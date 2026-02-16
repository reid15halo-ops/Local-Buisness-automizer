/* ============================================================
   FreyAI Core — Supabase Client
   ============================================================
   Initializes the single Supabase client instance used by all
   services. Loaded via <script> before any application code.

   Configuration:
     Set SUPABASE_URL and SUPABASE_ANON_KEY either:
       a) directly below (for quick testing), or
       b) in localStorage keys 'freyai_supabase_url' /
          'freyai_supabase_anon_key' (set via Settings UI).
   ============================================================ */

/**
 * @typedef {Object} SupabaseClientConfig
 * @property {string} url  - Supabase project URL
 * @property {string} anonKey - Supabase anon/public key
 */

(function () {
    'use strict';

    /* ----- Resolve credentials ----- */

    /** @type {string} */
    const SUPABASE_URL =
        localStorage.getItem('freyai_supabase_url') ||
        'YOUR_SUPABASE_URL';

    /** @type {string} */
    const SUPABASE_ANON_KEY =
        localStorage.getItem('freyai_supabase_anon_key') ||
        'YOUR_SUPABASE_ANON_KEY';

    /* ----- Guard: SDK loaded? ----- */

    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        console.error(
            '[FreyAI] Supabase SDK not found. ' +
            'Ensure the CDN script is loaded before supabase-client.js.'
        );
        window.freyaiSupabase = null;
        return;
    }

    /* ----- Guard: credentials present? ----- */

    const isConfigured =
        SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
        SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
        SUPABASE_URL.length > 0 &&
        SUPABASE_ANON_KEY.length > 0;

    if (!isConfigured) {
        console.warn(
            '[FreyAI] Supabase credentials not configured. ' +
            'Set freyai_supabase_url and freyai_supabase_anon_key in localStorage ' +
            'or update js/config/supabase-client.js.'
        );
        window.freyaiSupabase = null;
        return;
    }

    /* ----- Create client ----- */

    /** @type {import('@supabase/supabase-js').SupabaseClient} */
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    });

    /* ----- Expose globally ----- */

    /**
     * The global Supabase client instance.
     * @type {import('@supabase/supabase-js').SupabaseClient | null}
     */
    window.freyaiSupabase = client;

    /**
     * Helper to update credentials at runtime (e.g. from a Settings UI).
     * Reloads the page so the new client is initialized cleanly.
     *
     * @param {string} url
     * @param {string} anonKey
     */
    window.freyaiUpdateSupabaseConfig = function (url, anonKey) {
        localStorage.setItem('freyai_supabase_url', url);
        localStorage.setItem('freyai_supabase_anon_key', anonKey);
        location.reload();
    };

    console.info('[FreyAI] Supabase client initialized:', SUPABASE_URL);
})();
