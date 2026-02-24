/* ============================================
   Setup Wizard Service - User Onboarding Layer
   Handles first-run user setup with 5 simple fields
   (User-friendly for non-technical Handwerker)
   ============================================ */

class SetupWizardService {
    constructor() {
        this.currentStep = 0;
        // User onboarding: 5 simple fields ONLY
        this.steps = [
            {
                id: 'welcome',
                type: 'user',
                title: 'Willkommen bei FreyAI Visions!',
                description: 'Bevor es losgeht, brauchen wir ein paar Angaben für Ihre Angebote und Rechnungen.',
                required: true,
                fields: [
                    {
                        name: 'company_name',
                        label: 'Firmenname *',
                        placeholder: 'Müller Fliesenleger GmbH',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'owner_name',
                        label: 'Ihr Name *',
                        placeholder: 'Peter Müller',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'address_street',
                        label: 'Straße und Hausnummer *',
                        placeholder: 'Hauptstraße 42',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'address_postal',
                        label: 'Postleitzahl *',
                        placeholder: '74523',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'address_city',
                        label: 'Stadt *',
                        placeholder: 'Schwäbisch Hall',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'tax_number',
                        label: 'Steuernummer oder USt-IdNr *',
                        placeholder: '75 123 456 789 oder DE 123456789',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'business_type',
                        label: 'Betriebsart (für KI-Texte)',
                        placeholder: 'z.B. Metallbaubetrieb, Elektrobetrieb, Malerbetrieb',
                        type: 'text',
                        required: false
                    },
                    {
                        name: 'company_logo',
                        label: 'Logo hochladen (optional)',
                        type: 'file',
                        required: false,
                        accept: 'image/*'
                    }
                ]
            },
            {
                id: 'complete',
                type: 'user',
                title: 'Fertig! ✓',
                description: 'Ihre Firmendaten wurden gespeichert. Sie können jetzt direkt mit FreyAI Visions arbeiten.',
                required: false,
                fields: []
            }
        ];
    }

    /**
     * Check if user onboarding is complete
     */
    isSetupComplete() {
        const requiredFields = [
            'company_name',
            'owner_name',
            'address_street',
            'address_postal',
            'address_city',
            'tax_number'
        ];

        return requiredFields.every(field => {
            const value = localStorage.getItem(field);
            return value && value.trim() !== '';
        });
    }

    /**
     * Get missing required fields
     */
    getMissingKeys() {
        const requiredFields = [
            { key: 'company_name', name: 'Firmenname', required: true },
            { key: 'owner_name', name: 'Ihr Name', required: true },
            { key: 'address_street', name: 'Straße', required: true },
            { key: 'address_postal', name: 'Postleitzahl', required: true },
            { key: 'address_city', name: 'Stadt', required: true },
            { key: 'tax_number', name: 'Steuernummer', required: true }
        ];

        return requiredFields.filter(({ key }) => {
            const value = localStorage.getItem(key);
            return !value || value.trim() === '';
        });
    }

    /**
     * Get company profile from localStorage
     */
    getCompanyProfile() {
        return {
            company_name: localStorage.getItem('company_name') || '',
            owner_name: localStorage.getItem('owner_name') || '',
            address_street: localStorage.getItem('address_street') || '',
            address_postal: localStorage.getItem('address_postal') || '',
            address_city: localStorage.getItem('address_city') || '',
            tax_number: localStorage.getItem('tax_number') || '',
            company_logo: localStorage.getItem('company_logo') || null
        };
    }

    /**
     * Get current step configuration
     */
    getCurrentStep() {
        return this.steps[this.currentStep];
    }

