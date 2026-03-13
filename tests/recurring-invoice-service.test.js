import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock globals ─────────────────────────────────────────────────────
// Mirrors the project pattern: inline class + mocked browser APIs

const localStorageStore = {};
const sessionStorageStore = {};

const localStorageMock = {
    getItem: vi.fn((key) => localStorageStore[key] || null),
    setItem: vi.fn((key, val) => { localStorageStore[key] = String(val); }),
    removeItem: vi.fn((key) => { delete localStorageStore[key]; }),
    clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); })
};

const sessionStorageMock = {
    getItem: vi.fn((key) => sessionStorageStore[key] || null),
    setItem: vi.fn((key, val) => { sessionStorageStore[key] = String(val); }),
    removeItem: vi.fn((key) => { delete sessionStorageStore[key]; }),
    clear: vi.fn(() => { Object.keys(sessionStorageStore).forEach(k => delete sessionStorageStore[k]); })
};

// Supabase mock builder
function createSupabaseMock(data = [], error = null) {
    const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data, error }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, error: null })
            })
        })
    };
    return {
        from: vi.fn().mockReturnValue(chainable),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-123' } } }) },
        _chain: chainable
    };
}

// ── Inline RecurringInvoiceService (from js/services/recurring-invoice-service.js) ──

class RecurringInvoiceService {
    constructor() {
        this._ready = false;
        this.templates = [];
        this._userId = null;
        this._tenantId = 'a0000000-0000-0000-0000-000000000001';
        this._schedulerInterval = null;
        // Skip window.addEventListener in tests
    }

    async init() {
        if (this._ready) { return; }
        try {
            const { data } = await this._supabase()?.auth?.getUser() || {};
            this._userId = data?.user?.id || '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc';
        } catch {
            this._userId = '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc';
        }
        await this._loadFromSupabase();
        this._ready = true;
        // Skip _startScheduler in tests
        console.debug('[RecurringInvoice] Initialised - ' + this.templates.length + ' templates loaded');
    }

    _supabase() {
        return globalThis.supabaseClient?.client;
    }

    _isOnline() {
        return !!(this._supabase() && globalThis.supabaseClient?.isConfigured());
    }

    _toRow(t) {
        return {
            id:                       t.id,
            user_id:                  this._userId || '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc',
            tenant_id:                this._tenantId,
            kunde_id:                 t.kunde_id || null,
            kunde_name:               t.kunde_name || '',
            kunde_email:              t.kunde_email || '',
            kunde_adresse:            t.kunde_adresse || '',
            bezeichnung:              t.bezeichnung || '',
            positionen:               JSON.stringify(t.positionen || []),
            netto_betrag:             t.netto_betrag || 0,
            steuersatz:               t.steuersatz != null ? t.steuersatz : 0.19,
            intervall:                t.intervall || 'monatlich',
            benutzerdefinierte_monate: t.benutzerdefinierte_monate || 1,
            tag_im_monat:             t.tag_im_monat || 1,
            zahlungsziel_tage:        t.zahlungsziel_tage || 14,
            start_datum:              t.start_datum || null,
            end_datum:                t.end_datum || null,
            max_anzahl:               t.max_anzahl || null,
            notizen:                  t.notizen || '',
            status:                   t.status || 'aktiv',
            anzahl_erstellt:          t.anzahl_erstellt || 0,
            gesamt_umsatz:            t.gesamt_umsatz || 0,
            letzte_rechnung:          t.letzte_rechnung || null,
            naechste_faelligkeit:     t.naechste_faelligkeit || null,
            created_at:               t.created_at || new Date().toISOString(),
            updated_at:               new Date().toISOString()
        };
    }

    _fromRow(r) {
        let positionen = r.positionen || [];
        if (typeof positionen === 'string') {
            try { positionen = JSON.parse(positionen); } catch { positionen = []; }
        }
        return {
            id:                       r.id,
            kunde_id:                 r.kunde_id || null,
            kunde_name:               r.kunde_name || '',
            kunde_email:              r.kunde_email || '',
            kunde_adresse:            r.kunde_adresse || '',
            bezeichnung:              r.bezeichnung || '',
            positionen:               positionen,
            netto_betrag:             parseFloat(r.netto_betrag) || 0,
            steuersatz:               r.steuersatz != null ? parseFloat(r.steuersatz) : 0.19,
            intervall:                r.intervall || 'monatlich',
            benutzerdefinierte_monate: parseInt(r.benutzerdefinierte_monate) || 1,
            tag_im_monat:             parseInt(r.tag_im_monat) || 1,
            zahlungsziel_tage:        parseInt(r.zahlungsziel_tage) || 14,
            start_datum:              r.start_datum || null,
            end_datum:                r.end_datum || null,
            max_anzahl:               r.max_anzahl ? parseInt(r.max_anzahl) : null,
            notizen:                  r.notizen || '',
            status:                   r.status || 'aktiv',
            anzahl_erstellt:          parseInt(r.anzahl_erstellt) || 0,
            gesamt_umsatz:            parseFloat(r.gesamt_umsatz) || 0,
            letzte_rechnung:          r.letzte_rechnung || null,
            naechste_faelligkeit:     r.naechste_faelligkeit || null,
            created_at:               r.created_at,
            updated_at:               r.updated_at
        };
    }

    async _loadFromSupabase() {
        if (!this._isOnline()) {
            this._loadLocal();
            return;
        }
        try {
            const result = await this._supabase()
                .from('recurring_invoice_templates')
                .select('*')
                .eq('tenant_id', this._tenantId)
                .order('created_at', { ascending: false });
            if (result.error) {
                console.error('[RecurringInvoice] Supabase load error:', result.error.message);
                this._loadLocal();
                return;
            }
            this.templates = (result.data || []).map(r => this._fromRow(r));
            this._saveLocal();
        } catch (err) {
            console.error('[RecurringInvoice] Supabase load failed:', err.message);
            this._loadLocal();
        }
    }

