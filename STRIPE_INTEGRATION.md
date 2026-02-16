# Stripe Payment Integration Guide

This document explains the real Stripe payment integration for invoices (Rechnungen) in the Local Business Automizer.

## Overview

The integration provides:
- **Invoice Payment Links**: Generate Stripe Checkout sessions for invoice payments
- **Multiple Payment Methods**: Card, SEPA Direct Debit, Giropay, Sofort, EPS
- **Webhook Handling**: Automatic invoice status updates on payment completion
- **User Setup Wizard**: Easy configuration of Stripe credentials

## Architecture

### Components

1. **Frontend Services**
   - `js/services/stripe-service.js` - Stripe payment operations (subscriptions + invoices)
   - `js/services/payment-service.js` - Payment link management with Stripe integration
   - `js/services/setup-wizard-service.js` - Configuration wizard with Stripe step

2. **Supabase Edge Functions**
   - `supabase/functions/create-checkout/index.ts` - Creates Stripe Checkout sessions for invoices
   - `supabase/functions/stripe-webhook/index.ts` - Handles Stripe webhook events

## Setup Instructions

### 1. Create Stripe Account

1. Go to https://dashboard.stripe.com/register
2. Create a free account (test mode available)
3. Navigate to Developers → API Keys
4. You'll need:
   - **Publishable Key** (starts with `pk_`)
   - **Secret Key** (starts with `sk_`)

### 2. Configure Supabase Environment Variables

Deploy your Edge Functions first, then set environment variables:

```bash
# In Supabase Dashboard: Project Settings → Environment Variables

# Required
STRIPE_SECRET_KEY=sk_live_xxxxx (or sk_test_xxxxx)
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Note: SECRET_ROLE_KEY is usually pre-configured
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Deploy Edge Functions

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Deploy the checkout function
supabase functions deploy create-checkout

# Deploy the webhook handler
supabase functions deploy stripe-webhook

# Check deployment
supabase functions list
```

### 4. Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Set the URL to: `https://your-supabase-project.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy the **Webhook Signing Secret** (starts with `whsec_`)

### 5. Configure App Settings

1. Open the Local Business Automizer app
2. Go to Settings → Setup Wizard
3. Complete the Stripe step:
   - Enter your **Publishable Key**
   - Leave Secret Key for server-side (already in Supabase)

## Usage

### Creating Payment Links for Invoices

#### From Code

```javascript
// In your invoice UI or module
const invoice = {
    id: 'RE-2024-001',
    nummer: 'RE-2024-001',
    betrag: 99.99,
    kunde: {
        email: 'customer@example.com',
        name: 'John Doe'
    }
};

// Create payment link (with Stripe integration)
const paymentLink = await window.paymentService.createPaymentLink({
    type: 'invoice',
    referenceId: invoice.id,
    referenceType: 'rechnung',
    amount: invoice.betrag,
    description: `Invoice ${invoice.nummer}`,
    customerEmail: invoice.kunde.email,
    customerName: invoice.kunde.name,
    invoiceObject: invoice // Pass full invoice for Stripe
});

if (paymentLink.paymentMethod === 'stripe') {
    // Share payment link with customer
    console.log('Stripe Checkout URL:', paymentLink.url);
} else {
    // Fallback to PayPal
    console.log('PayPal payment URL:', paymentLink.url);
}
```

#### From UI

1. Open an invoice
2. Click "Zahlungslink senden" (Send payment link)
3. This generates a Stripe Checkout URL
4. Share the link with customer via email or message

### Handling Payment Success

When customers complete payment, Stripe sends a webhook event. The webhook handler:

1. Verifies the signature
2. Updates the invoice status to `bezahlt` (paid)
3. Logs the payment in `automation_log` table
4. Optionally sends confirmation email

#### Manual Handling (Optional)

If needed, handle payment success manually:

```javascript
// When customer returns from Stripe Checkout
const invoiceId = new URLSearchParams(window.location.search).get('invoice');
const result = await window.paymentService.handleStripePaymentSuccess(invoiceId);

if (result.success) {
    console.log('Payment confirmed!');
    // Redirect user
}
```

## Payment Flow

