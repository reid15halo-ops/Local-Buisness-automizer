/* ============================================================
   FreyAI Core — Store Service (Supabase Cloud-First)
   ============================================================
   Centralized state management backed by Supabase PostgreSQL.
   Replaces the legacy IndexedDB/localStorage persistence layer.

   Public API (backward-compatible with app.js):
     .state              — in-memory store object
     .load()             — fetch all data from Supabase into .state
     .save()             — upsert dirty data back to Supabase
     .login(email, pw)   — Supabase Auth sign-in
     .logout()           — Supabase Auth sign-out
     .getUser()          — current Supabase user or null
     .addAnfrage(obj)    — insert inquiry
     .addAngebot(obj)    — insert quote
     .acceptAngebot(id)  — convert quote → order
     .updateAuftrag(…)   — patch order
     .completeAuftrag(…) — close order → create invoice
     .addActivity(…)     — push activity log entry
     .generateId(prefix) — local ID generator
     .subscribe(cb)      — register change listener
   ============================================================ */

class StoreService {
    constructor() {
        /** @type {boolean} Whether the Supabase client is available */
        this._supabaseReady = !!window.freyaiSupabase;

        /**
         * In-memory store — same shape the UI expects.
         * Populated by load(), mutated by actions, synced by save().
         */
        this.store = {
            anfragen: [],
            angebote: [],
            auftraege: [],
            rechnungen: [],
            activities: [],
            settings: {
                companyName: '',
                owner: '',
                address: '',
                taxId: '',
                vatId: '',
                theme: 'dark'
            },
            currentAnfrageId: null,
            currentAuftragId: null,
            currentRechnungId: null
        };

        /** @type {Function[]} */
        this.subscribers = [];

        /** @type {string|null} */
        this.currentUserId = null;

        /**
         * Tables that are synced between the in-memory store and Supabase.
         * Key = store property name, Value = Supabase table name.
         * @type {Record<string, string>}
         */
        this._tableMap = {
            anfragen: 'anfragen',
            angebote: 'angebote',
            auftraege: 'auftraege',
            rechnungen: 'rechnungen'
        };
    }

    /* ==========================================================
       Supabase helpers
       ========================================================== */

    /**
     * Returns the Supabase client or null.
     * @returns {import('@supabase/supabase-js').SupabaseClient | null}
     */
    _sb() {
        return window.freyaiSupabase || null;
    }

    /**
     * Returns true when the Supabase client is initialised AND a user
     * session exists (required for RLS).
     * @returns {boolean}
     */
    _isOnline() {
        return !!(this._sb() && this.currentUserId);
    }

    /* ==========================================================
       Auth
       ========================================================== */

    /**
     * Sign in with email + password via Supabase Auth.
     * On success, populates the store for that user.
     *
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{user: object|null, error: string|null}>}
     */
    async login(email, password) {
        const sb = this._sb();
        if (!sb) {
            return { user: null, error: 'Supabase not configured.' };
        }

        const { data, error } = await sb.auth.signInWithPassword({ email, password });

        if (error) {
            console.error('[FreyAI] Login failed:', error.message);
            return { user: null, error: error.message };
        }

        this.currentUserId = data.user.id;
        await this.load();
        console.info('[FreyAI] Logged in as', email);
        return { user: data.user, error: null };
    }

    /**
     * Sign out the current user and clear the in-memory store.
     * @returns {Promise<void>}
     */
    async logout() {
        const sb = this._sb();
        if (sb) {
            await sb.auth.signOut();
        }
        this.currentUserId = null;
        this._clearStore();
        this.notify();
        console.info('[FreyAI] Logged out.');
    }

    /**
     * Returns the current Supabase user object, or null.
     * @returns {Promise<object|null>}
     */
    async getUser() {
        const sb = this._sb();
        if (!sb) return null;
        const { data } = await sb.auth.getUser();
        return data?.user || null;
    }

    /* ==========================================================
       Load — Supabase → in-memory store
       ========================================================== */

    /**
     * Main load entry-point.
     * Tries to restore an existing Supabase session first, then
     * fetches all relevant tables into the in-memory store.
     * Falls back to demo data when no Supabase connection exists.
     */
    async load() {
        const sb = this._sb();

        // Try to restore an existing session
        if (sb && !this.currentUserId) {
            const { data } = await sb.auth.getSession();
            if (data?.session?.user) {
                this.currentUserId = data.session.user.id;
            }
        }

        if (this._isOnline()) {
            await this._fetchAllFromSupabase();
        } else {
            // No Supabase connection — load demo data so the UI isn't empty
            console.warn('[FreyAI] No Supabase session. Loading demo data.');
            await this.resetToDemo();
        }

        this.notify();
    }

