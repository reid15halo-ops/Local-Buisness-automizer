import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock StorageUtils used by WarrantyService for persistence
const StorageUtils = {
    getJSON: vi.fn(() => [])
};

// Mock localStorage
const localStorage = {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn()
};

// Mock window and globals
const window = { taskService: null };

// Expose mocks as globals
globalThis.StorageUtils = StorageUtils;
globalThis.localStorage = localStorage;
globalThis.window = window;

// Self-contained WarrantyService (extracted from js/services/warranty-service.js)
class WarrantyService {
    constructor() {
        this.warranties = StorageUtils.getJSON('freyai_warranties', [], { service: 'warrantyService' });
        this.settings = StorageUtils.getJSON('freyai_warranty_settings', {}, { service: 'warrantyService' });

        if (!this.settings.defaultWarrantyMonths) { this.settings.defaultWarrantyMonths = 24; }
        if (!this.settings.reminderDaysBefore) { this.settings.reminderDaysBefore = 30; }
    }

    addWarranty(data) {
        const warranty = {
            id: 'war-' + Date.now(),
            jobId: data.jobId,
            invoiceId: data.invoiceId,
            customerId: data.customerId,
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            customerPhone: data.customerPhone,
            productName: data.productName || data.description,
            productType: data.productType || 'service',
            serialNumber: data.serialNumber || null,
            startDate: data.startDate || new Date().toISOString().split('T')[0],
            durationMonths: data.durationMonths || this.settings.defaultWarrantyMonths,
            endDate: null,
            coverageType: data.coverageType || 'full',
            terms: data.terms || 'Standard-Garantie gemäß Lieferbedingungen',
            exclusions: data.exclusions || [],
            status: 'active',
            claims: [],
            notes: data.notes || '',
            attachments: data.attachments || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        warranty.endDate = this.calculateEndDate(warranty.startDate, warranty.durationMonths);
        this.warranties.push(warranty);
        this.save();
        this.scheduleExpiryReminder(warranty);
        return warranty;
    }

    calculateEndDate(startDate, months) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + months);
        return date.toISOString().split('T')[0];
    }

    addClaim(warrantyId, claimData) {
        const warranty = this.warranties.find(w => w.id === warrantyId);
        if (!warranty) { return { success: false, error: 'Warranty not found' }; }
        if (warranty.status !== 'active') { return { success: false, error: 'Warranty not active' }; }

        const claim = {
            id: 'claim-' + Date.now(),
            date: new Date().toISOString(),
            issue: claimData.issue,
            description: claimData.description,
            resolution: claimData.resolution || 'pending',
            cost: claimData.cost || 0,
            coveredByWarranty: claimData.coveredByWarranty !== false,
            technician: claimData.technician || '',
            status: 'open'
        };

        warranty.claims.push(claim);
        warranty.status = 'claimed';
        warranty.updatedAt = new Date().toISOString();
        this.save();

        if (window.taskService) {
            window.taskService.addTask({
                title: `Garantiefall: ${warranty.productName}`,
                description: `Kunde: ${warranty.customerName}\nProblem: ${claim.issue}`,
                priority: 'high',
                source: 'warranty',
                dueDate: new Date().toISOString().split('T')[0]
            });
        }

        return { success: true, claim };
    }

    resolveClaim(warrantyId, claimId, resolution) {
        const warranty = this.warranties.find(w => w.id === warrantyId);
        if (!warranty) { return { success: false }; }

        const claim = warranty.claims.find(c => c.id === claimId);
        if (!claim) { return { success: false }; }

        claim.status = 'resolved';
        claim.resolution = resolution.description;
        claim.resolvedAt = new Date().toISOString();
        claim.cost = resolution.cost || 0;

        const hasOpenClaims = warranty.claims.some(c => c.status === 'open' || c.status === 'in_progress');
        if (!hasOpenClaims) {
            warranty.status = 'active';
        }

        warranty.updatedAt = new Date().toISOString();
        this.save();
        return { success: true };
    }

    getExpiringWarranties(daysAhead = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + daysAhead);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        return this.warranties.filter(w =>
            w.status === 'active' &&
            w.endDate >= today &&
            w.endDate <= cutoffStr
        ).sort((a, b) => a.endDate.localeCompare(b.endDate));
    }

    getExpiredWarranties() {
        const today = new Date().toISOString().split('T')[0];
        return this.warranties.filter(w =>
            w.status === 'active' && w.endDate < today
        );
    }

    updateExpiredWarranties() {
        const today = new Date().toISOString().split('T')[0];
        let updated = 0;

        this.warranties.forEach(w => {
            if (w.status === 'active' && w.endDate < today) {
                w.status = 'expired';
                w.expiredAt = new Date().toISOString();
                updated++;
            }
        });

        if (updated > 0) { this.save(); }
        return updated;
    }

    scheduleExpiryReminder(warranty) {
        const reminderDate = new Date(warranty.endDate);
        reminderDate.setDate(reminderDate.getDate() - this.settings.reminderDaysBefore);

        if (reminderDate <= new Date()) {
            if (window.taskService) {
                window.taskService.addTask({
                    title: `Garantie läuft ab: ${warranty.productName}`,
                    description: `Kunde: ${warranty.customerName}\nAblaufdatum: ${warranty.endDate}`,
                    priority: 'normal',
                    source: 'warranty',
                    dueDate: warranty.endDate
                });
            }
        }
    }

    getWarranty(id) {
        return this.warranties.find(w => w.id === id);
    }

    getWarrantiesByCustomer(customerId) {
        return this.warranties.filter(w => w.customerId === customerId);
    }

    getWarrantiesByJob(jobId) {
        return this.warranties.filter(w => w.jobId === jobId || w.invoiceId === jobId);
    }

    searchWarranties(query) {
        const q = query.toLowerCase();
        return this.warranties.filter(w =>
            w.productName.toLowerCase().includes(q) ||
            w.customerName.toLowerCase().includes(q) ||
            (w.serialNumber && w.serialNumber.toLowerCase().includes(q))
        );
    }

    getWarranties(filters = {}) {
        let warranties = [...this.warranties];

        if (filters.status) {
            warranties = warranties.filter(w => w.status === filters.status);
        }
        if (filters.customerId) {
            warranties = warranties.filter(w => w.customerId === filters.customerId);
        }
        if (filters.productType) {
            warranties = warranties.filter(w => w.productType === filters.productType);
        }

        return warranties.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getStatistics() {
        const active = this.warranties.filter(w => w.status === 'active').length;
        const expired = this.warranties.filter(w => w.status === 'expired').length;
        const claimed = this.warranties.filter(w => w.status === 'claimed').length;
        const expiringSoon = this.getExpiringWarranties(30).length;

        const totalClaims = this.warranties.reduce((sum, w) => sum + w.claims.length, 0);
        const claimCosts = this.warranties.reduce((sum, w) =>
            sum + w.claims.reduce((s, c) => s + (c.coveredByWarranty ? c.cost : 0), 0), 0
        );

        return {
            total: this.warranties.length,
            active,
            expired,
            claimed,
            expiringSoon,
            totalClaims,
            claimCosts
        };
    }

    voidWarranty(id, reason) {
        const warranty = this.warranties.find(w => w.id === id);
        if (!warranty) { return { success: false }; }

        warranty.status = 'voided';
        warranty.voidedAt = new Date().toISOString();
        warranty.voidReason = reason;
        warranty.updatedAt = new Date().toISOString();

        this.save();
        return { success: true };
    }

    extendWarranty(id, additionalMonths) {
        const warranty = this.warranties.find(w => w.id === id);
        if (!warranty) { return { success: false }; }

        warranty.durationMonths += additionalMonths;
        warranty.endDate = this.calculateEndDate(warranty.startDate, warranty.durationMonths);
        warranty.extended = true;
        warranty.extendedAt = new Date().toISOString();
        warranty.updatedAt = new Date().toISOString();

        this.save();
        return { success: true, newEndDate: warranty.endDate };
    }

    save() {
        localStorage.setItem('freyai_warranties', JSON.stringify(this.warranties));
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WarrantyService', () => {
    let service;

    const defaultWarrantyData = {
        jobId: 'job-001',
        invoiceId: 'inv-001',
        customerId: 'cust-001',
        customerName: 'Hans Müller',
        customerEmail: 'hans@mueller-sanitaer.de',
        customerPhone: '+49 170 1234567',
        productName: 'Heizungsanlage Viessmann Vitodens 300',
        productType: 'installation',
        serialNumber: 'VT-2026-00042',
        startDate: '2026-01-15',
        durationMonths: 24,
        coverageType: 'full',
        notes: 'Einbau im Keller, Zugang über Seitentür'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        StorageUtils.getJSON.mockImplementation((_key, defaultVal) => {
            if (Array.isArray(defaultVal)) return [];
            return {};
        });
        localStorage.setItem.mockClear();
        window.taskService = null;
        service = new WarrantyService();
    });

    // -----------------------------------------------------------------------
    // Constructor & Defaults
    // -----------------------------------------------------------------------
    describe('Constructor & Defaults', () => {
        it('should initialize with empty warranties array', () => {
            expect(service.warranties).toEqual([]);
        });

        it('should set defaultWarrantyMonths to 24', () => {
            expect(service.settings.defaultWarrantyMonths).toBe(24);
        });

        it('should set reminderDaysBefore to 30', () => {
            expect(service.settings.reminderDaysBefore).toBe(30);
        });

        it('should load data via StorageUtils.getJSON', () => {
            expect(StorageUtils.getJSON).toHaveBeenCalledWith(
                'freyai_warranties', [], { service: 'warrantyService' }
            );
            expect(StorageUtils.getJSON).toHaveBeenCalledWith(
                'freyai_warranty_settings', {}, { service: 'warrantyService' }
            );
        });
    });

    // -----------------------------------------------------------------------
    // Warranty Creation
    // -----------------------------------------------------------------------
    describe('addWarranty', () => {
        it('should create a warranty with status active', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            expect(warranty.status).toBe('active');
        });

        it('should assign an id starting with war-', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            expect(warranty.id).toMatch(/^war-/);
        });

        it('should store customer data on the warranty', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            expect(warranty.customerId).toBe('cust-001');
            expect(warranty.customerName).toBe('Hans Müller');
            expect(warranty.customerEmail).toBe('hans@mueller-sanitaer.de');
            expect(warranty.customerPhone).toBe('+49 170 1234567');
        });

        it('should store product details', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            expect(warranty.productName).toBe('Heizungsanlage Viessmann Vitodens 300');
            expect(warranty.productType).toBe('installation');
            expect(warranty.serialNumber).toBe('VT-2026-00042');
        });

        it('should calculate endDate based on startDate and durationMonths', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            expect(warranty.endDate).toBe('2028-01-15');
        });

        it('should default productType to service when not provided', () => {
            const { productType, ...dataWithoutType } = defaultWarrantyData;
            const warranty = service.addWarranty(dataWithoutType);
            expect(warranty.productType).toBe('service');
        });

        it('should default durationMonths to 24 when not provided', () => {
            const { durationMonths, ...dataWithout } = defaultWarrantyData;
            const warranty = service.addWarranty(dataWithout);
            expect(warranty.durationMonths).toBe(24);
        });

        it('should default coverageType to full', () => {
            const { coverageType, ...dataWithout } = defaultWarrantyData;
            const warranty = service.addWarranty(dataWithout);
            expect(warranty.coverageType).toBe('full');
        });

        it('should set default German terms when not provided', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            expect(warranty.terms).toBe('Standard-Garantie gemäß Lieferbedingungen');
        });

        it('should initialize empty claims array', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            expect(warranty.claims).toEqual([]);
        });

        it('should use description as productName fallback', () => {
            const data = { ...defaultWarrantyData, productName: undefined, description: 'Rohrreinigung' };
            const warranty = service.addWarranty(data);
            expect(warranty.productName).toBe('Rohrreinigung');
        });

        it('should set serialNumber to null when not provided', () => {
            const { serialNumber, ...dataWithout } = defaultWarrantyData;
            const warranty = service.addWarranty(dataWithout);
            expect(warranty.serialNumber).toBeNull();
        });

        it('should persist via localStorage after creation', () => {
            service.addWarranty(defaultWarrantyData);
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_warranties',
                expect.any(String)
            );
        });

        it('should store custom exclusions', () => {
            const data = {
                ...defaultWarrantyData,
                exclusions: ['Frostschäden', 'Eigenverschulden']
            };
            const warranty = service.addWarranty(data);
            expect(warranty.exclusions).toEqual(['Frostschäden', 'Eigenverschulden']);
        });

        it('should store attachments', () => {
            const data = {
                ...defaultWarrantyData,
                attachments: ['garantieschein.pdf']
            };
            const warranty = service.addWarranty(data);
            expect(warranty.attachments).toEqual(['garantieschein.pdf']);
        });
    });

    // -----------------------------------------------------------------------
    // calculateEndDate
    // -----------------------------------------------------------------------
    describe('calculateEndDate', () => {
        it('should add 24 months correctly', () => {
            const result = service.calculateEndDate('2026-01-15', 24);
            expect(result).toBe('2028-01-15');
        });

        it('should add 12 months correctly', () => {
            const result = service.calculateEndDate('2026-06-01', 12);
            expect(result).toBe('2027-06-01');
        });

        it('should add 6 months correctly', () => {
            const result = service.calculateEndDate('2026-01-01', 6);
            expect(result).toBe('2026-07-01');
        });

        it('should handle month overflow across year boundary', () => {
            const result = service.calculateEndDate('2026-11-01', 3);
            expect(result).toBe('2027-02-01');
        });
    });

    // -----------------------------------------------------------------------
    // Warranty Claims
    // -----------------------------------------------------------------------
    describe('addClaim', () => {
        it('should add a claim to an active warranty', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const result = service.addClaim(warranty.id, {
                issue: 'Heizung heizt nicht mehr',
                description: 'Brenner startet nicht bei Außentemperatur unter 0°C'
            });
            expect(result.success).toBe(true);
            expect(result.claim).toBeDefined();
            expect(result.claim.issue).toBe('Heizung heizt nicht mehr');
        });

        it('should set warranty status to claimed', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            service.addClaim(warranty.id, {
                issue: 'Undichtigkeit',
                description: 'Wasser tropft am Anschluss'
            });
            expect(warranty.status).toBe('claimed');
        });

        it('should assign claim id starting with claim-', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const result = service.addClaim(warranty.id, {
                issue: 'Störung',
                description: 'Fehlermeldung F28'
            });
            expect(result.claim.id).toMatch(/^claim-/);
        });

        it('should default resolution to pending', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const result = service.addClaim(warranty.id, {
                issue: 'Defekt',
                description: 'Pumpe defekt'
            });
            expect(result.claim.resolution).toBe('pending');
        });

        it('should default cost to 0', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const result = service.addClaim(warranty.id, {
                issue: 'Defekt',
                description: 'Test'
            });
            expect(result.claim.cost).toBe(0);
        });

        it('should default coveredByWarranty to true', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const result = service.addClaim(warranty.id, {
                issue: 'Defekt',
                description: 'Test'
            });
            expect(result.claim.coveredByWarranty).toBe(true);
        });

        it('should allow coveredByWarranty to be set to false', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const result = service.addClaim(warranty.id, {
                issue: 'Eigenverschulden',
                description: 'Kunde hat falsche Filter eingesetzt',
                coveredByWarranty: false
            });
            expect(result.claim.coveredByWarranty).toBe(false);
        });

        it('should return error for nonexistent warranty', () => {
            const result = service.addClaim('war-nonexistent', {
                issue: 'Test',
                description: 'Test'
            });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Warranty not found');
        });

        it('should return error for non-active warranty', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            service.voidWarranty(warranty.id, 'Storniert');
            const result = service.addClaim(warranty.id, {
                issue: 'Test',
                description: 'Test'
            });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Warranty not active');
        });

        it('should store technician when provided', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const result = service.addClaim(warranty.id, {
                issue: 'Defekt',
                description: 'Ventil defekt',
                technician: 'Stefan Becker'
            });
            expect(result.claim.technician).toBe('Stefan Becker');
        });

        it('should create a task via taskService when available', () => {
            window.taskService = { addTask: vi.fn() };
            const warranty = service.addWarranty(defaultWarrantyData);
            service.addClaim(warranty.id, {
                issue: 'Heizung ausgefallen',
                description: 'Komplettausfall'
            });
            expect(window.taskService.addTask).toHaveBeenCalledTimes(1);
            expect(window.taskService.addTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    priority: 'high',
                    source: 'warranty'
                })
            );
        });

        it('should not throw when taskService is not available', () => {
            window.taskService = null;
            const warranty = service.addWarranty(defaultWarrantyData);
            expect(() => service.addClaim(warranty.id, {
                issue: 'Test',
                description: 'Test'
            })).not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // Resolve Claim
    // -----------------------------------------------------------------------
    describe('resolveClaim', () => {
        it('should resolve a claim successfully', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const { claim } = service.addClaim(warranty.id, {
                issue: 'Defekt',
                description: 'Pumpe defekt'
            });
            const result = service.resolveClaim(warranty.id, claim.id, {
                description: 'Pumpe ausgetauscht',
                cost: 150
            });
            expect(result.success).toBe(true);
        });

        it('should set claim status to resolved', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const { claim } = service.addClaim(warranty.id, {
                issue: 'Defekt',
                description: 'Test'
            });
            service.resolveClaim(warranty.id, claim.id, {
                description: 'Behoben',
                cost: 0
            });
            const resolvedClaim = warranty.claims.find(c => c.id === claim.id);
            expect(resolvedClaim.status).toBe('resolved');
        });

        it('should set resolution description and cost', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const { claim } = service.addClaim(warranty.id, {
                issue: 'Leck',
                description: 'Wasserleitung undicht'
            });
            service.resolveClaim(warranty.id, claim.id, {
                description: 'Dichtung erneuert',
                cost: 85
            });
            const resolvedClaim = warranty.claims.find(c => c.id === claim.id);
            expect(resolvedClaim.resolution).toBe('Dichtung erneuert');
            expect(resolvedClaim.cost).toBe(85);
        });

        it('should reset warranty status to active when no open claims remain', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const { claim } = service.addClaim(warranty.id, {
                issue: 'Defekt',
                description: 'Test'
            });
            expect(warranty.status).toBe('claimed');
            service.resolveClaim(warranty.id, claim.id, {
                description: 'Behoben'
            });
            expect(warranty.status).toBe('active');
        });

        it('should keep status claimed when other open claims exist', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            // Manually set back to active so we can add a second claim
            const { claim: claim1 } = service.addClaim(warranty.id, {
                issue: 'Problem 1',
                description: 'Erste Störung'
            });
            // Status is now 'claimed', we need to set it back to active to add second claim
            warranty.status = 'active';
            const { claim: claim2 } = service.addClaim(warranty.id, {
                issue: 'Problem 2',
                description: 'Zweite Störung'
            });
            // Resolve only the first claim
            service.resolveClaim(warranty.id, claim1.id, {
                description: 'Erste Störung behoben'
            });
            // Second claim is still open, so warranty should remain claimed
            expect(warranty.status).toBe('claimed');
        });

        it('should return success false for nonexistent warranty', () => {
            const result = service.resolveClaim('war-nonexistent', 'claim-1', {
                description: 'Test'
            });
            expect(result.success).toBe(false);
        });

        it('should return success false for nonexistent claim', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const result = service.resolveClaim(warranty.id, 'claim-nonexistent', {
                description: 'Test'
            });
            expect(result.success).toBe(false);
        });

        it('should set resolvedAt timestamp', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const { claim } = service.addClaim(warranty.id, {
                issue: 'Defekt',
                description: 'Test'
            });
            service.resolveClaim(warranty.id, claim.id, {
                description: 'Behoben'
            });
            const resolvedClaim = warranty.claims.find(c => c.id === claim.id);
            expect(resolvedClaim.resolvedAt).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // Expiring Warranties
    // -----------------------------------------------------------------------
    describe('getExpiringWarranties', () => {
        it('should return warranties expiring within given days', () => {
            const endSoon = new Date();
            endSoon.setDate(endSoon.getDate() + 15);
            const endDateStr = endSoon.toISOString().split('T')[0];

            // Manually push a warranty with near-future end date
            service.warranties.push({
                id: 'war-exp-1',
                status: 'active',
                endDate: endDateStr,
                productName: 'Boiler',
                customerName: 'Test',
                claims: []
            });

            const expiring = service.getExpiringWarranties(30);
            expect(expiring).toHaveLength(1);
            expect(expiring[0].id).toBe('war-exp-1');
        });

        it('should not return warranties expiring beyond the window', () => {
            service.warranties.push({
                id: 'war-far',
                status: 'active',
                endDate: '2099-12-31',
                productName: 'Test',
                customerName: 'Test',
                claims: []
            });

            const expiring = service.getExpiringWarranties(30);
            expect(expiring).toHaveLength(0);
        });

        it('should not return expired warranties (endDate in the past)', () => {
            service.warranties.push({
                id: 'war-past',
                status: 'active',
                endDate: '2020-01-01',
                productName: 'Test',
                customerName: 'Test',
                claims: []
            });

            const expiring = service.getExpiringWarranties(30);
            expect(expiring).toHaveLength(0);
        });

        it('should not return voided warranties', () => {
            const endSoon = new Date();
            endSoon.setDate(endSoon.getDate() + 10);

            service.warranties.push({
                id: 'war-void',
                status: 'voided',
                endDate: endSoon.toISOString().split('T')[0],
                productName: 'Test',
                customerName: 'Test',
                claims: []
            });

            const expiring = service.getExpiringWarranties(30);
            expect(expiring).toHaveLength(0);
        });

        it('should sort by endDate ascending', () => {
            const d1 = new Date();
            d1.setDate(d1.getDate() + 20);
            const d2 = new Date();
            d2.setDate(d2.getDate() + 5);

            service.warranties.push(
                { id: 'war-a', status: 'active', endDate: d1.toISOString().split('T')[0], productName: 'A', customerName: 'A', claims: [] },
                { id: 'war-b', status: 'active', endDate: d2.toISOString().split('T')[0], productName: 'B', customerName: 'B', claims: [] }
            );

            const expiring = service.getExpiringWarranties(30);
            expect(expiring[0].id).toBe('war-b');
            expect(expiring[1].id).toBe('war-a');
        });
    });

    // -----------------------------------------------------------------------
    // Expired Warranties
    // -----------------------------------------------------------------------
    describe('getExpiredWarranties', () => {
        it('should return active warranties with past endDate', () => {
            service.warranties.push({
                id: 'war-old',
                status: 'active',
                endDate: '2020-01-01',
                productName: 'Alter Boiler',
                customerName: 'Test',
                claims: []
            });

            const expired = service.getExpiredWarranties();
            expect(expired).toHaveLength(1);
        });

        it('should not return already-expired-status warranties', () => {
            service.warranties.push({
                id: 'war-already',
                status: 'expired',
                endDate: '2020-01-01',
                productName: 'Test',
                customerName: 'Test',
                claims: []
            });

            const expired = service.getExpiredWarranties();
            expect(expired).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // Update Expired Warranties
    // -----------------------------------------------------------------------
    describe('updateExpiredWarranties', () => {
        it('should mark active warranties with past endDate as expired', () => {
            service.warranties.push({
                id: 'war-to-expire',
                status: 'active',
                endDate: '2020-06-01',
                productName: 'Alte Anlage',
                customerName: 'Test',
                claims: []
            });

            const count = service.updateExpiredWarranties();
            expect(count).toBe(1);
            expect(service.warranties[0].status).toBe('expired');
            expect(service.warranties[0].expiredAt).toBeDefined();
        });

        it('should not modify warranties with future endDate', () => {
            service.warranties.push({
                id: 'war-future',
                status: 'active',
                endDate: '2099-12-31',
                productName: 'Test',
                customerName: 'Test',
                claims: []
            });

            const count = service.updateExpiredWarranties();
            expect(count).toBe(0);
            expect(service.warranties[0].status).toBe('active');
        });

        it('should save only when warranties were updated', () => {
            service.warranties.push({
                id: 'war-active',
                status: 'active',
                endDate: '2099-12-31',
                productName: 'Test',
                customerName: 'Test',
                claims: []
            });

            localStorage.setItem.mockClear();
            service.updateExpiredWarranties();
            expect(localStorage.setItem).not.toHaveBeenCalled();
        });

        it('should save when warranties were updated', () => {
            service.warranties.push({
                id: 'war-old2',
                status: 'active',
                endDate: '2020-01-01',
                productName: 'Test',
                customerName: 'Test',
                claims: []
            });

            localStorage.setItem.mockClear();
            service.updateExpiredWarranties();
            expect(localStorage.setItem).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Retrieval Methods
    // -----------------------------------------------------------------------
    describe('getWarranty', () => {
        it('should return warranty by id', () => {
            const created = service.addWarranty(defaultWarrantyData);
            const found = service.getWarranty(created.id);
            expect(found).toBeDefined();
            expect(found.id).toBe(created.id);
        });

        it('should return undefined for unknown id', () => {
            const found = service.getWarranty('war-nonexistent');
            expect(found).toBeUndefined();
        });
    });

    describe('getWarrantiesByCustomer', () => {
        it('should return warranties for a specific customer', () => {
            service.addWarranty(defaultWarrantyData);
            service.addWarranty({ ...defaultWarrantyData, customerId: 'cust-002', customerName: 'Maria Schmidt' });
            service.addWarranty({ ...defaultWarrantyData, customerId: 'cust-001' });

            const results = service.getWarrantiesByCustomer('cust-001');
            expect(results).toHaveLength(2);
        });

        it('should return empty array for unknown customer', () => {
            service.addWarranty(defaultWarrantyData);
            const results = service.getWarrantiesByCustomer('cust-999');
            expect(results).toHaveLength(0);
        });
    });

    describe('getWarrantiesByJob', () => {
        it('should find warranty by jobId', () => {
            service.addWarranty(defaultWarrantyData);
            const results = service.getWarrantiesByJob('job-001');
            expect(results).toHaveLength(1);
        });

        it('should find warranty by invoiceId', () => {
            service.addWarranty(defaultWarrantyData);
            const results = service.getWarrantiesByJob('inv-001');
            expect(results).toHaveLength(1);
        });

        it('should return empty array for unknown jobId', () => {
            service.addWarranty(defaultWarrantyData);
            const results = service.getWarrantiesByJob('job-999');
            expect(results).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // Search
    // -----------------------------------------------------------------------
    describe('searchWarranties', () => {
        it('should find warranty by product name', () => {
            service.addWarranty(defaultWarrantyData);
            const results = service.searchWarranties('viessmann');
            expect(results).toHaveLength(1);
        });

        it('should find warranty by customer name', () => {
            service.addWarranty(defaultWarrantyData);
            const results = service.searchWarranties('müller');
            expect(results).toHaveLength(1);
        });

        it('should find warranty by serial number', () => {
            service.addWarranty(defaultWarrantyData);
            const results = service.searchWarranties('VT-2026');
            expect(results).toHaveLength(1);
        });

        it('should be case-insensitive', () => {
            service.addWarranty(defaultWarrantyData);
            const results = service.searchWarranties('HEIZUNGSANLAGE');
            expect(results).toHaveLength(1);
        });

        it('should return empty for non-matching query', () => {
            service.addWarranty(defaultWarrantyData);
            const results = service.searchWarranties('Klimaanlage');
            expect(results).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // Filtered Retrieval
    // -----------------------------------------------------------------------
    describe('getWarranties', () => {
        it('should return all warranties without filters', () => {
            service.addWarranty(defaultWarrantyData);
            service.addWarranty({ ...defaultWarrantyData, customerName: 'Karl Bauer' });
            const result = service.getWarranties();
            expect(result).toHaveLength(2);
        });

        it('should filter by status', () => {
            const w1 = service.addWarranty(defaultWarrantyData);
            service.addWarranty({ ...defaultWarrantyData, customerName: 'Zweiter' });
            service.voidWarranty(w1.id, 'Storniert');

            const active = service.getWarranties({ status: 'active' });
            expect(active).toHaveLength(1);
            expect(active[0].customerName).toBe('Zweiter');
        });

        it('should filter by customerId', () => {
            service.addWarranty(defaultWarrantyData);
            service.addWarranty({ ...defaultWarrantyData, customerId: 'cust-002' });
            const result = service.getWarranties({ customerId: 'cust-002' });
            expect(result).toHaveLength(1);
        });

        it('should filter by productType', () => {
            service.addWarranty(defaultWarrantyData); // installation
            service.addWarranty({ ...defaultWarrantyData, productType: 'product' });
            const result = service.getWarranties({ productType: 'product' });
            expect(result).toHaveLength(1);
        });

        it('should sort by createdAt descending', () => {
            const w1 = service.addWarranty({ ...defaultWarrantyData, productName: 'Erste' });
            // Ensure w2 has a later createdAt timestamp
            w1.createdAt = '2026-01-01T00:00:00.000Z';
            const w2 = service.addWarranty({ ...defaultWarrantyData, productName: 'Zweite' });
            w2.createdAt = '2026-06-01T00:00:00.000Z';
            const result = service.getWarranties();
            // w2 was created after w1, so it should come first
            expect(result[0].productName).toBe('Zweite');
            expect(result[1].productName).toBe('Erste');
        });
    });

    // -----------------------------------------------------------------------
    // Statistics
    // -----------------------------------------------------------------------
    describe('getStatistics', () => {
        it('should return zero stats for empty service', () => {
            const stats = service.getStatistics();
            expect(stats.total).toBe(0);
            expect(stats.active).toBe(0);
            expect(stats.expired).toBe(0);
            expect(stats.claimed).toBe(0);
            expect(stats.totalClaims).toBe(0);
            expect(stats.claimCosts).toBe(0);
        });

        it('should count active warranties', () => {
            service.addWarranty(defaultWarrantyData);
            service.addWarranty({ ...defaultWarrantyData, customerName: 'Zweiter' });
            const stats = service.getStatistics();
            expect(stats.total).toBe(2);
            expect(stats.active).toBe(2);
        });

        it('should count claimed warranties', () => {
            const w = service.addWarranty(defaultWarrantyData);
            service.addClaim(w.id, { issue: 'Defekt', description: 'Test' });
            const stats = service.getStatistics();
            expect(stats.claimed).toBe(1);
        });

        it('should count total claims across warranties', () => {
            const w = service.addWarranty(defaultWarrantyData);
            service.addClaim(w.id, { issue: 'Problem 1', description: 'Test 1' });
            // Set back to active to add another claim
            w.status = 'active';
            service.addClaim(w.id, { issue: 'Problem 2', description: 'Test 2' });
            const stats = service.getStatistics();
            expect(stats.totalClaims).toBe(2);
        });

        it('should sum covered claim costs', () => {
            const w = service.addWarranty(defaultWarrantyData);
            const { claim } = service.addClaim(w.id, {
                issue: 'Defekt',
                description: 'Test',
                cost: 200,
                coveredByWarranty: true
            });
            const stats = service.getStatistics();
            expect(stats.claimCosts).toBe(200);
        });

        it('should not count uncovered claims in claimCosts', () => {
            const w = service.addWarranty(defaultWarrantyData);
            service.addClaim(w.id, {
                issue: 'Eigenverschulden',
                description: 'Test',
                cost: 500,
                coveredByWarranty: false
            });
            const stats = service.getStatistics();
            expect(stats.claimCosts).toBe(0);
        });

        it('should count voided warranties separately (not in active/expired)', () => {
            const w = service.addWarranty(defaultWarrantyData);
            service.voidWarranty(w.id, 'Storno');
            const stats = service.getStatistics();
            expect(stats.total).toBe(1);
            expect(stats.active).toBe(0);
            expect(stats.expired).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // Void Warranty
    // -----------------------------------------------------------------------
    describe('voidWarranty', () => {
        it('should set status to voided', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            const result = service.voidWarranty(warranty.id, 'Kunde hat storniert');
            expect(result.success).toBe(true);
            expect(warranty.status).toBe('voided');
        });

        it('should store void reason', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            service.voidWarranty(warranty.id, 'Produkt zurückgegeben');
            expect(warranty.voidReason).toBe('Produkt zurückgegeben');
        });

        it('should set voidedAt timestamp', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            service.voidWarranty(warranty.id, 'Test');
            expect(warranty.voidedAt).toBeDefined();
        });

        it('should return success false for nonexistent warranty', () => {
            const result = service.voidWarranty('war-nonexistent', 'Test');
            expect(result.success).toBe(false);
        });

        it('should persist changes', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            localStorage.setItem.mockClear();
            service.voidWarranty(warranty.id, 'Test');
            expect(localStorage.setItem).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Extend Warranty
    // -----------------------------------------------------------------------
    describe('extendWarranty', () => {
        it('should extend warranty duration', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            expect(warranty.durationMonths).toBe(24);
            const result = service.extendWarranty(warranty.id, 12);
            expect(result.success).toBe(true);
            expect(warranty.durationMonths).toBe(36);
        });

        it('should recalculate endDate after extension', () => {
            const warranty = service.addWarranty({
                ...defaultWarrantyData,
                startDate: '2026-01-01',
                durationMonths: 12
            });
            expect(warranty.endDate).toBe('2027-01-01');
            service.extendWarranty(warranty.id, 12);
            expect(warranty.endDate).toBe('2028-01-01');
        });

        it('should return the new endDate', () => {
            const warranty = service.addWarranty({
                ...defaultWarrantyData,
                startDate: '2026-01-01',
                durationMonths: 12
            });
            const result = service.extendWarranty(warranty.id, 6);
            expect(result.newEndDate).toBe('2027-07-01');
        });

        it('should set extended flag to true', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            service.extendWarranty(warranty.id, 6);
            expect(warranty.extended).toBe(true);
        });

        it('should set extendedAt timestamp', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            service.extendWarranty(warranty.id, 6);
            expect(warranty.extendedAt).toBeDefined();
        });

        it('should return success false for nonexistent warranty', () => {
            const result = service.extendWarranty('war-nonexistent', 12);
            expect(result.success).toBe(false);
        });

        it('should persist changes', () => {
            const warranty = service.addWarranty(defaultWarrantyData);
            localStorage.setItem.mockClear();
            service.extendWarranty(warranty.id, 6);
            expect(localStorage.setItem).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Schedule Expiry Reminder
    // -----------------------------------------------------------------------
    describe('scheduleExpiryReminder', () => {
        it('should create a task when warranty is within reminder window', () => {
            window.taskService = { addTask: vi.fn() };
            // Create a warranty that ends soon (within the 30-day reminder window)
            const endSoon = new Date();
            endSoon.setDate(endSoon.getDate() + 10);

            service.addWarranty({
                ...defaultWarrantyData,
                startDate: '2024-01-01',
                durationMonths: 0,
                // We override endDate indirectly -- the reminder date will be in the past
            });

            // Directly test with a warranty that has a near-future end date
            const testWarranty = {
                productName: 'Testheizung',
                customerName: 'Test Kunde',
                endDate: endSoon.toISOString().split('T')[0]
            };
            service.scheduleExpiryReminder(testWarranty);

            expect(window.taskService.addTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    source: 'warranty',
                    priority: 'normal'
                })
            );
        });

        it('should not create a task when endDate is far in the future', () => {
            window.taskService = { addTask: vi.fn() };

            const testWarranty = {
                productName: 'Testheizung',
                customerName: 'Test Kunde',
                endDate: '2099-12-31'
            };
            service.scheduleExpiryReminder(testWarranty);

            expect(window.taskService.addTask).not.toHaveBeenCalled();
        });

        it('should not throw when taskService is not available', () => {
            window.taskService = null;
            const testWarranty = {
                productName: 'Test',
                customerName: 'Test',
                endDate: new Date().toISOString().split('T')[0]
            };
            expect(() => service.scheduleExpiryReminder(testWarranty)).not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // Persistence
    // -----------------------------------------------------------------------
    describe('save', () => {
        it('should save warranties to localStorage as JSON', () => {
            service.addWarranty(defaultWarrantyData);
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_warranties',
                expect.any(String)
            );

            const savedData = JSON.parse(localStorage.setItem.mock.calls[0][1]);
            expect(savedData).toHaveLength(1);
            expect(savedData[0].productName).toBe('Heizungsanlage Viessmann Vitodens 300');
        });
    });
});
