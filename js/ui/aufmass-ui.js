/* ============================================
   Aufmass UI (Site Measurement Interface)
   Full UI for digital room measurement, material
   estimation, and quote integration.
   ============================================ */

class AufmassUI {
    constructor() {
        this.currentProjectId = null;
        this.currentRoomId = null;
        this.currentScreen = 'list'; // list | detail | room-editor | material | quote-transfer
        this.debounceTimers = {};
        this.init();
    }

    // ============================================
    // Initialization
    // ============================================

    init() {
        // Listen for view changes
        document.addEventListener('viewchange', (e) => {
            if (e.detail.view === 'aufmass') {
                this.render();
            }
        });

        // Delegate all click events inside the aufmass container
        document.addEventListener('click', (e) => {
            const container = document.getElementById('aufmass-container');
            if (!container || !container.contains(e.target)) return;
            this.handleClick(e);
        });

        // Delegate input events for real-time calculation
        document.addEventListener('input', (e) => {
            const container = document.getElementById('aufmass-container');
            if (!container || !container.contains(e.target)) return;
            this.handleInput(e);
        });

        // Delegate change events
        document.addEventListener('change', (e) => {
            const container = document.getElementById('aufmass-container');
            if (!container || !container.contains(e.target)) return;
            this.handleChange(e);
        });
    }

    // ============================================
    // Main Render Router
    // ============================================

    render() {
        const container = document.getElementById('aufmass-container');
        if (!container) return;

        switch (this.currentScreen) {
            case 'list':
                this.renderProjectList(container);
                break;
            case 'detail':
                this.renderProjectDetail(container);
                break;
            case 'room-editor':
                this.renderRoomEditor(container);
                break;
            case 'material':
                this.renderMaterialCalculator(container);
                break;
            case 'quote-transfer':
                this.renderQuoteTransfer(container);
                break;
            default:
                this.renderProjectList(container);
        }
    }

    // ============================================
    // Screen 1: Project List
    // ============================================

    renderProjectList(container) {
        const service = window.aufmassService;
        if (!service) {
            container.innerHTML = '<p class="aufmass-empty">Aufma\u00DF-Service nicht verf\u00FCgbar.</p>';
            return;
        }

        const projects = service.getProjects();

        container.innerHTML = `
            <div class="aufmass-header">
                <div class="aufmass-header-text">
                    <h2>Aufma\u00DF-Projekte</h2>
                    <p class="aufmass-subtitle">${projects.length} Projekt${projects.length !== 1 ? 'e' : ''}</p>
                </div>
                <div class="aufmass-header-actions">
                    <button class="btn btn-primary aufmass-btn-new" data-action="new-project">
                        + Neues Aufma\u00DF
                    </button>
                </div>
            </div>

            <div class="aufmass-search-bar">
                <input type="text" id="aufmass-search" class="aufmass-input" placeholder="Projekte durchsuchen..." />
            </div>

            ${projects.length === 0 ? `
                <div class="aufmass-empty-state">
                    <div class="aufmass-empty-icon">📐</div>
                    <h3>Noch keine Aufma\u00DF-Projekte</h3>
                    <p>Erstellen Sie Ihr erstes digitales Aufma\u00DF, um R\u00E4ume zu vermessen und Mengen direkt in Angebote zu \u00FCbernehmen.</p>
                    <button class="btn btn-primary" data-action="new-project">Erstes Aufma\u00DF erstellen</button>
                </div>
            ` : `
                <div class="aufmass-project-grid">
                    ${projects.map(p => this._renderProjectCard(p)).join('')}
                </div>
            `}
        `;
    }

