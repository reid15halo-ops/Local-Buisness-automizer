/* ============================================
   Global Error Boundary
   Captures uncaught errors and promise rejections
   ============================================ */

class ErrorBoundary {
    constructor() {
        this.setupGlobalErrorHandlers();
    }

    setupGlobalErrorHandlers() {
        // Catch uncaught synchronous errors
        window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error);

            if (window.errorHandler) {
                window.errorHandler.handle(
                    event.error || new Error(event.message),
                    'Global Error Handler',
                    true
                );
            }
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);

            if (window.errorHandler) {
                const error = event.reason instanceof Error
                    ? event.reason
                    : new Error(String(event.reason));

                window.errorHandler.handle(
                    error,
                    'Unhandled Promise Rejection',
                    true
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