    /**
     * Alias kept for backward compatibility with app.js callers.
     * @param {string} userId
     */
    async loadForUser(userId) {
        this.currentUserId = userId;
        await this.load();
    }

    /**
     * Fetches all Supabase tables into the in-memory store.
     * @private
     */
    async _fetchAllFromSupabase() {
        const sb = this._sb();

        // Fetch core business tables in parallel
        const [anfragenRes, angeboteRes, auftraegeRes, rechnungenRes, profileRes] =
            await Promise.all([
                sb.from('anfragen').select('*').order('created_at', { ascending: false }),
                sb.from('angebote').select('*').order('created_at', { ascending: false }),
                sb.from('auftraege').select('*').order('created_at', { ascending: false }),
                sb.from('rechnungen').select('*').order('created_at', { ascending: false }),
                sb.from('profiles').select('*').eq('id', this.currentUserId).single()
            ]);

        // Map DB rows → store arrays (snake_case → camelCase where needed)
        this.store.anfragen = (anfragenRes.data || []).map(r => this._mapAnfrageFromDB(r));
        this.store.angebote = (angeboteRes.data || []).map(r => this._mapAngebotFromDB(r));
        this.store.auftraege = (auftraegeRes.data || []).map(r => this._mapAuftragFromDB(r));
        this.store.rechnungen = (rechnungenRes.data || []).map(r => this._mapRechnungFromDB(r));

        // Profile → settings
        if (profileRes.data) {
            const p = profileRes.data;
            const extra = p.settings_json || {};
            this.store.settings = {
                companyName: p.business_name || p.company_name || '',
                owner: p.full_name || '',
                address: p.address || '',
                taxId: p.tax_id || '',
                vatId: p.vat_id || extra.vatId || '',
                phone: p.phone || '',
                email: extra.email || '',
                theme: extra.theme || 'dark'
            };
        }

        // Activities are kept client-side only (lightweight, non-critical)
        // They will be empty on a fresh session; the UI handles that gracefully.

        console.info(
            `[FreyAI] Loaded from Supabase — ` +
            `${this.store.anfragen.length} anfragen, ` +
            `${this.store.angebote.length} angebote, ` +
            `${this.store.auftraege.length} auftraege, ` +
            `${this.store.rechnungen.length} rechnungen`
        );
    }

    /* ==========================================================
       Save — in-memory store → Supabase
       ========================================================== */

    /**
     * Persists the current in-memory store back to Supabase.
     * Called after every mutation (same contract as the old IndexedDB save).
     */
    async save() {
        if (!this._isOnline()) {
            // Not connected — changes stay in memory only
            this.notify();
            return;
        }

        try {
            const sb = this._sb();

            // Upsert each table's data
            const upsertOps = Object.entries(this._tableMap).map(([storeKey, tableName]) => {
                const rows = this.store[storeKey].map(item =>
                    this._mapToDB(storeKey, item)
                );
                if (rows.length === 0) return Promise.resolve();
                return sb.from(tableName).upsert(rows, { onConflict: 'id' });
            });

            // Upsert profile/settings
            upsertOps.push(
                sb.from('profiles').upsert({
                    id: this.currentUserId,
                    business_name: this.store.settings.companyName,
                    full_name: this.store.settings.owner,
                    address: this.store.settings.address,
                    tax_id: this.store.settings.taxId,
                    vat_id: this.store.settings.vatId,
                    phone: this.store.settings.phone || '',
                    settings_json: {
                        email: this.store.settings.email || '',
                        theme: this.store.settings.theme || 'dark',
                        vatId: this.store.settings.vatId || ''
                    }
                }, { onConflict: 'id' })
            );

            await Promise.all(upsertOps);
            this.notify();
        } catch (e) {
            console.error('[FreyAI] Save failed:', e);
            if (window.errorHandler) {
                window.errorHandler.error('Fehler beim Speichern der Daten.');
            }
            // Still notify so the UI stays in sync with in-memory state
            this.notify();
        }
    }

    /* ==========================================================
       Row mapping helpers (DB ↔ JS)
       ========================================================== */

