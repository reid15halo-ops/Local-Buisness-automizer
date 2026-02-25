/* ============================================
   App Configuration
   Populates window.APP_CONFIG from:
     1. __ENV__ placeholder (replaced at deploy time via build-sw.js or CI)
     2. localStorage keys set by the Setup Wizard
     3. Hard defaults (safe fallbacks for dev / offline)

   The relay secret stored here is NEVER a compile-time secret —
   it is always read from localStorage or injected by the user's
   own server during the hosting setup.  It is NOT shipped with
   the repository.
   ============================================ */

(function () {
    'use strict';

    // ── 1. Build-time injection (replaced by CI / deploy script) ──────────────
    // The deploy pipeline replaces the string literals below with real values.
    // If the placeholder was NOT replaced (local dev), the value stays empty
    // and localStorage is used as the fallback in step 2.
    const BUILD_INJECT = {
        EMAIL_RELAY_URL:    typeof __EMAIL_RELAY_URL__    !== 'undefined' ? __EMAIL_RELAY_URL__    : '',
        EMAIL_RELAY_SECRET: typeof __EMAIL_RELAY_SECRET__ !== 'undefined' ? __EMAIL_RELAY_SECRET__ : '',
        SMS_PROVIDER:       typeof __SMS_PROVIDER__       !== 'undefined' ? __SMS_PROVIDER__       : '',
        TWILIO_ACCOUNT_SID: typeof __TWILIO_ACCOUNT_SID__ !== 'undefined' ? __TWILIO_ACCOUNT_SID__ : '',
        TWILIO_AUTH_TOKEN:  typeof __TWILIO_AUTH_TOKEN__  !== 'undefined' ? __TWILIO_AUTH_TOKEN__  : '',
        TWILIO_FROM_NUMBER: typeof __TWILIO_FROM_NUMBER__ !== 'undefined' ? __TWILIO_FROM_NUMBER__ : '',
        SIPGATE_TOKEN_ID:   typeof __SIPGATE_TOKEN_ID__   !== 'undefined' ? __SIPGATE_TOKEN_ID__   : '',
        SIPGATE_TOKEN:      typeof __SIPGATE_TOKEN__       !== 'undefined' ? __SIPGATE_TOKEN__       : '',
        MESSAGEBIRD_KEY:    typeof __MESSAGEBIRD_KEY__    !== 'undefined' ? __MESSAGEBIRD_KEY__    : '',
        APP_ENV:            typeof __APP_ENV__             !== 'undefined' ? __APP_ENV__             : 'development',
        STAGING:            typeof __STAGING__             !== 'undefined' ? __STAGING__             : false,
    };

    // ── 2. localStorage (Setup Wizard / in-app settings) ─────────────────────
    const LS = {
        EMAIL_RELAY_URL:    localStorage.getItem('freyai_email_relay_url')    || '',
        EMAIL_RELAY_SECRET: localStorage.getItem('freyai_email_relay_secret') || '',
        SMS_PROVIDER:       localStorage.getItem('freyai_sms_provider')       || 'none',
        TWILIO_ACCOUNT_SID: localStorage.getItem('freyai_twilio_account_sid') || '',
        TWILIO_AUTH_TOKEN:  localStorage.getItem('freyai_twilio_auth_token')  || '',
        TWILIO_FROM_NUMBER: localStorage.getItem('freyai_twilio_from_number') || '',
        SIPGATE_TOKEN_ID:   localStorage.getItem('freyai_sipgate_token_id')   || '',
        SIPGATE_TOKEN:      localStorage.getItem('freyai_sipgate_token')       || '',
        MESSAGEBIRD_KEY:    localStorage.getItem('freyai_messagebird_key')    || '',
    };

    // ── 3. Merge: build-time wins, then localStorage, then empty string ────────
    function pick(...values) {
        return values.find(v => v !== '' && v !== undefined && v !== null) || '';
    }

    window.APP_CONFIG = {
        // Email relay
        EMAIL_RELAY_URL:    pick(BUILD_INJECT.EMAIL_RELAY_URL,    LS.EMAIL_RELAY_URL),
        // Relay env var is called API_SECRET on the server; we expose it as EMAIL_RELAY_SECRET
        EMAIL_RELAY_SECRET: pick(BUILD_INJECT.EMAIL_RELAY_SECRET, LS.EMAIL_RELAY_SECRET),

        // SMS
        SMS_PROVIDER:       pick(BUILD_INJECT.SMS_PROVIDER,       LS.SMS_PROVIDER,  'none'),
        TWILIO_ACCOUNT_SID: pick(BUILD_INJECT.TWILIO_ACCOUNT_SID, LS.TWILIO_ACCOUNT_SID),
        TWILIO_AUTH_TOKEN:  pick(BUILD_INJECT.TWILIO_AUTH_TOKEN,  LS.TWILIO_AUTH_TOKEN),
        TWILIO_FROM_NUMBER: pick(BUILD_INJECT.TWILIO_FROM_NUMBER, LS.TWILIO_FROM_NUMBER),
        SIPGATE_TOKEN_ID:   pick(BUILD_INJECT.SIPGATE_TOKEN_ID,   LS.SIPGATE_TOKEN_ID),
        SIPGATE_TOKEN:      pick(BUILD_INJECT.SIPGATE_TOKEN,       LS.SIPGATE_TOKEN),
        MESSAGEBIRD_KEY:    pick(BUILD_INJECT.MESSAGEBIRD_KEY,    LS.MESSAGEBIRD_KEY),

        // App environment
        APP_ENV: pick(BUILD_INJECT.APP_ENV, 'development'),
        STAGING: BUILD_INJECT.STAGING === true || BUILD_INJECT.STAGING === 'true',
    };

    const env = window.APP_CONFIG.APP_ENV;
    const hasRelay = !!window.APP_CONFIG.EMAIL_RELAY_URL;
    console.log(`[APP_CONFIG] env=${env} relay=${hasRelay ? 'configured' : 'not set'} sms=${window.APP_CONFIG.SMS_PROVIDER}`);
})();
