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
            if (e.message.includes('Ungültige')) {throw e;}
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
     * Generates a Stripe Checkout Session with:
     * - Amount in cents (EUR)
     * - Invoice number as reference/metadata
     * - Success/Cancel URLs
     * - Customer email pre-filled
     * - German locale (de)
     *
     * @param {Object} invoice - Invoice object with id, betrag/amount, kunde, nummer
     * @returns {Promise<Object>} Payment link object with url
     */
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
            // Get customer email
            const customerEmail = invoice.kunde?.email || invoice.customerEmail || null;
            if (!customerEmail) {
                throw new Error('Keine Kunden-E-Mail in der Rechnung hinterlegt');
            }

            // Calculate amount in cents (EUR)
            const amount = Math.round((invoice.brutto || invoice.betrag || invoice.amount || 0) * 100);
            if (amount < 50) {
                throw new Error('Rechnungsbetrag muss mindestens 0,50 EUR betragen');
            }

            // Build description with invoice number
            const invoiceNumber = invoice.nummer || invoice.rechnung_id || invoice.id;
            const customerName = invoice.kunde?.name || invoice.kunde_name || '';
            const description = `Rechnung ${invoiceNumber}${customerName ? ` - ${customerName}` : ''}`;

            // Build redirect URLs
            const baseUrl = window.location.origin;
            const successUrl = `${baseUrl}/index.html?payment=success&invoice=${invoice.id}`;
            const cancelUrl = `${baseUrl}/index.html?payment=cancelled&invoice=${invoice.id}`;

            // Call Supabase Edge Function to create Stripe Checkout session
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

    /**
     * Generate an HTML payment button for embedding in invoice emails.
     * Returns a styled "Jetzt bezahlen" link that opens Stripe Checkout.
     *
     * @param {Object} invoice - Invoice object (must have id, betrag/brutto, kunde)
     * @param {Object} [options] - Optional overrides
     * @param {string} [options.checkoutUrl] - Pre-generated checkout URL (skips createPaymentLink)
     * @param {string} [options.buttonText] - Button label (default: "Jetzt bezahlen")
     * @param {string} [options.accentColor] - Button background color (default: #6366f1)
     * @returns {Promise<string>} HTML string with styled payment button
     */
    async generatePaymentButton(invoice, options = {}) {
        const {
            checkoutUrl = null,
            buttonText = 'Jetzt bezahlen',
            accentColor = '#6366f1'
        } = options;

        let url = checkoutUrl;

        // Generate checkout URL if not provided
        if (!url) {
            const result = await this.createPaymentLink(invoice);
            if (!result.success) {
                throw new Error(result.error || 'Zahlungslink konnte nicht generiert werden');
            }
            url = result.url;
        }

        // Format amount for display
        const amount = invoice.brutto || invoice.betrag || invoice.amount || 0;
        const formattedAmount = new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);

        const invoiceNumber = invoice.nummer || invoice.rechnung_id || invoice.id;

        // Return email-safe HTML button (inline styles for maximum email client compatibility)
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

    /**
     * Generate a complete invoice payment email body with the payment button.
     *
     * @param {Object} invoice - Invoice object
     * @param {Object} [options] - Optional overrides
     * @param {string} [options.companyName] - Sender company name
     * @param {string} [options.checkoutUrl] - Pre-generated checkout URL
     * @returns {Promise<string>} Full HTML email body
     */
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

    /**
     * Get payment status for an invoice
     * @param {string} invoiceId - Invoice ID
     * @returns {Promise<Object>} Payment status
     */
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
                    amount: data[0].amount / 100, // Convert cents to EUR
                    method: data[0].payment_method
                };
            }

            return { status: 'pending' };
        } catch (err) {
            console.warn('Zahlungsstatus-Abfrage fehlgeschlagen:', err);
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
                throw new Error(result.error || 'Zahlungsseite konnte nicht geöffnet werden');
            }
        } catch (err) {
            console.error('Checkout-Fehler:', err);
            throw err;
        }
    }
}

window.stripeService = new StripeService();
