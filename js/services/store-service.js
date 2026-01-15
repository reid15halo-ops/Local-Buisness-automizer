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
        this.load();
    }

    /**
     * Loads the store state from localStorage.
     * Merges saved data with default structure to ensure integrity.
     */
    load() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge to ensure structure integrity
                Object.assign(this.store, parsed);
                this.checkStorageUsage();
            } catch (e) {
                console.error('Failed to load store:', e);
            }
        }
    }

    checkStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += (localStorage[key].length + key.length) * 2;
            }
        }
        const sizeInMB = total / (1024 * 1024);
        if (sizeInMB > 4.0) {
            console.warn(`Storage Critical: ${sizeInMB.toFixed(2)} MB`);
            if (window.errorHandler) {
                window.errorHandler.warning(`⚠️ Speicher kritisch: ${sizeInMB.toFixed(2)} MB belegt (Max ~5 MB). Bitte alte Daten archivieren.`);
            }
        }
    }

    /**
     * Saves the current store state to localStorage.
     * Triggers notification to all subscribers.
     */
    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.store));
            this.notifySubscribers();
        } catch (e) {
            console.error('Failed to save store:', e);
            // Check for quota exceeded
            if (e.name === 'QuotaExceededError') {
                alert('Speicher voll! Bitte alte Daten löschen oder Backup erstellen.');
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

        // Create Invoice automatically
        const rechnung = {
            id: this.generateId('RE'),
            auftragId,
            angebotId: auftrag.angebotId,
            kunde: auftrag.kunde,
            leistungsart: auftrag.leistungsart,
            positionen: auftrag.positionen,
            arbeitszeit: auftrag.arbeitszeit,
            materialKosten: auftrag.materialKosten,
            notizen: auftrag.notizen,
            netto: auftrag.netto + (auftrag.materialKosten || 0),
            mwst: (auftrag.netto + (auftrag.materialKosten || 0)) * 0.19,
            brutto: (auftrag.netto + (auftrag.materialKosten || 0)) * 1.19,
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
