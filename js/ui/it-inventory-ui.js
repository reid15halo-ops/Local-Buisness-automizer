/* ============================================
   Home IT Inventory UI
   Renders the home IT component inventory view
   ============================================ */

class ITInventoryUI {
    constructor() {
        this._activeFilter = { category: '', status: '', query: '' };
        this._editingId = null;
    }

    // ── Entry point ─────────────────────────────────

    render() {
        const container = document.getElementById('it-inventory-container');
        if (!container) return;
        const svc = window.itInventoryService;
        if (!svc) { container.innerHTML = '<p class="empty-state">Service nicht geladen.</p>'; return; }

        const summary = svc.getSummary();
        const alerts  = svc.getWarrantyAlerts();
        const devices = svc.getAll(this._activeFilter);

        container.innerHTML = `
            ${this._renderSummaryCards(summary)}
            ${alerts.length ? this._renderWarrantyAlerts(alerts) : ''}
            ${this._renderToolbar(summary)}
            ${this._renderDeviceGrid(devices, svc)}
            ${this._renderModal()}
        `;

        this._bindEvents();
    }

    // ── Summary cards ───────────────────────────────

    _renderSummaryCards(s) {
        const fmt = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        return `
        <div class="it-summary-cards">
            <div class="it-stat-card">
                <div class="it-stat-icon">🖥️</div>
                <div class="it-stat-body">
                    <div class="it-stat-value">${s.total}</div>
                    <div class="it-stat-label">Geräte gesamt</div>
                </div>
            </div>
            <div class="it-stat-card it-stat-green">
                <div class="it-stat-icon">✅</div>
                <div class="it-stat-body">
                    <div class="it-stat-value">${s.active}</div>
                    <div class="it-stat-label">Aktiv</div>
                </div>
            </div>
            <div class="it-stat-card it-stat-blue">
                <div class="it-stat-icon">💶</div>
                <div class="it-stat-body">
                    <div class="it-stat-value">${fmt(s.totalValue)}</div>
                    <div class="it-stat-label">Gesamtwert</div>
                </div>
            </div>
            <div class="it-stat-card ${s.warrantyExpiringSoon ? 'it-stat-orange' : ''}">
                <div class="it-stat-icon">🛡️</div>
                <div class="it-stat-body">
                    <div class="it-stat-value">${s.warrantyExpiringSoon}</div>
                    <div class="it-stat-label">Garantie läuft ab (90 Tage)</div>
                </div>
            </div>
        </div>
        ${this._renderCategoryBreakdown(s.byCategory)}`;
    }

    _renderCategoryBreakdown(byCategory) {
        const svc = window.itInventoryService;
        const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
        if (!entries.length) return '';
        return `
        <div class="it-category-bar">
            ${entries.map(([cat, count]) => `
                <button class="it-cat-chip ${this._activeFilter.category === cat ? 'active' : ''}"
                        data-cat="${cat}" title="${svc.getCategoryLabel(cat)}">
                    ${svc.getCategoryIcon(cat)} ${svc.getCategoryLabel(cat)}
                    <span class="it-cat-count">${count}</span>
                </button>
            `).join('')}
        </div>`;
    }

    // ── Warranty alerts ─────────────────────────────

    _renderWarrantyAlerts(alerts) {
        return `
        <div class="it-alert-box">
            <strong>⚠️ Garantie läuft bald ab:</strong>
            ${alerts.map(d => {
                const days = Math.ceil((new Date(d.warrantyExpiry) - new Date()) / 86400000);
                return `<span class="it-alert-chip">${d.name} — noch ${days} Tag${days !== 1 ? 'e' : ''}</span>`;
            }).join('')}
        </div>`;
    }

    // ── Toolbar ─────────────────────────────────────

