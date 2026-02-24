/* ============================================
   Fragebogen Import Service
   Bridge between Betriebs-Aufnahmebogen (fragebogen-beta-v1.html)
   and the App setup wizard / store settings.
   ============================================ */

class FragebogenImportService {
    constructor() {
        this.STORAGE_KEY = 'freyai_fragebogen_data';
        this.IMPORT_TIMESTAMP_KEY = 'freyai_fragebogen_imported_at';

        /**
         * Mapping: Fragebogen field name -> { wizard: setup-wizard key, store: store-settings key, label: German display name }
         * wizard  = localStorage key used by SetupWizardService
         * store   = key inside storeService.store.settings
         */
        this.fieldMapping = [
            { fragebogen: 'firmenname',     wizard: 'company_name',    store: 'companyName',   label: 'Firmenname' },
            { fragebogen: 'inhaber',        wizard: 'owner_name',      store: 'owner',         label: 'Inhaber / Name' },
            { fragebogen: 'gewerk',         wizard: 'business_type',   store: 'businessType',  label: 'Gewerk / Branche' },
            { fragebogen: 'strasse',        wizard: 'address_street',  store: null,             label: 'Straße' },
            { fragebogen: 'plz',            wizard: 'address_postal',  store: null,             label: 'PLZ' },
            { fragebogen: 'ort',            wizard: 'address_city',    store: null,             label: 'Ort' },
            { fragebogen: 'telefon',        wizard: null,              store: 'phone',          label: 'Telefon' },
            { fragebogen: 'email',          wizard: null,              store: 'email',          label: 'E-Mail' },
            { fragebogen: 'steuernummer',   wizard: 'tax_number',      store: 'taxId',          label: 'Steuernummer' },
            { fragebogen: 'ust_id',         wizard: null,              store: 'vatId',          label: 'USt-ID' },
            { fragebogen: 'iban',           wizard: null,              store: 'iban',           label: 'IBAN' },
            { fragebogen: 'bic',            wizard: null,              store: 'bic',            label: 'BIC / Bank' }
        ];

        /**
         * Extra fragebogen fields that are stored but not mapped to wizard/store directly.
         * They are kept in localStorage under the STORAGE_KEY blob for future use.
         */
        this.extraFields = [
            'rechtsform', 'rechtsform_sonstige', 'kleinunternehmer', 'mitarbeiter',
            'website', 'satz_geselle', 'satz_meister', 'satz_azubi', 'satz_notdienst'
        ];

        /**
         * Business-type detection map: keyword in "gewerk" field -> business_type value
         */
        this.businessTypeMap = [
            { keywords: ['elektr', 'strom', 'kabel'],               type: 'elektro' },
            { keywords: ['sanitaer', 'sanitär', 'wasser', 'heiz'],  type: 'sanitaer' },
            { keywords: ['maler', 'anstrich', 'lack', 'farb'],      type: 'maler' },
            { keywords: ['schreiner', 'tischler', 'holz', 'moebel', 'möbel'], type: 'schreiner' },
            { keywords: ['dach', 'dachdeck', 'speng'],              type: 'dachdecker' },
            { keywords: ['fliese', 'fliesen', 'platt'],             type: 'fliesenleger' },
            { keywords: ['metall', 'stahl', 'schweiß', 'schweiss', 'schloss'], type: 'metallbau' },
            { keywords: ['maurer', 'beton', 'hochbau'],             type: 'maurer' },
            { keywords: ['garten', 'landschaft', 'galabau'],        type: 'galabau' },
            { keywords: ['klima', 'lueftung', 'lüftung', 'kaelte', 'kälte'], type: 'klima' },
            { keywords: ['putz', 'stuck', 'fassad', 'trockenbau'],  type: 'stukkateur' },
            { keywords: ['zimmerer', 'zimmermann', 'holzbau'],      type: 'zimmerer' }
        ];
    }

