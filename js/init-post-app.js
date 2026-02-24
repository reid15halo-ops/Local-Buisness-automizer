/**
 * Post-App Initialization Scripts
 * Extracted from inline scripts in index.html (lines 3044-3173)
 * These scripts run AFTER all modules have loaded.
 *
 * Includes:
 *   1. Service Worker registration
 *   2. Demo Guard initialization
 *   3. Calendar UI initialization
 *   4. Auth UI initialization (updateUserUI + auth change subscription)
 *   5. Boomer Guide initialization
 */

// === 1. PWA Service Worker Registration ===
(function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg => console.log('\u2705 Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed:', err));
        });
    }
})();

// === 2. Demo Guard Initialization ===
(function initDemoGuard() {
    // Initialize demo guard
    if (window.demoGuardService) {
        // Hide demo buttons if not in development mode
        window.addEventListener('load', () => {
            window.demoGuardService.hideDemoButtons();

            // Show demo banner if demo data was previously loaded
            if (window.demoGuardService.isDemo()) {
                window.demoGuardService.showDemoBanner();
            }

            // Initialize dev mode toggle in settings (when settings are loaded)
            setTimeout(() => {
                window.demoGuardService.initDevModeToggle();
            }, 500);
        });
    }
})();

// === 3. Calendar UI Initialization ===
(function initCalendarUI() {
    // Wait for calendar services to be ready
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (window.calendarUIService) {
                window.calendarUIService.mount('calendar-ui-mount');
                console.log('\u2705 Calendar UI Service initialized');
            } else {
                console.warn('Calendar UI Service not available');
            }
        }, 500);
    });
})();

// === 4. Auth UI Initialization ===
(async function initAuthUI() {
    // Wait for auth service to be ready
    let attempts = 0;
    while (!window.authService && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    if (!window.authService) {return;}

    // Check if Supabase is configured
    const isConfigured = window.authService?.isConfigured?.() || false;

    if (!isConfigured) {
        // In offline mode, hide user info panel
        const panel = document.getElementById('user-info-panel');
        if (panel) {panel.style.display = 'none';}
        return;
    }

    // Get current user
    const user = window.authService.getUser();
    if (user) {
        updateUserUI(user);
    }

    // Subscribe to auth changes
    window.authService.onAuthChange((user, session) => {
        if (user) {
            updateUserUI(user);
        } else {
            // User logged out, redirect to auth page
            window.location.href = '/auth.html';
        }
    });

    function updateUserUI(user) {
        const panel = document.getElementById('user-info-panel');
        const emailEl = document.getElementById('user-email');
        const companyEl = document.getElementById('user-company');

        if (panel) {
            panel.style.display = 'block';
            if (emailEl) {
                emailEl.textContent = user.email || 'Benutzer';
            }
            if (companyEl) {
                const companyName = user.user_metadata?.company_name || user.user_metadata?.full_name || '';
                companyEl.textContent = companyName || 'Konto';
            }
        }

        // Add logout handler
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn && !logoutBtn.dataset.listenerAttached) {
            logoutBtn.dataset.listenerAttached = 'true';
            logoutBtn.addEventListener('click', async () => {
                if (confirm('Wirklich abmelden?')) {
                    await window.authService.logout();
                    window.location.href = '/auth.html';
                }
            });
        }
    }
})();

// === 5. Boomer Guide Initialization ===
(function initBoomerGuide() {
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (window.boomerGuideUI) {
                window.boomerGuideUI.init();
                console.log('\u2705 Boomer Guide initialized');
            }
        }, 800);
    });
})();
