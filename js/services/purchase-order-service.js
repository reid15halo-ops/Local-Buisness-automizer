/* ============================================
   Purchase Order (Bestellung) Service
   Supplier Management & PO Workflow
   Supabase-first — no localStorage
   ============================================ */

class PurchaseOrderService {
    constructor() {
        this.bestellungen = [];
        this.lieferanten = [];
        this.poCounter = 0;
        this._ready = false;
    }

    async init() {
        await this._loadFromSupabase();
        try {
            const { data } = await this._supabase()?.auth?.getUser() || {};
            this._userId = data?.user?.id || '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc';
        } catch {
            this._userId = '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc';
        }
        this._ready = true;
    }

    _supabase() {
        return window.supabaseClient?.client;
    }

    _isOnline() {
        return !!(this._supabase() && window.supabaseClient?.isConfigured());
    }

    // ============================================
    // Supabase helpers
    // ============================================

    _toSupabaseRow(po) {
        return {
            id: po.id,
            user_id: this._userId || '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc',
            tenant_id: 'a0000000-0000-0000-0000-000000000001',
            nummer: po.nummer,
            status: po.status,
            lieferant_name: po.lieferant?.name || '',
            lieferant_email: po.lieferant?.email || '',
            lieferant_telefon: po.lieferant?.telefon || '',
            lieferant_ansprechpartner: po.lieferant?.ansprechpartner || '',
            positionen: po.positionen || [],
            netto: po.netto || 0,
            mwst: po.mwst || 0,
            brutto: po.brutto || 0,
            bestelldatum: po.bestelldatum || null,
            lieferdatum_erwartet: po.lieferdatum_erwartet || null,
            lieferdatum_tatsaechlich: po.lieferdatum_tatsaechlich || null,
            auftrag_id: po.auftragId || null,
            notizen: po.notizen || '',
            eingangsrechnung_nr: po.eingangsrechnungNr || '',
            confidence: po.confidence || null
        };
    }

    _fromSupabaseRow(remote) {
        return {
            id: remote.id,
            nummer: remote.nummer || remote.id,
            status: remote.status || 'geliefert',
            lieferant: {
                name: remote.lieferant_name || '',
                email: remote.lieferant_email || '',
                telefon: remote.lieferant_telefon || '',
                ansprechpartner: remote.lieferant_ansprechpartner || ''
            },
            positionen: remote.positionen || [],
            netto: parseFloat(remote.netto) || 0,
            mwst: parseFloat(remote.mwst) || 0,
            brutto: parseFloat(remote.brutto) || 0,
            bestelldatum: remote.bestelldatum || remote.created_at?.split('T')[0] || '',
            lieferdatum_erwartet: remote.lieferdatum_erwartet || '',
            lieferdatum_tatsaechlich: remote.lieferdatum_tatsaechlich || '',
            auftragId: remote.auftrag_id || null,
            notizen: remote.notizen || '',
            eingangsrechnungNr: remote.eingangsrechnung_nr || '',
            confidence: remote.confidence != null ? parseFloat(remote.confidence) : null,
            erstelltAm: remote.created_at || new Date().toISOString()
        };
    }

