/* ============================================
   Pipeline Kanban UI
   Kanban board for the Angebote pipeline view
   ============================================ */

class PipelineKanbanUI {
    constructor() {
        this.columns = [
            { id: 'entwurf',    name: 'Neu',               color: '#3b82f6' },
            { id: 'offen',      name: 'Kontaktiert',       color: '#8b5cf6' },
            { id: 'angebot',    name: 'Angebot erstellt',  color: '#f59e0b' },
            { id: 'verhandlung', name: 'Verhandlung',      color: '#ec4899' },
            { id: 'abgeschlossen', name: 'Gewonnen/Verloren', color: '#6b7280' }
        ];
        this.dragState = { dragging: null, sourceColumn: null };
        this.visible = false;
    }

    // ============================================
    // Data helpers
    // ============================================

    _getAngebote() {
        const { store } = window.AppUtils || {};
        return (store?.angebote || []).slice();
    }

    _mapToColumn(angebot) {
        const s = angebot.status || 'entwurf';
        if (s === 'entwurf') return 'entwurf';
        if (s === 'offen' || s === 'vorläufig_gesendet') return 'offen';
        if (s === 'angenommen') return 'abgeschlossen';
        if (s === 'abgelehnt') return 'abgeschlossen';
        if (s === 'verhandlung') return 'verhandlung';
        // Fallback: map based on lead stage if available
        return 'offen';
    }

    _isGewonnen(a) { return a.status === 'angenommen'; }
    _isVerloren(a) { return a.status === 'abgelehnt'; }

    _daysSince(dateStr) {
        if (!dateStr) return 0;
        const diff = Date.now() - new Date(dateStr).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    _esc(str) {
        return window.esc ? window.esc(String(str || '')) : String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    _formatCurrency(val) {
        const { formatCurrency } = window.AppUtils || {};
        if (formatCurrency) return formatCurrency(val);
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);
    }

    // ============================================
    // Main Render
    // ============================================

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const angebote = this._getAngebote();

        // Group angebote by column
        const groups = {};
        this.columns.forEach(c => { groups[c.id] = []; });
        angebote.forEach(a => {
            const col = this._mapToColumn(a);
            if (groups[col]) groups[col].push(a);
        });

        let html = '<div class="kanban-board" id="kanban-board">';

        this.columns.forEach(col => {
            const items = groups[col.id] || [];
            const totalValue = items.reduce((s, a) => s + (a.brutto || 0), 0);

            html += `<div class="kanban-column" data-column="${this._esc(col.id)}"
                          ondragover="window.pipelineKanbanUI._onColumnDragOver(event)"
                          ondragleave="window.pipelineKanbanUI._onColumnDragLeave(event)"
                          ondrop="window.pipelineKanbanUI._onColumnDrop(event, '${col.id}')">`;

            // Column header
            html += `<div class="kanban-column-header" style="border-top: 3px solid ${col.color}">
                        <span class="kanban-column-title">${this._esc(col.name)}</span>
                        <span class="kanban-column-count">${items.length}</span>
                     </div>`;

            // Cards
            html += '<div class="kanban-column-body">';
            items.forEach(a => {
                html += this._renderCard(a);
            });
            html += '</div>';

            // Column footer
            html += `<div class="kanban-column-footer">
                        <span>${items.length} Angebot${items.length !== 1 ? 'e' : ''}</span>
                        <span>${this._formatCurrency(totalValue)}</span>
                     </div>`;

            html += '</div>'; // close .kanban-column
        });

        html += '</div>'; // close .kanban-board

        // Summary bar
        const totalAll = angebote.reduce((s, a) => s + (a.brutto || 0), 0);
        html += `<div class="kanban-summary">
                    <span class="kanban-summary-label">Gesamt: ${angebote.length} Angebote</span>
                    <span class="kanban-summary-value">${this._formatCurrency(totalAll)}</span>
                 </div>`;

        container.innerHTML = html;
    }

    // ============================================
    // Card Rendering
    // ============================================

    _renderCard(angebot) {
        const age = this._daysSince(angebot.createdAt);
        const isOverdue = age > 14 && !this._isGewonnen(angebot) && !this._isVerloren(angebot);
        const gewonnen = this._isGewonnen(angebot);
        const verloren = this._isVerloren(angebot);

        let cardClass = 'kanban-card';
        if (gewonnen) cardClass += ' kanban-card-won';
        else if (verloren) cardClass += ' kanban-card-lost';
        else if (isOverdue) cardClass += ' kanban-card-overdue';

        const statusLabel = this._getStatusLabel(angebot.status);
        const statusClass = 'kanban-status-' + (angebot.status || 'entwurf');

        return `<div class="${cardClass}"
                     draggable="true"
                     role="button" tabindex="0"
                     aria-label="Angebot ${this._esc(angebot.kunde?.name || 'Unbekannt')} ${this._formatCurrency(angebot.brutto || 0)}"
                     data-angebot-id="${this._esc(angebot.id)}"
                     ondragstart="window.pipelineKanbanUI._onCardDragStart(event, '${this._esc(angebot.id)}')"
                     ondragend="window.pipelineKanbanUI._onCardDragEnd(event)"
                     onclick="window.pipelineKanbanUI._onCardClick('${this._esc(angebot.id)}')"
                     onkeydown="if(event.key==='Enter')window.pipelineKanbanUI._onCardClick('${this._esc(angebot.id)}')">
                    <div class="kanban-card-header">
                        <span class="kanban-card-name">${this._esc(angebot.kunde?.name || 'Unbekannt')}</span>
                        <span class="kanban-card-id">${this._esc(angebot.id)}</span>
                    </div>
                    <div class="kanban-card-body">
                        <span class="kanban-card-amount">${this._formatCurrency(angebot.brutto || 0)}</span>
                        <span class="kanban-card-age">${age} Tag${age !== 1 ? 'e' : ''}</span>
                    </div>
                    <div class="kanban-card-footer">
                        <span class="kanban-status-badge ${statusClass}">${this._esc(statusLabel)}</span>
                    </div>
                </div>`;
    }

