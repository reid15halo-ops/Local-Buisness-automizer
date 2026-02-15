/* ============================================
   Excel Import Wizard UI
   4-Schritt-Wizard für intelligenten Import
   ============================================ */

class ExcelImportWizard {
    constructor() {
        this.currentStep = 1;
        this.file = null;
        this.dataType = null;
        this.analysisResult = null;
        this.mapping = null;
        this.validationResult = null;
        this.onComplete = null;
    }

    // ============================================
    // Wizard öffnen
    // ============================================

    open(dataType, onComplete) {
        this.dataType = dataType;
        this.onComplete = onComplete;
        this.currentStep = 1;
        this.file = null;
        this.analysisResult = null;
        this.mapping = null;
        this.validationResult = null;

        this.renderModal();
        document.getElementById('modal-excel-import').classList.add('active');
    }

    close() {
        document.getElementById('modal-excel-import').classList.remove('active');
    }

    // ============================================
    // Modal rendern
    // ============================================

    renderModal() {
        const modal = document.getElementById('modal-excel-import');
        if (!modal) {
            this.createModal();
            return;
        }

        this.updateContent();
    }

    createModal() {
        const modal = document.createElement('div');
        modal.id = 'modal-excel-import';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h2>Excel/CSV Import</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="wizard-progress">
                    <div class="wizard-step" data-step="1">
                        <div class="step-number">1</div>
                        <div class="step-label">Datei hochladen</div>
                    </div>
                    <div class="wizard-step" data-step="2">
                        <div class="step-number">2</div>
                        <div class="step-label">Spalten zuordnen</div>
                    </div>
                    <div class="wizard-step" data-step="3">
                        <div class="step-number">3</div>
                        <div class="step-label">Validierung</div>
                    </div>
                    <div class="wizard-step" data-step="4">
                        <div class="step-number">4</div>
                        <div class="step-label">Import</div>
                    </div>
                </div>
                <div class="wizard-content" id="wizard-content"></div>
                <div class="wizard-actions" id="wizard-actions"></div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event-Listener
        modal.querySelector('.modal-close').addEventListener('click', () => this.close());
        modal.querySelector('.modal-overlay').addEventListener('click', () => this.close());

        this.updateContent();
    }

    updateContent() {
        this.updateProgress();

        switch (this.currentStep) {
            case 1:
                this.renderStep1();
                break;
            case 2:
                this.renderStep2();
                break;
            case 3:
                this.renderStep3();
                break;
            case 4:
                this.renderStep4();
                break;
        }
    }

