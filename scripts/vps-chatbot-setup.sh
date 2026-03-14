#!/bin/bash
# ============================================================
# FreyAI Chatbot — VPS Setup (einmalig nach deploy.sh staging)
# Ausführen AUF dem VPS als openclaw:
#   bash /home/openclaw/workspace/projects/freyai-app-staging/scripts/vps-chatbot-setup.sh
# ============================================================

set -e

N8N_API="http://localhost:5678/api/v1"
N8N_KEY="n8n_api_c7464b95fbd282291f05c2ec861b0dd5"
STAGING_DIR="/home/openclaw/workspace/projects/freyai-app-staging"

echo "=== FreyAI Chatbot VPS Setup ==="

# ── 1. Prüfe n8n Verfügbarkeit ──────────────────────────────
echo "[1/3] Checking n8n..."
N8N_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${N8N_API}/workflows" -H "X-N8N-API-KEY: ${N8N_KEY}" --max-time 10)
if [ "$N8N_STATUS" != "200" ]; then
    echo "ERROR: n8n not reachable (HTTP $N8N_STATUS). Is n8n running?"
    exit 1
fi
echo "n8n OK (HTTP $N8N_STATUS)"

# ── 2. n8n Workflow importieren ─────────────────────────────
echo "[2/3] Importing chatbot workflow..."

WORKFLOW_FILE="${STAGING_DIR}/config/n8n-workflows/workflow-website-chatbot.json"

if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "ERROR: Workflow file not found: $WORKFLOW_FILE"
    echo "Run deploy.sh staging first!"
    exit 1
fi

# Prüfe ob Workflow bereits existiert
EXISTING_ID=$(curl -s "${N8N_API}/workflows" \
    -H "X-N8N-API-KEY: ${N8N_KEY}" | \
    python3 -c "
import json,sys
data=json.load(sys.stdin)
ids=[str(w['id']) for w in data.get('data',[]) if w['name']=='Website Chatbot Backend']
print(ids[0] if ids else '')
" 2>/dev/null)

if [ -n "$EXISTING_ID" ]; then
    echo "Workflow already exists (id=$EXISTING_ID), skipping import"
else
    echo "Creating workflow..."
    RESULT=$(curl -s -X POST "${N8N_API}/workflows" \
        -H "X-N8N-API-KEY: ${N8N_KEY}" \
        -H "Content-Type: application/json" \
        --data @"$WORKFLOW_FILE")

    WORKFLOW_ID=$(echo "$RESULT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('id',''))
" 2>/dev/null)

    if [ -z "$WORKFLOW_ID" ]; then
        echo "ERROR: Failed to create workflow"
        echo "Response: $RESULT"
        exit 1
    fi

    echo "Created workflow id=$WORKFLOW_ID"

    # Aktivieren
    curl -s -X PATCH "${N8N_API}/workflows/${WORKFLOW_ID}" \
        -H "X-N8N-API-KEY: ${N8N_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"active": true}' > /dev/null

    echo "Workflow activated"
fi

# ── 3. Webhook testen ───────────────────────────────────────
echo "[3/3] Testing webhook..."
sleep 2

TEST=$(curl -s -X POST "http://localhost:5678/webhook/website-chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"Was bietet FreyAI Visions an?","session_id":"setup-test-001"}' \
    --max-time 30 2>&1)

if echo "$TEST" | python3 -c "import json,sys; d=json.load(sys.stdin); print('reply' in d)" 2>/dev/null | grep -q True; then
    REPLY=$(echo "$TEST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['reply'][:100])" 2>/dev/null)
    echo "Webhook test PASSED"
    echo "Bot reply: $REPLY..."
else
    echo "WARN: Webhook test result unclear:"
    echo "$TEST" | head -c 400
    echo ""
    echo "Check n8n logs: docker logs n8n --tail 50"
fi

echo ""
echo "=== SETUP COMPLETE ==="
echo "Chatbot Webhook: http://localhost:5678/webhook/website-chat"
echo "Public URL:      https://app.freyaivisions.de/n8n/webhook/website-chat"
echo "Staging URL:     https://staging.freyaivisions.de"
echo ""
echo "WICHTIG: Stelle sicher dass GOOGLE_GEMINI_API_KEY als n8n Env-Variable gesetzt ist!"
echo "  In /opt/n8n/docker-compose.yml unter environment:"
echo "  - GOOGLE_GEMINI_API_KEY=dein-key"
