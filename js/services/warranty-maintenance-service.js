/* ============================================
   Warranty & Maintenance Service
   (Gewährleistungs- & Wartungsmanagement)

   Tracks warranty periods per German construction law:
   - BGB §634a: 5 years (Bauleistungen)
   - VOB/B §13: 4 years (Bauleistungen)

   Manages recurring maintenance contracts (Wartungsverträge)
   as a revenue generator for Handwerker.

   Storage keys:
   - mhs_warranties
   - mhs_maintenance_contracts
   ============================================ */

class WarrantyMaintenanceService {
    constructor() {
        this.WARRANTY_KEY = 'mhs_warranties';
        this.MAINTENANCE_KEY = 'mhs_maintenance_contracts';
        this.NOTIFY_LOG_KEY = 'mhs_wm_notify_log';

        this.warranties = this._load(this.WARRANTY_KEY);
        this.maintenanceContracts = this._load(this.MAINTENANCE_KEY);
        this.notifyLog = this._load(this.NOTIFY_LOG_KEY);

        // Warranty periods in years by contract basis
        this.WARRANTY_PERIODS = {
            'BGB': 5,
            'VOB': 4
        };

        // Interval mapping to days (approximate for scheduling)
        this.INTERVAL_DAYS = {
            'monatlich': 30,
            'quartalsweise': 91,
            'halbjaehrlich': 182,
            'jaehrlich': 365
        };

        // Auto-update expired warranties on load
        this._updateExpiredWarranties();
    }

    /* =======================================================
       WARRANTY MANAGEMENT (Gewährleistung)
       ======================================================= */

    /**
     * Create a new warranty item
     * @param {Object} data - Warranty data
     * @returns {Object} Created warranty item
     */
    createWarranty(data) {
        const now = new Date();
        const id = 'GWL-' + now.getTime() + '-' + Math.random().toString(36).substr(2, 6);

        const contractBasis = data.contractBasis || 'BGB';
        const completionDate = data.completionDate || now.toISOString().split('T')[0];
        const warrantyYears = this.WARRANTY_PERIODS[contractBasis] || 5;
        const warrantyEndDate = this._addYears(completionDate, warrantyYears);

        const warranty = {
            id: id,

            // Link to original job
            orderId: data.orderId || '',
            orderName: data.orderName || '',
            customerId: data.customerId || '',
            customerName: data.customerName || '',
            customerPhone: data.customerPhone || '',
            customerEmail: data.customerEmail || '',
            address: data.address || '',

            // Warranty details
            type: data.type || 'gewaehrleistung',
            contractBasis: contractBasis,
            category: data.category || '',
            description: data.description || '',

            // Dates
            completionDate: completionDate,
            warrantyEndDate: warrantyEndDate,

            // Status
            status: 'aktiv',

            // Claims
            claims: [],

            createdAt: now.toISOString()
        };

        this.warranties.push(warranty);
        this._save(this.WARRANTY_KEY, this.warranties);

        return warranty;
    }

