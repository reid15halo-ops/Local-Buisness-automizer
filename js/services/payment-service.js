/* ============================================
   Payment Service - Deposits & Online Payments
   Collect deposits, accept Stripe/PayPal payments
   ============================================ */

class PaymentService {
    constructor() {
        this.payments = StorageUtils.getJSON('freyai_payments', [], { financial: true, service: 'paymentService' });
        this.paymentLinks = StorageUtils.getJSON('freyai_payment_links', [], { financial: true, service: 'paymentService' });
        this.settings = StorageUtils.getJSON('freyai_payment_settings', {}, { financial: true, service: 'paymentService' });

        // Default settings
        if (!this.settings.depositPercentage) {this.settings.depositPercentage = 30;}
        if (!this.settings.depositRequired) {this.settings.depositRequired = false;}
        if (!this.settings.depositThreshold) {this.settings.depositThreshold = 1000;} // Require deposit over €1000
        if (!this.settings.paymentMethods) {this.settings.paymentMethods = ['bank', 'paypal'];}
        if (!this.settings.businessName) {this.settings.businessName = 'FreyAI Visions';}
    }

    // Create a payment link for invoice/deposit
    async createPaymentLink(options) {
        try {
            if (!options || typeof options !== 'object') {
                throw new Error('Invalid payment link options');
            }

            const {
                type = 'invoice', // 'invoice', 'deposit', 'custom'
                referenceId,
                referenceType,
                amount,
                description,
                customerEmail,
                customerName,
                expiresIn = 7, // days
                invoiceObject = null // Optional: Full invoice object for Stripe
            } = options;

            if (!amount || amount <= 0) {
                throw new Error('Invalid payment amount');
            }

            const link = {
                id: 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
                type: type,
                referenceId: referenceId,
                referenceType: referenceType, // 'rechnung', 'angebot', 'termin'
                amount: amount,
                currency: 'EUR',
                description: description || `Zahlung für ${referenceType} ${referenceId}`,
                customerEmail: customerEmail,
                customerName: customerName,
                status: 'pending', // pending, paid, expired, cancelled
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString(),
                paidAt: null,
                transactionId: null,
                stripeSessionId: null,
                paymentMethod: null
            };

            // Try to generate Stripe payment link if it's an invoice
            if (type === 'invoice' && referenceType === 'rechnung' && invoiceObject && window.stripeService?.isConfigured()) {
                try {
                    const stripeResult = await window.stripeService.createPaymentLink(invoiceObject);
                    if (stripeResult.success) {
                        link.url = stripeResult.url;
                        link.stripeSessionId = stripeResult.sessionId;
                        link.paymentMethod = 'stripe';
                    } else {
                        // Fallback if Stripe fails
                        console.warn('Stripe payment link failed, using fallback:', stripeResult.error);
                        link.url = this.generatePayPalLink(amount, description, referenceId);
                        link.paymentMethod = 'paypal';
                    }
                } catch (stripeError) {
                    console.warn('Stripe integration error:', stripeError);
                    // Fallback to PayPal
                    link.url = this.generatePayPalLink(amount, description, referenceId);
                    link.paymentMethod = 'paypal';
                }
            } else {
                // Fallback: Generate PayPal payment URL
                link.url = this.generatePayPalLink(amount, description, referenceId);
            }

            link.shortUrl = `pay.local/${link.id.slice(-8)}`;

            if (this.paymentLinks) {
                this.paymentLinks.push(link);
                this.saveLinks();
            }

            return link;
        } catch (error) {
            console.error('Error creating payment link:', error);
            if (window.errorHandler) {
                window.errorHandler.handle(error, 'PaymentService.createPaymentLink', false);
            }
            throw error;
        }
    }

    // Create deposit request for appointment/order
    async createDepositRequest(reference, customerData) {
        const depositAmount = this.calculateDeposit(reference.betrag || reference.amount);

        if (depositAmount <= 0) {
            return { required: false, reason: 'Amount below threshold' };
        }

        const link = await this.createPaymentLink({
            type: 'deposit',
            referenceId: reference.id,
            referenceType: reference.type || 'termin',
            amount: depositAmount,
            description: `Anzahlung für ${reference.type || 'Termin'}: ${reference.beschreibung || reference.title}`,
            customerEmail: customerData.email,
            customerName: customerData.name,
            invoiceObject: null // Deposits don't have invoice objects
        });

        return {
            required: true,
            depositAmount: depositAmount,
            fullAmount: reference.betrag || reference.amount,
            paymentLink: link
        };
    }

    // Calculate deposit amount
    calculateDeposit(totalAmount) {
        if (!this.settings.depositRequired) {return 0;}
        if (totalAmount < this.settings.depositThreshold) {return 0;}

        return Math.round(totalAmount * (this.settings.depositPercentage / 100) * 100) / 100;
    }

