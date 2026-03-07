/* ============================================
   Dashboard Widget UI
   Renders the customizable widget dashboard:
   - Widget grid with responsive layout
   - Edit mode (drag-and-drop, remove, add)
   - Add-widget dialog (modal)
   - Individual widget rendering by type
   ============================================ */

class DashboardWidgetUI {
    constructor() {
        this.editMode = false;
        this.dragState = {
            dragging: null,
            dragOverIndex: null
        };
        this._boundHandlers = {};
    }

    // ============================================
    // Main Render
    // ============================================

    /**
     * Render the full widget dashboard into a container element.
     * @param {string} containerId - DOM id of the container to render into
     */
    renderWidgetDashboard(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn('DashboardWidgetUI: Container nicht gefunden:', containerId);
            return;
        }

        const service = window.dashboardWidgetService;
        if (!service) {
            console.warn('DashboardWidgetUI: DashboardWidgetService nicht verf\u00FCgbar');
            return;
        }

        const layout = service.getLayout();

        let html = '';

        // Toolbar
        html += this._renderToolbar();

        // KPI Alerts (oben, vor den Widgets)
        html += '<div class="kpi-alerts-container" id="kpi-alerts-container"></div>';

        // Alerts async laden und einfuegen
        this._loadKpiAlerts();

        // Widget grid
        html += '<div class="widget-grid' + (this.editMode ? ' widget-edit-mode' : '') + '" id="widget-grid">';

        if (layout.length === 0) {
            html += this._renderEmptyState();
        } else {
            layout.forEach((widget, index) => {
                html += this.renderWidget(widget, index);
            });
        }

        // "Add widget" placeholder in edit mode
        if (this.editMode) {
            html += `
                <div class="widget-card widget-card-add" role="button" tabindex="0"
                     onclick="window.dashboardWidgetUI.renderAddWidgetDialog()"
                     onkeydown="if(event.key==='Enter')window.dashboardWidgetUI.renderAddWidgetDialog()">
                    <div class="widget-add-placeholder">
                        <span class="widget-add-icon">+</span>
                        <span class="widget-add-label">Widget hinzuf\u00FCgen</span>
                    </div>
                </div>
            `;
        }

        html += '</div>'; // close .widget-grid

        container.innerHTML = html;

