/* ============================================
   Lazy Loader Service
   Dynamic script loading for performance optimization
   ============================================ */

class LazyLoader {
    constructor() {
        this.loaded = new Set();
        this.loading = new Map(); // Track promises for concurrent loads

        // Service groups - load on demand
        this.serviceGroups = {
            // Core - always loaded
            core: [
                'error-handler',
                'db-service',
                'demo-data-service',
                'store-service',
                'ui-helpers',
                'navigation'
            ],

            // Basic workflow - load on dashboard/init
            workflow: [
                'gemini-service',
                'material-service',
                'dunning-service',
                'bookkeeping-service',
                'work-estimation-service'
            ],

            // CRM & Communication - load when Kunden view opened
            crm: [
                'customer-service',
                'communication-service',
                'phone-service',
                'email-service',
                'lead-service'
            ],

            // Documents & Scanning - load when Dokumente view opened
            documents: [
                'document-service',
                'ocr-scanner-service',
                'version-control-service',
                'photo-service',
                'barcode-service',
                'qrcode-service'
            ],

            // Calendar & Time - load when Termine/Kalender view opened
            calendar: [
                'calendar-service',
                'booking-service',
                'timetracking-service',
                'recurring-task-service'
            ],

            // Reports & Analytics - load when Berichte view opened
            reports: [
                'report-service',
                'cashflow-service',
                'profitability-service'
            ],

            // Workflow Automation - load when needed
            automation: [
                'workflow-service',
                'approval-service',
                'task-service',
                'webhook-service'
            ],

            // AI Features - load when AI assistant opened
            ai: [
                'ai-assistant-service',
                'chatbot-service',
                'llm-service',
                'voice-command-service'
            ],

            // Finance & Banking - load when Buchhaltung view opened
            finance: [
                'banking-service',
                'payment-service',
                'datev-export-service',
                'einvoice-service'
            ],

            // Advanced Features - load on demand
            advanced: [
                'sms-reminder-service',
                'contract-service',
                'route-service',
                'warranty-service',
                'print-digital-service',
                'security-backup-service',
                'theme-service',
                'i18n-service'
            ]
        };

        // View to service group mapping
        this.viewToGroups = {
            'dashboard': ['workflow'],
            'anfragen': ['workflow'],
            'angebote': ['workflow'],
            'auftraege': ['workflow'],
            'rechnungen': ['workflow', 'finance'],
            'mahnwesen': ['workflow'],
            'buchhaltung': ['workflow', 'finance'],
            'kunden': ['crm'],
            'termine': ['calendar'],
            'kalender': ['calendar'],
            'aufgaben': ['automation'],
            'dokumente': ['documents'],
            'berichte': ['reports'],
            'einstellungen': ['advanced'],
            'ai-assistent': ['ai']
        };
    }

    /**
     * Load a single service script
     * @param {string} serviceName - Name of the service file (without .js)
     * @param {string} path - Path prefix (default: 'js/services/')
     * @returns {Promise} Resolves when script is loaded
     */
    async loadScript(serviceName, path = 'js/services/') {
        const fullName = path + serviceName;

        // Already loaded
        if (this.loaded.has(fullName)) {
            return Promise.resolve();
        }

        // Currently loading - return existing promise
        if (this.loading.has(fullName)) {
            return this.loading.get(fullName);
        }

        // Create new loading promise
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = fullName + '.js';
            script.async = true;

            script.onload = () => {
                this.loaded.add(fullName);
                this.loading.delete(fullName);
                console.log(`✅ Lazy loaded: ${serviceName}`);
                resolve();
            };

            script.onerror = () => {
                this.loading.delete(fullName);
                console.error(`❌ Failed to load: ${serviceName}`);
                reject(new Error(`Failed to load ${serviceName}`));
            };

            document.body.appendChild(script);
        });

        this.loading.set(fullName, promise);
        return promise;
    }

    /**
     * Load multiple services in parallel
     * @param {string[]} serviceNames - Array of service names
     * @returns {Promise} Resolves when all services are loaded
     */
    async loadServices(serviceNames) {
        const promises = serviceNames.map(name => this.loadScript(name));
        return Promise.all(promises);
    }

    /**
     * Load a service group
     * @param {string} groupName - Name of the service group
     * @returns {Promise} Resolves when all services in group are loaded
     */
    async loadGroup(groupName) {
        const services = this.serviceGroups[groupName];
        if (!services) {
            console.warn(`Service group "${groupName}" not found`);
            return Promise.resolve();
        }

        console.log(`📦 Loading service group: ${groupName}`);
        return this.loadServices(services);
    }

    /**
     * Load services required for a specific view
     * @param {string} viewName - Name of the view
     * @returns {Promise} Resolves when all required services are loaded
     */
    async loadForView(viewName) {
        const groups = this.viewToGroups[viewName];
        if (!groups || groups.length === 0) {
            return Promise.resolve();
        }

        console.log(`🎯 Loading services for view: ${viewName}`);
        const promises = groups.map(group => this.loadGroup(group));
        return Promise.all(promises);
    }

    /**
     * Preload a service group in the background (low priority)
     * @param {string} groupName - Name of the service group
     */
    preload(groupName) {
        // Use requestIdleCallback if available, otherwise setTimeout
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => this.loadGroup(groupName));
        } else {
            setTimeout(() => this.loadGroup(groupName), 1000);
        }
    }

    /**
     * Get loading stats for debugging
     */
    getStats() {
        return {
            loaded: this.loaded.size,
            loading: this.loading.size,
            total: Object.values(this.serviceGroups).flat().length,
            loadedServices: Array.from(this.loaded)
        };
    }
}

// Initialize lazy loader
window.lazyLoader = new LazyLoader();
