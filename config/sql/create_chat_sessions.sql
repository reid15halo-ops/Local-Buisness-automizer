-- ============================================================
-- Website Chatbot Session Store
-- Tabelle: chat_sessions
-- Projekt: FreyAI Visions (incbhhaiiayohrjqevog)
-- Erstellt: 2026-03-13
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT        NOT NULL,
    messages_json TEXT      NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on session_id for ON CONFLICT DO UPDATE
ALTER TABLE public.chat_sessions
    ADD CONSTRAINT chat_sessions_session_id_unique UNIQUE (session_id);

-- Index for fast lookups by session_id
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id
    ON public.chat_sessions (session_id);

-- Index for cleanup of old sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at
    ON public.chat_sessions (updated_at);

-- RLS: Enable Row Level Security
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can do anything (n8n workflow nutzt Service Role Key)
CREATE POLICY "service_role_full_access" ON public.chat_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policy: Anon/authenticated cannot read sessions (sessions are server-side only)
-- No anon policy = no access for anon

-- Auto-cleanup function: delete sessions older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.chat_sessions
    WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$;

COMMENT ON TABLE public.chat_sessions IS 'Website chatbot session storage — messages_json contains conversation history array';
COMMENT ON COLUMN public.chat_sessions.session_id IS 'Client-generated session ID (stored in localStorage)';
COMMENT ON COLUMN public.chat_sessions.messages_json IS 'JSON array of {role, content} message objects';
