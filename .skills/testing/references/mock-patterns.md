# Mock Patterns for FreyAI Visions Tests

Reusable mock setups for the most common dependencies. Copy and adapt these into your test files.

## localStorage Mock

Used by almost every service. Provides a functional in-memory store.

```js
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = localStorageMock;
```

## Supabase Client Mock

For services that call `window.supabaseConfig.get()` to obtain the client.

```js
const mockSupabaseClient = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn()
  },
  from: vi.fn((table) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn()
  })),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null })
};

window.supabaseConfig = {
  get: vi.fn(() => mockSupabaseClient),
  isConfigured: vi.fn(() => true)
};
```

### Chaining Pattern for Supabase Queries

When a service chains `.from().select().eq()`, mock the chain to return data at the terminal call:

```js
// Success case
const mockChain = {
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({
      data: [{ id: '1', name: 'Test Kunde' }],
      error: null
    })
  })
};
mockSupabaseClient.from.mockReturnValue(mockChain);

// Error case
const mockErrorChain = {
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Row not found', code: 'PGRST116' }
    })
  })
};
mockSupabaseClient.from.mockReturnValue(mockErrorChain);

// Insert
const mockInsertChain = {
  insert: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: 'new-id', name: 'Neuer Kunde' },
        error: null
      })
    })
  })
};
mockSupabaseClient.from.mockReturnValue(mockInsertChain);
```

## IndexedDB Mock

For services that use `DBService` or direct IndexedDB access.

```js
const mockDbService = {
  userData: new Map(),
  getUserData: vi.fn(async (userId, key) => {
    return mockDbService.userData.get(`${userId}:${key}`);
  }),
  setUserData: vi.fn(async (userId, key, data) => {
    mockDbService.userData.set(`${userId}:${key}`, JSON.parse(JSON.stringify(data)));
  }),
  get: vi.fn(async (key) => {
    return mockDbService.userData.get(`default:${key}`);
  }),
  set: vi.fn(async (key, data) => {
    mockDbService.userData.set(`default:${key}`, JSON.parse(JSON.stringify(data)));
  }),
  clearUserData: vi.fn(async (userId) => {
    const keysToDelete = Array.from(mockDbService.userData.keys()).filter(k => k.startsWith(`${userId}:`));
    keysToDelete.forEach(k => mockDbService.userData.delete(k));
  }),
  // Sync queue methods
  addToSyncQueue: vi.fn(async (entry) => {
    const queue = mockDbService.userData.get('sync_queue') || [];
    queue.push({ ...entry, id: Date.now(), synced: false });
    mockDbService.userData.set('sync_queue', queue);
  }),
  getSyncQueue: vi.fn(async () => {
    return mockDbService.userData.get('sync_queue') || [];
  }),
  clearSyncQueue: vi.fn(async () => {
    mockDbService.userData.set('sync_queue', []);
  })
};

window.dbService = mockDbService;
```

## Window Globals Mock

Many services read from `window.*`. Set up the common globals:

```js
// Auth state
window.authService = {
  getUser: vi.fn(() => ({ id: 'user-123', email: 'test@example.com' })),
  isLoggedIn: vi.fn(() => true),
  getSession: vi.fn(async () => ({ access_token: 'mock-token' })),
  onAuthChange: vi.fn()
};

// Error handler (used by many services for logging)
window.errorHandler = {
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
};

// Demo data service (for store-service tests)
window.demoDataService = {
  getDemoData: vi.fn(() => ({
    anfragen: [],
    angebote: [],
    auftraege: [],
    rechnungen: [],
    activities: []
  }))
};

// User manager
window.userManager = {
  onUserChange: vi.fn(),
  getCurrentUser: vi.fn(() => ({ id: 'user-123' }))
};
```

## window.location Mock

For services that use `window.location`:

```js
delete window.location;
window.location = {
  origin: 'http://localhost',
  href: 'http://localhost/index.html',
  pathname: '/index.html',
  search: '',
  hash: '',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn()
};
```

## Cleanup Pattern

Always reset mocks between tests to prevent leakage:

```js
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockDbService.userData.clear();
  // Re-instantiate service fresh
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

## Testing Offline-Sync Behavior

Pattern for testing the dual-layer (Supabase + IndexedDB) flow:

```js
describe('Offline sync', () => {
  it('should fall back to IndexedDB when Supabase fails', async () => {
    // Simulate Supabase offline
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockRejectedValue(new Error('Network error'))
    });

    // IndexedDB has cached data
    mockDbService.getUserData.mockResolvedValue([{ id: '1', name: 'Cached' }]);

    const result = await service.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Cached');
  });

  it('should queue changes when offline', async () => {
    // Simulate offline write
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockRejectedValue(new Error('Network error'))
    });

    await service.create({ name: 'Offline Item' });

    // Verify queued for sync
    expect(mockDbService.addToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ table: expect.any(String), operation: 'insert' })
    );
  });

  it('should sync queued changes when back online', async () => {
    // Setup: items in sync queue
    mockDbService.getSyncQueue.mockResolvedValue([
      { id: 1, table: 'kunden', operation: 'insert', data: { name: 'Queued' }, synced: false }
    ]);

    // Simulate coming back online
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: { id: 'synced-1' }, error: null })
    });

    await service.syncOfflineQueue();

    expect(mockDbService.clearSyncQueue).toHaveBeenCalled();
  });
});
```

## Financial Test Helpers

For bookkeeping / invoice / DATEV tests with EUR precision:

```js
// Always test with EUR rounding edge cases
const eurTestCases = [
  { input: 19.995, expected: 20.00 },  // Round up
  { input: 19.994, expected: 19.99 },  // Round down
  { input: 0.1 + 0.2, expected: 0.30 }, // Float precision
];

// German number format assertions
expect(service.formatCurrency(1234.56)).toBe('1.234,56 EUR');
expect(service.formatCurrency(0)).toBe('0,00 EUR');
```
