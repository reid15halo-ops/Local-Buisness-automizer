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
                'customer-portal-service',
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
            ],

            // Agent Workflows & AI Automation (includes agentic executor for automation levels)
            // approval-queue-service must load before agentic-executor-service initialises
            'agent-workflows': [
                'approval-queue-service',
                'agent-workflow-service',
                'agentic-executor-service'
            ],

            // Field App (mobile on-site mode)
            'field-app': [
                'field-app-service'
            ],

            // Aufmaß (site measurement)
            aufmass: [
                'aufmass-service'
            ],

            // Workflow Builder (visual automation editor)
            'workflow-builder': [
                'workflow-builder-service'
            ]
        };

        // UI scripts that need loading after their service
        this.uiGroups = {
            'agent-workflows': ['agent-workflow-ui'],
            // field-app loads both desktop and mobile UIs; each self-selects based on screen size
            'field-app': ['field-app-ui', 'field-app-mobile-ui'],
            'aufmass': ['aufmass-ui'],
            'workflow-builder': ['workflow-builder-ui'],
            // Photo gallery rendered inside job/document detail views
            'documents': ['photo-gallery-ui'],
            // Dashboard widgets companion UI for the charts group
            'charts': ['dashboard-widget-ui'],
            // Fragebogen import wizard button — injected when setup wizard is active
            'settings': ['fragebogen-import-ui']
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
            'trash': ['advanced'],
            'agent-workflows': ['agent-workflows', 'ai', 'automation'],
            'workflow-builder': ['workflow-builder', 'automation'],
            'aufmass': ['aufmass', 'workflow'],
            'field-app': ['field-app', 'workflow', 'calendar']
        };
    }

    /**
     * Load a single service script with automatic retry (3 attempts, exponential backoff).
     * After all retries are exhausted the user sees a friendly German error message.
     * @param {string} serviceName - Name of the service file (without .js)
     * @param {string} path - Path prefix (default: 'js/services/')
     * @returns {Promise} Resolves when script is loaded
     */
    async loadScript(serviceName, path = 'js/services/') {
        const fullName = path + serviceName;
        const MAX_RETRIES = 3;
        const BACKOFF_MS = [1000, 2000, 4000];

        // Already loaded
        if (this.loaded.has(fullName)) {
            return Promise.resolve();
        }

        // Currently loading - return existing promise
        if (this.loading.has(fullName)) {
            return this.loading.get(fullName);
        }

        // Check if script already exists in DOM (loaded via <script> tag)
        const existingSrc = fullName + '.js';
        if (document.querySelector(`script[src="${existingSrc}"], script[src="/${existingSrc}"]`)) {
            this.loaded.add(fullName);
            return Promise.resolve();
        }

        const attemptLoad = (attempt) => new Promise((resolve, reject) => {
            const script = document.createElement('script');
            // Cache-bust on retries so the browser doesn't serve a cached 404
            script.src = attempt === 0 ? `${fullName}.js` : `${fullName}.js?_r=${attempt}`;
            script.async = true;

            script.onload = () => {
                this.loaded.add(fullName);
                this.loading.delete(fullName);
                if (attempt > 0) {
                    console.log(`✅ Lazy loaded after ${attempt} retry(s): ${serviceName}`);
                } else {
                    console.log(`✅ Lazy loaded: ${serviceName}`);
                }
                resolve();
            };

            script.onerror = () => {
                script.remove();
                reject(new Error(`Failed to load ${serviceName} (attempt ${attempt + 1})`));
            };

            document.body.appendChild(script);
        });

        const promise = (async () => {
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    if (attempt > 0) {
                        await new Promise(r => setTimeout(r, BACKOFF_MS[attempt - 1]));
                        console.warn(`🔄 Retrying (${attempt}/${MAX_RETRIES}): ${serviceName}`);
                    }
                    return await attemptLoad(attempt);
                } catch (err) {
                    if (attempt === MAX_RETRIES) {
                        this.loading.delete(fullName);
                        console.error(`❌ Permanent load failure: ${serviceName}`);
                        this._showLoadError(serviceName);
                        throw err;
                    }
                }
            }
        })();

        this.loading.set(fullName, promise);
        return promise;
    }

    /**
     * Show a friendly German error when a service cannot be loaded after all retries.
     * @param {string} serviceName
     */
    _showLoadError(serviceName) {
        const msg = `Eine Funktion konnte nicht geladen werden (${serviceName}). ` +
                    `Bitte prüfen Sie Ihre Internetverbindung und laden Sie die Seite neu.`;
        if (window.errorDisplayService?.showError) {
            window.errorDisplayService.showError(msg);
        } else if (window.showToast) {
            window.showToast(msg, 'error');
        } else {
            const banner = document.createElement('div');
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:#fff;' +
                'padding:12px 16px;z-index:99999;font-size:14px;text-align:center;';
            banner.textContent = msg;
            const close = document.createElement('button');
            close.textContent = '✕';
            close.style.cssText = 'margin-left:12px;background:transparent;border:none;color:#fff;cursor:pointer;font-size:16px;';
            close.onclick = () => banner.remove();
            banner.appendChild(close);
            document.body?.appendChild(banner);
        }
    }

    /**
     * Load multiple services in parallel
     * @param {string[]} serviceNames - Array of service names
     * @returns {Promise} Resolves when all services are loaded
     */
    async loadServices(serviceNames) {
        const results = await Promise.allSettled(
            serviceNames.map(name => this.loadScript(name))
        );
        const failed = results
            .map((r, i) => r.status === 'rejected' ? serviceNames[i] : null)
            .filter(Boolean);
        if (failed.length > 0) {
            console.warn(`⚠️ ${failed.length} service(s) failed to load:`, failed.join(', '));
        }
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
        await this.loadServices(services);

        // Also load corresponding UI scripts if any
        const uiScripts = this.uiGroups?.[groupName];
        if (uiScripts) {
            await Promise.all(uiScripts.map(name => this.loadScript(name, 'js/ui/')));
        }
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
        await Promise.allSettled(groups.map(group => this.loadGroup(group)));
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
