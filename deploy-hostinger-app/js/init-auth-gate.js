/**
 * Auth Gate & Offline Mode Check
 * Extracted from inline script in index.html (lines 30-86)
 * This script must run BEFORE the app loads — it blocks unauthenticated access.
 */
(async function checkAuth() {
    // Check if Supabase is configured
    const isConfigured = window.supabaseConfig?.isConfigured?.() || false;

    if (!isConfigured) {
        // Offline mode - show a notice using CSS class instead of inline styles
        const offlineBanner = document.createElement('div');
        offlineBanner.className = 'offline-banner';
        offlineBanner.innerHTML = '\uD83D\uDEDC Offline-Modus \u2014 Daten nur lokal gespeichert';
        document.body.appendChild(offlineBanner);
        document.body.classList.add('offline-banner-active');
        return; // Allow access
    }

    // Supabase is configured, check for session
    try {
        // Wait for auth service to be ready
        let attempts = 0;
        while (!window.authService && attempts < 50) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (!window.authService) {
            console.warn('Auth service not available');
            return;
        }

        const session = await window.authService.getSession();
        if (!session) {
            // No session, redirect to auth page
            window.location.href = '/auth.html';
            return;
        }

        // User is authenticated, continue loading the app
        console.log('User authenticated:', session.user?.email);
    } catch (error) {
        console.error('Auth check failed:', error);
        // On error, redirect to auth page to be safe
        window.location.href = '/auth.html';
    }
})();
