# Edge Functions Guide — FreyAI Visions

Patterns, boilerplate, and deployment checklist for Supabase Edge Functions.

## Directory Structure

```
supabase/functions/
├── ai-proxy/index.ts              # Gemini AI proxy (user-facing)
├── check-overdue/index.ts         # Invoice reminder cron (internal)
├── create-checkout/index.ts       # Stripe checkout (user-facing)
├── create-checkout-session/index.ts # Stripe session (user-facing)
├── create-portal-session/index.ts # Stripe billing portal (user-facing)
├── portal-api/index.ts            # Customer portal API (public)
├── process-call-recording/index.ts # Call transcription (internal)
├── process-inbound-email/index.ts # Inbound email handler (webhook)
├── run-automation/index.ts        # n8n automation trigger (internal)
├── run-webhook/index.ts           # Generic webhook handler (internal)
├── send-email/index.ts            # Email via relay (internal)
├── send-notification/index.ts     # Multi-channel notification (internal)
├── send-sms/index.ts              # SMS via Twilio (internal)
├── stripe-webhook/index.ts        # Stripe event handler (webhook)
└── canva-proxy/index.ts           # Canva API proxy (user-facing)
```

## Boilerplate Template

```typescript
// Supabase Edge Function: [Name]
// Deploy: supabase functions deploy [name]
// Env vars: [LIST_REQUIRED_VARS]

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // CORS preflight — required for browser calls
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Parse request body (if needed)
        const body = await req.json().catch(() => ({}))

        // ... function logic ...

        return new Response(
            JSON.stringify({ success: true, data: {} }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        console.error('[function-name]', err)
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
```

## Auth Patterns

### Pattern 1: User-facing (JWT from client)

For functions called from the frontend with the user's session token:

```typescript
// Extract user from JWT
const authHeader = req.headers.get('Authorization') ?? ''
const token = authHeader.replace('Bearer ', '')

const { data: { user }, error: authError } = await supabase.auth.getUser(token)
if (authError || !user) {
    return new Response(
        JSON.stringify({ error: 'Nicht autorisiert' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

// Use user.id for scoped queries
const { data } = await supabase
    .from('kunden')
    .select('*')
    .eq('user_id', user.id)
```

### Pattern 2: Internal/Cron (service_role validation)

For functions called by pg_cron or n8n — validate the caller has service_role:

```typescript
const callerAuth = req.headers.get('Authorization') ?? ''
const expectedKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
if (!expectedKey || callerAuth !== `Bearer ${expectedKey}`) {
    return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}
```

### Pattern 3: Webhook (secret validation, no JWT)

For external webhooks (Stripe, Resend). Deploy with `--no-verify-jwt`:

```typescript
// Stripe webhook signature validation
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const signature = req.headers.get('stripe-signature')!
const body = await req.text()
const event = stripe.webhooks.constructEvent(
    body,
    signature,
    Deno.env.get('STRIPE_WEBHOOK_SECRET')!
)
```

## Environment Variables

All env vars are set via Supabase Dashboard > Edge Functions > Secrets.

### Always available (auto-injected)
- `SUPABASE_URL` — Project URL
- `SUPABASE_ANON_KEY` — Anon key (for client-scoped operations)
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (bypasses RLS)

### Per-function secrets
| Variable | Used by | Purpose |
|----------|---------|---------|
| `ALLOWED_ORIGIN` | All | CORS origin (default: `https://app.freyaivisions.de`) |
| `GEMINI_API_KEY` | ai-proxy, process-inbound-email | Google Gemini API |
| `STRIPE_SECRET_KEY` | create-checkout*, stripe-webhook | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | Webhook signature validation |
| `EMAIL_RELAY_URL` | send-email, check-overdue, run-automation | VPS email relay endpoint |
| `EMAIL_RELAY_SECRET` | send-email, check-overdue, run-automation | Email relay auth |
| `TWILIO_ACCOUNT_SID` | send-sms, send-notification, run-automation | Twilio SMS |
| `TWILIO_AUTH_TOKEN` | send-sms, send-notification, run-automation | Twilio auth |
| `TWILIO_FROM_NUMBER` | send-sms, run-automation | SMS sender number |
| `TELEGRAM_BOT_TOKEN` | send-notification | Telegram bot |
| `TELEGRAM_CHAT_ID` | send-notification | Telegram chat target |
| `RESEND_API_KEY` | process-inbound-email | Resend email service |

## Deployment Checklist

1. Create function directory: `supabase/functions/[name]/index.ts`
2. Set required env vars in Supabase Dashboard
3. Deploy: `supabase functions deploy [name]`
4. For webhook functions: `supabase functions deploy [name] --no-verify-jwt`
5. Test with curl:
   ```bash
   curl -X POST https://incbhhaiiayohrjqevog.supabase.co/functions/v1/[name] \
     -H "Authorization: Bearer <KEY>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
6. Update schema comment header in `config/sql/supabase-schema.sql` if adding new function

## Calling Edge Functions from Frontend

```javascript
const { data, error } = await window.supabaseConfig.get()
    .functions.invoke('function-name', {
        body: { key: 'value' }
    });
```

The client automatically includes the user's JWT in the Authorization header.