    async _loadFromSupabase() {
        if (!this._isOnline()) return;
        try {
            const { data, error } = await this._supabase()
                .from('purchase_orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[PO] Supabase load error:', error.message);
                return;
            }

            this.bestellungen = (data || []).map(r => this._fromSupabaseRow(r));

            // Extract unique suppliers
            const supplierMap = new Map();
            for (const po of this.bestellungen) {
                if (po.lieferant?.name && !supplierMap.has(po.lieferant.name)) {
                    supplierMap.set(po.lieferant.name, { ...po.lieferant });
                }
            }
            this.lieferanten = Array.from(supplierMap.values());

            // Derive counter from highest existing PO number
            let maxNum = 0;
            for (const po of this.bestellungen) {
                const match = po.nummer?.match(/PO-\d{4}-(\d+)/);
                if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
            }
            this.poCounter = maxNum;

            console.debug(`[PO] Loaded ${this.bestellungen.length} POs from Supabase`);
        } catch (err) {
            console.error('[PO] Supabase load failed:', err.message);
        }
    }

    async _upsertToSupabase(po) {
        if (!this._isOnline()) return;
        try {
            const row = this._toSupabaseRow(po);
            const { error } = await this._supabase()
                .from('purchase_orders')
                .upsert(row, { onConflict: 'id' });
            if (error) console.error('[PO] Supabase upsert error:', error.message);
        } catch (err) {
            console.error('[PO] Supabase upsert failed:', err.message);
        }
    }

    async _deleteFromSupabase(poId) {
        if (!this._isOnline()) return;
        try {
            const { error } = await this._supabase()
                .from('purchase_orders')
                .delete()
                .eq('id', poId);
            if (error) console.error('[PO] Supabase delete error:', error.message);
        } catch (err) {
            console.error('[PO] Supabase delete failed:', err.message);
        }
    }

    // ============================================
    // CRUD Operations
    // ============================================

    async createPO(lieferant, positionen, options = {}) {
        const poNummer = this.generatePONummer();
        const po = {
            id: `PO-${poNummer}`,
            nummer: `PO-${poNummer}`,
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
            lieferdatum_tatsaechlich: options.lieferdatum_tatsaechlich || null,
            notizen: options.notizen || '',
            erstelltAm: new Date().toISOString(),
            auftragId: options.auftragId || null,
            eingangsrechnungNr: options.eingangsrechnungNr || null,
            confidence: options.confidence || null
        };

        this._calculatePOTotals(po);
        this.bestellungen.push(po);
        this._ensureSupplierExists(lieferant);

        await this._upsertToSupabase(po);

        // n8n Webhook Event
        window.webhookEventService?.poCreated?.(po);

        return po;
    }

    async updatePO(poId, updates) {
        const po = this.bestellungen.find(p => p.id === poId);
        if (!po) return null;

        Object.assign(po, updates);
        if (updates.positionen) {
            this._calculatePOTotals(po);
        }

        await this._upsertToSupabase(po);
        return po;
    }

    async deletePO(poId) {
        const index = this.bestellungen.findIndex(p => p.id === poId);
        if (index === -1) return false;

        const po = this.bestellungen[index];
        if (po.status !== 'entwurf') {
            console.warn('Cannot delete PO with status:', po.status);
            return false;
        }

        this.bestellungen.splice(index, 1);
        await this._deleteFromSupabase(poId);
        return true;
    }

    getPO(poId) {
        return this.bestellungen.find(p => p.id === poId) || null;
    }

    getAllPOs() {
        return [...this.bestellungen].sort((a, b) =>
            new Date(b.erstelltAm) - new Date(a.erstelltAm)
        );
    }

    getPOsByStatus(status) {
        return this.bestellungen.filter(p => p.status === status);
    }

    getPOsByLieferant(supplierName) {
        return this.bestellungen.filter(p => p.lieferant?.name === supplierName);
    }

    // ============================================
    // Workflow
    // ============================================

    async submitPO(poId) {
        const po = this.getPO(poId);
        if (!po || po.status !== 'entwurf') return null;

        po.status = 'bestellt';
        po.bestelldatum = new Date().toISOString().split('T')[0];
        await this._upsertToSupabase(po);
        return po;
    }

    async recordDelivery(poId, items) {
        const po = this.getPO(poId);
        if (!po) return null;
        if (po.status === 'entwurf' || po.status === 'storniert') return null;

        items.forEach(item => {
            const pos = po.positionen.find(p => p.materialId === item.materialId);
            if (pos) {
                pos.gelieferteMenge = (pos.gelieferteMenge || 0) + item.receivedQty;
            }
        });

        if (window.materialService) {
            items.forEach(item => {
                window.materialService.updateStock(item.materialId, item.receivedQty);
            });
        }

        const allFullyDelivered = po.positionen.every(pos => pos.gelieferteMenge >= pos.menge);
        if (allFullyDelivered) {
            po.status = 'geliefert';
            po.lieferdatum_tatsaechlich = new Date().toISOString().split('T')[0];
        } else if (po.positionen.some(pos => pos.gelieferteMenge > 0)) {
            po.status = 'teillieferung';
        }

        await this._upsertToSupabase(po);

        // n8n Webhook Event bei vollständiger Lieferung
        if (po.status === 'geliefert') {
            window.webhookEventService?.poDelivered?.(po);
        }

        return po;
    }

    async cancelPO(poId) {
        const po = this.getPO(poId);
        if (!po) return null;
        if (po.status === 'geliefert' || po.status === 'storniert') return null;

        po.status = 'storniert';
        await this._upsertToSupabase(po);
        return po;
    }

    // ============================================
    // Auto-generation
    // ============================================

    async generatePOFromShortage(shortageItems) {
        if (!window.materialService) return [];

        const createdPOs = [];
        const bySupplier = {};

        shortageItems.forEach(item => {
            const material = window.materialService.getMaterial(item.materialId);
            if (!material) return;

            const supplier = material.lieferant || 'Unknown';
            if (!bySupplier[supplier]) bySupplier[supplier] = [];

            const safetyBuffer = material.minBestand || 10;
            bySupplier[supplier].push({
                materialId: item.materialId,
                bezeichnung: material.bezeichnung,
                artikelnummer: material.artikelnummer,
                menge: item.shortage + safetyBuffer,
                einheit: material.einheit,
                ekPreis: material.preis
            });
        });

        for (const [supplierName, items] of Object.entries(bySupplier)) {
            let supplier = this.lieferanten.find(s => s.name === supplierName);
            if (!supplier) {
                supplier = { name: supplierName, email: '', telefon: '', ansprechpartner: '', lieferzeit_tage: 5 };
            }
            const po = await this.createPO(supplier, items, { notizen: 'Auto-generated from shortage' });
            createdPOs.push(po);
        }

        return createdPOs;
    }

    async generatePOFromLowStock() {
        if (!window.materialService) return [];
        const lowStockItems = window.materialService.getLowStockItems();
        if (lowStockItems.length === 0) return [];

        return await this.generatePOFromShortage(lowStockItems.map(material => ({
            materialId: material.id,
            shortage: Math.max(0, material.minBestand - material.bestand),
            material
        })));
    }

    // ============================================
    // Reporting
    // ============================================

    getOpenPOValue() {
        return this.bestellungen
            .filter(po => ['bestellt', 'teillieferung'].includes(po.status))
            .reduce((sum, po) => sum + po.brutto, 0);
    }

    getExpectedDeliveries(days = 7) {
        const now = new Date();
        const cutoff = new Date(now.getTime() + days * 86400000);
        return this.bestellungen.filter(po => {
            if (!['bestellt', 'teillieferung'].includes(po.status)) return false;
            const d = new Date(po.lieferdatum_erwartet);
            return d >= now && d <= cutoff;
        });
    }

    getPOHistory(dateRange = {}) {
        const { startDate, endDate } = dateRange;
        return this.bestellungen.filter(po => {
            if (startDate && po.bestelldatum < startDate) return false;
            if (endDate && po.bestelldatum > endDate) return false;
            return ['geliefert', 'storniert'].includes(po.status);
        });
    }

    // ============================================
    // Supplier Management
    // ============================================

    addSupplier(supplierData) {
        const existing = this.lieferanten.find(s => s.name === supplierData.name);
        if (existing) return existing;

        const supplier = {
            name: supplierData.name || '',
            email: supplierData.email || '',
            telefon: supplierData.telefon || '',
            ansprechpartner: supplierData.ansprechpartner || '',
            lieferzeit_tage: supplierData.lieferzeit_tage || 5,
            materialIds: supplierData.materialIds || []
        };

        this.lieferanten.push(supplier);
        return supplier;
    }

    getAllSuppliers() { return this.lieferanten; }

    getSupplier(name) {
        return this.lieferanten.find(s => s.name === name) || null;
    }

    updateSupplier(name, updates) {
        const supplier = this.getSupplier(name);
        if (!supplier) return null;
        Object.assign(supplier, updates);
        return supplier;
    }

    deleteSupplier(name) {
        const index = this.lieferanten.findIndex(s => s.name === name);
        if (index === -1) return false;

        const activePOs = this.getPOsByLieferant(name).filter(po =>
            ['bestellt', 'teillieferung'].includes(po.status)
        );
        if (activePOs.length > 0) return false;

        this.lieferanten.splice(index, 1);
        return true;
    }

    // ============================================
    // Numbering
    // ============================================

    generatePONummer() {
        this.poCounter++;
        const year = new Date().getFullYear();
        const num = this.poCounter.toString().padStart(3, '0');
        return `${year}-${num}`;
    }

    peekNextPONummer() {
        const year = new Date().getFullYear();
        const num = (this.poCounter + 1).toString().padStart(3, '0');
        return `${year}-${num}`;
    }

    // ============================================
    // Refresh from Supabase (called externally)
    // ============================================

    async refresh() {
        await this._loadFromSupabase();
        if (window.poUI) {
            window.poUI.renderPOList();
            if (typeof window.poUI.updateStats === 'function') {
                window.poUI.updateStats();
            }
        }
    }

    // ============================================
    // Private Helpers
    // ============================================

    _calculatePOTotals(po) {
        if (!po.positionen) po.positionen = [];
        const netto = po.positionen.reduce((sum, pos) =>
            sum + ((pos.menge || 0) * (pos.ekPreis || 0)), 0
        );
        po.netto = netto;
        const taxRate = (typeof window._getTaxRate === 'function') ? window._getTaxRate() : 0.19;
        po.mwst = netto * taxRate;
        po.brutto = netto * (1 + taxRate);
        po.positionen.forEach(pos => {
            pos.gesamtpreis = (pos.menge || 0) * (pos.ekPreis || 0);
        });
    }

    _ensureSupplierExists(supplier) {
        if (!this.lieferanten.find(s => s.name === supplier.name)) {
            this.addSupplier(supplier);
        }
    }

    _addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
    }
}

// Create global instance
window.purchaseOrderService = new PurchaseOrderService();

// Init from Supabase after page load
window.addEventListener('DOMContentLoaded', () => {
    let _initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 20;
    const tryInit = () => {
        if (window.supabaseClient?.isConfigured()) {
            window.purchaseOrderService.init().then(() => {
                if (window.poUI) {
                    window.poUI.renderPOList();
                    if (typeof window.poUI.updateStats === 'function') {
                        window.poUI.updateStats();
                    }
                }
                // Sync POs into Buchhaltung
                if (window.bookkeepingService) {
                    window.bookkeepingService.syncFromPurchaseOrders();
                }
            });
        } else if (++_initAttempts < MAX_INIT_ATTEMPTS) {
            setTimeout(tryInit, 1000);
        } else {
            console.warn('[PO] Supabase not configured after', MAX_INIT_ATTEMPTS, 'attempts, giving up');
        }
    };
    setTimeout(tryInit, 1000);
});
