/* ============================================
   Purchase Order UI Module
   Handles all PO interface interactions
   ============================================ */
function _getTaxRate() { return window.companySettings?.getTaxRate?.() ?? 0.19; }

class PurchaseOrderUI {
    constructor() {
        this.currentPOId = null;
        this.currentPositions = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderPOList();
    }

    setupEventListeners() {
        // New PO button
        document.getElementById('btn-new-bestellung')?.addEventListener('click', () => this.openNewPOModal());

        // Auto PO from low stock
        document.getElementById('btn-auto-po-low-stock')?.addEventListener('click', () => this.autoGeneratePOsFromLowStock());

        // Demo data
        document.getElementById('btn-demo-po')?.addEventListener('click', () => this.loadDemoPOs());

        // Modal controls
        document.getElementById('btn-save-bestellung')?.addEventListener('click', () => this.savePO());
        document.getElementById('btn-cancel-po')?.addEventListener('click', () => this.cancelPO());
        document.getElementById('btn-record-delivery')?.addEventListener('click', () => this.recordDelivery());
        document.getElementById('btn-add-po-position')?.addEventListener('click', () => this.addPositionRow());

        // Filters
        document.getElementById('po-search')?.addEventListener('input', (e) => this.filterPOList(e.target.value));
        document.getElementById('po-status-filter')?.addEventListener('change', () => this.renderPOList());
        document.getElementById('po-supplier-filter')?.addEventListener('change', () => this.renderPOList());

        // Modal closes
        document.querySelectorAll('[data-action="close-modal-bestellung"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modal-bestellung'));
        });

        document.querySelectorAll('[data-action="close-modal-po-detail"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modal-po-detail'));
        });

        // Lieferdatum default to 7 days from now
        const lieferdatumInput = document.getElementById('po-lieferdatum');
        if (lieferdatumInput) {
            const future = new Date();
            future.setDate(future.getDate() + 7);
            lieferdatumInput.value = future.toISOString().split('T')[0];
        }
    }

    // ============================================
    // Modal Operations
    // ============================================

    openNewPOModal() {
        this.currentPOId = null;
        this.currentPositions = [];

        document.getElementById('modal-bestellung-title').textContent = 'Neue Bestellung';
        document.getElementById('po-nummer').value = `PO-${window.purchaseOrderService.generatePONummer()}`;
        document.getElementById('po-lieferant-name').value = '';
        document.getElementById('po-lieferant-email').value = '';
        document.getElementById('po-lieferant-telefon').value = '';
        document.getElementById('po-lieferant-ansprechpartner').value = '';
        document.getElementById('po-notizen').value = '';

        const future = new Date();
        future.setDate(future.getDate() + 7);
        document.getElementById('po-lieferdatum').value = future.toISOString().split('T')[0];

        this.currentPositions = [];
        this.renderPositionRows();
        this.addPositionRow(); // Add one empty row

        this.updatePOSummary();
        this.openModal('modal-bestellung');
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // ============================================
    // Position Management
    // ============================================

    addPositionRow() {
        this.currentPositions.push({
            materialId: '',
            bezeichnung: '',
            artikelnummer: '',
            menge: 1,
            einheit: 'Stk.',
            ekPreis: 0
        });
        this.renderPositionRows();
    }

    removePositionRow(index) {
        this.currentPositions.splice(index, 1);
        this.renderPositionRows();
    }

    renderPositionRows() {
        const container = document.getElementById('po-positions');
        if (!container) {return;}

        container.innerHTML = this.currentPositions.map((pos, index) => `
            <div class="po-position-row" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto; gap: 8px; margin-bottom: 8px; padding: 8px; background: var(--bg-secondary); border-radius: 4px; align-items: start;">
                <div>
                    <input type="text" placeholder="Bezeichnung" value="${pos.bezeichnung}"
                        onchange="window.poUI.updatePosition(${index}, 'bezeichnung', this.value)" style="width: 100%;">
                </div>
                <div>
                    <input type="text" placeholder="Art.Nr." value="${pos.artikelnummer}"
                        onchange="window.poUI.updatePosition(${index}, 'artikelnummer', this.value)" style="width: 100%;">
                </div>
                <div>
                    <input type="number" placeholder="Menge" value="${pos.menge}"
                        onchange="window.poUI.updatePosition(${index}, 'menge', this.value)"
                        style="width: 100%;" min="1">
                </div>
                <div>
                    <input type="text" placeholder="Einheit" value="${pos.einheit}"
                        onchange="window.poUI.updatePosition(${index}, 'einheit', this.value)"
                        style="width: 100%;">
                </div>
                <div>
                    <input type="number" placeholder="EK-Preis" value="${pos.ekPreis}"
                        onchange="window.poUI.updatePosition(${index}, 'ekPreis', this.value)"
                        style="width: 100%;" step="0.01" min="0">
                </div>
                <button type="button" class="btn btn-small btn-danger"
                    onclick="window.poUI.removePositionRow(${index})">🗑️</button>
            </div>
        `).join('');

        this.updatePOSummary();
    }

    updatePosition(index, field, value) {
        if (this.currentPositions[index]) {
            if (field === 'menge' || field === 'ekPreis') {
                this.currentPositions[index][field] = parseFloat(value) || 0;
            } else {
                this.currentPositions[index][field] = value;
            }
            this.renderPositionRows();
        }
    }

    // ============================================
    // PO Operations
    // ============================================

    savePO() {
        const supplierName = document.getElementById('po-lieferant-name').value.trim();
        const positions = this.currentPositions.filter(p => p.bezeichnung.trim());

        if (!supplierName) {
            alert('Bitte Lieferantennamen eingeben');
            return;
        }

        if (positions.length === 0) {
            alert('Bitte mindestens eine Position hinzufügen');
            return;
        }

        const supplier = {
            name: supplierName,
            email: document.getElementById('po-lieferant-email').value,
            telefon: document.getElementById('po-lieferant-telefon').value,
            ansprechpartner: document.getElementById('po-lieferant-ansprechpartner').value
        };

        const po = window.purchaseOrderService.createPO(supplier, positions, {
            lieferdatum_erwartet: document.getElementById('po-lieferdatum').value,
            notizen: document.getElementById('po-notizen').value
        });

        this.closeModal('modal-bestellung');
        this.renderPOList();
        this.updateStats();

        if (window.errorHandler) {
            window.errorHandler.success(`Bestellung ${po.nummer} erstellt`);
        }
    }

    cancelPO() {
        if (!this.currentPOId) {return;}

        if (!confirm('Möchten Sie diese Bestellung stornieren?')) {return;}

        window.purchaseOrderService.cancelPO(this.currentPOId);
        this.closeModal('modal-po-detail');
        this.renderPOList();
        this.updateStats();

        if (window.errorHandler) {
            window.errorHandler.success('Bestellung storniert');
        }
    }

    recordDelivery() {
        if (!this.currentPOId) {return;}

        const po = window.purchaseOrderService.getPO(this.currentPOId);
        if (!po) {return;}

        const items = [];
        po.positionen.forEach((pos, index) => {
            const input = document.querySelector(`input[data-delivery-${index}]`);
            if (input) {
                const receivedQty = parseFloat(input.value) || 0;
                if (receivedQty > 0) {
                    items.push({
                        materialId: pos.materialId,
                        receivedQty: receivedQty
                    });
                }
            }
        });

        if (items.length === 0) {
            alert('Bitte mindestens eine Menge eingeben');
            return;
        }

        window.purchaseOrderService.recordDelivery(this.currentPOId, items);

        this.closeModal('modal-po-detail');
        this.renderPOList();
        this.updateStats();

        if (window.errorHandler) {
            window.errorHandler.success('Wareneingang gebucht');
        }
    }

    // ============================================
    // Auto-generation
    // ============================================

    autoGeneratePOsFromLowStock() {
        const pos = window.purchaseOrderService.generatePOFromLowStock();

        if (pos.length === 0) {
            alert('Keine Materialien unter Mindestbestand');
            return;
        }

        this.renderPOList();
        this.updateStats();

        if (window.errorHandler) {
            window.errorHandler.success(`${pos.length} Bestellungen generiert`);
        }
    }

    loadDemoPOs() {
        window.purchaseOrderService.loadDemoData();
        this.renderPOList();
        this.updateStats();

        if (window.errorHandler) {
            window.errorHandler.success('Demo-Daten geladen');
        }
    }

    // ============================================
    // List Rendering
    // ============================================

    renderPOList() {
        const container = document.getElementById('po-list');
        if (!container) {return;}

        const statusFilter = document.getElementById('po-status-filter')?.value || '';
        const supplierFilter = document.getElementById('po-supplier-filter')?.value || '';
        const searchQuery = document.getElementById('po-search')?.value || '';

        let pos = window.purchaseOrderService.getAllPOs();

        // Apply filters
        if (statusFilter) {
            pos = pos.filter(p => p.status === statusFilter);
        }

        if (supplierFilter) {
            pos = pos.filter(p => p.lieferant.name === supplierFilter);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            pos = pos.filter(p =>
                p.nummer.toLowerCase().includes(q) ||
                p.lieferant.name.toLowerCase().includes(q)
            );
        }

        this.populateSupplierFilter();

        if (pos.length === 0) {
            container.innerHTML = '<p class="empty-state">Keine Bestellungen gefunden.</p>';
            return;
        }

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color); background: var(--bg-secondary);">
                        <th style="text-align: left; padding: 12px; font-weight: 600;">Nummer</th>
                        <th style="text-align: left; padding: 12px; font-weight: 600;">Lieferant</th>
                        <th style="text-align: center; padding: 12px; font-weight: 600;">Status</th>
                        <th style="text-align: right; padding: 12px; font-weight: 600;">Betrag</th>
                        <th style="text-align: center; padding: 12px; font-weight: 600;">Lieferdatum</th>
                        <th style="text-align: center; padding: 12px; font-weight: 600;">Aktionen</th>
                    </tr>
                </thead>
                <tbody>
                    ${pos.map(p => this.renderPORow(p)).join('')}
                </tbody>
            </table>
        `;
    }

    renderPORow(po) {
        const statusBadgeColor = this.getStatusColor(po.status);
        const statusLabel = this.getStatusLabel(po.status);
        const brutto = (po.brutto || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

        return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px; font-weight: 600;">${po.nummer}</td>
                <td style="padding: 12px;">${window.UI?.sanitize?.(po.lieferant.name) || po.lieferant.name}</td>
                <td style="padding: 12px; text-align: center;">
                    <span class="badge" style="background: ${statusBadgeColor};">${statusLabel}</span>
                </td>
                <td style="padding: 12px; text-align: right;">${brutto}</td>
                <td style="padding: 12px; text-align: center;">
                    ${po.lieferdatum_erwartet ? this.formatDate(po.lieferdatum_erwartet) : '-'}
                </td>
                <td style="padding: 12px; text-align: center;">
                    <button class="btn btn-small btn-secondary" onclick="window.poUI.openPODetail('${po.id}')">
                        👁️ Details
                    </button>
                </td>
            </tr>
        `;
    }

    openPODetail(poId) {
        const po = window.purchaseOrderService.getPO(poId);
        if (!po) {return;}

        this.currentPOId = poId;

        // Header
        document.getElementById('po-detail-nummer').textContent = `Bestellung ${po.nummer}`;
        document.getElementById('po-detail-status').innerHTML = `<span class="badge" style="background: ${this.getStatusColor(po.status)};">${this.getStatusLabel(po.status)}</span>`;
        document.getElementById('po-detail-bestelldatum').textContent = this.formatDate(po.bestelldatum);
        document.getElementById('po-detail-lieferdatum-erwartet').textContent = this.formatDate(po.lieferdatum_erwartet);

        // Supplier
        document.getElementById('po-detail-lieferant-name').textContent = po.lieferant.name;
        document.getElementById('po-detail-lieferant-email').textContent = po.lieferant.email || '-';
        document.getElementById('po-detail-lieferant-telefon').textContent = po.lieferant.telefon || '-';
        document.getElementById('po-detail-lieferant-ansprechpartner').textContent = po.lieferant.ansprechpartner || '-';

        // Positions
        const positionsHtml = po.positionen.map(pos => `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px;">${pos.bezeichnung}</td>
                <td style="padding: 8px; text-align: right;">${pos.menge} ${pos.einheit}</td>
                <td style="padding: 8px; text-align: right;">${(pos.ekPreis || 0).toFixed(2)} €</td>
                <td style="padding: 8px; text-align: right;">${pos.gelieferteMenge || 0} ${pos.einheit}</td>
                <td style="padding: 8px; text-align: right;">${(pos.gesamtpreis || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
            </tr>
        `).join('');

        document.getElementById('po-detail-positionen').innerHTML = positionsHtml;

        // Summary
        document.getElementById('po-detail-netto').textContent = (po.netto || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        document.getElementById('po-detail-mwst').textContent = (po.mwst || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        document.getElementById('po-detail-brutto').textContent = (po.brutto || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

        // Notizen
        document.getElementById('po-detail-notizen').textContent = po.notizen || '-';

        // Show/hide action buttons
        const isEditable = ['entwurf', 'bestellt', 'teillieferung'].includes(po.status);
        document.getElementById('btn-cancel-po').style.display = isEditable ? 'block' : 'none';
        document.getElementById('btn-record-delivery').style.display = isEditable ? 'block' : 'none';

        // Show/hide Wareneingang section
        const wareneingang = document.getElementById('po-wareneingang-section');
        if (isEditable) {
            wareneingang.style.display = 'block';
            this.renderWareneingangForm(po);
        } else {
            wareneingang.style.display = 'none';
        }

        this.openModal('modal-po-detail');
    }

    renderWareneingangForm(po) {
        const form = document.getElementById('po-wareneingang-form');
        if (!form) {return;}

        form.innerHTML = po.positionen.map((pos, index) => `
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; margin-bottom: 12px; align-items: center;">
                <div>
                    <label style="font-size: 14px;">${pos.bezeichnung}</label>
                    <span style="display: block; color: var(--text-muted); font-size: 12px;">
                        Bestellt: ${pos.menge} ${pos.einheit}, Geliefert: ${pos.gelieferteMenge || 0} ${pos.einheit}
                    </span>
                </div>
                <div>
                    <label style="font-size: 12px; color: var(--text-muted);">Anzahl</label>
                    <input type="number" data-delivery-${index} placeholder="0" step="1" min="0" style="width: 100%;">
                </div>
            </div>
        `).join('');
    }

    // ============================================
    // Helpers
    // ============================================

    updatePOSummary() {
        let netto = 0;
        this.currentPositions.forEach(pos => {
            netto += (pos.menge || 0) * (pos.ekPreis || 0);
        });

        const mwst = netto * _getTaxRate();
        const brutto = netto * (1 + _getTaxRate());

        document.getElementById('po-summary-netto').textContent = netto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        document.getElementById('po-summary-mwst').textContent = mwst.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        document.getElementById('po-summary-brutto').textContent = brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    }

    filterPOList(query) {
        this.renderPOList();
    }

    updateStats() {
        const allPos = window.purchaseOrderService.getAllPOs();
        const openValue = window.purchaseOrderService.getOpenPOValue();
        const expected = window.purchaseOrderService.getExpectedDeliveries();

        document.getElementById('po-count').textContent = allPos.length;
        document.getElementById('po-value-open').textContent = openValue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        document.getElementById('po-expected-soon').textContent = expected.length;

        // Update material badge if low stock
        const lowStockCount = window.materialService?.getLowStockItems().length || 0;
        const badge = document.getElementById('lowstock-badge');
        if (badge && lowStockCount > 0) {
            badge.textContent = lowStockCount;
            badge.style.display = 'inline-block';
        }
    }

    populateSupplierFilter() {
        const suppliers = window.purchaseOrderService.getAllSuppliers();
        const select = document.getElementById('po-supplier-filter');
        if (!select) {return;}

        const currentValue = select.value;
        select.innerHTML = '<option value="">Alle Lieferanten</option>' +
            suppliers.map(s => `<option value="${(window.UI?.sanitize || String)(s.name)}">${(window.UI?.sanitize || String)(s.name)}</option>`).join('');
        select.value = currentValue;
    }

    getStatusColor(status) {
        const colors = {
            'entwurf': '#6b7280',
            'bestellt': '#3b82f6',
            'teillieferung': '#f59e0b',
            'geliefert': '#10b981',
            'storniert': '#ef4444'
        };
        return colors[status] || '#6b7280';
    }

    getStatusLabel(status) {
        const labels = {
            'entwurf': 'Entwurf',
            'bestellt': 'Bestellt',
            'teillieferung': 'Teillieferung',
            'geliefert': 'Geliefert',
            'storniert': 'Storniert'
        };
        return labels[status] || status;
    }

    formatDate(dateStr) {
        if (!dateStr) {return '-';}
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('de-DE');
        } catch (e) {
            return dateStr;
        }
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    if (!window.poUI) {
        window.poUI = new PurchaseOrderUI();
    }
});
