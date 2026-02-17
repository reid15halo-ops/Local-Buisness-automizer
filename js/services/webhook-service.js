/* ============================================
   Webhook & API Service
   External system integration via webhooks
   ============================================ */

class WebhookService {
    constructor() {
        this.webhooks = JSON.parse(localStorage.getItem('freyai_webhooks') || '[]');
        this.webhookLog = JSON.parse(localStorage.getItem('freyai_webhook_log') || '[]');
        this.apiKeys = JSON.parse(localStorage.getItem('freyai_api_keys') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_webhook_settings') || '{}');

        // Event types that can trigger webhooks
        this.eventTypes = [
            'invoice.created',
            'invoice.paid',
            'invoice.overdue',
            'customer.created',
            'customer.updated',
            'appointment.created',
            'appointment.cancelled',
            'task.created',
            'task.completed',
            'payment.received',
            'quote.accepted',
            'quote.rejected'
        ];
    }

    // Register a new webhook
    registerWebhook(webhookData) {
        const webhook = {
            id: 'wh-' + Date.now(),
            name: webhookData.name,
            url: webhookData.url,
            events: webhookData.events || [], // Array of event types
            secret: webhookData.secret || this.generateSecret(),
            headers: webhookData.headers || {},
            active: true,
            retryCount: webhookData.retryCount || 3,
            retryDelay: webhookData.retryDelay || 5000, // ms
            createdAt: new Date().toISOString(),
            lastTriggered: null,
            successCount: 0,
            failureCount: 0
        };

        this.webhooks.push(webhook);
        this.save();

        return { success: true, webhook };
    }

    // Update webhook
    updateWebhook(id, updates) {
        const webhook = this.webhooks.find(w => w.id === id);
        if (!webhook) {return { success: false, error: 'Webhook not found' };}

        Object.assign(webhook, updates, { updatedAt: new Date().toISOString() });
        this.save();
        return { success: true, webhook };
    }

    // Delete webhook
    deleteWebhook(id) {
        this.webhooks = this.webhooks.filter(w => w.id !== id);
        this.save();
        return { success: true };
    }

    // Trigger webhooks for an event
    async triggerEvent(eventType, payload) {
        const relevantWebhooks = this.webhooks.filter(w =>
            w.active && w.events.includes(eventType)
        );

        const results = [];

        for (const webhook of relevantWebhooks) {
            const result = await this.sendWebhook(webhook, eventType, payload);
            results.push(result);
        }

        return results;
    }

    // Send webhook request
    async sendWebhook(webhook, eventType, payload, attempt = 1) {
        const requestBody = {
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload
        };

        // Generate signature
        const signature = await this.generateSignature(requestBody, webhook.secret);

        const logEntry = {
            id: 'log-' + Date.now(),
            webhookId: webhook.id,
            webhookName: webhook.name,
            event: eventType,
            attempt: attempt,
            timestamp: new Date().toISOString(),
            status: 'pending',
            responseCode: null,
            responseBody: null,
            error: null
        };

        try {
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-FreyAI-Signature': signature,
                    'X-FreyAI-Event': eventType,
                    ...webhook.headers
                },
                body: JSON.stringify(requestBody)
            });

            logEntry.status = response.ok ? 'success' : 'failed';
            logEntry.responseCode = response.status;

            try {
                logEntry.responseBody = await response.text();
            } catch (e) { }

            // Update webhook stats
            if (response.ok) {
                webhook.successCount++;
            } else {
                webhook.failureCount++;

                // Retry if failed
                if (attempt < webhook.retryCount) {
                    setTimeout(() => {
                        this.sendWebhook(webhook, eventType, payload, attempt + 1);
                    }, webhook.retryDelay);
                }
            }

            webhook.lastTriggered = new Date().toISOString();
            this.save();

        } catch (error) {
            logEntry.status = 'error';
            logEntry.error = error.message;
            webhook.failureCount++;

            // Retry
            if (attempt < webhook.retryCount) {
                setTimeout(() => {
                    this.sendWebhook(webhook, eventType, payload, attempt + 1);
                }, webhook.retryDelay);
            }
        }

        this.webhookLog.push(logEntry);
        this.saveLog();

        return logEntry;
    }

    // Generate HMAC signature for webhook
    async generateSignature(payload, secret) {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(payload));
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, data);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Generate random secret
    generateSecret() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // API Keys management
    createApiKey(name, permissions = []) {
        const apiKey = {
            id: 'key-' + Date.now(),
            key: 'freyai_' + this.generateSecret(),
            name: name,
            permissions: permissions, // ['read:invoices', 'write:customers', etc.]
            active: true,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            usageCount: 0
        };

        this.apiKeys.push(apiKey);
        this.saveApiKeys();

        return { success: true, apiKey };
    }

    // Validate API key
    validateApiKey(key) {
        const apiKey = this.apiKeys.find(k => k.key === key && k.active);
        if (apiKey) {
            apiKey.lastUsed = new Date().toISOString();
            apiKey.usageCount++;
            this.saveApiKeys();
            return { valid: true, permissions: apiKey.permissions };
        }
        return { valid: false };
    }

    // Revoke API key
    revokeApiKey(id) {
        const apiKey = this.apiKeys.find(k => k.id === id);
        if (apiKey) {
            apiKey.active = false;
            apiKey.revokedAt = new Date().toISOString();
            this.saveApiKeys();
            return { success: true };
        }
        return { success: false };
    }

    // Get webhooks
    getWebhooks() {
        return this.webhooks;
    }

    // Get webhook by ID
    getWebhook(id) {
        return this.webhooks.find(w => w.id === id);
    }

    // Get webhook log
    getWebhookLog(webhookId = null, limit = 50) {
        let log = [...this.webhookLog];
        if (webhookId) {
            log = log.filter(l => l.webhookId === webhookId);
        }
        return log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    }

    // Get API keys (masked)
    getApiKeys() {
        return this.apiKeys.map(k => ({
            ...k,
            key: k.key.substring(0, 8) + '...' + k.key.substring(k.key.length - 4)
        }));
    }

    // Get statistics
    getStatistics() {
        return {
            totalWebhooks: this.webhooks.length,
            activeWebhooks: this.webhooks.filter(w => w.active).length,
            totalTriggers: this.webhookLog.length,
            successRate: this.webhookLog.length > 0
                ? (this.webhookLog.filter(l => l.status === 'success').length / this.webhookLog.length) * 100
                : 100,
            apiKeys: this.apiKeys.length,
            activeApiKeys: this.apiKeys.filter(k => k.active).length
        };
    }

    // Test webhook
    async testWebhook(id) {
        const webhook = this.webhooks.find(w => w.id === id);
        if (!webhook) {return { success: false, error: 'Webhook not found' };}

        return await this.sendWebhook(webhook, 'test.ping', {
            message: 'Test webhook from FreyAI Visions',
            timestamp: new Date().toISOString()
        });
    }

    // Persistence
    save() { localStorage.setItem('freyai_webhooks', JSON.stringify(this.webhooks)); }
    saveLog() {
        // Keep last 500 log entries
        if (this.webhookLog.length > 500) {
            this.webhookLog = this.webhookLog.slice(-500);
        }
        localStorage.setItem('freyai_webhook_log', JSON.stringify(this.webhookLog));
    }
    saveApiKeys() { localStorage.setItem('freyai_api_keys', JSON.stringify(this.apiKeys)); }
}

window.webhookService = new WebhookService();
