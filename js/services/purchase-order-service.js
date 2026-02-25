/* ============================================
   Purchase Order (Bestellung) Service
   Supplier Management & PO Workflow
   ============================================ */

class PurchaseOrderService {
    constructor() {
        this.bestellungen = JSON.parse(localStorage.getItem('purchase_orders') || '[]');
        this.lieferanten = JSON.parse(localStorage.getItem('suppliers') || '[]');
        this.poCounter = parseInt(localStorage.getItem('po_counter') || '0');
    }

    // ============================================
    // CRUD Operations
    // ============================================

    /**
     * Create a new Purchase Order
     * @param {Object} lieferant - Supplier object
     * @param {Array} positionen - [{materialId, bezeichnung, artikelnummer, menge, einheit, ekPreis}, ...]
     * @param {Object} options - {notizen, auftragId, lieferdatum_erwartet}
     * @returns {Object} Created PO
     */
    createPO(lieferant, positionen, options = {}) {
        const po = {
            id: `PO-${this.generatePONummer()}`,
            nummer: `PO-${this.generatePONummer()}`,
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
            netto: 0,
            mwst: 0,
            brutto: 0,
            bestelldatum: new Date().toISOString().split('T')[0],
            lieferdatum_erwartet: options.lieferdatum_erwartet || this._addDays(new Date(), 7),
            lieferdatum_tatsaechlich: null,
            notizen: options.notizen || '',
            erstelltAm: new Date().toISOString(),
            auftragId: options.auftragId || null
        };

        // Calculate totals
        this._calculatePOTotals(po);

        this.bestellungen.push(po);
        this._ensureSupplierExists(lieferant);
        this.save();

        return po;
    }

    /**
     * Update an existing PO
     * @param {string} poId - PO ID
     * @param {Object} updates - Fields to update
     * @returns {Object|null} Updated PO or null
     */
    updatePO(poId, updates) {
        const po = this.bestellungen.find(p => p.id === poId);
        if (!po) {return null;}

        Object.assign(po, updates);
        if (updates.positionen) {
            this._calculatePOTotals(po);
        }

        this.save();
        return po;
    }

    /**
     * Delete a draft PO
     * @param {string} poId - PO ID
     * @returns {boolean} Success
     */
    deletePO(poId) {
        const index = this.bestellungen.findIndex(p => p.id === poId);
        if (index === -1) {return false;}

        const po = this.bestellungen[index];
        // Only allow deletion of draft POs
        if (po.status !== 'entwurf') {
            console.warn('Cannot delete PO with status:', po.status);
            return false;
        }

        this.bestellungen.splice(index, 1);
        this.save();
        return true;
    }

    /**
     * Get PO by ID
     * @param {string} poId - PO ID
     * @returns {Object|null} PO or null
     */
    getPO(poId) {
        return this.bestellungen.find(p => p.id === poId) || null;
    }

    /**
     * Get all POs
     * @returns {Array} All POs sorted by date (newest first)
     */
    getAllPOs() {
        return [...this.bestellungen].sort((a, b) =>
            new Date(b.erstelltAm) - new Date(a.erstelltAm)
        );
    }

    /**
     * Get POs by status
     * @param {string} status - Status filter
     * @returns {Array} Filtered POs
     */
    getPOsByStatus(status) {
        return this.bestellungen.filter(p => p.status === status);
    }

    /**
     * Get POs by supplier
     * @param {string} supplierName - Supplier name
     * @returns {Array} Filtered POs
     */
    getPOsByLieferant(supplierName) {
        return this.bestellungen.filter(p => p.lieferant.name === supplierName);
    }

    // ============================================
    // Workflow
    // ============================================

    /**
     * Submit PO: entwurf → bestellt
     * @param {string} poId - PO ID
     * @returns {Object|null} Updated PO
     */
    submitPO(poId) {
        const po = this.getPO(poId);
        if (!po) {return null;}

        if (po.status !== 'entwurf') {
            console.warn('PO is not in draft status');
            return null;
        }

        po.status = 'bestellt';
        po.bestelldatum = new Date().toISOString().split('T')[0];
        this.save();

        return po;
    }

