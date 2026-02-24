/* ============================================
   Realtime Service
   Supabase Realtime subscription manager
   FreyAI Visions - 95/5 Architecture
   
   Manages all WebSocket subscriptions to
   Supabase Realtime channels. Provides clean
   subscribe/unsubscribe API. Falls back
   gracefully when Supabase not configured.
   ============================================ */

class RealtimeService {
    constructor() {
        /** @type {Map<string, Object>} channelName -> Supabase channel */
        this.channels = new Map();
        /** @type {Map<string, Function[]>} channelName -> listener array */
        this.listeners = new Map();
        /** @type {boolean} */
        this._initialized = false;
        /** @type {string|null} */
        this._currentUserId = null;

        // Re-subscribe when connection is restored
        if (window.supabaseClient) {
            window.supabaseClient.onOnline(() => this._resubscribeAll());
        }
    }

    /**
     * Ensure Supabase is available and return the client, or null.
     * @returns {import('@supabase/supabase-js').SupabaseClient|null}
     */
    _getClient() {
        if (window.supabaseClient && window.supabaseClient.isConfigured()) {
            return window.supabaseClient.client;
        }
        return null;
    }

    _getUserId() {
        if (this._currentUserId) { return this._currentUserId; }
        if (window.authService && window.authService.getUser()) {
            return window.authService.getUser().id;
        }
        if (window.userManager && window.userManager.getCurrentUser()) {
            return window.userManager.getCurrentUser().id;
        }
        return 'default';
    }

    /**
     * Subscribe to jobs_queue table changes for a user.
     * Fires callback whenever a job is inserted, updated, or deleted.
     * 
     * @param {string} userId - The user's ID to filter by
     * @param {Function} onUpdate - callback(payload: { eventType, new, old })
     * @returns {Function} Unsubscribe function
     */
    subscribeToJobQueue(userId, onUpdate) {
        const channelName = `jobs_queue:${userId}`;
        this._currentUserId = userId;

        const listener = onUpdate;
        this._addListener(channelName, listener);

        const client = this._getClient();
        if (!client) {
            console.info('[RealtimeService] Supabase not configured — job queue updates via polling.');
            return () => this._removeListener(channelName, listener);
        }

        // Only create channel once per name
        if (!this.channels.has(channelName)) {
            this._createJobQueueChannel(channelName, userId);
        }

        return () => {
            this._removeListener(channelName, listener);
            // Unsubscribe channel if no more listeners
            if (!this.listeners.get(channelName) || this.listeners.get(channelName).length === 0) {
                this.unsubscribe(channelName);
            }
        };
    }