    async _upsertToSupabase(template) {
        if (!this._isOnline()) { return; }
        try {
            const row = this._toRow(template);
            const result = await this._supabase()
                .from('recurring_invoice_templates')
                .upsert(row, { onConflict: 'id' });
            if (result.error) { console.error('[RecurringInvoice] Supabase upsert error:', result.error.message); }
        } catch (err) {
            console.error('[RecurringInvoice] Supabase upsert failed:', err.message);
        }
    }

    async _deleteFromSupabase(id) {
        if (!this._isOnline()) { return; }
        try {
            const result = await this._supabase()
                .from('recurring_invoice_templates')
                .delete()
                .eq('id', id)
                .eq('tenant_id', this._tenantId);
            if (result.error) { console.error('[RecurringInvoice] Supabase delete error:', result.error.message); }
        } catch (err) {
            console.error('[RecurringInvoice] Supabase delete failed:', err.message);
        }
    }

    _loadLocal() {
        try { this.templates = JSON.parse(globalThis.localStorage.getItem('freyai_recurring_inv_templates') || '[]'); } catch { this.templates = []; }
    }

    _saveLocal() {
        try { globalThis.localStorage.setItem('freyai_recurring_inv_templates', JSON.stringify(this.templates)); } catch { /* quota */ }
    }

    async createTemplate(data) {
        await this._ensureReady();

        const template = {
            id:                       'rit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            kunde_id:                 data.kunde_id || null,
            kunde_name:               data.kunde_name || '',
            kunde_email:              data.kunde_email || '',
            kunde_adresse:            data.kunde_adresse || '',
            bezeichnung:              data.bezeichnung || '',
            positionen:               data.positionen || [],
            netto_betrag:             parseFloat(data.netto_betrag) || 0,
            steuersatz:               data.steuersatz != null ? parseFloat(data.steuersatz) : 0.19,
            intervall:                data.intervall || 'monatlich',
            benutzerdefinierte_monate: parseInt(data.benutzerdefinierte_monate) || 1,
            tag_im_monat:             parseInt(data.tag_im_monat) || 1,
            zahlungsziel_tage:        parseInt(data.zahlungsziel_tage) || 14,
            start_datum:              data.start_datum || new Date().toISOString().split('T')[0],
            end_datum:                data.end_datum || null,
            max_anzahl:               data.max_anzahl ? parseInt(data.max_anzahl) : null,
            notizen:                  data.notizen || '',
            status:                   'aktiv',
            anzahl_erstellt:          0,
            gesamt_umsatz:            0,
            letzte_rechnung:          null,
            naechste_faelligkeit:     null,
            created_at:               new Date().toISOString(),
            updated_at:               new Date().toISOString()
        };

        template.naechste_faelligkeit = this._berechneNaechstesDatum(template);

        this.templates.push(template);
        this._saveLocal();
        await this._upsertToSupabase(template);

        return { success: true, template: template };
    }

    async updateTemplate(id, changes) {
        await this._ensureReady();
        const tpl = this.templates.find(function(t) { return t.id === id; });
        if (!tpl) { return { success: false, error: 'Template nicht gefunden' }; }

        const safeCopy = Object.assign({}, changes);
        delete safeCopy.id;
        delete safeCopy.created_at;
        Object.assign(tpl, safeCopy, { updated_at: new Date().toISOString() });
        tpl.naechste_faelligkeit = this._berechneNaechstesDatum(tpl);

        this._saveLocal();
        await this._upsertToSupabase(tpl);
        return { success: true, template: tpl };
    }

    async pauseTemplate(id) {
        return this.updateTemplate(id, { status: 'pausiert' });
    }

    async activateTemplate(id) {
        await this._ensureReady();
        const tpl = this.templates.find(function(t) { return t.id === id; });
        if (!tpl) { return { success: false, error: 'Template nicht gefunden' }; }

        tpl.status = 'aktiv';
        tpl.naechste_faelligkeit = this._berechneNaechstesDatum(tpl);
        tpl.updated_at = new Date().toISOString();

        this._saveLocal();
        await this._upsertToSupabase(tpl);
        return { success: true, template: tpl };
    }

    async endTemplate(id) {
        return this.updateTemplate(id, { status: 'beendet', naechste_faelligkeit: null });
    }

    async deleteTemplate(id) {
        await this._ensureReady();
        const idx = this.templates.findIndex(function(t) { return t.id === id; });
        if (idx === -1) { return { success: false, error: 'Template nicht gefunden' }; }

        this.templates.splice(idx, 1);
        this._saveLocal();
        await this._deleteFromSupabase(id);
        return { success: true };
    }

    getTemplates(filter) {
        filter = filter || {};
        let result = this.templates.slice();
        if (filter.status) { result = result.filter(function(t) { return t.status === filter.status; }); }
        if (filter.kunde_id) { result = result.filter(function(t) { return t.kunde_id === filter.kunde_id; }); }
        return result.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    }

    getTemplate(id) {
        return this.templates.find(function(t) { return t.id === id; }) || null;
    }

    async generateDueInvoices() {
        await this._ensureReady();
        const heute = new Date().toISOString().split('T')[0];
        const erstellte = [];

        for (let i = 0; i < this.templates.length; i++) {
            const tpl = this.templates[i];
            if (tpl.status !== 'aktiv' || !tpl.naechste_faelligkeit) { continue; }
            if (tpl.naechste_faelligkeit > heute) { continue; }

            const dupKey = 'rit_gen_' + tpl.id + '_' + heute;
            if (globalThis.sessionStorage.getItem(dupKey)) { continue; }

            const rechnung = await this._generiereRechnung(tpl);
            if (rechnung) {
                erstellte.push(rechnung);
                globalThis.sessionStorage.setItem(dupKey, '1');
            }
        }

        if (erstellte.length > 0) {
            console.debug('[RecurringInvoice] ' + erstellte.length + ' Rechnung(en) automatisch erstellt');
        }

        return { erstellt: erstellte.length, rechnungen: erstellte };
    }

