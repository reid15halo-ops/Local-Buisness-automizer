/* ============================================
   MHS Workflow Demo - Application Logic
   Complete Quote-to-Invoice Workflow
   ============================================ */

// ============================================
// Core Service Shims
// logic migrated to: store-service.js, ui-helpers.js, navigation.js
// ============================================

// Data Store Access
const store = window.storeService.state;
const saveStore = () => window.storeService.save();
const addActivity = (icon, title) => window.storeService.addActivity(icon, title);
const generateId = (prefix) => window.storeService.generateId(prefix);

// Expose render functions for NavigationController
window.renderAnfragen = renderAnfragen;
window.renderAngebote = renderAngebote;
window.renderAuftraege = renderAuftraege;
window.renderRechnungen = renderRechnungen;
window.renderMahnwesen = renderMahnwesen;
window.renderBuchhaltung = renderBuchhaltung;
window.init = init;
window.updateDashboard = updateDashboard;

function renderActivities() {
    const container = document.getElementById('activity-list');
    const activities = window.storeService.state.activities || [];

    if (activities.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Aktivitäten.</p>';
        return;
    }

    container.innerHTML = activities.slice(0, 10).map(activity => `
        <div class="activity-item">
            <span class="activity-icon">${activity.icon}</span>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-time">${window.UI.getRelativeTime(activity.time)}</div>
            </div>
        </div>
    `).join('');
}

// ============================================
// Dashboard
// ============================================
function updateDashboard() {
    const offeneAnfragen = store.anfragen.filter(a => a.status === 'neu').length;
    const wartendeAngebote = store.angebote.filter(a => a.status === 'offen').length;
    const aktiveAuftraege = store.auftraege.filter(a => a.status === 'aktiv').length;
    const offeneRechnungen = store.rechnungen.filter(r => r.status === 'offen').length;

    document.getElementById('stat-anfragen').textContent = offeneAnfragen;
    document.getElementById('stat-angebote').textContent = wartendeAngebote;
    document.getElementById('stat-auftraege').textContent = aktiveAuftraege;
    document.getElementById('stat-rechnungen').textContent = offeneRechnungen;

    // Update badges
    document.getElementById('anfragen-badge').textContent = offeneAnfragen;
    document.getElementById('angebote-badge').textContent = wartendeAngebote;
    document.getElementById('auftraege-badge').textContent = aktiveAuftraege;
    document.getElementById('rechnungen-badge').textContent = offeneRechnungen;

    renderActivities();
}

// ============================================
// Anfragen (Requests)
// ============================================
function initAnfrageForm() {
    const btn = document.getElementById('btn-neue-anfrage');
    const modal = document.getElementById('modal-anfrage');
    const form = document.getElementById('form-anfrage');

    btn.addEventListener('click', () => openModal('modal-anfrage'));

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const anfrage = {
            id: generateId('ANF'),
            kunde: {
                name: document.getElementById('kunde-name').value,
                email: document.getElementById('kunde-email').value,
                telefon: document.getElementById('kunde-telefon').value
            },
            leistungsart: document.getElementById('leistungsart').value,
            beschreibung: document.getElementById('beschreibung').value,
            budget: parseFloat(document.getElementById('budget').value) || 0,
            termin: document.getElementById('termin').value,
            status: 'neu',
            createdAt: new Date().toISOString()
        };

        store.anfragen.push(anfrage);
        saveStore();

        addActivity('📥', `Neue Anfrage von ${anfrage.kunde.name}`);

        form.reset();
        closeModal('modal-anfrage');
        switchView('anfragen');
        document.querySelector('[data-view="anfragen"]').click();
    });
}

function renderAnfragen() {
    const container = document.getElementById('anfragen-list');
    const anfragen = store.anfragen.filter(a => a.status === 'neu');

    if (anfragen.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 60px 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                <h3 style="margin-bottom: 8px;">Keine Anfragen vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Erstelle deine erste Kundenanfrage um loszulegen.
                </p>
                <button class="btn btn-primary" onclick="document.getElementById('btn-neue-anfrage').click()">
                    ➕ Neue Anfrage erstellen
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = anfragen.map(a => `
        <div class="item-card">
            <div class="item-header">
                <h3 class="item-title">${window.UI.sanitize(a.kunde.name)}</h3>
                <span class="item-id">${a.id}</span>
            </div>
            <div class="item-meta">
                <span>📧 ${window.UI.sanitize(a.kunde.email) || '-'}</span>
                <span>📞 ${window.UI.sanitize(a.kunde.telefon) || '-'}</span>
                <span>📅 ${formatDate(a.termin)}</span>
            </div>
            <p class="item-description">
                <strong>${getLeistungsartLabel(a.leistungsart)}:</strong> ${window.UI.sanitize(a.beschreibung)}
            </p>
            ${a.budget ? `<p class="item-description">💰 Budget: ${formatCurrency(a.budget)}</p>` : ''}
            <div class="item-actions">
                <span class="status-badge status-neu">● Neu</span>
                <button class="btn btn-primary" onclick="createAngebotFromAnfrage('${a.id}')">
                    📝 Angebot erstellen
                </button>
            </div>
        </div>
    `).join('');
}

function getLeistungsartLabel(key) {
    const labels = {
        'metallbau': 'Metallbau / Stahlkonstruktion',
        'schweissen': 'Schweißarbeiten',
        'rohrleitungsbau': 'Rohrleitungsbau',
        'industriemontage': 'Industriemontage',
        'hydraulik': 'Hydraulikschläuche',
        'reparatur': 'Reparatur / Wartung',
        'sonstiges': 'Sonstiges'
    };
    return labels[key] || key;
}

// ============================================
// Angebote (Quotes)
// ============================================
function createAngebotFromAnfrage(anfrageId) {
    const anfrage = store.anfragen.find(a => a.id === anfrageId);
    if (!anfrage) return;

    store.currentAnfrageId = anfrageId;

    // Fill modal info
    document.getElementById('angebot-anfrage-id').value = anfrageId;
    document.getElementById('angebot-kunde-info').innerHTML = `
        <strong>${window.UI.sanitize(anfrage.kunde.name)}</strong><br>
        ${getLeistungsartLabel(anfrage.leistungsart)}<br>
        <small>${window.UI.sanitize(anfrage.beschreibung.substring(0, 100))}...</small>
    `;

    // Clear positions
    document.getElementById('positionen-list').innerHTML = '';
    addPosition();

    // Clear text
    document.getElementById('angebot-text').value = '';

    openModal('modal-angebot');
}

function initAngebotForm() {
    const form = document.getElementById('form-angebot');
    const addBtn = document.getElementById('btn-add-position');
    const aiBtn = document.getElementById('btn-ai-text');

    addBtn.addEventListener('click', addPosition);
    aiBtn.addEventListener('click', generateAIText);

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const anfrageId = document.getElementById('angebot-anfrage-id').value;
        const anfrage = store.anfragen.find(a => a.id === anfrageId);

        const positionen = [];
        document.querySelectorAll('.position-row').forEach(row => {
            const beschreibung = row.querySelector('.pos-beschreibung').value;
            const menge = parseFloat(row.querySelector('.pos-menge').value) || 0;
            const einheit = row.querySelector('.pos-einheit').value;
            const preis = parseFloat(row.querySelector('.pos-preis').value) || 0;

            if (beschreibung && menge && preis) {
                positionen.push({ beschreibung, menge, einheit, preis });
            }
        });

        const netto = positionen.reduce((sum, p) => sum + (p.menge * p.preis), 0);
        const mwst = netto * 0.19;
        const brutto = netto + mwst;

        const angebot = {
            id: generateId('ANG'),
            anfrageId,
            kunde: anfrage.kunde,
            leistungsart: anfrage.leistungsart,
            positionen,
            text: document.getElementById('angebot-text').value,
            netto,
            mwst,
            brutto,
            status: 'offen',
            createdAt: new Date().toISOString()
        };

        store.angebote.push(angebot);

        // Update Anfrage status
        anfrage.status = 'angebot-erstellt';

        saveStore();
        addActivity('📝', `Angebot ${angebot.id} für ${anfrage.kunde.name} erstellt`);

        closeModal('modal-angebot');
        switchView('angebote');
        document.querySelector('[data-view="angebote"]').click();
    });
}

function addPosition(prefill = null) {
    const container = document.getElementById('positionen-list');
    const row = document.createElement('div');
    row.className = 'position-row';

    const uniqueId = Date.now();

    row.innerHTML = `
        <div class="pos-beschreibung-wrapper">
            <input type="text" class="pos-beschreibung" placeholder="Beschreibung tippen..." 
                   data-suggest-id="${uniqueId}"
                   value="${prefill?.beschreibung || ''}"
                   autocomplete="off">
            <div class="material-suggest" id="suggest-${uniqueId}" style="display:none;"></div>
        </div>
        <input type="number" class="pos-menge" placeholder="Menge" step="0.5" value="${prefill?.menge || 1}" oninput="updateAngebotSummary()">
        <input type="text" class="pos-einheit" placeholder="Einheit" value="${prefill?.einheit || 'Stk.'}">
        <input type="number" class="pos-preis" placeholder="€/Einheit" step="0.01" value="${prefill?.preis || ''}" oninput="updateAngebotSummary()">
        <button type="button" class="position-remove" onclick="this.parentElement.remove(); updateAngebotSummary();">×</button>
    `;
    container.appendChild(row);

    // Setup autocomplete
    const input = row.querySelector('.pos-beschreibung');
    const suggestBox = row.querySelector('.material-suggest');

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length < 2) {
            suggestBox.style.display = 'none';
            return;
        }

        const materials = window.materialService?.searchMaterials(query) || [];
        if (materials.length === 0) {
            suggestBox.style.display = 'none';
            return;
        }

        suggestBox.innerHTML = materials.slice(0, 5).map(m => `
            <div class="material-suggest-item" data-material='${JSON.stringify(m)}'>
                <span class="material-suggest-name">${m.bezeichnung}</span>
                <span class="material-suggest-meta">
                    <span class="price">${formatCurrency(m.vkPreis || m.preis)}</span>
                    <span class="stock">${m.bestand} ${m.einheit}</span>
                </span>
            </div>
        `).join('');
        suggestBox.style.display = 'block';

        // Handle selection
        suggestBox.querySelectorAll('.material-suggest-item').forEach(item => {
            item.addEventListener('click', () => {
                const material = JSON.parse(item.dataset.material);
                row.querySelector('.pos-beschreibung').value = material.bezeichnung;
                row.querySelector('.pos-preis').value = material.vkPreis || material.preis;
                row.querySelector('.pos-einheit').value = material.einheit;
                suggestBox.style.display = 'none';
                updateAngebotSummary();
            });
        });
    });

    // Hide on blur (with delay for click)
    input.addEventListener('blur', () => {
        setTimeout(() => suggestBox.style.display = 'none', 200);
    });

    updateAngebotSummary();
}


function updateAngebotSummary() {
    let netto = 0;
    document.querySelectorAll('.position-row').forEach(row => {
        const menge = parseFloat(row.querySelector('.pos-menge').value) || 0;
        const preis = parseFloat(row.querySelector('.pos-preis').value) || 0;
        netto += menge * preis;
    });

    const mwst = netto * 0.19;
    const brutto = netto + mwst;

    document.getElementById('angebot-netto').textContent = formatCurrency(netto);
    document.getElementById('angebot-mwst').textContent = formatCurrency(mwst);
    document.getElementById('angebot-brutto').textContent = formatCurrency(brutto);
}

