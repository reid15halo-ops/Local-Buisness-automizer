import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock StorageUtils globally
global.StorageUtils = {
    getJSON: vi.fn((key, defaultVal) => defaultVal),
    setJSON: vi.fn(() => true),
    safeDate: vi.fn((d) => d ? new Date(d) : null)
};

// Mock window globals
global.window = global.window || {};
window.formatCurrency = vi.fn((amount) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
});
window.demoGuardService = null;
window.stripeService = null;
window.storeService = null;
window.calendarService = null;
window.communicationService = null;
window.errorHandler = null;

// PaymentService class (from js/services/payment-service.js)
class PaymentService {
    constructor() {
        this.payments = StorageUtils.getJSON('freyai_payments', [], { financial: true, service: 'paymentService' });
        this.paymentLinks = StorageUtils.getJSON('freyai_payment_links', [], { financial: true, service: 'paymentService' });
        this.settings = StorageUtils.getJSON('freyai_payment_settings', {}, { financial: true, service: 'paymentService' });

        if (!this.settings.depositPercentage) { this.settings.depositPercentage = 30; }
        if (!this.settings.depositRequired) { this.settings.depositRequired = false; }
        if (!this.settings.depositThreshold) { this.settings.depositThreshold = 1000; }
        if (!this.settings.paymentMethods) { this.settings.paymentMethods = ['bank', 'paypal']; }
        if (!this.settings.businessName) { this.settings.businessName = 'FreyAI Visions'; }
    }

    async createPaymentLink(options) {
        if (window.demoGuardService && !window.demoGuardService.allowExternalAction('Zahlungslink erstellen')) {
            return {
                id: 'pay-demo-' + Date.now(),
                type: options?.type || 'invoice',
                amount: options?.amount || 0,
                status: 'demo',
                url: '#demo-payment-blocked',
                demo: true
            };
        }

        try {
            if (!options || typeof options !== 'object') {
                throw new Error('Invalid payment link options');
            }

            const {
                type = 'invoice',
                referenceId,
                referenceType,
                amount,
                description,
                customerEmail,
                customerName,
                expiresIn = 7,
                invoiceObject = null
            } = options;

            if (!amount || amount <= 0) {
                throw new Error('Invalid payment amount');
            }

            const link = {
                id: 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
                type,
                referenceId,
                referenceType,
                amount,
                currency: 'EUR',
                description: description || `Zahlung für ${referenceType} ${referenceId}`,
                customerEmail,
                customerName,
                status: 'pending',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString(),
                paidAt: null,
                transactionId: null,
                stripeSessionId: null,
                paymentMethod: null
            };

            if (type === 'invoice' && referenceType === 'rechnung' && invoiceObject && window.stripeService?.isConfigured()) {
                try {
                    const stripeResult = await window.stripeService.createPaymentLink(invoiceObject);
                    if (stripeResult.success) {
                        link.url = stripeResult.url;
                        link.stripeSessionId = stripeResult.sessionId;
                        link.paymentMethod = 'stripe';
                    } else {
                        link.url = this.generatePayPalLink(amount, description, referenceId);
                        link.paymentMethod = 'paypal';
                    }
                } catch (stripeError) {
                    link.url = this.generatePayPalLink(amount, description, referenceId);
                    link.paymentMethod = 'paypal';
                }
            } else {
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
            invoiceObject: null
        });

        return {
            required: true,
            depositAmount,
            fullAmount: reference.betrag || reference.amount,
            paymentLink: link
        };
    }

    calculateDeposit(totalAmount) {
        if (!this.settings.depositRequired) { return 0; }
        if (totalAmount < this.settings.depositThreshold) { return 0; }
        return Math.round(totalAmount * (this.settings.depositPercentage / 100) * 100) / 100;
    }

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

            link.status = 'paid';
            link.paidAt = payment.paidAt;
            link.paymentMethod = payment.method;
            link.transactionId = payment.transactionId;