    _getStatusLabel(status) {
        const map = {
            entwurf: 'Entwurf',
            offen: 'Offen',
            angenommen: 'Gewonnen',
            abgelehnt: 'Verloren',
            'vorläufig_gesendet': 'Vorl. gesendet',
            verhandlung: 'Verhandlung'
        };
        return map[status] || status || 'Unbekannt';
    }

    // ============================================
    // Drag & Drop
    // ============================================

    _onCardDragStart(e, angebotId) {
        this.dragState.dragging = angebotId;
        const card = e.target.closest('.kanban-card');
        if (card) {
            this.dragState.sourceColumn = card.closest('.kanban-column')?.dataset.column;
            card.classList.add('kanban-card-dragging');
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', angebotId);
        requestAnimationFrame(() => {
            if (card) card.style.opacity = '0.4';
        });
    }

    _onCardDragEnd(e) {
        const card = e.target.closest('.kanban-card');
        if (card) {
            card.classList.remove('kanban-card-dragging');
            card.style.opacity = '';
        }
        // Remove all column highlights
        document.querySelectorAll('.kanban-column-dragover').forEach(el => {
            el.classList.remove('kanban-column-dragover');
        });
        this.dragState.dragging = null;
        this.dragState.sourceColumn = null;
    }

    _onColumnDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const col = e.target.closest('.kanban-column');
        if (col) col.classList.add('kanban-column-dragover');
    }

    _onColumnDragLeave(e) {
        const col = e.target.closest('.kanban-column');
        if (col && !col.contains(e.relatedTarget)) {
            col.classList.remove('kanban-column-dragover');
        }
    }

    _onColumnDrop(e, targetColumnId) {
        e.preventDefault();
        const col = e.target.closest('.kanban-column');
        if (col) col.classList.remove('kanban-column-dragover');

        const angebotId = this.dragState.dragging;
        if (!angebotId) return;

        const sourceColumn = this.dragState.sourceColumn;
        if (sourceColumn === targetColumnId) return;

        // Map column back to status
        const newStatus = this._columnToStatus(targetColumnId);
        if (!newStatus) return;

        this._updateAngebotStatus(angebotId, newStatus);
    }

    _columnToStatus(columnId) {
        const map = {
            entwurf: 'entwurf',
            offen: 'offen',
            angebot: 'offen',
            verhandlung: 'offen' // no separate verhandlung status in data, keep as offen
        };
        // For abgeschlossen, we show a choice dialog
        if (columnId === 'abgeschlossen') return null; // handled separately
        return map[columnId] || 'offen';
    }

    _updateAngebotStatus(angebotId, newStatus) {
        const { store, saveStore, addActivity } = window.AppUtils || {};
        if (!store) return;

        const angebot = store.angebote.find(a => a.id === angebotId);
        if (!angebot) return;

        const oldStatus = angebot.status;
        angebot.status = newStatus;
        angebot.updatedAt = new Date().toISOString();

        if (saveStore) saveStore();
        if (addActivity) addActivity('📝', `Angebot ${angebotId}: Status ${oldStatus} -> ${newStatus}`);

        const { showToast } = window.AppUtils || {};
        if (showToast) showToast(`Angebot auf "${this._getStatusLabel(newStatus)}" verschoben`, 'success');

        // Re-render
        this.render('kanban-container');

        // Also update list view badges
        if (window.renderAngebote) window.renderAngebote();
    }

    // ============================================
    // Card Click -> Detail Modal
    // ============================================

    _onCardClick(angebotId) {
        if (window.showAngebotDetail) {
            window.showAngebotDetail(angebotId);
        }
    }

    // ============================================
    // Toggle Visibility
    // ============================================

    toggle() {
        this.visible = !this.visible;
        const listEl = document.getElementById('angebote-list');
        const kanbanEl = document.getElementById('kanban-container');
        const toggleBtn = document.getElementById('btn-pipeline-toggle');

        if (this.visible) {
            if (listEl) listEl.style.display = 'none';
            if (kanbanEl) {
                kanbanEl.style.display = 'block';
                this.render('kanban-container');
            }
            if (toggleBtn) {
                toggleBtn.textContent = 'Listenansicht';
                toggleBtn.title = 'Zur Listenansicht wechseln';
            }
        } else {
            if (listEl) listEl.style.display = '';
            if (kanbanEl) kanbanEl.style.display = 'none';
            if (toggleBtn) {
                toggleBtn.textContent = 'Pipeline';
                toggleBtn.title = 'Pipeline-Kanban anzeigen';
            }
        }
    }
}

// Global instance
window.pipelineKanbanUI = new PipelineKanbanUI();
