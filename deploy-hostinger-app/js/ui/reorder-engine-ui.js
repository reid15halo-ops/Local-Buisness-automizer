/* ============================================
   Reorder Engine UI
   Stock Movements & Auto-Reorder Interface
   ============================================ */

class ReorderEngineUI {
    constructor() {
        this.currentTab = 'lagerbewegungen'; // Default tab
        this.initUI();
        this.attachEventListeners();
    }

    initUI() {
        // Create the Lagerbewegungen section in material view
        this.setupStockMovementsSection();
        this.setupReorderSettingsPanel();
    }

    // ============================================
    // Stock Movements Tab (in Material Section)
    // ============================================

    setupStockMovementsSection() {
        // This would be added to the material section dynamically
        // Or could be added to index.html. For now, we'll create it dynamically on demand.

        // Create a "Lagerbewegungen" tab button if it doesn't exist
        const materialView = document.getElementById('view-material');
        if (!materialView) {return;}

        // Find the header to add a tab switcher
        const materialHeader = materialView.querySelector('.view-header');
        if (!materialHeader) {return;}

        // Check if tab bar already exists
        if (!document.getElementById('material-tab-bar')) {
            const tabBar = document.createElement('div');
            tabBar.id = 'material-tab-bar';
            tabBar.className = 'tab-bar';
            tabBar.innerHTML = `
                <button class="tab-button active" data-tab="bestand">📦 Bestand</button>
                <button class="tab-button" data-tab="lagerbewegungen">📜 Lagerbewegungen</button>
                <button class="tab-button" data-tab="nachbestellungen">🔄 Nachbestellungen</button>
            `;
            materialHeader.parentNode.insertBefore(tabBar, materialHeader.nextSibling);

            // Create content containers
            const container = document.createElement('div');
            container.id = 'material-tab-content';
            const materialList = document.getElementById('material-list');
            materialList.parentNode.insertBefore(container, materialList.nextSibling);

            // Content for each tab
            const bestandContent = document.createElement('div');
            bestandContent.id = 'tab-bestand';
            bestandContent.className = 'tab-content active';
            bestandContent.appendChild(materialList.cloneNode(true));

            const bewegungenContent = document.createElement('div');
            bewegungenContent.id = 'tab-lagerbewegungen';
            bewegungenContent.className = 'tab-content';
            bewegungenContent.innerHTML = `
                <div class="movement-controls">
                    <input type="text" id="movement-material-search" placeholder="🔍 Nach Material suchen...">
                    <input type="date" id="movement-start-date" placeholder="Von">
                    <input type="date" id="movement-end-date" placeholder="Bis">
                    <select id="movement-type-filter">
                        <option value="">Alle Typen</option>
                        <option value="reserved">Reserviert</option>
                        <option value="released">Freigegeben</option>
                        <option value="consumed">Verbraucht</option>
                        <option value="received">Empfangen</option>
                        <option value="adjusted">Korrigiert</option>
                    </select>
                    <button class="btn btn-secondary" id="btn-export-movements">📥 CSV Export</button>
                </div>
                <div class="movement-list" id="movement-list">
                    <p class="empty-state">Keine Lagerbewegungen vorhanden</p>
                </div>
            `;

            const nachbestellungenContent = document.createElement('div');
            nachbestellungenContent.id = 'tab-nachbestellungen';
            nachbestellungenContent.className = 'tab-content';
            nachbestellungenContent.innerHTML = `
                <div class="reorder-suggestions">
                    <div class="reorder-summary">
                        <div class="summary-stat">
                            <span id="reorder-count" class="number">0</span>
                            <span class="label">Artikel mit Bestandsmangel</span>
                        </div>
                        <div class="summary-stat">
                            <span id="reorder-total-cost" class="number">0 €</span>
                            <span class="label">Geschätzte Bestellmenge</span>
                        </div>
                    </div>
                    <div class="reorder-list" id="reorder-list">
                        <p class="empty-state">Alle Artikel haben ausreichend Bestand</p>
                    </div>
                </div>
            `;

            container.appendChild(bestandContent);
            container.appendChild(bewegungenContent);
            container.appendChild(nachbestellungenContent);
        }
    }