function generateAIText() {
    const anfrageId = document.getElementById('angebot-anfrage-id').value;
    const anfrage = store.anfragen.find(a => a.id === anfrageId);
    if (!anfrage) return;

    // Simulate AI text generation
    const aiBtn = document.getElementById('btn-ai-text');
    aiBtn.textContent = '⏳ Generiere...';
    aiBtn.disabled = true;

    setTimeout(() => {
        const templates = {
            'metallbau': `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage bezüglich ${anfrage.beschreibung.substring(0, 50)}.

Gerne unterbreiten wir Ihnen folgendes Angebot für die gewünschten Metallbauarbeiten. Als zertifizierter Metallbaubetrieb nach DIN EN 1090 garantieren wir höchste Qualitätsstandards und fachgerechte Ausführung.

Das Angebot umfasst alle notwendigen Materialien und Arbeitsleistungen. Änderungen im Arbeitsumfang werden nach Aufwand berechnet.

Die Arbeiten können nach Auftragserteilung innerhalb von 2-3 Wochen durchgeführt werden.

Dieses Angebot ist 30 Tage gültig. Wir freuen uns auf Ihren Auftrag!`,

            'schweissen': `Sehr geehrte Damen und Herren,

bezugnehmend auf Ihre Anfrage übersenden wir Ihnen unser Angebot für die Schweißarbeiten.

Unsere zertifizierten Schweißfachkräfte führen alle gängigen Schweißverfahren (WIG, MAG, MIG) aus. Die Qualität unserer Arbeit entspricht den höchsten Branchenstandards.

Materialien und Schweißzusätze sind im Angebot enthalten. Bei Arbeiten vor Ort wird eine Anfahrtspauschale berechnet.

Gültigkeitsdauer: 30 Tage.`,

            'default': `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage vom ${formatDate(anfrage.createdAt)}.

Gerne unterbreiten wir Ihnen für die gewünschten Leistungen folgendes Angebot.

Alle Preise verstehen sich zzgl. 19% MwSt. Das Angebot gilt 30 Tage.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
MHS Metallbau Hydraulik Service`
        };

        const text = templates[anfrage.leistungsart] || templates['default'];
        document.getElementById('angebot-text').value = text;

        aiBtn.innerHTML = '🤖 KI-Vorschlag generieren';
        aiBtn.disabled = false;
    }, 1500);
}

function renderAngebote() {
    const container = document.getElementById('angebote-list');
    const angebote = store.angebote.filter(a => a.status === 'offen');

    if (angebote.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 60px 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <h3 style="margin-bottom: 8px;">Keine Angebote vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Erstelle Angebote aus offenen Anfragen.
                </p>
                <button class="btn btn-primary" onclick="window.navigationController.navigateTo('anfragen')">
                    👀 Anfragen ansehen
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = angebote.map(a => `
        <div class="item-card">
            <div class="item-header">
                <h3 class="item-title">${window.UI.sanitize(a.kunde.name)}</h3>
                <span class="item-id">${a.id}</span>
            </div>
            <div class="item-meta">
                <span>📋 ${a.positionen.length} Positionen</span>
                <span>💰 ${formatCurrency(a.brutto)}</span>
                <span>📅 ${formatDate(a.createdAt)}</span>
            </div>
            <p class="item-description">${getLeistungsartLabel(a.leistungsart)}</p>
            <div class="item-actions">
                <span class="status-badge status-offen">● Wartet auf Annahme</span>
                <button class="btn btn-secondary btn-small" onclick="exportAngebotPDF('${h(a.id)}')">
                    PDF
                </button>
                <button class="btn btn-success" onclick="acceptAngebot('${a.id}')">
                    ✓ Auftrag erteilen
                </button>
            </div>
        </div>
    `).join('');
}

function acceptAngebot(angebotId) {
    const angebot = store.angebote.find(a => a.id === angebotId);
    if (!angebot) return;

    angebot.status = 'angenommen';

    const auftrag = {
        id: generateId('AUF'),
        angebotId,
        kunde: angebot.kunde,
        leistungsart: angebot.leistungsart,
        positionen: angebot.positionen,
        angebotsWert: angebot.brutto,
        netto: angebot.netto,
        mwst: angebot.mwst,
        status: 'aktiv',
        createdAt: new Date().toISOString()
    };

    store.auftraege.push(auftrag);
    saveStore();

    addActivity('✅', `Angebot ${angebotId} angenommen → Auftrag ${auftrag.id}`);

    switchView('auftraege');
    document.querySelector('[data-view="auftraege"]').click();
}

// ============================================
// Aufträge (Orders)
// ============================================
function renderAuftraege() {
    const container = document.getElementById('auftraege-list');
    const auftraege = store.auftraege.filter(a => a.status === 'aktiv');

    if (auftraege.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 60px 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚙️</div>
                <h3 style="margin-bottom: 8px;">Keine aktiven Aufträge</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Aufträge entstehen aus angenommenen Angeboten.
                </p>
                <button class="btn btn-primary" onclick="window.navigationController.navigateTo('angebote')">
                    📝 Angebote ansehen
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = auftraege.map(a => `
        <div class="item-card">
            <div class="item-header">
                <h3 class="item-title">${window.UI.sanitize(a.kunde.name)}</h3>
                <span class="item-id">${a.id}</span>
            </div>
            <div class="item-meta">
                <span>📋 ${getLeistungsartLabel(a.leistungsart)}</span>
                <span>💰 Angebotswert: ${formatCurrency(a.angebotsWert)}</span>
                <span>📅 Start: ${formatDate(a.createdAt)}</span>
            </div>
            <div class="item-actions">
                <span class="status-badge status-aktiv">● In Bearbeitung</span>
                <button class="btn btn-success" onclick="openAuftragModal('${a.id}')">
                    ✓ Auftrag abschließen
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================
// Stückliste (Bill of Materials) Management
// ============================================
let stuecklisteItems = []; // Current BOM items in modal

function openAuftragModal(auftragId) {
    const auftrag = store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) return;

    store.currentAuftragId = auftragId;
    document.getElementById('auftrag-id').value = auftragId;

    document.getElementById('auftrag-info').innerHTML = `
        <p><strong>${h(auftrag.kunde.name)}</strong></p>
        <p>${getLeistungsartLabel(auftrag.leistungsart)}</p>
        <p>Angebotswert: ${formatCurrency(auftrag.angebotsWert)}</p>
        <p style="font-size:12px; color:var(--text-muted);">Positionen: ${auftrag.positionen.map(p => h(p.beschreibung)).join(', ')}</p>
    `;

    document.getElementById('arbeitszeit').value = '';
    document.getElementById('material-kosten-extra').value = '0';
    document.getElementById('notizen').value = '';

    // Reset Stückliste
    stuecklisteItems = [];
    renderStueckliste();
    updateAuftragTotalSummary(auftrag);

    openModal('modal-auftrag');
}

function addStuecklisteRow(prefill = null) {
    const item = {
        id: `sl-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
        materialId: prefill?.id || prefill?.materialId || null,
        artikelnummer: prefill?.artikelnummer || '',
        bezeichnung: prefill?.bezeichnung || '',
        menge: prefill?.menge || 1,
        einheit: prefill?.einheit || 'Stk.',
        ekPreis: prefill?.preis || prefill?.ekPreis || 0,
        vkPreis: prefill?.vkPreis || 0,
        bestandVerfuegbar: prefill?.bestand || 0
    };
    stuecklisteItems.push(item);
    renderStueckliste();
    updateStuecklisteSummary();
}

function removeStuecklisteRow(itemId) {
    stuecklisteItems = stuecklisteItems.filter(i => i.id !== itemId);
    renderStueckliste();
    updateStuecklisteSummary();
}

function renderStueckliste() {
    const container = document.getElementById('stueckliste-rows');
    if (!container) return;

    if (stuecklisteItems.length === 0) {
        container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">Noch keine Materialien hinzugefügt. Klicke "Material hinzufügen" oder "Aus Bestand wählen".</div>';
        return;
    }

    container.innerHTML = stuecklisteItems.map(item => `
        <div class="stueckliste-row" data-sl-id="${item.id}">
            <div class="sl-name-wrapper">
                <input type="text" class="sl-name-input" value="${h(item.bezeichnung)}"
                    placeholder="Material suchen..." data-sl-id="${item.id}" autocomplete="off">
                <div class="sl-suggest" id="sl-suggest-${item.id}" style="display:none;"></div>
            </div>
            <input type="number" class="sl-menge" value="${item.menge}" min="0.1" step="0.5"
                data-sl-id="${item.id}" oninput="onStuecklisteChange(this)">
            <span style="font-size:13px;color:var(--text-secondary);">${h(item.einheit)}</span>
            <span style="font-size:13px;">${formatCurrency(item.ekPreis)}</span>
            <span style="font-size:13px;">${formatCurrency(item.vkPreis)}</span>
            <span class="sl-gesamt">${formatCurrency(item.menge * item.vkPreis)}</span>
            <button type="button" class="sl-remove-btn" onclick="removeStuecklisteRow('${item.id}')" title="Entfernen">&times;</button>
        </div>
    `).join('');

    // Setup autocomplete for each name input
    container.querySelectorAll('.sl-name-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const slId = e.target.dataset.slId;
            const suggestBox = document.getElementById(`sl-suggest-${slId}`);

            if (query.length < 2) {
                suggestBox.style.display = 'none';
                return;
            }

            const materials = window.materialService?.searchMaterials(query) || [];
            if (materials.length === 0) {
                suggestBox.style.display = 'none';
                return;
            }

            // Store materials for selection
            suggestBox._materials = materials.slice(0, 8);
            suggestBox.innerHTML = materials.slice(0, 8).map((m, i) => `
                <div class="sl-suggest-item" data-idx="${i}">
                    <span class="sl-suggest-name">${h(m.bezeichnung)}</span>
                    <span class="sl-suggest-meta">
                        <span>EK ${formatCurrency(m.preis)}</span>
                        <span>VK ${formatCurrency(m.vkPreis || m.preis)}</span>
                        <span>${m.bestand} ${h(m.einheit)}</span>
                    </span>
                </div>
            `).join('');
            suggestBox.style.display = 'block';

            suggestBox.querySelectorAll('.sl-suggest-item').forEach(si => {
                si.addEventListener('click', () => {
                    const mat = suggestBox._materials[parseInt(si.dataset.idx)];
                    if (!mat) return;
                    selectMaterialForStueckliste(slId, mat);
                    suggestBox.style.display = 'none';
                });
            });
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                const suggestBox = document.getElementById(`sl-suggest-${input.dataset.slId}`);
                if (suggestBox) suggestBox.style.display = 'none';
            }, 200);
        });
    });
}

function selectMaterialForStueckliste(slId, material) {
    const item = stuecklisteItems.find(i => i.id === slId);
    if (!item) return;

    item.materialId = material.id;
    item.artikelnummer = material.artikelnummer;
    item.bezeichnung = material.bezeichnung;
    item.einheit = material.einheit;
    item.ekPreis = material.preis;
    item.vkPreis = material.vkPreis || material.preis;
    item.bestandVerfuegbar = material.bestand;

    renderStueckliste();
    updateStuecklisteSummary();
}

function onStuecklisteChange(input) {
    const slId = input.dataset.slId;
    const item = stuecklisteItems.find(i => i.id === slId);
    if (!item) return;

    item.menge = parseFloat(input.value) || 0;
    // Update Gesamt in row
    const row = input.closest('.stueckliste-row');
    const gesamtEl = row?.querySelector('.sl-gesamt');
    if (gesamtEl) gesamtEl.textContent = formatCurrency(item.menge * item.vkPreis);

    updateStuecklisteSummary();
}

