# Stripe Webhook Events — FreyAI Visions

## Event Matrix

### Checkout Events

| Event | When | Action Required |
|-------|------|-----------------|
| `checkout.session.completed` | Customer completes checkout | Create/update subscription in profiles, record initial payment |
| `checkout.session.expired` | Session expires (24h default) | Log for analytics, no action needed |

### Invoice Events

| Event | When | Action Required |
|-------|------|-----------------|
| `invoice.paid` | Monthly invoice charged successfully | Insert into `stripe_payments`, update `subscription_status: 'active'` |
| `invoice.payment_failed` | Payment method declined | Update `subscription_status: 'past_due'`, send notification email |
| `invoice.created` | Stripe generates upcoming invoice | No action (informational) |
| `invoice.finalized` | Invoice ready for payment | No action (informational) |

### Subscription Events

| Event | When | Action Required |
|-------|------|-----------------|
| `customer.subscription.created` | New subscription starts | Update profiles with tier, status, period_end |
| `customer.subscription.updated` | Plan change, trial end, renewal | Sync tier/status/period_end to profiles |
| `customer.subscription.deleted` | Subscription cancelled and expired | Set `subscription_status: 'canceled'`, clear tier |
| `customer.subscription.trial_will_end` | Trial ending in 3 days | Send reminder email |

### Customer Events

| Event | When | Action Required |
|-------|------|-----------------|
| `customer.created` | New Stripe customer created | Store `stripe_customer_id` in profiles |
| `customer.updated` | Customer details changed | Sync if relevant |
| `customer.deleted` | Customer deleted in Stripe | Clear `stripe_customer_id` from profiles |

## Webhook Handler Structure

```typescript
// supabase/functions/stripe-webhook/index.ts
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

switch (event.type) {
  case 'checkout.session.completed':
    await handleCheckoutCompleted(event.data.object);
    break;
  case 'invoice.paid':
    await handleInvoicePaid(event.data.object);
    break;
  case 'invoice.payment_failed':
    await handlePaymentFailed(event.data.object);
    break;
  case 'customer.subscription.updated':
    await handleSubscriptionUpdated(event.data.object);
    break;
  case 'customer.subscription.deleted':
    await handleSubscriptionDeleted(event.data.object);
    break;
}
```

## Handler Details

### handleCheckoutCompleted
```
Input: session { customer, subscription, metadata.user_id }
1. Get user_id from metadata
2. Update profiles: stripe_customer_id, subscription_status = 'active'
3. Get subscription details → set tier from price lookup
4. Set subscription_period_end from subscription.current_period_end
```

### handleInvoicePaid
```
Input: invoice { customer, subscription, amount_paid, hosted_invoice_url }
1. Check idempotency: SELECT FROM stripe_payments WHERE stripe_payment_id = invoice.id
2. If not exists: INSERT into stripe_payments
3. Update profiles: subscription_status = 'active'
4. Amount: invoice.amount_paid / 100 (cents → EUR)
5. CRITICAL: Do NOT add VAT calculation (Kleinunternehmer)
```

### handlePaymentFailed
```
Input: invoice { customer, subscription, attempt_count }
1. Update profiles: subscription_status = 'past_due'
2. Send notification email to user
3. Stripe handles retry logic (3 attempts over ~2 weeks)
4. After all retries fail → subscription.deleted event
```

### handleSubscriptionDeleted
```
Input: subscription { customer, id }
1. Update profiles: subscription_status = 'canceled'
2. Clear subscription_tier (or keep for reference)
3. Set subscription_period_end to now
4. User retains access until original period_end (grace period)
```

## Testing Webhooks

### Stripe CLI (local development)
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

### Stripe Dashboard (production)
1. Go to Developers → Webhooks
2. Add endpoint: `https://incbhhaiiayohrjqevog.supabase.co/functions/v1/stripe-webhook`
3. Select events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted

## Common Issues

1. **Duplicate payments**: Missing idempotency check → duplicate rows in stripe_payments
2. **Wrong user**: Missing `metadata.user_id` on checkout → can't link payment to profile
3. **VAT bug**: Webhook hardcodes 19% tax → wrong amounts stored (Kleinunternehmer!)
4. **Stale status**: Subscription updated but profiles not synced → UI shows wrong plan
5. **Signature failure**: Wrong webhook secret → all events rejected (500 errors)
