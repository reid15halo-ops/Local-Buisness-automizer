/* ============================================
   FreyAI Visions Demo - Application Logic
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
    try {
        const container = document.getElementById('activity-list');
        if (!container) {return;}

        const activities = window.storeService?.state?.activities || [];

        if (activities.length === 0) {
            container.innerHTML = '<p class="empty-state">Noch keine Aktivitäten.</p>';
            return;
        }

        container.innerHTML = activities.slice(0, 10).map(activity => `
            <div class="activity-item">
                <span class="activity-icon">${activity.icon}</span>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-time">${window.UI?.getRelativeTime?.(activity.time) || ''}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        if (window.errorHandler) {
            window.errorHandler.handle(error, 'renderActivities', false);
        } else {
            console.error('renderActivities failed:', error);
        }
    }
}

// ============================================
// Dashboard
// ============================================
function updateDashboard() {
    try {
        const offeneAnfragen = store?.anfragen?.filter(a => a.status === 'neu').length || 0;
        const wartendeAngebote = store?.angebote?.filter(a => a.status === 'offen').length || 0;
        const aktiveAuftraege = store?.auftraege?.filter(a => a.status !== 'abgeschlossen').length || 0;
        const offeneRechnungen = store?.rechnungen?.filter(r => r.status === 'offen').length || 0;

        const statAnfragen = document.getElementById('stat-anfragen');
        const statAngebote = document.getElementById('stat-angebote');
        const statAuftraege = document.getElementById('stat-auftraege');
        const statRechnungen = document.getElementById('stat-rechnungen');

        if (statAnfragen) {statAnfragen.textContent = offeneAnfragen;}
        if (statAngebote) {statAngebote.textContent = wartendeAngebote;}
        if (statAuftraege) {statAuftraege.textContent = aktiveAuftraege;}
        if (statRechnungen) {statRechnungen.textContent = offeneRechnungen;}

        // Update badges
        const anfragenBadge = document.getElementById('anfragen-badge');
        const angeboteBadge = document.getElementById('angebote-badge');
        const auftraegeBadge = document.getElementById('auftraege-badge');
        const rechnungenBadge = document.getElementById('rechnungen-badge');

        if (anfragenBadge) {anfragenBadge.textContent = offeneAnfragen;}
        if (angeboteBadge) {angeboteBadge.textContent = wartendeAngebote;}
        if (auftraegeBadge) {auftraegeBadge.textContent = aktiveAuftraege;}
        if (rechnungenBadge) {rechnungenBadge.textContent = offeneRechnungen;}

        renderActivities();
    } catch (error) {
        if (window.errorHandler) {
            window.errorHandler.handle(error, 'updateDashboard', false);
        } else {
            console.error('updateDashboard failed:', error);
        }
    }
}

// ============================================
// Anfragen (Requests)
// ============================================
function initAnfrageForm() {
    try {
        const btn = document.getElementById('btn-neue-anfrage');
        const modal = document.getElementById('modal-anfrage');
        const form = document.getElementById('form-anfrage');

        if (!btn || !form) {return;}

        btn.addEventListener('click', () => openModal('modal-anfrage'));

        form.addEventListener('submit', (e) => {
            try {
                e.preventDefault();

                const kundenNameEl = document.getElementById('kunde-name');
                const kundenEmailEl = document.getElementById('kunde-email');
                const kundenTelefonEl = document.getElementById('kunde-telefon');
                const leistungsartEl = document.getElementById('leistungsart');
                const beschreibungEl = document.getElementById('beschreibung');
                const budgetEl = document.getElementById('budget');
                const terminEl = document.getElementById('termin');

                if (!kundenNameEl || !leistungsartEl || !beschreibungEl) {
                    throw new Error('Erforderliche Formularfelder nicht gefunden');
                }

                const anfrage = {
                    id: generateId('ANF'),
                    kunde: {
                        name: kundenNameEl.value,
                        email: kundenEmailEl?.value || '',
                        telefon: kundenTelefonEl?.value || ''
                    },
                    leistungsart: leistungsartEl.value,
                    beschreibung: beschreibungEl.value,
                    budget: parseFloat(budgetEl?.value) || 0,
                    termin: terminEl?.value || '',
                    status: 'neu',
                    createdAt: new Date().toISOString()
                };

                if (store?.anfragen) {
                    store.anfragen.push(anfrage);
                    saveStore();
                    addActivity('📥', `Neue Anfrage von ${anfrage.kunde.name}`);
                    form.reset();
                    closeModal('modal-anfrage');
                    switchView('anfragen');
                    const anfragenBtn = document.querySelector('[data-view="anfragen"]');
                    if (anfragenBtn) {anfragenBtn.click();}
                }
            } catch (error) {
                if (window.errorHandler) {
                    window.errorHandler.handle(error, 'initAnfrageForm - submit', true);
                } else {
                    console.error('Form submission failed:', error);
                }
            }
        });
    } catch (error) {
        if (window.errorHandler) {
            window.errorHandler.handle(error, 'initAnfrageForm', false);
        } else {
            console.error('initAnfrageForm failed:', error);
        }
    }
}

function renderAnfragen() {
    try {
        const container = document.getElementById('anfragen-list');
        if (!container) {return;}

        const anfragen = store?.anfragen?.filter(a => a.status === 'neu') || [];

        if (anfragen.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 60px 20px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                    <h3 style="margin-bottom: 8px;">Keine Anfragen vorhanden</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 24px;">
                        Erstelle deine erste Kundenanfrage um loszulegen.
                    </p>
                    <button class="btn btn-primary" data-action="trigger-new-request">
                        ➕ Neue Anfrage erstellen
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = anfragen.map(a => `
            <div class="item-card">
                <div class="item-header">
                    <h3 class="item-title">${window.UI?.sanitize?.(a.kunde?.name) || 'Unbekannt'}</h3>
                    <span class="item-id">${a.id || ''}</span>
                </div>
                <div class="item-meta">
                    <span>📧 ${window.UI?.sanitize?.(a.kunde?.email) || '-'}</span>
                    <span>📞 ${window.UI?.sanitize?.(a.kunde?.telefon) || '-'}</span>
                    <span>📅 ${formatDate(a.termin)}</span>
                </div>
                <p class="item-description">
                    <strong>${getLeistungsartLabel(a.leistungsart)}:</strong> ${window.UI?.sanitize?.(a.beschreibung) || ''}
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
    } catch (error) {
        if (window.errorHandler) {
            window.errorHandler.handle(error, 'renderAnfragen', false);
        } else {
            console.error('renderAnfragen failed:', error);
        }
    }
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
    try {
        if (!anfrageId || !store?.anfragen) {return;}

        const anfrage = store.anfragen.find(a => a.id === anfrageId);
        if (!anfrage) {
            throw new Error(`Anfrage mit ID ${anfrageId} nicht gefunden`);
        }

        store.currentAnfrageId = anfrageId;

        // Fill modal info
        const angebotAnfrageIdEl = document.getElementById('angebot-anfrage-id');
        const angebotKundeInfoEl = document.getElementById('angebot-kunde-info');
        const positionenListEl = document.getElementById('positionen-list');
        const angebotTextEl = document.getElementById('angebot-text');

        if (angebotAnfrageIdEl) {angebotAnfrageIdEl.value = anfrageId;}

        if (angebotKundeInfoEl) {
            angebotKundeInfoEl.innerHTML = `
                <strong>${window.UI?.sanitize?.(anfrage.kunde?.name) || 'Unbekannt'}</strong><br>
                ${getLeistungsartLabel(anfrage.leistungsart)}<br>
                <small>${window.UI?.sanitize?.(anfrage.beschreibung?.substring(0, 100)) || ''}...</small>
            `;
        }

        // Clear positions
        if (positionenListEl) {positionenListEl.innerHTML = '';}
        addPosition();

        // Clear text
        if (angebotTextEl) {angebotTextEl.value = '';}

        openModal('modal-angebot');
    } catch (error) {
        if (window.errorHandler) {
            window.errorHandler.handle(error, 'createAngebotFromAnfrage', true);
        } else {
            console.error('createAngebotFromAnfrage failed:', error);
        }
    }
}

function initAngebotForm() {
    try {
        const form = document.getElementById('form-angebot');
        const addBtn = document.getElementById('btn-add-position');
        const aiBtn = document.getElementById('btn-ai-text');

        if (!form) {return;}
        if (addBtn) {addBtn.addEventListener('click', addPosition);}
        if (aiBtn) {aiBtn.addEventListener('click', generateAIText);}

        form.addEventListener('submit', (e) => {
            try {
                e.preventDefault();

                const anfrageId = document.getElementById('angebot-anfrage-id')?.value;
                const anfrage = store.anfragen.find(a => a.id === anfrageId);
                if (!anfrage) {
                    showToast('Anfrage nicht gefunden', 'error');
                    return;
                }

                const positionen = [];
                document.querySelectorAll('.position-row').forEach(row => {
                    const beschreibungInput = row.querySelector('.pos-beschreibung');
                    const beschreibung = beschreibungInput?.value;
                    const menge = parseFloat(row.querySelector('.pos-menge')?.value) || 0;
                    const einheit = row.querySelector('.pos-einheit')?.value || 'Stk.';
                    const preis = parseFloat(row.querySelector('.pos-preis')?.value) || 0;
                    const materialId = beschreibungInput?.dataset?.materialId || null;

                    if (beschreibung && menge && preis) {
                        const position = { beschreibung, menge, einheit, preis };

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

                const netto = positionen.reduce((sum, p) => sum + (p.menge * p.preis), 0);
                const mwst = netto * 0.19;
                const brutto = netto + mwst;

                const angebot = {
                    id: generateId('ANG'),
                    anfrageId,
                    kunde: anfrage.kunde,
                    leistungsart: anfrage.leistungsart,
                    positionen,
                    text: document.getElementById('angebot-text')?.value || '',
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
                document.querySelector('[data-view="angebote"]')?.click();
            } catch (error) {
                if (window.errorHandler) {
                    window.errorHandler.handle(error, 'initAngebotForm - submit', true);
                } else {
                    console.error('Angebot form submission failed:', error);
                }
            }
        });
    } catch (error) {
        if (window.errorHandler) {
            window.errorHandler.handle(error, 'initAngebotForm', false);
        } else {
            console.error('initAngebotForm failed:', error);
        }
    }
}

function addPosition(prefill = null) {
    try {
        const container = document.getElementById('positionen-list');
        if (!container) {return;}

        const row = document.createElement('div');
        row.className = 'position-row';

        const uniqueId = Date.now();

        // Prepare material display info
        let materialDisplay = 'Kein Material zugewiesen';
        if (prefill?.materialId) {
            const material = window.materialService?.getMaterial(prefill.materialId);
            if (material) {
                materialDisplay = `${material.bezeichnung} (${material.artikelnummer})`;
            }
        }

        row.innerHTML = `
            <div class="pos-beschreibung-wrapper">
                <input type="text" class="pos-beschreibung" placeholder="Beschreibung tippen..."
                       data-suggest-id="${uniqueId}"
                       data-material-id="${prefill?.materialId || ''}"
                       value="${prefill?.beschreibung || ''}"
                       autocomplete="off">
                <div class="material-suggest" id="suggest-${uniqueId}" style="display:none;"></div>
            </div>
            <input type="number" class="pos-menge" placeholder="Menge" step="0.5" value="${prefill?.menge || 1}" data-action-input="update-angebot-summary">
            <input type="text" class="pos-einheit" placeholder="Einheit" value="${prefill?.einheit || 'Stk.'}">
            <input type="number" class="pos-preis" placeholder="€/Einheit" step="0.01" value="${prefill?.preis || ''}" data-action-input="update-angebot-summary">
            <div class="position-material-selector">
                <button type="button" class="btn btn-small position-material-picker" data-position-id="${uniqueId}">📦 Material</button>
                <span class="position-material-info" data-position-id="${uniqueId}">${materialDisplay}</span>
                ${prefill?.materialId ? `<button type="button" class="position-material-clear" data-position-id="${uniqueId}">✕</button>` : ''}
            </div>
            <button type="button" class="position-remove" data-action="remove-position">×</button>
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
                window.materialPickerUI?.open?.((material) => {
                    // Update position with material data
                    input.value = material.bezeichnung;
                    input.dataset.materialId = material.id;
                    row.querySelector('.pos-preis').value = material.vkPreis || material.preis;
                    row.querySelector('.pos-einheit').value = material.einheit;

                    // Update material info display
                    materialInfo.textContent = `${material.bezeichnung} (${material.artikelnummer})`;

                    // Show clear button if not already present
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

        if (input && suggestBox) {
            input.addEventListener('input', (e) => {
                try {
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

                    // Store materials for safe access by index (avoids JSON in HTML attributes)
                    suggestBox._materials = materials.slice(0, 5);
                    suggestBox.innerHTML = materials.slice(0, 5).map((m, idx) => `
                        <div class="material-suggest-item" data-material-idx="${idx}">
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
                            try {
                                const material = suggestBox._materials?.[parseInt(item.dataset.materialIdx)];
                                if (!material) {return;}
                                const descInput = row.querySelector('.pos-beschreibung');
                                const priceInput = row.querySelector('.pos-preis');
                                const einheitInput = row.querySelector('.pos-einheit');

                                if (descInput) {descInput.value = material.bezeichnung;}
                                if (priceInput) {priceInput.value = material.vkPreis || material.preis;}
                                if (einheitInput) {einheitInput.value = material.einheit;}
                                suggestBox.style.display = 'none';
                                updateAngebotSummary();
                            } catch (error) {
                                console.error('Material selection failed:', error);
                            }
                        });
                    });
                } catch (error) {
                    console.error('Material autocomplete failed:', error);
                }
            });

            // Hide on blur (with delay for click)
            input.addEventListener('blur', () => {
                setTimeout(() => suggestBox.style.display = 'none', 200);
            });
        }

        updateAngebotSummary();
    } catch (error) {
        if (window.errorHandler) {
            window.errorHandler.handle(error, 'addPosition', false);
        } else {
            console.error('addPosition failed:', error);
        }
    }
}


function updateAngebotSummary() {
    try {
        let netto = 0;
        document.querySelectorAll('.position-row').forEach(row => {
            try {
                const mengeEl = row.querySelector('.pos-menge');
                const preisEl = row.querySelector('.pos-preis');
                const menge = parseFloat(mengeEl?.value) || 0;
                const preis = parseFloat(preisEl?.value) || 0;
                netto += menge * preis;
            } catch (rowError) {
                console.error('Error calculating position:', rowError);
            }
        });

        const mwst = netto * 0.19;
        const brutto = netto + mwst;

        const nettoEl = document.getElementById('angebot-netto');
        const mwstEl = document.getElementById('angebot-mwst');
        const bruttoEl = document.getElementById('angebot-brutto');

        if (nettoEl) {nettoEl.textContent = formatCurrency(netto);}
        if (mwstEl) {mwstEl.textContent = formatCurrency(mwst);}
        if (bruttoEl) {bruttoEl.textContent = formatCurrency(brutto);}
    } catch (error) {
        if (window.errorHandler) {
            window.errorHandler.handle(error, 'updateAngebotSummary', false);
        } else {
            console.error('updateAngebotSummary failed:', error);
        }
    }
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

Gerne unterbreiten wir Ihnen folgendes Angebot für die gewünschten Arbeiten. Wir garantieren höchste Qualitätsstandards und fachgerechte Ausführung.

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
FreyAI Visions`
        };

        const text = templates[anfrage.leistungsart] || templates['default'];
        document.getElementById('angebot-text').value = text;

        aiBtn.innerHTML = '🤖 KI-Vorschlag generieren';
        aiBtn.disabled = false;
    }, 1500);
}

function renderAngebote() {
    try {
    const container = document.getElementById('angebote-list');
    if (!container) {return;}
    const angebote = store?.angebote?.filter(a => a.status === 'offen') || [];

    if (angebote.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 60px 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <h3 style="margin-bottom: 8px;">Keine Angebote vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Erstelle Angebote aus offenen Anfragen.
                </p>
                <button class="btn btn-primary" data-action="navigate-anfragen">
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
    } catch (error) {
        if (window.errorHandler) {
            window.errorHandler.handle(error, 'renderAngebote', false);
        } else {
            console.error('renderAngebote failed:', error);
        }
    }
}

function acceptAngebot(angebotId) {
    const angebot = store.angebote.find(a => a.id === angebotId);
    if (!angebot) {return;}

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

    // Attempt to reserve materials for the order
    if (window.materialService && stueckliste.length > 0) {
        const reservationItems = stueckliste.map(item => ({
            materialId: item.materialId,
            menge: item.menge
        }));

        const reservationResult = window.materialService.reserveForAuftrag(auftrag.id, reservationItems);

        if (!reservationResult.success) {
            // Show warning about stock shortages
            let warningMsg = '⚠️ Nicht genügend Material verfügbar:\n\n';
            reservationResult.shortages.forEach(shortage => {
                warningMsg += `${shortage.materialName}: Benötigt ${shortage.needed}, verfügbar ${shortage.available}\n`;
            });

            const proceed = confirm(warningMsg + '\nTrotzdem Auftrag erstellen?');
            if (!proceed) {
                // Restore angebot status if user cancels
                angebot.status = 'offen';
                return;
            }

            // If user confirms despite shortages, show a note in auftrag
            auftrag.reservationWarning = {
                timestamp: new Date().toISOString(),
                shortages: reservationResult.shortages,
                message: 'Auftrag erstellt trotz Materialengpässen'
            };
        }
    }

    store.auftraege.push(auftrag);
    saveStore();

    addActivity('✅', `Angebot ${angebotId} angenommen → Auftrag ${auftrag.id}`);

    switchView('auftraege');
    document.querySelector('[data-view="auftraege"]')?.click();
}

// ============================================
// Aufträge (Orders) - Full Management System
// ============================================
let currentAuftragFilter = 'alle';
let auftragViewMode = 'kanban';
let currentDetailAuftragId = null;

// ============================================
// Auftrag Status System (Vollständige Pipeline)
// ============================================
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

// Legacy-kompatible Lookups
const AUFTRAG_STATUS_LABELS = {};
const AUFTRAG_STATUS_ICONS = {};
Object.entries(AUFTRAG_STATUS_CONFIG).forEach(([key, cfg]) => {
    AUFTRAG_STATUS_LABELS[key] = cfg.label;
    AUFTRAG_STATUS_ICONS[key] = cfg.icon;
});
AUFTRAG_STATUS_LABELS['aktiv'] = 'In Bearbeitung';
AUFTRAG_STATUS_ICONS['aktiv'] = '🔧';

// Pausier-Gründe
const PAUSE_GRUENDE = [
    'Material nicht verfügbar',
    'Wetter / Witterung',
    'Kundenrückfrage offen',
    'Mitarbeiter krank / nicht verfügbar',
    'Genehmigung ausstehend',
    'Planänderung durch Kunden',
    'Andere Priorität',
    'Sonstiges'
];

const STORNO_GRUENDE = [
    'Kunde hat storniert',
    'Nicht umsetzbar',
    'Zu teuer',
    'Konkurrenzangebot',
    'Zeitlich nicht machbar',
    'Sonstiges'
];

function validateStatusChange(auftrag, newStatus) {
    const current = auftrag.status;
    if (current === newStatus) {return { valid: false, error: 'Status ist bereits ' + AUFTRAG_STATUS_LABELS[current] };}
    const config = AUFTRAG_STATUS_CONFIG[current];
    if (!config) {return { valid: true };} // Legacy status, allow all
    if (!config.erlaubteUebergaenge.includes(newStatus)) {
        return {
            valid: false,
            error: `"${AUFTRAG_STATUS_LABELS[current]}" kann nicht direkt zu "${AUFTRAG_STATUS_LABELS[newStatus]}" wechseln.\nErlaubt: ${config.erlaubteUebergaenge.map(s => AUFTRAG_STATUS_LABELS[s]).join(', ')}`
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
        case 'materialCheck': {
            const stueckliste = auftrag.stueckliste || [];
            if (stueckliste.length > 0 && window.materialService) {
                const fehlend = stueckliste.filter(item => {
                    if (!item.materialId) {return false;}
                    const mat = window.materialService.getMaterialById(item.materialId);
                    const verfuegbar = window.materialService.getAvailableStock(item.materialId);
                    return mat && verfuegbar < item.menge;
                });
                if (fehlend.length > 0) {
                    showToast(`${fehlend.length} Material-Position(en) nicht verfügbar (bereits reserviert oder nicht auf Lager)`, 'warning');
                }
            }
            break;
        }
        case 'zeitStart': {
            if (window.timeTrackingService && !window.timeTrackingService.currentEntry) {
                showToast('Tipp: Zeiterfassung im Auftrag starten', 'info');
            }
            break;
        }
        case 'kundeNotify': {
            showToast(`Kunde ${auftrag.kunde?.name || ''} kann zur Abnahme eingeladen werden`, 'info');
            break;
        }
        case 'rechnungReady': {
            auftrag.fortschritt = 100;
            showToast('Auftrag abgeschlossen - Rechnung kann erstellt werden', 'success');
            break;
        }
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

    // Release reserved materials if order is cancelled
    if (newStatus === 'storniert' && window.materialService) {
        window.materialService.releaseReservation(auftrag.id);
    }

    saveStore();
    executeStatusAutoAktion(auftrag, newStatus);
    addActivity(AUFTRAG_STATUS_ICONS[newStatus] || '📋', `${auftrag.id}: ${AUFTRAG_STATUS_LABELS[oldStatus]} → ${AUFTRAG_STATUS_LABELS[newStatus]}`);

    return { success: true, oldStatus, newStatus };
}

function renderAuftraege() {
    const auftraege = store.auftraege || [];
    // Migrate legacy 'aktiv' status
    auftraege.forEach(a => { if (a.status === 'aktiv') {a.status = 'in_bearbeitung';} });

    // Render stats dynamically from config
    const counts = {};
    Object.keys(AUFTRAG_STATUS_CONFIG).forEach(k => counts[k] = 0);
    auftraege.forEach(a => { if (counts[a.status] !== undefined) {counts[a.status]++;} });

    const statsGrid = document.getElementById('auftrag-stats-grid');
    if (statsGrid) {
        const mainStatuses = ['geplant', 'material_bestellt', 'in_bearbeitung', 'qualitaetskontrolle', 'abnahme', 'abgeschlossen'];
        statsGrid.innerHTML = mainStatuses.map(key => {
            const cfg = AUFTRAG_STATUS_CONFIG[key];
            return `
                <div class="stat-card-mini" style="cursor:pointer;" data-action="toggle-status-filter" data-value="${key}">
                    <span class="stat-icon-mini">${cfg.icon}</span>
                    <div class="stat-content-mini">
                        <span class="stat-value-mini">${counts[key] || 0}</span>
                        <span class="stat-label-mini">${cfg.label}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render pipeline visualization
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

    // Determine which columns to show
    let kanbanStatuses = ['geplant', 'material_bestellt', 'in_bearbeitung', 'qualitaetskontrolle', 'abnahme', 'abgeschlossen'];
    if (currentAuftragFilter !== 'alle') {
        kanbanStatuses = [currentAuftragFilter];
    }
    // Add pausiert/storniert if they have items or are filtered
    if (auftraege.some(a => a.status === 'pausiert') || currentAuftragFilter === 'pausiert') {
        if (!kanbanStatuses.includes('pausiert')) {kanbanStatuses.push('pausiert');}
    }
    if (auftraege.some(a => a.status === 'storniert') || currentAuftragFilter === 'storniert') {
        if (!kanbanStatuses.includes('storniert')) {kanbanStatuses.push('storniert');}
    }

    // Update grid columns count
    kanbanContainer.style.gridTemplateColumns = `repeat(${Math.min(kanbanStatuses.length, 6)}, 1fr)`;

    // Build columns
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

    // Status-Dauer berechnen
    const letzterWechsel = a.letzterStatusWechsel || new Date(a.createdAt).getTime();
    const dauerMs = Date.now() - letzterWechsel;
    const dauerTage = Math.floor(dauerMs / 86400000);
    const dauerText = dauerTage > 0 ? `${dauerTage}d` : `${Math.floor(dauerMs / 3600000)}h`;

    // Pausier-Grund anzeigen
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
            <div class="empty-state" style="padding:40px 20px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">⚙️</div>
                <h3>Keine Aufträge</h3>
                <p style="color:var(--text-secondary);">Aufträge entstehen aus angenommenen Angeboten.</p>
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
                    ${workers ? `<span>👷 ${h(workers)}</span>` : ''}
                    ${a.startDatum ? `<span>📅 ${formatDate(a.startDatum)} - ${a.endDatum ? formatDate(a.endDatum) : '?'}</span>` : ''}
                </div>
                <div style="margin-top:8px;">
                    <div class="auftrag-progress-bar" style="height:6px;">
                        <div class="auftrag-progress-fill ${progressClass}" style="width:${fortschritt}%"></div>
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${fortschritt}% abgeschlossen</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// Auftrag Detail Modal
// ============================================
function openAuftragDetail(auftragId) {
    const auftrag = store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) {return;}

    currentDetailAuftragId = auftragId;

    // Title
    document.getElementById('auftrag-detail-title').textContent = `Auftrag ${auftrag.id}`;

    // Tab: Übersicht
    document.getElementById('ad-kunde-name').textContent = auftrag.kunde.name;
    document.getElementById('ad-kunde-kontakt').textContent =
        [auftrag.kunde.email, auftrag.kunde.telefon].filter(Boolean).join(' | ');
    document.getElementById('ad-leistungsart').textContent = getLeistungsartLabel(auftrag.leistungsart);
    document.getElementById('ad-angebotswert').textContent = `Angebotswert: ${formatCurrency(auftrag.angebotsWert)}`;
    document.getElementById('ad-fortschritt').value = auftrag.fortschritt || 0;
    document.getElementById('ad-fortschritt-label').textContent = `${auftrag.fortschritt || 0}%`;
    document.getElementById('ad-start-datum').value = auftrag.startDatum || '';
    document.getElementById('ad-end-datum').value = auftrag.endDatum || '';

    // Status Pipeline & Actions
    renderDetailStatusPipeline(auftrag);
    renderDetailStatusActions(auftrag);
    renderDetailStatusZeit(auftrag);

    // Mitarbeiter
    renderDetailMitarbeiter(auftrag);

    // Tab: Checkliste
    renderDetailCheckliste(auftrag);

    // Tab: Zeiterfassung
    renderDetailZeiterfassung(auftrag);

    // Tab: Fotos
    renderDetailFotos(auftrag);

    // Tab: Kommentare
    renderDetailKommentare(auftrag);

    // Tab: Historie
    renderDetailHistorie(auftrag);

    // Show first tab
    document.querySelectorAll('#modal-auftrag-detail .auftrag-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#modal-auftrag-detail .auftrag-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('#modal-auftrag-detail .auftrag-tab[data-tab="uebersicht"]').classList.add('active');
    document.querySelector('#modal-auftrag-detail .auftrag-tab-content[data-tab="uebersicht"]').classList.add('active');

    // Show/hide complete button
    const completeBtn = document.getElementById('ad-btn-complete');
    completeBtn.style.display = auftrag.status === 'abgeschlossen' ? 'none' : '';

    openModal('modal-auftrag-detail');
}

function renderDetailStatusPipeline(auftrag) {
    const container = document.getElementById('ad-status-pipeline');
    if (!container) {return;}

    const pipeline = ['geplant', 'material_bestellt', 'in_bearbeitung', 'qualitaetskontrolle', 'abnahme', 'abgeschlossen'];
    const currentIdx = pipeline.indexOf(auftrag.status);
    const isPaused = auftrag.status === 'pausiert';
    const isCancelled = auftrag.status === 'storniert';

    container.innerHTML = `
        <div class="pipeline-flow compact">
            ${pipeline.map((key, i) => {
                const cfg = AUFTRAG_STATUS_CONFIG[key];
                let cls = '';
                if (isPaused || isCancelled) {
                    cls = i <= currentIdx ? 'done' : '';
                } else if (i < currentIdx) {cls = 'done';}
                else if (i === currentIdx) {cls = 'current';}
                return `
                    <div class="pipeline-step ${cls}" style="--step-color:${cfg.color};" title="${cfg.description}">
                        <div class="pipeline-step-icon">${cfg.icon}</div>
                        <div class="pipeline-step-label">${cfg.label}</div>
                        ${i < pipeline.length - 1 ? '<div class="pipeline-arrow">→</div>' : ''}
                    </div>
                `;
            }).join('')}
        </div>
        ${isPaused ? `<div style="margin-top:6px;font-size:12px;color:#94a3b8;">⏸️ Pausiert${auftrag.statusGrund ? ': ' + h(auftrag.statusGrund) : ''}</div>` : ''}
        ${isCancelled ? `<div style="margin-top:6px;font-size:12px;color:#ef4444;">❌ Storniert${auftrag.statusGrund ? ': ' + h(auftrag.statusGrund) : ''}</div>` : ''}
    `;
}

function renderDetailStatusActions(auftrag) {
    const container = document.getElementById('ad-status-actions');
    const grundWrapper = document.getElementById('ad-status-grund-wrapper');
    if (!container) {return;}

    const erlaubt = getErlaubteUebergaenge(auftrag.status);
    if (erlaubt.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Endstatus erreicht</span>';
        grundWrapper.style.display = 'none';
        return;
    }

    container.innerHTML = erlaubt.map(key => {
        const cfg = AUFTRAG_STATUS_CONFIG[key];
        if (!cfg) {return '';}
        const btnClass = key === 'storniert' ? 'btn-danger' : key === 'pausiert' ? 'btn-secondary' : key === 'abgeschlossen' ? 'btn-success' : 'btn-primary';
        return `<button class="btn btn-small ${btnClass}" onclick="handleStatusChange('${key}')">${cfg.icon} ${cfg.label}</button>`;
    }).join('');

    grundWrapper.style.display = 'none';
}

function renderDetailStatusZeit(auftrag) {
    const container = document.getElementById('ad-status-zeit-info');
    if (!container) {return;}

    const zeiten = auftrag.statusZeiten || {};
    const entries = Object.entries(zeiten).filter(([k, v]) => v > 0);
    if (entries.length === 0) {
        container.innerHTML = '';
        return;
    }

    const formatDauer = (ms) => {
        const stunden = Math.floor(ms / 3600000);
        const tage = Math.floor(stunden / 24);
        if (tage > 0) {return `${tage}d ${stunden % 24}h`;}
        if (stunden > 0) {return `${stunden}h`;}
        return `${Math.floor(ms / 60000)}min`;
    };

    container.innerHTML = 'Verweildauer: ' + entries.map(([key, ms]) => {
        const cfg = AUFTRAG_STATUS_CONFIG[key];
        return `<span style="color:${cfg?.color || 'inherit'}">${cfg?.icon || ''} ${cfg?.label || key}: ${formatDauer(ms)}</span>`;
    }).join(' · ');
}

// Global handler for status change buttons in detail modal
window.handleStatusChange = function(newStatus) {
    const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
    if (!auftrag) {return;}

    const config = AUFTRAG_STATUS_CONFIG[newStatus];

    // Check if reason is needed
    if (config?.brauchtGrund) {
        const grundWrapper = document.getElementById('ad-status-grund-wrapper');
        const grundSelect = document.getElementById('ad-status-grund');
        const grundCustom = document.getElementById('ad-status-grund-custom');

        grundWrapper.style.display = 'block';
        grundWrapper.dataset.targetStatus = newStatus;

        const gruende = newStatus === 'storniert' ? STORNO_GRUENDE : PAUSE_GRUENDE;
        grundSelect.innerHTML = '<option value="">Grund auswählen...</option>' +
            gruende.map(g => `<option value="${g}">${g}</option>`).join('');

        grundSelect.onchange = () => {
            grundCustom.style.display = grundSelect.value === 'Sonstiges' ? '' : 'none';
        };

        // Add confirm button if not already there
        if (!document.getElementById('ad-btn-confirm-status')) {
            grundWrapper.insertAdjacentHTML('beforeend',
                `<button class="btn btn-small btn-primary" id="ad-btn-confirm-status" style="margin-top:8px;" data-action="confirm-status-change">Bestätigen</button>`
            );
        }
        return;
    }

    const result = changeAuftragStatus(auftrag.id, newStatus);
    if (!result.success) {
        showToast(result.error, 'error');
        return;
    }

    showToast(`Status: ${AUFTRAG_STATUS_LABELS[newStatus]}`, 'success');
    openAuftragDetail(auftrag.id); // Refresh modal
    renderAuftraege();
};

window.confirmStatusChange = function() {
    const grundWrapper = document.getElementById('ad-status-grund-wrapper');
    const targetStatus = grundWrapper.dataset.targetStatus;
    const grundSelect = document.getElementById('ad-status-grund');
    const grundCustom = document.getElementById('ad-status-grund-custom');

    let grund = grundSelect.value;
    if (grund === 'Sonstiges') {grund = grundCustom.value.trim();}
    if (!grund) {
        showToast('Bitte Grund angeben', 'warning');
        return;
    }

    const result = changeAuftragStatus(currentDetailAuftragId, targetStatus, grund);
    if (!result.success) {
        showToast(result.error, 'error');
        return;
    }

    grundWrapper.style.display = 'none';
    const confirmBtn = document.getElementById('ad-btn-confirm-status');
    if (confirmBtn) {confirmBtn.remove();}

    showToast(`Status: ${AUFTRAG_STATUS_LABELS[targetStatus]} — ${grund}`, 'success');
    openAuftragDetail(currentDetailAuftragId);
    renderAuftraege();
};

function renderDetailMitarbeiter(auftrag) {
    const list = document.getElementById('ad-mitarbeiter-list');
    const mitarbeiter = auftrag.mitarbeiter || [];
    if (mitarbeiter.length === 0) {
        list.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Keine Mitarbeiter zugewiesen</span>';
    } else {
        list.innerHTML = mitarbeiter.map((m, i) =>
            `<span class="mitarbeiter-chip">${h(m)} <span class="remove-worker" data-action="remove-worker" data-index="${i}">&times;</span></span>`
        ).join('');
    }
}

function removeAuftragMitarbeiter(index) {
    const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
    if (!auftrag || !auftrag.mitarbeiter) {return;}
    const removed = auftrag.mitarbeiter.splice(index, 1);
    if (!auftrag.historie) {auftrag.historie = [];}
    auftrag.historie.push({ aktion: 'mitarbeiter', datum: new Date().toISOString(), details: `${removed[0]} entfernt` });
    saveStore();
    renderDetailMitarbeiter(auftrag);
}

function renderDetailCheckliste(auftrag) {
    const container = document.getElementById('ad-checkliste-items');
    const items = auftrag.checkliste || [];
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding:20px;text-align:center;">Noch keine Aufgaben</p>';
        return;
    }
    container.innerHTML = items.map((item, i) => `
        <div class="checkliste-item ${item.erledigt ? 'erledigt' : ''}">
            <input type="checkbox" ${item.erledigt ? 'checked' : ''} data-action-change="toggle-checklist-item" data-index="${i}">
            <span class="checkliste-text">${h(item.text)}</span>
            <span class="checkliste-remove" data-action="remove-checklist-item" data-index="${i}">&times;</span>
        </div>
    `).join('');
}

function toggleChecklistItem(index) {
    const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
    if (!auftrag || !auftrag.checkliste) {return;}
    auftrag.checkliste[index].erledigt = !auftrag.checkliste[index].erledigt;
    // Auto-recalculate progress
    const done = auftrag.checkliste.filter(c => c.erledigt).length;
    auftrag.fortschritt = Math.round((done / auftrag.checkliste.length) * 100);
    document.getElementById('ad-fortschritt').value = auftrag.fortschritt;
    document.getElementById('ad-fortschritt-label').textContent = `${auftrag.fortschritt}%`;
    saveStore();
    renderDetailCheckliste(auftrag);
}

function removeChecklistItem(index) {
    const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
    if (!auftrag || !auftrag.checkliste) {return;}
    auftrag.checkliste.splice(index, 1);
    if (auftrag.checkliste.length > 0) {
        auftrag.fortschritt = Math.round((auftrag.checkliste.filter(c => c.erledigt).length / auftrag.checkliste.length) * 100);
    }
    saveStore();
    renderDetailCheckliste(auftrag);
}

function renderDetailZeiterfassung(auftrag) {
    const entries = window.timeTrackingService?.getEntriesForAuftrag?.(auftrag.id) || [];
    const totalMinutes = entries.reduce((sum, e) => sum + (e.totalMinutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    document.getElementById('ad-zeit-total').innerHTML = `<span>Gesamt</span><span>${hours}:${String(mins).padStart(2, '0')} h</span>`;

    const container = document.getElementById('ad-zeit-entries');
    if (entries.length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding:20px;text-align:center;">Keine Zeiteinträge</p>';
        return;
    }

    container.innerHTML = entries.sort((a, b) => b.startTime - a.startTime).map(e => {
        const h = Math.floor((e.totalMinutes || 0) / 60);
        const m = (e.totalMinutes || 0) % 60;
        return `
            <div class="zeit-entry">
                <div>
                    <div>${e.description || 'Arbeitszeit'}</div>
                    <div class="zeit-entry-date">${formatDate(e.date || e.startTime)}</div>
                </div>
                <span class="zeit-entry-hours">${h}:${String(m).padStart(2, '0')} h</span>
            </div>
        `;
    }).join('');

    // Update clock button
    const clockBtn = document.getElementById('ad-btn-zeit-start');
    const running = window.timeTrackingService?.currentEntry;
    if (running && running.auftragId === auftrag.id) {
        clockBtn.textContent = 'Ausstempeln';
        clockBtn.className = 'btn btn-danger';
    } else {
        clockBtn.textContent = 'Einstempeln';
        clockBtn.className = 'btn btn-success';
    }
}

function renderDetailFotos(auftrag) {
    const photos = window.photoService?.getPhotosByReference?.('auftrag', auftrag.id) || [];
    const container = document.getElementById('ad-foto-gallery');

    if (photos.length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding:20px;text-align:center;grid-column:1/-1;">Keine Fotos</p>';
        return;
    }

    container.innerHTML = photos.map(p => `
        <div class="foto-thumb" onclick="window.open('${p.dataUrl}','_blank')">
            <img src="${p.dataUrl}" alt="Foto" loading="lazy">
            <span class="foto-date">${formatDate(p.timestamp || p.createdAt)}</span>
        </div>
    `).join('');
}

function renderDetailKommentare(auftrag) {
    const comments = auftrag.kommentare || [];
    const container = document.getElementById('ad-kommentar-list');

    if (comments.length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding:20px;text-align:center;">Keine Kommentare</p>';
        return;
    }

    container.innerHTML = comments.map(k => `
        <div class="kommentar-item">
            <div class="kommentar-header">
                <span class="kommentar-autor">${h(k.autor)}</span>
                <span class="kommentar-datum">${formatDate(k.datum)} ${new Date(k.datum).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="kommentar-text">${h(k.text)}</div>
        </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
}

function renderDetailHistorie(auftrag) {
    const items = auftrag.historie || [];
    const container = document.getElementById('ad-historie-timeline');

    if (items.length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding:20px;text-align:center;">Keine Einträge</p>';
        return;
    }

    container.innerHTML = [...items].reverse().map(h_item => `
        <div class="historie-item">
            <div><strong>${h(h_item.aktion)}</strong> — ${h(h_item.details || '')}</div>
            <div class="historie-datum">${formatDate(h_item.datum)} ${new Date(h_item.datum).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `).join('');
}

function initAuftragDetailHandlers() {
    // Tab switching
    document.querySelectorAll('#modal-auftrag-detail .auftrag-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('#modal-auftrag-detail .auftrag-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('#modal-auftrag-detail .auftrag-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`#modal-auftrag-detail .auftrag-tab-content[data-tab="${tabName}"]`).classList.add('active');
        });
    });

    // Fortschritt slider
    document.getElementById('ad-fortschritt')?.addEventListener('input', (e) => {
        document.getElementById('ad-fortschritt-label').textContent = `${e.target.value}%`;
    });

    // Add Mitarbeiter
    document.getElementById('ad-btn-add-mitarbeiter')?.addEventListener('click', () => {
        const input = document.getElementById('ad-mitarbeiter-input');
        const name = input.value.trim();
        if (!name) {return;}

        const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
        if (!auftrag) {return;}
        if (!auftrag.mitarbeiter) {auftrag.mitarbeiter = [];}
        auftrag.mitarbeiter.push(name);
        if (!auftrag.historie) {auftrag.historie = [];}
        auftrag.historie.push({ aktion: 'mitarbeiter', datum: new Date().toISOString(), details: `${name} zugewiesen` });
        saveStore();
        input.value = '';
        renderDetailMitarbeiter(auftrag);
    });

    // Add Checkliste item
    const addChecklist = () => {
        const input = document.getElementById('ad-checkliste-input');
        const text = input.value.trim();
        if (!text) {return;}

        const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
        if (!auftrag) {return;}
        if (!auftrag.checkliste) {auftrag.checkliste = [];}
        auftrag.checkliste.push({ text, erledigt: false });
        saveStore();
        input.value = '';
        renderDetailCheckliste(auftrag);
    };
    document.getElementById('ad-btn-add-checkliste')?.addEventListener('click', addChecklist);
    document.getElementById('ad-checkliste-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addChecklist(); }
    });

    // Zeiterfassung - Ein/Ausstempeln
    document.getElementById('ad-btn-zeit-start')?.addEventListener('click', () => {
        if (!window.timeTrackingService) { showToast('Zeiterfassung nicht verfügbar', 'warning'); return; }
        const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
        if (!auftrag) {return;}

        const current = window.timeTrackingService.currentEntry;
        if (current && current.auftragId === auftrag.id) {
            window.timeTrackingService.clockOut();
            showToast('Ausgestempelt', 'success');
        } else {
            if (current) {window.timeTrackingService.clockOut();} // Clock out from other
            window.timeTrackingService.clockIn({
                auftragId: auftrag.id,
                customerId: auftrag.kunde.name,
                description: `${auftrag.kunde.name} - ${getLeistungsartLabel(auftrag.leistungsart)}`
            });
            showToast('Eingestempelt für ' + auftrag.kunde.name, 'success');
        }
        renderDetailZeiterfassung(auftrag);
    });

    // Zeiterfassung - Manuell
    document.getElementById('ad-btn-zeit-manuell')?.addEventListener('click', () => {
        if (!window.timeTrackingService) { showToast('Zeiterfassung nicht verfügbar', 'warning'); return; }
        const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
        if (!auftrag) {return;}

        const hours = prompt('Stunden eingeben (z.B. 2.5):');
        if (!hours || isNaN(parseFloat(hours))) {return;}

        window.timeTrackingService.addEntry({
            auftragId: auftrag.id,
            customerId: auftrag.kunde.name,
            description: `Manuell: ${auftrag.kunde.name}`,
            totalMinutes: Math.round(parseFloat(hours) * 60),
            date: new Date().toISOString()
        });
        showToast(`${hours}h hinzugefügt`, 'success');
        renderDetailZeiterfassung(auftrag);
    });

    // Foto aufnehmen
    document.getElementById('ad-btn-foto-capture')?.addEventListener('click', async () => {
        if (!window.photoService) { showToast('Foto-Service nicht verfügbar', 'warning'); return; }
        const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
        if (!auftrag) {return;}

        try {
            await window.photoService.capturePhoto({ type: 'auftrag', id: auftrag.id });
            showToast('Foto aufgenommen', 'success');
            renderDetailFotos(auftrag);
        } catch (e) {
            showToast('Kamera nicht verfügbar: ' + e.message, 'error');
        }
    });

    // Foto hochladen
    document.getElementById('ad-foto-upload')?.addEventListener('change', async (e) => {
        if (!window.photoService) {return;}
        const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
        if (!auftrag) {return;}

        for (const file of e.target.files) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                window.photoService.addPhoto(ev.target.result, {
                    type: 'auftrag', id: auftrag.id, category: 'documentation'
                });
                renderDetailFotos(auftrag);
            };
            reader.readAsDataURL(file);
        }
        showToast(`${e.target.files.length} Foto(s) hochgeladen`, 'success');
        e.target.value = '';
    });

    // Kommentar senden
    const sendComment = () => {
        const input = document.getElementById('ad-kommentar-input');
        const text = input.value.trim();
        if (!text) {return;}

        const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
        if (!auftrag) {return;}
        if (!auftrag.kommentare) {auftrag.kommentare = [];}
        const userName = store.settings?.owner || 'Benutzer';
        auftrag.kommentare.push({ id: 'kom-' + Date.now(), text, autor: userName, datum: new Date().toISOString() });
        if (!auftrag.historie) {auftrag.historie = [];}
        auftrag.historie.push({ aktion: 'kommentar', datum: new Date().toISOString(), details: text.substring(0, 50) });
        saveStore();
        input.value = '';
        renderDetailKommentare(auftrag);
    };
    document.getElementById('ad-btn-add-kommentar')?.addEventListener('click', sendComment);

    // Save changes (Fortschritt, Termine, Mitarbeiter - Status läuft über Buttons)
    document.getElementById('ad-btn-save')?.addEventListener('click', () => {
        const auftrag = store.auftraege.find(a => a.id === currentDetailAuftragId);
        if (!auftrag) {return;}

        const newFortschritt = parseInt(document.getElementById('ad-fortschritt').value);
        const newStart = document.getElementById('ad-start-datum').value || null;
        const newEnd = document.getElementById('ad-end-datum').value || null;

        if (!auftrag.historie) {auftrag.historie = [];}

        if (newFortschritt !== (auftrag.fortschritt || 0)) {
            auftrag.historie.push({ aktion: 'fortschritt', datum: new Date().toISOString(), details: `${auftrag.fortschritt || 0}% → ${newFortschritt}%` });
        }
        if (newStart !== auftrag.startDatum || newEnd !== auftrag.endDatum) {
            auftrag.historie.push({ aktion: 'termin', datum: new Date().toISOString(), details: `${newStart || '?'} bis ${newEnd || '?'}` });
        }

        auftrag.fortschritt = newFortschritt;
        auftrag.startDatum = newStart;
        auftrag.endDatum = newEnd;

        saveStore();
        showToast('Auftrag gespeichert', 'success');
        renderAuftraege();
    });

    // Complete → open completion modal
    document.getElementById('ad-btn-complete')?.addEventListener('click', () => {
        closeModal('modal-auftrag-detail');
        openAuftragModal(currentDetailAuftragId);
    });

    // Kanban/List view toggle
    document.getElementById('btn-auftrag-kanban-view')?.addEventListener('click', () => {
        auftragViewMode = 'kanban';
        document.getElementById('btn-auftrag-kanban-view').classList.replace('btn-secondary', 'btn-primary');
        document.getElementById('btn-auftrag-list-view').classList.replace('btn-primary', 'btn-secondary');
        renderAuftraege();
    });
    document.getElementById('btn-auftrag-list-view')?.addEventListener('click', () => {
        auftragViewMode = 'list';
        document.getElementById('btn-auftrag-list-view').classList.replace('btn-secondary', 'btn-primary');
        document.getElementById('btn-auftrag-kanban-view').classList.replace('btn-primary', 'btn-secondary');
        renderAuftraege();
    });

    // Filter buttons
    document.querySelectorAll('#auftrag-filter-bar .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentAuftragFilter = btn.dataset.filter;
            document.querySelectorAll('#auftrag-filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderAuftraege();
        });
    });

    // Search
    document.getElementById('auftrag-search')?.addEventListener('input', () => renderAuftraege());
}

// ============================================
// Stückliste (Bill of Materials) Management
// ============================================
let stuecklisteItems = []; // Current BOM items in modal

function openAuftragModal(auftragId) {
    const auftrag = store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) {return;}

    store.currentAuftragId = auftragId;
    const auftragIdEl = document.getElementById('auftrag-id');
    if (auftragIdEl) {auftragIdEl.value = auftragId;}

    const auftragInfoEl = document.getElementById('auftrag-info');
    if (!auftragInfoEl) {return;}
    auftragInfoEl.innerHTML = `
        <p><strong>${h(auftrag.kunde.name)}</strong></p>
        <p>${getLeistungsartLabel(auftrag.leistungsart)}</p>
        <p>Angebotswert: ${formatCurrency(auftrag.angebotsWert)}</p>
        <p style="font-size:12px; color:var(--text-muted);">Positionen: ${auftrag.positionen.map(p => h(p.beschreibung)).join(', ')}</p>
    `;

    const arbeitszeitEl = document.getElementById('arbeitszeit');
    if (arbeitszeitEl) {arbeitszeitEl.value = '';}
    const materialKostenEl = document.getElementById('material-kosten-extra');
    if (materialKostenEl) {materialKostenEl.value = '0';}
    const notizenEl = document.getElementById('notizen');
    if (notizenEl) {notizenEl.value = '';}

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
    if (!container) {return;}

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
                    if (!mat) {return;}
                    selectMaterialForStueckliste(slId, mat);
                    suggestBox.style.display = 'none';
                });
            });
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                const suggestBox = document.getElementById(`sl-suggest-${input.dataset.slId}`);
                if (suggestBox) {suggestBox.style.display = 'none';}
            }, 200);
        });
    });
}

function selectMaterialForStueckliste(slId, material) {
    const item = stuecklisteItems.find(i => i.id === slId);
    if (!item) {return;}

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
    if (!item) {return;}

    item.menge = parseFloat(input.value) || 0;
    // Update Gesamt in row
    const row = input.closest('.stueckliste-row');
    const gesamtEl = row?.querySelector('.sl-gesamt');
    if (gesamtEl) {gesamtEl.textContent = formatCurrency(item.menge * item.vkPreis);}

    updateStuecklisteSummary();
}

function updateStuecklisteSummary() {
    const totalEK = stuecklisteItems.reduce((sum, i) => sum + (i.menge * i.ekPreis), 0);
    const totalVK = stuecklisteItems.reduce((sum, i) => sum + (i.menge * i.vkPreis), 0);

    const ekEl = document.getElementById('sl-total-ek');
    const vkEl = document.getElementById('sl-total-vk');
    const margeEl = document.getElementById('sl-total-marge');

    if (ekEl) {ekEl.textContent = formatCurrency(totalEK);}
    if (vkEl) {vkEl.textContent = formatCurrency(totalVK);}
    if (margeEl) {margeEl.textContent = formatCurrency(totalVK - totalEK);}

    // Update total summary
    const auftragId = document.getElementById('auftrag-id')?.value;
    const auftrag = store.auftraege.find(a => a.id === auftragId);
    if (auftrag) {updateAuftragTotalSummary(auftrag);}
}

function updateAuftragTotalSummary(auftrag) {
    const materialVK = stuecklisteItems.reduce((sum, i) => sum + (i.menge * i.vkPreis), 0);
    const extra = parseFloat(document.getElementById('material-kosten-extra')?.value) || 0;
    const angebotNetto = auftrag.netto || 0;

    const netto = angebotNetto + materialVK + extra;
    const mwst = netto * 0.19;
    const brutto = netto + mwst;

    const set = (id, val) => { const el = document.getElementById(id); if (el) {el.textContent = formatCurrency(val);} };
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
            if (m) {addStuecklisteRow(m);}
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
    if (!auftrag) {return;}

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
        if (auftrag) {updateAuftragTotalSummary(auftrag);}
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const auftragId = document.getElementById('auftrag-id').value;
        const auftrag = store.auftraege.find(a => a.id === auftragId);
        if (!auftrag) {return;}

        // Show confirmation dialog
        window.confirmDialogService?.confirmCompleteAuftrag(
            auftrag.id,
            window.UI?.sanitize?.(auftrag.kunde?.name) || 'Unbekannt',
            () => {
                // Confirmed - proceed with completion
                proceedWithAuftragCompletion(auftrag);
            }
        );
    });
}

function proceedWithAuftragCompletion(auftrag) {
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

    // Consume reserved materials (convert reserved → consumed in stock)
    if (window.materialService) {
        const consumed = window.materialService.consumeReserved(auftrag.id);
        if (consumed.length > 0) {
            auftrag.consumedMaterials = consumed;
        }
    }

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
        auftragId: auftrag.id,
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
    if (typeof renderMaterial === 'function') {renderMaterial();}

    closeModal('modal-auftrag');
    switchView('rechnungen');
    document.querySelector('[data-view="rechnungen"]')?.click();
}

// ============================================
// Rechnungen (Invoices)
// ============================================
function renderRechnungen() {
    const container = document.getElementById('rechnungen-list');
    if (!container) {return;}

    if (!store?.rechnungen || store.rechnungen.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px">📄</div>
                <h3>Keine Rechnungen</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px">Erstellen Sie erst einen Auftrag, um eine Rechnung zu generieren.</p>
                <button class="btn btn-secondary" data-action="navigate-auftraege">
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
    if (!rechnung) {return;}

    store.currentRechnungId = rechnungId;

    const preview = document.getElementById('rechnung-preview');
    if (!preview) {return;}
    preview.innerHTML = `
        <div class="rechnung-header">
            <div class="rechnung-firma">
                ⚙️ FreyAI Visions<br>
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
                    FreyAI Visions<br>
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
        if (!store.currentRechnungId) {return;}
        const rechnung = store.rechnungen.find(r => r.id === store.currentRechnungId);
        if (!rechnung) {return;}

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
        if (!store.currentRechnungId) {return;}

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

    // Update stats (with null guards)
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

    // Update kategorie filter
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
                    <button class="btn btn-secondary" data-action="load-demo-materials">
                        🎲 Demo-Daten laden
                    </button>
                    <button class="btn btn-primary" data-action="trigger-material-import">
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
    // Excel Import
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

    // Demo Materials Button
    const demoBtn = document.getElementById('btn-demo-materials');
    if (demoBtn) {
        demoBtn.addEventListener('click', async () => {
            // Guard: Require confirmation in production mode
            if (window.demoGuardService && !window.demoGuardService.isDeveloperMode) {
                const confirmed = await window.demoGuardService.confirmDemoLoad('Demo-Materialien laden');
                if (!confirmed) {return;}
            }

            window.materialService.loadDemoMaterials();
            renderMaterial();
            showToast('✅ Demo-Materialien geladen!', 'success');
            addActivity('📦', 'Demo-Materialbestand geladen (10 Artikel)');

            // Show demo mode banner
            if (window.demoGuardService) {
                window.demoGuardService.showDemoBanner();
                window.demoGuardService.markDemoLoaded();
            }
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
        a.download = `freyai-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
        window.confirmDialogService?.confirmDelete(
            'Alle Daten',
            'Alle gespeicherten Daten (Kunden, Anfragen, Angebote, Aufträge, Rechnungen) werden gelöscht',
            () => {
                localStorage.clear();
                location.reload();
            }
        );
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
    if (emailField) {emailField.value = senderEmail;}

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

    // Email Automation Config
    document.getElementById('btn-save-email-automation')?.addEventListener('click', async () => {
        const enabled = document.getElementById('email-auto-reply-enabled').checked;
        const requireApproval = document.getElementById('email-require-approval').checked;
        const replyTemplate = document.getElementById('email-reply-template').value.trim();

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
        window.UI.openModal('modal-test-email');
    });

    // View Email Automation History
    document.getElementById('btn-view-email-automation')?.addEventListener('click', () => {
        if (typeof switchView === 'function') { switchView('email-automation'); }
    });

    // Run Test
    document.getElementById('btn-run-test')?.addEventListener('click', async () => {
        const emailText = document.getElementById('test-email-body').value.trim();

        if (!emailText) {
            showToast('Bitte E-Mail-Text eingeben', 'warning');
            return;
        }

        if (!window.emailAutomationService) {
            showToast('Service noch nicht geladen', 'warning');
            return;
        }

        showToast('Verarbeite Test-Email...', 'info');

        const result = await window.emailAutomationService.testProcessing(emailText);

        const resultDiv = document.getElementById('test-result');
        if (result.success) {
            resultDiv.className = 'visible';
            resultDiv.innerHTML = `
                <div class="test-result-section">
                    <h4>✅ Analyse erfolgreich</h4>
                    <div class="test-analysis-grid">
                        <div class="analysis-item">
                            <div class="analysis-label">Kunde</div>
                            <div class="analysis-value">${result.analysis.customerName || '-'}</div>
                        </div>
                        <div class="analysis-item">
                            <div class="analysis-label">Telefon</div>
                            <div class="analysis-value">${result.analysis.phone || '-'}</div>
                        </div>
                        <div class="analysis-item">
                            <div class="analysis-label">E-Mail</div>
                            <div class="analysis-value">${result.analysis.email || '-'}</div>
                        </div>
                        <div class="analysis-item">
                            <div class="analysis-label">Projekttyp</div>
                            <div class="analysis-value">${result.analysis.projectType}</div>
                        </div>
                        <div class="analysis-item">
                            <div class="analysis-label">Dringlichkeit</div>
                            <div class="analysis-value">${result.analysis.urgency}</div>
                        </div>
                        <div class="analysis-item">
                            <div class="analysis-label">Geschätzter Wert</div>
                            <div class="analysis-value">${result.analysis.estimatedValue.toFixed(2)} €</div>
                        </div>
                    </div>
                </div>
                <div class="test-result-section">
                    <h4>📄 Erstelltes Angebot</h4>
                    <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px;">
                        <p><strong>${result.quote.title}</strong></p>
                        <p style="font-size: 13px; color: var(--text-muted); margin: 8px 0;">
                            Kunde: ${result.quote.customer.name}<br>
                            Status: ${result.quote.status}<br>
                            Summe: ${result.quote.total.toFixed(2)} €
                        </p>
                    </div>
                </div>
            `;
            showToast('Test erfolgreich!', 'success');
        } else {
            resultDiv.className = 'visible';
            resultDiv.innerHTML = `
                <div style="color: var(--color-error); padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 6px;">
                    ❌ Fehler: ${result.error}
                </div>
            `;
            showToast('Test fehlgeschlagen', 'error');
        }
    });

    // Load Example Email
    document.getElementById('btn-load-example-email')?.addEventListener('click', () => {
        const examples = [
            `Sehr geehrte Damen und Herren,

ich benötige ein Metalltor für meine Einfahrt.
Breite: 4 Meter
Höhe: 1,80 Meter
Material: Verzinkter Stahl

Bitte senden Sie mir ein Angebot.

Mit freundlichen Grüßen
Max Mustermann
Musterstraße 123
12345 Musterstadt
Tel: 0171-1234567
Email: max.mustermann@example.com`,
            `Hallo,

wir brauchen einen neuen Zaun für unser Grundstück.
Länge ca. 20 Meter, Höhe 1,50m.
Können Sie uns ein Angebot machen?

Freundliche Grüße
Sarah Schmidt
Tel: 0172-9876543`,
            `Guten Tag,

ich suche eine Metalltreppe für den Außenbereich.
Höhenunterschied: ca. 3 Meter
15-20 Stufen
Verzinkt und wetterfest

Bitte um Angebot.

MfG
Thomas Weber
weber@example.de
0176-5551234`
        ];

        const randomExample = examples[Math.floor(Math.random() * examples.length)];
        document.getElementById('test-email-body').value = randomExample;
        showToast('Beispiel-Email geladen', 'success');
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
    const emailAutomationStatus = document.getElementById('email-automation-status');

    const setStatus = (el, configured) => {
        if (!el) {return;}
        el.textContent = configured ? '● Konfiguriert' : '● Nicht konfiguriert';
        el.className = 'status-indicator' + (configured ? ' connected' : '');
    };

    setStatus(geminiStatus, geminiKey);
    setStatus(webhookStatus, webhookUrl);
    setStatus(emailStatus, emailConfigured);
    setStatus(smsStatus, twilioSid);

    // Email Automation Status
    if (window.emailAutomationService) {
        const config = window.emailAutomationService.getConfig();
        const configured = config.enabled;
        if (emailAutomationStatus) {
            emailAutomationStatus.textContent = configured ? '● Aktiv' : '● Deaktiviert';
            emailAutomationStatus.className = 'status-indicator' + (configured ? ' connected' : '');
        }
    }

    // Automation status panel
    const supabaseOk = window.supabaseConfig?.isConfigured();
    const setAutoStatus = (id, ok, label) => {
        const el = document.getElementById(id);
        if (!el) {return;}
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
    if (existing) {existing.remove();}

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
    if (!anfrage) {return;}

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
        case 'quick-actions': window.QuickActionsModule?.init?.(); break;
        case 'dashboard': updateDashboard(); break;
        case 'anfragen': renderAnfragen(); break;
        case 'angebote': renderAngebote(); break;
        case 'auftraege': renderAuftraege(); break;
        case 'rechnungen': renderRechnungen(); break;
        case 'material': renderMaterial(); break;
        case 'wareneingang': window.WareneingangModule?.renderWareneingang?.(); break;
        case 'mahnwesen': renderMahnwesen(); break;
        case 'buchhaltung': renderBuchhaltung(); break;
        case 'einstellungen':
            updateSettingsStatus();
            loadEmailAutomationConfig();
            break;
        case 'email-automation': renderEmailAutomation(); break;
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

    // Update stats (with null guards)
    const dunningCountEl = document.getElementById('dunning-count');
    if (dunningCountEl) {dunningCountEl.textContent = overdueItems.length;}
    const totalSum = overdueItems.reduce((sum, item) => sum + item.rechnung.brutto, 0);
    const dunningTotalEl = document.getElementById('dunning-total');
    if (dunningTotalEl) {dunningTotalEl.textContent = formatCurrency(totalSum);}
    const dunningInkassoEl = document.getElementById('dunning-inkasso');
    if (dunningInkassoEl) {dunningInkassoEl.textContent = inkassoFaelle.length;}
    const mahnwesenBadgeEl = document.getElementById('mahnwesen-badge');
    if (mahnwesenBadgeEl) {mahnwesenBadgeEl.textContent = overdueItems.length;}

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
                    <div class="dunning-kunde">${h(rechnung.kunde.name)}</div>
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
    if (!rechnung) {return;}

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
        if (!rechnung) {return;}

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

    // Update EÜR summary (with null guards)
    const eurEinnahmenEl = document.getElementById('eur-einnahmen');
    if (eurEinnahmenEl) {eurEinnahmenEl.textContent = formatCurrency(eur.einnahmen?.brutto || 0);}
    const eurEinnahmenNettoEl = document.getElementById('eur-einnahmen-netto');
    if (eurEinnahmenNettoEl) {eurEinnahmenNettoEl.textContent = formatCurrency(eur.einnahmen?.netto || 0);}
    const eurUstEl = document.getElementById('eur-ust');
    if (eurUstEl) {eurUstEl.textContent = formatCurrency(eur.einnahmen?.ust || 0);}

    const eurAusgabenEl = document.getElementById('eur-ausgaben');
    if (eurAusgabenEl) {eurAusgabenEl.textContent = formatCurrency(eur.ausgaben?.brutto || 0);}
    const eurAusgabenNettoEl = document.getElementById('eur-ausgaben-netto');
    if (eurAusgabenNettoEl) {eurAusgabenNettoEl.textContent = formatCurrency(eur.ausgaben?.netto || 0);}
    const eurVstEl = document.getElementById('eur-vst');
    if (eurVstEl) {eurVstEl.textContent = formatCurrency(eur.ausgaben?.vorsteuer || 0);}

    const eurGewinnEl = document.getElementById('eur-gewinn');
    if (eurGewinnEl) {eurGewinnEl.textContent = formatCurrency(eur.gewinn || 0);}
    const eurZahllastEl = document.getElementById('eur-zahllast');
    if (eurZahllastEl) {eurZahllastEl.textContent = formatCurrency(eur.ustZahllast || 0);}

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
        if (!file) {return;}

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
    // Check if setup wizard needs to run
    if (window.setupWizard && !window.setupWizard.isSetupComplete()) {
        // Show setup wizard if APIs are not configured
        const missing = window.setupWizard.getMissingKeys();
        if (missing.length > 0) {
            console.log('⚙️ Setup incomplete. Missing keys:', missing.map(k => k.name).join(', '));
            if (window.setupWizardUI) {
                window.setupWizardUI.show();
                return; // Don't initialize app until setup is complete
            }
        }
    }

    // Await store service load (migrates from localStorage if needed)
    await window.storeService.load();

    initAnfrageForm();
    initAngebotForm();
    initAuftragForm();
    initAuftragDetailHandlers();
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
    // Initialize Quick Actions Home Screen (new feature)
    window.QuickActionsModule?.init?.();

    // Dashboard Quick Action Buttons (legacy dashboard buttons)
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
    // Guard: Require confirmation in production mode
    if (window.demoGuardService && !window.demoGuardService.isDeveloperMode) {
        const confirmed = await window.demoGuardService.confirmDemoLoad('Demo-Workflow');
        if (!confirmed) {return;}
    }

    showToast('🚀 Demo-Workflow startet...', 'info');

    // Show demo mode banner
    if (window.demoGuardService) {
        window.demoGuardService.showDemoBanner();
        window.demoGuardService.markDemoLoaded();
    }

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
        if (modalOpen) {return;}

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
let customerPresets = {};
try { customerPresets = JSON.parse(localStorage.getItem('freyai_customer_presets') || '{}'); } catch { customerPresets = {}; }

function saveCustomerPresets() {
    localStorage.setItem('freyai_customer_presets', JSON.stringify(customerPresets));
}

function initCustomerPresets() {
    // Update dropdown when modal opens
    const presetSelect = document.getElementById('customer-preset');

    function updatePresetDropdown() {
        if (!presetSelect) {return;}
        const emails = Object.keys(customerPresets);
        presetSelect.innerHTML = '<option value="">-- Keine Vorlage --</option>' +
            emails.map(email => `<option value="${h(email)}">${h(email)} (${customerPresets[email].length} Pos.)</option>`).join('');
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
                let m; try { m = JSON.parse(item.dataset.material); } catch { return; }
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
        if (!file) {return;}

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
            if (idx >= 0) {bankTransactions.splice(idx, 1);}
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
        if (a.status !== 'offen') {return false;}
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

async function updateEmailAutomationBadge() {
    if (!window.emailAutomationService) {return;}

    const history = await window.emailAutomationService.getProcessedEmails(100);
    const pending = history.filter(e => e.status === 'pending').length;
    const badge = document.getElementById('email-automation-badge');

    if (badge) {
        badge.textContent = pending;
        badge.style.display = pending > 0 ? 'inline' : 'none';
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
// Email Automation UI Functions
// ============================================

async function renderEmailAutomation() {
    if (!window.emailAutomationService) {
        console.warn('EmailAutomationService not loaded yet');
        return;
    }

    // Update stats
    const stats = await window.emailAutomationService.getStats();
    document.getElementById('stat-emails-received').textContent = stats.totalProcessed;
    document.getElementById('stat-emails-processed').textContent = stats.successful;
    document.getElementById('stat-quotes-created').textContent = stats.quotesCreated;

    // Average processing time: calculate from history if available
    let avgTime = '-';
    if (stats.totalProcessed > 0) {
        const history = await window.emailAutomationService.getProcessedEmails(100);
        const timings = history
            .filter(e => e.processingTime && typeof e.processingTime === 'number')
            .map(e => e.processingTime);
        if (timings.length > 0) {
            const avg = timings.reduce((sum, t) => sum + t, 0) / timings.length;
            avgTime = (avg / 1000).toFixed(1) + 's';
        } else {
            avgTime = 'N/A';
        }
    }
    document.getElementById('stat-avg-time').textContent = avgTime;

    // Render history
    await renderEmailHistory();
}

async function renderEmailHistory(filter = '') {
    if (!window.emailAutomationService) {
        return;
    }

    const history = await window.emailAutomationService.getProcessedEmails(100);
    const listEl = document.getElementById('email-history-list');

    if (!listEl) {return;}

    // Apply filter
    const filtered = filter ? history.filter(e => e.status === filter) : history;

    if (filtered.length === 0) {
        listEl.innerHTML = '<p class="empty-state">Noch keine E-Mails verarbeitet.</p>';
        return;
    }

    listEl.innerHTML = filtered.map(entry => {
        const timestamp = new Date(entry.timestamp).toLocaleString('de-DE');
        const statusClass = entry.status || 'pending';
        const statusLabel = {
            'success': '✅ Erfolgreich',
            'pending': '⏳ Ausstehend',
            'failed': '❌ Fehler',
            'test': '🧪 Test'
        }[statusClass] || statusClass;

        return `
            <div class="email-history-item" data-id="${entry.id}">
                <div class="email-history-header">
                    <div>
                        <strong>${entry.analysis?.projectType || 'Unbekanntes Projekt'}</strong>
                        <div class="email-history-meta">
                            <span>📅 ${timestamp}</span>
                            ${entry.analysis?.customerName ? `<span>👤 ${entry.analysis.customerName}</span>` : ''}
                        </div>
                    </div>
                    <span class="email-history-status ${statusClass}">${statusLabel}</span>
                </div>

                ${entry.emailText ? `
                    <div class="email-preview">${entry.emailText}</div>
                ` : ''}

                ${entry.analysis ? `
                    <div class="email-analysis">
                        ${entry.analysis.customerName ? `
                            <div class="analysis-item">
                                <div class="analysis-label">Kunde</div>
                                <div class="analysis-value">${entry.analysis.customerName}</div>
                            </div>
                        ` : ''}
                        ${entry.analysis.phone ? `
                            <div class="analysis-item">
                                <div class="analysis-label">Telefon</div>
                                <div class="analysis-value">${entry.analysis.phone}</div>
                            </div>
                        ` : ''}
                        ${entry.analysis.email ? `
                            <div class="analysis-item">
                                <div class="analysis-label">E-Mail</div>
                                <div class="analysis-value">${entry.analysis.email}</div>
                            </div>
                        ` : ''}
                        <div class="analysis-item">
                            <div class="analysis-label">Projekttyp</div>
                            <div class="analysis-value">${entry.analysis.projectType || '-'}</div>
                        </div>
                        ${entry.analysis.estimatedValue ? `
                            <div class="analysis-item">
                                <div class="analysis-label">Geschätzter Wert</div>
                                <div class="analysis-value">${entry.analysis.estimatedValue.toFixed(2)} €</div>
                            </div>
                        ` : ''}
                        ${entry.analysis.urgency ? `
                            <div class="analysis-item">
                                <div class="analysis-label">Dringlichkeit</div>
                                <div class="analysis-value">${entry.analysis.urgency}</div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                ${entry.quote ? `
                    <div class="email-history-actions">
                        <button class="btn btn-secondary btn-small" onclick="viewQuoteFromEmail('${entry.id}')">
                            📄 Angebot anzeigen
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function viewQuoteFromEmail(entryId) {
    // Navigate to the angebote view
    if (window.navigationController) {
        await window.navigationController.navigateTo('angebote');
    }

    // Try to find quote data from email history
    if (window.emailAutomationService) {
        const history = await window.emailAutomationService.getProcessedEmails(100);
        const entry = history.find(e => e.id === entryId);
        if (entry && entry.quote) {
            const quoteTitle = entry.quote.title || 'Angebot';
            const customerName = entry.quote.customer?.name || '';
            const msg = customerName
                ? `Angebot "${quoteTitle}" für ${customerName}`
                : `Angebot "${quoteTitle}"`;
            showToast(msg, 'info');

            // If a matching angebot exists in the store, scroll to it
            if (entry.quote.id) {
                const el = document.querySelector(`[data-id="${entry.quote.id}"]`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('highlight');
                    setTimeout(() => el.classList.remove('highlight'), 2000);
                }
            }
        } else {
            showToast('Angebote-Ansicht geöffnet', 'info');
        }
    } else {
        showToast('Angebote-Ansicht geöffnet', 'info');
    }
}

// Event handlers for email automation view
document.getElementById('btn-refresh-email-history')?.addEventListener('click', async () => {
    await renderEmailHistory();
    showToast('Historie aktualisiert', 'success');
});

document.getElementById('email-history-filter')?.addEventListener('change', async (e) => {
    await renderEmailHistory(e.target.value);
});

// Load email automation config on settings page
function loadEmailAutomationConfig() {
    if (!window.emailAutomationService) {return;}

    const config = window.emailAutomationService.getConfig();

    const enabledEl = document.getElementById('email-auto-reply-enabled');
    const approvalEl = document.getElementById('email-require-approval');
    const templateEl = document.getElementById('email-reply-template');

    if (enabledEl) {enabledEl.checked = config.enabled;}
    if (approvalEl) {approvalEl.checked = config.requireApproval;}
    if (templateEl) {templateEl.value = config.replyTemplate;}
}

// Initialize email automation on settings view
window.addEventListener('emailAutomationConfigChanged', () => {
    updateSettingsStatus();
});

window.viewQuoteFromEmail = viewQuoteFromEmail;

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
        updateEmailAutomationBadge();
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
        const invoice = store.rechnungen?.find(r => r.id === invoiceId);
        if (!invoice) {
            showToast('❌ Rechnung nicht gefunden', 'error');
            return;
        }

        // Show confirmation dialog
        window.confirmDialogService?.confirmMarkAsPaid(
            invoice.nummer || invoice.id,
            invoice.brutto || 0,
            async () => {
                // Confirmed - proceed with marking as paid
                if (!window.invoiceService) {
                    showToast('❌ Invoice Service nicht verfügbar', 'error');
                    return;
                }

                try {
                    const result = await window.invoiceService.markAsPaid(invoiceId, {
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
        );
    } catch (error) {
        console.error('markInvoiceAsPaid error:', error);
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
    if (!previewElement) {return;}

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
    if (!angebot) {return;}
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
    if (!rechnung) {return;}
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
window.updateEmailAutomationBadge = updateEmailAutomationBadge;
window.exportAngebotPDF = exportAngebotPDF;
window.exportMahnungPDF = exportMahnungPDF;
window.downloadInvoicePDF = downloadInvoicePDF;
window.generateEInvoice = generateEInvoice;
window.markInvoiceAsPaid = markInvoiceAsPaid;
window.previewNextInvoiceNumber = previewNextInvoiceNumber;
window.generateSenderEmail = generateSenderEmail;
window.openAuftragDetail = openAuftragDetail;
window.removeAuftragMitarbeiter = removeAuftragMitarbeiter;
window.toggleChecklistItem = toggleChecklistItem;
window.removeChecklistItem = removeChecklistItem;
window.changeAuftragStatus = changeAuftragStatus;

// Expose init function globally for setup wizard
window.app = {
    init: async () => {
        await init();
        initAutomations();
    }
};

// Start app
document.addEventListener('DOMContentLoaded', async () => {
    await init();
    initAutomations();
});
