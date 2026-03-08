/* ============================================
   Aufträge Module
   Aufträge (orders/jobs) CRUD and UI management
   ============================================ */
(function() {

const { store, saveStore, addActivity, formatDate, formatCurrency, getLeistungsartLabel, h } = window.AppUtils;

// Module state
let currentAuftragFilter = 'alle';
let auftragViewMode = 'kanban';
let currentDetailAuftragId = null;

// Status configuration
const AUFTRAG_STATUS_CONFIG = {
    geplant: {
        label: 'Geplant', icon: '📋', color: 'var(--accent-info, #60a5fa)', order: 1,
        description: 'Auftrag erfasst, Planung läuft',
        erlaubteUebergaenge: ['material_bestellt', 'in_bearbeitung', 'pausiert', 'storniert']
    },
    material_bestellt: {
        label: 'Material bestellt', icon: '📦', color: 'var(--color-purple, #a78bfa)', order: 2,
        description: 'Material wurde bestellt, wartet auf Lieferung',
        erlaubteUebergaenge: ['in_bearbeitung', 'geplant', 'pausiert', 'storniert'],
        autoAktion: 'materialCheck'
    },
    in_bearbeitung: {
        label: 'In Bearbeitung', icon: '🔧', color: 'var(--accent-warning, #f59e0b)', order: 3,
        description: 'Arbeiten laufen',
        erlaubteUebergaenge: ['qualitaetskontrolle', 'abnahme', 'pausiert', 'storniert'],
        autoAktion: 'zeitStart'
    },
    qualitaetskontrolle: {
        label: 'Qualitätskontrolle', icon: '🔍', color: 'var(--color-cyan, #06b6d4)', order: 4,
        description: 'Arbeiten fertig, Qualitätsprüfung',
        erlaubteUebergaenge: ['in_bearbeitung', 'abnahme', 'pausiert']
    },
    abnahme: {
        label: 'Abnahme', icon: '✋', color: 'var(--color-violet, #8b5cf6)', order: 5,
        description: 'Wartet auf Kundenabnahme',
        erlaubteUebergaenge: ['abgeschlossen', 'in_bearbeitung', 'qualitaetskontrolle'],
        autoAktion: 'kundeNotify'
    },
    abgeschlossen: {
        label: 'Abgeschlossen', icon: '✅', color: 'var(--accent-success, #22c55e)', order: 6,
        description: 'Auftrag fertig, Rechnung kann erstellt werden',
        erlaubteUebergaenge: [],
        autoAktion: 'rechnungReady'
    },
    pausiert: {
        label: 'Pausiert', icon: '⏸️', color: 'var(--text-muted, #94a3b8)', order: 0,
        description: 'Auftrag unterbrochen',
        erlaubteUebergaenge: ['geplant', 'material_bestellt', 'in_bearbeitung', 'storniert'],
        brauchtGrund: true
    },
    storniert: {
        label: 'Storniert', icon: '❌', color: 'var(--accent-danger, #ef4444)', order: 0,
        description: 'Auftrag abgebrochen',
        erlaubteUebergaenge: ['geplant'],
        brauchtGrund: true
    }
};

// Legacy-compatible lookups
const AUFTRAG_STATUS_LABELS = {};
const AUFTRAG_STATUS_ICONS = {};
Object.entries(AUFTRAG_STATUS_CONFIG).forEach(([key, cfg]) => {
    AUFTRAG_STATUS_LABELS[key] = cfg.label;
    AUFTRAG_STATUS_ICONS[key] = cfg.icon;
});
AUFTRAG_STATUS_LABELS['aktiv'] = 'In Bearbeitung';
AUFTRAG_STATUS_ICONS['aktiv'] = '🔧';

// Status change helpers
function validateStatusChange(auftrag, newStatus) {
    const current = auftrag.status;
    if (current === newStatus) {return { valid: false, error: 'Status ist bereits ' + AUFTRAG_STATUS_LABELS[current] };}
    const config = AUFTRAG_STATUS_CONFIG[current];
    if (!config) {return { valid: true };}
    if (!config.erlaubteUebergaenge.includes(newStatus)) {
        return {
            valid: false,
            error: `"${AUFTRAG_STATUS_LABELS[current]}" kann nicht direkt zu "${AUFTRAG_STATUS_LABELS[newStatus]}" wechseln.`
        };
    }
    return { valid: true };
}

function getErlaubteUebergaenge(status) {
    const config = AUFTRAG_STATUS_CONFIG[status];
    if (!config) {return Object.keys(AUFTRAG_STATUS_CONFIG);}
    return config.erlaubteUebergaenge;
}

function executeStatusAutoAktion(auftrag, newStatus) {
    const config = AUFTRAG_STATUS_CONFIG[newStatus];
    if (!config?.autoAktion) {return;}

    switch (config.autoAktion) {
        case 'materialCheck':
            const stueckliste = auftrag.stueckliste || [];
            if (stueckliste.length > 0 && window.materialService) {
                const fehlend = stueckliste.filter(item => {
                    if (!item.materialId) {return false;}
                    const mat = window.materialService.getMaterialById(item.materialId);
                    return mat && mat.bestand < item.menge;
                });
                if (fehlend.length > 0) {
                    window.AppUtils.showToast(`${fehlend.length} Material-Position(en) unter Mindestbestand`, 'warning');
                }
            }
            break;
        case 'zeitStart':
            if (window.timeTrackingService && !window.timeTrackingService.currentEntry) {
                window.AppUtils.showToast('Tipp: Zeiterfassung im Auftrag starten', 'info');
            }
            break;
        case 'kundeNotify':
            window.AppUtils.showToast(`Kunde ${auftrag.kunde?.name || ''} kann zur Abnahme eingeladen werden`, 'info');
            break;
        case 'rechnungReady':
            auftrag.fortschritt = 100;
            window.AppUtils.showToast('Auftrag abgeschlossen - Rechnung kann erstellt werden', 'success');
            break;
    }
}

function trackStatusDauer(auftrag, oldStatus, _newStatus) {
    if (!auftrag.statusZeiten) {auftrag.statusZeiten = {};}
    const now = Date.now();
    const lastChange = auftrag.letzterStatusWechsel || new Date(auftrag.createdAt).getTime();
    const dauerMs = now - lastChange;

    if (!auftrag.statusZeiten[oldStatus]) {auftrag.statusZeiten[oldStatus] = 0;}
    auftrag.statusZeiten[oldStatus] += dauerMs;
    auftrag.letzterStatusWechsel = now;
}

function changeAuftragStatus(auftragId, newStatus, grund) {
    const auftrag = store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) {return { success: false, error: 'Auftrag nicht gefunden' };}

    const validation = validateStatusChange(auftrag, newStatus);
    if (!validation.valid) {return { success: false, error: validation.error };}

    const config = AUFTRAG_STATUS_CONFIG[newStatus];
    if (config?.brauchtGrund && !grund) {
        return { success: false, error: 'Grund erforderlich', brauchtGrund: true };
    }

    const oldStatus = auftrag.status;
    trackStatusDauer(auftrag, oldStatus, newStatus);

    if (!auftrag.historie) {auftrag.historie = [];}
    const entry = {
        aktion: 'status',
        datum: new Date().toISOString(),
        details: `${AUFTRAG_STATUS_LABELS[oldStatus]} → ${AUFTRAG_STATUS_LABELS[newStatus]}`
    };
    if (grund) {entry.grund = grund;}
    auftrag.historie.push(entry);

    auftrag.status = newStatus;
    if (grund) {auftrag.statusGrund = grund;}
    else {delete auftrag.statusGrund;}

    saveStore();
    executeStatusAutoAktion(auftrag, newStatus);
    addActivity(AUFTRAG_STATUS_ICONS[newStatus] || '📋', `${auftrag.id}: ${AUFTRAG_STATUS_LABELS[oldStatus]} → ${AUFTRAG_STATUS_LABELS[newStatus]}`);

    return { success: true, oldStatus, newStatus };
}

// Render functions
function renderAuftraege() {
    const auftraege = store.auftraege || [];
    auftraege.forEach(a => { if (a.status === 'aktiv') {a.status = 'in_bearbeitung';} });

    const counts = {};
    Object.keys(AUFTRAG_STATUS_CONFIG).forEach(k => counts[k] = 0);
    auftraege.forEach(a => { if (counts[a.status] !== undefined) {counts[a.status]++;} });

    const statsGrid = document.getElementById('auftrag-stats-grid');
    if (statsGrid) {
        const mainStatuses = ['geplant', 'material_bestellt', 'in_bearbeitung', 'qualitaetskontrolle', 'abnahme', 'abgeschlossen'];
        statsGrid.innerHTML = mainStatuses.map(key => {
            const cfg = AUFTRAG_STATUS_CONFIG[key];
            return `
                <div class="stat-card-mini" style="cursor:pointer;" data-action="filter-status" data-filter="${key}">
                    <span class="stat-icon-mini">${cfg.icon}</span>
                    <div class="stat-content-mini">
                        <span class="stat-value-mini">${counts[key] || 0}</span>
                        <span class="stat-label-mini">${cfg.label}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAuftragPipeline(auftraege, counts);

    if (auftragViewMode === 'kanban') {
        renderAuftraegeKanban(auftraege);
    } else {
        renderAuftraegeList(auftraege);
    }
}

function renderAuftragPipeline(auftraege, counts) {
    const container = document.getElementById('auftrag-pipeline');
    if (!container) {return;}

    const pipelineStatuses = ['geplant', 'material_bestellt', 'in_bearbeitung', 'qualitaetskontrolle', 'abnahme', 'abgeschlossen'];

    container.innerHTML = `
        <div class="pipeline-flow">
            ${pipelineStatuses.map((key, i) => {
                const cfg = AUFTRAG_STATUS_CONFIG[key];
                const count = counts[key] || 0;
                const isActive = count > 0;
                return `
                    <div class="pipeline-step ${isActive ? 'active' : ''}" style="--step-color:${cfg.color};">
                        <div class="pipeline-step-icon">${cfg.icon}</div>
                        <div class="pipeline-step-label">${cfg.label}</div>
                        <div class="pipeline-step-count">${count}</div>
                        ${i < pipelineStatuses.length - 1 ? '<div class="pipeline-arrow">→</div>' : ''}
                    </div>
                `;
            }).join('')}
        </div>
        ${(counts.pausiert || 0) > 0 ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px;">⏸️ ${counts.pausiert} pausiert</div>` : ''}
        ${(counts.storniert || 0) > 0 ? `<div style="font-size:12px;color:#ef4444;margin-top:2px;">❌ ${counts.storniert} storniert</div>` : ''}
    `;
}

function renderAuftraegeKanban(auftraege) {
    const kanbanContainer = document.getElementById('auftrag-kanban');
    if (!kanbanContainer) {return;}
    kanbanContainer.style.display = '';
    const listEl = document.getElementById('auftraege-list');
    if (listEl) {listEl.style.display = 'none';}

    const searchQuery = (document.getElementById('auftrag-search')?.value || '').toLowerCase();

    let kanbanStatuses = ['geplant', 'material_bestellt', 'in_bearbeitung', 'qualitaetskontrolle', 'abnahme', 'abgeschlossen'];
    if (currentAuftragFilter !== 'alle') {
        kanbanStatuses = [currentAuftragFilter];
    }
    if (auftraege.some(a => a.status === 'pausiert') || currentAuftragFilter === 'pausiert') {
        if (!kanbanStatuses.includes('pausiert')) {kanbanStatuses.push('pausiert');}
    }
    if (auftraege.some(a => a.status === 'storniert') || currentAuftragFilter === 'storniert') {
        if (!kanbanStatuses.includes('storniert')) {kanbanStatuses.push('storniert');}
    }

    kanbanContainer.style.gridTemplateColumns = `repeat(${Math.min(kanbanStatuses.length, 6)}, 1fr)`;

    kanbanContainer.innerHTML = kanbanStatuses.map(status => {
        const cfg = AUFTRAG_STATUS_CONFIG[status];
        if (!cfg) {return '';}

        let filtered = auftraege.filter(a => a.status === status);
        if (searchQuery) {
            filtered = filtered.filter(a =>
                (a.kunde?.name || '').toLowerCase().includes(searchQuery) ||
                a.id.toLowerCase().includes(searchQuery) ||
                (a.leistungsart || '').toLowerCase().includes(searchQuery)
            );
        }

        const cardsHtml = filtered.length === 0
            ? '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Keine Aufträge</div>'
            : filtered.map(a => renderAuftragCard(a)).join('');

        return `
            <div class="auftrag-kanban-col" data-status="${status}" style="--col-color:${cfg.color}">
                <h4 style="border-bottom-color:${cfg.color};">
                    ${cfg.icon} ${cfg.label} <span class="col-count">${filtered.length}</span>
                </h4>
                <div class="auftrag-kanban-items">${cardsHtml}</div>
            </div>
        `;
    }).join('');
}

function renderAuftragCard(a) {
    const fortschritt = a.fortschritt || 0;
    const progressClass = fortschritt < 30 ? 'low' : fortschritt < 70 ? 'mid' : 'high';
    const workers = (a.mitarbeiter || []).map(m => `<span class="worker-chip">${h(m)}</span>`).join('');
    const checkDone = (a.checkliste || []).filter(c => c.erledigt).length;
    const checkTotal = (a.checkliste || []).length;
    const statusCfg = AUFTRAG_STATUS_CONFIG[a.status];

    const letzterWechsel = a.letzterStatusWechsel || new Date(a.createdAt).getTime();
    const dauerMs = Date.now() - letzterWechsel;
    const dauerTage = Math.floor(dauerMs / 86400000);
    const dauerText = dauerTage > 0 ? `${dauerTage}d` : `${Math.floor(dauerMs / 3600000)}h`;

    const grundHtml = a.statusGrund ? `<div style="font-size:11px;color:${statusCfg?.color || 'var(--text-muted, #94a3b8)'};margin-top:4px;font-style:italic;">${h(a.statusGrund)}</div>` : '';

    const existingRechnung = (store.rechnungen || []).find(r => r.auftragId === a.id);
    const showRechnungAction = a.status === 'abgeschlossen' && !existingRechnung;
    const rechnungBtnHtml = showRechnungAction
        ? `<div style="margin-top:6px;"><button class="btn btn-small btn-primary" style="width:100%;font-size:11px;padding:4px 8px;" data-action="create-rechnung" data-id="${h(a.id)}">💰 Rechnung erstellen</button></div>`
        : (existingRechnung && a.status === 'abgeschlossen'
            ? `<div style="margin-top:6px;font-size:11px;color:var(--accent-success, #22c55e);">✅ Rechnung ${h(existingRechnung.nummer || existingRechnung.id)}</div>`
            : '');

    return `
        <div class="auftrag-card" data-action="open-detail" data-id="${h(a.id)}">
            <div class="auftrag-card-header">
                <span class="auftrag-card-title">${h(a.kunde?.name || 'Unbekannter Kunde')}</span>
                <span class="auftrag-card-id" title="Im Status seit ${dauerText}">${dauerText}</span>
            </div>
            <div class="auftrag-card-meta">
                <span>${getLeistungsartLabel(a.leistungsart)}</span>
                <span>${formatCurrency(a.angebotsWert)}</span>
                ${a.endDatum ? `<span>bis ${formatDate(a.endDatum)}</span>` : ''}
            </div>
            ${workers ? `<div class="auftrag-card-workers">${workers}</div>` : ''}
            ${grundHtml}
            <div class="auftrag-progress-bar">
                <div class="auftrag-progress-fill ${progressClass}" style="width:${fortschritt}%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:var(--text-muted);">
                <span>${fortschritt}%</span>
                ${checkTotal > 0 ? `<span>${checkDone}/${checkTotal}</span>` : ''}
            </div>
            ${rechnungBtnHtml}
        </div>
    `;
}

function renderAuftraegeList(auftraege) {
    const kanbanEl = document.getElementById('auftrag-kanban');
    if (kanbanEl) {kanbanEl.style.display = 'none';}
    const container = document.getElementById('auftraege-list');
    if (!container) {return;}
    container.style.display = '';

    let filtered = [...auftraege];
    if (currentAuftragFilter !== 'alle') {
        filtered = filtered.filter(a => a.status === currentAuftragFilter);
    }
    const searchQuery = (document.getElementById('auftrag-search')?.value || '').toLowerCase();
    if (searchQuery) {
        filtered = filtered.filter(a =>
            (a.kunde?.name || '').toLowerCase().includes(searchQuery) ||
            a.id.toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size:48px;margin-bottom:16px;">⚙️</div>
                <h3 style="margin-bottom:8px;">Keine Aufträge</h3>
                <p style="color:var(--text-secondary);margin-bottom:24px;">Aufträge entstehen aus angenommenen Angeboten.</p>
                <button class="btn btn-primary" data-action="navigate-angebote">
                    📝 Zu den Angeboten
                </button>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(a => {
        const fortschritt = a.fortschritt || 0;
        const progressClass = fortschritt < 30 ? 'low' : fortschritt < 70 ? 'mid' : 'high';
        const statusLabel = AUFTRAG_STATUS_LABELS[a.status] || a.status;
        return `
            <div class="item-card" data-action="open-detail" data-id="${h(a.id)}" style="cursor:pointer;">
                <div class="item-header">
                    <h3 class="item-title">${h(a.kunde?.name || 'Unbekannter Kunde')}</h3>
                    <span class="item-id">${h(a.id)}</span>
                </div>
                <div class="item-meta">
                    <span>${AUFTRAG_STATUS_ICONS[a.status] || ''} ${statusLabel}</span>
                    <span>${getLeistungsartLabel(a.leistungsart)}</span>
                    <span>${formatCurrency(a.angebotsWert)}</span>
                </div>
                <div class="item-progress-bar">
                    <div class="auftrag-progress-fill ${progressClass}" style="width:${fortschritt}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Auftrag form initialization (for completing orders with Stückliste)
function initAuftragForm() {
    const form = document.getElementById('form-auftrag');
    if (!form) {return;}

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const auftragId = document.getElementById('auftrag-id')?.value;
        const auftrag = store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) {return;}

        const arbeitszeit = parseFloat(document.getElementById('arbeitszeit')?.value) || 0;
        auftrag.arbeitszeit = arbeitszeit;
        auftrag.completedAt = new Date().toISOString();

        saveStore();
        addActivity('✅', `Auftrag ${auftrag.id} abgeschlossen (${arbeitszeit}h)`);
        window.AppUtils.closeModal('modal-auftrag');
        renderAuftraege();
    });

    // Stückliste: Material hinzufügen Button
    document.getElementById('btn-add-stueckliste')?.addEventListener('click', () => {
        const rows = document.getElementById('stueckliste-rows');
        if (!rows) {return;}
        const idx = rows.children.length;
        const row = document.createElement('div');
        row.className = 'stueckliste-row';
        row.innerHTML = `
            <input type="text" placeholder="Bezeichnung" class="sl-name" data-idx="${idx}">
            <input type="number" placeholder="1" value="1" min="0.1" step="0.1" class="sl-menge" data-idx="${idx}">
            <input type="text" placeholder="Stk" value="Stk" class="sl-einheit" data-idx="${idx}">
            <input type="number" placeholder="0.00" step="0.01" class="sl-ek" data-idx="${idx}">
            <input type="number" placeholder="0.00" step="0.01" class="sl-vk" data-idx="${idx}">
            <span class="sl-gesamt" data-idx="${idx}">0,00 €</span>
            <button type="button" class="btn-remove-sl" data-idx="${idx}">&times;</button>
        `;
        rows.appendChild(row);
    });
}

// Create Rechnung from Auftrag
async function createRechnungFromAuftrag(auftragId) {
    const auftrag = store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) {
        window.AppUtils.showToast('Auftrag nicht gefunden', 'error');
        return;
    }

    // Check if a Rechnung already exists for this Auftrag
    const existing = (store.rechnungen || []).find(r => r.auftragId === auftragId);
    if (existing) {
        window.AppUtils.showToast(`Rechnung ${existing.nummer || existing.id} existiert bereits für diesen Auftrag`, 'warning');
        return;
    }

    try {
        let rechnung = null;

        if (window.invoiceService) {
            // Use InvoiceService for GoBD-compliant invoice
            rechnung = await window.invoiceService.createInvoice(auftrag, {
                generatePDF: false,
                paymentTermDays: 14
            });
        } else if (window.storeService) {
            // Fallback to storeService.completeAuftrag which creates invoice internally
            rechnung = await window.storeService.completeAuftrag(auftragId);
        }

        if (rechnung) {
            window.AppUtils.showToast(
                `Rechnung ${rechnung.nummer || rechnung.id} erstellt`,
                'success'
            );
            // Refresh detail view
            if (currentDetailAuftragId === auftragId) {
                openAuftragDetail(auftragId);
            }
            renderAuftraege();
        } else {
            window.AppUtils.showToast('Rechnung konnte nicht erstellt werden', 'error');
        }
    } catch (err) {
        console.error('Fehler beim Erstellen der Rechnung:', err);
        window.AppUtils.showToast('Fehler: ' + (err.message || 'Unbekannter Fehler'), 'error');
    }
}

// Auftrag detail view handlers (tabs, status buttons, time tracking)
function initAuftragDetailHandlers() {
    // Tab switching
    document.getElementById('auftrag-detail-tabs')?.addEventListener('click', (e) => {
        const tab = e.target.closest('.auftrag-tab');
        if (!tab) {return;}
        const tabName = tab.dataset.tab;

        // Update active tab button
        document.querySelectorAll('#auftrag-detail-tabs .auftrag-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update active tab content
        const modal = document.getElementById('modal-auftrag-detail');
        modal.querySelectorAll('.auftrag-tab-content').forEach(c => c.classList.remove('active'));
        const content = modal.querySelector(`.auftrag-tab-content[data-tab="${tabName}"]`);
        if (content) {content.classList.add('active');}
    });

    // Render Zeiterfassung when tab is activated
    document.getElementById('auftrag-detail-tabs')?.addEventListener('click', (e) => {
        const tab = e.target.closest('.auftrag-tab');
        if (tab && tab.dataset.tab === 'zeiterfassung' && currentDetailAuftragId) {
            renderAuftragZeit(currentDetailAuftragId);
        }
    });

    // Status action buttons (delegated)
    document.getElementById('ad-status-actions')?.addEventListener('click', (e) => {
        // Handle "Rechnung erstellen" button
        if (e.target.closest('#ad-btn-rechnung')) {
            if (currentDetailAuftragId) {
                createRechnungFromAuftrag(currentDetailAuftragId);
            }
            return;
        }
        const btn = e.target.closest('[data-status]');
        if (!btn || !currentDetailAuftragId) {return;}
        const newStatus = btn.dataset.status;
        if (AUFTRAG_STATUS_CONFIG[newStatus]?.brauchtGrund) {
            const grund = prompt('Bitte Grund angeben:');
            if (!grund) {return;} // cancelled
            changeAuftragStatus(currentDetailAuftragId, newStatus, grund);
        } else {
            changeAuftragStatus(currentDetailAuftragId, newStatus);
        }
        openAuftragDetail(currentDetailAuftragId); // Refresh view
    });

    // Zeiterfassung: Clock in/out
    document.getElementById('ad-btn-zeit-start')?.addEventListener('click', () => {
        const ts = window.timeTrackingService;
        if (!ts || !currentDetailAuftragId) {return;}

        if (ts.isClockActive('default')) {
            ts.clockOut('default', `Auftrag ${currentDetailAuftragId}`);
            if (window.showToast) {window.showToast('Ausgestempelt', 'success');}
        } else {
            ts.clockIn('default', currentDetailAuftragId);
            // Tag active timer with auftragId
            if (ts.activeTimers['default']) {
                ts.activeTimers['default'].auftragId = currentDetailAuftragId;
                ts.saveTimers();
            }
            if (window.showToast) {window.showToast('Eingestempelt', 'success');}
        }
        renderAuftragZeit(currentDetailAuftragId);
    });

    // Zeiterfassung: Manual entry toggle
    document.getElementById('ad-btn-zeit-manuell')?.addEventListener('click', () => {
        const container = document.getElementById('ad-zeit-entries');
        if (!container || !currentDetailAuftragId) {return;}

        // Toggle inline form
        let form = container.querySelector('.ad-zeit-form');
        if (form) { form.remove(); return; }

        const today = new Date().toISOString().split('T')[0];
        const formHtml = `<div class="ad-zeit-form" style="padding:12px;background:var(--bg-secondary,#f5f5f5);border-radius:8px;margin-bottom:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                <input type="date" id="adz-date" value="${today}" class="form-input">
                <input type="time" id="adz-start" value="08:00" class="form-input">
                <input type="time" id="adz-end" value="16:00" class="form-input">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                <select id="adz-type" class="form-input">
                    <option value="arbeit">Arbeit</option>
                    <option value="fahrt">Fahrt</option>
                    <option value="pause">Pause</option>
                </select>
                <input type="text" id="adz-desc" placeholder="Beschreibung" class="form-input">
            </div>
            <button class="btn btn-success btn-small" id="adz-save">Speichern</button>
            <button class="btn btn-secondary btn-small" id="adz-cancel">Abbrechen</button>
        </div>`;
        container.insertAdjacentHTML('afterbegin', formHtml);

        container.querySelector('#adz-save')?.addEventListener('click', () => {
            const ts = window.timeTrackingService;
            if (!ts) {return;}
            const date = container.querySelector('#adz-date')?.value;
            const startTime = container.querySelector('#adz-start')?.value;
            const endTime = container.querySelector('#adz-end')?.value;
            const type = container.querySelector('#adz-type')?.value;
            const desc = container.querySelector('#adz-desc')?.value;

            if (!date || !startTime || !endTime) {
                if (window.showToast) {window.showToast('Bitte alle Felder ausfüllen', 'warning');}
                return;
            }

            ts.addEntry({
                date, startTime, endTime, type,
                description: desc || '',
                auftragId: currentDetailAuftragId,
                billable: type !== 'pause'
            });
            if (window.showToast) {window.showToast('Zeiteintrag gespeichert', 'success');}
            renderAuftragZeit(currentDetailAuftragId);
        });

        container.querySelector('#adz-cancel')?.addEventListener('click', () => {
            container.querySelector('.ad-zeit-form')?.remove();
        });
    });

    // Zeiterfassung: Delete entry (delegated)
    document.getElementById('ad-zeit-entries')?.addEventListener('click', (e) => {
        const delBtn = e.target.closest('.zeit-delete-btn');
        if (!delBtn) {return;}
        const entryId = delBtn.dataset.id;
        if (entryId && window.timeTrackingService) {
            window.timeTrackingService.deleteEntry(entryId);
            renderAuftragZeit(currentDetailAuftragId);
        }
    });
}

// Render Zeiterfassung entries for a specific Auftrag
function renderAuftragZeit(auftragId) {
    const ts = window.timeTrackingService;
    const entriesEl = document.getElementById('ad-zeit-entries');
    const totalEl = document.getElementById('ad-zeit-total');
    const startBtn = document.getElementById('ad-btn-zeit-start');

    if (!ts || !entriesEl) {return;}

    const entries = ts.getEntriesForAuftrag(auftragId);
    const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
    const totalH = Math.floor(totalMinutes / 60);
    const totalM = totalMinutes % 60;

    // Update total
    if (totalEl) {
        totalEl.innerHTML = `<span>Gesamt</span><span>${totalH}:${String(totalM).padStart(2, '0')} h (${entries.length} Einträge)</span>`;
    }

    // Update clock button state
    if (startBtn) {
        const active = ts.isClockActive('default');
        const timer = active ? ts.getActiveTimer('default') : null;
        const isThisAuftrag = timer && (timer.projectId === auftragId || timer.auftragId === auftragId);
        startBtn.textContent = isThisAuftrag ? `⏹ Ausstempeln (${timer.elapsedFormatted})` : '▶ Stempeln';
        startBtn.className = isThisAuftrag ? 'btn btn-danger' : 'btn btn-success';
    }

    // Render entries
    if (entries.length === 0) {
        entriesEl.innerHTML = '<p class="empty-state empty-state-centered">Keine Zeiteinträge</p>';
        return;
    }

    const typeLabels = { arbeit: 'Arbeit', fahrt: 'Fahrt', pause: 'Pause' };
    const typeColors = { arbeit: '#4caf50', fahrt: '#2196f3', pause: '#ff9800' };

    entriesEl.innerHTML = entries
        .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
        .map(e => `<div class="zeit-entry-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color,#eee);">
            <div>
                <strong>${h(e.date)}</strong> ${h(e.startTime)}–${h(e.endTime)}
                <span style="background:${typeColors[e.type] || '#999'};color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75em;margin-left:4px;">${h(typeLabels[e.type] || e.type)}</span>
                ${e.description ? `<br><small style="color:var(--text-secondary,#666)">${h(e.description)}</small>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <span>${ts.formatDuration(e.durationMinutes || 0)} h</span>
                <button class="zeit-delete-btn" data-id="${h(e.id)}" title="Löschen" style="background:none;border:none;cursor:pointer;color:var(--danger,#e53935);font-size:1.1em;">✕</button>
            </div>
        </div>`).join('');
}

// Open auftrag detail modal and populate it
function openAuftragDetail(auftragId) {
    currentDetailAuftragId = auftragId;
    const auftrag = store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) {return;}

    const kunde = auftrag.kunde || {};
    const statusConfig = AUFTRAG_STATUS_CONFIG[auftrag.status] || {};

    // Title
    const title = document.getElementById('auftrag-detail-title');
    if (title) {title.textContent = `Auftrag ${auftrag.id}`;}

    // Overview fields
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) {el.textContent = val || '-';} };
    setEl('ad-kunde-name', kunde.name || kunde.firma);
    setEl('ad-kunde-kontakt', [kunde.email, kunde.telefon].filter(Boolean).join(' · '));
    setEl('ad-leistungsart', auftrag.leistungsart || '');
    setEl('ad-angebotswert', auftrag.angebotsWert ? formatCurrency(auftrag.angebotsWert) : '-');

    // Status pipeline visual
    const pipeline = document.getElementById('ad-status-pipeline');
    if (pipeline) {
        const allStates = Object.entries(AUFTRAG_STATUS_CONFIG);
        pipeline.innerHTML = allStates.map(([key, cfg]) => {
            const isCurrent = key === auftrag.status;
            const isPast = cfg.order < (statusConfig.order || 0);
            return `<span class="pipeline-step ${isCurrent ? 'current' : ''} ${isPast ? 'done' : ''}">${cfg.icon} ${cfg.label}</span>`;
        }).join('');
    }

    // Status action buttons
    const actions = document.getElementById('ad-status-actions');
    if (actions && statusConfig.erlaubteUebergaenge) {
        const existingRechnung = (store.rechnungen || []).find(r => r.auftragId === auftragId);
        const showRechnungBtn = ['abgeschlossen', 'in_bearbeitung', 'qualitaetskontrolle', 'abnahme'].includes(auftrag.status) && !existingRechnung;

        actions.innerHTML = statusConfig.erlaubteUebergaenge.map(s => {
            const cfg = AUFTRAG_STATUS_CONFIG[s] || {};
            return `<button class="btn btn-small" data-status="${s}">${cfg.icon || ''} ${cfg.label || s}</button>`;
        }).join('') + (showRechnungBtn
            ? `<button class="btn btn-small btn-primary" id="ad-btn-rechnung" style="margin-left:8px;" title="Rechnung aus diesem Auftrag erstellen">💰 Rechnung erstellen</button>`
            : (existingRechnung
                ? `<span style="font-size:12px;color:var(--accent-success, #22c55e);margin-left:8px;">✅ Rechnung ${h(existingRechnung.nummer || existingRechnung.id)}</span>`
                : ''));
    }

    // Reset to first tab
    const tabs = document.querySelectorAll('#auftrag-detail-tabs .auftrag-tab');
    tabs.forEach((t, i) => t.classList.toggle('active', i === 0));
    const contents = document.querySelectorAll('#modal-auftrag-detail .auftrag-tab-content');
    contents.forEach((c, i) => c.classList.toggle('active', i === 0));

    window.AppUtils.openModal('modal-auftrag-detail');
}

// Event delegation for all data-action handlers in the Aufträge view
function initAuftraegeEventDelegation() {
    const container = document.getElementById('view-auftraege');
    if (!container) {return;}

    container.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) {return;}

        const action = actionEl.dataset.action;

        switch (action) {
            case 'open-detail': {
                const id = actionEl.dataset.id;
                if (id) {openAuftragDetail(id);}
                break;
            }
            case 'create-rechnung': {
                e.stopPropagation();
                const id = actionEl.dataset.id;
                if (id) {createRechnungFromAuftrag(id);}
                break;
            }
            case 'filter-status': {
                const filterKey = actionEl.dataset.filter;
                if (filterKey) {
                    const filterBtn = document.querySelector(`.filter-btn[data-filter="${filterKey}"]`);
                    if (filterBtn) {filterBtn.click();}
                }
                break;
            }
            case 'navigate-angebote': {
                window.navigationController?.navigateTo('angebote');
                break;
            }
        }
    });
}

// Initialize event delegation on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuftraegeEventDelegation);
} else {
    initAuftraegeEventDelegation();
}

// Export auftraege functions and state
window.AuftraegeModule = {
    renderAuftraege,
    changeAuftragStatus,
    openAuftragDetail,
    createRechnungFromAuftrag,
    renderAuftragZeit,
    initAuftragForm,
    initAuftragDetailHandlers,
    initAuftraegeEventDelegation,
    AUFTRAG_STATUS_CONFIG,
    AUFTRAG_STATUS_LABELS,
    AUFTRAG_STATUS_ICONS,
    currentAuftragFilter,
    auftragViewMode,
    currentDetailAuftragId,
    getErlaubteUebergaenge
};

// Make globally available
window.renderAuftraege = renderAuftraege;
window.changeAuftragStatus = changeAuftragStatus;
window.openAuftragDetail = openAuftragDetail;
window.createRechnungFromAuftrag = createRechnungFromAuftrag;

})();
