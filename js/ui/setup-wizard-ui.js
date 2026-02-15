/* ============================================
   Setup Wizard UI
   Interactive setup wizard for API configuration
   ============================================ */

class SetupWizardUI {
    constructor() {
        this.modal = null;
        this.service = window.setupWizard;
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
        modal.className = 'modal setup-wizard-modal';
        modal.innerHTML = `
            <div class="modal-content wizard-content">
                <div class="wizard-header">
                    <h2>🚀 App Setup</h2>
                    <p class="wizard-subtitle">Konfiguriere die benötigten APIs (100% kostenlos)</p>
                    <div class="wizard-progress">
                        <div class="wizard-progress-bar">
                            <div class="wizard-progress-fill" id="wizard-progress-fill"></div>
                        </div>
                        <span class="wizard-progress-text" id="wizard-progress-text">Schritt 1 von 4</span>
                    </div>
                </div>

                <div class="wizard-body" id="wizard-body">
                    <!-- Dynamic content -->
                </div>

                <div class="wizard-footer">
                    <button type="button" class="btn-secondary" id="wizard-prev-btn" style="display: none;">
                        ← Zurück
                    </button>
                    <div class="wizard-footer-actions">
                        <button type="button" class="btn-text" id="wizard-skip-btn">
                            Setup später
                        </button>
                        <button type="button" class="btn-primary" id="wizard-next-btn">
                            Weiter →
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal; // Set modal reference before attaching listeners
        this.attachEventListeners();
    }

    /**
     * Update step content
     */
    updateStepContent() {
        const step = this.service.getCurrentStep();
        const body = document.getElementById('wizard-body');

        // Update progress
        const progress = ((this.service.currentStep) / (this.service.steps.length - 1)) * 100;
        document.getElementById('wizard-progress-fill').style.width = `${progress}%`;
        document.getElementById('wizard-progress-text').textContent =
            `Schritt ${this.service.currentStep + 1} von ${this.service.steps.length}`;

        // Update buttons
        const prevBtn = document.getElementById('wizard-prev-btn');
        const nextBtn = document.getElementById('wizard-next-btn');
        const skipBtn = document.getElementById('wizard-skip-btn');

        prevBtn.style.display = this.service.currentStep > 0 ? 'block' : 'none';

        if (step.id === 'complete') {
            nextBtn.textContent = 'App starten 🎉';
            skipBtn.style.display = 'none';
        } else {
            nextBtn.textContent = 'Weiter →';
            skipBtn.style.display = 'block';
        }

        // Render step content
        if (step.id === 'complete') {
            body.innerHTML = this.renderCompleteStep(step);
        } else {
            body.innerHTML = this.renderConfigStep(step);
        }

        // Attach step-specific event listeners
        this.attachStepEventListeners(step);
    }

    /**
     * Render configuration step
     */
    renderConfigStep(step) {
        const fieldsHTML = step.fields.map(field => {
            const currentValue = localStorage.getItem(field.name) || '';
            return `
                <div class="wizard-field">
                    <label for="wizard-${field.name}">${field.label}</label>
                    <input
                        type="${field.type}"
                        id="wizard-${field.name}"
                        name="${field.name}"
                        placeholder="${field.placeholder}"
                        value="${currentValue}"
                        class="wizard-input"
                    />
                </div>
            `;
        }).join('');

        const linksHTML = step.links.map(link => `
            <a href="${link.url}" target="_blank" rel="noopener" class="wizard-link">
                <span class="wizard-link-icon">${link.icon}</span>
                <span>${link.text}</span>
                <span class="wizard-link-arrow">→</span>
            </a>
        `).join('');

        const instructionsHTML = step.instructions.map((instruction, i) => `
            <li>
                <span class="instruction-number">${i + 1}</span>
                <span>${instruction}</span>
            </li>
        `).join('');

        return `
            <div class="wizard-step">
                <div class="wizard-step-header">
                    <h3>${step.title}</h3>
                    <p>${step.description}</p>
                </div>

                ${step.links.length > 0 ? `
                    <div class="wizard-links">
                        <h4>📖 Hilfreiche Links:</h4>
                        ${linksHTML}
                    </div>
                ` : ''}

                ${step.instructions.length > 0 ? `
                    <div class="wizard-instructions">
                        <h4>📝 Anleitung:</h4>
                        <ol>${instructionsHTML}</ol>
                    </div>
                ` : ''}

                ${step.fields.length > 0 ? `
                    <div class="wizard-form">
                        <h4>🔑 Konfiguration:</h4>
                        ${fieldsHTML}
                        <button type="button" class="btn-secondary btn-sm" id="wizard-test-btn">
                            🧪 Verbindung testen
                        </button>
                        <div class="wizard-test-result" id="wizard-test-result"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render completion step
     */
    renderCompleteStep(step) {
        const config = this.service.exportConfig();
        const configPreview = Object.entries(config)
            .filter(([key]) => key !== 'exported_at')
            .map(([key, value]) => {
                const maskedValue = value ? value.substring(0, 10) + '...' : 'nicht gesetzt';
                return `
                    <div class="config-item">
                        <span class="config-key">${key}:</span>
                        <span class="config-value">${maskedValue}</span>
                    </div>
                `;
            }).join('');

        return `
            <div class="wizard-step wizard-complete">
                <div class="wizard-success-icon">✓</div>
                <h3>${step.title}</h3>
                <p>${step.description}</p>

                <div class="wizard-config-summary">
                    <h4>📋 Konfiguration:</h4>
                    ${configPreview}
                </div>

                <div class="wizard-actions">
                    <button type="button" class="btn-secondary" id="wizard-export-btn">
                        💾 Config exportieren
                    </button>
                    <button type="button" class="btn-secondary" id="wizard-reconfigure-btn">
                        ⚙️ Neu konfigurieren
                    </button>
                </div>

                <div class="wizard-next-steps">
                    <h4>🎯 Nächste Schritte:</h4>
                    <ul>
                        <li>Die App ist jetzt voll funktionsfähig</li>
                        <li>Email-Automation ist aktiviert</li>
                        <li>KI-Analyse läuft automatisch</li>
                        <li>Teste die Features im Dashboard!</li>
                    </ul>
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
        const skipBtn = document.getElementById('wizard-skip-btn');

        nextBtn.addEventListener('click', () => this.handleNext());
        prevBtn.addEventListener('click', () => this.handlePrevious());
        skipBtn.addEventListener('click', () => this.handleSkip());

        // Prevent closing modal by clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal && !this.service.isSetupComplete()) {
                // Show warning
                this.showWarning('Bitte schließe das Setup ab oder wähle "Setup später"');
            }
        });
    }

    /**
     * Attach step-specific event listeners
     */
    attachStepEventListeners(step) {
        // Save field values on input
        step.fields.forEach(field => {
            const input = document.getElementById(`wizard-${field.name}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    this.service.saveField(field.name, e.target.value);
                });
            }
        });

        // Test button
        const testBtn = document.getElementById('wizard-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.handleTest(step.id));
        }

        // Export button (complete step)
        const exportBtn = document.getElementById('wizard-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.handleExport());
        }

        // Reconfigure button (complete step)
        const reconfigureBtn = document.getElementById('wizard-reconfigure-btn');
        if (reconfigureBtn) {
            reconfigureBtn.addEventListener('click', () => this.handleReconfigure());
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
     * Handle skip button
     */
    handleSkip() {
        const confirmed = confirm(
            'Möchtest du das Setup wirklich überspringen?\n\n' +
            'Die App funktioniert ohne API-Keys nur eingeschränkt.'
        );

        if (confirmed) {
            this.hide();
            if (window.app && window.app.init) {
                window.app.init();
            }
        }
    }

    /**
     * Handle test connection
     */
    async handleTest(stepId) {
        const testBtn = document.getElementById('wizard-test-btn');
        const resultDiv = document.getElementById('wizard-test-result');

        testBtn.disabled = true;
        testBtn.textContent = '🔄 Teste...';
        resultDiv.className = 'wizard-test-result';
        resultDiv.textContent = '';

        const result = await this.service.testConnection(stepId);

        testBtn.disabled = false;
        testBtn.textContent = '🧪 Verbindung testen';

        resultDiv.className = `wizard-test-result ${result.success ? 'success' : 'error'}`;
        resultDiv.textContent = result.message;
    }

    /**
     * Handle export config
     */
    handleExport() {
        const config = this.service.exportConfig();
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `business-automizer-config-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Handle reconfigure
     */
    handleReconfigure() {
        const confirmed = confirm('Möchtest du die Konfiguration wirklich zurücksetzen?');
        if (confirmed) {
            this.service.resetSetup();
            this.updateStepContent();
        }
    }

    /**
     * Show errors
     */
    showErrors(errors) {
        const resultDiv = document.getElementById('wizard-test-result');
        if (resultDiv) {
            resultDiv.className = 'wizard-test-result error';
            resultDiv.innerHTML = errors.map(err => `<div>⚠️ ${err}</div>`).join('');
        }
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
