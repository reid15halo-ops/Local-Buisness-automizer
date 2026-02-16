# Stripe Integration Deployment Guide

Step-by-step instructions for deploying Stripe payment integration to production.

## Pre-Deployment Checklist

- [ ] Stripe account created and verified
- [ ] Supabase project configured
- [ ] Edge Functions ready for deployment
- [ ] Domain name configured (for webhook URLs)
- [ ] SSL certificate installed (HTTPS required)

## Step 1: Stripe Setup (5 minutes)

### 1.1 Create Stripe Account

1. Visit https://dashboard.stripe.com/register
2. Sign up with email or Google account
3. Verify email and set up your account
4. Complete initial business setup

### 1.2 Get API Keys

1. Go to Developers → API Keys (https://dashboard.stripe.com/apikeys)
2. Make sure you're in **Live Mode** (toggle at top)
3. Copy the **Publishable key** (starts with `pk_live_`)
4. Copy the **Secret key** (starts with `sk_live_`)
5. Store these securely (you'll need them in Step 2)

### 1.3 Create Webhook Endpoint

1. Go to Developers → Webhooks (https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter endpoint URL: `https://your-domain.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_`)

## Step 2: Supabase Configuration (10 minutes)

### 2.1 Set Environment Variables

1. Open Supabase Dashboard
2. Go to Project Settings → Environment
3. Add the following variables under "Secrets":

```
STRIPE_SECRET_KEY = sk_live_xxxxx
STRIPE_WEBHOOK_SECRET = whsec_xxxxx
```

**Important**: These are sensitive values - never commit to git!

### 2.2 Verify Edge Function Access

Check that your Edge Functions have access to these variables:

```bash
# From your project directory
supabase functions list

# Should show:
# create-checkout (deployed)
# stripe-webhook (deployed)
```

### 2.3 Deploy Edge Functions

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login to your Supabase account
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the checkout function
supabase functions deploy create-checkout

# Deploy the webhook handler
supabase functions deploy stripe-webhook

# Verify deployment
supabase functions list
```

## Step 3: Frontend Configuration (5 minutes)

### 3.1 Update App Settings

The app will auto-detect Stripe configuration via the Setup Wizard.

1. Open your app
2. Go to Settings → Setup Wizard
3. Complete the Stripe step:
   - Publishable Key: Paste your `pk_live_xxxxx`
   - Save configuration

The publishable key is stored in browser localStorage and is safe to expose client-side.

### 3.2 Verify Stripe Initialization

Open browser console and run:

```javascript
console.log(window.stripeService.isConfigured()); // Should be true
console.log(window.stripeService.stripe);         // Should be Stripe object
```

## Step 4: Testing (15 minutes)

### 4.1 Manual Payment Test

1. Create a test invoice with amount €5.00+
2. Click "💳 Zahlen" (Pay) button
3. Should redirect to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`
5. Fill in any date and CVC
6. Complete checkout

### 4.2 Verify Webhook

After payment:

1. Check Supabase Edge Function logs:
   - Dashboard → Edge Functions → stripe-webhook → Invocations
2. Should see `checkout.session.completed` event
3. Check invoice status - should be "bezahlt" (paid)

### 4.3 Test Webhook Locally (Optional)

If making changes to webhook handler:

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli/installation

# Login
stripe login

# Listen for events
stripe listen --forward-to localhost:3000/functions/v1/stripe-webhook

# Trigger test event
stripe trigger checkout.session.completed
```

## Step 5: Database Schema (Optional)

If you want to track payments in database:

### 5.1 Create Tables

In Supabase SQL Editor, run:

```sql
-- Stripe payment records
CREATE TABLE IF NOT EXISTS stripe_payments (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    stripe_session_id VARCHAR NOT NULL UNIQUE,
    stripe_customer_id VARCHAR NOT NULL,
    invoice_id VARCHAR NOT NULL,
    amount BIGINT NOT NULL, -- in cents (EUR)
    currency VARCHAR(3) DEFAULT 'EUR',
    payment_status VARCHAR NOT NULL,
    payment_method VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Create index for lookups
CREATE INDEX idx_stripe_payments_invoice ON stripe_payments(invoice_id);
CREATE INDEX idx_stripe_payments_session ON stripe_payments(stripe_session_id);
```

### 5.2 Update Invoices Table

If you have an invoices table:

```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'offen';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_id VARCHAR;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
```

## Step 6: Production Hardening (10 minutes)

### 6.1 Security Best Practices

1. **Secret Rotation**
   ```bash
   # Rotate Webhook Signing Secret monthly
   # Stripe Dashboard → Webhooks → Edit endpoint → Rotate
   # Update STRIPE_WEBHOOK_SECRET in Supabase
   ```

2. **Rate Limiting**
   - Enable rate limiting in Supabase for Edge Functions
   - Limit webhook handler to prevent abuse

3. **Monitoring**
   - Set up error alerts for failed transactions
   - Monitor webhook delivery failures
   - Log all payment events for audit

### 6.2 Error Handling

Webhook handler already includes:
- Signature verification
- Error logging
- Graceful degradation
- Transaction safety

### 6.3 Customer Communication

1. **Email Confirmation**
   - Webhook sends email confirmation on payment
   - Review email templates in communication service

2. **Payment Link Format**
   - Share payment links via email
   - Include invoice details and amount

## Step 7: Monitoring & Maintenance (Ongoing)

### 7.1 Monitor Payment Processing

**Supabase Dashboard:**
1. Edge Functions → stripe-webhook → Invocations
2. Check logs for errors
3. Monitor function performance

**Stripe Dashboard:**
1. Developers → Webhooks → Check recent deliveries
2. Payments → Look for failed transactions
3. Customers → View transaction history

### 7.2 Regular Maintenance

**Weekly:**
- [ ] Check webhook logs for errors
- [ ] Review payment statistics
- [ ] Monitor failed transactions

**Monthly:**
- [ ] Verify webhook delivery success rate (should be >99%)
- [ ] Rotate webhook signing secret
- [ ] Review security logs
- [ ] Test payment flow end-to-end

**Quarterly:**
- [ ] Audit Stripe account security
- [ ] Review API key usage
- [ ] Test disaster recovery procedures

### 7.3 Health Check Script

```javascript
// Run in browser console to verify integration
async function checkStripeIntegration() {
    console.log('=== Stripe Integration Check ===');

    console.log('✓ Service configured:', window.stripeService.isConfigured());
    console.log('✓ Stripe object loaded:', !!window.stripeService.stripe);
    console.log('✓ Payment service ready:', !!window.paymentService);
    console.log('✓ Supabase functions available:', !!window.supabaseConfig?.get());

    // Test Edge Function connectivity
    const supabase = window.supabaseConfig?.get();
    if (supabase) {
        try {
            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: { test: true }
            });
            console.log('✓ Edge Function accessible');
        } catch (err) {
            console.error('✗ Edge Function error:', err.message);
        }
    }
}

checkStripeIntegration();
```

## Troubleshooting

### Problem: "Stripe not configured"

**Solution:**
1. Verify publishable key is saved in localStorage:
   ```javascript
   console.log(localStorage.getItem('stripe_publishable_key'));
   ```
2. Re-run Setup Wizard
3. Check browser console for errors

### Problem: Webhook not updating invoices

**Solution:**
1. Verify webhook is registered: https://dashboard.stripe.com/webhooks
2. Check webhook signing secret in Supabase
3. View Edge Function logs for errors
4. Test webhook delivery in Stripe Dashboard

### Problem: Payment link creation fails

**Solution:**
1. Check customer email is provided
2. Amount must be ≥ €0.50
3. Verify Supabase Edge Function is deployed
4. Check browser console for detailed error

### Problem: "Invalid Signature" errors

**Solution:**
1. Verify `STRIPE_WEBHOOK_SECRET` is exactly correct
2. No extra spaces or line breaks
3. Webhook secret starts with `whsec_`
4. Check Stripe Dashboard for latest secret

## Rollback Procedure

If something goes wrong:

```bash
# Disable Edge Functions (keeps data safe)
supabase functions deploy stripe-webhook --update

# Or remove webhook endpoint:
# Stripe Dashboard → Webhooks → Delete endpoint

# Revert Supabase variables:
# Project Settings → Environment → Delete STRIPE_* variables

# App will fall back to PayPal links
```

## Support Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Supabase Functions**: https://supabase.com/docs/guides/functions
- **API Reference**: https://stripe.com/docs/api
- **Webhook Events**: https://stripe.com/docs/api/events/types

## Next Steps

Once Stripe is working:

1. **Automation**: Send payment links automatically
2. **Reminders**: Send payment reminders before due date
3. **Analytics**: Track payment metrics
4. **Multi-currency**: Support multiple payment currencies
5. **Recurring**: Set up automatic recurring billing

---

**Last updated**: 2024
**Stripe API version**: 2024-12-18.acacia
**Status**: Production Ready
