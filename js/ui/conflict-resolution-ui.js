/* ============================================
   Conflict Resolution UI

   Renders the conflict resolution panel with:
   - List of pending conflicts with status badges
   - Side-by-side diff view (local vs. remote)
   - Field-by-field comparison with radio selection
   - Batch resolution actions
   - Auto-resolve strategy settings
   - Toast notifications for new conflicts

   All UI text is in German.
   ============================================ */

class ConflictResolutionUI {
    constructor() {
        this.currentConflictId = null;
        this.manualSelections = {}; // { field: 'local' | 'remote' }
        this._setupEventListeners();
    }

    // ---- Event Listeners ----

    _setupEventListeners() {
        window.addEventListener('conflict-added', () => {
            this._updateBadge();
            const count = window.conflictResolutionService?.getConflictCount() || 0;
            if (count > 0) {
                this.showConflictNotification(count);
            }
        });

        window.addEventListener('conflict-resolved', () => {
            this._updateBadge();
            this._refreshCurrentView();
        });

        window.addEventListener('conflicts-batch-resolved', (e) => {
            this._updateBadge();
            this._refreshCurrentView();
            this._showToast(`${e.detail?.count || 0} Konflikte aufgeloest`, 'success');
        });

        window.addEventListener('sync-conflict-detected', (e) => {
            const count = e.detail?.count || 0;
            if (count > 0) {
                this.showConflictNotification(count);
            }
        });

        window.addEventListener('conflict-settings-changed', () => {
            this._refreshCurrentView();
        });
    }

    // ---- Main Render ----

    /**
     * Render the full conflict resolution panel into a container.
     * @param {string} containerId - DOM element ID to render into
     */
    render(containerId) {
        try {
            const container = document.getElementById(containerId);
            if (!container) {
                console.warn('ConflictResolutionUI: Container not found:', containerId);
                return;
            }

            this._containerId = containerId;

            const service = window.conflictResolutionService;
            if (!service) {
                container.innerHTML = '<p class="conflict-error">Konflikt-Service nicht verfuegbar.</p>';
                return;
            }

            const pendingConflicts = service.getPendingConflicts();
            const historyConflicts = service.getConflictHistory();

            container.innerHTML = `
                <div class="conflict-panel">
                    <div class="conflict-panel-header">
                        <h2>Sync-Konflikte</h2>
                        <span class="conflict-badge" id="conflict-count-badge">${pendingConflicts.length}</span>
                    </div>

                    ${this.renderSettings()}

                    ${this.renderBatchActions(pendingConflicts.length)}

                    <div class="conflict-tabs">
                        <button class="conflict-tab active" data-tab="pending" id="conflict-tab-pending">
                            Offen (${pendingConflicts.length})
                        </button>
                        <button class="conflict-tab" data-tab="history" id="conflict-tab-history">
                            Verlauf (${historyConflicts.length})
                        </button>
                    </div>

                    <div class="conflict-tab-content" id="conflict-tab-content-pending">
                        ${this.renderConflictList(pendingConflicts)}
                    </div>

                    <div class="conflict-tab-content" id="conflict-tab-content-history" style="display: none;">
                        ${this._renderHistoryList(historyConflicts)}
                    </div>

                    <div class="conflict-detail-area" id="conflict-detail-area"></div>
                </div>
            `;

            this._attachPanelEvents(container);
        } catch (err) {
            console.error('ConflictResolutionUI: Render error:', err);
        }
    }

    // ---- Conflict List ----

    /**
     * Render a list of pending conflicts as cards.
     * @param {Array} conflicts
     * @returns {string} HTML string
     */
    renderConflictList(conflicts) {
        if (!conflicts || conflicts.length === 0) {
            return `
                <div class="conflict-empty-state">
                    <p>Keine offenen Sync-Konflikte vorhanden.</p>
                    <p class="conflict-empty-hint">Konflikte entstehen, wenn Daten gleichzeitig lokal und auf dem Server geaendert werden.</p>
                </div>
            `;
        }

        return `
            <div class="conflict-list">
                ${conflicts.map(conflict => this._renderConflictCard(conflict)).join('')}
            </div>
        `;
    }

