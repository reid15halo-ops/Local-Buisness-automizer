/* ============================================
   Global Error Boundary
   Captures uncaught errors and promise rejections
   and displays friendly user-facing error messages
   ============================================ */

class ErrorBoundary {
    constructor() {
        this.setupGlobalErrorHandlers();
    }

    setupGlobalErrorHandlers() {
        // Catch uncaught synchronous errors
        window.addEventListener('error', (event) => {
            const error = event.error || new Error(event.message);

            // Log technical details to console for debugging
            console.error('[Uncaught Error]', {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });

            // Show friendly user message
            if (window.ErrorDisplay) {
                const errorType = window.ErrorDisplay.classifyError(error);
                window.ErrorDisplay.showError(errorType, {
                    originalError: error.message
                });
            }

            // Also call legacy errorHandler if available
            if (window.errorHandler) {
                window.errorHandler.handle(error, 'Global Error Handler', true);
            }

            // Prevent default error dialog
            event.preventDefault();
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason instanceof Error
                ? event.reason
                : new Error(String(event.reason));

            // Log technical details to console for debugging
            console.error('[Unhandled Promise Rejection]', {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });

            // Show friendly user message
            if (window.ErrorDisplay) {
                const errorType = window.ErrorDisplay.classifyError(error);
                window.ErrorDisplay.showError(errorType, {
                    originalError: error.message
                });
            }

            // Also call legacy errorHandler if available
            if (window.errorHandler) {
                window.errorHandler.handle(error, 'Unhandled Promise Rejection', true);
            }

            // Prevent unhandled rejection warning
            event.preventDefault();
        });

        // Monitor network connectivity
        window.addEventListener('offline', () => {
            console.warn('[Network Offline]');
            if (window.ErrorDisplay) {
                window.ErrorDisplay.showWarning(
                    'Sie sind nicht mehr mit dem Internet verbunden.',
                    { title: 'Verbindung unterbrochen' }
                );
            }
        });

        window.addEventListener('online', () => {
            console.log('[Network Online]');
            if (window.ErrorDisplay) {
                window.ErrorDisplay.showSuccess(
                    'Verbindung wiederhergestellt ✅',
                    { duration: 3000 }
                );
            }
        });
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.errorBoundary = new ErrorBoundary();
    });
} else {
    window.errorBoundary = new ErrorBoundary();
}
