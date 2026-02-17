/* ============================================
   Gantt Timeline UI - Werkstattplaner
   Visual bar-chart timeline for Aufträge
   Drag & drop scheduling for Herr Müller
   ============================================ */

class GanttTimelineUI {
    constructor() {
        this.container = null;
        this.viewStartDate = this._startOfWeek(new Date());
        this.weeksToShow = 4;
        this.filterActive = true; // exclude abgeschlossen/storniert by default
        this.dragState = null;
        this.tooltip = null;
        this.scrollContainer = null;

        // Status colors — must match AUFTRAG_STATUS_CONFIG in auftraege.js
        this.statusColors = {
            geplant:              { bg: '#60a5fa', fill: '#3b82f6', label: 'Geplant',             icon: '\u{1F4CB}' },
            material_bestellt:    { bg: '#a78bfa', fill: '#7c3aed', label: 'Material bestellt',   icon: '\u{1F4E6}' },
            in_bearbeitung:       { bg: '#f59e0b', fill: '#d97706', label: 'In Bearbeitung',      icon: '\u{1F527}' },
            qualitaetskontrolle:  { bg: '#06b6d4', fill: '#0891b2', label: 'Qualitaetskontrolle', icon: '\u{1F50D}' },
            abnahme:              { bg: '#8b5cf6', fill: '#6d28d9', label: 'Abnahme',             icon: '\u270B'    },
            abgeschlossen:        { bg: '#22c55e', fill: '#16a34a', label: 'Abgeschlossen',       icon: '\u2705'    },
            pausiert:             { bg: '#94a3b8', fill: '#64748b', label: 'Pausiert',             icon: '\u23F8\uFE0F' },
            storniert:            { bg: '#ef4444', fill: '#dc2626', label: 'Storniert',            icon: '\u274C'    }
        };

        this.DAY_WIDTH = 48;      // px per day column
        this.LABEL_WIDTH = 240;   // px for the left label column
        this.ROW_HEIGHT = 52;     // px per row
        this.HEADER_HEIGHT = 56;  // px for the day-header row

        this._injectStyles();
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    mount(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('[GanttTimelineUI] Container not found:', containerId);
            return;
        }
        this.render();
    }

    refresh() {
        if (this.container) this.render();
    }

    // ================================================================
    // HELPERS
    // ================================================================

    _getStore() {
        return window.AppUtils?.store || window.storeService?.state || { auftraege: [] };
    }

    _saveStore() {
        if (window.AppUtils?.saveStore) window.AppUtils.saveStore();
        else if (window.storeService?.save) window.storeService.save();
    }

    _startOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay(); // 0=Sun
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    _addDays(date, n) {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    }

    _daysBetween(a, b) {
        const msPerDay = 86400000;
        const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
        const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
        return Math.round((utcB - utcA) / msPerDay);
    }

    _formatDE(date) {
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }

    _formatDEShort(date) {
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    _parseDate(val) {
        if (!val) return null;
        if (val instanceof Date) return new Date(val.getFullYear(), val.getMonth(), val.getDate());
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    _isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6;
    }

    _isSameDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
               a.getMonth() === b.getMonth() &&
               a.getDate() === b.getDate();
    }