    // Process payment (demo mode - would be webhook in production)
    processPayment(linkId, paymentData) {
        try {
            if (!linkId) {
                throw new Error('Payment link ID required');
            }

            const link = this.paymentLinks?.find(l => l.id === linkId);
            if (!link) {
                return { success: false, error: 'Link not found' };
            }
            if (link.status !== 'pending') {
                return { success: false, error: 'Link not active' };
            }

            // Record payment
            const payment = {
                id: 'pmt-' + Date.now(),
                paymentLinkId: linkId,
                amount: link.amount,
                currency: link.currency,
                method: paymentData?.method || 'card',
                transactionId: paymentData?.transactionId || 'tx-' + Date.now(),
                customerEmail: link.customerEmail,
                referenceId: link.referenceId,
                referenceType: link.referenceType,
                status: 'completed',
                paidAt: new Date().toISOString(),
                metadata: paymentData?.metadata || {}
            };

            if (this.payments) {
                this.payments.push(payment);
            }

            // Update link status
            link.status = 'paid';
            link.paidAt = payment.paidAt;
            link.paymentMethod = payment.method;
            link.transactionId = payment.transactionId;

            this.saveLinks();
            this.savePayments();

            // Update related invoice/booking
            this.updateReference(link);

            // Send confirmation
            this.sendPaymentConfirmation(payment);

            return { success: true, payment };
        } catch (error) {
            console.error('Error processing payment:', error);
            if (window.errorHandler) {
                window.errorHandler.handle(error, 'PaymentService.processPayment', true);
            }
            return { success: false, error: error.message };
        }
    }

    // Update the referenced document
    updateReference(link) {
        try {
            if (!link) {return;}

            if (link.referenceType === 'rechnung') {
                // Update invoice
                const storeService = window.storeService;
                if (storeService?.store?.rechnungen) {
                    try {
                        const invoice = storeService.store.rechnungen.find(r => r.id === link.referenceId);
                        if (invoice) {
                            if (link.type === 'deposit') {
                                invoice.anzahlung = link.amount;
                                invoice.anzahlungDatum = link.paidAt;
                                invoice.restbetrag = (invoice.brutto || invoice.betrag || 0) - link.amount;
                            } else {
                                invoice.status = 'bezahlt';
                                invoice.bezahltAm = link.paidAt;
                            }
                            storeService.save();
                        }
                    } catch (invoiceError) {
                        console.error('Error updating invoice:', invoiceError);
                    }
                }
            }

            if (link.referenceType === 'termin') {
                // Update appointment
                try {
                    if (window.calendarService) {
                        window.calendarService.updateAppointment(link.referenceId, {
                            depositPaid: true,
                            depositAmount: link.amount,
                            depositPaidAt: link.paidAt
                        });
                    }
                } catch (appointmentError) {
                    console.error('Error updating appointment:', appointmentError);
                }
            }
        } catch (error) {
            console.error('Error updating reference:', error);
            if (window.errorHandler) {
                window.errorHandler.handle(error, 'PaymentService.updateReference', false);
            }
        }
    }

    // Send payment confirmation
    sendPaymentConfirmation(payment) {
        try {
            if (!payment) {return;}

            console.warn(`Zahlungsbestätigung: ${this.formatCurrency(payment.amount)} von ${payment.customerEmail}`);

            if (window.communicationService) {
                try {
                    window.communicationService.logMessage({
                        type: 'email',
                        direction: 'outbound',
                        to: payment.customerEmail,
                        subject: `Zahlungsbestätigung - ${payment.referenceId}`,
                        content: `Vielen Dank für Ihre Zahlung von ${this.formatCurrency(payment.amount)}. Transaktions-ID: ${payment.transactionId}`,
                        status: 'sent'
                    });
                } catch (commError) {
                    console.error('Error logging payment confirmation:', commError);
                }
            }
        } catch (error) {
            console.error('Error sending payment confirmation:', error);
            if (window.errorHandler) {
                window.errorHandler.handle(error, 'PaymentService.sendPaymentConfirmation', false);
            }
        }
    }