    /**
     * Move to next step
     */
    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            return true;
        }
        return false;
    }

    /**
     * Move to previous step
     */
    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            return true;
        }
        return false;
    }

    /**
     * Skip to specific step
     */
    goToStep(index) {
        if (index >= 0 && index < this.steps.length) {
            this.currentStep = index;
            return true;
        }
        return false;
    }

    /**
     * Validate current step inputs
     */
    validateCurrentStep() {
        const step = this.getCurrentStep();
        if (step.id === 'complete') {
            return { valid: true, errors: [] };
        }

        const errors = [];
        for (const field of step.fields) {
            if (!field.required) {continue;}

            const value = localStorage.getItem(field.name);

            if (!value || value.trim() === '') {
                errors.push(`${field.label.replace(' *', '')} ist erforderlich`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Save field value
     */
    saveField(fieldName, value) {
        if (fieldName === 'company_logo') {
            // Logo is stored as base64 by the UI
            localStorage.setItem(fieldName, value);
        } else {
            localStorage.setItem(fieldName, value.trim());
        }
    }

    /**
     * Get admin/technical settings from localStorage
     */
    getAdminSettings() {
        return {
            supabase_url: localStorage.getItem('supabase_url') || '',
            supabase_anon_key: localStorage.getItem('supabase_anon_key') || '',
            gemini_api_key: localStorage.getItem('gemini_api_key') || '',
            resend_api_key: localStorage.getItem('resend_api_key') || '',
            stripe_publishable_key: localStorage.getItem('stripe_publishable_key') || '',
            n8n_webhook_url: localStorage.getItem('n8n_webhook_url') || '',
            kleinunternehmer: localStorage.getItem('kleinunternehmer') === 'true'
        };
    }

    /**
     * Save admin/technical setting
     */
    saveAdminSetting(key, value) {
        if (key === 'kleinunternehmer') {
            localStorage.setItem(key, value === true ? 'true' : 'false');
        } else {
            localStorage.setItem(key, value.trim());
        }

        // Trigger service updates if needed
        if (key === 'supabase_url' || key === 'supabase_anon_key') {
            const url = localStorage.getItem('supabase_url');
            const anonKey = localStorage.getItem('supabase_anon_key');
            if (url && anonKey && window.supabaseConfig) {
                window.supabaseConfig.update(url, anonKey);
            }
        }

        if (key === 'stripe_publishable_key') {
            if (window.stripeService) {
                window.stripeService.publishableKey = value.trim();
                window.stripeService.init();
            }
        }
    }

    /**
     * Verify admin PIN
     * Returns false if no PIN is set (forces setup via Admin Panel)
     */
    verifyAdminPin(pin) {
        const storedPin = localStorage.getItem('admin_pin');
        if (!storedPin) {return false;}
        return pin === storedPin;
    }

    /**
     * Set new admin PIN
     */
    setAdminPin(newPin) {
        if (newPin && newPin.trim().length >= 4) {
            localStorage.setItem('admin_pin', newPin.trim());
            return true;
        }
        return false;
    }

    /**
     * Reset user onboarding (for re-setup)
     */
    resetSetup() {
        const userFields = [
            'company_name',
            'owner_name',
            'address_street',
            'address_postal',
            'address_city',
            'tax_number',
            'company_logo'
        ];

        userFields.forEach(field => localStorage.removeItem(field));
        this.currentStep = 0;
    }

    /**
     * Export company profile (for backup)
     */
    exportCompanyProfile() {
        return {
            ...this.getCompanyProfile(),
            exported_at: new Date().toISOString()
        };
    }

    /**
     * Import data from Fragebogen (Betriebs-Aufnahmebogen) into wizard fields.
     * Delegates to FragebogenImportService if available, otherwise applies data directly.
     * @param {Object} data - Key-value pairs from the fragebogen form
     * @returns {{ success: boolean, imported: number, errors: Array }}
     */
    importFromFragebogen(data) {
        if (!data || typeof data !== 'object') {
            console.error('[SetupWizard] importFromFragebogen: Keine gültigen Daten.');
            return { success: false, imported: 0, errors: ['Keine gültigen Daten.'] };
        }

        try {
            // If the dedicated import service is available, delegate to it
            if (window.fragebogenImportService) {
                const result = window.fragebogenImportService.importFromFragebogen(data);
                return {
                    success: result.errors.length === 0,
                    imported: result.imported.length,
                    errors: result.errors.map(e => typeof e === 'string' ? e : `${e.field}: ${e.reason}`)
                };
            }

            // Fallback: direct mapping for core wizard fields
            const mapping = {
                firmenname:    'company_name',
                inhaber:       'owner_name',
                strasse:       'address_street',
                plz:           'address_postal',
                ort:           'address_city',
                steuernummer:  'tax_number',
                gewerk:        'business_type'
            };

            let importedCount = 0;
            for (const [fragebogenKey, wizardKey] of Object.entries(mapping)) {
                const value = data[fragebogenKey];
                if (value && String(value).trim()) {
                    this.saveField(wizardKey, String(value).trim());
                    importedCount++;
                }
            }

            return { success: true, imported: importedCount, errors: [] };

        } catch (e) {
            console.error('[SetupWizard] importFromFragebogen Fehler:', e);
            return { success: false, imported: 0, errors: [e.message || 'Unbekannter Fehler'] };
        }
    }

    /**
     * Check for pending fragebogen import (e.g. URL param ?import=fragebogen).
     * Call this during app initialization to auto-trigger import flow.
     * @returns {boolean} true if an import was detected and should be handled
     */
    checkForFragebogenImport() {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('import') !== 'fragebogen') {
                return false;
            }

            // Check if import data exists in localStorage
            const raw = localStorage.getItem('freyai_fragebogen_data');
            if (!raw) {
                console.warn('[SetupWizard] URL hat ?import=fragebogen, aber keine Daten in localStorage.');
                return false;
            }

            const data = JSON.parse(raw);
            if (!data || data._pendingImport !== true) {
                return false;
            }

            console.log('[SetupWizard] Fragebogen-Import erkannt. Starte Import-Flow...');

            // If the UI component is available, let it handle the preview dialog
            if (window.fragebogenImportUI) {
                window.fragebogenImportUI.autoCheckImport();
                return true;
            }

            // Fallback: import directly without preview
            const result = this.importFromFragebogen(data);
            if (result.success) {
                // Clear pending flag
                delete data._pendingImport;
                localStorage.setItem('freyai_fragebogen_data', JSON.stringify(data));
            }

            // Clean URL
            const url = new URL(window.location.href);
            url.searchParams.delete('import');
            window.history.replaceState({}, document.title, url.pathname + url.search);

            return true;

        } catch (e) {
            console.error('[SetupWizard] Fehler bei Fragebogen-Import-Prüfung:', e);
            return false;
        }
    }
}

// Global instance
window.setupWizard = new SetupWizardService();
