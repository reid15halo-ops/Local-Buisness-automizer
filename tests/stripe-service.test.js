import { describe, it, expect, beforeEach, vi } from 'vitest';

// Inline StripeService class for isolated testing
class StripeService {
    constructor() {
        this.plans = {
            starter: {
                name: 'Starter',
                price: 3900,
                priceFormatted: '39,00 €',
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
                priceFormatted: '99,00 €',
                interval: 'month',
                features: [
                    'Bis zu 5 Benutzer',
                    'Alle Starter-Features',
                    'Unbegrenzte Rechnungen',
                    'OCR-Scanner',
                    'Zeiterfassung & Stempeluhr',
                    'Mahnwesen automatisiert',
                    'Prioritäts-Support'
                ],
                stripePriceId: localStorage.getItem('stripe_price_professional') || ''
            },
            enterprise: {
                name: 'Enterprise',
                price: 29900,
                priceFormatted: '299,00 €',
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
            body: { returnUrl: window.location.origin + '/index.html' }
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
                throw new Error(`Ungültige Redirect-URL: ${parsed.hostname} ist nicht erlaubt`);
            }
        } catch (e) {
            if (e.message.includes('Ungültige')) { throw e; }
            throw new Error('Ungültige URL für Stripe-Redirect');
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

    async generatePaymentButton(invoice, options = {}) {
        const {
            checkoutUrl = null,
            buttonText = 'Jetzt bezahlen',
            accentColor = '#6366f1'
        } = options;
        let url = checkoutUrl;
        if (!url) {
            const result = await this.createPaymentLink(invoice);
            if (!result.success) {
                throw new Error(result.error || 'Zahlungslink konnte nicht generiert werden');
            }
            url = result.url;
        }
        const amount = invoice.brutto || invoice.betrag || invoice.amount || 0;
        const formattedAmount = new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
        const invoiceNumber = invoice.nummer || invoice.rechnung_id || invoice.id;
        return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px auto;">
  <tr>
    <td align="center" style="border-radius: 8px; background-color: ${accentColor};">
      <a href="${url}"
         target="_blank"
         rel="noopener noreferrer"
         style="display: inline-block;
                padding: 16px 40px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 16px;
                font-weight: 600;
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                background-color: ${accentColor};
                line-height: 1.4;">
        ${buttonText} &mdash; ${formattedAmount}
      </a>
    </td>
  </tr>
</table>
<p style="text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          color: #71717a;
          margin-top: 8px;">
  Rechnung ${invoiceNumber} &middot; Sichere Zahlung via Stripe
</p>`.trim();
    }

    async generatePaymentEmailHTML(invoice, options = {}) {
        const companyName = options.companyName
            || window.storeService?.state?.settings?.companyName
            || 'FreyAI Visions';
        const invoiceNumber = invoice.nummer || invoice.rechnung_id || invoice.id;
        const customerName = invoice.kunde?.name || invoice.kunde_name || 'Kunde';
        const amount = invoice.brutto || invoice.betrag || invoice.amount || 0;
        const formattedAmount = new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
        const paymentButton = await this.generatePaymentButton(invoice, options);
        return `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background-color: #09090b; padding: 32px 40px; text-align: center;">
            <h1 style="margin: 0; color: #fafafa; font-size: 22px; font-weight: 700;">${companyName}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 40px;">
            <p style="font-size: 16px; color: #18181b; margin-top: 0;">Sehr geehrte/r ${customerName},</p>
            <p style="font-size: 15px; color: #3f3f46; line-height: 1.6;">
              vielen Dank f&uuml;r Ihren Auftrag. Anbei erhalten Sie die Rechnung
              <strong>${invoiceNumber}</strong> &uuml;ber <strong>${formattedAmount}</strong>.
            </p>
            <p style="font-size: 15px; color: #3f3f46; line-height: 1.6;">
              Sie k&ouml;nnen den Betrag bequem und sicher online bezahlen:
            </p>

            ${paymentButton}

            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="font-size: 13px; color: #71717a; line-height: 1.5;">
              Alternativ k&ouml;nnen Sie den Betrag auch per &Uuml;berweisung begleichen.
              Die Bankverbindung finden Sie auf der beigef&uuml;gten Rechnung.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #f4f4f5; padding: 24px 40px; text-align: center;">
            <p style="font-size: 12px; color: #a1a1aa; margin: 0;">
              &copy; ${new Date().getFullYear()} ${companyName} &middot; Alle Rechte vorbehalten
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`.trim();
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
}

// ============================================================
// Test Suite
// ============================================================

describe('StripeService', () => {
    let service;
    let mockSupabaseClient;

    beforeEach(() => {
        // Reset window state
        delete window.supabaseConfig;
        delete window.authService;
        delete window.storeService;

        // Mock localStorage
        const store = {};
        global.localStorage = {
            getItem: vi.fn((key) => store[key] || null),
            setItem: vi.fn((key, val) => { store[key] = val; }),
            removeItem: vi.fn((key) => { delete store[key]; }),
            clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); })
        };

        // Mock window.location
        delete window.location;
        window.location = { origin: 'https://app.example.com', href: '' };

        // Mock Supabase client with chainable query builder
        const createQueryBuilder = (resolvedValue) => {
            const builder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue(resolvedValue)
            };
            // When the chain ends without .single(), resolve the promise
            builder.limit.mockResolvedValue(resolvedValue);
            return builder;
        };

        mockSupabaseClient = {
            functions: {
                invoke: vi.fn()
            },
            from: vi.fn(() => createQueryBuilder({ data: null, error: null }))
        };

        window.supabaseConfig = {
            get: vi.fn(() => mockSupabaseClient)
        };

        window.authService = {
            getUser: vi.fn(() => ({ id: 'user-123', email: 'test@example.com' }))
        };

        // Remove global Stripe constructor so init() tests can control it
        delete globalThis.Stripe;

        service = new StripeService();
    });

    // --------------------------------------------------------
    // Plan Configuration
    // --------------------------------------------------------
    describe('Plan configuration', () => {
        it('should define three plans', () => {
            expect(Object.keys(service.plans)).toEqual(['starter', 'professional', 'enterprise']);
        });

        it('should set starter price to 3900 cents (39 EUR)', () => {
            expect(service.plans.starter.price).toBe(3900);
        });

        it('should set professional price to 9900 cents (99 EUR)', () => {
            expect(service.plans.professional.price).toBe(9900);
        });

        it('should set enterprise price to 29900 cents (299 EUR)', () => {
            expect(service.plans.enterprise.price).toBe(29900);
        });

        it('should set monthly interval for all plans', () => {
            Object.values(service.plans).forEach(plan => {
                expect(plan.interval).toBe('month');
            });
        });

        it('should have features arrays for every plan', () => {
            Object.values(service.plans).forEach(plan => {
                expect(Array.isArray(plan.features)).toBe(true);
                expect(plan.features.length).toBeGreaterThan(0);
            });
        });
    });

    // --------------------------------------------------------
    // isConfigured
    // --------------------------------------------------------
    describe('isConfigured()', () => {
        it('should return false when no publishable key is set', () => {
            service.publishableKey = '';
            expect(service.isConfigured()).toBe(false);
        });

        it('should return true when publishable key exists', () => {
            service.publishableKey = 'pk_test_abc123';
            expect(service.isConfigured()).toBe(true);
        });

        it('should return false for null publishable key', () => {
            service.publishableKey = null;
            expect(service.isConfigured()).toBe(false);
        });
    });

    // --------------------------------------------------------
    // init
    // --------------------------------------------------------
    describe('init()', () => {
        it('should return false if no publishable key', () => {
            service.publishableKey = '';
            expect(service.init()).toBe(false);
        });

        it('should return false if Stripe.js is not loaded', () => {
            service.publishableKey = 'pk_test_abc';
            // Stripe global is not defined
            expect(service.init()).toBe(false);
        });

        it('should return true and set stripe instance when Stripe.js available', () => {
            service.publishableKey = 'pk_test_abc';
            const mockStripeInstance = { redirectToCheckout: vi.fn() };
            globalThis.Stripe = vi.fn(() => mockStripeInstance);

            expect(service.init()).toBe(true);
            expect(service.stripe).toBe(mockStripeInstance);
            expect(globalThis.Stripe).toHaveBeenCalledWith('pk_test_abc');
        });
    });

    // --------------------------------------------------------
    // _validateRedirectUrl (security-critical)
    // --------------------------------------------------------
    describe('_validateRedirectUrl()', () => {
        it('should allow checkout.stripe.com', () => {
            expect(() => {
                service._validateRedirectUrl('https://checkout.stripe.com/c/pay_abc');
            }).not.toThrow();
        });

        it('should allow billing.stripe.com', () => {
            expect(() => {
                service._validateRedirectUrl('https://billing.stripe.com/session/abc');
            }).not.toThrow();
        });

        it('should reject evil-stripe.com', () => {
            expect(() => {
                service._validateRedirectUrl('https://evil-stripe.com/steal');
            }).toThrow('nicht erlaubt');
        });

        it('should reject checkout.stripe.com.evil.com (subdomain attack)', () => {
            expect(() => {
                service._validateRedirectUrl('https://checkout.stripe.com.evil.com/pay');
            }).toThrow('nicht erlaubt');
        });

        it('should reject completely unrelated domains', () => {
            expect(() => {
                service._validateRedirectUrl('https://malicious.example.com/phish');
            }).toThrow('nicht erlaubt');
        });

        it('should reject invalid URLs', () => {
            expect(() => {
                service._validateRedirectUrl('not-a-url');
            }).toThrow('Ungültige URL');
        });

        it('should reject empty string', () => {
            expect(() => {
                service._validateRedirectUrl('');
            }).toThrow('Ungültige URL');
        });

        it('should reject javascript: protocol URLs', () => {
            expect(() => {
                service._validateRedirectUrl('javascript:alert(1)');
            }).toThrow();
        });
    });

    // --------------------------------------------------------
    // createCheckoutSession
    // --------------------------------------------------------
    describe('createCheckoutSession()', () => {
        it('should throw for unknown plan key', async () => {
            await expect(service.createCheckoutSession('nonexistent'))
                .rejects.toThrow('nicht konfiguriert');
        });

        it('should throw when plan has no stripePriceId', async () => {
            service.plans.starter.stripePriceId = '';
            await expect(service.createCheckoutSession('starter'))
                .rejects.toThrow('Plan "starter" nicht konfiguriert');
        });

        it('should throw when no user is logged in', async () => {
            service.plans.starter.stripePriceId = 'price_abc';
            window.authService.getUser.mockReturnValue(null);

            await expect(service.createCheckoutSession('starter'))
                .rejects.toThrow('Bitte zuerst anmelden');
        });

        it('should throw when supabase is not configured', async () => {
            service.plans.starter.stripePriceId = 'price_abc';
            window.supabaseConfig.get.mockReturnValue(null);

            await expect(service.createCheckoutSession('starter'))
                .rejects.toThrow('Supabase nicht konfiguriert');
        });

        it('should call edge function with correct body', async () => {
            service.plans.starter.stripePriceId = 'price_starter_123';
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/c/pay_test' },
                error: null
            });

            await service.createCheckoutSession('starter');

            expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
                'create-checkout-session',
                expect.objectContaining({
                    body: expect.objectContaining({
                        priceId: 'price_starter_123',
                        userId: 'user-123',
                        email: 'test@example.com'
                    })
                })
            );
        });

        it('should throw when edge function returns error', async () => {
            service.plans.starter.stripePriceId = 'price_abc';
            const edgeError = new Error('Edge function failed');
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: null,
                error: edgeError
            });

            await expect(service.createCheckoutSession('starter'))
                .rejects.toThrow('Edge function failed');
        });

        it('should redirect via URL when no stripe instance and data.url present', async () => {
            service.plans.starter.stripePriceId = 'price_abc';
            service.stripe = null;
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/c/pay_test' },
                error: null
            });

            await service.createCheckoutSession('starter');
            expect(window.location.href).toBe('https://checkout.stripe.com/c/pay_test');
        });
    });

    // --------------------------------------------------------
    // openBillingPortal
    // --------------------------------------------------------
    describe('openBillingPortal()', () => {
        it('should throw when supabase is not configured', async () => {
            window.supabaseConfig.get.mockReturnValue(null);
            await expect(service.openBillingPortal())
                .rejects.toThrow('Supabase nicht konfiguriert');
        });

        it('should call create-portal-session edge function', async () => {
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: { url: 'https://billing.stripe.com/session/abc' },
                error: null
            });

            await service.openBillingPortal();

            expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
                'create-portal-session',
                expect.objectContaining({
                    body: { returnUrl: 'https://app.example.com/index.html' }
                })
            );
        });

        it('should redirect to portal URL', async () => {
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: { url: 'https://billing.stripe.com/session/abc' },
                error: null
            });

            await service.openBillingPortal();
            expect(window.location.href).toBe('https://billing.stripe.com/session/abc');
        });
    });

    // --------------------------------------------------------
    // getSubscriptionStatus
    // --------------------------------------------------------
    describe('getSubscriptionStatus()', () => {
        it('should return trialing when supabase not configured', async () => {
            window.supabaseConfig.get.mockReturnValue(null);
            const result = await service.getSubscriptionStatus();
            expect(result).toEqual({ plan: 'starter', status: 'trialing' });
        });

        it('should return none status when no user', async () => {
            window.authService.getUser.mockReturnValue(null);
            const result = await service.getSubscriptionStatus();
            expect(result).toEqual({ plan: 'starter', status: 'none' });
        });

        it('should return active status when subscription exists', async () => {
            const queryBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { plan: 'professional', stripe_subscription_id: 'sub_123' },
                    error: null
                })
            };
            mockSupabaseClient.from.mockReturnValue(queryBuilder);

            const result = await service.getSubscriptionStatus();
            expect(result.plan).toBe('professional');
            expect(result.hasSubscription).toBe(true);
            expect(result.status).toBe('active');
        });

        it('should return trialing when no subscription id', async () => {
            const queryBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { plan: 'starter', stripe_subscription_id: null },
                    error: null
                })
            };
            mockSupabaseClient.from.mockReturnValue(queryBuilder);

            const result = await service.getSubscriptionStatus();
            expect(result.plan).toBe('starter');
            expect(result.hasSubscription).toBe(false);
            expect(result.status).toBe('trialing');
        });

        it('should return unknown on database error', async () => {
            const queryBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: null,
                    error: new Error('DB error')
                })
            };
            mockSupabaseClient.from.mockReturnValue(queryBuilder);

            const result = await service.getSubscriptionStatus();
            expect(result).toEqual({ plan: 'starter', status: 'unknown' });
        });
    });

    // --------------------------------------------------------
    // hasAccess (plan hierarchy)
    // --------------------------------------------------------
    describe('hasAccess()', () => {
        const mockSubscriptionPlan = (plan) => {
            const queryBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { plan, stripe_subscription_id: 'sub_123' },
                    error: null
                })
            };
            mockSupabaseClient.from.mockReturnValue(queryBuilder);
        };

        it('starter should have access to starter', async () => {
            mockSubscriptionPlan('starter');
            expect(await service.hasAccess('starter')).toBe(true);
        });

        it('starter should NOT have access to professional', async () => {
            mockSubscriptionPlan('starter');
            expect(await service.hasAccess('professional')).toBe(false);
        });

        it('starter should NOT have access to enterprise', async () => {
            mockSubscriptionPlan('starter');
            expect(await service.hasAccess('enterprise')).toBe(false);
        });

        it('professional should have access to starter', async () => {
            mockSubscriptionPlan('professional');
            expect(await service.hasAccess('starter')).toBe(true);
        });

        it('professional should have access to professional', async () => {
            mockSubscriptionPlan('professional');
            expect(await service.hasAccess('professional')).toBe(true);
        });

        it('professional should NOT have access to enterprise', async () => {
            mockSubscriptionPlan('professional');
            expect(await service.hasAccess('enterprise')).toBe(false);
        });

        it('enterprise should have access to all plans', async () => {
            mockSubscriptionPlan('enterprise');
            expect(await service.hasAccess('starter')).toBe(true);
            expect(await service.hasAccess('professional')).toBe(true);
            expect(await service.hasAccess('enterprise')).toBe(true);
        });
    });

    // --------------------------------------------------------
    // saveConfig
    // --------------------------------------------------------
    describe('saveConfig()', () => {
        it('should save publishable key to localStorage', () => {
            service.saveConfig('pk_test_new');
            expect(localStorage.setItem).toHaveBeenCalledWith('stripe_publishable_key', 'pk_test_new');
        });

        it('should update instance publishableKey', () => {
            service.saveConfig('pk_test_new');
            expect(service.publishableKey).toBe('pk_test_new');
        });

        it('should save price IDs for each plan', () => {
            service.saveConfig('pk_test_new', {
                starter: 'price_s',
                professional: 'price_p',
                enterprise: 'price_e'
            });
            expect(localStorage.setItem).toHaveBeenCalledWith('stripe_price_starter', 'price_s');
            expect(localStorage.setItem).toHaveBeenCalledWith('stripe_price_professional', 'price_p');
            expect(localStorage.setItem).toHaveBeenCalledWith('stripe_price_enterprise', 'price_e');
        });

        it('should update plan stripePriceId properties', () => {
            service.saveConfig('pk_test_new', {
                starter: 'price_s',
                professional: 'price_p'
            });
            expect(service.plans.starter.stripePriceId).toBe('price_s');
            expect(service.plans.professional.stripePriceId).toBe('price_p');
        });

        it('should not overwrite price IDs when not provided', () => {
            service.plans.enterprise.stripePriceId = 'price_existing';
            service.saveConfig('pk_test_new', {});
            expect(service.plans.enterprise.stripePriceId).toBe('price_existing');
        });

        it('should reset stripe instance and attempt init', () => {
            service.stripe = { old: true };
            service.saveConfig('pk_test_new');
            // init() will fail because Stripe global is not defined, so stripe stays null
            expect(service.stripe).toBeNull();
        });
    });

    // --------------------------------------------------------
    // createPaymentLink
    // --------------------------------------------------------
    describe('createPaymentLink()', () => {
        const validInvoice = {
            id: 'inv-001',
            nummer: 'RE-2026-001',
            brutto: 119.00,
            kunde: { name: 'Max Mustermann', email: 'max@example.com' },
        };

        beforeEach(() => {
            service.publishableKey = 'pk_test_abc';
        });

        it('should throw when Stripe is not configured', async () => {
            service.publishableKey = '';
            await expect(service.createPaymentLink(validInvoice))
                .rejects.toThrow('Stripe nicht konfiguriert');
        });

        it('should return error when supabase not configured', async () => {
            window.supabaseConfig.get.mockReturnValue(null);
            await expect(service.createPaymentLink(validInvoice))
                .rejects.toThrow('Supabase nicht konfiguriert');
        });

        it('should return error when user not logged in', async () => {
            window.authService.getUser.mockReturnValue(null);
            await expect(service.createPaymentLink(validInvoice))
                .rejects.toThrow('Bitte zuerst anmelden');
        });

        it('should return error when customer email is missing', async () => {
            const noEmailInvoice = { id: 'inv-001', brutto: 100, kunde: { name: 'Max' } };
            const result = await service.createPaymentLink(noEmailInvoice);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Keine Kunden-E-Mail');
        });

        it('should return error when amount is below 50 cents', async () => {
            const lowAmountInvoice = {
                id: 'inv-001',
                brutto: 0.30,
                kunde: { name: 'Max', email: 'max@example.com' }
            };
            const result = await service.createPaymentLink(lowAmountInvoice);
            expect(result.success).toBe(false);
            expect(result.error).toContain('mindestens 0,50 EUR');
        });

        it('should accept amount of exactly 0.50 EUR (50 cents)', async () => {
            const minInvoice = {
                id: 'inv-001',
                brutto: 0.50,
                kunde: { name: 'Max', email: 'max@example.com' }
            };
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/c/cs_test', sessionId: 'cs_test' },
                error: null
            });

            const result = await service.createPaymentLink(minInvoice);
            expect(result.success).toBe(true);
        });

        it('should send correct amount in cents to edge function', async () => {
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/c/cs_test', sessionId: 'cs_test' },
                error: null
            });

            await service.createPaymentLink(validInvoice);

            expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
                'create-checkout',
                expect.objectContaining({
                    body: expect.objectContaining({
                        amount: 11900,
                        customer_email: 'max@example.com',
                        invoice_id: 'inv-001',
                        invoice_number: 'RE-2026-001'
                    })
                })
            );
        });

        it('should return success with url and metadata on success', async () => {
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/c/cs_test', sessionId: 'cs_abc' },
                error: null
            });

            const result = await service.createPaymentLink(validInvoice);
            expect(result.success).toBe(true);
            expect(result.url).toBe('https://checkout.stripe.com/c/cs_test');
            expect(result.sessionId).toBe('cs_abc');
            expect(result.invoiceId).toBe('inv-001');
            expect(result.invoiceNumber).toBe('RE-2026-001');
        });

        it('should return error when edge function returns error', async () => {
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Rate limited' }
            });

            const result = await service.createPaymentLink(validInvoice);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Stripe-Fehler');
        });

        it('should return error when no checkout URL in response', async () => {
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: { sessionId: 'cs_abc' },
                error: null
            });

            const result = await service.createPaymentLink(validInvoice);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Keine Checkout-URL');
        });

        it('should use customerEmail fallback when kunde.email is missing', async () => {
            const altInvoice = {
                id: 'inv-002',
                brutto: 50,
                customerEmail: 'fallback@example.com'
            };
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/c/test', sessionId: 'cs_1' },
                error: null
            });

            const result = await service.createPaymentLink(altInvoice);
            expect(result.success).toBe(true);
            expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
                'create-checkout',
                expect.objectContaining({
                    body: expect.objectContaining({
                        customer_email: 'fallback@example.com'
                    })
                })
            );
        });

        it('should use betrag fallback when brutto is missing', async () => {
            const betragInvoice = {
                id: 'inv-003',
                betrag: 75.50,
                kunde: { email: 'max@example.com' }
            };
            mockSupabaseClient.functions.invoke.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/c/test', sessionId: 'cs_1' },
                error: null
            });

            await service.createPaymentLink(betragInvoice);
            expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
                'create-checkout',
                expect.objectContaining({
                    body: expect.objectContaining({ amount: 7550 })
                })
            );
        });
    });

    // --------------------------------------------------------
    // getPaymentStatus
    // --------------------------------------------------------
    describe('getPaymentStatus()', () => {
        it('should return unknown when supabase not configured', async () => {
            window.supabaseConfig.get.mockReturnValue(null);
            const result = await service.getPaymentStatus('inv-001');
            expect(result.status).toBe('unknown');
            expect(result.error).toContain('Supabase');
        });

        it('should return payment details when payment found', async () => {
            const queryBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({
                    data: [{
                        payment_status: 'succeeded',
                        created_at: '2026-03-10T12:00:00Z',
                        amount: 11900,
                        payment_method: 'card'
                    }]
                })
            };
            mockSupabaseClient.from.mockReturnValue(queryBuilder);

            const result = await service.getPaymentStatus('inv-001');
            expect(result.status).toBe('succeeded');
            expect(result.amount).toBe(119);
            expect(result.method).toBe('card');
            expect(result.paidAt).toBe('2026-03-10T12:00:00Z');
        });

        it('should return pending when no payment records found', async () => {
            const queryBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: [] })
            };
            mockSupabaseClient.from.mockReturnValue(queryBuilder);

            const result = await service.getPaymentStatus('inv-001');
            expect(result.status).toBe('pending');
        });

        it('should return pending when data is null', async () => {
            const queryBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: null })
            };
            mockSupabaseClient.from.mockReturnValue(queryBuilder);

            const result = await service.getPaymentStatus('inv-001');
            expect(result.status).toBe('pending');
        });

        it('should return unknown on query error', async () => {
            const queryBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockRejectedValue(new Error('Connection timeout'))
            };
            mockSupabaseClient.from.mockReturnValue(queryBuilder);

            const result = await service.getPaymentStatus('inv-001');
            expect(result.status).toBe('unknown');
            expect(result.error).toBe('Connection timeout');
        });

        it('should query stripe_payments table with correct invoice id', async () => {
            const queryBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: [] })
            };
            mockSupabaseClient.from.mockReturnValue(queryBuilder);

            await service.getPaymentStatus('inv-xyz');

            expect(mockSupabaseClient.from).toHaveBeenCalledWith('stripe_payments');
            expect(queryBuilder.eq).toHaveBeenCalledWith('invoice_id', 'inv-xyz');
        });
    });

    // --------------------------------------------------------
    // generatePaymentButton
    // --------------------------------------------------------
    describe('generatePaymentButton()', () => {
        const invoice = {
            id: 'inv-001',
            nummer: 'RE-2026-001',
            brutto: 119.00,
            kunde: { name: 'Max', email: 'max@example.com' }
        };

        it('should use provided checkoutUrl without calling createPaymentLink', async () => {
            const html = await service.generatePaymentButton(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/preset'
            });
            expect(html).toContain('https://checkout.stripe.com/c/preset');
            expect(mockSupabaseClient.functions.invoke).not.toHaveBeenCalled();
        });

        it('should contain default button text', async () => {
            const html = await service.generatePaymentButton(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test'
            });
            expect(html).toContain('Jetzt bezahlen');
        });

        it('should use custom button text', async () => {
            const html = await service.generatePaymentButton(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test',
                buttonText: 'Pay Now'
            });
            expect(html).toContain('Pay Now');
        });

        it('should use default accent color #6366f1', async () => {
            const html = await service.generatePaymentButton(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test'
            });
            expect(html).toContain('#6366f1');
        });

        it('should include invoice number in output', async () => {
            const html = await service.generatePaymentButton(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test'
            });
            expect(html).toContain('RE-2026-001');
        });

        it('should contain formatted EUR amount', async () => {
            const html = await service.generatePaymentButton(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test'
            });
            // Intl formats 119 as "119,00 €" in de-DE
            expect(html).toContain('119,00');
        });
    });

    // --------------------------------------------------------
    // generatePaymentEmailHTML
    // --------------------------------------------------------
    describe('generatePaymentEmailHTML()', () => {
        const invoice = {
            id: 'inv-001',
            nummer: 'RE-2026-001',
            brutto: 250.00,
            kunde: { name: 'Hans Meier', email: 'hans@example.com' }
        };

        it('should return full HTML document', async () => {
            const html = await service.generatePaymentEmailHTML(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test',
                companyName: 'Musterfirma GmbH'
            });
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('</html>');
        });

        it('should include company name in header', async () => {
            const html = await service.generatePaymentEmailHTML(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test',
                companyName: 'Musterfirma GmbH'
            });
            expect(html).toContain('Musterfirma GmbH');
        });

        it('should fall back to FreyAI Visions as company name', async () => {
            const html = await service.generatePaymentEmailHTML(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test'
            });
            expect(html).toContain('FreyAI Visions');
        });

        it('should include customer greeting', async () => {
            const html = await service.generatePaymentEmailHTML(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test'
            });
            expect(html).toContain('Hans Meier');
        });

        it('should include invoice number', async () => {
            const html = await service.generatePaymentEmailHTML(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test'
            });
            expect(html).toContain('RE-2026-001');
        });

        it('should include the payment button HTML', async () => {
            const html = await service.generatePaymentEmailHTML(invoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test'
            });
            expect(html).toContain('Jetzt bezahlen');
            expect(html).toContain('https://checkout.stripe.com/c/test');
        });

        it('should default customer name to Kunde when not provided', async () => {
            const noNameInvoice = {
                id: 'inv-002',
                brutto: 50,
                kunde: { email: 'anon@example.com' }
            };
            const html = await service.generatePaymentEmailHTML(noNameInvoice, {
                checkoutUrl: 'https://checkout.stripe.com/c/test'
            });
            expect(html).toContain('Sehr geehrte/r Kunde');
        });
    });
});