        // Attach drag-and-drop handlers if in edit mode
        if (this.editMode) {
            this._attachDragHandlers();
        }
    }

    /**
     * Render toolbar with edit toggle and reset button.
     * @returns {string} HTML
     * @private
     */
    _renderToolbar() {
        const editLabel = this.editMode ? 'Fertig' : 'Dashboard anpassen';
        const editIcon = this.editMode ? '\u2713' : '\u270F\uFE0F';

        let html = '<div class="widget-toolbar">';
        html += `<button class="widget-toolbar-btn widget-edit-toggle${this.editMode ? ' active' : ''}"
                    onclick="window.dashboardWidgetUI.toggleEditMode()"
                    title="${editLabel}">
                    <span class="widget-toolbar-icon">${editIcon}</span>
                    <span class="widget-toolbar-label">${editLabel}</span>
                 </button>`;

        if (this.editMode) {
            html += `<button class="widget-toolbar-btn widget-reset-btn"
                        onclick="window.dashboardWidgetUI.handleReset()"
                        title="Zur\u00FCcksetzen auf Standard">
                        <span class="widget-toolbar-icon">\u21BA</span>
                        <span class="widget-toolbar-label">Zur\u00FCcksetzen</span>
                     </button>`;
        }

        html += '</div>';
        return html;
    }

    /**
     * Render empty state when no widgets are configured.
     * @returns {string} HTML
     * @private
     */
    _renderEmptyState() {
        return `
            <div class="widget-empty-state">
                <div class="widget-empty-icon">\u{1F4CA}</div>
                <p class="widget-empty-text">Keine Widgets konfiguriert.</p>
                <button class="widget-empty-btn"
                    onclick="window.dashboardWidgetUI.renderAddWidgetDialog()">
                    Widget hinzuf\u00FCgen
                </button>
            </div>
        `;
    }

    // ============================================
    // Individual Widget Rendering
    // ============================================

    /**
     * Render a single widget card.
     * @param {Object} widget - Widget config with id, name, icon, size, category
     * @param {number} index - Position index in layout
     * @returns {string} HTML
     */
    renderWidget(widget, index) {
        const service = window.dashboardWidgetService;
        const dataOrPromise = service.getWidgetData(widget.id);
        const sizeClass = `widget-card-${widget.size || 'small'}`;
        const asyncWidgets = ['cashflow-forecast', 'social-media'];

        // Async Widget: Placeholder rendern, dann nachladen
        if (asyncWidgets.includes(widget.id) && dataOrPromise && typeof dataOrPromise.then === 'function') {
            const placeholderId = `widget-async-${widget.id}-${index}`;
            // Sofort Placeholder-HTML zurueckgeben
            const placeholderHtml = `<div class="widget-card ${sizeClass}"
                     data-widget-id="${widget.id}"
                     data-widget-index="${index}"
                     ${this.editMode ? 'draggable="true"' : ''}>
                <div class="widget-header">
                    ${this.editMode ? '<span class="widget-drag-handle" title="Ziehen zum Verschieben">\u2261</span>' : ''}
                    <span class="widget-header-icon">${this._escapeHtml(widget.icon)}</span>
                    <span class="widget-header-title">${this._escapeHtml(widget.name)}</span>
                    ${this.editMode ? `<button class="widget-remove-btn" title="Widget entfernen" onclick="event.stopPropagation(); window.dashboardWidgetUI.handleRemoveWidget('${widget.id}')">\u00D7</button>` : ''}
                </div>
                <div class="widget-body" id="${placeholderId}">
                    <div class="widget-loading" style="display:flex;align-items:center;justify-content:center;padding:1.5rem;color:var(--text-muted);font-size:0.85rem">
                        Lade KI-Prognose...
                    </div>
                </div>
            </div>`;

            // Daten nachladen und DOM aktualisieren
            dataOrPromise.then((data) => {
                const el = document.getElementById(placeholderId);
                if (!el) return;
                if (data && data.error) {
                    el.innerHTML = `<div class="widget-error">${this._escapeHtml(data.message)}</div>`;
                } else {
                    el.innerHTML = this._renderWidgetContent(widget, data);
                }
            }).catch((err) => {
                const el = document.getElementById(placeholderId);
                if (el) el.innerHTML = '<div class="widget-error">Fehler beim Laden der Prognose.</div>';
                console.error('DashboardWidgetUI: Async Widget Fehler:', err);
            });

            return placeholderHtml;
        }

        // Synchrones Widget (Standard-Pfad)
        const data = dataOrPromise;
        const sizeClass2 = sizeClass; // alias fuer Klarheit

        let html = `<div class="widget-card ${sizeClass2}"
                         data-widget-id="${widget.id}"
                         data-widget-index="${index}"
                         ${this.editMode ? 'draggable="true"' : ''}>`;

        // Header
        html += `<div class="widget-header">`;

        if (this.editMode) {
            html += `<span class="widget-drag-handle" title="Ziehen zum Verschieben">\u2261</span>`;
        }

        html += `<span class="widget-header-icon">${this._escapeHtml(widget.icon)}</span>`;
        html += `<span class="widget-header-title">${this._escapeHtml(widget.name)}</span>`;

        if (this.editMode) {
            html += `<button class="widget-remove-btn" title="Widget entfernen"
                        onclick="event.stopPropagation(); window.dashboardWidgetUI.handleRemoveWidget('${widget.id}')">
                        \u00D7
                     </button>`;
        }

        html += '</div>'; // close .widget-header

        // Body
        html += '<div class="widget-body">';

        if (data && data.error) {
            html += `<div class="widget-error">${this._escapeHtml(data.message)}</div>`;
        } else {
            html += this._renderWidgetContent(widget, data);
        }

        html += '</div>'; // close .widget-body

        // Optional navigation link
        if (!this.editMode && data && data.navigateTo) {
            html += `<div class="widget-footer">
                        <button class="widget-details-link"
                            onclick="window.dashboardWidgetUI._navigateTo('${data.navigateTo}')">
                            Details anzeigen \u2192
                        </button>
                     </div>`;
        }

        html += '</div>'; // close .widget-card

        return html;
    }

    /**
     * Render the content area of a widget based on its data type.
     * @param {Object} widget - Widget definition
     * @param {Object} data - Computed widget data
     * @returns {string} HTML
     * @private
     */
    _renderWidgetContent(widget, data) {
        switch (data.type) {
            case 'kpi':
                return this._renderKpiContent(data);
            case 'list':
                return this._renderListContent(data);
            case 'chart':
                return this._renderChartContent(data);
            case 'cashflow-ai':
                return this._renderCashflowAiContent(data);
            case 'euer-live':
                return this._renderEuerLiveContent(data);
            default:
                return '<div class="widget-no-data">Keine Daten</div>';
        }
    }

    /**
     * Render KI-Cashflow-Prognose Widget (30/60/90 Tage Ampel-Ansicht).
     * @param {Object} data
     * @returns {string} HTML
     * @private
     */
    _renderCashflowAiContent(data) {
        if (!data.hasData) {
            return `<div class="cashflow-ai-empty">
                <div class="cashflow-ai-empty-icon">KI</div>
                <p>${data.message || 'Keine Prognose verfuegbar.'}</p>
            </div>`;
        }

        const fmt = (v) => {
            if (v === null || v === undefined) return '—';
            const abs = Math.abs(v);
            const f = abs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return v < 0 ? `-${f} EUR` : `+${f} EUR`;
        };

        const ampelColors = { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' };
        const ampelLabels = { gruen: 'Gut', gelb: 'Achtung', rot: 'Kritisch' };

        const badge = (ampel) => {
            const color = ampelColors[ampel] || '#eab308';
            const label = ampelLabels[ampel] || ampel;
            return `<span class="cashflow-badge" style="background:${color}20;color:${color};border:1px solid ${color}40;padding:1px 6px;border-radius:4px;font-size:0.7rem;font-weight:600">${label}</span>`;
        };

        const currentColor = ampelColors[data.ampel?.current] || '#eab308';
        const ageHint = data.ageTage > 7
            ? `<span style="color:#ef4444;font-size:0.7rem">${data.ageTage} Tage alt</span>`
            : `<span style="color:var(--text-muted);font-size:0.7rem">${new Date(data.forecastDate).toLocaleDateString('de-DE')}</span>`;

        let html = `<div class="cashflow-ai-widget" style="padding:0.5rem 0">`;

        // Aktueller Stand
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
            <div>
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Aktueller Stand</div>
                <div style="font-size:1.4rem;font-weight:700;color:${currentColor}">${fmt(data.currentBalance)}</div>
            </div>
            <div style="text-align:right">${badge(data.ampel?.current)}${ageHint ? '<br>' + ageHint : ''}</div>
        </div>`;

        // 30/60/90 Tage Grid
        html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.75rem">`;
        for (const [label, value, ampelKey] of [
            ['30 Tage', data.forecast30d, data.ampel?.d30],
            ['60 Tage', data.forecast60d, data.ampel?.d60],
            ['90 Tage', data.forecast90d, data.ampel?.d90],
        ]) {
            const color = ampelColors[ampelKey] || '#eab308';
            html += `<div style="background:var(--bg-secondary,#f9fafb);border-radius:6px;padding:0.5rem;text-align:center;border:1px solid var(--border-color,#e5e7eb)">
                <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px">${label}</div>
                <div style="font-size:0.85rem;font-weight:600;color:${color}">${fmt(value)}</div>
            </div>`;
        }
        html += `</div>`;

        // Offene Posten
        html += `<div style="display:flex;gap:1rem;font-size:0.72rem;color:var(--text-muted);margin-bottom:0.5rem">
            <span>Forderungen: <strong style="color:#22c55e">${fmt(data.offeneForderungen)}</strong></span>
            <span>Verbindlichk.: <strong style="color:#ef4444">${fmt(data.offeneVerbindlichkeiten)}</strong></span>
        </div>`;

        // Analyse (gekuerzt)
        if (data.analyse) {
            const kurzAnalyse = data.analyse.length > 160 ? data.analyse.substring(0, 157) + '...' : data.analyse;
            html += `<div style="font-size:0.72rem;color:var(--text-secondary,#6b7280);border-top:1px solid var(--border-color,#e5e7eb);padding-top:0.5rem;line-height:1.5">${this._escapeHtml(kurzAnalyse)}</div>`;
        }

        html += `</div>`;
        return html;
    }

    /**
     * Render E\u00DCR Live widget content (finance overview grid).
     * @param {Object} data
     * @returns {string} HTML
     * @private
     */
    _renderEuerLiveContent(data) {
        const fmt = (v) => {
            if (typeof v !== 'number' || isNaN(v)) return '0,00 \u20AC';
            return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
        };

        const gewinnColor = data.gewinn >= 0 ? '#22c55e' : '#ef4444';
        const gewinnLabel = data.gewinn >= 0 ? 'Gewinn' : 'Verlust';

        let html = `<div class="euer-live-widget" style="padding:0.25rem 0">`;

        // --- Hauptzeile: Gewinn/Verlust ---
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border-color,#e5e7eb)">
            <div>
                <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">${this._escapeHtml(gewinnLabel)} ${this._escapeHtml(String(data.jahr))}</div>
                <div style="font-size:1.5rem;font-weight:700;color:${gewinnColor}">${this._escapeHtml(fmt(data.gewinn))}</div>
            </div>
            <div style="text-align:right">
                <span style="background:${gewinnColor}20;color:${gewinnColor};border:1px solid ${gewinnColor}40;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:600">${this._escapeHtml(gewinnLabel)}</span>
            </div>
        </div>`;

        // --- Grid: Einnahmen / Ausgaben YTD ---
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.75rem">`;

        html += `<div style="background:var(--bg-secondary,#f9fafb);border-radius:6px;padding:0.5rem;border:1px solid var(--border-color,#e5e7eb)">
            <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px">Einnahmen YTD</div>
            <div style="font-size:1rem;font-weight:600;color:#22c55e">${this._escapeHtml(fmt(data.einnahmenYTD))}</div>
        </div>`;

        html += `<div style="background:var(--bg-secondary,#f9fafb);border-radius:6px;padding:0.5rem;border:1px solid var(--border-color,#e5e7eb)">
            <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px">Ausgaben YTD</div>
            <div style="font-size:1rem;font-weight:600;color:#ef4444">${this._escapeHtml(fmt(data.ausgabenYTD))}</div>
        </div>`;

        html += `</div>`;

        // --- Aktuelles Quartal ---
        html += `<div style="background:var(--bg-secondary,#f9fafb);border-radius:6px;padding:0.5rem;margin-bottom:0.75rem;border:1px solid var(--border-color,#e5e7eb)">
            <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px">Aktuelles Quartal (${this._escapeHtml(data.quartal.label)})</div>
            <div style="display:flex;justify-content:space-between">
                <span style="font-size:0.85rem;color:#22c55e;font-weight:600">+ ${this._escapeHtml(fmt(data.quartal.einnahmen))}</span>
                <span style="font-size:0.85rem;color:#ef4444;font-weight:600">- ${this._escapeHtml(fmt(data.quartal.ausgaben))}</span>
            </div>
        </div>`;

        // --- Untere Dreier-Grid: Steuer / Forderungen / Verbindlichkeiten ---
        html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem">`;

        // Steuer-Ruecklage
        const steuerColor = data.steuerRuecklage > 0 ? '#eab308' : 'var(--text-muted)';
        html += `<div style="background:var(--bg-secondary,#f9fafb);border-radius:6px;padding:0.5rem;text-align:center;border:1px solid var(--border-color,#e5e7eb)">
            <div style="font-size:0.6rem;color:var(--text-muted);margin-bottom:2px">Steuer-R\u00FCcklage</div>
            <div style="font-size:0.8rem;font-weight:600;color:${steuerColor}">${this._escapeHtml(fmt(data.steuerRuecklage))}</div>
            <div style="font-size:0.55rem;color:var(--text-muted)">${data.kleinunternehmer ? 'ESt (~25%)' : 'ESt+USt'}</div>
        </div>`;

        // Offene Forderungen
        const fordColor = data.offeneForderungen > 0 ? '#22c55e' : 'var(--text-muted)';
        html += `<div style="background:var(--bg-secondary,#f9fafb);border-radius:6px;padding:0.5rem;text-align:center;border:1px solid var(--border-color,#e5e7eb)">
            <div style="font-size:0.6rem;color:var(--text-muted);margin-bottom:2px">Forderungen</div>
            <div style="font-size:0.8rem;font-weight:600;color:${fordColor}">${this._escapeHtml(fmt(data.offeneForderungen))}</div>
            <div style="font-size:0.55rem;color:var(--text-muted)">offen</div>
        </div>`;

        // Offene Verbindlichkeiten
        const verbColor = data.offeneVerbindlichkeiten > 0 ? '#ef4444' : 'var(--text-muted)';
        html += `<div style="background:var(--bg-secondary,#f9fafb);border-radius:6px;padding:0.5rem;text-align:center;border:1px solid var(--border-color,#e5e7eb)">
            <div style="font-size:0.6rem;color:var(--text-muted);margin-bottom:2px">Verbindlichk.</div>
            <div style="font-size:0.8rem;font-weight:600;color:${verbColor}">${this._escapeHtml(fmt(data.offeneVerbindlichkeiten))}</div>
            <div style="font-size:0.55rem;color:var(--text-muted)">offen</div>
        </div>`;

        html += `</div>`; // close grid

        html += `</div>`; // close .euer-live-widget
        return html;
    }

    /**
     * Render KPI widget content (big number + label).
     * @param {Object} data
     * @returns {string} HTML
     * @private
     */
    _renderKpiContent(data) {
        const valueClass = data.status === 'negative' ? 'widget-kpi-value negative' : 'widget-kpi-value';

        let html = `<div class="widget-kpi">`;
        html += `<span class="${valueClass}">${this._escapeHtml(String(data.value ?? ''))}</span>`;

        if (data.subValue) {
            html += `<span class="widget-kpi-sub">${this._escapeHtml(String(data.subValue))}</span>`;
        }

        if (data.label) {
            html += `<span class="widget-kpi-label">${this._escapeHtml(String(data.label))}</span>`;
        }

        if (data.trend) {
            const trendIcons = { up: '\u2191', down: '\u2193', stable: '\u2194' };
            const trendClasses = { up: 'trend-up', down: 'trend-down', stable: 'trend-stable' };
            html += `<span class="widget-kpi-trend ${trendClasses[data.trend] || ''}">
                        ${trendIcons[data.trend] || ''} ${data.trend === 'up' ? 'Steigend' : data.trend === 'down' ? 'Fallend' : 'Stabil'}
                     </span>`;
        }

        html += '</div>';
        return html;
    }

    /**
     * Render list widget content (activity feed, termine, etc.).
     * @param {Object} data
     * @returns {string} HTML
     * @private
     */
    _renderListContent(data) {
        if (!data.items || data.items.length === 0) {
            return `<div class="widget-list-empty">${data.emptyMessage || 'Keine Eintr\u00E4ge.'}</div>`;
        }

        // Summary line for overdue invoices
        let summaryHtml = '';
        if (data.totalAmount) {
            const service = window.dashboardWidgetService;
            summaryHtml = `<div class="widget-list-summary">
                Gesamt: <strong>${service._formatCurrency(data.totalAmount)}</strong>
            </div>`;
        }

        let html = '<div class="widget-list">';

        data.items.forEach(item => {
            const statusClass = item.status ? `widget-list-item-${item.status}` : '';
            html += `<div class="widget-list-item ${statusClass}">`;
            html += `<span class="widget-list-icon">${item.icon || ''}</span>`;
            html += `<div class="widget-list-content">`;
            html += `<span class="widget-list-title">${this._escapeHtml(item.title)}</span>`;
            if (item.subTitle) {
                html += `<span class="widget-list-subtitle">${this._escapeHtml(item.subTitle)}</span>`;
            }
            if (item.timeFormatted) {
                html += `<span class="widget-list-time">${this._escapeHtml(item.timeFormatted)}</span>`;
            }
            html += '</div>'; // close .widget-list-content
            html += '</div>'; // close .widget-list-item
        });

        html += '</div>'; // close .widget-list
        html += summaryHtml;

        // External link (e.g. Postiz) — only allow http/https
        if (data.externalLink && /^https?:\/\//.test(data.externalLink)) {
            html += `<div class="widget-list-footer" style="text-align:right;padding-top:0.5rem">
                <a href="${this._escapeHtml(data.externalLink)}" target="_blank" rel="noopener noreferrer"
                   style="font-size:0.8rem;color:var(--accent-primary);text-decoration:none">
                    ${this._escapeHtml(data.externalLinkLabel || 'Öffnen')} \u2192
                </a>
            </div>`;
        }

        return html;
    }

    /**
     * Render chart widget content (simple bar chart via SVG).
     * @param {Object} data
     * @returns {string} HTML
     * @private
     */
    _renderChartContent(data) {
        if (!data.data || data.data.length === 0) {
            return '<div class="widget-no-data">Keine Daten f\u00FCr Chart verf\u00FCgbar</div>';
        }

        const width = 460;
        const height = 200;
        const padding = { top: 20, right: 15, bottom: 35, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const maxVal = data.maxValue || 1;
        const barCount = data.data.length;
        const barWidth = (chartWidth / barCount) * 0.6;
        const barSpacing = chartWidth / barCount;

        let svg = `<svg class="widget-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">`;

        // Grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartHeight / 4) * i;
            const val = maxVal - (maxVal / 4) * i;
            svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-color, #1a3535)" stroke-width="1"/>`;
            svg += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted, #8aacac)" font-size="10">${this._formatCurrencyShort(val)}</text>`;
        }

        // Bars
        data.data.forEach((item, i) => {
            const barH = (item.value / maxVal) * chartHeight;
            const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
            const y = height - padding.bottom - barH;

            svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="var(--accent-primary, #2dd4a8)" rx="3" opacity="0.9">
                        <title>${item.label}: ${this._formatCurrencyShort(item.value)}</title>
                    </rect>`;

            // Value on top of bar
            if (item.value > 0) {
                svg += `<text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" fill="var(--text-primary, #fff)" font-size="10" font-weight="600">${this._formatCurrencyShort(item.value)}</text>`;
            }

            // X-axis label
            svg += `<text x="${x + barWidth / 2}" y="${height - padding.bottom + 16}" text-anchor="middle" fill="var(--text-secondary, #a1a1aa)" font-size="11">${item.label}</text>`;
        });

        svg += '</svg>';

        return `<div class="widget-chart">${svg}</div>`;
    }

    // ============================================
    // Edit Mode
    // ============================================

    /**
     * Toggle edit mode on/off and re-render.
     */
    toggleEditMode() {
        this.editMode = !this.editMode;
        this._rerender();
    }

    /**
     * Enter edit mode explicitly.
     */
    renderEditMode() {
        this.editMode = true;
        this._rerender();
    }

    /**
     * Handle resetting to default layout.
     */
    handleReset() {
        const service = window.dashboardWidgetService;
        if (!service) { return; }
        service.resetToDefault();
        this._rerender();
    }

    /**
     * Handle removing a widget from the layout.
     * @param {string} widgetId
     */
    handleRemoveWidget(widgetId) {
        const service = window.dashboardWidgetService;
        if (!service) { return; }

        service.removeWidget(widgetId);
        this._rerender();
    }

    /**
     * Handle adding a widget to the layout.
     * @param {string} widgetId
     */
    handleAddWidget(widgetId) {
        const service = window.dashboardWidgetService;
        if (!service) { return; }

        service.addWidget(widgetId);
        this._closeAddWidgetDialog();
        this._rerender();
    }

    // ============================================
    // Add Widget Dialog
    // ============================================

    /**
     * Open the "add widget" modal dialog.
     */
    renderAddWidgetDialog() {
        // Remove existing dialog if present
        this._closeAddWidgetDialog();

        const service = window.dashboardWidgetService;
        if (!service) { return; }

        const grouped = service.getAvailableGroupedByCategory();
        const categoryKeys = Object.keys(grouped);

        let html = `
            <div class="widget-add-dialog-overlay" id="widget-add-dialog-overlay"
                 onclick="if(event.target===this) window.dashboardWidgetUI._closeAddWidgetDialog()">
                <div class="widget-add-dialog" role="dialog" aria-label="Widget hinzuf\u00FCgen">
                    <div class="widget-add-dialog-header">
                        <h3>Widget hinzuf\u00FCgen</h3>
                        <button class="widget-add-dialog-close"
                            onclick="window.dashboardWidgetUI._closeAddWidgetDialog()"
                            title="Schlie\u00DFen">
                            \u00D7
                        </button>
                    </div>
                    <div class="widget-add-dialog-body">
        `;

        if (categoryKeys.length === 0) {
            html += '<p class="widget-add-empty">Alle verf\u00FCgbaren Widgets sind bereits im Dashboard.</p>';
        } else {
            categoryKeys.forEach(category => {
                html += `<div class="widget-add-category">`;
                html += `<h4 class="widget-add-category-title">${this._escapeHtml(category)}</h4>`;
                html += `<div class="widget-add-items">`;

                grouped[category].forEach(widget => {
                    html += `
                        <button class="widget-add-item"
                            onclick="window.dashboardWidgetUI.handleAddWidget('${widget.id}')"
                            title="${widget.name} hinzuf\u00FCgen">
                            <span class="widget-add-item-icon">${this._escapeHtml(widget.icon)}</span>
                            <span class="widget-add-item-name">${this._escapeHtml(widget.name)}</span>
                            <span class="widget-add-item-size">${this._getSizeLabel(widget.size)}</span>
                        </button>
                    `;
                });

                html += '</div>'; // close .widget-add-items
                html += '</div>'; // close .widget-add-category
            });
        }

        html += `
                    </div>
                </div>
            </div>
        `;

        // Append dialog to body
        const dialogContainer = document.createElement('div');
        dialogContainer.id = 'widget-add-dialog-container';
        dialogContainer.innerHTML = html;
        document.body.appendChild(dialogContainer);

        // Escape key to close dialog
        const escHandler = (e) => { if (e.key === 'Escape') { this._closeAddWidgetDialog(); document.removeEventListener('keydown', escHandler); } };
        document.addEventListener('keydown', escHandler);

        // Trap focus for accessibility
        requestAnimationFrame(() => {
            const firstButton = dialogContainer.querySelector('.widget-add-item, .widget-add-dialog-close');
            if (firstButton) { firstButton.focus(); }
        });
    }

    /**
     * Close the add widget dialog.
     * @private
     */
    _closeAddWidgetDialog() {
        const existing = document.getElementById('widget-add-dialog-container');
        if (existing) {
            existing.remove();
        }
    }

    // ============================================
    // Drag and Drop
    // ============================================

    /**
     * Attach HTML5 drag-and-drop event handlers to widget cards.
     * @private
     */
    _attachDragHandlers() {
        const grid = document.getElementById('widget-grid');
        if (!grid) { return; }

        const cards = grid.querySelectorAll('.widget-card[draggable="true"]');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => this._onDragStart(e));
            card.addEventListener('dragend', (e) => this._onDragEnd(e));
            card.addEventListener('dragover', (e) => this._onDragOver(e));
            card.addEventListener('dragenter', (e) => this._onDragEnter(e));
            card.addEventListener('dragleave', (e) => this._onDragLeave(e));
            card.addEventListener('drop', (e) => this._onDrop(e));
        });
    }

    /** @private */
    _onDragStart(e) {
        const card = e.target.closest('.widget-card');
        if (!card) { return; }

        this.dragState.dragging = card;
        card.classList.add('widget-dragging');

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.widgetIndex);

        // Slightly delay adding drag visual for smoother UX
        requestAnimationFrame(() => {
            card.style.opacity = '0.5';
        });
    }

    /** @private */
    _onDragEnd(e) {
        const card = e.target.closest('.widget-card');
        if (card) {
            card.classList.remove('widget-dragging');
            card.style.opacity = '';
        }

        // Remove all drag-over highlights
        const grid = document.getElementById('widget-grid');
        if (grid) {
            grid.querySelectorAll('.widget-drag-over').forEach(el => {
                el.classList.remove('widget-drag-over');
            });
        }

        this.dragState.dragging = null;
        this.dragState.dragOverIndex = null;
    }

    /** @private */
    _onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    /** @private */
    _onDragEnter(e) {
        e.preventDefault();
        const card = e.target.closest('.widget-card');
        if (card && card !== this.dragState.dragging) {
            card.classList.add('widget-drag-over');
        }
    }

    /** @private */
    _onDragLeave(e) {
        const card = e.target.closest('.widget-card');
        if (card) {
            card.classList.remove('widget-drag-over');
        }
    }

    /** @private */
    _onDrop(e) {
        e.preventDefault();

        const targetCard = e.target.closest('.widget-card');
        if (!targetCard || !this.dragState.dragging) { return; }

        const fromIndex = parseInt(this.dragState.dragging.dataset.widgetIndex, 10);
        const toIndex = parseInt(targetCard.dataset.widgetIndex, 10);

        if (isNaN(fromIndex) || isNaN(toIndex) || fromIndex === toIndex) { return; }

        const service = window.dashboardWidgetService;
        if (service) {
            service.moveWidget(fromIndex, toIndex);
            this._rerender();
        }
    }

    // ============================================
    // KPI Alerts
    // ============================================

    /**
     * Lade KPI-Alerts asynchron und rendere sie in den Container.
     * @private
     */
    async _loadKpiAlerts() {
        const container = document.getElementById('kpi-alerts-container');
        if (!container) return;

        const service = window.kpiAlertService;
        if (!service) {
            container.innerHTML = '';
            return;
        }

        try {
            const alerts = await service.getAlerts();
            if (!alerts || alerts.length === 0) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = this._renderKpiAlerts(alerts);
        } catch (err) {
            console.warn('DashboardWidgetUI: KPI-Alerts Fehler:', err);
            container.innerHTML = '';
        }
    }

    /**
     * Rendere die Alert-Boxen als HTML.
     * @param {Array} alerts
     * @returns {string} HTML
     * @private
     */
    _renderKpiAlerts(alerts) {
        if (!alerts || alerts.length === 0) return '';

        let html = '<div class="kpi-alerts">';

        alerts.forEach(alert => {
            const typeClass = `kpi-alert-${alert.type || 'info'}`;
            const iconMap = {
                danger: '\u26A0',
                warning: '\u26A0',
                info: '\u2139'
            };
            const icon = iconMap[alert.type] || '\u2139';
            const escapedMessage = this._escapeHtml(alert.message);
            const action = alert.action || '';

            html += `<button class="kpi-alert ${typeClass}"
                        onclick="window.dashboardWidgetUI._handleAlertClick('${this._escapeAttr(action)}')"
                        title="Klicken um Details anzuzeigen">
                        <span class="kpi-alert-icon">${icon}</span>
                        <span class="kpi-alert-message">${escapedMessage}</span>
                        <span class="kpi-alert-arrow">\u2192</span>
                     </button>`;
        });

        html += '</div>';
        return html;
    }

    /**
     * Klick-Handler fuer KPI-Alert: Navigiert zum relevanten Tab.
     * @param {string} viewName
     * @private
     */
    _handleAlertClick(viewName) {
        if (!viewName) return;
        try {
            if (window.navigationController && typeof window.navigationController.navigateTo === 'function') {
                window.navigationController.navigateTo(viewName);
            } else {
                this._navigateTo(viewName);
            }
        } catch (err) {
            console.warn('DashboardWidgetUI: Alert-Navigation fehlgeschlagen:', err);
        }
    }

    // ============================================
    // Helpers
    // ============================================

    /**
     * Re-render the widget dashboard in place.
     * @private
     */
    _rerender() {
        // Find the container - check common container IDs
        const container = document.getElementById('widget-dashboard-container')
            || document.querySelector('.widget-grid')?.parentElement;

        if (container && container.id) {
            this.renderWidgetDashboard(container.id);
        }
    }

    /**
     * Navigate to a view section (e.g., anfragen, angebote).
     * Uses the app's existing navigation if available.
     * @param {string} viewName
     * @private
     */
    _navigateTo(viewName) {
        try {
            if (window.UI?.switchView) {
                window.UI.switchView(viewName);
            } else if (typeof switchView === 'function') {
                switchView(viewName);
            } else {
                // Fallback: click the corresponding nav item
                const navItem = document.querySelector(`[data-view="${viewName}"], [onclick*="'${viewName}'"]`);
                if (navItem) { navItem.click(); }
            }
        } catch (error) {
            console.warn('DashboardWidgetUI: Navigation fehlgeschlagen:', error);
        }
    }

    /**
     * Escape HTML special characters to prevent XSS.
     * @param {string} str
     * @returns {string}
     * @private
     */
    _escapeHtml(str) {
        if (!str) { return ''; }
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Escape a string for safe use inside HTML attribute single-quotes.
     * Covers &, <, >, ", and ' (which _escapeHtml does NOT cover).
     * @param {string} str
     * @returns {string}
     * @private
     */
    _escapeAttr(str) {
        if (!str) { return ''; }
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    /**
     * Get a German display label for widget size.
     * @param {string} size - 'small', 'medium', or 'large'
     * @returns {string}
     * @private
     */
    _getSizeLabel(size) {
        switch (size) {
            case 'small': return 'Klein';
            case 'medium': return 'Mittel';
            case 'large': return 'Gro\u00DF';
            default: return size || '';
        }
    }

    /**
     * Format currency in short form for chart labels.
     * @param {number} value
     * @returns {string}
     * @private
     */
    _formatCurrencyShort(value) {
        if (typeof value !== 'number' || isNaN(value)) { return '0\u20AC'; }
        if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'k\u20AC';
        }
        return Math.round(value) + '\u20AC';
    }

    /**
     * Refresh widget data without full re-render (for live updates).
     */
    refreshData() {
        this._rerender();
    }
}

// Register as global UI service
window.dashboardWidgetUI = new DashboardWidgetUI();
