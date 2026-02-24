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

// Self-contained PurchaseOrderService (extracted from js/services/purchase-order-service.js)
class PurchaseOrderService {
    constructor() {
        this.bestellungen = JSON.parse(localStorage.getItem('purchase_orders') || '[]');
        this.lieferanten = JSON.parse(localStorage.getItem('suppliers') || '[]');
        this.poCounter = parseInt(localStorage.getItem('po_counter') || '0');
    }

    _addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
    }

    _calculatePOTotals(po) {
        const netto = po.positionen.reduce((sum, pos) => sum + ((pos.menge || 0) * (pos.ekPreis || 0)), 0);
        po.netto = netto;
        po.mwst = netto * 0.19;
        po.brutto = netto * 1.19;
        po.positionen.forEach(pos => { pos.gesamtpreis = (pos.menge || 0) * (pos.ekPreis || 0); });
    }

    _ensureSupplierExists(supplier) {
        if (!this.lieferanten.find(s => s.name === supplier.name)) { this.addSupplier(supplier); }
    }

    generatePONummer() {
        this.poCounter++;
        const year = new Date().getFullYear();
        const num = this.poCounter.toString().padStart(3, '0');
        localStorage.setItem('po_counter', this.poCounter.toString());
        return `${year}-${num}`;
    }

    createPO(lieferant, positionen, options = {}) {
        const nummer = this.generatePONummer();
        const po = {
            id: `PO-${nummer}`,
            nummer: `PO-${nummer}`,
            status: 'entwurf',
            lieferant: {
                name: lieferant.name || '',
                email: lieferant.email || '',
                telefon: lieferant.telefon || '',
                ansprechpartner: lieferant.ansprechpartner || ''
            },
            positionen: positionen.map(pos => ({
                materialId: pos.materialId || '',
                bezeichnung: pos.bezeichnung || '',
                artikelnummer: pos.artikelnummer || '',
                menge: pos.menge || 0,
                einheit: pos.einheit || 'Stk.',
                ekPreis: pos.ekPreis || 0,
                gelieferteMenge: 0,
                gesamtpreis: (pos.menge || 0) * (pos.ekPreis || 0)
            })),
            netto: 0, mwst: 0, brutto: 0,
            bestelldatum: new Date().toISOString().split('T')[0],
            lieferdatum_erwartet: options.lieferdatum_erwartet || this._addDays(new Date(), 7),
            lieferdatum_tatsaechlich: null,
            notizen: options.notizen || '',
            erstelltAm: new Date().toISOString(),
            auftragId: options.auftragId || null
        };

        this._calculatePOTotals(po);
        this.bestellungen.push(po);
        this._ensureSupplierExists(lieferant);
        this.save();
        return po;
    }

    updatePO(poId, updates) {
        const po = this.bestellungen.find(p => p.id === poId);
        if (!po) { return null; }
        Object.assign(po, updates);
        if (updates.positionen) { this._calculatePOTotals(po); }
        this.save();
        return po;
    }

    deletePO(poId) {
        const index = this.bestellungen.findIndex(p => p.id === poId);
        if (index === -1) { return false; }
        if (this.bestellungen[index].status !== 'entwurf') { return false; }
        this.bestellungen.splice(index, 1);
        this.save();
        return true;
    }

    getPO(poId) { return this.bestellungen.find(p => p.id === poId) || null; }

    getAllPOs() {
        return [...this.bestellungen].sort((a, b) => new Date(b.erstelltAm) - new Date(a.erstelltAm));
    }

    getPOsByStatus(status) { return this.bestellungen.filter(p => p.status === status); }

    getPOsByLieferant(supplierName) { return this.bestellungen.filter(p => p.lieferant.name === supplierName); }

    submitPO(poId) {
        const po = this.getPO(poId);
        if (!po || po.status !== 'entwurf') { return null; }
        po.status = 'bestellt';
        po.bestelldatum = new Date().toISOString().split('T')[0];
        this.save();
        return po;
    }

    recordDelivery(poId, items) {
        const po = this.getPO(poId);
        if (!po || po.status === 'entwurf' || po.status === 'storniert') { return null; }

        items.forEach(item => {
            const pos = po.positionen.find(p => p.materialId === item.materialId);
            if (pos) { pos.gelieferteMenge = (pos.gelieferteMenge || 0) + item.receivedQty; }
        });

        const allFull = po.positionen.every(pos => pos.gelieferteMenge >= pos.menge);
        if (allFull) {
            po.status = 'geliefert';
            po.lieferdatum_tatsaechlich = new Date().toISOString().split('T')[0];
        } else {
            if (po.positionen.some(pos => pos.gelieferteMenge > 0)) { po.status = 'teillieferung'; }
        }

        this.save();
        return po;
    }

    cancelPO(poId) {
        const po = this.getPO(poId);
        if (!po || po.status === 'geliefert' || po.status === 'storniert') { return null; }
        po.status = 'storniert';
        this.save();
        return po;
    }

    addSupplier(supplierData) {
        const existing = this.lieferanten.find(s => s.name === supplierData.name);
        if (existing) { return existing; }
        const supplier = { name: supplierData.name || '', email: supplierData.email || '', telefon: supplierData.telefon || '', ansprechpartner: supplierData.ansprechpartner || '', lieferzeit_tage: supplierData.lieferzeit_tage || 5 };
        this.lieferanten.push(supplier);
        this.save();
        return supplier;
    }

    getAllSuppliers() { return this.lieferanten; }
    getSupplier(name) { return this.lieferanten.find(s => s.name === name) || null; }

    updateSupplier(name, updates) {
        const supplier = this.getSupplier(name);
        if (!supplier) { return null; }
        Object.assign(supplier, updates);
        this.save();
        return supplier;
    }

    deleteSupplier(name) {
        const index = this.lieferanten.findIndex(s => s.name === name);
        if (index === -1) { return false; }
        const activePOs = this.getPOsByLieferant(name).filter(po => ['bestellt', 'teillieferung'].includes(po.status));
        if (activePOs.length > 0) { return false; }
        this.lieferanten.splice(index, 1);
        this.save();
        return true;
    }

    getOpenPOValue() {
        return this.bestellungen
            .filter(po => ['bestellt', 'teillieferung'].includes(po.status))
            .reduce((sum, po) => sum + po.brutto, 0);
    }

    save() {
        localStorage.setItem('purchase_orders', JSON.stringify(this.bestellungen));
        localStorage.setItem('suppliers', JSON.stringify(this.lieferanten));
    }
}

