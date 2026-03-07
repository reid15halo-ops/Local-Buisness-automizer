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
                        name: 'phone',
                        label: 'Telefon',
                        placeholder: '+49 123 4567890',
                        type: 'tel',
                        required: false
                    },
                    {
                        name: 'email',
                        label: 'E-Mail *',
                        placeholder: 'info@meine-firma.de',
                        type: 'email',
                        required: true
                    },
                    {
                        name: 'iban',
                        label: 'IBAN',
                        placeholder: 'DE89 3704 0044 0532 0130 00',
                        type: 'text',
                        required: false
                    },
                    {
                        name: 'bic',
                        label: 'BIC / Bank',
                        placeholder: 'COBADEFFXXX / Commerzbank',
                        type: 'text',
                        required: false
                    },
                    {
                        name: 'kleinunternehmer',
                        label: 'Kleinunternehmer nach §19 UStG',
                        type: 'checkbox',
                        required: false
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
                id: 'integrations',
                type: 'user',
                title: 'Integrationen einrichten',
                description: 'Verbinden Sie optionale Dienste. Sie können diesen Schritt auch überspringen und später konfigurieren.',
                required: false,
                fields: [],
                integrations: [
                    {
                        id: 'paperless',
                        name: 'Paperless-ngx',
                        icon: '\u{1F4C4}',
                        description: 'Dokumentenmanagement',
                        fields: [
                            { name: 'freyai_paperless_url', label: 'Paperless URL', placeholder: 'https://docs.example.de', type: 'url' },
                            { name: 'freyai_paperless_token', label: 'API Token', placeholder: 'Token ...', type: 'password' }
                        ]
                    },
                    {
                        id: 'calcom',
                        name: 'Cal.com',
                        icon: '\u{1F4C5}',
                        description: 'Terminbuchung',
                        fields: [
                            { name: 'freyai_calcom_url', label: 'Cal.com URL', placeholder: 'https://cal.example.de', type: 'url' },
                            { name: 'freyai_calcom_api_key', label: 'API Key', placeholder: 'cal_live_...', type: 'password' }
                        ]
                    },
                    {
                        id: 'postiz',
                        name: 'Postiz',
                        icon: '\u{1F4F1}',
                        description: 'Social-Media-Planung',
                        fields: [
                            { name: 'freyai_postiz_url', label: 'Postiz URL', placeholder: 'https://social.example.de', type: 'url' },
                            { name: 'freyai_postiz_api_key', label: 'API Key', placeholder: 'API Key ...', type: 'password' }
                        ]
                    },
                    {
                        id: 'whatsapp',
                        name: 'WhatsApp',
                        icon: '\u{1F4AC}',
                        description: 'WhatsApp Business (Evolution API)',
                        fields: [
                            { name: 'freyai_whatsapp_api_url', label: 'API URL', placeholder: 'https://api.example.de', type: 'url' },
                            { name: 'freyai_whatsapp_api_key', label: 'API Key', placeholder: 'API Key ...', type: 'password' },
                            { name: 'freyai_whatsapp_instance', label: 'Instanzname', placeholder: 'meine-instanz', type: 'text' }
                        ]
                    }
                ]
            },
            {
                id: 'complete',
                type: 'user',
                title: 'Fertig! \u2713',
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
            'tax_number',
            'email'
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
            { key: 'tax_number', name: 'Steuernummer', required: true },
            { key: 'email', name: 'E-Mail', required: true }
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
            phone: localStorage.getItem('phone') || '',
            email: localStorage.getItem('email') || '',
            iban: localStorage.getItem('iban') || '',
            bic: localStorage.getItem('bic') || '',
            kleinunternehmer: localStorage.getItem('kleinunternehmer') === 'true',
            business_type: localStorage.getItem('business_type') || '',
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
            } else if (field.type === 'email' && value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value.trim())) {
                    errors.push('Bitte geben Sie eine gueltige E-Mail-Adresse ein');
                }
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
        } else if (fieldName === 'kleinunternehmer') {
            localStorage.setItem(fieldName, value === true || value === 'true' ? 'true' : 'false');
        } else {
            localStorage.setItem(fieldName, (value ?? '').toString().trim());
        }
    }

    /**
     * Get admin/technical settings from localStorage
     */
    getAdminSettings() {
        return {
            supabase_url: localStorage.getItem('supabase_url') || '',
            supabase_anon_key: localStorage.getItem('supabase_anon_key') || '',
            // gemini_api_key is server-side only (Supabase env var GEMINI_API_KEY, ai-proxy edge function).
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
     * Hash a PIN using SHA-256 (async)
     */
    async _hashPin(pin) {
        const encoded = new TextEncoder().encode(pin);
        const hash = await crypto.subtle.digest('SHA-256', encoded);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Verify admin PIN
     * Returns false if no PIN is set (forces setup via Admin Panel)
     */
    async verifyAdminPin(pin) {
        const storedHash = localStorage.getItem('admin_pin_hash');
        // Migration: if old plaintext pin exists, hash it
        const oldPin = localStorage.getItem('admin_pin');
        if (!storedHash && oldPin) {
            const hash = await this._hashPin(oldPin);
            localStorage.setItem('admin_pin_hash', hash);
            localStorage.removeItem('admin_pin');
            return pin === oldPin;
        }
        if (!storedHash) return false;
        const inputHash = await this._hashPin(pin);
        return inputHash === storedHash;
    }

    /**
     * Set new admin PIN
     */
    async setAdminPin(newPin) {
        if (newPin && newPin.trim().length >= 4) {
            const hash = await this._hashPin(newPin.trim());
            localStorage.setItem('admin_pin_hash', hash);
            localStorage.removeItem('admin_pin'); // Remove plaintext if exists
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
            'phone',
            'email',
            'iban',
            'bic',
            'kleinunternehmer',
            'company_logo'
        ];

        // Also clear integration fields
        const intStep = this.getIntegrationsStep();
        if (intStep && intStep.integrations) {
            intStep.integrations.forEach(integration => {
                integration.fields.forEach(f => userFields.push(f.name));
            });
        }

        userFields.forEach(field => localStorage.removeItem(field));
        this.currentStep = 0;
    }

    /**
     * Get the integrations step definition
     */
    getIntegrationsStep() {
        return this.steps.find(s => s.id === 'integrations');
    }

    /**
     * Check if an integration is configured (all fields have values)
     */
    isIntegrationConfigured(integrationId) {
        const step = this.getIntegrationsStep();
        if (!step) { return false; }
        const integration = step.integrations.find(i => i.id === integrationId);
        if (!integration) { return false; }
        return integration.fields.every(f => {
            const val = localStorage.getItem(f.name);
            return val && val.trim() !== '';
        });
    }

    /**
     * Save an integration field value
     */
    saveIntegrationField(fieldName, value) {
        localStorage.setItem(fieldName, (value || '').trim());
    }

    /**
     * Test an integration connection
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async testIntegration(integrationId) {
        const step = this.getIntegrationsStep();
        if (!step) { return { success: false, message: 'Integrationsschritt nicht gefunden.' }; }
        const integration = step.integrations.find(i => i.id === integrationId);
        if (!integration) { return { success: false, message: 'Integration nicht gefunden.' }; }

        // Check that required fields are filled
        const hasAllFields = integration.fields.every(f => {
            const val = localStorage.getItem(f.name);
            return val && val.trim() !== '';
        });
        if (!hasAllFields) {
            return { success: false, message: 'Bitte alle Felder ausfüllen.' };
        }

        try {
            switch (integrationId) {
                case 'paperless': {
                    const url = localStorage.getItem('freyai_paperless_url');
                    const token = localStorage.getItem('freyai_paperless_token');
                    const resp = await fetch(`${url}/api/documents/?page_size=1`, {
                        headers: { 'Authorization': `Token ${token}` }
                    });
                    return resp.ok
                        ? { success: true, message: 'Paperless-ngx verbunden.' }
                        : { success: false, message: `Fehler: HTTP ${resp.status}` };
                }
                case 'calcom': {
                    const url = localStorage.getItem('freyai_calcom_url');
                    const key = localStorage.getItem('freyai_calcom_api_key');
                    const resp = await fetch(`${url}/api/v1/me`, {
                        headers: { 'Authorization': `Bearer ${key}` }
                    });
                    return resp.ok
                        ? { success: true, message: 'Cal.com verbunden.' }
                        : { success: false, message: `Fehler: HTTP ${resp.status}` };
                }
                case 'postiz': {
                    const url = localStorage.getItem('freyai_postiz_url');
                    const key = localStorage.getItem('freyai_postiz_api_key');
                    const resp = await fetch(`${url}/api/posts?limit=1`, {
                        headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' }
                    });
                    return resp.ok
                        ? { success: true, message: 'Postiz verbunden.' }
                        : { success: false, message: `Fehler: HTTP ${resp.status}` };
                }
                case 'whatsapp': {
                    const url = localStorage.getItem('freyai_whatsapp_api_url');
                    const key = localStorage.getItem('freyai_whatsapp_api_key');
                    const instance = localStorage.getItem('freyai_whatsapp_instance');
                    const resp = await fetch(`${url}/instance/connectionState/${instance}`, {
                        headers: { 'apikey': key }
                    });
                    return resp.ok
                        ? { success: true, message: 'WhatsApp verbunden.' }
                        : { success: false, message: `Fehler: HTTP ${resp.status}` };
                }
                default:
                    return { success: false, message: 'Unbekannte Integration.' };
            }
        } catch (err) {
            return { success: false, message: `Verbindungsfehler: ${err.message}` };
        }
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
                telefon:       'phone',
                email:         'email',
                iban:          'iban',
                bic:           'bic',
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

            console.warn('[SetupWizard] Fragebogen-Import erkannt. Starte Import-Flow...');

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
