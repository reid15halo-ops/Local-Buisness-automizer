-- Migration: Add missing fields to tenants table
-- Date: 2026-03-07
-- Fixes: kleinunternehmer + email columns missing (Morpheus Architecture review)

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kleinunternehmer BOOLEAN DEFAULT false;