    /**
     * Maps a DB anfrage row to the JS object shape the UI expects.
     * @param {Object} row - Supabase row
     * @returns {Object}
     */
    _mapAnfrageFromDB(row) {
        return {
            id: row.id,
            kunde: {
                name: row.kunde_name || '',
                email: row.kunde_email || '',
                telefon: row.kunde_telefon || ''
            },
            leistungsart: row.leistungsart || '',
            beschreibung: row.beschreibung || '',
            budget: parseFloat(row.budget) || 0,
            termin: row.termin || '',
            status: row.status || 'neu',
            createdAt: row.created_at
        };
    }

    /**
     * Maps a DB angebot row to JS.
     * @param {Object} row
     * @returns {Object}
     */
    _mapAngebotFromDB(row) {
        return {
            id: row.id,
            anfrageId: row.anfrage_id || null,
            kunde: {
                name: row.kunde_name || '',
                email: row.kunde_email || '',
                telefon: row.kunde_telefon || ''
            },
            leistungsart: row.leistungsart || '',
            positionen: row.positionen || [],
            angebotsText: row.angebots_text || '',
            netto: parseFloat(row.netto) || 0,
            mwst: parseFloat(row.mwst) || 0,
            brutto: parseFloat(row.brutto) || 0,
            status: row.status || 'offen',
            gueltigBis: row.gueltig_bis || '',
            createdAt: row.created_at
        };
    }

    /**
     * Maps a DB auftrag row to JS.
     * @param {Object} row
     * @returns {Object}
     */
    _mapAuftragFromDB(row) {
        return {
            id: row.id,
            angebotId: row.angebot_id || null,
            kunde: {
                name: row.kunde_name || '',
                email: row.kunde_email || '',
                telefon: row.kunde_telefon || ''
            },
            leistungsart: row.leistungsart || '',
            positionen: row.positionen || [],
            angebotsWert: parseFloat(row.angebots_wert) || 0,
            netto: parseFloat(row.netto) || 0,
            mwst: parseFloat(row.mwst) || 0,
            arbeitszeit: parseFloat(row.arbeitszeit) || 0,
            materialKosten: parseFloat(row.material_kosten) || 0,
            notizen: row.notizen || '',
            status: row.status || 'aktiv',
            createdAt: row.created_at,
            completedAt: row.completed_at || null,
            // Client-side-only fields (not persisted in DB columns)
            fortschritt: 0,
            mitarbeiter: [],
            startDatum: null,
            endDatum: null,
            checkliste: [],
            kommentare: [],
            historie: []
        };
    }

    /**
     * Maps a DB rechnung row to JS.
     * @param {Object} row
     * @returns {Object}
     */
    _mapRechnungFromDB(row) {
        return {
            id: row.id,
            auftragId: row.auftrag_id || null,
            kunde: {
                name: row.kunde_name || '',
                email: row.kunde_email || '',
                telefon: row.kunde_telefon || ''
            },
            leistungsart: row.leistungsart || '',
            positionen: row.positionen || [],
            arbeitszeit: parseFloat(row.arbeitszeit) || 0,
            materialKosten: parseFloat(row.material_kosten) || 0,
            netto: parseFloat(row.netto) || 0,
            mwst: parseFloat(row.mwst) || 0,
            brutto: parseFloat(row.brutto) || 0,
            status: row.status || 'offen',
            datum: row.created_at,
            faelligkeitsdatum: row.zahlungsziel_tage
                ? new Date(new Date(row.created_at).getTime() + row.zahlungsziel_tage * 86400000).toISOString()
                : '',
            createdAt: row.created_at,
            paidAt: row.paid_at || null
        };
    }

