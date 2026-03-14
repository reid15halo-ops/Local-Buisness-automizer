#!/bin/bash
# ============================================================
# FreyAI Website Chatbot — Deployment Script
# Läuft auf dem VPS (openclaw@72.61.187.24)
# Einmalig ausführen nach erstem rsync/deploy.sh staging
# ============================================================

set -e

echo "[chatbot-deploy] Start"

VPS_APP_DIR="/home/openclaw/workspace/projects/freyai-app-staging"
N8N_API="http://localhost:5678/api/v1"
N8N_KEY="n8n_api_c7464b95fbd282291f05c2ec861b0dd5"
SUPABASE_DB_HOST="aws-0-eu-central-1.pooler.supabase.com"
SUPABASE_DB_PORT="6543"
SUPABASE_DB_NAME="postgres"
SUPABASE_DB_USER="postgres.incbhhaiiayohrjqevog"
# DB PW aus env lesen (nicht hartcodieren)
SUPABASE_DB_PW="${SUPABASE_DB_PW:-F5xwoS7VUVSHvUg6}"

# ── 1. Supabase Tabelle erstellen ──────────────────────────
echo "[chatbot-deploy] 1/3 Creating chat_sessions table in Supabase..."

PGPASSWORD="$SUPABASE_DB_PW" psql \
    "postgresql://${SUPABASE_DB_USER}:${SUPABASE_DB_PW}@${SUPABASE_DB_HOST}:${SUPABASE_DB_PORT}/${SUPABASE_DB_NAME}?sslmode=require" \
    -f "${VPS_APP_DIR}/config/sql/create_chat_sessions.sql" 2>&1 || \
    echo "[chatbot-deploy] WARN: psql failed — table may already exist, continuing..."

echo "[chatbot-deploy] Table check done"

# ── 2. n8n Workflow importieren ────────────────────────────
echo "[chatbot-deploy] 2/3 Importing chatbot workflow into n8n..."

WORKFLOW_JSON=$(cat "${VPS_APP_DIR}/config/n8n-workflows/workflow-website-chatbot.json")

# Prüfe ob Workflow bereits existiert
EXISTING=$(curl -s -X GET "${N8N_API}/workflows" \
    -H "X-N8N-API-KEY: ${N8N_KEY}" | \
    python3 -c "import json,sys; data=json.load(sys.stdin); ids=[w['id'] for w in data.get('data',[]) if w['name']=='Website Chatbot Backend']; print(ids[0] if ids else '')" 2>/dev/null)

if [ -n "$EXISTING" ]; then
    echo "[chatbot-deploy] Workflow exists (id=$EXISTING), updating..."
    curl -s -X PUT "${N8N_API}/workflows/${EXISTING}" \
        -H "X-N8N-API-KEY: ${N8N_KEY}" \
        -H "Content-Type: application/json" \
        -d "$WORKFLOW_JSON" > /tmp/n8n-update-result.json
    echo "[chatbot-deploy] Updated workflow $EXISTING"
else
    echo "[chatbot-deploy] Creating new workflow..."
    RESULT=$(curl -s -X POST "${N8N_API}/workflows" \
        -H "X-N8N-API-KEY: ${N8N_KEY}" \
        -H "Content-Type: application/json" \
        -d "$WORKFLOW_JSON")
    WORKFLOW_ID=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id','ERROR'))" 2>/dev/null)
    echo "[chatbot-deploy] Created workflow id=$WORKFLOW_ID"

    # Workflow aktivieren
    curl -s -X PATCH "${N8N_API}/workflows/${WORKFLOW_ID}" \
        -H "X-N8N-API-KEY: ${N8N_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"active": true}' > /dev/null
    echo "[chatbot-deploy] Activated workflow"
fi

# ── 3. Webhook URL testen ──────────────────────────────────
echo "[chatbot-deploy] 3/3 Testing webhook endpoint..."

sleep 2

TEST_RESULT=$(curl -s -X POST "http://localhost:5678/webhook/website-chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"Hallo, was macht ihr?","session_id":"deploy-test-123"}' \
    --max-time 30 2>&1)

if echo "$TEST_RESULT" | grep -q '"reply"'; then
    echo "[chatbot-deploy] Webhook test PASSED"
    echo "[chatbot-deploy] Response: $TEST_RESULT" | head -c 200
else
    echo "[chatbot-deploy] WARN: Webhook test inconclusive:"
    echo "$TEST_RESULT" | head -c 300
fi

echo ""
echo "[chatbot-deploy] DONE"
echo "  Chatbot endpoint: https://app.freyaivisions.de/n8n/webhook/website-chat"
echo "  Staging UI:       https://staging.freyaivisions.de"
