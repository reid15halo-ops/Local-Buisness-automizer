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

// Self-contained MaterialService (extracted from js/services/material-service.js)
class MaterialService {
    constructor() {
        this.bestand = JSON.parse(localStorage.getItem('material_bestand') || '[]');
        this.stundensatz = parseFloat(localStorage.getItem('stundensatz') || '65');
        this.reservierungen = JSON.parse(localStorage.getItem('material_reservations') || '[]');
        this.lagerbewegungen = JSON.parse(localStorage.getItem('stock_movements') || '[]');
    }

    addMaterial(material) {
        material.id = `MAT-${Date.now()}`;
        material.importedAt = new Date().toISOString();
        this.bestand.push(material);
        this.save();
        return material;
    }

    updateMaterial(id, updates) {
        const index = this.bestand.findIndex(m => m.id === id);
        if (index !== -1) {
            this.bestand[index] = { ...this.bestand[index], ...updates };
            this.save();
            return this.bestand[index];
        }
        return null;
    }

    deleteMaterial(id) {
        this.bestand = this.bestand.filter(m => m.id !== id);
        this.save();
    }

    getMaterial(id) {
        const material = this.bestand.find(m => m.id === id);
        return material ? this._ensureReservationFields(material) : null;
    }

    getMaterialByArtikelnummer(artikelnummer) {
        const material = this.bestand.find(m => m.artikelnummer === artikelnummer);
        return material ? this._ensureReservationFields(material) : null;
    }

    getAllMaterials() {
        return this.bestand.map(m => this._ensureReservationFields(m));
    }

    _ensureReservationFields(material) {
        if (!material.reserviert) {
            material.reserviert = 0;
        }
        return material;
    }

    getAvailableStock(materialId) {
        const material = this.getMaterial(materialId);
        if (!material) { return 0; }
        this._ensureReservationFields(material);
        return material.bestand - material.reserviert;
    }

    getKategorien() {
        return [...new Set(this.bestand.map(m => m.kategorie))];
    }

    searchMaterials(query) {
        const q = query.toLowerCase();
        return this.bestand.filter(m =>
            m.bezeichnung.toLowerCase().includes(q) ||
            m.artikelnummer.toLowerCase().includes(q) ||
            m.kategorie.toLowerCase().includes(q)
        );
    }

    calculatePositionPrice(materialId, menge, arbeitsstunden = 0) {
        const material = this.getMaterial(materialId);
        if (!material) { return null; }

        const materialkosten = menge * (material.vkPreis || material.preis);
        const arbeitskosten = arbeitsstunden * this.stundensatz;

        return {
            material: material,
            menge: menge,
            einzelpreis: material.vkPreis || material.preis,
            materialkosten: materialkosten,
            arbeitsstunden: arbeitsstunden,
            arbeitskosten: arbeitskosten,
            gesamt: materialkosten + arbeitskosten
        };
    }

    calculateAngebotPositionen(positionen) {
        const berechnet = [];
        let gesamtMaterial = 0;
        let gesamtArbeit = 0;

        positionen.forEach(pos => {
            if (pos.materialId) {
                const calc = this.calculatePositionPrice(
                    pos.materialId,
                    pos.menge || 1,
                    pos.arbeitsstunden || 0
                );
                if (calc) {
                    berechnet.push({ ...pos, ...calc });
                    gesamtMaterial += calc.materialkosten;
                    gesamtArbeit += calc.arbeitskosten;
                }
            } else {
                berechnet.push(pos);
            }
        });

        return {
            positionen: berechnet,
            materialkosten: gesamtMaterial,
            arbeitskosten: gesamtArbeit,
            netto: gesamtMaterial + gesamtArbeit,
            mwst: (gesamtMaterial + gesamtArbeit) * 0.19,
            brutto: (gesamtMaterial + gesamtArbeit) * 1.19
        };
    }

    updateStock(materialId, change) {
        const material = this.getMaterial(materialId);
        if (material) {
            material.bestand = Math.max(0, material.bestand + change);
            this.save();
        }
    }

    getLowStockItems() {
        return this.bestand.filter(m => {
            const verfuegbar = this.getAvailableStock(m.id);
            return verfuegbar <= m.minBestand && m.minBestand > 0;
        });
    }