    _createJobQueueChannel(channelName, userId) {
        const client = this._getClient();
        if (!client) { return; }

        try {
            const channel = client
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'jobs_queue',
                        filter: `user_id=eq.${userId}`
                    },
                    (payload) => {
                        console.debug('[RealtimeService] jobs_queue change:', payload.eventType, payload.new?.id);
                        const listeners = this.listeners.get(channelName) || [];
                        listeners.forEach(cb => {
                            try { cb(payload); } catch (e) { console.error('[RealtimeService] Listener error:', e); }
                        });
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.info(`[RealtimeService] Subscribed to ${channelName}`);
                    } else if (status === 'CHANNEL_ERROR') {
                        console.warn(`[RealtimeService] Channel error on ${channelName}`);
                    } else if (status === 'TIMED_OUT') {
                        console.warn(`[RealtimeService] Timed out on ${channelName}`);
                    }
                });

            this.channels.set(channelName, channel);
        } catch (err) {
            console.error('[RealtimeService] Failed to create job queue channel:', err);
        }
    }

    /**
     * Subscribe to invoice status changes for a user.
     * 
     * @param {string} userId
     * @param {Function} onUpdate - callback(payload)
     * @returns {Function} Unsubscribe function
     */
    subscribeToInvoices(userId, onUpdate) {
        const channelName = `invoices:${userId}`;
        this._currentUserId = userId;

        this._addListener(channelName, onUpdate);

        const client = this._getClient();
        if (!client) {
            console.info('[RealtimeService] Supabase not configured — invoice updates unavailable.');
            return () => this._removeListener(channelName, onUpdate);
        }

        if (!this.channels.has(channelName)) {
            try {
                const channel = client
                    .channel(channelName)
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'invoices',
                            filter: `user_id=eq.${userId}`
                        },
                        (payload) => {
                            console.debug('[RealtimeService] invoice change:', payload.eventType, payload.new?.id);
                            const listeners = this.listeners.get(channelName) || [];
                            listeners.forEach(cb => {
                                try { cb(payload); } catch (e) { console.error('[RealtimeService] Listener error:', e); }
                            });
                        }
                    )
                    .subscribe((status) => {
                        console.info(`[RealtimeService] invoices channel status: ${status}`);
                    });

                this.channels.set(channelName, channel);
            } catch (err) {
                console.error('[RealtimeService] Failed to create invoices channel:', err);
            }
        }

        return () => {
            this._removeListener(channelName, onUpdate);
            if (!this.listeners.get(channelName) || this.listeners.get(channelName).length === 0) {
                this.unsubscribe(channelName);
            }
        };
    }

    /**
     * Subscribe to push notifications for a user.
     * Uses a dedicated 'notifications' table or broadcasts.
     * 
     * @param {string} userId
     * @param {Function} onNotification - callback(notification)
     * @returns {Function} Unsubscribe function
     */
    subscribeToNotifications(userId, onNotification) {
        const channelName = `notifications:${userId}`;
        this._currentUserId = userId;

        this._addListener(channelName, onNotification);

        const client = this._getClient();
        if (!client) {
            console.info('[RealtimeService] Supabase not configured — push notifications unavailable.');
            return () => this._removeListener(channelName, onNotification);
        }

        if (!this.channels.has(channelName)) {
            try {
                // Use broadcast for lightweight notifications + postgres changes for persistent ones
                const channel = client
                    .channel(channelName)
                    // Broadcast: ephemeral real-time messages
                    .on('broadcast', { event: 'notification' }, (payload) => {
                        const listeners = this.listeners.get(channelName) || [];
                        listeners.forEach(cb => {
                            try { cb({ type: 'broadcast', ...payload.payload }); } catch (e) {}
                        });
                    })
                    // Postgres: persistent notification records
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'notifications',
                            filter: `user_id=eq.${userId}`
                        },
                        (payload) => {
                            const listeners = this.listeners.get(channelName) || [];
                            listeners.forEach(cb => {
                                try { cb({ type: 'persistent', ...payload.new }); } catch (e) {}
                            });
                        }
                    )
                    .subscribe((status) => {
                        console.info(`[RealtimeService] notifications channel status: ${status}`);
                    });

                this.channels.set(channelName, channel);
            } catch (err) {
                console.error('[RealtimeService] Failed to create notifications channel:', err);
            }
        }

        return () => {
            this._removeListener(channelName, onNotification);
            if (!this.listeners.get(channelName) || this.listeners.get(channelName).length === 0) {
                this.unsubscribe(channelName);
            }
        };
    }

    /**
     * Subscribe to any table with custom filter.
     * Low-level method for advanced use cases.
     * 
     * @param {string} channelName - Unique channel name
     * @param {string} table - Supabase table name
     * @param {string} event - 'INSERT' | 'UPDATE' | 'DELETE' | '*'
     * @param {string|null} filter - e.g. 'user_id=eq.abc'
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribeToTable(channelName, table, event, filter, callback) {
        this._addListener(channelName, callback);

        const client = this._getClient();
        if (!client) {
            return () => this._removeListener(channelName, callback);
        }

        if (!this.channels.has(channelName)) {
            try {
                const changeConfig = {
                    event,
                    schema: 'public',
                    table
                };
                if (filter) { changeConfig.filter = filter; }

                const channel = client
                    .channel(channelName)
                    .on('postgres_changes', changeConfig, (payload) => {
                        const listeners = this.listeners.get(channelName) || [];
                        listeners.forEach(cb => { try { cb(payload); } catch (e) {} });
                    })
                    .subscribe();

                this.channels.set(channelName, channel);
            } catch (err) {
                console.error(`[RealtimeService] Failed to subscribe to ${table}:`, err);
            }
        }

        return () => {
            this._removeListener(channelName, callback);
            if (!this.listeners.get(channelName) || this.listeners.get(channelName).length === 0) {
                this.unsubscribe(channelName);
            }
        };
    }

    /**
     * Unsubscribe from a specific channel and clean it up.
     * @param {string} channelName
     */
    unsubscribe(channelName) {
        const channel = this.channels.get(channelName);
        if (channel) {
            const client = this._getClient();
            if (client) {
                try {
                    client.removeChannel(channel);
                } catch (err) {
                    console.warn(`[RealtimeService] Error removing channel ${channelName}:`, err);
                }
            }
            this.channels.delete(channelName);
        }
        this.listeners.delete(channelName);
        console.info(`[RealtimeService] Unsubscribed from ${channelName}`);
    }

    /**
     * Unsubscribe from all channels (call on user logout / app destroy).
     */
    unsubscribeAll() {
        const client = this._getClient();
        this.channels.forEach((channel, name) => {
            if (client) {
                try { client.removeChannel(channel); } catch (e) {}
            }
            console.info(`[RealtimeService] Unsubscribed from ${name}`);
        });
        this.channels.clear();
        this.listeners.clear();
    }

    /**
     * Re-subscribe all existing channels (called after connection restore).
     * @private
     */
    _resubscribeAll() {
        console.info('[RealtimeService] Connection restored, re-subscribing to all channels...');
        const existingChannels = new Map(this.channels);
        // Clear and rebuild
        this.channels.clear();

        // Re-establish active subscriptions
        // Each channel will be re-created by the next subscription call
        // Since listeners are still in this.listeners, we just need to rebuild channels
        existingChannels.forEach((channel, channelName) => {
            const parts = channelName.split(':');
            const type = parts[0];
            const userId = parts[1];

            if (!userId) { return; }

            if (type === 'jobs_queue') {
                this._createJobQueueChannel(channelName, userId);
            } else if (type === 'invoices') {
                // Rebuild invoices channel
                this.subscribeToInvoices(userId, () => {});
            }
            // Other channel types will rebuild on next use
        });
    }

    // ========================================
    // Internal listener management
    // ========================================

    _addListener(channelName, callback) {
        if (!this.listeners.has(channelName)) {
            this.listeners.set(channelName, []);
        }
        this.listeners.get(channelName).push(callback);
    }

    _removeListener(channelName, callback) {
        if (!this.listeners.has(channelName)) { return; }
        const filtered = this.listeners.get(channelName).filter(cb => cb !== callback);
        this.listeners.set(channelName, filtered);
    }

    /**
     * Get the current number of active subscriptions.
     * @returns {number}
     */
    getSubscriptionCount() {
        return this.channels.size;
    }

    /**
     * Get all active channel names.
     * @returns {string[]}
     */
    getActiveChannels() {
        return Array.from(this.channels.keys());
    }
}

window.realtimeService = new RealtimeService();
