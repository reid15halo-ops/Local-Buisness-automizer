/* ============================================
   Fragebogen Import UI
   Shows import preview dialog and "Import aus Aufnahmebogen"
   button inside the setup wizard.
   ============================================ */

class FragebogenImportUI {
    constructor() {
        this.service = window.fragebogenImportService;
        this.dialogEl = null;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Inject the "Import aus Aufnahmebogen" button into the setup wizard body.
     * Call this after the wizard UI has rendered its step content.
     */
    injectWizardButton() {
        const wizardBody = document.getElementById('wizard-body');
        if (!wizardBody) {return;}

        // Don't add twice
        if (document.getElementById('fragebogen-import-btn')) {return;}

        const wrapper = document.createElement('div');
        wrapper.className = 'fragebogen-overlay';

        wizardBody.appendChild(wrapper);

        document.getElementById('fragebogen-import-btn').addEventListener('click', () => {
            this.startImport();
        });
    }

    /**
     * Start the import flow: read pending data, show preview, let user confirm.
     */
    startImport() {
        if (!this.service) {
            this._showNotification('Fehler: Import-Service nicht verfügbar.', 'error');
            return;
        }

        const pendingData = this.service.getPendingImportData();
        if (!pendingData) {
            this._showNoDataDialog();
            return;
        }

        this._showPreviewDialog(pendingData);
    }

    /**
     * Auto-check for pending fragebogen import (call on app start).
     * If ?import=fragebogen is in the URL and data exists, show import dialog.
     */
    autoCheckImport() {
        if (!this.service) {return;}

        if (this.service.hasImportUrlParam() && this.service.hasPendingImport()) {
            // Small delay so app UI is ready
            setTimeout(() => {
                this.startImport();
                this.service.clearImportUrlParam();
            }, 600);
        }
    }

    // -------------------------------------------------------------------------
    // Dialogs
    // -------------------------------------------------------------------------

    /**
     * Show a dialog when no import data is found.
     * @private
     */
    _showNoDataDialog() {
        const esc = this._esc;

        this._createDialog(`
            <div style="text-align:center; padding:24px 20px;">
                <div style="font-size:38px; margin-bottom:12px;">&#128196;</div>
                <h3 style="margin:0 0 10px; font-size:17px; font-weight:700; color:#111118;">
                    Keine Import-Daten gefunden
                </h3>
                <p style="font-size:13.5px; color:#4a4a6a; line-height:1.6; margin:0 0 20px;">
                    ${esc('Bitte fülle zuerst den Betriebs-Aufnahmebogen aus und klicke dort auf "In App importieren".')}
                </p>
                <a href="fragebogen-beta-v1.html" target="_blank"
                   style="
                       display:inline-block;
                       background:#6366f1;
                       color:#fff;
                       text-decoration:none;
                       padding:9px 20px;
                       border-radius:8px;
                       font-size:13px;
                       font-weight:600;
                       margin-bottom:8px;
                   ">
                    Aufnahmebogen öffnen
                </a>
                <br>
                <button type="button" class="fragebogen-dialog-cancel"
                        style="
                            background:transparent;
                            border:1.5px solid #d1d1e0;
                            border-radius:8px;
                            padding:8px 18px;
                            font-size:13px;
                            font-weight:600;
                            color:#4a4a6a;
                            cursor:pointer;
                            margin-top:8px;
                        ">
                    Schliessen
                </button>
            </div>
        `);

        this.dialogEl.querySelector('.fragebogen-dialog-cancel')
            .addEventListener('click', () => this._closeDialog());
    }

    /**
     * Show the import preview dialog with before/after field values.
     * @private
     * @param {Object} formData
     */
    _showPreviewDialog(formData) {
        const esc = this._esc;
        const preview = this.service.getImportPreview(formData);
        const importable = preview.filter(p => p.willImport);
        const skipped = preview.filter(p => !p.willImport);

        let rowsHTML = '';
        for (const item of importable) {
            const currentDisplay = item.currentValue
                ? `<span style="color:#ef4444; text-decoration:line-through; font-size:12px;">${esc(item.currentValue)}</span><br>`
                : '';
            rowsHTML += `
                <tr>
                    <td style="padding:7px 10px; font-weight:600; font-size:13px; color:#111118; border-bottom:1px solid #eee; white-space:nowrap;">
                        ${esc(item.label)}
                    </td>
                    <td style="padding:7px 10px; font-size:13px; color:#4a4a6a; border-bottom:1px solid #eee;">
                        ${currentDisplay}
                        <span style="color:#10b981; font-weight:500;">${esc(item.fragebogenValue)}</span>
                    </td>
                </tr>
            `;
        }

        let skippedHTML = '';
        if (skipped.length > 0) {
            const skippedLabels = skipped.map(s => esc(s.label)).join(', ');
            skippedHTML = `
                <div style="font-size:12px; color:#7070a0; margin-top:10px; padding:0 4px;">
                    Nicht importiert (leer): ${skippedLabels}
                </div>
            `;
        }

        this._createDialog(`
            <div style="padding:20px;">
                <h3 style="margin:0 0 4px; font-size:17px; font-weight:700; color:#111118;">
                    Import-Vorschau
                </h3>
                <p style="font-size:13px; color:#4a4a6a; margin:0 0 16px;">
                    Folgende Daten werden aus dem Aufnahmebogen übernommen:
                </p>

                ${importable.length > 0 ? `
                    <div style="max-height:320px; overflow-y:auto; border:1px solid #e5e5ee; border-radius:8px;">
                        <table style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8f8fc;">
                                    <th style="padding:8px 10px; text-align:left; font-size:11px; font-weight:700; color:#6366f1; border-bottom:2px solid #d1d1e0;">
                                        Feld
                                    </th>
                                    <th style="padding:8px 10px; text-align:left; font-size:11px; font-weight:700; color:#6366f1; border-bottom:2px solid #d1d1e0;">
                                        Neuer Wert
                                    </th>
                                </tr>
                            </thead>
                            <tbody>${rowsHTML}</tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align:center; padding:20px; color:#7070a0; font-size:13px;">
                        Keine importierbaren Felder gefunden.
                    </div>
                `}

                ${skippedHTML}

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                    <button type="button" class="fragebogen-dialog-cancel"
                            style="
                                background:transparent;
                                border:1.5px solid #d1d1e0;
                                border-radius:8px;
                                padding:9px 20px;
                                font-size:13px;
                                font-weight:600;
                                color:#4a4a6a;
                                cursor:pointer;
                            ">
                        Abbrechen
                    </button>
                    ${importable.length > 0 ? `
                        <button type="button" class="fragebogen-dialog-confirm"
                                style="
                                    background:#6366f1;
                                    color:#fff;
                                    border:none;
                                    border-radius:8px;
                                    padding:9px 22px;
                                    font-size:13px;
                                    font-weight:600;
                                    cursor:pointer;
                                ">
                            ${esc(importable.length + ' Felder importieren')}
                        </button>
                    ` : ''}
                </div>
            </div>
        `);

        // Event listeners
        this.dialogEl.querySelector('.fragebogen-dialog-cancel')
            .addEventListener('click', () => this._closeDialog());

        const confirmBtn = this.dialogEl.querySelector('.fragebogen-dialog-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this._executeImport(formData);
            });
        }
    }

    /**
     * Execute the actual import and show success/error notification.
     * @private
     */
    _executeImport(formData) {
        this._closeDialog();

        try {
            const result = this.service.importFromFragebogen(formData);
            this.service.clearPendingImport();

            if (result.errors.length > 0) {
                const errorMessages = result.errors.map(e =>
                    typeof e === 'string' ? e : `${e.field}: ${e.reason}`
                ).join('\n');
                this._showNotification(
                    `Import teilweise erfolgreich: ${result.imported.length} Felder importiert, ${result.errors.length} Fehler.\n${errorMessages}`,
                    'warning'
                );
            } else {
                this._showNotification(
                    `Import erfolgreich! ${result.imported.length} Felder wurden übernommen.`,
                    'success'
                );
            }

            // Refresh wizard UI if open
            this._refreshWizardFields();

        } catch (e) {
            console.error('[FragebogenImportUI] Import fehlgeschlagen:', e);
            this._showNotification('Import fehlgeschlagen. Bitte versuche es erneut.', 'error');
        }
    }

    // -------------------------------------------------------------------------
    // Dialog helpers
    // -------------------------------------------------------------------------

    /**
     * Create and show a modal dialog.
     * @private
     */
    _createDialog(innerHTML) {
        this._closeDialog(); // Close any existing

        const overlay = document.createElement('div');
        overlay.id = 'fragebogen-import-dialog';
        overlay.className = 'fragebogen-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'fragebogen-dialog';
        dialog.innerHTML = innerHTML;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        this.dialogEl = overlay;

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {this._closeDialog();}
        });

        // Close on Escape
        this._escHandler = (e) => {
            if (e.key === 'Escape') {this._closeDialog();}
        };
        document.addEventListener('keydown', this._escHandler);

        // Inject animation keyframes if not already present
        if (!document.getElementById('fragebogen-import-animations')) {
            const style = document.createElement('style');
            style.id = 'fragebogen-import-animations';
            style.textContent = `
                @keyframes fragebogenFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fragebogenSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Close the current dialog.
     * @private
     */
    _closeDialog() {
        if (this.dialogEl && this.dialogEl.parentNode) {
            this.dialogEl.parentNode.removeChild(this.dialogEl);
        }
        this.dialogEl = null;

        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    }

    // -------------------------------------------------------------------------
    // Notifications
    // -------------------------------------------------------------------------

    /**
     * Show an in-app notification toast.
     * @private
     * @param {string} message
     * @param {'success'|'error'|'warning'} type
     */
    _showNotification(message, type) {
        const colors = {
            success: { bg: '#10b981', icon: '\u2713' },
            error:   { bg: '#ef4444', icon: '\u2717' },
            warning: { bg: '#f59e0b', icon: '\u26A0' }
        };
        const cfg = colors[type] || colors.success;
        const esc = this._esc;

        const toast = document.createElement('div');
        toast.className = 'toast-notification success';
        toast.textContent = message;

        document.body.appendChild(toast);

        const removeToast = () => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.2s';
                setTimeout(() => {
                    if (toast.parentNode) {toast.parentNode.removeChild(toast);}
                }, 200);
            }
        };

        toast.addEventListener('click', removeToast);
        setTimeout(removeToast, 5000);
    }

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------

    /**
     * Sanitize a string for safe HTML display.
     * Uses window.UI.sanitize if available, otherwise basic escaping.
     * @private
     * @param {string} str
     * @returns {string}
     */
    _esc(str) {
        if (!str) {return '';}
        if (window.UI && typeof window.UI.sanitize === 'function') {
            return window.UI.sanitize(str);
        }
        // Fallback basic HTML escape
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    /**
     * Refresh wizard input fields after import (re-read localStorage values).
     * @private
     */
    _refreshWizardFields() {
        const wizardBody = document.getElementById('wizard-body');
        if (!wizardBody) {return;}

        // Re-trigger wizard step rendering if available
        if (window.setupWizardUI && typeof window.setupWizardUI.updateStepContent === 'function') {
            try {
                window.setupWizardUI.updateStepContent();
                // Re-inject our button after wizard re-renders
                setTimeout(() => this.injectWizardButton(), 100);
            } catch (e) {
                console.error('[FragebogenImportUI] Wizard-Refresh fehlgeschlagen:', e);
            }
            return;
        }

        // Manual fallback: update input values directly
        const inputs = wizardBody.querySelectorAll('input[name]');
        inputs.forEach(input => {
            const stored = localStorage.getItem(input.name);
            if (stored && input.type !== 'file') {
                input.value = stored;
            }
        });
    }
}

// Global instance
window.fragebogenImportUI = new FragebogenImportUI();
