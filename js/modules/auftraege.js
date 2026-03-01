/* ============================================
   Aufträge Module
   Aufträge (orders/jobs) CRUD and UI management
   ============================================ */
(function() {

const { store, saveStore, addActivity, generateId, formatDate, formatCurrency, getLeistungsartLabel, h } = window.AppUtils;

// Module state
let currentAuftragFilter = 'alle';
let auftragViewMode = 'kanban';
let currentDetailAuftragId = null;

// Status configuration
const AUFTRAG_STATUS_CONFIG = {
    geplant: {
        label: 'Geplant', icon: '📋', color: '#60a5fa', order: 1,
        description: 'Auftrag erfasst, Planung läuft',
        erlaubteUebergaenge: ['material_bestellt', 'in_bearbeitung', 'pausiert', 'storniert']
    },
    material_bestellt: {
        label: 'Material bestellt', icon: '📦', color: '#a78bfa', order: 2,
        description: 'Material wurde bestellt, wartet auf Lieferung',
        erlaubteUebergaenge: ['in_bearbeitung', 'geplant', 'pausiert', 'storniert'],
        autoAktion: 'materialCheck'
    },
    in_bearbeitung: {
        label: 'In Bearbeitung', icon: '🔧', color: '#f59e0b', order: 3,
        description: 'Arbeiten laufen',
        erlaubteUebergaenge: ['qualitaetskontrolle', 'abnahme', 'pausiert', 'storniert'],
        autoAktion: 'zeitStart'
    },
    qualitaetskontrolle: {
        label: 'Qualitätskontrolle', icon: '🔍', color: '#06b6d4', order: 4,
        description: 'Arbeiten fertig, Qualitätsprüfung',
        erlaubteUebergaenge: ['in_bearbeitung', 'abnahme', 'pausiert']
    },
    abnahme: {
        label: 'Abnahme', icon: '✋', color: '#8b5cf6', order: 5,
        description: 'Wartet auf Kundenabnahme',
        erlaubteUebergaenge: ['abgeschlossen', 'in_bearbeitung', 'qualitaetskontrolle'],
        autoAktion: 'kundeNotify'
    },
    abgeschlossen: {
        label: 'Abgeschlossen', icon: '✅', color: '#22c55e', order: 6,
        description: 'Auftrag fertig, Rechnung kann erstellt werden',
        erlaubteUebergaenge: [],
        autoAktion: 'rechnungReady'
    },
    pausiert: {
        label: 'Pausiert', icon: '⏸️', color: '#94a3b8', order: 0,
        description: 'Auftrag unterbrochen',
        erlaubteUebergaenge: ['geplant', 'material_bestellt', 'in_bearbeitung', 'storniert'],
        brauchtGrund: true
    },
    storniert: {
        label: 'Storniert', icon: '❌', color: '#ef4444', order: 0,
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

function trackStatusDauer(auftrag, oldStatus, newStatus) {
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
                <div class="stat-card-mini" style="cursor:pointer;" onclick="document.querySelector('.filter-btn[data-filter=${key}]')?.click()">
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
    const total = auftraege.filter(a => !['storniert'].includes(a.status)).length || 1;

    container.innerHTML = `
        <div class="pipeline-flow">
            ${pipelineStatuses.map((key, i) => {
                const cfg = AUFTRAG_STATUS_CONFIG[key];
                const count = counts[key] || 0;
                const pct = Math.round((count / total) * 100);
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
    kanbanContainer.style.display = '';
    document.getElementById('auftraege-list').style.display = 'none';

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
                a.kunde.name.toLowerCase().includes(searchQuery) ||
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

    const grundHtml = a.statusGrund ? `<div style="font-size:11px;color:${statusCfg?.color || '#94a3b8'};margin-top:4px;font-style:italic;">${h(a.statusGrund)}</div>` : '';

    return `
        <div class="auftrag-card" onclick="openAuftragDetail('${a.id}')">
            <div class="auftrag-card-header">
                <span class="auftrag-card-title">${h(a.kunde.name)}</span>
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
        </div>
    `;
}

function renderAuftraegeList(auftraege) {
    document.getElementById('auftrag-kanban').style.display = 'none';
    const container = document.getElementById('auftraege-list');
    container.style.display = '';

    let filtered = [...auftraege];
    if (currentAuftragFilter !== 'alle') {
        filtered = filtered.filter(a => a.status === currentAuftragFilter);
    }
    const searchQuery = (document.getElementById('auftrag-search')?.value || '').toLowerCase();
    if (searchQuery) {
        filtered = filtered.filter(a =>
            a.kunde.name.toLowerCase().includes(searchQuery) ||
            a.id.toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding:60px 20px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">⚙️</div>
                <h3 style="margin-bottom:8px;">Keine Aufträge</h3>
                <p style="color:var(--text-secondary);margin-bottom:24px;">Aufträge entstehen aus angenommenen Angeboten.</p>
                <button class="btn btn-primary" onclick="window.navigationController?.navigateTo('angebote')">
                    📝 Zu den Angeboten
                </button>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(a => {
        const fortschritt = a.fortschritt || 0;
        const progressClass = fortschritt < 30 ? 'low' : fortschritt < 70 ? 'mid' : 'high';
        const statusLabel = AUFTRAG_STATUS_LABELS[a.status] || a.status;
        const workers = (a.mitarbeiter || []).join(', ');

        return `
            <div class="item-card" onclick="openAuftragDetail('${a.id}')" style="cursor:pointer;">
                <div class="item-header">
                    <h3 class="item-title">${h(a.kunde.name)}</h3>
                    <span class="item-id">${a.id}</span>
                </div>
                <div class="item-meta">
                    <span>${AUFTRAG_STATUS_ICONS[a.status] || ''} ${statusLabel}</span>
                    <span>${getLeistungsartLabel(a.leistungsart)}</span>
                    <span>${formatCurrency(a.angebotsWert)}</span>
                </div>
                <div class="item-progress-bar">
                    <div class="progress-fill ${progressClass}" style="width:${fortschritt}%"></div>
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

    // Status action buttons (delegated)
    document.getElementById('ad-status-actions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-status]');
        if (!btn || !currentDetailAuftragId) {return;}
        changeAuftragStatus(currentDetailAuftragId, btn.dataset.status);
        openAuftragDetail(currentDetailAuftragId); // Refresh view
    });
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
    setEl('ad-leistungsart', h(auftrag.leistungsart || ''));
    setEl('ad-angebotswert', auftrag.angebotswert ? formatCurrency(auftrag.angebotswert) : '-');

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
        actions.innerHTML = statusConfig.erlaubteUebergaenge.map(s => {
            const cfg = AUFTRAG_STATUS_CONFIG[s] || {};
            return `<button class="btn btn-small" data-status="${s}">${cfg.icon || ''} ${cfg.label || s}</button>`;
        }).join('');
    }

    // Reset to first tab
    const tabs = document.querySelectorAll('#auftrag-detail-tabs .auftrag-tab');
    tabs.forEach((t, i) => t.classList.toggle('active', i === 0));
    const contents = document.querySelectorAll('#modal-auftrag-detail .auftrag-tab-content');
    contents.forEach((c, i) => c.classList.toggle('active', i === 0));

    window.AppUtils.openModal('modal-auftrag-detail');
}

// Export auftraege functions and state
window.AuftraegeModule = {
    renderAuftraege,
    changeAuftragStatus,
    openAuftragDetail,
    initAuftragForm,
    initAuftragDetailHandlers,
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

})();