    _renderConflictCard(conflict) {
        const fieldCount = conflict.conflictingFields?.length || 0;
        const tableLabel = this._getTableLabel(conflict.table);
        const timeAgo = this._formatTimeAgo(conflict.detectedAt);

        return `
            <div class="conflict-card" data-conflict-id="${conflict.id}">
                <div class="conflict-card-header">
                    <div class="conflict-card-title">
                        <span class="conflict-card-table-badge">${tableLabel}</span>
                        <strong>${this._escapeHtml(conflict.recordTitle)}</strong>
                    </div>
                    <span class="conflict-card-time">${timeAgo}</span>
                </div>
                <div class="conflict-card-body">
                    <span class="conflict-card-field-count">${fieldCount} ${fieldCount === 1 ? 'Feld' : 'Felder'} betroffen</span>
                </div>
                <div class="conflict-card-actions">
                    <button class="btn btn-sm btn-secondary conflict-btn-detail" data-conflict-id="${conflict.id}">Details anzeigen</button>
                    <button class="btn btn-sm btn-success conflict-btn-keep-local" data-conflict-id="${conflict.id}">Lokal behalten</button>
                    <button class="btn btn-sm btn-primary conflict-btn-keep-remote" data-conflict-id="${conflict.id}">Server behalten</button>
                </div>
            </div>
        `;
    }

    // ---- Conflict Detail (Side-by-Side Diff) ----

    /**
     * Render the detail view for a single conflict with side-by-side diff.
     * @param {string} conflictId
     */
    renderConflictDetail(conflictId) {
        try {
            const service = window.conflictResolutionService;
            if (!service) { return; }

            const conflict = service.getConflict(conflictId);
            if (!conflict) {
                console.warn('ConflictResolutionUI: Conflict not found:', conflictId);
                return;
            }

            this.currentConflictId = conflictId;
            this.manualSelections = {};

            // Pre-fill manual selections with local as default
            if (conflict.conflictingFields) {
                conflict.conflictingFields.forEach(f => {
                    this.manualSelections[f.field] = 'local';
                });
            }

            const detailArea = document.getElementById('conflict-detail-area');
            if (!detailArea) { return; }

            const tableLabel = this._getTableLabel(conflict.table);

            detailArea.innerHTML = `
                <div class="conflict-detail">
                    <div class="conflict-detail-header">
                        <h3>Konflikt-Details: ${this._escapeHtml(conflict.recordTitle)}</h3>
                        <span class="conflict-card-table-badge">${tableLabel}</span>
                        <button class="btn btn-sm btn-secondary conflict-detail-close" id="conflict-detail-close">Schliessen</button>
                    </div>

                    <div class="conflict-detail-info">
                        <p>Erkannt: ${this._formatDateTime(conflict.detectedAt)}</p>
                        <p>Datensatz-ID: <code>${conflict.recordId}</code></p>
                    </div>

                    ${this.renderDiffView(conflict.localRecord, conflict.remoteRecord, conflict.conflictingFields)}

                    <div class="conflict-detail-actions">
                        <button class="btn btn-success conflict-resolve-local" data-conflict-id="${conflictId}">Lokal behalten</button>
                        <button class="btn btn-primary conflict-resolve-remote" data-conflict-id="${conflictId}">Server behalten</button>
                        <button class="btn btn-warning conflict-resolve-merge" data-conflict-id="${conflictId}">Manuell zusammenfuehren</button>
                    </div>
                </div>
            `;

            this._attachDetailEvents(detailArea);

            // Scroll to detail
            detailArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
            console.error('ConflictResolutionUI: Error rendering detail:', err);
        }
    }

    // ---- Diff View ----

