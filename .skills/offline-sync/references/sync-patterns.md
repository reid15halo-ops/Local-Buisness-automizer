# Sync Patterns Reference

Detailed patterns, state machines, and pitfalls for FreyAI offline sync architecture.

## 1. Sync Flow Diagram

### Write Operation (Online)

```
User clicks "Save Kunde"
        |
        v
DBService.saveCustomer(data)
        |
        v
   _getSupabase() --> client exists?
        |                    |
       YES                  NO
        |                    |
        v                    v
  supabase.from('kunden')   _idbOperation('customers', 'readwrite', ...)
  .upsert(data)                     |
        |                           v
   error?                   Save to IndexedDB
    |       |               + addToSyncQueue({
   YES     NO                   table: 'customers',
    |       |                   action: 'upsert',
    |       v                   data: data
    |  Cache in IndexedDB    })
    |  Return data               |
    |                            v
    +---> Fall through       Return data from IndexedDB
          to IndexedDB path
```

### Write Operation (Offline)

```
User clicks "Save Kunde" (offline)
        |
        v
DBService.saveCustomer(data)
        |
        v
   _getSupabase() --> null (offline or not configured)
        |
        v
   _idbOperation('customers', 'readwrite', put(data))
        |
        v
   addToSyncQueue({
       table: 'customers',
       action: 'upsert',
       data: { id: _generateId(), ...data },
       userId: _getCurrentUserId(),
       synced: false,
       retries: 0,
       timestamp: Date.now()
   })
        |
        v
   Return data (user sees it immediately)
```

### Read Operation (Dual-Layer Fallback)

```
DBService.getCustomers()
        |
        v
   _getSupabase() --> client exists + online?
        |                    |
       YES                  NO
        |                    |
        v                    v
  supabase.from('kunden')   _idbOperation('customers', 'readonly', getAll())
  .select('*')                      |
  .eq('user_id', userId)            v
        |                   Return cached data from IndexedDB
   error?
    |       |
   YES     NO
    |       |
    |       v
    |  _cacheEntities('customers', data)  <-- Update local cache
    |  Return fresh data from Supabase
    |
    +---> Fall through to IndexedDB read
```

## 2. Sync Queue State Machine

```
                    addToSyncQueue()
                          |
                          v
                    +-----------+
                    |  PENDING  |  synced: false, retries: 0
                    +-----------+
                          |
                    _syncOfflineQueue()
                          |
                          v
                    +-----------+
                    |  SYNCING  |  (in-flight, processing)
                    +-----------+
                       /     \
                  success    failure
                    /           \
                   v             v
            +-----------+   +-----------+
            |  SYNCED   |   |  FAILED   |  retries++
            +-----------+   +-----------+
            synced: true         |
            syncedAt: now        |  retries < 5?
                 |              / \
                 |           YES   NO
                 |            |     |
                 |            v     v
                 |      +-----------+   +-----------+
                 |      |  PENDING  |   | EXHAUSTED |  retries >= 5
                 |      +-----------+   +-----------+
                 |      (retry next      (stays in queue,
                 |       sync cycle)      excluded from sync)
                 |
                 v
         cleanupSyncedQueue()
         (after 7 days)
                 |
                 v
            +-----------+
            |  DELETED  |  Removed from IndexedDB
            +-----------+
```

### State Transitions

| From | To | Trigger | Action |
|------|----|---------|--------|
| -- | PENDING | Write while offline | `addToSyncQueue()` |
| PENDING | SYNCING | Sync cycle starts | `_syncOfflineQueue()` processes item |
| SYNCING | SYNCED | Supabase accepts write | `markQueueItemSynced(id)` |
| SYNCING | FAILED | Supabase returns error | `_incrementRetry(id)` |
| FAILED | PENDING | Next sync cycle | Automatic (retries < 5) |
| FAILED | EXHAUSTED | retries >= 5 | Excluded by `getUnsyncedQueue()` filter |
| SYNCED | DELETED | 7+ days old | `cleanupSyncedQueue()` |

## 3. Conflict Resolution Decision Tree

```
Sync queue item ready to push
        |
        v
   What action?
    /    |    \
insert update delete
   |     |      |
   v     v      v
 upsert()  Check remote updated_at    delete().eq('id')
   |              |                        |
   |         Remote exists?                |
   |          /       \                    |
   |        YES       NO                   |
   |         |         |                   |
   |    Compare         v                  |
   |    timestamps   Insert instead        |
   |      |                                |
   |  local.updated_at > remote.updated_at?
   |    /           \
   |  YES           NO
   |   |             |
   |   v             v
   | Push local   Remote wins (skip local update,
   | changes      re-fetch remote into IndexedDB cache)
   |
   v
 Done
```

### Conflict Resolution Rules

1. **Insert conflicts**: Use `upsert()` -- if ID already exists, Supabase overwrites. Client-generated IDs (timestamp+random) make collisions near-impossible.
2. **Update conflicts**: Currently last-write-wins via `upsert()`. For future field-level merge, track `_dirtyFields` on local entities.
3. **Delete conflicts**: If remote already deleted (404), treat as success. If remote was updated after local delete, delete still wins (destructive action is intentional).
4. **Orphaned references**: If a Kunde is deleted but their Rechnungen still exist, Supabase foreign keys will cascade or restrict based on schema. Never delete parent entities without checking children.

## 4. IndexedDB Transaction Patterns

### Pattern: Single Store Read

