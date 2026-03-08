/* ============================================
   Store Service
   Centralized state management
   ============================================ */

class StoreService {
    constructor() {
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
                phone: '',
                email: '',
                iban: '',
                bic: '',
                bank: '',
                businessType: '',
                theme: 'dark'
            },
            currentAnfrageId: null,
            currentAuftragId: null,
            currentRechnungId: null
        };
        this.STORAGE_KEY = 'freyai-workflow-store';
        this.subscribers = [];
        this.currentUserId = null; // Track which user's data is loaded

        // Subscribe to user changes
        if (window.userManager) {
            window.userManager.onUserChange(async (user) => {
                if (user) {
                    await this.loadForUser(user.id);
                } else {
                    this._clearStore();
                }
            });
        }

        // Re-sync from Supabase once auth becomes available (fixes timing issue)
        this._setupAuthSync();

        // Note: load() or loadForUser() must be called explicitly and awaited in app.js
    }

    /**
     * Loads the store state for a specific user from IndexedDB.
     * @param {string} userId - User ID to load data for
     */
    async loadForUser(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Loading data for user
        this.currentUserId = userId;

        // 1. Try to get user-specific data from IndexedDB
        let data = await window.dbService.getUserData(userId, this.STORAGE_KEY);

        // 2. Migration: If no user data exists, check old app_state store (v1 → v2 migration)
        if (!data) {
            const legacyData = await window.dbService.get(this.STORAGE_KEY);
            if (legacyData && userId === 'default') {
                console.warn('Migrating legacy data to user_default_data...');
                data = legacyData;
                await window.dbService.setUserData(userId, this.STORAGE_KEY, data);
            }
        }

        // 3. Migration: Check if data still exists in localStorage (very old version)
        if (!data) {
            const legacyLocalStorage = localStorage.getItem(this.STORAGE_KEY);
            if (legacyLocalStorage && userId === 'default') {
                console.warn('Migrating data from localStorage to user-specific IndexedDB...');
                try {
                    data = JSON.parse(legacyLocalStorage);
                    await window.dbService.setUserData(userId, this.STORAGE_KEY, data);
                    localStorage.removeItem(this.STORAGE_KEY);
                } catch (e) {
                    console.error('Migration failed:', e);
                }
            }
        }

        if (data) {
            try {
                // Clear current store
                this._clearStore();
                // Merge only known keys to prevent unexpected properties
                const STORE_KEYS = ['anfragen', 'angebote', 'auftraege', 'rechnungen', 'activities', 'settings', 'kunden', 'currentAnfrageId', 'currentAuftragId', 'currentRechnungId'];
                const filtered = {};
                for (const key of STORE_KEYS) {
                    if (data[key] !== undefined) {filtered[key] = data[key];}
                }
                Object.assign(this.store, filtered);
                this.checkStorageUsage();
            } catch (e) {
                console.error('Failed to parse store data:', e);
            }
        }

        // Always try Supabase sync when online (overrides cached/demo data)
        const synced = await this._syncFromSupabase();
        if (!synced && !data) {
            // No cached data AND no Supabase → load demo
            await this.resetToDemo();
        }

        this.notify();
    }

    /**
     * Legacy load method (backward compatibility).
     * Loads data for the current user or 'default' user if not logged in.
     * @deprecated Use loadForUser() instead
     */
    async load() {
        const currentUser = window.userManager?.getCurrentUser();
        const userId = currentUser ? currentUser.id : 'default';
        return await this.loadForUser(userId);
    }

    /**
     * Clears the in-memory store to default state.
     * @private
     */
    _clearStore() {
        this.store.anfragen = [];
        this.store.angebote = [];
        this.store.auftraege = [];
        this.store.rechnungen = [];
        this.store.kunden = [];
        this.store.activities = [];
        this.store.currentAnfrageId = null;
        this.store.currentAuftragId = null;
        this.store.currentRechnungId = null;
        // Keep settings (theme, etc.)
    }

    /**
     * Hard reset of the application data to demo state (user-specific).
     */
    async resetToDemo() {
        if (!window.demoDataService) {
            console.error('DemoDataService not loaded!');
            return;
        }

        const demoData = window.demoDataService.getDemoData();

        // Determine user ID
        const userId = this.currentUserId || 'default';

        // Clear user-specific storage
        await window.dbService.clearUserData(userId);
        localStorage.removeItem('freyai_customer_presets');

        // Populate store in-place to preserve references in app.js
        Object.keys(this.store).forEach(key => {
            if (Array.isArray(this.store[key])) {
                this.store[key] = [];
            } else if (key === 'settings') {
                // Reset settings to constructor defaults so demoData can override cleanly
                this.store.settings = {
                    companyName: '',
                    owner: '',
                    address: '',
                    taxId: '',
                    vatId: '',
                    phone: '',
                    email: '',
                    iban: '',
                    bic: '',
                    bank: '',
                    businessType: '',
                    theme: 'dark'
                };
            }
        });

        Object.assign(this.store, demoData, {
            currentAnfrageId: null,
            currentAuftragId: null,
            currentRechnungId: null
        });

        await this.save();
        console.warn(`App reset to demo state for user: ${userId} (Reference preserved).`);
    }

    checkStorageUsage() {
        // Estimation for IndexedDB is harder, but we can check the total store object size in memory
        const json = JSON.stringify(this.store);
        const sizeInMB = (json.length * 2) / (1024 * 1024); // UTF-16 estimation

        // New limit: 1GB (1024 MB), Warning at 800MB
        if (sizeInMB > 800.0) {
            console.warn(`Storage High Usage: ${sizeInMB.toFixed(2)} MB`);
            if (window.errorHandler) {
                window.errorHandler.warning(`⚠️ Speicherplatz fast erschöpft: ${sizeInMB.toFixed(2)} MB belegt (Max 1024 MB).`);
            }
        }
    }

    /**
     * Saves the current store state to IndexedDB (user-specific).
     */
    async save() {
        if (this._saving) {
            this._saveQueued = true;
            return;
        }
        this._saving = true;
        try {
            const userId = this.currentUserId || 'default';
            await window.dbService.setUserData(userId, this.STORAGE_KEY, this.store);
            this.notify();
        } catch (e) {
            console.error('Save failed:', e);
            if (window.errorHandler) {
                window.errorHandler.error('Fehler beim Speichern der Daten.');
            }
        } finally {
            this._saving = false;
            if (this._saveQueued) {
                this._saveQueued = false;
                await this.save();
            }
        }
    }

    // Get simplified state reference (read-only recommended)
    get state() {
        return this.store;
    }

    // --- Actions ---

    /**
     * Adds a new Inquiry to the store.
     * @param {Object} anfrage - The inquiry object to add
     */
    async addAnfrage(anfrage) {
        this.store.anfragen.push(anfrage);
        this.addActivity('📥', `Neue Anfrage von ${anfrage.kunde?.name || 'Unbekannt'}`);
        await this.save();
    }

    /**
     * Adds a new Offer to the store and updates the related Inquiry status.
     * @param {Object} angebot - The offer object
     */
    async addAngebot(angebot) {
        this.store.angebote.push(angebot);
        // Update linked Anfrage
        const anfrage = this.store.anfragen.find(a => a.id === angebot.anfrageId);
        if (anfrage) {anfrage.status = 'angebot-erstellt';}

        this.addActivity('📝', `Angebot ${angebot.id} für ${angebot.kunde?.name || 'Kunde'} erstellt`);
        await this.save();
    }

    /**
     * Accepts an Offer and converts it into a new Order (Auftrag).
     * @param {string} angebotId - The ID of the offer to accept
     * @returns {Object|null} The created order object or null if failed
     */
    async acceptAngebot(angebotId) {
        const angebot = this.store.angebote.find(a => a.id === angebotId);
        if (!angebot) {return null;}

        angebot.status = 'angenommen';

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
        this.addActivity('✅', `Angebot ${angebotId} angenommen → Auftrag ${auftrag.id}`);
        await this.save();

        return auftrag;
    }

    async updateAuftrag(auftragId, updates) {
        const auftrag = this.store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) {return null;}

        const oldStatus = auftrag.status;
        Object.assign(auftrag, updates);

        if (!auftrag.historie) {auftrag.historie = [];}
        if (updates.status && updates.status !== oldStatus) {
            auftrag.historie.push({
                aktion: 'status',
                datum: new Date().toISOString(),
                details: `${oldStatus} → ${updates.status}`
            });
        }

        await this.save();
        return auftrag;
    }

    async addAuftragComment(auftragId, text, autor) {
        const auftrag = this.store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) {return null;}

        if (!auftrag.kommentare) {auftrag.kommentare = [];}
        const kommentar = {
            id: 'kom-' + Date.now(),
            text,
            autor: autor || 'Benutzer',
            datum: new Date().toISOString()
        };
        auftrag.kommentare.push(kommentar);

        if (!auftrag.historie) {auftrag.historie = [];}
        auftrag.historie.push({ aktion: 'kommentar', datum: kommentar.datum, details: (text || '').substring(0, 50) });

        await this.save();
        return kommentar;
    }

    async updateAuftragCheckliste(auftragId, checkliste) {
        const auftrag = this.store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) {return null;}

        auftrag.checkliste = checkliste;
        // Auto-calculate progress from checklist
        if (checkliste.length > 0) {
            auftrag.fortschritt = Math.round((checkliste.filter(c => c.erledigt).length / checkliste.length) * 100);
        }

        await this.save();
        return auftrag;
    }

    async completeAuftrag(auftragId, completionData = {}) {
        const auftrag = this.store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) {return null;}

        Object.assign(auftrag, {
            status: 'abgeschlossen',
            completedAt: new Date().toISOString(),
            ...completionData
        });

        await this.save();

        // Create Invoice using InvoiceService
        try {
            if (!window.invoiceService) {
                console.error('InvoiceService not available, falling back to enhanced invoice creation');

                // Fallback: Enhanced invoice creation with Stückliste support
                // Build invoice positions: original positions + Stückliste + extra costs
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

                const netto = rechnungsPositionen.reduce((sum, p) => sum + ((p.menge || 0) * (p.preis || 0)), 0);
                const isKleinunternehmer = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}').kleinunternehmer;
                const taxRate = isKleinunternehmer ? 0 : (typeof window._getTaxRate === 'function' ? window._getTaxRate() : 0.19);

                const rechnung = {
                    id: this.generateId('RE'),
                    nummer: this.generateId('RE'), // Simple fallback number
                    auftragId,
                    angebotId: auftrag.angebotId,
                    kunde: auftrag.kunde,
                    leistungsart: auftrag.leistungsart,
                    positionen: rechnungsPositionen,
                    stueckliste: stueckliste,
                    arbeitszeit: auftrag.arbeitszeit,
                    materialKosten: auftrag.materialKosten || 0,
                    extraMaterialKosten: auftrag.extraMaterialKosten || 0,
                    stuecklisteVK: auftrag.stuecklisteVK || 0,
                    stuecklisteEK: auftrag.stuecklisteEK || 0,
                    notizen: auftrag.notizen,
                    netto: netto,
                    mwst: Math.round(netto * taxRate * 100) / 100,
                    brutto: Math.round(netto * (1 + taxRate) * 100) / 100,
                    status: 'offen',
                    datum: new Date().toISOString(),
                    faelligkeitsdatum: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                    createdAt: new Date().toISOString()
                };

                this.store.rechnungen.push(rechnung);
                this.addActivity('💰', `Rechnung ${rechnung.nummer} erstellt`);
                await this.save();

                return rechnung;
            }

            // Use InvoiceService for GoBD-compliant invoice creation
            const invoiceOptions = {
                generatePDF: completionData.generatePDF || false,
                openPDF: completionData.openPDF || false,
                downloadPDF: completionData.downloadPDF || false,
                generateEInvoice: completionData.generateEInvoice || false,
                paymentTermDays: completionData.paymentTermDays || 14,
                templateId: completionData.templateId || 'standard-de'
            };

            const rechnung = await window.invoiceService.createInvoice(auftrag, invoiceOptions);

            return rechnung;

        } catch (error) {
            console.error('Error creating invoice:', error);
            // Still return something if invoice creation fails
            return null;
        }
    }

    addActivity(icon, title) {
        this.store.activities.unshift({
            icon,
            title,
            time: new Date().toISOString()
        });
        if (this.store.activities.length > 50) { // Increased limit
            this.store.activities = this.store.activities.slice(0, 50);
        }
        // Note: callers (addAnfrage, addAngebot, etc.) are responsible for saving
    }

    // --- Helpers ---

    generateId(prefix) {
        if (crypto?.randomUUID) {
            return `${prefix}-${crypto.randomUUID()}`.toUpperCase();
        }
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 7);
        return `${prefix}-${timestamp}-${random}`.toUpperCase();
    }

    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(s => s !== callback);
        };
    }

    notifySubscribers() {
        this.subscribers.forEach(cb => cb(this.store));
    }

    // Alias for notifySubscribers (for consistency)
    notify() {
        this.notifySubscribers();
    }

    /**
     * Listen for auth state changes and re-sync when user logs in.
     */
    _setupAuthSync() {
        let attempts = 0;
        const MAX_ATTEMPTS = 20;
        const trySubscribe = () => {
            if (attempts++ >= MAX_ATTEMPTS) {
                console.warn('StoreService: authService not found after', MAX_ATTEMPTS, 'attempts');
                return;
            }
            if (window.authService) {
                window.authService.onAuthChange(async (user) => {
                    if (user && window.supabaseDB?.isOnline()) {
                        await this.forceSync();
                    }
                });
            } else {
                setTimeout(trySubscribe, 500);
            }
        };
        trySubscribe();
    }

    /**
     * Force re-sync from Supabase, replacing cached data.
     */
    async forceSync() {
        const synced = await this._syncFromSupabase();
        if (synced) {
            this.notify();
        }
        return synced;
    }

    /**
     * Transform flat Supabase rows (kunde_name, kunde_email, kunde_telefon)
     * into the nested kunde object the frontend expects.
     */
    _transformSupabaseRows(rows) {
        return rows.map(row => {
            if (row.kunde_name && !row.kunde) {
                row.kunde = {
                    name: row.kunde_name,
                    email: row.kunde_email || '',
                    telefon: row.kunde_telefon || ''
                };
            }
            return row;
        });
    }

    /**
     * Sync data from Supabase cloud tables into local store.
     * @returns {boolean} true if data was loaded from Supabase
     */
    async _syncFromSupabase() {
        if (!window.supabaseDB || !window.supabaseDB.isOnline()) {return false;}
        try {
            console.warn("[StoreService] Syncing from Supabase...");
            const tables = ["anfragen", "angebote", "auftraege", "rechnungen"];
            let totalRecords = 0;
            for (const table of tables) {
                const data = await window.supabaseDB.getAll(table);
                if (data && data.length > 0) {
                    this.store[table] = this._transformSupabaseRows(data);
                    totalRecords += data.length;
                }
            }
            try {
                const kunden = await window.supabaseDB.getAll("kunden");
                if (kunden && kunden.length > 0) {
                    this.store.kunden = kunden;
                    totalRecords += kunden.length;
                }
            } catch { /* kunden table may not exist */ }

            if (totalRecords > 0) {
                console.warn(`[StoreService] Loaded ${totalRecords} records from Supabase`);
                await this.save();
                return true;
            }
            return false;
        } catch (err) {
            console.warn("[StoreService] Supabase sync failed:", err.message);
            return false;
        }
    }
}

window.storeService = new StoreService();
