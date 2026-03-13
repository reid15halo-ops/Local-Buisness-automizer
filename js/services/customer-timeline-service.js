/* ============================================
   Customer Timeline Service
   Aggregiert den kompletten Kunden-Lebenszyklus:
   Anfrage -> Angebot -> Auftrag -> Rechnung -> Mahnung -> Bezahlt
   ============================================ */

class CustomerTimelineService {
    constructor() {
        this.storeService = null;
        this.dbService = null;
    }

    _getStore() {
        if (!this.storeService) { this.storeService = window.storeService; }
        return this.storeService;
    }

    _getDB() {
        if (!this.dbService) { this.dbService = window.supabaseDBService; }
        return this.dbService;
    }

    /**
     * Lade die komplette Timeline fuer einen Kunden.
     * Datenquellen: leads, angebote, auftraege, rechnungen, mahnungen
     * @param {string} kundeId - Kunden-ID
     * @param {Object} [customer] - Optionales Kundenobjekt (fuer Email-Matching)
     * @returns {Promise<Array>} Chronologisch sortierte Events
     */
    async getTimeline(kundeId, customer) {
        const events = [];

        // Paralleles Laden aus allen Quellen (Rechnungen zuerst, da Mahnungen sie brauchen)
        const results = await Promise.allSettled([
            this._getLeads(kundeId, customer),
            this._getAngebote(kundeId, customer),
            this._getAuftraege(kundeId, customer),
            this._getRechnungen(kundeId, customer)
        ]);
        const [leads, angebote, auftraege, rechnungen] = results.map(r => r.status === 'fulfilled' ? r.value : []);
        // Mahnungen brauchen Rechnungs-IDs — Cache uebergeben um Doppel-Query zu vermeiden
        const mahnungen = await this._getMahnungen(kundeId, rechnungen);

        // Leads -> Events
        for (const lead of leads) {
            events.push({
                datum: lead.createdAt || lead.created_at,
                typ: 'anfrage',
                titel: lead.anforderung || lead.name || 'Anfrage',
                status: this._mapLeadStatus(lead.stage),
                betrag: lead.budget || null,
                id: lead.id,
                icon: 'anfrage',
                quelle: lead.quelle || ''
            });
        }

        // Angebote -> Events
        for (const angebot of angebote) {
            const status = this._mapAngebotStatus(angebot.status);
            events.push({
                datum: angebot.createdAt || angebot.created_at || angebot.datum,
                typ: 'angebot',
                titel: angebot.leistungsart || angebot.titel || 'Angebot ' + (angebot.nummer || ''),
                status: status,
                betrag: angebot.brutto || angebot.netto || null,
                id: angebot.id,
                icon: 'angebot',
                nummer: angebot.nummer || ''
            });
        }

        // Auftraege -> Events
        for (const auftrag of auftraege) {
            events.push({
                datum: auftrag.createdAt || auftrag.created_at || auftrag.datum,
                typ: 'auftrag',
                titel: auftrag.leistungsart || auftrag.titel || 'Auftrag',
                status: this._mapAuftragStatus(auftrag.status),
                betrag: auftrag.brutto || auftrag.netto || null,
                id: auftrag.id,
                icon: 'auftrag',
                nummer: auftrag.nummer || ''
            });
        }

        // Rechnungen -> Events
        for (const rechnung of rechnungen) {
            events.push({
                datum: rechnung.createdAt || rechnung.created_at || rechnung.datum,
                typ: 'rechnung',
                titel: 'Rechnung ' + (rechnung.nummer || ''),
                status: this._mapRechnungStatus(rechnung.status),
                betrag: rechnung.brutto || rechnung.netto || null,
                id: rechnung.id,
                icon: 'rechnung',
                nummer: rechnung.nummer || '',
                faelligkeitsdatum: rechnung.faelligkeitsdatum || null
            });

            // Wenn bezahlt, zusaetzlichen "Bezahlt"-Event erstellen
            if (rechnung.status === 'bezahlt') {
                events.push({
                    datum: rechnung.bezahltAm || rechnung.bezahlt_am || rechnung.aktualisiertAm || rechnung.updated_at || rechnung.createdAt || rechnung.created_at,
                    typ: 'bezahlt',
                    titel: 'Zahlung erhalten - ' + (rechnung.nummer || ''),
                    status: 'abgeschlossen',
                    betrag: rechnung.brutto || rechnung.netto || null,
                    id: rechnung.id,
                    icon: 'bezahlt',
                    nummer: rechnung.nummer || ''
                });
            }
        }

        // Mahnungen -> Events
        for (const mahnung of mahnungen) {
            events.push({
                datum: mahnung.createdAt || mahnung.created_at || mahnung.datum,
                typ: 'mahnung',
                titel: mahnung.typ ? this._mapMahnungTyp(mahnung.typ) : 'Mahnung',
                status: 'ueberfaellig',
                betrag: mahnung.betrag || null,
                id: mahnung.id,
                icon: 'mahnung',
                rechnungId: mahnung.rechnungId || mahnung.rechnung_id || null
            });
        }

        // Chronologisch sortieren (aelteste zuerst)
        events.sort((a, b) => {
            const dA = a.datum ? new Date(a.datum).getTime() : 0;
            const dB = b.datum ? new Date(b.datum).getTime() : 0;
            return dA - dB;
        });

        return events;
    }

