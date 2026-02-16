/* ============================================
   Database Service (IndexedDB) - v2
   Multi-User Support with Isolated Data Stores
   ============================================ */

class DBService {
    constructor() {
        this.dbName = 'mhs_app_db';
        this.storeName = 'app_state'; // Legacy, kept for backward compatibility
        this.version = 2; // ⬆️ Upgraded to v2
        this.db = null;
        this.userStores = new Set(); // Track created user stores
    }

    /**
     * Initializes the IndexedDB database with Multi-User support.
     * @returns {Promise<IDBDatabase>}
     */
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                const transaction = event.target.transaction;

                console.log(`DB upgrade: ${oldVersion} → ${this.version}`);

                // === Version 1 → Version 2 Migration ===
                if (oldVersion < 2) {
                    // Create new stores
                    if (!db.objectStoreNames.contains('users')) {
                        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
                        usersStore.createIndex('name', 'name', { unique: false });
                        console.log('Created: users store');
                    }

                    if (!db.objectStoreNames.contains('sync_queue')) {
                        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
                        syncStore.createIndex('userId', 'userId', { unique: false });
                        syncStore.createIndex('synced', 'synced', { unique: false });
                        console.log('Created: sync_queue store');
                    }

                    // Migrate existing app_state → user_default_data
                    if (!db.objectStoreNames.contains('user_default_data')) {
                        db.createObjectStore('user_default_data');
                        console.log('Created: user_default_data store');

                        // Copy data from old app_state to user_default_data
                        if (db.objectStoreNames.contains('app_state')) {
                            const oldStore = transaction.objectStore('app_state');
                            const newStore = transaction.objectStore('user_default_data');

                            const getAllRequest = oldStore.getAll();
                            const getAllKeysRequest = oldStore.getAllKeys();

                            getAllRequest.onsuccess = () => {
                                const values = getAllRequest.result;
                                const keys = getAllKeysRequest.result;

                                keys.forEach((key, index) => {
                                    newStore.put(values[index], key);
                                });
                                console.log('Migrated app_state → user_default_data');
                            };
                        }
                    }
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB v2 initialized successfully');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // ========================================
    // Legacy Methods (for backward compatibility)
    // ========================================

    /**
     * Gets a value by key from the legacy app_state store.
     * @deprecated Use getUserData() instead
     * @param {string} key
     * @returns {Promise<any>}
     */
    async get(key) {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Sets a value for a key in the legacy app_state store.
     * @deprecated Use setUserData() instead
     * @param {string} key
     * @param {any} value
     * @returns {Promise<void>}
     */
    async set(key, value) {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clears all data in the legacy app_state store.
     * @deprecated Use clearUserData() instead
     * @returns {Promise<void>}
     */
    async clear() {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ========================================
    // Multi-User Methods (v2)
    // ========================================

    /**
     * Creates a new user-specific data store dynamically.
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async createUserStore(userId) {
        const storeName = `user_${userId}_data`;

        // Check if already exists in DB
        if (this.db.objectStoreNames.contains(storeName)) {
            this.userStores.add(storeName);
            return;
        }

        // Need to upgrade DB version to add new store
        this.db.close();
        this.version++;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                    console.log(`Created: ${storeName}`);
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.userStores.add(storeName);
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Gets user-specific data by key.
     * @param {string} userId - User ID
     * @param {string} key - Data key
     * @returns {Promise<any>}
     */
    async getUserData(userId, key) {
        if (!this.db) {await this.init();}
        const storeName = `user_${userId}_data`;

        // Ensure store exists
        if (!this.db.objectStoreNames.contains(storeName)) {
            await this.createUserStore(userId);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Sets user-specific data.
     * @param {string} userId - User ID
     * @param {string} key - Data key
     * @param {any} value - Data value
     * @returns {Promise<void>}
     */
    async setUserData(userId, key, value) {
        if (!this.db) {await this.init();}
        const storeName = `user_${userId}_data`;

        // Ensure store exists
        if (!this.db.objectStoreNames.contains(storeName)) {
            await this.createUserStore(userId);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(value, key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clears all data for a specific user.
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async clearUserData(userId) {
        if (!this.db) {await this.init();}
        const storeName = `user_${userId}_data`;

        if (!this.db.objectStoreNames.contains(storeName)) {
            return; // Nothing to clear
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ========================================
    // User Management Methods
    // ========================================

    /**
     * Gets all users from the users store.
     * @returns {Promise<Array>}
     */
    async getAllUsers() {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Gets a user by ID.
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async getUser(userId) {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(userId);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Creates or updates a user.
     * @param {Object} user - User object with id, name, pin_hash, avatar, created_at
     * @returns {Promise<void>}
     */
    async saveUser(user) {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put(user);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Deletes a user and their associated data store.
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async deleteUser(userId) {
        if (!this.db) {await this.init();}

        // Delete user record
        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.delete(userId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        // Clear user data
        await this.clearUserData(userId);
    }

    // ========================================
    // Sync Queue Methods
    // ========================================

    /**
     * Adds an item to the sync queue.
     * @param {Object} item - Queue item { userId, action, table, data, timestamp, synced, retries }
     * @returns {Promise<number>} The auto-generated ID
     */
    async addToSyncQueue(item) {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.add({
                ...item,
                synced: false,
                retries: 0,
                timestamp: item.timestamp || Date.now()
            });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Gets all unsynced items from the queue.
     * @param {string} userId - Optional: filter by user ID
     * @returns {Promise<Array>}
     */
    async getUnsyncedQueue(userId = null) {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const index = store.index('synced');
            const request = index.getAll(false);

            request.onsuccess = () => {
                let results = request.result || [];
                if (userId) {
                    results = results.filter(item => item.userId === userId);
                }
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Marks a queue item as synced.
     * @param {number} queueId
     * @returns {Promise<void>}
     */
    async markQueueItemSynced(queueId) {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const getRequest = store.get(queueId);

            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    item.synced = true;
                    item.syncedAt = Date.now();
                    store.put(item);
                }
                resolve();
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Deletes a queue item.
     * @param {number} queueId
     * @returns {Promise<void>}
     */
    async deleteQueueItem(queueId) {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.delete(queueId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clears all synced items older than a given time.
     * @param {number} olderThanMs - Timestamp in milliseconds
     * @returns {Promise<number>} Number of deleted items
     */
    async cleanupSyncedQueue(olderThanMs = Date.now() - 7 * 24 * 60 * 60 * 1000) {
        if (!this.db) {await this.init();}
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.openCursor();
            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const item = cursor.value;
                    if (item.synced && item.syncedAt < olderThanMs) {
                        cursor.delete();
                        deletedCount++;
                    }
                    cursor.continue();
                } else {
                    resolve(deletedCount);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }
}

window.dbService = new DBService();