const TEST_SUPPLIER = { name: 'Test Lieferant GmbH', email: 'bestellung@test.de', telefon: '+49 123 456789', lieferzeit_tage: 5 };
const TEST_POSITIONS = [{ materialId: 'MAT-001', bezeichnung: 'IPE 100 Stahlträger', artikelnummer: 'ST-IPE-100', menge: 10, einheit: 'm', ekPreis: 12.50 }];

describe('PurchaseOrderService', () => {
    let service;

    beforeEach(() => {
        localStorage.clear();
        service = new PurchaseOrderService();
    });

    describe('PO Creation', () => {
        it('should create a PO in entwurf status', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            expect(po.status).toBe('entwurf');
            expect(po.id).toMatch(/^PO-/);
        });

        it('should assign supplier data to PO', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            expect(po.lieferant.name).toBe('Test Lieferant GmbH');
            expect(po.lieferant.email).toBe('bestellung@test.de');
        });

        it('should calculate line item totals correctly', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            expect(po.positionen[0].gesamtpreis).toBeCloseTo(125, 2);
        });

        it('should calculate PO netto, mwst, brutto with 19% MwSt', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            expect(po.netto).toBeCloseTo(125, 2);
            expect(po.mwst).toBeCloseTo(23.75, 2);
            expect(po.brutto).toBeCloseTo(148.75, 2);
        });

        it('should set expected delivery date in the future', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            const today = new Date().toISOString().split('T')[0];
            expect(po.lieferdatum_erwartet > today).toBe(true);
        });

        it('should accept custom delivery date', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS, { lieferdatum_erwartet: '2026-03-15' });
            expect(po.lieferdatum_erwartet).toBe('2026-03-15');
        });

        it('should attach optional notes', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS, { notizen: 'Eilbestellung' });
            expect(po.notizen).toBe('Eilbestellung');
        });

        it('should link PO to an Auftrag', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS, { auftragId: 'AUF-001' });
            expect(po.auftragId).toBe('AUF-001');
        });

        it('should auto-register supplier if not known', () => {
            service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            expect(service.getSupplier('Test Lieferant GmbH')).not.toBeNull();
        });
    });

    describe('PO Status Transitions', () => {
        it('should transition from entwurf to bestellt', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            const submitted = service.submitPO(po.id);
            expect(submitted.status).toBe('bestellt');
        });

        it('should not submit a non-entwurf PO', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            service.submitPO(po.id);
            expect(service.submitPO(po.id)).toBeNull();
        });

        it('should transition to teillieferung on partial delivery', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            service.submitPO(po.id);
            const updated = service.recordDelivery(po.id, [{ materialId: 'MAT-001', receivedQty: 5 }]);
            expect(updated.status).toBe('teillieferung');
        });

        it('should transition to geliefert on full delivery', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            service.submitPO(po.id);
            const updated = service.recordDelivery(po.id, [{ materialId: 'MAT-001', receivedQty: 10 }]);
            expect(updated.status).toBe('geliefert');
            expect(updated.lieferdatum_tatsaechlich).toBeDefined();
        });

        it('should cancel a PO in entwurf status', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            expect(service.cancelPO(po.id).status).toBe('storniert');
        });

        it('should cancel a PO in bestellt status', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            service.submitPO(po.id);
            expect(service.cancelPO(po.id).status).toBe('storniert');
        });

        it('should not cancel a delivered PO', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            service.submitPO(po.id);
            service.recordDelivery(po.id, [{ materialId: 'MAT-001', receivedQty: 10 }]);
            expect(service.cancelPO(po.id)).toBeNull();
        });

        it('should not record delivery for draft PO', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            expect(service.recordDelivery(po.id, [{ materialId: 'MAT-001', receivedQty: 10 }])).toBeNull();
        });
    });

    describe('Supplier Assignment', () => {
        it('should add a new supplier', () => {
            const supplier = service.addSupplier({ name: 'Rohrstahl GmbH', lieferzeit_tage: 7 });
            expect(supplier.name).toBe('Rohrstahl GmbH');
            expect(supplier.lieferzeit_tage).toBe(7);
        });

        it('should not duplicate an existing supplier', () => {
            service.addSupplier({ name: 'Einmalig GmbH' });
            service.addSupplier({ name: 'Einmalig GmbH' });
            const suppliers = service.getAllSuppliers().filter(s => s.name === 'Einmalig GmbH');
            expect(suppliers.length).toBe(1);
        });

        it('should update supplier data', () => {
            service.addSupplier({ name: 'Update GmbH', email: 'alt@test.de' });
            const updated = service.updateSupplier('Update GmbH', { email: 'neu@test.de' });
            expect(updated.email).toBe('neu@test.de');
        });

        it('should delete a supplier with no active POs', () => {
            service.addSupplier({ name: 'Delete Me' });
            expect(service.deleteSupplier('Delete Me')).toBe(true);
            expect(service.getSupplier('Delete Me')).toBeNull();
        });

        it('should not delete a supplier with active POs', () => {
            const po = service.createPO({ name: 'Active Supplier' }, TEST_POSITIONS);
            service.submitPO(po.id);
            expect(service.deleteSupplier('Active Supplier')).toBe(false);
        });

        it('should get POs for a specific supplier', () => {
            service.createPO({ name: 'Supplier A' }, TEST_POSITIONS);
            service.createPO({ name: 'Supplier B' }, TEST_POSITIONS);
            const posA = service.getPOsByLieferant('Supplier A');
            expect(posA.length).toBe(1);
        });
    });

    describe('Line Item Totals', () => {
        it('should calculate correct totals for multi-line PO', () => {
            const multiPositionen = [
                { materialId: 'MAT-001', bezeichnung: 'Stahl', artikelnummer: 'ST-001', menge: 10, einheit: 'm', ekPreis: 12.50 },
                { materialId: 'MAT-002', bezeichnung: 'Rohr', artikelnummer: 'RO-001', menge: 5, einheit: 'm', ekPreis: 8.00 }
            ];
            const po = service.createPO(TEST_SUPPLIER, multiPositionen);
            expect(po.netto).toBeCloseTo(165, 2);
            expect(po.brutto).toBeCloseTo(165 * 1.19, 2);
        });

        it('should recalculate totals when PO positions are updated', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            expect(po.netto).toBeCloseTo(125, 2);
            const updated = service.updatePO(po.id, { positionen: [
                { materialId: 'MAT-001', bezeichnung: 'Stahl', artikelnummer: 'ST-001', menge: 20, einheit: 'm', ekPreis: 12.50 }
            ]});
            expect(updated.netto).toBeCloseTo(250, 2);
        });

        it('should handle empty positions array', () => {
            const po = service.createPO(TEST_SUPPLIER, []);
            expect(po.netto).toBe(0);
            expect(po.brutto).toBe(0);
        });
    });

    describe('Delivery Date Validation', () => {
        it('should set actual delivery date on full delivery', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            service.submitPO(po.id);
            service.recordDelivery(po.id, [{ materialId: 'MAT-001', receivedQty: 10 }]);
            const updated = service.getPO(po.id);
            expect(updated.lieferdatum_tatsaechlich).not.toBeNull();
            expect(updated.lieferdatum_tatsaechlich).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should not set actual delivery date for partial delivery', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            service.submitPO(po.id);
            service.recordDelivery(po.id, [{ materialId: 'MAT-001', receivedQty: 3 }]);
            expect(service.getPO(po.id).lieferdatum_tatsaechlich).toBeNull();
        });
    });

    describe('Reporting', () => {
        it('should calculate total value of open POs', () => {
            const po1 = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            const po2 = service.createPO({ name: 'Supplier 2' }, [
                { materialId: 'MAT-002', bezeichnung: 'Rohr', artikelnummer: 'RO-001', menge: 5, einheit: 'm', ekPreis: 20.00 }
            ]);
            service.submitPO(po1.id);
            service.submitPO(po2.id);
            const total = service.getOpenPOValue();
            expect(total).toBeCloseTo(148.75 + 119, 1);
        });

        it('should get all POs sorted by date (newest first)', () => {
            service.createPO({ name: 'Old Supplier' }, TEST_POSITIONS);
            service.createPO({ name: 'New Supplier' }, TEST_POSITIONS);
            const all = service.getAllPOs();
            expect(all.length).toBe(2);
            expect(new Date(all[0].erstelltAm) >= new Date(all[1].erstelltAm)).toBe(true);
        });

        it('should filter POs by status', () => {
            const po1 = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            const po2 = service.createPO({ name: 'S2' }, TEST_POSITIONS);
            service.submitPO(po2.id);
            expect(service.getPOsByStatus('entwurf').length).toBe(1);
            expect(service.getPOsByStatus('bestellt').length).toBe(1);
        });
    });

    describe('CRUD Operations', () => {
        it('should get a PO by id', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            expect(service.getPO(po.id)).not.toBeNull();
        });

        it('should return null for non-existent PO', () => {
            expect(service.getPO('NONEXISTENT')).toBeNull();
        });

        it('should delete a draft PO', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            expect(service.deletePO(po.id)).toBe(true);
            expect(service.getPO(po.id)).toBeNull();
        });

        it('should not delete a non-draft PO', () => {
            const po = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            service.submitPO(po.id);
            expect(service.deletePO(po.id)).toBe(false);
        });

        it('should persist POs to localStorage', () => {
            service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            const stored = JSON.parse(localStorage.getItem('purchase_orders'));
            expect(stored.length).toBe(1);
        });

        it('should generate sequential PO numbers', () => {
            const po1 = service.createPO(TEST_SUPPLIER, TEST_POSITIONS);
            const po2 = service.createPO({ name: 'S2' }, TEST_POSITIONS);
            expect(po1.id).not.toBe(po2.id);
        });
    });
});