    _sanitize(str) {
        if (window.UI?.sanitize) return window.UI.sanitize(str);
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    _getDayAbbr(date) {
        const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        return days[date.getDay()];
    }

    _getMonthName(date) {
        const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        return months[date.getMonth()];
    }

    get totalDays() {
        return this.weeksToShow * 7;
    }

    get viewEndDate() {
        return this._addDays(this.viewStartDate, this.totalDays - 1);
    }

    // ================================================================
    // RENDER
    // ================================================================

    render() {
        const store = this._getStore();
        const auftraege = store.auftraege || [];

        // Separate scheduled vs unplanned
        let scheduled = auftraege.filter(a => {
            const s = this._parseDate(a.startDatum);
            const e = this._parseDate(a.endDatum);
            return s && e;
        });
        let unplanned = auftraege.filter(a => {
            const s = this._parseDate(a.startDatum);
            const e = this._parseDate(a.endDatum);
            return !s || !e;
        });

        // Apply filter
        if (this.filterActive) {
            scheduled = scheduled.filter(a => a.status !== 'abgeschlossen' && a.status !== 'storniert');
            unplanned = unplanned.filter(a => a.status !== 'abgeschlossen' && a.status !== 'storniert');
        }

        // Sort scheduled by startDatum
        scheduled.sort((a, b) => new Date(a.startDatum) - new Date(b.startDatum));

        this.container.innerHTML = '';
        this.container.className = 'gantt-root';

        // Build toolbar
        this.container.appendChild(this._buildToolbar());

        // Build timeline
        const timelineWrapper = document.createElement('div');
        timelineWrapper.className = 'gantt-timeline-wrapper';

        if (scheduled.length === 0 && unplanned.length === 0) {
            timelineWrapper.innerHTML = `
                <div class="gantt-empty-state">
                    <div class="gantt-empty-icon">\u{1F4C5}</div>
                    <div class="gantt-empty-title">Keine Auftr\u00E4ge vorhanden</div>
                    <div class="gantt-empty-text">Erstellen Sie zun\u00E4chst Auftr\u00E4ge, um den Werkstattplaner zu nutzen.</div>
                </div>`;
        } else if (scheduled.length === 0) {
            // Only unplanned exist
            timelineWrapper.appendChild(this._buildTimelineArea([]));
        } else {
            timelineWrapper.appendChild(this._buildTimelineArea(scheduled));
        }

        this.container.appendChild(timelineWrapper);

        // Unplanned section
        if (unplanned.length > 0) {
            this.container.appendChild(this._buildUnplannedSection(unplanned));
        }

        // Scroll to today
        this._scrollToToday();
    }

    // ================================================================
    // TOOLBAR
    // ================================================================

    _buildToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'gantt-toolbar';

        // Title
        const startMonth = this._getMonthName(this.viewStartDate);
        const endMonth = this._getMonthName(this.viewEndDate);
        const startYear = this.viewStartDate.getFullYear();
        const endYear = this.viewEndDate.getFullYear();
        let titleText;
        if (startYear === endYear) {
            titleText = startMonth === endMonth
                ? `${startMonth} ${startYear}`
                : `${startMonth} \u2013 ${endMonth} ${startYear}`;
        } else {
            titleText = `${startMonth} ${startYear} \u2013 ${endMonth} ${endYear}`;
        }

        toolbar.innerHTML = `
            <div class="gantt-toolbar-left">
                <div class="gantt-toolbar-title">\u{1F527} Werkstattplaner</div>
                <div class="gantt-toolbar-range">${titleText}</div>
            </div>
            <div class="gantt-toolbar-center">
                <button class="gantt-nav-btn" data-action="prev-week">\u2190 Vorherige Woche</button>
                <button class="gantt-nav-btn gantt-heute-btn" data-action="today">Heute</button>
                <button class="gantt-nav-btn" data-action="next-week">N\u00E4chste Woche \u2192</button>
            </div>
            <div class="gantt-toolbar-right">
                <div class="gantt-zoom-group">
                    <button class="gantt-zoom-btn ${this.weeksToShow === 2 ? 'active' : ''}" data-weeks="2">2 Wochen</button>
                    <button class="gantt-zoom-btn ${this.weeksToShow === 4 ? 'active' : ''}" data-weeks="4">4 Wochen</button>
                    <button class="gantt-zoom-btn ${this.weeksToShow === 8 ? 'active' : ''}" data-weeks="8">8 Wochen</button>
                </div>
                <label class="gantt-filter-toggle">
                    <input type="checkbox" ${this.filterActive ? 'checked' : ''} data-action="toggle-filter" />
                    <span>Nur aktive</span>
                </label>
            </div>
        `;

        // Event listeners
        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) {
                const zoomBtn = e.target.closest('[data-weeks]');
                if (zoomBtn) {
                    this.weeksToShow = parseInt(zoomBtn.dataset.weeks, 10);
                    this.render();
                }
                return;
            }
            switch (btn.dataset.action) {
                case 'prev-week':
                    this.viewStartDate = this._addDays(this.viewStartDate, -7);
                    this.render();
                    break;
                case 'next-week':
                    this.viewStartDate = this._addDays(this.viewStartDate, 7);
                    this.render();
                    break;
                case 'today':
                    this.viewStartDate = this._startOfWeek(new Date());
                    this.render();
                    break;
            }
        });

        toolbar.addEventListener('change', (e) => {
            if (e.target.dataset.action === 'toggle-filter') {
                this.filterActive = e.target.checked;
                this.render();
            }
        });

        return toolbar;
    }

    // ================================================================
    // TIMELINE AREA (header + rows)
    // ================================================================

    _buildTimelineArea(scheduled) {
        const area = document.createElement('div');
        area.className = 'gantt-timeline-area';

        // Scrollable container
        const scrollOuter = document.createElement('div');
        scrollOuter.className = 'gantt-scroll-outer';

        // Inner: fixed labels + scrollable grid
        const inner = document.createElement('div');
        inner.className = 'gantt-inner';

        // --- LABEL COLUMN ---
        const labelCol = document.createElement('div');
        labelCol.className = 'gantt-label-col';
        labelCol.style.width = this.LABEL_WIDTH + 'px';
        labelCol.style.minWidth = this.LABEL_WIDTH + 'px';

        // Label header
        const labelHeader = document.createElement('div');
        labelHeader.className = 'gantt-label-header';
        labelHeader.style.height = this.HEADER_HEIGHT + 'px';
        labelHeader.textContent = 'Auftrag';
        labelCol.appendChild(labelHeader);

        // Label rows
        if (scheduled.length === 0) {
            const emptyRow = document.createElement('div');
            emptyRow.className = 'gantt-label-row';
            emptyRow.style.height = '80px';
            emptyRow.innerHTML = `<span style="color:#71717a;font-size:13px;">Keine geplanten Auftr\u00E4ge</span>`;
            labelCol.appendChild(emptyRow);
        } else {
            scheduled.forEach(a => {
                const row = document.createElement('div');
                row.className = 'gantt-label-row';
                row.style.height = this.ROW_HEIGHT + 'px';

                const sc = this.statusColors[a.status] || this.statusColors.geplant;
                row.innerHTML = `
                    <div class="gantt-label-content">
                        <span class="gantt-label-icon">${sc.icon}</span>
                        <div class="gantt-label-text">
                            <span class="gantt-label-name">${this._sanitize(a.kunde?.name || 'Unbekannt')}</span>
                            <span class="gantt-label-id">${this._sanitize(a.id)}</span>
                        </div>
                    </div>
                `;
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    if (window.openAuftragDetail) window.openAuftragDetail(a.id);
                });
                labelCol.appendChild(row);
            });
        }

        inner.appendChild(labelCol);

        // --- GRID COLUMN ---
        const gridCol = document.createElement('div');
        gridCol.className = 'gantt-grid-col';
        this.scrollContainer = gridCol;

        const gridWidth = this.totalDays * this.DAY_WIDTH;

        // Day headers
        const headerRow = document.createElement('div');
        headerRow.className = 'gantt-day-header-row';
        headerRow.style.height = this.HEADER_HEIGHT + 'px';
        headerRow.style.width = gridWidth + 'px';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < this.totalDays; i++) {
            const day = this._addDays(this.viewStartDate, i);
            const isWE = this._isWeekend(day);
            const isToday = this._isSameDay(day, today);

            const cell = document.createElement('div');
            cell.className = 'gantt-day-header' +
                (isWE ? ' gantt-day-weekend' : '') +
                (isToday ? ' gantt-day-today' : '');
            cell.style.width = this.DAY_WIDTH + 'px';
            cell.style.minWidth = this.DAY_WIDTH + 'px';
            cell.innerHTML = `
                <span class="gantt-day-num">${day.getDate()}</span>
                <span class="gantt-day-abbr">${this._getDayAbbr(day)}</span>
            `;
            headerRow.appendChild(cell);
        }
        gridCol.appendChild(headerRow);

        // Grid body (rows + bars)
        const gridBody = document.createElement('div');
        gridBody.className = 'gantt-grid-body';
        gridBody.style.width = gridWidth + 'px';
        gridBody.style.position = 'relative';

        if (scheduled.length === 0) {
            gridBody.style.height = '80px';
            // Draw column lines anyway
            this._drawColumnBackgrounds(gridBody, 80);
            const msg = document.createElement('div');
            msg.className = 'gantt-no-scheduled-msg';
            msg.textContent = 'Keine Auftr\u00E4ge mit Zeitplan. Ziehen Sie Auftr\u00E4ge aus der Liste unten auf die Zeitleiste.';
            gridBody.appendChild(msg);
        } else {
            const bodyHeight = scheduled.length * this.ROW_HEIGHT;
            gridBody.style.height = bodyHeight + 'px';

            // Column backgrounds (weekends + today line)
            this._drawColumnBackgrounds(gridBody, bodyHeight);

            // Row dividers + bars
            scheduled.forEach((a, idx) => {
                // Row background stripe (hover target)
                const rowBg = document.createElement('div');
                rowBg.className = 'gantt-row-bg';
                rowBg.style.top = (idx * this.ROW_HEIGHT) + 'px';
                rowBg.style.height = this.ROW_HEIGHT + 'px';
                rowBg.style.width = '100%';
                if (idx % 2 === 1) rowBg.classList.add('gantt-row-alt');
                gridBody.appendChild(rowBg);

                // Bar
                const bar = this._buildBar(a, idx);
                if (bar) gridBody.appendChild(bar);
            });

            // Today red line (on top of everything)
            this._drawTodayLine(gridBody, bodyHeight);
        }

        gridCol.appendChild(gridBody);
        inner.appendChild(gridCol);
        scrollOuter.appendChild(inner);
        area.appendChild(scrollOuter);

        // Enable drop from unplanned section
        this._setupDropZone(gridBody, scheduled);

        return area;
    }

    // ================================================================
    // COLUMN BACKGROUNDS
    // ================================================================

    _drawColumnBackgrounds(gridBody, height) {
        for (let i = 0; i < this.totalDays; i++) {
            const day = this._addDays(this.viewStartDate, i);
            if (this._isWeekend(day)) {
                const bg = document.createElement('div');
                bg.className = 'gantt-col-weekend';
                bg.style.left = (i * this.DAY_WIDTH) + 'px';
                bg.style.width = this.DAY_WIDTH + 'px';
                bg.style.height = height + 'px';
                gridBody.appendChild(bg);
            }
        }
    }

    _drawTodayLine(gridBody, height) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const offset = this._daysBetween(this.viewStartDate, today);
        if (offset >= 0 && offset < this.totalDays) {
            const line = document.createElement('div');
            line.className = 'gantt-today-line';
            line.style.left = (offset * this.DAY_WIDTH + Math.floor(this.DAY_WIDTH / 2)) + 'px';
            line.style.height = height + 'px';
            gridBody.appendChild(line);
        }
    }

    // ================================================================
    // BAR RENDERING
    // ================================================================

    _buildBar(auftrag, rowIdx) {
        const start = this._parseDate(auftrag.startDatum);
        const end = this._parseDate(auftrag.endDatum);
        if (!start || !end) return null;

        const viewStart = new Date(this.viewStartDate);
        const viewEnd = this.viewEndDate;

        // Calculate positions
        const barStartDay = this._daysBetween(viewStart, start);
        const barEndDay = this._daysBetween(viewStart, end);
        const durationDays = this._daysBetween(start, end) + 1; // inclusive

        // Check if bar is at least partially visible
        if (barEndDay < 0 || barStartDay >= this.totalDays) return null;

        const clampedStart = Math.max(0, barStartDay);
        const clampedEnd = Math.min(this.totalDays - 1, barEndDay);

        const left = clampedStart * this.DAY_WIDTH + 2;
        const width = (clampedEnd - clampedStart + 1) * this.DAY_WIDTH - 4;
        const top = rowIdx * this.ROW_HEIGHT + 8;
        const barHeight = this.ROW_HEIGHT - 16;

        const sc = this.statusColors[auftrag.status] || this.statusColors.geplant;
        const fortschritt = auftrag.fortschritt || 0;
        const isPausiert = auftrag.status === 'pausiert';

        const bar = document.createElement('div');
        bar.className = 'gantt-bar' + (isPausiert ? ' gantt-bar-paused' : '');
        bar.dataset.auftragId = auftrag.id;
        bar.style.cssText = `
            left: ${left}px;
            top: ${top}px;
            width: ${width}px;
            height: ${barHeight}px;
            background: ${sc.bg};
        `;

        // Progress fill
        if (fortschritt > 0) {
            const progressDiv = document.createElement('div');
            progressDiv.className = 'gantt-bar-progress';
            progressDiv.style.width = fortschritt + '%';
            progressDiv.style.background = sc.fill;
            bar.appendChild(progressDiv);
        }

        // Bar text
        const textSpan = document.createElement('span');
        textSpan.className = 'gantt-bar-text';
        const displayText = width > 120
            ? `${this._sanitize(auftrag.kunde?.name || '')} (${durationDays}T)`
            : (width > 60 ? this._sanitize(auftrag.kunde?.name || '') : '');
        textSpan.textContent = displayText;
        bar.appendChild(textSpan);

        // Worker chips
        const workers = auftrag.mitarbeiter || [];
        if (workers.length > 0 && width > 80) {
            const chipsDiv = document.createElement('div');
            chipsDiv.className = 'gantt-bar-workers';
            workers.forEach(w => {
                const chip = document.createElement('span');
                chip.className = 'gantt-worker-chip';
                chip.textContent = w;
                chipsDiv.appendChild(chip);
            });
            bar.appendChild(chipsDiv);
        }

        // Resize handle (right edge)
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'gantt-resize-handle';
        bar.appendChild(resizeHandle);

        // Click to open detail
        bar.addEventListener('click', (e) => {
            // Don't trigger if we just finished a drag
            if (this._justDragged) return;
            if (e.target.classList.contains('gantt-resize-handle')) return;
            if (window.openAuftragDetail) window.openAuftragDetail(auftrag.id);
        });

        // Drag to move
        this._setupBarDrag(bar, auftrag, 'move');

        // Drag to resize (from right handle)
        this._setupBarDrag(resizeHandle, auftrag, 'resize');

        return bar;
    }

    // ================================================================
    // DRAG & DROP — MOVE / RESIZE BARS
    // ================================================================

    _setupBarDrag(element, auftrag, mode) {
        let startX = 0;
        let originalLeft = 0;
        let originalWidth = 0;
        let barEl = null;

        const onMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._justDragged = false;

            barEl = mode === 'resize' ? element.parentElement : element;
            startX = e.clientX;
            originalLeft = parseInt(barEl.style.left, 10);
            originalWidth = parseInt(barEl.style.width, 10);

            barEl.classList.add('gantt-bar-dragging');

            this._showTooltip(e.clientX, e.clientY, '');
            this._updateDragTooltip(auftrag, 0, mode, originalLeft, originalWidth);

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            const dx = e.clientX - startX;
            this._justDragged = true;

            if (mode === 'move') {
                barEl.style.left = (originalLeft + dx) + 'px';
            } else {
                const newWidth = Math.max(this.DAY_WIDTH - 4, originalWidth + dx);
                barEl.style.width = newWidth + 'px';
            }

            this._moveTooltip(e.clientX, e.clientY);
            this._updateDragTooltip(auftrag, dx, mode, originalLeft, originalWidth);
        };

        const onMouseUp = (e) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (barEl) barEl.classList.remove('gantt-bar-dragging');
            this._hideTooltip();

            if (!this._justDragged) return;

            const dx = e.clientX - startX;
            const dayShift = Math.round(dx / this.DAY_WIDTH);

            if (dayShift === 0 && mode === 'move') {
                this._justDragged = false;
                return;
            }

            const origStart = this._parseDate(auftrag.startDatum);
            const origEnd = this._parseDate(auftrag.endDatum);
            if (!origStart || !origEnd) return;

            if (mode === 'move') {
                auftrag.startDatum = this._addDays(origStart, dayShift).toISOString().split('T')[0];
                auftrag.endDatum = this._addDays(origEnd, dayShift).toISOString().split('T')[0];
            } else {
                // Resize: only move endDatum
                const newEnd = this._addDays(origEnd, dayShift);
                if (newEnd >= origStart) {
                    auftrag.endDatum = newEnd.toISOString().split('T')[0];
                }
            }

            this._saveStore();
            this.render();

            // Reset justDragged after a short delay so click doesn't fire
            setTimeout(() => { this._justDragged = false; }, 100);
        };

        element.addEventListener('mousedown', onMouseDown);
    }

    // ================================================================
    // DRAG TOOLTIP
    // ================================================================

    _showTooltip(x, y, text) {
        if (!this.tooltip) {
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'gantt-drag-tooltip';
            document.body.appendChild(this.tooltip);
        }
        this.tooltip.textContent = text;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (x + 14) + 'px';
        this.tooltip.style.top = (y - 30) + 'px';
    }

    _moveTooltip(x, y) {
        if (this.tooltip) {
            this.tooltip.style.left = (x + 14) + 'px';
            this.tooltip.style.top = (y - 30) + 'px';
        }
    }

    _updateDragTooltip(auftrag, dx, mode, originalLeft, originalWidth) {
        const dayShift = Math.round(dx / this.DAY_WIDTH);
        const origStart = this._parseDate(auftrag.startDatum);
        const origEnd = this._parseDate(auftrag.endDatum);
        if (!origStart || !origEnd || !this.tooltip) return;

        let newStart, newEnd;
        if (mode === 'move') {
            newStart = this._addDays(origStart, dayShift);
            newEnd = this._addDays(origEnd, dayShift);
        } else {
            newStart = origStart;
            newEnd = this._addDays(origEnd, dayShift);
            if (newEnd < newStart) newEnd = new Date(newStart);
        }

        this.tooltip.textContent = `Neuer Zeitraum: ${this._formatDEShort(newStart)} - ${this._formatDE(newEnd)}`;
    }

    _hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }

    // ================================================================
    // UNPLANNED SECTION
    // ================================================================

    _buildUnplannedSection(unplanned) {
        const section = document.createElement('div');
        section.className = 'gantt-unplanned-section';

        section.innerHTML = `
            <div class="gantt-unplanned-header">
                <span class="gantt-unplanned-title">\u{1F4CB} Nicht geplant (${unplanned.length})</span>
                <span class="gantt-unplanned-hint">Ziehen Sie Auftr\u00E4ge auf die Zeitleiste, um Termine zuzuweisen</span>
            </div>
        `;

        const list = document.createElement('div');
        list.className = 'gantt-unplanned-list';

        unplanned.forEach(a => {
            const card = document.createElement('div');
            card.className = 'gantt-unplanned-card';
            card.draggable = true;
            card.dataset.auftragId = a.id;

            const sc = this.statusColors[a.status] || this.statusColors.geplant;
            card.innerHTML = `
                <div class="gantt-unplanned-color" style="background:${sc.bg};"></div>
                <div class="gantt-unplanned-info">
                    <span class="gantt-unplanned-name">${sc.icon} ${this._sanitize(a.kunde?.name || 'Unbekannt')}</span>
                    <span class="gantt-unplanned-id">${this._sanitize(a.id)} \u2014 ${sc.label}</span>
                </div>
            `;

            // Click to open detail
            card.addEventListener('click', (e) => {
                if (e.defaultPrevented) return;
                if (window.openAuftragDetail) window.openAuftragDetail(a.id);
            });

            // Drag start
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', a.id);
                e.dataTransfer.effectAllowed = 'move';
                card.classList.add('gantt-unplanned-dragging');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('gantt-unplanned-dragging');
            });

            list.appendChild(card);
        });

        section.appendChild(list);
        return section;
    }

    // ================================================================
    // DROP ZONE (timeline accepts drops from unplanned)
    // ================================================================

    _setupDropZone(gridBody, scheduled) {
        gridBody.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            gridBody.classList.add('gantt-drop-active');
        });

        gridBody.addEventListener('dragleave', () => {
            gridBody.classList.remove('gantt-drop-active');
        });

        gridBody.addEventListener('drop', (e) => {
            e.preventDefault();
            gridBody.classList.remove('gantt-drop-active');

            const auftragId = e.dataTransfer.getData('text/plain');
            if (!auftragId) return;

            const store = this._getStore();
            const auftrag = (store.auftraege || []).find(a => a.id === auftragId);
            if (!auftrag) return;

            // Calculate drop day based on mouse position
            const rect = gridBody.getBoundingClientRect();
            const x = e.clientX - rect.left + gridBody.parentElement.scrollLeft;
            const dayOffset = Math.floor(x / this.DAY_WIDTH);
            const dropDate = this._addDays(this.viewStartDate, dayOffset);

            // Assign 3-day default duration
            const endDate = this._addDays(dropDate, 2);

            auftrag.startDatum = dropDate.toISOString().split('T')[0];
            auftrag.endDatum = endDate.toISOString().split('T')[0];

            this._saveStore();

            if (window.AppUtils?.showToast) {
                window.AppUtils.showToast(
                    `${auftrag.kunde?.name || auftragId}: ${this._formatDE(dropDate)} \u2013 ${this._formatDE(endDate)}`,
                    'success'
                );
            }

            this.render();
        });
    }

    // ================================================================
    // SCROLL TO TODAY
    // ================================================================

    _scrollToToday() {
        if (!this.scrollContainer) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const offset = this._daysBetween(this.viewStartDate, today);
        if (offset >= 0 && offset < this.totalDays) {
            // Scroll so today is roughly centered
            const scrollTarget = Math.max(0, offset * this.DAY_WIDTH - this.scrollContainer.clientWidth / 2);
            this.scrollContainer.scrollLeft = scrollTarget;
        }
    }

    // ================================================================
    // CSS INJECTION
    // ================================================================

    _injectStyles() {
        if (document.getElementById('gantt-timeline-styles')) return;

        const style = document.createElement('style');
        style.id = 'gantt-timeline-styles';
        style.textContent = `
            /* ========== ROOT ========== */
            .gantt-root {
                width: 100%;
                background: #0f0f12;
                color: #e4e4e7;
                border-radius: 8px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            /* ========== TOOLBAR ========== */
            .gantt-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 18px;
                background: #1c1c21;
                border-bottom: 1px solid #2a2a32;
                flex-wrap: wrap;
                gap: 12px;
            }
            .gantt-toolbar-left {
                display: flex;
                align-items: baseline;
                gap: 12px;
            }
            .gantt-toolbar-title {
                font-size: 18px;
                font-weight: 700;
                color: #e4e4e7;
                white-space: nowrap;
            }
            .gantt-toolbar-range {
                font-size: 14px;
                color: #a1a1aa;
                white-space: nowrap;
            }
            .gantt-toolbar-center {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            .gantt-toolbar-right {
                display: flex;
                gap: 12px;
                align-items: center;
                flex-wrap: wrap;
            }
            .gantt-nav-btn {
                padding: 7px 14px;
                border: 1px solid #3a3a42;
                border-radius: 6px;
                background: #0f0f12;
                color: #a1a1aa;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.15s ease;
                white-space: nowrap;
            }
            .gantt-nav-btn:hover {
                background: #2a2a32;
                border-color: #6366f1;
                color: #e4e4e7;
            }
            .gantt-heute-btn {
                background: #6366f1;
                color: #fff;
                border-color: #6366f1;
                font-weight: 600;
            }
            .gantt-heute-btn:hover {
                background: #4f46e5;
            }
            .gantt-zoom-group {
                display: flex;
                gap: 0;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid #3a3a42;
            }
            .gantt-zoom-btn {
                padding: 7px 12px;
                border: none;
                border-right: 1px solid #3a3a42;
                background: #0f0f12;
                color: #a1a1aa;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.15s ease;
                white-space: nowrap;
            }
            .gantt-zoom-btn:last-child {
                border-right: none;
            }
            .gantt-zoom-btn.active {
                background: #6366f1;
                color: #fff;
            }
            .gantt-zoom-btn:hover:not(.active) {
                background: #2a2a32;
                color: #e4e4e7;
            }
            .gantt-filter-toggle {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 13px;
                color: #a1a1aa;
                cursor: pointer;
                white-space: nowrap;
                user-select: none;
            }
            .gantt-filter-toggle input[type="checkbox"] {
                accent-color: #6366f1;
                width: 16px;
                height: 16px;
                cursor: pointer;
            }

            /* ========== TIMELINE WRAPPER ========== */
            .gantt-timeline-wrapper {
                flex: 1;
                min-height: 200px;
                overflow: hidden;
            }
            .gantt-timeline-area {
                height: 100%;
            }
            .gantt-scroll-outer {
                overflow: hidden;
                height: 100%;
            }
            .gantt-inner {
                display: flex;
                height: 100%;
            }

            /* ========== LABEL COLUMN ========== */
            .gantt-label-col {
                flex-shrink: 0;
                background: #1c1c21;
                border-right: 2px solid #2a2a32;
                overflow-y: auto;
                z-index: 2;
            }
            .gantt-label-header {
                display: flex;
                align-items: center;
                padding: 0 14px;
                font-size: 13px;
                font-weight: 600;
                color: #71717a;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                background: #1c1c21;
                border-bottom: 1px solid #2a2a32;
                box-sizing: border-box;
            }
            .gantt-label-row {
                display: flex;
                align-items: center;
                padding: 0 14px;
                border-bottom: 1px solid #1f1f26;
                box-sizing: border-box;
                transition: background 0.15s ease;
            }
            .gantt-label-row:hover {
                background: #1a1a22;
            }
            .gantt-label-content {
                display: flex;
                align-items: center;
                gap: 8px;
                overflow: hidden;
            }
            .gantt-label-icon {
                font-size: 16px;
                flex-shrink: 0;
            }
            .gantt-label-text {
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .gantt-label-name {
                font-size: 13px;
                font-weight: 600;
                color: #e4e4e7;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .gantt-label-id {
                font-size: 11px;
                color: #71717a;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* ========== GRID COLUMN (scrollable) ========== */
            .gantt-grid-col {
                flex: 1;
                overflow-x: auto;
                overflow-y: auto;
                position: relative;
            }

            /* ========== DAY HEADER ========== */
            .gantt-day-header-row {
                display: flex;
                border-bottom: 1px solid #2a2a32;
                background: #1c1c21;
                position: sticky;
                top: 0;
                z-index: 1;
            }
            .gantt-day-header {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-right: 1px solid #232329;
                box-sizing: border-box;
                user-select: none;
            }
            .gantt-day-num {
                font-size: 14px;
                font-weight: 600;
                color: #e4e4e7;
                line-height: 1.2;
            }
            .gantt-day-abbr {
                font-size: 11px;
                color: #71717a;
                line-height: 1.2;
            }
            .gantt-day-weekend {
                background: #16161b;
            }
            .gantt-day-weekend .gantt-day-num {
                color: #71717a;
            }
            .gantt-day-today {
                background: #1a1025;
            }
            .gantt-day-today .gantt-day-num {
                color: #ef4444;
                font-weight: 700;
            }
            .gantt-day-today .gantt-day-abbr {
                color: #ef4444;
            }

            /* ========== GRID BODY ========== */
            .gantt-grid-body {
                position: relative;
                min-height: 50px;
            }
            .gantt-row-bg {
                position: absolute;
                left: 0;
                border-bottom: 1px solid #1f1f26;
                box-sizing: border-box;
            }
            .gantt-row-bg:hover {
                background: #1a1a22;
            }
            .gantt-row-alt {
                background: #131317;
            }

            /* Column backgrounds */
            .gantt-col-weekend {
                position: absolute;
                top: 0;
                background: rgba(22, 22, 27, 0.6);
                pointer-events: none;
                z-index: 0;
            }

            /* Today line */
            .gantt-today-line {
                position: absolute;
                top: 0;
                width: 2px;
                background: #ef4444;
                z-index: 5;
                pointer-events: none;
                box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
            }

            /* ========== BARS ========== */
            .gantt-bar {
                position: absolute;
                border-radius: 6px;
                cursor: pointer;
                z-index: 3;
                display: flex;
                align-items: center;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                transition: box-shadow 0.15s ease, transform 0.1s ease;
                user-select: none;
            }
            .gantt-bar:hover {
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                transform: translateY(-1px);
                z-index: 4;
            }
            .gantt-bar-dragging {
                opacity: 0.85;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                z-index: 10 !important;
                cursor: grabbing !important;
            }
            .gantt-bar-paused {
                background-image: repeating-linear-gradient(
                    -45deg,
                    transparent,
                    transparent 5px,
                    rgba(255,255,255,0.08) 5px,
                    rgba(255,255,255,0.08) 10px
                ) !important;
            }
            .gantt-bar-progress {
                position: absolute;
                left: 0;
                top: 0;
                height: 100%;
                border-radius: 6px 0 0 6px;
                opacity: 0.5;
                pointer-events: none;
            }
            .gantt-bar-text {
                position: relative;
                z-index: 1;
                padding: 0 8px;
                font-size: 12px;
                font-weight: 600;
                color: #fff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                text-shadow: 0 1px 2px rgba(0,0,0,0.4);
            }
            .gantt-bar-workers {
                position: absolute;
                bottom: -1px;
                left: 8px;
                display: flex;
                gap: 3px;
                z-index: 1;
            }
            .gantt-worker-chip {
                font-size: 9px;
                padding: 1px 5px;
                border-radius: 3px;
                background: rgba(0,0,0,0.4);
                color: #e4e4e7;
                white-space: nowrap;
            }

            /* Resize handle */
            .gantt-resize-handle {
                position: absolute;
                right: 0;
                top: 0;
                width: 8px;
                height: 100%;
                cursor: ew-resize;
                background: transparent;
                z-index: 2;
                border-radius: 0 6px 6px 0;
                transition: background 0.15s;
            }
            .gantt-resize-handle:hover,
            .gantt-resize-handle:active {
                background: rgba(255,255,255,0.2);
            }

            /* ========== DRAG TOOLTIP ========== */
            .gantt-drag-tooltip {
                position: fixed;
                display: none;
                padding: 6px 12px;
                background: #27272a;
                color: #e4e4e7;
                border: 1px solid #3a3a42;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                white-space: nowrap;
                pointer-events: none;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            }

            /* ========== DROP ZONE ========== */
            .gantt-drop-active {
                outline: 2px dashed #6366f1;
                outline-offset: -2px;
                background: rgba(99, 102, 241, 0.05) !important;
            }

            /* ========== NO-SCHEDULED MESSAGE ========== */
            .gantt-no-scheduled-msg {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #71717a;
                font-size: 14px;
                text-align: center;
                padding: 20px;
                line-height: 1.5;
                pointer-events: none;
            }

            /* ========== EMPTY STATE ========== */
            .gantt-empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 20px;
                text-align: center;
            }
            .gantt-empty-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            .gantt-empty-title {
                font-size: 18px;
                font-weight: 600;
                color: #e4e4e7;
                margin-bottom: 8px;
            }
            .gantt-empty-text {
                font-size: 14px;
                color: #71717a;
                max-width: 400px;
            }

            /* ========== UNPLANNED SECTION ========== */
            .gantt-unplanned-section {
                border-top: 2px solid #2a2a32;
                background: #131317;
                padding: 14px 18px;
            }
            .gantt-unplanned-header {
                display: flex;
                align-items: baseline;
                gap: 12px;
                margin-bottom: 12px;
            }
            .gantt-unplanned-title {
                font-size: 15px;
                font-weight: 600;
                color: #e4e4e7;
            }
            .gantt-unplanned-hint {
                font-size: 12px;
                color: #71717a;
            }
            .gantt-unplanned-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .gantt-unplanned-card {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 14px;
                background: #1c1c21;
                border: 1px solid #2a2a32;
                border-radius: 8px;
                cursor: grab;
                transition: all 0.15s ease;
                user-select: none;
                min-width: 180px;
            }
            .gantt-unplanned-card:hover {
                border-color: #6366f1;
                background: #1a1a22;
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            }
            .gantt-unplanned-card:active {
                cursor: grabbing;
            }
            .gantt-unplanned-dragging {
                opacity: 0.5;
            }
            .gantt-unplanned-color {
                width: 4px;
                height: 32px;
                border-radius: 2px;
                flex-shrink: 0;
            }
            .gantt-unplanned-info {
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .gantt-unplanned-name {
                font-size: 13px;
                font-weight: 600;
                color: #e4e4e7;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .gantt-unplanned-id {
                font-size: 11px;
                color: #71717a;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* ========== RESPONSIVE ========== */
            @media (max-width: 768px) {
                .gantt-toolbar {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 10px 12px;
                }
                .gantt-toolbar-center {
                    width: 100%;
                    justify-content: center;
                }
                .gantt-toolbar-right {
                    width: 100%;
                    justify-content: space-between;
                }
            }
        `;

        document.head.appendChild(style);
    }
}

// ================================================================
// GLOBAL INSTANCE
// ================================================================
window.ganttTimelineUI = new GanttTimelineUI();