function updateStuecklisteSummary() {
    const totalEK = stuecklisteItems.reduce((sum, i) => sum + (i.menge * i.ekPreis), 0);
    const totalVK = stuecklisteItems.reduce((sum, i) => sum + (i.menge * i.vkPreis), 0);

    const ekEl = document.getElementById('sl-total-ek');
    const vkEl = document.getElementById('sl-total-vk');
    const margeEl = document.getElementById('sl-total-marge');

    if (ekEl) ekEl.textContent = formatCurrency(totalEK);
    if (vkEl) vkEl.textContent = formatCurrency(totalVK);
    if (margeEl) margeEl.textContent = formatCurrency(totalVK - totalEK);

    // Update total summary
    const auftragId = document.getElementById('auftrag-id')?.value;
    const auftrag = store.auftraege.find(a => a.id === auftragId);
    if (auftrag) updateAuftragTotalSummary(auftrag);
}

function updateAuftragTotalSummary(auftrag) {
    const materialVK = stuecklisteItems.reduce((sum, i) => sum + (i.menge * i.vkPreis), 0);
    const extra = parseFloat(document.getElementById('material-kosten-extra')?.value) || 0;
    const angebotNetto = auftrag.netto || 0;

    const netto = angebotNetto + materialVK + extra;
    const mwst = netto * 0.19;
    const brutto = netto + mwst;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatCurrency(val); };
    set('at-angebot-netto', angebotNetto);
    set('at-material-vk', materialVK);
    set('at-extra', extra);
    set('at-netto', netto);
    set('at-mwst', mwst);
    set('at-brutto', brutto);
}

function openStuecklisteBestandPicker() {
    const materials = window.materialService?.getAllMaterials() || [];
    if (materials.length === 0) {
        showToast('Materialbestand leer – lade Demo-Daten in der Material-Ansicht', 'warning');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'sl-picker-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>📦 Material aus Bestand wählen</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="material-filter" style="padding:0 24px;">
                <input type="text" id="sl-picker-search" placeholder="🔍 Material suchen..." style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:14px;">
            </div>
            <div class="material-picker-list" id="sl-picker-list" style="max-height:400px;overflow-y:auto;padding:12px 24px;">
                ${materials.map((m, i) => `
                    <div class="material-picker-item" data-idx="${i}" style="display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid var(--border-color);cursor:pointer;">
                        <div class="material-picker-check" style="width:20px;height:20px;border:2px solid var(--border-color);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;"></div>
                        <div style="flex:1">
                            <div style="font-weight:500;">${h(m.bezeichnung)}</div>
                            <div style="font-size:12px;color:var(--text-muted);">
                                ${h(m.artikelnummer)} · EK ${formatCurrency(m.preis)} · VK ${formatCurrency(m.vkPreis || m.preis)} · ${m.bestand} ${h(m.einheit)} auf Lager
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="form-actions" style="padding:16px 24px;">
                <button class="btn btn-secondary" id="sl-picker-cancel">Abbrechen</button>
                <button class="btn btn-primary" id="sl-picker-add">Ausgewählte hinzufügen</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const selected = new Set();
    modal.querySelectorAll('.material-picker-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.idx);
            item.classList.toggle('selected');
            if (item.classList.contains('selected')) {
                selected.add(idx);
                item.querySelector('.material-picker-check').textContent = '✓';
                item.querySelector('.material-picker-check').style.borderColor = 'var(--accent-primary)';
                item.querySelector('.material-picker-check').style.color = 'var(--accent-primary)';
            } else {
                selected.delete(idx);
                item.querySelector('.material-picker-check').textContent = '';
                item.querySelector('.material-picker-check').style.borderColor = 'var(--border-color)';
            }
        });
    });

    // Search filter
    modal.querySelector('#sl-picker-search')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        modal.querySelectorAll('.material-picker-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(q) ? 'flex' : 'none';
        });
    });

    modal.querySelector('#sl-picker-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());

    modal.querySelector('#sl-picker-add').addEventListener('click', () => {
        selected.forEach(idx => {
            const m = materials[idx];
            if (m) addStuecklisteRow(m);
        });
        if (selected.size > 0) {
            showToast(`${selected.size} Material(ien) zur Stückliste hinzugefügt`, 'success');
        }
        modal.remove();
    });
}

function suggestStuecklisteMaterials() {
    const auftragId = document.getElementById('auftrag-id')?.value;
    const auftrag = store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) return;

    // Build description from all positions
    const beschreibung = auftrag.positionen.map(p => p.beschreibung).join(' ');
    const suggestions = window.materialService?.suggestMaterials(beschreibung) || [];

    if (suggestions.length === 0) {
        showToast('Keine passenden Materialien im Bestand gefunden', 'info');
        return;
    }

    suggestions.forEach(m => {
        // Don't add duplicates
        if (!stuecklisteItems.some(i => i.materialId === m.id)) {
            addStuecklisteRow(m);
        }
    });

    showToast(`${suggestions.length} Material-Vorschläge hinzugefügt`, 'success');
}

function initAuftragForm() {
    const form = document.getElementById('form-auftrag');

    // Stückliste button handlers
    document.getElementById('btn-add-stueckliste')?.addEventListener('click', () => addStuecklisteRow());
    document.getElementById('btn-add-stueckliste-bestand')?.addEventListener('click', () => openStuecklisteBestandPicker());
    document.getElementById('btn-suggest-stueckliste')?.addEventListener('click', () => suggestStuecklisteMaterials());

    // Update total summary when extra costs change
    document.getElementById('material-kosten-extra')?.addEventListener('input', () => {
        const auftragId = document.getElementById('auftrag-id')?.value;
        const auftrag = store.auftraege.find(a => a.id === auftragId);
        if (auftrag) updateAuftragTotalSummary(auftrag);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const auftragId = document.getElementById('auftrag-id').value;
        const auftrag = store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) return;

        const arbeitszeit = parseFloat(document.getElementById('arbeitszeit').value) || 0;
        const extraMaterialKosten = parseFloat(document.getElementById('material-kosten-extra').value) || 0;
        const notizen = document.getElementById('notizen').value;

        // Collect Stückliste data
        const stueckliste = stuecklisteItems.filter(i => i.bezeichnung).map(item => ({
            materialId: item.materialId,
            artikelnummer: item.artikelnummer,
            bezeichnung: item.bezeichnung,
            menge: item.menge,
            einheit: item.einheit,
            ekPreis: item.ekPreis,
            vkPreis: item.vkPreis
        }));

        // Calculate totals
        const stuecklisteVK = stueckliste.reduce((sum, i) => sum + (i.menge * i.vkPreis), 0);
        const stuecklisteEK = stueckliste.reduce((sum, i) => sum + (i.menge * i.ekPreis), 0);
        const totalMaterialKosten = stuecklisteVK + extraMaterialKosten;

        // Update Auftrag
        auftrag.status = 'abgeschlossen';
        auftrag.arbeitszeit = arbeitszeit;
        auftrag.stueckliste = stueckliste;
        auftrag.stuecklisteVK = stuecklisteVK;
        auftrag.stuecklisteEK = stuecklisteEK;
        auftrag.extraMaterialKosten = extraMaterialKosten;
        auftrag.materialKosten = totalMaterialKosten;
        auftrag.notizen = notizen;
        auftrag.completedAt = new Date().toISOString();

        // Reduce stock for each material from Stückliste
        stueckliste.forEach(item => {
            if (item.materialId && window.materialService) {
                window.materialService.updateStock(item.materialId, -item.menge);
            }
        });

        // Create invoice with Stückliste as individual positions
        const rechnungsPositionen = [...(auftrag.positionen || [])];

        // Add Stückliste items as separate invoice positions
        stueckliste.forEach(item => {
            rechnungsPositionen.push({
                beschreibung: `Material: ${item.bezeichnung}`,
                menge: item.menge,
                einheit: item.einheit,
                preis: item.vkPreis,
                isMaterial: true,
                artikelnummer: item.artikelnummer,
                ekPreis: item.ekPreis
            });
        });

        // Add extra material costs as position if > 0
        if (extraMaterialKosten > 0) {
            rechnungsPositionen.push({
                beschreibung: 'Sonstige Materialkosten',
                menge: 1,
                einheit: 'pauschal',
                preis: extraMaterialKosten,
                isMaterial: true
            });
        }

        const netto = rechnungsPositionen.reduce((sum, p) => sum + ((p.menge || 0) * (p.preis || 0)), 0);

        const rechnung = {
            id: generateId('RE'),
            auftragId,
            angebotId: auftrag.angebotId,
            kunde: auftrag.kunde,
            leistungsart: auftrag.leistungsart,
            positionen: rechnungsPositionen,
            stueckliste: stueckliste,
            arbeitszeit: arbeitszeit,
            materialKosten: totalMaterialKosten,
            extraMaterialKosten: extraMaterialKosten,
            stuecklisteVK: stuecklisteVK,
            stuecklisteEK: stuecklisteEK,
            notizen: notizen,
            netto: netto,
            mwst: netto * 0.19,
            brutto: netto * 1.19,
            status: 'offen',
            createdAt: new Date().toISOString()
        };

        store.rechnungen.push(rechnung);
        saveStore();

        // Activity log with Stückliste info
        const slInfo = stueckliste.length > 0 ? ` (${stueckliste.length} Materialien)` : '';
        addActivity('💰', `Rechnung ${rechnung.id} erstellt (${formatCurrency(rechnung.brutto)})${slInfo}`);

        // Update material view if visible
        if (typeof renderMaterial === 'function') renderMaterial();

        closeModal('modal-auftrag');
        switchView('rechnungen');
        document.querySelector('[data-view="rechnungen"]').click();
    });
}

// ============================================
// Rechnungen (Invoices)
// ============================================
function renderRechnungen() {
    const container = document.getElementById('rechnungen-list');

    if (store.rechnungen.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px">📄</div>
                <h3>Keine Rechnungen</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px">Erstellen Sie erst einen Auftrag, um eine Rechnung zu generieren.</p>
                <button class="btn btn-secondary" onclick="document.querySelector('.nav-item[data-view=\\'auftraege\\']').click()">
                    Zu den Aufträgen
                </button>
            </div>`;
        return;
    }

    container.innerHTML = store.rechnungen.map(r => `
        <div class="item-card">
            <div class="item-header">
                <h3 class="item-title">${window.UI.sanitize(r.kunde.name)}</h3>
                <span class="item-id">${r.nummer || r.id}</span>
            </div>
            <div class="item-meta">
                <span>💰 ${formatCurrency(r.brutto)}</span>
                <span>📅 ${formatDate(r.createdAt)}</span>
                ${r.faelligkeitsdatum ? `<span>⏰ Fällig: ${formatDate(r.faelligkeitsdatum)}</span>` : ''}
            </div>
            <div class="item-actions" style="gap: 8px; display: flex; flex-wrap: wrap; align-items: center;">
                <span class="status-badge status-${r.status}">
                    ● ${r.status === 'offen' ? 'Offen' : r.status === 'bezahlt' ? 'Bezahlt' : r.status === 'storniert' ? 'Storniert' : r.status}
                </span>
                <button class="btn btn-secondary btn-sm" onclick="downloadInvoicePDF('${r.id}')" title="PDF herunterladen">
                    📄 PDF
                </button>
                <button class="btn btn-secondary btn-sm" onclick="generateEInvoice('${r.id}')" title="E-Rechnung (XRechnung)">
                    🔐 E-Rechnung
                </button>
                ${r.status === 'offen' ? `
                    <button class="btn btn-success btn-sm" onclick="markInvoiceAsPaid('${r.id}')" title="Als bezahlt markieren">
                        ✓ Bezahlt
                    </button>
                ` : ''}
                <button class="btn btn-primary" onclick="showRechnung('${r.id}')">
                    👁 Anzeigen
                </button>
            </div>
        </div>
    `).join('');
}

function showRechnung(rechnungId) {
    const rechnung = store.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) return;

    store.currentRechnungId = rechnungId;

    const preview = document.getElementById('rechnung-preview');
    preview.innerHTML = `
        <div class="rechnung-header">
            <div class="rechnung-firma">
                ⚙️ MHS Metallbau<br>
                <small style="font-weight: 400; font-size: 14px;">Hydraulik Service</small>
            </div>
            <div class="rechnung-nummer">
                <h3>Rechnung</h3>
                <p>${rechnung.id}</p>
            </div>
        </div>

        <div class="rechnung-adressen">
            <div>
                <div class="rechnung-label">Absender</div>
                <p>
                    MHS Metallbau Hydraulik Service<br>
                    Handwerkerring 38a<br>
                    63776 Mömbris-Rothengrund<br>
                    Tel: +49 6029 99 22 96 4
                </p>
            </div>
            <div>
                <div class="rechnung-label">Rechnungsempfänger</div>
                <p>
                    ${window.UI.sanitize(rechnung.kunde.name)}<br>
                    ${window.UI.sanitize(rechnung.kunde.email) || ''}<br>
                    ${window.UI.sanitize(rechnung.kunde.telefon) || ''}
                </p>
            </div>
        </div>

        <p style="margin-bottom: 20px;">
            <strong>Rechnungsdatum:</strong> ${formatDate(rechnung.createdAt)}<br>
            <strong>Leistungszeitraum:</strong> ${getLeistungsartLabel(rechnung.leistungsart)}
        </p>

        <table class="rechnung-table">
            <thead>
                <tr>
                    <th>Pos.</th>
                    <th>Beschreibung</th>
                    <th>Menge</th>
                    <th class="text-right">Einzelpreis</th>
                    <th class="text-right">Gesamt</th>
                </tr>
            </thead>
            <tbody>
                ${(() => {
                    const leistungen = (rechnung.positionen || []).filter(p => !p.isMaterial);
                    const materialien = (rechnung.positionen || []).filter(p => p.isMaterial);
                    let pos = 0;
                    let rows = '';

                    // Leistungspositionen (service items from Angebot)
                    leistungen.forEach(p => {
                        pos++;
                        rows += `<tr>
                            <td>${pos}</td>
                            <td>${h(p.beschreibung)}</td>
                            <td>${p.menge} ${h(p.einheit)}</td>
                            <td class="text-right">${formatCurrency(p.preis)}</td>
                            <td class="text-right">${formatCurrency((p.menge || 0) * (p.preis || 0))}</td>
                        </tr>`;
                    });

                    // Stückliste / Materialien section
                    if (materialien.length > 0) {
                        rows += `<tr class="rechnung-section-header">
                            <td colspan="5" style="font-weight:600; padding-top:16px; border-bottom:2px solid var(--border-color);">
                                Materialien / Stückliste
                            </td>
                        </tr>`;
                        materialien.forEach(p => {
                            pos++;
                            rows += `<tr>
                                <td>${pos}</td>
                                <td>${h(p.beschreibung)}${p.artikelnummer ? ` <span style="color:var(--text-muted);font-size:12px;">(${h(p.artikelnummer)})</span>` : ''}</td>
                                <td>${p.menge} ${h(p.einheit)}</td>
                                <td class="text-right">${formatCurrency(p.preis)}</td>
                                <td class="text-right">${formatCurrency((p.menge || 0) * (p.preis || 0))}</td>
                            </tr>`;
                        });
                    }

                    // Legacy fallback: old invoices without isMaterial flag
                    if (materialien.length === 0 && rechnung.materialKosten > 0) {
                        pos++;
                        rows += `<tr>
                            <td>${pos}</td>
                            <td>Materialkosten</td>
                            <td>1</td>
                            <td class="text-right">${formatCurrency(rechnung.materialKosten)}</td>
                            <td class="text-right">${formatCurrency(rechnung.materialKosten)}</td>
                        </tr>`;
                    }

                    return rows;
                })()}
            </tbody>
        </table>

        ${rechnung.stueckliste?.length > 0 ? `
        <div class="rechnung-stueckliste" style="margin-top:16px;padding:12px 16px;background:var(--bg-secondary);border-radius:8px;font-size:13px;">
            <strong>Materialmarge:</strong>
            EK gesamt: ${formatCurrency(rechnung.stuecklisteEK || 0)} ·
            VK gesamt: ${formatCurrency(rechnung.stuecklisteVK || 0)} ·
            Marge: <span style="color:var(--accent-primary);font-weight:600;">${formatCurrency((rechnung.stuecklisteVK || 0) - (rechnung.stuecklisteEK || 0))}</span>
        </div>
        ` : ''}

        <div class="rechnung-totals">
            <table>
                <tr>
                    <td>Nettobetrag:</td>
                    <td class="text-right">${formatCurrency(rechnung.netto)}</td>
                </tr>
                <tr>
                    <td>MwSt. 19%:</td>
                    <td class="text-right">${formatCurrency(rechnung.mwst)}</td>
                </tr>
                <tr class="total-row">
                    <td>Gesamtbetrag:</td>
                    <td class="text-right">${formatCurrency(rechnung.brutto)}</td>
                </tr>
            </table>
        </div>

        <p style="margin-top: 30px; font-size: 13px; color: #666;">
            Zahlungsziel: 14 Tage ohne Abzug<br>
            Bankverbindung: Sparkasse Aschaffenburg | IBAN: DE00 0000 0000 0000 0000 00
        </p>
    `;

    // Update button visibility
    const paidBtn = document.getElementById('btn-mark-paid');
    paidBtn.style.display = rechnung.status === 'offen' ? 'inline-flex' : 'none';

    openModal('modal-rechnung');
}

function initRechnungActions() {
    document.getElementById('btn-pdf-export').addEventListener('click', async () => {
        if (!store.currentRechnungId) return;
        const rechnung = store.rechnungen.find(r => r.id === store.currentRechnungId);
        if (!rechnung) return;

        try {
            showToast('PDF wird erstellt...', 'info');
            await window.pdfService.generateRechnung(rechnung);
            showToast(`Rechnung ${rechnung.id} als PDF gespeichert`, 'success');
        } catch (err) {
            console.error('PDF generation error:', err);
            showToast('PDF-Erstellung fehlgeschlagen: ' + err.message, 'error');
        }
    });

    document.getElementById('btn-mark-paid').addEventListener('click', () => {
        if (!store.currentRechnungId) return;

        const rechnung = store.rechnungen.find(r => r.id === store.currentRechnungId);
        if (rechnung) {
            rechnung.status = 'bezahlt';
            rechnung.paidAt = new Date().toISOString();
            saveStore();

            addActivity('✅', `Rechnung ${rechnung.id} als bezahlt markiert`);
            closeModal('modal-rechnung');
            renderRechnungen();
            updateDashboard();
        }
    });
}

// ============================================
// Modal Management
// ============================================
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = '';
}

