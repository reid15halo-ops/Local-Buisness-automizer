-- Migration: Add 'pilot' to profiles.plan constraint
-- Date: 2026-03-07

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('starter', 'pilot', 'professional', 'enterprise'));
