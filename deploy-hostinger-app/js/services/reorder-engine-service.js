/* ============================================
   Reorder Engine Service
   Auto-Reorder & Stock Movement Audit Trail
   ============================================ */

class ReorderEngineService {
    constructor() {
        this.settings = {
            autoReorderEnabled: false,
            safetyStockMultiplier: 1.5,
            checkIntervalMinutes: 30,
            notifyOnReorder: true,
            reorderStrategy: 'min_bestand' // 'min_bestand' | 'economic_order_qty' | 'fixed_qty'
        };
        this.checkInterval = null;
        this.lastCheckTime = null;
        this.loadSettings();
    }

    // ============================================
    // Settings Management
    // ============================================

    loadSettings() {
        const saved = localStorage.getItem('reorder_engine_settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    }

    saveSettings() {
        localStorage.setItem('reorder_engine_settings', JSON.stringify(this.settings));
    }

    updateSettings(updates) {
        this.settings = { ...this.settings, ...updates };
        this.saveSettings();

        // Restart interval if enabled and settings changed
        if (this.settings.autoReorderEnabled) {
            this.disable();
            this.enable();
        }

        return this.settings;
    }

    getSettings() {
        return { ...this.settings };
    }

    // ============================================
    // Enable/Disable Auto-Reorder
    // ============================================

    enable() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        const intervalMs = this.settings.checkIntervalMinutes * 60 * 1000;

        // Run check immediately
        this.checkAndReorder();

        // Then run periodically
        this.checkInterval = setInterval(() => {
            this.checkAndReorder();
        }, intervalMs);

        this.settings.autoReorderEnabled = true;
        this.saveSettings();

        console.log(`[ReorderEngine] Auto-reorder enabled. Check interval: ${this.settings.checkIntervalMinutes} minutes`);
    }

    disable() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        this.settings.autoReorderEnabled = false;
        this.saveSettings();

        console.log('[ReorderEngine] Auto-reorder disabled');
    }

    // ============================================
    // Core Reorder Logic
    // ============================================

    /**
     * Check for low stock and auto-reorder
     * @returns {Object} {created: number, items: Array, suppliers: Array, timestamp: ISO}
     */
    checkAndReorder() {
        if (!window.materialService) {
            console.error('[ReorderEngine] MaterialService not available');
            return { created: 0, items: [], suppliers: [], error: 'MaterialService unavailable' };
        }

        this.lastCheckTime = new Date().toISOString();

        // Get all materials with low stock
        const lowStockItems = this._getLowStockItemsWithReorderPoint();

        if (lowStockItems.length === 0) {
            console.log('[ReorderEngine] No items require reordering');
            return { created: 0, items: [], suppliers: [], timestamp: this.lastCheckTime };
        }

        // Group by supplier
        const bySupplier = this._groupBySupplier(lowStockItems);

        // Create POs via purchase-order-service if available
        const createdPOs = [];
        if (window.purchaseOrderService) {
            Object.entries(bySupplier).forEach(([supplierName, items]) => {
                const po = this._createPOForSupplier(supplierName, items);
                if (po) {
                    createdPOs.push(po);
                }
            });
        }

        // Log audit trail
        const auditEntry = {
            id: `REORDER-${Date.now()}`,
            timestamp: this.lastCheckTime,
            itemsChecked: window.materialService.getAllMaterials().length,
            itemsLowStock: lowStockItems.length,
            posCreated: createdPOs.length,
            items: lowStockItems.map(item => ({
                materialId: item.id,
                materialName: item.bezeichnung,
                currentStock: item.bestand,
                availableStock: window.materialService.getAvailableStock(item.id),
                minBestand: item.minBestand,
                suggestedQty: this._calculateOrderQty(item, this._calculateShortage(item)),
                supplier: item.lieferant
            })),
            reorderStrategy: this.settings.reorderStrategy
        };

        this._logReorderActivity(auditEntry);

        // Send notification if enabled
        if (this.settings.notifyOnReorder && createdPOs.length > 0) {
            this._notifyReorderCreated(createdPOs);
        }

        return {
            created: createdPOs.length,
            items: auditEntry.items,
            suppliers: Object.keys(bySupplier),
            timestamp: this.lastCheckTime,
            pos: createdPOs
        };
    }