    // ---- Datenquellen ----

    async _getLeads(kundeId, customer) {
        // Versuche aus localStorage (lead-service)
        const leads = [];

        if (window.leadService) {
            const allLeads = window.leadService.leads || [];
            for (const lead of allLeads) {
                if (lead.kundeId === kundeId || lead.kunde_id === kundeId) {
                    leads.push(lead);
                    continue;
                }
                // Email-Matching
                if (customer && customer.email && lead.email &&
                    lead.email.toLowerCase() === customer.email.toLowerCase()) {
                    leads.push(lead);
                }
            }
        }

        // Zusaetzlich aus Supabase
        const db = this._getDB();
        if (db && db.isOnline()) {
            try {
                const emailSafe = customer?.email?.match(/^[^,()]+@[^,()]+$/) ? customer.email : null;
                const { data } = await db.getClient()
                    .from('leads')
                    .select('*')
                    .or(`kunde_id.eq.${kundeId}${emailSafe ? ',email.ilike.' + emailSafe : ''}`)
                    .order('created_at', { ascending: true });
                if (data) {
                    const existingIds = new Set(leads.map(l => l.id));
                    for (const d of data) {
                        if (!existingIds.has(d.id)) { leads.push(d); }
                    }
                }
            } catch (e) { console.warn('[CustomerTimeline] Leads Supabase error:', e.message); }
        }

        return leads;
    }

    async _getAngebote(kundeId, customer) {
        const store = this._getStore();
        const kundeName = customer?.name || '';
        const local = (store?.store?.angebote || []).filter(a =>
            a.kundeId === kundeId || a.kunde_id === kundeId ||
            a.kunde?.id === kundeId || a.kunde?.name === kundeName ||
            a.kunde_name === kundeName
        );

        const db = this._getDB();
        if (db && db.isOnline() && kundeName) {
            try {
                const { data } = await db.getClient()
                    .from('angebote')
                    .select('*')
                    .eq('kunde_name', kundeName)
                    .order('created_at', { ascending: true });
                if (data) {
                    const existingIds = new Set(local.map(a => a.id));
                    for (const d of data) {
                        if (!existingIds.has(d.id)) { local.push(d); }
                    }
                }
            } catch (e) { console.warn('[CustomerTimeline] Angebote Supabase error:', e.message); }
        }

        return local;
    }

    async _getAuftraege(kundeId, customer) {
        const store = this._getStore();
        const kundeName = customer?.name || '';
        const local = (store?.store?.auftraege || []).filter(a =>
            a.kundeId === kundeId || a.kunde_id === kundeId ||
            a.kunde?.id === kundeId || a.kunde?.name === kundeName ||
            a.kunde_name === kundeName
        );

        const db = this._getDB();
        if (db && db.isOnline() && kundeName) {
            try {
                const { data } = await db.getClient()
                    .from('auftraege')
                    .select('*')
                    .eq('kunde_name', kundeName)
                    .order('created_at', { ascending: true });
                if (data) {
                    const existingIds = new Set(local.map(a => a.id));
                    for (const d of data) {
                        if (!existingIds.has(d.id)) { local.push(d); }
                    }
                }
            } catch (e) { console.warn('[CustomerTimeline] Auftraege Supabase error:', e.message); }
        }

        return local;
    }

    async _getRechnungen(kundeId, customer) {
        const store = this._getStore();
        const kundeName = customer?.name || '';
        const local = (store?.store?.rechnungen || []).filter(r =>
            r.kundeId === kundeId || r.kunde_id === kundeId ||
            r.kunde?.id === kundeId || r.kunde?.name === kundeName ||
            r.kunde_name === kundeName
        );

        const db = this._getDB();
        if (db && db.isOnline() && kundeName) {
            try {
                const { data } = await db.getClient()
                    .from('rechnungen')
                    .select('*')
                    .eq('kunde_name', kundeName)
                    .order('created_at', { ascending: true });
                if (data) {
                    const existingIds = new Set(local.map(r => r.id));
                    for (const d of data) {
                        if (!existingIds.has(d.id)) { local.push(d); }
                    }
                }
            } catch (e) { console.warn('[CustomerTimeline] Rechnungen Supabase error:', e.message); }
        }

        return local;
    }

