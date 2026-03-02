/* ============================================
   Angebote Module
   Angebote (quotes) CRUD and UI
   ============================================ */
(function() {

const { store, saveStore, addActivity, generateId, formatDate, formatCurrency, getLeistungsartLabel, openModal, closeModal, switchView, h, showToast } = window.AppUtils;

// Filter and search state
let currentAngeboteFilter = 'alle';
let currentAngeboteSearch = '';
let angeboteSearchDebounceTimer = null;

function createAngebotFromAnfrage(anfrageId) {
    const anfrage = store.anfragen.find(a => a.id === anfrageId);
    if (!anfrage) {return;}

    // Clear any previous editing state
    store.editingAngebotId = null;

    // Reset modal title to create mode
    const modalTitle = document.getElementById('modal-angebot-title');
    if (modalTitle) {
        modalTitle.textContent = 'Angebot erstellen';
    }

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

    if (addBtn) {addBtn.addEventListener('click', addPosition);}
    if (aiBtn) {aiBtn.addEventListener('click', generateAIText);}

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const anfrageId = document.getElementById('angebot-anfrage-id').value;
        const anfrage = store.anfragen.find(a => a.id === anfrageId);

        const positionen = [];
        document.querySelectorAll('.position-row').forEach(row => {
            const beschreibungInput = row.querySelector('.pos-beschreibung');
            const beschreibung = beschreibungInput.value;
            const menge = parseFloat(row.querySelector('.pos-menge').value) || 0;
            const einheit = row.querySelector('.pos-einheit').value;
            const preis = parseFloat(row.querySelector('.pos-preis').value) || 0;
            const materialId = beschreibungInput.dataset.materialId || null;

            const details = row.querySelector('.pos-details')?.value?.trim() || '';
            const verantwortlich = row.querySelector('.pos-verantwortlich')?.value?.trim() || '';

            if (beschreibung && menge && preis) {
                const position = { beschreibung, menge, einheit, preis, details, verantwortlich };

                // Add material-specific fields
                if (materialId) {
                    const material = window.materialService?.getMaterial(materialId);
                    if (material) {
                        position.materialId = materialId;
                        position.ekPreis = material.preis;
                        position.bestandVerfuegbar = material.bestand;
                        position.artikelnummer = material.artikelnummer;
                    }
                }

                positionen.push(position);
            }
        });

        // Validate: at least one position required
        if (positionen.length === 0) {
            if (window.showToast) {window.showToast('Mindestens eine Position mit Beschreibung, Menge und Preis erforderlich', 'warning');}
            return;
        }

        const netto = positionen.reduce((sum, p) => sum + (p.menge * p.preis), 0);
        if (netto <= 0) {
            if (window.showToast) {window.showToast('Angebotssumme muss größer als 0 sein', 'warning');}
            return;
        }

        const mwst = netto * _getTaxRate();
        const brutto = netto + mwst;

        // Check if we are editing an existing Angebot
        if (store.editingAngebotId) {
            const existing = store.angebote.find(a => a.id === store.editingAngebotId);
            if (existing) {
                existing.positionen = positionen;
                existing.text = document.getElementById('angebot-text').value;
                existing.netto = netto;
                existing.mwst = mwst;
                existing.brutto = brutto;
                existing.updatedAt = new Date().toISOString();

                saveStore();
                addActivity('✏️', `Angebot ${existing.id} für ${existing.kunde.name} aktualisiert`);
                showToast('Angebot erfolgreich aktualisiert', 'success');
            }

            // Clear edit flag
            store.editingAngebotId = null;
        } else {
            // Create new Angebot
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
                status: 'entwurf',
                createdAt: new Date().toISOString()
            };

            store.angebote.push(angebot);

            // Update Anfrage status
            anfrage.status = 'angebot-erstellt';

            saveStore();
            addActivity('📝', `Angebot ${angebot.id} für ${anfrage.kunde.name} erstellt`);
            showToast('Angebot erfolgreich erstellt — vorläufige Version wird versendet…', 'success');

            // Auto-send preliminary quote in background (non-blocking)
            sendVorlaeufigAngebot(angebot, anfrage).catch(err =>
                console.warn('[Angebote] Vorläufiger Versand fehlgeschlagen:', err)
            );
        }

        // Reset modal title back to create mode
        const modalTitle = document.getElementById('modal-angebot-title');
        if (modalTitle) {
            modalTitle.textContent = 'Angebot erstellen';
        }

        closeModal('modal-angebot');
        switchView('angebote');
        document.querySelector('[data-view="angebote"]')?.click();
    });
}

