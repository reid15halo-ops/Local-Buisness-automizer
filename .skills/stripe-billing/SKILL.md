---
name: stripe-billing
description: |
  Manage Stripe billing, subscriptions, and payment flows for FreyAI Visions.
  Use this skill when the user asks about Stripe integration, checkout sessions,
  customer portal, webhook handling, subscription lifecycle, payment issues,
  invoice generation, or billing configuration.
  Also trigger when the user says "Stripe setup", "payment flow", "checkout",
  "subscription", "billing portal", "webhook", "Zahlungen", "Abonnement",
  "Rechnung erstellen", or any request involving payment processing.
---

# Stripe Billing Skill — FreyAI Payment Management

Manage Stripe Checkout, Customer Portal, webhooks, subscription lifecycle, and Kleinunternehmer-compliant invoicing for FreyAI Visions.

Read `references/stripe-architecture.md` for the full integration map before making changes.

## 1. Understand the Payment Architecture

FreyAI uses Stripe in **Kleinunternehmer mode** (§19 UStG — NO VAT):

| Component | Location | Purpose |
|-----------|----------|---------|
| `js/services/stripe-service.js` | Frontend | Checkout redirect, portal redirect, plan display |
| `supabase/functions/stripe-webhook/` | Edge Function | Webhook event processing |
| `supabase/functions/create-checkout-session/` | Edge Function | Creates Stripe Checkout sessions |
| `supabase/functions/create-portal-session/` | Edge Function | Creates Customer Portal sessions |
| `stripe_payments` table | Supabase | Payment records (synced from webhooks) |

### Pricing Model (Retainer/SaaS)
```
Starter:      €39/month   (price_starter_monthly, 3900 cents)
Professional: €99/month   (price_professional_monthly, 9900 cents)
Enterprise:   €299/month  (price_enterprise_monthly, 29900 cents)
```

> **Note**: Setup fees (€3.5k–7.5k one-time) are handled via invoice checkout (`create-checkout`), not subscriptions.

## 2. Checkout Flow

### Creating a Checkout Session
```javascript
// Frontend triggers checkout
const { url } = await stripeService.createCheckoutSession({
  priceId: 'price_professional_monthly',
  userId: auth.user.id,
  customerEmail: auth.user.email,
  successUrl: `${window.location.origin}/dashboard?checkout=success`,
  cancelUrl: `${window.location.origin}/pricing?checkout=cancelled`
});
window.location.href = url;
```

### Edge Function (create-checkout-session)
```typescript
// Validates user, creates or retrieves Stripe customer
// Sets metadata: { user_id, plan_tier }
// Returns checkout URL
```

### Key Rules
1. Always pass `user_id` in metadata for webhook correlation
2. Use `customer_email` from auth, never from client input
3. Set `tax_behavior: 'inclusive'` (Kleinunternehmer — price IS the total)
4. No tax rates or tax IDs — §19 UStG means no VAT collection

## 3. Customer Portal

### Portal Session Creation
```javascript
const { url } = await stripeService.createPortalSession({
  customerId: stripeCustomerId,
  returnUrl: `${window.location.origin}/settings/billing`
});
```

### Portal Capabilities
- View/update payment method
- View invoice history
- Cancel subscription
- Change plan (upgrade/downgrade)

## 4. Webhook Processing

### Event Handler Map
Read `references/webhook-events.md` for the complete event matrix.

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription record, update profile |
| `invoice.paid` | Record payment in `stripe_payments` |
| `invoice.payment_failed` | Flag subscription, notify user |
| `customer.subscription.updated` | Sync plan changes |
| `customer.subscription.deleted` | Mark subscription cancelled |

### Critical Webhook Rules
1. **Verify signature**: Always validate `stripe-signature` header
2. **Idempotency**: Check if payment already recorded before inserting
3. **Kleinunternehmer compliance**: Never add VAT/tax lines to invoices
4. **User correlation**: Use `metadata.user_id` to link payments to profiles

## 5. Subscription Lifecycle

```
Free Trial (optional)
  ↓ User selects plan on /pricing
Checkout Session
  ↓ Payment succeeds
Active Subscription
  ↓ Monthly invoice auto-charged
  ├─→ invoice.paid → record payment
  ├─→ invoice.payment_failed → retry logic + notification
  ├─→ customer.subscription.updated → plan change
  └─→ customer.subscription.deleted → cancellation
```

### Status Values
| Status | Meaning |
|--------|---------|
| `active` | Subscription is current and paid |
| `past_due` | Payment failed, in retry period |
| `canceled` | User cancelled, access until period end |
| `unpaid` | All retries failed |
| `trialing` | In free trial period |

## 6. Kleinunternehmer Invoice Rules

**CRITICAL**: FreyAI is a Kleinunternehmer (§19 UStG). All Stripe invoices must:

1. Show **no VAT/MwSt line** — total = net amount
2. Include notice: "Gemäß §19 UStG wird keine Umsatzsteuer berechnet."
3. Never configure Stripe Tax or tax rates
4. Set `automatic_tax: { enabled: false }` on checkout sessions
5. Invoice amounts are always netto = brutto

### Known Bug
The `stripe-webhook` Edge Function may hardcode 19% VAT calculation. Verify and fix:
```typescript
// WRONG: const tax = amount * 0.19;
// RIGHT: const tax = 0; // Kleinunternehmer §19 UStG
```

## 7. Database Schema

### stripe_payments table
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES auth.users(id),
stripe_payment_id TEXT UNIQUE NOT NULL,
stripe_customer_id TEXT,
stripe_subscription_id TEXT,
amount DECIMAL(12,2) NOT NULL,
currency TEXT DEFAULT 'eur',
status TEXT NOT NULL, -- 'succeeded', 'failed', 'pending'
plan_tier TEXT, -- 'starter', 'professional', 'enterprise'
invoice_url TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()
```

### profiles table (subscription fields)
```sql
stripe_customer_id TEXT,
subscription_status TEXT, -- 'active', 'past_due', 'canceled'
subscription_tier TEXT, -- 'starter', 'professional', 'enterprise'
subscription_period_end TIMESTAMPTZ
```

## 8. Quality Checklist

Before deploying any Stripe changes, verify all 10 items:

1. [ ] Webhook signature verification is active (never bypass)
2. [ ] No VAT/tax rates configured (Kleinunternehmer §19 UStG)
3. [ ] `metadata.user_id` set on all checkout sessions
4. [ ] Idempotency check on payment recording (no duplicates)
5. [ ] Customer portal return URL is correct
6. [ ] Subscription status synced to profiles table
7. [ ] Payment failure notifications configured
8. [ ] Success/cancel redirect URLs are absolute and correct
9. [ ] All amounts in cents (Stripe) converted to EUR (display)
10. [ ] No PII logged in webhook handler (DSGVO)

## References

- `references/stripe-architecture.md` — Integration map, service locations, data flow
- `references/webhook-events.md` — Complete webhook event matrix with actions