    _renderToolbar(summary) {
        return `
        <div class="it-toolbar">
            <div class="it-toolbar-left">
                <input type="text" id="it-search" class="it-search" placeholder="Gerät suchen…" value="${this._activeFilter.query}">
                <select id="it-filter-status" class="it-select">
                    <option value="">Alle Status</option>
                    <option value="active" ${this._activeFilter.status === 'active' ? 'selected' : ''}>Aktiv</option>
                    <option value="inactive" ${this._activeFilter.status === 'inactive' ? 'selected' : ''}>Inaktiv</option>
                    <option value="repair" ${this._activeFilter.status === 'repair' ? 'selected' : ''}>In Reparatur</option>
                    <option value="retired" ${this._activeFilter.status === 'retired' ? 'selected' : ''}>Ausgemustert</option>
                </select>
                ${this._activeFilter.category ? `<button class="it-clear-filter" id="it-clear-cat">✕ ${window.itInventoryService.getCategoryLabel(this._activeFilter.category)}</button>` : ''}
            </div>
            <button class="btn btn-primary" id="it-add-device">+ Gerät hinzufügen</button>
        </div>`;
    }

    // ── Device grid ─────────────────────────────────

    _renderDeviceGrid(devices, svc) {
        if (!devices.length) {
            return `<div class="it-empty">
                <div style="font-size:48px;margin-bottom:12px;">🖥️</div>
                <p>Keine Geräte gefunden.</p>
                <button class="btn btn-primary" id="it-add-device-empty">+ Erstes Gerät hinzufügen</button>
            </div>`;
        }
        return `
        <div class="it-device-grid">
            ${devices.map(d => this._renderDeviceCard(d, svc)).join('')}
        </div>`;
    }

    _renderDeviceCard(d, svc) {
        const today = new Date().toISOString().split('T')[0];
        const warrantyOk = d.warrantyExpiry && d.warrantyExpiry >= today;
        const warrantyLabel = d.warrantyExpiry
            ? (warrantyOk ? `Garantie bis ${this._formatDate(d.warrantyExpiry)}` : 'Garantie abgelaufen')
            : 'Keine Garantiedaten';
        const statusColor = svc.getStatusColor(d.status);

        return `
        <div class="it-device-card" data-id="${d.id}">
            <div class="it-device-header">
                <span class="it-device-icon">${svc.getCategoryIcon(d.category)}</span>
                <div class="it-device-meta">
                    <div class="it-device-name">${this._esc(d.name)}</div>
                    <div class="it-device-sub">${this._esc(d.brand)} ${this._esc(d.model)}</div>
                </div>
                <span class="it-status-badge it-status-${statusColor}">${svc.getStatusLabel(d.status)}</span>
            </div>
            <div class="it-device-details">
                ${d.location ? `<div class="it-detail-row"><span>📍</span><span>${this._esc(d.location)}</span></div>` : ''}
                ${d.ipAddress ? `<div class="it-detail-row"><span>🌐</span><span>${this._esc(d.ipAddress)}</span></div>` : ''}
                ${d.purchaseDate ? `<div class="it-detail-row"><span>🛒</span><span>Gekauft ${this._formatDate(d.purchaseDate)}${d.purchasePrice ? ' · ' + d.purchasePrice.toLocaleString('de-DE', {style:'currency',currency:'EUR'}) : ''}</span></div>` : ''}
                <div class="it-detail-row"><span>${warrantyOk ? '🛡️' : '⚠️'}</span><span class="${warrantyOk ? '' : 'it-warn-text'}">${warrantyLabel}</span></div>
                ${d.osVersion ? `<div class="it-detail-row"><span>💿</span><span>${this._esc(d.osVersion)}</span></div>` : ''}
                ${d.notes ? `<div class="it-detail-row it-notes"><span>📝</span><span>${this._esc(d.notes)}</span></div>` : ''}
            </div>
            <div class="it-device-actions">
                <button class="btn btn-small btn-secondary it-edit-btn" data-id="${d.id}">✏️ Bearbeiten</button>
                <button class="btn btn-small btn-danger it-delete-btn" data-id="${d.id}">🗑️ Löschen</button>
            </div>
        </div>`;
    }

    // ── Modal (add / edit) ──────────────────────────

