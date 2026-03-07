-- Migration: recurring_invoice_templates
-- Wiederkehrende Rechnungsvorlagen fuer Retainer/SaaS-Kunden

CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
    id                       TEXT PRIMARY KEY,
    user_id                  UUID NOT NULL DEFAULT '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc',
    tenant_id                UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
    kunde_id                 TEXT,
    kunde_name               TEXT NOT NULL DEFAULT '',
    kunde_email              TEXT NOT NULL DEFAULT '',
    kunde_adresse            TEXT NOT NULL DEFAULT '',
    bezeichnung              TEXT NOT NULL DEFAULT '',
    positionen               JSONB NOT NULL DEFAULT '[]'::jsonb,
    netto_betrag             NUMERIC(12,2) NOT NULL DEFAULT 0,
    steuersatz               NUMERIC(5,4) NOT NULL DEFAULT 0.19,
    intervall                TEXT NOT NULL DEFAULT 'monatlich'
                             CHECK (intervall IN ('monatlich','quartalsweise','jaehrlich','benutzerdefiniert')),
    benutzerdefinierte_monate INTEGER NOT NULL DEFAULT 1,
    tag_im_monat             INTEGER NOT NULL DEFAULT 1 CHECK (tag_im_monat BETWEEN 1 AND 28),
    zahlungsziel_tage        INTEGER NOT NULL DEFAULT 14,
    start_datum              DATE,
    end_datum                DATE,
    max_anzahl               INTEGER,
    notizen                  TEXT NOT NULL DEFAULT '',
    status                   TEXT NOT NULL DEFAULT 'aktiv'
                             CHECK (status IN ('aktiv','pausiert','beendet')),
    anzahl_erstellt          INTEGER NOT NULL DEFAULT 0,
    gesamt_umsatz            NUMERIC(12,2) NOT NULL DEFAULT 0,
    letzte_rechnung          DATE,
    naechste_faelligkeit     DATE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index fuer schnelle Abfragen nach tenant + status
CREATE INDEX IF NOT EXISTS idx_rit_tenant_status
    ON recurring_invoice_templates (tenant_id, status);

-- Index fuer Scheduler: faellige Templates finden
CREATE INDEX IF NOT EXISTS idx_rit_naechste_faelligkeit
    ON recurring_invoice_templates (naechste_faelligkeit)
    WHERE status = 'aktiv' AND naechste_faelligkeit IS NOT NULL;

-- RLS
ALTER TABLE recurring_invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant templates"
    ON recurring_invoice_templates FOR SELECT
    USING (tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can insert own templates"
    ON recurring_invoice_templates FOR INSERT
    WITH CHECK (tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can update own templates"
    ON recurring_invoice_templates FOR UPDATE
    USING (tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can delete own templates"
    ON recurring_invoice_templates FOR DELETE
    USING (tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid);
