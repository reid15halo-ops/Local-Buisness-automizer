/* ============================================
   Rechnungen Module
   Rechnungen (invoices) CRUD and UI
   ============================================ */

const { store, saveStore, addActivity, generateId, formatDate, formatCurrency, getLeistungsartLabel, openModal, closeModal, showToast } = window.AppUtils;

/**
 * Determine the effective display status of an invoice.
 * An 'offen' invoice whose due date has passed is considered 'ueberfaellig'.
 */
function getEffectiveStatus(rechnung) {
    if (rechnung.status === 'storniert') return 'storniert';
    if (rechnung.status === 'bezahlt') return 'bezahlt';
    // Check overdue: offen + past due date
    if (rechnung.status === 'offen' && rechnung.faelligkeitsdatum) {
        const dueDate = new Date(rechnung.faelligkeitsdatum);
        if (dueDate < new Date()) {
            return 'ueberfaellig';
        }
    }
    return 'offen';
}

/**
 * Get the left border color for a card based on status.
 */
function getStatusBorderColor(effectiveStatus) {
    switch (effectiveStatus) {
        case 'bezahlt':    return '#22c55e'; // green
        case 'offen':      return '#f59e0b'; // orange
        case 'ueberfaellig': return '#ef4444'; // red
        case 'storniert':  return '#9ca3af'; // gray
        default:           return '#f59e0b';
    }
}

/**
 * Get the status icon for display.
 */
function getStatusIcon(effectiveStatus) {
    switch (effectiveStatus) {
        case 'bezahlt':      return '\u2705'; // checkmark
        case 'offen':        return '\u23F3'; // hourglass
        case 'ueberfaellig': return '\u26A0\uFE0F'; // warning
        case 'storniert':    return '\u274C'; // X
        default:             return '\u23F3';
    }
}

/**
 * Get the status label for display.
 */
function getStatusLabel(effectiveStatus) {
    switch (effectiveStatus) {
        case 'bezahlt':      return 'Bezahlt';
        case 'offen':        return 'Offen';
        case 'ueberfaellig': return '\u00DCberf\u00E4llig';
        case 'storniert':    return 'Storniert';
        default:             return 'Offen';
    }
}

/**
 * Get the CSS class for the status badge.
 */
function getStatusBadgeClass(effectiveStatus) {
    switch (effectiveStatus) {
        case 'bezahlt':      return 'status-bezahlt';
        case 'offen':        return 'status-offen';
        case 'ueberfaellig': return 'status-ueberfaellig';
        case 'storniert':    return 'status-storniert';
        default:             return 'status-offen';
    }
}

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
        const effectiveStatus = getEffectiveStatus(r);
        const borderColor = getStatusBorderColor(effectiveStatus);
        const statusIcon = getStatusIcon(effectiveStatus);
        const statusLabel = getStatusLabel(effectiveStatus);
        const statusBadgeClass = getStatusBadgeClass(effectiveStatus);
        const isStorniert = effectiveStatus === 'storniert';
        const textStyle = isStorniert ? 'text-decoration: line-through; opacity: 0.6;' : '';
        const korrekturHint = r.korrekturVon
            ? `<span style="font-size: 11px; color: var(--text-secondary); margin-left: 6px;">(Korrektur von ${window.UI.sanitize(r.korrekturVon)})</span>`
            : '';

        // Action buttons: Stornieren and Korrektur only for 'offen' (or ueberfaellig which is still technically offen)
        const canCancel = r.status === 'offen';
        const canCorrect = r.status === 'offen';

        const cancelBtn = canCancel
            ? `<button class="btn btn-danger btn-small" onclick="event.stopPropagation(); cancelRechnung('${r.id}')" title="Rechnung stornieren">
                    ❌ Stornieren
                </button>`
            : '';

        const correctBtn = canCorrect
            ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); duplicateRechnung('${r.id}')" title="Korrekturrechnung erstellen">
                    📝 Korrektur
                </button>`
            : '';

        return `
            <div class="item-card" onclick="showRechnung('${r.id}')" style="cursor:pointer; border-left: 4px solid ${borderColor};">
                <div class="item-header">
                    <h3 class="item-title" style="${textStyle}">${window.UI.sanitize(r.kunde.name)}</h3>
                    <span class="item-id">${window.UI.sanitize(r.id)}${korrekturHint}</span>
                </div>
                <div class="item-meta">
                    <span>${statusIcon} ${statusLabel}</span>
                    <span>💰 ${formatCurrency(r.brutto || 0)}</span>
                    <span>📅 ${formatDate(r.createdAt)}</span>
                    ${r.faelligkeitsdatum ? `<span>⏰ Fällig: ${formatDate(r.faelligkeitsdatum)}</span>` : ''}
                </div>
                <p class="item-description" style="${textStyle}">${getLeistungsartLabel(r.leistungsart)}</p>
                <div class="item-actions">
                    <span class="status-badge ${statusBadgeClass}">● ${statusLabel}</span>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); downloadInvoicePDF('${r.id}')" title="PDF herunterladen">
                        📄 PDF
                    </button>
                    ${cancelBtn}
                    ${correctBtn}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Cancel (stornieren) an invoice.
 * Uses confirmDialogService for confirmation, then invoiceService or manual fallback.
 */