function initModals() {
    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            overlay.closest('.modal').classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Close on X button
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
            document.body.style.overflow = '';
        }
    });
}

// ============================================
// Material Management
// ============================================
function renderMaterial() {
    const materials = window.materialService?.getAllMaterials() || [];
    const container = document.getElementById('material-list');

    // Update stats
    document.getElementById('material-count').textContent = materials.length;
    const lagerwert = materials.reduce((sum, m) => sum + (m.bestand * m.preis), 0);
    document.getElementById('material-value').textContent = formatCurrency(lagerwert);
    const lowStock = window.materialService?.getLowStockItems() || [];
    document.getElementById('material-low').textContent = lowStock.length;
    document.getElementById('material-badge').textContent = materials.length;

    // Update kategorie filter
    const kategorien = window.materialService?.getKategorien() || [];
    const filterSelect = document.getElementById('material-kategorie-filter');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Alle Kategorien</option>' +
            kategorien.map(k => `<option value="${k}">${k}</option>`).join('');
    }

    if (materials.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 60px 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                <h3 style="margin-bottom: 8px;">Keine Materialien vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Importiere deine Materialliste aus Excel oder lade Demo-Daten.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button class="btn btn-secondary" onclick="window.materialService.loadDemoData(); renderMaterial();">
                        🎲 Demo-Daten laden
                    </button>
                    <button class="btn btn-primary" onclick="document.getElementById('material-import').click()">
                        📊 Excel importieren
                    </button>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = materials.map(m => {
        const isLow = m.bestand <= m.minBestand && m.minBestand > 0;
        return `
            <div class="item-card">
                <div class="material-card">
                    <div class="material-info">
                        <span class="material-name">${m.bezeichnung}</span>
                        <span class="material-sku">${m.artikelnummer}</span>
                    </div>
                    <span class="material-kategorie">${m.kategorie}</span>
                    <div class="material-preis">
                        <div class="vk">${formatCurrency(m.vkPreis || m.preis)}</div>
                        <div class="ek">EK: ${formatCurrency(m.preis)}</div>
                    </div>
                    <div class="material-bestand ${isLow ? 'low' : ''}">
                        <div class="count">${m.bestand}</div>
                        <div class="unit">${m.einheit}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function initMaterial() {
    // Excel Import
    const excelInput = document.getElementById('excel-import');
    if (excelInput) {
        excelInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                showToast('📥 Importiere Excel...', 'info');
                const result = await window.materialService.importFromExcel(file);
                showToast(`✅ ${result.count} Artikel importiert!`, 'success');
                renderMaterial();
                addActivity('📦', `${result.count} Materialien aus Excel importiert`);
            } catch (error) {
                console.error('Excel import error:', error);
                showToast('❌ Fehler beim Import: ' + error.message, 'error');
            }
            excelInput.value = '';
        });
    }

    // Demo Materials Button
    const demoBtn = document.getElementById('btn-demo-materials');
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            window.materialService.loadDemoMaterials();
            renderMaterial();
            showToast('✅ Demo-Materialien geladen!', 'success');
            addActivity('📦', 'Demo-Materialbestand geladen (10 Artikel)');
        });
    }

    // Search
    const searchInput = document.getElementById('material-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const materials = query ?
                window.materialService.searchMaterials(query) :
                window.materialService.getAllMaterials();
            renderMaterialList(materials);
        });
    }
}

function renderMaterialList(materials) {
    const container = document.getElementById('material-list');
    if (materials.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine Treffer</p>';
        return;
    }
    container.innerHTML = materials.map(m => {
        const isLow = m.bestand <= m.minBestand && m.minBestand > 0;
        return `
            <div class="item-card">
                <div class="material-card">
                    <div class="material-info">
                        <span class="material-name">${m.bezeichnung}</span>
                        <span class="material-sku">${m.artikelnummer}</span>
                    </div>
                    <span class="material-kategorie">${m.kategorie}</span>
                    <div class="material-preis">
                        <div class="vk">${formatCurrency(m.vkPreis || m.preis)}</div>
                        <div class="ek">EK: ${formatCurrency(m.preis)}</div>
                    </div>
                    <div class="material-bestand ${isLow ? 'low' : ''}">
                        <div class="count">${m.bestand}</div>
                        <div class="unit">${m.einheit}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// Settings / Einstellungen
// ============================================
function initSettings() {
    // Load saved values
    const geminiKey = localStorage.getItem('gemini_api_key');
    const stundensatz = localStorage.getItem('stundensatz') || '65';
    const webhookUrl = localStorage.getItem('n8n_webhook_url');

    if (document.getElementById('gemini-api-key')) {
        document.getElementById('gemini-api-key').value = geminiKey || '';
        document.getElementById('stundensatz').value = stundensatz;
        document.getElementById('n8n-webhook-url').value = webhookUrl || '';

        // Update status indicators
        updateSettingsStatus();
    }

    // Save Gemini API Key
    document.getElementById('btn-save-gemini')?.addEventListener('click', () => {
        const key = document.getElementById('gemini-api-key').value.trim();
        localStorage.setItem('gemini_api_key', key);
        window.geminiService = new GeminiService(key);
        updateSettingsStatus();
        showToast('✅ Gemini API Key gespeichert!', 'success');
    });

    // Save Stundensatz
    document.getElementById('btn-save-stundensatz')?.addEventListener('click', () => {
        const satz = document.getElementById('stundensatz').value;
        localStorage.setItem('stundensatz', satz);
        window.materialService?.setStundensatz(parseFloat(satz));
        showToast('✅ Stundensatz gespeichert!', 'success');
    });

    // Save Webhook URL
    document.getElementById('btn-save-webhook')?.addEventListener('click', () => {
        const url = document.getElementById('n8n-webhook-url').value.trim();
        localStorage.setItem('n8n_webhook_url', url);
        updateSettingsStatus();
        showToast('✅ Webhook URL gespeichert!', 'success');
    });

    // Export Data
    document.getElementById('btn-export-data')?.addEventListener('click', () => {
        const data = {
            store: store,
            materials: window.materialService?.getAllMaterials() || [],
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mhs-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        showToast('📥 Daten exportiert!', 'success');
    });

    // Invoice Template Settings
    document.getElementById('btn-save-template')?.addEventListener('click', () => {
        const templateId = document.getElementById('invoice-template').value;
        localStorage.setItem('default_invoice_template', templateId);
        showToast('✅ Template-Einstellung gespeichert!', 'success');
    });

    // Invoice Numbering Settings
    document.getElementById('btn-save-invoice-numbering')?.addEventListener('click', async () => {
        try {
            const prefix = document.getElementById('invoice-prefix').value;
            const format = document.getElementById('invoice-format').value;
            const yearlyReset = document.getElementById('invoice-yearly-reset').checked;

            if (window.invoiceNumberingService) {
                const userId = window.storeService?.getCurrentUserId?.() || 'default';
                await window.invoiceNumberingService.updateConfig(userId, {
                    prefix: prefix,
                    format: format,
                    resetYearly: yearlyReset
                });

                // Update preview
                await updateInvoiceNumberPreview();

                showToast('✅ Rechnungsnummern-Einstellung gespeichert!', 'success');
            } else {
                showToast('❌ Invoice Service nicht verfügbar', 'error');
            }
        } catch (error) {
            console.error('Error saving invoice numbering:', error);
            showToast('❌ Fehler beim Speichern', 'error');
        }
    });

    // Load invoice numbering preview
    updateInvoiceNumberPreview();

    // Clear Data
    document.getElementById('btn-clear-data')?.addEventListener('click', () => {
        if (confirm('Wirklich ALLE Daten löschen? Dies kann nicht rückgängig gemacht werden!')) {
            localStorage.clear();
            location.reload();
        }
    });
}

// Generate a unique sender email on first app launch
function generateSenderEmail() {
    // Try to build from company name in settings
    const settings = window.storeService?.state?.settings || {};
    const firmaName = settings.companyName || settings.firmenname || settings.firma || '';

    let slug = '';
    if (firmaName) {
        // Convert "Müller Metallbau GmbH" → "mueller-metallbau"
        slug = firmaName
            .toLowerCase()
            .replace(/gmbh|gbr|kg|ohg|ag|ug|e\.k\.|co\./gi, '')
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 30);
    }

    if (!slug) {
        // Fallback: generate short unique ID
        slug = 'firma-' + crypto.randomUUID().substring(0, 8);
    }

    // Use plus-addressing on the Proton Mail base address
    const baseEmail = localStorage.getItem('proton_base_email') || 'noreply@handwerkflow.de';
    const [localPart, domain] = baseEmail.split('@');
    const senderEmail = `${localPart}+${slug}@${domain}`;

    localStorage.setItem('sender_email', senderEmail);
    localStorage.setItem('sender_email_slug', slug);

    // Update UI
    const emailField = document.getElementById('sender-email');
    if (emailField) emailField.value = senderEmail;

    console.log('Auto-generated sender email:', senderEmail);
    return senderEmail;
}

function initAutomationSettings() {
    // Load saved values
    const relayUrl = localStorage.getItem('email_relay_url');
    const relaySecret = localStorage.getItem('email_relay_secret');
    const senderEmail = localStorage.getItem('sender_email');
    const twilioSid = localStorage.getItem('twilio_sid');
    const twilioToken = localStorage.getItem('twilio_token');
    const twilioFrom = localStorage.getItem('twilio_from');

    if (document.getElementById('email-relay-url')) {
        document.getElementById('email-relay-url').value = relayUrl || '';
        document.getElementById('email-relay-secret').value = relaySecret || '';
        document.getElementById('sender-email').value = senderEmail || '';
    }
    if (document.getElementById('twilio-sid')) {
        document.getElementById('twilio-sid').value = twilioSid || '';
        document.getElementById('twilio-token').value = twilioToken || '';
        document.getElementById('twilio-from').value = twilioFrom || '';
    }

    // Auto-generate sender email on first launch
    if (!senderEmail) {
        generateSenderEmail();
    }

    // Save Email config
    document.getElementById('btn-save-email-config')?.addEventListener('click', () => {
        const url = document.getElementById('email-relay-url').value.trim();
        const secret = document.getElementById('email-relay-secret').value.trim();
        localStorage.setItem('email_relay_url', url);
        localStorage.setItem('email_relay_secret', secret);
        updateSettingsStatus();
        showToast('E-Mail-Konfiguration gespeichert', 'success');
    });

    // Test Email
    document.getElementById('btn-test-email')?.addEventListener('click', async () => {
        if (!window.automationAPI?.isAvailable()) {
            showToast('Supabase muss zuerst konfiguriert sein', 'warning');
            return;
        }
        const email = localStorage.getItem('sender_email');
        if (!email) {
            showToast('Absender-E-Mail konnte nicht generiert werden', 'warning');
            return;
        }
        showToast('Sende Test-E-Mail...', 'info');
        const result = await window.automationAPI.sendEmail(
            email, 'HandwerkFlow Test', 'Diese Test-E-Mail bestätigt, dass der E-Mail-Versand über Proton Mail funktioniert.'
        );
        showToast(result.success ? 'Test-E-Mail gesendet!' : 'Fehler: ' + result.error, result.success ? 'success' : 'error');
    });

    // Save SMS config
    document.getElementById('btn-save-sms-config')?.addEventListener('click', () => {
        localStorage.setItem('twilio_sid', document.getElementById('twilio-sid').value.trim());
        localStorage.setItem('twilio_token', document.getElementById('twilio-token').value.trim());
        localStorage.setItem('twilio_from', document.getElementById('twilio-from').value.trim());
        updateSettingsStatus();
        showToast('SMS-Konfiguration gespeichert', 'success');
    });

    // Check overdue manually
    document.getElementById('btn-check-overdue')?.addEventListener('click', async () => {
        if (!window.automationAPI?.isAvailable()) {
            showToast('Supabase muss zuerst konfiguriert sein', 'warning');
            return;
        }
        showToast('Prüfe überfällige Rechnungen...', 'info');
        const result = await window.automationAPI.checkOverdue();
        if (result.success) {
            showToast(`Geprüft: ${result.checked} Rechnungen, ${result.reminders_sent} Mahnungen gesendet`, 'success');
        } else {
            showToast('Fehler: ' + result.error, 'error');
        }
    });

    updateSettingsStatus();
}

function updateSettingsStatus() {
    const geminiKey = localStorage.getItem('gemini_api_key');
    const webhookUrl = localStorage.getItem('n8n_webhook_url');
    const relayUrl = localStorage.getItem('email_relay_url');
    const relaySecret = localStorage.getItem('email_relay_secret');
    const emailConfigured = relayUrl && relaySecret;
    const twilioSid = localStorage.getItem('twilio_sid');

    const geminiStatus = document.getElementById('gemini-status');
    const webhookStatus = document.getElementById('webhook-status');
    const emailStatus = document.getElementById('email-status');
    const smsStatus = document.getElementById('sms-status');

    const setStatus = (el, configured) => {
        if (!el) return;
        el.textContent = configured ? '● Konfiguriert' : '● Nicht konfiguriert';
        el.className = 'status-indicator' + (configured ? ' connected' : '');
    };

    setStatus(geminiStatus, geminiKey);
    setStatus(webhookStatus, webhookUrl);
    setStatus(emailStatus, emailConfigured);
    setStatus(smsStatus, twilioSid);

    // Automation status panel
    const supabaseOk = window.supabaseConfig?.isConfigured();
    const setAutoStatus = (id, ok, label) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = ok ? label || 'Aktiv' : 'Nicht konfiguriert';
        el.style.color = ok ? 'var(--accent-primary)' : 'var(--text-muted)';
    };

    setAutoStatus('auto-status-supabase', supabaseOk, 'Verbunden');
    setAutoStatus('auto-status-email', supabaseOk && emailConfigured, 'Proton Mail Bereit');
    setAutoStatus('auto-status-sms', supabaseOk && twilioSid, 'Bereit');
    setAutoStatus('auto-status-overdue', supabaseOk && emailConfigured, 'Automatisch (tägl. 08:00)');
    setAutoStatus('auto-status-webhook', webhookUrl, 'Konfiguriert');
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// Enhanced AI Text Generation (Real Gemini)
// ============================================
async function generateAITextReal() {
    const anfrageId = document.getElementById('angebot-anfrage-id').value;
    const anfrage = store.anfragen.find(a => a.id === anfrageId);
    if (!anfrage) return;

    const aiBtn = document.getElementById('btn-ai-text');
    aiBtn.innerHTML = '⏳ Generiere mit Gemini...';
    aiBtn.disabled = true;

    try {
        const text = await window.geminiService.generateAngebotText(anfrage);
        document.getElementById('angebot-text').value = text;
        showToast('✅ KI-Text generiert!', 'success');
    } catch (error) {
        console.error('AI generation error:', error);
        showToast('❌ Fehler bei KI-Generierung', 'error');
    } finally {
        aiBtn.innerHTML = '🤖 KI-Vorschlag generieren';
        aiBtn.disabled = false;
    }
}

// Override generateAIText if Gemini is configured
const originalGenerateAIText = generateAIText;
generateAIText = function () {
    if (window.geminiService?.isConfigured) {
        generateAITextReal();
    } else {
        originalGenerateAIText();
    }
};

// ============================================
// Extended Navigation
// ============================================
function switchViewExtended(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById(`view-${viewId}`);
    if (viewEl) {
        viewEl.classList.add('active');
    }

    // Refresh content
    switch (viewId) {
        case 'dashboard': updateDashboard(); break;
        case 'anfragen': renderAnfragen(); break;
        case 'angebote': renderAngebote(); break;
        case 'auftraege': renderAuftraege(); break;
        case 'rechnungen': renderRechnungen(); break;
        case 'material': renderMaterial(); break;
        case 'mahnwesen': renderMahnwesen(); break;
        case 'buchhaltung': renderBuchhaltung(); break;
        case 'einstellungen': updateSettingsStatus(); break;
    }
}

// Override switchView
switchView = switchViewExtended;

// ============================================
// Mahnwesen Rendering
// ============================================
function renderMahnwesen() {
    const rechnungen = store.rechnungen.filter(r => r.status === 'offen');
    const overdueItems = window.dunningService?.checkAllOverdueInvoices(rechnungen) || [];
    const inkassoFaelle = window.dunningService?.getInkassoFaelle() || [];

    // Update stats
    document.getElementById('dunning-count').textContent = overdueItems.length;
    const totalSum = overdueItems.reduce((sum, item) => sum + item.rechnung.brutto, 0);
    document.getElementById('dunning-total').textContent = formatCurrency(totalSum);
    document.getElementById('dunning-inkasso').textContent = inkassoFaelle.length;
    document.getElementById('mahnwesen-badge').textContent = overdueItems.length;

    const container = document.getElementById('dunning-list');
    if (overdueItems.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine überfälligen Rechnungen 🎉</p>';
        return;
    }

    container.innerHTML = overdueItems.map(item => {
        const { rechnung, status } = item;
        const isCritical = status.stufe.typ.startsWith('mahnung') || status.stufe.typ === 'inkasso';

        return `
            <div class="dunning-card ${isCritical ? 'critical' : 'overdue'}">
                <div class="dunning-info">
                    <div class="dunning-kunde">${rechnung.kunde.name}</div>
                    <div class="dunning-status">
                        <span>📄 ${rechnung.id}</span>
                        <span>💰 ${formatCurrency(rechnung.brutto)}</span>
                        <span>📅 ${status.tageOffen} Tage offen</span>
                        <span class="status-badge ${isCritical ? 'status-offen' : 'status-neu'}">
                            ${status.stufe.name}
                        </span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-warning" onclick="openMahnungModal('${rechnung.id}')">
                        📧 ${status.stufe.typ === 'erinnerung' ? 'Erinnerung' : 'Mahnung'} erstellen
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openMahnungModal(rechnungId) {
    const rechnung = store.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) return;

    const status = window.dunningService.checkRechnungStatus(rechnung);
    const text = window.dunningService.generateMahnText(rechnung, status.stufe);

    document.getElementById('mahnung-preview').textContent = text;
    store.currentMahnungRechnungId = rechnungId;
    store.currentMahnungStufe = status.stufe;

    openModal('modal-mahnung');
}

function initMahnwesen() {
    // Send Mahnung
    document.getElementById('btn-send-mahnung')?.addEventListener('click', () => {
        const rechnungId = store.currentMahnungRechnungId;
        const stufe = store.currentMahnungStufe;
        const rechnung = store.rechnungen.find(r => r.id === rechnungId);

        if (rechnung && stufe) {
            window.dunningService.erstelleMahnung(rechnung, stufe);
            addActivity('⚠️', `${stufe.name} für ${rechnung.kunde.name} erstellt`);
            showToast(`✅ ${stufe.name} wurde erstellt!`, 'success');
            closeModal('modal-mahnung');
            renderMahnwesen();
        }
    });

    // PDF Mahnung
    document.getElementById('btn-print-mahnung')?.addEventListener('click', async () => {
        const rechnungId = store.currentMahnungRechnungId;
        const stufe = store.currentMahnungStufe;
        const rechnung = store.rechnungen.find(r => r.id === rechnungId);
        if (!rechnung) return;

        const level = stufe?.level || 1;
        const fee = stufe?.gebuehr || 0;
        await exportMahnungPDF(rechnungId, level, fee);
    });
}

// ============================================
// Buchhaltung Rendering
// ============================================
function renderBuchhaltung() {
    const jahr = parseInt(document.getElementById('buchhaltung-jahr')?.value || new Date().getFullYear());
    const eur = window.bookkeepingService?.berechneEUR(jahr) || {};

    // Update EÜR summary
    document.getElementById('eur-einnahmen').textContent = formatCurrency(eur.einnahmen?.brutto || 0);
    document.getElementById('eur-einnahmen-netto').textContent = formatCurrency(eur.einnahmen?.netto || 0);
    document.getElementById('eur-ust').textContent = formatCurrency(eur.einnahmen?.ust || 0);

    document.getElementById('eur-ausgaben').textContent = formatCurrency(eur.ausgaben?.brutto || 0);
    document.getElementById('eur-ausgaben-netto').textContent = formatCurrency(eur.ausgaben?.netto || 0);
    document.getElementById('eur-vst').textContent = formatCurrency(eur.ausgaben?.vorsteuer || 0);

    document.getElementById('eur-gewinn').textContent = formatCurrency(eur.gewinn || 0);
    document.getElementById('eur-zahllast').textContent = formatCurrency(eur.ustZahllast || 0);

    // Render buchungen
    const buchungen = window.bookkeepingService?.getBuchungenForJahr(jahr) || [];
    const container = document.getElementById('buchungen-list');

    if (buchungen.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Buchungen. Rechnungen werden automatisch erfasst.</p>';
        return;
    }

    container.innerHTML = buchungen.slice().reverse().slice(0, 20).map(b => `
        <div class="buchung-item">
            <div class="buchung-datum">${formatDate(b.datum)}</div>
            <div class="buchung-beschreibung">
                ${b.beschreibung}
                <small>${b.belegnummer || b.id}</small>
            </div>
            <div class="buchung-kategorie">${b.kategorie}</div>
            <div class="buchung-betrag ${b.typ}">
                ${b.typ === 'einnahme' ? '+' : '-'}${formatCurrency(b.brutto)}
            </div>
        </div>
    `).join('');
}

function initBuchhaltung() {
    // Year filter
    document.getElementById('buchhaltung-jahr')?.addEventListener('change', () => {
        renderBuchhaltung();
    });

    // Add ausgabe button
    document.getElementById('btn-add-ausgabe')?.addEventListener('click', () => {
        document.getElementById('ausgabe-datum').value = new Date().toISOString().slice(0, 10);
        openModal('modal-ausgabe');
    });

    // Ausgabe form
    document.getElementById('form-ausgabe')?.addEventListener('submit', (e) => {
        e.preventDefault();

        const ausgabe = {
            kategorie: document.getElementById('ausgabe-kategorie').value,
            beschreibung: document.getElementById('ausgabe-beschreibung').value,
            betrag: parseFloat(document.getElementById('ausgabe-betrag').value),
            datum: document.getElementById('ausgabe-datum').value,
            belegnummer: document.getElementById('ausgabe-beleg').value
        };

        window.bookkeepingService.addAusgabe(ausgabe);
        addActivity('📉', `Ausgabe erfasst: ${ausgabe.beschreibung}`);
        showToast('✅ Ausgabe wurde gespeichert!', 'success');

        e.target.reset();
        closeModal('modal-ausgabe');
        renderBuchhaltung();
    });

    // CSV Export
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
        const jahr = parseInt(document.getElementById('buchhaltung-jahr').value);
        const csv = window.bookkeepingService.exportCSV(jahr);

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `buchhaltung-${jahr}.csv`;
        a.click();

        showToast('📥 CSV exportiert!', 'success');
    });

    // DATEV Export
    document.getElementById('btn-export-datev')?.addEventListener('click', () => {
        const jahr = parseInt(document.getElementById('buchhaltung-jahr').value);
        const datev = window.bookkeepingService.exportDATEV(jahr);

        const blob = new Blob([datev], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DATEV-${jahr}.csv`;
        a.click();

        showToast('📤 DATEV Export erstellt!', 'success');
    });

    // CSV Import
    document.getElementById('buchung-csv-import')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const content = await file.text();
            const result = window.bookkeepingService.importFromCSV(content);

            if (result.imported > 0) {
                showToast(`✅ ${result.imported} Buchungen importiert!`, 'success');
                addActivity('📤', `CSV Import: ${result.imported} Buchungen`);
                renderBuchhaltung();
            }

            if (result.errors.length > 0) {
                console.warn('Import-Fehler:', result.errors);
                if (result.imported === 0) {
                    showToast(`⚠️ Fehler beim Import: ${result.errors[0]}`, 'error');
                }
            }
        } catch (err) {
            showToast(`❌ Import-Fehler: ${err.message}`, 'error');
        }

        // Reset input
        e.target.value = '';
    });
}


