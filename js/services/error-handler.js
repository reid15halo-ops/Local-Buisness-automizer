/* ============================================
   Error Handler & Notification Service
   Centralized logging and user feedback
   ============================================ */

class ErrorHandler {
    constructor() {
        this.history = [];
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

        if (notifyUser) {
            this.showToast(error.message || 'Ein unbekannter Fehler ist aufgetreten', 'error');
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

    // Render Toast Notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container') || this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = this.getIconForType(type);

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${this.sanitize(message)}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        // CSS for Toast (injected here for self-containment, but ideally in styles.css)
        toast.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 450px;
            padding: 16px;
            margin-bottom: 12px;
            background: var(--bg-card, #1c1c21);
            border: 1px solid var(--border-color, #27272a);
            border-left: 4px solid ${this.getColorForType(type)};
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            color: var(--text-primary, #fff);
            font-size: 14px;
            animation: slideInRight 0.3s ease;
            position: relative;
            z-index: 10000;
        `;

        container.appendChild(toast);

        // Auto remove after 5s
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            pointer-events: none; /* Allow clicking through container */
        `;
        document.body.appendChild(container);

        // Inject animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes fadeOut {
                to { opacity: 0; transform: translateY(10px); }
            }
            .toast { pointer-events: auto; } /* Enable clicks on toasts */
            .toast-close { background: none; border: none; color: #aaa; cursor: pointer; font-size: 18px; margin-left: auto; }
            .toast-close:hover { color: #fff; }
        `;
        document.head.appendChild(style);

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

    getColorForType(type) {
        switch (type) {
            case 'success': return '#22c55e';
            case 'error': return '#ef4444';
            case 'warning': return '#f59e0b';
            default: return '#3b82f6';
        }
    }
}

window.errorHandler = new ErrorHandler();

// Global shorthand
window.showToast = (msg, type) => window.errorHandler.showToast(msg, type);
