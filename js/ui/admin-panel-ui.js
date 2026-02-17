/* ============================================
   Admin Panel UI
   Full-page admin panel with login gate
   Two tiers: Admin (business) & Developer (technical)
   ============================================ */

class AdminPanelUI {
    constructor() {
        this.service = window.adminPanelService;
        this.container = null;
    }

    /**
     * Initialize the admin panel view content
     * Called when navigating to view-admin-panel
     */
    init() {
        this.container = document.getElementById('admin-panel-content');
        if (!this.container) {return;}

        // Listen for session expiry
        document.addEventListener('mhs:admin-session-expired', () => {
            this.renderLogin();
        });

        if (this.service.isAuthenticated()) {
            this.renderPanel();
        } else {
            this.renderLogin();
        }
    }

    // ============================================
    // Login Screen
    // ============================================

    renderLogin() {
        if (!this.container) {return;}

        this.container.innerHTML = `
            <div class="admin-panel-login">
                <div class="admin-panel-login-card">
                    <div class="admin-panel-login-icon">🔐</div>
                    <h2>Admin-Bereich</h2>
                    <p class="admin-panel-login-subtitle">Bitte melden Sie sich an, um auf die Verwaltung zuzugreifen.</p>

                    <div class="admin-panel-warning-box admin-panel-warning-info">
                        <div class="admin-panel-warning-icon">ℹ️</div>
                        <div>
                            <strong>Hinweis:</strong> Dieser Bereich enthält die Grundstruktur der Anwendung.
                            Änderungen können die Software beeinträchtigen.
                        </div>
                    </div>

                    <form id="admin-panel-login-form" class="admin-panel-login-form">
                        <div class="admin-panel-field">
                            <label for="admin-login-username">Benutzername</label>
                            <input
                                type="text"
                                id="admin-login-username"
                                class="admin-panel-input"
                                placeholder="Benutzername eingeben"
                                autocomplete="username"
                                required
                            />
                        </div>
                        <div class="admin-panel-field">
                            <label for="admin-login-password">Passwort</label>
                            <input
                                type="password"
                                id="admin-login-password"
                                class="admin-panel-input"
                                placeholder="Passwort eingeben"
                                autocomplete="current-password"
                                required
                            />
                        </div>
                        <div class="admin-panel-login-error" id="admin-login-error" style="display: none;"></div>
                        <button type="submit" class="btn btn-primary admin-panel-login-btn">Anmelden</button>
                    </form>

                    <div class="admin-panel-login-hint">
                        <details>
                            <summary>Zugangsdaten vergessen?</summary>
                            <p>Kontaktieren Sie Ihren Systemadministrator oder Developer, um die Zugangsdaten zurückzusetzen.</p>
                        </details>
                    </div>
                </div>
            </div>
        `;

        // Attach login handler
        const form = document.getElementById('admin-panel-login-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleLogin();
        });

