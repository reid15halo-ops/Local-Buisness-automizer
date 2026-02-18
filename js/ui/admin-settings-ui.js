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
            errorDiv.textContent = 'Falsches Passwort. Bitte versuchen Sie es erneut. Falls Sie das Passwort vergessen haben, wenden Sie sich an Ihren IT-Betreuer oder an den App-Support.';
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
                    <p class="admin-warning">⚠️ Diese Einstellungen sind nur für Administratoren. Falsche Eingaben können dazu führen, dass E-Mails nicht mehr versendet werden oder Daten nicht mehr gespeichert werden. Nur ändern, wenn Sie wissen, was Sie tun.</p>
                </div>

                <div class="admin-settings-body">
                    <form id="admin-settings-form">
                        <div class="admin-settings-section">
                            <h3>Datenspeicher (Cloud-Backup)</h3>
                            <div class="admin-field">
                                <label for="setting-supabase_url">Server-Adresse</label>
                                <input
                                    type="url"
                                    id="setting-supabase_url"
                                    class="admin-input"
                                    placeholder="https://xyz.supabase.co"
                                />
                                <p class="admin-hint">Die Internet-Adresse Ihres Cloud-Speichers, damit Ihre Daten gesichert werden. Erhalten Sie bei der App-Einrichtung von Ihrem IT-Betreuer.</p>
                            </div>
                            <div class="admin-field">
                                <label for="setting-supabase_anon_key">Zugriffsschlüssel für den Datenspeicher</label>
                                <input
                                    type="password"
                                    id="setting-supabase_anon_key"
                                    class="admin-input"
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                                />
                                <p class="admin-hint">Geheimer Schlüssel für den Cloud-Speicher. Gehört zusammen mit der Server-Adresse oben. Von Ihrem IT-Betreuer bereitgestellt.</p>
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>E-Mail-Versand</h3>
                            <div class="admin-field">
                                <label for="setting-resend_api_key">Zugriffsschlüssel für E-Mail-Versand</label>
                                <input
                                    type="password"
                                    id="setting-resend_api_key"
                                    class="admin-input"
                                    placeholder="re_..."
                                />
                                <p class="admin-hint">Damit die App automatisch E-Mails versenden kann (z. B. Rechnungen an Kunden). Den Schlüssel erhalten Sie unter resend.com — kostenlos bis 100 E-Mails/Tag.</p>
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>Künstliche Intelligenz (KI-Assistent) — optional</h3>
                            <div class="admin-field">
                                <label for="setting-gemini_api_key">Zugriffsschlüssel für den KI-Assistenten</label>
                                <input
                                    type="password"
                                    id="setting-gemini_api_key"
                                    class="admin-input"
                                    placeholder="AIzaSy..."
                                />
                                <p class="admin-hint">Optional. Ermöglicht dem Computer, automatisch Angebotstexte und Zeitschätzungen zu erstellen. Schlüssel kostenlos erhältlich unter aistudio.google.com. Wenn leer gelassen, funktioniert die App normal — nur ohne KI-Hilfe.</p>
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>Online-Zahlung annehmen — optional</h3>
                            <div class="admin-field">
                                <label for="setting-stripe_publishable_key">Zugriffsschlüssel für Online-Zahlung</label>
                                <input
                                    type="password"
                                    id="setting-stripe_publishable_key"
                                    class="admin-input"
                                    placeholder="pk_live_..."
                                />
                                <p class="admin-hint">Optional. Damit Ihre Kunden Rechnungen direkt online per Kreditkarte bezahlen können. Konto und Schlüssel erhalten Sie unter stripe.com. Wenn Sie keine Online-Zahlung benötigen, lassen Sie dieses Feld leer.</p>
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>Automatisierung — nur für IT-Fachleute (optional)</h3>
                            <div class="admin-field">
                                <label for="setting-n8n_webhook_url">Automatisierungs-Adresse</label>
                                <input
                                    type="url"
                                    id="setting-n8n_webhook_url"
                                    class="admin-input"
                                    placeholder="https://..."
                                />
                                <p class="admin-hint">Sehr fortgeschrittene Einstellung für IT-Fachleute. Ermöglicht Verbindung zu externen Automatisierungswerkzeugen. Wenn Sie nicht wissen, was das ist — lassen Sie das Feld leer.</p>
                            </div>
                        </div>

                        <div class="admin-settings-section">
                            <h3>Steuer &amp; Geschäftsmodell</h3>
                            <div class="admin-field">
                                <label class="checkbox-label">
                                    <input
                                        type="checkbox"
                                        id="setting-kleinunternehmer"
                                        class="admin-checkbox"
                                    />
                                    <span>Kleinunternehmer-Regelung (keine Mehrwertsteuer auf Rechnungen)</span>
                                </label>
                                <p class="admin-hint">Aktivieren, wenn Ihr Jahresumsatz unter 22.000 € liegt und Sie beim Finanzamt als Kleinunternehmer eingetragen sind. Wirkung: Alle neuen Rechnungen werden OHNE Mehrwertsteuer erstellt. Im Zweifel Ihren Steuerberater fragen.</p>
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

            // Save settings.
            // Warn if a Gemini API key is being persisted to localStorage.
            // When Supabase is configured, the ai-proxy Edge Function handles Gemini calls server-side
            // using GEMINI_API_KEY from a Deno env var — no client-side key is needed in that case.
            const geminiKeyInput = document.getElementById('setting-gemini_api_key');
            if (geminiKeyInput?.value) {
                console.warn('[Security] Gemini API key saved to localStorage via settings panel. This key is readable by any script on this page. For production use, configure the ai-proxy Supabase Edge Function with the GEMINI_API_KEY environment variable instead.');
            }
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
            window.errorHandler?.success('Einstellungen erfolgreich gespeichert!');
            this.closeSettings(modal);
        } catch (err) {
            errorsDiv.innerHTML = `<div class="error-message">⚠️ ${h(err.message)}</div>`;
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
