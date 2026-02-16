/* ============================================
   PWA Install Service
   Handles app installation experience with custom banner
   Dark theme matching the application
   ============================================ */

class PWAInstallService {
    constructor() {
        this.deferredPrompt = null;
        this.bannerElement = null;
        this.isInstalled = false;
        this.lastDismissalTime = null;
        this.dismissalTimeoutDays = 7;

        // Check if app is already installed
        this.checkInstallationStatus();

        // Listen for install events
        this.setupEventListeners();
    }

    /**
     * Check if app is already installed (PWA mode)
     */
    checkInstallationStatus() {
        // Check if running as PWA (standalone mode)
        if (window.navigator.standalone === true) {
            this.isInstalled = true;
            return;
        }

        // Check if running in PWA mode (display mode standalone)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            return;
        }

        // Check localStorage for installation status
        const installed = localStorage.getItem('mhs_pwa_installed');
        if (installed === 'true') {
            this.isInstalled = true;
            return;
        }

        // Check if recently dismissed
        const dismissalTime = localStorage.getItem('mhs_pwa_dismissal_time');
        if (dismissalTime) {
            const now = Date.now();
            const dismissedDays = (now - parseInt(dismissalTime)) / (1000 * 60 * 60 * 24);
            this.lastDismissalTime = dismissalTime;

            if (dismissedDays < this.dismissalTimeoutDays) {
                // Don't show banner for 7 days after dismissal
                return;
            } else {
                // Clear old dismissal time after timeout
                localStorage.removeItem('mhs_pwa_dismissal_time');
            }
        }
    }

    /**
     * Setup event listeners for install prompt
     */
    setupEventListeners() {
        // Listen for beforeinstallprompt event (Chrome, Edge, Samsung Internet)
        window.addEventListener('beforeinstallprompt', (event) => {
            // Prevent automatic browser prompt
            event.preventDefault();

            // Store the prompt event
            this.deferredPrompt = event;

            // Show custom install banner
            if (!this.isInstalled && !this.lastDismissalTime) {
                this.showInstallBanner();
            }
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('PWA app installed successfully');
            this.isInstalled = true;
            localStorage.setItem('mhs_pwa_installed', 'true');
            this.hideInstallBanner();
            this.showSuccessToast();
        });

        // Listen for changes in display mode
        window.matchMedia('(display-mode: standalone)').addEventListener('change', (event) => {
            if (event.matches) {
                this.isInstalled = true;
                localStorage.setItem('mhs_pwa_installed', 'true');
                this.hideInstallBanner();
            }
        });
    }

    /**
     * Show custom install banner at bottom of screen
     */
    showInstallBanner() {
        // Don't show if already installed
        if (this.isInstalled || this.bannerElement) {
            return;
        }

        // Create banner container
        this.bannerElement = document.createElement('div');
        this.bannerElement.id = 'mhs-pwa-install-banner';
        this.bannerElement.setAttribute('role', 'dialog');
        this.bannerElement.setAttribute('aria-label', 'App installieren');

        // Banner HTML
        this.bannerElement.innerHTML = `
            <div style="
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: white;
                padding: 16px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                z-index: 9999;
                box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                animation: slideUp 0.4s ease-out;
            " style="animation: slideUp 0.4s ease-out;">
                <!-- Left: Icon and Info -->
                <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                    <div style="
                        font-size: 28px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">⚙️</div>
                    <div>
                        <div style="
                            font-weight: 600;
                            font-size: 14px;
                            margin-bottom: 2px;
                        ">MHS Workflow</div>
                        <div style="
                            font-size: 12px;
                            color: #cbd5e1;
                            line-height: 1.3;
                        ">App installieren für schnelleren Zugriff</div>
                    </div>
                </div>

                <!-- Right: Buttons -->
                <div style="display: flex; gap: 8px; flex-shrink: 0;">
                    <button id="mhs-pwa-install-btn" style="
                        background-color: #6366f1;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background-color 0.2s, transform 0.1s;
                        white-space: nowrap;
                    " onmouseover="this.style.backgroundColor='#4f46e5'" onmouseout="this.style.backgroundColor='#6366f1'" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'">
                        Installieren
                    </button>
                    <button id="mhs-pwa-dismiss-btn" style="
                        background-color: transparent;
                        color: #cbd5e1;
                        border: 1px solid #475569;
                        padding: 8px 14px;
                        border-radius: 4px;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                        white-space: nowrap;
                    " onmouseover="this.style.borderColor='#64748b'; this.style.color='#f1f5f9';" onmouseout="this.style.borderColor='#475569'; this.style.color='#cbd5e1';" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'">
                        Später
                    </button>
                </div>
            </div>

            <style>
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                @media (max-width: 480px) {
                    #mhs-pwa-install-banner > div {
                        flex-direction: column;
                        gap: 12px !important;
                        padding: 12px 16px !important;
                    }

                    #mhs-pwa-install-banner > div > div:last-child {
                        width: 100%;
                        display: flex !important;
                    }

                    #mhs-pwa-install-banner button {
                        flex: 1;
                    }
                }

                /* Prevent layout shift when banner appears */
                body.mhs-pwa-banner-shown {
                    padding-bottom: 70px;
                }
            </style>
        `;

        // Add to body
        document.body.appendChild(this.bannerElement);
        document.body.classList.add('mhs-pwa-banner-shown');

        // Attach event listeners
        const installBtn = document.getElementById('mhs-pwa-install-btn');
        const dismissBtn = document.getElementById('mhs-pwa-dismiss-btn');

        if (installBtn) {
            installBtn.addEventListener('click', () => this.installApp());
        }

        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => this.dismissBanner());
        }
    }

    /**
     * Hide the install banner
     */
    hideInstallBanner() {
        if (this.bannerElement) {
            // Slide out animation
            const bannerDiv = this.bannerElement.querySelector('div');
            if (bannerDiv) {
                bannerDiv.style.animation = 'slideDown 0.3s ease-out forwards';
                setTimeout(() => {
                    if (this.bannerElement && this.bannerElement.parentNode) {
                        this.bannerElement.parentNode.removeChild(this.bannerElement);
                    }
                    document.body.classList.remove('mhs-pwa-banner-shown');
                    this.bannerElement = null;
                }, 300);
            }
        }
    }

    /**
     * Trigger app installation
     */
    async installApp() {
        if (!this.deferredPrompt) {
            console.warn('Install prompt not available');
            return;
        }

        try {
            // Show the native install prompt
            this.deferredPrompt.prompt();

            // Wait for user's choice
            const { outcome } = await this.deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                console.log('App installation accepted');
                this.isInstalled = true;
                localStorage.setItem('mhs_pwa_installed', 'true');
                this.hideInstallBanner();
                this.showSuccessToast();
            } else {
                console.log('App installation declined');
                this.dismissBanner();
            }

            // Clear the stored prompt
            this.deferredPrompt = null;
        } catch (error) {
            console.error('Error during app installation:', error);
        }
    }

    /**
     * Dismiss the banner for 7 days
     */
    dismissBanner() {
        localStorage.setItem('mhs_pwa_dismissal_time', Date.now().toString());
        this.lastDismissalTime = Date.now();
        this.hideInstallBanner();
    }

    /**
     * Show success toast after installation
     */
    showSuccessToast() {
        const toast = document.createElement('div');
        toast.id = 'mhs-pwa-success-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');

        toast.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: #10b981;
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                animation: toastSlideIn 0.3s ease-out;
                max-width: 300px;
            " style="animation: toastSlideIn 0.3s ease-out;">
                ✓ App erfolgreich installiert! Sie können diese nun vom Homescreen starten.
            </div>

            <style>
                @keyframes toastSlideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }

                @keyframes toastSlideOut {
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }

                @media (max-width: 480px) {
                    #mhs-pwa-success-toast > div {
                        bottom: 60px !important;
                        left: 10px !important;
                        right: 10px !important;
                    }
                }
            </style>
        `;

        document.body.appendChild(toast);

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
            const toastDiv = toast.querySelector('div');
            if (toastDiv) {
                toastDiv.style.animation = 'toastSlideOut 0.3s ease-out forwards';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 4000);
    }

    /**
     * Check if PWA is installed
     */
    isAppInstalled() {
        return this.isInstalled;
    }

    /**
     * Force show banner (for testing)
     */
    forceShowBanner() {
        localStorage.removeItem('mhs_pwa_dismissal_time');
        localStorage.removeItem('mhs_pwa_installed');
        this.isInstalled = false;
        this.lastDismissalTime = null;
        this.showInstallBanner();
    }

    /**
     * Reset installation state (for development)
     */
    resetInstallationState() {
        localStorage.removeItem('mhs_pwa_installed');
        localStorage.removeItem('mhs_pwa_dismissal_time');
        this.isInstalled = false;
        this.lastDismissalTime = null;
        this.hideInstallBanner();
        console.log('PWA installation state reset');
    }
}

// Create global instance and initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pwaInstallService = new PWAInstallService();
    });
} else {
    window.pwaInstallService = new PWAInstallService();
}