```js
async _idbOperation(storeName, mode, operation) {
    await this._ensureDB();

    if (!this.db.objectStoreNames.contains(storeName)) {
        console.warn(`[DBService] Store '${storeName}' not found`);
        return null;
    }

    return new Promise((resolve, reject) => {
        const tx = this.db.transaction([storeName], mode);
        const store = tx.objectStore(storeName);
        const result = operation(store);

        if (result instanceof IDBRequest) {
            result.onsuccess = () => resolve(result.result);
            result.onerror = () => reject(result.error);
        } else {
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
        }
    });
}
```

### Pattern: Multi-Store Transaction (Sync Queue + Entity)

When writing an entity offline, you need to update both the entity store AND the sync queue in a single transaction to prevent partial writes:

```js
async _offlineWrite(storeName, action, data) {
    await this._ensureDB();

    return new Promise((resolve, reject) => {
        // Single transaction spanning both stores
        const tx = this.db.transaction([storeName, 'sync_queue'], 'readwrite');

        // Write entity
        const entityStore = tx.objectStore(storeName);
        entityStore.put(data);

        // Queue sync entry
        const syncStore = tx.objectStore('sync_queue');
        syncStore.add({
            table: storeName,
            action: action,
            data: data,
            userId: this._getCurrentUserId(),
            synced: false,
            retries: 0,
            timestamp: Date.now()
        });

        tx.oncomplete = () => resolve(data);
        tx.onerror = () => reject(tx.error);
    });
}
```

### Pattern: Index Query

```js
// Get all unsynced items
const index = store.index('synced');
const request = index.getAll(false);  // false = synced === false

// Get items for a specific user
const index = store.index('userId');
const request = index.getAll(userId);

// Get items by status
const index = store.index('status');
const request = index.getAll('draft');
```

### Pattern: Cursor Iteration (Cleanup)

```js
// Delete synced items older than 7 days
const request = store.openCursor();
request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
        const item = cursor.value;
        if (item.synced && item.syncedAt < cutoffTimestamp) {
            cursor.delete();
        }
        cursor.continue();
    }
};
```

## 5. Common Pitfalls and Solutions

### Pitfall 1: Dual IndexedDB Databases

**Problem**: Opening two separate IndexedDB databases causes version upgrade race conditions and data loss.

**Solution**: Single database (`freyai_app_db`) with multiple object stores. All schema changes go through the `onupgradeneeded` handler with version gating.

**Rule**: Never call `indexedDB.open()` with a different database name. Always go through `DBService.init()`.

### Pitfall 2: Silent Discard of Failed Sync Items

**Problem**: Original code deleted sync queue items on failure, losing offline changes permanently.

**Solution**: Failed items stay in queue with incrementing `retries` counter. Items with `retries >= 5` are excluded from sync but NOT deleted. They remain inspectable for manual resolution.

**Rule**: Never delete a sync queue item unless it has been successfully synced AND is older than the cleanup threshold (7 days).

### Pitfall 3: Concurrent Sync Cycles

**Problem**: Multiple calls to `_syncOfflineQueue()` process the same items simultaneously, causing duplicate writes to Supabase.

**Solution**: `_syncInProgress` boolean flag. If sync is already running, subsequent calls return immediately.

```js
async _syncOfflineQueue() {
    if (this._syncInProgress) { return; }  // Guard
    this._syncInProgress = true;
    try {
        // ... process queue
    } finally {
        this._syncInProgress = false;  // Always release
    }
}
```

### Pitfall 4: Missing Table Name Mapping

**Problem**: IndexedDB uses English store names (`customers`), but Supabase uses German table names (`kunden`). Pushing to `supabase.from('customers')` fails with table-not-found.

**Solution**: Always use `this._supabaseTable(storeName)` to map before Supabase queries.

### Pitfall 5: Stale IndexedDB Cache After Remote Changes

**Problem**: Another device updates a record in Supabase. The local IndexedDB cache still has the old version. User sees stale data.

**Solution**: On every successful Supabase read, overwrite the IndexedDB cache via `_cacheEntities()`. Consider Supabase Realtime subscriptions for push-based cache invalidation in high-traffic scenarios.

### Pitfall 6: IndexedDB Transaction Auto-Commit

**Problem**: IndexedDB transactions auto-commit when the event loop is idle. If you `await` a network call inside a transaction, the transaction closes before you can write.

**Solution**: Never perform async network operations inside an IndexedDB transaction. Structure code as:
1. Read from IndexedDB (transaction 1)
2. Make network call (no transaction)
3. Write results to IndexedDB (transaction 2)

### Pitfall 7: Service Worker Cache Versioning

**Problem**: Updating `CACHE_NAME` without updating `STATIC_ASSETS` leaves stale files in the new cache.

**Solution**: Always bump `CACHE_NAME` version when changing cached assets. The `activate` handler deletes old caches automatically.

### Pitfall 8: navigator.onLine False Positives

**Problem**: `navigator.onLine` returns `true` when connected to WiFi with no internet (captive portal, no upstream).

**Solution**: Supplement with actual fetch-based health checks. The `online` event triggers sync, but sync will gracefully fail and retry if the server is unreachable.

### Pitfall 9: Client-Side ID Collisions

**Problem**: Two devices create entities offline with colliding IDs.

**Solution**: `DBService._generateId()` uses `Date.now().toString(36) + Math.random().toString(36).substring(2, 11)`. The combination of millisecond timestamp + 9 random chars makes collisions statistically negligible for the target user base (5-10 employees).

### Pitfall 10: Large Sync Queues After Extended Offline

**Problem**: Craftsman works offline for days, accumulates hundreds of queue items. Sync takes too long and times out.

**Solution**: Process queue items sequentially (current behavior). If needed, batch items by table and use bulk upsert. Monitor queue size and warn users when it exceeds 50 items.
