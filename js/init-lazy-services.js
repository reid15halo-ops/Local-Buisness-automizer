/* ============================================
   Lazy Services Initialization
   Registers critical services and preloads
   essential service groups after app init
   ============================================ */

(async function initLazyServices() {
    // Wait for DOM and core services to be ready
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }

    // Ensure lazyLoader is available
    if (!window.lazyLoader) {
        console.error('LazyLoader not initialized!');
        return;
    }

    // Initializing lazy-loaded services architecture

    // Register services that are already loaded via <script> tags
    // These should not be re-loaded by the lazy loader
    const criticalServices = [
        'error-handler',
        'error-handler-utils',
        'error-display-service',
        'db-service',
        'demo-data-service',
        'store-service',
        'setup-wizard-service',
        'onboarding-tutorial-service',
        'activity-indicator-service',
        'demo-guard-service',
        'auth-service',
        'supabase-config',
        'supabase-db-service',
        'sanitize-service',
        'excel-recognition-service',
        'search-service',
        'theme-manager',
        'pdf-service',
        'lazy-loader',
        'automation-api',
        // Services loaded eagerly via <script> tags in index.html
        'i18n-service',
        'security-service',
        'sync-service',
        'confirm-dialog-service',
        'trash-service',
        'user-mode-service',
        'form-validation-service',
        'company-settings-service',
        'document-template-service',
        'admin-panel-service',
        'dashboard-charts-service',
        'notification-service',
        'push-messenger-service',
        'boomer-guide-service',
        'data-export-service',
        'email-template-service',
        'pwa-install-service',
        'calendar-service',
        'booking-service',
        'calendar-ui-service',
        'purchase-order-service',
        'reorder-engine-service',
        'portal-service',
        'offline-sync-service',
        'bon-scanner-service'
    ];

    window.lazyLoader.registerCriticalServices(criticalServices);

    // Load core infrastructure services immediately (needed for app function)
    try {
        // Loading core infrastructure services
        await window.lazyLoader.loadGroup('core');
        // Core services loaded
    } catch (error) {
        console.error('Failed to load core services:', error);
    }

    // Load workflow services immediately (needed for dashboard)
    try {
        // Loading workflow services
        await window.lazyLoader.loadGroup('workflow');
        // Workflow services loaded
    } catch (error) {
        console.error('Failed to load workflow services:', error);
    }

    // Services are loaded on-demand when views are opened (via navigation.js loadForView).
    // No eager preloading — saves ~2.5 MB of JS on initial load.
    // EmailAutomationService is initialized when the automation view is first opened.
    document.addEventListener('viewchange', function initEmailAuto(e) {
        if (e.detail?.view === 'automation' || e.detail?.view === 'workflows') {
            if (window.EmailAutomationService && !window.emailAutomationService) {
                try {
                    window.emailAutomationService = new window.EmailAutomationService();
                    window.emailAutomationService.init().catch(() => {});
                } catch { /* ignore */ }
            }
            document.removeEventListener('viewchange', initEmailAuto);
        }
    });

    // Log loading stats periodically
    setTimeout(() => {
        window.lazyLoader.getStats();
        // Lazy loading stats collected
    }, 3000);

    // Setup view-based lazy loading trigger
    // View-based lazy loading system ready

    // Initialize Onboarding Tutorial
    initOnboardingTutorial();
})();

// ============================================
// Onboarding Tutorial Initialization
// ============================================
function initOnboardingTutorial() {
    if (!window.OnboardingTutorialService) {
        console.warn('OnboardingTutorialService not available');
        return;
    }

    // Create global tutorial instance
    if (!window.onboardingTutorial) {
        window.onboardingTutorial = new window.OnboardingTutorialService();
        // Onboarding Tutorial Service initialized
    }

    // Setup tutorial button listeners
    setTimeout(() => {
        const startBtn = document.getElementById('btn-start-tutorial');
        const resetBtn = document.getElementById('btn-reset-tutorial');

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                window.onboardingTutorial.start();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Das Tutorial wird auf Schritt 1 zurückgesetzt. Beim nächsten Besuch wird es automatisch gestartet.')) {
                    window.onboardingTutorial.reset();
                    alert('✓ Tutorial zurückgesetzt!');
                }
            });
        }
    }, 100);

    // Auto-start tutorial on first visit
    setTimeout(() => {
        if (window.onboardingTutorial.shouldAutoStart()) {
            // Delay to avoid conflicts with other startup processes
            // Starting onboarding tutorial for first-time user
            window.onboardingTutorial.start();
        }
    }, 2000);
}