    async generateNow(id) {
        await this._ensureReady();
        const tpl = this.templates.find(function(t) { return t.id === id; });
        if (!tpl || tpl.status === 'beendet') { return null; }
        return this._generiereRechnung(tpl);
    }

    async _generiereRechnung(tpl) {
        const storeService = globalThis.storeService;
        if (!storeService || !storeService.store || !storeService.store.rechnungen) {
            console.warn('[RecurringInvoice] StoreService nicht verfuegbar');
            return null;
        }

        try {
            const mwst = Math.round(tpl.netto_betrag * tpl.steuersatz * 100) / 100;
            const brutto = Math.round((tpl.netto_betrag + mwst) * 100) / 100;
            const heute = new Date().toISOString().split('T')[0];
            const faellig = this._addTage(heute, tpl.zahlungsziel_tage);

            let nummer = 'RE-ABO-' + Date.now();
            if (globalThis.invoiceNumberingService) {
                try {
                    const userId = (storeService.getCurrentUserId && storeService.getCurrentUserId()) || 'default';
                    nummer = await globalThis.invoiceNumberingService.generateNumber(userId);
                } catch (e) {
                    console.warn('[RecurringInvoice] Nummernfallback', e);
                }
            }

            const aboVermerk = 'Auto-generiert aus Abo "' + (tpl.bezeichnung || '') + '"';

            const rechnung = {
                id: (storeService.generateId && storeService.generateId('RE')) || ('RE-' + Date.now()),
                nummer: nummer,
                kunde: {
                    id: tpl.kunde_id,
                    name: tpl.kunde_name,
                    email: tpl.kunde_email,
                    adresse: tpl.kunde_adresse
                },
                leistungsart: tpl.bezeichnung,
                positionen: tpl.positionen.length > 0 ? tpl.positionen : [{
                    beschreibung: tpl.bezeichnung,
                    menge: 1,
                    einzelpreis: tpl.netto_betrag
                }],
                netto: tpl.netto_betrag,
                mwst: mwst,
                brutto: brutto,
                status: 'offen',
                datum: new Date().toISOString(),
                faelligkeitsdatum: new Date(faellig).toISOString(),
                createdAt: new Date().toISOString(),
                pdfGenerated: false,
                eInvoiceGenerated: false,
                notizen: aboVermerk,
                istWiederkehrend: true,
                wiederkehrendeVorlageId: tpl.id
            };

            storeService.store.rechnungen.push(rechnung);
            storeService.save();
            if (storeService.addActivity) {
                storeService.addActivity('💰', 'Abo-Rechnung ' + nummer + ' erstellt (' + tpl.kunde_name + ')');
            }

            if (globalThis.webhookEventService && globalThis.webhookEventService.invoiceCreated) {
                globalThis.webhookEventService.invoiceCreated(rechnung);
            }

            tpl.anzahl_erstellt++;
            tpl.gesamt_umsatz += tpl.netto_betrag;
            tpl.letzte_rechnung = heute;
            tpl.naechste_faelligkeit = this._berechneNaechstesDatum(tpl);

            if (tpl.max_anzahl && tpl.anzahl_erstellt >= tpl.max_anzahl) {
                tpl.status = 'beendet';
                tpl.naechste_faelligkeit = null;
            }

            if (tpl.end_datum && tpl.naechste_faelligkeit && tpl.naechste_faelligkeit > tpl.end_datum) {
                tpl.status = 'beendet';
                tpl.naechste_faelligkeit = null;
            }

            tpl.updated_at = new Date().toISOString();
            this._saveLocal();
            await this._upsertToSupabase(tpl);

            this._benachrichtigen(tpl, rechnung);
            return rechnung;
        } catch (error) {
            console.error('[RecurringInvoice] Fehler bei Rechnungserstellung:', error);
            return null;
        }
    }

    _berechneNaechstesDatum(tpl) {
        let basis;

        if (tpl.letzte_rechnung) {
            basis = new Date(tpl.letzte_rechnung);
        } else if (tpl.start_datum) {
            const start = new Date(tpl.start_datum);
            const heute = new Date();
            heute.setHours(0, 0, 0, 0);
            if (start >= heute) { return tpl.start_datum; }
            basis = start;
        } else {
            basis = new Date();
        }

        const naechstes = new Date(basis);

        switch (tpl.intervall) {
            case 'monatlich':
                naechstes.setMonth(naechstes.getMonth() + 1);
                break;
            case 'quartalsweise':
                naechstes.setMonth(naechstes.getMonth() + 3);
                break;
            case 'jaehrlich':
                naechstes.setFullYear(naechstes.getFullYear() + 1);
                break;
            case 'benutzerdefiniert':
                naechstes.setMonth(naechstes.getMonth() + (tpl.benutzerdefinierte_monate || 1));
                break;
        }

        if (tpl.tag_im_monat) {
            const maxTag = new Date(naechstes.getFullYear(), naechstes.getMonth() + 1, 0).getDate();
            naechstes.setDate(Math.min(tpl.tag_im_monat, maxTag));
        }

        const ergebnis = naechstes.toISOString().split('T')[0];

        if (tpl.end_datum && ergebnis > tpl.end_datum) { return null; }
        if (tpl.max_anzahl && tpl.anzahl_erstellt >= tpl.max_anzahl) { return null; }

        return ergebnis;
    }

    _addTage(datumStr, tage) {
        const d = new Date(datumStr);
        d.setDate(d.getDate() + tage);
        return d.toISOString().split('T')[0];
    }

