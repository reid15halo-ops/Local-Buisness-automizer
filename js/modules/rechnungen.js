/* ============================================
   Rechnungen Module
   Rechnungen (invoices) CRUD and UI
   ============================================ */
(function() {

const { store, saveStore, addActivity, generateId, formatDate, formatCurrency, getLeistungsartLabel, openModal, closeModal, showToast, h, switchView } = window.AppUtils;

// Filter and search state
let currentRechnungenFilter = 'alle';
let currentRechnungenSearch = '';
let rechnungenSearchDebounceTimer = null;

/**
 * Determine the effective display status of an invoice.
 * An 'offen' invoice whose due date has passed is considered 'ueberfaellig'.
 */
function getEffectiveStatus(rechnung) {
    if (rechnung.status === 'storniert') {return 'storniert';}
    if (rechnung.status === 'bezahlt') {return 'bezahlt';}
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
        case 'bezahlt':    return 'var(--accent-success, #22c55e)'; // green
        case 'offen':      return 'var(--accent-warning, #f59e0b)'; // orange
        case 'ueberfaellig': return 'var(--accent-danger, #ef4444)'; // red
        case 'storniert':  return 'var(--text-muted, #9ca3af)'; // gray
        default:           return 'var(--accent-warning, #f59e0b)';
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

/**
 * Build an entity trail HTML string for a Rechnung.
 * Traces: Anfrage → Angebot → Auftrag → Rechnung
 * Also shows "Korrektur von" link when applicable.
 * @param {Object} rechnung - The invoice object
 * @param {boolean} isCurrent - Whether the rechnung itself is the current (non-clickable) item
 * @returns {string} HTML string for the trail
 */
function buildRechnungTrail(rechnung, isCurrent) {
    const auftrag = rechnung.auftragId ? (store?.auftraege || []).find(a => a.id === rechnung.auftragId) : null;

    // Try to find the Angebot: directly on rechnung, or via the auftrag
    const angebotId = rechnung.angebotId || (auftrag ? auftrag.angebotId : null);
    const angebot = angebotId ? (store?.angebote || []).find(a => a.id === angebotId) : null;

    // Try to find the Anfrage via the Angebot
    const anfrageId = angebot ? angebot.anfrageId : null;
    const anfrage = anfrageId ? (store?.anfragen || []).find(a => a.id === anfrageId) : null;

    // Only show trail if there's at least one ancestor to link
    if (!auftrag && !angebot && !anfrage && !rechnung.korrekturVon) {
        return '';
    }

    const parts = [];

    if (anfrage) {
        parts.push(`<span class="trail-item" onclick="event.stopPropagation(); switchView('anfragen');">📥 ${h(anfrage.id)}</span>`);
    }
    if (angebot) {
        if (parts.length > 0) {parts.push('<span class="trail-arrow">&rarr;</span>');}
        parts.push(`<span class="trail-item" onclick="event.stopPropagation(); switchView('angebote');">📝 ${h(angebot.id)}</span>`);
    }
    if (auftrag) {
        if (parts.length > 0) {parts.push('<span class="trail-arrow">&rarr;</span>');}
        parts.push(`<span class="trail-item" onclick="event.stopPropagation(); switchView('auftraege');">🔧 ${h(auftrag.id)}</span>`);
    }

    // The Rechnung itself
    if (parts.length > 0) {parts.push('<span class="trail-arrow">&rarr;</span>');}
    if (isCurrent) {
        parts.push(`<span class="trail-item trail-current">📄 ${h(rechnung.id)}</span>`);
    } else {
        parts.push(`<span class="trail-item" onclick="event.stopPropagation(); showRechnung('${h(rechnung.id)}');">📄 ${h(rechnung.id)}</span>`);
    }

    let trailHTML = `<div class="entity-trail">${parts.join('')}</div>`;

    // Show "Korrektur von" link if applicable
    if (rechnung.korrekturVon) {
        trailHTML += `<span class="trail-correction" onclick="event.stopPropagation(); showRechnung('${h(rechnung.korrekturVon)}');">↩️ Korrektur von ${h(rechnung.korrekturVon)}</span>`;
    }

    return trailHTML;
}

function updateRechnungenFilterBadges() {
    const allRechnungen = store?.rechnungen || [];
    const counts = { alle: allRechnungen.length, offen: 0, bezahlt: 0, ueberfaellig: 0, storniert: 0 };
    allRechnungen.forEach(r => {
        const s = getEffectiveStatus(r);
        if (counts[s] !== undefined) { counts[s]++; }
    });

    const tabContainer = document.getElementById('rechnungen-filter-tabs');
    if (!tabContainer) {return;}
    tabContainer.querySelectorAll('.filter-btn').forEach(btn => {
        const filter = btn.dataset.filter;
        const count = counts[filter] !== undefined ? counts[filter] : 0;
        const labelMap = { alle: 'Alle', offen: 'Offen', bezahlt: 'Bezahlt', ueberfaellig: '\u00DCberf\u00E4llig', storniert: 'Storniert' };
        btn.textContent = `${labelMap[filter] || filter} (${count})`;
    });
}

function renderRechnungen() {
    const container = document.getElementById('rechnungen-list');
    if (!container) {return;}
    const allRechnungen = store?.rechnungen || [];

    // Update badge counts on filter tabs
    updateRechnungenFilterBadges();

    if (allRechnungen.length === 0) {
        container.innerHTML = `
            <div class="empty-state" class="empty-state">
                <div style="font-size: 48px; margin-bottom: 16px;">💰</div>
                <h3 style="margin-bottom: 8px;">Keine Rechnungen vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Rechnungen werden automatisch erstellt, wenn du einen Auftrag abschließt.
                </p>
                <button class="btn btn-primary" onclick="window.navigationController?.navigateTo('auftraege')">
                    🔧 Zu den Aufträgen
                </button>
            </div>
        `;
        return;
    }

    // Apply status filter
    let filtered = [...allRechnungen];
    if (currentRechnungenFilter !== 'alle') {
        filtered = filtered.filter(r => getEffectiveStatus(r) === currentRechnungenFilter);
    }

    // Apply search filter
    const searchQuery = currentRechnungenSearch.toLowerCase().trim();
    if (searchQuery) {
        filtered = filtered.filter(r =>
            (r.kunde?.name || '').toLowerCase().includes(searchQuery) ||
            (r.id || '').toLowerCase().includes(searchQuery) ||
            (r.leistungsart || '').toLowerCase().includes(searchQuery) ||
            (r.auftragId || '').toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        const labelMap = { offen: 'Offen', bezahlt: 'Bezahlt', ueberfaellig: '\u00DCberf\u00E4llig', storniert: 'Storniert' };
        const filterLabel = currentRechnungenFilter !== 'alle' ? ` mit Status "${labelMap[currentRechnungenFilter] || currentRechnungenFilter}"` : '';
        const searchLabel = searchQuery ? ` passend zu "${window.UI.sanitize(searchQuery)}"` : '';
        container.innerHTML = `
            <div class="empty-state" class="empty-state empty-state-small">
                <div style="font-size: 36px; margin-bottom: 12px;">🔍</div>
                <h3 style="margin-bottom: 8px;">Keine Rechnungen gefunden</h3>
                <p style="color: var(--text-secondary);">
                    Keine Rechnungen${filterLabel}${searchLabel}.
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(r => {
        const effectiveStatus = getEffectiveStatus(r);
        const borderColor = getStatusBorderColor(effectiveStatus);
        const statusIcon = getStatusIcon(effectiveStatus);
        const statusLabel = getStatusLabel(effectiveStatus);
        const statusBadgeClass = getStatusBadgeClass(effectiveStatus);
        const isStorniert = effectiveStatus === 'storniert';
        const textStyle = isStorniert ? 'text-decoration: line-through; opacity: 0.6;' : '';

        // Entity trail (Anfrage -> Angebot -> Auftrag -> Rechnung)
        const rechnungTrailHTML = buildRechnungTrail(r, true);

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
                    <span class="item-id">${window.UI.sanitize(r.id)}</span>
                </div>
                ${rechnungTrailHTML}
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
                    <button class="btn btn-secondary btn-small" data-action="xrechnung" data-id="${r.id}" onclick="event.stopPropagation();" title="XRechnung XML exportieren">
                        🔐 XRechnung
                    </button>
                    <button class="btn btn-secondary btn-small" data-action="zugferd" data-id="${r.id}" onclick="event.stopPropagation();" title="ZUGFeRD PDF exportieren">
                        📎 ZUGFeRD
                    </button>
                    ${cancelBtn}
                    ${correctBtn}
                    ${r.kunde?.id ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); copyPortalLinkForKunde('${r.kunde.id}')" title="Portal-Link kopieren">
                        Portal-Link
                    </button>` : ''}
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
        if ((await window.confirmDialogService?.confirm(`Rechnung ${rechnungId} wirklich stornieren? Dies kann nicht rückgängig gemacht werden.`, {title: 'Stornieren bestätigen', type: 'danger'}) ?? confirm(`Rechnung ${rechnungId} wirklich stornieren? Dies kann nicht rückgängig gemacht werden.`))) {
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

    // Entity trail for the modal (Anfrage → Angebot → Auftrag → Rechnung)
    const modalTrailHTML = buildRechnungTrail(rechnung, true);

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

            ${modalTrailHTML}

            <div style="margin-bottom: 20px;">
                <strong>Kunde:</strong> <span style="${textStyle}">${window.UI.sanitize(rechnung.kunde.name)}</span><br>
                <strong>Leistungsart:</strong> <span style="${textStyle}">${getLeistungsartLabel(rechnung.leistungsart)}</span><br>
                <strong>Status:</strong> ${statusHTML}
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
                <button class="btn btn-secondary" id="btn-xrechnung">
                    🔐 XRechnung
                </button>
                <button class="btn btn-secondary" id="btn-zugferd">
                    📎 ZUGFeRD
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

    // XRechnung export
    const xrBtn = modal.querySelector('#btn-xrechnung');
    if (xrBtn) {
        xrBtn.addEventListener('click', () => {
            if (!window.eInvoiceService) {
                showToast('E-Rechnung Service nicht verfügbar', 'error');
                return;
            }
            const result = window.eInvoiceService.generateXRechnung(rechnung);
            if (result.success) {
                window.eInvoiceService.downloadXml(result.recordId);
                showToast('XRechnung XML generiert', 'success');
            } else {
                showToast('XRechnung Fehler', 'error');
            }
        });
    }

    // ZUGFeRD export
    const zfBtn = modal.querySelector('#btn-zugferd');
    if (zfBtn) {
        zfBtn.addEventListener('click', async () => {
            if (!window.eInvoiceService) {
                showToast('E-Rechnung Service nicht verfügbar', 'error');
                return;
            }
            showToast('ZUGFeRD wird generiert...', 'info');
            const result = await window.eInvoiceService.generateZugferd(rechnung);
            if (result.success && result.pdfBytes) {
                window.eInvoiceService.downloadZugferdPdf(result.recordId);
                showToast('ZUGFeRD PDF generiert', 'success');
            } else if (result.success) {
                window.eInvoiceService.downloadXml(result.recordId);
                showToast('ZUGFeRD XML generiert (PDF-Einbettung nicht verfügbar)', 'warning');
            } else {
                showToast('ZUGFeRD Fehler', 'error');
            }
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
    // Delegated click handler for invoice action buttons
    document.getElementById('view-rechnungen')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) {return;}

        const action = btn.dataset.action;
        const rechnungId = btn.dataset.id;
        const rechnung = store.rechnungen.find(r => r.id === rechnungId);
        if (!rechnung) {return;}

        switch (action) {
            case 'download-pdf':
                if (window.pdfGenerationService) {
                    try {
                        await window.pdfGenerationService.downloadPDF(rechnung);
                        if (window.showToast) {showToast('PDF heruntergeladen', 'success');}
                    } catch (err) {
                        if (window.showToast) {showToast('PDF-Fehler: ' + err.message, 'error');}
                    }
                }
                break;
            case 'xrechnung':
                if (window.eInvoiceService) {
                    const result = window.eInvoiceService.generateXRechnung(rechnung);
                    if (result.success) {
                        window.eInvoiceService.downloadXml(result.recordId);
                        if (window.showToast) {showToast('XRechnung XML generiert', 'success');}
                    }
                }
                break;
            case 'zugferd':
                if (window.eInvoiceService) {
                    const result = await window.eInvoiceService.generateZugferd(rechnung);
                    if (result.success && result.pdfBytes) {
                        window.eInvoiceService.downloadZugferdPdf(result.recordId);
                        if (window.showToast) {showToast('ZUGFeRD PDF generiert', 'success');}
                    } else {
                        window.eInvoiceService.downloadXml(result.recordId);
                        if (window.showToast) {showToast('ZUGFeRD XML generiert (PDF-Einbettung nicht verfügbar)', 'warning');}
                    }
                }
                break;
            case 'mark-paid':
                if (rechnung.status === 'offen') {
                    rechnung.status = 'bezahlt';
                    rechnung.paidAt = new Date().toISOString();
                    saveStore();
                    addActivity('💰', `Rechnung ${rechnung.nummer || rechnung.id} als bezahlt markiert`);
                    renderRechnungen();
                    if (window.showToast) {showToast('Als bezahlt markiert', 'success');}
                }
                break;
        }
    });
}

function initRechnungenFilters() {
    // Filter tab clicks
    const tabContainer = document.getElementById('rechnungen-filter-tabs');
    if (tabContainer) {
        tabContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentRechnungenFilter = btn.dataset.filter;
                tabContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderRechnungen();
            });
        });
    }

    // Search input with 300ms debounce
    const searchInput = document.getElementById('rechnungen-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(rechnungenSearchDebounceTimer);
            rechnungenSearchDebounceTimer = setTimeout(() => {
                currentRechnungenSearch = searchInput.value;
                renderRechnungen();
            }, 300);
        });
    }
}

// Export rechnungen functions
window.RechnungenModule = {
    renderRechnungen,
    showRechnung,
    initRechnungActions,
    initRechnungenFilters,
    cancelRechnung,
    duplicateRechnung
};

// Make globally available
window.renderRechnungen = renderRechnungen;
window.showRechnung = showRechnung;
window.initRechnungenFilters = initRechnungenFilters;
window.cancelRechnung = cancelRechnung;
window.duplicateRechnung = duplicateRechnung;

})();
