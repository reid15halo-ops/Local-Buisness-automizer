/* ============================================
   Work Estimation UI
   Sichtbare KI-Schätzung mit Override-Möglichkeit
   Für Auftrag- und Angebotserstellung
   ============================================ */

class WorkEstimationUI {
    constructor() {
        this.activePanels = new Map();
        this.injectStyles();
    }

    // ============================================
    // Style Injection
    // ============================================
    injectStyles() {
        if (document.getElementById('work-estimation-ui-styles')) { return; }

        const style = document.createElement('style');
        style.id = 'work-estimation-ui-styles';
        style.textContent = `
            /* Panel Container */
            .we-panel {
                background: #1c1c21;
                border: 1px solid #2a2a32;
                border-radius: 10px;
                padding: 20px;
                margin: 16px 0;
                position: relative;
                transition: border-color 0.3s ease;
            }

            .we-panel:hover {
                border-color: #3a3a42;
            }

            /* Header */
            .we-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }

            .we-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #e4e4e7;
            }

            .we-badge-ki {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 3px 10px;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                border-radius: 4px;
                background: #f59e0b22;
                color: #f59e0b;
                border: 1px solid #f59e0b44;
                white-space: nowrap;
            }

            .we-badge-ki::before {
                content: '⚡';
                font-size: 10px;
            }

            /* Estimate Display */
            .we-estimate-display {
                display: flex;
                align-items: baseline;
                gap: 8px;
                margin-bottom: 16px;
                padding: 16px;
                background: #0f0f12;
                border-radius: 8px;
                border: 1px solid #2a2a32;
            }

            .we-estimate-value {
                font-size: 36px;
                font-weight: 700;
                color: #e4e4e7;
                line-height: 1;
            }

            .we-estimate-unit {
                font-size: 16px;
                color: #71717a;
                font-weight: 400;
            }

            .we-estimate-prefix {
                font-size: 24px;
                color: #71717a;
                font-weight: 300;
            }

            /* Confidence Indicator */
            .we-confidence {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 16px;
                padding: 10px 14px;
                border-radius: 6px;
                font-size: 13px;
            }

            .we-confidence-bar {
                width: 60px;
                height: 6px;
                border-radius: 3px;
                background: #2a2a32;
                overflow: hidden;
                flex-shrink: 0;
            }

            .we-confidence-fill {
                height: 100%;
                border-radius: 3px;
                transition: width 0.4s ease;
            }

            .we-confidence--hoch {
                background: #22c55e18;
                border: 1px solid #22c55e33;
            }
            .we-confidence--hoch .we-confidence-label {
                color: #22c55e;
                font-weight: 600;
            }
            .we-confidence--hoch .we-confidence-fill {
                width: 100%;
                background: #22c55e;
            }
            .we-confidence--hoch .we-confidence-text {
                color: #86efac;
            }

            .we-confidence--mittel {
                background: #f59e0b18;
                border: 1px solid #f59e0b33;
            }
            .we-confidence--mittel .we-confidence-label {
                color: #f59e0b;
                font-weight: 600;
            }
            .we-confidence--mittel .we-confidence-fill {
                width: 60%;
                background: #f59e0b;
            }
            .we-confidence--mittel .we-confidence-text {
                color: #fcd34d;
            }

            .we-confidence--niedrig {
                background: #ef444418;
                border: 1px solid #ef444433;
            }
            .we-confidence--niedrig .we-confidence-label {
                color: #ef4444;
                font-weight: 600;
            }
            .we-confidence--niedrig .we-confidence-fill {
                width: 30%;
                background: #ef4444;
            }
            .we-confidence--niedrig .we-confidence-text {
                color: #fca5a5;
            }

            /* Reasoning Section */
            .we-reasoning-toggle {
                display: flex;
                align-items: center;
                gap: 6px;
                background: none;
                border: none;
                color: #6366f1;
                font-size: 13px;
                cursor: pointer;
                padding: 6px 0;
                margin-bottom: 8px;
                font-family: inherit;
                transition: color 0.2s;
            }

            .we-reasoning-toggle:hover {
                color: #818cf8;
            }

            .we-reasoning-toggle .we-arrow {
                display: inline-block;
                transition: transform 0.2s;
                font-size: 10px;
            }

            .we-reasoning-toggle.we-open .we-arrow {
                transform: rotate(90deg);
            }

            .we-reasoning-content {
                display: none;
                padding: 12px 16px;
                margin-bottom: 16px;
                background: #0f0f12;
                border-radius: 6px;
                border: 1px solid #2a2a32;
                font-size: 13px;
                color: #a1a1aa;
                line-height: 1.6;
            }

            .we-reasoning-content.we-visible {
                display: block;
            }

            .we-reasoning-item {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                margin-bottom: 6px;
            }

            .we-reasoning-item:last-child {
                margin-bottom: 0;
            }

            .we-reasoning-bullet {
                color: #6366f1;
                flex-shrink: 0;
                margin-top: 1px;
            }

            .we-reasoning-label {
                color: #71717a;
                min-width: 120px;
                flex-shrink: 0;
            }

            .we-reasoning-value {
                color: #e4e4e7;
            }

            /* Breakdown (Gemini detail) */
            .we-breakdown {
                margin-bottom: 16px;
                padding: 12px 16px;
                background: #0f0f12;
                border-radius: 6px;
                border: 1px solid #2a2a32;
            }

            .we-breakdown-title {
                font-size: 13px;
                font-weight: 600;
                color: #a1a1aa;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .we-breakdown-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 0;
                border-bottom: 1px solid #2a2a3210;
            }

            .we-breakdown-row:last-child {
                border-bottom: none;
            }

            .we-breakdown-label {
                color: #a1a1aa;
                font-size: 13px;
            }

            .we-breakdown-value {
                color: #e4e4e7;
                font-weight: 600;
                font-size: 13px;
            }

            /* Override Controls */
            .we-override {
                margin-bottom: 16px;
                padding: 14px 16px;
                background: #0f0f12;
                border-radius: 8px;
                border: 1px solid #2a2a32;
                transition: background 0.3s ease, border-color 0.3s ease;
            }

            .we-override.we-override-active {
                background: #1e3a5f20;
                border-color: #3b82f644;
            }

            .we-override-label {
                display: block;
                font-size: 13px;
                font-weight: 600;
                color: #a1a1aa;
                margin-bottom: 8px;
            }

            .we-override-row {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .we-override-input {
                width: 100px;
                padding: 8px 12px;
                font-size: 18px;
                font-weight: 600;
                text-align: center;
                background: #1c1c21;
                border: 1px solid #3a3a42;
                border-radius: 6px;
                color: #e4e4e7;
                outline: none;
                transition: border-color 0.2s, background 0.2s;
                font-family: inherit;
            }

            .we-override-input:focus {
                border-color: #6366f1;
            }

            .we-override-input.we-modified {
                border-color: #3b82f6;
                background: #1e3a5f30;
            }

            .we-override-unit {
                font-size: 14px;
                color: #71717a;
            }

            .we-override-hint {
                font-size: 11px;
                color: #52525b;
                margin-top: 8px;
                line-height: 1.4;
            }

            .we-override-changed-info {
                display: none;
                font-size: 11px;
                color: #3b82f6;
                margin-top: 6px;
                font-style: italic;
            }

            .we-override-changed-info.we-visible {
                display: block;
            }

            /* Action Buttons */
            .we-actions {
                display: flex;
                gap: 10px;
                margin-top: 16px;
            }

            .we-btn {
                padding: 10px 20px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 0.2s ease;
                font-family: inherit;
            }

            .we-btn-accept {
                background: #22c55e;
                color: #fff;
                border-color: #22c55e;
                flex: 1;
            }

            .we-btn-accept:hover {
                background: #16a34a;
                border-color: #16a34a;
            }

            .we-btn-dismiss {
                background: #2a2a32;
                color: #a1a1aa;
                border-color: #3a3a42;
            }

            .we-btn-dismiss:hover {
                background: #3a3a42;
                color: #e4e4e7;
            }

            /* Loading State */
            .we-loading {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 20px;
                color: #a1a1aa;
                font-size: 14px;
            }

            .we-spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #2a2a32;
                border-top-color: #6366f1;
                border-radius: 50%;
                animation: we-spin 0.8s linear infinite;
            }

            @keyframes we-spin {
                to { transform: rotate(360deg); }
            }

            /* Error State */
            .we-error {
                padding: 14px;
                background: #ef444418;
                border: 1px solid #ef444433;
                border-radius: 6px;
                color: #fca5a5;
                font-size: 13px;
                margin-bottom: 12px;
            }

            /* Recommendation */
            .we-empfehlung {
                padding: 10px 14px;
                background: #6366f110;
                border: 1px solid #6366f133;
                border-radius: 6px;
                color: #a5b4fc;
                font-size: 12px;
                margin-bottom: 16px;
                line-height: 1.5;
            }

            /* Responsive */
            @media (max-width: 480px) {
                .we-panel {
                    padding: 14px;
                }

                .we-estimate-value {
                    font-size: 28px;
                }

                .we-actions {
                    flex-direction: column;
                }

                .we-btn {
                    text-align: center;
                }

                .we-reasoning-label {
                    min-width: 90px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // Main Panel Rendering
    // ============================================

    /**
     * Show an estimation panel inside the given container.
     * @param {string} containerId - ID of the target DOM container
     * @param {object} anfrage - { leistungsart, beschreibung, budget }
     * @param {object} options - {
     *   useGemini: boolean (default true if configured),
     *   materialien: array,
     *   onAccept: function(result),
     *   onDismiss: function()
     * }
     */
    async showEstimationPanel(containerId, anfrage, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`[WorkEstimationUI] Container #${containerId} nicht gefunden.`);
            return;
        }