    /**
     * Maps a JS store object back to a DB row for upsert.
     * @param {string} storeKey - e.g. 'anfragen'
     * @param {Object} item     - JS object
     * @returns {Object} DB-shaped row
     */
    _mapToDB(storeKey, item) {
        const base = { id: item.id, user_id: this.currentUserId };

        switch (storeKey) {
            case 'anfragen':
                return {
                    ...base,
                    kunde_name: item.kunde?.name || '',
                    kunde_email: item.kunde?.email || '',
                    kunde_telefon: item.kunde?.telefon || '',
                    leistungsart: item.leistungsart || '',
                    beschreibung: item.beschreibung || '',
                    budget: item.budget || 0,
                    termin: item.termin || null,
                    status: item.status || 'neu'
                };

            case 'angebote':
                return {
                    ...base,
                    anfrage_id: item.anfrageId || null,
                    kunde_name: item.kunde?.name || '',
                    kunde_email: item.kunde?.email || '',
                    kunde_telefon: item.kunde?.telefon || '',
                    leistungsart: item.leistungsart || '',
                    positionen: item.positionen || [],
                    angebots_text: item.angebotsText || '',
                    netto: item.netto || 0,
                    mwst: item.mwst || 0,
                    brutto: item.brutto || 0,
                    status: item.status || 'offen',
                    gueltig_bis: item.gueltigBis || null
                };

            case 'auftraege':
                return {
                    ...base,
                    angebot_id: item.angebotId || null,
                    kunde_name: item.kunde?.name || '',
                    kunde_email: item.kunde?.email || '',
                    kunde_telefon: item.kunde?.telefon || '',
                    leistungsart: item.leistungsart || '',
                    positionen: item.positionen || [],
                    angebots_wert: item.angebotsWert || 0,
                    netto: item.netto || 0,
                    mwst: item.mwst || 0,
                    arbeitszeit: item.arbeitszeit || null,
                    material_kosten: item.materialKosten || null,
                    notizen: item.notizen || '',
                    status: item.status || 'aktiv',
                    completed_at: item.completedAt || null
                };

            case 'rechnungen':
                return {
                    ...base,
                    auftrag_id: item.auftragId || null,
                    kunde_name: item.kunde?.name || '',
                    kunde_email: item.kunde?.email || '',
                    kunde_telefon: item.kunde?.telefon || '',
                    leistungsart: item.leistungsart || '',
                    positionen: item.positionen || [],
                    arbeitszeit: item.arbeitszeit || null,
                    material_kosten: item.materialKosten || null,
                    netto: item.netto || 0,
                    mwst: item.mwst || 0,
                    brutto: item.brutto || 0,
                    status: item.status || 'offen',
                    paid_at: item.paidAt || null
                };

            default:
                return { ...base, ...item };
        }
    }

    /* ==========================================================
       Store management
       ========================================================== */

    /** @returns {Object} The in-memory store (read-only recommended). */
    get state() {
        return this.store;
    }

    /**
     * Clears the in-memory store arrays to defaults.
     * @private
     */
    _clearStore() {
        this.store.anfragen = [];
        this.store.angebote = [];
        this.store.auftraege = [];
        this.store.rechnungen = [];
        this.store.activities = [];
        this.store.currentAnfrageId = null;
        this.store.currentAuftragId = null;
        this.store.currentRechnungId = null;
    }

    /**
     * Hard reset to demo data (offline fallback).
     */
    async resetToDemo() {
        if (!window.demoDataService) {
            console.error('[FreyAI] DemoDataService not loaded!');
            return;
        }

        const demoData = window.demoDataService.getDemoData();

        Object.keys(this.store).forEach(key => {
            if (Array.isArray(this.store[key])) {
                this.store[key] = [];
            }
        });

        Object.assign(this.store, demoData, {
            currentAnfrageId: null,
            currentAuftragId: null,
            currentRechnungId: null
        });

        console.info('[FreyAI] Store reset to demo data.');
    }

    /* ==========================================================
       Actions (same public API as legacy StoreService)
       ========================================================== */

    /**
     * Adds a new Inquiry.
     * @param {Object} anfrage
     */
    addAnfrage(anfrage) {
        this.store.anfragen.push(anfrage);
        this._insertRow('anfragen', anfrage);
        this.addActivity('📥', `Neue Anfrage von ${anfrage.kunde.name}`);
    }

    /**
     * Adds a new Quote and updates the linked Inquiry status.
     * @param {Object} angebot
     */
    addAngebot(angebot) {
        this.store.angebote.push(angebot);

        const anfrage = this.store.anfragen.find(a => a.id === angebot.anfrageId);
        if (anfrage) {
            anfrage.status = 'angebot-erstellt';
            this._updateRow('anfragen', anfrage.id, { status: 'angebot-erstellt' });
        }

        this._insertRow('angebote', angebot);
        this.addActivity('📝', `Angebot ${angebot.id} für ${angebot.kunde.name} erstellt`);
    }