    /**
     * Get all warranties
     * @returns {Array} All warranty items sorted by creation date (newest first)
     */
    getWarranties() {
        return [...this.warranties].sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    /**
     * Get a single warranty by ID
     * @param {string} id
     * @returns {Object|null}
     */
    getWarranty(id) {
        return this.warranties.find(w => w.id === id) || null;
    }

    /**
     * Update a warranty item
     * @param {string} id
     * @param {Object} data - Fields to update
     * @returns {Object|null} Updated warranty or null if not found
     */
    updateWarranty(id, data) {
        const warranty = this.warranties.find(w => w.id === id);
        if (!warranty) { return null; }

        // Update allowed fields
        const updatable = [
            'orderName', 'customerName', 'customerPhone', 'customerEmail',
            'address', 'type', 'contractBasis', 'category', 'description',
            'completionDate', 'status'
        ];

        updatable.forEach(field => {
            if (data[field] !== undefined) {
                warranty[field] = data[field];
            }
        });

        // Recalculate end date if completion date or contract basis changed
        if (data.completionDate || data.contractBasis) {
            const years = this.WARRANTY_PERIODS[warranty.contractBasis] || 5;
            warranty.warrantyEndDate = this._addYears(warranty.completionDate, years);
        }

        warranty.updatedAt = new Date().toISOString();
        this._save(this.WARRANTY_KEY, this.warranties);

        return warranty;
    }

    /**
     * Get all active warranties (not expired, not only claims)
     * @returns {Array}
     */
    getActiveWarranties() {
        const today = this._today();
        return this.warranties.filter(w =>
            w.status === 'aktiv' && w.warrantyEndDate >= today
        );
    }

    /**
     * Get warranties expiring within a given number of days
     * @param {number} withinDays - Number of days to look ahead
     * @returns {Array} Warranties expiring soon, sorted by end date
     */
    getExpiringWarranties(withinDays = 90) {
        const today = this._today();
        const cutoff = this._addDays(today, withinDays);

        return this.warranties.filter(w =>
            w.status === 'aktiv' &&
            w.warrantyEndDate >= today &&
            w.warrantyEndDate <= cutoff
        ).sort((a, b) => a.warrantyEndDate.localeCompare(b.warrantyEndDate));
    }

    /**
     * Add a claim (Reklamation) to a warranty
     * @param {string} warrantyId
     * @param {Object} claimData
     * @returns {Object} { success, claim } or { success: false, error }
     */
    addClaim(warrantyId, claimData) {
        const warranty = this.warranties.find(w => w.id === warrantyId);
        if (!warranty) {
            return { success: false, error: 'Gewährleistung nicht gefunden' };
        }

        const claim = {
            id: 'RKL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            date: claimData.date || this._today(),
            description: claimData.description || '',
            resolution: claimData.resolution || '',
            cost: parseFloat(claimData.cost) || 0,
            status: claimData.status || 'offen'
        };

        warranty.claims.push(claim);
        warranty.status = 'reklamation';
        warranty.updatedAt = new Date().toISOString();

        this._save(this.WARRANTY_KEY, this.warranties);

        // Create task for warranty claim if taskService is available
        if (window.taskService) {
            try {
                window.taskService.addTask({
                    title: 'Reklamation: ' + (warranty.orderName || warranty.category),
                    description: 'Kunde: ' + warranty.customerName + '\n' +
                                 'Beschreibung: ' + claim.description,
                    priority: 'high',
                    source: 'warranty',
                    dueDate: this._today()
                });
            } catch (e) {
                console.warn('WarrantyMaintenance: Could not create task for claim', e);
            }
        }

        return { success: true, claim };
    }

    /**
     * Update an existing claim
     * @param {string} warrantyId
     * @param {string} claimId
     * @param {Object} data - Fields to update
     * @returns {Object} { success } or { success: false, error }
     */
    updateClaim(warrantyId, claimId, data) {
        const warranty = this.warranties.find(w => w.id === warrantyId);
        if (!warranty) {
            return { success: false, error: 'Gewährleistung nicht gefunden' };
        }

        const claim = warranty.claims.find(c => c.id === claimId);
        if (!claim) {
            return { success: false, error: 'Reklamation nicht gefunden' };
        }

        if (data.date !== undefined) { claim.date = data.date; }
        if (data.description !== undefined) { claim.description = data.description; }
        if (data.resolution !== undefined) { claim.resolution = data.resolution; }
        if (data.cost !== undefined) { claim.cost = parseFloat(data.cost) || 0; }
        if (data.status !== undefined) { claim.status = data.status; }

        // Recalculate warranty status based on open claims
        const hasOpenClaims = warranty.claims.some(c => c.status === 'offen');
        if (!hasOpenClaims && warranty.status === 'reklamation') {
            const today = this._today();
            warranty.status = warranty.warrantyEndDate < today ? 'abgelaufen' : 'aktiv';
        }

        warranty.updatedAt = new Date().toISOString();
        this._save(this.WARRANTY_KEY, this.warranties);

        return { success: true };
    }

    /**
     * Auto-create a warranty from a completed order
     * Fills fields automatically from order data
     * @param {Object} order - Order object from the workflow
     * @returns {Object} Created warranty
     */
    createWarrantyFromOrder(order) {
        const kunde = order.kunde || {};

        return this.createWarranty({
            orderId: order.id || '',
            orderName: order.titel || order.title || order.beschreibung || '',
            customerId: kunde.id || order.customerId || '',
            customerName: kunde.name || order.customerName || '',
            customerPhone: kunde.telefon || kunde.phone || '',
            customerEmail: kunde.email || '',
            address: kunde.adresse || kunde.address || '',
            type: 'gewaehrleistung',
            contractBasis: order.contractBasis || order.vertragsart || 'BGB',
            category: order.kategorie || order.category || '',
            description: order.beschreibung || order.description || order.titel || '',
            completionDate: order.completionDate || order.abnahmedatum || this._today()
        });
    }

    /* =======================================================
       MAINTENANCE CONTRACT MANAGEMENT (Wartungsvertrag)
       ======================================================= */

    /**
     * Create a new maintenance contract
     * @param {Object} data
     * @returns {Object} Created contract
     */
    createMaintenanceContract(data) {
        const now = new Date();
        const id = 'WTG-' + now.getTime() + '-' + Math.random().toString(36).substr(2, 6);

        const interval = data.interval || 'jaehrlich';
        const nextDueDate = data.nextDueDate || this._calculateNextDueFromInterval(this._today(), interval);

        const contract = {
            id: id,

            // Customer
            customerId: data.customerId || '',
            customerName: data.customerName || '',
            customerPhone: data.customerPhone || '',
            address: data.address || '',

            // Contract details
            name: data.name || '',
            description: data.description || '',

            // Schedule
            interval: interval,
            nextDueDate: nextDueDate,
            lastPerformedDate: data.lastPerformedDate || '',

            // Pricing
            flatRate: parseFloat(data.flatRate) || 0,
            includesPartsUpTo: parseFloat(data.includesPartsUpTo) || 0,

            // Status
            status: 'aktiv',

            // History
            history: [],

            createdAt: now.toISOString()
        };

        this.maintenanceContracts.push(contract);
        this._save(this.MAINTENANCE_KEY, this.maintenanceContracts);

        return contract;
    }

    /**
     * Get all maintenance contracts
     * @returns {Array} Sorted by creation date (newest first)
     */
    getMaintenanceContracts() {
        return [...this.maintenanceContracts].sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    /**
     * Get a single maintenance contract by ID
     * @param {string} id
     * @returns {Object|null}
     */
    getMaintenanceContract(id) {
        return this.maintenanceContracts.find(c => c.id === id) || null;
    }

    /**
     * Update a maintenance contract
     * @param {string} id
     * @param {Object} data - Fields to update
     * @returns {Object|null} Updated contract or null
     */
    updateMaintenanceContract(id, data) {
        const contract = this.maintenanceContracts.find(c => c.id === id);
        if (!contract) { return null; }

        const updatable = [
            'customerName', 'customerPhone', 'address',
            'name', 'description', 'interval', 'nextDueDate',
            'flatRate', 'includesPartsUpTo', 'status'
        ];

        updatable.forEach(field => {
            if (data[field] !== undefined) {
                contract[field] = data[field];
            }
        });

        // Parse numeric fields
        if (data.flatRate !== undefined) { contract.flatRate = parseFloat(data.flatRate) || 0; }
        if (data.includesPartsUpTo !== undefined) { contract.includesPartsUpTo = parseFloat(data.includesPartsUpTo) || 0; }

        contract.updatedAt = new Date().toISOString();
        this._save(this.MAINTENANCE_KEY, this.maintenanceContracts);

        return contract;
    }

    /**
     * Get all maintenance contracts that are overdue or due soon (within 14 days)
     * @returns {Array} Contracts needing attention, sorted by due date
     */
    getDueMaintenances() {
        const today = this._today();
        const soonCutoff = this._addDays(today, 14);

        return this.maintenanceContracts.filter(c =>
            c.status === 'aktiv' &&
            c.nextDueDate &&
            c.nextDueDate <= soonCutoff
        ).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
    }

    /**
     * Log a completed maintenance visit
     * @param {string} contractId
     * @param {Object} logData - Visit data
     * @returns {Object} { success, entry } or { success: false, error }
     */
    logMaintenance(contractId, logData) {
        const contract = this.maintenanceContracts.find(c => c.id === contractId);
        if (!contract) {
            return { success: false, error: 'Wartungsvertrag nicht gefunden' };
        }

        const entry = {
            date: logData.date || this._today(),
            performedBy: logData.performedBy || '',
            notes: logData.notes || '',
            partsUsed: (logData.partsUsed || []).map(p => ({
                name: p.name || '',
                cost: parseFloat(p.cost) || 0
            })),
            totalCost: parseFloat(logData.totalCost) || 0,
            invoiceId: logData.invoiceId || ''
        };

        contract.history.push(entry);
        contract.lastPerformedDate = entry.date;

        // Calculate next due date
        contract.nextDueDate = this._calculateNextDueFromInterval(entry.date, contract.interval);

        contract.updatedAt = new Date().toISOString();
        this._save(this.MAINTENANCE_KEY, this.maintenanceContracts);

        return { success: true, entry };
    }

    /**
     * Calculate the next due date for a contract based on its interval
     * @param {string} contractId
     * @returns {string} Next due date in YYYY-MM-DD format
     */
    calculateNextDueDate(contractId) {
        const contract = this.maintenanceContracts.find(c => c.id === contractId);
        if (!contract) { return null; }

        const baseDate = contract.lastPerformedDate || contract.nextDueDate || this._today();
        const next = this._calculateNextDueFromInterval(baseDate, contract.interval);

        contract.nextDueDate = next;
        this._save(this.MAINTENANCE_KEY, this.maintenanceContracts);

        return next;
    }

    /* =======================================================
       DASHBOARD & STATISTICS
       ======================================================= */

    /**
     * Get warranty statistics
     * @returns {Object} { active, expiringSoon, totalClaims, openClaims }
     */
    getWarrantyStats() {
        const today = this._today();
        const cutoff90 = this._addDays(today, 90);

        const active = this.warranties.filter(w =>
            w.status === 'aktiv' && w.warrantyEndDate >= today
        ).length;

        const expiringSoon = this.warranties.filter(w =>
            w.status === 'aktiv' &&
            w.warrantyEndDate >= today &&
            w.warrantyEndDate <= cutoff90
        ).length;

        const totalClaims = this.warranties.reduce((sum, w) => sum + w.claims.length, 0);

        const openClaims = this.warranties.reduce((sum, w) =>
            sum + w.claims.filter(c => c.status === 'offen').length, 0
        );

        return { active, expiringSoon, totalClaims, openClaims };
    }

    /**
     * Get maintenance statistics
     * @returns {Object} { activeContracts, dueSoon, overdue, monthlyRevenue }
     */
    getMaintenanceStats() {
        const today = this._today();
        const soonCutoff = this._addDays(today, 14);

        const activeContracts = this.maintenanceContracts.filter(c =>
            c.status === 'aktiv'
        ).length;

        const dueSoon = this.maintenanceContracts.filter(c =>
            c.status === 'aktiv' &&
            c.nextDueDate &&
            c.nextDueDate > today &&
            c.nextDueDate <= soonCutoff
        ).length;

        const overdue = this.maintenanceContracts.filter(c =>
            c.status === 'aktiv' &&
            c.nextDueDate &&
            c.nextDueDate < today
        ).length;

        // Calculate approximate monthly revenue from active contracts
        const monthlyRevenue = this.maintenanceContracts
            .filter(c => c.status === 'aktiv')
            .reduce((sum, c) => {
                const rate = c.flatRate || 0;
                switch (c.interval) {
                    case 'monatlich': return sum + rate;
                    case 'quartalsweise': return sum + (rate / 3);
                    case 'halbjaehrlich': return sum + (rate / 6);
                    case 'jaehrlich': return sum + (rate / 12);
                    default: return sum + (rate / 12);
                }
            }, 0);

        return { activeContracts, dueSoon, overdue, monthlyRevenue };
    }

    /**
     * Get all upcoming actions: warranty expiries + maintenance due dates
     * Combined and sorted by urgency
     * @returns {Array} Action items with type, severity, and details
     */
    getUpcomingActions() {
        const today = this._today();
        const actions = [];

        // Overdue maintenance (RED)
        this.maintenanceContracts
            .filter(c => c.status === 'aktiv' && c.nextDueDate && c.nextDueDate < today)
            .forEach(c => {
                actions.push({
                    type: 'maintenance_overdue',
                    severity: 'urgent',
                    id: c.id,
                    title: c.name + ' - ' + c.customerName,
                    detail: 'Wartung ueberfaellig seit ' + this._formatDateDE(c.nextDueDate),
                    dueDate: c.nextDueDate,
                    entity: c
                });
            });

        // Open warranty claims (RED)
        this.warranties.forEach(w => {
            const openClaims = w.claims.filter(c => c.status === 'offen');
            openClaims.forEach(claim => {
                actions.push({
                    type: 'warranty_claim',
                    severity: 'urgent',
                    id: w.id,
                    claimId: claim.id,
                    title: 'Reklamation: ' + (w.orderName || w.category) + ' - ' + w.customerName,
                    detail: claim.description,
                    dueDate: claim.date,
                    entity: w
                });
            });
        });

        // Maintenance due this week (AMBER)
        const weekCutoff = this._addDays(today, 7);
        this.maintenanceContracts
            .filter(c => c.status === 'aktiv' && c.nextDueDate && c.nextDueDate >= today && c.nextDueDate <= weekCutoff)
            .forEach(c => {
                actions.push({
                    type: 'maintenance_due_soon',
                    severity: 'warning',
                    id: c.id,
                    title: c.name + ' - ' + c.customerName,
                    detail: 'Wartung faellig am ' + this._formatDateDE(c.nextDueDate),
                    dueDate: c.nextDueDate,
                    entity: c
                });
            });

        // Warranties expiring in 30 days (AMBER)
        const days30Cutoff = this._addDays(today, 30);
        this.warranties
            .filter(w => w.status === 'aktiv' && w.warrantyEndDate >= today && w.warrantyEndDate <= days30Cutoff)
            .forEach(w => {
                actions.push({
                    type: 'warranty_expiring',
                    severity: 'warning',
                    id: w.id,
                    title: 'Gewaehrleistung laeuft ab: ' + (w.orderName || w.category),
                    detail: w.customerName + ' - Ablauf: ' + this._formatDateDE(w.warrantyEndDate),
                    dueDate: w.warrantyEndDate,
                    entity: w
                });
            });

        // Upcoming maintenance (BLUE)
        const days30 = this._addDays(today, 30);
        this.maintenanceContracts
            .filter(c => c.status === 'aktiv' && c.nextDueDate && c.nextDueDate > weekCutoff && c.nextDueDate <= days30)
            .forEach(c => {
                actions.push({
                    type: 'maintenance_upcoming',
                    severity: 'info',
                    id: c.id,
                    title: c.name + ' - ' + c.customerName,
                    detail: 'Naechste Wartung: ' + this._formatDateDE(c.nextDueDate),
                    dueDate: c.nextDueDate,
                    entity: c
                });
            });

        // Warranty milestones: expiring in 90 days (BLUE)
        const days90Cutoff = this._addDays(today, 90);
        this.warranties
            .filter(w => w.status === 'aktiv' && w.warrantyEndDate > days30Cutoff && w.warrantyEndDate <= days90Cutoff)
            .forEach(w => {
                actions.push({
                    type: 'warranty_milestone',
                    severity: 'info',
                    id: w.id,
                    title: 'Gewaehrleistung endet bald: ' + (w.orderName || w.category),
                    detail: w.customerName + ' - Ablauf: ' + this._formatDateDE(w.warrantyEndDate),
                    dueDate: w.warrantyEndDate,
                    entity: w
                });
            });

        // Sort by severity, then by date
        const severityOrder = { urgent: 0, warning: 1, info: 2 };
        actions.sort((a, b) => {
            const sevDiff = (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
            if (sevDiff !== 0) { return sevDiff; }
            return (a.dueDate || '').localeCompare(b.dueDate || '');
        });

        return actions;
    }

    /* =======================================================
       NOTIFICATIONS
       ======================================================= */

    /**
     * Check for items needing attention and trigger notifications
     * Called periodically or on app load
     */
    checkAndNotify() {
        const actions = this.getUpcomingActions();
        const urgentActions = actions.filter(a => a.severity === 'urgent');

        if (urgentActions.length === 0) { return; }

        // Browser notification
        if (window.notificationService) {
            urgentActions.forEach(action => {
                const notifKey = action.type + '_' + action.id + '_' + (action.claimId || '');

                // Only notify once per day per item
                if (!this._wasNotifiedToday(notifKey)) {
                    window.notificationService.sendNotification(
                        action.title,
                        {
                            body: action.detail,
                            tag: notifKey,
                            icon: '/icons/icon-192x192.png'
                        }
                    );
                    this._markNotified(notifKey);
                }
            });
        }

        // Push messenger for critical items
        if (window.pushMessengerService && urgentActions.length > 0) {
            const lines = urgentActions.map(a => {
                const icon = a.type.includes('maintenance') ? '\u{1F527}' : '\u{1F6E1}';
                return icon + ' ' + a.title + ' — ' + a.detail;
            });

            const dedupKey = 'wm_daily_' + this._today();
            if (!this._wasNotifiedToday(dedupKey)) {
                const message = 'MHS Workflow — Wartung & Gewaehrleistung:\n\n' + lines.join('\n');
                window.pushMessengerService.sendAlert(message, 'high');
                this._markNotified(dedupKey);
            }
        }
    }

    /* =======================================================
       INTERNAL HELPERS
       ======================================================= */

    /**
     * Auto-update status of expired warranties
     */
    _updateExpiredWarranties() {
        const today = this._today();
        let changed = false;

        this.warranties.forEach(w => {
            if (w.status === 'aktiv' && w.warrantyEndDate < today) {
                // Only mark expired if there are no open claims
                const hasOpenClaims = w.claims.some(c => c.status === 'offen');
                if (!hasOpenClaims) {
                    w.status = 'abgelaufen';
                    changed = true;
                }
            }
        });

        if (changed) {
            this._save(this.WARRANTY_KEY, this.warranties);
        }
    }

    /**
     * Add years to a date string
     * @param {string} dateStr - YYYY-MM-DD
     * @param {number} years
     * @returns {string} YYYY-MM-DD
     */
    _addYears(dateStr, years) {
        const date = new Date(dateStr + 'T00:00:00');
        date.setFullYear(date.getFullYear() + years);
        return date.toISOString().split('T')[0];
    }

    /**
     * Add days to a date string
     * @param {string} dateStr - YYYY-MM-DD
     * @param {number} days
     * @returns {string} YYYY-MM-DD
     */
    _addDays(dateStr, days) {
        const date = new Date(dateStr + 'T00:00:00');
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    /**
     * Get today's date as YYYY-MM-DD
     * @returns {string}
     */
    _today() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Calculate next due date based on interval
     * @param {string} fromDate - YYYY-MM-DD
     * @param {string} interval
     * @returns {string} YYYY-MM-DD
     */
    _calculateNextDueFromInterval(fromDate, interval) {
        const date = new Date(fromDate + 'T00:00:00');

        switch (interval) {
            case 'monatlich':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'quartalsweise':
                date.setMonth(date.getMonth() + 3);
                break;
            case 'halbjaehrlich':
                date.setMonth(date.getMonth() + 6);
                break;
            case 'jaehrlich':
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                date.setFullYear(date.getFullYear() + 1);
        }

        return date.toISOString().split('T')[0];
    }

    /**
     * Format a date string for German display
     * @param {string} dateStr - YYYY-MM-DD
     * @returns {string} DD.MM.YYYY
     */
    _formatDateDE(dateStr) {
        if (!dateStr) { return ''; }
        const parts = dateStr.split('-');
        if (parts.length !== 3) { return dateStr; }
        return parts[2] + '.' + parts[1] + '.' + parts[0];
    }

    /**
     * Check if an item was already notified today
     * @param {string} key
     * @returns {boolean}
     */
    _wasNotifiedToday(key) {
        const today = this._today();
        return this.notifyLog.some(entry =>
            entry.key === key && entry.date === today
        );
    }

    /**
     * Mark an item as notified
     * @param {string} key
     */
    _markNotified(key) {
        const today = this._today();
        // Clean old entries (keep last 7 days)
        const cutoff = this._addDays(today, -7);
        this.notifyLog = this.notifyLog.filter(e => e.date >= cutoff);

        this.notifyLog.push({ key, date: today });
        this._save(this.NOTIFY_LOG_KEY, this.notifyLog);
    }

    /**
     * Load data from localStorage
     * @param {string} key
     * @returns {Array}
     */
    _load(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) {
            console.error('WarrantyMaintenance: Error loading ' + key, e);
            return [];
        }
    }

    /**
     * Save data to localStorage
     * @param {string} key
     * @param {*} data
     */
    _save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('WarrantyMaintenance: Error saving ' + key, e);
        }
    }
}

// Initialize as global singleton
window.warrantyMaintenanceService = new WarrantyMaintenanceService();
