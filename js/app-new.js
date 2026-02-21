/* ============================================
   FreyAI Visions Demo - Application Orchestrator
   Complete Quote-to-Invoice Workflow
   Modular Architecture Entry Point
   ============================================ */

// Module-level convenience shortcuts
const {
    store, saveStore, addActivity, generateId,
    formatCurrency, formatDate, formatDateTime, getRelativeTime,
    getLeistungsartLabel, openModal, closeModal, h,
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
            console.log('⚙️ Setup incomplete. Missing keys:', missing.map(k => k.name).join(', '));
            if (window.setupWizardUI) {
                window.setupWizardUI.show();
                return;
            }
        }
    }

    // Await store service load
    await window.storeService.load();

    // Initialize modules (with null guards for load-order safety)
    window.AnfragenModule?.initAnfrageForm?.();
    window.AngeboteModule?.initAngebotForm?.();
    window.AngeboteModule?.initAngeboteFilters?.();
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
    const geminiKey = localStorage.getItem('gemini_api_key');
    const stundensatz = localStorage.getItem('stundensatz') || '65';
    const webhookUrl = localStorage.getItem('n8n_webhook_url');

    if (document.getElementById('gemini-api-key')) {
        document.getElementById('gemini-api-key').value = geminiKey || '';
        document.getElementById('stundensatz').value = stundensatz;
        document.getElementById('n8n-webhook-url').value = webhookUrl || '';

        updateSettingsStatus();
    }

    document.getElementById('btn-save-gemini')?.addEventListener('click', () => {
        const key = document.getElementById('gemini-api-key').value.trim();
        localStorage.setItem('gemini_api_key', key);
        window.geminiService = new GeminiService(key);
        updateSettingsStatus();
        showToast('✅ Gemini API Key gespeichert!', 'success');
    });

    document.getElementById('btn-save-stundensatz')?.addEventListener('click', () => {
        const satz = document.getElementById('stundensatz').value;
        localStorage.setItem('stundensatz', satz);
        window.materialService?.setStundensatz(parseFloat(satz));
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
        showToast('📥 Daten exportiert!', 'success');
    });
}

// ============================================
// Mahnwesen (Dunning)
// ============================================
function renderMahnwesen() {
    const container = document.getElementById('mahnwesen-list');
    if (!container) {return;}
    const rechnungen = store?.rechnungen?.filter(r => r.status === 'offen') || [];

    if (rechnungen.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine offenen Rechnungen</p>';
        return;
    }

    container.innerHTML = rechnungen.map(r => `
        <div class="item-card">
            <div class="item-header">
                <h3 class="item-title">${window.UI.sanitize(r.kunde?.name || 'Unbekannter Kunde')}</h3>
                <span class="item-id">${r.id}</span>
            </div>
            <div class="item-meta">
                <span>💰 ${formatCurrency(r.brutto)}</span>
                <span>📅 ${formatDate(r.createdAt)}</span>
            </div>
        </div>
    `).join('');
}

function openMahnungModal(rechnungId) {
    const rechnung = store.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) {return;}

    const modal = document.getElementById('modal-mahnung');
    if (modal) {
        modal.querySelector('[data-rechnung-id]').dataset.rechnungId = rechnungId;
        openModal('modal-mahnung');
    }
}

function initMahnwesen() {
    document.getElementById('btn-mahnung-create')?.addEventListener('click', () => {
        const rechnungId = document.querySelector('[data-rechnung-id]')?.dataset?.rechnungId;
        if (!rechnungId) {return;}

        const mahnung = {
            id: generateId('MAH'),
            rechnungId,
            stufe: 1,
            datum: new Date().toISOString(),
            status: 'versendet'
        };

        if (!store.mahnungen) {store.mahnungen = [];}
        store.mahnungen.push(mahnung);
        saveStore();

        showToast('✅ Mahnung erstellt!', 'success');
        closeModal('modal-mahnung');
        renderMahnwesen();
    });
}

// ============================================
// Buchhaltung (Accounting)
// ============================================
function renderBuchhaltung() {
    const Jahr = parseInt(document.getElementById('buchhaltung-jahr')?.value) || new Date().getFullYear();
    const buchungen = window.bookkeepingService?.getBuchungenForJahr(Jahr) || [];
    const container = document.getElementById('buchungen-list');
    if (!container) {return;}

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
}

// ============================================
// Automation Settings
// ============================================
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
    if (!senderEmail && typeof generateSenderEmail === 'function') {
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
            email, 'FreyAI Test', 'Diese Test-E-Mail bestätigt, dass der E-Mail-Versand funktioniert.'
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
        if (window.UI?.openModal) window.UI.openModal('modal-test-email');
    });

    // View Email Automation History
    document.getElementById('btn-view-email-automation')?.addEventListener('click', () => {
        if (window.UI?.switchView) window.UI.switchView('email-automation');
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

    const setStatus = (el, configured) => {
        if (!el) return;
        el.textContent = configured ? '● Konfiguriert' : '● Nicht konfiguriert';
        el.className = 'status-indicator' + (configured ? ' connected' : '');
    };

    setStatus(document.getElementById('gemini-status'), geminiKey);
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
        if (!el) return;
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

    const baseEmail = localStorage.getItem('proton_base_email') || 'noreply@freyai-visions.de';
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
// Demo Workflow
// ============================================
async function runDemoWorkflow() {
    showToast('🚀 Demo-Workflow startet...', 'info');

    if (window.materialService?.getAllMaterials().length === 0) {
        window.materialService.loadDemoMaterials();
    }

    const ap = (() => { try { return JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}'); } catch { return {}; } })();
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

    store.anfragen.push(demoAnfrage);
    saveStore();
    addActivity('📥', `Demo-Anfrage von ${demoAnfrage.kunde.name}`);

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
        mwst: (demoAuftrag.netto + demoAuftrag.materialKosten) * 0.19,
        brutto: (demoAuftrag.netto + demoAuftrag.materialKosten) * 1.19,
        status: 'offen',
        createdAt: new Date().toISOString()
    };

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
    try {
        // These functions may not exist if automation modules are not loaded
        if (typeof initPaymentMatching === 'function') {initPaymentMatching();}
        if (typeof initFollowUp === 'function') {initFollowUp();}
        if (typeof initLowStockAlerts === 'function') {initLowStockAlerts();}

        // Update badges on load
        setTimeout(() => {
            if (typeof updateFollowUpBadge === 'function') {updateFollowUpBadge();}
            if (typeof updateLowStockBadge === 'function') {updateLowStockBadge();}
            if (typeof updateEmailAutomationBadge === 'function') {updateEmailAutomationBadge();}
        }, 500);
    } catch (error) {
        console.warn('initAutomations: Some automation modules not yet available:', error.message);
    }
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
window.renderBuchhaltung = renderBuchhaltung;
window.updateDashboard = window.DashboardModule?.updateDashboard;

// ============================================
// Auto-initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await init();
    initAutomations();
});