    setupReorderSettingsPanel() {
        // Add reorder settings to the Einstellungen view
        const settingsView = document.getElementById('view-einstellungen');
        if (!settingsView) {return;}

        // Check if settings card already exists
        if (!document.getElementById('reorder-settings-card')) {
            const settingsGrid = settingsView.querySelector('.settings-grid');
            if (!settingsGrid) {return;}

            const reorderCard = document.createElement('div');
            reorderCard.id = 'reorder-settings-card';
            reorderCard.className = 'settings-card';
            reorderCard.innerHTML = `
                <h3>🤖 Automatische Nachbestellung</h3>
                <p>Automatisches Nachbestellen bei Bestandsmangel</p>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="auto-reorder-enabled">
                        Automatische Nachbestellung aktivieren
                    </label>
                </div>

                <div class="form-group">
                    <label for="reorder-strategy">Nachbestellstrategie</label>
                    <select id="reorder-strategy">
                        <option value="min_bestand">Mindestbestand + Sicherheitspuffer</option>
                        <option value="economic_order_qty">Wirtschaftliche Bestellmenge (EOQ)</option>
                        <option value="fixed_qty">Feste Bestellmenge</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="safety-stock-multiplier">Sicherheitsbestand-Faktor</label>
                    <input type="number" id="safety-stock-multiplier" step="0.1" min="1" value="1.5">
                    <small>Multiplikator des Mindestbestands (z.B. 1.5 = 150%)</small>
                </div>

                <div class="form-group">
                    <label for="check-interval">Prüfintervall (Minuten)</label>
                    <input type="number" id="check-interval" step="5" min="5" value="30">
                    <small>Wie oft der Bestand auf Nachbestellbedarf geprüft wird</small>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="notify-on-reorder">
                        Benachrichtigung bei Nachbestellung
                    </label>
                </div>

                <div class="reorder-status">
                    <p><strong>Status:</strong> <span id="reorder-engine-status">Inaktiv</span></p>
                    <p><strong>Letzte Prüfung:</strong> <span id="reorder-last-check">Nie</span></p>
                    <p><strong>Nächste Prüfung:</strong> <span id="reorder-next-check">—</span></p>
                </div>

                <button class="btn btn-primary" id="btn-save-reorder-settings">Einstellungen speichern</button>
                <button class="btn btn-secondary" id="btn-test-reorder">Test durchführen</button>
                <button class="btn btn-secondary" id="btn-view-reorder-log">📊 Aktivitätsprotokoll</button>
            `;

            settingsGrid.appendChild(reorderCard);
        }
    }