function addPosition(prefill = null) {
    const container = document.getElementById('positionen-list');
    const row = document.createElement('div');
    row.className = 'position-row';

    const uniqueId = Date.now();

    // Prepare material display info
    let materialDisplay = 'Kein Material zugewiesen';
    if (prefill?.materialId) {
        const material = window.materialService?.getMaterial(prefill.materialId);
        if (material) {
            materialDisplay = `${(window.UI?.sanitize || String)(material.bezeichnung)} (${(window.UI?.sanitize || String)(material.artikelnummer)})`;
        }
    }

    row.innerHTML = `
        <div class="pos-beschreibung-wrapper">
            <input type="text" class="pos-beschreibung" placeholder="Beschreibung tippen..."
                   data-suggest-id="${uniqueId}"
                   data-material-id="${prefill?.materialId || ''}"
                   value="${(window.UI?.sanitize || String)(prefill?.beschreibung || '')}"
                   autocomplete="off">
            <div class="material-suggest" id="suggest-${uniqueId}" style="display:none;"></div>
        </div>
        <input type="number" class="pos-menge" placeholder="Menge" step="0.5" value="${prefill?.menge || 1}" oninput="updateAngebotSummary()">
        <input type="text" class="pos-einheit" placeholder="Einheit" value="${(window.UI?.sanitize || String)(prefill?.einheit || 'Stk.')}">
        <input type="number" class="pos-preis" placeholder="€/Einheit" step="0.01" value="${prefill?.preis || ''}" oninput="updateAngebotSummary()">
        <div class="position-material-selector">
            <button type="button" class="btn btn-small position-material-picker" data-position-id="${uniqueId}">📦 Material</button>
            <span class="position-material-info" data-position-id="${uniqueId}">${materialDisplay}</span>
            ${prefill?.materialId ? `<button type="button" class="position-material-clear" data-position-id="${uniqueId}">✕</button>` : ''}
        </div>
        <button type="button" class="position-remove" onclick="this.parentElement.remove(); updateAngebotSummary();">×</button>
        <div class="position-extra-details" style="flex:0 0 100%;width:100%;grid-column:1/-1;padding:10px 4px 6px;margin-top:6px;border-top:1px dashed #d1d5db;display:grid;grid-template-columns:3fr 1fr;gap:10px;align-items:start;">
            <div>
                <label style="font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;">Leistungsbeschreibung für den Kunden <span style="color:#6366f1;">(empfohlen – mehr Details = mehr Vertrauen)</span></label>
                <textarea class="pos-details" rows="2" placeholder="Was genau wird gemacht? Was ist im Preis enthalten? Z.B.: Vollständige Demontage der alten Anlage, fachgerechte Neuinstallation inkl. Dichtheitsprüfung, Spülung aller Leitungen und Übergabe-Protokoll. Alle Arbeiten werden durch einen zertifizierten Fachmann ausgeführt." style="width:100%;resize:vertical;font-size:12px;padding:7px 9px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;box-sizing:border-box;color:#374151;line-height:1.5;">${(window.UI?.sanitize || String)(prefill?.details || '')}</textarea>
            </div>
            <div>
                <label style="font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;">Zuständige Fachkraft / Rolle</label>
                <input type="text" class="pos-verantwortlich" placeholder="z.B. Monteur, Elektriker, Schreiner, Projektleiter" value="${(window.UI?.sanitize || String)(prefill?.verantwortlich || '')}" style="width:100%;font-size:12px;padding:7px 9px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;color:#374151;">
            </div>
        </div>
    `;
    container.appendChild(row);

    // Setup material picker button
    const pickerBtn = row.querySelector('.position-material-picker');
    const materialInfo = row.querySelector('.position-material-info');
    const clearBtn = row.querySelector('.position-material-clear');
    const input = row.querySelector('.pos-beschreibung');
    const suggestBox = row.querySelector('.material-suggest');

    if (pickerBtn) {
        pickerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.materialPickerUI?.open((material) => {
                // Update position with material data
                input.value = material.bezeichnung;
                input.dataset.materialId = material.id;
                row.querySelector('.pos-preis').value = material.vkPreis || material.preis;
                row.querySelector('.pos-einheit').value = material.einheit;

                // Update material info display
                materialInfo.textContent = `${material.bezeichnung} (${material.artikelnummer})`;

                // Show clear button
                if (!row.querySelector('.position-material-clear')) {
                    const newClearBtn = document.createElement('button');
                    newClearBtn.type = 'button';
                    newClearBtn.className = 'position-material-clear';
                    newClearBtn.dataset.positionId = uniqueId;
                    newClearBtn.textContent = '✕';
                    newClearBtn.addEventListener('click', clearMaterialSelection);
                    pickerBtn.parentElement.appendChild(newClearBtn);
                }

                updateAngebotSummary();
            });
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearMaterialSelection);
    }

    function clearMaterialSelection() {
        input.dataset.materialId = '';
        materialInfo.textContent = 'Kein Material zugewiesen';
        clearBtn?.remove?.();
        updateAngebotSummary();
    }

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
            <div class="material-suggest-item" data-material='${h(JSON.stringify(m))}'>
                <span class="material-suggest-name">${h(m.bezeichnung)}</span>
                <span class="material-suggest-meta">
                    <span class="price">${formatCurrency(m.vkPreis || m.preis)}</span>
                    <span class="stock">${m.bestand} ${h(m.einheit)}</span>
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

    const mwst = netto * _getTaxRate();
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

    // Add timeout safety for AI generation
    const aiTimeout = setTimeout(() => {
        aiBtn.innerHTML = '🤖 KI-Vorschlag generieren';
        aiBtn.disabled = false;
        if (window.showToast) {showToast('KI-Generierung abgebrochen (Timeout)', 'warning');}
    }, 30000);

    setTimeout(() => {
        clearTimeout(aiTimeout);
        const ap = (() => { try { return JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}'); } catch { return {}; } })();
        const companyName = ap.company_name || window.storeService?.state?.settings?.companyName || '';
        const signoff = companyName ? `\nMit freundlichen Grüßen\n${companyName}` : '\nMit freundlichen Grüßen';

        // Collect current positions from the form for context
        const currentPositionen = [];
        document.querySelectorAll('.position-row').forEach(row => {
            const desc = row.querySelector('.pos-beschreibung')?.value?.trim();
            const verantw = row.querySelector('.pos-verantwortlich')?.value?.trim();
            const detail = row.querySelector('.pos-details')?.value?.trim();
            if (desc) { currentPositionen.push({ desc, verantw, detail }); }
        });

        const positionenLines = currentPositionen.length > 0
            ? '\n\nDie beauftragten Leistungen im Einzelnen:\n' +
              currentPositionen.map((p, i) => {
                  let line = `  ${i + 1}. ${p.desc}`;
                  if (p.verantw) { line += ` – ausgeführt durch: ${p.verantw}`; }
                  if (p.detail) { line += `\n     → ${p.detail}`; }
                  return line;
              }).join('\n')
            : '';

        const text = `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage vom ${formatDate(anfrage.createdAt)}${anfrage.beschreibung ? ` bezüglich "${anfrage.beschreibung.substring(0, 80)}"` : ''}.

Gerne unterbreiten wir Ihnen das folgende detaillierte Angebot für die gewünschten Arbeiten. Alle Leistungen werden durch qualifizierte Fachkräfte ausgeführt und entsprechen den geltenden Normen und Vorschriften.${positionenLines}

Selbstverständlich stehen wir Ihnen bei Rückfragen zu einzelnen Positionen jederzeit zur Verfügung – wir erläutern Ihnen gerne jeden Schritt persönlich.

Hinweise:
– Alle Preise verstehen sich zzgl. 19 % MwSt.
– Das Angebot gilt 30 Tage ab Erstellungsdatum.
– Änderungen im Arbeitsumfang werden nach tatsächlichem Aufwand berechnet und vorab kommuniziert.
– Nach Abschluss der Arbeiten erhalten Sie ein detailliertes Abnahmeprotokoll.

Wir freuen uns auf eine gute Zusammenarbeit.
${signoff}`;
        document.getElementById('angebot-text').value = text;

        // KI-Transparenz: Vorschlag klar kennzeichnen und Nutzer entscheiden lassen
        if (window.kiTransparencyUI) {
            window.kiTransparencyUI.wrapAIContent('angebot-text', {
                type: 'angebot-text',
                onConfirm: () => {
                    window.AppUtils.showToast('KI-Text übernommen', 'success');
                },
                onReject: () => {
                    document.getElementById('angebot-text').value = '';
                    window.AppUtils.showToast('KI-Text verworfen', 'info');
                }
            });
        }

        aiBtn.innerHTML = '🤖 KI-Vorschlag generieren';
        aiBtn.disabled = false;
    }, 1500);
}

function getAngebotStatusBadge(status) {
    switch (status) {
    case 'entwurf':
        return '<span class="status-badge status-entwurf">● Entwurf</span>';
    case 'offen':
        return '<span class="status-badge status-offen">● Wartet auf Annahme</span>';
    case 'angenommen':
        return '<span class="status-badge status-angenommen">● Angenommen</span>';
    case 'vorläufig_gesendet':
        return '<span class="status-badge status-offen">✉️ Vorläufig gesendet</span>';
    case 'abgelehnt':
        return '<span class="status-badge status-abgelehnt">● Abgelehnt</span>';
    default:
        return `<span class="status-badge">${window.UI.sanitize(status || 'entwurf')}</span>`;
    }
}

function updateAngeboteFilterBadges() {
    const allAngebote = store?.angebote || [];
    const counts = { alle: allAngebote.length, entwurf: 0, offen: 0, angenommen: 0, abgelehnt: 0, 'vorläufig_gesendet': 0 };
    allAngebote.forEach(a => {
        const s = a.status || 'entwurf';
        if (counts[s] !== undefined) { counts[s]++; }
    });

    const tabContainer = document.getElementById('angebote-filter-tabs');
    if (!tabContainer) {return;}
    tabContainer.querySelectorAll('.filter-btn').forEach(btn => {
        const filter = btn.dataset.filter;
        const count = counts[filter] !== undefined ? counts[filter] : 0;
        const labelMap = { alle: 'Alle', entwurf: 'Entwurf', offen: 'Offen', angenommen: 'Angenommen', abgelehnt: 'Abgelehnt' };
        btn.textContent = `${labelMap[filter] || filter} (${count})`;
    });
}

function renderAngebote() {
    const container = document.getElementById('angebote-list');
    if (!container) {return;}
    const allAngebote = store?.angebote || [];

    // Update badge counts on filter tabs
    updateAngeboteFilterBadges();

    if (allAngebote.length === 0) {
        container.innerHTML = `
            <div class="empty-state" class="empty-state">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <h3 style="margin-bottom: 8px;">Keine Angebote vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Erstelle Angebote aus offenen Anfragen oder lege eine neue Anfrage an.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="window.navigationController?.navigateTo('anfragen')">
                        📥 Anfragen ansehen
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('btn-neue-anfrage')?.click()">
                        ➕ Neue Anfrage
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Apply status filter
    let filtered = [...allAngebote];
    if (currentAngeboteFilter !== 'alle') {
        filtered = filtered.filter(a => (a.status || 'entwurf') === currentAngeboteFilter);
    }

    // Apply search filter
    const searchQuery = currentAngeboteSearch.toLowerCase().trim();
    if (searchQuery) {
        filtered = filtered.filter(a =>
            (a.kunde?.name || '').toLowerCase().includes(searchQuery) ||
            (a.id || '').toLowerCase().includes(searchQuery) ||
            (a.leistungsart || '').toLowerCase().includes(searchQuery) ||
            (a.text || '').toLowerCase().includes(searchQuery) ||
            (a.positionen || []).some(p => (p.beschreibung || '').toLowerCase().includes(searchQuery))
        );
    }

    if (filtered.length === 0) {
        const filterLabel = currentAngeboteFilter !== 'alle' ? ` mit Status "${currentAngeboteFilter}"` : '';
        const searchLabel = searchQuery ? ` passend zu "${window.UI.sanitize(searchQuery)}"` : '';
        container.innerHTML = `
            <div class="empty-state" class="empty-state empty-state-small">
                <div style="font-size: 36px; margin-bottom: 12px;">🔍</div>
                <h3 style="margin-bottom: 8px;">Keine Angebote gefunden</h3>
                <p style="color: var(--text-secondary);">
                    Keine Angebote${filterLabel}${searchLabel}.
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(a => {
        const isOffen = a.status === 'offen';
        const isEntwurf = a.status === 'entwurf';

        // Build entity trail: Anfrage -> Angebot (current)
        const anfrage = a.anfrageId ? (store?.anfragen || []).find(anf => anf.id === a.anfrageId) : null;
        let angebotTrailHTML = '';
        if (anfrage) {
            angebotTrailHTML = `
                <div class="entity-trail">
                    <span class="trail-item" onclick="event.stopPropagation(); switchView('anfragen');">📥 ${h(anfrage.id)}</span>
                    <span class="trail-arrow">&rarr;</span>
                    <span class="trail-item trail-current">📝 ${h(a.id)}</span>
                </div>
            `;
        }

        // Build action buttons based on status
        let actionButtons = '';

        if (isEntwurf) {
            // Draft: show Bearbeiten + Vorschau & Freigabe + Löschen
            actionButtons = `
                <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); editAngebot('${h(a.id)}')">
                    Bearbeiten
                </button>
                <button class="btn btn-primary" onclick="event.stopPropagation(); previewAngebot('${h(a.id)}')">
                    Vorschau &amp; Freigabe
                </button>
                <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteAngebot('${h(a.id)}')">
                    Löschen
                </button>
            `;
        } else {
            // Non-draft: standard buttons
            actionButtons = `
                <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); exportAngebotPDF('${h(a.id)}')">
                    PDF
                </button>
                <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); editAngebot('${h(a.id)}')">
                    Bearbeiten
                </button>
                <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteAngebot('${h(a.id)}')">
                    Löschen
                </button>
                ${isOffen ? `<button class="btn btn-success" onclick="event.stopPropagation(); acceptAngebot('${h(a.id)}')">
                    Auftrag erteilen
                </button>` : ''}
                ${isOffen && a.kunde?.id ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); copyPortalLinkForKunde('${h(a.kunde.id)}')" title="Portal-Link kopieren">
                    Portal-Link
                </button>` : ''}
            `;
        }

        return `
        <div class="item-card" onclick="showAngebotDetail('${h(a.id)}')" style="cursor:pointer">
            <div class="item-header">
                <h3 class="item-title">${window.UI.sanitize(a.kunde.name)}</h3>
                <span class="item-id">${h(a.id)}</span>
            </div>
            ${angebotTrailHTML}
            <div class="item-meta">
                <span>${a.positionen.length} Positionen</span>
                <span>${formatCurrency(a.brutto)}</span>
                <span>${formatDate(a.createdAt)}</span>
                ${(() => {
                    if (a.status === 'offen' || a.status === 'entwurf') {
                        const created = new Date(a.createdAt);
                        const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
                        const daysLeft = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
                        if (daysLeft < 0) {return '<span style="color:var(--accent-danger);font-weight:600;">Abgelaufen</span>';}
                        if (daysLeft <= 7) {return `<span style="color:var(--accent-warning);font-weight:600;">Noch ${daysLeft}T gültig</span>`;}
                        return `<span style="color:var(--text-muted);">Noch ${daysLeft}T gültig</span>`;
                    }
                    return '';
                })()}
            </div>
            <p class="item-description">${getLeistungsartLabel(a.leistungsart)}</p>
            <div class="item-actions">
                ${getAngebotStatusBadge(a.status)}
                ${actionButtons}
            </div>
        </div>`;
    }).join('');
}

function editAngebot(id) {
    const angebot = store.angebote.find(a => a.id === id);
    if (!angebot) {return;}

    // Set the editing flag so the submit handler knows to update
    store.editingAngebotId = id;

    // Update modal title to indicate editing
    const modalTitle = document.getElementById('modal-angebot-title');
    if (modalTitle) {
        modalTitle.textContent = 'Angebot bearbeiten';
    }

    // Fill the hidden anfrage ID field
    document.getElementById('angebot-anfrage-id').value = angebot.anfrageId || '';

    // Fill the kunde info section
    const kundeInfoEl = document.getElementById('angebot-kunde-info');
    if (kundeInfoEl && angebot.kunde) {
        kundeInfoEl.innerHTML = `
            <strong>${window.UI.sanitize(angebot.kunde.name)}</strong><br>
            ${getLeistungsartLabel(angebot.leistungsart)}<br>
            <small>Angebot ${window.UI.sanitize(angebot.id)} bearbeiten</small>
        `;
    }

    // Clear existing positions and re-add from the angebot
    const posContainer = document.getElementById('positionen-list');
    posContainer.innerHTML = '';

    if (angebot.positionen && angebot.positionen.length > 0) {
        angebot.positionen.forEach(pos => {
            addPosition({
                beschreibung: pos.beschreibung,
                menge: pos.menge,
                einheit: pos.einheit,
                preis: pos.preis,
                materialId: pos.materialId || null,
                details: pos.details || '',
                verantwortlich: pos.verantwortlich || ''
            });
        });
    } else {
        addPosition();
    }

    // Fill the angebot text
    document.getElementById('angebot-text').value = angebot.text || '';

    // Update the summary calculation
    updateAngebotSummary();

    // Open the modal
    openModal('modal-angebot');
}

function deleteAngebot(id) {
    const angebot = store.angebote.find(a => a.id === id);
    if (!angebot) {return;}

    // Use trash service for soft-delete with undo if available
    if (window.trashService) {
        const result = window.trashService.softDelete('angebot', angebot);
        if (result && result.blocked) {
            // Orphan protection: show warning, don't delete
            if (window.confirmDialogService) {
                window.confirmDialogService.showConfirmDialog({
                    title: 'Angebot kann nicht gelöscht werden',
                    message: result.reason,
                    confirmText: 'Verstanden',
                    cancelText: '',
                    onConfirm: () => {}
                });
            }
            return;
        }

        // trashService already removed from store and saved
        // Reload angebote from store to stay in sync
        showToast('Angebot gelöscht', 'info');
        addActivity('🗑️', `Angebot ${angebot.id} für ${angebot.kunde.name} gelöscht`);
        renderAngebote();
        return;
    }

    // Fallback: use confirmDialogService for confirmation, then hard delete
    if (window.confirmDialogService) {
        window.confirmDialogService.confirmDelete(
            'Angebot',
            `Angebot ${window.UI.sanitize(angebot.id)} für ${window.UI.sanitize(angebot.kunde.name)} (${formatCurrency(angebot.brutto)})`,
            () => {
                store.angebote = store.angebote.filter(a => a.id !== id);
                saveStore();
                showToast('Angebot gelöscht', 'info');
                addActivity('🗑️', `Angebot ${angebot.id} für ${angebot.kunde.name} gelöscht`);
                renderAngebote();
            }
        );
    } else {
        // Last resort: simple confirm
        if (await window.confirmDialogService?.confirm(`Angebot ${angebot.id} wirklich löschen?`, {title: 'Löschen bestätigen', type: 'danger'}) ?? confirm(`Angebot ${angebot.id} wirklich löschen?`)) {
            store.angebote = store.angebote.filter(a => a.id !== id);
            saveStore();
            showToast('Angebot gelöscht', 'info');
            addActivity('🗑️', `Angebot ${angebot.id} für ${angebot.kunde.name} gelöscht`);
            renderAngebote();
        }
    }
}

function acceptAngebot(angebotId) {
    const angebot = store.angebote.find(a => a.id === angebotId);
    if (!angebot) {return;}

    // Show confirmation dialog
    window.confirmDialogService?.confirmAcceptAngebot(
        angebot.id,
        window.UI?.sanitize?.(angebot.kunde?.name) || 'Unbekannt',
        () => {
            // Confirmed - proceed with accepting the quote
            angebot.status = 'angenommen';

            // Build stueckliste from positionen with materialId
            const stueckliste = angebot.positionen
                .filter(pos => pos.materialId)
                .map(pos => ({
                    materialId: pos.materialId,
                    artikelnummer: pos.artikelnummer,
                    beschreibung: pos.beschreibung,
                    menge: pos.menge,
                    einheit: pos.einheit,
                    ekPreis: pos.ekPreis,
                    vkPreis: pos.preis,
                    bestandBenötigt: pos.menge,
                    bestandVerfügbar: pos.bestandVerfuegbar
                }));

            const auftrag = {
                id: generateId('AUF'),
                angebotId,
                kunde: angebot.kunde,
                leistungsart: angebot.leistungsart,
                positionen: angebot.positionen,
                stueckliste: stueckliste,  // NEW: Material list from positionen
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
    );
}

function initAngeboteFilters() {
    // Filter tab clicks
    const tabContainer = document.getElementById('angebote-filter-tabs');
    if (tabContainer) {
        tabContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentAngeboteFilter = btn.dataset.filter;
                tabContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderAngebote();
            });
        });
    }

    // Search input with 300ms debounce
    const searchInput = document.getElementById('angebote-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(angeboteSearchDebounceTimer);
            angeboteSearchDebounceTimer = setTimeout(() => {
                currentAngeboteSearch = searchInput.value;
                renderAngebote();
            }, 300);
        });
    }
}

// ============================================
// Preview & Freigabe (Draft Review Workflow)
// ============================================

// Inject CSS for entwurf status badge and preview modal
(function injectEntwurfStyles() { return; /* styles moved to components.css */ } function _oldInjectEntwurfStyles() {
    if (document.getElementById('entwurf-styles')) {return;}
    const style = document.createElement('style');
    style.id = 'entwurf-styles';
    style.textContent = `
        .status-badge.status-entwurf {
            background: rgba(107, 114, 128, 0.15);
            color: #6b7280;
        }

        .angebot-preview-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .angebot-preview-modal {
            background: var(--bg-primary, #fff);
            border-radius: 12px;
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .angebot-preview-warning {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            border-radius: 8px;
            padding: 14px 20px;
            margin: 20px 24px 0 24px;
            color: #92400e;
            font-weight: 600;
            font-size: 15px;
            text-align: center;
        }

        .angebot-preview-header {
            padding: 24px 24px 0 24px;
            border-bottom: none;
        }

        .angebot-preview-header h2 {
            margin: 0 0 4px 0;
            font-size: 22px;
            color: var(--text-primary, #1f2937);
        }

        .angebot-preview-header .preview-subtitle {
            color: var(--text-secondary, #6b7280);
            font-size: 14px;
            margin: 0;
        }

        .angebot-preview-body {
            padding: 20px 24px;
        }

        .angebot-preview-section {
            margin-bottom: 20px;
        }

        .angebot-preview-section h3 {
            font-size: 15px;
            color: var(--text-secondary, #6b7280);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 10px 0;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--border-color, #e5e7eb);
        }

        .angebot-preview-kunde {
            font-size: 16px;
            line-height: 1.6;
        }

        .angebot-preview-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        .angebot-preview-table th {
            text-align: left;
            padding: 10px 12px;
            background: var(--bg-secondary, #f9fafb);
            border-bottom: 2px solid var(--border-color, #e5e7eb);
            font-weight: 600;
            color: var(--text-primary, #1f2937);
        }

        .angebot-preview-table td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--border-color, #e5e7eb);
            color: var(--text-primary, #374151);
        }

        .angebot-preview-table .text-right {
            text-align: right;
        }

        .angebot-preview-totals {
            margin-top: 12px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 6px;
            font-size: 15px;
        }

        .angebot-preview-totals .total-row {
            display: flex;
            gap: 20px;
            min-width: 260px;
            justify-content: space-between;
        }

        .angebot-preview-totals .total-row.total-brutto {
            font-weight: 700;
            font-size: 17px;
            border-top: 2px solid var(--text-primary, #1f2937);
            padding-top: 8px;
            margin-top: 4px;
        }

        .angebot-preview-text {
            background: var(--bg-secondary, #f9fafb);
            border-radius: 8px;
            padding: 16px;
            white-space: pre-wrap;
            font-size: 14px;
            line-height: 1.6;
            color: var(--text-primary, #374151);
            border: 1px solid var(--border-color, #e5e7eb);
        }

        .angebot-preview-actions {
            padding: 20px 24px;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            border-top: 1px solid var(--border-color, #e5e7eb);
            flex-wrap: wrap;
        }

        .angebot-preview-actions .btn-freigabe {
            background: #16a34a;
            color: #fff;
            border: none;
            padding: 12px 28px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s;
        }

        .angebot-preview-actions .btn-freigabe:hover {
            background: #15803d;
        }

        .angebot-preview-actions .btn-zurueck {
            background: var(--bg-secondary, #f3f4f6);
            color: var(--text-primary, #374151);
            border: 1px solid var(--border-color, #d1d5db);
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }

        .angebot-preview-actions .btn-zurueck:hover {
            background: var(--border-color, #e5e7eb);
        }
    `;
    document.head.appendChild(style);
})();

function previewAngebot(id) {
    const angebot = store.angebote.find(a => a.id === id);
    if (!angebot) { return; }

    // Build positions table rows
    const positionenRows = (angebot.positionen || []).map((pos, idx) => {
        const gesamt = (pos.menge || 0) * (pos.preis || 0);
        return `
            <tr>
                <td style="vertical-align:top;padding-top:12px;">${idx + 1}</td>
                <td style="vertical-align:top;">
                    <strong style="font-size:14px;">${window.UI.sanitize(pos.beschreibung)}</strong>
                    ${pos.details ? `<div style="font-size:12px;color:#6b7280;margin-top:5px;line-height:1.5;">${window.UI.sanitize(pos.details)}</div>` : ''}
                    ${pos.verantwortlich ? `<div style="font-size:11px;color:#6366f1;margin-top:4px;font-weight:600;">&#128100; Zuständig: ${window.UI.sanitize(pos.verantwortlich)}</div>` : ''}
                </td>
                <td class="text-right" style="vertical-align:top;padding-top:12px;">${pos.menge}</td>
                <td style="vertical-align:top;padding-top:12px;">${window.UI.sanitize(pos.einheit || 'Stk.')}</td>
                <td class="text-right" style="vertical-align:top;padding-top:12px;">${formatCurrency(pos.preis)}</td>
                <td class="text-right" style="vertical-align:top;padding-top:12px;">${formatCurrency(gesamt)}</td>
            </tr>
        `;
    }).join('');

    // Build the preview modal HTML
    const previewHTML = `
        <div class="angebot-preview-overlay" id="angebot-preview-overlay" onclick="closeAngebotPreview(event)">
            <div class="angebot-preview-modal" onclick="event.stopPropagation()">

                <div class="angebot-preview-warning">
                    ⚠ Bitte prüfen Sie alle Angaben sorgfältig, bevor Sie das Angebot freigeben.
                </div>

                <div class="angebot-preview-header">
                    <h2>Angebot ${window.UI.sanitize(angebot.id)} — Vorschau</h2>
                    <p class="preview-subtitle">Erstellt am ${formatDate(angebot.createdAt)}</p>
                </div>

                <div class="angebot-preview-body">

                    <div class="angebot-preview-section">
                        <h3>Kunde</h3>
                        <div class="angebot-preview-kunde">
                            <strong>${window.UI.sanitize(angebot.kunde?.name || 'Unbekannt')}</strong><br>
                            ${angebot.kunde?.email ? window.UI.sanitize(angebot.kunde.email) + '<br>' : ''}
                            ${angebot.kunde?.telefon ? window.UI.sanitize(angebot.kunde.telefon) + '<br>' : ''}
                            ${angebot.kunde?.adresse ? window.UI.sanitize(angebot.kunde.adresse) : ''}
                        </div>
                    </div>

                    <div class="angebot-preview-section">
                        <h3>Leistungsart</h3>
                        <p style="margin:0;">${getLeistungsartLabel(angebot.leistungsart)}</p>
                    </div>

                    <div class="angebot-preview-section">
                        <h3>Positionen</h3>
                        <table class="angebot-preview-table">
                            <thead>
                                <tr>
                                    <th>Nr.</th>
                                    <th>Beschreibung</th>
                                    <th class="text-right">Menge</th>
                                    <th>Einheit</th>
                                    <th class="text-right">Einzelpreis</th>
                                    <th class="text-right">Gesamt</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${positionenRows}
                            </tbody>
                        </table>

                        <div class="angebot-preview-totals">
                            <div class="total-row">
                                <span>Netto:</span>
                                <span>${formatCurrency(angebot.netto)}</span>
                            </div>
                            <div class="total-row">
                                <span>MwSt. (19%):</span>
                                <span>${formatCurrency(angebot.mwst)}</span>
                            </div>
                            <div class="total-row total-brutto">
                                <span>Brutto:</span>
                                <span>${formatCurrency(angebot.brutto)}</span>
                            </div>
                        </div>
                    </div>

                    ${angebot.text ? `
                    <div class="angebot-preview-section">
                        <h3>Angebotstext</h3>
                        <div class="angebot-preview-text">${window.UI.sanitize(angebot.text)}</div>
                    </div>
                    ` : ''}

                </div>

                <div class="angebot-preview-actions">
                    <button class="btn-zurueck" onclick="closeAngebotPreview()">
                        Zurück zum Bearbeiten
                    </button>
                    <button class="btn-freigabe" onclick="freigebenAngebot('${window.UI.sanitize(angebot.id)}')">
                        Angebot freigeben und senden
                    </button>
                </div>

            </div>
        </div>
    `;

    // Remove any existing preview overlay
    const existing = document.getElementById('angebot-preview-overlay');
    if (existing) { existing.remove(); }

    // Insert into DOM
    document.body.insertAdjacentHTML('beforeend', previewHTML);
    document.body.style.overflow = 'hidden';
}

function closeAngebotPreview(event) {
    // If called from overlay click, only close if clicking the overlay itself
    if (event && event.target && event.target.id !== 'angebot-preview-overlay') {
        return;
    }
    const overlay = document.getElementById('angebot-preview-overlay');
    if (overlay) {
        overlay.remove();
        document.body.style.overflow = '';
    }
}

function freigebenAngebot(id) {
    const angebot = store.angebote.find(a => a.id === id);
    if (!angebot) { return; }

    // Move status from 'entwurf' to 'offen'
    angebot.status = 'offen';
    angebot.freigegebenAt = new Date().toISOString();
    saveStore();

    // Close the preview modal
    closeAngebotPreview();

    addActivity('✅', `Angebot ${angebot.id} für ${angebot.kunde.name} freigegeben und gesendet`);
    showToast('Angebot wurde freigegeben und ist jetzt offen.', 'success');

    // Re-render
    renderAngebote();
}

// ============================================
// Angebot Detail View
// ============================================

function showAngebotDetail(angebotId) {
    const angebot = store.angebote.find(a => a.id === angebotId);
    if (!angebot) {return;}

    // Linked documents
    const anfrage = angebot.anfrageId ? store.anfragen.find(a => a.id === angebot.anfrageId) : null;
    const auftrag = store.auftraege.find(a => a.angebotId === angebotId);
    const rechnung = store.rechnungen.find(r => r.angebotId === angebotId || (auftrag && r.auftragId === auftrag.id));

    // Customer enrichment
    const customer = window.customerService?.getCustomerByEmail?.(angebot.kunde.email) || null;
    const customerId = customer?.id || null;

    // Calendar & Communication
    const appointments = customerId && window.calendarService?.getAppointmentsForCustomer ? window.calendarService.getAppointmentsForCustomer(customerId) : [];
    const messages = customerId && window.communicationService?.getMessagesByCustomer ? window.communicationService.getMessagesByCustomer(customerId) : [];

    const st = getAngebotStatusBadge(angebot.status);

    // Build linked document chain
    let docChainHtml = '<div class="angebot-doc-chain">';
    if (anfrage) {
        docChainHtml += `<span class="doc-chain-item" onclick="event.stopPropagation(); switchView('anfragen');" title="Anfrage anzeigen">📥 ${h(anfrage.id)}</span><span class="doc-chain-arrow">&rarr;</span>`;
    }
    docChainHtml += `<span class="doc-chain-item doc-chain-active">📝 ${h(angebot.id)}</span>`;
    if (auftrag) {
        docChainHtml += `<span class="doc-chain-arrow">&rarr;</span><span class="doc-chain-item" onclick="event.stopPropagation(); switchView('auftraege');" title="Auftrag anzeigen">📋 ${h(auftrag.id)}</span>`;
    }
    if (rechnung) {
        docChainHtml += `<span class="doc-chain-arrow">&rarr;</span><span class="doc-chain-item" onclick="event.stopPropagation(); window.showRechnung?.('${h(rechnung.id)}');" title="Rechnung anzeigen">💰 ${h(rechnung.id)}</span>`;
    }
    docChainHtml += '</div>';

    // Customer card
    const k = customer || angebot.kunde;
    const customerHtml = `
        <div class="angebot-detail-section">
            <h4>Kunde</h4>
            <div class="angebot-customer-card">
                <div><strong>${window.UI.sanitize(k.name || '-')}</strong></div>
                ${k.email ? `<div>${window.UI.sanitize(k.email)}</div>` : ''}
                ${k.telefon || k.phone ? `<div>${window.UI.sanitize(k.telefon || k.phone)}</div>` : ''}
                ${k.adresse || k.address ? `<div>${window.UI.sanitize(k.adresse || k.address)}</div>` : ''}
            </div>
        </div>`;

    // Positionen / BOM table
    const posHtml = `
        <div class="angebot-detail-section">
            <h4>Positionen</h4>
            <table class="angebot-bom-table">
                <thead>
                    <tr>
                        <th>Pos.</th>
                        <th>Beschreibung</th>
                        <th>Menge</th>
                        <th>Einheit</th>
                        <th class="text-right">Einzelpreis</th>
                        <th class="text-right">Gesamt</th>
                    </tr>
                </thead>
                <tbody>
                    ${(angebot.positionen || []).map((p, i) => `
                        <tr>
                            <td style="vertical-align:top;">${i + 1}</td>
                            <td style="vertical-align:top;">
                                <strong>${window.UI.sanitize(p.beschreibung)}</strong>
                                ${p.details ? `<div style="font-size:12px;color:var(--text-muted,#6b7280);margin-top:4px;line-height:1.5;">${window.UI.sanitize(p.details)}</div>` : ''}
                                ${p.verantwortlich ? `<div style="font-size:11px;color:#6366f1;margin-top:3px;font-weight:600;">&#128100; Zuständig: ${window.UI.sanitize(p.verantwortlich)}</div>` : ''}
                            </td>
                            <td style="vertical-align:top;">${p.menge}</td>
                            <td style="vertical-align:top;">${window.UI.sanitize(p.einheit)}</td>
                            <td class="text-right" style="vertical-align:top;">${formatCurrency(p.preis)}</td>
                            <td class="text-right" style="vertical-align:top;">${formatCurrency((p.menge || 0) * (p.preis || 0))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="angebot-summary">
                <div class="summary-row"><span>Netto:</span><span>${formatCurrency(angebot.netto)}</span></div>
                <div class="summary-row"><span>MwSt. 19%:</span><span>${formatCurrency(angebot.mwst)}</span></div>
                <div class="summary-row total"><span>Brutto:</span><span>${formatCurrency(angebot.brutto)}</span></div>
            </div>
        </div>`;

    // Angebots-Text
    const textHtml = angebot.text ? `
        <div class="angebot-detail-section">
            <h4>Angebotstext</h4>
            <div style="white-space:pre-wrap; font-size:13px; color:var(--text-secondary); line-height:1.6;">${window.UI.sanitize(angebot.text)}</div>
        </div>` : '';

    // Calendar
    let calHtml = '';
    if (appointments.length > 0) {
        calHtml = `
        <div class="angebot-detail-section">
            <h4>Termine</h4>
            ${appointments.slice(0, 5).map(apt => `
                <div class="angebot-comm-item">
                    <span>${formatDate(apt.date || apt.start)}</span>
                    <span>${window.UI.sanitize(apt.title || apt.beschreibung || '-')}</span>
                </div>
            `).join('')}
        </div>`;
    }

    // Communication
    let commHtml = '';
    if (messages.length > 0) {
        commHtml = `
        <div class="angebot-detail-section">
            <h4>Kommunikation</h4>
            ${messages.slice(0, 5).map(msg => `
                <div class="angebot-comm-item">
                    <span>${formatDate(msg.date || msg.createdAt)}</span>
                    <span>${window.UI.sanitize(msg.subject || msg.text || '-')}</span>
                </div>
            `).join('')}
        </div>`;
    }

    // Kundenportal — generate link for this Angebot if service available
    const portalToken = window.customerPortalService?.generateAccessToken
        ? (() => {
            try {
                const customerId = angebot.kunde?.id || angebot.kunde?.email || angebot.anfrageId;
                const existing = window.customerPortalService.tokens?.find(
                    t => t.customerId === customerId && t.isActive && t.scope === 'quote'
                );
                return existing || window.customerPortalService.generateAccessToken(customerId, 'quote', { expiresInDays: 30 });
            } catch { return null; }
        })()
        : null;
    const portalBase = window.location.origin + window.location.pathname.replace('index.html', '') + 'customer-portal.html';
    const portalUrl  = portalToken ? `${portalBase}?token=${encodeURIComponent(portalToken.token)}&ref=${h(angebot.id)}` : null;

    // Actions
    const actionsHtml = `
        <div class="form-actions" style="flex-wrap:wrap;gap:8px;">
            <button type="button" class="btn btn-secondary" onclick="closeModal('modal-angebot-detail')">Schliessen</button>
            ${angebot.status === 'offen' ? `<button type="button" class="btn btn-success" onclick="acceptAngebot('${h(angebot.id)}'); closeModal('modal-angebot-detail');">Auftrag erteilen</button>` : ''}
            ${portalUrl ? `
            <button type="button" class="btn btn-secondary" title="Kundenportal öffnen"
                onclick="window.open('${portalUrl}', '_blank')">
                🔗 Portal öffnen
            </button>
            <button type="button" class="btn btn-secondary" title="Direkt-Link kopieren"
                onclick="navigator.clipboard.writeText('${portalUrl}').then(()=>window.showToast?.('Link kopiert', 'success'))">
                📋 Link kopieren
            </button>` : ''}
        </div>`;

    // Render
    document.getElementById('angebot-detail-content').innerHTML = `
        <div style="padding:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <div>
                    <span class="item-id" style="font-size:14px;">${h(angebot.id)}</span>
                    <span style="margin-left:12px;">${st}</span>
                </div>
                <div style="color:var(--text-muted); font-size:13px;">
                    ${formatDate(angebot.createdAt)}
                </div>
            </div>
            ${docChainHtml}
            ${customerHtml}
            ${posHtml}
            ${textHtml}
            ${calHtml}
            ${commHtml}
            ${actionsHtml}
        </div>`;

    openModal('modal-angebot-detail');
}

function exportAngebotPDF(id) {
    const angebot = store.angebote.find(a => a.id === id);
    if (!angebot) {return;}

    // Use PDF service if available
    if (window.pdfService?.generateAngebot) {
        window.pdfService.generateAngebot(angebot);
        return;
    }

    // Fallback: show toast with info
    showToast('PDF-Export wird vorbereitet...', 'info');

    // Simple print-based PDF fallback
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Popup-Blocker verhindert den PDF-Export', 'error');
        return;
    }

    const posRows = (angebot.positionen || []).map((p, i) =>
        `<tr>
            <td style="vertical-align:top;padding-top:10px;">${i + 1}</td>
            <td style="vertical-align:top;">
                <strong>${window.UI.sanitize(p.beschreibung)}</strong>
                ${p.details ? `<div style="font-size:11px;color:#6b7280;margin-top:5px;line-height:1.5;">${window.UI.sanitize(p.details)}</div>` : ''}
                ${p.verantwortlich ? `<div style="font-size:11px;color:#6366f1;margin-top:4px;font-weight:600;">Zuständig: ${window.UI.sanitize(p.verantwortlich)}</div>` : ''}
            </td>
            <td style="vertical-align:top;padding-top:10px;">${p.menge}</td>
            <td style="vertical-align:top;padding-top:10px;">${window.UI.sanitize(p.einheit)}</td>
            <td style="text-align:right;vertical-align:top;padding-top:10px;">${formatCurrency(p.preis)}</td>
            <td style="text-align:right;vertical-align:top;padding-top:10px;">${formatCurrency((p.menge || 0) * (p.preis || 0))}</td>
        </tr>`
    ).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Angebot ${window.UI.sanitize(angebot.id)}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#333}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:8px 12px;border-bottom:1px solid #ddd;text-align:left}th{background:#f5f5f5;font-weight:600}.totals{text-align:right;margin-top:20px}.totals div{margin:4px 0}.totals .brutto{font-weight:700;font-size:18px;border-top:2px solid #333;padding-top:8px}</style>
    </head><body>
        <h1>Angebot ${window.UI.sanitize(angebot.id)}</h1>
        <p><strong>Kunde:</strong> ${window.UI.sanitize(angebot.kunde?.name || '-')}</p>
        <p><strong>Datum:</strong> ${formatDate(angebot.createdAt)}</p>
        <p><strong>Leistungsart:</strong> ${getLeistungsartLabel(angebot.leistungsart)}</p>
        <table><thead><tr><th>Nr.</th><th>Beschreibung</th><th>Menge</th><th>Einheit</th><th style="text-align:right">Einzelpreis</th><th style="text-align:right">Gesamt</th></tr></thead><tbody>${posRows}</tbody></table>
        <div class="totals"><div>Netto: ${formatCurrency(angebot.netto)}</div><div>MwSt. 19%: ${formatCurrency(angebot.mwst)}</div><div class="brutto">Brutto: ${formatCurrency(angebot.brutto)}</div></div>
        ${angebot.text ? `<h3>Angebotstext</h3><p style="white-space:pre-wrap">${window.UI.sanitize(angebot.text)}</p>` : ''}
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
}

// ============================================
// Vorläufiges Angebot — Auto-Send
// ============================================

/**
 * Automatically send a preliminary (vorläufig) quote to the customer immediately
 * after it is created. The Handwerker gets an in-app notification so they can
 * supervise and edit before the customer responds.
 *
 * Flow:
 *  1. Generate a PDF preview (if pdfGenerationService is available)
 *  2. Email the preliminary quote to the customer (if emailService is available)
 *  3. Create an in-app supervisor notification
 *  4. Set angebot.status → 'vorläufig_gesendet'
 *  5. Save the updated status to the store
 *
 * Failures in step 1 or 2 are non-fatal: the notification (step 3) still fires
 * and the Handwerker can send manually if needed.
 *
 * @param {Object} angebot - Newly created Angebot object
 * @param {Object} anfrage - Parent Anfrage object
 */
async function sendVorlaeufigAngebot(angebot, anfrage) {
    const kundeEmail = angebot.kunde?.email || anfrage?.kunde?.email;
    const kundeName  = angebot.kunde?.name  || anfrage?.kunde?.name || 'Kunde';

    let emailSent = false;

    // 1. Try to send via email relay
    if (kundeEmail && window.emailService?.sendEmail) {
        const companyInfo = window.companySettings
            ? await window.companySettings.load().catch(() => ({}))
            : {};
        const companyName = companyInfo?.companyName || 'FreyAI Visions';

        // ── Portal CTA ────────────────────────────────────────────────────
        let portalUrl = null;
        if (window.customerPortalService) {
            try {
                const tokenRecord = window.customerPortalService.generateAccessToken(
                    angebot.kunde?.id || angebot.kundeId || '',
                    'quote'
                );
                if (tokenRecord?.token) {
                    portalUrl = `${location.origin}/customer-portal.html?token=${encodeURIComponent(tokenRecord.token)}`;
                }
            } catch (_) { /* portal not available */ }
        }

        // ── Build body fragment (positions + totals) ──────────────────────
        const eur = n => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        const posRows = (angebot.positionen || []).map((p, idx) =>
            `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
               <td style="padding:10px 8px;color:#9ca3af;font-size:12px;vertical-align:top;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
               <td style="padding:10px 8px;vertical-align:top;border-bottom:1px solid #e5e7eb;">
                 <strong style="font-size:13px;color:#1f2937;">${p.beschreibung}</strong>
                 ${p.details ? `<div style="font-size:12px;color:#6b7280;margin-top:6px;line-height:1.6;">${p.details}</div>` : ''}
                 ${p.verantwortlich ? `<div style="font-size:11px;color:#6366f1;margin-top:5px;font-weight:600;">&#128100; Zuständige Fachkraft: ${p.verantwortlich}</div>` : ''}
               </td>
               <td style="padding:10px 8px;white-space:nowrap;vertical-align:top;border-bottom:1px solid #e5e7eb;color:#374151;">${p.menge} ${p.einheit}</td>
               <td style="padding:10px 8px;text-align:right;vertical-align:top;border-bottom:1px solid #e5e7eb;color:#374151;">${eur(p.preis)}</td>
               <td style="padding:10px 8px;text-align:right;vertical-align:top;border-bottom:1px solid #e5e7eb;font-weight:600;color:#1f2937;">${eur((p.menge||0)*(p.preis||0))}</td>
             </tr>`
        ).join('');

        const bodyHtml = `
            <p style="margin:0 0 16px;font-size:15px;">Sehr geehrte(r) ${kundeName},</p>
            <p style="margin:0 0 20px;line-height:1.6;color:#374151;">
              vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen unser
              <strong>vorläufiges Angebot (Nr. ${angebot.id})</strong>.
              Im Folgenden finden Sie eine detaillierte Aufstellung aller Leistungen und Materialien
              mit den zuständigen Fachkräften – damit Sie genau wissen, was wir für Sie tun.<br><br>
              Sobald wir Ihre Rückmeldung erhalten, erstellen wir das verbindliche Angebot für Sie.
            </p>
            ${angebot.text ? `<div style="margin:0 0 20px;padding:14px 18px;background:#f8fafc;border-left:4px solid #6366f1;border-radius:4px;font-size:13px;color:#374151;line-height:1.6;">${angebot.text.replace(/\n/g,'<br>')}</div>` : ''}
            <h3 style="margin:0 0 10px;font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #0f172a;padding-bottom:6px;">Leistungsübersicht</h3>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:13px;margin-bottom:20px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <thead>
                <tr style="background:#0f172a;color:#fff;">
                  <th style="padding:10px 8px;text-align:left;font-weight:600;">Nr.</th>
                  <th style="padding:10px 8px;text-align:left;font-weight:600;">Leistung &amp; Details</th>
                  <th style="padding:10px 8px;text-align:left;font-weight:600;">Menge</th>
                  <th style="padding:10px 8px;text-align:right;font-weight:600;">Einzelpreis</th>
                  <th style="padding:10px 8px;text-align:right;font-weight:600;">Gesamt</th>
                </tr>
              </thead>
              <tbody>${posRows}</tbody>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-left:auto;font-size:13px;min-width:260px;">
              <tr><td style="padding:5px 12px;color:#6b7280;">Netto</td>
                  <td style="padding:5px 12px;text-align:right;color:#374151;">${eur(angebot.netto)}</td></tr>
              <tr><td style="padding:5px 12px;color:#6b7280;">MwSt. 19 %</td>
                  <td style="padding:5px 12px;text-align:right;color:#374151;">${eur(angebot.mwst)}</td></tr>
              <tr style="font-weight:700;font-size:15px;">
                <td style="padding:10px 12px;border-top:2px solid #0f172a;color:#0f172a;">Gesamtbetrag</td>
                <td style="padding:10px 12px;text-align:right;border-top:2px solid #0f172a;color:#0f172a;">${eur(angebot.brutto)}</td>
              </tr>
            </table>
            <div style="margin:24px 0 0;padding:14px 18px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;font-size:12px;color:#166534;">
              <strong>Im Leistungsumfang enthalten:</strong><br>
              &#10003; Alle Arbeiten durch qualifizierte Fachkräfte<br>
              &#10003; Sämtliche Materialien entsprechen aktuellen Normen und Vorschriften<br>
              &#10003; Abnahmeprotokoll nach Fertigstellung<br>
              &#10003; Garantie auf alle ausgeführten Arbeiten gemäß gesetzlichen Bestimmungen
            </div>
            <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;line-height:1.5;">
              Dieses Angebot ist <strong>vorläufig und unverbindlich</strong>.
              Es wird erst nach schriftlicher Bestätigung durch uns verbindlich.
              Das Angebot gilt 30 Tage ab Erstellungsdatum.
            </p>`;

        // ── Render via DocumentTemplateService ────────────────────────────
        let html;
        if (window.documentTemplateService) {
            html = await window.documentTemplateService.renderEmail(
                `Vorläufiges Angebot ${angebot.id}`,
                bodyHtml,
                {
                    company:      companyInfo,
                    portalUrl,
                    portalCtaLabel: 'Angebot ansehen &amp; freigeben →'
                }
            );
        } else {
            // Minimal fallback (documentTemplateService not yet loaded)
            html = `<html><body style="font-family:sans-serif;padding:24px">${bodyHtml}</body></html>`;
        }

        const result = await window.emailService.sendEmail(
            kundeEmail,
            `Vorläufiges Angebot ${angebot.id} – ${companyName}`,
            html
        );
        emailSent = result.success;
    }

    // 2. Update angebot status
    const savedAngebot = store.angebote.find(a => a.id === angebot.id);
    if (savedAngebot) {
        savedAngebot.status = 'vorläufig_gesendet';
        savedAngebot.vorlaeufigGesendetAt = new Date().toISOString();
        savedAngebot.vorlaeufigEmailSent = emailSent;
        saveStore();
    }

    // 3. Activity log
    addActivity('📨', `Vorläufiges Angebot ${angebot.id} ${emailSent ? 'an ' + kundeEmail + ' gesendet' : 'erstellt (E-Mail nicht konfiguriert)'}`);

    // 4. Supervisor notification — Handwerker must review/edit before customer confirms
    if (window.notificationService?.addNotification) {
        const emailNote = emailSent
            ? `E-Mail wurde automatisch an ${kundeEmail} gesendet.`
            : 'E-Mail konnte nicht automatisch gesendet werden — bitte manuell senden.';
        window.notificationService.addNotification(
            'angebot_vorlaeufig',
            `Vorläufiges Angebot ${angebot.id} gesendet`,
            `${kundeName} • ${angebot.brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} • ${emailNote} Bitte prüfen Sie das Angebot und passen Sie es bei Bedarf an.`,
            { angebotId: angebot.id, kundeEmail, requiresAction: true }
        );
    }

    // 5. Create a supervisor task for the Handwerker
    if (window.taskService?.addTask) {
        window.taskService.addTask({
            title: `Vorläufiges Angebot prüfen: ${kundeName}`,
            description: `Angebot ${angebot.id} wurde automatisch als vorläufige Version ${emailSent ? 'an ' + kundeEmail + ' gesendet' : 'erstellt'}. ` +
                         `Bitte prüfen Sie das Angebot und passen Sie es bei Bedarf an, bevor der Kunde antwortet.`,
            priority: 'normal',
            status: 'offen',
            source: 'auto',
            sourceId: angebot.id,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
    }
}

// Export angebote functions
window.AngeboteModule = {
    createAngebotFromAnfrage,
    initAngebotForm,
    initAngeboteFilters,
    addPosition,
    updateAngebotSummary,
    generateAIText,
    renderAngebote,
    editAngebot,
    deleteAngebot,
    acceptAngebot,
    previewAngebot,
    closeAngebotPreview,
    freigebenAngebot,
    showAngebotDetail,
    exportAngebotPDF
};

// Make globally available
window.createAngebotFromAnfrage = createAngebotFromAnfrage;
window.renderAngebote = renderAngebote;
window.initAngeboteFilters = initAngeboteFilters;
window.addPosition = addPosition;
window.updateAngebotSummary = updateAngebotSummary;
window.acceptAngebot = acceptAngebot;
window.editAngebot = editAngebot;
window.deleteAngebot = deleteAngebot;
window.previewAngebot = previewAngebot;
window.closeAngebotPreview = closeAngebotPreview;
window.freigebenAngebot = freigebenAngebot;
window.showAngebotDetail = showAngebotDetail;
window.exportAngebotPDF = exportAngebotPDF;

})();
