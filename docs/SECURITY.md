# Security Configuration - MHS Business Automizer

## Table of Contents
1. [API Key Management](#api-key-management)
2. [Content Security Policy](#content-security-policy)
3. [HTTP Headers](#http-headers)
4. [LocalStorage Security](#localstorage-security)

## API Key Management

### Overview
This application separates sensitive API keys between client-side and server-side storage to prevent key exposure in the browser.

### Client-Side Keys (Stored in localStorage)
These keys are public and safe to store in the browser:
- **Supabase Anon Key**: Public key for database access (read-only by default)
- **Supabase URL**: Public Supabase project URL

### Server-Side Keys (Supabase Environment Variables)
These keys must NEVER be exposed to the browser:
- **GEMINI_API_KEY**: Proxied through Supabase Edge Functions (ai-proxy)
- **RESEND_API_KEY**: Used only in edge functions for email delivery
- **STRIPE_SECRET_KEY**: Used only in edge functions for payment processing
- **EMAIL_RELAY_SECRET**: Used only in edge functions for email relay

### API Key Flow Architecture

#### Gemini AI Requests (Secure Pattern)
```
Client App (localStorage: supabase_anon_key)
    ↓
    │ Authorization: Bearer {access_token}
    ↓
Supabase Edge Function (ai-proxy)
    ├ Authenticates user
    ├ Rate limits (50 requests/hour per user)
    └ Proxies to Google Gemini API
         ├ Uses: GEMINI_API_KEY (env var)
         └ Returns response to client
```

#### Local Development (Fallback)
For local development without Supabase:
- Gemini service can use direct API key from localStorage
- This requires gemini_api_key to be stored locally
- A console warning is displayed when direct API key usage is detected
- **NOT recommended for production**

### Setting Up API Keys for Production

#### 1. Supabase Configuration
```bash
# Set environment variables in Supabase Dashboard
# Go to: Settings > Edge Functions > Environment variables

GEMINI_API_KEY=AIzaSy...
RESEND_API_KEY=re_...
STRIPE_SECRET_KEY=sk_live_...
EMAIL_RELAY_SECRET=your-secret
```

#### 2. Deploy Edge Functions
```bash
supabase functions deploy ai-proxy
supabase functions deploy send-email
supabase functions deploy create-checkout-session
# ... other functions
```

#### 3. Client Configuration
Users only need to configure:
- Supabase URL
- Supabase Anon Key
- (Optional for local dev: Gemini API key in setup wizard)

### Rate Limiting
The AI proxy enforces rate limiting to prevent abuse:
- **Limit**: 50 requests per user per hour
- **Returns**: HTTP 429 when exceeded
- **Resets**: Hourly per user ID

### Key Rotation

#### Rotating Gemini API Key
1. Generate new key at https://aistudio.google.com/apikey
2. Update `GEMINI_API_KEY` in Supabase environment variables
3. Delete old key from Google Cloud Console
4. Restart Supabase functions (or they auto-reload)

#### Rotating Resend API Key
1. Generate new key at https://resend.com/api-keys
2. Update `RESEND_API_KEY` in Supabase environment variables
3. Delete old key from Resend dashboard

#### Rotating Stripe Secret Key
1. Generate new restricted API key in Stripe Dashboard
2. Update `STRIPE_SECRET_KEY` in Supabase environment variables
3. Revoke old key from Stripe

### Audit Logging
All API usage is logged to the `automation_log` table:
```sql
INSERT INTO automation_log (user_id, action, target, metadata)
VALUES (
  'user-uuid',
  'ai.gemini_request',
  'gemini-2.0-flash',
  '{"tokens_estimated": 300}'
)
```

## Content Security Policy (CSP)

Recommended header for production deployment (e.g., Apache, Nginx, Vercel logic).

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.sheetjs.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://generativelanguage.googleapis.com https://*.supabase.co;
```

**Notes:**
- `script-src`: Includes `unsafe-inline` for inline event handlers (legacy choice, refactor recommended). Includes `cdn.sheetjs.com` for Excel export.
- `style-src`: Includes `unsafe-inline` for dynamic styles. Includes Google Fonts.
- `font-src`: Google Fonts data.
- `connect-src`: Updated to allow Gemini API and Supabase connections.

## HTTP Headers

```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## LocalStorage Security

The application monitors LocalStorage usage and warns the user when it exceeds 4MB (approx 80% of typical 5MB limit).

### What's Stored in localStorage
**Safe to store (public keys):**
- supabase_url
- supabase_anon_key
- mhs_llm_config (local development settings)

**Never store in localStorage:**
- gemini_api_key (for production - use Supabase proxy instead)
- resend_api_key (server-side only)
- stripe_secret_key (server-side only)
- Any user passwords or session tokens

### LocalStorage Best Practices
1. Clear sensitive data on logout
2. Use HTTPS only (prevents man-in-the-middle access)
3. Set secure CORS headers
4. Implement CSP to prevent script injection
5. Use Supabase edge functions for secret API keys

## Compliance Checklist

- [x] API keys separated into client/server
- [x] Server-side keys via Supabase environment variables
- [x] Edge functions authenticate all requests
- [x] Rate limiting on API proxies
- [x] CORS headers configured
- [x] Audit logging for API usage
- [x] No API keys in version control (.env files excluded)
- [x] HTTPS enforced in production
- [x] CSP headers recommended
- [x] Secrets rotation procedure documented
