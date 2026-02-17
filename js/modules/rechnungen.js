/* ============================================
   Rechnungen Module
   Rechnungen (invoices) CRUD and UI
   ============================================ */

const { store, saveStore, addActivity, formatDate, formatCurrency, getLeistungsartLabel, openModal, closeModal } = window.AppUtils;

function renderRechnungen() {
    const container = document.getElementById('rechnungen-list');
    if (!container) {return;}
    const rechnungen = store?.rechnungen || [];

    if (rechnungen.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 60px 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">💰</div>
                <h3 style="margin-bottom: 8px;">Keine Rechnungen vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Rechnungen werden automatisch aus abgeschlossenen Aufträgen erstellt.
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = rechnungen.map(r => {
        const statusClass = r.status === 'bezahlt' ? 'status-bezahlt' : 'status-offen';
        const statusIcon = r.status === 'bezahlt' ? '✅' : '⏳';

        return `
            <div class="item-card" onclick="showRechnung('${r.id}')" style="cursor:pointer;">
                <div class="item-header">
                    <h3 class="item-title">${window.UI.sanitize(r.kunde.name)}</h3>
                    <span class="item-id">${r.id}</span>
                </div>
                <div class="item-meta">
                    <span>${statusIcon} ${r.status === 'bezahlt' ? 'Bezahlt' : 'Offen'}</span>
                    <span>💰 ${formatCurrency(r.brutto || 0)}</span>
                    <span>📅 ${formatDate(r.createdAt)}</span>
                </div>
                <p class="item-description">${getLeistungsartLabel(r.leistungsart)}</p>
                <div class="item-actions">
                    <span class="status-badge ${statusClass}">● ${r.status === 'bezahlt' ? 'Bezahlt' : 'Offen'}</span>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); downloadInvoicePDF('${r.id}')">
                        📄 PDF
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function showRechnung(rechnungId) {
    const rechnung = store.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) {return;}

    store.currentRechnungId = rechnungId;

    const modal = document.getElementById('modal-rechnung');
    if (!modal) {return;}

    const statusHTML = rechnung.status === 'bezahlt'
        ? `<span class="status-badge" style="background:#22c55e;">✅ Bezahlt am ${formatDate(rechnung.paidAt)}</span>`
        : `<span class="status-badge" style="background:#ef4444;">⏳ Ausstehend</span>`;

    modal.querySelector('.modal-content').innerHTML = `
        <div style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>${rechnung.id}</h2>
                <button class="modal-close">×</button>
            </div>

            <div style="margin-bottom: 20px;">
                <strong>Kunde:</strong> ${window.UI.sanitize(rechnung.kunde.name)}<br>
                <strong>Leistungsart:</strong> ${getLeistungsartLabel(rechnung.leistungsart)}<br>
                <strong>Status:</strong> ${statusHTML}
            </div>

            <div style="margin-bottom: 20px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Netto:</span>
                    <strong>${formatCurrency(rechnung.netto || 0)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>MwSt (19%):</span>
                    <strong>${formatCurrency(rechnung.mwst || 0)}</strong>
                </div>
                <hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-size: 16px; font-weight: bold;">Gesamt:</span>
                    <strong style="font-size: 16px;">${formatCurrency(rechnung.brutto || 0)}</strong>
                </div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 20px;">
                <button class="btn btn-secondary" onclick="downloadInvoicePDF('${rechnung.id}')">
                    📄 PDF herunterladen
                </button>
                ${rechnung.status === 'offen' ? `
                    <button class="btn btn-success" id="btn-mark-paid">
                        ✓ Als bezahlt markieren
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    if (rechnung.status === 'offen') {
        const markPaidBtn = modal.querySelector('#btn-mark-paid');
        if (markPaidBtn) {
            markPaidBtn.addEventListener('click', () => {
                // Show confirmation dialog
                window.confirmDialogService?.confirmMarkAsPaid(
                    rechnung.id,
                    rechnung.brutto || 0,
                    () => {
                        // Confirmed - mark as paid
                        rechnung.status = 'bezahlt';
                        rechnung.paidAt = new Date().toISOString();
                        saveStore();
                        addActivity('✅', `Rechnung ${rechnung.id} als bezahlt markiert`);
                        closeModal('modal-rechnung');
                        renderRechnungen();
                        window.DashboardModule?.updateDashboard?.();
                    }
                );
            });
        }
    }

    openModal('modal-rechnung');
}

function initRechnungActions() {
    // Initialize any event listeners for invoice actions
    // Implementation details would go here
}

// Export rechnungen functions
window.RechnungenModule = {
    renderRechnungen,
    showRechnung,
    initRechnungActions
};

// Make globally available
window.renderRechnungen = renderRechnungen;
window.showRechnung = showRechnung;
