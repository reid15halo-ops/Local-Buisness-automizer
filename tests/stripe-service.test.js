import { describe, it, expect, vi, beforeEach } from 'vitest';

// Inline StripeService class for isolated testing
class StripeService {
    constructor() {
        this.plans = {
            starter: {
                name: 'Starter',
                price: 3900,
                priceFormatted: '39,00 \u20ac',
                interval: 'month',
                features: [
                    '1 Benutzer',
                    'Kompletter Workflow',
                    '50 Rechnungen / Monat',
                    'DATEV-Export',
                    'E-Mail Support',
                    'KI-Angebots-Assistent'
                ],
                stripePriceId: localStorage.getItem('stripe_price_starter') || ''
            },
            professional: {
                name: 'Professional',
                price: 9900,
                priceFormatted: '99,00 \u20ac',
                interval: 'month',
                features: [
                    'Bis zu 5 Benutzer',
                    'Alle Starter-Features',
                    'Unbegrenzte Rechnungen',
                    'OCR-Scanner',
                    'Zeiterfassung & Stempeluhr',
                    'Mahnwesen automatisiert',
                    'Priorit\u00e4ts-Support'
                ],
                stripePriceId: localStorage.getItem('stripe_price_professional') || ''
            },
            enterprise: {
                name: 'Enterprise',
                price: 29900,
                priceFormatted: '299,00 \u20ac',
                interval: 'month',
                features: [
                    'Unbegrenzte Benutzer',
                    'Alle Professional-Features',
                    'API-Zugang',
                    'SSO & Rollen',
                    'Dedizierter Ansprechpartner',
                    'Custom Integrationen',
                    'SLA & On-Premise Option'
                ],
                stripePriceId: localStorage.getItem('stripe_price_enterprise') || ''
            }
        };

        this.publishableKey = localStorage.getItem('stripe_publishable_key') || '';
        this.stripe = null;
    }

    isConfigured() {
        return !!(this.publishableKey);
    }

    init() {
        if (!this.publishableKey) {
            console.warn('Stripe nicht konfiguriert');
            return false;
        }

        if (typeof Stripe === 'undefined') {
            console.warn('Stripe.js nicht geladen');
            return false;
        }

        this.stripe = Stripe(this.publishableKey);
        return true;
    }

