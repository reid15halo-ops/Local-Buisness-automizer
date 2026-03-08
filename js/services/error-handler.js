/* ============================================
   Error Handler & Notification Service
   Centralized logging and user feedback
   ============================================ */

class ErrorHandler {
    constructor() {
        this.history = [];
        this._errorCount = 0;
        this._errorWindowStart = Date.now();
        this._maxErrorsPerMinute = 10;
        this._initGlobalHandlers();
    }

    // Log error and notify user (optional)
    handle(error, context = 'App', notifyUser = true) {
        console.error(`[${context}] ${error.message || error}`, error);

        this.history.push({
            timestamp: new Date().toISOString(),
            context,
            message: error.message || error.toString(),
            stack: error.stack
        });
        if (this.history.length > 100) this.history.shift();

        this._sendToSupabase(error.message || error.toString(), error.stack, { context });

        if (notifyUser) {
            this.showToast(error.message || 'Ein unbekannter Fehler ist aufgetreten', 'error');
        }
    }

    // ---- Supabase Error Logging ----

    _initGlobalHandlers() {
        const prevOnError = window.onerror;
        window.onerror = (msg, source, line, col, error) => {
            this.handle(error || new Error(String(msg)), 'global');
            if (prevOnError) prevOnError(msg, source, line, col, error);
        };
        const prevUnhandled = window.onunhandledrejection;
        window.onunhandledrejection = (event) => {
            this.handle(event.reason || new Error('Unhandled rejection'), 'promise');
            if (prevUnhandled) prevUnhandled(event);
        };
    }

    _isRateLimited() {
        const now = Date.now();
        if (now - this._errorWindowStart > 60000) {
            this._errorCount = 0;
            this._errorWindowStart = now;
        }
        this._errorCount++;
        return this._errorCount > this._maxErrorsPerMinute;
    }

    async _sendToSupabase(errorMessage, errorStack, metadata = {}) {
        try {
            // Skip in demo mode
            if (window.demoGuardService && window.demoGuardService.isDemo()) return;

            // Skip if rate limited
            if (this._isRateLimited()) return;

            // Get supabase client
            const supabase = window.supabaseClient?.client;
            if (!supabase || !window.supabaseClient?.isConfigured()) return;

            // Get current user id if available
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id || null;

            // Get tenant_id (consistent with other services)
            const tenantId = user?.app_metadata?.tenant_id || 'a0000000-0000-0000-0000-000000000001';

            await supabase.from('client_errors').insert({
                tenant_id: tenantId,
                user_id: userId,
                error_message: errorMessage,
                error_stack: errorStack || null,
                url: window.location.href,
                user_agent: navigator.userAgent,
                metadata: metadata
            });
        } catch (e) {
            // Silently fail — avoid infinite error loops
            console.warn('[ErrorHandler] Failed to log error to Supabase:', e.message);
        }
    }

    // Show success message
    success(message) {
        this.showToast(message, 'success');
    }

    // Show info message
    info(message) {
        this.showToast(message, 'info');
    }

    // Show warning message
    warning(message) {
        this.showToast(message, 'warning');
    }

    // Render Toast Notification (uses CSS classes from core.css)
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container') || this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = this.getIconForType(type);

        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-header">
                    <span class="toast-icon">${icon}</span>
                    <span class="toast-message">${this.sanitize(message)}</span>
                    <button class="toast-close" onclick="this.parentElement.closest('.toast').remove()">&times;</button>
                </div>
            </div>
        `;

        container.appendChild(toast);
        // Trigger visibility for CSS transition
        requestAnimationFrame(() => toast.classList.add('visible'));

        // Auto remove after 5s
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    sanitize(str) {
        if (!str) {return '';}
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    getIconForType(type) {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '⛔';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    }

}

window.errorHandler = new ErrorHandler();

// Global shorthand
window.showToast = (msg, type) => window.errorHandler.showToast(msg, type);