        // Store panel state
        const panelState = {
            containerId,
            anfrage,
            options,
            originalEstimate: null,
            currentValue: null,
            isOverridden: false,
            estimation: null
        };
        this.activePanels.set(containerId, panelState);

        // Show loading state
        container.innerHTML = this._renderLoading();

        try {
            // Run estimation
            const estimation = await this._runEstimation(anfrage, options);
            panelState.estimation = estimation;
            panelState.originalEstimate = estimation.geschaetzteStunden;
            panelState.currentValue = estimation.geschaetzteStunden;

            // Render the full panel
            container.innerHTML = this._renderPanel(estimation, panelState);

            // Attach event listeners
            this._attachPanelEvents(containerId, panelState);

        } catch (error) {
            console.error('[WorkEstimationUI] Fehler bei Schätzung:', error);
            container.innerHTML = this._renderError();
        }
    }

    // ============================================
    // Estimation Logic
    // ============================================

    async _runEstimation(anfrage, options) {
        const service = window.workEstimationService;
        if (!service) {
            throw new Error('WorkEstimationService nicht verfügbar');
        }

        const useGemini = options.useGemini !== false;
        const materialien = options.materialien || [];

        // Try Gemini first if enabled
        if (useGemini && window.geminiService?.isConfigured) {
            try {
                const geminiResult = await service.schaetzeMitGemini(anfrage, materialien);
                if (geminiResult && geminiResult.quelle === 'gemini') {
                    return {
                        ...geminiResult,
                        quelle: 'gemini',
                        hatGemini: true
                    };
                }
            } catch (e) {
                console.warn('[WorkEstimationUI] Gemini-Schätzung fehlgeschlagen, verwende Basis:', e);
            }
        }

        // Fall back to base estimation
        let result;
        if (materialien.length > 0) {
            result = service.schaetzeMitMaterial(anfrage, materialien);
        } else {
            result = service.schaetzeArbeitsstunden(anfrage);
        }

        return {
            ...result,
            quelle: 'basis',
            hatGemini: false
        };
    }

    // ============================================
    // Render Methods
    // ============================================

    _renderLoading() {
        return `
            <div class="we-panel">
                <div class="we-loading">
                    <div class="we-spinner"></div>
                    <span>Arbeitsstunden werden geschätzt...</span>
                </div>
            </div>
        `;
    }

    _renderError() {
        return `
            <div class="we-panel">
                <div class="we-error">
                    Schätzung konnte nicht berechnet werden. Bitte geben Sie die Stunden manuell ein.
                </div>
                <div class="we-override">
                    <label class="we-override-label">Ihre Einschätzung (Stunden):</label>
                    <div class="we-override-row">
                        <input type="number" class="we-override-input" min="0.5" step="0.5" value="" placeholder="z.B. 8">
                        <span class="we-override-unit">Stunden</span>
                    </div>
                </div>
                <div class="we-actions">
                    <button class="we-btn we-btn-accept" data-action="accept">Stunden übernehmen</button>
                    <button class="we-btn we-btn-dismiss" data-action="dismiss">Ohne Schätzung fortfahren</button>
                </div>
            </div>
        `;
    }

    _renderPanel(estimation, panelState) {
        const stunden = estimation.geschaetzteStunden;
        const konfidenz = estimation.konfidenz || 'mittel';
        const komplexitaet = estimation.komplexitaet || 'mittel';
        const hatGemini = estimation.hatGemini || false;
        const quelle = estimation.quelle || 'basis';

        // Badge text
        const badgeText = hatGemini ? 'KI-Vorschlag' : 'Automatische Schätzung';

        // Confidence display
        const konfidenzMap = {
            hoch: {
                label: 'Hohe Sicherheit',
                text: `Basierend auf ${estimation.historischeDaten || '5+'}  ähnlichen Aufträgen`
            },
            mittel: {
                label: 'Mittlere Sicherheit',
                text: 'Basierend auf Erfahrungswerten'
            },
            niedrig: {
                label: 'Grobe Schätzung',
                text: 'Grobe Schätzung — bitte manuell prüfen'
            }
        };
        const konfidenzInfo = konfidenzMap[konfidenz] || konfidenzMap.mittel;

        // Build reasoning items
        const reasoningHtml = this._buildReasoningHtml(estimation);

        // Build breakdown if Gemini data available
        const breakdownHtml = this._buildBreakdownHtml(estimation);

        // Build recommendation
        const empfehlungHtml = estimation.details?.empfehlung
            ? `<div class="we-empfehlung">${this._sanitize(estimation.details.empfehlung)}</div>`
            : '';

        return `
            <div class="we-panel" data-panel-id="${panelState.containerId}">
                <!-- Header -->
                <div class="we-header">
                    <h3>Geschätzte Arbeitszeit</h3>
                    <span class="we-badge-ki">${this._sanitize(badgeText)}</span>
                </div>

                <!-- Estimate Display -->
                <div class="we-estimate-display">
                    <span class="we-estimate-prefix">~</span>
                    <span class="we-estimate-value">${this._formatHours(stunden)}</span>
                    <span class="we-estimate-unit">Stunden</span>
                </div>

                <!-- Confidence Indicator -->
                <div class="we-confidence we-confidence--${konfidenz}">
                    <div class="we-confidence-bar">
                        <div class="we-confidence-fill"></div>
                    </div>
                    <span class="we-confidence-label">${konfidenzInfo.label}</span>
                    <span class="we-confidence-text">— ${konfidenzInfo.text}</span>
                </div>

                <!-- Reasoning (expandable) -->
                <button class="we-reasoning-toggle" data-action="toggle-reasoning">
                    <span class="we-arrow">▶</span> Warum diese Schätzung?
                </button>
                <div class="we-reasoning-content">
                    ${reasoningHtml}
                </div>

                <!-- Breakdown (if Gemini) -->
                ${breakdownHtml}

                <!-- Recommendation -->
                ${empfehlungHtml}

                <!-- Override Controls -->
                <div class="we-override" data-override-section>
                    <label class="we-override-label">Ihre Einschätzung (Stunden):</label>
                    <div class="we-override-row">
                        <input type="number"
                               class="we-override-input"
                               data-action="override-input"
                               min="0.5"
                               step="0.5"
                               value="${stunden}">
                        <span class="we-override-unit">Stunden</span>
                    </div>
                    <div class="we-override-hint">
                        Sie können die KI-Schätzung jederzeit überschreiben
                    </div>
                    <div class="we-override-changed-info" data-override-info>
                        Ihr Wert weicht von der Schätzung ab — Ihre Eingabe wird verwendet.
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="we-actions">
                    <button class="we-btn we-btn-accept" data-action="accept">
                        Schätzung übernehmen
                    </button>
                    <button class="we-btn we-btn-dismiss" data-action="dismiss">
                        Ohne Schätzung fortfahren
                    </button>
                </div>
            </div>
        `;
    }

    _buildReasoningHtml(estimation) {
        const items = [];
        const details = estimation.details || {};

        // Leistungsart / base hours
        if (details.leistungsart) {
            items.push({
                label: 'Leistungsart',
                value: details.leistungsart
            });
        }

        if (details.basisStunden !== undefined) {
            items.push({
                label: 'Basis-Richtwert',
                value: `${details.basisStunden} Stunden`
            });
        }

        // Complexity
        if (details.ermittelteKomplexitaet) {
            const komplexLabels = {
                einfach: 'Einfach (Faktor ×' + (details.komplexitaetsFaktor || '0.7') + ')',
                mittel: 'Mittel (Faktor ×' + (details.komplexitaetsFaktor || '1.0') + ')',
                komplex: 'Komplex (Faktor ×' + (details.komplexitaetsFaktor || '1.5') + ')'
            };
            items.push({
                label: 'Komplexität',
                value: komplexLabels[details.ermittelteKomplexitaet] || details.ermittelteKomplexitaet
            });
        }

        // Historical data
        if (estimation.historischeDaten !== undefined) {
            const count = estimation.historischeDaten;
            items.push({
                label: 'Historische Daten',
                value: count > 0
                    ? `${count} ähnliche Aufträge berücksichtigt`
                    : 'Keine ähnlichen Aufträge vorhanden'
            });
        }

        // Material handling
        if (details.materialHandling) {
            items.push({
                label: 'Material-Handling',
                value: `+${details.materialHandling} Stunden`
            });
        }

        // Source
        if (estimation.hatGemini) {
            items.push({
                label: 'Datenquelle',
                value: 'KI-Analyse (Gemini)'
            });
        }

        // Gemini reasoning
        if (estimation.begruendung) {
            items.push({
                label: 'KI-Begründung',
                value: estimation.begruendung
            });
        }

        return items.map(item => `
            <div class="we-reasoning-item">
                <span class="we-reasoning-bullet">▪</span>
                <span class="we-reasoning-label">${this._sanitize(item.label)}:</span>
                <span class="we-reasoning-value">${this._sanitize(item.value)}</span>
            </div>
        `).join('');
    }

    _buildBreakdownHtml(estimation) {
        if (!estimation.aufschluesselung) { return ''; }

        const a = estimation.aufschluesselung;
        const rows = [];

        if (a.vorbereitung !== undefined) {
            rows.push({ label: 'Vorbereitung', value: a.vorbereitung });
        }
        if (a.fertigung !== undefined) {
            rows.push({ label: 'Fertigung', value: a.fertigung });
        }
        if (a.montage !== undefined) {
            rows.push({ label: 'Montage', value: a.montage });
        }
        if (a.dokumentation !== undefined) {
            rows.push({ label: 'Dokumentation', value: a.dokumentation });
        }

        if (rows.length === 0) { return ''; }

        const rowsHtml = rows.map(r => `
            <div class="we-breakdown-row">
                <span class="we-breakdown-label">${r.label}</span>
                <span class="we-breakdown-value">${this._formatHours(r.value)} Std.</span>
            </div>
        `).join('');

        return `
            <div class="we-breakdown">
                <div class="we-breakdown-title">Aufschlüsselung</div>
                ${rowsHtml}
            </div>
        `;
    }

    // ============================================
    // Event Handling
    // ============================================

    _attachPanelEvents(containerId, panelState) {
        const container = document.getElementById(containerId);
        if (!container) { return; }

        // Reasoning toggle
        const toggleBtn = container.querySelector('[data-action="toggle-reasoning"]');
        const reasoningContent = container.querySelector('.we-reasoning-content');
        if (toggleBtn && reasoningContent) {
            toggleBtn.addEventListener('click', () => {
                toggleBtn.classList.toggle('we-open');
                reasoningContent.classList.toggle('we-visible');
            });
        }

        // Override input
        const overrideInput = container.querySelector('[data-action="override-input"]');
        const overrideSection = container.querySelector('[data-override-section]');
        const overrideInfo = container.querySelector('[data-override-info]');
        if (overrideInput) {
            overrideInput.addEventListener('input', () => {
                const newVal = parseFloat(overrideInput.value);
                if (!isNaN(newVal) && newVal > 0) {
                    panelState.currentValue = newVal;
                    const isChanged = newVal !== panelState.originalEstimate;
                    panelState.isOverridden = isChanged;

                    // Visual feedback
                    overrideInput.classList.toggle('we-modified', isChanged);
                    if (overrideSection) {
                        overrideSection.classList.toggle('we-override-active', isChanged);
                    }
                    if (overrideInfo) {
                        overrideInfo.classList.toggle('we-visible', isChanged);
                    }
                }
            });
        }

        // Accept button
        const acceptBtn = container.querySelector('[data-action="accept"]');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => {
                this._handleAccept(containerId, panelState);
            });
        }

        // Dismiss button
        const dismissBtn = container.querySelector('[data-action="dismiss"]');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                this._handleDismiss(containerId, panelState);
            });
        }
    }

    _handleAccept(containerId, panelState) {
        const finalValue = panelState.currentValue;
        let quelle;

        if (panelState.isOverridden) {
            quelle = 'ki-angepasst';
        } else if (panelState.estimation?.hatGemini) {
            quelle = 'ki';
        } else {
            quelle = 'manuell';
        }

        const result = {
            geschaetzteStunden: finalValue,
            schaetzungQuelle: quelle,
            originalSchaetzung: panelState.originalEstimate,
            konfidenz: panelState.estimation?.konfidenz || 'mittel',
            komplexitaet: panelState.estimation?.komplexitaet || 'mittel'
        };

        // Fire callback
        if (typeof panelState.options.onAccept === 'function') {
            panelState.options.onAccept(result);
        }

        // Clean up
        this.activePanels.delete(containerId);
    }

    _handleDismiss(containerId, panelState) {
        if (typeof panelState.options.onDismiss === 'function') {
            panelState.options.onDismiss();
        }

        // Clean up panel
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
        }
        this.activePanels.delete(containerId);
    }

    // ============================================
    // Public: Remove a panel programmatically
    // ============================================

    removePanel(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
        }
        this.activePanels.delete(containerId);
    }

    // ============================================
    // Public: Get the current value of a panel
    // ============================================

    getPanelValue(containerId) {
        const state = this.activePanels.get(containerId);
        if (!state) { return null; }
        return {
            geschaetzteStunden: state.currentValue,
            isOverridden: state.isOverridden,
            schaetzungQuelle: state.isOverridden
                ? 'ki-angepasst'
                : (state.estimation?.hatGemini ? 'ki' : 'manuell')
        };
    }

    // ============================================
    // Helpers
    // ============================================

    _formatHours(value) {
        if (value === undefined || value === null) { return '0'; }
        const num = parseFloat(value);
        if (isNaN(num)) { return '0'; }
        // Show one decimal only if needed (e.g., 8.5 but not 8.0)
        return num % 1 === 0 ? num.toString() : num.toFixed(1);
    }

    _sanitize(str) {
        if (!str) { return ''; }
        const temp = document.createElement('div');
        temp.textContent = String(str);
        return temp.innerHTML;
    }
}

// Create global instance
window.workEstimationUI = new WorkEstimationUI();
