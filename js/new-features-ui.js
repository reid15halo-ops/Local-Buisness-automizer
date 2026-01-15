/* ============================================
   New Features UI Integration
   Workflows, Scanner, Backup UI handlers
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {

    // Initialize new views when they become active
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function () {
            const view = this.dataset.view;
            if (view === 'workflows') initWorkflowsView();
            if (view === 'scanner') initScannerView();
            if (view === 'backup') initBackupView();
        });
    });

    // =====================================================
    // WORKFLOWS VIEW
    // =====================================================

    function initWorkflowsView() {
        updateWorkflowStats();
        renderWorkflowTemplates();
        renderWorkflows();
        renderWorkflowLog();
    }

    function updateWorkflowStats() {
        if (!window.workflowService) return;
        const stats = window.workflowService.getStatistics();
        document.getElementById('workflow-total').textContent = stats.totalWorkflows;
        document.getElementById('workflow-active').textContent = stats.activeWorkflows;
        document.getElementById('workflow-runs').textContent = stats.todayExecutions;
    }

    function renderWorkflowTemplates() {
        if (!window.workflowService) return;
        const container = document.getElementById('workflow-templates');
        const templates = window.workflowService.getTemplates();

        container.innerHTML = templates.map((t, i) => `
            <div class="template-card" data-template="${i}">
                <h4>⚡ ${t.name}</h4>
                <p>${t.description}</p>
            </div>
        `).join('');

        container.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', function () {
                const idx = parseInt(this.dataset.template);
                const result = window.workflowService.createFromTemplate(idx);
                if (result.success) {
                    showNotification('Workflow erstellt: ' + result.workflow.name, 'success');
                    initWorkflowsView();
                }
            });
        });
    }

    function renderWorkflows() {
        if (!window.workflowService) return;
        const container = document.getElementById('workflows-list');
        const workflows = window.workflowService.getWorkflows();

        if (workflows.length === 0) {
            container.innerHTML = '<p class="empty-state">Noch keine Workflows erstellt.</p>';
            return;
        }

        container.innerHTML = workflows.map(w => `
            <div class="workflow-item" data-id="${w.id}">
                <div class="workflow-item-info">
                    <span style="font-size:24px">${w.active ? '✅' : '⏸️'}</span>
                    <div>
                        <h4>${w.name}</h4>
                        <p>Trigger: ${window.workflowService.triggerTypes[w.trigger.type]?.name || w.trigger.type} | Läufe: ${w.runCount}</p>
                    </div>
                </div>
                <div class="workflow-item-actions">
                    <button class="btn btn-small btn-secondary workflow-toggle" title="${w.active ? 'Deaktivieren' : 'Aktivieren'}">
                        ${w.active ? '⏸️' : '▶️'}
                    </button>
                    <button class="btn btn-small btn-primary workflow-run" title="Jetzt ausführen">🏃</button>
                    <button class="btn btn-small btn-secondary workflow-delete" title="Löschen">🗑️</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.workflow-toggle').forEach(btn => {
            btn.addEventListener('click', function () {
                const id = this.closest('.workflow-item').dataset.id;
                window.workflowService.toggleWorkflow(id);
                initWorkflowsView();
            });
        });

        container.querySelectorAll('.workflow-run').forEach(btn => {
            btn.addEventListener('click', async function () {
                const id = this.closest('.workflow-item').dataset.id;
                const result = await window.workflowService.executeWorkflow(id, { manual: true });
                showNotification(result.success ? 'Workflow ausgeführt!' : 'Fehler: ' + result.error, result.success ? 'success' : 'error');
                initWorkflowsView();
            });
        });

        container.querySelectorAll('.workflow-delete').forEach(btn => {
            btn.addEventListener('click', function () {
                if (confirm('Workflow wirklich löschen?')) {
                    const id = this.closest('.workflow-item').dataset.id;
                    window.workflowService.deleteWorkflow(id);
                    initWorkflowsView();
                }
            });
        });
    }

    function renderWorkflowLog() {
        if (!window.workflowService) return;
        const container = document.getElementById('workflow-log');
        const log = window.workflowService.getExecutionLog(null, 20);

        if (log.length === 0) {
            container.innerHTML = '<p class="empty-state">Keine Ausführungen</p>';
            return;
        }

        container.innerHTML = log.map(l => `
            <div class="log-entry">
                <span class="log-time">${new Date(l.timestamp).toLocaleTimeString('de-DE')}</span>
                <span class="log-type ${l.type}">${l.type}</span>
                <span class="log-message">${l.message}</span>
            </div>
        `).join('');
    }

    // =====================================================
    // SCANNER VIEW
    // =====================================================

    function initScannerView() {
        updateScannerStats();
        renderScannedDocs();
        setupScannerControls();
        setupDatevControls();
    }

    function updateScannerStats() {
        if (!window.ocrScannerService) return;
        const stats = window.ocrScannerService.getStatistics();
        document.getElementById('scanner-total').textContent = stats.totalDocuments;
        document.getElementById('scanner-amount').textContent = stats.totalAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        document.getElementById('scanner-pending').textContent = stats.needsManualEntry;
    }

    function renderScannedDocs() {
        if (!window.ocrScannerService) return;
        const container = document.getElementById('scanned-docs-list');
        const filter = document.getElementById('scanner-filter')?.value || '';
        const docs = window.ocrScannerService.getDocuments({ category: filter || undefined });

        if (docs.length === 0) {
            container.innerHTML = '<p class="empty-state">Noch keine Dokumente gescannt.</p>';
            return;
        }

        container.innerHTML = docs.map(doc => `
            <div class="scanned-doc-card" data-id="${doc.id}">
                ${doc.imageData ? `<img src="${doc.imageData}" class="doc-preview" alt="Preview">` : '<div class="doc-preview"></div>'}
                <h4>${doc.filename}</h4>
                <span class="doc-category">${window.ocrScannerService.getCategoryName(doc.category)}</span>
                ${doc.extractedData?.totalAmount ? `<div class="doc-amount">${doc.extractedData.totalAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>` : ''}
                <div class="doc-date">${new Date(doc.createdAt).toLocaleDateString('de-DE')}</div>
            </div>
        `).join('');
    }

    function setupScannerControls() {
        const fileInput = document.getElementById('scanner-file-input');
        const cameraBtn = document.getElementById('btn-scanner-camera');
        const filterSelect = document.getElementById('scanner-filter');

        if (fileInput) {
            fileInput.addEventListener('change', async function (e) {
                if (e.target.files.length > 0) {
                    showNotification('Dokument wird verarbeitet...', 'info');
                    const result = await window.ocrScannerService.scanFromFile(e.target.files[0]);
                    if (result.success) {
                        showNotification('Dokument gescannt: ' + result.document.category, 'success');
                        initScannerView();
                    }
                }
            });
        }

        if (cameraBtn) {
            cameraBtn.addEventListener('click', async function () {
                const panel = document.getElementById('scanner-camera-panel');
                const video = document.getElementById('scanner-video');

                panel.style.display = 'block';
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    video.srcObject = stream;
                } catch (err) {
                    showNotification('Kamera nicht verfügbar', 'error');
                    panel.style.display = 'none';
                }
            });
        }

        document.getElementById('btn-capture')?.addEventListener('click', async function () {
            const video = document.getElementById('scanner-video');
            const result = await window.ocrScannerService.scanFromCamera(video);

            // Stop camera
            video.srcObject?.getTracks().forEach(t => t.stop());
            document.getElementById('scanner-camera-panel').style.display = 'none';

            if (result.success) {
                showNotification('Foto aufgenommen!', 'success');
                initScannerView();
            }
        });

        document.getElementById('btn-cancel-camera')?.addEventListener('click', function () {
            const video = document.getElementById('scanner-video');
            video.srcObject?.getTracks().forEach(t => t.stop());
            document.getElementById('scanner-camera-panel').style.display = 'none';
        });

        if (filterSelect) {
            filterSelect.addEventListener('change', renderScannedDocs);
        }
    }

    function setupDatevControls() {
        // Set default dates
        const now = new Date();
        const year = now.getFullYear();
        document.getElementById('datev-from').value = `${year}-01-01`;
        document.getElementById('datev-to').value = now.toISOString().split('T')[0];

        document.getElementById('btn-datev-export')?.addEventListener('click', function () {
            if (!window.datevExportService) return;
            const from = document.getElementById('datev-from').value;
            const to = document.getElementById('datev-to').value;

            const result = window.datevExportService.generateExport(from, to);
            if (result.success) {
                window.datevExportService.downloadExport(result.export.id);
                showNotification('DATEV Export erstellt!', 'success');
            } else {
                showNotification(result.error, 'error');
            }
        });

        document.getElementById('btn-euer-report')?.addEventListener('click', function () {
            if (!window.datevExportService) return;
            const year = new Date().getFullYear();
            const report = window.datevExportService.generateEuerText(year);
            document.getElementById('datev-result').textContent = report;
        });
    }

    // =====================================================
    // BACKUP VIEW
    // =====================================================

    function initBackupView() {
        updateBackupStats();
        renderAutoBackups();
        renderActivityLog();
        setupBackupControls();
        populateCustomerSelects();
    }

    function updateBackupStats() {
        if (!window.securityBackupService) return;
        const usage = window.securityBackupService.getStorageUsage();
        const backups = window.securityBackupService.getBackupHistory();
        const log = window.securityBackupService.getActivityLog(100);

        document.getElementById('storage-used').textContent = usage.mhsMB + ' MB';
        document.getElementById('backup-count').textContent = backups.length;
        document.getElementById('activity-count').textContent = log.length;
    }

    function renderAutoBackups() {
        if (!window.securityBackupService) return;
        const container = document.getElementById('auto-backups-list');
        const backups = window.securityBackupService.getAutoBackups();

        if (backups.length === 0) {
            container.innerHTML = '<p class="empty-state">Keine Auto-Backups vorhanden</p>';
            return;
        }

        container.innerHTML = backups.map(b => `
            <div class="auto-backup-item">
                <span>📦 ${new Date(b.createdAt).toLocaleString('de-DE')}</span>
                <span>${(b.data.length / 1024).toFixed(1)} KB</span>
            </div>
        `).join('');
    }

    function renderActivityLog() {
        if (!window.securityBackupService) return;
        const container = document.getElementById('security-activity-log');
        const log = window.securityBackupService.getActivityLog(20);

        if (log.length === 0) {
            container.innerHTML = '<p class="empty-state">Keine Aktivitäten protokolliert</p>';
            return;
        }

        container.innerHTML = log.map(l => `
            <div class="activity-log-item">
                <span class="log-time">${new Date(l.timestamp).toLocaleTimeString('de-DE')}</span>
                <span>${l.action}</span>
                <span style="color:var(--text-muted)">${JSON.stringify(l.details).slice(0, 50)}</span>
            </div>
        `).join('');
    }

    function setupBackupControls() {
        document.getElementById('btn-create-backup')?.addEventListener('click', async function () {
            const password = document.getElementById('backup-password').value || null;
            showNotification('Backup wird erstellt...', 'info');
            const result = await window.securityBackupService.downloadBackup(password);
            showNotification(result.success ? 'Backup heruntergeladen!' : result.error, result.success ? 'success' : 'error');
            initBackupView();
        });

        document.getElementById('btn-restore-backup')?.addEventListener('click', async function () {
            const fileInput = document.getElementById('backup-file-input');
            const password = document.getElementById('restore-password').value || null;

            if (!fileInput.files.length) {
                showNotification('Bitte Backup-Datei auswählen', 'warning');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const result = await window.securityBackupService.restoreBackup(e.target.result, password);
                if (result.success) {
                    showNotification(result.message, 'success');
                    if (result.needsReload) {
                        setTimeout(() => location.reload(), 2000);
                    }
                } else {
                    showNotification(result.error, 'error');
                }
            };
            reader.readAsText(fileInput.files[0]);
        });

        document.getElementById('auto-backup-enabled')?.addEventListener('change', function () {
            window.securityBackupService.updateSettings({ autoBackup: this.checked });
        });

        document.getElementById('backup-interval')?.addEventListener('change', function () {
            window.securityBackupService.updateSettings({ backupInterval: this.value });
        });
    }

    function populateCustomerSelects() {
        const customers = window.customerService?.getCustomers() || [];
        const options = customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        const gdprExport = document.getElementById('gdpr-customer-select');
        const gdprDelete = document.getElementById('gdpr-delete-select');

        if (gdprExport) gdprExport.innerHTML = '<option value="">Kunde wählen...</option>' + options;
        if (gdprDelete) gdprDelete.innerHTML = '<option value="">Kunde wählen...</option>' + options;
    }

    document.getElementById('btn-gdpr-export')?.addEventListener('click', function () {
        const customerId = document.getElementById('gdpr-customer-select').value;
        if (!customerId) {
            showNotification('Bitte Kunde auswählen', 'warning');
            return;
        }
        const data = window.securityBackupService.exportCustomerData(customerId);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DSGVO_Export_${customerId}.json`;
        a.click();
        showNotification('Kundendaten exportiert!', 'success');
    });

    document.getElementById('btn-gdpr-delete')?.addEventListener('click', function () {
        const customerId = document.getElementById('gdpr-delete-select').value;
        if (!customerId) {
            showNotification('Bitte Kunde auswählen', 'warning');
            return;
        }
        if (confirm('ACHTUNG: Alle Daten dieses Kunden werden unwiderruflich gelöscht! Fortfahren?')) {
            const result = window.securityBackupService.deleteCustomerData(customerId);
            showNotification(`${result.deletedCount} Datensätze gelöscht`, 'success');
            populateCustomerSelects();
        }
    });

    // =====================================================
    // NOTIFICATIONS
    // =====================================================

    function showNotification(message, type = 'info') {
        // Use existing notification system or create simple alert
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            // Simple visual notification
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.style.cssText = `
                position: fixed; bottom: 20px; right: 20px; padding: 16px 24px;
                background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#6366f1'};
                color: white; border-radius: 8px; z-index: 9999; font-size: 14px;
                animation: fadeIn 0.3s ease;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }
});
