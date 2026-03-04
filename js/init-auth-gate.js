/**
 * Auth Gate & Offline Mode Check
 * Standalone version of the inline auth gate in index.html.
 * This script must run BEFORE the app loads — it blocks unauthenticated access.
 */
(async function checkAuth() {
    // Check if Supabase is configured
    const isConfigured = window.supabaseConfig?.isConfigured?.() || false;

    if (!isConfigured) {
        // Offline/demo mode - show a notice and allow access
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('offline-mode-banner')) {return;} // Already shown by inline script
            const offlineBanner = document.createElement('div');
            offlineBanner.className = 'offline-banner';
            offlineBanner.id = 'offline-mode-banner';
            offlineBanner.innerHTML = `
                <span>Offline-Modus &mdash; Daten nur lokal gespeichert</span>
                <a href="auth.html" style="color:inherit;margin-left:12px;text-decoration:underline;">Supabase einrichten</a>
            `;
            document.body.appendChild(offlineBanner);
            document.body.classList.add('has-offline-banner');
        });
        return; // Allow access without auth
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
            window.location.href = '/auth.html';
            return;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/auth.html';
    }
})();