    getStatistiken() {
        const aktive = this.templates.filter(function(t) { return t.status === 'aktiv'; });

        const mrr = aktive.reduce(function(sum, t) {
            switch (t.intervall) {
                case 'monatlich': return sum + t.netto_betrag;
                case 'quartalsweise': return sum + (t.netto_betrag / 3);
                case 'jaehrlich': return sum + (t.netto_betrag / 12);
                case 'benutzerdefiniert': return sum + (t.netto_betrag / (t.benutzerdefinierte_monate || 1));
                default: return sum;
            }
        }, 0);

        return {
            gesamt: this.templates.length,
            aktiv: aktive.length,
            pausiert: this.templates.filter(function(t) { return t.status === 'pausiert'; }).length,
            beendet: this.templates.filter(function(t) { return t.status === 'beendet'; }).length,
            mrr: mrr,
            arr: mrr * 12,
            gesamt_umsatz: this.templates.reduce(function(s, t) { return s + t.gesamt_umsatz; }, 0)
        };
    }

    getVorschau(monate) {
        monate = monate || 12;
        const vorschau = [];
        const endDatum = new Date();
        endDatum.setMonth(endDatum.getMonth() + monate);
        const endStr = endDatum.toISOString().split('T')[0];

        const aktiveTpls = this.templates.filter(function(t) { return t.status === 'aktiv'; });
        for (let i = 0; i < aktiveTpls.length; i++) {
            const tpl = aktiveTpls[i];
            const temp = Object.assign({}, tpl);
            let naechstes = temp.naechste_faelligkeit;

            while (naechstes && naechstes <= endStr) {
                vorschau.push({
                    template_id: tpl.id,
                    kunde_name: tpl.kunde_name,
                    bezeichnung: tpl.bezeichnung,
                    datum: naechstes,
                    netto_betrag: tpl.netto_betrag,
                    brutto_betrag: tpl.netto_betrag * (1 + tpl.steuersatz)
                });
                temp.letzte_rechnung = naechstes;
                temp.anzahl_erstellt++;
                naechstes = this._berechneNaechstesDatum(temp);
            }
        }

        return vorschau.sort(function(a, b) { return a.datum.localeCompare(b.datum); });
    }

    getIntervallName(intervall) {
        const namen = {
            'monatlich': 'Monatlich',
            'quartalsweise': 'Quartalsweise',
            'jaehrlich': 'Jaehrlich',
            'benutzerdefiniert': 'Benutzerdefiniert'
        };
        return namen[intervall] || intervall;
    }

    getStatusName(status) {
        const namen = { 'aktiv': 'Aktiv', 'pausiert': 'Pausiert', 'beendet': 'Beendet' };
        return namen[status] || status;
    }

    _benachrichtigen(tpl, rechnung) {
        const betragStr = (parseFloat(rechnung.brutto) || 0).toFixed(2);
        if (globalThis.notificationService && globalThis.notificationService.sendTelegram) {
            const msg = [
                '📄 Abo-Rechnung erstellt',
                'Kunde: ' + tpl.kunde_name,
                'Rechnung: ' + rechnung.nummer,
                'Betrag: ' + betragStr + ' EUR (brutto)',
                'Naechste: ' + (tpl.naechste_faelligkeit || 'Keine (beendet)')
            ].join('\n');
            globalThis.notificationService.sendTelegram(msg);
        } else if (globalThis.notificationService && globalThis.notificationService.send) {
            globalThis.notificationService.send(
                'Abo-Rechnung erstellt',
                rechnung.nummer + ' - ' + tpl.kunde_name + ': ' + betragStr + ' EUR'
            );
        }
    }

    _startScheduler() {
        // no-op in tests
    }

    stop() {
        if (this._schedulerInterval) {
            clearInterval(this._schedulerInterval);
            this._schedulerInterval = null;
        }
    }

    async _ensureReady() {
        if (!this._ready) { await this.init(); }
    }
}


// ── Helpers ──────────────────────────────────────────────────────────

function makeTemplateData(overrides = {}) {
    return {
        kunde_id: 'kunde-001',
        kunde_name: 'Mustermann GmbH',
        kunde_email: 'info@mustermann.de',
        kunde_adresse: 'Musterstr. 1, 10115 Berlin',
        bezeichnung: 'Monatlicher IT-Retainer',
        positionen: [{ beschreibung: 'IT-Support', menge: 1, einzelpreis: 500 }],
        netto_betrag: 500,
        steuersatz: 0.19,
        intervall: 'monatlich',
        tag_im_monat: 1,
        zahlungsziel_tage: 14,
        start_datum: '2025-01-01',
        ...overrides
    };
}

function setupStoreService() {
    globalThis.storeService = {
        store: { rechnungen: [] },
        save: vi.fn(),
        addActivity: vi.fn(),
        generateId: vi.fn((prefix) => prefix + '-' + Date.now()),
        getCurrentUserId: vi.fn(() => 'test-user-123')
    };
}


// ── Tests ────────────────────────────────────────────────────────────