    _renderModal() {
        return `
        <div id="it-modal" class="it-modal-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="it-modal-title">
            <div class="it-modal-box">
                <div class="it-modal-header">
                    <h2 id="it-modal-title">Gerät hinzufügen</h2>
                    <button id="it-modal-close" class="it-modal-close" aria-label="Schließen">✕</button>
                </div>
                <form id="it-device-form" class="it-form" novalidate>
                    <input type="hidden" id="it-form-id">
                    <div class="it-form-grid">
                        <div class="it-form-group it-span2">
                            <label for="it-form-name">Gerätename *</label>
                            <input type="text" id="it-form-name" required placeholder="z.B. FritzBox 7590">
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-category">Kategorie</label>
                            <select id="it-form-category">
                                <option value="computer">🖥️ Desktop PC</option>
                                <option value="laptop">💻 Laptop</option>
                                <option value="phone">📱 Smartphone</option>
                                <option value="tablet">📱 Tablet</option>
                                <option value="router">📡 Router / Netzwerk</option>
                                <option value="switch">🔌 Switch / Hub</option>
                                <option value="nas">🗄️ NAS / Server</option>
                                <option value="smart-home">🏠 Smart Home</option>
                                <option value="gaming">🎮 Gaming</option>
                                <option value="printer">🖨️ Drucker</option>
                                <option value="monitor">🖥️ Monitor</option>
                                <option value="other">🔧 Sonstiges</option>
                            </select>
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-status">Status</label>
                            <select id="it-form-status">
                                <option value="active">Aktiv</option>
                                <option value="inactive">Inaktiv</option>
                                <option value="repair">In Reparatur</option>
                                <option value="retired">Ausgemustert</option>
                            </select>
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-brand">Hersteller</label>
                            <input type="text" id="it-form-brand" placeholder="z.B. Apple">
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-model">Modell</label>
                            <input type="text" id="it-form-model" placeholder="z.B. MacBook Pro 14">
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-location">Standort</label>
                            <input type="text" id="it-form-location" placeholder="z.B. Büro, Wohnzimmer">
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-serial">Seriennummer</label>
                            <input type="text" id="it-form-serial" placeholder="">
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-ip">IP-Adresse</label>
                            <input type="text" id="it-form-ip" placeholder="z.B. 192.168.1.10">
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-os">OS / Firmware</label>
                            <input type="text" id="it-form-os" placeholder="z.B. macOS 14">
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-purchase-date">Kaufdatum</label>
                            <input type="date" id="it-form-purchase-date">
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-price">Kaufpreis (€)</label>
                            <input type="number" id="it-form-price" min="0" step="0.01" placeholder="0.00">
                        </div>
                        <div class="it-form-group">
                            <label for="it-form-warranty">Garantie (Monate)</label>
                            <input type="number" id="it-form-warranty" min="0" value="24">
                        </div>
                        <div class="it-form-group it-span2">
                            <label for="it-form-notes">Notizen</label>
                            <textarea id="it-form-notes" rows="2" placeholder="Weitere Informationen…"></textarea>
                        </div>
                    </div>
                    <div class="it-modal-footer">
                        <button type="button" id="it-modal-cancel" class="btn btn-secondary">Abbrechen</button>
                        <button type="submit" class="btn btn-primary" id="it-modal-save">Speichern</button>
                    </div>
                </form>
            </div>
        </div>`;
    }

    // ── Events ──────────────────────────────────────

