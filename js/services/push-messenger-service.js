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

    async _sendTelegram(message) {
        const { botToken, chatId } = this.config.telegram;

        try {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                })
            });

            const data = await response.json();

            if (data.ok) {
                console.log('PushMessenger: Telegram message sent successfully');
                return { success: true };
            } else {
                console.error('PushMessenger: Telegram error:', data.description);
                return { success: false, error: data.description };
            }
        } catch (error) {
            console.error('PushMessenger: Telegram send failed:', error);
            return { success: false, error: error.message };
        }
    }

    /* ===== WHATSAPP VIA TWILIO ===== */

    async _sendWhatsApp(message) {
        const { accountSid, authToken, fromNumber, toNumber } = this.config.whatsapp;

        // Prefer server-side edge function to avoid exposing Twilio authToken in browser
        const sbUrl = localStorage.getItem('supabase_url');
        const sbKey = localStorage.getItem('supabase_anon_key');
        if (sbUrl && sbKey) {
            try {
                const efResp = await fetch(`${sbUrl}/functions/v1/send-sms`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sbKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ to: `whatsapp:${toNumber}`, message, from: `whatsapp:${fromNumber}` })
                });
                const efData = await efResp.json();
                if (efData.success) {
                    console.log('PushMessenger: WhatsApp sent via edge function');
                    return { success: true };
                }
                console.warn('PushMessenger: Edge function failed, trying direct Twilio...');
            } catch (e) {
                console.warn('PushMessenger: Edge function unavailable');
            }
        }

        // Fallback: direct Twilio (only if edge function unavailable)
        try {
            const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
            const auth = btoa(`${accountSid}:${authToken}`);

            const body = new URLSearchParams({
                From: `whatsapp:${fromNumber}`,
                To: `whatsapp:${toNumber}`,
                Body: message
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body.toString()
            });

            const data = await response.json();

            if (response.ok) {
                console.log('PushMessenger: WhatsApp message sent via Twilio');
                return { success: true, sid: data.sid };
            } else {
                console.error('PushMessenger: Twilio error:', data.message);
                return { success: false, error: data.message };
            }
        } catch (error) {
            console.error('PushMessenger: WhatsApp send failed:', error);
            return { success: false, error: error.message };
        }
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
