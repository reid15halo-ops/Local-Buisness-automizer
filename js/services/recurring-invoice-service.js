/* ============================================
   Recurring Invoice Service
   Wiederkehrende Rechnungen (Retainer, SaaS-Abos)
   Automatische Rechnungserstellung nach Intervall
   Supabase-first — Tabelle: recurring_invoice_templates
   ============================================ */

class RecurringInvoiceService {
    constructor() {
        this._ready = false;
        this.templates = [];
        this._userId = null;
        this._tenantId = 'a0000000-0000-0000-0000-000000000001';
        this._schedulerInterval = null;
        window.addEventListener('beforeunload', () => this.stop());
    }

    // ── Initialisation (bookkeeping-service pattern) ────────────

    async init() {
        if (this._ready) return;
        try {
            const { data } = await this._supabase()?.auth?.getUser() || {};
            this._userId = data?.user?.id || '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc';
        } catch {
            this._userId = '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc';
        }
        await this._loadFromSupabase();
        this._ready = true;
        this._startScheduler();
        console.log('[RecurringInvoice] Initialised - ' + this.templates.length + ' templates loaded');
    }

    _supabase() {
        return window.supabaseClient?.client;
    }

    _isOnline() {
        return !!(this._supabase() && window.supabaseClient?.isConfigured());
    }

    // ── Supabase row mapping ────────────────────────────────────

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
        var positionen = r.positionen || [];
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

    // ── Supabase persistence ────────────────────────────────────

