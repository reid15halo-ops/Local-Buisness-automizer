/* ============================================
   Wareneingang Module
   Goods receipt: Bon scan, Bank detection,
   Supplier CSV import, History
   ============================================ */

(function() {
'use strict';

const { store, saveStore, formatCurrency, formatDate, h, showToast, openModal, closeModal } = window.AppUtils || {};

// ============================================
// Module State
// ============================================
let activeTab = 'bon';
let bonScanResults = null;      // parsed items from OCR scan
let bankQuickEntry = null;      // { transactionId, rows: [...] }
let csvImportResults = null;    // parsed items from CSV/Excel
let cameraStream = null;
let expandedHistoryIds = new Set();

// ============================================
// 1. Main Render
// ============================================
function renderWareneingang() {
    updateStats();
    renderActiveTab();
    renderWareneingangHistory();
}

function updateStats() {
    const wareneingaenge = getWareneingaengeList();
    const count = wareneingaenge.length;
    const totalValue = wareneingaenge.reduce((sum, we) => sum + (we.gesamtwert || 0), 0);
    const lastEntry = wareneingaenge.length > 0
        ? wareneingaenge.sort((a, b) => new Date(b.datum) - new Date(a.datum))[0]
        : null;

    const elCount = document.getElementById('we-count');
    const elValue = document.getElementById('we-value');
    const elLast = document.getElementById('we-last');
    const elBankPending = document.getElementById('we-bank-pending');

    if (elCount) {elCount.textContent = count;}
    if (elValue) {elValue.textContent = formatCurrency(totalValue);}
    if (elLast) {elLast.textContent = lastEntry ? formatDate(lastEntry.datum) : '\u2013';}

    // Count unmatched bank purchases
    let bankPending = 0;
    if (window.bankingService) {
        try {
            const txs = window.bankingService.getTransactions({ type: 'debit', category: 'material', matched: false });
            bankPending = txs.length;
        } catch (e) { /* service not ready */ }
    }
    if (elBankPending) {elBankPending.textContent = bankPending;}

    // Update nav badge
    const badge = document.getElementById('wareneingang-badge');
    if (badge) {badge.textContent = bankPending;}
}

// ============================================
// Helper: get list from bonScannerService or store
// ============================================
function getWareneingaengeList() {
    if (window.bonScannerService && typeof window.bonScannerService.getWareneingaenge === 'function') {
        try { return window.bonScannerService.getWareneingaenge() || []; } catch (e) { /* fallback */ }
    }
    return store.wareneingaenge || [];
}

// ============================================
// Tab Switching
// ============================================
function switchTab(tabId) {
    activeTab = tabId;

    // Update tab buttons
    document.querySelectorAll('.we-tab').forEach(btn => {
        const isActive = btn.getAttribute('data-we-tab') === tabId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update tab panels
    document.querySelectorAll('.we-tab-content').forEach(panel => {
        panel.classList.remove('active');
    });
    const activePanel = document.getElementById('we-tab-' + tabId);
    if (activePanel) {activePanel.classList.add('active');}

    renderActiveTab();
}

function renderActiveTab() {
    switch (activeTab) {
        case 'bon':  renderBonScanTab(); break;
        case 'bank': renderBankTab(); break;
        case 'csv':  renderSupplierImportTab(); break;
    }
}

// ============================================
// 2. Tab 1: Bon Scannen
// ============================================
function renderBonScanTab() {
    const resultsContainer = document.getElementById('we-bon-results');
    if (!resultsContainer) {return;}

    if (!bonScanResults) {
        resultsContainer.style.display = 'none';
        return;
    }

    resultsContainer.style.display = '';
    resultsContainer.innerHTML = buildResultsTable(bonScanResults, 'bon');
}

async function handleBonFile(file) {
    if (!file) {return;}

    const dropzone = document.getElementById('we-dropzone');
    const processing = document.getElementById('we-processing');
    const resultsContainer = document.getElementById('we-bon-results');

    // Show processing state
    if (dropzone) {dropzone.style.display = 'none';}
    if (processing) {processing.style.display = '';}
    if (resultsContainer) {resultsContainer.style.display = 'none';}

    try {
        // Step 1: OCR scan
        let ocrResult;
        if (window.ocrScannerService) {
            ocrResult = await window.ocrScannerService.scanFromFile(file);
        } else {
            throw new Error('OCR-Service nicht verfuegbar');
        }

        if (!ocrResult || !ocrResult.success) {
            throw new Error('OCR-Erkennung fehlgeschlagen');
        }

        const extractedText = ocrResult.document ? ocrResult.document.text : '';

        // Step 2: Parse receipt text
        let parsed = { items: [], supplier: '', date: '' };
        if (window.bonScannerService && typeof window.bonScannerService.parseReceiptText === 'function') {
            parsed = await window.bonScannerService.parseReceiptText(extractedText);
        }

        // Step 3: Match to materials
        let matchedItems = parsed.items || [];
        if (window.bonScannerService && typeof window.bonScannerService.matchItemsToMaterials === 'function') {
            matchedItems = await window.bonScannerService.matchItemsToMaterials(matchedItems);
        }

        // Step 4: Suggest Auftrag
        let suggestedAuftrag = null;
        if (window.bonScannerService && typeof window.bonScannerService.suggestAuftrag === 'function') {
            suggestedAuftrag = await window.bonScannerService.suggestAuftrag(matchedItems);
        }

        bonScanResults = {
            items: matchedItems,
            supplier: parsed.supplier || '',
            date: parsed.date || new Date().toISOString(),
            suggestedAuftragId: suggestedAuftrag ? suggestedAuftrag.id : '',
            source: 'bon'
        };

        showToast('Bon erfolgreich erkannt!', 'success');
    } catch (err) {
        console.error('Bon scan error:', err);
        showToast('Fehler beim Scannen: ' + err.message, 'error');
        bonScanResults = null;
    } finally {
        if (processing) {processing.style.display = 'none';}
        if (!bonScanResults && dropzone) {dropzone.style.display = '';}
        renderBonScanTab();
    }
}

// ============================================
// Camera Flow
// ============================================
async function startCamera() {
    const previewContainer = document.getElementById('we-camera-preview');
    const videoEl = document.getElementById('we-camera-video');
    const dropzone = document.getElementById('we-dropzone');

    if (!previewContainer || !videoEl) {return;}

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        videoEl.srcObject = cameraStream;
        if (dropzone) {dropzone.style.display = 'none';}
        previewContainer.style.display = '';
    } catch (err) {
        console.error('Camera error:', err);
        showToast('Kamera konnte nicht gestartet werden: ' + err.message, 'error');
    }
}

async function captureCamera() {
    const videoEl = document.getElementById('we-camera-video');
    if (!videoEl || !window.ocrScannerService) {return;}

    const previewContainer = document.getElementById('we-camera-preview');
    const processing = document.getElementById('we-processing');

    stopCamera();
    if (previewContainer) {previewContainer.style.display = 'none';}
    if (processing) {processing.style.display = '';}

    try {
        const ocrResult = await window.ocrScannerService.scanFromCamera(videoEl);
        if (!ocrResult || !ocrResult.success) {
            throw new Error('Kamera-OCR fehlgeschlagen');
        }

        const extractedText = ocrResult.document ? ocrResult.document.text : '';

        let parsed = { items: [], supplier: '', date: '' };
        if (window.bonScannerService && typeof window.bonScannerService.parseReceiptText === 'function') {
            parsed = await window.bonScannerService.parseReceiptText(extractedText);
        }

        let matchedItems = parsed.items || [];
        if (window.bonScannerService && typeof window.bonScannerService.matchItemsToMaterials === 'function') {
            matchedItems = await window.bonScannerService.matchItemsToMaterials(matchedItems);
        }

        let suggestedAuftrag = null;
        if (window.bonScannerService && typeof window.bonScannerService.suggestAuftrag === 'function') {
            suggestedAuftrag = await window.bonScannerService.suggestAuftrag(matchedItems);
        }

        bonScanResults = {
            items: matchedItems,
            supplier: parsed.supplier || '',
            date: parsed.date || new Date().toISOString(),
            suggestedAuftragId: suggestedAuftrag ? suggestedAuftrag.id : '',
            source: 'bon'
        };

        showToast('Foto erfolgreich erkannt!', 'success');
    } catch (err) {
        console.error('Camera capture error:', err);
        showToast('Fehler: ' + err.message, 'error');
        bonScanResults = null;
    } finally {
        if (processing) {processing.style.display = 'none';}
        if (!bonScanResults) {
            const dropzone = document.getElementById('we-dropzone');
            if (dropzone) {dropzone.style.display = '';}
        }
        renderBonScanTab();
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const videoEl = document.getElementById('we-camera-video');
    if (videoEl) {videoEl.srcObject = null;}
}

function cancelCamera() {
    stopCamera();
    const previewContainer = document.getElementById('we-camera-preview');
    const dropzone = document.getElementById('we-dropzone');
    if (previewContainer) {previewContainer.style.display = 'none';}
    if (dropzone) {dropzone.style.display = '';}
}

// ============================================
// 3. Tab 2: Bank-Erkennung
// ============================================
function renderBankTab() {
    const listContainer = document.getElementById('we-bank-list');
    const resultsContainer = document.getElementById('we-bank-results');
    if (!listContainer) {return;}

    let transactions = [];
    if (window.bankingService) {
        try {
            // Use enhanced detection if available, fallback to basic filter
            if (typeof window.bankingService.getUnprocessedMaterialPurchases === 'function') {
                transactions = window.bankingService.getUnprocessedMaterialPurchases();
            } else {
                transactions = window.bankingService.getTransactions({ type: 'debit', category: 'material', matched: false });
            }
        } catch (e) { /* service not ready */ }
    }

    if (transactions.length === 0) {
        listContainer.innerHTML = '<p class="empty-state">Keine offenen Material-Eink\u00e4ufe erkannt. Verbinde dein Bankkonto unter Buchhaltung.</p>';
        if (resultsContainer) {resultsContainer.style.display = 'none';}
        return;
    }

    listContainer.innerHTML = transactions.map(tx => `
        <div class="item-card we-bank-tx" data-tx-id="${h(tx.id)}">
            <div class="item-header">
                <div>
                    <h3 class="item-title">${h(tx.name || tx.supplier || 'Unbekannt')}</h3>
                    <span class="item-id">${h(tx.id)}</span>
                </div>
                <span class="we-tx-amount" style="font-weight:700; color:var(--danger, #ef4444);">
                    ${formatCurrency(Math.abs(tx.amount || 0))}
                </span>
            </div>
            <div class="item-meta">
                <span>${formatDate(tx.date)}</span>
                <span>${h(tx.purpose || '')}</span>
            </div>
            <div style="margin-top:8px;">
                <button class="btn btn-secondary btn-sm we-bank-capture-btn" data-tx-id="${h(tx.id)}">
                    Positionen erfassen
                </button>
            </div>
        </div>
    `).join('');

    // Render quick-entry form if active
    if (bankQuickEntry && resultsContainer) {
        const tx = transactions.find(t => t.id === bankQuickEntry.transactionId);
        resultsContainer.style.display = '';
        resultsContainer.innerHTML = buildBankQuickEntryForm(bankQuickEntry, tx);
    } else if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
}

function openBankQuickEntry(transactionId) {
    bankQuickEntry = {
        transactionId: transactionId,
        rows: [createEmptyBankRow()]
    };
    renderBankTab();
}

function createEmptyBankRow() {
    return { materialId: '', menge: 1, einheit: 'Stk.', preis: 0, searchQuery: '' };
}

function buildBankQuickEntryForm(entry, tx) {
    const auftraege = store.auftraege || [];
    const materials = getAllMaterials();

    let html = '<div class="we-quick-entry">';
    html += '<h3>Positionen erfassen';
    if (tx) {html += ' <span style="color:var(--text-secondary); font-weight:400;">(' + h(tx.name || '') + ')</span>';}
    html += '</h3>';

    html += '<div class="we-table-responsive"><table class="we-results-table"><thead><tr>';
    html += '<th>Material</th><th>Menge</th><th>Einheit</th><th>Preis</th><th></th>';
    html += '</tr></thead><tbody>';

    entry.rows.forEach((row, idx) => {
        html += '<tr data-bank-row="' + idx + '">';
        html += '<td>';
        html += '<input type="text" class="form-input we-bank-material-search" data-row="' + idx + '" '
            + 'placeholder="Material suchen..." value="' + h(row.searchQuery || '') + '" '
            + 'autocomplete="off" style="min-width:160px;">';
        html += buildMaterialDropdown(materials, row.materialId, 'we-bank-mat-select', idx);
        html += '</td>';
        html += '<td><input type="number" class="form-input we-bank-menge" data-row="' + idx + '" '
            + 'value="' + row.menge + '" min="0" step="any" style="width:70px;"></td>';
        html += '<td><input type="text" class="form-input we-bank-einheit" data-row="' + idx + '" '
            + 'value="' + h(row.einheit) + '" style="width:60px;"></td>';
        html += '<td><input type="number" class="form-input we-bank-preis" data-row="' + idx + '" '
            + 'value="' + row.preis + '" min="0" step="0.01" style="width:90px;"></td>';
        html += '<td><button class="btn btn-icon btn-sm we-bank-remove-row" data-row="' + idx + '" '
            + 'title="Zeile entfernen" aria-label="Zeile entfernen" '
            + 'style="min-width:36px;min-height:36px;">&times;</button></td>';
        html += '</tr>';
    });

    html += '</tbody></table></div>';

    html += '<div class="we-quick-entry-actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">';
    html += '<button class="btn btn-secondary btn-sm" id="we-bank-add-row" style="min-height:44px;">+ Zeile hinzuf\u00fcgen</button>';
    html += '<select class="form-select" id="we-bank-auftrag" style="min-height:44px; max-width:220px;" aria-label="Auftrag zuordnen">';
    html += '<option value="">Kein Auftrag</option>';
    auftraege.forEach(a => {
        const label = (a.id || '') + ' \u2013 ' + (a.kunde ? a.kunde.name || '' : '') + ' \u2013 ' + (a.beschreibung || '').substring(0, 30);
        html += '<option value="' + h(a.id) + '">' + h(label) + '</option>';
    });
    html += '</select>';
    html += '<button class="btn btn-primary" id="we-bank-buchen" style="min-height:44px;">Buchen</button>';
    html += '<button class="btn btn-secondary" id="we-bank-cancel" style="min-height:44px;">Abbrechen</button>';
    html += '</div></div>';

    return html;
}

function addBankRow() {
    if (!bankQuickEntry) {return;}
    bankQuickEntry.rows.push(createEmptyBankRow());
    renderBankTab();
}

function removeBankRow(idx) {
    if (!bankQuickEntry) {return;}
    if (bankQuickEntry.rows.length <= 1) {return;} // keep at least one row
    bankQuickEntry.rows.splice(idx, 1);
    renderBankTab();
}

function updateBankRowField(idx, field, value) {
    if (!bankQuickEntry || !bankQuickEntry.rows[idx]) {return;}
    bankQuickEntry.rows[idx][field] = value;
}

async function processBankEntry() {
    if (!bankQuickEntry) {return;}

    // Sync fields from DOM
    syncBankRowsFromDOM();

    const validRows = bankQuickEntry.rows.filter(r => r.materialId || r.searchQuery);
    if (validRows.length === 0) {
        showToast('Bitte mindestens ein Material angeben.', 'error');
        return;
    }

    const auftragSelect = document.getElementById('we-bank-auftrag');
    const auftragId = auftragSelect ? auftragSelect.value : '';

    const items = validRows.map(r => ({
        materialId: r.materialId,
        beschreibung: r.searchQuery || '',
        menge: parseFloat(r.menge) || 0,
        einheit: r.einheit || 'Stk.',
        einzelpreis: parseFloat(r.preis) || 0,
        gesamt: (parseFloat(r.menge) || 0) * (parseFloat(r.preis) || 0)
    }));

    try {
        if (window.bonScannerService && typeof window.bonScannerService.processWareneingang === 'function') {
            await window.bonScannerService.processWareneingang({
                items: items,
                auftragId: auftragId,
                source: 'bank',
                transactionId: bankQuickEntry.transactionId,
                datum: new Date().toISOString(),
                gesamtwert: items.reduce((s, i) => s + i.gesamt, 0)
            });
        } else {
            saveWareneingangLocally({
                items: items,
                auftragId: auftragId,
                source: 'bank',
                transactionId: bankQuickEntry.transactionId
            });
        }

        showToast('Wareneingang erfolgreich gebucht!', 'success');
        bankQuickEntry = null;
        renderWareneingang();
    } catch (err) {
        console.error('Bank booking error:', err);
        showToast('Fehler beim Buchen: ' + err.message, 'error');
    }
}

function syncBankRowsFromDOM() {
    if (!bankQuickEntry) {return;}
    bankQuickEntry.rows.forEach((row, idx) => {
        const searchEl = document.querySelector('.we-bank-material-search[data-row="' + idx + '"]');
        const selectEl = document.querySelector('.we-bank-mat-select[data-row="' + idx + '"]');
        const mengeEl = document.querySelector('.we-bank-menge[data-row="' + idx + '"]');
        const einheitEl = document.querySelector('.we-bank-einheit[data-row="' + idx + '"]');
        const preisEl = document.querySelector('.we-bank-preis[data-row="' + idx + '"]');

        if (searchEl) {row.searchQuery = searchEl.value;}
        if (selectEl) {row.materialId = selectEl.value;}
        if (mengeEl) {row.menge = parseFloat(mengeEl.value) || 0;}
        if (einheitEl) {row.einheit = einheitEl.value;}
        if (preisEl) {row.preis = parseFloat(preisEl.value) || 0;}
    });
}

// ============================================
// 4. Tab 3: Lieferanten-Import
// ============================================
function renderSupplierImportTab() {
    const resultsContainer = document.getElementById('we-csv-results');
    if (!resultsContainer) {return;}

    if (!csvImportResults) {
        resultsContainer.style.display = 'none';
        return;
    }

    resultsContainer.style.display = '';
    resultsContainer.innerHTML = buildResultsTable(csvImportResults, 'csv');
}

async function handleCSVFile(file) {
    if (!file) {return;}

    const supplierSelect = document.getElementById('we-supplier-type');
    const supplierType = supplierSelect ? supplierSelect.value : 'generic';
    const resultsContainer = document.getElementById('we-csv-results');

    if (resultsContainer) {
        resultsContainer.style.display = '';
        resultsContainer.innerHTML = '<div class="we-processing" style="display:flex;align-items:center;gap:12px;padding:24px;">'
            + '<div class="we-spinner"></div><p>Datei wird verarbeitet...</p></div>';
    }

    try {
        let parsed = { items: [], supplier: supplierType };

        if (window.bonScannerService && typeof window.bonScannerService.parseSupplierCSV === 'function') {
            parsed = await window.bonScannerService.parseSupplierCSV(file, supplierType);
        } else {
            throw new Error('Import-Service nicht verf\u00fcgbar');
        }

        let matchedItems = parsed.items || [];
        if (window.bonScannerService && typeof window.bonScannerService.matchItemsToMaterials === 'function') {
            matchedItems = await window.bonScannerService.matchItemsToMaterials(matchedItems);
        }

        let suggestedAuftrag = null;
        if (window.bonScannerService && typeof window.bonScannerService.suggestAuftrag === 'function') {
            suggestedAuftrag = await window.bonScannerService.suggestAuftrag(matchedItems);
        }

        csvImportResults = {
            items: matchedItems,
            supplier: parsed.supplier || supplierType,
            date: parsed.date || new Date().toISOString(),
            suggestedAuftragId: suggestedAuftrag ? suggestedAuftrag.id : '',
            source: 'csv'
        };

        showToast(matchedItems.length + ' Positionen importiert!', 'success');
    } catch (err) {
        console.error('CSV import error:', err);
        showToast('Fehler beim Import: ' + err.message, 'error');
        csvImportResults = null;
    }

    renderSupplierImportTab();
}

// ============================================
// Shared Results Table (Bon + CSV)
// ============================================
function buildResultsTable(results, source) {
    const materials = getAllMaterials();
    const auftraege = store.auftraege || [];

    let html = '<div class="we-parsed-results">';

    // Editable items table
    html += '<div class="we-table-responsive"><table class="we-results-table"><thead><tr>';
    html += '<th>Beschreibung</th><th>Menge</th><th>Einheit</th>';
    html += '<th>Einzelpreis</th><th>Gesamt</th><th>Zuordnung</th>';
    html += '</tr></thead><tbody>';

    (results.items || []).forEach((item, idx) => {
        const confidence = item.matchConfidence != null ? item.matchConfidence : (item.confidence != null ? item.confidence : 0);
        const confidenceColor = confidence > 0.8 ? '#22c55e' : (confidence > 0.5 ? '#f59e0b' : '#ef4444');
        const gesamt = (parseFloat(item.menge) || 0) * (parseFloat(item.einzelpreis) || 0);
        const prefix = source; // 'bon' or 'csv'

        html += '<tr data-result-row="' + idx + '" data-source="' + prefix + '">';
        html += '<td><input type="text" class="form-input we-res-beschreibung" data-row="' + idx + '" data-source="' + prefix + '" '
            + 'value="' + h(item.beschreibung || item.description || '') + '" style="min-width:140px;"></td>';
        html += '<td><input type="number" class="form-input we-res-menge" data-row="' + idx + '" data-source="' + prefix + '" '
            + 'value="' + (item.menge || 1) + '" min="0" step="any" style="width:70px;"></td>';
        html += '<td><input type="text" class="form-input we-res-einheit" data-row="' + idx + '" data-source="' + prefix + '" '
            + 'value="' + h(item.einheit || 'Stk.') + '" style="width:60px;"></td>';
        html += '<td><input type="number" class="form-input we-res-einzelpreis" data-row="' + idx + '" data-source="' + prefix + '" '
            + 'value="' + (item.einzelpreis || item.preis || 0) + '" min="0" step="0.01" style="width:90px;"></td>';
        html += '<td class="we-res-gesamt" style="white-space:nowrap; font-weight:600;">' + formatCurrency(gesamt) + '</td>';
        html += '<td>';
        html += '<span class="we-confidence-dot" style="display:inline-block; width:10px; height:10px; border-radius:50%;'
            + 'background:' + confidenceColor + '; margin-right:6px;" '
            + 'title="Zuordnungs-Konfidenz: ' + Math.round(confidence * 100) + '%"></span>';
        html += buildMaterialDropdown(materials, item.materialId || '', 'we-res-material', idx, prefix);
        html += '</td>';
        html += '</tr>';
    });

    html += '</tbody></table></div>';

    // Auftrag selector + submit button
    html += '<div class="we-results-footer" style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">';

    html += '<label style="font-weight:600; white-space:nowrap;">Auftrag zuordnen:</label>';
    html += '<select class="form-select we-auftrag-select" id="we-auftrag-' + source + '" style="min-height:44px; max-width:260px;" aria-label="Auftrag zuordnen">';
    html += '<option value="">Kein Auftrag</option>';
    auftraege.forEach(a => {
        const selected = results.suggestedAuftragId === a.id ? ' selected' : '';
        const label = (a.id || '') + ' \u2013 ' + (a.kunde ? a.kunde.name || '' : '') + ' \u2013 ' + (a.beschreibung || '').substring(0, 30);
        html += '<option value="' + h(a.id) + '"' + selected + '>' + h(label) + '</option>';
    });
    html += '</select>';

    html += '<button class="btn btn-primary btn-lg we-buchen-btn" data-source="' + source + '" '
        + 'style="min-height:48px; padding:12px 32px; font-size:1.05rem;">Wareneingang buchen</button>';

    html += '<button class="btn btn-secondary we-reset-btn" data-source="' + source + '" '
        + 'style="min-height:44px;">Verwerfen</button>';

    html += '</div></div>';

    return html;
}

function buildMaterialDropdown(materials, selectedId, cssClass, rowIdx, sourcePrefix) {
    let html = '<select class="form-select ' + cssClass + '" data-row="' + rowIdx + '"'
        + (sourcePrefix ? ' data-source="' + sourcePrefix + '"' : '')
        + ' style="min-width:140px; min-height:44px;" aria-label="Material zuordnen">';
    html += '<option value="">-- Material --</option>';
    materials.forEach(m => {
        const sel = selectedId === m.id ? ' selected' : '';
        html += '<option value="' + h(m.id) + '"' + sel + '>'
            + h(m.artikelnummer || '') + ' \u2013 ' + h(m.bezeichnung || '')
            + '</option>';
    });
    html += '</select>';
    return html;
}

// ============================================
// Booking (Bon + CSV)
// ============================================
async function processResultsBooking(source) {
    const resultData = source === 'bon' ? bonScanResults : csvImportResults;
    if (!resultData || !resultData.items || resultData.items.length === 0) {
        showToast('Keine Positionen zum Buchen vorhanden.', 'error');
        return;
    }

    // Sync editable fields from DOM
    syncResultItemsFromDOM(resultData, source);

    const auftragSelect = document.getElementById('we-auftrag-' + source);
    const auftragId = auftragSelect ? auftragSelect.value : '';

    const items = resultData.items.map(item => ({
        materialId: item.materialId || '',
        beschreibung: item.beschreibung || item.description || '',
        menge: parseFloat(item.menge) || 0,
        einheit: item.einheit || 'Stk.',
        einzelpreis: parseFloat(item.einzelpreis || item.preis) || 0,
        gesamt: (parseFloat(item.menge) || 0) * (parseFloat(item.einzelpreis || item.preis) || 0)
    }));

    const gesamtwert = items.reduce((s, i) => s + i.gesamt, 0);

    try {
        if (window.bonScannerService && typeof window.bonScannerService.processWareneingang === 'function') {
            await window.bonScannerService.processWareneingang({
                items: items,
                auftragId: auftragId,
                source: source,
                supplier: resultData.supplier || '',
                datum: resultData.date || new Date().toISOString(),
                gesamtwert: gesamtwert
            });
        } else {
            saveWareneingangLocally({
                items: items,
                auftragId: auftragId,
                source: source,
                supplier: resultData.supplier || ''
            });
        }

        showToast('Wareneingang erfolgreich gebucht! (' + items.length + ' Positionen, ' + formatCurrency(gesamtwert) + ')', 'success');

        // Reset state
        if (source === 'bon') {
            bonScanResults = null;
            const dropzone = document.getElementById('we-dropzone');
            if (dropzone) {dropzone.style.display = '';}
        } else {
            csvImportResults = null;
        }

        renderWareneingang();
    } catch (err) {
        console.error('Booking error:', err);
        showToast('Fehler beim Buchen: ' + err.message, 'error');
    }
}

function syncResultItemsFromDOM(resultData, source) {
    if (!resultData || !resultData.items) {return;}
    resultData.items.forEach((item, idx) => {
        const beschEl = document.querySelector('.we-res-beschreibung[data-row="' + idx + '"][data-source="' + source + '"]');
        const mengeEl = document.querySelector('.we-res-menge[data-row="' + idx + '"][data-source="' + source + '"]');
        const einheitEl = document.querySelector('.we-res-einheit[data-row="' + idx + '"][data-source="' + source + '"]');
        const preisEl = document.querySelector('.we-res-einzelpreis[data-row="' + idx + '"][data-source="' + source + '"]');
        const matEl = document.querySelector('.we-res-material[data-row="' + idx + '"][data-source="' + source + '"]');

        if (beschEl) {item.beschreibung = beschEl.value;}
        if (mengeEl) {item.menge = parseFloat(mengeEl.value) || 0;}
        if (einheitEl) {item.einheit = einheitEl.value;}
        if (preisEl) {item.einzelpreis = parseFloat(preisEl.value) || 0;}
        if (matEl) {item.materialId = matEl.value;}
    });
}

function resetResults(source) {
    if (source === 'bon') {
        bonScanResults = null;
        const dropzone = document.getElementById('we-dropzone');
        if (dropzone) {dropzone.style.display = '';}
        renderBonScanTab();
    } else if (source === 'csv') {
        csvImportResults = null;
        renderSupplierImportTab();
    }
}

// ============================================
// Fallback local save
// ============================================
function saveWareneingangLocally(data) {
    if (!store.wareneingaenge) {store.wareneingaenge = [];}

    const we = {
        id: 'WE-' + Date.now(),
        datum: data.datum || new Date().toISOString(),
        lieferant: data.supplier || '',
        items: data.items || [],
        gesamtwert: (data.items || []).reduce((s, i) => s + (i.gesamt || 0), 0),
        auftragId: data.auftragId || '',
        source: data.source || 'manual',
        transactionId: data.transactionId || '',
        createdAt: new Date().toISOString()
    };

    store.wareneingaenge.push(we);
    saveStore();

    // Update material stock
    if (window.materialService) {
        we.items.forEach(item => {
            if (item.materialId && item.menge) {
                try {
                    window.materialService.updateStock(item.materialId, parseFloat(item.menge) || 0);
                } catch (e) {
                    console.warn('Stock update failed for', item.materialId, e);
                }
            }
        });
    }
}

// ============================================
// Material helpers
// ============================================
function getAllMaterials() {
    if (window.materialService && typeof window.materialService.getAllMaterials === 'function') {
        try { return window.materialService.getAllMaterials(); } catch (e) { /* fallback */ }
    }
    return [];
}

function searchMaterials(query) {
    if (window.materialService && typeof window.materialService.searchMaterials === 'function') {
        try { return window.materialService.searchMaterials(query); } catch (e) { /* fallback */ }
    }
    return [];
}

// ============================================
// 5. History
// ============================================
function renderWareneingangHistory() {
    const container = document.getElementById('we-history-list');
    if (!container) {return;}

    const wareneingaenge = getWareneingaengeList();
    const sorted = [...wareneingaenge].sort((a, b) => new Date(b.datum || b.createdAt) - new Date(a.datum || a.createdAt));

    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Wareneing\u00e4nge erfasst.</p>';
        return;
    }

    container.innerHTML = sorted.map(we => {
        const isExpanded = expandedHistoryIds.has(we.id);
        const sourceIcon = getSourceIcon(we.source);
        const items = we.items || [];
        const auftrag = we.auftragId
            ? (store.auftraege || []).find(a => a.id === we.auftragId)
            : null;

        let html = '<div class="item-card we-history-card' + (isExpanded ? ' we-expanded' : '') + '" data-we-id="' + h(we.id) + '">';
        html += '<div class="item-header we-history-toggle" data-we-id="' + h(we.id) + '" role="button" tabindex="0" '
            + 'aria-expanded="' + (isExpanded ? 'true' : 'false') + '" '
            + 'style="cursor:pointer;">';
        html += '<div style="display:flex; align-items:center; gap:8px;">';
        html += '<span class="we-source-icon" title="' + h(getSourceLabel(we.source)) + '">' + sourceIcon + '</span>';
        html += '<div>';
        html += '<h3 class="item-title" style="margin:0;">' + h(we.lieferant || 'Wareneingang') + '</h3>';
        html += '<span class="item-id">' + h(we.id) + '</span>';
        html += '</div>';
        html += '</div>';
        html += '<div style="text-align:right;">';
        html += '<div style="font-weight:700;">' + formatCurrency(we.gesamtwert || 0) + '</div>';
        html += '<div style="font-size:0.85rem; color:var(--text-secondary);">' + formatDate(we.datum || we.createdAt) + '</div>';
        html += '</div>';
        html += '</div>'; // header

        html += '<div class="item-meta" style="margin-top:4px;">';
        html += '<span>' + items.length + ' Position' + (items.length !== 1 ? 'en' : '') + '</span>';
        if (auftrag) {
            html += '<span>Auftrag: ' + h(auftrag.id) + ' \u2013 ' + h(auftrag.kunde ? auftrag.kunde.name || '' : '') + '</span>';
        }
        html += '</div>';

        // Expanded detail
        if (isExpanded) {
            html += '<div class="we-history-detail" style="margin-top:12px; border-top:1px solid var(--border-color, #e5e7eb); padding-top:12px;">';
            if (items.length > 0) {
                html += '<table class="we-results-table" style="width:100%; font-size:0.9rem;"><thead><tr>';
                html += '<th>Beschreibung</th><th>Menge</th><th>Einheit</th><th>Einzelpreis</th><th>Gesamt</th>';
                html += '</tr></thead><tbody>';
                items.forEach(item => {
                    const gesamt = (parseFloat(item.menge) || 0) * (parseFloat(item.einzelpreis) || 0);
                    html += '<tr>';
                    html += '<td>' + h(item.beschreibung || '') + '</td>';
                    html += '<td>' + (item.menge || 0) + '</td>';
                    html += '<td>' + h(item.einheit || '') + '</td>';
                    html += '<td>' + formatCurrency(item.einzelpreis || 0) + '</td>';
                    html += '<td style="font-weight:600;">' + formatCurrency(gesamt) + '</td>';
                    html += '</tr>';
                });
                html += '</tbody></table>';
            } else {
                html += '<p style="color:var(--text-secondary);">Keine Positionen gespeichert.</p>';
            }
            html += '</div>';
        }

        html += '</div>'; // card
        return html;
    }).join('');
}

function getSourceIcon(source) {
    switch (source) {
        case 'bon':  return '\uD83D\uDCF7'; // camera
        case 'bank': return '\uD83C\uDFE6'; // bank
        case 'csv':  return '\uD83D\uDCC4'; // document
        default:     return '\uD83D\uDCE6'; // package
    }
}

function getSourceLabel(source) {
    switch (source) {
        case 'bon':  return 'Bon-Scan';
        case 'bank': return 'Bank-Erkennung';
        case 'csv':  return 'Lieferanten-Import';
        default:     return 'Manuell';
    }
}

function toggleHistoryExpand(weId) {
    if (expandedHistoryIds.has(weId)) {
        expandedHistoryIds.delete(weId);
    } else {
        expandedHistoryIds.add(weId);
    }
    renderWareneingangHistory();
}

// ============================================
// 6. Init / Event Wiring
// ============================================
function initWareneingang() {
    const viewEl = document.getElementById('view-wareneingang');
    if (!viewEl) {return;}

    // --- Tab switching ---
    viewEl.querySelectorAll('.we-tab[data-we-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.getAttribute('data-we-tab'));
        });
    });

    // --- Tab 1: File input ---
    const fileInput = document.getElementById('we-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {handleBonFile(file);}
            e.target.value = ''; // reset for re-upload
        });
    }

    // --- Tab 1: Drag & drop ---
    const dropzone = document.getElementById('we-dropzone');
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('we-dropzone-active');
        });
        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('we-dropzone-active');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('we-dropzone-active');
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) {handleBonFile(file);}
        });
        // Click on dropzone also opens file picker (except when clicking buttons/labels directly)
        dropzone.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('label') || e.target.closest('input')) {return;}
            if (fileInput) {fileInput.click();}
        });
    }

    // --- Tab 1: Camera ---
    const cameraBtn = document.getElementById('we-camera-btn');
    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => startCamera());
    }
    const captureBtn = document.getElementById('we-camera-capture');
    if (captureBtn) {
        captureBtn.addEventListener('click', () => captureCamera());
    }
    const cameraCancelBtn = document.getElementById('we-camera-cancel');
    if (cameraCancelBtn) {
        cameraCancelBtn.addEventListener('click', () => cancelCamera());
    }

    // --- Tab 3: CSV file input ---
    const csvInput = document.getElementById('we-csv-input');
    if (csvInput) {
        csvInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {handleCSVFile(file);}
            e.target.value = '';
        });
    }

    // --- Event delegation for dynamic buttons ---
    viewEl.addEventListener('click', (e) => {
        const target = e.target;

        // Bank: "Positionen erfassen" button
        const bankCaptureBtn = target.closest('.we-bank-capture-btn');
        if (bankCaptureBtn) {
            const txId = bankCaptureBtn.getAttribute('data-tx-id');
            if (txId) {openBankQuickEntry(txId);}
            return;
        }

        // Bank: add row
        if (target.id === 'we-bank-add-row' || target.closest('#we-bank-add-row')) {
            addBankRow();
            return;
        }

        // Bank: remove row
        const removeRowBtn = target.closest('.we-bank-remove-row');
        if (removeRowBtn) {
            const idx = parseInt(removeRowBtn.getAttribute('data-row'), 10);
            if (!isNaN(idx)) {removeBankRow(idx);}
            return;
        }

        // Bank: buchen
        if (target.id === 'we-bank-buchen' || target.closest('#we-bank-buchen')) {
            processBankEntry();
            return;
        }

        // Bank: cancel
        if (target.id === 'we-bank-cancel' || target.closest('#we-bank-cancel')) {
            bankQuickEntry = null;
            renderBankTab();
            return;
        }

        // Bon/CSV: buchen
        const buchenBtn = target.closest('.we-buchen-btn');
        if (buchenBtn) {
            const source = buchenBtn.getAttribute('data-source');
            if (source) {processResultsBooking(source);}
            return;
        }

        // Bon/CSV: reset/discard
        const resetBtn = target.closest('.we-reset-btn');
        if (resetBtn) {
            const source = resetBtn.getAttribute('data-source');
            if (source) {resetResults(source);}
            return;
        }

        // History: toggle expand
        const historyToggle = target.closest('.we-history-toggle');
        if (historyToggle) {
            const weId = historyToggle.getAttribute('data-we-id');
            if (weId) {toggleHistoryExpand(weId);}
            return;
        }
    });

    // Keyboard support for history expand (Enter/Space)
    viewEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const historyToggle = e.target.closest('.we-history-toggle');
            if (historyToggle) {
                e.preventDefault();
                const weId = historyToggle.getAttribute('data-we-id');
                if (weId) {toggleHistoryExpand(weId);}
            }
        }
    });

    // Recalculate row totals on input changes (results tables)
    viewEl.addEventListener('input', (e) => {
        const target = e.target;

        // Recalculate "Gesamt" column when menge or einzelpreis changes
        if (target.classList.contains('we-res-menge') || target.classList.contains('we-res-einzelpreis')) {
            const row = target.closest('tr');
            if (row) {
                const mengeEl = row.querySelector('.we-res-menge');
                const preisEl = row.querySelector('.we-res-einzelpreis');
                const gesamtEl = row.querySelector('.we-res-gesamt');
                if (mengeEl && preisEl && gesamtEl) {
                    const gesamt = (parseFloat(mengeEl.value) || 0) * (parseFloat(preisEl.value) || 0);
                    gesamtEl.textContent = formatCurrency(gesamt);
                }
            }
        }

        // Bank material search (live filter)
        if (target.classList.contains('we-bank-material-search')) {
            const rowIdx = parseInt(target.getAttribute('data-row'), 10);
            const query = target.value.trim();
            const selectEl = target.parentElement ? target.parentElement.querySelector('.we-bank-mat-select') : null;
            if (selectEl && query.length >= 2) {
                const results = searchMaterials(query);
                updateMaterialSelectOptions(selectEl, results);
            }
        }
    });

    // Initial render
    renderWareneingang();
}

function updateMaterialSelectOptions(selectEl, materials) {
    const currentValue = selectEl.value;
    let html = '<option value="">-- Material --</option>';
    materials.forEach(m => {
        const sel = currentValue === m.id ? ' selected' : '';
        html += '<option value="' + h(m.id) + '"' + sel + '>'
            + h(m.artikelnummer || '') + ' \u2013 ' + h(m.bezeichnung || '')
            + '</option>';
    });
    selectEl.innerHTML = html;
}

// ============================================
// Export
// ============================================
window.WareneingangModule = {
    renderWareneingang,
    initWareneingang
};
window.initWareneingang = initWareneingang;

})(); // end IIFE