        // Focus username field
        setTimeout(() => {
            const usernameInput = document.getElementById('admin-login-username');
            if (usernameInput) {usernameInput.focus();}
        }, 100);
    }

    _handleLogin() {
        const username = document.getElementById('admin-login-username').value.trim();
        const password = document.getElementById('admin-login-password').value;
        const errorDiv = document.getElementById('admin-login-error');

        if (!username || !password) {
            errorDiv.textContent = 'Bitte Benutzername und Passwort eingeben.';
            errorDiv.style.display = 'block';
            return;
        }

        const result = this.service.authenticate(username, password);

        if (result.success) {
            this.renderPanel();
        } else {
            errorDiv.textContent = result.error;
            errorDiv.style.display = 'block';
            document.getElementById('admin-login-password').value = '';
            document.getElementById('admin-login-password').focus();
        }
    }

    // ============================================
    // Main Panel (after login)
    // ============================================

    renderPanel() {
        if (!this.container) {return;}

        const isDev = this.service.isDeveloper();
        const roleLabel = this.service.getRoleLabel();

        this.container.innerHTML = `
            <!-- Session Header -->
            <div class="admin-panel-session-bar">
                <div class="admin-panel-session-info">
                    <span class="admin-panel-role-badge ${isDev ? 'role-developer' : 'role-admin'}">
                        ${isDev ? '👨‍💻' : '🔧'} ${roleLabel}
                    </span>
                    <span class="admin-panel-session-text">Angemeldet als <strong>${roleLabel}</strong></span>
                </div>
                <button class="btn btn-secondary btn-small" id="admin-panel-logout">🚪 Abmelden</button>
            </div>

            <!-- Warning Banner -->
            <div class="admin-panel-warning-box admin-panel-warning-danger">
                <div class="admin-panel-warning-icon">⚠️</div>
                <div>
                    <strong>Achtung — Systemkonfiguration</strong><br>
                    Dies ist die Grundstruktur der Anwendung. Änderungen in diesem Bereich können die
                    Software beeinträchtigen oder dazu führen, dass Funktionen nicht mehr korrekt arbeiten.
                    Bitte nehmen Sie nur Änderungen vor, wenn Sie wissen, was Sie tun.
                </div>
            </div>

            <!-- Tab Navigation -->
            <div class="admin-panel-tabs">
                <button class="admin-panel-tab active" data-tab="business">
                    🏢 Firmendaten
                </button>
                <button class="admin-panel-tab" data-tab="financial">
                    💰 Finanzen & Steuern
                </button>
                <button class="admin-panel-tab" data-tab="credentials">
                    🔑 Zugangsdaten
                </button>
                ${isDev ? `
                <button class="admin-panel-tab tab-developer" data-tab="technical">
                    🛠️ Technische Konfiguration
                </button>
                <button class="admin-panel-tab tab-developer" data-tab="database">
                    🗄️ Datenbank & APIs
                </button>
                ` : ''}
            </div>

            <!-- Tab Content -->
            <div class="admin-panel-tab-content" id="admin-panel-tab-content">
                <!-- Rendered dynamically -->
            </div>
        `;

        // Attach tab handlers
        this.container.querySelectorAll('.admin-panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.container.querySelectorAll('.admin-panel-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._renderTab(tab.dataset.tab);
            });
        });

        // Attach logout handler
        document.getElementById('admin-panel-logout').addEventListener('click', () => {
            this.service.logout();
            this.renderLogin();
        });

        // Render first tab
        this._renderTab('business');
    }

    // ============================================
    // Tab Rendering
    // ============================================

    _renderTab(tabId) {
        const content = document.getElementById('admin-panel-tab-content');
        if (!content) {return;}

        switch (tabId) {
            case 'business':
                this._renderBusinessTab(content);
                break;
            case 'financial':
                this._renderFinancialTab(content);
                break;
            case 'credentials':
                this._renderCredentialsTab(content);
                break;
            case 'technical':
                if (this.service.isDeveloper()) {
                    this._renderTechnicalTab(content);
                }
                break;
            case 'database':
                if (this.service.isDeveloper()) {
                    this._renderDatabaseTab(content);
                }
                break;
        }
    }

    // ---- Business Settings Tab ----
    _renderBusinessTab(content) {
        const settings = this.service.getBusinessSettings();

        content.innerHTML = `
            <div class="admin-panel-section">
                <h3>🏢 Firmendaten</h3>
                <p class="admin-panel-section-desc">Grundlegende Informationen über Ihr Unternehmen. Diese Daten erscheinen auf Angeboten, Rechnungen und Dokumenten.</p>

                <div class="admin-panel-form-grid">
                    <div class="admin-panel-field">
                        <label for="ap-company-name">Firmenname *</label>
                        <input type="text" id="ap-company-name" class="admin-panel-input" value="${this._esc(settings.company_name)}" placeholder="Müller Metallbau GmbH" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-owner-name">Inhaber / Geschäftsführer *</label>
                        <input type="text" id="ap-owner-name" class="admin-panel-input" value="${this._esc(settings.owner_name)}" placeholder="Max Müller" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-address-street">Straße & Hausnummer *</label>
                        <input type="text" id="ap-address-street" class="admin-panel-input" value="${this._esc(settings.address_street)}" placeholder="Hauptstraße 42" />
                    </div>
                    <div class="admin-panel-field-row">
                        <div class="admin-panel-field" style="flex: 0 0 120px;">
                            <label for="ap-address-postal">PLZ *</label>
                            <input type="text" id="ap-address-postal" class="admin-panel-input" value="${this._esc(settings.address_postal)}" placeholder="74523" maxlength="5" />
                        </div>
                        <div class="admin-panel-field" style="flex: 1;">
                            <label for="ap-address-city">Stadt *</label>
                            <input type="text" id="ap-address-city" class="admin-panel-input" value="${this._esc(settings.address_city)}" placeholder="Schwäbisch Hall" />
                        </div>
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-company-email">E-Mail-Adresse</label>
                        <input type="email" id="ap-company-email" class="admin-panel-input" value="${this._esc(settings.company_email)}" placeholder="info@firma.de" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-company-phone">Telefon</label>
                        <input type="tel" id="ap-company-phone" class="admin-panel-input" value="${this._esc(settings.company_phone)}" placeholder="+49 123 456789" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-company-website">Website</label>
                        <input type="url" id="ap-company-website" class="admin-panel-input" value="${this._esc(settings.company_website)}" placeholder="https://www.firma.de" />
                    </div>
                </div>

                <div class="admin-panel-actions">
                    <button class="btn btn-primary" id="ap-save-business">Firmendaten speichern</button>
                    <span class="admin-panel-save-status" id="ap-business-status"></span>
                </div>
            </div>
        `;

        document.getElementById('ap-save-business').addEventListener('click', () => {
            this._saveBusinessSettings();
        });
    }

    _saveBusinessSettings() {
        const fields = {
            company_name: 'ap-company-name',
            owner_name: 'ap-owner-name',
            address_street: 'ap-address-street',
            address_postal: 'ap-address-postal',
            address_city: 'ap-address-city',
            company_email: 'ap-company-email',
            company_phone: 'ap-company-phone',
            company_website: 'ap-company-website'
        };

        let allSaved = true;
        for (const [key, inputId] of Object.entries(fields)) {
            const input = document.getElementById(inputId);
            if (input) {
                if (!this.service.saveBusinessSetting(key, input.value)) {
                    allSaved = false;
                }
            }
        }

        const status = document.getElementById('ap-business-status');
        if (status) {
            status.textContent = allSaved ? '✅ Gespeichert!' : '❌ Fehler beim Speichern';
            status.className = `admin-panel-save-status ${allSaved ? 'success' : 'error'}`;
            setTimeout(() => { status.textContent = ''; }, 3000);
        }
    }

    // ---- Financial Settings Tab ----
    _renderFinancialTab(content) {
        const settings = this.service.getBusinessSettings();

        content.innerHTML = `
            <div class="admin-panel-section">
                <h3>💰 Steuer & Finanzen</h3>
                <p class="admin-panel-section-desc">Steuer- und Zahlungseinstellungen für Rechnungen und Buchhaltung.</p>

                <div class="admin-panel-form-grid">
                    <div class="admin-panel-field">
                        <label for="ap-tax-number">Steuernummer / USt-IdNr *</label>
                        <input type="text" id="ap-tax-number" class="admin-panel-input" value="${this._esc(settings.tax_number)}" placeholder="75 123 456 789 oder DE 123456789" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-vat-rate">Standard MwSt.-Satz (%)</label>
                        <input type="number" id="ap-vat-rate" class="admin-panel-input" value="${this._esc(settings.default_vat_rate)}" min="0" max="100" step="0.5" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-payment-terms">Zahlungsziel (Tage)</label>
                        <input type="number" id="ap-payment-terms" class="admin-panel-input" value="${this._esc(settings.payment_terms_days)}" min="0" max="365" />
                    </div>
                    <div class="admin-panel-field admin-panel-checkbox-field">
                        <label>
                            <input type="checkbox" id="ap-kleinunternehmer" ${settings.kleinunternehmer ? 'checked' : ''} />
                            <span>Kleinunternehmer-Regelung (§19 UStG)</span>
                        </label>
                        <p class="admin-panel-hint">Wenn aktiv, wird keine Umsatzsteuer auf Rechnungen ausgewiesen.</p>
                    </div>
                </div>
            </div>

            <div class="admin-panel-section">
                <h3>🏦 Bankverbindung</h3>
                <p class="admin-panel-section-desc">Ihre Bankdaten für Rechnungen und Zahlungsinformationen.</p>

                <div class="admin-panel-form-grid">
                    <div class="admin-panel-field">
                        <label for="ap-bank-name">Bank / Kreditinstitut</label>
                        <input type="text" id="ap-bank-name" class="admin-panel-input" value="${this._esc(settings.bank_name)}" placeholder="Sparkasse Schwäbisch Hall" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-bank-iban">IBAN</label>
                        <input type="text" id="ap-bank-iban" class="admin-panel-input" value="${this._esc(settings.bank_iban)}" placeholder="DE89 3704 0044 0532 0130 00" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-bank-bic">BIC</label>
                        <input type="text" id="ap-bank-bic" class="admin-panel-input" value="${this._esc(settings.bank_bic)}" placeholder="COBADEFFXXX" />
                    </div>
                </div>

                <div class="admin-panel-actions">
                    <button class="btn btn-primary" id="ap-save-financial">Finanzdaten speichern</button>
                    <span class="admin-panel-save-status" id="ap-financial-status"></span>
                </div>
            </div>
        `;

        document.getElementById('ap-save-financial').addEventListener('click', () => {
            this._saveFinancialSettings();
        });
    }

    _saveFinancialSettings() {
        const fields = {
            tax_number: 'ap-tax-number',
            default_vat_rate: 'ap-vat-rate',
            payment_terms_days: 'ap-payment-terms',
            bank_name: 'ap-bank-name',
            bank_iban: 'ap-bank-iban',
            bank_bic: 'ap-bank-bic'
        };

        let allSaved = true;
        for (const [key, inputId] of Object.entries(fields)) {
            const input = document.getElementById(inputId);
            if (input) {
                if (!this.service.saveBusinessSetting(key, input.value)) {
                    allSaved = false;
                }
            }
        }

        // Kleinunternehmer checkbox
        const ku = document.getElementById('ap-kleinunternehmer');
        if (ku) {
            this.service.saveBusinessSetting('kleinunternehmer', ku.checked);
        }

        const status = document.getElementById('ap-financial-status');
        if (status) {
            status.textContent = allSaved ? '✅ Gespeichert!' : '❌ Fehler beim Speichern';
            status.className = `admin-panel-save-status ${allSaved ? 'success' : 'error'}`;
            setTimeout(() => { status.textContent = ''; }, 3000);
        }
    }

    // ---- Credentials Tab ----
    _renderCredentialsTab(content) {
        const isDev = this.service.isDeveloper();

        content.innerHTML = `
            <div class="admin-panel-section">
                <h3>🔑 Admin-Zugangsdaten ändern</h3>
                <p class="admin-panel-section-desc">Ändern Sie die Anmeldedaten für den Administrator-Zugang.</p>

                <div class="admin-panel-form-grid">
                    <div class="admin-panel-field">
                        <label for="ap-admin-new-user">Neuer Admin-Benutzername</label>
                        <input type="text" id="ap-admin-new-user" class="admin-panel-input" placeholder="Mindestens 3 Zeichen" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-admin-new-pass">Neues Admin-Passwort</label>
                        <input type="password" id="ap-admin-new-pass" class="admin-panel-input" placeholder="Mindestens 6 Zeichen" />
                    </div>
                </div>
                <div class="admin-panel-actions">
                    <button class="btn btn-primary" id="ap-save-admin-creds">Admin-Zugangsdaten speichern</button>
                    <span class="admin-panel-save-status" id="ap-admin-creds-status"></span>
                </div>
            </div>

            ${isDev ? `
            <div class="admin-panel-section">
                <h3>👨‍💻 Developer-Zugangsdaten ändern</h3>
                <p class="admin-panel-section-desc">Ändern Sie die Anmeldedaten für den Developer-Zugang. Nur als Developer sichtbar.</p>

                <div class="admin-panel-warning-box admin-panel-warning-danger">
                    <div class="admin-panel-warning-icon">⚠️</div>
                    <div>Wenn Sie diese Zugangsdaten vergessen, können sie nur durch direkten Zugriff auf den localStorage zurückgesetzt werden.</div>
                </div>

                <div class="admin-panel-form-grid">
                    <div class="admin-panel-field">
                        <label for="ap-dev-new-user">Neuer Developer-Benutzername</label>
                        <input type="text" id="ap-dev-new-user" class="admin-panel-input" placeholder="Mindestens 3 Zeichen" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-dev-new-pass">Neues Developer-Passwort</label>
                        <input type="password" id="ap-dev-new-pass" class="admin-panel-input" placeholder="Mindestens 6 Zeichen" />
                    </div>
                </div>
                <div class="admin-panel-actions">
                    <button class="btn btn-primary" id="ap-save-dev-creds">Developer-Zugangsdaten speichern</button>
                    <span class="admin-panel-save-status" id="ap-dev-creds-status"></span>
                </div>
            </div>
            ` : ''}
        `;

        // Admin credentials save
        document.getElementById('ap-save-admin-creds').addEventListener('click', () => {
            const user = document.getElementById('ap-admin-new-user').value;
            const pass = document.getElementById('ap-admin-new-pass').value;
            const result = this.service.changeCredentials('admin', user, pass);
            const status = document.getElementById('ap-admin-creds-status');
            if (result.success) {
                status.textContent = '✅ Gespeichert!';
                status.className = 'admin-panel-save-status success';
                document.getElementById('ap-admin-new-user').value = '';
                document.getElementById('ap-admin-new-pass').value = '';
            } else {
                status.textContent = `❌ ${result.error}`;
                status.className = 'admin-panel-save-status error';
            }
            setTimeout(() => { status.textContent = ''; }, 4000);
        });

        // Developer credentials save
        if (isDev) {
            document.getElementById('ap-save-dev-creds').addEventListener('click', () => {
                const user = document.getElementById('ap-dev-new-user').value;
                const pass = document.getElementById('ap-dev-new-pass').value;
                const result = this.service.changeCredentials('developer', user, pass);
                const status = document.getElementById('ap-dev-creds-status');
                if (result.success) {
                    status.textContent = '✅ Gespeichert!';
                    status.className = 'admin-panel-save-status success';
                    document.getElementById('ap-dev-new-user').value = '';
                    document.getElementById('ap-dev-new-pass').value = '';
                } else {
                    status.textContent = `❌ ${result.error}`;
                    status.className = 'admin-panel-save-status error';
                }
                setTimeout(() => { status.textContent = ''; }, 4000);
            });
        }
    }

    // ---- Technical Config Tab (Developer only) ----
    _renderTechnicalTab(content) {
        const settings = this.service.getTechnicalSettings();

        content.innerHTML = `
            <div class="admin-panel-warning-box admin-panel-warning-danger">
                <div class="admin-panel-warning-icon">🛑</div>
                <div>
                    <strong>Developer-Bereich</strong><br>
                    Dieser Bereich enthält technische Konfigurationen, die die Grundstruktur der App betreffen.
                    Falsche Werte können dazu führen, dass die Anwendung nicht mehr funktioniert.
                </div>
            </div>

            <div class="admin-panel-section">
                <h3>📧 E-Mail-Konfiguration</h3>
                <div class="admin-panel-form-grid">
                    <div class="admin-panel-field">
                        <label for="ap-resend-key">Resend API Key</label>
                        <input type="password" id="ap-resend-key" class="admin-panel-input" value="${this._esc(settings.resend_api_key)}" placeholder="re_..." />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-email-relay-url">E-Mail Relay URL</label>
                        <input type="url" id="ap-email-relay-url" class="admin-panel-input" value="${this._esc(settings.email_relay_url)}" placeholder="https://dein-vps:3100" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-email-relay-secret">E-Mail Relay Secret</label>
                        <input type="password" id="ap-email-relay-secret" class="admin-panel-input" value="${this._esc(settings.email_relay_secret)}" placeholder="Geheimschlüssel..." />
                    </div>
                </div>
            </div>

            <div class="admin-panel-section">
                <h3>🤖 KI & Automation</h3>
                <div class="admin-panel-form-grid">
                    <div class="admin-panel-field">
                        <label for="ap-gemini-key">Google Gemini API Key</label>
                        <input type="password" id="ap-gemini-key" class="admin-panel-input" value="${this._esc(settings.gemini_api_key)}" placeholder="AIzaSy..." />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-n8n-url">n8n Webhook URL</label>
                        <input type="url" id="ap-n8n-url" class="admin-panel-input" value="${this._esc(settings.n8n_webhook_url)}" placeholder="https://n8n.example.com/webhook/..." />
                    </div>
                </div>
            </div>

            <div class="admin-panel-section">
                <h3>💳 Zahlungsanbieter</h3>
                <div class="admin-panel-form-grid">
                    <div class="admin-panel-field">
                        <label for="ap-stripe-key">Stripe Publishable Key</label>
                        <input type="password" id="ap-stripe-key" class="admin-panel-input" value="${this._esc(settings.stripe_publishable_key)}" placeholder="pk_live_..." />
                    </div>
                </div>
            </div>

            <div class="admin-panel-actions">
                <button class="btn btn-primary" id="ap-save-technical">Technische Einstellungen speichern</button>
                <span class="admin-panel-save-status" id="ap-technical-status"></span>
            </div>
        `;

        document.getElementById('ap-save-technical').addEventListener('click', () => {
            this._saveTechnicalSettings();
        });
    }

    _saveTechnicalSettings() {
        const fields = {
            resend_api_key: 'ap-resend-key',
            email_relay_url: 'ap-email-relay-url',
            email_relay_secret: 'ap-email-relay-secret',
            gemini_api_key: 'ap-gemini-key',
            n8n_webhook_url: 'ap-n8n-url',
            stripe_publishable_key: 'ap-stripe-key'
        };

        let allSaved = true;
        for (const [key, inputId] of Object.entries(fields)) {
            const input = document.getElementById(inputId);
            if (input && input.value) {
                if (!this.service.saveTechnicalSetting(key, input.value)) {
                    allSaved = false;
                }
            }
        }

        const status = document.getElementById('ap-technical-status');
        if (status) {
            status.textContent = allSaved ? '✅ Gespeichert!' : '❌ Fehler beim Speichern';
            status.className = `admin-panel-save-status ${allSaved ? 'success' : 'error'}`;
            setTimeout(() => { status.textContent = ''; }, 3000);
        }
    }

    // ---- Database & API Tab (Developer only) ----
    _renderDatabaseTab(content) {
        const settings = this.service.getTechnicalSettings();

        content.innerHTML = `
            <div class="admin-panel-warning-box admin-panel-warning-danger">
                <div class="admin-panel-warning-icon">🛑</div>
                <div>
                    <strong>Datenbank-Konfiguration</strong><br>
                    Falsche Supabase-Konfigurationen können zum Datenverlust führen.
                    Ändern Sie diese Werte nur, wenn Sie wissen, was Sie tun.
                </div>
            </div>

            <div class="admin-panel-section">
                <h3>🗄️ Supabase Backend</h3>
                <div class="admin-panel-form-grid">
                    <div class="admin-panel-field">
                        <label for="ap-supabase-url">Supabase Projekt-URL</label>
                        <input type="url" id="ap-supabase-url" class="admin-panel-input" value="${this._esc(settings.supabase_url)}" placeholder="https://xyz.supabase.co" />
                    </div>
                    <div class="admin-panel-field">
                        <label for="ap-supabase-key">Supabase Anon Key</label>
                        <input type="password" id="ap-supabase-key" class="admin-panel-input" value="${this._esc(settings.supabase_anon_key)}" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." />
                    </div>
                </div>
            </div>

            <div class="admin-panel-section">
                <h3>📊 Systemstatus</h3>
                <div class="admin-panel-system-info">
                    <div class="admin-panel-info-row">
                        <span>Supabase</span>
                        <span class="admin-panel-status-indicator ${settings.supabase_url ? 'status-ok' : 'status-off'}">${settings.supabase_url ? '● Konfiguriert' : '○ Nicht konfiguriert'}</span>
                    </div>
                    <div class="admin-panel-info-row">
                        <span>E-Mail (Resend)</span>
                        <span class="admin-panel-status-indicator ${settings.resend_api_key ? 'status-ok' : 'status-off'}">${settings.resend_api_key ? '● Konfiguriert' : '○ Nicht konfiguriert'}</span>
                    </div>
                    <div class="admin-panel-info-row">
                        <span>KI (Gemini)</span>
                        <span class="admin-panel-status-indicator ${settings.gemini_api_key ? 'status-ok' : 'status-off'}">${settings.gemini_api_key ? '● Konfiguriert' : '○ Nicht konfiguriert'}</span>
                    </div>
                    <div class="admin-panel-info-row">
                        <span>Zahlungen (Stripe)</span>
                        <span class="admin-panel-status-indicator ${settings.stripe_publishable_key ? 'status-ok' : 'status-off'}">${settings.stripe_publishable_key ? '● Konfiguriert' : '○ Nicht konfiguriert'}</span>
                    </div>
                    <div class="admin-panel-info-row">
                        <span>Webhook (n8n)</span>
                        <span class="admin-panel-status-indicator ${settings.n8n_webhook_url ? 'status-ok' : 'status-off'}">${settings.n8n_webhook_url ? '● Konfiguriert' : '○ Nicht konfiguriert'}</span>
                    </div>
                    <div class="admin-panel-info-row">
                        <span>localStorage Einträge</span>
                        <span>${localStorage.length}</span>
                    </div>
                </div>
            </div>

            <div class="admin-panel-actions">
                <button class="btn btn-primary" id="ap-save-database">Datenbank-Einstellungen speichern</button>
                <span class="admin-panel-save-status" id="ap-database-status"></span>
            </div>
        `;

        document.getElementById('ap-save-database').addEventListener('click', () => {
            const fields = {
                supabase_url: 'ap-supabase-url',
                supabase_anon_key: 'ap-supabase-key'
            };

            let allSaved = true;
            for (const [key, inputId] of Object.entries(fields)) {
                const input = document.getElementById(inputId);
                if (input && input.value) {
                    if (!this.service.saveTechnicalSetting(key, input.value)) {
                        allSaved = false;
                    }
                }
            }

            const status = document.getElementById('ap-database-status');
            if (status) {
                status.textContent = allSaved ? '✅ Gespeichert!' : '❌ Fehler beim Speichern';
                status.className = `admin-panel-save-status ${allSaved ? 'success' : 'error'}`;
                setTimeout(() => { status.textContent = ''; }, 3000);
            }
        });
    }

    // ============================================
    // Utility
    // ============================================

    /**
     * Escape HTML to prevent XSS
     */
    _esc(str) {
        if (!str) {return '';}
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Global instance
window.adminPanelUI = new AdminPanelUI();