// ============================================
// Enhance Rechnung with Bookkeeping Entry
// ============================================
const originalMarkPaid = document.getElementById('btn-mark-paid');
if (originalMarkPaid) {
    const oldHandler = originalMarkPaid.onclick;
    originalMarkPaid.addEventListener('click', () => {
        const rechnung = store.rechnungen.find(r => r.id === store.currentRechnungId);
        if (rechnung && rechnung.status === 'offen') {
            // Add to bookkeeping when paid
            window.bookkeepingService?.addFromRechnung(rechnung);
        }
    });
}

// ============================================
// Initialize Application
// ============================================
async function init() {
    // Await store service load (migrates from localStorage if needed)
    await window.storeService.load();

    initAnfrageForm();
    initAngebotForm();
    initAuftragForm();
    initRechnungActions();
    initMaterial();
    initSettings();
    initAutomationSettings();
    initMahnwesen();
    initBuchhaltung();
    initQuickActions();

    // Initialize automation API
    window.automationAPI?.init();

    updateDashboard();
}


// ============================================
// Quick Actions
// ============================================
function initQuickActions() {
    // New Anfrage
    document.getElementById('qa-new-anfrage')?.addEventListener('click', () => {
        openModal('modal-anfrage');
    });

    // Demo Workflow - Creates complete demo in one click
    document.getElementById('qa-demo-workflow')?.addEventListener('click', runDemoWorkflow);

    // Send all Mahnungen
    document.getElementById('qa-all-invoices')?.addEventListener('click', () => {
        const rechnungen = store.rechnungen.filter(r => r.status === 'offen');
        const overdueItems = window.dunningService?.checkAllOverdueInvoices(rechnungen) || [];

        if (overdueItems.length === 0) {
            showToast('✅ Keine überfälligen Rechnungen!', 'success');
            return;
        }

        let created = 0;
        overdueItems.forEach(item => {
            if (item.actionNeeded) {
                window.dunningService.erstelleMahnung(item.rechnung, item.status.stufe);
                created++;
            }
        });

        showToast(`✅ ${created} Mahnungen erstellt!`, 'success');
        addActivity('⚠️', `${created} automatische Mahnungen erstellt`);
    });

    // DATEV Export
    document.getElementById('qa-datev-export')?.addEventListener('click', () => {
        const jahr = new Date().getFullYear();
        const datev = window.bookkeepingService?.exportDATEV(jahr);

        if (!datev || datev.split('\n').length <= 1) {
            showToast('⚠️ Keine Buchungen zum Exportieren', 'warning');
            return;
        }

        const blob = new Blob([datev], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DATEV-${jahr}.csv`;
        a.click();

        showToast('📤 DATEV Export erstellt!', 'success');
    });

    // Clickable stat cards
    document.querySelectorAll('.stat-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            const viewId = card.dataset.navigate;
            if (viewId) {
                switchView(viewId);
                document.querySelector(`[data-view="${viewId}"]`)?.click();
            }
        });
    });
}

// ============================================
// Demo Workflow - One Click Complete Demo
// ============================================
async function runDemoWorkflow() {
    showToast('🚀 Demo-Workflow startet...', 'info');

    // 1. Load demo materials if empty
    if (window.materialService?.getAllMaterials().length === 0) {
        window.materialService.loadDemoMaterials();
    }

    // 2. Create demo Anfrage
    const demoAnfrage = {
        id: generateId('ANF'),
        kunde: {
            name: 'Demo GmbH',
            email: 'info@demo-gmbh.de',
            telefon: '+49 123 456789'
        },
        leistungsart: 'metallbau',
        beschreibung: 'Stahltreppe für Bürogebäude, 12 Stufen, inkl. Geländer nach DIN EN 1090',
        budget: 3500,
        termin: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'neu',
        createdAt: new Date().toISOString()
    };

    store.anfragen.push(demoAnfrage);
    saveStore();
    addActivity('📥', `Demo-Anfrage von ${demoAnfrage.kunde.name}`);

    await delay(500);

    // 3. Create Angebot
    const demoAngebot = {
        id: generateId('ANG'),
        anfrageId: demoAnfrage.id,
        kunde: demoAnfrage.kunde,
        leistungsart: demoAnfrage.leistungsart,
        positionen: [
            { beschreibung: 'Stahltreppe 12 Stufen', menge: 1, einheit: 'Stk.', preis: 2200 },
            { beschreibung: 'Geländer Edelstahl', menge: 4, einheit: 'lfm', preis: 185 },
            { beschreibung: 'Montage vor Ort', menge: 8, einheit: 'Std.', preis: 65 }
        ],
        text: 'Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot.',
        netto: 3460,
        mwst: 657.40,
        brutto: 4117.40,
        status: 'offen',
        createdAt: new Date().toISOString()
    };

    store.angebote.push(demoAngebot);
    demoAnfrage.status = 'angebot-erstellt';
    saveStore();
    addActivity('📝', `Angebot ${demoAngebot.id} erstellt`);

    await delay(500);

    // 4. Accept Angebot -> Auftrag
    demoAngebot.status = 'angenommen';
    const demoAuftrag = {
        id: generateId('AUF'),
        angebotId: demoAngebot.id,
        kunde: demoAngebot.kunde,
        leistungsart: demoAngebot.leistungsart,
        positionen: demoAngebot.positionen,
        angebotsWert: demoAngebot.brutto,
        netto: demoAngebot.netto,
        mwst: demoAngebot.mwst,
        status: 'aktiv',
        createdAt: new Date().toISOString()
    };

    store.auftraege.push(demoAuftrag);
    saveStore();
    addActivity('✅', `Auftrag ${demoAuftrag.id} erteilt`);

    await delay(500);

    // 5. Complete Auftrag -> Rechnung
    demoAuftrag.status = 'abgeschlossen';
    demoAuftrag.arbeitszeit = 10;
    demoAuftrag.materialKosten = 150;
    demoAuftrag.completedAt = new Date().toISOString();

    const demoRechnung = {
        id: generateId('RE'),
        auftragId: demoAuftrag.id,
        angebotId: demoAuftrag.angebotId,
        kunde: demoAuftrag.kunde,
        leistungsart: demoAuftrag.leistungsart,
        positionen: demoAuftrag.positionen,
        arbeitszeit: demoAuftrag.arbeitszeit,
        materialKosten: demoAuftrag.materialKosten,
        netto: demoAuftrag.netto + demoAuftrag.materialKosten,
        mwst: (demoAuftrag.netto + demoAuftrag.materialKosten) * 0.19,
        brutto: (demoAuftrag.netto + demoAuftrag.materialKosten) * 1.19,
        status: 'offen',
        createdAt: new Date().toISOString()
    };

    store.rechnungen.push(demoRechnung);
    saveStore();
    addActivity('💰', `Rechnung ${demoRechnung.id} erstellt`);

    updateDashboard();
    showToast('🎉 Demo-Workflow abgeschlossen!', 'success');

    // Show rechnung
    setTimeout(() => showRechnung(demoRechnung.id), 800);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Keyboard Shortcuts
// ============================================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        // Check if any modal is open
        const modalOpen = document.querySelector('.modal.active');
        if (modalOpen) return;

        switch (e.key.toLowerCase()) {
            case 'n':
                e.preventDefault();
                openModal('modal-anfrage');
                break;
            case 'd':
                e.preventDefault();
                runDemoWorkflow();
                break;
            case '1':
                e.preventDefault();
                switchView('dashboard');
                document.querySelector('[data-view="dashboard"]')?.click();
                break;
            case '2':
                e.preventDefault();
                switchView('anfragen');
                document.querySelector('[data-view="anfragen"]')?.click();
                break;
            case '3':
                e.preventDefault();
                switchView('angebote');
                document.querySelector('[data-view="angebote"]')?.click();
                break;
            case '4':
                e.preventDefault();
                switchView('auftraege');
                document.querySelector('[data-view="auftraege"]')?.click();
                break;
            case '5':
                e.preventDefault();
                switchView('rechnungen');
                document.querySelector('[data-view="rechnungen"]')?.click();
                break;
            case '?':
                e.preventDefault();
                showKeyboardHelp();
                break;
        }
    });
}

function showKeyboardHelp() {
    const help = document.createElement('div');
    help.className = 'keyboard-help';
    help.innerHTML = `
        <strong>Tastenkürzel:</strong><br>
        <kbd>N</kbd> Neue Anfrage<br>
        <kbd>D</kbd> Demo-Workflow<br>
        <kbd>1-5</kbd> Navigation<br>
        <kbd>?</kbd> Diese Hilfe<br>
        <kbd>ESC</kbd> Modal schließen
    `;
    document.body.appendChild(help);

    setTimeout(() => help.remove(), 5000);
}

// ============================================
// Customer Suggestions (Auto-fill)
// ============================================
const recentCustomers = [];

function addToRecentCustomers(kunde) {
    const existing = recentCustomers.findIndex(k => k.email === kunde.email);
    if (existing >= 0) {
        recentCustomers.splice(existing, 1);
    }
    recentCustomers.unshift(kunde);
    if (recentCustomers.length > 5) {
        recentCustomers.pop();
    }
}

// ============================================
// Customer Presets (Position Templates by Email)
// ============================================
const customerPresets = JSON.parse(localStorage.getItem('mhs_customer_presets') || '{}');

function saveCustomerPresets() {
    localStorage.setItem('mhs_customer_presets', JSON.stringify(customerPresets));
}

function initCustomerPresets() {
    // Update dropdown when modal opens
    const presetSelect = document.getElementById('customer-preset');

    function updatePresetDropdown() {
        if (!presetSelect) return;
        const emails = Object.keys(customerPresets);
        presetSelect.innerHTML = '<option value="">-- Keine Vorlage --</option>' +
            emails.map(email => `<option value="${email}">${email} (${customerPresets[email].length} Pos.)</option>`).join('');
    }

    // Load preset
    document.getElementById('btn-load-preset')?.addEventListener('click', () => {
        const email = presetSelect?.value;
        if (!email || !customerPresets[email]) {
            showToast('⚠️ Keine Vorlage ausgewählt', 'warning');
            return;
        }

        // Clear current positions
        document.getElementById('positionen-list').innerHTML = '';

        // Add preset positions
        customerPresets[email].forEach(pos => {
            addPosition(pos);
        });

        showToast(`✅ ${customerPresets[email].length} Positionen geladen!`, 'success');
    });

    // Save preset
    document.getElementById('btn-save-preset')?.addEventListener('click', () => {
        const anfrageId = document.getElementById('angebot-anfrage-id').value;
        const anfrage = store.anfragen.find(a => a.id === anfrageId);
        const email = anfrage?.kunde?.email;

        if (!email) {
            showToast('⚠️ Keine Email vorhanden', 'warning');
            return;
        }

        const positionen = [];
        document.querySelectorAll('.position-row').forEach(row => {
            const beschreibung = row.querySelector('.pos-beschreibung').value;
            const menge = parseFloat(row.querySelector('.pos-menge').value) || 1;
            const einheit = row.querySelector('.pos-einheit').value;
            const preis = parseFloat(row.querySelector('.pos-preis').value) || 0;

            if (beschreibung) {
                positionen.push({ beschreibung, menge, einheit, preis });
            }
        });

        if (positionen.length === 0) {
            showToast('⚠️ Keine Positionen zum Speichern', 'warning');
            return;
        }

        customerPresets[email] = positionen;
        saveCustomerPresets();
        updatePresetDropdown();
        showToast(`✅ Vorlage für ${email} gespeichert!`, 'success');
    });

    // Material picker button
    document.getElementById('btn-add-from-material')?.addEventListener('click', () => {
        const materials = window.materialService?.getAllMaterials() || [];
        if (materials.length === 0) {
            showToast('⚠️ Materialbestand leer - lade Demo-Daten', 'warning');
            window.materialService?.loadDemoMaterials();
            return;
        }

        // Create quick picker dialog
        const picker = document.createElement('div');
        picker.className = 'modal active';
        picker.id = 'material-picker-modal';
        picker.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📦 Material auswählen</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="material-picker-list">
                    ${materials.map(m => `
                        <div class="material-picker-item" data-material='${JSON.stringify(m)}'>
                            <div class="material-picker-check"></div>
                            <div style="flex:1">
                                <div class="material-suggest-name">${m.bezeichnung}</div>
                                <div class="material-suggest-meta">
                                    <span class="price">${formatCurrency(m.vkPreis || m.preis)}</span>
                                    <span class="stock">${m.bestand} ${m.einheit}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" id="picker-cancel">Abbrechen</button>
                    <button class="btn btn-primary" id="picker-add">Ausgewählte hinzufügen</button>
                </div>
            </div>
        `;
        document.body.appendChild(picker);

        // Selection handling
        const selected = new Set();
        picker.querySelectorAll('.material-picker-item').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('selected');
                const m = JSON.parse(item.dataset.material);
                if (item.classList.contains('selected')) {
                    selected.add(m.artikelnummer);
                    item.querySelector('.material-picker-check').textContent = '✓';
                } else {
                    selected.delete(m.artikelnummer);
                    item.querySelector('.material-picker-check').textContent = '';
                }
            });
        });

        // Cancel
        picker.querySelector('#picker-cancel').addEventListener('click', () => picker.remove());
        picker.querySelector('.modal-overlay').addEventListener('click', () => picker.remove());
        picker.querySelector('.modal-close').addEventListener('click', () => picker.remove());

        // Add selected
        picker.querySelector('#picker-add').addEventListener('click', () => {
            materials.filter(m => selected.has(m.artikelnummer)).forEach(m => {
                addPosition({
                    beschreibung: m.bezeichnung,
                    menge: 1,
                    einheit: m.einheit,
                    preis: m.vkPreis || m.preis
                });
            });
            showToast(`✅ ${selected.size} Positionen hinzugefügt!`, 'success');
            picker.remove();
        });
    });

    // Update dropdown initially and on modal open
    updatePresetDropdown();
}

// ============================================
// Automation 1: Bank-CSV Payment Matching
// ============================================
const bankTransactions = [];

function initPaymentMatching() {
    // Bank CSV Import
    document.getElementById('bank-csv-import')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const content = await file.text();
            const result = parseBankCSV(content);
            bankTransactions.push(...result.transactions);
            showToast(`✅ ${result.transactions.length} Banktransaktionen importiert!`, 'success');
            addActivity('🏦', `Bank-CSV: ${result.transactions.length} Transaktionen`);
        } catch (err) {
            showToast(`❌ Fehler: ${err.message}`, 'error');
        }
        e.target.value = '';
    });

    // Match payments button
    document.getElementById('btn-match-payments')?.addEventListener('click', () => {
        matchPaymentsToInvoices();
    });
}

function parseBankCSV(content) {
    const lines = content.split('\n').filter(l => l.trim());
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.toLowerCase().replace(/"/g, ''));

    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(v => v.replace(/"/g, '').trim());

        // Try to find common bank CSV columns
        const betragIdx = headers.findIndex(h => h.includes('betrag') || h.includes('umsatz') || h.includes('amount'));
        const textIdx = headers.findIndex(h => h.includes('verwendungszweck') || h.includes('buchungstext') || h.includes('text'));
        const datumIdx = headers.findIndex(h => h.includes('datum') || h.includes('valuta') || h.includes('date'));

        if (betragIdx >= 0 && values[betragIdx]) {
            let betrag = parseFloat(values[betragIdx].replace('.', '').replace(',', '.'));
            if (!isNaN(betrag) && betrag > 0) { // Only positive = incoming
                transactions.push({
                    betrag,
                    text: textIdx >= 0 ? values[textIdx] : '',
                    datum: datumIdx >= 0 ? values[datumIdx] : new Date().toISOString()
                });
            }
        }
    }

    return { transactions };
}

function matchPaymentsToInvoices() {
    const openInvoices = store.rechnungen.filter(r => r.status === 'offen');
    let matched = 0;

    openInvoices.forEach(rechnung => {
        // Look for matching transaction
        const match = bankTransactions.find(t => {
            // Match by amount (±1€ tolerance) and invoice number in text
            const amountMatch = Math.abs(t.betrag - rechnung.brutto) < 1;
            const textMatch = t.text.includes(rechnung.id) ||
                t.text.includes(rechnung.kunde.name?.split(' ')[0] || '');
            return amountMatch && textMatch;
        });

        if (match) {
            rechnung.status = 'bezahlt';
            rechnung.paidAt = new Date().toISOString();
            window.bookkeepingService?.addFromRechnung(rechnung);
            matched++;

            // Remove used transaction
            const idx = bankTransactions.indexOf(match);
            if (idx >= 0) bankTransactions.splice(idx, 1);
        }
    });

    saveStore();
    renderRechnungen();
    updateDashboard();

    if (matched > 0) {
        showToast(`✅ ${matched} Rechnungen als bezahlt markiert!`, 'success');
        addActivity('💰', `Automatisch ${matched} Zahlungen zugeordnet`);
    } else {
        showToast('ℹ️ Keine passenden Zahlungen gefunden', 'info');
    }
}

// ============================================
// Automation 2: Angebots-Nachverfolgung
// ============================================
const FOLLOWUP_DAYS = 7; // Nach 7 Tagen nachfassen

function initFollowUp() {
    document.getElementById('btn-check-followups')?.addEventListener('click', () => {
        showFollowUpOffers();
    });
}

function getFollowUpOffers() {
    const now = new Date();
    return store.angebote.filter(a => {
        if (a.status !== 'offen') return false;
        const created = new Date(a.createdAt);
        const daysSince = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        return daysSince >= FOLLOWUP_DAYS;
    }).map(a => {
        const daysSince = Math.floor((new Date() - new Date(a.createdAt)) / (1000 * 60 * 60 * 24));
        return { ...a, daysSince };
    });
}

function updateFollowUpBadge() {
    const count = getFollowUpOffers().length;
    const badge = document.getElementById('followup-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
}

function showFollowUpOffers() {
    const offers = getFollowUpOffers();

    if (offers.length === 0) {
        showToast('✅ Keine Angebote zum Nachfassen!', 'success');
        return;
    }

    // Show modal with follow-up list
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'followup-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>📞 Nachfass-Liste (${offers.length})</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="followup-list">
                ${offers.map(a => `
                    <div class="followup-item">
                        <div class="followup-info">
                            <strong>${a.kunde.name}</strong>
                            <span>${formatCurrency(a.brutto)}</span>
                        </div>
                        <div class="followup-meta">
                            <span>📅 ${a.daysSince} Tage alt</span>
                            ${a.kunde.email ? `<a href="mailto:${a.kunde.email}?subject=Nachfrage zu Angebot ${a.id}" class="btn btn-small">📧 Email</a>` : ''}
                            ${a.kunde.telefon ? `<a href="tel:${a.kunde.telefon}" class="btn btn-small">📞 Anrufen</a>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary modal-close">Schließen</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
    modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => modal.remove()));
}

// ============================================
// Automation 3: Bestellvorschläge (Low Stock)
// ============================================
const MIN_STOCK_THRESHOLD = 5;

function initLowStockAlerts() {
    document.getElementById('btn-low-stock')?.addEventListener('click', () => {
        showLowStockItems();
    });
}

function getLowStockItems() {
    const materials = window.materialService?.getAllMaterials() || [];
    return materials.filter(m => {
        const threshold = m.mindestbestand || MIN_STOCK_THRESHOLD;
        return m.bestand < threshold;
    });
}

function updateLowStockBadge() {
    const count = getLowStockItems().length;
    const badge = document.getElementById('lowstock-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
}

function showLowStockItems() {
    const items = getLowStockItems();

    if (items.length === 0) {
        showToast('✅ Alle Materialien ausreichend auf Lager!', 'success');
        return;
    }

    // Show modal with order suggestions
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'lowstock-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>⚠️ Bestellvorschläge (${items.length})</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="lowstock-list">
                ${items.map(m => `
                    <div class="lowstock-item">
                        <div class="lowstock-info">
                            <strong>${m.bezeichnung}</strong>
                            <span class="stock-critical">${m.bestand} ${m.einheit} (Min: ${m.mindestbestand || MIN_STOCK_THRESHOLD})</span>
                        </div>
                        <div class="lowstock-meta">
                            <span>EK: ${formatCurrency(m.ekPreis || m.preis)}</span>
                            <span>Empfehlung: ${Math.max(10, (m.mindestbestand || MIN_STOCK_THRESHOLD) * 2)} ${m.einheit}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary modal-close">Schließen</button>
                <button class="btn btn-primary" id="btn-export-orderlist">📋 Bestellliste exportieren</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
    modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => modal.remove()));

    modal.querySelector('#btn-export-orderlist')?.addEventListener('click', () => {
        exportOrderList(items);
        modal.remove();
    });
}

function exportOrderList(items) {
    const csv = 'Artikelnr;Bezeichnung;Aktuell;Mindest;Bestellmenge;EK-Preis;Gesamt\n' +
        items.map(m => {
            const orderQty = Math.max(10, (m.mindestbestand || MIN_STOCK_THRESHOLD) * 2);
            const total = orderQty * (m.ekPreis || m.preis);
            return [
                m.artikelnummer,
                m.bezeichnung,
                m.bestand,
                m.mindestbestand || MIN_STOCK_THRESHOLD,
                orderQty,
                (m.ekPreis || m.preis).toFixed(2).replace('.', ','),
                total.toFixed(2).replace('.', ',')
            ].join(';');
        }).join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bestellliste-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    showToast('📋 Bestellliste exportiert!', 'success');
}

// ============================================
// Initialize all automations
// ============================================
function initAutomations() {
    initPaymentMatching();
    initFollowUp();
    initLowStockAlerts();

    // Update badges on load
    setTimeout(() => {
        updateFollowUpBadge();
        updateLowStockBadge();
    }, 500);
}

// ============================================
// Invoice Management Functions
// ============================================

/**
 * Download invoice PDF
 */
async function downloadInvoicePDF(invoiceId) {
    try {
        if (!window.invoiceService) {
            showToast('❌ Invoice Service nicht verfügbar', 'error');
            return;
        }

        showToast('📄 Generiere PDF...', 'info');

        await window.invoiceService.generatePDF(invoiceId, {
            download: true,
            open: false
        });

        showToast('✅ PDF heruntergeladen!', 'success');
    } catch (error) {
        console.error('PDF download error:', error);
        showToast('❌ Fehler beim PDF-Download: ' + error.message, 'error');
    }
}

/**
 * Generate e-invoice (XRechnung)
 */
async function generateEInvoice(invoiceId) {
    try {
        if (!window.invoiceService) {
            showToast('❌ Invoice Service nicht verfügbar', 'error');
            return;
        }

        showToast('🔐 Generiere E-Rechnung...', 'info');

        const result = await window.invoiceService.generateEInvoice(invoiceId, {
            format: 'xrechnung',
            download: true
        });

        if (result.success) {
            showToast('✅ E-Rechnung (XRechnung) erstellt!', 'success');
        } else {
            showToast('❌ E-Rechnung Fehler', 'error');
        }
    } catch (error) {
        console.error('E-Invoice generation error:', error);
        showToast('❌ Fehler bei E-Rechnung: ' + error.message, 'error');
    }
}

/**
 * Mark invoice as paid
 */
async function markInvoiceAsPaid(invoiceId) {
    try {
        const confirmed = confirm('Rechnung als bezahlt markieren?');
        if (!confirmed) return;

        if (!window.invoiceService) {
            showToast('❌ Invoice Service nicht verfügbar', 'error');
            return;
        }

        const invoice = await window.invoiceService.markAsPaid(invoiceId, {
            method: 'Überweisung',
            note: ''
        });

        showToast('✅ Rechnung als bezahlt markiert!', 'success');
        renderRechnungen();
        updateDashboard();
    } catch (error) {
        console.error('Mark as paid error:', error);
        showToast('❌ Fehler: ' + error.message, 'error');
    }
}

/**
 * Preview next invoice number
 */
async function previewNextInvoiceNumber() {
    try {
        if (!window.invoiceNumberingService) {
            return 'N/A';
        }

        const userId = window.storeService?.getCurrentUserId?.() || 'default';
        const preview = await window.invoiceNumberingService.previewNext(userId);
        return preview;
    } catch (error) {
        console.error('Preview error:', error);
        return 'Error';
    }
}

/**
 * Update invoice number preview in settings
 */
async function updateInvoiceNumberPreview() {
    const previewElement = document.getElementById('invoice-number-preview');
    if (!previewElement) return;

    try {
        const preview = await previewNextInvoiceNumber();
        previewElement.textContent = preview;
    } catch (error) {
        previewElement.textContent = 'Fehler beim Laden';
    }
}

// Make functions globally available
// ============================================
// PDF Export Functions
// ============================================
async function exportAngebotPDF(angebotId) {
    const angebot = store.angebote.find(a => a.id === angebotId);
    if (!angebot) return;
    try {
        showToast('PDF wird erstellt...', 'info');
        await window.pdfService.generateAngebot(angebot);
        showToast(`Angebot ${angebot.id} als PDF gespeichert`, 'success');
    } catch (err) {
        console.error('PDF error:', err);
        showToast('PDF-Erstellung fehlgeschlagen: ' + err.message, 'error');
    }
}

async function exportMahnungPDF(rechnungId, level, fee) {
    const rechnung = store.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) return;
    try {
        showToast('Mahnung-PDF wird erstellt...', 'info');
        await window.pdfService.generateMahnung(rechnung, level, fee);
        showToast('Mahnung als PDF gespeichert', 'success');
    } catch (err) {
        console.error('PDF error:', err);
        showToast('PDF-Erstellung fehlgeschlagen: ' + err.message, 'error');
    }
}

window.createAngebotFromAnfrage = createAngebotFromAnfrage;
window.acceptAngebot = acceptAngebot;
window.openAuftragModal = openAuftragModal;
window.showRechnung = showRechnung;
window.updateAngebotSummary = updateAngebotSummary;
window.showToast = showToast;
window.openMahnungModal = openMahnungModal;
window.runDemoWorkflow = runDemoWorkflow;
window.addPosition = addPosition;
window.matchPaymentsToInvoices = matchPaymentsToInvoices;
window.updateFollowUpBadge = updateFollowUpBadge;
window.updateLowStockBadge = updateLowStockBadge;
window.exportAngebotPDF = exportAngebotPDF;
window.exportMahnungPDF = exportMahnungPDF;
window.downloadInvoicePDF = downloadInvoicePDF;
window.generateEInvoice = generateEInvoice;
window.markInvoiceAsPaid = markInvoiceAsPaid;
window.previewNextInvoiceNumber = previewNextInvoiceNumber;
window.generateSenderEmail = generateSenderEmail;

// Start app
document.addEventListener('DOMContentLoaded', async () => {
    await init();
    initAutomations();
});