    /**
     * Get materials below reorder point
     * @private
     */
    _getLowStockItemsWithReorderPoint() {
        const materials = window.materialService.getAllMaterials();

        return materials.filter(material => {
            const availableStock = window.materialService.getAvailableStock(material.id);
            const reorderPoint = material.minBestand || 0;

            // Item needs reorder if available stock <= reorder point
            return availableStock <= reorderPoint && reorderPoint > 0;
        });
    }

    /**
     * Group materials by supplier
     * @private
     */
    _groupBySupplier(materials) {
        const grouped = {};

        materials.forEach(material => {
            const supplier = material.lieferant || 'Unknown';
            if (!grouped[supplier]) {
                grouped[supplier] = [];
            }
            grouped[supplier].push(material);
        });

        return grouped;
    }

    /**
     * Create PO for a supplier
     * @private
     */
    _createPOForSupplier(supplierName, materials) {
        try {
            // Get or create supplier object
            let supplier = window.purchaseOrderService.getSupplier(supplierName);
            if (!supplier) {
                supplier = {
                    name: supplierName,
                    email: '',
                    telefon: '',
                    ansprechpartner: '',
                    lieferzeit_tage: 5
                };
                window.purchaseOrderService.addSupplier(supplier);
            }

            // Build position list with calculated order quantities
            const positionen = materials.map(material => {
                const shortage = this._calculateShortage(material);
                const orderQty = this._calculateOrderQty(material, shortage);

                return {
                    materialId: material.id,
                    bezeichnung: material.bezeichnung,
                    artikelnummer: material.artikelnummer,
                    menge: orderQty,
                    einheit: material.einheit,
                    ekPreis: material.preis
                };
            });

            // Create the PO
            const po = window.purchaseOrderService.createPO(supplier, positionen, {
                notizen: `Auto-generated by ReorderEngine (${this.settings.reorderStrategy})`
            });

            // Log to audit trail
            this._logPOCreated(po, materials);

            return po;
        } catch (error) {
            console.error('[ReorderEngine] Error creating PO for supplier:', supplierName, error);
            return null;
        }
    }

    /**
     * Calculate shortage for a material
     * @private
     */
    _calculateShortage(material) {
        const availableStock = window.materialService.getAvailableStock(material.id);
        const reorderPoint = material.minBestand || 0;
        return Math.max(0, reorderPoint - availableStock);
    }

    // ============================================
    // Order Quantity Calculation Strategies
    // ============================================

    /**
     * Calculate order quantity based on configured strategy
     */
    calculateOrderQty(material, shortage) {
        switch (this.settings.reorderStrategy) {
            case 'min_bestand':
                return this._calculateMinBestandQty(material, shortage);

            case 'economic_order_qty':
                return this._calculateEOQ(material);

            case 'fixed_qty':
                return this._calculateFixedQty(material);

            default:
                return this._calculateMinBestandQty(material, shortage);
        }
    }

    /**
     * Private wrapper for strategy calculation
     * @private
     */
    _calculateOrderQty(material, shortage) {
        return this.calculateOrderQty(material, shortage);
    }

    /**
     * Strategy: Reorder to 2x minimum stock
     * Order Qty = Shortage + (MinBestand * SafetyMultiplier)
     * @private
     */
    _calculateMinBestandQty(material, shortage) {
        const safetyStock = material.minBestand * this.settings.safetyStockMultiplier;
        return Math.ceil(shortage + safetyStock);
    }