    _renderProjectCard(project) {
        const service = window.aufmassService;
        const summary = service.getProjectSummary(project.id);
        const dateStr = this._formatDate(project.updatedAt || project.createdAt);

        return `
            <div class="aufmass-project-card" data-action="open-project" data-project-id="${project.id}">
                <div class="aufmass-project-card-header">
                    <div class="aufmass-project-icon">📐</div>
                    <div class="aufmass-project-meta">
                        <h3 class="aufmass-project-name">${this._esc(project.name)}</h3>
                        <span class="aufmass-project-date">${dateStr}</span>
                    </div>
                    <button class="aufmass-btn-icon aufmass-btn-delete" data-action="delete-project" data-project-id="${project.id}" title="Projekt l\u00F6schen">&times;</button>
                </div>
                <div class="aufmass-project-card-body">
                    ${project.customerName ? `<div class="aufmass-project-customer">👤 ${this._esc(project.customerName)}</div>` : ''}
                    ${project.address ? `<div class="aufmass-project-address">📍 ${this._esc(project.address)}</div>` : ''}
                </div>
                <div class="aufmass-project-card-stats">
                    <div class="aufmass-stat-mini">
                        <span class="aufmass-stat-value">${summary.roomCount}</span>
                        <span class="aufmass-stat-label">R\u00E4ume</span>
                    </div>
                    <div class="aufmass-stat-mini">
                        <span class="aufmass-stat-value">${summary.totalFloorArea.toFixed(1)}</span>
                        <span class="aufmass-stat-label">m\u00B2 Boden</span>
                    </div>
                    <div class="aufmass-stat-mini">
                        <span class="aufmass-stat-value">${summary.totalNetWallArea.toFixed(1)}</span>
                        <span class="aufmass-stat-label">m\u00B2 Wand</span>
                    </div>
                    <div class="aufmass-stat-mini">
                        <span class="aufmass-stat-value">${summary.totalVolume.toFixed(1)}</span>
                        <span class="aufmass-stat-label">m\u00B3</span>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // Screen 2: Project Detail
    // ============================================

    renderProjectDetail(container) {
        const service = window.aufmassService;
        const project = service.getProject(this.currentProjectId);
        if (!project) {
            this.currentScreen = 'list';
            this.render();
            return;
        }

        const summary = service.getProjectSummary(this.currentProjectId);

        container.innerHTML = `
            <div class="aufmass-header">
                <div class="aufmass-header-text">
                    <button class="aufmass-btn-back" data-action="back-to-list">&larr; Zur\u00FCck</button>
                    <h2 class="aufmass-editable-title" contenteditable="false">${this._esc(project.name)}</h2>
                    <p class="aufmass-subtitle">
                        ${project.customerName ? `👤 ${this._esc(project.customerName)}` : ''}
                        ${project.address ? ` | 📍 ${this._esc(project.address)}` : ''}
                    </p>
                </div>
                <div class="aufmass-header-actions">
                    <button class="btn btn-secondary" data-action="edit-project" data-project-id="${project.id}" title="Projekt bearbeiten">Bearbeiten</button>
                    <button class="btn btn-secondary" data-action="export-project" data-project-id="${project.id}" title="JSON Export">Export</button>
                    <button class="btn btn-primary" data-action="open-quote-transfer" data-project-id="${project.id}">In Angebot \u00FCbernehmen</button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="aufmass-summary-grid">
                <div class="aufmass-summary-card">
                    <div class="aufmass-summary-value">${summary.roomCount}</div>
                    <div class="aufmass-summary-label">R\u00E4ume</div>
                </div>
                <div class="aufmass-summary-card">
                    <div class="aufmass-summary-value">${summary.totalFloorArea.toFixed(2)}<small> m\u00B2</small></div>
                    <div class="aufmass-summary-label">Bodenfl\u00E4che gesamt</div>
                </div>
                <div class="aufmass-summary-card">
                    <div class="aufmass-summary-value">${summary.totalNetWallArea.toFixed(2)}<small> m\u00B2</small></div>
                    <div class="aufmass-summary-label">Wandfl\u00E4che (netto)</div>
                </div>
                <div class="aufmass-summary-card">
                    <div class="aufmass-summary-value">${summary.totalVolume.toFixed(2)}<small> m\u00B3</small></div>
                    <div class="aufmass-summary-label">Volumen gesamt</div>
                </div>
                <div class="aufmass-summary-card">
                    <div class="aufmass-summary-value">${summary.totalPerimeter.toFixed(2)}<small> m</small></div>
                    <div class="aufmass-summary-label">Umfang gesamt</div>
                </div>
                <div class="aufmass-summary-card">
                    <div class="aufmass-summary-value">${summary.totalDeductionArea.toFixed(2)}<small> m\u00B2</small></div>
                    <div class="aufmass-summary-label">Abz\u00FCge (Fenster/T\u00FCren)</div>
                </div>
            </div>

            <!-- Rooms -->
            <div class="aufmass-section">
                <div class="aufmass-section-header">
                    <h3>R\u00E4ume</h3>
                    <button class="btn btn-primary btn-small" data-action="add-room" data-project-id="${project.id}">+ Raum hinzuf\u00FCgen</button>
                </div>

                ${project.rooms.length === 0 ? `
                    <div class="aufmass-empty-state aufmass-empty-state--compact">
                        <p>Noch keine R\u00E4ume angelegt. F\u00FCgen Sie den ersten Raum hinzu.</p>
                    </div>
                ` : `
                    <div class="aufmass-room-list">
                        ${project.rooms.map(room => this._renderRoomCard(room, project.id)).join('')}
                    </div>
                `}
            </div>

            <!-- Project Notes -->
            ${project.notes ? `
                <div class="aufmass-section">
                    <h3>Notizen</h3>
                    <div class="aufmass-notes-display">${this._esc(project.notes)}</div>
                </div>
            ` : ''}
        `;
    }

    _renderRoomCard(room, projectId) {
        const service = window.aufmassService;
        const calc = service.calculateRoom(room);
        const typeDef = service.ROOM_TYPES[room.type] || service.ROOM_TYPES.rechteck;
        const deductionCount = (room.deductions || []).reduce((s, d) => s + (d.count || 1), 0);

        return `
            <div class="aufmass-room-card" data-action="open-room" data-project-id="${projectId}" data-room-id="${room.id}">
                <div class="aufmass-room-card-left">
                    <div class="aufmass-room-icon">${typeDef.icon}</div>
                    <div class="aufmass-room-info">
                        <h4>${this._esc(room.name)}</h4>
                        <span class="aufmass-room-type-badge">${typeDef.label}</span>
                        ${deductionCount > 0 ? `<span class="aufmass-deduction-badge">${deductionCount} Abz\u00FCge</span>` : ''}
                    </div>
                </div>
                <div class="aufmass-room-card-stats">
                    <div class="aufmass-room-stat">
                        <span class="aufmass-room-stat-val">${calc.floorArea.toFixed(2)}</span>
                        <span class="aufmass-room-stat-unit">m\u00B2 Boden</span>
                    </div>
                    <div class="aufmass-room-stat">
                        <span class="aufmass-room-stat-val">${calc.netWallArea.toFixed(2)}</span>
                        <span class="aufmass-room-stat-unit">m\u00B2 Wand</span>
                    </div>
                    <div class="aufmass-room-stat">
                        <span class="aufmass-room-stat-val">${calc.volume.toFixed(2)}</span>
                        <span class="aufmass-room-stat-unit">m\u00B3</span>
                    </div>
                </div>
                <div class="aufmass-room-card-actions">
                    <button class="aufmass-btn-icon" data-action="open-material-calc" data-project-id="${projectId}" data-room-id="${room.id}" title="Material berechnen">📊</button>
                    <button class="aufmass-btn-icon aufmass-btn-delete" data-action="delete-room" data-project-id="${projectId}" data-room-id="${room.id}" title="Raum l\u00F6schen">&times;</button>
                </div>
            </div>
        `;
    }

    // ============================================
    // Screen 3: Room Editor
    // ============================================

    renderRoomEditor(container) {
        const service = window.aufmassService;
        const project = service.getProject(this.currentProjectId);
        if (!project) { this.currentScreen = 'list'; this.render(); return; }

        const room = project.rooms.find(r => r.id === this.currentRoomId);
        if (!room) { this.currentScreen = 'detail'; this.render(); return; }

        const calc = service.calculateRoom(room);
        const typeDef = service.ROOM_TYPES[room.type] || service.ROOM_TYPES.rechteck;

        container.innerHTML = `
            <div class="aufmass-header">
                <div class="aufmass-header-text">
                    <button class="aufmass-btn-back" data-action="back-to-detail">&larr; Zur\u00FCck zu ${this._esc(project.name)}</button>
                    <h2>Raum bearbeiten</h2>
                </div>
                <div class="aufmass-header-actions">
                    <button class="btn btn-secondary" data-action="open-material-calc" data-project-id="${project.id}" data-room-id="${room.id}">Material berechnen</button>
                </div>
            </div>

            <div class="aufmass-room-editor-layout">
                <!-- Left: Inputs -->
                <div class="aufmass-editor-inputs">
                    <!-- Room Name & Type -->
                    <div class="aufmass-form-card">
                        <h3>Raum-Informationen</h3>
                        <div class="aufmass-form-grid">
                            <div class="aufmass-form-group">
                                <label for="aufmass-room-name">Raumname</label>
                                <input type="text" id="aufmass-room-name" class="aufmass-input" value="${this._esc(room.name)}"
                                    data-field="name" data-project-id="${project.id}" data-room-id="${room.id}" />
                            </div>
                            <div class="aufmass-form-group">
                                <label for="aufmass-room-type">Raumform</label>
                                <select id="aufmass-room-type" class="aufmass-input" data-field="type"
                                    data-project-id="${project.id}" data-room-id="${room.id}">
                                    ${Object.entries(service.ROOM_TYPES).map(([key, val]) =>
                                        `<option value="${key}" ${room.type === key ? 'selected' : ''}>${val.icon} ${val.label}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Dimensions (type-dependent) -->
                    <div class="aufmass-form-card">
                        <h3>Ma\u00DFe (in Metern)</h3>
                        <div class="aufmass-form-grid" id="aufmass-dimension-fields">
                            ${this._renderDimensionFields(room, project.id)}
                        </div>
                    </div>

                    <!-- Deductions -->
                    <div class="aufmass-form-card">
                        <div class="aufmass-section-header">
                            <h3>Abz\u00FCge (Fenster, T\u00FCren)</h3>
                            <button class="btn btn-small btn-secondary" data-action="add-deduction" data-project-id="${project.id}" data-room-id="${room.id}">+ Abzug</button>
                        </div>
                        <div id="aufmass-deductions-list">
                            ${this._renderDeductions(room, project.id)}
                        </div>
                    </div>

                    <!-- Room Notes -->
                    <div class="aufmass-form-card">
                        <h3>Notizen</h3>
                        <textarea class="aufmass-input aufmass-textarea" data-field="notes"
                            data-project-id="${project.id}" data-room-id="${room.id}"
                            placeholder="Anmerkungen zum Raum...">${this._esc(room.notes || '')}</textarea>
                    </div>
                </div>

                <!-- Right: Preview & Calculations -->
                <div class="aufmass-editor-preview">
                    <!-- Visual Preview -->
                    <div class="aufmass-form-card">
                        <h3>Vorschau</h3>
                        <div class="aufmass-preview-container" id="aufmass-room-preview">
                            ${this._renderRoomPreview(room, calc)}
                        </div>
                    </div>

                    <!-- Calculation Results -->
                    <div class="aufmass-form-card aufmass-calc-results">
                        <h3>Berechnungen</h3>
                        <div class="aufmass-calc-grid" id="aufmass-calc-display">
                            ${this._renderCalcResults(calc)}
                        </div>
                    </div>

                    <!-- Wall Areas -->
                    ${calc.wallAreas.length > 0 ? `
                        <div class="aufmass-form-card">
                            <h3>Wandfl\u00E4chen</h3>
                            <div class="aufmass-wall-list">
                                ${calc.wallAreas.map(w => `
                                    <div class="aufmass-wall-item">
                                        <span class="aufmass-wall-name">${this._esc(w.wall)}</span>
                                        <span class="aufmass-wall-area">${w.area.toFixed(2)} m\u00B2</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    _renderDimensionFields(room, projectId) {
        const fields = [];

        const makeField = (id, label, value, unit = 'm') => `
            <div class="aufmass-form-group">
                <label for="aufmass-dim-${id}">${label}</label>
                <div class="aufmass-input-with-unit">
                    <input type="number" id="aufmass-dim-${id}" class="aufmass-input aufmass-dim-input"
                        value="${value || ''}" step="0.01" min="0" max="999"
                        data-field="${id}" data-project-id="${projectId}" data-room-id="${room.id}"
                        placeholder="0.00" />
                    <span class="aufmass-input-unit">${unit}</span>
                </div>
            </div>
        `;

        // Height is always shown
        switch (room.type) {
            case 'rechteck':
                fields.push(makeField('length', 'L\u00E4nge', room.length));
                fields.push(makeField('width', 'Breite', room.width));
                fields.push(makeField('height', 'H\u00F6he', room.height));
                break;
            case 'lform':
                fields.push(makeField('length1', 'L\u00E4nge Teil 1', room.length1));
                fields.push(makeField('width1', 'Breite Teil 1', room.width1));
                fields.push(makeField('length2', 'L\u00E4nge Teil 2', room.length2));
                fields.push(makeField('width2', 'Breite Teil 2', room.width2));
                fields.push(makeField('height', 'H\u00F6he', room.height));
                break;
            case 'trapez':
                fields.push(makeField('sideA', 'Seite A (oben)', room.sideA));
                fields.push(makeField('sideB', 'Seite B (unten)', room.sideB));
                fields.push(makeField('depth', 'Tiefe', room.depth));
                fields.push(makeField('height', 'H\u00F6he', room.height));
                break;
            case 'dreieck':
                fields.push(makeField('base', 'Basis', room.base));
                fields.push(makeField('triHeight', 'H\u00F6he (Dreieck)', room.triHeight));
                fields.push(makeField('height', 'Raumh\u00F6he', room.height));
                break;
            case 'kreis':
                fields.push(makeField('radius', 'Radius', room.radius));
                fields.push(makeField('height', 'H\u00F6he', room.height));
                break;
            case 'frei':
                fields.push(makeField('height', 'H\u00F6he', room.height));
                // Custom polygon editor is handled separately
                break;
            default:
                fields.push(makeField('length', 'L\u00E4nge', room.length));
                fields.push(makeField('width', 'Breite', room.width));
                fields.push(makeField('height', 'H\u00F6he', room.height));
        }

        return fields.join('');
    }

    _renderDeductions(room, projectId) {
        if (!room.deductions || room.deductions.length === 0) {
            return '<p class="aufmass-deduction-empty">Keine Abz\u00FCge. F\u00FCgen Sie Fenster oder T\u00FCren hinzu.</p>';
        }

        const service = window.aufmassService;

        return room.deductions.map(d => {
            const typeDef = service.DEDUCTION_TYPES[d.type] || service.DEDUCTION_TYPES.sonstiges;
            const area = (d.width * d.height * (d.count || 1)).toFixed(2);

            return `
                <div class="aufmass-deduction-item" data-deduction-id="${d.id}">
                    <div class="aufmass-deduction-icon">${typeDef.icon}</div>
                    <div class="aufmass-deduction-info">
                        <span class="aufmass-deduction-name">${this._esc(d.name)}</span>
                        <span class="aufmass-deduction-dims">${d.width.toFixed(2)} x ${d.height.toFixed(2)} m${d.count > 1 ? ` (${d.count}x)` : ''}</span>
                    </div>
                    <div class="aufmass-deduction-area">${area} m\u00B2</div>
                    <button class="aufmass-btn-icon aufmass-btn-delete" data-action="remove-deduction"
                        data-project-id="${projectId}" data-room-id="${room.id}" data-deduction-id="${d.id}"
                        title="Abzug entfernen">&times;</button>
                </div>
            `;
        }).join('');
    }

    _renderCalcResults(calc) {
        return `
            <div class="aufmass-calc-item aufmass-calc-item--primary">
                <span class="aufmass-calc-label">Bodenfl\u00E4che</span>
                <span class="aufmass-calc-value">${calc.floorArea.toFixed(2)} <small>m\u00B2</small></span>
            </div>
            <div class="aufmass-calc-item">
                <span class="aufmass-calc-label">Deckenfl\u00E4che</span>
                <span class="aufmass-calc-value">${calc.ceilingArea.toFixed(2)} <small>m\u00B2</small></span>
            </div>
            <div class="aufmass-calc-item aufmass-calc-item--primary">
                <span class="aufmass-calc-label">Wandfl\u00E4che (brutto)</span>
                <span class="aufmass-calc-value">${calc.wallArea.toFixed(2)} <small>m\u00B2</small></span>
            </div>
            <div class="aufmass-calc-item aufmass-calc-item--highlight">
                <span class="aufmass-calc-label">Wandfl\u00E4che (netto)</span>
                <span class="aufmass-calc-value">${calc.netWallArea.toFixed(2)} <small>m\u00B2</small></span>
            </div>
            <div class="aufmass-calc-item">
                <span class="aufmass-calc-label">Abz\u00FCge gesamt</span>
                <span class="aufmass-calc-value aufmass-calc-value--deduction">-${calc.totalDeductionArea.toFixed(2)} <small>m\u00B2</small></span>
            </div>
            <div class="aufmass-calc-item">
                <span class="aufmass-calc-label">Umfang</span>
                <span class="aufmass-calc-value">${calc.perimeter.toFixed(2)} <small>m</small></span>
            </div>
            <div class="aufmass-calc-item aufmass-calc-item--primary">
                <span class="aufmass-calc-label">Volumen</span>
                <span class="aufmass-calc-value">${calc.volume.toFixed(2)} <small>m\u00B3</small></span>
            </div>
        `;
    }

    // ============================================
    // SVG Room Preview
    // ============================================

    _renderRoomPreview(room, calc) {
        const svgWidth = 400;
        const svgHeight = 300;
        const padding = 40;

        let svgContent = '';

        switch (room.type) {
            case 'rechteck':
                svgContent = this._svgRectangle(room, svgWidth, svgHeight, padding);
                break;
            case 'lform':
                svgContent = this._svgLForm(room, svgWidth, svgHeight, padding);
                break;
            case 'trapez':
                svgContent = this._svgTrapezoid(room, svgWidth, svgHeight, padding);
                break;
            case 'dreieck':
                svgContent = this._svgTriangle(room, svgWidth, svgHeight, padding);
                break;
            case 'kreis':
                svgContent = this._svgCircle(room, svgWidth, svgHeight, padding);
                break;
            default:
                svgContent = this._svgRectangle(room, svgWidth, svgHeight, padding);
        }

        return `
            <svg class="aufmass-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(99,102,241,0.08)" stroke-width="0.5"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" rx="8" />
                ${svgContent}
                <!-- Scale indicator -->
                <text x="${svgWidth - padding}" y="${svgHeight - 8}" fill="#71717a" font-size="10" text-anchor="end" font-family="Inter, sans-serif">Ma\u00DFe in m</text>
            </svg>
        `;
    }

    _svgRectangle(room, W, H, pad) {
        const l = room.length || 0;
        const w = room.width || 0;
        if (l === 0 && w === 0) return this._svgPlaceholder(W, H);

        const drawW = W - 2 * pad;
        const drawH = H - 2 * pad;
        const scale = Math.min(drawW / (l || 1), drawH / (w || 1));
        const rw = l * scale;
        const rh = w * scale;
        const rx = (W - rw) / 2;
        const ry = (H - rh) / 2;

        let deductions = this._svgDeductions(room, rx, ry, rw, rh, l, w);

        return `
            <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="rgba(99,102,241,0.1)" stroke="#6366f1" stroke-width="2" rx="2" />
            ${deductions}
            <!-- Dimension labels -->
            <text x="${rx + rw / 2}" y="${ry - 8}" fill="#a1a1aa" font-size="12" text-anchor="middle" font-family="Inter, sans-serif">${l.toFixed(2)} m</text>
            <text x="${rx + rw + 12}" y="${ry + rh / 2}" fill="#a1a1aa" font-size="12" text-anchor="start" font-family="Inter, sans-serif" transform="rotate(90 ${rx + rw + 12} ${ry + rh / 2})">${w.toFixed(2)} m</text>
            <!-- Area label -->
            <text x="${rx + rw / 2}" y="${ry + rh / 2}" fill="#ffffff" font-size="14" text-anchor="middle" font-weight="600" font-family="Inter, sans-serif">${(l * w).toFixed(2)} m\u00B2</text>
        `;
    }

    _svgLForm(room, W, H, pad) {
        const l1 = room.length1 || 0;
        const w1 = room.width1 || 0;
        const l2 = room.length2 || 0;
        const w2 = room.width2 || 0;
        if (l1 === 0 && l2 === 0) return this._svgPlaceholder(W, H);

        const maxL = Math.max(l1, l2);
        const maxW = w1 + w2;
        const drawW = W - 2 * pad;
        const drawH = H - 2 * pad;
        const scale = Math.min(drawW / (maxL || 1), drawH / (maxW || 1));

        const ox = (W - maxL * scale) / 2;
        const oy = (H - maxW * scale) / 2;

        // L-shape as polygon
        const points = [
            `${ox},${oy}`,
            `${ox + l1 * scale},${oy}`,
            `${ox + l1 * scale},${oy + w1 * scale}`,
            `${ox + l2 * scale},${oy + w1 * scale}`,
            `${ox + l2 * scale},${oy + (w1 + w2) * scale}`,
            `${ox},${oy + (w1 + w2) * scale}`
        ].join(' ');

        const area = (l1 * w1 + l2 * w2).toFixed(2);

        return `
            <polygon points="${points}" fill="rgba(99,102,241,0.1)" stroke="#6366f1" stroke-width="2" />
            <text x="${W / 2}" y="${H / 2}" fill="#ffffff" font-size="14" text-anchor="middle" font-weight="600" font-family="Inter, sans-serif">${area} m\u00B2</text>
            <text x="${ox + (l1 * scale) / 2}" y="${oy - 8}" fill="#a1a1aa" font-size="11" text-anchor="middle" font-family="Inter, sans-serif">${l1.toFixed(2)} m</text>
            <text x="${ox + (l2 * scale) / 2}" y="${oy + (w1 + w2) * scale + 16}" fill="#a1a1aa" font-size="11" text-anchor="middle" font-family="Inter, sans-serif">${l2.toFixed(2)} m</text>
        `;
    }

    _svgTrapezoid(room, W, H, pad) {
        const a = room.sideA || 0;
        const b = room.sideB || 0;
        const d = room.depth || 0;
        if (a === 0 && b === 0) return this._svgPlaceholder(W, H);

        const maxSide = Math.max(a, b);
        const drawW = W - 2 * pad;
        const drawH = H - 2 * pad;
        const scale = Math.min(drawW / (maxSide || 1), drawH / (d || 1));

        const cx = W / 2;
        const oy = (H - d * scale) / 2;

        const points = [
            `${cx - (a * scale) / 2},${oy}`,
            `${cx + (a * scale) / 2},${oy}`,
            `${cx + (b * scale) / 2},${oy + d * scale}`,
            `${cx - (b * scale) / 2},${oy + d * scale}`
        ].join(' ');

        const area = (((a + b) / 2) * d).toFixed(2);

        return `
            <polygon points="${points}" fill="rgba(99,102,241,0.1)" stroke="#6366f1" stroke-width="2" />
            <text x="${cx}" y="${oy - 8}" fill="#a1a1aa" font-size="11" text-anchor="middle" font-family="Inter, sans-serif">${a.toFixed(2)} m</text>
            <text x="${cx}" y="${oy + d * scale + 16}" fill="#a1a1aa" font-size="11" text-anchor="middle" font-family="Inter, sans-serif">${b.toFixed(2)} m</text>
            <text x="${cx}" y="${oy + (d * scale) / 2}" fill="#ffffff" font-size="14" text-anchor="middle" font-weight="600" font-family="Inter, sans-serif">${area} m\u00B2</text>
        `;
    }

    _svgTriangle(room, W, H, pad) {
        const base = room.base || 0;
        const th = room.triHeight || 0;
        if (base === 0 && th === 0) return this._svgPlaceholder(W, H);

        const drawW = W - 2 * pad;
        const drawH = H - 2 * pad;
        const scale = Math.min(drawW / (base || 1), drawH / (th || 1));

        const cx = W / 2;
        const by = (H + th * scale) / 2;

        const points = [
            `${cx},${by - th * scale}`,
            `${cx + (base * scale) / 2},${by}`,
            `${cx - (base * scale) / 2},${by}`
        ].join(' ');

        const area = ((base * th) / 2).toFixed(2);

        return `
            <polygon points="${points}" fill="rgba(99,102,241,0.1)" stroke="#6366f1" stroke-width="2" />
            <text x="${cx}" y="${by + 16}" fill="#a1a1aa" font-size="11" text-anchor="middle" font-family="Inter, sans-serif">${base.toFixed(2)} m</text>
            <text x="${cx}" y="${by - th * scale / 3}" fill="#ffffff" font-size="14" text-anchor="middle" font-weight="600" font-family="Inter, sans-serif">${area} m\u00B2</text>
        `;
    }

    _svgCircle(room, W, H, pad) {
        const r = room.radius || 0;
        if (r === 0) return this._svgPlaceholder(W, H);

        const drawR = Math.min(W - 2 * pad, H - 2 * pad) / 2;
        const cx = W / 2;
        const cy = H / 2;

        const area = (Math.PI * r * r).toFixed(2);

        return `
            <circle cx="${cx}" cy="${cy}" r="${drawR}" fill="rgba(99,102,241,0.1)" stroke="#6366f1" stroke-width="2" />
            <line x1="${cx}" y1="${cy}" x2="${cx + drawR}" y2="${cy}" stroke="#a1a1aa" stroke-width="1" stroke-dasharray="4,4" />
            <text x="${cx + drawR / 2}" y="${cy - 6}" fill="#a1a1aa" font-size="11" text-anchor="middle" font-family="Inter, sans-serif">r = ${r.toFixed(2)} m</text>
            <text x="${cx}" y="${cy + 5}" fill="#ffffff" font-size="14" text-anchor="middle" font-weight="600" font-family="Inter, sans-serif">${area} m\u00B2</text>
        `;
    }

    _svgDeductions(room, rx, ry, rw, rh, realL, realW) {
        if (!room.deductions || room.deductions.length === 0) return '';

        const deductions = [];
        // Place deductions along the walls
        let wallIndex = 0;
        room.deductions.forEach(d => {
            const dw = (d.width / realL) * rw;
            const dh = (d.height / (room.height || 2.5)) * rh * 0.15;

            for (let i = 0; i < (d.count || 1); i++) {
                const color = d.type === 'fenster' ? '#3b82f6' : d.type === 'tuer' ? '#a16207' : '#71717a';
                const fillColor = d.type === 'fenster' ? 'rgba(59,130,246,0.3)' : d.type === 'tuer' ? 'rgba(161,98,7,0.3)' : 'rgba(113,113,122,0.2)';

                // Place on top wall by default, distribute
                const offset = (wallIndex * 0.2 + 0.1) * rw;
                const x = rx + Math.min(offset, rw - dw);
                const y = ry - dh / 2;

                deductions.push(`
                    <rect x="${x}" y="${y}" width="${dw}" height="${dh}" fill="${fillColor}" stroke="${color}" stroke-width="1.5" rx="1" />
                `);
                wallIndex++;
            }
        });

        return deductions.join('');
    }

    _svgPlaceholder(W, H) {
        return `
            <text x="${W / 2}" y="${H / 2 - 10}" fill="#71717a" font-size="14" text-anchor="middle" font-family="Inter, sans-serif">Ma\u00DFe eingeben</text>
            <text x="${W / 2}" y="${H / 2 + 10}" fill="#4a4a52" font-size="12" text-anchor="middle" font-family="Inter, sans-serif">f\u00FCr Vorschau</text>
        `;
    }

    // ============================================
    // Screen 4: Material Calculator
    // ============================================

    renderMaterialCalculator(container) {
        const service = window.aufmassService;
        const project = service.getProject(this.currentProjectId);
        if (!project) { this.currentScreen = 'list'; this.render(); return; }

        const room = project.rooms.find(r => r.id === this.currentRoomId);
        if (!room) { this.currentScreen = 'detail'; this.render(); return; }

        const calc = service.calculateRoom(room);
        const materials = service.estimateAllMaterials(room);

        container.innerHTML = `
            <div class="aufmass-header">
                <div class="aufmass-header-text">
                    <button class="aufmass-btn-back" data-action="back-to-room">&larr; Zur\u00FCck zu ${this._esc(room.name)}</button>
                    <h2>Material-Kalkulation</h2>
                    <p class="aufmass-subtitle">${this._esc(room.name)} - ${this._esc(project.name)}</p>
                </div>
            </div>

            <!-- Room Quick Stats -->
            <div class="aufmass-material-room-stats">
                <div class="aufmass-stat-chip">Boden: ${calc.floorArea.toFixed(2)} m\u00B2</div>
                <div class="aufmass-stat-chip">Wand (netto): ${calc.netWallArea.toFixed(2)} m\u00B2</div>
                <div class="aufmass-stat-chip">Decke: ${calc.ceilingArea.toFixed(2)} m\u00B2</div>
                <div class="aufmass-stat-chip">Volumen: ${calc.volume.toFixed(2)} m\u00B3</div>
            </div>

            <!-- Material Cards -->
            <div class="aufmass-material-grid">
                ${materials.map(mat => this._renderMaterialCard(mat, project.id, room.id)).join('')}
            </div>
        `;
    }

    _renderMaterialCard(mat, projectId, roomId) {
        const wastePercent = ((mat.wasteFactor - 1) * 100).toFixed(0);

        return `
            <div class="aufmass-material-card">
                <div class="aufmass-material-header">
                    <h4>${this._esc(mat.label)}</h4>
                    <span class="aufmass-material-desc">${this._esc(mat.description)}</span>
                </div>
                <div class="aufmass-material-body">
                    <div class="aufmass-material-row">
                        <span>Fl\u00E4che</span>
                        <span>${mat.area.toFixed(2)} m\u00B2</span>
                    </div>
                    <div class="aufmass-material-row">
                        <span>Bedarf (netto)</span>
                        <span>${mat.quantity.toFixed(2)} ${this._esc(mat.unit)}</span>
                    </div>
                    <div class="aufmass-material-row aufmass-material-row--muted">
                        <span>Verschnitt (+${wastePercent}%)</span>
                        <span>+${(mat.totalWithWaste - mat.quantity).toFixed(2)} ${this._esc(mat.unit)}</span>
                    </div>
                    <div class="aufmass-material-row aufmass-material-row--total">
                        <span>Gesamt (inkl. Verschnitt)</span>
                        <span class="aufmass-material-total">${mat.totalWithWaste.toFixed(2)} ${this._esc(mat.unit)}</span>
                    </div>
                </div>
                <div class="aufmass-material-footer">
                    <div class="aufmass-material-price-row">
                        <label for="aufmass-mat-price-${mat.materialType}">Einzelpreis (\u20AC)</label>
                        <input type="number" id="aufmass-mat-price-${mat.materialType}" class="aufmass-input aufmass-input--small aufmass-mat-price-input"
                            step="0.01" min="0" placeholder="0.00"
                            data-material-type="${mat.materialType}" data-quantity="${mat.totalWithWaste}" />
                        <span class="aufmass-mat-price-total" id="aufmass-mat-total-${mat.materialType}">= 0,00 \u20AC</span>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // Screen 5: Quote Transfer
    // ============================================

    renderQuoteTransfer(container) {
        const service = window.aufmassService;
        const project = service.getProject(this.currentProjectId);
        if (!project) { this.currentScreen = 'list'; this.render(); return; }

        const summary = service.getProjectSummary(this.currentProjectId);

        // Get existing Angebote from store
        const existingAngebote = (window.storeService?.state?.angebote || []).filter(a => a.status !== 'abgelehnt');

        // Generate preview positions
        const previewPositions = service.generateQuotePositions(this.currentProjectId, {
            includeFloor: true,
            includeWalls: true,
            includeCeiling: false
        });

        container.innerHTML = `
            <div class="aufmass-header">
                <div class="aufmass-header-text">
                    <button class="aufmass-btn-back" data-action="back-to-detail">&larr; Zur\u00FCck</button>
                    <h2>In Angebot \u00FCbernehmen</h2>
                    <p class="aufmass-subtitle">${this._esc(project.name)} - ${summary.roomCount} R\u00E4ume, ${summary.totalFloorArea.toFixed(2)} m\u00B2</p>
                </div>
            </div>

            <!-- Transfer Options -->
            <div class="aufmass-form-card">
                <h3>Positionen konfigurieren</h3>
                <div class="aufmass-transfer-options">
                    <label class="aufmass-checkbox-label">
                        <input type="checkbox" id="aufmass-incl-floor" checked data-action="refresh-positions" />
                        Bodenfl\u00E4chen einbeziehen
                    </label>
                    <label class="aufmass-checkbox-label">
                        <input type="checkbox" id="aufmass-incl-walls" checked data-action="refresh-positions" />
                        Wandfl\u00E4chen einbeziehen (netto)
                    </label>
                    <label class="aufmass-checkbox-label">
                        <input type="checkbox" id="aufmass-incl-ceiling" data-action="refresh-positions" />
                        Deckenfl\u00E4chen einbeziehen
                    </label>
                </div>
            </div>

            <!-- Positions Preview Table -->
            <div class="aufmass-form-card">
                <h3>Vorschau der Positionen</h3>
                <div class="aufmass-positions-table-wrap">
                    <table class="aufmass-positions-table" id="aufmass-positions-table">
                        <thead>
                            <tr>
                                <th>Beschreibung</th>
                                <th>Menge</th>
                                <th>Einheit</th>
                                <th>Einzelpreis (\u20AC)</th>
                                <th>Gesamt (\u20AC)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${previewPositions.map((pos, i) => `
                                <tr>
                                    <td>${this._esc(pos.beschreibung)}</td>
                                    <td>${pos.menge.toFixed(2)}</td>
                                    <td>${this._esc(pos.einheit)}</td>
                                    <td>
                                        <input type="number" class="aufmass-input aufmass-input--small aufmass-pos-price"
                                            value="${pos.preis}" step="0.01" min="0" data-pos-index="${i}" placeholder="0.00" />
                                    </td>
                                    <td class="aufmass-pos-total" data-pos-index="${i}">${(pos.menge * pos.preis).toFixed(2)} \u20AC</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4" style="text-align: right; font-weight: 600;">Netto Gesamt:</td>
                                <td id="aufmass-transfer-total" style="font-weight: 700; color: var(--accent-primary);">
                                    ${previewPositions.reduce((s, p) => s + p.menge * p.preis, 0).toFixed(2)} \u20AC
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- Target Selection -->
            <div class="aufmass-form-card">
                <h3>Ziel-Angebot</h3>
                <div class="aufmass-transfer-target">
                    <label class="aufmass-radio-label">
                        <input type="radio" name="aufmass-target" value="new" checked />
                        Neues Angebot erstellen
                    </label>
                    ${existingAngebote.length > 0 ? `
                        <label class="aufmass-radio-label">
                            <input type="radio" name="aufmass-target" value="existing" />
                            Zu bestehendem Angebot hinzuf\u00FCgen
                        </label>
                        <select id="aufmass-target-angebot" class="aufmass-input" style="margin-top: 8px; display: none;">
                            ${existingAngebote.map(a => `
                                <option value="${a.id}">${a.id} - ${this._esc(a.kunde?.name || 'Unbekannt')} (${(a.brutto || 0).toFixed(2)} \u20AC)</option>
                            `).join('')}
                        </select>
                    ` : ''}
                </div>
            </div>

            <!-- Confirm -->
            <div class="aufmass-transfer-actions">
                <button class="btn btn-secondary" data-action="back-to-detail">Abbrechen</button>
                <button class="btn btn-primary aufmass-btn-transfer" data-action="confirm-transfer" data-project-id="${project.id}">
                    Positionen \u00FCbernehmen
                </button>
            </div>
        `;

        // Wire up radio toggle for target select
        this._wireQuoteTransferEvents();
    }

    _wireQuoteTransferEvents() {
        const radios = document.querySelectorAll('input[name="aufmass-target"]');
        const select = document.getElementById('aufmass-target-angebot');

        radios.forEach(r => {
            r.addEventListener('change', () => {
                if (select) {
                    select.style.display = r.value === 'existing' && r.checked ? 'block' : 'none';
                }
            });
        });
    }

    // ============================================
    // Event Handlers
    // ============================================

    handleClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const projectId = btn.dataset.projectId;
        const roomId = btn.dataset.roomId;
        const deductionId = btn.dataset.deductionId;

        switch (action) {
            case 'new-project':
                this.showNewProjectModal();
                break;

            case 'open-project':
                e.preventDefault();
                this.currentProjectId = projectId;
                this.currentScreen = 'detail';
                this.render();
                break;

            case 'delete-project':
                e.stopPropagation();
                this.confirmDeleteProject(projectId);
                break;

            case 'back-to-list':
                this.currentProjectId = null;
                this.currentScreen = 'list';
                this.render();
                break;

            case 'edit-project':
                this.showEditProjectModal(projectId);
                break;

            case 'export-project':
                this.exportProject(projectId);
                break;

            case 'add-room':
                this.addNewRoom(projectId);
                break;

            case 'open-room':
                e.preventDefault();
                this.currentProjectId = projectId;
                this.currentRoomId = roomId;
                this.currentScreen = 'room-editor';
                this.render();
                break;

            case 'delete-room':
                e.stopPropagation();
                this.confirmDeleteRoom(projectId, roomId);
                break;

            case 'back-to-detail':
                this.currentRoomId = null;
                this.currentScreen = 'detail';
                this.render();
                break;

            case 'back-to-room':
                this.currentScreen = 'room-editor';
                this.render();
                break;

            case 'add-deduction':
                this.showAddDeductionModal(projectId, roomId);
                break;

            case 'remove-deduction':
                e.stopPropagation();
                this.removeDeduction(projectId, roomId, deductionId);
                break;

            case 'open-material-calc':
                e.stopPropagation();
                this.currentProjectId = projectId;
                this.currentRoomId = roomId;
                this.currentScreen = 'material';
                this.render();
                break;

            case 'open-quote-transfer':
                this.currentProjectId = projectId;
                this.currentScreen = 'quote-transfer';
                this.render();
                break;

            case 'confirm-transfer':
                this.executeQuoteTransfer(projectId);
                break;

            case 'refresh-positions':
                // Handled by change event
                break;
        }
    }

    handleInput(e) {
        const el = e.target;

        // Dimension inputs - debounced real-time update
        if (el.classList.contains('aufmass-dim-input')) {
            this._debounce('dimUpdate', () => {
                const field = el.dataset.field;
                const projectId = el.dataset.projectId;
                const roomId = el.dataset.roomId;
                const value = parseFloat(el.value) || 0;

                if (window.aufmassService) {
                    window.aufmassService.updateRoom(projectId, roomId, { [field]: value });
                    // Update preview and calculations only
                    this._refreshCalcAndPreview(projectId, roomId);
                }
            }, 300);
        }

        // Room name
        if (el.dataset.field === 'name' && el.dataset.roomId) {
            this._debounce('nameUpdate', () => {
                window.aufmassService?.updateRoom(el.dataset.projectId, el.dataset.roomId, { name: el.value });
            }, 500);
        }

        // Room notes
        if (el.dataset.field === 'notes' && el.dataset.roomId) {
            this._debounce('notesUpdate', () => {
                window.aufmassService?.updateRoom(el.dataset.projectId, el.dataset.roomId, { notes: el.value });
            }, 500);
        }

        // Material price inputs
        if (el.classList.contains('aufmass-mat-price-input')) {
            const price = parseFloat(el.value) || 0;
            const qty = parseFloat(el.dataset.quantity) || 0;
            const matType = el.dataset.materialType;
            const totalEl = document.getElementById(`aufmass-mat-total-${matType}`);
            if (totalEl) {
                totalEl.textContent = `= ${(price * qty).toFixed(2)} \u20AC`;
            }
        }

        // Quote transfer position prices
        if (el.classList.contains('aufmass-pos-price')) {
            this._updateTransferTotals();
        }

        // Search
        if (el.id === 'aufmass-search') {
            this._debounce('search', () => {
                this._filterProjectList(el.value);
            }, 300);
        }
    }

    handleChange(e) {
        const el = e.target;

        // Room type change
        if (el.dataset.field === 'type' && el.dataset.roomId) {
            window.aufmassService?.updateRoom(el.dataset.projectId, el.dataset.roomId, { type: el.value });
            // Re-render entire room editor for new fields
            this.render();
        }

        // Quote transfer checkboxes
        if (el.dataset.action === 'refresh-positions') {
            this._refreshQuotePositions();
        }

        // Quote transfer target radio
        if (el.name === 'aufmass-target') {
            const select = document.getElementById('aufmass-target-angebot');
            if (select) {
                select.style.display = el.value === 'existing' ? 'block' : 'none';
            }
        }
    }

    // ============================================
    // Actions
    // ============================================

    showNewProjectModal() {
        const html = `
            <div class="aufmass-modal-overlay" id="aufmass-modal-overlay">
                <div class="aufmass-modal">
                    <div class="aufmass-modal-header">
                        <h3>Neues Aufma\u00DF-Projekt</h3>
                        <button class="aufmass-modal-close" id="aufmass-modal-close">&times;</button>
                    </div>
                    <div class="aufmass-modal-body">
                        <div class="aufmass-form-group">
                            <label>Projektname *</label>
                            <input type="text" id="aufmass-new-name" class="aufmass-input" placeholder="z.B. Wohnung M\u00FCller, Badezimmer-Sanierung" autofocus />
                        </div>
                        <div class="aufmass-form-group">
                            <label>Kundenname</label>
                            <input type="text" id="aufmass-new-customer" class="aufmass-input" placeholder="Name des Kunden" />
                        </div>
                        <div class="aufmass-form-group">
                            <label>E-Mail</label>
                            <input type="email" id="aufmass-new-email" class="aufmass-input" placeholder="kunde@example.de" />
                        </div>
                        <div class="aufmass-form-group">
                            <label>Adresse</label>
                            <input type="text" id="aufmass-new-address" class="aufmass-input" placeholder="Stra\u00DFe, PLZ Ort" />
                        </div>
                        <div class="aufmass-form-group">
                            <label>Notizen</label>
                            <textarea id="aufmass-new-notes" class="aufmass-input aufmass-textarea" placeholder="Zus\u00E4tzliche Informationen..."></textarea>
                        </div>
                    </div>
                    <div class="aufmass-modal-footer">
                        <button class="btn btn-secondary" id="aufmass-modal-cancel">Abbrechen</button>
                        <button class="btn btn-primary" id="aufmass-modal-confirm">Projekt erstellen</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);

        const overlay = document.getElementById('aufmass-modal-overlay');
        const closeModal = () => overlay?.remove();

        document.getElementById('aufmass-modal-close').addEventListener('click', closeModal);
        document.getElementById('aufmass-modal-cancel').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        document.getElementById('aufmass-modal-confirm').addEventListener('click', () => {
            const name = document.getElementById('aufmass-new-name').value.trim();
            if (!name) {
                document.getElementById('aufmass-new-name').style.borderColor = 'var(--accent-danger)';
                return;
            }

            const project = window.aufmassService.createProject({
                name,
                customerName: document.getElementById('aufmass-new-customer').value.trim(),
                customerEmail: document.getElementById('aufmass-new-email').value.trim(),
                address: document.getElementById('aufmass-new-address').value.trim(),
                notes: document.getElementById('aufmass-new-notes').value.trim()
            });

            closeModal();
            this.currentProjectId = project.id;
            this.currentScreen = 'detail';
            this.render();
            this._showToast('Aufma\u00DF-Projekt erstellt');
        });
    }

    showEditProjectModal(projectId) {
        const project = window.aufmassService.getProject(projectId);
        if (!project) return;

        const html = `
            <div class="aufmass-modal-overlay" id="aufmass-modal-overlay">
                <div class="aufmass-modal">
                    <div class="aufmass-modal-header">
                        <h3>Projekt bearbeiten</h3>
                        <button class="aufmass-modal-close" id="aufmass-modal-close">&times;</button>
                    </div>
                    <div class="aufmass-modal-body">
                        <div class="aufmass-form-group">
                            <label>Projektname *</label>
                            <input type="text" id="aufmass-edit-name" class="aufmass-input" value="${this._esc(project.name)}" />
                        </div>
                        <div class="aufmass-form-group">
                            <label>Kundenname</label>
                            <input type="text" id="aufmass-edit-customer" class="aufmass-input" value="${this._esc(project.customerName)}" />
                        </div>
                        <div class="aufmass-form-group">
                            <label>E-Mail</label>
                            <input type="email" id="aufmass-edit-email" class="aufmass-input" value="${this._esc(project.customerEmail)}" />
                        </div>
                        <div class="aufmass-form-group">
                            <label>Adresse</label>
                            <input type="text" id="aufmass-edit-address" class="aufmass-input" value="${this._esc(project.address)}" />
                        </div>
                        <div class="aufmass-form-group">
                            <label>Notizen</label>
                            <textarea id="aufmass-edit-notes" class="aufmass-input aufmass-textarea">${this._esc(project.notes)}</textarea>
                        </div>
                    </div>
                    <div class="aufmass-modal-footer">
                        <button class="btn btn-secondary" id="aufmass-modal-cancel">Abbrechen</button>
                        <button class="btn btn-primary" id="aufmass-modal-confirm">Speichern</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);

        const overlay = document.getElementById('aufmass-modal-overlay');
        const closeModal = () => overlay?.remove();

        document.getElementById('aufmass-modal-close').addEventListener('click', closeModal);
        document.getElementById('aufmass-modal-cancel').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        document.getElementById('aufmass-modal-confirm').addEventListener('click', () => {
            const name = document.getElementById('aufmass-edit-name').value.trim();
            if (!name) {
                document.getElementById('aufmass-edit-name').style.borderColor = 'var(--accent-danger)';
                return;
            }

            window.aufmassService.updateProject(projectId, {
                name,
                customerName: document.getElementById('aufmass-edit-customer').value.trim(),
                customerEmail: document.getElementById('aufmass-edit-email').value.trim(),
                address: document.getElementById('aufmass-edit-address').value.trim(),
                notes: document.getElementById('aufmass-edit-notes').value.trim()
            });

            closeModal();
            this.render();
            this._showToast('Projekt aktualisiert');
        });
    }

    showAddDeductionModal(projectId, roomId) {
        const service = window.aufmassService;

        const html = `
            <div class="aufmass-modal-overlay" id="aufmass-modal-overlay">
                <div class="aufmass-modal aufmass-modal--compact">
                    <div class="aufmass-modal-header">
                        <h3>Abzug hinzuf\u00FCgen</h3>
                        <button class="aufmass-modal-close" id="aufmass-modal-close">&times;</button>
                    </div>
                    <div class="aufmass-modal-body">
                        <div class="aufmass-form-group">
                            <label>Typ</label>
                            <select id="aufmass-ded-type" class="aufmass-input">
                                ${Object.entries(service.DEDUCTION_TYPES).map(([key, val]) =>
                                    `<option value="${key}">${val.icon} ${val.label}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="aufmass-form-group">
                            <label>Bezeichnung</label>
                            <input type="text" id="aufmass-ded-name" class="aufmass-input" placeholder="z.B. Fenster links" />
                        </div>
                        <div class="aufmass-form-grid aufmass-form-grid--3col">
                            <div class="aufmass-form-group">
                                <label>Breite (m)</label>
                                <input type="number" id="aufmass-ded-width" class="aufmass-input" step="0.01" min="0" value="1.20" />
                            </div>
                            <div class="aufmass-form-group">
                                <label>H\u00F6he (m)</label>
                                <input type="number" id="aufmass-ded-height" class="aufmass-input" step="0.01" min="0" value="1.40" />
                            </div>
                            <div class="aufmass-form-group">
                                <label>Anzahl</label>
                                <input type="number" id="aufmass-ded-count" class="aufmass-input" step="1" min="1" value="1" />
                            </div>
                        </div>
                        <div class="aufmass-deduction-preview-area" id="aufmass-ded-preview">
                            Fl\u00E4che: 1,68 m\u00B2
                        </div>
                    </div>
                    <div class="aufmass-modal-footer">
                        <button class="btn btn-secondary" id="aufmass-modal-cancel">Abbrechen</button>
                        <button class="btn btn-primary" id="aufmass-modal-confirm">Hinzuf\u00FCgen</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);

        const overlay = document.getElementById('aufmass-modal-overlay');
        const closeModal = () => overlay?.remove();

        document.getElementById('aufmass-modal-close').addEventListener('click', closeModal);
        document.getElementById('aufmass-modal-cancel').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        // Update defaults when type changes
        const typeSelect = document.getElementById('aufmass-ded-type');
        const widthInput = document.getElementById('aufmass-ded-width');
        const heightInput = document.getElementById('aufmass-ded-height');
        const nameInput = document.getElementById('aufmass-ded-name');
        const countInput = document.getElementById('aufmass-ded-count');
        const previewEl = document.getElementById('aufmass-ded-preview');

        const updatePreview = () => {
            const w = parseFloat(widthInput.value) || 0;
            const h = parseFloat(heightInput.value) || 0;
            const c = parseInt(countInput.value) || 1;
            previewEl.textContent = `Fl\u00E4che: ${(w * h * c).toFixed(2)} m\u00B2`;
        };

        typeSelect.addEventListener('change', () => {
            const typeDef = service.DEDUCTION_TYPES[typeSelect.value];
            if (typeDef) {
                widthInput.value = typeDef.defaultWidth;
                heightInput.value = typeDef.defaultHeight;
                if (!nameInput.value) nameInput.placeholder = typeDef.label;
                updatePreview();
            }
        });

        [widthInput, heightInput, countInput].forEach(el => el.addEventListener('input', updatePreview));

        document.getElementById('aufmass-modal-confirm').addEventListener('click', () => {
            const ded = service.addDeduction(projectId, roomId, {
                type: typeSelect.value,
                name: nameInput.value.trim(),
                width: parseFloat(widthInput.value),
                height: parseFloat(heightInput.value),
                count: parseInt(countInput.value) || 1
            });

            closeModal();
            if (ded) {
                this.render();
                this._showToast('Abzug hinzugef\u00FCgt');
            }
        });
    }

    addNewRoom(projectId) {
        const service = window.aufmassService;
        const project = service.getProject(projectId);
        if (!project) return;

        const room = service.addRoom(projectId, {
            name: `Raum ${project.rooms.length + 1}`,
            type: 'rechteck',
            length: 0,
            width: 0,
            height: 2.5
        });

        if (room) {
            this.currentProjectId = projectId;
            this.currentRoomId = room.id;
            this.currentScreen = 'room-editor';
            this.render();
            this._showToast('Neuer Raum hinzugef\u00FCgt');
        }
    }

    confirmDeleteProject(projectId) {
        if (!confirm('Aufma\u00DF-Projekt wirklich l\u00F6schen? Dies kann nicht r\u00FCckg\u00E4ngig gemacht werden.')) return;

        window.aufmassService.deleteProject(projectId);
        if (this.currentProjectId === projectId) {
            this.currentProjectId = null;
            this.currentScreen = 'list';
        }
        this.render();
        this._showToast('Projekt gel\u00F6scht');
    }

    confirmDeleteRoom(projectId, roomId) {
        if (!confirm('Raum wirklich l\u00F6schen?')) return;

        window.aufmassService.deleteRoom(projectId, roomId);
        this.render();
        this._showToast('Raum gel\u00F6scht');
    }

    removeDeduction(projectId, roomId, deductionId) {
        window.aufmassService.removeDeduction(projectId, roomId, deductionId);
        this.render();
    }

    exportProject(projectId) {
        const json = window.aufmassService.exportProject(projectId);
        if (!json) return;

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aufmass-export-${projectId}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this._showToast('Projekt exportiert');
    }

    executeQuoteTransfer(projectId) {
        const service = window.aufmassService;

        // Get options from checkboxes
        const includeFloor = document.getElementById('aufmass-incl-floor')?.checked ?? true;
        const includeWalls = document.getElementById('aufmass-incl-walls')?.checked ?? true;
        const includeCeiling = document.getElementById('aufmass-incl-ceiling')?.checked ?? false;

        // Get prices from the position table
        const priceInputs = document.querySelectorAll('.aufmass-pos-price');
        const positions = service.generateQuotePositions(projectId, { includeFloor, includeWalls, includeCeiling });

        priceInputs.forEach((input, i) => {
            if (positions[i]) {
                positions[i].preis = parseFloat(input.value) || 0;
            }
        });

        // Determine target
        const targetRadio = document.querySelector('input[name="aufmass-target"]:checked');
        const isNewAngebot = !targetRadio || targetRadio.value === 'new';

        if (isNewAngebot) {
            // Create new Angebot
            const project = service.getProject(projectId);
            const netto = positions.reduce((s, p) => s + p.menge * p.preis, 0);

            const angebot = {
                id: window.storeService.generateId('ANG'),
                anfrageId: null,
                aufmassProjectId: projectId,
                kunde: {
                    name: project?.customerName || 'Unbekannt',
                    email: project?.customerEmail || ''
                },
                leistungsart: 'aufmass',
                positionen: positions,
                netto: Math.round(netto * 100) / 100,
                mwst: Math.round(netto * 0.19 * 100) / 100,
                brutto: Math.round(netto * 1.19 * 100) / 100,
                status: 'entwurf',
                angebotText: `Aufma\u00DF-basiertes Angebot - ${project?.name || 'Projekt'}`,
                createdAt: new Date().toISOString()
            };

            window.storeService.state.angebote.push(angebot);
            window.storeService.save();

            this._showToast(`Neues Angebot ${angebot.id} erstellt`);
        } else {
            // Append to existing Angebot
            const angebotId = document.getElementById('aufmass-target-angebot')?.value;
            if (!angebotId) {
                this._showToast('Bitte Angebot ausw\u00E4hlen', 'warning');
                return;
            }

            const angebot = window.storeService.state.angebote.find(a => a.id === angebotId);
            if (!angebot) {
                this._showToast('Angebot nicht gefunden', 'error');
                return;
            }

            if (!angebot.positionen) angebot.positionen = [];
            angebot.positionen.push(...positions);

            const netto = angebot.positionen.reduce((s, p) => s + (p.menge || 0) * (p.preis || 0), 0);
            angebot.netto = Math.round(netto * 100) / 100;
            angebot.mwst = Math.round(netto * 0.19 * 100) / 100;
            angebot.brutto = Math.round(netto * 1.19 * 100) / 100;

            window.storeService.save();
            this._showToast(`Positionen zu Angebot ${angebotId} hinzugef\u00FCgt`);
        }

        // Navigate back to project detail
        this.currentScreen = 'detail';
        this.render();
    }

    // ============================================
    // Real-time Update Helpers
    // ============================================

    _refreshCalcAndPreview(projectId, roomId) {
        const service = window.aufmassService;
        const project = service.getProject(projectId);
        if (!project) return;

        const room = project.rooms.find(r => r.id === roomId);
        if (!room) return;

        const calc = service.calculateRoom(room);

        // Update preview SVG
        const previewContainer = document.getElementById('aufmass-room-preview');
        if (previewContainer) {
            previewContainer.innerHTML = this._renderRoomPreview(room, calc);
        }

        // Update calculations display
        const calcDisplay = document.getElementById('aufmass-calc-display');
        if (calcDisplay) {
            calcDisplay.innerHTML = this._renderCalcResults(calc);
        }
    }

    _refreshQuotePositions() {
        const includeFloor = document.getElementById('aufmass-incl-floor')?.checked ?? true;
        const includeWalls = document.getElementById('aufmass-incl-walls')?.checked ?? true;
        const includeCeiling = document.getElementById('aufmass-incl-ceiling')?.checked ?? false;

        const positions = window.aufmassService.generateQuotePositions(this.currentProjectId, {
            includeFloor, includeWalls, includeCeiling
        });

        const tbody = document.querySelector('#aufmass-positions-table tbody');
        if (tbody) {
            tbody.innerHTML = positions.map((pos, i) => `
                <tr>
                    <td>${this._esc(pos.beschreibung)}</td>
                    <td>${pos.menge.toFixed(2)}</td>
                    <td>${this._esc(pos.einheit)}</td>
                    <td>
                        <input type="number" class="aufmass-input aufmass-input--small aufmass-pos-price"
                            value="${pos.preis}" step="0.01" min="0" data-pos-index="${i}" placeholder="0.00" />
                    </td>
                    <td class="aufmass-pos-total" data-pos-index="${i}">${(pos.menge * pos.preis).toFixed(2)} \u20AC</td>
                </tr>
            `).join('');
        }

        this._updateTransferTotals();
    }

    _updateTransferTotals() {
        const priceInputs = document.querySelectorAll('.aufmass-pos-price');
        let total = 0;

        priceInputs.forEach(input => {
            const index = input.dataset.posIndex;
            const price = parseFloat(input.value) || 0;
            const row = input.closest('tr');
            const mengeCell = row?.children[1];
            const menge = parseFloat(mengeCell?.textContent) || 0;
            const totalCell = document.querySelector(`.aufmass-pos-total[data-pos-index="${index}"]`);

            if (totalCell) {
                totalCell.textContent = `${(menge * price).toFixed(2)} \u20AC`;
            }
            total += menge * price;
        });

        const totalEl = document.getElementById('aufmass-transfer-total');
        if (totalEl) {
            totalEl.textContent = `${total.toFixed(2)} \u20AC`;
        }
    }

    _filterProjectList(term) {
        const cards = document.querySelectorAll('.aufmass-project-card');
        const lower = (term || '').toLowerCase();

        cards.forEach(card => {
            const name = card.querySelector('.aufmass-project-name')?.textContent?.toLowerCase() || '';
            const customer = card.querySelector('.aufmass-project-customer')?.textContent?.toLowerCase() || '';
            const address = card.querySelector('.aufmass-project-address')?.textContent?.toLowerCase() || '';

            const match = !lower || name.includes(lower) || customer.includes(lower) || address.includes(lower);
            card.style.display = match ? '' : 'none';
        });
    }

    // ============================================
    // Utility Methods
    // ============================================

    _debounce(key, fn, delay) {
        clearTimeout(this.debounceTimers[key]);
        this.debounceTimers[key] = setTimeout(fn, delay);
    }

    _esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    _formatDate(isoStr) {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return '';
        }
    }

    _showToast(message, type = 'success') {
        // Use existing toast system if available
        if (window.showToast) {
            window.showToast(message, type);
            return;
        }
        if (window.AppUtils?.showToast) {
            window.AppUtils.showToast(message, type);
            return;
        }

        // Fallback toast
        const toast = document.createElement('div');
        toast.className = `aufmass-toast aufmass-toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('aufmass-toast--visible'));

        setTimeout(() => {
            toast.classList.remove('aufmass-toast--visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Attach to window
window.aufmassUI = new AufmassUI();
