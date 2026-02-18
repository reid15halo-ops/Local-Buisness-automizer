/* ============================================
   Supabase Configuration

   Setup:
   1. Erstelle ein Supabase-Projekt auf https://supabase.com
   2. Trage URL und Anon Key hier ein oder in den Einstellungen
   3. Führe das SQL-Schema aus (siehe /config/supabase-schema.sql)
   ============================================ */

const SUPABASE_CONFIG = {
    // Diese Werte aus den Supabase-Projekteinstellungen holen:
    // Settings > API > Project URL & anon/public key
    url: localStorage.getItem('supabase_url') || '',
    anonKey: localStorage.getItem('supabase_anon_key') || '',
};

// Expose URL only (not the anon key) for landing page waitlist.
// The anon key must not be placed on window — read it via window.supabaseConfig.config.anonKey
// when absolutely needed within the same script context, or use the Supabase client directly.
window.SUPABASE_URL = SUPABASE_CONFIG.url;

// Supabase Client (loaded via CDN)
let supabaseClient = null;

function initSupabase() {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
        console.warn('Supabase nicht konfiguriert. Verwende lokalen Speicher.');
        return null;
    }

    if (typeof window.supabase === 'undefined') {
        console.warn('Supabase CDN nicht geladen.');
        return null;
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.anonKey
    );

    return supabaseClient;
}

function getSupabase() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
}

function isSupabaseConfigured() {
    return !!(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

function updateSupabaseConfig(url, anonKey) {
    SUPABASE_CONFIG.url = url;
    SUPABASE_CONFIG.anonKey = anonKey;
    // Store the URL in localStorage (not a secret). The anon key is kept in-memory only;
    // persisting it to localStorage would expose it to any script on the page.
    localStorage.setItem('supabase_url', url);
    window.SUPABASE_URL = url;
    // Do NOT assign window.SUPABASE_ANON_KEY — the key must not be a window global.
    supabaseClient = null; // Force re-init
    initSupabase();
}

window.supabaseConfig = {
    init: initSupabase,
    get: getSupabase,
    isConfigured: isSupabaseConfigured,
    update: updateSupabaseConfig,
    config: SUPABASE_CONFIG
};