    async createCheckoutSession(planKey) {
        const plan = this.plans[planKey];
        if (!plan || !plan.stripePriceId) {
            throw new Error(`Plan "${planKey}" nicht konfiguriert`);
        }

        const user = window.authService?.getUser();
        if (!user) {
            throw new Error('Bitte zuerst anmelden');
        }

        const supabase = window.supabaseConfig?.get();
        if (!supabase) {
            throw new Error('Supabase nicht konfiguriert');
        }

        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
            body: {
                priceId: plan.stripePriceId,
                userId: user.id,
                email: user.email,
                successUrl: window.location.origin + '/index.html?payment=success',
                cancelUrl: window.location.origin + '/index.html?payment=cancelled'
            }
        });

        if (error) { throw error; }

        if (this.stripe && data.sessionId) {
            const { error: stripeError } = await this.stripe.redirectToCheckout({
                sessionId: data.sessionId
            });
            if (stripeError) { throw stripeError; }
        } else if (data.url) {
            this._validateRedirectUrl(data.url);
            window.location.href = data.url;
        }
    }

    async openBillingPortal() {
        const supabase = window.supabaseConfig?.get();
        if (!supabase) { throw new Error('Supabase nicht konfiguriert'); }

        const { data, error } = await supabase.functions.invoke('create-portal-session', {
            body: {
                returnUrl: window.location.origin + '/index.html'
            }
        });

        if (error) { throw error; }

        if (data.url) {
            this._validateRedirectUrl(data.url);
            window.location.href = data.url;
        }
    }

    _validateRedirectUrl(url) {
        const allowed = ['checkout.stripe.com', 'billing.stripe.com'];
        try {
            const parsed = new URL(url);
            if (!allowed.includes(parsed.hostname)) {
                throw new Error(`Ung\u00fcltige Redirect-URL: ${parsed.hostname} ist nicht erlaubt`);
            }
        } catch (e) {
            if (e.message.includes('Ung\u00fcltige')) { throw e; }
            throw new Error('Ung\u00fcltige URL f\u00fcr Stripe-Redirect');
        }
    }

    async getSubscriptionStatus() {
        const supabase = window.supabaseConfig?.get();
        if (!supabase) { return { plan: 'starter', status: 'trialing' }; }

        try {
            const user = window.authService?.getUser();
            if (!user) { return { plan: 'starter', status: 'none' }; }

            const { data, error } = await supabase
                .from('profiles')
                .select('plan, stripe_subscription_id')
                .eq('id', user.id)
                .single();

            if (error) { throw error; }
            return {
                plan: data?.plan || 'starter',
                hasSubscription: !!data?.stripe_subscription_id,
                status: data?.stripe_subscription_id ? 'active' : 'trialing'
            };
        } catch (err) {
            console.warn('Subscription status error:', err.message);
            return { plan: 'starter', status: 'unknown' };
        }
    }

    async hasAccess(requiredPlan) {
        const planHierarchy = { starter: 1, professional: 2, enterprise: 3 };
        const status = await this.getSubscriptionStatus();
        return (planHierarchy[status.plan] || 0) >= (planHierarchy[requiredPlan] || 0);
    }

    saveConfig(publishableKey, priceIds = {}) {
        this.publishableKey = publishableKey;
        localStorage.setItem('stripe_publishable_key', publishableKey);

        if (priceIds.starter) {
            this.plans.starter.stripePriceId = priceIds.starter;
            localStorage.setItem('stripe_price_starter', priceIds.starter);
        }
        if (priceIds.professional) {
            this.plans.professional.stripePriceId = priceIds.professional;
            localStorage.setItem('stripe_price_professional', priceIds.professional);
        }
        if (priceIds.enterprise) {
            this.plans.enterprise.stripePriceId = priceIds.enterprise;
            localStorage.setItem('stripe_price_enterprise', priceIds.enterprise);
        }

        this.stripe = null;
        this.init();
    }

    async createPaymentLink(invoice) {
        if (!this.publishableKey) {
            throw new Error('Stripe nicht konfiguriert. Bitte Publishable Key im Setup-Wizard hinterlegen.');
        }

        const supabase = window.supabaseConfig?.get();
        if (!supabase) {
            throw new Error('Supabase nicht konfiguriert');
        }

        const user = window.authService?.getUser();
        if (!user) {
            throw new Error('Bitte zuerst anmelden');
        }

        try {
            const customerEmail = invoice.kunde?.email || invoice.customerEmail || null;
            if (!customerEmail) {
                throw new Error('Keine Kunden-E-Mail in der Rechnung hinterlegt');
            }

            const amount = Math.round((invoice.brutto || invoice.betrag || invoice.amount || 0) * 100);
            if (amount < 50) {
                throw new Error('Rechnungsbetrag muss mindestens 0,50 EUR betragen');
            }

            const invoiceNumber = invoice.nummer || invoice.rechnung_id || invoice.id;
            const customerName = invoice.kunde?.name || invoice.kunde_name || '';
            const description = `Rechnung ${invoiceNumber}${customerName ? ` - ${customerName}` : ''}`;

            const baseUrl = window.location.origin;
            const successUrl = `${baseUrl}/index.html?payment=success&invoice=${invoice.id}`;
            const cancelUrl = `${baseUrl}/index.html?payment=cancelled&invoice=${invoice.id}`;

            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: {
                    invoice_id: invoice.id,
                    invoice_number: invoiceNumber,
                    amount: amount,
                    customer_email: customerEmail,
                    customer_name: customerName,
                    description: description,
                    success_url: successUrl,
                    cancel_url: cancelUrl
                }
            });

            if (error) {
                throw new Error(`Stripe-Fehler: ${error.message}`);
            }

            if (!data || !data.url) {
                throw new Error('Keine Checkout-URL von Stripe erhalten');
            }

            return {
                success: true,
                url: data.url,
                sessionId: data.sessionId,
                invoiceId: invoice.id,
                invoiceNumber: invoiceNumber
            };
        } catch (err) {
            console.error('Zahlungslink-Erstellung fehlgeschlagen:', err);
            return {
                success: false,
                error: err.message
            };
        }
    }

    async getPaymentStatus(invoiceId) {
        const supabase = window.supabaseConfig?.get();
        if (!supabase) {
            return { status: 'unknown', error: 'Supabase nicht konfiguriert' };
        }

        try {
            const { data } = await supabase
                .from('stripe_payments')
                .select('payment_status, created_at, amount, payment_method')
                .eq('invoice_id', invoiceId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                return {
                    status: data[0].payment_status,
                    paidAt: data[0].created_at,
                    amount: data[0].amount / 100,
                    method: data[0].payment_method
                };
            }

            return { status: 'pending' };
        } catch (err) {
            console.warn('Zahlungsstatus-Abfrage fehlgeschlagen:', err);
            return { status: 'unknown', error: err.message };
        }
    }

    async openPaymentCheckout(invoice) {
        try {
            const result = await this.createPaymentLink(invoice);
            if (result.success && result.url) {
                window.open(result.url, '_blank');
                return result;
            } else {
                throw new Error(result.error || 'Zahlungsseite konnte nicht ge\u00f6ffnet werden');
            }
        } catch (err) {
            console.error('Checkout-Fehler:', err);
            throw err;
        }
    }
}