    /**
     * Handle Stripe payment success callback
     * Called from index.html when user returns from Stripe Checkout with success
     * @param {string} invoiceId - Invoice ID
     * @returns {Promise<Object>} Result
     */
    async handleStripePaymentSuccess(invoiceId) {
        try {
            if (!invoiceId) {
                return { success: false, error: 'Invoice ID required' };
            }

            // Find payment link with this invoice ID
            const link = this.paymentLinks?.find(l => l.referenceId === invoiceId && l.referenceType === 'rechnung');
            if (!link) {
                // Link might not exist if created during Stripe checkout
                console.warn(`No payment link found for invoice ${invoiceId}, creating one`);
                return { success: true, message: 'Payment processed by webhook' };
            }

            // Payment confirmed by webhook (from Stripe), so just update link status
            link.status = 'paid';
            link.paidAt = new Date().toISOString();
            this.saveLinks();

            // Update invoice in store
            this.updateReference(link);

            // Send confirmation email
            const payment = {
                referenceId: invoiceId,
                customerEmail: link.customerEmail,
                amount: link.amount,
                transactionId: link.stripeSessionId
            };
            this.sendPaymentConfirmation(payment);

            return { success: true, message: 'Payment confirmed' };
        } catch (error) {
            console.error('Error handling payment success:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle Stripe payment cancellation
     * @param {string} invoiceId - Invoice ID
     * @returns {Promise<Object>} Result
     */
    async handleStripePaymentCancellation(invoiceId) {
        try {
            console.warn(`Payment cancelled for invoice ${invoiceId}`);
            // Just log - don't mark as failed since customer may retry
            return { success: true, message: 'Payment cancelled by user' };
        } catch (error) {
            console.error('Error handling payment cancellation:', error);
            return { success: false, error: error.message };
        }
    }

    // Generate PayPal payment link
    generatePayPalLink(amount, description, _invoiceId) {
        // PayPal.me link format
        const paypalUser = this.settings.paypalUser || 'freyai-service';
        return `https://paypal.me/${paypalUser}/${amount}EUR?memo=${encodeURIComponent(description)}`;
    }

    // Check for expired payment links
    checkExpiredLinks() {
        const now = new Date();
        let expiredCount = 0;

        this.paymentLinks.forEach(link => {
            const expires = StorageUtils.safeDate(link.expiresAt);
            if (link.status === 'pending' && expires && expires < now) {
                link.status = 'expired';
                expiredCount++;
            }
        });

        if (expiredCount > 0) {
            this.saveLinks();
        }

        return expiredCount;
    }

    // Get payment link by ID
    getPaymentLink(id) {
        return this.paymentLinks.find(l => l.id === id);
    }

    // Get all payment links with filters
    getPaymentLinks(filters = {}) {
        let links = [...this.paymentLinks];

        if (filters.status) {
            links = links.filter(l => l.status === filters.status);
        }
        if (filters.type) {
            links = links.filter(l => l.type === filters.type);
        }
        if (filters.referenceId) {
            links = links.filter(l => l.referenceId === filters.referenceId);
        }

        return links.sort((a, b) => (StorageUtils.safeDate(b.createdAt) || 0) - (StorageUtils.safeDate(a.createdAt) || 0));
    }

    // Get all payments
    getPayments(limit = 50) {
        return this.payments
            .sort((a, b) => (StorageUtils.safeDate(b.paidAt) || 0) - (StorageUtils.safeDate(a.paidAt) || 0))
            .slice(0, limit);
    }

    // Get payment statistics
    getStatistics() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyPayments = this.payments.filter(p => {
            const paidDate = StorageUtils.safeDate(p.paidAt);
            return paidDate && paidDate >= monthStart;
        });

        const pendingLinks = this.paymentLinks.filter(l => l.status === 'pending');
        const pendingAmount = pendingLinks.reduce((sum, l) => sum + (l.amount || 0), 0);

        return {
            totalPayments: this.payments.length,
            totalAmount: this.payments.reduce((sum, p) => sum + (p.amount || 0), 0),
            monthlyPayments: monthlyPayments.length,
            monthlyAmount: monthlyPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
            pendingLinks: pendingLinks.length,
            pendingAmount: pendingAmount,
            averagePayment: this.payments.length > 0
                ? this.payments.reduce((sum, p) => sum + (p.amount || 0), 0) / this.payments.length
                : 0
        };
    }

    // Cancel payment link
    cancelPaymentLink(id) {
        const link = this.paymentLinks.find(l => l.id === id);
        if (link && link.status === 'pending') {
            link.status = 'cancelled';
            link.cancelledAt = new Date().toISOString();
            this.saveLinks();
            return { success: true };
        }
        return { success: false, error: 'Cannot cancel' };
    }

    // Format currency
    formatCurrency(amount) {
        return window.formatCurrency(amount);
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        const ok = StorageUtils.setJSON('freyai_payment_settings', this.settings, { service: 'PaymentService' });
        if (!ok) { console.error('[PaymentService] CRITICAL: Failed to save payment settings — GoBD write failure'); }
    }

    // Persistence
    saveLinks() {
        const ok = StorageUtils.setJSON('freyai_payment_links', this.paymentLinks, { service: 'PaymentService' });
        if (!ok) { console.error('[PaymentService] CRITICAL: Failed to save payment links — GoBD write failure'); }
    }
    savePayments() {
        const ok = StorageUtils.setJSON('freyai_payments', this.payments, { service: 'PaymentService' });
        if (!ok) { console.error('[PaymentService] CRITICAL: Failed to save payments — GoBD write failure'); }
    }
}

window.paymentService = new PaymentService();
