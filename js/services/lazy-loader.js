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
            // Core Infrastructure - essential services (loaded eagerly or on critical path)
            core: [
                'auth-service',
                'supabase-config',
                'supabase-db-service',
                'sanitize-service',
                'sync-service',
                'confirm-dialog-service',
                'error-display-service',
                'user-mode-service'
            ],

            // CRM & Customer Management - load when Kunden view opened
            crm: [
                'customer-service',
                'lead-service',
                'communication-service',
                'unified-comm-service',
                'communication-hub-controller',
                'phone-service',
                'email-service',
                'email-automation-service',
                'email-template-service'
            ],

            // Finance & Accounting - load when Buchhaltung/Rechnungen view opened
            finance: [
                'invoice-service',
                'invoice-numbering-service',
                'invoice-template-service',
                'payment-service',
                'bookkeeping-service',
                'cashflow-service',
                'profitability-service',
                'banking-service',
                'stripe-service',
                'datev-export-service',
                'purchase-order-service'
            ],

            // Automation & Workflows - load when automation features needed
            automation: [
                'email-service',
                'email-automation-service',
                'webhook-service',
                'automation-api',
                'workflow-service',
                'recurring-task-service',
                'approval-service',
                'task-service'
            ],

            // AI & Intelligence - load when AI assistant opened
            ai: [
                'gemini-service',
                'ai-assistant-service',
                'llm-service',
                'work-estimation-service',
                'chatbot-service',
                'voice-command-service'
            ],

            // Documents & Scanning - load when Dokumente view opened
            documents: [
                'document-service',
                'pdf-generation-service',
                'einvoice-service',
                'ocr-scanner-service',
                'photo-service',
                'barcode-service',
                'qrcode-service',
                'print-digital-service'
            ],

            // Calendar & Task Management - load when Termine/Kalender/Aufgaben opened
            calendar: [
                'calendar-service',
                'calendar-ui-service',
                'task-service',
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

            // Settings & Configuration - load when Einstellungen opened
            settings: [
                'theme-manager',
                'theme-service',
                'i18n-service',
                'version-control-service',
                'security-backup-service',
                'onboarding-tutorial-service'
            ],

            // Basic Workflow - load on dashboard/init
            workflow: [
                'gemini-service',
                'dunning-service',
                'bookkeeping-service',
                'work-estimation-service',
                'material-service',
                'reorder-engine-service'
            ],

            // Advanced Features - load on demand
            advanced: [
                'contract-service',
                'dunning-service',
                'warranty-service',
                'sms-reminder-service',
                'user-manager-service',
                'route-service',
                'trash-service',
                'security-service',
                'security-backup-service',
                'pwa-install-service'
            ],

            // Reports & Charts - load when dashboards/charts needed
            charts: [
                'dashboard-charts-service',
                'data-export-service'
            ]
        };

        // View to service group mapping
        this.viewToGroups = {
            'dashboard': ['workflow', 'crm', 'ai'],
            'anfragen': ['workflow', 'crm', 'automation'],
            'angebote': ['workflow', 'crm', 'ai'],
            'auftraege': ['workflow', 'crm', 'automation', 'ai'],
            'rechnungen': ['workflow', 'finance', 'documents', 'automation'],
            'mahnwesen': ['workflow', 'finance', 'automation'],
            'buchhaltung': ['workflow', 'finance', 'reports', 'automation'],
            'kunden': ['crm', 'communication', 'calendar'],
            'emails': ['crm', 'communication', 'automation'],
            'email-automation': ['crm', 'automation', 'ai'],
            'termine': ['calendar', 'automation', 'crm'],
            'kalender': ['calendar', 'automation'],
            'aufgaben': ['automation', 'calendar'],
            'dokumente': ['documents', 'automation', 'ai'],
            'berichte': ['reports', 'finance', 'automation', 'charts'],
            'einstellungen': ['settings', 'advanced'],
            'ai-assistent': ['ai', 'automation', 'crm'],
            'material': ['workflow'],
            'material-list': ['workflow'],
            'kommunikation': ['crm'],
            'trash': ['advanced']
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
     * Register critical services that should be eagerly loaded
     * These services are essential for core app functionality
     * @param {string[]} serviceNames - Array of service names to mark as critical
     */
    registerCriticalServices(serviceNames) {
        serviceNames.forEach(name => this.loaded.add('js/services/' + name));
        console.log(`✅ Registered ${serviceNames.length} critical services as pre-loaded`);
    }

    /**
     * Get loading stats for debugging
     */
    getStats() {
        return {
            loaded: this.loaded.size,
            loading: this.loading.size,
            total: Object.values(this.serviceGroups).flat().length,
            loadedServices: Array.from(this.loaded),
            serviceGroups: Object.keys(this.serviceGroups)
        };
    }
}

// Initialize lazy loader
window.lazyLoader = new LazyLoader();
