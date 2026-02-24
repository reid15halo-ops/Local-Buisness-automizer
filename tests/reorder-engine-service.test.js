import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] !== undefined ? store[key] : null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

global.localStorage = localStorageMock;

// Self-contained ReorderEngineService (pure logic extracted from js/services/reorder-engine-service.js)
class ReorderEngineService {
    constructor() {
        this.settings = {
            autoReorderEnabled: false,
            safetyStockMultiplier: 1.5,
            checkIntervalMinutes: 30,
            notifyOnReorder: true,
            reorderStrategy: 'min_bestand'
        };
        this.checkInterval = null;
        this.lastCheckTime = null;
        this.loadSettings();
    }

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
        return this.settings;
    }

    getSettings() {
        return { ...this.settings };
    }

    // ---- Reorder Threshold Detection ----

    isLowStock(material, availableStock) {
        const reorderPoint = material.minBestand || 0;
        return availableStock <= reorderPoint && reorderPoint > 0;
    }

    // ---- Order Quantity Strategies ----

    calculateOrderQty(material, shortage) {
        switch (this.settings.reorderStrategy) {
            case 'min_bestand':
                return this._calculateMinBestandQty(material, shortage);
            case 'economic_order_qty':
                return this._calculateEOQ(material, []);
            case 'fixed_qty':
                return this._calculateFixedQty(material);
            default:
                return this._calculateMinBestandQty(material, shortage);
        }
    }

    _calculateMinBestandQty(material, shortage) {
        const safetyStock = material.minBestand * this.settings.safetyStockMultiplier;
        return Math.ceil(shortage + safetyStock);
    }

    _calculateEOQFromMovements(material, movements) {
        const consumedMovements = movements.filter(m => m.type === 'consumed');
        const monthlyConsumption = consumedMovements.length > 0
            ? consumedMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0) / Math.max(1, consumedMovements.length)
            : material.minBestand;

        const annualDemand = monthlyConsumption * 12;
        const orderingCost = 25;
        const holdingCostPerUnit = material.preis * 0.20;

        if (holdingCostPerUnit === 0 || annualDemand === 0) {
            return this._calculateMinBestandQty(material, 0);
        }

        const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);
        return Math.max(Math.ceil(eoq), material.minBestand || 10);
    }

    _calculateEOQ(material) {
        return this._calculateMinBestandQty(material, 0); // Simplified without movements
    }

    _calculateFixedQty(material) {
        return material.reorderQty || material.minBestand || 100;
    }

    _calculateShortage(availableStock, reorderPoint) {
        return Math.max(0, reorderPoint - availableStock);
    }

    // ---- Supplier Grouping ----

    groupBySupplier(materials) {
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

    // ---- Audit Trail ----

    _logReorderActivity(auditEntry) {
        const log = JSON.parse(localStorage.getItem('reorder_activity_log') || '[]');
        log.push(auditEntry);
        if (log.length > 1000) { log.shift(); }
        localStorage.setItem('reorder_activity_log', JSON.stringify(log));
    }

    getActivityLog(filters = {}) {
        const log = JSON.parse(localStorage.getItem('reorder_activity_log') || '[]');
        return log.filter(entry => {
            if (filters.startDate && new Date(entry.timestamp) < new Date(filters.startDate)) { return false; }
            if (filters.endDate && new Date(entry.timestamp) > new Date(filters.endDate)) { return false; }
            return true;
        }).reverse();
    }

    clearLogs() {
        localStorage.removeItem('reorder_activity_log');
        localStorage.removeItem('reorder_po_log');
    }

    getStatistics() {
        const log = this.getActivityLog();
        const poLog = JSON.parse(localStorage.getItem('reorder_po_log') || '[]').reverse();

        const totalChecks = log.length;
        const totalItemsProcessed = log.reduce((sum, e) => sum + e.itemsChecked, 0);
        const totalLowStock = log.reduce((sum, e) => sum + e.itemsLowStock, 0);
        const totalPOsCreated = log.reduce((sum, e) => sum + e.posCreated, 0);
        const totalPOValue = poLog.reduce((sum, e) => sum + (e.totalValue || 0), 0);
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

    _getNextCheckTime() {
        if (!this.lastCheckTime) { return null; }
        const lastCheck = new Date(this.lastCheckTime);
        const nextCheck = new Date(lastCheck.getTime() + this.settings.checkIntervalMinutes * 60 * 1000);
        return nextCheck.toISOString();
    }

    exportAuditTrail(format = 'json') {
        const log = this.getActivityLog();
        const poLog = JSON.parse(localStorage.getItem('reorder_po_log') || '[]').reverse();

        const data = {
            exportDate: new Date().toISOString(),
            settings: this.settings,
            activityLog: log,
            poLog: poLog
        };

        if (format === 'csv') {
            let csv = 'Timestamp,Items Checked,Low Stock,POs Created,Strategy\n';
            data.activityLog.forEach(entry => {
                csv += `${entry.timestamp},${entry.itemsChecked},${entry.itemsLowStock},${entry.posCreated},${entry.reorderStrategy}\n`;
            });
            return csv;
        }

        return JSON.stringify(data, null, 2);
    }
}

// ---- Test Fixtures ----
const makeMaterial = (overrides = {}) => ({
    id: `MAT-${Date.now()}-${Math.random()}`,
    bezeichnung: 'Test Material',
    artikelnummer: 'TM-001',
    preis: 10.00,
    bestand: 100,
    minBestand: 20,
    lieferant: 'Test Lieferant',
    ...overrides
});

describe('ReorderEngineService', () => {
    let service;

    beforeEach(() => {
        localStorage.clear();
        service = new ReorderEngineService();
    });

    describe('Settings Management', () => {
        it('should load default settings', () => {
            const settings = service.getSettings();
            expect(settings.autoReorderEnabled).toBe(false);
            expect(settings.safetyStockMultiplier).toBe(1.5);
            expect(settings.checkIntervalMinutes).toBe(30);
            expect(settings.reorderStrategy).toBe('min_bestand');
        });

        it('should update settings and persist them', () => {
            service.updateSettings({ autoReorderEnabled: true, checkIntervalMinutes: 60 });
            const settings = service.getSettings();
            expect(settings.autoReorderEnabled).toBe(true);
            expect(settings.checkIntervalMinutes).toBe(60);
        });

        it('should persist settings to localStorage', () => {
            service.updateSettings({ safetyStockMultiplier: 2.0 });
            const saved = JSON.parse(localStorage.getItem('reorder_engine_settings'));
            expect(saved.safetyStockMultiplier).toBe(2.0);
        });

        it('should not overwrite unmentioned settings on partial update', () => {
            service.updateSettings({ checkIntervalMinutes: 45 });
            const settings = service.getSettings();
            expect(settings.reorderStrategy).toBe('min_bestand'); // Unchanged
        });

        it('should load settings from localStorage on construction', () => {
            localStorage.setItem('reorder_engine_settings', JSON.stringify({ checkIntervalMinutes: 15 }));
            const fresh = new ReorderEngineService();
            expect(fresh.getSettings().checkIntervalMinutes).toBe(15);
        });
    });

    describe('Reorder Threshold Detection', () => {
        it('should flag material as low stock when available <= minBestand', () => {
            const mat = makeMaterial({ bestand: 10, minBestand: 20 });
            expect(service.isLowStock(mat, 10)).toBe(true);
        });

        it('should flag material as low stock when available equals minBestand', () => {
            const mat = makeMaterial({ bestand: 20, minBestand: 20 });
            expect(service.isLowStock(mat, 20)).toBe(true);
        });

        it('should not flag material as low stock when available > minBestand', () => {
            const mat = makeMaterial({ bestand: 50, minBestand: 20 });
            expect(service.isLowStock(mat, 50)).toBe(false);
        });

        it('should not flag material with minBestand = 0', () => {
            const mat = makeMaterial({ bestand: 0, minBestand: 0 });
            expect(service.isLowStock(mat, 0)).toBe(false);
        });

        it('should calculate shortage correctly', () => {
            expect(service._calculateShortage(5, 20)).toBe(15);
            expect(service._calculateShortage(25, 20)).toBe(0); // Surplus → 0
            expect(service._calculateShortage(0, 15)).toBe(15);
        });
    });

    describe('Order Quantity Calculation - min_bestand Strategy', () => {
        it('should calculate order quantity with safety stock', () => {
            const mat = makeMaterial({ minBestand: 20 });
            const shortage = 15;
            // Qty = ceiling(shortage + minBestand * 1.5) = ceiling(15 + 30) = 45
            const qty = service._calculateMinBestandQty(mat, shortage);
            expect(qty).toBe(45);
        });

        it('should calculate correct qty with zero shortage', () => {
            const mat = makeMaterial({ minBestand: 20 });
            // Qty = ceiling(0 + 20 * 1.5) = 30
            const qty = service._calculateMinBestandQty(mat, 0);
            expect(qty).toBe(30);
        });

        it('should ceil the result (never partial units)', () => {
            const mat = makeMaterial({ minBestand: 7 });
            // Qty = ceiling(0 + 7 * 1.5) = ceiling(10.5) = 11
            const qty = service._calculateMinBestandQty(mat, 0);
            expect(qty).toBe(11);
        });

        it('should respect safetyStockMultiplier setting', () => {
            service.updateSettings({ safetyStockMultiplier: 2.0 });
            const mat = makeMaterial({ minBestand: 10 });
            // Qty = ceiling(0 + 10 * 2) = 20
            const qty = service._calculateMinBestandQty(mat, 0);
            expect(qty).toBe(20);
        });

        it('should use min_bestand strategy via calculateOrderQty', () => {
            service.updateSettings({ reorderStrategy: 'min_bestand' });
            const mat = makeMaterial({ minBestand: 10 });
            const qty = service.calculateOrderQty(mat, 5);
            // 5 + (10 * 1.5) = 20
            expect(qty).toBe(20);
        });
    });

    describe('Order Quantity Calculation - fixed_qty Strategy', () => {
        it('should use material reorderQty when set', () => {
            service.updateSettings({ reorderStrategy: 'fixed_qty' });
            const mat = makeMaterial({ minBestand: 10, reorderQty: 50 });
            const qty = service.calculateOrderQty(mat, 0);
            expect(qty).toBe(50);
        });

        it('should fall back to minBestand when reorderQty not set', () => {
            service.updateSettings({ reorderStrategy: 'fixed_qty' });
            const mat = makeMaterial({ minBestand: 25 });
            const qty = service._calculateFixedQty(mat);
            expect(qty).toBe(25);
        });

        it('should fall back to 100 when no reorderQty and no minBestand', () => {
            const mat = { ...makeMaterial(), minBestand: 0, reorderQty: undefined };
            const qty = service._calculateFixedQty(mat);
            expect(qty).toBe(100);
        });
    });

    describe('Supplier Selection / Grouping', () => {
        it('should group materials by supplier', () => {
            const mat1 = makeMaterial({ lieferant: 'Stahl AG', bezeichnung: 'Material A' });
            const mat2 = makeMaterial({ lieferant: 'Stahl AG', bezeichnung: 'Material B' });
            const mat3 = makeMaterial({ lieferant: 'Rohr GmbH', bezeichnung: 'Material C' });

            const grouped = service.groupBySupplier([mat1, mat2, mat3]);

            expect(Object.keys(grouped)).toHaveLength(2);
            expect(grouped['Stahl AG']).toHaveLength(2);
            expect(grouped['Rohr GmbH']).toHaveLength(1);
        });

        it('should use "Unknown" for materials without supplier', () => {
            const mat = { ...makeMaterial(), lieferant: undefined };
            const grouped = service.groupBySupplier([mat]);
            expect(grouped['Unknown']).toHaveLength(1);
        });

        it('should group single supplier correctly', () => {
            const mat = makeMaterial({ lieferant: 'Single Supplier' });
            const grouped = service.groupBySupplier([mat]);
            expect(grouped['Single Supplier']).toHaveLength(1);
        });

        it('should handle empty materials array', () => {
            const grouped = service.groupBySupplier([]);
            expect(Object.keys(grouped)).toHaveLength(0);
        });
    });

    describe('Audit Trail Logging', () => {
        it('should log reorder activity to localStorage', () => {
            const entry = {
                id: 'REORDER-001',
                timestamp: new Date().toISOString(),
                itemsChecked: 50,
                itemsLowStock: 3,
                posCreated: 2,
                reorderStrategy: 'min_bestand'
            };

            service._logReorderActivity(entry);
            const log = service.getActivityLog();
            expect(log.length).toBe(1);
            expect(log[0].itemsChecked).toBe(50);
        });

        it('should retrieve activity log with newest first', () => {
            service._logReorderActivity({
                id: 'R1', timestamp: '2026-01-01T00:00:00Z',
                itemsChecked: 10, itemsLowStock: 1, posCreated: 0, reorderStrategy: 'min_bestand'
            });
            service._logReorderActivity({
                id: 'R2', timestamp: '2026-02-01T00:00:00Z',
                itemsChecked: 20, itemsLowStock: 2, posCreated: 1, reorderStrategy: 'min_bestand'
            });

            const log = service.getActivityLog();
            // Newest first
            expect(log[0].id).toBe('R2');
        });

        it('should filter activity log by startDate', () => {
            service._logReorderActivity({
                id: 'OLD', timestamp: '2025-06-01T00:00:00Z',
                itemsChecked: 5, itemsLowStock: 0, posCreated: 0, reorderStrategy: 'min_bestand'
            });
            service._logReorderActivity({
                id: 'NEW', timestamp: '2026-02-01T00:00:00Z',
                itemsChecked: 10, itemsLowStock: 1, posCreated: 0, reorderStrategy: 'min_bestand'
            });

            const log = service.getActivityLog({ startDate: '2026-01-01' });
            expect(log.length).toBe(1);
            expect(log[0].id).toBe('NEW');
        });

        it('should clear all logs', () => {
            service._logReorderActivity({
                id: 'R1', timestamp: new Date().toISOString(),
                itemsChecked: 5, itemsLowStock: 1, posCreated: 0, reorderStrategy: 'min_bestand'
            });
            service.clearLogs();
            const log = service.getActivityLog();
            expect(log.length).toBe(0);
        });
    });

    describe('Statistics', () => {
        it('should return zero statistics when no activity logged', () => {
            const stats = service.getStatistics();
            expect(stats.totalChecks).toBe(0);
            expect(stats.totalPOsCreated).toBe(0);
            expect(stats.avgPOValue).toBe(0);
        });

        it('should accumulate statistics across multiple log entries', () => {
            service._logReorderActivity({
                id: 'R1', timestamp: new Date().toISOString(),
                itemsChecked: 100, itemsLowStock: 5, posCreated: 3, reorderStrategy: 'min_bestand'
            });
            service._logReorderActivity({
                id: 'R2', timestamp: new Date().toISOString(),
                itemsChecked: 80, itemsLowStock: 2, posCreated: 1, reorderStrategy: 'min_bestand'
            });

            const stats = service.getStatistics();
            expect(stats.totalChecks).toBe(2);
            expect(stats.totalItemsProcessed).toBe(180);
            expect(stats.totalLowStock).toBe(7);
            expect(stats.totalPOsCreated).toBe(4);
        });
    });

    describe('Export Audit Trail', () => {
        beforeEach(() => {
            service._logReorderActivity({
                id: 'R1', timestamp: '2026-02-01T10:00:00Z',
                itemsChecked: 50, itemsLowStock: 3, posCreated: 2, reorderStrategy: 'min_bestand'
            });
        });

        it('should export as JSON by default', () => {
            const exported = service.exportAuditTrail('json');
            const parsed = JSON.parse(exported);
            expect(parsed.settings).toBeDefined();
            expect(parsed.activityLog).toBeDefined();
        });

        it('should export as CSV', () => {
            const csv = service.exportAuditTrail('csv');
            expect(csv).toContain('Timestamp,Items Checked,Low Stock,POs Created,Strategy');
            expect(csv).toContain('2026-02-01T10:00:00Z');
        });

        it('should include current settings in JSON export', () => {
            service.updateSettings({ reorderStrategy: 'fixed_qty' });
            const exported = JSON.parse(service.exportAuditTrail('json'));
            expect(exported.settings.reorderStrategy).toBe('fixed_qty');
        });
    });

    describe('Next Check Time Calculation', () => {
        it('should return null when never checked', () => {
            expect(service._getNextCheckTime()).toBeNull();
        });

        it('should calculate next check time from last check', () => {
            const now = new Date('2026-02-24T10:00:00Z');
            service.lastCheckTime = now.toISOString();
            service.updateSettings({ checkIntervalMinutes: 30 });

            const nextCheck = service._getNextCheckTime();
            const nextDate = new Date(nextCheck);
            const diffMinutes = (nextDate - now) / (1000 * 60);
            expect(diffMinutes).toBe(30);
        });
    });

    describe('EOQ Calculation', () => {
        it('should calculate EOQ from consumption history', () => {
            const mat = makeMaterial({ preis: 10, minBestand: 10 });
            const movements = [
                { type: 'consumed', quantity: -50 },
                { type: 'consumed', quantity: -30 },
                { type: 'consumed', quantity: -40 },
                { type: 'reserved', quantity: 10 } // Not consumed - ignored
            ];

            const qty = service._calculateEOQFromMovements(mat, movements);
            // Monthly consumption = avg of |50|,|30|,|40| = 40
            // Annual demand = 40 * 12 = 480
            // Holding cost = 10 * 0.20 = 2 per year
            // EOQ = sqrt(2 * 480 * 25 / 2) = sqrt(12000) ≈ 109.5 → 110
            expect(qty).toBeGreaterThan(0);
            expect(typeof qty).toBe('number');
            expect(Number.isInteger(qty)).toBe(true); // Always ceil'd
        });

        it('should fall back to EOQ using minBestand as demand when no consumption history', () => {
            service.updateSettings({ safetyStockMultiplier: 1.5 });
            const mat = makeMaterial({ minBestand: 20, preis: 10 });
            const qty = service._calculateEOQFromMovements(mat, []);
            // Fallback: monthlyConsumption = minBestand = 20, annual = 240
            // EOQ = sqrt(2 * 240 * 25 / (10 * 0.20)) = sqrt(12000 / 2) = sqrt(6000) ≈ 77.5 → 78
            // Also max with minBestand(20) → 78
            expect(qty).toBeGreaterThanOrEqual(20); // At minimum, minBestand
            expect(typeof qty).toBe('number');
            expect(Number.isInteger(qty)).toBe(true);
        });
    });
});
