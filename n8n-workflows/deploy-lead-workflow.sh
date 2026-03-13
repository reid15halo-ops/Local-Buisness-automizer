#!/bin/bash
# Deploy WhatsApp Lead-Qualifizierung Workflow auf n8n (VPS intern)
# Voraussetzung: Auf VPS als openclaw ausfuehren
# Workflow JSON muss unter /tmp/whatsapp-lead-qualifizierung.json liegen

set -e

N8N_API_KEY="n8n_api_c7464b95fbd282291f05c2ec861b0dd5"
N8N_URL="http://localhost:5678"
WORKFLOW_FILE="/tmp/whatsapp-lead-qualifizierung.json"
EVO_API_KEY="evo_freyai_2026_secret"
EVO_INSTANCE="freyai-whatsapp"

echo "=== WhatsApp Lead-Qualifizierung Deployment ==="
echo "Datum: $(date)"

# Pruefen ob Workflow-Datei vorhanden
if [ ! -f "$WORKFLOW_FILE" ]; then
  echo "FEHLER: $WORKFLOW_FILE nicht gefunden"
  echo "Bitte erst die JSON-Datei auf den VPS kopieren"
  exit 1
fi

# 1. Pruefen ob Workflow bereits existiert (nach Namen suchen)
echo ""
echo "--- Suche nach bestehendem Workflow..."
EXISTING=$(curl -s "${N8N_URL}/api/v1/workflows?name=WhatsApp+Lead-Qualifizierung" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
items = d.get('data', [])
if items:
    print(items[0]['id'])
else:
    print('')
" 2>/dev/null)

if [ -n "$EXISTING" ] && [ "$EXISTING" != "null" ]; then
  echo "Bestehender Workflow gefunden (ID: $EXISTING) - wird aktualisiert"
  METHOD="PUT"
  ENDPOINT="${N8N_URL}/api/v1/workflows/${EXISTING}"
else
  echo "Kein bestehender Workflow - wird neu erstellt"
  METHOD="POST"
  ENDPOINT="${N8N_URL}/api/v1/workflows"
fi

# 2. Workflow erstellen / aktualisieren
echo ""
echo "--- Importiere Workflow (${METHOD})..."
RESPONSE=$(curl -s -X "${METHOD}" \
  "${ENDPOINT}" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @"${WORKFLOW_FILE}")

WORKFLOW_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('id', 'ERROR'))" 2>/dev/null)

if [ "$WORKFLOW_ID" = "ERROR" ] || [ -z "$WORKFLOW_ID" ]; then
  echo "FEHLER beim Erstellen des Workflows"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "Workflow ID: $WORKFLOW_ID"

# 3. Workflow aktivieren
echo ""
echo "--- Aktiviere Workflow..."
ACTIVATE_RESPONSE=$(curl -s -X PATCH \
  "${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"active": true}')

IS_ACTIVE=$(echo "$ACTIVATE_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('active', False))" 2>/dev/null)
echo "Aktiv: $IS_ACTIVE"

# 4. Webhook-URL ermitteln
WEBHOOK_URL="${N8N_URL}/webhook/whatsapp-lead"
echo ""
echo "--- Webhook-URL: $WEBHOOK_URL"

# 5. Aktuellen Evolution API Webhook-Status pruefen
echo ""
echo "--- Aktueller Evolution API Webhook:"
CURRENT_WEBHOOK=$(curl -s "http://localhost:8080/webhook/find/${EVO_INSTANCE}" \
  -H "apikey: ${EVO_API_KEY}" 2>/dev/null)
echo "$CURRENT_WEBHOOK" | python3 -m json.tool 2>/dev/null | head -15

# 6. HINWEIS: Evolution API Webhook muss manuell gesetzt werden
# da der bestehende Workflow (sJa545wYjKldjIbA) bereits den Webhook nutzt.
# Optionen:
# A) Beide Workflows erhalten Webhooks auf derselben URL (Evolution erlaubt nur eine URL)
# B) Den neuen Workflow in den bestehenden WhatsApp Workflow als Sub-Workflow einbinden
# C) Den bestehenden Workflow erweitern

echo ""
echo "=== HINWEIS: Evolution API Webhook-Konfiguration ==="
echo "Evolution API unterstuetzt nur EINE Webhook-URL pro Instanz."
echo "Aktuell laeuft Workflow sJa545wYjKldjIbA auf einem anderen Webhook."
echo ""
echo "EMPFEHLUNG: Evolution API Webhook auf einen n8n-Router zeigen lassen"
echo "der beide Workflows triggert, ODER den Lead-Workflow in den bestehenden"
echo "Support-Workflow integrieren."
echo ""
echo "Um den Webhook zu setzen (ueberschreibt den bestehenden!):"
echo "curl -X PUT http://localhost:8080/webhook/set/${EVO_INSTANCE} \\"
echo "  -H 'apikey: ${EVO_API_KEY}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"url\": \"${WEBHOOK_URL}\", \"webhook_by_events\": true, \"webhook_base64\": false, \"events\": [\"MESSAGES_UPSERT\", \"CONNECTION_UPDATE\"]}'"
echo ""

# 7. Test-Aufruf
echo "--- Teste Webhook mit Dummy-Nachricht..."
TEST_RESPONSE=$(curl -s -X POST \
  "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "event": "MESSAGES_UPSERT",
      "data": {
        "key": {
          "fromMe": false,
          "remoteJid": "4917612345678@s.whatsapp.net"
        },
        "pushName": "Test Interessent",
        "message": {
          "conversation": "Hallo, ich habe einen kleinen Betrieb und wuerde gerne meine Prozesse automatisieren. Was bieten Sie an?"
        }
      }
    }
  }' 2>&1)

echo "Test-Response: $TEST_RESPONSE"
echo ""
echo "=== Deployment abgeschlossen ==="
echo "Workflow ID: $WORKFLOW_ID"
echo "Status: AKTIV"
echo "n8n URL: http://localhost:5678/workflow/${WORKFLOW_ID}"