    // -------------------------------------------------------------------------
    // Core import / export
    // -------------------------------------------------------------------------

    /**
     * Import data from fragebogen form into app settings.
     * @param {Object} formData - Structured object from the fragebogen (all field name -> value pairs)
     * @returns {{ imported: Array, skipped: Array, errors: Array }}
     */
    importFromFragebogen(formData) {
        if (!formData || typeof formData !== 'object') {
            console.error('[FragebogenImport] Ungueltige Formulardaten.');
            return { imported: [], skipped: [], errors: ['Keine gültigen Formulardaten erhalten.'] };
        }

        const result = { imported: [], skipped: [], errors: [] };

        try {
            // 1. Process mapped fields
            for (const mapping of this.fieldMapping) {
                const rawValue = formData[mapping.fragebogen];
                if (!rawValue || String(rawValue).trim() === '') {
                    result.skipped.push({ field: mapping.label, reason: 'Feld leer' });
                    continue;
                }

                const value = String(rawValue).trim();
                const validation = this._validateField(mapping.fragebogen, value);
                if (!validation.valid) {
                    result.errors.push({ field: mapping.label, reason: validation.reason });
                    continue;
                }

                // Write to setup-wizard localStorage keys
                if (mapping.wizard) {
                    try {
                        localStorage.setItem(mapping.wizard, value);
                    } catch (e) {
                        console.error(`[FragebogenImport] Fehler beim Speichern von ${mapping.wizard}:`, e);
                        result.errors.push({ field: mapping.label, reason: 'Speicherfehler' });
                        continue;
                    }
                }

                // Write to store settings
                if (mapping.store && window.storeService) {
                    try {
                        window.storeService.store.settings[mapping.store] = value;
                    } catch (e) {
                        console.error(`[FragebogenImport] Fehler beim Setzen von store.settings.${mapping.store}:`, e);
                    }
                }

                result.imported.push({ field: mapping.label, value });
            }

            // 2. Handle combined address for store
            this._buildStoreAddress(formData);

            // 3. Handle BIC/Bank split (fragebogen has "BIC / Bank" in one field)
            this._parseBicBank(formData);

            // 4. Auto-detect business type
            this._detectBusinessType(formData);

            // 5. Handle Kleinunternehmer flag
            if (formData.kleinunternehmer) {
                const isKlein = formData.kleinunternehmer === 'ja';
                localStorage.setItem('kleinunternehmer', isKlein ? 'true' : 'false');
            }

            // 6. Store the full fragebogen blob for future reference
            this._storeFullFragebogen(formData);

            // 7. Persist store changes
            if (window.storeService && typeof window.storeService.save === 'function') {
                window.storeService.save();
            }

            // 8. Mark import timestamp
            localStorage.setItem(this.IMPORT_TIMESTAMP_KEY, new Date().toISOString());

            console.log('[FragebogenImport] Import abgeschlossen:', result);
        } catch (e) {
            console.error('[FragebogenImport] Unerwarteter Fehler:', e);
            result.errors.push({ field: 'Allgemein', reason: 'Unerwarteter Fehler beim Import.' });
        }

        return result;
    }

    /**
     * Export current app settings back to a fragebogen-compatible data object.
     * Useful for pre-filling the fragebogen from existing settings.
     * @returns {Object} key-value pairs matching fragebogen field names
     */
    exportToFragebogen() {
        const data = {};

        try {
            for (const mapping of this.fieldMapping) {
                let value = '';

                // Prefer wizard/localStorage values
                if (mapping.wizard) {
                    value = localStorage.getItem(mapping.wizard) || '';
                }

                // Fall back to store settings
                if (!value && mapping.store && window.storeService) {
                    value = window.storeService.store.settings[mapping.store] || '';
                }

                if (value) {
                    data[mapping.fragebogen] = value;
                }
            }

            // Kleinunternehmer
            const kleinunternehmer = localStorage.getItem('kleinunternehmer');
            if (kleinunternehmer !== null) {
                data.kleinunternehmer = kleinunternehmer === 'true' ? 'ja' : 'nein';
            }

            // Extra fields from stored blob
            const blob = this._getStoredFragebogen();
            if (blob) {
                for (const key of this.extraFields) {
                    if (blob[key] && !data[key]) {
                        data[key] = blob[key];
                    }
                }
            }
        } catch (e) {
            console.error('[FragebogenImport] Fehler beim Export:', e);
        }

        return data;
    }

