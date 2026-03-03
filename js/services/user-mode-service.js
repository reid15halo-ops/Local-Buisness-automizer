/**
 * User Mode Service - Progressive Disclosure
 * Manages Simple vs Pro mode visibility
 *
 * Modes:
 * - 'simple' (default): Shows only core features for non-technical users
 * - 'pro': Shows all advanced features
 *
 * Storage: localStorage under 'freyai_user_mode'
 * Events: Custom 'freyai:mode-changed' event fired when mode changes
 */

class UserModeService {
    constructor() {
        this.STORAGE_KEY = 'freyai_user_mode';
        this.SIMPLE_MODE = 'simple';
        this.PRO_MODE = 'pro';
        this.DEFAULT_MODE = this.SIMPLE_MODE;

        // Initialize mode from localStorage
        this.currentMode = this.loadMode();

        // UserModeService initialized
    }

    /**
     * Load mode from localStorage
     * Defaults to SIMPLE_MODE for new users
     */
    loadMode() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved && (saved === this.SIMPLE_MODE || saved === this.PRO_MODE)) {
                return saved;
            }
        } catch (error) {
            console.error('[UserModeService] Failed to load mode from localStorage:', error);
        }
        return this.DEFAULT_MODE;
    }

    /**
     * Get current user mode
     * @returns {string} 'simple' or 'pro'
     */
    getCurrentMode() {
        return this.currentMode;
    }

    /**
     * Check if user is in Pro mode
     * @returns {boolean}
     */
    isProMode() {
        return this.currentMode === this.PRO_MODE;
    }

    /**
     * Check if user is in Simple mode
     * @returns {boolean}
     */
    isSimpleMode() {
        return this.currentMode === this.SIMPLE_MODE;
    }

    /**
     * Set the user mode and persist to localStorage
     * Fires 'freyai:mode-changed' event for all components to react
     * @param {string} mode - 'simple' or 'pro'
     */
    setMode(mode) {
        if (mode !== this.SIMPLE_MODE && mode !== this.PRO_MODE) {
            console.error('[UserModeService] Invalid mode:', mode);
            return;
        }

        // Only trigger update if mode actually changed
        if (this.currentMode === mode) {
            // Mode is already set
            return;
        }

        this.currentMode = mode;

        // Persist to localStorage
        try {
            localStorage.setItem(this.STORAGE_KEY, mode);
        } catch (error) {
            console.error('[UserModeService] Failed to save mode to localStorage:', error);
        }

        // Fire custom event so all components can react
        this.fireEvent(mode);

        // Mode changed
    }

    /**
     * Toggle between Simple and Pro mode
     * @returns {string} The new mode
     */
    toggleMode() {
        const newMode = this.isSimpleMode() ? this.PRO_MODE : this.SIMPLE_MODE;
        this.setMode(newMode);
        return newMode;
    }

    /**
     * Fire custom event when mode changes
     * All components should listen to 'freyai:mode-changed' event
     * @private
     */
    fireEvent(mode) {
        try {
            const event = new CustomEvent('freyai:mode-changed', {
                detail: {
                    mode: mode,
                    isProMode: mode === this.PRO_MODE,
                    isSimpleMode: mode === this.SIMPLE_MODE,
                    timestamp: new Date().toISOString()
                },
                bubbles: true,
                cancelable: false
            });
            document.dispatchEvent(event);
        } catch (error) {
            console.error('[UserModeService] Failed to dispatch freyai:mode-changed event:', error);
        }
    }

    /**
     * Get sidebar item visibility rules
     * Returns which nav items should be shown in each mode
     * @returns {Object}
     */
    getVisibilityRules() {
        return {
            // Simple mode - core features only
            simple: [
                'quick-actions',  // 🏠 Startseite
                'anfragen',        // 📥 Anfragen
                'angebote',        // 📝 Angebote
                'auftraege',       // 🔧 Aufträge
                'rechnungen',      // 💰 Rechnungen
                'kunden',          // 👥 Kunden
                'einstellungen',   // ⚙️ Einstellungen
            ],
            // Pro mode - all features
            pro: [
                'quick-actions',
                'dashboard',       // 📊 Auswertungen
                'anfragen',
                'angebote',
                'auftraege',
                'rechnungen',
                'aufgaben',        // 📋 Aufgaben
                'kunden',
                'kommunikation',   // 💬 Kommunikation
                'kalender',        // 📅 Kalender
                'zeiterfassung',   // ⏱️ Zeiterfassung
                'emails',          // 📧 E-Mails
                'email-automation', // 🤖 E-Mail Automation
                'dokumente',       // 📄 Dokumente
                'chatbot',         // 🤖 KI-Chatbot
                'material',        // 📦 Material / Lager
                'bestellungen',    // 🛒 Bestellungen
                'mahnwesen',       // ⚠️ Mahnwesen
                'buchhaltung',     // 💰 Buchhaltung
                'berichte',        // 📊 Berichte
                'workflows',       // ⚡ Workflows
                'scanner',         // 📷 Scanner
                'backup',          // 🔒 Backup
                'admin-panel',     // 🔐 Verwaltung (Admin/Developer)
            ]
        };
    }

    /**
     * Check if a view is visible in current mode
     * @param {string} viewName - The data-view name (e.g., 'angebote')
     * @returns {boolean}
     */
    isViewVisible(viewName) {
        const rules = this.getVisibilityRules();
        const visibleInMode = rules[this.currentMode] || [];
        return visibleInMode.includes(viewName);
    }
}

// Create singleton instance
window.userModeService = new UserModeService();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserModeService;
}
