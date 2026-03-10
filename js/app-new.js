/* ============================================
   FreyAI Visions Demo - Application Orchestrator
   Complete Quote-to-Invoice Workflow
   Modular Architecture Entry Point
   ============================================ */
(function() {

// Module-level convenience shortcuts
const {
    store, saveStore, addActivity, generateId,
    formatCurrency, formatDate,
    openModal, closeModal, h,
    switchView, delay, showToast
} = window.AppUtils;

// ============================================
// Initialization
// ============================================
async function init() {
    // Check if setup wizard needs to run
    if (window.setupWizard && !window.setupWizard.isSetupComplete()) {
        const missing = window.setupWizard.getMissingKeys();
        if (missing.length > 0) {
            console.warn('Setup incomplete. Missing keys:', missing.map(k => k.name).join(', '));
            if (window.setupWizardUI) {
                window.setupWizardUI.show();
                return;
            }
        }
    }

    // Load company settings from Supabase (tax rate, stundensatz, noreply email, etc.)
    if (window.companySettings) { await window.companySettings.load(); }

    // Await store service load
    await window.storeService.load();

    // Initialize modules (with null guards for load-order safety)
    window.AnfragenModule?.initAnfrageForm?.();
    window.AngeboteModule?.initAngebotForm?.();
    window.AngeboteModule?.initAngeboteFilters?.();
    window.AngeboteModule?.initAngeboteEventDelegation?.();
    window.AuftraegeModule?.initAuftragForm?.();
    window.AuftraegeModule?.initAuftragDetailHandlers?.();
    window.RechnungenModule?.initRechnungActions?.();
    window.RechnungenModule?.initRechnungenFilters?.();
    initMaterial();
    initSettings();
    initAutomationSettings();
    initMahnwesen();
    initBuchhaltung();
    initQuickActions();
    window.ModalsModule?.initModals?.();
    window.WareneingangModule?.initWareneingang?.();

    // Initialize automation API
    window.automationAPI?.init();

    window.DashboardModule?.updateDashboard?.();
}

// ============================================
// Material Management (from app.js)
// ============================================
function renderMaterial() {
    const materials = window.materialService?.getAllMaterials() || [];
    const container = document.getElementById('material-list');

    const matCountEl = document.getElementById('material-count');
    if (matCountEl) {matCountEl.textContent = materials.length;}
    const lagerwert = materials.reduce((sum, m) => sum + (m.bestand * m.preis), 0);
    const matValueEl = document.getElementById('material-value');
    if (matValueEl) {matValueEl.textContent = formatCurrency(lagerwert);}
    const lowStock = window.materialService?.getLowStockItems() || [];
    const matLowEl = document.getElementById('material-low');
    if (matLowEl) {matLowEl.textContent = lowStock.length;}
    const matBadgeEl = document.getElementById('material-badge');
    if (matBadgeEl) {matBadgeEl.textContent = materials.length;}

    const kategorien = window.materialService?.getKategorien() || [];
    const filterSelect = document.getElementById('material-kategorie-filter');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Alle Kategorien</option>' +
            kategorien.map(k => `<option value="${h(k)}">${h(k)}</option>`).join('');
    }

    if (!container) {return;}
    if (materials.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 60px 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                <h3 style="margin-bottom: 8px;">Keine Materialien vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Importiere deine Materialliste aus Excel oder lade Demo-Daten.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button class="btn btn-secondary" onclick="window.materialService.loadDemoMaterials(); renderMaterial();">
                        🎲 Demo-Daten laden
                    </button>
                    <button class="btn btn-primary" onclick="document.getElementById('excel-import').click()">
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
                        <span class="material-name">${h(m.bezeichnung)}</span>
                        <span class="material-sku">${h(m.artikelnummer)}</span>
                    </div>
                    <span class="material-kategorie">${h(m.kategorie)}</span>
                    <div class="material-preis">
                        <div class="vk">${formatCurrency(m.vkPreis || m.preis)}</div>
                        <div class="ek">EK: ${formatCurrency(m.preis)}</div>
                    </div>
                    <div class="material-bestand ${isLow ? 'low' : ''}">
                        <div class="count">${m.bestand}</div>
                        <div class="unit">${h(m.einheit)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function initMaterial() {
    const excelInput = document.getElementById('excel-import');
    if (excelInput) {
        excelInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) {return;}

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

    const demoBtn = document.getElementById('btn-demo-materials');
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            window.materialService.loadDemoMaterials();
            renderMaterial();
            showToast('✅ Demo-Materialien geladen!', 'success');
            addActivity('📦', 'Demo-Materialbestand geladen (10 Artikel)');
        });
    }

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
    if (!container) {return;}
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
                        <span class="material-name">${h(m.bezeichnung)}</span>
                        <span class="material-sku">${h(m.artikelnummer)}</span>
                    </div>
                    <span class="material-kategorie">${h(m.kategorie)}</span>
                    <div class="material-preis">
                        <div class="vk">${formatCurrency(m.vkPreis || m.preis)}</div>
                        <div class="ek">EK: ${formatCurrency(m.preis)}</div>
                    </div>
                    <div class="material-bestand ${isLow ? 'low' : ''}">
                        <div class="count">${m.bestand}</div>
                        <div class="unit">${h(m.einheit)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// Settings (abbreviated - full version in original app.js)
// ============================================
function initSettings() {
    const stundensatz = String(window.companySettings?.getStundensatz?.() ?? localStorage.getItem('stundensatz') ?? 65);
    const webhookUrl = localStorage.getItem('n8n_webhook_url');

    if (document.getElementById('stundensatz')) {
        document.getElementById('stundensatz').value = stundensatz;
        if (document.getElementById('n8n-webhook-url')) {
            document.getElementById('n8n-webhook-url').value = webhookUrl || '';
        }
        updateSettingsStatus();
    }

    document.getElementById('btn-save-stundensatz')?.addEventListener('click', async () => {
        const satz = parseFloat(document.getElementById('stundensatz').value);
        window.materialService?.setStundensatz(satz);
        await window.companySettings?.save?.({ stundensatz: satz });
        showToast('✅ Stundensatz gespeichert!', 'success');
    });

    document.getElementById('btn-save-webhook')?.addEventListener('click', () => {
        const url = document.getElementById('n8n-webhook-url').value.trim();
        localStorage.setItem('n8n_webhook_url', url);
        updateSettingsStatus();
        showToast('✅ Webhook URL gespeichert!', 'success');
    });

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
        a.download = `freyai-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        showToast('Daten exportiert', 'success');
    });

    // Import data
    document.getElementById('btn-import-data')?.addEventListener('click', () => {
        document.getElementById('import-data-file')?.click();
    });
    document.getElementById('import-data-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {return;}
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                if (data.store) {
                    Object.assign(store, data.store);
                    saveStore();
                }
                if (data.materials && window.materialService) {
                    data.materials.forEach(m => window.materialService.addMaterial(m));
                }
                showToast(`Import erfolgreich (${file.name})`, 'success');
                location.reload();
            } catch (err) {
                showToast('Import fehlgeschlagen: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // Clear all data
    document.getElementById('btn-clear-data')?.addEventListener('click', () => {
        if (!confirm('Alle Daten unwiderruflich löschen? Dies kann nicht rückgängig gemacht werden!')) {return;}
        if (!confirm('Letzte Warnung: Wirklich ALLE Daten löschen?')) {return;}
        localStorage.clear();
        sessionStorage.clear();
        showToast('Alle Daten gelöscht', 'success');
        setTimeout(() => location.reload(), 500);
    });

    // Save invoice template
    document.getElementById('btn-save-template')?.addEventListener('click', () => {
        const template = document.getElementById('invoice-template')?.value;
        localStorage.setItem('invoice_template', template || 'standard-de');
        showToast('Rechnungsvorlage gespeichert', 'success');
    });

    // Invoice numbering
    const updateInvoicePreview = () => {
        const prefix = document.getElementById('invoice-prefix')?.value || 'RE';
        const format = document.getElementById('invoice-format')?.value || '{PREFIX}-{YEAR}-{NUMBER:4}';
        const year = new Date().getFullYear();
        const nextNum = parseInt(localStorage.getItem('invoice_next_number') || '1');
        const preview = format
            .replace('{PREFIX}', prefix)
            .replace('{YEAR}', year)
            .replace(/\{NUMBER:(\d+)\}/, (_, len) => String(nextNum).padStart(parseInt(len), '0'));
        const el = document.getElementById('invoice-number-preview');
        if (el) {el.textContent = preview;}
    };
    updateInvoicePreview();
    document.getElementById('invoice-prefix')?.addEventListener('input', updateInvoicePreview);
    document.getElementById('invoice-format')?.addEventListener('change', updateInvoicePreview);

    document.getElementById('btn-save-invoice-numbering')?.addEventListener('click', () => {
        localStorage.setItem('invoice_prefix', document.getElementById('invoice-prefix')?.value || 'RE');
        localStorage.setItem('invoice_format', document.getElementById('invoice-format')?.value || '{PREFIX}-{YEAR}-{NUMBER:4}');
        localStorage.setItem('invoice_yearly_reset', document.getElementById('invoice-yearly-reset')?.checked ? '1' : '0');
        showToast('Rechnungsnummern gespeichert', 'success');
    });

    // Load saved template
    const savedTemplate = localStorage.getItem('invoice_template');
    if (savedTemplate) {
        const templateSelect = document.getElementById('invoice-template');
        if (templateSelect) {templateSelect.value = savedTemplate;}
    }
    const savedPrefix = localStorage.getItem('invoice_prefix');
    if (savedPrefix) {
        const prefixInput = document.getElementById('invoice-prefix');
        if (prefixInput) {prefixInput.value = savedPrefix;}
    }
}

// ============================================
// Mahnwesen (Dunning)
// ============================================
function renderMahnwesen() {
    const container = document.getElementById('dunning-list');
    if (!container) {return;}
    const rechnungen = store?.rechnungen?.filter(r => r.status === 'offen' || r.status === 'versendet') || [];
    const mahnungen = store?.mahnungen || [];

    // Update stat cards
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) {el.textContent = val;} };
    setEl('dunning-count', rechnungen.length);
    setEl('dunning-total', formatCurrency(rechnungen.reduce((s, r) => s + (r.brutto || r.gesamtBrutto || 0), 0)));
    setEl('dunning-inkasso', mahnungen.filter(m => m.stufe >= 3).length);

    if (rechnungen.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine offenen Rechnungen</p>';
        return;
    }

    container.innerHTML = rechnungen.map(r => {
        const rMahnungen = mahnungen.filter(m => m.rechnungId === r.id);
        const stufe = rMahnungen.length;
        return `<div class="item-card" style="cursor:pointer" onclick="window.openMahnungModal?.('${h(r.id)}')">
            <div class="item-header">
                <h3 class="item-title">${h(r.kunde?.name || r.kunde?.firma || 'Unbekannt')}</h3>
                <span class="item-id">${h(r.id)}</span>
                ${stufe > 0 ? `<span class="badge badge-warning">Stufe ${stufe}</span>` : ''}
            </div>
            <div class="item-meta">
                <span>${formatCurrency(r.brutto || r.gesamtBrutto || 0)}</span>
                <span>${formatDate(r.createdAt || r.datum)}</span>
            </div>
        </div>`;
    }).join('');
}

function openMahnungModal(rechnungId) {
    const rechnung = store.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) {return;}

    const modal = document.getElementById('modal-mahnung');
    if (!modal) {return;}

    const hiddenInput = modal.querySelector('[data-rechnung-id]');
    if (hiddenInput) {hiddenInput.dataset.rechnungId = rechnungId;}

    // Render preview
    const kunde = store.kunden?.find(k => k.id === rechnung.kundeId) || {};
    const preview = document.getElementById('mahnung-preview');
    const existingMahnungen = (store.mahnungen || []).filter(m => m.rechnungId === rechnungId);
    const stufe = existingMahnungen.length + 1;
    const frist = stufe === 1 ? '14 Tagen' : stufe === 2 ? '7 Tagen' : '5 Tagen';

    if (preview) {
        preview.innerHTML = `
            <div style="padding:16px;border:1px solid var(--border-color,#ddd);border-radius:8px;">
                <h3>Mahnung Stufe ${stufe}</h3>
                <p><strong>An:</strong> ${h(kunde.name || kunde.firma || 'Unbekannt')}</p>
                <p><strong>Rechnung:</strong> ${h(rechnung.id)} vom ${formatDate(rechnung.datum)}</p>
                <p><strong>Betrag:</strong> ${formatCurrency(rechnung.betrag || rechnung.gesamtBrutto || 0)}</p>
                <p><strong>Frist:</strong> Zahlung innerhalb von ${frist}</p>
                ${stufe >= 3 ? '<p style="color:var(--danger,#e53935);"><strong>Letzte Mahnung vor Inkasso</strong></p>' : ''}
            </div>`;
    }

    openModal('modal-mahnung');
}

function initMahnwesen() {
    // Send Mahnung button
    document.getElementById('btn-send-mahnung')?.addEventListener('click', () => {
        const rechnungId = document.querySelector('[data-rechnung-id]')?.dataset?.rechnungId;
        if (!rechnungId) {return;}

        const existingMahnungen = (store.mahnungen || []).filter(m => m.rechnungId === rechnungId);
        const mahnung = {
            id: generateId('MAH'),
            rechnungId,
            stufe: existingMahnungen.length + 1,
            datum: new Date().toISOString(),
            status: 'versendet'
        };

        if (!store.mahnungen) {store.mahnungen = [];}
        store.mahnungen.push(mahnung);
        saveStore();

        showToast('Mahnung versendet', 'success');
        closeModal('modal-mahnung');
        renderMahnwesen();
    });

    // Print Mahnung button
    document.getElementById('btn-print-mahnung')?.addEventListener('click', () => {
        const preview = document.getElementById('mahnung-preview');
        if (!preview) {return;}
        const printWindow = window.open('', '_blank');
        if (!printWindow) {showToast('Popup-Blocker aktiv – bitte Popups erlauben', 'warning'); return;}
        printWindow.document.write(`<html><head><title>Mahnung</title><style>body{font-family:sans-serif;padding:40px;}</style></head><body>${preview.innerHTML}</body></html>`);
        printWindow.document.close();
        printWindow.print();
    });
}

// ============================================
// Buchhaltung (Accounting)
// ============================================
function renderBuchhaltung() {
    const Jahr = parseInt(document.getElementById('buchhaltung-jahr')?.value) || new Date().getFullYear();
    const bs = window.bookkeepingService;
    const buchungen = bs?.getBuchungenForJahr(Jahr) || [];
    const container = document.getElementById('buchungen-list');
    if (!container) {return;}

    // EÜR Summary Cards
    if (bs?.berechneEUR) {
        const eur = bs.berechneEUR(Jahr);
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) {el.textContent = val;} };
        setEl('eur-einnahmen', formatCurrency(eur.einnahmen.brutto));
        setEl('eur-einnahmen-netto', formatCurrency(eur.einnahmen.netto));
        setEl('eur-ust', formatCurrency(eur.einnahmen.ust));
        setEl('eur-ausgaben', formatCurrency(eur.ausgabenGesamt?.brutto || 0));
        setEl('eur-ausgaben-netto', formatCurrency(eur.ausgabenGesamt?.netto || 0));
        setEl('eur-vst', formatCurrency(eur.ausgabenGesamt?.vorsteuer || 0));
        setEl('eur-gewinn', formatCurrency(eur.gewinn || 0));
        setEl('eur-zahllast', formatCurrency(eur.ustZahllast || 0));
    }

    if (buchungen.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Buchungen. Rechnungen werden automatisch erfasst.</p>';
        return;
    }

    container.innerHTML = buchungen.slice().reverse().slice(0, 20).map(b => `
        <div class="buchung-item">
            <div class="buchung-datum">${formatDate(b.datum)}</div>
            <div class="buchung-beschreibung">
                ${h(b.beschreibung)}
                <small>${h(b.belegnummer || b.id)}</small>
            </div>
            <div class="buchung-kategorie">${h(b.kategorie)}</div>
            <div class="buchung-betrag ${b.typ}">
                ${b.typ === 'einnahme' ? '+' : '-'}${formatCurrency(b.brutto)}
            </div>
        </div>
    `).join('');
}

function initBuchhaltung() {
    document.getElementById('buchhaltung-jahr')?.addEventListener('change', () => {
        renderBuchhaltung();
    });

    // Open Ausgabe modal
    document.getElementById('btn-add-ausgabe')?.addEventListener('click', () => {
        const datumField = document.getElementById('ausgabe-datum');
        if (datumField && !datumField.value) {datumField.value = new Date().toISOString().split('T')[0];}
        openModal('modal-ausgabe');
    });

    // Submit Ausgabe form
    document.getElementById('form-ausgabe')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const bs = window.bookkeepingService;
        if (!bs) {showToast('Buchhaltung nicht verfügbar', 'warning'); return;}

        bs.addAusgabe({
            kategorie: document.getElementById('ausgabe-kategorie')?.value,
            beschreibung: document.getElementById('ausgabe-beschreibung')?.value,
            betrag: parseFloat(document.getElementById('ausgabe-betrag')?.value) || 0,
            datum: document.getElementById('ausgabe-datum')?.value,
            belegnummer: document.getElementById('ausgabe-beleg')?.value
        });

        showToast('Ausgabe gespeichert', 'success');
        closeModal('modal-ausgabe');
        e.target.reset();
        renderBuchhaltung();
    });

    // CSV Export
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
        const bs = window.bookkeepingService;
        if (!bs) {return;}
        const jahr = parseInt(document.getElementById('buchhaltung-jahr')?.value) || new Date().getFullYear();
        const csv = bs.exportCSV(jahr);
        const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `buchungen-${jahr}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('CSV exportiert', 'success');
    });

    // DATEV Export
    document.getElementById('btn-export-datev')?.addEventListener('click', () => {
        const bs = window.bookkeepingService;
        if (!bs) {return;}
        const jahr = parseInt(document.getElementById('buchhaltung-jahr')?.value) || new Date().getFullYear();
        const datev = bs.exportDATEV(jahr);
        const blob = new Blob([datev], {type: 'text/csv;charset=utf-8;'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `DATEV-${jahr}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('DATEV exportiert', 'success');
    });

    // CSV Import
    document.getElementById('buchung-csv-import')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {return;}
        const bs = window.bookkeepingService;
        if (!bs) {return;}

        const reader = new FileReader();
        reader.onload = (evt) => {
            const lines = evt.target.result.split('\n').filter(l => l.trim());
            let imported = 0;
            // Skip header row
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(';');
                if (cols.length < 6) {continue;}
                const typ = cols[1]?.trim().toLowerCase().includes('einnahme') ? 'einnahme' : 'ausgabe';
                const brutto = parseFloat(cols[7]?.replace(',', '.')) || parseFloat(cols[5]?.replace(',', '.')) || 0;
                if (brutto <= 0) {continue;}

                bs.addBuchung({
                    typ,
                    kategorie: cols[2]?.trim() || 'Import',
                    beschreibung: cols[3]?.replace(/"/g, '').trim() || 'CSV Import',
                    belegnummer: cols[4]?.trim() || '',
                    datum: new Date().toISOString(),
                    brutto,
                    netto: brutto / 1.19,
                    ust: typ === 'einnahme' ? brutto - (brutto / 1.19) : 0,
                    vorsteuer: typ === 'ausgabe' ? brutto - (brutto / 1.19) : 0
                });
                imported++;
            }
            showToast(`${imported} Buchungen importiert`, 'success');
            renderBuchhaltung();
        };
        reader.readAsText(file);
        e.target.value = '';
    });
}

// ============================================
// Automation Settings
// ============================================
function initAutomationSettings() {
    // Load saved values
    const relayUrl = localStorage.getItem('email_relay_url') || (window.location.origin + '/api');
    const relaySecret = (sessionStorage.getItem("email_relay_secret") || localStorage.getItem("email_relay_secret"));
    const senderEmail = localStorage.getItem('sender_email');
    const twilioSid = (sessionStorage.getItem("twilio_sid") || localStorage.getItem("twilio_sid"));
    const twilioToken = (sessionStorage.getItem("twilio_token") || localStorage.getItem("twilio_token"));
    const twilioFrom = (sessionStorage.getItem("twilio_from") || localStorage.getItem("twilio_from"));

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
    if (!senderEmail && typeof generateSenderEmail === 'function') {
        generateSenderEmail();
    }

    // Save Email config
    document.getElementById('btn-save-email-config')?.addEventListener('click', () => {
        const url = document.getElementById('email-relay-url').value.trim();
        const secret = document.getElementById('email-relay-secret').value.trim();
        localStorage.setItem('email_relay_url', url);
        localStorage.setItem('freyai_email_relay_url', url);
        sessionStorage.setItem("email_relay_secret", secret);
        localStorage.setItem('freyai_email_relay_secret', secret);
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
            email, 'FreyAI Test', 'Diese Test-E-Mail bestätigt, dass der E-Mail-Versand funktioniert.'
        );
        showToast(result.success ? 'Test-E-Mail gesendet!' : 'Fehler: ' + result.error, result.success ? 'success' : 'error');
    });

    // Save SMS config
    document.getElementById('btn-save-sms-config')?.addEventListener('click', () => {
        sessionStorage.setItem("twilio_sid", document.getElementById('twilio-sid').value.trim());
        sessionStorage.setItem("twilio_token", document.getElementById('twilio-token').value.trim());
        sessionStorage.setItem("twilio_from", document.getElementById('twilio-from').value.trim());
        updateSettingsStatus();
        showToast('SMS-Konfiguration gespeichert', 'success');
    });

    // Email Automation Config
    document.getElementById('btn-save-email-automation')?.addEventListener('click', async () => {
        const enabled = document.getElementById('email-auto-reply-enabled')?.checked;
        const requireApproval = document.getElementById('email-require-approval')?.checked;
        const replyTemplate = document.getElementById('email-reply-template')?.value.trim();

        const config = {
            enabled,
            requireApproval,
            replyTemplate,
            autoCreateQuote: true,
            autoSendReply: !requireApproval
        };

        if (window.emailAutomationService) {
            const result = await window.emailAutomationService.setConfig(config);
            if (result.success) {
                updateSettingsStatus();
                showToast('E-Mail Automation Konfiguration gespeichert', 'success');
            } else {
                showToast('Fehler beim Speichern: ' + result.error, 'error');
            }
        } else {
            showToast('Service noch nicht geladen', 'warning');
        }
    });

    // Test Email Processing
    document.getElementById('btn-test-email-processing')?.addEventListener('click', () => {
        if (window.UI?.openModal) {window.UI.openModal('modal-test-email');}
    });

    // View Email Automation History
    document.getElementById('btn-view-email-automation')?.addEventListener('click', () => {
        if (window.UI?.switchView) {window.UI.switchView('email-automation');}
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
    const webhookUrl = localStorage.getItem('n8n_webhook_url');
    const relayUrl = localStorage.getItem('email_relay_url') || (window.location.origin + '/api');
    const relaySecret = (sessionStorage.getItem("email_relay_secret") || localStorage.getItem("email_relay_secret"));
    const emailConfigured = relayUrl && relaySecret;
    const twilioSid = (sessionStorage.getItem("twilio_sid") || localStorage.getItem("twilio_sid"));
    // Gemini is now configured server-side via Supabase GEMINI_API_KEY env var
    const geminiConfigured = window.supabaseConfig?.isConfigured?.() ?? false;

    const setStatus = (el, configured) => {
        if (!el) {return;}
        el.textContent = configured ? '● Konfiguriert' : '● Nicht konfiguriert';
        el.className = 'status-indicator' + (configured ? ' connected' : '');
    };

    setStatus(document.getElementById('gemini-status'), geminiConfigured);
    setStatus(document.getElementById('webhook-status'), webhookUrl);
    setStatus(document.getElementById('email-status'), emailConfigured);
    setStatus(document.getElementById('sms-status'), twilioSid);

    // Email Automation Status
    if (window.emailAutomationService) {
        const config = window.emailAutomationService.getConfig();
        const el = document.getElementById('email-automation-status');
        if (el) {
            el.textContent = config.enabled ? '● Aktiv' : '● Deaktiviert';
            el.className = 'status-indicator' + (config.enabled ? ' connected' : '');
        }
    }

    // Automation status panel
    const supabaseOk = window.supabaseConfig?.isConfigured?.();
    const setAutoStatus = (id, ok, label) => {
        const el = document.getElementById(id);
        if (!el) {return;}
        el.textContent = ok ? label || 'Aktiv' : 'Nicht konfiguriert';
        el.style.color = ok ? 'var(--accent-primary)' : 'var(--text-muted)';
    };

    setAutoStatus('auto-status-supabase', supabaseOk, 'Verbunden');
    setAutoStatus('auto-status-email', supabaseOk && emailConfigured, 'Bereit');
    setAutoStatus('auto-status-sms', supabaseOk && twilioSid, 'Bereit');
    setAutoStatus('auto-status-overdue', supabaseOk && emailConfigured, 'Automatisch (tägl. 08:00)');
    setAutoStatus('auto-status-webhook', webhookUrl, 'Konfiguriert');
}

// ============================================
// Sender Email Generation
// ============================================
function generateSenderEmail() {
    const settings = window.storeService?.state?.settings || {};
    const firmaName = settings.companyName || settings.firmenname || settings.firma || '';

    let slug = '';
    if (firmaName) {
        slug = firmaName
            .toLowerCase()
            .replace(/gmbh|gbr|kg|ohg|ag|ug|e\.k\.|co\./gi, '')
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 30);
    }

    if (!slug) {
        slug = 'firma-' + crypto.randomUUID().substring(0, 8);
    }

    const noReplyEmail = settings?.noreply_email ?? window.companySettings?.getNoReplyEmail?.() ?? 'noreply@freyaivisions.de';
    const baseEmail = localStorage.getItem('proton_base_email') || noReplyEmail;
    const [localPart, domain] = baseEmail.split('@');
    const senderEmail = `${localPart}+${slug}@${domain}`;

    localStorage.setItem('sender_email', senderEmail);
    localStorage.setItem('sender_email_slug', slug);

    const emailField = document.getElementById('sender-email');
    if (emailField) {emailField.value = senderEmail;}

    return senderEmail;
}

// ============================================
// Quick Actions
// ============================================
function initQuickActions() {
    document.getElementById('qa-new-anfrage')?.addEventListener('click', () => {
        openModal('modal-anfrage');
    });

    document.getElementById('qa-demo-workflow')?.addEventListener('click', runDemoWorkflow);

    document.getElementById('qa-all-invoices')?.addEventListener('click', () => {
        if (window.navigationController) {window.navigationController.navigateTo('mahnwesen');}
    });

    document.getElementById('qa-datev-export')?.addEventListener('click', () => {
        if (window.navigationController) {window.navigationController.navigateTo('buchhaltung');}
        // Auto-trigger DATEV export after navigation
        setTimeout(() => {document.getElementById('btn-export-datev')?.click();}, 300);
    });

    document.querySelectorAll('.stat-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            const viewId = card.dataset.navigate;
            if (viewId && window.navigationController) {
                window.navigationController.navigateTo(viewId);
            }
        });
    });
}

// ============================================
// Demo Workflow
// ============================================
async function runDemoWorkflow() {
    showToast('🚀 Demo-Workflow startet...', 'info');

    if (window.materialService?.getAllMaterials().length === 0) {
        window.materialService.loadDemoMaterials();
    }

    const ap = StorageUtils.getJSON('freyai_admin_settings', {}, { service: 'appNew' });
    const bizType = ap.business_type || window.storeService?.state?.settings?.businessType || 'Handwerk';

    const demoAnfrage = {
        id: generateId('ANF'),
        kunde: {
            name: 'Demo GmbH',
            email: 'info@demo-gmbh.de',
            telefon: '+49 123 456789'
        },
        leistungsart: bizType.toLowerCase(),
        beschreibung: `Demo-Projekt: Beispielauftrag für ${bizType}`,
        budget: 3500,
        termin: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'neu',
        createdAt: new Date().toISOString()
    };

    if (!store.anfragen) { store.anfragen = []; }
    store.anfragen.push(demoAnfrage);
    saveStore();
    addActivity('📥', `Demo-Anfrage von ${demoAnfrage.kunde?.name || 'Unbekannt'}`);

    await delay(500);

    const demoAngebot = {
        id: generateId('ANG'),
        anfrageId: demoAnfrage.id,
        kunde: demoAnfrage.kunde,
        leistungsart: demoAnfrage.leistungsart,
        positionen: [
            { beschreibung: `${bizType} - Hauptleistung`, menge: 1, einheit: 'Stk.', preis: 2200 },
            { beschreibung: 'Zusatzleistung', menge: 4, einheit: 'Stk.', preis: 185 },
            { beschreibung: 'Montage / Arbeitszeit', menge: 8, einheit: 'Std.', preis: 65 }
        ],
        text: 'Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot.',
        netto: 3460,
        mwst: 657.40,
        brutto: 4117.40,
        status: 'offen',
        createdAt: new Date().toISOString()
    };

    if (!store.angebote) { store.angebote = []; }
    store.angebote.push(demoAngebot);
    demoAnfrage.status = 'angebot-erstellt';
    saveStore();
    addActivity('📝', `Angebot ${demoAngebot.id} erstellt`);

    await delay(500);

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

    if (!store.auftraege) { store.auftraege = []; }
    store.auftraege.push(demoAuftrag);
    saveStore();
    addActivity('✅', `Auftrag ${demoAuftrag.id} erteilt`);

    await delay(500);

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
        mwst: (demoAuftrag.netto + demoAuftrag.materialKosten) * ((typeof window._getTaxRate === 'function') ? window._getTaxRate() : 0.19),
        brutto: (demoAuftrag.netto + demoAuftrag.materialKosten) * (1 + ((typeof window._getTaxRate === 'function') ? window._getTaxRate() : 0.19)),
        status: 'offen',
        createdAt: new Date().toISOString()
    };

    if (!store.rechnungen) { store.rechnungen = []; }
    store.rechnungen.push(demoRechnung);
    saveStore();
    addActivity('💰', `Rechnung ${demoRechnung.id} erstellt`);

    window.DashboardModule?.updateDashboard?.();
    showToast('🎉 Demo-Workflow abgeschlossen!', 'success');

    setTimeout(() => window.RechnungenModule?.showRechnung?.(demoRechnung.id), 800);
}

// ============================================
// Automation initialization (migrated from app.js)
// ============================================
function initAutomations() {
    // Payment matching: match bank CSV against open invoices
    document.getElementById('btn-match-payments')?.addEventListener('click', () => {
        const offene = store?.rechnungen?.filter(r => r.status === 'offen') || [];
        if (offene.length === 0) {showToast('Keine offenen Rechnungen zum Abgleich', 'info'); return;}
        showToast(`${offene.length} offene Rechnungen bereit zum Abgleich. Bank-CSV importieren →`, 'info');
    });

    document.getElementById('bank-csv-import')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {return;}
        const reader = new FileReader();
        reader.onload = (evt) => {
            const lines = evt.target.result.split('\n').filter(l => l.trim());
            let matched = 0;
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(';');
                const betrag = parseFloat((cols[4] || cols[3] || '0').replace(',', '.'));
                if (betrag <= 0) {continue;}
                const match = store?.rechnungen?.find(r =>
                    r.status === 'offen' && Math.abs((r.brutto || r.gesamtBrutto || 0) - betrag) < 0.02
                );
                if (match) {
                    match.status = 'bezahlt';
                    match.paid_at = new Date().toISOString();
                    matched++;
                }
            }
            saveStore();
            showToast(`${matched} Zahlungen zugeordnet`, matched > 0 ? 'success' : 'info');
            if (window.renderRechnungen) {window.renderRechnungen();}
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // Follow-up check for quotes
    document.getElementById('btn-check-followups')?.addEventListener('click', () => {
        const now = new Date();
        const angebote = store?.angebote?.filter(a => {
            if (a.status !== 'versendet') {return false;}
            const sent = new Date(a.versendetAm || a.createdAt);
            return (now - sent) > 7 * 24 * 60 * 60 * 1000; // > 7 Tage
        }) || [];
        if (angebote.length === 0) {showToast('Keine Nachfass-Kandidaten', 'info'); return;}
        showToast(`${angebote.length} Angebote ohne Rückmeldung seit >7 Tagen`, 'warning');
    });

    // Low stock suggestions
    document.getElementById('btn-low-stock')?.addEventListener('click', () => {
        const materials = window.materialService?.getAllMaterials() || [];
        const low = materials.filter(m => m.bestand !== undefined && m.mindestbestand !== undefined && m.bestand <= m.mindestbestand);
        if (low.length === 0) {showToast('Alle Bestände ausreichend', 'success'); return;}
        showToast(`${low.length} Artikel unter Mindestbestand`, 'warning');
        if (window.navigationController) {window.navigationController.navigateTo('bestellungen');}
    });

    // Update badges after short delay
    setTimeout(() => {
        const lowStockBadge = document.getElementById('lowstock-badge');
        if (lowStockBadge) {
            const materials = window.materialService?.getAllMaterials() || [];
            const low = materials.filter(m => m.bestand !== undefined && m.mindestbestand !== undefined && m.bestand <= m.mindestbestand);
            lowStockBadge.textContent = low.length > 0 ? low.length : '';
        }
    }, 500);
}

// ============================================
// Global Module API
// ============================================
window.app = {
    init: async () => {
        await init();
        initAutomations();
    },
    renderMaterial,
    runDemoWorkflow
};

// Expose all render functions for NavigationController
window.renderAnfragen = window.AnfragenModule?.renderAnfragen;
window.renderAngebote = window.AngeboteModule?.renderAngebote;
window.renderAuftraege = window.AuftraegeModule?.renderAuftraege;
window.renderRechnungen = window.RechnungenModule?.renderRechnungen;
window.renderMahnwesen = renderMahnwesen;
window.openMahnungModal = openMahnungModal;
window.renderBuchhaltung = renderBuchhaltung;
window.renderMaterial = renderMaterial;
window.openMahnungModal = openMahnungModal;
window.updateDashboard = window.DashboardModule?.updateDashboard;

// ============================================
// Auto-initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (window._appInitialized) {return;}
    window._appInitialized = true;
    await init();
    initAutomations();
});

})();