    // -------------------------------------------------------------------------
    // Import preview (for UI confirmation dialog)
    // -------------------------------------------------------------------------

    /**
     * Generate a preview of what would be imported, including before/after values.
     * Does NOT write anything.
     * @param {Object} formData
     * @returns {Array<{ label: string, fragebogenValue: string, currentValue: string, willImport: boolean }>}
     */
    getImportPreview(formData) {
        if (!formData || typeof formData !== 'object') {
            return [];
        }

        const preview = [];

        for (const mapping of this.fieldMapping) {
            const newValue = formData[mapping.fragebogen] ? String(formData[mapping.fragebogen]).trim() : '';

            let currentValue = '';
            if (mapping.wizard) {
                currentValue = localStorage.getItem(mapping.wizard) || '';
            }
            if (!currentValue && mapping.store && window.storeService) {
                currentValue = window.storeService.store.settings[mapping.store] || '';
            }

            const willImport = newValue !== '' && this._validateField(mapping.fragebogen, newValue).valid;

            preview.push({
                key: mapping.fragebogen,
                label: mapping.label,
                fragebogenValue: newValue,
                currentValue: currentValue,
                willImport
            });
        }

        return preview;
    }

    // -------------------------------------------------------------------------
    // Detection from URL params / localStorage
    // -------------------------------------------------------------------------