describe('RecurringInvoiceService', () => {
    let service;

    beforeEach(() => {
        // Reset globals
        globalThis.localStorage = localStorageMock;
        globalThis.sessionStorage = sessionStorageMock;
        localStorageMock.clear();
        sessionStorageMock.clear();
        vi.clearAllMocks();

        // Default: offline mode (no supabase)
        globalThis.supabaseClient = undefined;
        globalThis.storeService = undefined;
        globalThis.invoiceNumberingService = undefined;
        globalThis.webhookEventService = undefined;
        globalThis.notificationService = undefined;

        service = new RecurringInvoiceService();
    });

    afterEach(() => {
        service.stop();
    });

    // ── Initialisation ───────────────────────────────────────────

    describe('Initialisation', () => {
        it('should start with empty templates and not ready', () => {
            expect(service.templates).toEqual([]);
            expect(service._ready).toBe(false);
        });

        it('should init offline with empty localStorage', async () => {
            await service.init();
            expect(service._ready).toBe(true);
            expect(service.templates).toEqual([]);
            expect(service._userId).toBe('83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc');
        });

        it('should load templates from localStorage when offline', async () => {
            const stored = [{ id: 'rit-1', kunde_name: 'Test', status: 'aktiv' }];
            localStorageMock.setItem('freyai_recurring_inv_templates', JSON.stringify(stored));

            await service.init();
            expect(service.templates).toEqual(stored);
        });

        it('should not re-init if already ready', async () => {
            await service.init();
            service.templates = [{ id: 'keep-me' }];
            await service.init();
            expect(service.templates).toEqual([{ id: 'keep-me' }]);
        });

        it('should load from Supabase when online', async () => {
            const mockRows = [{
                id: 'rit-remote-1',
                kunde_name: 'Remote Kunde',
                netto_betrag: '300',
                steuersatz: '0.19',
                intervall: 'monatlich',
                positionen: '[]',
                benutzerdefinierte_monate: 1,
                tag_im_monat: 1,
                zahlungsziel_tage: 14,
                anzahl_erstellt: '0',
                gesamt_umsatz: '0',
                status: 'aktiv',
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z'
            }];
            const sbMock = createSupabaseMock(mockRows);
            globalThis.supabaseClient = { client: sbMock, isConfigured: () => true };

            await service.init();
            expect(service.templates.length).toBe(1);
            expect(service.templates[0].kunde_name).toBe('Remote Kunde');
            expect(service.templates[0].netto_betrag).toBe(300);
        });
    });

    // ── CRUD: createTemplate ─────────────────────────────────────

    describe('createTemplate', () => {
        it('should create a template with default values', async () => {
            const result = await service.createTemplate(makeTemplateData());
            expect(result.success).toBe(true);
            expect(result.template.id).toMatch(/^rit-/);
            expect(result.template.status).toBe('aktiv');
            expect(result.template.anzahl_erstellt).toBe(0);
            expect(result.template.gesamt_umsatz).toBe(0);
        });

        it('should set naechste_faelligkeit on creation', async () => {
            const result = await service.createTemplate(makeTemplateData());
            expect(result.template.naechste_faelligkeit).toBeTruthy();
        });

        it('should default intervall to monatlich', async () => {
            const result = await service.createTemplate(makeTemplateData({ intervall: undefined }));
            expect(result.template.intervall).toBe('monatlich');
        });

        it('should default steuersatz to 0.19', async () => {
            const result = await service.createTemplate(makeTemplateData({ steuersatz: undefined }));
            expect(result.template.steuersatz).toBe(0.19);
        });

        it('should allow steuersatz of 0', async () => {
            const result = await service.createTemplate(makeTemplateData({ steuersatz: 0 }));
            expect(result.template.steuersatz).toBe(0);
        });

        it('should persist to localStorage', async () => {
            await service.createTemplate(makeTemplateData());
            const stored = JSON.parse(localStorageMock.getItem('freyai_recurring_inv_templates'));
            expect(stored.length).toBe(1);
        });

        it('should add template to internal array', async () => {
            await service.createTemplate(makeTemplateData({ kunde_name: 'Kunde A' }));
            await service.createTemplate(makeTemplateData({ kunde_name: 'Kunde B' }));
            expect(service.templates.length).toBe(2);
        });
    });

    // ── CRUD: updateTemplate ─────────────────────────────────────

    describe('updateTemplate', () => {
        it('should update existing template fields', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            const result = await service.updateTemplate(template.id, { netto_betrag: 750 });
            expect(result.success).toBe(true);
            expect(result.template.netto_betrag).toBe(750);
        });

        it('should not overwrite id or created_at', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            const origId = template.id;
            const origCreated = template.created_at;
            await service.updateTemplate(template.id, { id: 'hacked', created_at: '2000-01-01' });
            expect(service.getTemplate(origId).id).toBe(origId);
            expect(service.getTemplate(origId).created_at).toBe(origCreated);
        });

        it('should return error for nonexistent template', async () => {
            const result = await service.updateTemplate('nonexistent', { netto_betrag: 100 });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Template nicht gefunden');
        });
    });

    // ── Status transitions ───────────────────────────────────────

    describe('Status Transitions', () => {
        it('should pause a template', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            const result = await service.pauseTemplate(template.id);
            expect(result.success).toBe(true);
            expect(result.template.status).toBe('pausiert');
        });

        it('should activate a paused template', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            await service.pauseTemplate(template.id);
            const result = await service.activateTemplate(template.id);
            expect(result.success).toBe(true);
            expect(result.template.status).toBe('aktiv');
            expect(result.template.naechste_faelligkeit).toBeTruthy();
        });

        it('should end a template', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            const result = await service.endTemplate(template.id);
            expect(result.success).toBe(true);
            expect(result.template.status).toBe('beendet');
        });

        it('should return error when activating nonexistent template', async () => {
            const result = await service.activateTemplate('ghost');
            expect(result.success).toBe(false);
        });
    });

    // ── CRUD: deleteTemplate ─────────────────────────────────────

    describe('deleteTemplate', () => {
        it('should remove template from array', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            const result = await service.deleteTemplate(template.id);
            expect(result.success).toBe(true);
            expect(service.templates.length).toBe(0);
        });

        it('should return error for nonexistent template', async () => {
            const result = await service.deleteTemplate('nonexistent');
            expect(result.success).toBe(false);
        });

        it('should update localStorage after deletion', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            await service.deleteTemplate(template.id);
            const stored = JSON.parse(localStorageMock.getItem('freyai_recurring_inv_templates'));
            expect(stored.length).toBe(0);
        });
    });

    // ── Query: getTemplates / getTemplate ────────────────────────

    describe('getTemplates & getTemplate', () => {
        it('should filter by status', async () => {
            await service.createTemplate(makeTemplateData({ kunde_name: 'A' }));
            const { template: b } = await service.createTemplate(makeTemplateData({ kunde_name: 'B' }));
            await service.pauseTemplate(b.id);

            const aktive = service.getTemplates({ status: 'aktiv' });
            expect(aktive.length).toBe(1);
            expect(aktive[0].kunde_name).toBe('A');
        });

        it('should filter by kunde_id', async () => {
            await service.createTemplate(makeTemplateData({ kunde_id: 'k1' }));
            await service.createTemplate(makeTemplateData({ kunde_id: 'k2' }));

            const filtered = service.getTemplates({ kunde_id: 'k1' });
            expect(filtered.length).toBe(1);
            expect(filtered[0].kunde_id).toBe('k1');
        });

        it('should return null for nonexistent getTemplate', () => {
            expect(service.getTemplate('ghost')).toBeNull();
        });

        it('should sort templates by created_at descending', async () => {
            const { template: first } = await service.createTemplate(makeTemplateData({ kunde_name: 'First' }));
            const { template: second } = await service.createTemplate(makeTemplateData({ kunde_name: 'Second' }));
            // Ensure distinct timestamps for deterministic sort
            first.created_at = '2025-01-01T00:00:00.000Z';
            second.created_at = '2025-06-01T00:00:00.000Z';
            const all = service.getTemplates();
            expect(all[0].kunde_name).toBe('Second');
            expect(all[1].kunde_name).toBe('First');
        });
    });

    // ── Date Calculation ─────────────────────────────────────────

    describe('Date Calculation (_berechneNaechstesDatum)', () => {
        it('should calculate monthly interval from letzte_rechnung', () => {
            const tpl = { intervall: 'monatlich', letzte_rechnung: '2025-03-01', tag_im_monat: 1 };
            const result = service._berechneNaechstesDatum(tpl);
            expect(result).toBe('2025-04-01');
        });

        it('should calculate quarterly interval', () => {
            const tpl = { intervall: 'quartalsweise', letzte_rechnung: '2025-01-15', tag_im_monat: 15 };
            const result = service._berechneNaechstesDatum(tpl);
            expect(result).toBe('2025-04-15');
        });

        it('should calculate yearly interval', () => {
            const tpl = { intervall: 'jaehrlich', letzte_rechnung: '2025-06-01', tag_im_monat: 1 };
            const result = service._berechneNaechstesDatum(tpl);
            expect(result).toBe('2026-06-01');
        });

        it('should calculate custom interval (benutzerdefiniert)', () => {
            const tpl = { intervall: 'benutzerdefiniert', benutzerdefinierte_monate: 2, letzte_rechnung: '2025-01-10', tag_im_monat: 10 };
            const result = service._berechneNaechstesDatum(tpl);
            expect(result).toBe('2025-03-10');
        });

        it('should return null when end_datum is exceeded', () => {
            const tpl = { intervall: 'monatlich', letzte_rechnung: '2025-12-01', tag_im_monat: 1, end_datum: '2025-12-31' };
            const result = service._berechneNaechstesDatum(tpl);
            expect(result).toBeNull();
        });

        it('should return null when max_anzahl is reached', () => {
            const tpl = { intervall: 'monatlich', letzte_rechnung: '2025-06-01', tag_im_monat: 1, max_anzahl: 3, anzahl_erstellt: 3 };
            const result = service._berechneNaechstesDatum(tpl);
            expect(result).toBeNull();
        });

        it('should clamp tag_im_monat to last day of month (Feb 28/29)', () => {
            // Use Jan 15 as basis so month+1 lands in Feb without JS Date overflow
            const tpl = { intervall: 'monatlich', letzte_rechnung: '2025-01-15', tag_im_monat: 31 };
            const result = service._berechneNaechstesDatum(tpl);
            // February 2025 has 28 days, so tag 31 gets clamped to 28
            expect(result).toBe('2025-02-28');
        });

        it('should return start_datum if it is in the future and no letzte_rechnung', () => {
            const futureDate = '2099-06-15';
            const tpl = { intervall: 'monatlich', start_datum: futureDate, tag_im_monat: 15 };
            const result = service._berechneNaechstesDatum(tpl);
            expect(result).toBe(futureDate);
        });
    });

    // ── _addTage ─────────────────────────────────────────────────

    describe('_addTage', () => {
        it('should add days to a date string', () => {
            expect(service._addTage('2025-03-01', 14)).toBe('2025-03-15');
        });

        it('should cross month boundaries', () => {
            expect(service._addTage('2025-01-25', 10)).toBe('2025-02-04');
        });
    });

    // ── Row Mapping ──────────────────────────────────────────────

    describe('Row Mapping (_toRow / _fromRow)', () => {
        it('should serialize positionen to JSON string in _toRow', () => {
            const tpl = { id: 'x', positionen: [{ beschreibung: 'Test', menge: 1 }] };
            const row = service._toRow(tpl);
            expect(typeof row.positionen).toBe('string');
            expect(JSON.parse(row.positionen)).toEqual([{ beschreibung: 'Test', menge: 1 }]);
        });

        it('should deserialize positionen from JSON string in _fromRow', () => {
            const row = { id: 'x', positionen: '[{"beschreibung":"Test"}]', netto_betrag: '100', steuersatz: '0.19', anzahl_erstellt: '5', gesamt_umsatz: '500' };
            const tpl = service._fromRow(row);
            expect(Array.isArray(tpl.positionen)).toBe(true);
            expect(tpl.positionen[0].beschreibung).toBe('Test');
        });

        it('should handle invalid JSON in positionen gracefully', () => {
            const row = { id: 'x', positionen: '{broken json', netto_betrag: '0', anzahl_erstellt: '0', gesamt_umsatz: '0' };
            const tpl = service._fromRow(row);
            expect(tpl.positionen).toEqual([]);
        });

        it('should parse numeric strings in _fromRow', () => {
            const row = { id: 'x', netto_betrag: '1234.56', steuersatz: '0.07', anzahl_erstellt: '10', gesamt_umsatz: '12345.60', benutzerdefinierte_monate: '3', tag_im_monat: '15', zahlungsziel_tage: '30' };
            const tpl = service._fromRow(row);
            expect(tpl.netto_betrag).toBe(1234.56);
            expect(tpl.steuersatz).toBe(0.07);
            expect(tpl.anzahl_erstellt).toBe(10);
            expect(tpl.benutzerdefinierte_monate).toBe(3);
            expect(tpl.tag_im_monat).toBe(15);
            expect(tpl.zahlungsziel_tage).toBe(30);
        });
    });

    // ── Statistiken ──────────────────────────────────────────────

    describe('getStatistiken', () => {
        it('should return zero stats for empty templates', () => {
            const stats = service.getStatistiken();
            expect(stats.gesamt).toBe(0);
            expect(stats.aktiv).toBe(0);
            expect(stats.mrr).toBe(0);
            expect(stats.arr).toBe(0);
        });

        it('should calculate MRR for monthly templates', async () => {
            await service.createTemplate(makeTemplateData({ netto_betrag: 300 }));
            await service.createTemplate(makeTemplateData({ netto_betrag: 200 }));
            const stats = service.getStatistiken();
            expect(stats.aktiv).toBe(2);
            expect(stats.mrr).toBeCloseTo(500, 2);
            expect(stats.arr).toBeCloseTo(6000, 2);
        });

        it('should calculate MRR for quarterly template as netto/3', async () => {
            await service.createTemplate(makeTemplateData({ netto_betrag: 900, intervall: 'quartalsweise' }));
            const stats = service.getStatistiken();
            expect(stats.mrr).toBeCloseTo(300, 2);
        });

        it('should calculate MRR for yearly template as netto/12', async () => {
            await service.createTemplate(makeTemplateData({ netto_betrag: 1200, intervall: 'jaehrlich' }));
            const stats = service.getStatistiken();
            expect(stats.mrr).toBeCloseTo(100, 2);
        });

        it('should calculate MRR for custom interval', async () => {
            await service.createTemplate(makeTemplateData({ netto_betrag: 600, intervall: 'benutzerdefiniert', benutzerdefinierte_monate: 2 }));
            const stats = service.getStatistiken();
            expect(stats.mrr).toBeCloseTo(300, 2);
        });

        it('should not include paused templates in MRR', async () => {
            const { template } = await service.createTemplate(makeTemplateData({ netto_betrag: 500 }));
            await service.pauseTemplate(template.id);
            const stats = service.getStatistiken();
            expect(stats.mrr).toBe(0);
            expect(stats.pausiert).toBe(1);
        });

        it('should sum gesamt_umsatz across all templates', async () => {
            await service.createTemplate(makeTemplateData());
            await service.createTemplate(makeTemplateData());
            // Manually set gesamt_umsatz for testing
            service.templates[0].gesamt_umsatz = 1500;
            service.templates[1].gesamt_umsatz = 2500;
            const stats = service.getStatistiken();
            expect(stats.gesamt_umsatz).toBe(4000);
        });
    });

    // ── Invoice Generation ───────────────────────────────────────

    describe('Invoice Generation', () => {
        beforeEach(() => {
            setupStoreService();
        });

        it('should generate invoice via generateNow', async () => {
            const { template } = await service.createTemplate(makeTemplateData({ netto_betrag: 500, steuersatz: 0.19 }));
            const rechnung = await service.generateNow(template.id);

            expect(rechnung).not.toBeNull();
            expect(rechnung.netto).toBe(500);
            expect(rechnung.mwst).toBeCloseTo(95, 2);
            expect(rechnung.brutto).toBeCloseTo(595, 2);
            expect(rechnung.status).toBe('offen');
            expect(rechnung.istWiederkehrend).toBe(true);
            expect(rechnung.wiederkehrendeVorlageId).toBe(template.id);
        });

        it('should increment anzahl_erstellt after generation', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            await service.generateNow(template.id);
            expect(service.getTemplate(template.id).anzahl_erstellt).toBe(1);
        });

        it('should accumulate gesamt_umsatz', async () => {
            const { template } = await service.createTemplate(makeTemplateData({ netto_betrag: 300 }));
            await service.generateNow(template.id);
            await service.generateNow(template.id);
            expect(service.getTemplate(template.id).gesamt_umsatz).toBe(600);
        });

        it('should push invoice to storeService.store.rechnungen', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            await service.generateNow(template.id);
            expect(globalThis.storeService.store.rechnungen.length).toBe(1);
            expect(globalThis.storeService.save).toHaveBeenCalled();
        });

        it('should return null if storeService is unavailable', async () => {
            globalThis.storeService = undefined;
            const { template } = await service.createTemplate(makeTemplateData());
            const result = await service.generateNow(template.id);
            expect(result).toBeNull();
        });

        it('should return null for beendet template via generateNow', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            await service.endTemplate(template.id);
            const result = await service.generateNow(template.id);
            expect(result).toBeNull();
        });

        it('should mark template as beendet when max_anzahl is reached', async () => {
            const { template } = await service.createTemplate(makeTemplateData({ max_anzahl: 1 }));
            await service.generateNow(template.id);
            expect(service.getTemplate(template.id).status).toBe('beendet');
            expect(service.getTemplate(template.id).naechste_faelligkeit).toBeNull();
        });

        it('should create default position when positionen is empty', async () => {
            const { template } = await service.createTemplate(makeTemplateData({ positionen: [], bezeichnung: 'SaaS-Abo' }));
            const rechnung = await service.generateNow(template.id);
            expect(rechnung.positionen.length).toBe(1);
            expect(rechnung.positionen[0].beschreibung).toBe('SaaS-Abo');
        });

        it('should call webhookEventService.invoiceCreated if available', async () => {
            globalThis.webhookEventService = { invoiceCreated: vi.fn() };
            const { template } = await service.createTemplate(makeTemplateData());
            await service.generateNow(template.id);
            expect(globalThis.webhookEventService.invoiceCreated).toHaveBeenCalledTimes(1);
        });

        it('should call notificationService.sendTelegram if available', async () => {
            globalThis.notificationService = { sendTelegram: vi.fn() };
            const { template } = await service.createTemplate(makeTemplateData());
            await service.generateNow(template.id);
            expect(globalThis.notificationService.sendTelegram).toHaveBeenCalledTimes(1);
        });

        it('should fall back to notificationService.send when sendTelegram is unavailable', async () => {
            globalThis.notificationService = { send: vi.fn() };
            const { template } = await service.createTemplate(makeTemplateData());
            await service.generateNow(template.id);
            expect(globalThis.notificationService.send).toHaveBeenCalledTimes(1);
        });
    });

    // ── generateDueInvoices ──────────────────────────────────────

    describe('generateDueInvoices', () => {
        beforeEach(() => {
            setupStoreService();
        });

        it('should generate invoices for due templates', async () => {
            const { template } = await service.createTemplate(makeTemplateData({ start_datum: '2020-01-01' }));
            // Force the due date to be in the past
            template.naechste_faelligkeit = '2020-02-01';

            const result = await service.generateDueInvoices();
            expect(result.erstellt).toBe(1);
            expect(result.rechnungen.length).toBe(1);
        });

        it('should skip templates with future naechste_faelligkeit', async () => {
            const { template } = await service.createTemplate(makeTemplateData());
            template.naechste_faelligkeit = '2099-12-31';

            const result = await service.generateDueInvoices();
            expect(result.erstellt).toBe(0);
        });

        it('should skip paused templates', async () => {
            const { template } = await service.createTemplate(makeTemplateData({ start_datum: '2020-01-01' }));
            template.naechste_faelligkeit = '2020-02-01';
            await service.pauseTemplate(template.id);

            const result = await service.generateDueInvoices();
            expect(result.erstellt).toBe(0);
        });

        it('should prevent duplicate generation via sessionStorage', async () => {
            const { template } = await service.createTemplate(makeTemplateData({ start_datum: '2020-01-01' }));
            template.naechste_faelligkeit = '2020-02-01';

            await service.generateDueInvoices();
            // After first generation, the template's naechste_faelligkeit advances.
            // Reset it to simulate another due scenario on the same day:
            template.naechste_faelligkeit = '2020-02-01';
            template.status = 'aktiv';

            const result2 = await service.generateDueInvoices();
            // sessionStorage key prevents duplicate
            expect(result2.erstellt).toBe(0);
        });
    });

    // ── Vorschau (Preview) ───────────────────────────────────────

    describe('getVorschau', () => {
        it('should return preview entries for active templates', async () => {
            await service.createTemplate(makeTemplateData({ netto_betrag: 500, start_datum: '2020-01-01' }));
            const vorschau = service.getVorschau(3);
            expect(vorschau.length).toBeGreaterThan(0);
            expect(vorschau[0].netto_betrag).toBe(500);
            expect(vorschau[0].brutto_betrag).toBeCloseTo(595, 2);
        });

        it('should not include paused templates in preview', async () => {
            const { template } = await service.createTemplate(makeTemplateData({ start_datum: '2020-01-01' }));
            await service.pauseTemplate(template.id);
            const vorschau = service.getVorschau(12);
            expect(vorschau.length).toBe(0);
        });

        it('should sort preview entries by date ascending', async () => {
            await service.createTemplate(makeTemplateData({ start_datum: '2020-01-01' }));
            const vorschau = service.getVorschau(6);
            for (let i = 1; i < vorschau.length; i++) {
                expect(vorschau[i].datum >= vorschau[i - 1].datum).toBe(true);
            }
        });

        it('should default to 12 months when no argument given', async () => {
            // Use a recent start_datum so the preview window is bounded
            const recentStart = new Date();
            recentStart.setMonth(recentStart.getMonth() - 1);
            const startStr = recentStart.toISOString().split('T')[0];
            await service.createTemplate(makeTemplateData({ netto_betrag: 100, start_datum: startStr }));
            const vorschau = service.getVorschau();
            // Monthly template over ~12-13 months from now should produce ~12-13 entries
            expect(vorschau.length).toBeGreaterThanOrEqual(10);
            expect(vorschau.length).toBeLessThanOrEqual(14);
        });
    });

    // ── Helpers: getIntervallName / getStatusName ────────────────

    describe('Helper Name Mappings', () => {
        it('should return correct interval names', () => {
            expect(service.getIntervallName('monatlich')).toBe('Monatlich');
            expect(service.getIntervallName('quartalsweise')).toBe('Quartalsweise');
            expect(service.getIntervallName('jaehrlich')).toBe('Jaehrlich');
            expect(service.getIntervallName('benutzerdefiniert')).toBe('Benutzerdefiniert');
        });

        it('should return raw string for unknown interval', () => {
            expect(service.getIntervallName('weekly')).toBe('weekly');
        });

        it('should return correct status names', () => {
            expect(service.getStatusName('aktiv')).toBe('Aktiv');
            expect(service.getStatusName('pausiert')).toBe('Pausiert');
            expect(service.getStatusName('beendet')).toBe('Beendet');
        });

        it('should return raw string for unknown status', () => {
            expect(service.getStatusName('archiviert')).toBe('archiviert');
        });
    });

    // ── Scheduler: stop ──────────────────────────────────────────

    describe('Scheduler', () => {
        it('should clear interval on stop()', () => {
            service._schedulerInterval = setInterval(() => {}, 100000);
            expect(service._schedulerInterval).not.toBeNull();
            service.stop();
            expect(service._schedulerInterval).toBeNull();
        });

        it('should be safe to call stop() multiple times', () => {
            service.stop();
            service.stop();
            expect(service._schedulerInterval).toBeNull();
        });
    });
});