    /**
     * Record incoming goods (Wareneingang)
     * @param {string} poId - PO ID
     * @param {Array} items - [{materialId, receivedQty}, ...]
     * @returns {Object|null} Updated PO
     */
    recordDelivery(poId, items) {
        const po = this.getPO(poId);
        if (!po) {return null;}

        if (po.status === 'entwurf' || po.status === 'storniert') {
            console.warn('Cannot record delivery for PO in status:', po.status);
            return null;
        }

        // Update positions
        items.forEach(item => {
            const pos = po.positionen.find(p => p.materialId === item.materialId);
            if (pos) {
                pos.gelieferteMenge = (pos.gelieferteMenge || 0) + item.receivedQty;
            }
        });

        // Update material stock via materialService
        if (window.materialService) {
            items.forEach(item => {
                window.materialService.updateStock(item.materialId, item.receivedQty);
            });
        }

        // Determine new status
        const allFullyDelivered = po.positionen.every(pos =>
            pos.gelieferteMenge >= pos.menge
        );

        if (allFullyDelivered) {
            po.status = 'geliefert';
            po.lieferdatum_tatsaechlich = new Date().toISOString().split('T')[0];
        } else {
            const anyDelivered = po.positionen.some(pos => pos.gelieferteMenge > 0);
            if (anyDelivered) {
                po.status = 'teillieferung';
            }
        }

        this.save();
        return po;
    }

    /**
     * Cancel a PO
     * @param {string} poId - PO ID
     * @returns {Object|null} Updated PO
     */
    cancelPO(poId) {
        const po = this.getPO(poId);
        if (!po) {return null;}

        if (po.status === 'geliefert' || po.status === 'storniert') {
            console.warn('Cannot cancel PO in status:', po.status);
            return null;
        }

        po.status = 'storniert';
        this.save();

        return po;
    }

    // ============================================
    // Auto-generation
    // ============================================

    /**
     * Generate PO(s) from material shortages
     * @param {Array} shortageItems - [{materialId, shortage, material}, ...]
     * @returns {Array} Created POs
     */
    generatePOFromShortage(shortageItems) {
        if (!window.materialService) {
            console.error('MaterialService not available');
            return [];
        }

        const createdPOs = [];

        // Group by supplier
        const bySupplier = {};
        shortageItems.forEach(item => {
            const material = window.materialService.getMaterial(item.materialId);
            if (!material) {return;}

            const supplier = material.lieferant || 'Unknown';
            if (!bySupplier[supplier]) {
                bySupplier[supplier] = [];
            }

            // Order quantity = shortage + safety buffer
            const safetyBuffer = material.minBestand || 10;
            const orderQty = item.shortage + safetyBuffer;

            bySupplier[supplier].push({
                materialId: item.materialId,
                bezeichnung: material.bezeichnung,
                artikelnummer: material.artikelnummer,
                menge: orderQty,
                einheit: material.einheit,
                ekPreis: material.preis
            });
        });

        // Create one PO per supplier
        Object.entries(bySupplier).forEach(([supplierName, items]) => {
            // Get or create supplier object
            let supplier = this.lieferanten.find(s => s.name === supplierName);
            if (!supplier) {
                supplier = {
                    name: supplierName,
                    email: '',
                    telefon: '',
                    ansprechpartner: '',
                    lieferzeit_tage: 5
                };
            }

            const po = this.createPO(supplier, items, {
                notizen: 'Auto-generated from shortage'
            });

            createdPOs.push(po);
        });

        return createdPOs;
    }

    /**
     * Generate POs for items with low stock
     * @returns {Array} Created POs
     */
    generatePOFromLowStock() {
        if (!window.materialService) {
            console.error('MaterialService not available');
            return [];
        }

        const lowStockItems = window.materialService.getLowStockItems();
        if (lowStockItems.length === 0) {return [];}

        const shortageItems = lowStockItems.map(material => ({
            materialId: material.id,
            shortage: Math.max(0, material.minBestand - material.bestand),
            material: material
        }));

        return this.generatePOFromShortage(shortageItems);
    }

    // ============================================
    // Reporting
    // ============================================

    /**
     * Get total value of open POs
     * @returns {number} Total € of outstanding orders
     */
    getOpenPOValue() {
        return this.bestellungen
            .filter(po => ['bestellt', 'teillieferung'].includes(po.status))
            .reduce((sum, po) => sum + po.brutto, 0);
    }