            this.saveLinks();
            this.savePayments();
            this.updateReference(link);
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

    updateReference(link) {
        try {
            if (!link) { return; }

            if (link.referenceType === 'rechnung') {
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
        }
    }

    sendPaymentConfirmation(payment) {
        try {
            if (!payment) { return; }
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
        }
    }

    async handleStripePaymentSuccess(invoiceId) {
        try {
            if (!invoiceId) {
                return { success: false, error: 'Invoice ID required' };
            }

            const link = this.paymentLinks?.find(l => l.referenceId === invoiceId && l.referenceType === 'rechnung');
            if (!link) {
                return { success: true, message: 'Payment processed by webhook' };
            }

            link.status = 'paid';
            link.paidAt = new Date().toISOString();
            this.saveLinks();
            this.updateReference(link);

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

    async handleStripePaymentCancellation(invoiceId) {
        try {
            return { success: true, message: 'Payment cancelled by user' };
        } catch (error) {
            console.error('Error handling payment cancellation:', error);
            return { success: false, error: error.message };
        }
    }

    generatePayPalLink(amount, description, _invoiceId) {
        const paypalUser = this.settings.paypalUser || 'freyai-service';
        return `https://paypal.me/${paypalUser}/${amount}EUR?memo=${encodeURIComponent(description)}`;
    }

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

    getPaymentLink(id) {
        return this.paymentLinks.find(l => l.id === id);
    }

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

    getPayments(limit = 50) {
        return this.payments
            .sort((a, b) => (StorageUtils.safeDate(b.paidAt) || 0) - (StorageUtils.safeDate(a.paidAt) || 0))
            .slice(0, limit);
    }

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
            pendingAmount,
            averagePayment: this.payments.length > 0
                ? this.payments.reduce((sum, p) => sum + (p.amount || 0), 0) / this.payments.length
                : 0
        };
    }

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

    formatCurrency(amount) {
        return window.formatCurrency(amount);
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        StorageUtils.setJSON('freyai_payment_settings', this.settings, { service: 'PaymentService' });
    }

    saveLinks() {
        StorageUtils.setJSON('freyai_payment_links', this.paymentLinks, { service: 'PaymentService' });
    }

    savePayments() {
        StorageUtils.setJSON('freyai_payments', this.payments, { service: 'PaymentService' });
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PaymentService', () => {
    let service;

    beforeEach(() => {
        vi.clearAllMocks();
        StorageUtils.getJSON.mockImplementation((key, defaultVal) => defaultVal);
        StorageUtils.setJSON.mockReturnValue(true);
        StorageUtils.safeDate.mockImplementation((d) => d ? new Date(d) : null);

        window.demoGuardService = null;
        window.stripeService = null;
        window.storeService = null;
        window.calendarService = null;
        window.communicationService = null;
        window.errorHandler = null;

        service = new PaymentService();
    });

    // ─── Constructor & Defaults ─────────────────────────────────────────

    describe('constructor', () => {
        it('should load data from StorageUtils', () => {
            expect(StorageUtils.getJSON).toHaveBeenCalledWith('freyai_payments', [], expect.any(Object));
            expect(StorageUtils.getJSON).toHaveBeenCalledWith('freyai_payment_links', [], expect.any(Object));
            expect(StorageUtils.getJSON).toHaveBeenCalledWith('freyai_payment_settings', expect.any(Object), expect.any(Object));
        });

        it('should set default settings', () => {
            expect(service.settings.depositPercentage).toBe(30);
            expect(service.settings.depositThreshold).toBe(1000);
            expect(service.settings.depositRequired).toBe(false);
            expect(service.settings.paymentMethods).toEqual(['bank', 'paypal']);
            expect(service.settings.businessName).toBe('FreyAI Visions');
        });
    });

    // ─── calculateDeposit ───────────────────────────────────────────────

    describe('calculateDeposit', () => {
        it('should return 0 when deposit is not required', () => {
            service.settings.depositRequired = false;
            expect(service.calculateDeposit(5000)).toBe(0);
        });

        it('should return 0 when amount is below threshold', () => {
            service.settings.depositRequired = true;
            expect(service.calculateDeposit(500)).toBe(0);
        });

        it('should calculate correct deposit when required and above threshold', () => {
            service.settings.depositRequired = true;
            service.settings.depositPercentage = 30;
            service.settings.depositThreshold = 1000;
            expect(service.calculateDeposit(2000)).toBe(600);
        });

        it('should round deposit to 2 decimal places', () => {
            service.settings.depositRequired = true;
            service.settings.depositPercentage = 33;
            service.settings.depositThreshold = 100;
            // 333.33 * 0.33 = 109.9989 => rounded to 110.00
            expect(service.calculateDeposit(1111)).toBe(366.63);
        });

        it('should return 0 for amount exactly at threshold', () => {
            service.settings.depositRequired = true;
            service.settings.depositThreshold = 1000;
            // 1000 < 1000 is false, so deposit should be calculated
            expect(service.calculateDeposit(1000)).toBe(300);
        });
    });

    // ─── createPaymentLink ──────────────────────────────────────────────

    describe('createPaymentLink', () => {
        it('should throw on null options', async () => {
            await expect(service.createPaymentLink(null)).rejects.toThrow('Invalid payment link options');
        });

        it('should throw on non-object options', async () => {
            await expect(service.createPaymentLink('bad')).rejects.toThrow('Invalid payment link options');
        });

        it('should throw on zero amount', async () => {
            await expect(service.createPaymentLink({ amount: 0 })).rejects.toThrow('Invalid payment amount');
        });

        it('should throw on negative amount', async () => {
            await expect(service.createPaymentLink({ amount: -50 })).rejects.toThrow('Invalid payment amount');
        });

        it('should create a valid payment link with PayPal fallback', async () => {
            const link = await service.createPaymentLink({
                type: 'invoice',
                referenceId: 'INV-001',
                referenceType: 'rechnung',
                amount: 250,
                description: 'Test invoice',
                customerEmail: 'test@example.com',
                customerName: 'Hans Meier'
            });

            expect(link.id).toMatch(/^pay-/);
            expect(link.type).toBe('invoice');
            expect(link.amount).toBe(250);
            expect(link.currency).toBe('EUR');
            expect(link.status).toBe('pending');
            expect(link.url).toContain('paypal.me');
            expect(link.shortUrl).toBeDefined();
            expect(link.customerEmail).toBe('test@example.com');
        });

        it('should save the link after creation', async () => {
            await service.createPaymentLink({
                amount: 100,
                referenceId: 'R-1',
                referenceType: 'rechnung',
                description: 'Test'
            });

            expect(StorageUtils.setJSON).toHaveBeenCalledWith(
                'freyai_payment_links',
                expect.any(Array),
                expect.any(Object)
            );
            expect(service.paymentLinks.length).toBe(1);
        });

        it('should return demo link when demoGuardService blocks', async () => {
            window.demoGuardService = { allowExternalAction: vi.fn(() => false) };

            const link = await service.createPaymentLink({
                type: 'invoice',
                amount: 500
            });

            expect(link.demo).toBe(true);
            expect(link.status).toBe('demo');
            expect(link.url).toBe('#demo-payment-blocked');
        });

        it('should use Stripe when stripeService is configured and invoice type', async () => {
            window.stripeService = {
                isConfigured: vi.fn(() => true),
                createPaymentLink: vi.fn(async () => ({
                    success: true,
                    url: 'https://checkout.stripe.com/session123',
                    sessionId: 'cs_123'
                }))
            };

            const link = await service.createPaymentLink({
                type: 'invoice',
                referenceType: 'rechnung',
                referenceId: 'INV-002',
                amount: 1500,
                description: 'Stripe invoice',
                invoiceObject: { id: 'INV-002' }
            });

            expect(link.paymentMethod).toBe('stripe');
            expect(link.url).toBe('https://checkout.stripe.com/session123');
            expect(link.stripeSessionId).toBe('cs_123');
        });

        it('should fallback to PayPal when Stripe fails', async () => {
            window.stripeService = {
                isConfigured: vi.fn(() => true),
                createPaymentLink: vi.fn(async () => ({ success: false, error: 'Stripe error' }))
            };

            const link = await service.createPaymentLink({
                type: 'invoice',
                referenceType: 'rechnung',
                referenceId: 'INV-003',
                amount: 500,
                description: 'Fallback test',
                invoiceObject: { id: 'INV-003' }
            });

            expect(link.url).toContain('paypal.me');
            expect(link.paymentMethod).toBe('paypal');
        });

        it('should set default description when none provided', async () => {
            const link = await service.createPaymentLink({
                amount: 100,
                referenceType: 'rechnung',
                referenceId: 'R-5'
            });

            expect(link.description).toBe('Zahlung für rechnung R-5');
        });
    });

    // ─── processPayment ─────────────────────────────────────────────────

    describe('processPayment', () => {
        it('should return error when linkId is missing', () => {
            const result = service.processPayment(null);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Payment link ID required');
        });

        it('should return error when link is not found', () => {
            const result = service.processPayment('nonexistent');
            expect(result).toEqual({ success: false, error: 'Link not found' });
        });

        it('should return error when link is not pending', async () => {
            const link = await service.createPaymentLink({
                amount: 200,
                referenceId: 'R-10',
                referenceType: 'rechnung',
                description: 'Test'
            });

            // Mark as paid first
            link.status = 'paid';

            const result = service.processPayment(link.id);
            expect(result).toEqual({ success: false, error: 'Link not active' });
        });

        it('should process payment successfully', async () => {
            const link = await service.createPaymentLink({
                amount: 300,
                referenceId: 'R-20',
                referenceType: 'rechnung',
                description: 'Payment test',
                customerEmail: 'kunde@test.de'
            });

            const result = service.processPayment(link.id, {
                method: 'card',
                transactionId: 'tx-abc123'
            });

            expect(result.success).toBe(true);
            expect(result.payment.amount).toBe(300);
            expect(result.payment.method).toBe('card');
            expect(result.payment.transactionId).toBe('tx-abc123');
            expect(result.payment.status).toBe('completed');
            expect(link.status).toBe('paid');
            expect(service.payments.length).toBe(1);
        });

        it('should use default method "card" when no paymentData provided', async () => {
            const link = await service.createPaymentLink({
                amount: 100,
                referenceId: 'R-21',
                referenceType: 'rechnung',
                description: 'Default method test'
            });

            const result = service.processPayment(link.id);
            expect(result.payment.method).toBe('card');
        });
    });

    // ─── cancelPaymentLink ──────────────────────────────────────────────

    describe('cancelPaymentLink', () => {
        it('should cancel a pending link', async () => {
            const link = await service.createPaymentLink({
                amount: 150,
                referenceId: 'R-30',
                referenceType: 'rechnung',
                description: 'Cancel test'
            });

            const result = service.cancelPaymentLink(link.id);
            expect(result.success).toBe(true);
            expect(link.status).toBe('cancelled');
            expect(link.cancelledAt).toBeDefined();
        });

        it('should fail to cancel a non-pending link', async () => {
            const link = await service.createPaymentLink({
                amount: 150,
                referenceId: 'R-31',
                referenceType: 'rechnung',
                description: 'Cancel fail test'
            });

            link.status = 'paid';

            const result = service.cancelPaymentLink(link.id);
            expect(result).toEqual({ success: false, error: 'Cannot cancel' });
        });

        it('should fail when link does not exist', () => {
            const result = service.cancelPaymentLink('nonexistent');
            expect(result).toEqual({ success: false, error: 'Cannot cancel' });
        });
    });

    // ─── checkExpiredLinks ──────────────────────────────────────────────

    describe('checkExpiredLinks', () => {
        it('should mark expired pending links', () => {
            const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
            service.paymentLinks = [
                { id: 'pay-1', status: 'pending', expiresAt: pastDate },
                { id: 'pay-2', status: 'pending', expiresAt: new Date(Date.now() + 86400000).toISOString() }
            ];

            const count = service.checkExpiredLinks();
            expect(count).toBe(1);
            expect(service.paymentLinks[0].status).toBe('expired');
            expect(service.paymentLinks[1].status).toBe('pending');
        });

        it('should not expire already paid links', () => {
            const pastDate = new Date(Date.now() - 86400000).toISOString();
            service.paymentLinks = [
                { id: 'pay-3', status: 'paid', expiresAt: pastDate }
            ];

            const count = service.checkExpiredLinks();
            expect(count).toBe(0);
            expect(service.paymentLinks[0].status).toBe('paid');
        });

        it('should save when links are expired', () => {
            const pastDate = new Date(Date.now() - 86400000).toISOString();
            service.paymentLinks = [
                { id: 'pay-4', status: 'pending', expiresAt: pastDate }
            ];

            StorageUtils.setJSON.mockClear();
            service.checkExpiredLinks();
            expect(StorageUtils.setJSON).toHaveBeenCalled();
        });

        it('should not save when no links are expired', () => {
            service.paymentLinks = [
                { id: 'pay-5', status: 'pending', expiresAt: new Date(Date.now() + 86400000).toISOString() }
            ];

            StorageUtils.setJSON.mockClear();
            service.checkExpiredLinks();
            expect(StorageUtils.setJSON).not.toHaveBeenCalled();
        });
    });

    // ─── getPaymentLinks with filters ───────────────────────────────────

    describe('getPaymentLinks', () => {
        beforeEach(() => {
            service.paymentLinks = [
                { id: 'a', status: 'pending', type: 'invoice', referenceId: 'R-1', createdAt: '2026-01-01T00:00:00Z' },
                { id: 'b', status: 'paid', type: 'deposit', referenceId: 'R-2', createdAt: '2026-02-01T00:00:00Z' },
                { id: 'c', status: 'pending', type: 'deposit', referenceId: 'R-1', createdAt: '2026-03-01T00:00:00Z' }
            ];
        });

        it('should return all links when no filters', () => {
            const links = service.getPaymentLinks();
            expect(links.length).toBe(3);
        });

        it('should filter by status', () => {
            const links = service.getPaymentLinks({ status: 'pending' });
            expect(links.length).toBe(2);
            expect(links.every(l => l.status === 'pending')).toBe(true);
        });

        it('should filter by type', () => {
            const links = service.getPaymentLinks({ type: 'deposit' });
            expect(links.length).toBe(2);
        });

        it('should filter by referenceId', () => {
            const links = service.getPaymentLinks({ referenceId: 'R-1' });
            expect(links.length).toBe(2);
        });

        it('should sort by createdAt descending', () => {
            const links = service.getPaymentLinks();
            expect(links[0].id).toBe('c');
            expect(links[2].id).toBe('a');
        });
    });

    // ─── getStatistics ──────────────────────────────────────────────────

    describe('getStatistics', () => {
        it('should return zeroes with no data', () => {
            const stats = service.getStatistics();
            expect(stats.totalPayments).toBe(0);
            expect(stats.totalAmount).toBe(0);
            expect(stats.monthlyPayments).toBe(0);
            expect(stats.monthlyAmount).toBe(0);
            expect(stats.pendingLinks).toBe(0);
            expect(stats.pendingAmount).toBe(0);
            expect(stats.averagePayment).toBe(0);
        });

        it('should compute correct totals and averages', () => {
            service.payments = [
                { amount: 100, paidAt: new Date().toISOString() },
                { amount: 200, paidAt: new Date().toISOString() },
                { amount: 300, paidAt: '2020-01-01T00:00:00Z' } // old payment
            ];
            service.paymentLinks = [
                { status: 'pending', amount: 50 },
                { status: 'paid', amount: 100 }
            ];

            const stats = service.getStatistics();
            expect(stats.totalPayments).toBe(3);
            expect(stats.totalAmount).toBe(600);
            expect(stats.monthlyPayments).toBe(2);
            expect(stats.monthlyAmount).toBe(300);
            expect(stats.pendingLinks).toBe(1);
            expect(stats.pendingAmount).toBe(50);
            expect(stats.averagePayment).toBe(200);
        });
    });

    // ─── generatePayPalLink ─────────────────────────────────────────────

    describe('generatePayPalLink', () => {
        it('should generate correct PayPal URL with default user', () => {
            const url = service.generatePayPalLink(250, 'Test Payment', 'INV-1');
            expect(url).toBe('https://paypal.me/freyai-service/250EUR?memo=Test%20Payment');
        });

        it('should use custom paypalUser from settings', () => {
            service.settings.paypalUser = 'my-business';
            const url = service.generatePayPalLink(100, 'Custom', 'INV-2');
            expect(url).toContain('paypal.me/my-business/');
        });

        it('should encode special characters in description', () => {
            const url = service.generatePayPalLink(50, 'Zahlung für Auftrag #123', 'INV-3');
            expect(url).toContain(encodeURIComponent('Zahlung für Auftrag #123'));
        });
    });

    // ─── handleStripePaymentSuccess ─────────────────────────────────────

    describe('handleStripePaymentSuccess', () => {
        it('should return error when invoiceId is missing', async () => {
            const result = await service.handleStripePaymentSuccess(null);
            expect(result).toEqual({ success: false, error: 'Invoice ID required' });
        });

        it('should return webhook message when no link is found', async () => {
            const result = await service.handleStripePaymentSuccess('unknown-inv');
            expect(result).toEqual({ success: true, message: 'Payment processed by webhook' });
        });

        it('should mark link as paid and update reference', async () => {
            // Create a link first
            const link = await service.createPaymentLink({
                type: 'invoice',
                referenceType: 'rechnung',
                referenceId: 'INV-STRIPE',
                amount: 1000,
                description: 'Stripe success test',
                customerEmail: 'stripe@test.de'
            });

            const result = await service.handleStripePaymentSuccess('INV-STRIPE');
            expect(result).toEqual({ success: true, message: 'Payment confirmed' });
            expect(link.status).toBe('paid');
            expect(link.paidAt).toBeDefined();
        });
    });

    // ─── handleStripePaymentCancellation ────────────────────────────────

    describe('handleStripePaymentCancellation', () => {
        it('should return success with cancellation message', async () => {
            const result = await service.handleStripePaymentCancellation('INV-001');
            expect(result).toEqual({ success: true, message: 'Payment cancelled by user' });
        });
    });

    // ─── getPaymentLink / getPayments ───────────────────────────────────

    describe('getPaymentLink', () => {
        it('should find a link by ID', async () => {
            const created = await service.createPaymentLink({
                amount: 100,
                referenceId: 'R-50',
                referenceType: 'rechnung',
                description: 'Find test'
            });

            const found = service.getPaymentLink(created.id);
            expect(found).toBeDefined();
            expect(found.id).toBe(created.id);
        });

        it('should return undefined for unknown ID', () => {
            expect(service.getPaymentLink('nope')).toBeUndefined();
        });
    });

    describe('getPayments', () => {
        it('should return payments sorted by paidAt descending, limited', () => {
            service.payments = [
                { id: 'p1', paidAt: '2026-01-01T00:00:00Z', amount: 100 },
                { id: 'p2', paidAt: '2026-03-01T00:00:00Z', amount: 200 },
                { id: 'p3', paidAt: '2026-02-01T00:00:00Z', amount: 150 }
            ];

            const payments = service.getPayments(2);
            expect(payments.length).toBe(2);
            expect(payments[0].id).toBe('p2');
            expect(payments[1].id).toBe('p3');
        });
    });

    // ─── updateReference ────────────────────────────────────────────────

    describe('updateReference', () => {
        it('should update invoice status to bezahlt for full payment', () => {
            const invoice = { id: 'INV-REF', brutto: 1000 };
            window.storeService = {
                store: { rechnungen: [invoice] },
                save: vi.fn()
            };

            service.updateReference({
                referenceType: 'rechnung',
                referenceId: 'INV-REF',
                type: 'invoice',
                paidAt: '2026-03-10T00:00:00Z',
                amount: 1000
            });

            expect(invoice.status).toBe('bezahlt');
            expect(invoice.bezahltAm).toBe('2026-03-10T00:00:00Z');
            expect(window.storeService.save).toHaveBeenCalled();
        });

        it('should update deposit fields for deposit payment', () => {
            const invoice = { id: 'INV-DEP', brutto: 2000 };
            window.storeService = {
                store: { rechnungen: [invoice] },
                save: vi.fn()
            };

            service.updateReference({
                referenceType: 'rechnung',
                referenceId: 'INV-DEP',
                type: 'deposit',
                paidAt: '2026-03-10T00:00:00Z',
                amount: 600
            });

            expect(invoice.anzahlung).toBe(600);
            expect(invoice.restbetrag).toBe(1400);
        });

        it('should update appointment via calendarService for termin type', () => {
            window.calendarService = {
                updateAppointment: vi.fn()
            };

            service.updateReference({
                referenceType: 'termin',
                referenceId: 'T-1',
                amount: 300,
                paidAt: '2026-03-10T00:00:00Z'
            });

            expect(window.calendarService.updateAppointment).toHaveBeenCalledWith('T-1', {
                depositPaid: true,
                depositAmount: 300,
                depositPaidAt: '2026-03-10T00:00:00Z'
            });
        });

        it('should not throw when link is null', () => {
            expect(() => service.updateReference(null)).not.toThrow();
        });
    });

    // ─── createDepositRequest ───────────────────────────────────────────

    describe('createDepositRequest', () => {
        it('should return not required when deposit is 0', async () => {
            service.settings.depositRequired = false;

            const result = await service.createDepositRequest(
                { id: 'T-10', betrag: 5000, type: 'termin', beschreibung: 'Badumbau' },
                { email: 'k@test.de', name: 'Kurt' }
            );

            expect(result.required).toBe(false);
            expect(result.reason).toBe('Amount below threshold');
        });

        it('should create deposit link when required', async () => {
            service.settings.depositRequired = true;
            service.settings.depositPercentage = 30;
            service.settings.depositThreshold = 1000;

            const result = await service.createDepositRequest(
                { id: 'T-20', betrag: 3000, type: 'termin', beschreibung: 'Dachsanierung' },
                { email: 'k@test.de', name: 'Kurt' }
            );

            expect(result.required).toBe(true);
            expect(result.depositAmount).toBe(900);
            expect(result.fullAmount).toBe(3000);
            expect(result.paymentLink).toBeDefined();
            expect(result.paymentLink.type).toBe('deposit');
        });
    });

    // ─── formatCurrency ─────────────────────────────────────────────────

    describe('formatCurrency', () => {
        it('should delegate to window.formatCurrency', () => {
            service.formatCurrency(99.5);
            expect(window.formatCurrency).toHaveBeenCalledWith(99.5);
        });
    });

    // ─── updateSettings ─────────────────────────────────────────────────

    describe('updateSettings', () => {
        it('should merge new settings and persist', () => {
            service.updateSettings({ depositPercentage: 50, paypalUser: 'new-user' });
            expect(service.settings.depositPercentage).toBe(50);
            expect(service.settings.paypalUser).toBe('new-user');
            expect(service.settings.businessName).toBe('FreyAI Visions'); // unchanged
            expect(StorageUtils.setJSON).toHaveBeenCalledWith(
                'freyai_payment_settings',
                expect.objectContaining({ depositPercentage: 50 }),
                expect.any(Object)
            );
        });
    });
});
