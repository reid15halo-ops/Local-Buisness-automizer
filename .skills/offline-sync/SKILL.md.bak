---
name: offline-sync
description: |
  Offline-first PWA data synchronization for FreyAI Visions.
  Use this skill when the user asks about offline mode, IndexedDB, sync queue, conflict resolution,
  service worker caching, PWA offline, background sync, retry logic, connectivity detection,
  data persistence, offline fallback, cache strategy, stale-while-revalidate, sync failures,
  data loss prevention, queue processing, or says things like "offline", "sync", "IndexedDB",
  "service worker", "cache", "background sync", "retry", "conflict", "merge", "online/offline",
  "connectivity", "pending changes", "sync queue", "data integrity", "offline-first".
  Be pushy -- activate on ANY mention of offline, sync, or caching topics.
---

# Offline Sync Skill

Build and maintain offline-first data synchronization for FreyAI Visions PWA. The app serves German craftsmen (Handwerker) who work on job sites with unreliable connectivity. Every write must survive offline and sync cleanly when back online.

Read `references/sync-patterns.md` before implementing any sync-related feature -- it contains the project's established patterns, state machines, and pitfalls.

## 1. Architecture Overview

FreyAI uses a **dual-layer data access** pattern (see `js/services/db-service.js`):

```
User Action
    |
    v
DBService (single entry point)
    |
    +---> Try Supabase (if configured + online)
    |         |
    |         +---> Success: cache locally in IndexedDB, return data
    |         +---> Failure: fall through to IndexedDB
    |
    +---> IndexedDB (offline fallback + local cache)
              |
              +---> Read: return cached data
              +---> Write: save locally + add to sync_queue
              +---> sync_queue processed when connection restores
```

Key files:
- `js/services/db-service.js` -- DBService class, IndexedDB init, CRUD, sync queue, sync logic
- `js/services/sync-service.js` -- Higher-level sync coordination
- `js/services/store-service.js` -- Legacy key-value store (app_state)
- `service-worker.js` -- Cache strategies, background sync triggers, push notifications

## 2. IndexedDB Schema (Single Database, v3)

**Database**: `freyai_app_db` (version 3)

The project uses a **single IndexedDB database** with multiple object stores. This was a deliberate fix -- the original dual-database design caused race conditions and data loss. Never introduce a second database.

### Object Stores

| Store | KeyPath | Indices | Purpose |
|-------|---------|---------|---------|
| `app_state` | (out-of-line) | -- | Legacy key-value store for app settings |
| `users` | `id` | `name` | User profiles |
| `sync_queue` | `id` (autoIncrement) | `userId`, `synced`, `table` | Pending offline changes |
| `user_default_data` | (out-of-line) | -- | Default data templates |
| `customers` | `id` | `userId`, `email` | Kunden (cached from Supabase) |
| `invoices` | `id` | `userId`, `status`, `customerId` | Rechnungen |
| `quotes` | `id` | `userId`, `status` | Angebote |
| `orders` | `id` | `userId`, `status` | Auftraege |
| `jobs_queue` | `id` | `userId`, `status`, `jobType` | Background job queue |
| `communications` | `id` | `userId`, `status` | Email/SMS log cache |

### Why Single Database (Not Dual)

The original design had two IndexedDB databases: one for app state, one for user data. This caused:
- Race conditions during concurrent transactions across databases
- Version upgrade conflicts when both databases needed schema changes simultaneously
- Data loss when one database upgraded while the other held stale references

**Rule**: All stores live in `freyai_app_db`. Schema changes increment `this.version` and handle upgrades in `onupgradeneeded` with version gating (`if (oldVersion < N)`).

### Table Name Mapping

IndexedDB stores use English names; Supabase tables use German names:

```js
this._supabaseTableMap = {
    'customers': 'kunden',
    'invoices': 'rechnungen',
    'quotes': 'angebote',
    'orders': 'auftraege',
};
```

Always use `this._supabaseTable(storeName)` when building Supabase queries from IndexedDB store names.

## 3. Sync Queue Architecture

### Queue Entry Shape

```js
{
    id: <autoIncrement>,       // IndexedDB auto-generated
    table: 'customers',        // IndexedDB store name (English)
    action: 'insert' | 'update' | 'upsert' | 'delete',
    data: { ... },             // The entity payload
    userId: 'uuid',            // Owner
    synced: false,             // Becomes true after successful push
    syncedAt: null,            // Timestamp when synced
    retries: 0,                // Increment on failure, give up at 5
    timestamp: Date.now()      // When the change was made
}
```

### Queue Lifecycle

1. **Enqueue**: `addToSyncQueue(item)` -- called automatically when a write falls back to IndexedDB
2. **Process**: `_syncOfflineQueue()` -- triggered by:
   - `supabaseClient.onOnline()` callback (auto)
   - Service Worker `PROCESS_OFFLINE_QUEUE` message
   - Manual `syncNow()` call
3. **Per-item sync**: For each pending item, map table name, execute Supabase operation (upsert/update/delete)
4. **On success**: `markQueueItemSynced(queueId)` sets `synced: true`, `syncedAt: Date.now()`
5. **On failure**: `_incrementRetry(queueId)` bumps `retries`. Items with `retries >= 5` are excluded from future sync attempts.
6. **Cleanup**: `cleanupSyncedQueue()` deletes synced items older than 7 days

### Retry Logic (Not Silent Discard)

Previous bug: failed sync items were silently discarded. Current fix ensures:
- Failed items stay in queue with `synced: false`
- `retries` counter increments on each failure
- Items are retried on every sync cycle until `retries >= 5`
- After 5 failures, items remain in queue (not deleted) but are excluded from sync attempts
- Users can inspect failed items via `getUnsyncedQueue()`