    /**
     * Render a field-by-field comparison table.
     * Changed fields are highlighted; unchanged fields are dimmed.
     * @param {Object} localRecord
     * @param {Object} remoteRecord
     * @param {Array} conflictingFields
     * @returns {string} HTML string
     */
    renderDiffView(localRecord, remoteRecord, conflictingFields) {
        const conflictFieldNames = new Set((conflictingFields || []).map(f => f.field));
        const ignoredFields = ['user_id', 'created_at', 'id'];

        // Collect all field names
        const allFields = new Set([
            ...Object.keys(localRecord || {}),
            ...Object.keys(remoteRecord || {})
        ]);

        let rows = '';

        for (const field of allFields) {
            if (ignoredFields.includes(field)) { continue; }

            const localVal = localRecord?.[field];
            const remoteVal = remoteRecord?.[field];
            const isConflict = conflictFieldNames.has(field);

            const localDisplay = this._formatFieldValue(localVal);
            const remoteDisplay = this._formatFieldValue(remoteVal);

            const rowClass = isConflict ? 'conflict-diff-row conflict-diff-row-changed' : 'conflict-diff-row conflict-diff-row-unchanged';
            const localCellClass = isConflict ? 'conflict-field-local' : '';
            const remoteCellClass = isConflict ? 'conflict-field-remote' : '';

            const radioHtml = isConflict ? `
                <td class="conflict-diff-select">
                    <label class="conflict-radio-label">
                        <input type="radio" name="merge_${field}" value="local" checked data-field="${field}">
                        Lokal
                    </label>
                    <label class="conflict-radio-label">
                        <input type="radio" name="merge_${field}" value="remote" data-field="${field}">
                        Server
                    </label>
                </td>
            ` : '<td class="conflict-diff-select"></td>';

            rows += `
                <tr class="${rowClass}">
                    <td class="conflict-diff-field">${this._formatFieldLabel(field)}</td>
                    <td class="conflict-diff-value ${localCellClass}">${localDisplay}</td>
                    <td class="conflict-diff-value ${remoteCellClass}">${remoteDisplay}</td>
                    ${radioHtml}
                </tr>
            `;
        }

        return `
            <div class="conflict-diff-view">
                <table class="conflict-diff-table">
                    <thead>
                        <tr>
                            <th class="conflict-diff-th-field">Feld</th>
                            <th class="conflict-diff-th-local">Lokal (Geraet)</th>
                            <th class="conflict-diff-th-remote">Server</th>
                            <th class="conflict-diff-th-select">Auswahl</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    // ---- Batch Actions ----

    /**
     * Render batch action buttons.
     * @param {number} pendingCount
     * @returns {string} HTML string
     */
    renderBatchActions(pendingCount) {
        if (pendingCount === 0) {
            return '';
        }

        return `
            <div class="conflict-batch-actions">
                <span class="conflict-batch-label">${pendingCount} offene ${pendingCount === 1 ? 'Konflikt' : 'Konflikte'}</span>
                <button class="btn btn-sm btn-success" id="conflict-batch-keep-local">Alle lokal behalten</button>
                <button class="btn btn-sm btn-primary" id="conflict-batch-keep-remote">Alle vom Server</button>
            </div>
        `;
    }

    // ---- Settings ----

    /**
     * Render auto-resolve strategy settings.
     * @returns {string} HTML string
     */
    renderSettings() {
        const service = window.conflictResolutionService;
        const currentStrategy = service ? service.getAutoResolveStrategy() : 'manual';

        return `
            <div class="conflict-settings">
                <label class="conflict-settings-label" for="conflict-auto-strategy">Automatische Aufloesung:</label>
                <select class="conflict-settings-select" id="conflict-auto-strategy">
                    <option value="manual" ${currentStrategy === 'manual' ? 'selected' : ''}>Manuell (Immer fragen)</option>
                    <option value="local-wins" ${currentStrategy === 'local-wins' ? 'selected' : ''}>Lokal gewinnt</option>
                    <option value="remote-wins" ${currentStrategy === 'remote-wins' ? 'selected' : ''}>Server gewinnt</option>
                </select>
            </div>
        `;
    }

    // ---- Notification ----

    /**
     * Show a toast notification about new conflicts.
     * @param {number} count
     */
    showConflictNotification(count) {
        if (count <= 0) { return; }

        const message = count === 1
            ? '1 Sync-Konflikt gefunden'
            : `${count} Sync-Konflikte gefunden`;

        this._showToast(message, 'warning');
    }

    // ---- Private: Event Attachment ----

    _attachPanelEvents(container) {
        // Tab switching
        container.querySelectorAll('.conflict-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this._switchTab(container, tabName);
            });
        });

        // Batch actions
        container.querySelector('#conflict-batch-keep-local')?.addEventListener('click', () => {
            if (window.conflictResolutionService) {
                window.conflictResolutionService.resolveAllKeepLocal();
            }
        });

        container.querySelector('#conflict-batch-keep-remote')?.addEventListener('click', () => {
            if (window.conflictResolutionService) {
                window.conflictResolutionService.resolveAllKeepRemote();
            }
        });

        // Settings
        container.querySelector('#conflict-auto-strategy')?.addEventListener('change', (e) => {
            if (window.conflictResolutionService) {
                window.conflictResolutionService.setAutoResolveStrategy(e.target.value);
            }
        });

        // Card-level actions (event delegation)
        container.addEventListener('click', (e) => {
            const detailBtn = e.target.closest('.conflict-btn-detail');
            if (detailBtn) {
                this.renderConflictDetail(detailBtn.dataset.conflictId);
                return;
            }

            const keepLocalBtn = e.target.closest('.conflict-btn-keep-local');
            if (keepLocalBtn) {
                window.conflictResolutionService?.resolveKeepLocal(keepLocalBtn.dataset.conflictId);
                return;
            }

            const keepRemoteBtn = e.target.closest('.conflict-btn-keep-remote');
            if (keepRemoteBtn) {
                window.conflictResolutionService?.resolveKeepRemote(keepRemoteBtn.dataset.conflictId);
                return;
            }
        });
    }

    _attachDetailEvents(detailArea) {
        // Close button
        detailArea.querySelector('#conflict-detail-close')?.addEventListener('click', () => {
            detailArea.innerHTML = '';
            this.currentConflictId = null;
        });

        // Radio buttons for manual merge
        detailArea.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const field = e.target.dataset.field;
                const value = e.target.value;
                this.manualSelections[field] = value;
            });
        });

        // Resolve buttons
        detailArea.querySelector('.conflict-resolve-local')?.addEventListener('click', (e) => {
            window.conflictResolutionService?.resolveKeepLocal(e.target.dataset.conflictId);
            detailArea.innerHTML = '';
            this.currentConflictId = null;
        });

        detailArea.querySelector('.conflict-resolve-remote')?.addEventListener('click', (e) => {
            window.conflictResolutionService?.resolveKeepRemote(e.target.dataset.conflictId);
            detailArea.innerHTML = '';
            this.currentConflictId = null;
        });

        detailArea.querySelector('.conflict-resolve-merge')?.addEventListener('click', (e) => {
            this._performManualMerge(e.target.dataset.conflictId);
            detailArea.innerHTML = '';
            this.currentConflictId = null;
        });
    }

    // ---- Private: Manual Merge ----

    _performManualMerge(conflictId) {
        try {
            const service = window.conflictResolutionService;
            if (!service) { return; }

            const conflict = service.getConflict(conflictId);
            if (!conflict) { return; }

            // Build merged record from user selections
            const merged = { ...conflict.localRecord };

            for (const [field, choice] of Object.entries(this.manualSelections)) {
                if (choice === 'remote') {
                    merged[field] = conflict.remoteRecord[field];
                }
                // 'local' keeps the localRecord value already in merged
            }

            service.resolveManualMerge(conflictId, merged);
            this._showToast('Konflikt manuell aufgeloest', 'success');
        } catch (err) {
            console.error('ConflictResolutionUI: Manual merge error:', err);
            this._showToast('Fehler beim Zusammenfuehren', 'error');
        }
    }

    // ---- Private: History List ----

    _renderHistoryList(historyConflicts) {
        if (!historyConflicts || historyConflicts.length === 0) {
            return '<div class="conflict-empty-state"><p>Noch keine geloesten Konflikte vorhanden.</p></div>';
        }

        return `
            <div class="conflict-list conflict-history-list">
                ${historyConflicts.map(conflict => this._renderHistoryCard(conflict)).join('')}
            </div>
        `;
    }

    _renderHistoryCard(conflict) {
        const tableLabel = this._getTableLabel(conflict.table);
        const resolutionLabel = this._getResolutionLabel(conflict.resolution);

        return `
            <div class="conflict-card conflict-card-resolved">
                <div class="conflict-card-header">
                    <div class="conflict-card-title">
                        <span class="conflict-card-table-badge">${tableLabel}</span>
                        <strong>${this._escapeHtml(conflict.recordTitle)}</strong>
                    </div>
                    <span class="conflict-card-resolution-badge">${resolutionLabel}</span>
                </div>
                <div class="conflict-card-body">
                    <span class="conflict-card-time">Erkannt: ${this._formatDateTime(conflict.detectedAt)}</span>
                    <span class="conflict-card-time">Geloest: ${this._formatDateTime(conflict.resolvedAt)}</span>
                </div>
            </div>
        `;
    }

    // ---- Private: Tab Switching ----

    _switchTab(container, tabName) {
        // Update tab buttons
        container.querySelectorAll('.conflict-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        container.querySelector('#conflict-tab-content-pending').style.display =
            tabName === 'pending' ? '' : 'none';
        container.querySelector('#conflict-tab-content-history').style.display =
            tabName === 'history' ? '' : 'none';
    }

    // ---- Private: Refresh ----

    _refreshCurrentView() {
        if (this._containerId) {
            this.render(this._containerId);
        }
    }

    _updateBadge() {
        const badge = document.getElementById('conflict-count-badge');
        if (badge && window.conflictResolutionService) {
            const count = window.conflictResolutionService.getConflictCount();
            badge.textContent = count;
            badge.style.display = count > 0 ? '' : 'none';
        }

        // Also update any nav badges
        const navBadge = document.getElementById('nav-conflict-badge');
        if (navBadge && window.conflictResolutionService) {
            const count = window.conflictResolutionService.getConflictCount();
            navBadge.textContent = count;
            navBadge.style.display = count > 0 ? '' : 'none';
        }
    }

    // ---- Private: Toast ----

    _showToast(message, type = 'info') {
        try {
            // Remove existing conflict toast
            const existing = document.querySelector('.conflict-toast');
            if (existing) {
                existing.remove();
            }

            const toast = document.createElement('div');
            toast.className = `conflict-toast conflict-toast-${type}`;
            toast.textContent = message;
            document.body.appendChild(toast);

            // Trigger animation
            requestAnimationFrame(() => {
                toast.classList.add('conflict-toast-visible');
            });

            // Auto-remove
            setTimeout(() => {
                toast.classList.remove('conflict-toast-visible');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        } catch (err) {
            console.error('ConflictResolutionUI: Toast error:', err);
        }
    }

    // ---- Private: Formatting Helpers ----

    _getTableLabel(table) {
        const labels = {
            'purchase_orders': 'Bestellungen',
            'stock_movements': 'Lagerbewegungen',
            'material_reservations': 'Reservierungen',
            'suppliers': 'Lieferanten',
            'communication_log': 'Kommunikation'
        };
        return labels[table] || table;
    }

    _getResolutionLabel(resolution) {
        const labels = {
            'keep-local': 'Lokal behalten',
            'keep-remote': 'Server behalten',
            'manual-merge': 'Manuell zusammengefuehrt'
        };
        return labels[resolution] || resolution;
    }

    _formatFieldLabel(field) {
        // Convert snake_case to readable German-style label
        const labels = {
            'updated_at': 'Aktualisiert am',
            'name': 'Name',
            'title': 'Titel',
            'description': 'Beschreibung',
            'bezeichnung': 'Bezeichnung',
            'status': 'Status',
            'menge': 'Menge',
            'preis': 'Preis',
            'einheit': 'Einheit',
            'notizen': 'Notizen',
            'notes': 'Notizen',
            'po_nummer': 'Bestellnummer',
            'nummer': 'Nummer',
            'lieferant_name': 'Lieferant',
            'lieferdatum': 'Lieferdatum',
            'total': 'Gesamt',
            'quantity': 'Menge',
            'price': 'Preis',
            'unit': 'Einheit',
            'email': 'E-Mail',
            'telefon': 'Telefon',
            'phone': 'Telefon',
            'address': 'Adresse',
            'adresse': 'Adresse',
            'type': 'Typ',
            'category': 'Kategorie',
            'priority': 'Prioritaet',
            'due_date': 'Faelligkeitsdatum',
            'assigned_to': 'Zugewiesen an',
            'completed': 'Abgeschlossen'
        };

        if (labels[field]) {
            return labels[field];
        }

        // Fallback: convert snake_case to Title Case
        return field
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    _formatFieldValue(value) {
        if (value === null || value === undefined) {
            return '<span class="conflict-value-empty">-</span>';
        }
        if (typeof value === 'boolean') {
            return value ? 'Ja' : 'Nein';
        }
        if (typeof value === 'object') {
            try {
                return `<code>${this._escapeHtml(JSON.stringify(value, null, 2))}</code>`;
            } catch {
                return '<span class="conflict-value-empty">[Objekt]</span>';
            }
        }
        // Check if it looks like an ISO date
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
            return this._formatDateTime(value);
        }
        return this._escapeHtml(String(value));
    }

    _formatDateTime(isoString) {
        if (!isoString) { return '-'; }
        try {
            const date = new Date(isoString);
            return date.toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoString;
        }
    }

    _formatTimeAgo(isoString) {
        if (!isoString) { return ''; }
        try {
            const now = new Date();
            const date = new Date(isoString);
            const diffMs = now - date;
            const diffMin = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMin / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMin < 1) { return 'Gerade eben'; }
            if (diffMin < 60) { return `vor ${diffMin} Min.`; }
            if (diffHours < 24) { return `vor ${diffHours} Std.`; }
            if (diffDays < 7) { return `vor ${diffDays} ${diffDays === 1 ? 'Tag' : 'Tagen'}`; }
            return this._formatDateTime(isoString);
        } catch {
            return '';
        }
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Global instance
window.conflictResolutionUI = new ConflictResolutionUI();
