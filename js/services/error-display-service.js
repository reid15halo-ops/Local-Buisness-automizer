/* ============================================
   Error Display Service

   User-facing error display system with friendly
   German messages and recovery paths. No technical
   jargon shown to the user.
   ============================================ */
if (typeof window.ErrorDisplay !== 'undefined') { /* already loaded */ } else {
(function() {

class ErrorDisplayService {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.maxVisibleToasts = 3;
        this.initContainer();
    }

    initContainer() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('error-display-container')) {
            this.container = document.createElement('div');
            this.container.id = 'error-display-container';
            this.container.setAttribute('role', 'region');
            this.container.setAttribute('aria-live', 'polite');
            this.container.setAttribute('aria-atomic', 'true');
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('error-display-container');
        }
    }

    /* ============================================
       Error Type Definitions with German Messages
       ============================================ */

    getErrorMessage(type, context = {}) {
        const messages = {
            network: {
                icon: '⚠️',
                title: 'Keine Verbindung',
                message: 'Keine Internetverbindung. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
                retryable: true
            },
            save: {
                icon: '⚠️',
                title: 'Speichern fehlgeschlagen',
                message: 'Ihre Änderungen konnten nicht gespeichert werden. Keine Sorge — Ihre Eingaben sind noch da. Bitte versuchen Sie es erneut.',
                retryable: true
            },
            load: {
                icon: '⚠️',
                title: 'Laden fehlgeschlagen',
                message: 'Die Daten konnten nicht geladen werden. Bitte laden Sie die Seite neu.',
                retryable: false
            },
            notfound: {
                icon: '⚠️',
                title: 'Nicht gefunden',
                message: 'Dieser Eintrag wurde nicht gefunden. Möglicherweise wurde er gelöscht.',
                retryable: false
            },
            permission: {
                icon: '⚠️',
                title: 'Berechtigung erforderlich',
                message: 'Sie haben keine Berechtigung für diese Aktion. Bitte wenden Sie sich an Ihren Administrator.',
                retryable: false
            },
            validation: {
                icon: '⚠️',
                title: 'Eingabe ungültig',
                message: 'Bitte prüfen Sie Ihre Eingaben.',
                fieldError: context.field || null,
                retryable: true
            },
            timeout: {
                icon: '⏱️',
                title: 'Anfrage zu lang',
                message: 'Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.',
                retryable: true
            },
            unknown: {
                icon: '⚠️',
                title: 'Ein Fehler ist aufgetreten',
                message: 'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut oder laden Sie die Seite neu.',
                retryable: true
            }
        };

        return messages[type] || messages.unknown;
    }

    /* ============================================
       Toast Creation and Display
       ============================================ */

    createToastElement(type, message, showDuration = null) {
        const errorMsg = type === 'custom' ? {
            icon: '⚠️',
            title: message.title || 'Fehler',
            message: message.message || '',
            retryable: message.retryable === false ? false : true
        } : this.getErrorMessage(type, message);

        const toastEl = document.createElement('div');
        toastEl.className = `toast toast-${type === 'custom' ? (message.severity || 'error') : type}`;
        toastEl.setAttribute('role', 'alert');

        // Build button HTML
        let buttonsHTML = '';

        if (errorMsg.retryable && message.onRetry) {
            buttonsHTML += `<button class="toast-btn toast-btn-retry" data-action="retry">Nochmal versuchen</button>`;
        }

        buttonsHTML += `<button class="toast-btn toast-btn-dismiss" data-action="dismiss">Schließen</button>`;

        const toastSan = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
        toastEl.innerHTML = `
            <div class="toast-content">
                <div class="toast-header">
                    <span class="toast-icon">${toastSan(errorMsg.icon)}</span>
                    <h3 class="toast-title">${toastSan(errorMsg.title)}</h3>
                    <button class="toast-close" data-action="dismiss" aria-label="Schließen">×</button>
                </div>
                <p class="toast-message">${toastSan(errorMsg.message)}</p>
                ${errorMsg.fieldError ? `<p class="toast-field-error">Feld: ${toastSan(errorMsg.fieldError)}</p>` : ''}
                <div class="toast-actions">
                    ${buttonsHTML}
                </div>
            </div>
        `;

        // Attach event handlers
        const retryBtn = toastEl.querySelector('[data-action="retry"]');
        const dismissBtn = toastEl.querySelector('[data-action="dismiss"]');
        const closeBtn = toastEl.querySelector('.toast-close');

        if (retryBtn && message.onRetry) {
            retryBtn.addEventListener('click', () => {
                message.onRetry();
                this.removeToast(toastEl);
            });
        }

        if (dismissBtn || closeBtn) {
            [dismissBtn, closeBtn].forEach(btn => {
                if (btn) {
                    btn.addEventListener('click', () => {
                        this.removeToast(toastEl);
                    });
                }
            });
        }

        return { element: toastEl, duration: showDuration };
    }

    showToast(toastData) {
        const { element, duration } = toastData;

        // Check visible toasts count
        const visibleToasts = this.container.querySelectorAll('.toast').length;

        if (visibleToasts >= this.maxVisibleToasts) {
            // Queue the toast if max visible is reached
            this.toasts.push(toastData);
            return;
        }

        this.container.appendChild(element);
        this.toasts.push({ element, duration });

        // Trigger animation
        setTimeout(() => {
            element.classList.add('visible');
        }, 10);

        // Auto-dismiss if duration is set
        if (duration) {
            setTimeout(() => {
                this.removeToast(element);
            }, duration);
        }
    }

    removeToast(element) {
        element.classList.remove('visible');

        setTimeout(() => {
            if (element.parentElement) {
                element.remove();
            }

            // Remove from toasts array
            this.toasts = this.toasts.filter(t => t.element !== element);

            // Show next queued toast if any
            if (this.toasts.length > 0 && this.container.querySelectorAll('.toast').length < this.maxVisibleToasts) {
                const next = this.toasts.shift();
                this.showToast(next);
            }
        }, 300);
    }

    /* ============================================
       Public API
       ============================================ */

    showError(type = 'unknown', context = {}) {
        const toastData = this.createToastElement(type, context, null);
        this.showToast(toastData);

        // Log technical details to console for debugging only
        console.error(`[Error: ${type}]`, context);
    }

    showWarning(message, options = {}) {
        const warningMsg = {
            severity: 'warning',
            title: options.title || 'Hinweis',
            message: message,
            retryable: false
        };

        const toastData = this.createToastElement('custom', warningMsg, options.duration || 8000);
        this.showToast(toastData);
    }

    showSuccess(message, options = {}) {
        const successMsg = {
            severity: 'success',
            title: options.title || 'Erfolg',
            message: message,
            retryable: false
        };

        const toastData = this.createToastElement('custom', successMsg, options.duration || 4000);
        this.showToast(toastData);
    }

    showInfo(message, options = {}) {
        const infoMsg = {
            severity: 'info',
            title: options.title || 'Information',
            message: message,
            retryable: false
        };

        const toastData = this.createToastElement('custom', infoMsg, options.duration || 5000);
        this.showToast(toastData);
    }

    /* ============================================
       Action-Specific Feedback Messages
       ============================================ */

    showActionFeedback(actionType, details = {}) {
        const messages = {
            'customer-saved': {
                message: `Kunde "${details.name || 'erfolgreich'}" gespeichert ✅`,
                duration: 4000
            },
            'angebot-created': {
                message: 'Angebot erfolgreich erstellt ✅',
                duration: 4000
            },
            'angebot-sent': {
                message: 'Angebot wurde gesendet ✅',
                duration: 4000
            },
            'angebot-accepted': {
                message: 'Angebot angenommen — Auftrag erstellt ✅',
                duration: 4000
            },
            'auftrag-completed': {
                message: 'Auftrag als erledigt markiert ✅',
                duration: 4000
            },
            'rechnung-created': {
                message: 'Rechnung erfolgreich erstellt ✅',
                duration: 4000
            },
            'rechnung-sent': {
                message: 'Rechnung wurde versendet ✅',
                duration: 4000
            },
            'rechnung-paid': {
                message: 'Rechnung als bezahlt verbucht ✅',
                duration: 4000
            },
            'item-deleted': {
                message: 'Eintrag gelöscht ✅',
                duration: 4000
            },
            'data-saved': {
                message: 'Daten gespeichert ✅',
                duration: 3000
            }
        };

        const feedback = messages[actionType];
        if (feedback) {
            this.showSuccess(feedback.message, { duration: feedback.duration });
        }
    }

    /* ============================================
       Batch Error Handler (for form validation)
       ============================================ */

    showValidationErrors(errors) {
        if (!errors || errors.length === 0) {return;}

        const errorList = errors.map(err => {
            if (typeof err === 'string') {return err;}
            if (err.message) {return err.message;}
            return 'Validierungsfehler';
        }).join(', ');

        this.showError('validation', {
            message: errorList,
            field: errors[0].field || null
        });
    }

    /* ============================================
       Empty State Renderer
       ============================================ */

    renderEmptyState(containerEl, message, buttonText, onClickCallback) {
        const emptyStateHTML = `
            <div class="empty-state">
                <div class="empty-state-content">
                    <p class="empty-state-message">${message}</p>
                    <button class="btn btn-primary empty-state-btn">
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;

        containerEl.innerHTML = emptyStateHTML;

        const button = containerEl.querySelector('.empty-state-btn');
        if (button && onClickCallback) {
            button.addEventListener('click', onClickCallback);
        }
    }

    /* ============================================
       Error Classification Helper
       ============================================ */

    classifyError(error) {
        if (!error) {return 'unknown';}

        const message = error.message || error.toString();
        const status = error.status || error.statusCode;

        // Network errors
        if (error.type === 'network' || !navigator.onLine) {
            return 'network';
        }

        // Timeout errors
        if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('too long')) {
            return 'timeout';
        }

        // 404 errors
        if (status === 404 || message.includes('not found')) {
            return 'notfound';
        }

        // 403/401 permission errors
        if (status === 403 || status === 401) {
            return 'permission';
        }

        // Validation errors
        if (message.includes('validation') || message.includes('invalid')) {
            return 'validation';
        }

        // Save/network errors
        if (message.includes('save') || message.includes('save failed')) {
            return 'save';
        }

        // Load errors
        if (message.includes('load') || status === 500) {
            return 'load';
        }

        return 'unknown';
    }
}

// Initialize global error display service
window.ErrorDisplay = new ErrorDisplayService();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorDisplayService;
}

})();
} // end redeclaration guard