function cancelRechnung(rechnungId) {
    const rechnung = store.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) {return;}

    const doCancel = async () => {
        try {
            if (window.invoiceService?.cancelInvoice) {
                await window.invoiceService.cancelInvoice(rechnungId);
            } else {
                // Manual fallback
                rechnung.status = 'storniert';
                rechnung.cancelledAt = new Date().toISOString();
                saveStore();
                addActivity('❌', `Rechnung ${rechnung.id} storniert`);
            }
            closeModal('modal-rechnung');
            renderRechnungen();
            window.DashboardModule?.updateDashboard?.();
            showToast('Rechnung storniert', 'info');
        } catch (error) {
            console.error('Cancel invoice error:', error);
            showToast('Fehler beim Stornieren: ' + error.message, 'error');
        }
    };

    if (window.confirmDialogService?.confirmCancelRechnung) {
        window.confirmDialogService.confirmCancelRechnung(
            rechnungId,
            rechnung.brutto || 0,
            doCancel
        );
    } else if (window.confirmDialogService?.showConfirmDialog) {
        window.confirmDialogService.showConfirmDialog({
            title: 'Rechnung stornieren?',
            message: `Rechnung ${window.UI.sanitize(rechnungId)} wirklich stornieren? Dies kann nicht rückgängig gemacht werden.`,
            confirmText: 'Ja, stornieren',
            destructive: true,
            onConfirm: doCancel
        });
    } else {
        // Absolute fallback: native confirm
        if (confirm(`Rechnung ${rechnungId} wirklich stornieren? Dies kann nicht rückgängig gemacht werden.`)) {
            doCancel();
        }
    }
}

/**
 * Duplicate (Korrektur) an invoice.
 * Creates a copy of the original invoice with a new ID and links it back.
 * The original stays as-is for GoBD compliance.
 */
function duplicateRechnung(rechnungId) {
    const original = store.rechnungen.find(r => r.id === rechnungId);
    if (!original) {return;}

    const newId = generateId('RE');

    const korrektur = {
        ...JSON.parse(JSON.stringify(original)), // deep copy
        id: newId,
        status: 'offen',
        korrekturVon: rechnungId,
        createdAt: new Date().toISOString(),
        datum: new Date().toISOString(),
        paidAt: null,
        cancelledAt: null,
        cancellationReason: null,
        pdfGenerated: false,
        eInvoiceGenerated: false
    };

    // Recalculate due date (14 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    korrektur.faelligkeitsdatum = dueDate.toISOString();

    store.rechnungen.push(korrektur);
    saveStore();
    addActivity('📝', `Korrekturrechnung ${newId} erstellt (Original: ${rechnungId})`);
    renderRechnungen();
    window.DashboardModule?.updateDashboard?.();
    showToast('Korrekturrechnung erstellt', 'success');
}