    reserveForAuftrag(auftragId, items) {
        const shortages = [];

        items.forEach(item => {
            const material = this.getMaterial(item.materialId);
            if (!material) {
                shortages.push({
                    materialId: item.materialId,
                    needed: item.menge,
                    available: 0,
                    materialName: 'Unbekannt'
                });
                return;
            }

            const available = this.getAvailableStock(item.materialId);
            if (available < item.menge) {
                shortages.push({
                    materialId: item.materialId,
                    needed: item.menge,
                    available: available,
                    materialName: material.bezeichnung
                });
            }
        });

        if (shortages.length > 0) {
            return { success: false, shortages };
        }

        items.forEach(item => {
            const material = this.getMaterial(item.materialId);
            if (material) {
                this._ensureReservationFields(material);
                material.reserviert += item.menge;

                const reservation = {
                    id: `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    auftragId,
                    materialId: item.materialId,
                    menge: item.menge,
                    datum: new Date().toISOString()
                };
                this.reservierungen.push(reservation);

                this._recordStockMovement({
                    materialId: item.materialId,
                    auftragId,
                    type: 'reserved',
                    quantity: item.menge,
                    previousStock: material.bestand,
                    newStock: material.bestand
                });
            }
        });

        this.save();
        return { success: true, shortages: [] };
    }

    releaseReservation(auftragId) {
        const reservations = this.reservierungen.filter(r => r.auftragId === auftragId);

        reservations.forEach(res => {
            const material = this.getMaterial(res.materialId);
            if (material) {
                this._ensureReservationFields(material);
                material.reserviert = Math.max(0, material.reserviert - res.menge);

                this._recordStockMovement({
                    materialId: res.materialId,
                    auftragId,
                    type: 'released',
                    quantity: -res.menge,
                    previousStock: material.bestand,
                    newStock: material.bestand
                });
            }
        });

        this.reservierungen = this.reservierungen.filter(r => r.auftragId !== auftragId);
        this.save();
    }

    consumeReserved(auftragId) {
        const reservations = this.reservierungen.filter(r => r.auftragId === auftragId);
        const consumed = [];

        reservations.forEach(res => {
            const material = this.getMaterial(res.materialId);
            if (material) {
                this._ensureReservationFields(material);
                material.bestand = Math.max(0, material.bestand - res.menge);
                material.reserviert = Math.max(0, material.reserviert - res.menge);

                this._recordStockMovement({
                    materialId: res.materialId,
                    auftragId,
                    type: 'consumed',
                    quantity: -res.menge,
                    previousStock: material.bestand + res.menge,
                    newStock: material.bestand
                });

                consumed.push({
                    materialId: res.materialId,
                    menge: res.menge,
                    bezeichnung: material.bezeichnung
                });
            }
        });

        this.reservierungen = this.reservierungen.filter(r => r.auftragId !== auftragId);
        this.save();
        return consumed;
    }

    checkAvailability(items) {
        const details = items.map(item => {
            const material = this.getMaterial(item.materialId);
            const available = this.getAvailableStock(item.materialId);
            const shortage = Math.max(0, item.menge - available);

            return {
                materialId: item.materialId,
                materialName: material ? material.bezeichnung : 'Unbekannt',
                needed: item.menge,
                available: available,
                shortage: shortage
            };
        });

        const allAvailable = details.every(item => item.shortage === 0);
        return { allAvailable, items: details };
    }

    getReservations(auftragId) {
        return this.reservierungen.filter(r => r.auftragId === auftragId);
    }

    _recordStockMovement(movement) {
        const record = {
            id: `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            materialId: movement.materialId,
            auftragId: movement.auftragId,
            type: movement.type,
            quantity: movement.quantity,
            previousStock: movement.previousStock,
            newStock: movement.newStock,
            timestamp: new Date().toISOString()
        };
        this.lagerbewegungen.push(record);
        return record;
    }

    getStockMovements(materialId = null) {
        if (materialId) {
            return this.lagerbewegungen.filter(m => m.materialId === materialId);
        }
        return this.lagerbewegungen;
    }

    getMovementsSummary(materialId) {
        const movements = this.getStockMovements(materialId);

        const summary = {
            materialId: materialId,
            material: this.getMaterial(materialId),
            movementCount: movements.length,
            totalIncoming: 0,
            totalOutgoing: 0,
            netChange: 0,
            byType: {}
        };

        movements.forEach(m => {
            const type = m.type;
            if (!summary.byType[type]) {
                summary.byType[type] = { count: 0, quantity: 0 };
            }
            summary.byType[type].count++;
            summary.byType[type].quantity += m.quantity;

            if (m.quantity > 0) {
                summary.totalIncoming += m.quantity;
            } else {
                summary.totalOutgoing += Math.abs(m.quantity);
            }
        });

        summary.netChange = summary.totalIncoming - summary.totalOutgoing;
        return summary;
    }

    setStundensatz(satz) {
        this.stundensatz = satz;
        localStorage.setItem('stundensatz', satz.toString());
    }

    getStundensatz() {
        return this.stundensatz;
    }

    save() {
        localStorage.setItem('material_bestand', JSON.stringify(this.bestand));
        localStorage.setItem('material_reservations', JSON.stringify(this.reservierungen));
        localStorage.setItem('stock_movements', JSON.stringify(this.lagerbewegungen));
    }

    clear() {
        this.bestand = [];
        this.save();
    }
}

describe('MaterialService', () => {
    let service;

    beforeEach(() => {
        localStorage.clear();
        service = new MaterialService();
    });

    describe('Material CRUD', () => {
        it('should add a material and assign an id', () => {
            const mat = service.addMaterial({
                bezeichnung: 'IPE 100 Stahlträger',
                artikelnummer: 'ST-IPE-100',
                kategorie: 'Stahlträger',
                einheit: 'm',
                preis: 12.50,
                vkPreis: 18.00,
                bestand: 100,
                minBestand: 20,
                lieferant: 'Stahl AG'
            });

            expect(mat.id).toBeDefined();
            expect(mat.id).toMatch(/^MAT-/);
            expect(mat.bezeichnung).toBe('IPE 100 Stahlträger');
        });

        it('should retrieve a material by id', () => {
            const added = service.addMaterial({
                bezeichnung: 'Testmaterial',
                artikelnummer: 'TEST-001',
                preis: 5.00,
                bestand: 50,
                minBestand: 10
            });

            const found = service.getMaterial(added.id);
            expect(found).not.toBeNull();
            expect(found.bezeichnung).toBe('Testmaterial');
        });

        it('should return null for non-existent material id', () => {
            const found = service.getMaterial('NONEXISTENT');
            expect(found).toBeNull();
        });

        it('should update a material', () => {
            const mat = service.addMaterial({
                bezeichnung: 'Altname',
                artikelnummer: 'ART-001',
                preis: 10.00,
                bestand: 50,
                minBestand: 5
            });

            const updated = service.updateMaterial(mat.id, { bezeichnung: 'Neuname', preis: 15.00 });
            expect(updated.bezeichnung).toBe('Neuname');
            expect(updated.preis).toBe(15.00);
        });

        it('should delete a material', () => {
            const mat = service.addMaterial({
                bezeichnung: 'Zu löschen',
                artikelnummer: 'DEL-001',
                preis: 5.00,
                bestand: 10,
                minBestand: 2
            });

            service.deleteMaterial(mat.id);
            expect(service.getMaterial(mat.id)).toBeNull();
        });

        it('should return all materials', () => {
            service.addMaterial({ bezeichnung: 'A', artikelnummer: 'A-001', preis: 1, bestand: 10, minBestand: 2 });
            service.addMaterial({ bezeichnung: 'B', artikelnummer: 'B-001', preis: 2, bestand: 20, minBestand: 3 });

            const all = service.getAllMaterials();
            expect(all.length).toBe(2);
        });

        it('should find material by Artikelnummer', () => {
            service.addMaterial({ bezeichnung: 'Test', artikelnummer: 'UNIQUE-999', preis: 1, bestand: 5, minBestand: 1 });
            const found = service.getMaterialByArtikelnummer('UNIQUE-999');
            expect(found).not.toBeNull();
            expect(found.artikelnummer).toBe('UNIQUE-999');
        });
    });

    describe('Stock Level Calculations', () => {
        it('should get available stock (bestand - reserviert)', () => {
            const mat = service.addMaterial({
                bezeichnung: 'Stock Test',
                artikelnummer: 'ST-001',
                preis: 10,
                bestand: 100,
                minBestand: 10,
                reserviert: 0
            });

            expect(service.getAvailableStock(mat.id)).toBe(100);
        });

        it('should update stock by positive change (incoming)', () => {
            const mat = service.addMaterial({
                bezeichnung: 'Stock',
                artikelnummer: 'S-001',
                preis: 5,
                bestand: 50,
                minBestand: 10
            });

            service.updateStock(mat.id, 25);
            const updated = service.getMaterial(mat.id);
            expect(updated.bestand).toBe(75);
        });

        it('should update stock by negative change (consumption)', () => {
            const mat = service.addMaterial({
                bezeichnung: 'Stock',
                artikelnummer: 'S-002',
                preis: 5,
                bestand: 50,
                minBestand: 10
            });

            service.updateStock(mat.id, -10);
            const updated = service.getMaterial(mat.id);
            expect(updated.bestand).toBe(40);
        });

        it('should not allow stock to go below zero', () => {
            const mat = service.addMaterial({
                bezeichnung: 'Stock',
                artikelnummer: 'S-003',
                preis: 5,
                bestand: 5,
                minBestand: 2
            });

            service.updateStock(mat.id, -100);
            const updated = service.getMaterial(mat.id);
            expect(updated.bestand).toBe(0);
        });

        it('should return 0 available stock for non-existent material', () => {
            expect(service.getAvailableStock('NONEXISTENT')).toBe(0);
        });
    });

    describe('Reorder Threshold Detection (Low Stock)', () => {
        it('should detect low stock items at or below minBestand', () => {
            service.addMaterial({
                bezeichnung: 'Low Stock',
                artikelnummer: 'LS-001',
                preis: 5,
                bestand: 5,
                minBestand: 10,
                lieferant: 'Supplier A'
            });

            const lowStock = service.getLowStockItems();
            expect(lowStock.length).toBe(1);
            expect(lowStock[0].bezeichnung).toBe('Low Stock');
        });

        it('should not flag items above minBestand as low stock', () => {
            service.addMaterial({
                bezeichnung: 'Plenty',
                artikelnummer: 'PL-001',
                preis: 5,
                bestand: 100,
                minBestand: 10
            });

            const lowStock = service.getLowStockItems();
            expect(lowStock.length).toBe(0);
        });

        it('should not flag items with minBestand = 0', () => {
            service.addMaterial({
                bezeichnung: 'No Min',
                artikelnummer: 'NM-001',
                preis: 5,
                bestand: 0,
                minBestand: 0
            });

            const lowStock = service.getLowStockItems();
            expect(lowStock.length).toBe(0);
        });

        it('should detect multiple low stock items', async () => {
            // Use async + delays to ensure unique IDs (Date.now() based)
            service.addMaterial({ bezeichnung: 'Low A', artikelnummer: 'LOW-A', preis: 1, bestand: 2, minBestand: 10 });
            await new Promise(r => setTimeout(r, 2));
            service.addMaterial({ bezeichnung: 'OK B', artikelnummer: 'OK-B', preis: 1, bestand: 50, minBestand: 10 });
            await new Promise(r => setTimeout(r, 2));
            service.addMaterial({ bezeichnung: 'Low C', artikelnummer: 'LOW-C', preis: 1, bestand: 3, minBestand: 15 });

            const lowStock = service.getLowStockItems();
            // 'Low A': bestand 2 <= minBestand 10 → low
            // 'OK B': bestand 50 > minBestand 10 → not low
            // 'Low C': bestand 3 <= minBestand 15 → low
            const lowNames = lowStock.map(m => m.bezeichnung);
            expect(lowNames).toContain('Low A');
            expect(lowNames).toContain('Low C');
            expect(lowNames).not.toContain('OK B');
            expect(lowStock.filter(m => m.bezeichnung === 'OK B').length).toBe(0);
        });
    });

    describe('BOM / Position Price Calculations', () => {
        it('should calculate material position price correctly', () => {
            const mat = service.addMaterial({
                bezeichnung: 'Stahl',
                artikelnummer: 'ST-001',
                preis: 10.00,
                vkPreis: 15.00,
                bestand: 100,
                minBestand: 10
            });

            const result = service.calculatePositionPrice(mat.id, 5, 0);
            expect(result).not.toBeNull();
            expect(result.materialkosten).toBeCloseTo(75, 2); // 5 * 15
            expect(result.gesamt).toBeCloseTo(75, 2);
        });

        it('should include labor cost in position price calculation', () => {
            const mat = service.addMaterial({
                bezeichnung: 'Stahl',
                artikelnummer: 'ST-002',
                preis: 10.00,
                vkPreis: 15.00,
                bestand: 100,
                minBestand: 10
            });
            service.setStundensatz(65);

            const result = service.calculatePositionPrice(mat.id, 2, 3); // 3 Stunden
            expect(result.arbeitskosten).toBeCloseTo(195, 2); // 3 * 65
            expect(result.gesamt).toBeCloseTo(225, 2); // 30 + 195
        });

        it('should return null for non-existent material in position price', () => {
            const result = service.calculatePositionPrice('NONEXISTENT', 5, 0);
            expect(result).toBeNull();
        });

        it('should calculate Angebot totals for multiple positions', async () => {
            service.setStundensatz(65); // Set stundensatz BEFORE calculations
            const mat1 = service.addMaterial({
                bezeichnung: 'Material A',
                artikelnummer: 'MA-001',
                preis: 10.00,
                vkPreis: 15.00,
                bestand: 100,
                minBestand: 5
            });
            await new Promise(r => setTimeout(r, 2)); // Ensure unique Date.now() id
            const mat2 = service.addMaterial({
                bezeichnung: 'Material B',
                artikelnummer: 'MB-001',
                preis: 20.00,
                vkPreis: 30.00,
                bestand: 100,
                minBestand: 5
            });

            const positionen = [
                { materialId: mat1.id, menge: 2, arbeitsstunden: 1 },
                { materialId: mat2.id, menge: 1, arbeitsstunden: 0 }
            ];

            const result = service.calculateAngebotPositionen(positionen);

            // mat1: 2 * 15 = 30, mat2: 1 * 30 = 30 => material = 60
            // labor: 1 * 65 = 65
            // netto = 125
            expect(result.materialkosten).toBeCloseTo(60, 2);
            expect(result.arbeitskosten).toBeCloseTo(65, 2);
            expect(result.netto).toBeCloseTo(125, 2);
            expect(result.mwst).toBeCloseTo(125 * 0.19, 2);
            expect(result.brutto).toBeCloseTo(125 * 1.19, 2);
        });

        it('should use preis when vkPreis is not set', () => {
            const mat = service.addMaterial({
                bezeichnung: 'No VK',
                artikelnummer: 'NV-001',
                preis: 20.00,
                bestand: 50,
                minBestand: 5
            });

            const result = service.calculatePositionPrice(mat.id, 3, 0);
            expect(result.einzelpreis).toBe(20.00);
            expect(result.materialkosten).toBeCloseTo(60, 2);
        });
    });

    describe('Stock Reservation System', () => {
        let mat;

        beforeEach(() => {
            mat = service.addMaterial({
                bezeichnung: 'Reservierbar',
                artikelnummer: 'RES-001',
                preis: 10,
                bestand: 100,
                minBestand: 10,
                lieferant: 'Lieferant A'
            });
        });

        it('should reserve materials for an Auftrag successfully', () => {
            const result = service.reserveForAuftrag('AUF-001', [{ materialId: mat.id, menge: 20 }]);
            expect(result.success).toBe(true);

            const available = service.getAvailableStock(mat.id);
            expect(available).toBe(80); // 100 - 20 reserved
        });

        it('should fail reservation when insufficient stock', () => {
            const result = service.reserveForAuftrag('AUF-002', [{ materialId: mat.id, menge: 200 }]);
            expect(result.success).toBe(false);
            expect(result.shortages.length).toBeGreaterThan(0);
            expect(result.shortages[0].needed).toBe(200);
        });

        it('should release reservation when order is cancelled', () => {
            service.reserveForAuftrag('AUF-003', [{ materialId: mat.id, menge: 30 }]);
            expect(service.getAvailableStock(mat.id)).toBe(70);

            service.releaseReservation('AUF-003');
            expect(service.getAvailableStock(mat.id)).toBe(100);
        });

        it('should consume reserved materials when order completes', () => {
            service.reserveForAuftrag('AUF-004', [{ materialId: mat.id, menge: 25 }]);
            expect(service.getMaterial(mat.id).bestand).toBe(100); // Physical stock unchanged

            service.consumeReserved('AUF-004');
            const updated = service.getMaterial(mat.id);
            expect(updated.bestand).toBe(75); // Physical stock reduced
            expect(updated.reserviert).toBe(0); // Reservation cleared
        });

        it('should check availability for multiple items', async () => {
            await new Promise(r => setTimeout(r, 2)); // Ensure unique id from mat
            const mat2 = service.addMaterial({
                bezeichnung: 'Material 2',
                artikelnummer: 'M2-001',
                preis: 5,
                bestand: 50,
                minBestand: 5
            });

            const result = service.checkAvailability([
                { materialId: mat.id, menge: 10 },
                { materialId: mat2.id, menge: 60 } // More than available (50)
            ]);

            expect(result.allAvailable).toBe(false);
            const m2Detail = result.items.find(i => i.materialId === mat2.id);
            expect(m2Detail.shortage).toBe(10); // 60 needed - 50 available = 10
        });

        it('should retrieve reservations for a specific Auftrag', () => {
            service.reserveForAuftrag('AUF-005', [{ materialId: mat.id, menge: 15 }]);
            const reservations = service.getReservations('AUF-005');
            expect(reservations.length).toBe(1);
            expect(reservations[0].menge).toBe(15);
        });
    });

    describe('Stock Movement Audit Trail', () => {
        it('should record stock movement on reservation', () => {
            const mat = service.addMaterial({
                bezeichnung: 'Tracked',
                artikelnummer: 'TR-001',
                preis: 10,
                bestand: 50,
                minBestand: 5
            });

            service.reserveForAuftrag('AUF-TRACK', [{ materialId: mat.id, menge: 10 }]);
            const movements = service.getStockMovements(mat.id);
            expect(movements.length).toBeGreaterThan(0);
            expect(movements[0].type).toBe('reserved');
        });

        it('should get movement summary with totals', () => {
            const mat = service.addMaterial({
                bezeichnung: 'Summary Test',
                artikelnummer: 'SUM-001',
                preis: 10,
                bestand: 100,
                minBestand: 5
            });

            service.reserveForAuftrag('AUF-SUM1', [{ materialId: mat.id, menge: 20 }]);
            service.consumeReserved('AUF-SUM1');

            const summary = service.getMovementsSummary(mat.id);
            expect(summary.movementCount).toBeGreaterThan(0);
            expect(summary.totalOutgoing).toBeGreaterThan(0);
        });

        it('should get all movements when no materialId provided', () => {
            const mat = service.addMaterial({
                bezeichnung: 'AllMov',
                artikelnummer: 'AM-001',
                preis: 5,
                bestand: 50,
                minBestand: 5
            });

            service.reserveForAuftrag('AUF-ALL', [{ materialId: mat.id, menge: 5 }]);
            const all = service.getStockMovements();
            expect(all.length).toBeGreaterThan(0);
        });
    });

    describe('Search and Filter', () => {
        beforeEach(() => {
            service.addMaterial({ bezeichnung: 'IPE 100 Stahlträger', artikelnummer: 'ST-IPE-100', kategorie: 'Stahlträger', preis: 12, bestand: 100, minBestand: 20 });
            service.addMaterial({ bezeichnung: 'Rechteckrohr 50x50', artikelnummer: 'RR-50x50', kategorie: 'Rohre', preis: 8, bestand: 200, minBestand: 30 });
            service.addMaterial({ bezeichnung: 'Schraube M12', artikelnummer: 'SCHR-M12', kategorie: 'Verbindungsmittel', preis: 0.35, bestand: 500, minBestand: 100 });
        });

        it('should search materials by bezeichnung', () => {
            const results = service.searchMaterials('stahl');
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(m => m.bezeichnung.includes('Stahl'))).toBe(true);
        });

        it('should search materials by artikelnummer', () => {
            const results = service.searchMaterials('RR-50');
            expect(results.length).toBe(1);
            expect(results[0].artikelnummer).toBe('RR-50x50');
        });

        it('should search materials by kategorie', () => {
            const results = service.searchMaterials('rohre');
            expect(results.length).toBe(1);
        });

        it('should return empty array for no matches', () => {
            const results = service.searchMaterials('XYZXYZ');
            expect(results.length).toBe(0);
        });

        it('should return unique kategorien', () => {
            const kategorien = service.getKategorien();
            expect(kategorien).toContain('Stahlträger');
            expect(kategorien).toContain('Rohre');
            // Should be unique
            expect(new Set(kategorien).size).toBe(kategorien.length);
        });
    });

    describe('Settings', () => {
        it('should get and set Stundensatz', () => {
            service.setStundensatz(80);
            expect(service.getStundensatz()).toBe(80);
        });

        it('should persist Stundensatz to localStorage', () => {
            service.setStundensatz(75);
            expect(localStorage.getItem('stundensatz')).toBe('75');
        });
    });
});
