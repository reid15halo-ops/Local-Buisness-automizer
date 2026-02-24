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
        const data = service.getWidgetData(widget.id);
        const sizeClass = `widget-card-${widget.size || 'small'}`;

        let html = `<div class="widget-card ${sizeClass}"
                         data-widget-id="${widget.id}"
                         data-widget-index="${index}"
                         ${this.editMode ? 'draggable="true"' : ''}>`;

        // Header
        html += `<div class="widget-header">`;

        if (this.editMode) {
            html += `<span class="widget-drag-handle" title="Ziehen zum Verschieben">\u2261</span>`;
        }

        html += `<span class="widget-header-icon">${widget.icon}</span>`;
        html += `<span class="widget-header-title">${widget.name}</span>`;

        if (this.editMode) {
            html += `<button class="widget-remove-btn" title="Widget entfernen"
                        onclick="event.stopPropagation(); window.dashboardWidgetUI.handleRemoveWidget('${widget.id}')">
                        \u00D7
                     </button>`;
        }

        html += '</div>'; // close .widget-header

        // Body
        html += '<div class="widget-body">';

        if (data.error) {
            html += `<div class="widget-error">${data.message}</div>`;
        } else {
            html += this._renderWidgetContent(widget, data);
        }

        html += '</div>'; // close .widget-body

        // Optional navigation link
        if (!this.editMode && data.navigateTo) {
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
            default:
                return '<div class="widget-no-data">Keine Daten</div>';
        }
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
        html += `<span class="${valueClass}">${data.isFormattedValue ? data.value : data.value}</span>`;

        if (data.subValue) {
            html += `<span class="widget-kpi-sub">${data.subValue}</span>`;
        }

        if (data.label) {
            html += `<span class="widget-kpi-label">${data.label}</span>`;
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
                html += `<span class="widget-list-time">${item.timeFormatted}</span>`;
            }
            html += '</div>'; // close .widget-list-content
            html += '</div>'; // close .widget-list-item
        });

        html += '</div>'; // close .widget-list
        html += summaryHtml;

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
            svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-color, #27272a)" stroke-width="1"/>`;
            svg += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted, #8b8b94)" font-size="10">${this._formatCurrencyShort(val)}</text>`;
        }

        // Bars
        data.data.forEach((item, i) => {
            const barH = (item.value / maxVal) * chartHeight;
            const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
            const y = height - padding.bottom - barH;

            svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="var(--accent-primary, #6366f1)" rx="3" opacity="0.9">
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
                html += `<h4 class="widget-add-category-title">${category}</h4>`;
                html += `<div class="widget-add-items">`;

                grouped[category].forEach(widget => {
                    html += `
                        <button class="widget-add-item"
                            onclick="window.dashboardWidgetUI.handleAddWidget('${widget.id}')"
                            title="${widget.name} hinzuf\u00FCgen">
                            <span class="widget-add-item-icon">${widget.icon}</span>
                            <span class="widget-add-item-name">${widget.name}</span>
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