    updateProgress() {
        const steps = document.querySelectorAll('.wizard-step');
        steps.forEach((step, index) => {
            const stepNum = index + 1;
            if (stepNum < this.currentStep) {
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (stepNum === this.currentStep) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });
    }

    // ============================================
    // Schritt 1: Datei-Upload
    // ============================================

    renderStep1() {
        // Wenn kein dataType gesetzt ist, zeige Auswahl
        if (!this.dataType) {
            document.getElementById('wizard-content').innerHTML = `
                <div class="wizard-step-content">
                    <h3>Datentyp auswählen</h3>
                    <p class="subtitle">Was möchtest du importieren?</p>

                    <div class="datatype-selection">
                        <div class="datatype-card" data-type="kunden">
                            <div class="datatype-icon">👥</div>
                            <h4>Kunden</h4>
                            <p>Name, Email, Telefon, Adresse</p>
                        </div>
                        <div class="datatype-card" data-type="material">
                            <div class="datatype-icon">📦</div>
                            <h4>Material</h4>
                            <p>Artikelnr., Bezeichnung, Preis, Bestand</p>
                        </div>
                        <div class="datatype-card" data-type="anfragen">
                            <div class="datatype-icon">📥</div>
                            <h4>Anfragen</h4>
                            <p>Kunde, Beschreibung, Budget</p>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('wizard-actions').innerHTML = `
                <button class="btn btn-secondary" onclick="window.excelImportWizard.close()">Abbrechen</button>
            `;

            // Event-Listener für Datentyp-Auswahl
            document.querySelectorAll('.datatype-card').forEach(card => {
                card.addEventListener('click', () => {
                    this.dataType = card.dataset.type;
                    this.renderStep1(); // Neu rendern mit gewähltem Typ
                });
            });

            return;
        }

        // Ansonsten: Normale File-Upload-Ansicht
        const dataTypeLabel = {
            kunden: 'Kunden',
            material: 'Material',
            anfragen: 'Anfragen'
        }[this.dataType];

        document.getElementById('wizard-content').innerHTML = `
            <div class="wizard-step-content">
                <div class="step-header-with-actions">
                    <div>
                        <h3>Datei hochladen</h3>
                        <p class="subtitle">Importiere ${dataTypeLabel} aus Excel oder CSV</p>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-download-template">
                        📥 Vorlage herunterladen
                    </button>
                </div>

                <div class="upload-area" id="upload-area">
                    <div class="upload-icon">📁</div>
                    <p>Datei hier ablegen oder klicken zum Auswählen</p>
                    <p class="upload-hint">Unterstützte Formate: .xlsx, .xls, .csv</p>
                    <input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display:none">
                </div>

                <div id="file-info" style="display:none; margin-top: 20px;">
                    <div class="info-card">
                        <div class="info-row">
                            <span>Dateiname:</span>
                            <strong id="file-name"></strong>
                        </div>
                        <div class="info-row">
                            <span>Größe:</span>
                            <strong id="file-size"></strong>
                        </div>
                        <div class="info-row">
                            <span>Typ:</span>
                            <strong id="file-type"></strong>
                        </div>
                    </div>
                </div>

                <div id="analysis-status" style="display:none; margin-top: 20px;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="analysis-progress"></div>
                    </div>
                    <p class="progress-text" id="analysis-text">Analysiere Datei...</p>
                </div>
            </div>
        `;

        document.getElementById('wizard-actions').innerHTML = `
            <button class="btn btn-secondary" onclick="window.excelImportWizard.close()">Abbrechen</button>
            <button class="btn btn-primary" id="btn-next-step" disabled>Weiter</button>
        `;

        // Event-Listener
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFileSelect(file);
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleFileSelect(file);
        });

        document.getElementById('btn-next-step').addEventListener('click', () => {
            this.nextStep();
        });

        // Download-Template Button
        const btnDownloadTemplate = document.getElementById('btn-download-template');
        if (btnDownloadTemplate) {
            btnDownloadTemplate.addEventListener('click', () => {
                window.excelRecognitionService.downloadTemplate(this.dataType);
            });
        }
    }

    async handleFileSelect(file) {
        this.file = file;

        // Zeige Datei-Info
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = this.formatFileSize(file.size);
        document.getElementById('file-type').textContent = file.name.split('.').pop().toUpperCase();
        document.getElementById('file-info').style.display = 'block';

        // Starte Analyse
        document.getElementById('analysis-status').style.display = 'block';
        document.getElementById('analysis-progress').style.width = '50%';

        try {
            this.analysisResult = await window.excelRecognitionService.analyzeFile(file, this.dataType);

            document.getElementById('analysis-progress').style.width = '100%';
            document.getElementById('analysis-text').textContent = `✓ ${this.analysisResult.totalRows} Zeilen gefunden`;

            // Enable next button
            document.getElementById('btn-next-step').disabled = false;

        } catch (error) {
            document.getElementById('analysis-text').innerHTML = `<span style="color: var(--color-error)">✗ Fehler: ${error.message}</span>`;
            console.error('Analyse-Fehler:', error);
        }
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ============================================
    // Schritt 2: Spalten-Mapping
    // ============================================

    renderStep2() {
        this.mapping = this.analysisResult.suggestedMapping;

        const template = window.excelRecognitionService.mappingTemplates[this.dataType];
        const availableFields = [...template.required, ...template.optional];

        // Gespeicherte Templates abrufen
        const savedTemplates = window.excelRecognitionService.getAllTemplates(this.dataType);

        document.getElementById('wizard-content').innerHTML = `
            <div class="wizard-step-content">
                <h3>Spalten zuordnen</h3>
                <p class="subtitle">Ordne die Excel-Spalten den richtigen Feldern zu</p>

                ${savedTemplates.length > 0 ? `
                    <div class="template-manager">
                        <label for="template-select">📋 Gespeicherte Vorlagen:</label>
                        <select id="template-select" class="template-select">
                            <option value="">-- Neue Zuordnung --</option>
                            ${savedTemplates.map(tpl => `
                                <option value="${tpl.name}">${tpl.name} (${new Date(tpl.createdAt).toLocaleDateString()})</option>
                            `).join('')}
                        </select>
                        <button class="btn btn-sm btn-secondary" id="btn-delete-template" disabled>🗑️</button>
                    </div>
                ` : ''}

                <div class="mapping-stats">
                    <div class="stat-mini">
                        <span>${this.analysisResult.stats.mappedColumns}</span>
                        <span>Automatisch zugeordnet</span>
                    </div>
                    <div class="stat-mini ${this.analysisResult.stats.unmappedColumns > 0 ? 'stat-warning' : ''}">
                        <span>${this.analysisResult.stats.unmappedColumns}</span>
                        <span>Nicht zugeordnet</span>
                    </div>
                </div>

                <div class="mapping-table-container">
                    <table class="mapping-table">
                        <thead>
                            <tr>
                                <th>Excel-Spalte</th>
                                <th>Beispieldaten</th>
                                <th>Zuordnung zu Feld</th>
                                <th>Füllrate</th>
                            </tr>
                        </thead>
                        <tbody id="mapping-tbody"></tbody>
                    </table>
                </div>

                <div class="mapping-actions">
                    <button class="btn btn-small btn-secondary" id="btn-auto-map">🔄 Automatisch zuordnen</button>
                    <button class="btn btn-small btn-secondary" id="btn-save-mapping">💾 Zuordnung speichern</button>
                </div>
            </div>
        `;

        // Mapping-Tabelle füllen
        const tbody = document.getElementById('mapping-tbody');
        Object.entries(this.mapping).forEach(([sourceCol, targetField]) => {
            const stats = this.analysisResult.stats.dataTypes[targetField] || { fillRate: '0%', samples: [] };

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${sourceCol}</strong></td>
                <td class="sample-data">${stats.samples.join(', ') || '-'}</td>
                <td>
                    <select class="mapping-select" data-source="${sourceCol}">
                        <option value="">-- Nicht importieren --</option>
                        ${template.required.map(field => `
                            <option value="${field}" ${targetField === field ? 'selected' : ''}>
                                ${field} ${template.required.includes(field) ? '*' : ''}
                            </option>
                        `).join('')}
                        <optgroup label="Optional">
                            ${template.optional.map(field => `
                                <option value="${field}" ${targetField === field ? 'selected' : ''}>
                                    ${field}
                                </option>
                            `).join('')}
                        </optgroup>
                    </select>
                </td>
                <td>${stats.fillRate}</td>
            `;
            tbody.appendChild(row);
        });

        // Event-Listener für Mapping-Änderungen
        document.querySelectorAll('.mapping-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const source = e.target.dataset.source;
                const target = e.target.value;
                this.mapping[source] = target || null;
            });
        });

        document.getElementById('btn-auto-map').addEventListener('click', () => {
            this.mapping = window.excelRecognitionService.suggestMapping(
                this.analysisResult.headers,
                this.dataType
            );
            this.renderStep2(); // Re-render
        });

        document.getElementById('btn-save-mapping').addEventListener('click', () => {
            const templateName = prompt('Template-Name:', 'Meine Zuordnung');
            if (templateName) {
                window.excelRecognitionService.saveMapping(this.dataType, this.mapping, templateName);
                this.showNotification(`Template "${templateName}" gespeichert`);
                this.renderStep2(); // Re-render to show new template
            }
        });

        // Template-Verwaltung Event-Listener
        const templateSelect = document.getElementById('template-select');
        const btnDeleteTemplate = document.getElementById('btn-delete-template');

        if (templateSelect) {
            templateSelect.addEventListener('change', (e) => {
                const templateName = e.target.value;

                if (btnDeleteTemplate) {
                    btnDeleteTemplate.disabled = !templateName;
                }

                if (templateName) {
                    const loadedMapping = window.excelRecognitionService.getSavedMapping(this.dataType, templateName);
                    if (loadedMapping) {
                        this.mapping = loadedMapping;
                        this.renderStep2(); // Re-render with loaded mapping
                        this.showNotification(`Template "${templateName}" geladen`);
                    }
                }
            });
        }

        if (btnDeleteTemplate) {
            btnDeleteTemplate.addEventListener('click', () => {
                const selectedTemplate = templateSelect.value;
                if (selectedTemplate && confirm(`Template "${selectedTemplate}" wirklich löschen?`)) {
                    window.excelRecognitionService.deleteTemplate(this.dataType, selectedTemplate);
                    this.showNotification(`Template "${selectedTemplate}" gelöscht`);
                    this.renderStep2(); // Re-render
                }
            });
        }

        document.getElementById('wizard-actions').innerHTML = `
            <button class="btn btn-secondary" onclick="window.excelImportWizard.prevStep()">Zurück</button>
            <button class="btn btn-primary" onclick="window.excelImportWizard.nextStep()">Validieren</button>
        `;
    }

    // ============================================
    // Schritt 3: Validierung
    // ============================================

    renderStep3() {
        document.getElementById('wizard-content').innerHTML = `
            <div class="wizard-step-content">
                <h3>Daten validieren</h3>
                <p class="subtitle">Überprüfe die Daten vor dem Import</p>

                <div id="validation-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" id="validation-progress-bar"></div>
                    </div>
                    <p class="progress-text">Validiere Daten...</p>
                </div>

                <div id="validation-results" style="display:none;"></div>
            </div>
        `;

        document.getElementById('wizard-actions').innerHTML = `
            <button class="btn btn-secondary" onclick="window.excelImportWizard.prevStep()">Zurück</button>
            <button class="btn btn-primary" id="btn-start-import" disabled>Import starten</button>
        `;

        // Starte Validierung
        setTimeout(() => this.runValidation(), 500);
    }

    async runValidation() {
        document.getElementById('validation-progress-bar').style.width = '50%';

        this.validationResult = window.excelRecognitionService.validateData(
            this.analysisResult.rawData,
            this.mapping,
            this.dataType
        );

        document.getElementById('validation-progress-bar').style.width = '100%';

        // Zeige Ergebnisse
        setTimeout(() => {
            document.getElementById('validation-progress').style.display = 'none';
            this.renderValidationResults();
        }, 300);
    }

    renderValidationResults() {
        const results = document.getElementById('validation-results');
        results.style.display = 'block';

        const hasErrors = this.validationResult.invalid.length > 0;

        results.innerHTML = `
            <div class="validation-stats">
                <div class="stat-mini stat-success">
                    <span>${this.validationResult.valid.length}</span>
                    <span>Gültige Einträge</span>
                </div>
                <div class="stat-mini ${hasErrors ? 'stat-error' : ''}">
                    <span>${this.validationResult.invalid.length}</span>
                    <span>Fehlerhafte Einträge</span>
                </div>
                <div class="stat-mini ${this.validationResult.warnings.length > 0 ? 'stat-warning' : ''}">
                    <span>${this.validationResult.warnings.length}</span>
                    <span>Warnungen</span>
                </div>
            </div>

            ${hasErrors ? `
                <div class="error-list">
                    <h4>Fehlerhafte Einträge:</h4>
                    ${this.validationResult.invalid.slice(0, 5).map(item => `
                        <div class="error-item">
                            <strong>Zeile ${item.row}:</strong>
                            <ul>
                                ${item.errors.map(err => `<li>${err}</li>`).join('')}
                            </ul>
                        </div>
                    `).join('')}
                    ${this.validationResult.invalid.length > 5 ? `
                        <p class="more-errors">... und ${this.validationResult.invalid.length - 5} weitere Fehler</p>
                    ` : ''}
                </div>
            ` : ''}

            ${this.validationResult.warnings.length > 0 ? `
                <div class="warning-list">
                    <h4>Warnungen:</h4>
                    ${this.validationResult.warnings.slice(0, 3).map(item => `
                        <div class="warning-item">
                            <strong>Zeile ${item.row}:</strong>
                            <ul>
                                ${item.warnings.map(warn => `<li>${warn}</li>`).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${this.validationResult.valid.length > 0 ? `
                <div class="options-panel">
                    <h4>Import-Optionen:</h4>
                    <label>
                        <input type="checkbox" id="skip-duplicates" checked>
                        Duplikate überspringen
                    </label>
                    <label>
                        <input type="checkbox" id="update-existing">
                        Bestehende Einträge aktualisieren
                    </label>
                </div>
            ` : ''}
        `;

        // Enable Import-Button wenn gültige Daten vorhanden
        if (this.validationResult.valid.length > 0) {
            document.getElementById('btn-start-import').disabled = false;
            document.getElementById('btn-start-import').addEventListener('click', () => this.nextStep());
        }
    }

    // ============================================
    // Schritt 4: Import-Ausführung
    // ============================================

    renderStep4() {
        document.getElementById('wizard-content').innerHTML = `
            <div class="wizard-step-content">
                <h3>Import wird durchgeführt</h3>
                <p class="subtitle">Bitte warten Sie...</p>

                <div class="import-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" id="import-progress-bar"></div>
                    </div>
                    <p class="progress-text" id="import-progress-text">0 von ${this.validationResult.valid.length} Einträgen importiert</p>
                </div>

                <div id="import-results" style="display:none;"></div>
            </div>
        `;

        document.getElementById('wizard-actions').innerHTML = `
            <button class="btn btn-secondary" id="btn-close-wizard" disabled>Schließen</button>
        `;

        // Starte Import
        setTimeout(() => this.runImport(), 500);
    }

    async runImport() {
        const skipDuplicates = document.getElementById('skip-duplicates')?.checked ?? true;
        const updateExisting = document.getElementById('update-existing')?.checked ?? false;

        const results = await window.excelRecognitionService.executeImport(
            this.validationResult.valid,
            this.dataType,
            {
                batchSize: 100,
                skipDuplicates,
                updateExisting,
                onProgress: (progress) => {
                    document.getElementById('import-progress-bar').style.width = progress.percent + '%';
                    document.getElementById('import-progress-text').textContent =
                        `${progress.current} von ${this.validationResult.valid.length} Einträgen importiert`;
                }
            }
        );

        // Zeige Ergebnisse
        this.showImportResults(results);
    }

    showImportResults(results) {
        document.getElementById('import-results').style.display = 'block';
        document.getElementById('import-results').innerHTML = `
            <div class="import-summary">
                <div class="summary-icon">✓</div>
                <h3>Import abgeschlossen!</h3>

                <div class="validation-stats">
                    <div class="stat-mini stat-success">
                        <span>${results.imported}</span>
                        <span>Neu importiert</span>
                    </div>
                    <div class="stat-mini">
                        <span>${results.updated}</span>
                        <span>Aktualisiert</span>
                    </div>
                    <div class="stat-mini">
                        <span>${results.skipped}</span>
                        <span>Übersprungen</span>
                    </div>
                    <div class="stat-mini ${results.errors.length > 0 ? 'stat-error' : ''}">
                        <span>${results.errors.length}</span>
                        <span>Fehler</span>
                    </div>
                </div>

                ${results.errors.length > 0 ? `
                    <div class="error-list">
                        <h4>Fehler beim Import:</h4>
                        ${results.errors.slice(0, 5).map(err => `
                            <div class="error-item">
                                <p>${err.error}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        // Enable close button
        const closeBtn = document.getElementById('btn-close-wizard');
        closeBtn.disabled = false;
        closeBtn.addEventListener('click', () => {
            this.close();
            if (this.onComplete) {
                this.onComplete(results);
            }
        });
    }

    // ============================================
    // Navigation
    // ============================================

    nextStep() {
        if (this.currentStep < 4) {
            this.currentStep++;
            this.updateContent();
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateContent();
        }
    }

    // ============================================
    // Helpers
    // ============================================

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-success);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Globale Instanz
window.excelImportWizard = new ExcelImportWizard();
