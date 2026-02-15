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
                companyName: 'MHS Metallbau Hydraulik Service',
                owner: 'Max Mustermann',
                address: 'Handwerkerring 38a, 12345 Musterstadt',
                taxId: '12/345/67890',
                vatId: 'DE123456789',
                theme: 'dark'
            },
            currentAnfrageId: null,
            currentAuftragId: null,
            currentRechnungId: null
        };
        this.STORAGE_KEY = 'mhs-workflow-store';
        this.subscribers = [];
        // Note: load() must be called explicitly and awaited in app.js
    }

    /**
     * Loads the store state from IndexedDB (with localStorage fallback/migration).
     */
    async load() {
        // 1. Try to get from IndexedDB
        let data = await window.dbService.get(this.STORAGE_KEY);

        // 2. Migration: Check if data still exists in localStorage
        const legacyData = localStorage.getItem(this.STORAGE_KEY);
        if (legacyData && !data) {
            console.log('Migrating data from localStorage to IndexedDB...');
            try {
                data = JSON.parse(legacyData);
                await window.dbService.set(this.STORAGE_KEY, data);
                localStorage.removeItem(this.STORAGE_KEY); // Move, don't just copy
            } catch (e) {
                console.error('Migration failed:', e);
            }
        }

        if (data) {
            try {
                // Merge to ensure structure integrity
                Object.assign(this.store, data);
                this.checkStorageUsage();

                // If store exists but is effectively empty, load demo data
                if (this.store.anfragen.length === 0 &&
                    this.store.angebote.length === 0 &&
                    this.store.auftraege.length === 0) {
                    await this.resetToDemo();
                }
            } catch (e) {
                console.error('Failed to parse store data:', e);
                await this.resetToDemo();
            }
        } else {
            // No data saved yet -> Initial Demo Load
            await this.resetToDemo();
        }
    }

    /**
     * Hard reset of the application data to demo state.
     */
    async resetToDemo() {
        if (!window.demoDataService) {
            console.error('DemoDataService not loaded!');
            return;
        }

        const demoData = window.demoDataService.getDemoData();

        // Reset storage
        await window.dbService.clear();
        localStorage.removeItem('mhs_customer_presets');

        // Populate store in-place to preserve references in app.js
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

        await this.save();
        console.log('App reset to demo state (Reference preserved).');
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
     * Saves the current store state to IndexedDB.
     */
    async save() {
        try {
            await window.dbService.set(this.STORAGE_KEY, this.store);
            this.notify();
        } catch (e) {
            console.error('Save failed:', e);
            if (window.errorHandler) {
                window.errorHandler.error('Fehler beim Speichern der Daten.');
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
    addAnfrage(anfrage) {
        this.store.anfragen.push(anfrage);
        this.save();
        this.addActivity('📥', `Neue Anfrage von ${anfrage.kunde.name}`);
    }

    /**
     * Adds a new Offer to the store and updates the related Inquiry status.
     * @param {Object} angebot - The offer object
     */
    addAngebot(angebot) {
        this.store.angebote.push(angebot);
        // Update linked Anfrage
        const anfrage = this.store.anfragen.find(a => a.id === angebot.anfrageId);
        if (anfrage) anfrage.status = 'angebot-erstellt';

        this.save();
        this.addActivity('📝', `Angebot ${angebot.id} für ${angebot.kunde.name} erstellt`);
    }

    /**
     * Accepts an Offer and converts it into a new Order (Auftrag).
     * @param {string} angebotId - The ID of the offer to accept
     * @returns {Object|null} The created order object or null if failed
     */
    acceptAngebot(angebotId) {
        const angebot = this.store.angebote.find(a => a.id === angebotId);
        if (!angebot) return null;

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
            status: 'aktiv',
            createdAt: new Date().toISOString()
        };

        this.store.auftraege.push(auftrag);
        this.save();
        this.addActivity('✅', `Angebot ${angebotId} angenommen → Auftrag ${auftrag.id}`);

        return auftrag;
    }

    completeAuftrag(auftragId, completionData) {
        const auftrag = this.store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) return null;

        Object.assign(auftrag, {
            status: 'abgeschlossen',
            completedAt: new Date().toISOString(),
            ...completionData
        });

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

        const rechnung = {
            id: this.generateId('RE'),
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
            mwst: netto * 0.19,
            brutto: netto * 1.19,
            status: 'offen',
            createdAt: new Date().toISOString()
        };

        this.store.rechnungen.push(rechnung);
        this.save();
        this.addActivity('💰', `Rechnung ${rechnung.id} erstellt`);

        return rechnung;
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
        this.save(); // Save triggers notify
    }

    // --- Helpers ---

    generateId(prefix) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${prefix}-${timestamp}-${random}`.toUpperCase();
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    notifySubscribers() {
        this.subscribers.forEach(cb => cb(this.store));
    }
}

window.storeService = new StoreService();