    /**
     * Strategy: Economic Order Quantity (Wilson Formula)
     * EOQ = sqrt(2 * D * S / H)
     * D = annual demand (estimated from history)
     * S = ordering cost (fixed, €25)
     * H = holding cost per unit per year (20% of unit cost)
     * @private
     */
    _calculateEOQ(material) {
        // Estimate annual demand from movement history
        const movements = window.materialService.getStockMovements(material.id);
        const consumedMovements = movements.filter(m => m.type === 'consumed');

        // Assume last 12 movements represent monthly consumption
        const monthlyConsumption = consumedMovements.length > 0
            ? consumedMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0) / Math.max(1, consumedMovements.length)
            : material.minBestand; // Fallback to min bestand

        const annualDemand = monthlyConsumption * 12;
        const orderingCost = 25; // Fixed cost per order (€)
        const holdingCostPercentage = 0.20; // 20% of unit cost per year
        const holdingCostPerUnit = material.preis * holdingCostPercentage;

        if (holdingCostPerUnit === 0 || annualDemand === 0) {
            // Fallback to min_bestand strategy if unable to calculate
            return this._calculateMinBestandQty(material, 0);
        }

        // EOQ = sqrt(2 * D * S / H)
        const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);

        // Ensure minimum order quantity
        return Math.max(Math.ceil(eoq), material.minBestand || 10);
    }

    /**
     * Strategy: Fixed reorder quantity
     * @private
     */
    _calculateFixedQty(material) {
        return material.reorderQty || material.minBestand || 100;
    }

    // ============================================
    // Reorder Suggestions (without auto-ordering)
    // ============================================

    /**
     * Get reorder suggestions for dashboard display
     * @returns {Array} [{material, shortage, suggestedQty, supplier}, ...]
     */
    getReorderSuggestions() {
        if (!window.materialService) {
            return [];
        }

        const lowStockItems = this._getLowStockItemsWithReorderPoint();

        return lowStockItems.map(material => {
            const shortage = this._calculateShortage(material);
            const suggestedQty = this._calculateOrderQty(material, shortage);

            return {
                material: material,
                shortage: shortage,
                suggestedQty: suggestedQty,
                supplier: material.lieferant,
                reorderPoint: material.minBestand,
                availableStock: window.materialService.getAvailableStock(material.id)
            };
        });
    }

    /**
     * Get reorder status summary
     * @returns {Object} {totalItems, lowStockCount, suggestions}
     */
    getReorderStatus() {
        if (!window.materialService) {
            return { totalItems: 0, lowStockCount: 0, suggestions: [] };
        }

        const allMaterials = window.materialService.getAllMaterials();
        const suggestions = this.getReorderSuggestions();

        return {
            totalItems: allMaterials.length,
            lowStockCount: suggestions.length,
            suggestions: suggestions,
            lastCheck: this.lastCheckTime,
            nextCheck: this._getNextCheckTime()
        };
    }

    /**
     * Calculate next scheduled check time
     * @private
     */
    _getNextCheckTime() {
        if (!this.lastCheckTime) {return null;}

        const lastCheck = new Date(this.lastCheckTime);
        const nextCheck = new Date(lastCheck.getTime() + this.settings.checkIntervalMinutes * 60 * 1000);
        return nextCheck.toISOString();
    }

    // ============================================
    // Audit Trail & Logging
    // ============================================

    /**
     * Log reorder activity
     * @private
     */
    _logReorderActivity(auditEntry) {
        const log = JSON.parse(localStorage.getItem('reorder_activity_log') || '[]');
        log.push(auditEntry);

        // Keep only last 1000 entries
        if (log.length > 1000) {
            log.shift();
        }

        localStorage.setItem('reorder_activity_log', JSON.stringify(log));
    }

    /**
     * Log PO creation
     * @private
     */
    _logPOCreated(po, materials) {
        const log = JSON.parse(localStorage.getItem('reorder_po_log') || '[]');
        log.push({
            timestamp: new Date().toISOString(),
            poId: po.id,
            poNummer: po.nummer,
            supplier: po.lieferant.name,
            materialCount: materials.length,
            totalValue: po.brutto,
            strategy: this.settings.reorderStrategy
        });

        // Keep only last 500 entries
        if (log.length > 500) {
            log.shift();
        }

        localStorage.setItem('reorder_po_log', JSON.stringify(log));
    }

    /**
     * Get reorder activity log
     * @param {Object} filters - {startDate, endDate, supplier}
     * @returns {Array} Activity log entries
     */
    getActivityLog(filters = {}) {
        const log = JSON.parse(localStorage.getItem('reorder_activity_log') || '[]');

        return log.filter(entry => {
            if (filters.startDate && new Date(entry.timestamp) < new Date(filters.startDate)) {return false;}
            if (filters.endDate && new Date(entry.timestamp) > new Date(filters.endDate)) {return false;}
            return true;
        }).reverse(); // Newest first
    }

    /**
     * Get PO creation log
     * @returns {Array} PO creation log entries
     */
    getPOLog() {
        return JSON.parse(localStorage.getItem('reorder_po_log') || '[]').reverse();
    }

    /**
     * Clear all logs (for admin/maintenance)
     */
    clearLogs() {
        localStorage.removeItem('reorder_activity_log');
        localStorage.removeItem('reorder_po_log');
    }

    // ============================================
    // Notifications
    // ============================================

    /**
     * Send notification about created POs
     * @private
     */
    _notifyReorderCreated(pos) {
        try {
            if (window.notificationService) {
                const message = `${pos.length} Nachbestellung(en) automatisch erstellt`;
                window.notificationService.show({
                    title: 'Automatische Nachbestellung',
                    message: message,
                    type: 'success',
                    duration: 5000
                });
            } else {
                console.log('[ReorderEngine] Notification:', `${pos.length} POs created`);
            }
        } catch (error) {
            console.error('[ReorderEngine] Notification error:', error);
        }
    }

    // ============================================
    // Stats & Reporting
    // ============================================

    /**
     * Get reorder statistics
     * @returns {Object} Statistics about reorder activity
     */
    getStatistics() {
        const log = this.getActivityLog();
        const poLog = this.getPOLog();

        const totalChecks = log.length;
        const totalItemsProcessed = log.reduce((sum, entry) => sum + entry.itemsChecked, 0);
        const totalLowStock = log.reduce((sum, entry) => sum + entry.itemsLowStock, 0);
        const totalPOsCreated = log.reduce((sum, entry) => sum + entry.posCreated, 0);

        const totalPOValue = poLog.reduce((sum, entry) => sum + entry.totalValue, 0);
        const avgPOValue = poLog.length > 0 ? totalPOValue / poLog.length : 0;

        return {
            totalChecks,
            totalItemsProcessed,
            totalLowStock,
            totalPOsCreated,
            totalPOValue,
            avgPOValue,
            recentChecks: log.slice(0, 10)
        };
    }

    // ============================================
    // Persistence
    // ============================================

    exportAuditTrail(format = 'json') {
        const log = this.getActivityLog();
        const poLog = this.getPOLog();

        const data = {
            exportDate: new Date().toISOString(),
            settings: this.settings,
            activityLog: log,
            poLog: poLog
        };

        if (format === 'csv') {
            return this._convertToCSV(data);
        }

        return JSON.stringify(data, null, 2);
    }

    /**
     * Convert activity log to CSV
     * @private
     */
    _convertToCSV(data) {
        let csv = 'Timestamp,Items Checked,Low Stock,POs Created,Strategy\n';

        data.activityLog.forEach(entry => {
            csv += `${entry.timestamp},${entry.itemsChecked},${entry.itemsLowStock},${entry.posCreated},${entry.reorderStrategy}\n`;
        });

        return csv;
    }
}

// Create global instance
window.reorderEngineService = new ReorderEngineService();
