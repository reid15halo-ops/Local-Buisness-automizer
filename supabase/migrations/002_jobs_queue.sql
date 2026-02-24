-- ============================================================
-- FreyAI Visions 95/5 Architecture — Zone 1
-- Migration 002: Async Jobs Queue + Notifications
-- ============================================================
-- CRITICAL: The jobs_queue table is the backbone of the 95/5
-- architecture. Every AI/automation task is queued here so
-- the frontend never waits longer than 200 ms for a response.
-- Workers (n8n / Supabase Edge Functions) poll and process.
-- Realtime subscriptions push status updates to the client.
-- ============================================================

-- ============================================================
-- TABLE: jobs_queue
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs_queue (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- What kind of job this is
    job_type        TEXT        NOT NULL,
    -- Valid job_type values (enforced by application layer):
    --   'invoice_ocr'       – extract & validate invoice data from PDF/image
    --   'pii_sanitize'      – strip personally-identifiable information before AI call
    --   'email_draft'       – generate AI reply draft for inbound communication
    --   'dunning_check'     – scan overdue invoices and trigger dunning workflow
    --   'payment_match'     – fuzzy-match bank transactions to open invoices
    --   'quote_generate'    – AI-assisted quote creation from lead/email
    --   'pdf_generate'      – render PDF for quote/invoice
    --   'whatsapp_send'     – outbound WhatsApp message via API
    --   'sms_send'          – outbound SMS
    --   'stock_alert'       – low-stock notification

    -- Input data for the worker
    payload         JSONB       NOT NULL DEFAULT '{}',

    -- Job lifecycle state
    status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','failed','cancelled')),

    -- Scheduling: lower number = higher priority (1 = urgent, 10 = background)
    priority        INTEGER     NOT NULL DEFAULT 5
                    CHECK (priority BETWEEN 1 AND 10),

    -- Output from worker
    result          JSONB,
    error_message   TEXT,

    -- Worker identity (for distributed workers, useful for debugging)
    worker_id       TEXT,

    -- Retry tracking
    attempts        INTEGER     NOT NULL DEFAULT 0,
    max_attempts    INTEGER     NOT NULL DEFAULT 3,

    -- Timing
    scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES for jobs_queue
-- ============================================================

-- Primary worker polling index: find next jobs to run
CREATE INDEX IF NOT EXISTS idx_jobs_queue_status
    ON jobs_queue(status, priority, scheduled_at)
    WHERE status IN ('pending', 'processing');

-- User-facing: show my jobs in dashboard
CREATE INDEX IF NOT EXISTS idx_jobs_queue_user
    ON jobs_queue(user_id, status);

-- Stale job detection: find jobs stuck in 'processing'
CREATE INDEX IF NOT EXISTS idx_jobs_queue_started_at
    ON jobs_queue(started_at)
    WHERE status = 'processing';

-- Job type filtering for analytics
CREATE INDEX IF NOT EXISTS idx_jobs_queue_job_type
    ON jobs_queue(job_type, status);

-- ============================================================
-- RLS for jobs_queue
-- ============================================================
ALTER TABLE jobs_queue ENABLE ROW LEVEL SECURITY;

-- Users can see and manage only their own jobs
CREATE POLICY "Users can select own jobs"
    ON jobs_queue FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
    ON jobs_queue FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
    ON jobs_queue FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
    ON jobs_queue FOR DELETE
    USING (auth.uid() = user_id);

-- Service role bypass: n8n workers and Edge Functions run as service_role
-- and need unrestricted access to claim and update jobs across all users
CREATE POLICY "Service role has full access to jobs_queue"
    ON jobs_queue FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- UPDATED_AT trigger for jobs_queue
-- ============================================================
CREATE TRIGGER trg_jobs_queue_updated_at
    BEFORE UPDATE ON jobs_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- REALTIME: publish jobs_queue so Flutter/Web gets live updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE jobs_queue;

-- ============================================================
-- TABLE: notifications
-- Push alerts delivered to Flutter/Web via Supabase Realtime
-- ============================================================
CREATE TYPE notification_type AS ENUM (
    'job_completed',
    'job_failed',
    'invoice_overdue',
    'payment_received',
    'approval_required',
    'stock_low',
    'new_lead',
    'new_communication',
    'system_alert'
);

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID                NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id      UUID                REFERENCES jobs_queue(id) ON DELETE SET NULL,
    type        notification_type   NOT NULL,
    title       TEXT                NOT NULL,
    body        TEXT,
    data        JSONB               NOT NULL DEFAULT '{}',
    read        BOOLEAN             NOT NULL DEFAULT FALSE,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES for notifications
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_job_id
    ON notifications(job_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications(user_id, created_at DESC)
    WHERE read = FALSE;

-- ============================================================
-- RLS for notifications
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Service role inserts notifications on behalf of workers/automation
CREATE POLICY "Service role has full access to notifications"
    ON notifications FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- REALTIME: notifications table for push delivery
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================
-- FUNCTION: enqueue_job
-- Convenience helper for Edge Functions and n8n to enqueue jobs
-- and immediately return the job id.
-- ============================================================
CREATE OR REPLACE FUNCTION enqueue_job(
    p_user_id   UUID,
    p_job_type  TEXT,
    p_payload   JSONB       DEFAULT '{}',
    p_priority  INTEGER     DEFAULT 5,
    p_delay_s   INTEGER     DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id UUID;
BEGIN
    INSERT INTO jobs_queue (user_id, job_type, payload, priority, scheduled_at)
    VALUES (
        p_user_id,
        p_job_type,
        p_payload,
        p_priority,
        NOW() + (p_delay_s || ' seconds')::INTERVAL
    )
    RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$;

COMMENT ON FUNCTION enqueue_job IS
    'Enqueue an async job. Returns the new job UUID immediately. '
    'Frontend calls this and subscribes to realtime for completion.';

-- ============================================================
-- FUNCTION: claim_next_job
-- Worker atomically claims the next available job.
-- Uses FOR UPDATE SKIP LOCKED to prevent double-processing
-- in concurrent worker environments.
-- ============================================================
CREATE OR REPLACE FUNCTION claim_next_job(
    p_worker_id TEXT,
    p_job_types TEXT[] DEFAULT NULL
)
RETURNS SETOF jobs_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE jobs_queue
    SET
        status     = 'processing',
        worker_id  = p_worker_id,
        started_at = NOW(),
        attempts   = attempts + 1,
        updated_at = NOW()
    WHERE id = (
        SELECT id FROM jobs_queue
        WHERE status = 'pending'
          AND scheduled_at <= NOW()
          AND (p_job_types IS NULL OR job_type = ANY(p_job_types))
        ORDER BY priority ASC, scheduled_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;

COMMENT ON FUNCTION claim_next_job IS
    'Atomically claim the next pending job. Safe for concurrent workers.';

-- ============================================================
-- FUNCTION: complete_job
-- Worker marks a job as completed and stores the result.
-- Automatically creates a notification for the user.
-- ============================================================
CREATE OR REPLACE FUNCTION complete_job(
    p_job_id    UUID,
    p_result    JSONB   DEFAULT '{}',
    p_title     TEXT    DEFAULT 'Job completed',
    p_body      TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    UPDATE jobs_queue
    SET
        status       = 'completed',
        result       = p_result,
        completed_at = NOW(),
        updated_at   = NOW()
    WHERE id = p_job_id
    RETURNING user_id INTO v_user_id;

    IF v_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, job_id, type, title, body, data)
        VALUES (v_user_id, p_job_id, 'job_completed', p_title,
                COALESCE(p_body, 'Your task has been processed successfully.'),
                p_result);
    END IF;
END;
$$;

-- ============================================================
-- FUNCTION: fail_job
-- Worker marks a job as failed. Reschedules for retry if
-- attempts < max_attempts, otherwise marks permanently failed.
-- ============================================================
CREATE OR REPLACE FUNCTION fail_job(
    p_job_id        UUID,
    p_error_message TEXT    DEFAULT 'Unknown error'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id     UUID;
    v_attempts    INTEGER;
    v_max         INTEGER;
    v_new_status  TEXT;
BEGIN
    SELECT user_id, attempts, max_attempts
    INTO v_user_id, v_attempts, v_max
    FROM jobs_queue WHERE id = p_job_id;

    IF v_attempts >= v_max THEN
        v_new_status := 'failed';

        -- Notify user of permanent failure
        INSERT INTO notifications (user_id, job_id, type, title, body)
        VALUES (v_user_id, p_job_id, 'job_failed',
                'Task failed',
                'A background task failed after ' || v_max || ' attempts: ' || p_error_message);
    ELSE
        -- Exponential backoff: 30s, 120s, 300s
        v_new_status := 'pending';
    END IF;

    UPDATE jobs_queue
    SET
        status        = v_new_status,
        error_message = p_error_message,
        -- Reschedule with exponential backoff
        scheduled_at  = CASE
            WHEN v_new_status = 'pending'
            THEN NOW() + (POWER(4, v_attempts) * 30 || ' seconds')::INTERVAL
            ELSE scheduled_at
        END,
        updated_at    = NOW()
    WHERE id = p_job_id;
END;
$$;

COMMENT ON TABLE jobs_queue   IS 'Async job queue — the 95% async backbone. Frontend enqueues, workers process, realtime notifies.';
COMMENT ON TABLE notifications IS 'Push notification log delivered to Flutter/Web via Supabase Realtime.';