**Never silently delete failed queue items.** If an item fails 5 times, it likely needs manual intervention (schema mismatch, RLS policy, etc.).

## 4. Conflict Resolution

### Current Strategy: Last-Write-Wins (LWW)

The project uses Supabase `upsert()` for inserts and updates, which implements last-write-wins at the database level. This is intentional for the target audience (small teams of 5-10 craftsmen).

### When to Use Merge Instead

For specific high-value entities (e.g., Angebote with line items), consider field-level merge:

```js
// Field-level merge: only overwrite fields that changed
async _mergeConflict(localItem, remoteItem) {
    const merged = { ...remoteItem };

    // Local wins for fields modified after remote's updated_at
    if (localItem.updated_at > remoteItem.updated_at) {
        // Copy locally-modified fields
        for (const key of localItem._dirtyFields || []) {
            merged[key] = localItem[key];
        }
    }

    merged.updated_at = new Date().toISOString();
    return merged;
}
```

### Timestamp Requirements

Every entity must have:
- `created_at` -- set on insert, never modified
- `updated_at` -- set on every update (both local and remote)

These timestamps are compared during conflict resolution. Use ISO 8601 format (`new Date().toISOString()`).

## 5. Service Worker Caching Strategy

File: `service-worker.js` (currently v34)

### Strategy Map

| Resource Type | Strategy | Rationale |
|--------------|----------|-----------|
| Static assets (HTML, CSS, JS, fonts, icons) | **Cache-first** (stale-while-revalidate) | Fast loads, background refresh |
| API calls (Supabase, Stripe, Google) | **Network-first** (cache fallback) | Fresh data preferred, cache for offline |
| Auth endpoints (`/auth/`, `token`) | **Network-first, never cached** | Security -- stale auth tokens are dangerous |
| Navigation requests (offline) | **Offline page fallback** | Shows `/offline.html` when network + cache both miss |

### Pre-cached Assets (App Shell)

The `STATIC_ASSETS` array in `service-worker.js` defines the app shell. When adding new pages or core JS files, add them to this array. Lazy-loaded services are cached on-demand by the fetch handler.

### Background Sync Tags

```js
// Register background sync from the app
navigator.serviceWorker.ready.then(reg => {
    reg.sync.register('sync-data');       // General data sync
    reg.sync.register('sync-invoices');   // Invoice-specific sync
    reg.sync.register('sync-time-entries'); // Time tracking sync
});
```

The Service Worker listens for these tags and posts `PROCESS_OFFLINE_QUEUE` messages to all clients, which triggers `DBService._syncOfflineQueue()`.

## 6. Connectivity Detection

### Online/Offline Transitions

```js
// In supabaseClient or app initialization
window.addEventListener('online', () => {
    console.log('[App] Back online -- triggering sync');
    window.dbService.syncNow();
});

window.addEventListener('offline', () => {
    console.log('[App] Gone offline -- writes will queue locally');
    // Show offline indicator in UI
});
```

### Checking Connectivity

Do not rely solely on `navigator.onLine` -- it only checks if the device has a network interface, not if it can reach Supabase. Use a health check:

```js
async function isSupabaseReachable() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000)
        });
        return response.ok;
    } catch {
        return false;
    }
}
```

## 7. Data Integrity Rules

1. **Every write goes through DBService** -- never write directly to IndexedDB or Supabase from feature modules
2. **Generate IDs client-side** -- use `DBService._generateId()` (timestamp + random) so offline-created entities have stable IDs before sync
3. **Cache on read** -- when Supabase returns data, always cache it in IndexedDB via `_cacheEntities()`
4. **Sync lock** -- `_syncInProgress` flag prevents concurrent sync cycles (would cause duplicate pushes)
5. **Listener notification** -- after sync, notify all listeners with `{ synced, failed, total }` so UI can update
6. **Queue cleanup** -- run `cleanupSyncedQueue()` periodically to prevent IndexedDB bloat (synced items older than 7 days)

## 8. Testing Offline Scenarios

### Manual Testing Checklist

1. Open app online, create a Kunde (customer)
2. Go offline (DevTools > Network > Offline, or airplane mode)
3. Create another Kunde, edit the first one, delete a third
4. Verify changes appear in local UI immediately
5. Check `sync_queue` in DevTools > Application > IndexedDB > freyai_app_db > sync_queue
6. Go back online
7. Verify sync processes (check console for `[DBService] Sync complete`)
8. Verify Supabase has all changes
9. Refresh page -- data should load from Supabase, matching local state

### Automated Testing

Use the testing skill (`/.skills/testing/`) for unit tests. Key areas:
- Mock IndexedDB with in-memory store
- Mock Supabase client with configurable success/failure
- Test dual-layer fallback (Supabase fail -> IndexedDB read)
- Test queue write on offline
- Test sync cycle processes all pending items
- Test retry counter increments on failure
- Test items with retries >= 5 are skipped

### Common Debugging Commands (Browser Console)

```js
// Check pending sync items
await window.dbService.getUnsyncedQueue();

// Force sync now
await window.dbService.syncNow();

// Check IndexedDB contents
const db = await indexedDB.open('freyai_app_db');
// ... inspect stores

// Check Service Worker cache
const cache = await caches.open('freyai-visions-v34');
const keys = await cache.keys();
console.log('Cached URLs:', keys.map(r => r.url));
```

## References

- `references/sync-patterns.md` -- Detailed sync flow diagrams, state machines, conflict resolution trees, IndexedDB transaction patterns, common pitfalls
