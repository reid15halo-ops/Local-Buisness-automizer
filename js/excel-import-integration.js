/* ============================================
   Excel Import Integration
   Bindet Import-Wizard an UI-Buttons
   ============================================ */

(function() {
    'use strict';

    // Warte bis DOM geladen ist
    document.addEventListener('DOMContentLoaded', function() {
        initExcelImportButtons();
    });

    function initExcelImportButtons() {
        // Dashboard Quick-Action: Universeller Import
        const btnDashboardImport = document.getElementById('qa-excel-import');
        if (btnDashboardImport) {
            btnDashboardImport.addEventListener('click', () => {
                window.excelImportWizard.open(null, (results) => {
                    console.log('Universal-Import abgeschlossen:', results);

                    // Aktualisiere entsprechende Ansicht basierend auf importType
                    if (results.importType === 'material' && window.UI && window.UI.refreshMaterialView) {
                        window.UI.refreshMaterialView();
                    } else if (results.importType === 'kunden' && window.UI && window.UI.refreshCustomersView) {
                        window.UI.refreshCustomersView();
                    }

                    // Zeige Benachrichtigung
                    showSuccessNotification(`${results.imported} ${results.importType} importiert`);
                });
            });
        }

        // Material Import
        const btnMaterialImport = document.getElementById('btn-import-wizard-material');
        if (btnMaterialImport) {
            btnMaterialImport.addEventListener('click', () => {
                window.excelImportWizard.open('material', (results) => {
                    console.log('Material-Import abgeschlossen:', results);

                    // Aktualisiere Material-Ansicht
                    if (window.UI && window.UI.refreshMaterialView) {
                        window.UI.refreshMaterialView();
                    }

                    // Zeige Benachrichtigung
                    showSuccessNotification(`${results.imported} Materialien importiert`);
                });
            });
        }

        // Kunden Import
        const btnKundenImport = document.getElementById('btn-import-wizard-kunden');
        if (btnKundenImport) {
            btnKundenImport.addEventListener('click', () => {
                window.excelImportWizard.open('kunden', (results) => {
                    console.log('Kunden-Import abgeschlossen:', results);

                    // Aktualisiere Kunden-Ansicht
                    if (window.UI && window.UI.refreshCustomersView) {
                        window.UI.refreshCustomersView();
                    }

                    // Zeige Benachrichtigung
                    showSuccessNotification(`${results.imported} Kunden importiert`);
                });
            });
        }

        // Optional: Anfragen Import (falls später gewünscht)
        const btnAnfragenImport = document.getElementById('btn-import-wizard-anfragen');
        if (btnAnfragenImport) {
            btnAnfragenImport.addEventListener('click', () => {
                window.excelImportWizard.open('anfragen', (results) => {
                    console.log('Anfragen-Import abgeschlossen:', results);

                    // Aktualisiere Anfragen-Ansicht
                    if (window.UI && window.UI.loadAnfragen) {
                        window.UI.loadAnfragen();
                    }

                    // Zeige Benachrichtigung
                    showSuccessNotification(`${results.imported} Anfragen importiert`);
                });
            });
        }
    }

    function showSuccessNotification(message) {
        // Erstelle Benachrichtigung
        const notification = document.createElement('div');
        notification.className = 'toast-notification success';
        notification.innerHTML = `
            <div class="toast-icon">✓</div>
            <div class="toast-message">${message}</div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: var(--color-success, #10b981);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);

        // Automatisch entfernen nach 4 Sekunden
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 4000);
    }

    // Füge Refresh-Funktionen zu window.UI hinzu (falls noch nicht vorhanden)
    if (window.UI) {
        if (!window.UI.refreshMaterialView) {
            window.UI.refreshMaterialView = function() {
                // Trigger Material-View Reload
                const materialList = document.getElementById('material-list');
                if (materialList && window.materialService) {
                    const materials = window.materialService.getAllMaterials();

                    // Clear and reload
                    materialList.innerHTML = '';

                    if (materials.length === 0) {
                        materialList.innerHTML = '<p class="empty-state">Kein Material vorhanden.</p>';
                        return;
                    }

                    materials.forEach(material => {
                        const card = createMaterialCard(material);
                        materialList.appendChild(card);
                    });

                    // Update stats
                    updateMaterialStats();
                }
            };
        }

        if (!window.UI.refreshCustomersView) {
            window.UI.refreshCustomersView = function() {
                // Trigger Kunden-View Reload
                const customersList = document.getElementById('customers-list');
                if (customersList && window.customerService) {
                    const customers = window.customerService.getAllCustomers();

                    // Clear and reload
                    customersList.innerHTML = '';

                    if (customers.length === 0) {
                        customersList.innerHTML = '<p class="empty-state">Keine Kunden vorhanden.</p>';
                        return;
                    }

                    customers.forEach(customer => {
                        const card = createCustomerCard(customer);
                        customersList.appendChild(card);
                    });

                    // Update stats
                    updateCustomerStats();
                }
            };
        }
    }

    function createMaterialCard(material) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-header">
                <div>
                    <strong>${material.bezeichnung}</strong>
                    <span class="item-meta">${material.artikelnummer}</span>
                </div>
                <span class="badge">${material.kategorie}</span>
            </div>
            <div class="item-details">
                <div class="detail-row">
                    <span>Preis:</span>
                    <strong>${material.preis.toFixed(2)} €</strong>
                </div>
                <div class="detail-row">
                    <span>VK-Preis:</span>
                    <strong>${(material.vkPreis || 0).toFixed(2)} €</strong>
                </div>
                <div class="detail-row">
                    <span>Bestand:</span>
                    <strong class="${material.bestand <= material.minBestand ? 'text-warning' : ''}">${material.bestand} ${material.einheit}</strong>
                </div>
            </div>
        `;
        return card;
    }

    function createCustomerCard(customer) {
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.innerHTML = `
            <div class="customer-header">
                <h3>${customer.name}</h3>
                ${customer.firma ? `<p class="customer-firma">${customer.firma}</p>` : ''}
            </div>
            <div class="customer-contact">
                ${customer.email ? `<div>📧 ${customer.email}</div>` : ''}
                ${customer.telefon ? `<div>📞 ${customer.telefon}</div>` : ''}
            </div>
            <div class="customer-stats-inline">
                <div>Umsatz: <strong>${(customer.umsatzGesamt || 0).toFixed(2)} €</strong></div>
                <div>Aufträge: <strong>${customer.anzahlAuftraege || 0}</strong></div>
            </div>
        `;
        return card;
    }

    function updateMaterialStats() {
        if (window.materialService) {
            const materials = window.materialService.getAllMaterials();
            const totalValue = materials.reduce((sum, m) => sum + (m.preis * m.bestand), 0);
            const lowStock = window.materialService.getLowStockItems();

            document.getElementById('material-count').textContent = materials.length;
            document.getElementById('material-value').textContent = totalValue.toFixed(2) + ' €';
            document.getElementById('material-low').textContent = lowStock.length;
        }
    }

    function updateCustomerStats() {
        if (window.customerService) {
            const customers = window.customerService.getAllCustomers();
            const active = window.customerService.getActiveCustomers();

            document.getElementById('customers-total').textContent = customers.length;
            document.getElementById('customers-active').textContent = active.length;
        }
    }

})();
