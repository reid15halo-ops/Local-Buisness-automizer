/* ============================================
   Supabase Configuration

   Setup:
   1. Erstelle ein Supabase-Projekt auf https://supabase.com
   2. Trage URL und Anon Key hier ein oder in den Einstellungen
   3. Führe das SQL-Schema aus (siehe /config/supabase-schema.sql)

   This module exposes window.supabaseConfig (legacy API).
   When SupabaseClientService (supabase-client.js) is loaded,
   get() delegates to its singleton client to avoid duplicates.
   ============================================ */

const SUPABASE_CONFIG = {
    // SECURITY NOTE: Der anon key ist by design öffentlich (public).
    // Die Sicherheit wird durch Row Level Security (RLS) Policies in
    // Supabase gewährleistet, NICHT durch Geheimhaltung des anon keys.
    url: localStorage.getItem('supabase_url') || 'https://incbhhaiiayohrjqevog.supabase.co',
    anonKey: localStorage.getItem('supabase_anon_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluY2JoaGFpaWF5b2hyanFldm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzExNjMsImV4cCI6MjA4Njc0NzE2M30.aTZ6qX_gvqOUyPvJYmQ1_cD9yZCO0gd6pdODxSODnGM',
};

// Expose for landing page waitlist
window.SUPABASE_URL = SUPABASE_CONFIG.url;
window.SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

// Legacy fallback client (only used when SupabaseClientService is not loaded)
let _legacyClient = null;

function initSupabase() {
    // Delegate to SupabaseClientService when available
    if (window.supabaseClient && typeof window.supabaseClient.isConfigured === 'function') {
        return window.supabaseClient.client;
    }

    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
        console.warn('Supabase nicht konfiguriert. Verwende lokalen Speicher.');
        return null;
    }

    if (typeof window.supabase === 'undefined') {
        console.warn('Supabase CDN nicht geladen.');
        return null;
    }

    _legacyClient = window.supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.anonKey
    );

    return _legacyClient;
}

function getSupabase() {
    // Prefer SupabaseClientService singleton when available
    if (window.supabaseClient && typeof window.supabaseClient.isConfigured === 'function') {
        return window.supabaseClient.client;
    }
    if (!_legacyClient) {
        return initSupabase();
    }
    return _legacyClient;
}

function isSupabaseConfigured() {
    // Check SupabaseClientService first
    if (window.supabaseClient && typeof window.supabaseClient.isConfigured === 'function') {
        return window.supabaseClient.isConfigured();
    }
    return !!(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

function updateSupabaseConfig(url, anonKey) {
    SUPABASE_CONFIG.url = url;
    SUPABASE_CONFIG.anonKey = anonKey;
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_anon_key', anonKey);
    window.SUPABASE_URL = url;
    window.SUPABASE_ANON_KEY = anonKey;
    _legacyClient = null;

    // Update SupabaseClientService if available
    if (window.supabaseClient && typeof window.supabaseClient.updateConfig === 'function') {
        window.supabaseClient.updateConfig(url, anonKey);
    } else {
        initSupabase();
    }
}

window.supabaseConfig = {
    init: initSupabase,
    get: getSupabase,
    isConfigured: isSupabaseConfigured,
    update: updateSupabaseConfig,
    config: SUPABASE_CONFIG
};
