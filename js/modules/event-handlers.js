/* ============================================
   Event Delegation Module
   Centralizes all inline event handlers
   ============================================ */

(function() {
    'use strict';

    // Initialize event delegation
    function initEventDelegation() {
        // Click delegation - main handler
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) {return;}

            const action = target.dataset.action;
            const id = target.dataset.id;
            const itemId = target.dataset.itemId;
            const index = target.dataset.index;
            const value = target.dataset.value;

            handleAction(action, { id, itemId, index, value, target });
        });

        // Change delegation
        document.addEventListener('change', (e) => {
            if (e.target.matches('[data-action-change]')) {
                const action = e.target.dataset.actionChange;
                const value = e.target.value;
                const index = e.target.dataset.index;

                handleAction(action, { value, index, target: e.target });
            }
        });

        // Input delegation
        document.addEventListener('input', (e) => {
            if (e.target.matches('[data-action-input]')) {
                const action = e.target.dataset.actionInput;
                const itemId = e.target.dataset.itemId;

                handleAction(action, { itemId, target: e.target });
            }
        });
    }

    // Central action handler
    function handleAction(action, params = {}) {
        const { id, itemId, index, value, target } = params;

        try {
            switch (action) {
                // Navigation & Modal actions
                case 'open-modal-help':
                    window.UI?.openModal?.('modal-help');
                    break;
                case 'open-modal-email-test':
                    window.UI?.openModal?.('modal-test-email');
                    break;
                case 'close-modal-help':
                case 'close-modal-email-test':
                    window.UI?.closeModal?.(action.replace('close-modal-', 'modal-'));
                    break;
                case 'navigate-settings':
                    document.querySelector('.nav-item[data-view="einstellungen"]')?.click();
                    break;
                case 'navigate-auftraege':
                    window.navigationController?.navigateTo('auftraege');
                    break;
                case 'navigate-anfragen':
                    window.navigationController?.navigateTo('anfragen');
                    break;
                case 'reset-app':
                    window.UI?.resetApp();
                    break;

                // Quote/Offer actions
                case 'create-angebot-from-anfrage':
                    window.createAngebotFromAnfrage?.(id);
                    break;
                case 'accept-angebot':
                    window.acceptAngebot?.(id);
                    break;
                case 'export-angebot-pdf':
                    window.exportAngebotPDF?.(id);
                    break;

                // Position management in quote form
                case 'remove-position':
                    target.closest('.pos-row')?.remove();
                    window.updateAngebotSummary?.();
                    break;

                // Order/Auftrag actions
                case 'open-auftrag-detail':
                    window.openAuftragDetail?.(id);
                    break;
                case 'toggle-status-filter':
                    document.querySelector(`.filter-btn[data-filter="${value}"]`)?.click();
                    break;
                case 'handle-status-change':
                    window.handleStatusChange?.(value);
                    break;
                case 'confirm-status-change':
                    window.confirmStatusChange?.();
                    break;
                case 'remove-worker':
                    window.removeAuftragMitarbeiter?.(index);
                    break;

                // Checklist actions
                case 'toggle-checklist-item':
                    window.toggleChecklistItem?.(index);
                    break;
                case 'remove-checklist-item':
                    window.removeChecklistItem?.(index);
                    break;

                // Photo actions
                case 'open-photo':
                    window.open(value, '_blank');
                    break;

                // Stueckliste actions
                case 'remove-stueckliste-row':
                    window.removeStuecklisteRow?.(itemId);
                    break;

                // Invoice/Rechnung actions
                case 'download-invoice-pdf':
                    window.downloadInvoicePDF?.(id);
                    break;
                case 'generate-einvoice':
                    window.generateEInvoice?.(id);
                    break;
                case 'mark-invoice-paid':
                    window.markInvoiceAsPaid?.(id);
                    break;
                case 'show-rechnung':
                    window.showRechnung?.(id);
                    break;

                // Material actions
                case 'load-demo-materials':
                    (async () => {
                        // Guard: Require confirmation in production mode
                        if (window.demoGuardService && !window.demoGuardService.isDeveloperMode) {
                            const confirmed = await window.demoGuardService.confirmDemoLoad('Demo-Materialien laden');
                            if (!confirmed) {return;}
                        }

                        window.materialService?.loadDemoMaterials?.();
                        window.renderMaterial?.();

                        // Show demo mode banner
                        if (window.demoGuardService) {
                            window.demoGuardService.showDemoBanner();
                            window.demoGuardService.markDemoLoaded();
                        }
                    })();
                    break;
                case 'trigger-material-import':
                    document.getElementById('material-import')?.click();
                    break;

                // Mahnung (Reminder/Dunning) actions
                case 'open-mahnung-modal':
                    window.openMahnungModal?.(id);
                    break;

                // Email actions
                case 'create-task-from-email':
                    window.createTaskFromEmail?.(id);
                    break;
                case 'create-anfrage-from-email':
                    window.createAnfrageFromEmail?.(id);
                    break;
                case 'make-phone-call':
                    window.phoneService?.makeCall?.(value, itemId);
                    break;
                case 'view-quote-from-email':
                    window.viewQuoteFromEmail?.(id);
                    break;
                case 'search-result-navigate':
                    window.searchService?.navigateToResult?.(value, id, itemId);
                    break;

                // Report/Export actions
                case 'export-report-csv':
                    window.exportReportCSV?.();
                    break;

                // Stripe/Payment actions
                case 'create-checkout-session':
                    window.stripeService?.createCheckoutSession?.(value);
                    break;

                // Excel import wizard actions
                case 'wizard-close':
                    window.excelImportWizard?.close?.();
                    break;
                case 'wizard-prev-step':
                    window.excelImportWizard?.prevStep?.();
                    break;
                case 'wizard-next-step':
                    window.excelImportWizard?.nextStep?.();
                    break;

                // Toast/Notification close
                case 'close-toast':
                    target.closest('.toast')?.remove();
                    break;

                // Demo/Navigation actions
                case 'navigate-demo-home':
                    window.location.href = 'index.html';
                    break;
                case 'page-reload':
                    location.reload();
                    break;

                // Test page actions (test-invoice-system.html)
                case 'test-services':
                    window.testServices?.();
                    break;
                case 'test-number-generation':
                    window.testNumberGeneration?.();
                    break;
                case 'test-number-preview':
                    window.testNumberPreview?.();
                    break;
                case 'test-template':
                    window.testTemplate?.();
                    break;
                case 'test-pdf-generation':
                    window.testPDFGeneration?.();
                    break;
                case 'test-full-invoice':
                    window.testFullInvoice?.();
                    break;

                default:
                    console.warn(`Unknown action: ${action}`, params);
            }
        } catch (error) {
            console.error(`Error handling action "${action}":`, error);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEventDelegation);
    } else {
        initEventDelegation();
    }

    // Expose for testing
    window.EventDelegation = { handleAction, initEventDelegation };
})();
