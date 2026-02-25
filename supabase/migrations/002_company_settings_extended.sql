-- ============================================================
-- Migration 002: Extend company_settings with business config
-- Moves hardcoded business values into Supabase for per-user config
-- ============================================================

ALTER TABLE company_settings
    ADD COLUMN IF NOT EXISTS owner_name          TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS company_email       TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS company_phone       TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS company_website     TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS noreply_email       TEXT NOT NULL DEFAULT 'noreply@handwerkflow.de',
    ADD COLUMN IF NOT EXISTS stundensatz         NUMERIC(10, 2) NOT NULL DEFAULT 65.00,
    ADD COLUMN IF NOT EXISTS payment_terms_days  INTEGER NOT NULL DEFAULT 14,
    ADD COLUMN IF NOT EXISTS kleinunternehmer    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS bank_iban           TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS bank_bic            TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN company_settings.owner_name         IS 'Full name of the business owner / Inhaber';
COMMENT ON COLUMN company_settings.company_email      IS 'Primary business email address';
COMMENT ON COLUMN company_settings.company_phone      IS 'Primary business phone number';
COMMENT ON COLUMN company_settings.company_website    IS 'Company website URL';
COMMENT ON COLUMN company_settings.noreply_email      IS 'No-reply sender email for automated messages';
COMMENT ON COLUMN company_settings.stundensatz        IS 'Default hourly rate in EUR (Stundensatz)';
COMMENT ON COLUMN company_settings.payment_terms_days IS 'Default payment due days (Zahlungsziel)';
COMMENT ON COLUMN company_settings.kleinunternehmer   IS 'Kleinunternehmerregelung §19 UStG – no VAT invoicing';
COMMENT ON COLUMN company_settings.bank_iban          IS 'Bank IBAN for payment details on invoices';
COMMENT ON COLUMN company_settings.bank_bic           IS 'Bank BIC/SWIFT code';
