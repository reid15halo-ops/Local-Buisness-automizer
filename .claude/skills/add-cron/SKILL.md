---
name: add-cron
description: Create a scheduled/cron job — either as a Supabase pg_cron function, an Edge Function with pg_cron trigger, or a FastAPI background task.
argument-hint: [job-name] [schedule]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add Scheduled Job

**Arguments:** `$ARGUMENTS` — parse as `[job-name] [cron-schedule]`
Example: `check-overdue-invoices "0 8 * * *"`

### Options (pick the best fit)

#### Option A: Supabase pg_cron (pure SQL)

```sql
-- Enable pg_cron extension (run once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the function
CREATE OR REPLACE FUNCTION cron_<job_name>()
RETURNS void AS $$
BEGIN
    -- Job logic here (e.g., mark overdue invoices)
    UPDATE invoices
    SET status = 'overdue'
    WHERE status = 'sent'
      AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule it
SELECT cron.schedule(
    '<job-name>',
    '<schedule>',
    'SELECT cron_<job_name>()'
);
```

#### Option B: Supabase Edge Function + pg_cron trigger

Create an Edge Function (use `/add-edge-function <job-name>`) and trigger it via pg_cron:

```sql
SELECT cron.schedule(
    '<job-name>',
    '<schedule>',
    $$SELECT net.http_post(
        url := '<SUPABASE_URL>/functions/v1/<job-name>',
        headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
    )$$
);
```

#### Option C: FastAPI background task

```python
from fastapi_utils.tasks import repeat_every

@app.on_event("startup")
@repeat_every(seconds=3600)  # every hour
async def <job_name>_task():
    """<description>."""
    # Job logic here
```

### Decision Guide

| Use case | Recommendation |
|----------|---------------|
| Pure DB operations | Option A (pg_cron) |
| Needs external APIs | Option B (Edge Function) |
| Needs Python libraries | Option C (FastAPI) |
