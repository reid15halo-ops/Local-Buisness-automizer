---
name: add-stripe-flow
description: Add a Stripe payment flow — checkout session, customer portal, webhook handling, and invoice sync.
argument-hint: [flow-type]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add Stripe Payment Flow

**Argument:** `$ARGUMENTS` — one of: `checkout`, `portal`, `webhook`, `subscription`, `invoice-sync`

### Steps

1. **Read** `js/services/stripe-service.js` for existing Stripe integration.
2. **Read** `supabase/functions/create-checkout-session/` and `create-portal-session/`.
3. Implement the requested flow.

### Flow Templates

#### checkout — One-time payment
```javascript
async createCheckout(invoiceId) {
    const invoice = this.store.rechnungen.find(r => r.id === invoiceId);
    const { data, error } = await window.freyaiSupabase.functions.invoke('create-checkout-session', {
        body: {
            invoice_id: invoiceId,
            amount: Math.round(invoice.brutto * 100), // cents
            currency: 'eur',
            customer_email: invoice.kunde.email,
            success_url: window.location.origin + '/index.html#payment-success',
            cancel_url: window.location.origin + '/index.html#rechnungen'
        }
    });
    if (data?.url) window.location.href = data.url;
}
```

#### webhook — Payment completion handler
Add to `backend/main.py`:
```python
@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        invoice_id = session["metadata"]["invoice_id"]
        # Update invoice status to 'paid' in Supabase
```

#### invoice-sync — Sync FreyAI invoices to Stripe
Create Stripe Invoice objects from FreyAI rechnungen, enabling Stripe-hosted payment pages.

### Required Config
| Variable | Where |
|----------|-------|
| `STRIPE_SECRET_KEY` | Backend .env |
| `STRIPE_WEBHOOK_SECRET` | Backend .env |
| `STRIPE_PUBLISHABLE_KEY` | Frontend (safe to expose) |
