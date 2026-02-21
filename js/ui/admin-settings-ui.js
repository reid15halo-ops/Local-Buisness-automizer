/* ============================================
   Admin Technical Settings UI
   Hidden settings for technical configuration
   Protected by PIN (must be set via Admin Panel)
   ============================================ */

class AdminSettingsUI {
    constructor() {
        this.service = window.setupWizard;
        this.pinVerified = false;
    }

    /**
     * Show admin settings modal
     */
    show() {
        // Check if already logged in
        if (!this.pinVerified) {
            this.showPinPrompt();
        } else {
            this.showSettings();
        }
    }

    /**
     * Show PIN verification prompt
     */
    showPinPrompt() {
        const modal = document.createElement('div');
        modal.id = 'admin-pin-modal';
        modal.className = 'modal admin-pin-modal';
        modal.innerHTML = `
            <div class="modal-content admin-pin-content">
                <div class="admin-pin-header">
                    <h2>⚙️ Technische Einstellungen</h2>
                    <p>Bitte geben Sie das Administratorpasswort ein.</p>
                </div>

                <div class="admin-pin-body">
                    <div class="pin-field">
                        <label for="admin-pin-input">Passwort</label>
                        <input
                            type="password"
                            id="admin-pin-input"
                            class="admin-pin-input"
                            placeholder="••••••••"
                            autocomplete="off"
                        />
                    </div>
                    <div class="pin-error" id="pin-error" style="display: none;"></div>
                </div>

                <div class="admin-pin-footer">
                    <button type="button" class="btn-secondary" id="btn-pin-cancel">Abbrechen</button>
                    <button type="button" class="btn-primary" id="btn-pin-verify">Bestätigen</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.classList.add('visible');

        const pinInput = document.getElementById('admin-pin-input');
        const verifyBtn = document.getElementById('btn-pin-verify');
        const cancelBtn = document.getElementById('btn-pin-cancel');

        pinInput.focus();

        pinInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.verifyPin(pinInput, modal);
            }
        });

        verifyBtn.addEventListener('click', () => {
            this.verifyPin(pinInput, modal);
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('visible');
            setTimeout(() => modal.parentNode?.removeChild(modal), 300);
        });
    }

    /**
     * Verify PIN and show settings
     */
    verifyPin(pinInput, modal) {
        const pin = pinInput.value;
        const errorDiv = document.getElementById('pin-error');

        if (!this.service.verifyAdminPin(pin)) {
            errorDiv.textContent = 'Falsches Passwort. Bitte versuchen Sie es erneut.';
            errorDiv.style.display = 'block';
            pinInput.value = '';
            pinInput.focus();
            return;
        }

        this.pinVerified = true;
        modal.classList.remove('visible');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            this.showSettings();
        }, 300);
    }

    /**
     * Show admin settings form
     */
    showSettings() {
        const modal = document.createElement('div');
        modal.id = 'admin-settings-modal';
        modal.className = 'modal admin-settings-modal';
        modal.innerHTML = `
            <div class="modal-content admin-settings-content">
                <div class="admin-settings-header">
                    <h2>⚙️ Technische Einstellungen</h2>
                    <p class="admin-warning">⚠️ Diese Einstellungen sind nur für den Administrator gedacht. Änderungen können die Funktionalität der App beeinflussen.</p>
                </div>

                <div class="admin-settings-body">
                    <form id="admin-settings-form">
                        <div class="admin-settings-section">
                            <h3>Backend-Konfiguration</h3>
                            <div class="admin-field">
                                <label for="setting-supabase_url">Supabase Projekt-URL</label>
                                <input
                                    type="url"
                                    id="setting-supabase_url"
                                    class="admin-input"
                                    placeholder="https://xyz.supabase.co"
                                />
                            </div>
                            <div class="admin-field">
                                <label for="setting-supabase_anon_key">Supabase Anon Key</label>
                                <input
                                    type="password"
                                    id="setting-supabase_anon_key"
                                    class="admin-input"
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                                />
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>Email-Versand</h3>
                            <div class="admin-field">
                                <label for="setting-resend_api_key">Resend API Key</label>
                                <input
                                    type="password"
                                    id="setting-resend_api_key"
                                    class="admin-input"
                                    placeholder="re_..."
                                />
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>KI & Automation</h3>
                            <div class="admin-field">
                                <label for="setting-gemini_api_key">Google Gemini API Key (optional)</label>
                                <input
                                    type="password"
                                    id="setting-gemini_api_key"
                                    class="admin-input"
                                    placeholder="AIzaSy..."
                                />
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>Zahlungen</h3>
                            <div class="admin-field">
                                <label for="setting-stripe_publishable_key">Stripe Publishable Key (optional)</label>
                                <input
                                    type="password"
                                    id="setting-stripe_publishable_key"
                                    class="admin-input"
                                    placeholder="pk_live_..."
                                />
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>Webhooks & Integration</h3>
                            <div class="admin-field">
                                <label for="setting-n8n_webhook_url">n8n Webhook URL (optional)</label>
                                <input
                                    type="url"
                                    id="setting-n8n_webhook_url"
                                    class="admin-input"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>Geschäftsmodell</h3>
                            <div class="admin-field">
                                <label class="checkbox-label">
                                    <input
                                        type="checkbox"
                                        id="setting-kleinunternehmer"
                                        class="admin-checkbox"
                                    />
                                    <span>Kleinunternehmer-Regelung (ohne Umsatzsteuer)</span>
                                </label>
                                <p class="admin-hint">Aktivieren Sie dies, wenn Sie unter der Kleinunternehmer-Regelung tätig sind.</p>
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>Sicherheit</h3>
                            <div class="admin-field">
                                <label for="setting-admin_pin">Administratorpasswort ändern</label>
                                <input
                                    type="password"
                                    id="setting-admin_pin"
                                    class="admin-input"
                                    placeholder="Neues Passwort (mind. 4 Zeichen)"
                                />
                                <p class="admin-hint">Lassen Sie leer, um nicht zu ändern.</p>
                            </div>
                        </div>

                        <div class="admin-errors" id="admin-errors" style="display: none;"></div>
                    </form>
                </div>

                <div class="admin-settings-footer">
                    <button type="button" class="btn-secondary" id="btn-admin-cancel">Abbrechen</button>
                    <button type="button" class="btn-primary" id="btn-admin-save">Speichern</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.classList.add('visible');

        // Load current settings
        const settings = this.service.getAdminSettings();
        this.populateFields(settings);

        // Attach event listeners
        document.getElementById('btn-admin-cancel').addEventListener('click', () => {
            this.closeSettings(modal);
        });

        document.getElementById('btn-admin-save').addEventListener('click', () => {
            this.saveSettings(modal);
        });

        // Allow Escape to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeSettings(modal);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Populate form fields with current settings
     */
    populateFields(settings) {
        Object.entries(settings).forEach(([key, value]) => {
            const input = document.getElementById(`setting-${key}`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value === true;
                } else {
                    input.value = value || '';
                }
            }
        });
    }

