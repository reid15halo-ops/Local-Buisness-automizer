/**
 * Invoice Payment Integration Module
 * Provides utilities for integrating Stripe payment links into invoice UI
 *
 * Usage:
 * - Call initPaymentHandling() to set up button listeners
 * - Use createAndSharePaymentLink() to generate payment links
 * - Handle payment success via URL parameters
 */

class InvoicePaymentIntegration {
    constructor() {
        this.paymentInProgress = new Map(); // Track ongoing payments
    }

    /**
     * Initialize payment button listeners for invoices
     * Call this when invoice list is rendered
     */
    initPaymentHandling() {
        // Listen for send payment link button clicks
        document.addEventListener('click', async (e) => {
            if (e.target.closest('[data-action="send-payment-link"]')) {
                const invoiceId = e.target.closest('[data-action="send-payment-link"]').dataset.invoiceId;
                await this.handleSendPaymentLink(invoiceId);
            }

            if (e.target.closest('[data-action="open-payment"]')) {
                const invoiceId = e.target.closest('[data-action="open-payment"]').dataset.invoiceId;
                await this.handleOpenPayment(invoiceId);
            }
        });

        // Check for payment success on page load
        this.checkPaymentCallback();
    }

    /**
     * Check if user is returning from Stripe Checkout
     */
    checkPaymentCallback() {
        const params = new URLSearchParams(window.location.search);
        const payment = params.get('payment');
        const invoiceId = params.get('invoice');

        if (!payment || !invoiceId) {
            return;
        }

        if (payment === 'success') {
            this.handlePaymentSuccess(invoiceId);
        } else if (payment === 'cancelled') {
            this.handlePaymentCancelled(invoiceId);
        }

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    /**
     * Handle payment success callback
     */
    async handlePaymentSuccess(invoiceId) {
        try {
            if (!window.paymentService) {
                console.warn('Payment service not available');
                return;
            }

            // Mark invoice as paid in store
            if (window.invoiceService) {
                try {
                    await window.invoiceService.markAsPaid(invoiceId, { method: 'Stripe' });
                } catch (e) {
                    console.warn('invoiceService.markAsPaid failed:', e);
                    // Fallback: update store directly
                    const invoice = this.getInvoiceById(invoiceId);
                    if (invoice) {
                        invoice.status = 'bezahlt';
                        invoice.paidAt = new Date().toISOString();
                        invoice.paymentMethod = 'Stripe';
                        window.storeService?.save();
                    }
                }
            } else {
                // No invoiceService - update store directly
                const invoice = this.getInvoiceById(invoiceId);
                if (invoice) {
                    invoice.status = 'bezahlt';
                    invoice.paidAt = new Date().toISOString();
                    invoice.paymentMethod = 'Stripe';
                    window.storeService?.save();
                }
            }

            // Notify user
            this.showNotification('Zahlung erfolgreich!', 'success', 'Die Rechnung wurde als bezahlt markiert.');

            // Update invoice in UI
            const invoiceRow = document.querySelector(`[data-invoice-id="${invoiceId}"]`);
            if (invoiceRow) {
                invoiceRow.classList.add('paid');
                const statusCell = invoiceRow.querySelector('[data-field="status"]');
                if (statusCell) {
                    statusCell.textContent = 'bezahlt';
                    statusCell.classList.add('status-paid');
                }
            }

            // Trigger any payment success handlers
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('invoice:payment:success', {
                    detail: { invoiceId }
                }));
            }
        } catch (error) {
            console.error('Payment success handling failed:', error);
            this.showNotification('Fehler', 'error', 'Zahlung konnte nicht verarbeitet werden: ' + error.message);
        }
    }

    /**
     * Handle payment cancellation
     */
    async handlePaymentCancelled(invoiceId) {
        this.showNotification(
            'Zahlung abgebrochen',
            'info',
            'Sie können jederzeit einen neuen Zahlungslink anfordern.'
        );

        // Trigger any cancellation handlers
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('invoice:payment:cancelled', {
                detail: { invoiceId }
            }));
        }
    }

    /**
     * Send payment link via email (or copy to clipboard)
     */
    async handleSendPaymentLink(invoiceId) {
        try {
            const invoice = this.getInvoiceById(invoiceId);
            if (!invoice) {
                throw new Error('Invoice not found');
            }

            this.showNotification('', 'loading', 'Zahlungslink wird generiert...');

            // Create payment link with Stripe integration
            const paymentLink = await window.paymentService.createPaymentLink({
                type: 'invoice',
                referenceId: invoice.id,
                referenceType: 'rechnung',
                amount: invoice.betrag || invoice.amount,
                description: `Rechnung ${invoice.nummer}`,
                customerEmail: invoice.kunde?.email,
                customerName: invoice.kunde?.name,
                invoiceObject: invoice
            });

            if (!paymentLink) {
                throw new Error('Failed to create payment link');
            }

            // Copy to clipboard
            const url = paymentLink.url;
            await navigator.clipboard.writeText(url);

            this.showNotification(
                'Zahlungslink kopiert!',
                'success',
                `Link wurde in die Zwischenablage kopiert. Sende ihn an ${invoice.kunde?.email || 'Kunde'}`
            );

            // Try to open email if available
            if (window.communicationService) {
                try {
                    window.communicationService.logMessage({
                        type: 'email',
                        direction: 'outbound',
                        to: invoice.kunde?.email,
                        subject: `Zahlungslink für Rechnung ${invoice.nummer}`,
                        body: `Lieber Kunde,\n\nanbei erhalten Sie einen Zahlungslink für Ihre Rechnung ${invoice.nummer}:\n\n${url}\n\nMit freundlichen Grüßen`,
                        status: 'draft'
                    });
                } catch (emailError) {
                    console.warn('Email logging failed:', emailError);
                }
            }

            // Trigger event
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('invoice:payment-link:created', {
                    detail: { invoiceId, paymentLink }
                }));
            }
        } catch (error) {
            console.error('Payment link creation failed:', error);
            this.showNotification(
                'Fehler',
                'error',
                `Zahlungslink konnte nicht generiert werden: ${error.message}`
            );
        }
    }

    /**
     * Open Stripe Checkout in new window
     */
    async handleOpenPayment(invoiceId) {
        try {
            const invoice = this.getInvoiceById(invoiceId);
            if (!invoice) {
                throw new Error('Rechnung nicht gefunden');
            }

            if (!window.stripeService?.isConfigured()) {
                throw new Error('Stripe nicht konfiguriert');
            }

            this.showNotification('', 'loading', 'Öffne Zahlungsseite...');

            // Open checkout
            const result = await window.stripeService.openPaymentCheckout(invoice);

            if (result.success) {
                this.showNotification(
                    'Checkout geöffnet',
                    'success',
                    'Zahlungsseite wurde in neuem Fenster geöffnet'
                );
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Payment checkout failed:', error);
            this.showNotification(
                'Fehler',
                'error',
                error.message || 'Zahlung konnte nicht gestartet werden'
            );
        }
    }

    /**
     * Get invoice by ID from store
     */
    getInvoiceById(invoiceId) {
        if (typeof store !== 'undefined' && store.rechnungen) {
            return store.rechnungen.find(r => r.id === invoiceId);
        }
        return null;
    }

    /**
     * Create payment buttons for invoice row
     * Use in invoice list templates
     */
    createPaymentButtons(invoice) {
        const isPaid = invoice.status === 'bezahlt';

        if (isPaid) {
            return `
                <div class="payment-status paid">
                    <span class="badge badge-success">Bezahlt</span>
                </div>
            `;
        }

        const stripeAvailable = window.stripeService?.isConfigured();

        return `
            <div class="payment-actions">
                ${stripeAvailable ? `
                    <button class="btn btn-small btn-primary"
                        data-action="open-payment"
                        data-invoice-id="${invoice.id}"
                        title="Zahlungsseite in neuem Fenster öffnen">
                        💳 Zahlen
                    </button>
                ` : ''}
                <button class="btn btn-small btn-secondary"
                    data-action="send-payment-link"
                    data-invoice-id="${invoice.id}"
                    title="Zahlungslink kopieren und per Email versenden">
                    🔗 Link
                </button>
            </div>
        `;
    }

    /**
     * Show notification (requires notification service)
     */
    showNotification(title, type = 'info', message = '') {
        if (window.notificationService) {
            window.notificationService.show({
                title,
                message,
                type,
                duration: type === 'loading' ? 0 : 4000
            });
        } else {
            // Fallback
            if (type === 'error') {
                console.error(`${title}: ${message}`);
                alert(`${title}\n\n${message}`);
            } else if (type !== 'loading') {
                console.log(`${title}: ${message}`);
            }
        }
    }

    /**
     * Get payment statistics for dashboard
     */
    async getPaymentStats() {
        if (!window.paymentService) {
            return null;
        }

        const stats = window.paymentService.getStatistics();
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Add invoice status breakdown
        let paidInvoices = 0;
        let pendingInvoices = 0;
        let totalInvoiceAmount = 0;

        if (typeof store !== 'undefined' && store.rechnungen) {
            store.rechnungen.forEach(invoice => {
                totalInvoiceAmount += invoice.betrag || 0;
                if (invoice.status === 'bezahlt') {
                    paidInvoices++;
                } else {
                    pendingInvoices++;
                }
            });
        }

        return {
            ...stats,
            paidInvoices,
            pendingInvoices,
            totalInvoiceAmount,
            paymentRate: paidInvoices / (paidInvoices + pendingInvoices) || 0
        };
    }

    /**
     * Format currency for display
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }
}

// Global instance
window.invoicePaymentIntegration = new InvoicePaymentIntegration();

// Auto-initialize on document ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.invoicePaymentIntegration.initPaymentHandling();
    });
} else {
    window.invoicePaymentIntegration.initPaymentHandling();
}