    /**
     * Get POs expected to arrive within X days
     * @param {number} days - Number of days
     * @returns {Array} Expected POs
     */
    getExpectedDeliveries(days = 7) {
        const now = new Date();
        const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        return this.bestellungen.filter(po => {
            if (!['bestellt', 'teillieferung'].includes(po.status)) {return false;}

            const expectedDate = new Date(po.lieferdatum_erwartet);
            return expectedDate >= now && expectedDate <= cutoff;
        });
    }

    /**
     * Get PO history within date range
     * @param {Object} dateRange - {startDate, endDate} in YYYY-MM-DD format
     * @returns {Array} Historical POs
     */
    getPOHistory(dateRange = {}) {
        const { startDate, endDate } = dateRange;

        return this.bestellungen.filter(po => {
            const poDate = po.bestelldatum;
            if (startDate && poDate < startDate) {return false;}
            if (endDate && poDate > endDate) {return false;}
            return ['geliefert', 'storniert'].includes(po.status);
        });
    }

    // ============================================
    // Supplier Management
    // ============================================

    /**
     * Get or create supplier
     * @param {Object} supplierData - Supplier object
     * @returns {Object} Supplier
     */
    addSupplier(supplierData) {
        const existing = this.lieferanten.find(s => s.name === supplierData.name);
        if (existing) {return existing;}

        const supplier = {
            name: supplierData.name || '',
            email: supplierData.email || '',
            telefon: supplierData.telefon || '',
            ansprechpartner: supplierData.ansprechpartner || '',
            lieferzeit_tage: supplierData.lieferzeit_tage || 5,
            materialIds: supplierData.materialIds || []
        };

        this.lieferanten.push(supplier);
        this.save();

        return supplier;
    }

    /**
     * Get all suppliers
     * @returns {Array} All suppliers
     */
    getAllSuppliers() {
        return this.lieferanten;
    }

    /**
     * Get supplier by name
     * @param {string} name - Supplier name
     * @returns {Object|null} Supplier or null
     */
    getSupplier(name) {
        return this.lieferanten.find(s => s.name === name) || null;
    }

    /**
     * Update supplier
     * @param {string} name - Supplier name
     * @param {Object} updates - Fields to update
     * @returns {Object|null} Updated supplier
     */
    updateSupplier(name, updates) {
        const supplier = this.getSupplier(name);
        if (!supplier) {return null;}

        Object.assign(supplier, updates);
        this.save();

        return supplier;
    }

    /**
     * Delete supplier
     * @param {string} name - Supplier name
     * @returns {boolean} Success
     */
    deleteSupplier(name) {
        const index = this.lieferanten.findIndex(s => s.name === name);
        if (index === -1) {return false;}

        // Don't delete if there are active POs
        const activePOs = this.getPOsByLieferant(name).filter(po =>
            ['bestellt', 'teillieferung'].includes(po.status)
        );

        if (activePOs.length > 0) {
            console.warn('Cannot delete supplier with active purchase orders');
            return false;
        }

        this.lieferanten.splice(index, 1);
        this.save();

        return true;
    }

    // ============================================
    // Numbering
    // ============================================

    /**
     * Generate sequential PO number
     * @returns {string} PO number like "2026-001"
     */
    generatePONummer() {
        this.poCounter++;
        const year = new Date().getFullYear();
        const num = this.poCounter.toString().padStart(3, '0');
        localStorage.setItem('po_counter', this.poCounter.toString());
        return `${year}-${num}`;
    }

    // ============================================
    // Persistence
    // ============================================

    save() {
        localStorage.setItem('purchase_orders', JSON.stringify(this.bestellungen));
        localStorage.setItem('suppliers', JSON.stringify(this.lieferanten));
    }

    load() {
        this.bestellungen = JSON.parse(localStorage.getItem('purchase_orders') || '[]');
        this.lieferanten = JSON.parse(localStorage.getItem('suppliers') || '[]');
        this.poCounter = parseInt(localStorage.getItem('po_counter') || '0');
    }

    clear() {
        this.bestellungen = [];
        this.lieferanten = [];
        this.poCounter = 0;
        this.save();
    }

    // ============================================
    // Private Helpers
    // ============================================

