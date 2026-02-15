-- ============================================
-- Database Schema für E-Mail-zu-Angebot-Automation
-- ============================================

-- Inbound Emails Tabelle
CREATE TABLE IF NOT EXISTS inbound_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_email TEXT NOT NULL,
    from_name TEXT,
    subject TEXT,
    body TEXT,
    html_body TEXT,
    attachments JSONB,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    anfrage_id TEXT,
    angebot_id TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automation Log Tabelle
CREATE TABLE IF NOT EXISTS automation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kunden Tabelle (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS kunden (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    firma TEXT,
    email TEXT,
    telefon TEXT,
    strasse TEXT,
    plz TEXT,
    ort TEXT,
    notizen TEXT,
    quelle TEXT, -- 'email-automation', 'manual', 'website'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Anfragen Tabelle (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS anfragen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nummer TEXT UNIQUE NOT NULL,
    kunde_id UUID REFERENCES kunden(id) ON DELETE CASCADE,
    leistungsart TEXT NOT NULL, -- metallbau, schweissen, hydraulik, etc.
    beschreibung TEXT,
    budget NUMERIC(10,2),
    termin DATE,
    status TEXT DEFAULT 'neu', -- neu, in_bearbeitung, angebot_erstellt, abgeschlossen
    quelle TEXT, -- 'email', 'telefon', 'website', 'manual'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Angebote Tabelle (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS angebote (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nummer TEXT UNIQUE NOT NULL,
    anfrage_id UUID REFERENCES anfragen(id) ON DELETE SET NULL,
    kunde_id UUID REFERENCES kunden(id) ON DELETE CASCADE,
    positionen JSONB NOT NULL, -- Array von Positionen
    netto NUMERIC(10,2) NOT NULL,
    mwst NUMERIC(10,2) NOT NULL,
    brutto NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'entwurf', -- entwurf, versendet, akzeptiert, abgelehnt
    arbeitszeit NUMERIC(5,2), -- Geschätzte Stunden
    versanddatum DATE,
    gueltig_bis DATE,
    notizen TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices für Performance
CREATE INDEX IF NOT EXISTS idx_inbound_emails_processed ON inbound_emails(processed);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_received_at ON inbound_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_from_email ON inbound_emails(from_email);

CREATE INDEX IF NOT EXISTS idx_automation_log_created_at ON automation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_log_action ON automation_log(action);

CREATE INDEX IF NOT EXISTS idx_kunden_email ON kunden(email);
CREATE INDEX IF NOT EXISTS idx_kunden_user_id ON kunden(user_id);

CREATE INDEX IF NOT EXISTS idx_anfragen_kunde_id ON anfragen(kunde_id);
CREATE INDEX IF NOT EXISTS idx_anfragen_status ON anfragen(status);
CREATE INDEX IF NOT EXISTS idx_anfragen_user_id ON anfragen(user_id);

CREATE INDEX IF NOT EXISTS idx_angebote_kunde_id ON angebote(kunde_id);
CREATE INDEX IF NOT EXISTS idx_angebote_anfrage_id ON angebote(anfrage_id);
CREATE INDEX IF NOT EXISTS idx_angebote_status ON angebote(status);
CREATE INDEX IF NOT EXISTS idx_angebote_user_id ON angebote(user_id);

-- Row Level Security (RLS)
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE kunden ENABLE ROW LEVEL SECURITY;
ALTER TABLE anfragen ENABLE ROW LEVEL SECURITY;
ALTER TABLE angebote ENABLE ROW LEVEL SECURITY;

-- Policies für inbound_emails (nur Service Role)
CREATE POLICY "Service role can manage inbound_emails"
    ON inbound_emails
    FOR ALL
    USING (auth.role() = 'service_role');

-- Policies für automation_log
CREATE POLICY "Users can view their own automation logs"
    ON automation_log
    FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role can insert automation logs"
    ON automation_log
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Policies für kunden
CREATE POLICY "Users can view their own customers"
    ON kunden
    FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own customers"
    ON kunden
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own customers"
    ON kunden
    FOR UPDATE
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can delete their own customers"
    ON kunden
    FOR DELETE
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Policies für anfragen
CREATE POLICY "Users can view their own anfragen"
    ON anfragen
    FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own anfragen"
    ON anfragen
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own anfragen"
    ON anfragen
    FOR UPDATE
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can delete their own anfragen"
    ON anfragen
    FOR DELETE
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Policies für angebote
CREATE POLICY "Users can view their own angebote"
    ON angebote
    FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own angebote"
    ON angebote
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own angebote"
    ON angebote
    FOR UPDATE
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can delete their own angebote"
    ON angebote
    FOR DELETE
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_kunden_updated_at
    BEFORE UPDATE ON kunden
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_anfragen_updated_at
    BEFORE UPDATE ON anfragen
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_angebote_updated_at
    BEFORE UPDATE ON angebote
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Hilfsfunktionen für Statistiken
CREATE OR REPLACE FUNCTION get_automation_stats(
    user_uuid UUID DEFAULT NULL,
    days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_emails INTEGER,
    processed_emails INTEGER,
    failed_emails INTEGER,
    total_angebote INTEGER,
    total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT ie.id)::INTEGER as total_emails,
        COUNT(DISTINCT CASE WHEN ie.processed = true AND ie.error IS NULL THEN ie.id END)::INTEGER as processed_emails,
        COUNT(DISTINCT CASE WHEN ie.error IS NOT NULL THEN ie.id END)::INTEGER as failed_emails,
        COUNT(DISTINCT a.id)::INTEGER as total_angebote,
        COALESCE(SUM(a.brutto), 0)::NUMERIC as total_value
    FROM inbound_emails ie
    LEFT JOIN angebote a ON ie.angebot_id::UUID = a.id
    WHERE ie.received_at >= NOW() - (days || ' days')::INTERVAL
        AND (user_uuid IS NULL OR a.user_id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View für Dashboard
CREATE OR REPLACE VIEW automation_dashboard AS
SELECT
    ie.id,
    ie.from_email,
    ie.from_name,
    ie.subject,
    ie.received_at,
    ie.processed,
    ie.error,
    a.nummer as anfrage_nummer,
    ang.nummer as angebot_nummer,
    ang.brutto,
    ang.status as angebot_status,
    k.name as kunde_name,
    k.firma as kunde_firma
FROM inbound_emails ie
LEFT JOIN anfragen a ON ie.anfrage_id::UUID = a.id
LEFT JOIN angebote ang ON ie.angebot_id::UUID = ang.id
LEFT JOIN kunden k ON ang.kunde_id = k.id
ORDER BY ie.received_at DESC;

-- Grant permissions
GRANT SELECT ON automation_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION get_automation_stats TO authenticated;

-- Demo Daten (optional)
-- INSERT INTO automation_log (action, target, metadata) VALUES
--     ('email.auto_process', 'test@example.com', '{"anfrage_nummer": "ANF-001", "angebot_nummer": "ANG-001"}');
