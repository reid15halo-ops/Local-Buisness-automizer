/* ============================================
   Automation API Service
   Bridges workflow-service with Supabase Edge Functions
   for real email, SMS, webhook execution
   ============================================ */

class AutomationAPI {
    constructor() {
        this.initialized = false;
        this.supabaseUrl = null;
        this.supabaseKey = null;
    }

    init() {
        const config = window.supabaseConfig;
        if (config?.isConfigured()) {
            const cfg = config.get();
            this.supabaseUrl = cfg.url;
            this.supabaseKey = cfg.anonKey;
            this.initialized = true;
        }
    }

    async getAuthHeaders() {
        if (!this.initialized) this.init();
        if (!this.supabaseUrl) return null;

        const session = await window.authService?.getSession();
        if (!session?.access_token) return null;

        return {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': this.supabaseKey,
            'Content-Type': 'application/json',
        };
    }

    async callFunction(functionName, body) {
        const headers = await this.getAuthHeaders();
        if (!headers) {
            return { success: false, error: 'Nicht authentifiziert oder Supabase nicht konfiguriert' };
        }

        try {
            const response = await fetch(`${this.supabaseUrl}/functions/v1/${functionName}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, error: data.error || `HTTP ${response.status}` };
            }

            return data;
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // ============================================
    // Direct API methods
    // ============================================

    async sendEmail(to, subject, body, replyTo) {
        return this.callFunction('send-email', { to, subject, body, replyTo });
    }

    async sendSMS(to, message) {
        return this.callFunction('send-sms', { to, message });
    }

    async callWebhook(url, method, data, headers) {
        return this.callFunction('run-webhook', { url, method, data, headers });
    }

    async checkOverdue() {
        return this.callFunction('check-overdue', {});
    }

    // ============================================
    // Workflow action executor
    // Called by workflow-service for each action step
    // ============================================

    async executeAction(actionType, params, workflowId, executionId) {
        // Try Supabase Edge Function first
        if (this.initialized || window.supabaseConfig?.isConfigured()) {
            this.init();

            const result = await this.callFunction('run-automation', {
                action: actionType,
                params,
                workflowId,
                executionId,
            });

            if (result.success !== undefined) return result;
        }

        // Fallback: handle locally what we can
        return this.executeLocally(actionType, params);
    }

    executeLocally(actionType, params) {
        switch (actionType) {
            case 'notification.show':
                if (window.Notification && Notification.permission === 'granted') {
                    new Notification('HandwerkFlow', { body: params.message || '' });
                } else if (window.showToast) {
                    window.showToast(params.message || '', 'info');
                }
                return { success: true, local: true };

            case 'task.create':
                if (window.taskService) {
                    window.taskService.addTask({
                        title: params.title || 'Neue Aufgabe',
                        priority: params.priority || 'normal',
                        dueDate: params.dueDate,
                        source: 'workflow',
                    });
                    return { success: true, local: true };
                }
                return { success: false, error: 'TaskService nicht verfügbar' };

            case 'log':
                console.log('[Workflow]', params.message);
                return { success: true, local: true };

            case 'wait':
                // Wait can't be properly handled locally in async context
                return { success: true, local: true, note: 'Wait wird übersprungen (lokal)' };

            default:
                return {
                    success: false,
                    error: `Aktion "${actionType}" benötigt Supabase-Verbindung (E-Mail, SMS, Webhook)`,
                };
        }
    }

    // ============================================
    // Status check
    // ============================================

    isAvailable() {
        return this.initialized || window.supabaseConfig?.isConfigured();
    }

    getStatus() {
        if (!window.supabaseConfig?.isConfigured()) {
            return { connected: false, reason: 'Supabase nicht konfiguriert' };
        }
        return { connected: true };
    }
}

window.automationAPI = new AutomationAPI();
