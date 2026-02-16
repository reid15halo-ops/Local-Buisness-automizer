/* ============================================
   Setup Wizard UI
   User-friendly onboarding for Handwerker
   (German-language, non-technical, boomer-friendly)
   ============================================ */

class SetupWizardUI {
    constructor() {
        this.modal = null;
        this.service = window.setupWizard;
        this.logoPreview = null;
    }

    /**
     * Show the setup wizard
     */
    show() {
        this.render();
        // modal is already set in render()
        if (this.modal) {
            this.modal.classList.add('visible');
        }
        this.updateStepContent();
    }

    /**
     * Hide the wizard
     */
    hide() {
        if (this.modal) {
            this.modal.classList.remove('visible');
            setTimeout(() => {
                if (this.modal && this.modal.parentNode) {
                    this.modal.parentNode.removeChild(this.modal);
                }
                this.modal = null;
            }, 300);
        }
    }

    /**
     * Render wizard modal
     */
    render() {
        // Remove existing wizard if any
        const existing = document.getElementById('setup-wizard-modal');
        if (existing) {
            existing.parentNode.removeChild(existing);
        }

        const modal = document.createElement('div');
        modal.id = 'setup-wizard-modal';
        modal.className = 'modal setup-wizard-modal setup-wizard-user';
        modal.innerHTML = `
            <div class="modal-content wizard-content wizard-content-user">
                <div class="wizard-header wizard-header-user">
                    <h1 class="wizard-title-user">MHS Workflow</h1>
                    <p class="wizard-subtitle-user" id="wizard-subtitle"></p>
                </div>

                <div class="wizard-body wizard-body-user" id="wizard-body">
                    <!-- Dynamic content -->
                </div>

                <div class="wizard-footer wizard-footer-user">
                    <button type="button" class="btn-secondary btn-large" id="wizard-prev-btn" style="display: none;">
                        ← Zurück
                    </button>
                    <div class="wizard-footer-actions">
                        <button type="button" class="btn-primary btn-large" id="wizard-next-btn">
                            Weiter
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;
        this.attachEventListeners();
    }

    /**
     * Update step content
     */
    updateStepContent() {
        const step = this.service.getCurrentStep();
        const body = document.getElementById('wizard-body');
        const subtitle = document.getElementById('wizard-subtitle');

        subtitle.textContent = step.description;

        // Update buttons
        const prevBtn = document.getElementById('wizard-prev-btn');
        const nextBtn = document.getElementById('wizard-next-btn');

        prevBtn.style.display = this.service.currentStep > 0 ? 'block' : 'none';

        if (step.id === 'complete') {
            nextBtn.textContent = 'Los geht\'s!';
        } else {
            nextBtn.textContent = 'Weiter';
        }

        // Render step content
        if (step.id === 'complete') {
            body.innerHTML = this.renderCompleteStep(step);
        } else if (step.type === 'user') {
            body.innerHTML = this.renderUserOnboardingStep(step);
        } else {
            body.innerHTML = this.renderAdminStep(step);
        }

        // Attach step-specific event listeners
        this.attachStepEventListeners(step);
    }

    /**
     * Render user-friendly onboarding step
     */
    renderUserOnboardingStep(step) {
        const fieldsHTML = step.fields.map(field => {
            const currentValue = localStorage.getItem(field.name) || '';

            if (field.type === 'file') {
                return `
                    <div class="wizard-field-group">
                        <label for="wizard-${field.name}" class="wizard-field-label">
                            ${field.label}
                        </label>
                        <div class="wizard-file-upload" id="wizard-logo-dropzone">
                            <input
                                type="file"
                                id="wizard-${field.name}"
                                name="${field.name}"
                                accept="${field.accept || '*'}"
                                class="wizard-file-input"
                                style="display: none;"
                            />
                            <div class="logo-upload-area">
                                <div class="logo-icon">🖼️</div>
                                <p class="logo-text">Bild hochladen oder hierher ziehen</p>
                                <p class="logo-hint">(PNG, JPG, GIF)</p>
                            </div>
                            <div class="logo-preview-container" id="logo-preview-container" style="display: none;">
                                <img id="logo-preview-img" alt="Logo Preview" class="logo-preview">
                                <button type="button" class="btn-sm btn-secondary" id="btn-remove-logo">
                                    Logo entfernen
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="wizard-field-group">
                    <label for="wizard-${field.name}" class="wizard-field-label">
                        ${field.label}
                    </label>
                    <input
                        type="${field.type}"
                        id="wizard-${field.name}"
                        name="${field.name}"
                        placeholder="${field.placeholder}"
                        value="${currentValue}"
                        class="wizard-input-user ${field.required ? 'required' : ''}"
                        ${field.required ? 'required' : ''}
                    />
                </div>
            `;
        }).join('');

        return `
            <div class="wizard-step-user">
                <div class="wizard-form-user">
                    ${fieldsHTML}
                    <div class="wizard-errors" id="wizard-errors" style="display: none;"></div>
                </div>
            </div>
        `;
    }

    /**
     * Render admin/technical settings step (not used in first-run, but available)
     */
    renderAdminStep(step) {
        return `
            <div class="wizard-step-admin">
                <div class="wizard-admin-message">
                    Diese Seite ist nicht Teil der Einrichtung für normale Benutzer.
                    <br><br>
                    Technische Einstellungen finden Sie unter: Einstellungen → Technische Einstellungen
                </div>
            </div>
        `;
    }

    /**
     * Render completion step
     */
    renderCompleteStep(step) {
        const profile = this.service.getCompanyProfile();

        return `
            <div class="wizard-step-complete">
                <div class="wizard-success-check">✓</div>
                <h2>${step.title}</h2>
                <p class="wizard-complete-description">${step.description}</p>

                <div class="wizard-company-summary">
                    <div class="summary-item">
                        <span class="summary-label">Firma:</span>
                        <span class="summary-value">${profile.company_name}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Ansprechpartner:</span>
                        <span class="summary-value">${profile.owner_name}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Adresse:</span>
                        <span class="summary-value">
                            ${profile.address_street}<br>
                            ${profile.address_postal} ${profile.address_city}
                        </span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Steuernummer:</span>
                        <span class="summary-value">${profile.tax_number}</span>
                    </div>
                    ${profile.company_logo ? `
                        <div class="summary-item">
                            <span class="summary-label">Logo:</span>
                            <img src="${profile.company_logo}" alt="Unternehmenslogo" class="summary-logo">
                        </div>
                    ` : ''}
                </div>

                <div class="wizard-welcome-message">
                    <p><strong>Herzlich willkommen!</strong></p>
                    <p>Sie können jetzt direkt anfangen, Ihre Angebote und Rechnungen zu verwalten.</p>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const nextBtn = document.getElementById('wizard-next-btn');
        const prevBtn = document.getElementById('wizard-prev-btn');

        nextBtn.addEventListener('click', () => this.handleNext());
        prevBtn.addEventListener('click', () => this.handlePrevious());

        // Prevent closing modal by clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal && !this.service.isSetupComplete()) {
                // Show warning
                this.showWarning('Bitte füllen Sie die erforderlichen Felder aus.');
            }
        });
    }

    /**
     * Attach step-specific event listeners
     */
    attachStepEventListeners(step) {
        if (step.type !== 'user') {return;}

        // Save text field values on input
        step.fields.forEach(field => {
            if (field.type === 'file') {return;}

            const input = document.getElementById(`wizard-${field.name}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    this.service.saveField(field.name, e.target.value);
                });
            }
        });

        // Handle logo upload
        const logoInput = document.getElementById('wizard-company_logo');
        const dropzone = document.getElementById('wizard-logo-dropzone');

        if (logoInput && dropzone) {
            // File input change
            logoInput.addEventListener('change', (e) => this.handleLogoUpload(e));

            // Drag and drop
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragging');
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('dragging');
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragging');
                if (e.dataTransfer.files.length) {
                    logoInput.files = e.dataTransfer.files;
                    this.handleLogoUpload({ target: logoInput });
                }
            });

            dropzone.addEventListener('click', () => logoInput.click());

            // Remove logo button
            const removeBtn = document.getElementById('btn-remove-logo');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => this.handleRemoveLogo());
            }

            // Show preview if logo exists
            const logo = localStorage.getItem('company_logo');
            if (logo) {
                this.displayLogoPreview(logo);
            }
        }
    }

    /**
     * Handle logo file upload
     */
    handleLogoUpload(e) {
        const file = e.target.files?.[0];
        if (!file) {return;}

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Bitte wählen Sie eine Bilddatei (PNG, JPG, GIF).');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showError('Die Datei ist zu groß. Maximum: 5 MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            this.service.saveField('company_logo', base64);
            this.displayLogoPreview(base64);
        };
        reader.readAsDataURL(file);
    }

    /**
     * Display logo preview
     */
    displayLogoPreview(base64) {
        const img = document.getElementById('logo-preview-img');
        const container = document.getElementById('logo-preview-container');
        const uploadArea = document.querySelector('.logo-upload-area');

        if (img && container && uploadArea) {
            img.src = base64;
            container.style.display = 'block';
            uploadArea.style.display = 'none';
        }
    }

    /**
     * Handle logo removal
     */
    handleRemoveLogo() {
        localStorage.removeItem('company_logo');
        const input = document.getElementById('wizard-company_logo');
        if (input) {input.value = '';}
        const container = document.getElementById('logo-preview-container');
        const uploadArea = document.querySelector('.logo-upload-area');
        if (container && uploadArea) {
            container.style.display = 'none';
            uploadArea.style.display = 'block';
        }
    }

    /**
     * Handle next button
     */
    handleNext() {
        const step = this.service.getCurrentStep();

        // If complete step, start app
        if (step.id === 'complete') {
            this.hide();
            if (window.app && window.app.init) {
                window.app.init();
            }
            return;
        }

        // Validate current step
        const validation = this.service.validateCurrentStep();
        if (!validation.valid) {
            this.showErrors(validation.errors);
            return;
        }

        // Clear errors before moving on
        const errorsDiv = document.getElementById('wizard-errors');
        if (errorsDiv) {
            errorsDiv.style.display = 'none';
            errorsDiv.innerHTML = '';
        }

        // Move to next step
        this.service.nextStep();
        this.updateStepContent();
    }

    /**
     * Handle previous button
     */
    handlePrevious() {
        this.service.previousStep();
        this.updateStepContent();
    }

    /**
     * Show errors
     */
    showErrors(errors) {
        const errorsDiv = document.getElementById('wizard-errors');
        if (errorsDiv) {
            errorsDiv.className = 'wizard-errors-user';
            errorsDiv.innerHTML = errors.map(err => `
                <div class="error-message">
                    <span class="error-icon">⚠️</span>
                    <span>${err}</span>
                </div>
            `).join('');
            errorsDiv.style.display = 'block';
            // Scroll to errors
            errorsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Show single error (for logo upload, etc)
     */
    showError(message) {
        alert(message);
    }

    /**
     * Show warning
     */
    showWarning(message) {
        alert(message);
    }
}

// Global instance
window.setupWizardUI = new SetupWizardUI();
