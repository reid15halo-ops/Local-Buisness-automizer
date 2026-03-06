-- Run this in Supabase SQL Editor to fix portal_responses INSERT policy
-- This blocks direct anonymous inserts, forcing use of RPC functions only
DROP POLICY IF EXISTS "Portal insert responses" ON portal_responses;
CREATE POLICY "Portal insert via RPC only" ON portal_responses
    FOR INSERT WITH CHECK (FALSE);
-- The portal_approve_quote and portal_reject_quote RPCs are SECURITY DEFINER
-- and will bypass this RLS policy, which is the correct behavior.
