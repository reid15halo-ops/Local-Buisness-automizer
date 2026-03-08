/* ============================================
   Rechnungen Module
   Rechnungen (invoices) CRUD and UI
   ============================================ */
(function() {

const { store, saveStore, addActivity, generateId, formatDate, formatCurrency, getLeistungsartLabel, openModal, closeModal, showToast, h } = window.AppUtils || {};

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
            <div class="empty-state" style="padding: 60px 20px; text-align: center;">
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
            <div class="empty-state" style="padding: 40px 20px; text-align: center;">
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
        const safeId = h(r.id);

        const canCancel = r.status === 'offen';
        const canCorrect = r.status === 'offen';

        const cancelBtn = canCancel
            ? `<button class="btn btn-danger btn-small" onclick="event.stopPropagation(); cancelRechnung('${safeId}')" title="Rechnung stornieren">
                    ❌ Stornieren
                </button>`
            : '';

        const correctBtn = canCorrect
            ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); duplicateRechnung('${safeId}')" title="Korrekturrechnung erstellen">
                    📝 Korrektur
                </button>`
            : '';

        // Mahnung button for overdue invoices
        let mahnungBtn = '';
        if (effectiveStatus === 'ueberfaellig' && window.dunningService) {
            const empfohleneStufe = window.dunningService.getEmpfohleneStufe(r);
            const letzteMahnung = window.dunningService.getLetzteMahnung(r.id);
            if (empfohleneStufe) {
                mahnungBtn = `<button class="btn btn-small" style="background:#dc2626;color:#fff;border:none;" onclick="event.stopPropagation(); window.sendMahnungClick('${safeId}')" title="${window.UI.sanitize(empfohleneStufe.name)} senden">
                    📧 ${window.UI.sanitize(empfohleneStufe.name)}
                </button>`;
            }
            if (letzteMahnung) {
                mahnungBtn += `<span class="btn-small" style="font-size:11px;color:var(--text-secondary);padding:4px 8px;">Letzte: ${formatDate(letzteMahnung.gesendetAm || letzteMahnung.erstelltAm)}</span>`;
            }
        }

        return `
            <div class="item-card" onclick="showRechnung('${safeId}')" style="cursor:pointer; border-left: 4px solid ${borderColor};">
                <div class="item-header">
                    <h3 class="item-title" style="${textStyle}">${window.UI.sanitize(r.kunde?.name || 'Unbekannt')}</h3>
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
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); downloadInvoicePDF('${safeId}')" title="PDF herunterladen">
                        📄 PDF
                    </button>
                    <button class="btn btn-secondary btn-small" data-action="xrechnung" data-id="${safeId}" onclick="event.stopPropagation();" title="XRechnung XML exportieren">
                        🔐 XRechnung
                    </button>
                    <button class="btn btn-secondary btn-small" data-action="zugferd" data-id="${safeId}" onclick="event.stopPropagation();" title="ZUGFeRD PDF exportieren">
                        📎 ZUGFeRD
                    </button>
                    ${mahnungBtn}
                    ${cancelBtn}
                    ${correctBtn}
                    ${r.kunde?.id ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); copyPortalLinkForKunde('${h(r.kunde.id)}')" title="Portal-Link kopieren">
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

    // Mahnung section for overdue invoices
    let mahnungSection = '';
    if (effectiveStatus === 'ueberfaellig' && window.dunningService) {
        const dunning = window.dunningService;
        const empfohleneStufe = dunning.getEmpfohleneStufe(rechnung);
        const letzteMahnung = dunning.getLetzteMahnung(rechnung.id);
        const mahnHistorie = dunning.getMahnungenForRechnung(rechnung.id);
        const rechnungStatus = dunning.checkRechnungStatus(rechnung);

        let mahnBtn = '';
        if (empfohleneStufe) {
            const hasEmail = !!rechnung.kunde?.email;
            const disabledAttr = hasEmail ? '' : 'disabled title="Keine E-Mail-Adresse hinterlegt"';
            mahnBtn = `<button class="btn" id="btn-send-mahnung" style="background:#dc2626;color:#fff;border:none;" ${disabledAttr}>
                📧 ${window.UI.sanitize(empfohleneStufe.name)} senden${empfohleneStufe.gebuehr > 0 ? ' (+' + formatCurrency(empfohleneStufe.gebuehr) + ')' : ''}
            </button>`;
            if (!hasEmail) {
                mahnBtn += `<span style="color:#ef4444;font-size:12px;">Keine E-Mail beim Kunden hinterlegt</span>`;
            }
        } else {
            mahnBtn = `<span style="color:var(--text-secondary);font-size:13px;">Alle Mahnstufen bereits gesendet</span>`;
        }

        let historieHTML = '';
        if (mahnHistorie.length > 0) {
            historieHTML = `<div style="margin-top:8px;font-size:13px;">
                <strong>Mahnhistorie:</strong>
                <ul style="margin:4px 0 0 16px;padding:0;list-style:disc;">
                    ${mahnHistorie.map(m => `<li>${window.UI.sanitize(m.stufenName || m.stufe)} — ${formatDate(m.gesendetAm || m.erstelltAm)}${m.empfaenger ? ' an ' + window.UI.sanitize(m.empfaenger) : ''}</li>`).join('')}
                </ul>
            </div>`;
        }

        mahnungSection = `
            <div style="margin-bottom:20px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <strong style="color:#dc2626;">Mahnwesen</strong>
                    <span style="font-size:12px;color:var(--text-secondary);">${rechnungStatus.tageOffen || 0} Tage überfällig</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    ${mahnBtn}
                </div>
                ${letzteMahnung ? `<div style="margin-top:8px;font-size:12px;color:var(--text-secondary);">Letzte Mahnung: ${window.UI.sanitize(letzteMahnung.stufenName || letzteMahnung.stufe)} am ${formatDate(letzteMahnung.gesendetAm || letzteMahnung.erstelltAm)}</div>` : ''}
                ${historieHTML}
            </div>
        `;
    }

    modal.querySelector('.modal-content').innerHTML = `
        <div style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="${textStyle}">${window.UI.sanitize(rechnung.id)}</h2>
                <button class="modal-close">×</button>
            </div>

            ${modalTrailHTML}

            <div style="margin-bottom: 20px;">
                <strong>Kunde:</strong> <span style="${textStyle}">${window.UI.sanitize(rechnung.kunde?.name || 'Unbekannt')}</span><br>
                <strong>Leistungsart:</strong> <span style="${textStyle}">${getLeistungsartLabel(rechnung.leistungsart)}</span><br>
                <strong>Status:</strong> ${statusHTML}
            </div>

            ${mahnungSection}

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
                showToast('E-Rechnung Service nicht verfuegbar', 'error');
                return;
            }
            const result = window.eInvoiceService.generateXRechnung(rechnung);
            if (result.success) {
                window.eInvoiceService.downloadXml(result.recordId);
                showToast('XRechnung XML generiert', 'success');
            } else if (result.validation && result.validation.errors && result.validation.errors.length > 0) {
                showToast('Validierungsfehler: ' + result.validation.errors.join(', '), 'error');
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
                showToast('E-Rechnung Service nicht verfuegbar', 'error');
                return;
            }
            showToast('ZUGFeRD wird generiert...', 'info');
            const result = await window.eInvoiceService.generateZugferd(rechnung);
            if (result.success && result.pdfBytes) {
                window.eInvoiceService.downloadZugferdPdf(result.recordId);
                showToast('ZUGFeRD PDF generiert', 'success');
            } else if (result.success) {
                window.eInvoiceService.downloadXml(result.recordId);
                showToast('ZUGFeRD XML generiert (PDF-Einbettung nicht verfuegbar)', 'warning');
            } else if (result.validation && result.validation.errors && result.validation.errors.length > 0) {
                showToast('Validierungsfehler: ' + result.validation.errors.join(', '), 'error');
            } else {
                showToast('ZUGFeRD Fehler', 'error');
            }
        });
    }

    // Send Mahnung from modal
    const mahnungBtnEl = modal.querySelector('#btn-send-mahnung');
    if (mahnungBtnEl && !mahnungBtnEl.disabled) {
        mahnungBtnEl.addEventListener('click', () => {
            _confirmAndSendMahnung(rechnung);
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
                    if (window.showToast) {showToast('XRechnung wird generiert…', 'info');}
                    const result = window.eInvoiceService.generateXRechnung(rechnung);
                    if (result.success) {
                        window.eInvoiceService.downloadXml(result.recordId);
                        if (window.showToast) {showToast('XRechnung XML generiert', 'success');}
                    } else if (result.validation && result.validation.errors && result.validation.errors.length > 0) {
                        if (window.showToast) {showToast('Validierungsfehler:\n' + result.validation.errors.join('\n'), 'error');}
                    } else {
                        if (window.showToast) {showToast('XRechnung Fehler', 'error');}
                    }
                } else {
                    if (window.showToast) {showToast('E-Rechnung Service nicht verfügbar', 'error');}
                }
                break;
            case 'zugferd':
                if (window.eInvoiceService) {
                    if (window.showToast) {showToast('ZUGFeRD wird generiert…', 'info');}
                    const zfResult = await window.eInvoiceService.generateZugferd(rechnung);
                    if (zfResult.success && zfResult.pdfBytes) {
                        window.eInvoiceService.downloadZugferdPdf(zfResult.recordId);
                        if (window.showToast) {showToast('ZUGFeRD PDF generiert', 'success');}
                    } else if (zfResult.success) {
                        window.eInvoiceService.downloadXml(zfResult.recordId);
                        if (window.showToast) {showToast('ZUGFeRD XML generiert (PDF-Einbettung nicht verfügbar)', 'warning');}
                    } else if (zfResult.validation && zfResult.validation.errors && zfResult.validation.errors.length > 0) {
                        if (window.showToast) {showToast('Validierungsfehler:\n' + zfResult.validation.errors.join('\n'), 'error');}
                    } else {
                        if (window.showToast) {showToast('ZUGFeRD Fehler', 'error');}
                    }
                } else {
                    if (window.showToast) {showToast('E-Rechnung Service nicht verfügbar', 'error');}
                }
                break;
            case 'mark-paid':
                if (rechnung.status === 'offen') {
                    rechnung.status = 'bezahlt';
                    rechnung.bezahltAm = new Date().toISOString();
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

// ============================================
// Mahnung senden (1-Click mit Bestätigung)
// ============================================
function _confirmAndSendMahnung(rechnung) {
    if (!window.dunningService) {
        showToast('Mahnwesen-Service nicht verfügbar', 'error');
        return;
    }
    const stufe = window.dunningService.getEmpfohleneStufe(rechnung);
    if (!stufe) {
        showToast('Keine passende Mahnstufe verfügbar', 'warning');
        return;
    }

    const kundeName = window.UI.sanitize(rechnung.kunde?.name || 'Unbekannt');
    const kundeEmail = window.UI.sanitize(rechnung.kunde?.email || '');
    const gebuehrText = stufe.gebuehr > 0 ? ` (zzgl. ${formatCurrency(stufe.gebuehr)} Mahngebühr)` : '';

    const doSend = async () => {
        const btn = document.getElementById('btn-send-mahnung');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Wird gesendet...';
        }
        const result = await window.dunningService.sendMahnung(rechnung, stufe);
        if (result) {
            // Refresh modal to show updated state
            showRechnung(rechnung.id);
            renderRechnungen();
        } else if (btn) {
            btn.disabled = false;
            btn.textContent = `📧 ${stufe.name} senden`;
        }
    };

    if (window.confirmDialogService?.showConfirmDialog) {
        window.confirmDialogService.showConfirmDialog({
            title: `${stufe.name} senden?`,
            message: `${stufe.name}${gebuehrText} an ${kundeName} (${kundeEmail}) senden?`,
            confirmText: 'Ja, senden',
            destructive: false,
            onConfirm: doSend
        });
    } else if (confirm(`${stufe.name}${gebuehrText} an ${rechnung.kunde?.name || 'Kunde'} (${rechnung.kunde?.email || ''}) senden?`)) {
        doSend();
    }
}

/**
 * Global click handler for Mahnung button on cards
 */
function sendMahnungClick(rechnungId) {
    const rechnung = store.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) return;
    _confirmAndSendMahnung(rechnung);
}

// PDF download for invoices
async function downloadInvoicePDF(id) {
    const rechnung = store.rechnungen.find(r => r.id === id);
    if (!rechnung) {return;}
    // Try pdfGenerationService first (pdfMake), then pdfService (jsPDF)
    if (window.pdfGenerationService) {
        try {
            await window.pdfGenerationService.downloadPDF(rechnung);
            if (window.showToast) {showToast('PDF heruntergeladen', 'success');}
        } catch (err) {
            if (window.showToast) {showToast('PDF-Fehler: ' + err.message, 'error');}
        }
    } else if (window.pdfService?.generateRechnung) {
        try {
            await window.pdfService.generateRechnung(rechnung);
            if (window.showToast) {showToast('PDF heruntergeladen', 'success');}
        } catch (err) {
            if (window.showToast) {showToast('PDF-Fehler: ' + err.message, 'error');}
        }
    } else {
        if (window.showToast) {showToast('PDF-Service nicht verfügbar', 'error');}
    }
}

// ═══════════════════════════════════════════════════════════════
//  Abo-Rechnungen Tab (Recurring Invoice Templates)
// ═══════════════════════════════════════════════════════════════

let _mainTabsInit = false;
let _aboActionsInit = false;

function initMainTabs() {
    const tabContainer = document.getElementById('rechnungen-main-tabs');
    if (!tabContainer || _mainTabsInit) return;
    _mainTabsInit = true;

    tabContainer.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const tabId = btn.dataset.maintab;
            tabContainer.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            const rechnungenTab = document.getElementById('rechnungen-tab');
            const aboTab = document.getElementById('abo-rechnungen-tab');
            if (rechnungenTab) rechnungenTab.style.display = (tabId === 'rechnungen-tab') ? '' : 'none';
            if (aboTab) aboTab.style.display = (tabId === 'abo-rechnungen-tab') ? '' : 'none';
            if (tabId === 'abo-rechnungen-tab') {
                renderAboRechnungen();
            }
        });
    });

    const btnNeuesAbo = document.getElementById('btn-neues-abo');
    if (btnNeuesAbo) {
        btnNeuesAbo.addEventListener('click', function() {
            openAboFormular();
        });
    }
}

function renderAboRechnungen() {
    const svc = window.recurringInvoiceService;
    if (!svc) return;

    const statsBar = document.getElementById('abo-stats-bar');
    if (statsBar) {
        const stats = svc.getStatistiken();
        statsBar.innerHTML =
            '<span style="padding:4px 12px; background:var(--bg-secondary); border-radius:6px; font-size:13px;">' +
                'Aktiv: <strong>' + stats.aktiv + '</strong>' +
            '</span>' +
            '<span style="padding:4px 12px; background:var(--bg-secondary); border-radius:6px; font-size:13px;">' +
                'MRR: <strong>' + formatCurrency(stats.mrr) + '</strong>' +
            '</span>' +
            '<span style="padding:4px 12px; background:var(--bg-secondary); border-radius:6px; font-size:13px;">' +
                'ARR: <strong>' + formatCurrency(stats.arr) + '</strong>' +
            '</span>';
    }

    const container = document.getElementById('abo-rechnungen-list');
    if (!container) return;

    const templates = svc.getTemplates();

    if (templates.length === 0) {
        container.innerHTML =
            '<div class="empty-state" style="padding:60px 20px; text-align:center;">' +
                '<div style="font-size:48px; margin-bottom:16px;">🔄</div>' +
                '<h3 style="margin-bottom:8px;">Keine Abo-Rechnungen</h3>' +
                '<p style="color:var(--text-secondary); margin-bottom:24px;">' +
                    'Erstelle eine wiederkehrende Rechnungsvorlage fuer Retainer-Kunden.' +
                '</p>' +
                '<button class="btn btn-primary" onclick="window._openAboFormular && window._openAboFormular()">+ Neues Abo erstellen</button>' +
            '</div>';
        return;
    }

    container.innerHTML = templates.map(function(t) {
        const statusColors = { aktiv: '#22c55e', pausiert: '#f59e0b', beendet: '#9ca3af' };
        const borderColor = statusColors[t.status] || '#f59e0b';
        const statusLabel = svc.getStatusName(t.status);
        const intervallLabel = svc.getIntervallName(t.intervall);
        const brutto = t.netto_betrag * (1 + t.steuersatz);
        const safeId = h(t.id);
        const safeName = h(t.kunde_name || 'Unbekannt');
        const safeBez = h(t.bezeichnung || '-');

        let pauseBtn = '';
        if (t.status === 'aktiv') {
            pauseBtn = '<button class="btn btn-secondary btn-small" data-abo-action="pause" data-abo-id="' + safeId + '">⏸ Pausieren</button>';
        } else if (t.status === 'pausiert') {
            pauseBtn = '<button class="btn btn-primary btn-small" data-abo-action="activate" data-abo-id="' + safeId + '">▶ Fortsetzen</button>';
        }

        let generateBtn = '';
        if (t.status !== 'beendet') {
            generateBtn = '<button class="btn btn-secondary btn-small" data-abo-action="generate" data-abo-id="' + safeId + '">⚡ Jetzt generieren</button>';
        }

        const deleteBtn = '<button class="btn btn-danger btn-small" data-abo-action="delete" data-abo-id="' + safeId + '">🗑 Loeschen</button>';

        return '<div class="item-card" style="border-left: 4px solid ' + borderColor + ';">' +
            '<div class="item-header">' +
                '<h3 class="item-title">' + safeName + '</h3>' +
                '<span class="item-id">' + safeBez + '</span>' +
            '</div>' +
            '<div class="item-meta">' +
                '<span>● ' + statusLabel + '</span>' +
                '<span>💰 ' + formatCurrency(brutto) + ' (brutto)</span>' +
                '<span>🔄 ' + intervallLabel + '</span>' +
                (t.naechste_faelligkeit ? '<span>📅 Naechste: ' + formatDate(t.naechste_faelligkeit) + '</span>' : '') +
                '<span>📊 ' + t.anzahl_erstellt + ' erstellt</span>' +
            '</div>' +
            (t.notizen ? '<p class="item-description">' + h(t.notizen) + '</p>' : '') +
            '<div class="item-actions">' +
                pauseBtn + generateBtn + deleteBtn +
            '</div>' +
        '</div>';
    }).join('');
}

function initAboActions() {
    const container = document.getElementById('abo-rechnungen-list');
    if (!container || _aboActionsInit) return;
    _aboActionsInit = true;

    container.addEventListener('click', async function(e) {
        const btn = e.target.closest('[data-abo-action]');
        if (!btn) return;

        const action = btn.dataset.aboAction;
        const id = btn.dataset.aboId;
        const svc = window.recurringInvoiceService;
        if (!svc) return;

        switch (action) {
            case 'pause':
                await svc.pauseTemplate(id);
                showToast('Abo pausiert', 'info');
                renderAboRechnungen();
                break;
            case 'activate':
                await svc.activateTemplate(id);
                showToast('Abo fortgesetzt', 'success');
                renderAboRechnungen();
                break;
            case 'generate':
                const rechnung = await svc.generateNow(id);
                if (rechnung) {
                    showToast('Rechnung ' + rechnung.nummer + ' erstellt', 'success');
                    renderAboRechnungen();
                    renderRechnungen();
                } else {
                    showToast('Fehler bei Rechnungserstellung', 'error');
                }
                break;
            case 'delete':
                if (window.confirmDialogService && window.confirmDialogService.showConfirmDialog) {
                    window.confirmDialogService.showConfirmDialog({
                        title: 'Abo loeschen?',
                        message: 'Dieses Abo-Template wirklich loeschen? Bereits erstellte Rechnungen bleiben erhalten.',
                        confirmText: 'Ja, loeschen',
                        destructive: true,
                        onConfirm: async function() {
                            await svc.deleteTemplate(id);
                            showToast('Abo geloescht', 'info');
                            renderAboRechnungen();
                        }
                    });
                } else if (confirm('Dieses Abo-Template wirklich loeschen?')) {
                    await svc.deleteTemplate(id);
                    showToast('Abo geloescht', 'info');
                    renderAboRechnungen();
                }
                break;
        }
    });
}

function openAboFormular(existing) {
    const modal = document.getElementById('modal-neues-abo');
    if (!modal) return;

    const isEdit = !!existing;
    const title = isEdit ? 'Abo bearbeiten' : 'Neues Abo erstellen';

    const kunden = (store && store.kunden) ? store.kunden : [];
    let kundenOptions = '<option value="">-- Kunde waehlen --</option>';
    kunden.forEach(function(k) {
        const sel = (existing && existing.kunde_id === k.id) ? ' selected' : '';
        kundenOptions += '<option value="' + h(k.id) + '"' + sel + '>' + h(k.name || k.firma || k.id) + '</option>';
    });

    modal.querySelector('.modal-content').innerHTML =
        '<div style="padding:24px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">' +
                '<h2>' + title + '</h2>' +
                '<button class="modal-close" onclick="window.AppUtils.closeModal(\'modal-neues-abo\')">×</button>' +
            '</div>' +
            '<form id="form-neues-abo">' +
                '<div style="margin-bottom:12px;">' +
                    '<label style="display:block; font-weight:600; margin-bottom:4px;">Kunde</label>' +
                    '<select id="abo-kunde" class="form-input" style="width:100%;">' + kundenOptions + '</select>' +
                '</div>' +
                '<div style="margin-bottom:12px;">' +
                    '<label style="display:block; font-weight:600; margin-bottom:4px;">Kunde (Freitext, falls nicht in Liste)</label>' +
                    '<input type="text" id="abo-kunde-name" class="form-input" style="width:100%;" placeholder="Kundenname" value="' + h((existing && existing.kunde_name) || '') + '">' +
                '</div>' +
                '<div style="margin-bottom:12px;">' +
                    '<label style="display:block; font-weight:600; margin-bottom:4px;">Bezeichnung</label>' +
                    '<input type="text" id="abo-bezeichnung" class="form-input" style="width:100%;" placeholder="z.B. IT-Retainer Monatspauschale" value="' + h((existing && existing.bezeichnung) || '') + '" required>' +
                '</div>' +
                '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">' +
                    '<div>' +
                        '<label style="display:block; font-weight:600; margin-bottom:4px;">Netto-Betrag (EUR)</label>' +
                        '<input type="number" id="abo-netto" class="form-input" style="width:100%;" step="0.01" min="0" value="' + ((existing && existing.netto_betrag) || '') + '" required>' +
                    '</div>' +
                    '<div>' +
                        '<label style="display:block; font-weight:600; margin-bottom:4px;">Steuersatz</label>' +
                        '<select id="abo-steuersatz" class="form-input" style="width:100%;">' +
                            '<option value="0.19"' + ((existing && existing.steuersatz === 0.19) || !existing ? ' selected' : '') + '>19% MwSt</option>' +
                            '<option value="0.07"' + (existing && existing.steuersatz === 0.07 ? ' selected' : '') + '>7% MwSt</option>' +
                            '<option value="0"' + (existing && existing.steuersatz === 0 ? ' selected' : '') + '>0% (Kleinunternehmer)</option>' +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">' +
                    '<div>' +
                        '<label style="display:block; font-weight:600; margin-bottom:4px;">Intervall</label>' +
                        '<select id="abo-intervall" class="form-input" style="width:100%;">' +
                            '<option value="monatlich"' + (existing && existing.intervall === 'monatlich' ? ' selected' : (!existing ? ' selected' : '')) + '>Monatlich</option>' +
                            '<option value="quartalsweise"' + (existing && existing.intervall === 'quartalsweise' ? ' selected' : '') + '>Quartalsweise</option>' +
                            '<option value="jaehrlich"' + (existing && existing.intervall === 'jaehrlich' ? ' selected' : '') + '>Jaehrlich</option>' +
                        '</select>' +
                    '</div>' +
                    '<div>' +
                        '<label style="display:block; font-weight:600; margin-bottom:4px;">Tag im Monat</label>' +
                        '<input type="number" id="abo-tag" class="form-input" style="width:100%;" min="1" max="28" value="' + ((existing && existing.tag_im_monat) || 1) + '">' +
                    '</div>' +
                '</div>' +
                '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">' +
                    '<div>' +
                        '<label style="display:block; font-weight:600; margin-bottom:4px;">Startdatum</label>' +
                        '<input type="date" id="abo-start" class="form-input" style="width:100%;" value="' + ((existing && existing.start_datum) || new Date().toISOString().split('T')[0]) + '">' +
                    '</div>' +
                    '<div>' +
                        '<label style="display:block; font-weight:600; margin-bottom:4px;">Enddatum (optional)</label>' +
                        '<input type="date" id="abo-end" class="form-input" style="width:100%;" value="' + ((existing && existing.end_datum) || '') + '">' +
                    '</div>' +
                '</div>' +
                '<div style="margin-bottom:12px;">' +
                    '<label style="display:block; font-weight:600; margin-bottom:4px;">Zahlungsziel (Tage)</label>' +
                    '<input type="number" id="abo-zahlungsziel" class="form-input" style="width:100%;" min="0" value="' + ((existing && existing.zahlungsziel_tage) || 14) + '">' +
                '</div>' +
                '<div style="margin-bottom:16px;">' +
                    '<label style="display:block; font-weight:600; margin-bottom:4px;">Notizen</label>' +
                    '<textarea id="abo-notizen" class="form-input" style="width:100%; min-height:60px;">' + h((existing && existing.notizen) || '') + '</textarea>' +
                '</div>' +
                '<div style="display:flex; gap:8px; justify-content:flex-end;">' +
                    '<button type="button" class="btn btn-secondary" onclick="window.AppUtils.closeModal(\'modal-neues-abo\')">Abbrechen</button>' +
                    '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Speichern' : 'Abo erstellen') + '</button>' +
                '</div>' +
            '</form>' +
        '</div>';

    const kundeSelect = document.getElementById('abo-kunde');
    const kundeNameInput = document.getElementById('abo-kunde-name');
    if (kundeSelect) {
        kundeSelect.addEventListener('change', function() {
            const selected = kunden.find(function(k) { return k.id === kundeSelect.value; });
            if (selected && kundeNameInput) {
                kundeNameInput.value = selected.name || selected.firma || '';
            }
        });
    }

    const form = document.getElementById('form-neues-abo');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const data = {
                kunde_id: document.getElementById('abo-kunde').value || null,
                kunde_name: document.getElementById('abo-kunde-name').value.trim(),
                bezeichnung: document.getElementById('abo-bezeichnung').value.trim(),
                netto_betrag: parseFloat(document.getElementById('abo-netto').value) || 0,
                steuersatz: parseFloat(document.getElementById('abo-steuersatz').value),
                intervall: document.getElementById('abo-intervall').value,
                tag_im_monat: parseInt(document.getElementById('abo-tag').value) || 1,
                start_datum: document.getElementById('abo-start').value || new Date().toISOString().split('T')[0],
                end_datum: document.getElementById('abo-end').value || null,
                zahlungsziel_tage: parseInt(document.getElementById('abo-zahlungsziel').value) || 14,
                notizen: document.getElementById('abo-notizen').value.trim()
            };

            if (!data.bezeichnung) {
                showToast('Bitte Bezeichnung eingeben', 'error');
                return;
            }
            if (!data.netto_betrag || data.netto_betrag <= 0) {
                showToast('Bitte gueltigen Betrag eingeben', 'error');
                return;
            }

            if (!data.kunde_name && data.kunde_id) {
                const k = kunden.find(function(k) { return k.id === data.kunde_id; });
                if (k) data.kunde_name = k.name || k.firma || '';
            }

            const svc = window.recurringInvoiceService;
            if (!svc) {
                showToast('Service nicht verfuegbar', 'error');
                return;
            }

            let result;
            if (isEdit && existing) {
                result = await svc.updateTemplate(existing.id, data);
            } else {
                result = await svc.createTemplate(data);
            }

            if (result.success) {
                closeModal('modal-neues-abo');
                showToast(isEdit ? 'Abo aktualisiert' : 'Abo erstellt', 'success');
                renderAboRechnungen();
            } else {
                showToast('Fehler: ' + (result.error || 'Unbekannt'), 'error');
            }
        });
    }

    openModal('modal-neues-abo');
}

window._openAboFormular = openAboFormular;

function initAboRechnungenUI() {
    initMainTabs();
    initAboActions();
}

document.addEventListener('viewchange', function(e) {
    if (e.detail && e.detail.view === 'rechnungen') {
        initAboRechnungenUI();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    initAboRechnungenUI();
});

// Export rechnungen functions (extended)
window.RechnungenModule = {
    renderRechnungen: renderRechnungen,
    showRechnung: showRechnung,
    initRechnungActions: initRechnungActions,
    initRechnungenFilters: initRechnungenFilters,
    cancelRechnung: cancelRechnung,
    duplicateRechnung: duplicateRechnung,
    sendMahnungClick: sendMahnungClick,
    renderAboRechnungen: renderAboRechnungen,
    openAboFormular: openAboFormular
};

// Make globally available
window.renderRechnungen = renderRechnungen;
window.showRechnung = showRechnung;
window.initRechnungenFilters = initRechnungenFilters;
window.cancelRechnung = cancelRechnung;
window.duplicateRechnung = duplicateRechnung;
window.downloadInvoicePDF = downloadInvoicePDF;
window.sendMahnungClick = sendMahnungClick;
window.renderAboRechnungen = renderAboRechnungen;
window.openAboFormular = openAboFormular;

})();
