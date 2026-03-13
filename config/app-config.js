/* ============================================
   App Configuration — localStorage-only (Option C)
   Populates window.APP_CONFIG from localStorage keys
   set by the Setup Wizard inside the main application.

   This is intentionally simple: no secrets are ever
   shipped with the repository or injected at build time.
   The Handwerker configures his relay URL and API secret
   once in the Setup Wizard; values are persisted in
   localStorage and read here at runtime.

   DSGVO note: no personal data is stored in APP_CONFIG.
   ============================================ */
(function () {
    'use strict';

    function ls(key, fallback) {
        try { return localStorage.getItem(key) || fallback; }
        catch (_) { return fallback; }
    }

    window.APP_CONFIG = {
        // ── Email relay ────────────────────────────────────────────────────
        // The relay's server-side env var is API_SECRET.
        // The frontend key name is EMAIL_RELAY_SECRET for clarity.
        // Default relay URL points to the FreyAI VPS proxy (nginx → port 3100).
        // Pilotprojekt customers get this pre-configured; secret is per-tenant.
        EMAIL_RELAY_URL:    ls('freyai_email_relay_url',    'https://app.freyaivisions.de/api'),
        EMAIL_RELAY_SECRET: ls('freyai_email_relay_secret', ''),

        // ── SMS provider ───────────────────────────────────────────────────
        SMS_PROVIDER:       ls('freyai_sms_provider',       'none'),
        TWILIO_ACCOUNT_SID: ls('freyai_twilio_account_sid', ''),
        TWILIO_AUTH_TOKEN:  ls('freyai_twilio_auth_token',  ''),
        TWILIO_FROM_NUMBER: ls('freyai_twilio_from_number', ''),
        SIPGATE_TOKEN_ID:   ls('freyai_sipgate_token_id',   ''),
        SIPGATE_TOKEN:      ls('freyai_sipgate_token',       ''),
        MESSAGEBIRD_KEY:    ls('freyai_messagebird_key',    ''),

        // ── Paperless-ngx DMS ─────────────────────────────────────────────
        PAPERLESS_URL:   ls('freyai_paperless_url',   'https://docs.freyaivisions.de'),
        PAPERLESS_TOKEN: ls('freyai_paperless_token', ''),

        // ── Cal.com Integration ──────────────────────────────────────────
        // API key generated in Cal.com Settings > Developer > API Keys.
        // Set via Setup Wizard or localStorage key 'freyai_calcom_api_key'.
        CALCOM_URL:     ls('freyai_calcom_url',     'https://buchung.freyaivisions.de'),
        CALCOM_API_KEY: ls('freyai_calcom_api_key',  ''),

        // ── Postiz Social Media ──────────────────────────────────────────
        POSTIZ_URL:     ls('freyai_postiz_url',     'https://social.freyaivisions.de'),
        POSTIZ_API_KEY: ls('freyai_postiz_api_key', ''),

        // ── WhatsApp (Evolution API) ──────────────────────────────────────
        WHATSAPP_API_URL:      ls('freyai_whatsapp_api_url',      'https://wa.freyaivisions.de'),
        WHATSAPP_API_KEY:      ls('freyai_whatsapp_api_key',      ''),
        WHATSAPP_INSTANCE:     ls('freyai_whatsapp_instance',     'freyai-whatsapp'),

        // ── GoCardless Open Banking ──────────────────────────────────────
        // GoCardless credentials (SECRET_ID, SECRET_KEY) are now stored server-side
        // as Supabase env vars. All API calls go through the gocardless-proxy Edge Function.
        // Only the account ID is kept client-side for UI reference.
        GOCARDLESS_ACCOUNT_ID: ls('freyai_gocardless_account_id', ''),

        // ── Environment ────────────────────────────────────────────────────
        APP_ENV: ls('freyai_app_env', 'production'),
        STAGING: ls('freyai_staging', 'false') === 'true',
    };

    const cfg = window.APP_CONFIG;
    console.log(
        `[APP_CONFIG] env=${cfg.APP_ENV}`,
        `relay=${cfg.EMAIL_RELAY_URL ? 'configured' : 'not set'}`,
        `sms=${cfg.SMS_PROVIDER}`
    );
})();
