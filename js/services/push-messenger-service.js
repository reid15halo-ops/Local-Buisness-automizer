/* ============================================
   Push Messenger Service
   Sends critical alerts via Telegram Bot API
   and/or WhatsApp (via Twilio).
   Configurable via Admin Panel (Developer tier).
   ============================================ */

class PushMessengerService {
    constructor() {
        this.STORAGE_KEY = 'freyai_push_messenger';
        this.SENT_LOG_KEY = 'freyai_push_sent_log';
        this.config = this._loadConfig();
        this.sentLog = this._loadSentLog();
    }

    /* ===== PUBLIC API ===== */

    /**
     * Send an alert message via all configured channels
     * @param {string} message - The alert message text
     * @param {string} priority - 'critical' | 'high' | 'normal'
     * @returns {Promise<Object>} Results per channel
     */
    async sendAlert(message, priority = 'critical') {
        const results = {};

        // Dedup: don't send the same message within 1 hour
        const msgHash = this._hashMessage(message);
        if (this._wasSentRecently(msgHash)) {
            console.log('PushMessenger: Skipping duplicate message (sent within 1h)');
            return { skipped: true };
        }

        // Telegram
        if (this.config.telegram?.enabled && this.config.telegram?.botToken && this.config.telegram?.chatId) {
            results.telegram = await this._sendTelegram(message);
        }

        // WhatsApp via Twilio
        if (this.config.whatsapp?.enabled && this.config.whatsapp?.accountSid) {
            results.whatsapp = await this._sendWhatsApp(message);
        }

        // Log sent message
        if (!results.skipped) {
            this._logSent(msgHash);
        }

        return results;
    }

    /**
     * Test the connection for a specific channel
     * @param {string} channel - 'telegram' | 'whatsapp'
     * @returns {Promise<Object>} { success: boolean, error?: string }
     */
    async testConnection(channel) {
        const testMsg = '✅ FreyAI Visions — Test-Nachricht erfolgreich!\n\nIhre Benachrichtigungen sind aktiv.';

        if (channel === 'telegram') {
            return this._sendTelegram(testMsg);
        } else if (channel === 'whatsapp') {
            return this._sendWhatsApp(testMsg);
        }

        return { success: false, error: 'Unknown channel' };
    }

    /**
     * Get current configuration
     * @returns {Object}
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update configuration
     * @param {Object} newConfig
     */
    saveConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    }

    /**
     * Check if any channel is configured and enabled
     * @returns {boolean}
     */
    isConfigured() {
        return (
            (this.config.telegram?.enabled && this.config.telegram?.botToken && this.config.telegram?.chatId) ||
            (this.config.whatsapp?.enabled && this.config.whatsapp?.accountSid)
        );
    }

    /* ===== TELEGRAM ===== */

    /**
     * Send notification via Supabase Edge Function (send-notification).
     * Bot tokens and API keys are stored server-side, NOT client-side.
     */
    async _sendViaEdgeFunction(channel, message) {
        const supabase = window.supabaseConfig?.get();
        if (!supabase) {throw new Error('Supabase nicht konfiguriert');}

        try {
            const { data, error } = await supabase.functions.invoke('send-notification', {
                body: {
                    channel,
                    message,
                    chatId: this.config.telegram?.chatId || undefined,
                    toNumber: this.config.whatsapp?.toNumber || undefined
                }
            });

            if (error) {
                console.error(`PushMessenger: ${channel} Edge Function error:`, error);
                return { success: false, error: error.message };
            }

            if (data?.success) {
                console.log(`PushMessenger: ${channel} message sent via Edge Function`);
                return { success: true };
            } else {
                console.error(`PushMessenger: ${channel} error:`, data?.error);
                return { success: false, error: data?.error || 'Unbekannter Fehler' };
            }
        } catch (error) {
            console.error(`PushMessenger: ${channel} send failed:`, error);
            return { success: false, error: error.message };
        }
    }

    async _sendTelegram(message) {
        return this._sendViaEdgeFunction('telegram', message);
    }

    /* ===== WHATSAPP VIA EDGE FUNCTION ===== */

    async _sendWhatsApp(message) {
        return this._sendViaEdgeFunction('whatsapp', message);
    }

    /* ===== DEDUPLICATION ===== */

    _hashMessage(msg) {
        // Simple hash for dedup (not cryptographic)
        let hash = 0;
        for (let i = 0; i < msg.length; i++) {
            const char = msg.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return `msg_${hash}`;
    }

    _wasSentRecently(hash) {
        const entry = this.sentLog[hash];
        if (!entry) { return false; }
        const hourAgo = Date.now() - (60 * 60 * 1000);
        return entry > hourAgo;
    }

    _logSent(hash) {
        this.sentLog[hash] = Date.now();
        // Clean old entries
        const hourAgo = Date.now() - (60 * 60 * 1000);
        Object.keys(this.sentLog).forEach(key => {
            if (this.sentLog[key] < hourAgo) { delete this.sentLog[key]; }
        });
        try {
            localStorage.setItem(this.SENT_LOG_KEY, JSON.stringify(this.sentLog));
        } catch (e) { /* ignore */ }
    }

    /* ===== PERSISTENCE ===== */

    _loadConfig() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) { return JSON.parse(stored); }
        } catch (e) { /* ignore */ }

        return {
            telegram: {
                enabled: false,
                botToken: '',
                chatId: ''
            },
            whatsapp: {
                enabled: false,
                accountSid: '',
                authToken: '',
                fromNumber: '',
                toNumber: ''
            }
        };
    }

    _loadSentLog() {
        try {
            const stored = localStorage.getItem(this.SENT_LOG_KEY);
            if (stored) { return JSON.parse(stored); }
        } catch (e) { /* ignore */ }
        return {};
    }
}

// Initialize as global singleton
window.pushMessengerService = new PushMessengerService();