    /**
     * Accepts a Quote → creates an Order.
     * @param {string} angebotId
     * @returns {Object|null}
     */
    acceptAngebot(angebotId) {
        const angebot = this.store.angebote.find(a => a.id === angebotId);
        if (!angebot) return null;

        angebot.status = 'angenommen';
        this._updateRow('angebote', angebotId, { status: 'angenommen' });

        const auftrag = {
            id: this.generateId('AUF'),
            angebotId,
            kunde: angebot.kunde,
            leistungsart: angebot.leistungsart,
            positionen: angebot.positionen,
            angebotsWert: angebot.brutto,
            netto: angebot.netto,
            mwst: angebot.mwst,
            status: 'geplant',
            fortschritt: 0,
            mitarbeiter: [],
            startDatum: null,
            endDatum: null,
            checkliste: [],
            kommentare: [],
            historie: [{ aktion: 'erstellt', datum: new Date().toISOString(), details: `Aus Angebot ${angebotId}` }],
            createdAt: new Date().toISOString()
        };

        this.store.auftraege.push(auftrag);
        this._insertRow('auftraege', auftrag);
        this.addActivity('✅', `Angebot ${angebotId} angenommen → Auftrag ${auftrag.id}`);

        return auftrag;
    }

    /**
     * Updates an order in-place.
     * @param {string} auftragId
     * @param {Object} updates
     * @returns {Object|null}
     */
    updateAuftrag(auftragId, updates) {
        const auftrag = this.store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) return null;

        const oldStatus = auftrag.status;
        Object.assign(auftrag, updates);

        if (!auftrag.historie) auftrag.historie = [];
        if (updates.status && updates.status !== oldStatus) {
            auftrag.historie.push({
                aktion: 'status',
                datum: new Date().toISOString(),
                details: `${oldStatus} → ${updates.status}`
            });
        }