    /**
     * Calculate PO totals (netto, mwst, brutto)
     * @private
     */
    _calculatePOTotals(po) {
        const netto = po.positionen.reduce((sum, pos) =>
            sum + ((pos.menge || 0) * (pos.ekPreis || 0)), 0
        );

        po.netto = netto;
        po.mwst = netto * _getTaxRate();
        po.brutto = netto * (1 + _getTaxRate());

        // Update position totals
        po.positionen.forEach(pos => {
            pos.gesamtpreis = (pos.menge || 0) * (pos.ekPreis || 0);
        });
    }

    /**
     * Ensure supplier exists in registry
     * @private
     */
    _ensureSupplierExists(supplier) {
        const existing = this.lieferanten.find(s => s.name === supplier.name);
        if (!existing) {
            this.addSupplier(supplier);
        }
    }

    /**
     * Add days to date
     * @private
     */
    _addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
    }

    /**
     * Load demo POs and suppliers
     */
    loadDemoData() {
        // Demo suppliers
        this.lieferanten = [
            {
                name: 'Stahl Schmidt GmbH',
                email: 'bestellung@stahlschmidt.de',
                telefon: '+49 6029 12345',
                ansprechpartner: 'Herr Müller',
                lieferzeit_tage: 5,
                materialIds: ['MAT-DEMO-001', 'MAT-DEMO-002']
            },
            {
                name: 'Rohrstahl GmbH',
                email: 'order@rohrstahl.de',
                telefon: '+49 6029 54321',
                ansprechpartner: 'Frau Schmidt',
                lieferzeit_tage: 7,
                materialIds: ['MAT-DEMO-003', 'MAT-DEMO-004']
            },
            {
                name: 'Blech Express',
                email: 'info@blech-express.de',
                telefon: '+49 6029 99999',
                ansprechpartner: 'Herr Wagner',
                lieferzeit_tage: 3,
                materialIds: ['MAT-DEMO-005']
            }
        ];

        // Demo POs
        this.bestellungen = [
            {
                id: 'PO-2026-001',
                nummer: 'PO-2026-001',
                status: 'geliefert',
                lieferant: {
                    name: 'Stahl Schmidt GmbH',
                    email: 'bestellung@stahlschmidt.de',
                    telefon: '+49 6029 12345',
                    ansprechpartner: 'Herr Müller'
                },
                positionen: [
                    {
                        materialId: 'MAT-DEMO-001',
                        bezeichnung: 'IPE 100 Stahlträger',
                        artikelnummer: 'ST-IPE-100',
                        menge: 50,
                        einheit: 'm',
                        ekPreis: 12.50,
                        gelieferteMenge: 50,
                        gesamtpreis: 625.00
                    }
                ],
                netto: 625.00,
                mwst: 118.75,
                brutto: 743.75,
                bestelldatum: '2026-02-10',
                lieferdatum_erwartet: '2026-02-17',
                lieferdatum_tatsaechlich: '2026-02-16',
                notizen: 'Demo-Bestellung',
                erstelltAm: '2026-02-10T10:00:00Z',
                auftragId: null
            },
            {
                id: 'PO-2026-002',
                nummer: 'PO-2026-002',
                status: 'bestellt',
                lieferant: {
                    name: 'Rohrstahl GmbH',
                    email: 'order@rohrstahl.de',
                    telefon: '+49 6029 54321',
                    ansprechpartner: 'Frau Schmidt'
                },
                positionen: [
                    {
                        materialId: 'MAT-DEMO-003',
                        bezeichnung: 'Rechteckrohr 50x50x3',
                        artikelnummer: 'RR-50x50',
                        menge: 100,
                        einheit: 'm',
                        ekPreis: 8.50,
                        gelieferteMenge: 0,
                        gesamtpreis: 850.00
                    }
                ],
                netto: 850.00,
                mwst: 161.50,
                brutto: 1011.50,
                bestelldatum: '2026-02-15',
                lieferdatum_erwartet: '2026-02-22',
                lieferdatum_tatsaechlich: null,
                notizen: 'Demo-Bestellung',
                erstelltAm: '2026-02-15T14:30:00Z',
                auftragId: null
            }
        ];

        this.poCounter = 2;
        this.save();
    }
}

// Create global instance
window.purchaseOrderService = new PurchaseOrderService();
