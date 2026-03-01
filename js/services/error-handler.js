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

    getColorForType(type) {
        switch (type) {
            case 'success': return 'var(--accent-success, #22c55e)';
            case 'error': return 'var(--accent-danger, #ef4444)';
            case 'warning': return 'var(--accent-warning, #f59e0b)';
            default: return 'var(--accent-info, #3b82f6)';
        }
    }
}

window.errorHandler = new ErrorHandler();

// Global shorthand
window.showToast = (msg, type) => window.errorHandler.showToast(msg, type);