    attachEventListeners() {
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-button')) {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            }
        });

        // Stock movements
        document.getElementById('btn-export-movements')?.addEventListener('click', () => {
            this.exportMovements();
        });

        // Reorder settings
        document.getElementById('btn-save-reorder-settings')?.addEventListener('click', () => {
            this.saveReorderSettings();
        });

        document.getElementById('btn-test-reorder')?.addEventListener('click', () => {
            this.testReorder();
        });

        document.getElementById('btn-view-reorder-log')?.addEventListener('click', () => {
            this.showReorderLog();
        });

        document.getElementById('auto-reorder-enabled')?.addEventListener('change', (e) => {
            this.updateAutoReorderUI(e.target.checked);
        });

        // Movement filters
        document.getElementById('movement-material-search')?.addEventListener('input', () => {
            this.refreshMovements();
        });

        document.getElementById('movement-type-filter')?.addEventListener('change', () => {
            this.refreshMovements();
        });

        document.getElementById('movement-start-date')?.addEventListener('change', () => {
            this.refreshMovements();
        });

        document.getElementById('movement-end-date')?.addEventListener('change', () => {
            this.refreshMovements();
        });

        // Initial load
        this.loadReorderSettings();
        this.refreshMovements();
        this.refreshReorderSuggestions();
    }

    // ============================================
    // Tab Management
    // ============================================

    switchTab(tabName) {
        // Update active button
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update active content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });

        this.currentTab = tabName;

        // Refresh content based on tab
        if (tabName === 'lagerbewegungen') {
            this.refreshMovements();
        } else if (tabName === 'nachbestellungen') {
            this.refreshReorderSuggestions();
        }
    }

    // ============================================
    // Stock Movements Display
    // ============================================

    refreshMovements() {
        if (!window.materialService) {return;}

        const allMovements = window.materialService.getStockMovements();
        let filtered = allMovements;

        // Apply filters
        const materialSearch = document.getElementById('movement-material-search')?.value.toLowerCase() || '';
        const typeFilter = document.getElementById('movement-type-filter')?.value || '';
        const startDate = document.getElementById('movement-start-date')?.value;
        const endDate = document.getElementById('movement-end-date')?.value;

        filtered = filtered.filter(m => {
            const material = window.materialService.getMaterial(m.materialId);
            const materialName = material ? material.bezeichnung.toLowerCase() : '';

            if (materialSearch && !materialName.includes(materialSearch)) {return false;}
            if (typeFilter && m.type !== typeFilter) {return false;}

            if (startDate) {
                const movDate = new Date(m.timestamp);
                const filterDate = new Date(startDate);
                if (movDate < filterDate) {return false;}
            }

            if (endDate) {
                const movDate = new Date(m.timestamp);
                const filterDate = new Date(endDate);
                filterDate.setDate(filterDate.getDate() + 1); // Include end date
                if (movDate > filterDate) {return false;}
            }

            return true;
        });

        // Sort by newest first
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Render
        const list = document.getElementById('movement-list');
        if (!list) {return;}

        if (filtered.length === 0) {
            list.innerHTML = '<p class="empty-state">Keine Lagerbewegungen vorhanden</p>';
            return;
        }

        list.innerHTML = filtered.map(m => {
            const material = window.materialService.getMaterial(m.materialId);
            const matName = material ? material.bezeichnung : 'Unbekannt';
            const date = new Date(m.timestamp);
            const typeLabel = this._getMovementTypeLabel(m.type);
            const direction = m.quantity > 0 ? '➕' : '➖';

            return `
                <div class="movement-item">
                    <div class="movement-header">
                        <span class="movement-date">${date.toLocaleDateString('de-DE')} ${date.toLocaleTimeString('de-DE')}</span>
                        <span class="movement-type">${typeLabel}</span>
                    </div>
                    <div class="movement-body">
                        <span class="material-name">${matName}</span>
                        <span class="movement-qty ${m.quantity > 0 ? 'positive' : 'negative'}">
                            ${direction} ${Math.abs(m.quantity)}
                        </span>
                    </div>
                    <div class="movement-footer">
                        <span class="stock-info">
                            ${m.previousStock} → ${m.newStock}
                        </span>
                        <span class="reference">${m.auftragId || '—'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    _getMovementTypeLabel(type) {
        const labels = {
            'reserved': '🔒 Reserviert',
            'released': '🔓 Freigegeben',
            'consumed': '✅ Verbraucht',
            'received': '📦 Empfangen',
            'adjusted': '📝 Korrigiert'
        };
        return labels[type] || type;
    }

    exportMovements() {
        if (!window.materialService) {return;}

        const csv = window.materialService.exportMovementsToCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `lagerbewegungen-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    // ============================================
    // Reorder Suggestions Display
    // ============================================

    refreshReorderSuggestions() {
        if (!window.reorderEngineService) {return;}

        const suggestions = window.reorderEngineService.getReorderSuggestions();
        const list = document.getElementById('reorder-list');
        if (!list) {return;}

        // Update summary
        const totalQty = suggestions.reduce((sum, s) => sum + s.suggestedQty, 0);
        const totalValue = suggestions.reduce((sum, s) => {
            return sum + (s.suggestedQty * s.material.preis);
        }, 0);

        const countEl = document.getElementById('reorder-count');
        const costEl = document.getElementById('reorder-total-cost');
        if (countEl) {countEl.textContent = suggestions.length;}
        if (costEl) {costEl.textContent = `${totalValue.toFixed(2)} €`;}

        if (suggestions.length === 0) {
            list.innerHTML = '<p class="empty-state">Alle Artikel haben ausreichend Bestand</p>';
            return;
        }

        // Group by supplier
        const bySupplier = {};
        suggestions.forEach(s => {
            const supplier = s.supplier || 'Unbekannt';
            if (!bySupplier[supplier]) {bySupplier[supplier] = [];}
            bySupplier[supplier].push(s);
        });

        list.innerHTML = Object.entries(bySupplier).map(([supplier, items]) => {
            const supplierTotal = items.reduce((sum, s) => sum + (s.suggestedQty * s.material.preis), 0);

            return `
                <div class="reorder-supplier-group">
                    <h4>${supplier}</h4>
                    <div class="reorder-items">
                        ${items.map(s => `
                            <div class="reorder-item">
                                <div class="item-info">
                                    <span class="item-name">${s.material.bezeichnung}</span>
                                    <span class="item-sku">${s.material.artikelnummer}</span>
                                </div>
                                <div class="item-stock">
                                    <span class="available">${s.availableStock} verfügbar</span>
                                    <span class="minimum">Min: ${s.reorderPoint}</span>
                                </div>
                                <div class="item-qty">
                                    <input type="number" value="${s.suggestedQty}" class="qty-input" disabled>
                                    <span class="price">${(s.suggestedQty * s.material.preis).toFixed(2)} €</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="supplier-total">
                        Gesamtwert: <strong>${supplierTotal.toFixed(2)} €</strong>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ============================================
    // Reorder Settings
    // ============================================

    loadReorderSettings() {
        if (!window.reorderEngineService) {return;}

        const settings = window.reorderEngineService.getSettings();

        const enabledCheckbox = document.getElementById('auto-reorder-enabled');
        const strategySelect = document.getElementById('reorder-strategy');
        const multiplierInput = document.getElementById('safety-stock-multiplier');
        const intervalInput = document.getElementById('check-interval');
        const notifyCheckbox = document.getElementById('notify-on-reorder');

        if (enabledCheckbox) {enabledCheckbox.checked = settings.autoReorderEnabled;}
        if (strategySelect) {strategySelect.value = settings.reorderStrategy;}
        if (multiplierInput) {multiplierInput.value = settings.safetyStockMultiplier;}
        if (intervalInput) {intervalInput.value = settings.checkIntervalMinutes;}
        if (notifyCheckbox) {notifyCheckbox.checked = settings.notifyOnReorder;}

        this.updateAutoReorderUI(settings.autoReorderEnabled);
        this.updateStatusDisplay();
    }

    saveReorderSettings() {
        if (!window.reorderEngineService) {return;}

        const updates = {
            autoReorderEnabled: document.getElementById('auto-reorder-enabled')?.checked || false,
            reorderStrategy: document.getElementById('reorder-strategy')?.value || 'min_bestand',
            safetyStockMultiplier: parseFloat(document.getElementById('safety-stock-multiplier')?.value || '1.5'),
            checkIntervalMinutes: parseInt(document.getElementById('check-interval')?.value || '30'),
            notifyOnReorder: document.getElementById('notify-on-reorder')?.checked || true
        };

        window.reorderEngineService.updateSettings(updates);

        // Enable/disable auto-reorder
        if (updates.autoReorderEnabled) {
            window.reorderEngineService.enable();
        } else {
            window.reorderEngineService.disable();
        }

        this.loadReorderSettings();

        if (window.notificationService) {
            window.notificationService.show({
                title: 'Einstellungen gespeichert',
                message: 'Nachbestellungs-Einstellungen aktualisiert',
                type: 'success'
            });
        }
    }

    updateAutoReorderUI(enabled) {
        const inputs = [
            'reorder-strategy',
            'safety-stock-multiplier',
            'check-interval',
            'notify-on-reorder'
        ];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {el.disabled = !enabled;}
        });
    }

    updateStatusDisplay() {
        if (!window.reorderEngineService) {return;}

        const settings = window.reorderEngineService.getSettings();
        const status = window.reorderEngineService.getReorderStatus();

        const statusEl = document.getElementById('reorder-engine-status');
        const lastCheckEl = document.getElementById('reorder-last-check');
        const nextCheckEl = document.getElementById('reorder-next-check');

        if (statusEl) {
            statusEl.textContent = settings.autoReorderEnabled ? '✅ Aktiv' : '❌ Inaktiv';
            statusEl.className = settings.autoReorderEnabled ? 'active' : 'inactive';
        }

        if (lastCheckEl) {
            if (status.lastCheck) {
                const date = new Date(status.lastCheck);
                lastCheckEl.textContent = date.toLocaleString('de-DE');
            } else {
                lastCheckEl.textContent = 'Nie';
            }
        }

        if (nextCheckEl) {
            if (status.nextCheck) {
                const date = new Date(status.nextCheck);
                nextCheckEl.textContent = date.toLocaleString('de-DE');
            } else {
                nextCheckEl.textContent = '—';
            }
        }
    }

    testReorder() {
        if (!window.reorderEngineService) {return;}

        const result = window.reorderEngineService.checkAndReorder();

        let message = `Prüfung abgeschlossen: ${result.created} Bestellung(en) erstellt`;
        if (result.items.length > 0) {
            message += `\n${result.items.length} Artikel unter Mindestbestand`;
        }

        if (window.notificationService) {
            window.notificationService.show({
                title: 'Nachbestellungs-Test',
                message: message,
                type: 'info'
            });
        } else {
            alert(message);
        }

        this.updateStatusDisplay();
        this.refreshReorderSuggestions();
    }

    showReorderLog() {
        if (!window.reorderEngineService) {return;}

        const stats = window.reorderEngineService.getStatistics();
        const log = window.reorderEngineService.getActivityLog().slice(0, 10);

        let html = `
            <h3>Nachbestellungs-Aktivitätsprotokoll</h3>
            <div class="stats-grid">
                <div class="stat">
                    <span class="number">${stats.totalChecks}</span>
                    <span class="label">Gesamte Prüfungen</span>
                </div>
                <div class="stat">
                    <span class="number">${stats.totalPOsCreated}</span>
                    <span class="label">Bestellungen erstellt</span>
                </div>
                <div class="stat">
                    <span class="number">${stats.totalLowStock}</span>
                    <span class="label">Bestandsmängel erkannt</span>
                </div>
                <div class="stat">
                    <span class="number">${stats.totalPOValue.toFixed(0)} €</span>
                    <span class="label">Gesamtbestellwert</span>
                </div>
            </div>
            <h4>Letzte Aktivitäten</h4>
            <table>
                <thead>
                    <tr>
                        <th>Zeitstempel</th>
                        <th>Geprüft</th>
                        <th>Mangel</th>
                        <th>Bestellungen</th>
                    </tr>
                </thead>
                <tbody>
                    ${log.map(entry => `
                        <tr>
                            <td>${new Date(entry.timestamp).toLocaleString('de-DE')}</td>
                            <td>${entry.itemsChecked}</td>
                            <td>${entry.itemsLowStock}</td>
                            <td>${entry.posCreated}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Show in a modal/dialog (you can use your own modal system)
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                ${html}
                <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">Schließen</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.reorderEngineUI = new ReorderEngineUI();
});