    /**
     * Save admin settings
     */
    saveSettings(modal) {
        const errorsDiv = document.getElementById('admin-errors');
        errorsDiv.innerHTML = '';
        errorsDiv.style.display = 'none';

        try {
            // Get all input values
            const form = document.getElementById('admin-settings-form');
            const formData = new FormData(form);

            const newPin = document.getElementById('setting-admin_pin').value;
            if (newPin && newPin.length < 4) {
                throw new Error('Passwort muss mindestens 4 Zeichen lang sein.');
            }

            // Save settings
            ['supabase_url', 'supabase_anon_key', 'gemini_api_key', 'resend_api_key', 'stripe_publishable_key', 'n8n_webhook_url'].forEach(key => {
                const input = document.getElementById(`setting-${key}`);
                if (input?.value) {
                    this.service.saveAdminSetting(key, input.value);
                }
            });

            const kleinunternehmer = document.getElementById('setting-kleinunternehmer');
            if (kleinunternehmer) {
                this.service.saveAdminSetting('kleinunternehmer', kleinunternehmer.checked);
            }

            if (newPin) {
                if (!this.service.setAdminPin(newPin)) {
                    throw new Error('Passwort konnte nicht gespeichert werden.');
                }
            }

            // Show success and close
            alert('Einstellungen erfolgreich gespeichert!');
            this.closeSettings(modal);
        } catch (err) {
            errorsDiv.textContent = `⚠️ ${err.message}`;
            errorsDiv.style.display = 'block';
        }
    }

    /**
     * Close settings modal
     */
    closeSettings(modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            this.pinVerified = false;
        }, 300);
    }
}

// Global instance
window.adminSettingsUI = new AdminSettingsUI();
