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

    console.log('🚀 Initializing lazy-loaded services architecture...');

    // Register services that are already loaded via <script> tags
    // These should not be re-loaded by the lazy loader
    const criticalServices = [
        'error-handler',
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
        'excel-recognition-service',
        'search-service',
        'theme-manager',
        'pdf-service',
        'lazy-loader',
        'automation-api'
    ];

    window.lazyLoader.registerCriticalServices(criticalServices);

    // Load core infrastructure services immediately (needed for app function)
    try {
        console.log('📦 Loading core infrastructure services...');
        await window.lazyLoader.loadGroup('core');
        console.log('✅ Core services loaded');
    } catch (error) {
        console.error('Failed to load core services:', error);
    }

    // Load workflow services immediately (needed for dashboard)
    try {
        console.log('📦 Loading workflow services...');
        await window.lazyLoader.loadGroup('workflow');
        console.log('✅ Workflow services loaded');
    } catch (error) {
        console.error('Failed to load workflow services:', error);
    }

    // Preload commonly used groups in background (idle time)
    const preloadGroups = ['crm', 'finance', 'documents', 'calendar', 'automation', 'ai'];

    setTimeout(() => {
        console.log('📦 Preloading service groups in background...');
        preloadGroups.forEach(group => {
            window.lazyLoader.preload(group);
        });

        // Initialize email automation service when loaded
        setTimeout(() => {
            if (window.EmailAutomationService && !window.emailAutomationService) {
                try {
                    window.emailAutomationService = new window.EmailAutomationService();
                    window.emailAutomationService.init().catch(err => {
                        console.error('Failed to init EmailAutomationService:', err);
                    });
                } catch (error) {
                    console.warn('EmailAutomationService not yet available:', error.message);
                }
            }
        }, 500);
    }, 1500);

    // Log loading stats periodically
    setTimeout(() => {
        const stats = window.lazyLoader.getStats();
        console.log('📊 Lazy Loading Stats:', {
            loadedCount: stats.loaded,
            loadingCount: stats.loading,
            totalAvailable: stats.total,
            groups: stats.serviceGroups.length,
            services: stats.loadedServices.slice(0, 10).map(s => s.replace('js/services/', ''))
        });
    }, 3000);

    // Setup view-based lazy loading trigger
    console.log('🎯 View-based lazy loading system ready');

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
        console.log('✅ Onboarding Tutorial Service initialized');
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
            console.log('📖 Starting onboarding tutorial for first-time user');
            window.onboardingTutorial.start();
        }
    }, 2000);
}
