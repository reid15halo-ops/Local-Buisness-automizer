/* ============================================
   Payment Service - Deposits & Online Payments
   Collect deposits, accept Stripe/PayPal payments
   ============================================ */

class PaymentService {
    constructor() {
        try {
            this.payments = JSON.parse(localStorage.getItem('mhs_payments') || '[]');
            this.paymentLinks = JSON.parse(localStorage.getItem('mhs_payment_links') || '[]');
            this.settings = JSON.parse(localStorage.getItem('mhs_payment_settings') || '{}');

            // Default settings
            if (!this.settings.depositPercentage) this.settings.depositPercentage = 30;
            if (!this.settings.depositRequired) this.settings.depositRequired = false;
            if (!this.settings.depositThreshold) this.settings.depositThreshold = 1000; // Require deposit over €1000
            if (!this.settings.paymentMethods) this.settings.paymentMethods = ['bank', 'paypal'];
            if (!this.settings.businessName) this.settings.businessName = 'MHS Service';
        } catch (error) {
            console.error('PaymentService initialization error:', error);
            if (window.errorHandler) {
                window.errorHandler.handle(error, 'PaymentService.constructor', false);
            }
            // Fallback to defaults
            this.payments = [];
            this.paymentLinks = [];
            this.settings = {
                depositPercentage: 30,
                depositRequired: false,
                depositThreshold: 1000,
                paymentMethods: ['bank', 'paypal'],
                businessName: 'MHS Service'
            };
        }
    }

    // Create a payment link for invoice/deposit
    createPaymentLink(options) {
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
                expiresIn = 7 // days
            } = options;

            if (!amount || amount <= 0) {
                throw new Error('Invalid payment amount');
            }

            const link = {
                id: 'pay-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
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
                paymentMethod: null,
                transactionId: null
            };

            // Generate payment URL (demo mode)
            link.url = this.generatePaymentUrl(link);
            link.shortUrl = `mhs.pay/${link.id.substr(-8)}`;

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

    // Generate payment URL (would integrate with Stripe/PayPal)
    generatePaymentUrl(link) {
        // In production: Create Stripe/PayPal payment session
        // Demo mode: Return a mock URL
        const baseUrl = window.location.origin;
        return `${baseUrl}/pay?id=${link.id}&amount=${link.amount}`;
    }

    // Create deposit request for appointment/order
    createDepositRequest(reference, customerData) {
        const depositAmount = this.calculateDeposit(reference.betrag || reference.amount);

        if (depositAmount <= 0) {
            return { required: false, reason: 'Amount below threshold' };
        }

        const link = this.createPaymentLink({
            type: 'deposit',
            referenceId: reference.id,
            referenceType: reference.type || 'termin',
            amount: depositAmount,
            description: `Anzahlung für ${reference.type || 'Termin'}: ${reference.beschreibung || reference.title}`,
            customerEmail: customerData.email,
            customerName: customerData.name
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
        if (!this.settings.depositRequired) return 0;
        if (totalAmount < this.settings.depositThreshold) return 0;

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
            if (!link) return;

            if (link.referenceType === 'rechnung') {
                // Update invoice
                if (typeof store !== 'undefined' && store?.rechnungen) {
                    try {
                        const invoice = store.rechnungen.find(r => r.id === link.referenceId);
                        if (invoice) {
                            if (link.type === 'deposit') {
                                invoice.anzahlung = link.amount;
                                invoice.anzahlungDatum = link.paidAt;
                                invoice.restbetrag = (invoice.betrag || 0) - link.amount;
                            } else {
                                invoice.status = 'bezahlt';
                                invoice.bezahltAm = link.paidAt;
                            }
                            if (typeof saveStore === 'function') saveStore();
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
            if (!payment) return;

            console.log(`💳 Zahlungsbestätigung: ${this.formatCurrency(payment.amount)} von ${payment.customerEmail}`);

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

    // Generate PayPal payment link
    generatePayPalLink(amount, description, invoiceId) {
        // PayPal.me link format
        const paypalUser = this.settings.paypalUser || 'mhs-service';
        return `https://paypal.me/${paypalUser}/${amount}EUR?memo=${encodeURIComponent(description)}`;
    }

    // Check for expired payment links
    checkExpiredLinks() {
        const now = new Date();
        let expiredCount = 0;

        this.paymentLinks.forEach(link => {
            if (link.status === 'pending' && new Date(link.expiresAt) < now) {
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

        return links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Get all payments
    getPayments(limit = 50) {
        return this.payments
            .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
            .slice(0, limit);
    }

    // Get payment statistics
    getStatistics() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyPayments = this.payments.filter(p =>
            new Date(p.paidAt) >= monthStart
        );

        const pendingLinks = this.paymentLinks.filter(l => l.status === 'pending');
        const pendingAmount = pendingLinks.reduce((sum, l) => sum + l.amount, 0);

        return {
            totalPayments: this.payments.length,
            totalAmount: this.payments.reduce((sum, p) => sum + p.amount, 0),
            monthlyPayments: monthlyPayments.length,
            monthlyAmount: monthlyPayments.reduce((sum, p) => sum + p.amount, 0),
            pendingLinks: pendingLinks.length,
            pendingAmount: pendingAmount,
            averagePayment: this.payments.length > 0
                ? this.payments.reduce((sum, p) => sum + p.amount, 0) / this.payments.length
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
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('mhs_payment_settings', JSON.stringify(this.settings));
    }

    // Persistence
    saveLinks() { localStorage.setItem('mhs_payment_links', JSON.stringify(this.paymentLinks)); }
    savePayments() { localStorage.setItem('mhs_payments', JSON.stringify(this.payments)); }
}

window.paymentService = new PaymentService();