function showRechnung(rechnungId) {
    const rechnung = store.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) {return;}

    store.currentRechnungId = rechnungId;

    const modal = document.getElementById('modal-rechnung');
    if (!modal) {return;}

    const effectiveStatus = getEffectiveStatus(rechnung);

    // Build status HTML for modal
    let statusHTML;
    switch (effectiveStatus) {
        case 'bezahlt':
            statusHTML = `<span class="status-badge" style="background:#22c55e;">✅ Bezahlt am ${formatDate(rechnung.paidAt)}</span>`;
            break;
        case 'storniert':
            statusHTML = `<span class="status-badge" style="background:#9ca3af;">❌ Storniert am ${formatDate(rechnung.cancelledAt)}</span>`;
            break;
        case 'ueberfaellig':
            statusHTML = `<span class="status-badge" style="background:#ef4444;">⚠️ Überfällig (fällig ${formatDate(rechnung.faelligkeitsdatum)})</span>`;
            break;
        default:
            statusHTML = `<span class="status-badge" style="background:#f59e0b;">⏳ Ausstehend</span>`;
            break;
    }

    const korrekturInfo = rechnung.korrekturVon
        ? `<br><strong>Korrektur von:</strong> ${window.UI.sanitize(rechnung.korrekturVon)}`
        : '';

    const isStorniert = effectiveStatus === 'storniert';
    const textStyle = isStorniert ? 'text-decoration: line-through; opacity: 0.6;' : '';

    // Action buttons for modal
    const canAct = rechnung.status === 'offen'; // only offen invoices can be acted on

    const markPaidBtn = canAct
        ? `<button class="btn btn-success" id="btn-mark-paid">✓ Als bezahlt markieren</button>`
        : '';

    const cancelBtn = canAct
        ? `<button class="btn btn-danger" id="btn-cancel-rechnung">❌ Stornieren</button>`
        : '';

    const correctBtn = canAct
        ? `<button class="btn btn-secondary" id="btn-korrektur-rechnung">📝 Korrektur</button>`
        : '';

    modal.querySelector('.modal-content').innerHTML = `
        <div style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="${textStyle}">${window.UI.sanitize(rechnung.id)}</h2>
                <button class="modal-close">×</button>
            </div>

            <div style="margin-bottom: 20px;">
                <strong>Kunde:</strong> <span style="${textStyle}">${window.UI.sanitize(rechnung.kunde.name)}</span><br>
                <strong>Leistungsart:</strong> <span style="${textStyle}">${getLeistungsartLabel(rechnung.leistungsart)}</span><br>
                <strong>Status:</strong> ${statusHTML}
                ${korrekturInfo}
            </div>

            <div style="margin-bottom: 20px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; ${textStyle}">
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

            <div style="display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap;">
                <button class="btn btn-secondary" id="btn-download-pdf">
                    📄 PDF herunterladen
                </button>
                ${markPaidBtn}
                ${cancelBtn}
                ${correctBtn}
            </div>
        </div>
    `;

    // --- Attach event listeners ---

    // PDF download with toast
    const pdfBtn = modal.querySelector('#btn-download-pdf');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            showToast('PDF wird erstellt...', 'info');
            downloadInvoicePDF(rechnung.id);
        });
    }

    // Mark as paid
    if (canAct) {
        const markPaidBtnEl = modal.querySelector('#btn-mark-paid');
        if (markPaidBtnEl) {
            markPaidBtnEl.addEventListener('click', () => {
                window.confirmDialogService?.confirmMarkAsPaid(
                    rechnung.id,
                    rechnung.brutto || 0,
                    () => {
                        rechnung.status = 'bezahlt';
                        rechnung.paidAt = new Date().toISOString();
                        saveStore();
                        addActivity('✅', `Rechnung ${rechnung.id} als bezahlt markiert`);
                        closeModal('modal-rechnung');
                        renderRechnungen();
                        window.DashboardModule?.updateDashboard?.();
                        showToast('Rechnung als bezahlt markiert \u2713', 'success');
                    }
                );
            });
        }

        // Cancel from modal
        const cancelBtnEl = modal.querySelector('#btn-cancel-rechnung');
        if (cancelBtnEl) {
            cancelBtnEl.addEventListener('click', () => {
                cancelRechnung(rechnung.id);
            });
        }

        // Korrektur from modal
        const correctBtnEl = modal.querySelector('#btn-korrektur-rechnung');
        if (correctBtnEl) {
            correctBtnEl.addEventListener('click', () => {
                duplicateRechnung(rechnung.id);
                closeModal('modal-rechnung');
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
    initRechnungActions,
    cancelRechnung,
    duplicateRechnung
};

// Make globally available
window.renderRechnungen = renderRechnungen;
window.showRechnung = showRechnung;
window.cancelRechnung = cancelRechnung;
window.duplicateRechnung = duplicateRechnung;
