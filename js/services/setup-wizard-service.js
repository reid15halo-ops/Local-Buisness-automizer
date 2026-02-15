/* ============================================
   Setup Wizard Service
   Guides users through API key configuration
   ============================================ */

class SetupWizardService {
    constructor() {
        this.currentStep = 0;
        this.steps = [
            {
                id: 'supabase',
                title: 'Supabase Backend',
                description: 'Kostenloser Backend-Service für Datenbank & Cloud-Funktionen',
                required: true,
                fields: [
                    {
                        name: 'supabase_url',
                        label: 'Project URL',
                        placeholder: 'https://xyz.supabase.co',
                        type: 'url'
                    },
                    {
                        name: 'supabase_anon_key',
                        label: 'Anon Key',
                        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
                        type: 'password'
                    }
                ],
                links: [
                    {
                        text: 'Kostenloses Projekt erstellen',
                        url: 'https://supabase.com/dashboard',
                        icon: '🚀'
                    },
                    {
                        text: 'API Keys finden',
                        url: 'https://supabase.com/dashboard/project/_/settings/api',
                        icon: '🔑'
                    }
                ],
                instructions: [
                    'Erstelle ein kostenloses Supabase-Projekt',
                    'Gehe zu Settings → API',
                    'Kopiere Project URL und anon/public key'
                ]
            },
            {
                id: 'gemini',
                title: 'Google Gemini AI',
                description: 'KI für automatische Analyse von Kundenanfragen',
                required: true,
                fields: [
                    {
                        name: 'gemini_api_key',
                        label: 'API Key',
                        placeholder: 'AIzaSy...',
                        type: 'password'
                    }
                ],
                links: [
                    {
                        text: 'Kostenlosen API Key erstellen',
                        url: 'https://aistudio.google.com/apikey',
                        icon: '🤖'
                    }
                ],
                instructions: [
                    'Melde dich mit Google-Account an',
                    'Klicke "Create API Key"',
                    'Wähle "Create API key in new project"',
                    'Kopiere den generierten Key'
                ]
            },
            {
                id: 'resend',
                title: 'Resend Email Service',
                description: 'Email-Versand für Angebote & Rechnungen (100/Tag kostenlos)',
                required: true,
                fields: [
                    {
                        name: 'resend_api_key',
                        label: 'API Key',
                        placeholder: 're_...',
                        type: 'password'
                    }
                ],
                links: [
                    {
                        text: 'Kostenloses Konto erstellen',
                        url: 'https://resend.com/signup',
                        icon: '📧'
                    }
                ],
                instructions: [
                    'Registriere dich mit Email',
                    'Gehe zu API Keys im Dashboard',
                    'Klicke "Create API Key"',
                    'Name: "Business-Automizer"',
                    'Kopiere den Key'
                ]
            },
            {
                id: 'complete',
                title: 'Setup abgeschlossen! 🎉',
                description: 'Alle APIs sind konfiguriert. Die App ist jetzt einsatzbereit.',
                required: false,
                fields: [],
                links: [],
                instructions: []
            }
        ];
    }

    /**
     * Check if setup is complete
     */
    isSetupComplete() {
        const requiredKeys = [
            'supabase_url',
            'supabase_anon_key',
            'gemini_api_key',
            'resend_api_key'
        ];

        return requiredKeys.every(key => {
            const value = localStorage.getItem(key);
            return value && value.trim() !== '';
        });
    }

