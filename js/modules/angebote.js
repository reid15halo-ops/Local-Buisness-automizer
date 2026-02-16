/* ============================================
   Angebote Module
   Angebote (quotes) CRUD and UI
   ============================================ */

const { store, saveStore, addActivity, generateId, formatDate, formatCurrency, getLeistungsartLabel, openModal, closeModal, switchView, h } = window.AppUtils;

function createAngebotFromAnfrage(anfrageId) {
    const anfrage = store.anfragen.find(a => a.id === anfrageId);
    if (!anfrage) {return;}

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
    if (!anfrage) {return;}

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
    if (!angebot) {return;}

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
        status: 'geplant',
        fortschritt: 0,
        mitarbeiter: [],
        startDatum: null,
        endDatum: null,
        checkliste: [],
        kommentare: [],
        historie: [{ aktion: 'erstellt', datum: new Date().toISOString(), details: `Aus Angebot ${angebotId}` }],
        createdAt: new Date().toISOString()
    };

    store.auftraege.push(auftrag);
    saveStore();

    addActivity('✅', `Angebot ${angebotId} angenommen → Auftrag ${auftrag.id}`);

    switchView('auftraege');
    document.querySelector('[data-view="auftraege"]').click();
}

// Export angebote functions
window.AngeboteModule = {
    createAngebotFromAnfrage,
    initAngebotForm,
    addPosition,
    updateAngebotSummary,
    generateAIText,
    renderAngebote,
    acceptAngebot
};

// Make globally available
window.createAngebotFromAnfrage = createAngebotFromAnfrage;
window.renderAngebote = renderAngebote;
window.addPosition = addPosition;
window.updateAngebotSummary = updateAngebotSummary;
window.acceptAngebot = acceptAngebot;
