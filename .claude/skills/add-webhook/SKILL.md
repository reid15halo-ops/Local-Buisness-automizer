---
name: add-webhook
description: Create a webhook receiver endpoint in the FastAPI backend with signature verification, payload parsing, and Supabase integration.
argument-hint: [webhook-source] [event-type]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add Webhook Receiver

**Arguments:** `$ARGUMENTS` — parse as `[source] [event-type]`
Examples: `stripe payment.completed`, `n8n invoice.created`, `supabase db.changes`

### Steps

1. **Read** `backend/main.py` for current endpoints.
2. Add a webhook endpoint at `/webhooks/<source>`.

### Template

```python
import hmac
import hashlib

@app.post("/webhooks/<source>")
async def handle_<source>_webhook(request: Request):
    """Handle incoming <source> webhook."""
    body = await request.body()

    # 1. Verify signature (if applicable)
    signature = request.headers.get("x-webhook-signature", "")
    secret = os.getenv("<SOURCE>_WEBHOOK_SECRET", "")
    if secret:
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid signature")

    # 2. Parse payload
    payload = await request.json()
    event_type = payload.get("type", "unknown")

    # 3. Route by event type
    if event_type == "<event-type>":
        # Process the event
        pass

    return {"received": True}
```

### Conventions
- Always verify webhook signatures when the source supports it
- Log incoming webhooks: `logger.info(f"Webhook received: {event_type}")`
- Return 200 quickly, process async if needed
- Store raw payloads for debugging (optional JSONB column)
- Add the webhook secret to the env vars documentation