        this._updateRow('auftraege', auftragId, this._mapToDB('auftraege', auftrag));
        this.notify();
        return auftrag;
    }

    /**
     * Adds a comment to an order.
     * @param {string} auftragId
     * @param {string} text
     * @param {string} [autor]
     * @returns {Object|null}
     */
    addAuftragComment(auftragId, text, autor) {
        const auftrag = this.store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) return null;

        if (!auftrag.kommentare) auftrag.kommentare = [];
        const kommentar = {
            id: 'kom-' + Date.now(),
            text,
            autor: autor || 'Benutzer',
            datum: new Date().toISOString()
        };
        auftrag.kommentare.push(kommentar);

        if (!auftrag.historie) auftrag.historie = [];
        auftrag.historie.push({ aktion: 'kommentar', datum: kommentar.datum, details: text.substring(0, 50) });

        this.save();
        return kommentar;
    }

    /**
     * Updates the checklist for an order.
     * @param {string} auftragId
     * @param {Array} checkliste
     * @returns {Object|null}
     */
    updateAuftragCheckliste(auftragId, checkliste) {
        const auftrag = this.store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) return null;

        auftrag.checkliste = checkliste;
        if (checkliste.length > 0) {
            auftrag.fortschritt = Math.round(
                (checkliste.filter(c => c.erledigt).length / checkliste.length) * 100
            );
        }

        this.save();
        return auftrag;
    }

    /**
     * Completes an order and creates an invoice.
     * @param {string} auftragId
     * @param {Object} [completionData]
     * @returns {Promise<Object|null>}
     */
    async completeAuftrag(auftragId, completionData = {}) {
        const auftrag = this.store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) return null;

        Object.assign(auftrag, {
            status: 'abgeschlossen',
            completedAt: new Date().toISOString(),
            ...completionData
        });

        this._updateRow('auftraege', auftragId, this._mapToDB('auftraege', auftrag));

        try {
            if (window.invoiceService) {
                const invoiceOptions = {
                    generatePDF: completionData.generatePDF || false,
                    openPDF: completionData.openPDF || false,
                    downloadPDF: completionData.downloadPDF || false,
                    generateEInvoice: completionData.generateEInvoice || false,
                    paymentTermDays: completionData.paymentTermDays || 14,
                    templateId: completionData.templateId || 'standard-de'
                };
                return await window.invoiceService.createInvoice(auftrag, invoiceOptions);
            }

            // Fallback: manual invoice creation
            const rechnungsPositionen = [...(auftrag.positionen || [])];
            const stueckliste = auftrag.stueckliste || [];

            stueckliste.forEach(item => {
                rechnungsPositionen.push({
                    beschreibung: `Material: ${item.bezeichnung}`,
                    menge: item.menge,
                    einheit: item.einheit,
                    preis: item.vkPreis,
                    isMaterial: true,
                    artikelnummer: item.artikelnummer,
                    ekPreis: item.ekPreis
                });
            });

            if ((auftrag.extraMaterialKosten || 0) > 0) {
                rechnungsPositionen.push({
                    beschreibung: 'Sonstige Materialkosten',
                    menge: 1,
                    einheit: 'pauschal',
                    preis: auftrag.extraMaterialKosten,
                    isMaterial: true
                });
            }

            const netto = rechnungsPositionen.reduce(
                (sum, p) => sum + ((p.menge || 0) * (p.preis || 0)), 0
            );

            const rechnung = {
                id: this.generateId('RE'),
                nummer: this.generateId('RE'),
                auftragId,
                angebotId: auftrag.angebotId,
                kunde: auftrag.kunde,
                leistungsart: auftrag.leistungsart,
                positionen: rechnungsPositionen,
                stueckliste,
                arbeitszeit: auftrag.arbeitszeit,
                materialKosten: auftrag.materialKosten || 0,
                extraMaterialKosten: auftrag.extraMaterialKosten || 0,
                stuecklisteVK: auftrag.stuecklisteVK || 0,
                stuecklisteEK: auftrag.stuecklisteEK || 0,
                notizen: auftrag.notizen,
                netto,
                mwst: netto * 0.19,
                brutto: netto * 1.19,
                status: 'offen',
                datum: new Date().toISOString(),
                faelligkeitsdatum: new Date(Date.now() + 14 * 86400000).toISOString(),
                createdAt: new Date().toISOString()
            };

            this.store.rechnungen.push(rechnung);
            this._insertRow('rechnungen', rechnung);
            this.addActivity('💰', `Rechnung ${rechnung.nummer} erstellt`);
            return rechnung;

        } catch (error) {
            console.error('[FreyAI] Error creating invoice:', error);
            return null;
        }
    }

    /**
     * Pushes an activity log entry (client-side only).
     * @param {string} icon
     * @param {string} title
     */
    addActivity(icon, title) {
        this.store.activities.unshift({
            icon,
            title,
            time: new Date().toISOString()
        });
        if (this.store.activities.length > 50) {
            this.store.activities = this.store.activities.slice(0, 50);
        }
        this.notify();
    }

    /* ==========================================================
       Fine-grained Supabase operations (fire-and-forget)
       ========================================================== */

    /**
     * Inserts a single row into a Supabase table.
     * Falls back silently if offline.
     * @param {string} storeKey
     * @param {Object} item
     * @private
     */
    _insertRow(storeKey, item) {
        if (!this._isOnline()) return;
        const tableName = this._tableMap[storeKey];
        if (!tableName) return;

        const row = this._mapToDB(storeKey, item);
        this._sb().from(tableName).insert([row]).then(({ error }) => {
            if (error) console.error(`[FreyAI] Insert ${tableName} failed:`, error.message);
        });
    }

    /**
     * Updates a single row in a Supabase table.
     * @param {string} storeKey
     * @param {string} id
     * @param {Object} updates - DB-shaped partial row
     * @private
     */
    _updateRow(storeKey, id, updates) {
        if (!this._isOnline()) return;
        const tableName = this._tableMap[storeKey];
        if (!tableName) return;

        // Remove id and user_id from the update payload (they are in the WHERE clause)
        const { id: _id, user_id: _uid, ...patch } = updates;
        this._sb().from(tableName).update(patch).eq('id', id).then(({ error }) => {
            if (error) console.error(`[FreyAI] Update ${tableName}/${id} failed:`, error.message);
        });
    }

    /* ==========================================================
       Helpers
       ========================================================== */

    /**
     * Generates a prefixed unique ID.
     * @param {string} prefix - e.g. 'ANF', 'ANG', 'AUF', 'RE'
     * @returns {string}
     */
    generateId(prefix) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${prefix}-${timestamp}-${random}`.toUpperCase();
    }

    /**
     * Registers a subscriber that is called on every store change.
     * @param {Function} callback
     */
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    /** Notifies all subscribers with the current store. */
    notifySubscribers() {
        this.subscribers.forEach(cb => cb(this.store));
    }

    /** Alias for notifySubscribers (backward compat). */
    notify() {
        this.notifySubscribers();
    }
}

window.storeService = new StoreService();