    /**
     * Get missing API keys
     */
    getMissingKeys() {
        const allKeys = [
            { key: 'supabase_url', name: 'Supabase URL' },
            { key: 'supabase_anon_key', name: 'Supabase Anon Key' },
            { key: 'gemini_api_key', name: 'Gemini API Key' },
            { key: 'resend_api_key', name: 'Resend API Key' }
        ];

        return allKeys.filter(({ key }) => {
            const value = localStorage.getItem(key);
            return !value || value.trim() === '';
        });
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
        if (!step.required || step.fields.length === 0) {
            return { valid: true, errors: [] };
        }

        const errors = [];
        for (const field of step.fields) {
            const value = localStorage.getItem(field.name);

            if (!value || value.trim() === '') {
                errors.push(`${field.label} ist erforderlich`);
                continue;
            }

            // URL validation
            if (field.type === 'url' && !this._isValidUrl(value)) {
                errors.push(`${field.label} muss eine gültige URL sein`);
            }

            // Basic format checks
            if (field.name === 'supabase_anon_key' && !value.startsWith('eyJ')) {
                errors.push('Supabase Anon Key sollte mit "eyJ" beginnen');
            }
            if (field.name === 'gemini_api_key' && !value.startsWith('AIzaSy')) {
                errors.push('Gemini API Key sollte mit "AIzaSy" beginnen');
            }
            if (field.name === 'resend_api_key' && !value.startsWith('re_')) {
                errors.push('Resend API Key sollte mit "re_" beginnen');
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
        localStorage.setItem(fieldName, value.trim());

        // Trigger Supabase config update if needed
        if (fieldName === 'supabase_url' || fieldName === 'supabase_anon_key') {
            const url = localStorage.getItem('supabase_url');
            const key = localStorage.getItem('supabase_anon_key');
            if (url && key && window.supabaseConfig) {
                window.supabaseConfig.update(url, key);
            }
        }
    }

    /**
     * Test API connection
     */
    async testConnection(stepId) {
        switch (stepId) {
            case 'supabase':
                return await this._testSupabase();
            case 'gemini':
                return await this._testGemini();
            case 'resend':
                return await this._testResend();
            default:
                return { success: true, message: 'Keine Tests verfügbar' };
        }
    }

    async _testSupabase() {
        try {
            const url = localStorage.getItem('supabase_url');
            const key = localStorage.getItem('supabase_anon_key');

            const response = await fetch(`${url}/rest/v1/`, {
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`
                }
            });

            if (response.ok || response.status === 404) {
                return { success: true, message: 'Verbindung erfolgreich! ✓' };
            }
            return { success: false, message: 'Verbindung fehlgeschlagen. Prüfe URL und Key.' };
        } catch (err) {
            return { success: false, message: `Fehler: ${err.message}` };
        }
    }

    async _testGemini() {
        try {
            const key = localStorage.getItem('gemini_api_key');
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
            );

            if (response.ok) {
                return { success: true, message: 'API Key gültig! ✓' };
            }
            return { success: false, message: 'API Key ungültig.' };
        } catch (err) {
            return { success: false, message: `Fehler: ${err.message}` };
        }
    }

    async _testResend() {
        // Can't really test without sending email, just validate format
        const key = localStorage.getItem('resend_api_key');
        if (key && key.startsWith('re_')) {
            return { success: true, message: 'API Key Format korrekt ✓' };
        }
        return { success: false, message: 'Ungültiges API Key Format' };
    }

    _isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    /**
     * Reset setup (for testing or re-configuration)
     */
    resetSetup() {
        const keys = [
            'supabase_url',
            'supabase_anon_key',
            'gemini_api_key',
            'resend_api_key'
        ];

        keys.forEach(key => localStorage.removeItem(key));
        this.currentStep = 0;
    }

    /**
     * Export configuration (for backup)
     */
    exportConfig() {
        return {
            supabase_url: localStorage.getItem('supabase_url'),
            supabase_anon_key: localStorage.getItem('supabase_anon_key'),
            gemini_api_key: localStorage.getItem('gemini_api_key'),
            resend_api_key: localStorage.getItem('resend_api_key'),
            exported_at: new Date().toISOString()
        };
    }

    /**
     * Import configuration (from backup)
     */
    importConfig(config) {
        Object.entries(config).forEach(([key, value]) => {
            if (key !== 'exported_at' && value) {
                localStorage.setItem(key, value);
            }
        });
    }
}

// Global instance
window.setupWizard = new SetupWizardService();
