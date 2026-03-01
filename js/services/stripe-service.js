/* ============================================
   Stripe Payment Service
   - SaaS-Abonnements: Starter, Professional, Enterprise
   - Invoice/Rechnung Payment Links via Checkout

   Setup:
   1. Stripe-Konto erstellen: https://dashboard.stripe.com
   2. Publishable Key in Einstellungen eintragen (Setup Wizard)
   3. Secret Key in Supabase (Environment Variables)
   4. Webhook-Endpoint einrichten: https://your-domain/functions/v1/stripe-webhook
   ============================================ */

class StripeService {
    constructor() {
        // Pricing Tiers for Subscriptions - Stripe Price IDs
        this.plans = {
            starter: {
                name: 'Starter',
                price: 3900, // in Cent
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

    // Initialize Stripe.js
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

    // Create checkout session via Supabase Edge Function
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

        // Call Supabase Edge Function to create Stripe session
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
            body: {
                priceId: plan.stripePriceId,
                userId: user.id,
                email: user.email,
                successUrl: window.location.origin + '/index.html?payment=success',
                cancelUrl: window.location.origin + '/index.html?payment=cancelled'
            }
        });

        if (error) {throw error;}

        // Redirect to Stripe Checkout
        if (this.stripe && data.sessionId) {
            const { error: stripeError } = await this.stripe.redirectToCheckout({
                sessionId: data.sessionId
            });
            if (stripeError) {throw stripeError;}
        } else if (data.url) {
            this._validateRedirectUrl(data.url);
            window.location.href = data.url;
        }
    }

    // Open Stripe Customer Portal (manage subscription)
    async openBillingPortal() {
        const supabase = window.supabaseConfig?.get();
        if (!supabase) {throw new Error('Supabase nicht konfiguriert');}

        const { data, error } = await supabase.functions.invoke('create-portal-session', {
            body: {
                returnUrl: window.location.origin + '/index.html'
            }
        });

        if (error) {throw error;}

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
            if (e.message.includes('Ungültige')) throw e;
            throw new Error('Ungültige URL für Stripe-Redirect');
        }
    }

    // Get current subscription status
    async getSubscriptionStatus() {
        const supabase = window.supabaseConfig?.get();
        if (!supabase) {return { plan: 'starter', status: 'trialing' };}

        try {
            const user = window.authService?.getUser();
            if (!user) {return { plan: 'starter', status: 'none' };}

            const { data, error } = await supabase
                .from('profiles')
                .select('plan, stripe_subscription_id')
                .eq('id', user.id)
                .single();

            if (error) {throw error;}
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

    // Check if user has access to a feature
    async hasAccess(requiredPlan) {
        const planHierarchy = { starter: 1, professional: 2, enterprise: 3 };
        const status = await this.getSubscriptionStatus();
        return (planHierarchy[status.plan] || 0) >= (planHierarchy[requiredPlan] || 0);
    }

    // Save Stripe configuration
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

    // Render pricing cards (reusable UI component)
    renderPricingCards(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) {return;}

        container.innerHTML = Object.entries(this.plans).map(([key, plan]) => `
            <div class="pricing-card ${key === 'professional' ? 'featured' : ''}">
                <h3>${plan.name}</h3>
                <div class="pricing-amount">${plan.priceFormatted}<span>/Monat</span></div>
                <ul>
                    ${plan.features.map(f => `<li>&#x2713; ${f}</li>`).join('')}
                </ul>
                <button class="btn btn-primary" onclick="window.stripeService.createCheckoutSession('${key}')"
                    ${!this.isConfigured() ? 'disabled title="Stripe nicht konfiguriert"' : ''}>
                    ${key === 'enterprise' ? 'Kontakt aufnehmen' : 'Jetzt upgraden'}
                </button>
            </div>
        `).join('');
    }

    // ========== INVOICE PAYMENT METHODS ==========

    /**
     * Create payment link for an invoice (Rechnung)
     * @param {Object} invoice - Invoice object with id, betrag/amount, kunde
     * @returns {Promise<Object>} Payment link object with url
     */
    async createPaymentLink(invoice) {
        if (!this.publishableKey) {
            throw new Error('Stripe not configured. Please add your publishable key in setup wizard.');
        }

        const supabase = window.supabaseConfig?.get();
        if (!supabase) {
            throw new Error('Supabase not configured');
        }

        const user = window.authService?.getUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        try {
            // Get customer email
            const customerEmail = invoice.kunde?.email || invoice.customerEmail || user.email;
            if (!customerEmail) {
                throw new Error('Customer email not found in invoice');
            }

            // Calculate amount in cents (EUR)
            const amount = Math.round((invoice.betrag || invoice.amount || 0) * 100);
            if (amount < 50) {
                throw new Error('Invoice amount must be at least €0.50');
            }

            // Build description
            const description = `Invoice ${invoice.nummer || invoice.id}`;

            // Build redirect URLs
            const baseUrl = window.location.origin;
            const successUrl = `${baseUrl}/index.html?payment=success&invoice=${invoice.id}`;
            const cancelUrl = `${baseUrl}/index.html?payment=cancelled&invoice=${invoice.id}`;

            // Call Supabase Edge Function to create Stripe Checkout session
            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: {
                    invoice_id: invoice.id,
                    amount: amount,
                    customer_email: customerEmail,
                    description: description,
                    success_url: successUrl,
                    cancel_url: cancelUrl
                }
            });

            if (error) {
                throw new Error(`Stripe error: ${error.message}`);
            }

            if (!data || !data.url) {
                throw new Error('No checkout URL returned from Stripe');
            }

            return {
                success: true,
                url: data.url,
                sessionId: data.sessionId,
                invoiceId: invoice.id
            };
        } catch (err) {
            console.error('Payment link creation failed:', err);
            return {
                success: false,
                error: err.message
            };
        }
    }

    /**
     * Get payment status for an invoice
     * @param {string} invoiceId - Invoice ID
     * @returns {Promise<Object>} Payment status
     */
    async getPaymentStatus(invoiceId) {
        const supabase = window.supabaseConfig?.get();
        if (!supabase) {
            return { status: 'unknown', error: 'Supabase not configured' };
        }

        try {
            // Try to query payment records (optional - depends on database setup)
            const { data, error } = await supabase
                .from('stripe_payments')
                .select('payment_status, created_at, amount')
                .eq('invoice_id', invoiceId)
                .order('created_at', { ascending: false })
                .limit(1)
                .catch(() => ({ data: null, error: null })); // Handle if table doesn't exist

            if (data && data.length > 0) {
                return {
                    status: data[0].payment_status,
                    paidAt: data[0].created_at,
                    amount: data[0].amount / 100 // Convert cents to EUR
                };
            }

            return { status: 'pending' };
        } catch (err) {
            console.warn('Payment status check failed:', err);
            return { status: 'unknown', error: err.message };
        }
    }

    /**
     * Open invoice payment in a new window
     * @param {Object} invoice - Invoice object
     */
    async openPaymentCheckout(invoice) {
        try {
            const result = await this.createPaymentLink(invoice);
            if (result.success && result.url) {
                window.open(result.url, '_blank');
                return result;
            } else {
                throw new Error(result.error || 'Failed to create payment link');
            }
        } catch (err) {
            console.error('Checkout error:', err);
            throw err;
        }
    }
}

window.stripeService = new StripeService();
