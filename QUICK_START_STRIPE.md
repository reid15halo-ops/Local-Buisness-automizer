# Quick Start: Stripe Integration in 15 Minutes

Get Stripe payment integration running fast.

## Prerequisites

- ✓ Stripe account (free at https://stripe.com)
- ✓ Supabase project configured
- ✓ Edge Functions already deployed
- ✓ Project running locally or in production

## Step 1: Stripe Account Setup (5 min)

1. Visit https://dashboard.stripe.com/register
2. Create account and verify email
3. Go to **Developers → API Keys**
4. Copy these values:
   - **Publishable Key** (starts with `pk_`)
   - **Secret Key** (starts with `sk_`)

## Step 2: Supabase Configuration (3 min)

1. Open Supabase Dashboard
2. Project Settings → Environment
3. Add secrets:
   ```
   STRIPE_SECRET_KEY = sk_live_xxxxx (your secret key)
   ```

4. Deploy Edge Functions:
   ```bash
   supabase functions deploy create-checkout
   supabase functions deploy stripe-webhook
   ```

## Step 3: Stripe Webhook Setup (3 min)

1. In Stripe Dashboard → **Developers → Webhooks**
2. Click **Add endpoint**
3. Enter URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Click Create endpoint
6. Copy **Signing secret** (starts with `whsec_`)
7. Back in Supabase, add to Environment:
   ```
   STRIPE_WEBHOOK_SECRET = whsec_xxxxx
   ```

## Step 4: App Configuration (2 min)

1. Open app → Settings → Setup Wizard
2. Find **Stripe Zahlungen** step
3. Enter your **Publishable Key** (`pk_xxxxx`)
4. Save

Done! 🎉

## Test Payment (2 min)

1. Create an invoice in your app
2. Click "💳 Zahlen" button (or "🔗 Link")
3. Use test card: `4242 4242 4242 4242`
4. Any future date and CVC (e.g., 12/25, 123)
5. Complete payment
6. Invoice should show "bezahlt" (paid)

## Verify Success

Check Supabase logs:
```
Dashboard → Edge Functions → stripe-webhook → Invocations
```

Should see successful webhook event.

## Common Issues

### "Stripe not configured"
- Make sure publishable key is entered in Setup Wizard
- Key should start with `pk_`
- Try browser refresh

### Webhook not updating invoice
- Check `STRIPE_WEBHOOK_SECRET` is set correctly in Supabase
- Verify webhook endpoint in Stripe Dashboard
- Check Edge Function logs

### Payment link won't open
- Confirm Stripe is configured (Step 4)
- Make sure invoice has amount and customer email
- Check browser console for errors

## Next Steps

1. **Production**: Switch from test to live keys
2. **Email**: Auto-send payment links via email
3. **Dashboard**: Add payment statistics
4. **Automation**: Send payment reminders

## Documentation

- **Full Setup**: See `STRIPE_INTEGRATION.md`
- **Deployment**: See `DEPLOYMENT_STRIPE.md`
- **Examples**: See `INVOICE_PAYMENT_INTEGRATION_EXAMPLE.md`

## Support

- Stripe Docs: https://stripe.com/docs
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Project Issues: Check browser console for error messages

---

**Total setup time**: ~15 minutes
**Status**: Ready for production