    async _getMahnungen(kundeId, rechnungenCache) {
        // Mahnungen sind im dunningService gespeichert
        const mahnungen = [];

        // Rechnungen wiederverwenden falls schon geladen (vermeidet Doppel-Query)
        const rechnungen = rechnungenCache || await this._getRechnungen(kundeId);

        if (window.dunningService) {
            const allMahnungen = window.dunningService.mahnungen || [];
            // Mahnungen sind an Rechnungen gebunden, wir muessen ueber Rechnungen filtern
            const rechnungIds = new Set(rechnungen.map(r => r.id));

            for (const m of allMahnungen) {
                if (rechnungIds.has(m.rechnungId) || rechnungIds.has(m.rechnung_id)) {
                    mahnungen.push(m);
                }
            }
        }

        // Zusaetzlich aus Supabase (nutze bereits geladene Rechnungs-IDs statt erneuter Query)
        const db = this._getDB();
        if (db && db.isOnline()) {
            try {
                const rIds = rechnungen.map(r => r.id).filter(Boolean);
                if (rIds.length > 0) {
                    const { data } = await db.getClient()
                        .from('mahnungen')
                        .select('*')
                        .in('rechnung_id', rIds)
                        .order('created_at', { ascending: true });
                    if (data) {
                        const existingIds = new Set(mahnungen.map(m => m.id));
                        for (const d of data) {
                            if (!existingIds.has(d.id)) { mahnungen.push(d); }
                        }
                    }
                }
            } catch (e) { console.warn('[CustomerTimeline] Mahnungen Supabase error:', e.message); }
        }

        return mahnungen;
    }

    // ---- Status-Mapping ----

    _mapLeadStatus(stage) {
        if (!stage) { return 'offen'; }
        if (stage === 'gewonnen') { return 'abgeschlossen'; }
        if (stage === 'verloren') { return 'abgeschlossen'; }
        return 'offen';
    }

    _mapAngebotStatus(status) {
        if (!status) { return 'offen'; }
        const s = status.toLowerCase();
        if (s === 'angenommen' || s === 'akzeptiert') { return 'abgeschlossen'; }
        if (s === 'abgelehnt') { return 'abgeschlossen'; }
        if (s === 'versendet' || s === 'offen') { return 'offen'; }
        return 'offen';
    }

    _mapAuftragStatus(status) {
        if (!status) { return 'offen'; }
        const s = status.toLowerCase();
        if (s === 'abgeschlossen' || s === 'fertig' || s === 'erledigt') { return 'abgeschlossen'; }
        if (s === 'in_arbeit' || s === 'laufend' || s === 'in bearbeitung') { return 'offen'; }
        if (s === 'geplant' || s === 'neu') { return 'geplant'; }
        return 'offen';
    }

    _mapRechnungStatus(status) {
        if (!status) { return 'offen'; }
        const s = status.toLowerCase();
        if (s === 'bezahlt') { return 'abgeschlossen'; }
        if (s === 'ueberfaellig' || s === 'überfällig') { return 'ueberfaellig'; }
        if (s === 'storniert') { return 'abgeschlossen'; }
        return 'offen';
    }

    _mapMahnungTyp(typ) {
        const map = {
            'erinnerung': 'Zahlungserinnerung',
            'mahnung1': '1. Mahnung',
            'mahnung2': '2. Mahnung',
            'mahnung3': '3. Mahnung',
            'inkasso': 'Inkasso-Uebergabe'
        };
        return map[typ] || 'Mahnung';
    }

    /**
     * Zusammenfassung des Kunden-Lebenszyklus
     * @param {string} kundeId
     * @returns {Promise<Object>} { phase, fortschritt, offeneBetrag, gesamtUmsatz }
     */
    async getLifecycleSummary(kundeId) {
        const events = await this.getTimeline(kundeId);

        const phasen = ['anfrage', 'angebot', 'auftrag', 'rechnung', 'bezahlt'];
        let hoechstePhase = -1;
        let offenerBetrag = 0;
        let gesamtUmsatz = 0;

        for (const e of events) {
            const idx = phasen.indexOf(e.typ);
            if (idx > hoechstePhase) { hoechstePhase = idx; }
            if (e.typ === 'bezahlt' && e.betrag) { gesamtUmsatz += e.betrag; }
            if (e.typ === 'rechnung' && e.status === 'offen' && e.betrag) { offenerBetrag += e.betrag; }
        }

        return {
            phase: hoechstePhase >= 0 ? phasen[hoechstePhase] : 'keine',
            fortschritt: hoechstePhase >= 0 ? Math.round(((hoechstePhase + 1) / phasen.length) * 100) : 0,
            offenerBetrag,
            gesamtUmsatz,
            anzahlEvents: events.length
        };
    }
}

window.customerTimelineService = new CustomerTimelineService();