    /**
     * Check if there is pending fragebogen import data in localStorage.
     * @returns {boolean}
     */
    hasPendingImport() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            return data && data._pendingImport === true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get pending import data from localStorage (set by fragebogen HTML page).
     * @returns {Object|null}
     */
    getPendingImportData() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data && data._pendingImport === true) {
                return data;
            }
            return null;
        } catch (e) {
            console.error('[FragebogenImport] Fehler beim Lesen der Import-Daten:', e);
            return null;
        }
    }

    /**
     * Clear the pending import flag (after successful import).
     */
    clearPendingImport() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                if (data) {
                    delete data._pendingImport;
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
                }
            }
        } catch (e) {
            console.error('[FragebogenImport] Fehler beim Loeschen des Pending-Flags:', e);
        }
    }

    /**
     * Check URL for ?import=fragebogen parameter.
     * @returns {boolean}
     */
    hasImportUrlParam() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('import') === 'fragebogen';
        } catch (e) {
            return false;
        }
    }

    /**
     * Remove the ?import=fragebogen parameter from the URL without reload.
     */
    clearImportUrlParam() {
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('import');
            window.history.replaceState({}, document.title, url.pathname + url.search);
        } catch (e) {
            console.error('[FragebogenImport] Fehler beim Entfernen des URL-Parameters:', e);
        }
    }

    // -------------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------------

    /**
     * Get the timestamp of the last successful import.
     * @returns {string|null} ISO date string or null
     */
    getLastImportTimestamp() {
        return localStorage.getItem(this.IMPORT_TIMESTAMP_KEY) || null;
    }

    /**
     * Get the full mapping configuration (for debugging / UI).
     * @returns {Array}
     */
    getMappingConfig() {
        return [...this.fieldMapping];
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Validate a single field value.
     * @private
     */
    _validateField(fieldName, value) {
        if (typeof value !== 'string') {
            return { valid: false, reason: 'Wert muss ein Text sein.' };
        }

        const trimmed = value.trim();

        // Max length check (general safety)
        if (trimmed.length > 500) {
            return { valid: false, reason: 'Wert ist zu lang (max. 500 Zeichen).' };
        }

        // Field-specific validation
        switch (fieldName) {
            case 'email': {
                // Basic email pattern check
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (trimmed && !emailPattern.test(trimmed)) {
                    return { valid: false, reason: 'Ungültige E-Mail-Adresse.' };
                }
                break;
            }
            case 'plz': {
                // German PLZ: 5 digits
                if (trimmed && !/^\d{4,5}$/.test(trimmed)) {
                    return { valid: false, reason: 'PLZ muss 4-5 Ziffern haben.' };
                }
                break;
            }
            case 'iban': {
                // Basic IBAN pattern: 2 letters + 2 digits + up to 30 alphanum, spaces allowed
                const cleanIban = trimmed.replace(/\s/g, '');
                if (cleanIban && !/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/i.test(cleanIban)) {
                    return { valid: false, reason: 'Ungültiges IBAN-Format.' };
                }
                break;
            }
            case 'telefon': {
                // Allow digits, +, -, spaces, (), /
                if (trimmed && !/^[\d\s+\-()\/]+$/.test(trimmed)) {
                    return { valid: false, reason: 'Ungültige Telefonnummer.' };
                }
                break;
            }
            default:
                break;
        }

        return { valid: true, reason: '' };
    }

    /**
     * Build combined address string for store.settings.address
     * @private
     */
    _buildStoreAddress(formData) {
        const street = (formData.strasse || '').trim();
        const plz = (formData.plz || '').trim();
        const city = (formData.ort || '').trim();

        if ((street || plz || city) && window.storeService) {
            const parts = [];
            if (street) parts.push(street);
            if (plz || city) parts.push([plz, city].filter(Boolean).join(' '));
            window.storeService.store.settings.address = parts.join(', ');
        }
    }

    /**
     * Parse the BIC field which may contain "BIC / Bankname"
     * @private
     */
    _parseBicBank(formData) {
        const bicRaw = (formData.bic || '').trim();
        if (!bicRaw || !window.storeService) return;

        // Common pattern: "XXXXDEXX / Sparkasse Musterstadt" or "XXXXDEXX"
        if (bicRaw.includes('/')) {
            const parts = bicRaw.split('/').map(p => p.trim());
            window.storeService.store.settings.bic = parts[0] || '';
            window.storeService.store.settings.bank = parts.slice(1).join('/').trim() || '';
        } else {
            window.storeService.store.settings.bic = bicRaw;
        }
    }

    /**
     * Auto-detect business type from "gewerk" field.
     * @private
     */
    _detectBusinessType(formData) {
        const gewerk = (formData.gewerk || '').toLowerCase();
        if (!gewerk) return;

        for (const entry of this.businessTypeMap) {
            for (const keyword of entry.keywords) {
                if (gewerk.includes(keyword)) {
                    // Only set if wizard field is currently empty or matches gewerk raw value
                    const currentType = localStorage.getItem('business_type') || '';
                    if (!currentType || currentType === formData.gewerk) {
                        // Keep the user's raw gewerk text — it is more descriptive
                        // The detected type is stored as extra metadata
                        localStorage.setItem('freyai_detected_business_type', entry.type);
                    }
                    return;
                }
            }
        }
    }

    /**
     * Store the full fragebogen data blob in localStorage for future reference.
     * @private
     */
    _storeFullFragebogen(formData) {
        try {
            const dataToStore = { ...formData };
            delete dataToStore._pendingImport; // Remove import flag
            dataToStore._importedAt = new Date().toISOString();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
        } catch (e) {
            console.error('[FragebogenImport] Fehler beim Speichern des Fragebogen-Blobs:', e);
        }
    }

    /**
     * Retrieve the stored fragebogen blob.
     * @private
     */
    _getStoredFragebogen() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }
}

// Global instance
window.fragebogenImportService = new FragebogenImportService();