    async _loadFromSupabase() {
        if (!this._isOnline()) {
            this._loadLocal();
            return;
        }
        try {
            var result = await this._supabase()
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
        if (!this._isOnline()) return;
        try {
            var row = this._toRow(template);
            var result = await this._supabase()
                .from('recurring_invoice_templates')
                .upsert(row, { onConflict: 'id' });
            if (result.error) console.error('[RecurringInvoice] Supabase upsert error:', result.error.message);
        } catch (err) {
            console.error('[RecurringInvoice] Supabase upsert failed:', err.message);
        }
    }

    async _deleteFromSupabase(id) {
        if (!this._isOnline()) return;
        try {
            var result = await this._supabase()
                .from('recurring_invoice_templates')
                .delete()
                .eq('id', id)
                .eq('tenant_id', this._tenantId);
            if (result.error) console.error('[RecurringInvoice] Supabase delete error:', result.error.message);
        } catch (err) {
            console.error('[RecurringInvoice] Supabase delete failed:', err.message);
        }
    }

    _loadLocal() {
        try { this.templates = JSON.parse(localStorage.getItem('freyai_recurring_inv_templates') || '[]'); } catch { this.templates = []; }
    }

    _saveLocal() {
        try { localStorage.setItem('freyai_recurring_inv_templates', JSON.stringify(this.templates)); } catch { /* quota */ }
    }

    // ── CRUD: Templates ─────────────────────────────────────────

    async createTemplate(data) {
        await this._ensureReady();

        var template = {
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
        var tpl = this.templates.find(function(t) { return t.id === id; });
        if (!tpl) return { success: false, error: 'Template nicht gefunden' };

        var safeCopy = Object.assign({}, changes);
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
        var tpl = this.templates.find(function(t) { return t.id === id; });
        if (!tpl) return { success: false, error: 'Template nicht gefunden' };

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
        var idx = this.templates.findIndex(function(t) { return t.id === id; });
        if (idx === -1) return { success: false, error: 'Template nicht gefunden' };

        this.templates.splice(idx, 1);
        this._saveLocal();
        await this._deleteFromSupabase(id);
        return { success: true };
    }

    getTemplates(filter) {
        filter = filter || {};
        var result = this.templates.slice();
        if (filter.status) result = result.filter(function(t) { return t.status === filter.status; });
        if (filter.kunde_id) result = result.filter(function(t) { return t.kunde_id === filter.kunde_id; });
        return result.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    }

    getTemplate(id) {
        return this.templates.find(function(t) { return t.id === id; }) || null;
    }

    // ── Rechnungsgenerierung ────────────────────────────────────

    async generateDueInvoices() {
        await this._ensureReady();
        var heute = new Date().toISOString().split('T')[0];
        var erstellte = [];

        for (var i = 0; i < this.templates.length; i++) {
            var tpl = this.templates[i];
            if (tpl.status !== 'aktiv' || !tpl.naechste_faelligkeit) continue;
            if (tpl.naechste_faelligkeit > heute) continue;

            var dupKey = 'rit_gen_' + tpl.id + '_' + heute;
            if (sessionStorage.getItem(dupKey)) continue;

            var rechnung = await this._generiereRechnung(tpl);
            if (rechnung) {
                erstellte.push(rechnung);
                sessionStorage.setItem(dupKey, '1');
            }
        }

        if (erstellte.length > 0) {
            console.log('[RecurringInvoice] ' + erstellte.length + ' Rechnung(en) automatisch erstellt');
        }

        return { erstellt: erstellte.length, rechnungen: erstellte };
    }

    async generateNow(id) {
        await this._ensureReady();
        var tpl = this.templates.find(function(t) { return t.id === id; });
        if (!tpl || tpl.status === 'beendet') return null;
        return this._generiereRechnung(tpl);
    }

    async _generiereRechnung(tpl) {
        var storeService = window.storeService;
        if (!storeService || !storeService.store || !storeService.store.rechnungen) {
            console.warn('[RecurringInvoice] StoreService nicht verfuegbar');
            return null;
        }

        try {
            var mwst = Math.round(tpl.netto_betrag * tpl.steuersatz * 100) / 100;
            var brutto = Math.round((tpl.netto_betrag + mwst) * 100) / 100;
            var heute = new Date().toISOString().split('T')[0];
            var faellig = this._addTage(heute, tpl.zahlungsziel_tage);

            var nummer = 'RE-ABO-' + Date.now();
            if (window.invoiceNumberingService) {
                try {
                    var userId = (storeService.getCurrentUserId && storeService.getCurrentUserId()) || 'default';
                    nummer = await window.invoiceNumberingService.generateNumber(userId);
                } catch (e) {
                    console.warn('[RecurringInvoice] Nummernfallback', e);
                }
            }

            var aboVermerk = 'Auto-generiert aus Abo "' + (tpl.bezeichnung || '') + '"';

            var rechnung = {
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

            if (window.webhookEventService && window.webhookEventService.invoiceCreated) {
                window.webhookEventService.invoiceCreated(rechnung);
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

    // ── Datumsberechnung ────────────────────────────────────────

    _berechneNaechstesDatum(tpl) {
        var basis;

        if (tpl.letzte_rechnung) {
            basis = new Date(tpl.letzte_rechnung);
        } else if (tpl.start_datum) {
            var start = new Date(tpl.start_datum);
            var heute = new Date();
            heute.setHours(0, 0, 0, 0);
            if (start >= heute) return tpl.start_datum;
            basis = start;
        } else {
            basis = new Date();
        }

        var naechstes = new Date(basis);

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
            var maxTag = new Date(naechstes.getFullYear(), naechstes.getMonth() + 1, 0).getDate();
            naechstes.setDate(Math.min(tpl.tag_im_monat, maxTag));
        }

        var ergebnis = naechstes.toISOString().split('T')[0];

        if (tpl.end_datum && ergebnis > tpl.end_datum) return null;
        if (tpl.max_anzahl && tpl.anzahl_erstellt >= tpl.max_anzahl) return null;

        return ergebnis;
    }

    _addTage(datumStr, tage) {
        var d = new Date(datumStr);
        d.setDate(d.getDate() + tage);
        return d.toISOString().split('T')[0];
    }

    // ── Statistiken & Vorschau ──────────────────────────────────

    getStatistiken() {
        var aktive = this.templates.filter(function(t) { return t.status === 'aktiv'; });

        var mrr = aktive.reduce(function(sum, t) {
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
        var vorschau = [];
        var endDatum = new Date();
        endDatum.setMonth(endDatum.getMonth() + monate);
        var endStr = endDatum.toISOString().split('T')[0];

        var aktiveTpls = this.templates.filter(function(t) { return t.status === 'aktiv'; });
        for (var i = 0; i < aktiveTpls.length; i++) {
            var tpl = aktiveTpls[i];
            var temp = Object.assign({}, tpl);
            var naechstes = temp.naechste_faelligkeit;

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

    // ── Hilfsfunktionen ─────────────────────────────────────────

    getIntervallName(intervall) {
        var namen = {
            'monatlich': 'Monatlich',
            'quartalsweise': 'Quartalsweise',
            'jaehrlich': 'Jaehrlich',
            'benutzerdefiniert': 'Benutzerdefiniert'
        };
        return namen[intervall] || intervall;
    }

    getStatusName(status) {
        var namen = { 'aktiv': 'Aktiv', 'pausiert': 'Pausiert', 'beendet': 'Beendet' };
        return namen[status] || status;
    }

    // ── Benachrichtigungen ──────────────────────────────────────

    _benachrichtigen(tpl, rechnung) {
        var betragStr = (parseFloat(rechnung.brutto) || 0).toFixed(2);
        if (window.notificationService && window.notificationService.sendTelegram) {
            var msg = [
                '📄 Abo-Rechnung erstellt',
                'Kunde: ' + tpl.kunde_name,
                'Rechnung: ' + rechnung.nummer,
                'Betrag: ' + betragStr + ' EUR (brutto)',
                'Naechste: ' + (tpl.naechste_faelligkeit || 'Keine (beendet)')
            ].join('\n');
            window.notificationService.sendTelegram(msg);
        } else if (window.notificationService && window.notificationService.send) {
            window.notificationService.send(
                'Abo-Rechnung erstellt',
                rechnung.nummer + ' - ' + tpl.kunde_name + ': ' + betragStr + ' EUR'
            );
        }
    }

    // ── Scheduler ───────────────────────────────────────────────

    _startScheduler() {
        var self = this;
        setTimeout(function() { self.generateDueInvoices(); }, 10000);
        this._schedulerInterval = setInterval(function() { self.generateDueInvoices(); }, 6 * 60 * 60 * 1000);
    }

    stop() {
        if (this._schedulerInterval) {
            clearInterval(this._schedulerInterval);
            this._schedulerInterval = null;
        }
    }

    async _ensureReady() {
        if (!this._ready) await this.init();
    }
}

window.recurringInvoiceService = new RecurringInvoiceService();