// ==================== TESTS ====================

describe('StripeService', () => {
    let service;
    let mockSupabase;

    beforeEach(() => {
        // Clean up globals
        delete window.authService;
        delete window.supabaseConfig;
        delete window.storeService;
        delete window.stripeService;
        delete global.Stripe;

        // Mock localStorage
        const store = {};
        global.localStorage = {
            getItem: vi.fn((key) => store[key] || null),
            setItem: vi.fn((key, val) => { store[key] = val; }),
            removeItem: vi.fn((key) => { delete store[key]; }),
            clear: vi.fn()
        };

        // Mock window.location
        delete window.location;
        window.location = { origin: 'http://localhost', href: '' };

        // Mock window.open
        window.open = vi.fn();

        // Mock console methods
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // Mock supabase client
        mockSupabase = {
            functions: { invoke: vi.fn() },
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(),
                        order: vi.fn(() => ({
                            limit: vi.fn()
                        }))
                    }))
                }))
            }))
        };

        service = new StripeService();
    });

    // ==================== Plan Configuration ====================

    describe('Plan Configuration', () => {
        it('should have exactly 3 tiers: starter, professional, enterprise', () => {
            expect(Object.keys(service.plans)).toEqual(['starter', 'professional', 'enterprise']);
        });

        it('should have correct starter pricing (3900 cents = 39,00 EUR)', () => {
            expect(service.plans.starter.price).toBe(3900);
            expect(service.plans.starter.priceFormatted).toBe('39,00 \u20ac');
            expect(service.plans.starter.name).toBe('Starter');
        });

        it('should have correct professional pricing (9900 cents = 99,00 EUR)', () => {
            expect(service.plans.professional.price).toBe(9900);
            expect(service.plans.professional.priceFormatted).toBe('99,00 \u20ac');
            expect(service.plans.professional.name).toBe('Professional');
        });

        it('should have correct enterprise pricing (29900 cents = 299,00 EUR)', () => {
            expect(service.plans.enterprise.price).toBe(29900);
            expect(service.plans.enterprise.priceFormatted).toBe('299,00 \u20ac');
            expect(service.plans.enterprise.name).toBe('Enterprise');
        });

        it('should have monthly interval for all plans', () => {
            expect(service.plans.starter.interval).toBe('month');
            expect(service.plans.professional.interval).toBe('month');
            expect(service.plans.enterprise.interval).toBe('month');
        });

        it('should have features arrays with correct counts (6, 7, 7)', () => {
            expect(service.plans.starter.features).toHaveLength(6);
            expect(service.plans.professional.features).toHaveLength(7);
            expect(service.plans.enterprise.features).toHaveLength(7);
        });

        it('should initialize stripePriceId from localStorage when present', () => {
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'stripe_price_starter') return 'price_starter_123';
                if (key === 'stripe_price_professional') return 'price_pro_456';
                return null;
            });

            const svc = new StripeService();
            expect(svc.plans.starter.stripePriceId).toBe('price_starter_123');
            expect(svc.plans.professional.stripePriceId).toBe('price_pro_456');
            expect(svc.plans.enterprise.stripePriceId).toBe('');
        });
    });

    // ==================== isConfigured ====================

    describe('isConfigured()', () => {
        it('should return false when publishableKey is empty string', () => {
            service.publishableKey = '';
            expect(service.isConfigured()).toBe(false);
        });

        it('should return true when publishableKey is set', () => {
            service.publishableKey = 'pk_test_abc123';
            expect(service.isConfigured()).toBe(true);
        });
    });

    // ==================== init ====================

    describe('init()', () => {
        it('should return false when no publishableKey is set', () => {
            service.publishableKey = '';
            expect(service.init()).toBe(false);
        });

        it('should return false when Stripe global is undefined', () => {
            service.publishableKey = 'pk_test_abc';
            expect(service.init()).toBe(false);
        });

        it('should return true and initialize stripe instance when both key and Stripe global present', () => {
            service.publishableKey = 'pk_test_abc';
            const mockStripeInstance = { redirectToCheckout: vi.fn() };
            global.Stripe = vi.fn(() => mockStripeInstance);

            expect(service.init()).toBe(true);
            expect(global.Stripe).toHaveBeenCalledWith('pk_test_abc');
            expect(service.stripe).toBe(mockStripeInstance);
        });
    });

    // ==================== createCheckoutSession ====================

    describe('createCheckoutSession()', () => {
        it('should throw on invalid/unknown plan key', async () => {
            await expect(service.createCheckoutSession('nonexistent'))
                .rejects.toThrow('Plan "nonexistent" nicht konfiguriert');
        });

        it('should throw when plan exists but has no stripePriceId', async () => {
            service.plans.starter.stripePriceId = '';
            await expect(service.createCheckoutSession('starter'))
                .rejects.toThrow('Plan "starter" nicht konfiguriert');
        });

        it('should throw when no user is logged in', async () => {
            service.plans.starter.stripePriceId = 'price_123';
            window.authService = { getUser: vi.fn(() => null) };

            await expect(service.createCheckoutSession('starter'))
                .rejects.toThrow('Bitte zuerst anmelden');
        });

        it('should throw when supabase is not configured', async () => {
            service.plans.starter.stripePriceId = 'price_123';
            window.authService = { getUser: vi.fn(() => ({ id: 'u1', email: 'a@b.de' })) };
            window.supabaseConfig = { get: vi.fn(() => null) };

            await expect(service.createCheckoutSession('starter'))
                .rejects.toThrow('Supabase nicht konfiguriert');
        });

        it('should call edge function with correct body parameters', async () => {
            service.plans.starter.stripePriceId = 'price_starter_abc';
            window.authService = { getUser: vi.fn(() => ({ id: 'user-1', email: 'test@example.com' })) };
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };

            mockSupabase.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/session123' },
                error: null
            });

            await service.createCheckoutSession('starter');

            expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-checkout-session', {
                body: {
                    priceId: 'price_starter_abc',
                    userId: 'user-1',
                    email: 'test@example.com',
                    successUrl: 'http://localhost/index.html?payment=success',
                    cancelUrl: 'http://localhost/index.html?payment=cancelled'
                }
            });
        });

        it('should throw when edge function returns error', async () => {
            service.plans.starter.stripePriceId = 'price_123';
            window.authService = { getUser: vi.fn(() => ({ id: 'u1', email: 'a@b.de' })) };
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };

            const edgeError = new Error('Edge function failed');
            mockSupabase.functions.invoke.mockResolvedValue({ data: null, error: edgeError });

            await expect(service.createCheckoutSession('starter')).rejects.toThrow('Edge function failed');
        });

        it('should redirect via stripe.redirectToCheckout when stripe instance and sessionId present', async () => {
            service.plans.starter.stripePriceId = 'price_123';
            window.authService = { getUser: vi.fn(() => ({ id: 'u1', email: 'a@b.de' })) };
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };

            const mockRedirect = vi.fn().mockResolvedValue({ error: null });
            service.stripe = { redirectToCheckout: mockRedirect };

            mockSupabase.functions.invoke.mockResolvedValue({ data: { sessionId: 'cs_test_123' }, error: null });

            await service.createCheckoutSession('starter');

            expect(mockRedirect).toHaveBeenCalledWith({ sessionId: 'cs_test_123' });
        });

        it('should set window.location.href when data.url is returned and no stripe instance', async () => {
            service.plans.starter.stripePriceId = 'price_123';
            window.authService = { getUser: vi.fn(() => ({ id: 'u1', email: 'a@b.de' })) };
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };
            service.stripe = null;

            mockSupabase.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/pay/cs_abc' },
                error: null
            });

            await service.createCheckoutSession('starter');

            expect(window.location.href).toBe('https://checkout.stripe.com/pay/cs_abc');
        });
    });

    // ==================== _validateRedirectUrl ====================

    describe('_validateRedirectUrl()', () => {
        it('should allow checkout.stripe.com URLs', () => {
            expect(() => service._validateRedirectUrl('https://checkout.stripe.com/session/abc'))
                .not.toThrow();
        });

        it('should allow billing.stripe.com URLs', () => {
            expect(() => service._validateRedirectUrl('https://billing.stripe.com/portal/abc'))
                .not.toThrow();
        });

        it('should reject domains not in allowlist', () => {
            expect(() => service._validateRedirectUrl('https://evil.com/phish'))
                .toThrow('Ung\u00fcltige Redirect-URL: evil.com ist nicht erlaubt');
        });

        it('should reject non-allowed stripe subdomains', () => {
            expect(() => service._validateRedirectUrl('https://api.stripe.com/v1'))
                .toThrow('Ung\u00fcltige Redirect-URL');
        });

        it('should reject completely invalid URLs', () => {
            expect(() => service._validateRedirectUrl('not-a-url-at-all'))
                .toThrow('Ung\u00fcltige URL f\u00fcr Stripe-Redirect');
        });
    });

    // ==================== getSubscriptionStatus ====================

    describe('getSubscriptionStatus()', () => {
        it('should return default trialing status when no supabase configured', async () => {
            window.supabaseConfig = { get: vi.fn(() => null) };
            const result = await service.getSubscriptionStatus();
            expect(result).toEqual({ plan: 'starter', status: 'trialing' });
        });

        it('should return none status when no user is logged in', async () => {
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };
            window.authService = { getUser: vi.fn(() => null) };

            const result = await service.getSubscriptionStatus();
            expect(result).toEqual({ plan: 'starter', status: 'none' });
        });

        it('should return active status when profile has stripe_subscription_id', async () => {
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };
            window.authService = { getUser: vi.fn(() => ({ id: 'u1' })) };

            const mockSingle = vi.fn().mockResolvedValue({
                data: { plan: 'professional', stripe_subscription_id: 'sub_abc' },
                error: null
            });
            const mockEq = vi.fn(() => ({ single: mockSingle }));
            const mockSelect = vi.fn(() => ({ eq: mockEq }));
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            const result = await service.getSubscriptionStatus();
            expect(result).toEqual({
                plan: 'professional',
                hasSubscription: true,
                status: 'active'
            });
            expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
        });

        it('should return trialing status when no stripe_subscription_id', async () => {
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };
            window.authService = { getUser: vi.fn(() => ({ id: 'u1' })) };

            const mockSingle = vi.fn().mockResolvedValue({
                data: { plan: 'starter', stripe_subscription_id: null },
                error: null
            });
            const mockEq = vi.fn(() => ({ single: mockSingle }));
            const mockSelect = vi.fn(() => ({ eq: mockEq }));
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            const result = await service.getSubscriptionStatus();
            expect(result).toEqual({
                plan: 'starter',
                hasSubscription: false,
                status: 'trialing'
            });
        });

        it('should return unknown status on database error', async () => {
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };
            window.authService = { getUser: vi.fn(() => ({ id: 'u1' })) };

            const mockSingle = vi.fn().mockResolvedValue({
                data: null,
                error: new Error('DB connection failed')
            });
            const mockEq = vi.fn(() => ({ single: mockSingle }));
            const mockSelect = vi.fn(() => ({ eq: mockEq }));
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            const result = await service.getSubscriptionStatus();
            expect(result).toEqual({ plan: 'starter', status: 'unknown' });
        });

        it('should default plan to starter when data.plan is null', async () => {
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };
            window.authService = { getUser: vi.fn(() => ({ id: 'u1' })) };

            const mockSingle = vi.fn().mockResolvedValue({
                data: { plan: null, stripe_subscription_id: null },
                error: null
            });
            const mockEq = vi.fn(() => ({ single: mockSingle }));
            const mockSelect = vi.fn(() => ({ eq: mockEq }));
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            const result = await service.getSubscriptionStatus();
            expect(result.plan).toBe('starter');
        });
    });

    // ==================== hasAccess ====================

    describe('hasAccess()', () => {
        function mockSubscriptionPlan(plan) {
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };
            window.authService = { getUser: vi.fn(() => ({ id: 'u1' })) };

            const mockSingle = vi.fn().mockResolvedValue({
                data: { plan, stripe_subscription_id: 'sub_123' },
                error: null
            });
            const mockEq = vi.fn(() => ({ single: mockSingle }));
            const mockSelect = vi.fn(() => ({ eq: mockEq }));
            mockSupabase.from.mockReturnValue({ select: mockSelect });
        }

        it('should grant starter access to starter user', async () => {
            mockSubscriptionPlan('starter');
            expect(await service.hasAccess('starter')).toBe(true);
        });

        it('should deny professional access to starter user', async () => {
            mockSubscriptionPlan('starter');
            expect(await service.hasAccess('professional')).toBe(false);
        });

        it('should deny enterprise access to starter user', async () => {
            mockSubscriptionPlan('starter');
            expect(await service.hasAccess('enterprise')).toBe(false);
        });

        it('should grant starter and professional access to professional user', async () => {
            mockSubscriptionPlan('professional');
            expect(await service.hasAccess('starter')).toBe(true);
            expect(await service.hasAccess('professional')).toBe(true);
        });

        it('should deny enterprise access to professional user', async () => {
            mockSubscriptionPlan('professional');
            expect(await service.hasAccess('enterprise')).toBe(false);
        });

        it('should grant access to all plans for enterprise user', async () => {
            mockSubscriptionPlan('enterprise');
            expect(await service.hasAccess('starter')).toBe(true);
            expect(await service.hasAccess('professional')).toBe(true);
            expect(await service.hasAccess('enterprise')).toBe(true);
        });

        it('should handle unknown required plan (hierarchy 0) - always grants access', async () => {
            mockSubscriptionPlan('starter');
            expect(await service.hasAccess('unknown_plan')).toBe(true);
        });
    });

    // ==================== saveConfig ====================

    describe('saveConfig()', () => {
        it('should persist publishableKey to localStorage and update instance', () => {
            service.saveConfig('pk_live_xyz');
            expect(localStorage.setItem).toHaveBeenCalledWith('stripe_publishable_key', 'pk_live_xyz');
            expect(service.publishableKey).toBe('pk_live_xyz');
        });

        it('should update all plan price IDs when provided', () => {
            service.saveConfig('pk_test_key', {
                starter: 'price_s',
                professional: 'price_p',
                enterprise: 'price_e'
            });

            expect(service.plans.starter.stripePriceId).toBe('price_s');
            expect(service.plans.professional.stripePriceId).toBe('price_p');
            expect(service.plans.enterprise.stripePriceId).toBe('price_e');

            expect(localStorage.setItem).toHaveBeenCalledWith('stripe_price_starter', 'price_s');
            expect(localStorage.setItem).toHaveBeenCalledWith('stripe_price_professional', 'price_p');
            expect(localStorage.setItem).toHaveBeenCalledWith('stripe_price_enterprise', 'price_e');
        });

        it('should not overwrite existing price IDs when not provided', () => {
            service.plans.starter.stripePriceId = 'existing_price';
            service.saveConfig('pk_test_key', {});
            expect(service.plans.starter.stripePriceId).toBe('existing_price');
        });

        it('should reset stripe instance to null and call init()', () => {
            const initSpy = vi.spyOn(service, 'init');
            service.saveConfig('pk_test_key');
            expect(initSpy).toHaveBeenCalled();
        });

        it('should reinitialize stripe when global Stripe is available after saveConfig', () => {
            const mockStripeInstance = { redirectToCheckout: vi.fn() };
            global.Stripe = vi.fn(() => mockStripeInstance);

            service.saveConfig('pk_test_reinit');
            expect(service.stripe).toBe(mockStripeInstance);
        });
    });

    // ==================== createPaymentLink ====================

    describe('createPaymentLink()', () => {
        const validInvoice = {
            id: 'inv-001',
            nummer: 'RE-2024-001',
            brutto: 119.00,
            kunde: { name: 'Max M\u00fcller', email: 'max@example.com' }
        };

        beforeEach(() => {
            service.publishableKey = 'pk_test_abc';
            window.authService = { getUser: vi.fn(() => ({ id: 'u1', email: 'owner@test.de' })) };
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };
        });

        it('should throw when stripe is not configured (no publishableKey)', async () => {
            service.publishableKey = '';
            await expect(service.createPaymentLink(validInvoice))
                .rejects.toThrow('Stripe nicht konfiguriert');
        });

        it('should throw when supabase is not configured', async () => {
            window.supabaseConfig = { get: vi.fn(() => null) };
            await expect(service.createPaymentLink(validInvoice))
                .rejects.toThrow('Supabase nicht konfiguriert');
        });

        it('should throw when no user is logged in', async () => {
            window.authService = { getUser: vi.fn(() => null) };
            await expect(service.createPaymentLink(validInvoice))
                .rejects.toThrow('Bitte zuerst anmelden');
        });

        it('should return error object when no customer email is available', async () => {
            const noEmail = { id: 'inv-001', brutto: 100, kunde: { name: 'Test' } };
            const result = await service.createPaymentLink(noEmail);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Keine Kunden-E-Mail');
        });

        it('should return error when amount is below minimum (50 cents)', async () => {
            const lowAmount = { ...validInvoice, brutto: 0.30 };
            const result = await service.createPaymentLink(lowAmount);
            expect(result.success).toBe(false);
            expect(result.error).toContain('mindestens 0,50 EUR');
        });

        it('should call edge function create-checkout with correct body', async () => {
            mockSupabase.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/pay/cs_test', sessionId: 'cs_test_id' },
                error: null
            });

            const result = await service.createPaymentLink(validInvoice);

            expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-checkout', {
                body: {
                    invoice_id: 'inv-001',
                    invoice_number: 'RE-2024-001',
                    amount: 11900,
                    customer_email: 'max@example.com',
                    customer_name: 'Max M\u00fcller',
                    description: 'Rechnung RE-2024-001 - Max M\u00fcller',
                    success_url: 'http://localhost/index.html?payment=success&invoice=inv-001',
                    cancel_url: 'http://localhost/index.html?payment=cancelled&invoice=inv-001'
                }
            });

            expect(result.success).toBe(true);
            expect(result.url).toBe('https://checkout.stripe.com/pay/cs_test');
            expect(result.invoiceId).toBe('inv-001');
            expect(result.invoiceNumber).toBe('RE-2024-001');
        });

        it('should return error object when edge function returns error', async () => {
            mockSupabase.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Internal server error' }
            });

            const result = await service.createPaymentLink(validInvoice);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Stripe-Fehler');
        });

        it('should return error when response has no URL', async () => {
            mockSupabase.functions.invoke.mockResolvedValue({
                data: { sessionId: 'cs_123' },
                error: null
            });

            const result = await service.createPaymentLink(validInvoice);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Keine Checkout-URL');
        });

        it('should use customerEmail fallback when kunde.email is missing', async () => {
            mockSupabase.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/x', sessionId: 's1' },
                error: null
            });

            const invoice = { id: 'inv-002', brutto: 50, customerEmail: 'fallback@test.de', nummer: 'RE-002' };
            const result = await service.createPaymentLink(invoice);
            expect(result.success).toBe(true);

            const body = mockSupabase.functions.invoke.mock.calls[0][1].body;
            expect(body.customer_email).toBe('fallback@test.de');
        });

        it('should use betrag when brutto is not available', async () => {
            mockSupabase.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/x', sessionId: 's1' },
                error: null
            });

            const invoice = { id: 'inv-003', betrag: 75.50, kunde: { email: 'a@b.de' } };
            const result = await service.createPaymentLink(invoice);
            expect(result.success).toBe(true);

            const body = mockSupabase.functions.invoke.mock.calls[0][1].body;
            expect(body.amount).toBe(7550);
        });

        it('should build description without customer name when not provided', async () => {
            mockSupabase.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/x', sessionId: 's1' },
                error: null
            });

            const invoice = { id: 'inv-004', brutto: 100, customerEmail: 'a@b.de', nummer: 'RE-004' };
            const result = await service.createPaymentLink(invoice);
            expect(result.success).toBe(true);

            const body = mockSupabase.functions.invoke.mock.calls[0][1].body;
            expect(body.description).toBe('Rechnung RE-004');
        });
    });

    // ==================== getPaymentStatus ====================

    describe('getPaymentStatus()', () => {
        it('should return unknown when no supabase configured', async () => {
            window.supabaseConfig = { get: vi.fn(() => null) };
            const result = await service.getPaymentStatus('inv-001');
            expect(result).toEqual({ status: 'unknown', error: 'Supabase nicht konfiguriert' });
        });

        it('should query stripe_payments table and convert cents to EUR', async () => {
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };

            const mockLimit = vi.fn().mockResolvedValue({
                data: [{
                    payment_status: 'paid',
                    created_at: '2024-06-01T10:00:00Z',
                    amount: 11900,
                    payment_method: 'card'
                }]
            });
            const mockOrder = vi.fn(() => ({ limit: mockLimit }));
            const mockEq = vi.fn(() => ({ order: mockOrder }));
            const mockSelect = vi.fn(() => ({ eq: mockEq }));
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            const result = await service.getPaymentStatus('inv-001');
            expect(result.status).toBe('paid');
            expect(result.amount).toBe(119);
            expect(result.method).toBe('card');
            expect(result.paidAt).toBe('2024-06-01T10:00:00Z');
            expect(mockSupabase.from).toHaveBeenCalledWith('stripe_payments');
        });

        it('should return pending when no payment records found (empty array)', async () => {
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };

            const mockLimit = vi.fn().mockResolvedValue({ data: [] });
            const mockOrder = vi.fn(() => ({ limit: mockLimit }));
            const mockEq = vi.fn(() => ({ order: mockOrder }));
            const mockSelect = vi.fn(() => ({ eq: mockEq }));
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            const result = await service.getPaymentStatus('inv-002');
            expect(result).toEqual({ status: 'pending' });
        });

        it('should return pending when data is null', async () => {
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };

            const mockLimit = vi.fn().mockResolvedValue({ data: null });
            const mockOrder = vi.fn(() => ({ limit: mockLimit }));
            const mockEq = vi.fn(() => ({ order: mockOrder }));
            const mockSelect = vi.fn(() => ({ eq: mockEq }));
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            const result = await service.getPaymentStatus('inv-003');
            expect(result).toEqual({ status: 'pending' });
        });

        it('should handle query errors gracefully and return unknown', async () => {
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };

            const mockLimit = vi.fn().mockRejectedValue(new Error('Network error'));
            const mockOrder = vi.fn(() => ({ limit: mockLimit }));
            const mockEq = vi.fn(() => ({ order: mockOrder }));
            const mockSelect = vi.fn(() => ({ eq: mockEq }));
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            const result = await service.getPaymentStatus('inv-004');
            expect(result.status).toBe('unknown');
            expect(result.error).toBe('Network error');
        });
    });

    // ==================== openPaymentCheckout ====================

    describe('openPaymentCheckout()', () => {
        const validInvoice = {
            id: 'inv-010',
            nummer: 'RE-2024-010',
            brutto: 200,
            kunde: { name: 'Test GmbH', email: 'test@gmbh.de' }
        };

        beforeEach(() => {
            service.publishableKey = 'pk_test_abc';
            window.authService = { getUser: vi.fn(() => ({ id: 'u1', email: 'owner@test.de' })) };
            window.supabaseConfig = { get: vi.fn(() => mockSupabase) };
        });

        it('should call createPaymentLink and open URL in new window on success', async () => {
            mockSupabase.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/pay/cs_test', sessionId: 'cs_1' },
                error: null
            });

            const result = await service.openPaymentCheckout(validInvoice);

            expect(window.open).toHaveBeenCalledWith('https://checkout.stripe.com/pay/cs_test', '_blank');
            expect(result.success).toBe(true);
            expect(result.url).toBe('https://checkout.stripe.com/pay/cs_test');
        });

        it('should throw when createPaymentLink returns failure', async () => {
            mockSupabase.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Server error' }
            });

            await expect(service.openPaymentCheckout(validInvoice))
                .rejects.toThrow('Stripe-Fehler: Server error');
        });

        it('should throw when no checkout URL is returned', async () => {
            mockSupabase.functions.invoke.mockResolvedValue({
                data: {},
                error: null
            });

            await expect(service.openPaymentCheckout(validInvoice))
                .rejects.toThrow('Keine Checkout-URL von Stripe erhalten');
        });
    });
});