```
┌─────────────┐
│   Invoice   │
└──────┬──────┘
       │
       ├─ Click "Send Payment Link"
       ▼
┌─────────────────────────────────────────┐
│ paymentService.createPaymentLink()      │
│  └─ stripeService.createPaymentLink()   │
│     └─ calls create-checkout Edge Fn    │
└──────┬──────────────────────────────────┘
       │
       ▼ (Supabase Edge Function)
┌──────────────────────────────────────────┐
│ create-checkout/index.ts                 │
│  ├─ Create Stripe customer              │
│  ├─ Create Checkout session              │
│  └─ Return checkout URL                  │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Customer visits Checkout URL│
│  (Stripe hosted checkout)    │
└──────┬───────────────────────┘
       │
       ├─ Completes payment
       ▼
┌──────────────────────────────┐
│   Stripe sends webhook       │
│   (checkout.session.completed)
└──────┬───────────────────────┘
       │
       ▼ (Supabase Edge Function)
┌──────────────────────────────────────────┐
│ stripe-webhook/index.ts                  │
│  ├─ Verify webhook signature             │
│  ├─ Update invoice status → 'bezahlt'    │
│  ├─ Log payment in database              │
│  └─ Return 200 OK                        │
└──────────────────────────────────────────┘
```

## Database Schema (Optional)

The webhook handler can update your database if you have these tables:

### stripe_payments table
```sql
CREATE TABLE stripe_payments (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    stripe_session_id VARCHAR NOT NULL UNIQUE,
    stripe_customer_id VARCHAR NOT NULL,
    invoice_id VARCHAR NOT NULL,
    amount BIGINT NOT NULL, -- in cents
    currency VARCHAR(3) DEFAULT 'EUR',
    payment_status VARCHAR NOT NULL,
    payment_method VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);
```

### invoices table extensions
```sql
ALTER TABLE invoices ADD COLUMN status VARCHAR DEFAULT 'offen';
ALTER TABLE invoices ADD COLUMN paid_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN stripe_payment_id VARCHAR;
ALTER TABLE invoices ADD COLUMN payment_method VARCHAR;
```

### automation_log table
```sql
-- Usually already exists, but webhook handler uses it
CREATE TABLE automation_log (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    action VARCHAR NOT NULL,
    target VARCHAR,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Testing

### Test Mode

Use Stripe's test credentials:
- **Publishable**: `pk_test_xxxxx`
- **Secret**: `sk_test_xxxxx`

Test card numbers:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires auth**: `4000 2500 0000 3155`

### Test Webhook Locally

Use Stripe CLI:
```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

## Error Handling

### Common Issues

1. **"Stripe not configured"**
   - Run setup wizard and enter Publishable Key
   - Verify key starts with `pk_`

2. **Webhook not updating invoice**
   - Check Supabase function logs
   - Verify `STRIPE_WEBHOOK_SECRET` is set correctly
   - Confirm webhook endpoint is registered in Stripe Dashboard

3. **Payment link creation fails**
   - Ensure customer email is provided
   - Amount must be at least €0.50
   - Check browser console for detailed error

4. **"Supabase not configured"**
   - Complete Supabase setup in Setup Wizard
   - Verify Edge Functions are deployed

### Debugging

Enable debug logging:
```javascript
// In browser console
localStorage.setItem('DEBUG_STRIPE', 'true');

// Check webhook logs
// Supabase Dashboard → Edge Functions → stripe-webhook → Invocations
```

## Security Notes

1. **Publishable Key** (client-side, safe to expose)
   - Stored in `localStorage`
   - Embedded in client code
   - Only used for Stripe.js initialization

2. **Secret Key** (server-side, NEVER expose)
   - Stored as Supabase Environment Variable
   - Only Edge Functions can access it
   - Used to create Checkout sessions

3. **Webhook Signature Verification**
   - Always verify signature with `STRIPE_WEBHOOK_SECRET`
   - Prevents spoofed webhook events

4. **No PCI Compliance Needed**
   - Stripe Checkout is PCI DSS Level 1
   - You never handle card data directly

## Support

- Stripe Documentation: https://stripe.com/docs
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Stripe API Reference: https://stripe.com/docs/api

## Troubleshooting Checklist

- [ ] Stripe Account created and verified
- [ ] API Keys copied correctly (no extra spaces)
- [ ] Supabase environment variables set
- [ ] Edge Functions deployed and active
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] Webhook signing secret copied correctly
- [ ] App Setup Wizard completed with Publishable Key
- [ ] Test payment link created successfully
- [ ] Webhook logs show successful events
- [ ] Invoice status updated to 'bezahlt' after payment

## Next Steps

1. **Email Integration**: Send payment links via email automatically
2. **Payment Dashboard**: Add payment analytics and statistics
3. **Recurring Invoices**: Set up automatic payment reminders
4. **Multi-currency**: Support payments in multiple currencies
5. **Invoice Numbering**: Automatic invoice sequencing with payment tracking
