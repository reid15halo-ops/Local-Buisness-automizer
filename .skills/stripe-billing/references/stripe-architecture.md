# Stripe Architecture — FreyAI Visions

## Integration Map

```
Frontend (js/services/stripe-service.js)
  ├─→ createCheckoutSession() → Edge Function → Stripe Checkout
  ├─→ createPortalSession() → Edge Function → Stripe Customer Portal
  ├─→ getSubscriptionStatus() → profiles table
  └─→ displayPricingPlans() → Static plan data

Stripe Events (webhooks)
  → supabase/functions/stripe-webhook/
    → Validates signature
    → Processes event
    → Updates: stripe_payments, profiles

Edge Functions
  ├─→ create-checkout-session/ → Creates Stripe Checkout
  ├─→ create-checkout/ → Alternative checkout path
  ├─→ create-portal-session/ → Customer Portal
  └─→ stripe-webhook/ → Event processor
```

## stripe-service.js — Key Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `createCheckoutSession(options)` | Redirect to Stripe Checkout | `{ url }` |
| `createPortalSession(options)` | Redirect to Customer Portal | `{ url }` |
| `getSubscriptionStatus()` | Current subscription state | `{ status, tier, periodEnd }` |
| `getPricingPlans()` | Available plans for display | `Plan[]` |
| `handleCheckoutSuccess()` | Post-checkout redirect handler | void |
| `handleCheckoutCancel()` | Cancelled checkout handler | void |

## Pricing Plans

| Tier | Monthly (€) | Stripe Price ID Pattern | Features |
|------|-------------|------------------------|----------|
| Starter | 39 | `price_starter_monthly` | Basic CRM, email, support |
| Professional | 99 | `price_professional_monthly` | Full suite, AI, priority |
| Enterprise | 299 | `price_enterprise_monthly` | Custom, multi-location, SLA |

## Data Flow: Checkout → Payment

```
1. User clicks "Jetzt starten" on pricing page
2. Frontend: stripeService.createCheckoutSession({
     priceId, userId, customerEmail, successUrl, cancelUrl
   })
3. Edge Function: create-checkout-session
   - Finds or creates Stripe Customer
   - Creates Checkout Session with metadata
   - Returns session URL
4. User redirected to Stripe Checkout
5. Payment succeeds → Stripe fires webhook events
6. Edge Function: stripe-webhook
   - checkout.session.completed → creates subscription record
   - invoice.paid → records payment
7. profiles table updated with subscription status
8. User redirected to successUrl
```

## Kleinunternehmer Impact

As Kleinunternehmer (§19 UStG), FreyAI:
- Does NOT collect VAT
- Does NOT configure Stripe Tax
- Does NOT add tax rates to products/prices
- Prices shown = prices charged (netto = brutto)
- Stripe invoices must NOT show a tax line
- Must add note: "Gemäß §19 UStG wird keine Umsatzsteuer berechnet."

### Stripe Configuration Required
```
automatic_tax: { enabled: false }
tax_behavior: 'inclusive'  // or simply don't set tax
// NO tax_rates array
// NO tax_id_collection
```

## Database Tables

### stripe_payments
Records each successful payment for audit/display:
- `stripe_payment_id` — Stripe's payment intent ID (unique)
- `stripe_customer_id` — Links to Stripe customer
- `stripe_subscription_id` — Links to subscription
- `amount` — In EUR (converted from cents)
- `status` — succeeded, failed, pending
- `plan_tier` — starter, professional, enterprise
- `invoice_url` — Link to Stripe-hosted invoice

### profiles (subscription columns)
- `stripe_customer_id` — Stripe customer reference
- `subscription_status` — active, past_due, canceled, unpaid, trialing
- `subscription_tier` — Current plan tier
- `subscription_period_end` — When current period expires

## Security Considerations

1. **Webhook signature verification** — Always validate `stripe-signature` header
2. **Service role key** — Webhook handler uses Supabase service role (not anon)
3. **No PII in logs** — Don't log customer emails or payment methods
4. **Idempotency** — Check `stripe_payment_id` uniqueness before inserting
5. **CORS** — Edge Functions handle CORS headers for frontend calls