    _bindEvents() {
        const container = document.getElementById('it-inventory-container');
        if (!container) return;

        // Search
        const searchEl = container.querySelector('#it-search');
        if (searchEl) {
            searchEl.addEventListener('input', (e) => {
                this._activeFilter.query = e.target.value;
                this.render();
            });
        }

        // Status filter
        const statusEl = container.querySelector('#it-filter-status');
        if (statusEl) {
            statusEl.addEventListener('change', (e) => {
                this._activeFilter.status = e.target.value;
                this.render();
            });
        }

        // Category chips
        container.querySelectorAll('.it-cat-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.cat;
                this._activeFilter.category = this._activeFilter.category === cat ? '' : cat;
                this.render();
            });
        });

        // Clear category filter
        const clearCat = container.querySelector('#it-clear-cat');
        if (clearCat) clearCat.addEventListener('click', () => { this._activeFilter.category = ''; this.render(); });

        // Add device buttons
        ['it-add-device', 'it-add-device-empty'].forEach(id => {
            const el = container.querySelector(`#${id}`);
            if (el) el.addEventListener('click', () => this._openModal());
        });

        // Edit buttons
        container.querySelectorAll('.it-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => this._openModal(btn.dataset.id));
        });

        // Delete buttons
        container.querySelectorAll('.it-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => this._confirmDelete(btn.dataset.id));
        });

        // Modal close
        const overlay  = container.querySelector('#it-modal');
        const closeBtn = container.querySelector('#it-modal-close');
        const cancelBtn= container.querySelector('#it-modal-cancel');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closeModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this._closeModal());
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) this._closeModal(); });

        // Form submit
        const form = container.querySelector('#it-device-form');
        if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this._saveDevice(); });
    }

    _openModal(id = null) {
        const container = document.getElementById('it-inventory-container');
        if (!container) return;
        const modal = container.querySelector('#it-modal');
        const title = container.querySelector('#it-modal-title');
        if (!modal) return;

        this._editingId = id;

        if (id) {
            const device = window.itInventoryService.getById(id);
            if (!device) return;
            title.textContent = 'Gerät bearbeiten';
            this._fillForm(device);
        } else {
            title.textContent = 'Gerät hinzufügen';
            container.querySelector('#it-device-form').reset();
            container.querySelector('#it-form-id').value = '';
            container.querySelector('#it-form-warranty').value = '24';
        }

        modal.style.display = 'flex';
        container.querySelector('#it-form-name').focus();
    }

    _fillForm(d) {
        const g = (id) => document.querySelector(`#it-inventory-container #${id}`);
        g('it-form-id').value           = d.id;
        g('it-form-name').value         = d.name;
        g('it-form-category').value     = d.category;
        g('it-form-status').value       = d.status;
        g('it-form-brand').value        = d.brand || '';
        g('it-form-model').value        = d.model || '';
        g('it-form-location').value     = d.location || '';
        g('it-form-serial').value       = d.serialNumber || '';
        g('it-form-ip').value           = d.ipAddress || '';
        g('it-form-os').value           = d.osVersion || '';
        g('it-form-purchase-date').value= d.purchaseDate || '';
        g('it-form-price').value        = d.purchasePrice || '';
        g('it-form-warranty').value     = d.warrantyMonths || 24;
        g('it-form-notes').value        = d.notes || '';
    }

    _closeModal() {
        const modal = document.querySelector('#it-inventory-container #it-modal');
        if (modal) modal.style.display = 'none';
        this._editingId = null;
    }

    _saveDevice() {
        const g = (id) => document.querySelector(`#it-inventory-container #${id}`);
        const name = (g('it-form-name').value || '').trim();
        if (!name) { g('it-form-name').focus(); return; }

        const data = {
            name,
            category:     g('it-form-category').value,
            status:       g('it-form-status').value,
            brand:        g('it-form-brand').value.trim(),
            model:        g('it-form-model').value.trim(),
            location:     g('it-form-location').value.trim(),
            serialNumber: g('it-form-serial').value.trim(),
            ipAddress:    g('it-form-ip').value.trim(),
            osVersion:    g('it-form-os').value.trim(),
            purchaseDate: g('it-form-purchase-date').value,
            purchasePrice:parseFloat(g('it-form-price').value) || 0,
            warrantyMonths: parseInt(g('it-form-warranty').value) || 24,
            notes:        g('it-form-notes').value.trim()
        };

        if (this._editingId) {
            window.itInventoryService.update(this._editingId, data);
        } else {
            window.itInventoryService.add(data);
        }

        this._closeModal();
        this.render();
    }

    _confirmDelete(id) {
        const device = window.itInventoryService.getById(id);
        if (!device) return;
        if (confirm(`Gerät "${device.name}" wirklich löschen?`)) {
            window.itInventoryService.remove(id);
            this.render();
        }
    }

    // ── Helpers ─────────────────────────────────────

    _esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _formatDate(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${d}.${m}.${y}`;
    }
}

window.itInventoryUI = new ITInventoryUI();
