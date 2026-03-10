-- Add payment failure tracking columns to rechnungen
-- Used by stripe-webhook handler for payment_intent.payment_failed events
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ;
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS payment_error TEXT;

-- Add refund tracking column to rechnungen
-- Used by stripe-webhook handler for charge.refunded events
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
