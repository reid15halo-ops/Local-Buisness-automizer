-- ============================================
-- HandwerkFlow - Supabase Database Schema
--
-- Anleitung:
-- 1. Supabase Dashboard öffnen
-- 2. SQL Editor > New Query
-- 3. Dieses komplette Script einfügen & ausführen
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Waitlist (Landing Page Signups)
-- ============================================
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    signed_up_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'landing_page',
    converted BOOLEAN DEFAULT FALSE
);

-- Allow anonymous inserts for waitlist
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join waitlist" ON waitlist
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Only admins can read waitlist" ON waitlist
    FOR SELECT USING (auth.role() = 'service_role');

-- ============================================
-- User Profiles (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    company_name TEXT,
    full_name TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    zip TEXT,
    tax_id TEXT,
    iban TEXT,
    plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, company_name, full_name, phone, plan)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'plan', 'starter')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Kunden (Customers/CRM)
-- ============================================
CREATE TABLE IF NOT EXISTS kunden (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    telefon TEXT,
    adresse TEXT,
    stadt TEXT,
    plz TEXT,
    notizen TEXT,
    kategorie TEXT DEFAULT 'kunde',
    status TEXT DEFAULT 'aktiv',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE kunden ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own kunden" ON kunden
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Anfragen (Requests/Inquiries)
-- ============================================
CREATE TABLE IF NOT EXISTS anfragen (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    kunde_name TEXT NOT NULL,
    kunde_email TEXT,
    kunde_telefon TEXT,
    leistungsart TEXT,
    beschreibung TEXT,
    budget DECIMAL(12,2),
    termin DATE,
    status TEXT DEFAULT 'neu',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE anfragen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own anfragen" ON anfragen
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Angebote (Quotes)
-- ============================================
CREATE TABLE IF NOT EXISTS angebote (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    anfrage_id TEXT REFERENCES anfragen(id),
    kunde_name TEXT NOT NULL,
    kunde_email TEXT,
    kunde_telefon TEXT,
    leistungsart TEXT,
    positionen JSONB DEFAULT '[]',
    angebots_text TEXT,
    netto DECIMAL(12,2) DEFAULT 0,
    mwst DECIMAL(12,2) DEFAULT 0,
    brutto DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'offen',
    gueltig_bis DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE angebote ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own angebote" ON angebote
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Aufträge (Orders/Jobs)
-- ============================================
CREATE TABLE IF NOT EXISTS auftraege (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    angebot_id TEXT REFERENCES angebote(id),
    kunde_name TEXT NOT NULL,
    kunde_email TEXT,
    kunde_telefon TEXT,
    leistungsart TEXT,
    positionen JSONB DEFAULT '[]',
    angebots_wert DECIMAL(12,2) DEFAULT 0,
    netto DECIMAL(12,2) DEFAULT 0,
    mwst DECIMAL(12,2) DEFAULT 0,
    arbeitszeit DECIMAL(8,2),
    material_kosten DECIMAL(12,2),
    notizen TEXT,
    status TEXT DEFAULT 'aktiv',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE auftraege ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own auftraege" ON auftraege
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Rechnungen (Invoices)
-- ============================================
CREATE TABLE IF NOT EXISTS rechnungen (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    auftrag_id TEXT REFERENCES auftraege(id),
    kunde_name TEXT NOT NULL,
    kunde_email TEXT,
    kunde_telefon TEXT,
    leistungsart TEXT,
    positionen JSONB DEFAULT '[]',
    arbeitszeit DECIMAL(8,2),
    material_kosten DECIMAL(12,2),
    netto DECIMAL(12,2) DEFAULT 0,
    mwst DECIMAL(12,2) DEFAULT 0,
    brutto DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'offen' CHECK (status IN ('offen', 'bezahlt', 'storniert')),
    zahlungsziel_tage INT DEFAULT 14,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

ALTER TABLE rechnungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rechnungen" ON rechnungen
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Buchungen (Bookkeeping Entries)
-- ============================================
CREATE TABLE IF NOT EXISTS buchungen (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    typ TEXT CHECK (typ IN ('einnahme', 'ausgabe')) NOT NULL,
    kategorie TEXT NOT NULL,
    beschreibung TEXT,
    belegnummer TEXT,
    netto DECIMAL(12,2) DEFAULT 0,
    ust DECIMAL(12,2) DEFAULT 0,
    brutto DECIMAL(12,2) DEFAULT 0,
    ust_satz DECIMAL(4,2) DEFAULT 19.00,
    datum DATE NOT NULL,
    rechnung_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE buchungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own buchungen" ON buchungen
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Materialien (Inventory)
-- ============================================
CREATE TABLE IF NOT EXISTS materialien (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    artikelnummer TEXT,
    bezeichnung TEXT NOT NULL,
    kategorie TEXT,
    einheit TEXT DEFAULT 'Stk.',
    preis DECIMAL(12,2) DEFAULT 0,
    vk_preis DECIMAL(12,2) DEFAULT 0,
    bestand DECIMAL(12,2) DEFAULT 0,
    min_bestand DECIMAL(12,2) DEFAULT 0,
    lieferant TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE materialien ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own materialien" ON materialien
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Aufgaben (Tasks)
-- ============================================
CREATE TABLE IF NOT EXISTS aufgaben (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    titel TEXT NOT NULL,
    beschreibung TEXT,
    prioritaet TEXT DEFAULT 'mittel' CHECK (prioritaet IN ('hoch', 'mittel', 'niedrig')),
    status TEXT DEFAULT 'offen',
    faellig_am DATE,
    zugewiesen_an TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE aufgaben ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own aufgaben" ON aufgaben
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Termine (Calendar Events)
-- ============================================
CREATE TABLE IF NOT EXISTS termine (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    titel TEXT NOT NULL,
    beschreibung TEXT,
    kunde_id TEXT,
    start_zeit TIMESTAMPTZ NOT NULL,
    end_zeit TIMESTAMPTZ,
    ganztaegig BOOLEAN DEFAULT FALSE,
    ort TEXT,
    status TEXT DEFAULT 'geplant',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE termine ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own termine" ON termine
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Zeiteinträge (Time Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS zeiteintraege (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    auftrag_id TEXT,
    start_zeit TIMESTAMPTZ NOT NULL,
    end_zeit TIMESTAMPTZ,
    dauer_minuten INT,
    notiz TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE zeiteintraege ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own zeiteintraege" ON zeiteintraege
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Dokumente (Documents metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS dokumente (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    dateiname TEXT NOT NULL,
    kategorie TEXT,
    storage_path TEXT,
    ocr_text TEXT,
    extrahierte_daten JSONB,
    groesse_bytes INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dokumente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own dokumente" ON dokumente
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_anfragen_user ON anfragen(user_id);
CREATE INDEX IF NOT EXISTS idx_anfragen_status ON anfragen(status);
CREATE INDEX IF NOT EXISTS idx_angebote_user ON angebote(user_id);
CREATE INDEX IF NOT EXISTS idx_angebote_status ON angebote(status);
CREATE INDEX IF NOT EXISTS idx_auftraege_user ON auftraege(user_id);
CREATE INDEX IF NOT EXISTS idx_rechnungen_user ON rechnungen(user_id);
CREATE INDEX IF NOT EXISTS idx_rechnungen_status ON rechnungen(status);
CREATE INDEX IF NOT EXISTS idx_buchungen_user ON buchungen(user_id);
CREATE INDEX IF NOT EXISTS idx_buchungen_datum ON buchungen(datum);
CREATE INDEX IF NOT EXISTS idx_kunden_user ON kunden(user_id);
CREATE INDEX IF NOT EXISTS idx_materialien_user ON materialien(user_id);
CREATE INDEX IF NOT EXISTS idx_aufgaben_user ON aufgaben(user_id);
CREATE INDEX IF NOT EXISTS idx_termine_user ON termine(user_id);
CREATE INDEX IF NOT EXISTS idx_termine_start ON termine(start_zeit);

-- ============================================
-- Updated_at Trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_kunden_updated_at
    BEFORE UPDATE ON kunden
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_materialien_updated_at
    BEFORE UPDATE ON materialien
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
