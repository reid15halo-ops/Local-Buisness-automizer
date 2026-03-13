#!/bin/bash
# WhatsApp Lead-Qualifizierung: VPS-Installation
# Ausfuehren auf dem VPS als root oder openclaw:
# curl -s https://raw.githubusercontent.com/.../install-on-vps.sh | bash
# ODER: bash install-on-vps.sh (wenn Datei lokal vorhanden)

set -e

N8N_API_KEY="n8n_api_c7464b95fbd282291f05c2ec861b0dd5"
N8N_URL="http://localhost:5678"
EVO_API_KEY="evo_freyai_2026_secret"
EVO_INSTANCE="freyai-whatsapp"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluY2JoaGFpaWF5b2hyanFldm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MTE2MywiZXhwIjoyMDg2NzQ3MTYzfQ.2I8Qkv9HHfHtuIYSs4Re-0F_fOFYx2_3FUVU-sFo2iQ"
GEMINI_KEY="AIzaSyBF80s7kShv--23w7PZdtz4_gw0Ry-2S38"

echo "=== WhatsApp Lead-Qualifizierung Setup ==="
echo "$(date)"

# SCHRITT 1: Workflow JSON erstellen
echo ""
echo "--- Schritt 1: Erstelle Workflow JSON..."
cat > /tmp/whatsapp-lead-qualifizierung.json << 'WORKFLOW_EOF'
{
  "name": "WhatsApp Lead-Qualifizierung",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "whatsapp-lead",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "node-webhook",
      "name": "WhatsApp Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 300],
      "webhookId": "whatsapp-lead-inbound"
    },
    {
      "parameters": {
        "respondWith": "text",
        "responseBody": "OK",
        "options": {}
      },
      "id": "node-respond",
      "name": "Webhook Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [460, 500]
    },
    {
      "parameters": {
        "conditions": {
          "options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict"},
          "conditions": [
            {"id": "c1", "leftValue": "={{ $json.body.event }}", "rightValue": "MESSAGES_UPSERT", "operator": {"type": "string", "operation": "equals"}},
            {"id": "c2", "leftValue": "={{ $json.body.data.key.fromMe }}", "rightValue": true, "operator": {"type": "boolean", "operation": "notEqual"}}
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "id": "node-filter",
      "name": "Filter: Eingehende Msgs",
      "type": "n8n-nodes-base.filter",
      "typeVersion": 2.1,
      "position": [460, 300]
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {"id": "s1", "name": "phone", "value": "={{ $json.body.data.key.remoteJid.split('@')[0] }}", "type": "string"},
            {"id": "s2", "name": "message", "value": "={{ $json.body.data.message.conversation || $json.body.data.message.extendedTextMessage?.text || '' }}", "type": "string"},
            {"id": "s3", "name": "pushName", "value": "={{ $json.body.data.pushName || 'Unbekannt' }}", "type": "string"},
            {"id": "s4", "name": "remoteJid", "value": "={{ $json.body.data.key.remoteJid }}", "type": "string"}
          ]
        },
        "options": {}
      },
      "id": "node-extract",
      "name": "Daten extrahieren",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [680, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "GEMINI_URL_PLACEHOLDER",
        "sendHeaders": true,
        "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]},
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\"contents\":[{\"parts\":[{\"text\":\"Du bist Lead-Qualifizierungs-Assistent fuer FreyAI Visions (IT/KI-Beratung). Analysiere diese WhatsApp-Nachricht.\\n\\nVon: {{ $json.pushName }} (+{{ $json.phone }}): \\\"{{ $json.message }}\\\"\\n\\nLead = jemand der IT/KI-Beratung, Automatisierung, Preise oder Leistungen anfraegt oder Betrieb erwaehnt.\\nKein Lead = Spam, Privates, Tests.\\n\\nNur JSON ohne Markdown: {\\\"is_lead\\\":bool,\\\"confidence\\\":0-100,\\\"category\\\":\\\"Automatisierung|KI-Beratung|IT-Beratung|Website|Sonstiges|Kein-Lead\\\",\\\"priority\\\":\\\"hoch|mittel|niedrig\\\",\\\"summary\\\":\\\"max 60 Zeichen\\\",\\\"reply_de\\\":\\\"max 120 Zeichen\\\"}\"}]}],\"generationConfig\":{\"temperature\":0.1,\"maxOutputTokens\":800,\"responseMimeType\":\"application/json\"}}",
        "options": {"timeout": 30000}
      },
      "id": "node-gemini",
      "name": "Gemini 2.5 Flash Analyse",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [900, 300]
    },
    {
      "parameters": {
        "jsCode": "const responseText = $input.item.json.candidates[0].content.parts[0].text;\nconst cleanText = responseText.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();\nlet geminiResult;\ntry {\n  geminiResult = JSON.parse(cleanText);\n} catch (e) {\n  geminiResult = {is_lead: false, confidence: 0, category: 'Kein-Lead', priority: 'niedrig', summary: 'Parse-Fehler', reply_de: 'Danke! Wir melden uns bald.'};\n}\nconst prev = $('Daten extrahieren').item.json;\nreturn {json: {...prev, geminiResult, is_lead: geminiResult.is_lead === true, confidence: geminiResult.confidence || 0}};"
      },
      "id": "node-parse",
      "name": "Gemini Antwort parsen",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1120, 300]
    },
    {
      "parameters": {
        "conditions": {
          "options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict"},
          "conditions": [
            {"id": "l1", "leftValue": "={{ $json.is_lead }}", "rightValue": true, "operator": {"type": "boolean", "operation": "equal"}},
            {"id": "l2", "leftValue": "={{ $json.confidence }}", "rightValue": 60, "operator": {"type": "number", "operation": "gte"}}
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "id": "node-leadcheck",
      "name": "Ist Lead (>60%)?",
      "type": "n8n-nodes-base.filter",
      "typeVersion": 2.1,
      "position": [1340, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://incbhhaiiayohrjqevog.supabase.co/rest/v1/leads",
        "sendHeaders": true,
        "headerParameters": {"parameters": [
          {"name": "apikey", "value": "SUPABASE_KEY_PLACEHOLDER"},
          {"name": "Authorization", "value": "Bearer SUPABASE_KEY_PLACEHOLDER"},
          {"name": "Content-Type", "value": "application/json"},
          {"name": "Prefer", "value": "return=representation"}
        ]},
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\"from_name\":\"{{ $json.pushName }}\",\"from_email\":\"wa_{{ $json.phone }}@whatsapp.lead\",\"phone\":\"{{ $json.phone }}\",\"message\":\"{{ $json.message }}\",\"source\":\"whatsapp\",\"category\":\"{{ $json.geminiResult.category }}\",\"priority\":\"{{ $json.geminiResult.priority }}\",\"score\":{{ $json.confidence }},\"status\":\"neu\",\"subject\":\"WA-Lead: {{ $json.geminiResult.summary }}\",\"notes\":\"Auto via WhatsApp. Confidence: {{ $json.confidence }}%\",\"tags\":[\"whatsapp\",\"auto\"]}",
        "options": {}
      },
      "id": "node-supabase",
      "name": "Lead in Supabase speichern",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1560, 180]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://172.19.0.1:8080/message/sendText/freyai-whatsapp",
        "sendHeaders": true,
        "headerParameters": {"parameters": [
          {"name": "apikey", "value": "evo_freyai_2026_secret"},
          {"name": "Content-Type", "value": "application/json"}
        ]},
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\"number\":\"{{ $('Gemini Antwort parsen').item.json.remoteJid }}\",\"text\":\"{{ $('Gemini Antwort parsen').item.json.geminiResult.reply_de }}\\n\\nTermin buchen: https://buchung.freyaivisions.de\"}",
        "options": {}
      },
      "id": "node-reply-lead",
      "name": "WhatsApp: Lead-Antwort",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1780, 180]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://172.19.0.1:8080/message/sendText/freyai-whatsapp",
        "sendHeaders": true,
        "headerParameters": {"parameters": [
          {"name": "apikey", "value": "evo_freyai_2026_secret"},
          {"name": "Content-Type", "value": "application/json"}
        ]},
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\"number\":\"{{ $json.remoteJid }}\",\"text\":\"Hallo {{ $json.pushName }}! Fuer Fragen zu IT und KI-Beratung, buche gerne ein Erstgespraech:\\nhttps://buchung.freyaivisions.de\\n\\nOder per Mail: kontakt@freyaivisions.de\"}",
        "options": {}
      },
      "id": "node-reply-nolead",
      "name": "WhatsApp: Allgemeine Antwort",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1560, 420]
    }
  ],
  "connections": {
    "WhatsApp Webhook": {"main": [[{"node": "Filter: Eingehende Msgs", "type": "main", "index": 0}, {"node": "Webhook Response", "type": "main", "index": 0}]]},
    "Filter: Eingehende Msgs": {"main": [[{"node": "Daten extrahieren", "type": "main", "index": 0}]]},
    "Daten extrahieren": {"main": [[{"node": "Gemini 2.5 Flash Analyse", "type": "main", "index": 0}]]},
    "Gemini 2.5 Flash Analyse": {"main": [[{"node": "Gemini Antwort parsen", "type": "main", "index": 0}]]},
    "Gemini Antwort parsen": {"main": [[{"node": "Ist Lead (>60%)?", "type": "main", "index": 0}]]},
    "Ist Lead (>60%)?": {"main": [[{"node": "Lead in Supabase speichern", "type": "main", "index": 0}], [{"node": "WhatsApp: Allgemeine Antwort", "type": "main", "index": 0}]]},
    "Lead in Supabase speichern": {"main": [[{"node": "WhatsApp: Lead-Antwort", "type": "main", "index": 0}]]}
  },
  "pinData": {},
  "settings": {"executionOrder": "v1", "saveManualExecutions": true},
  "staticData": null,
  "tags": ["whatsapp", "lead"],
  "triggerCount": 0,
  "active": true
}
WORKFLOW_EOF

# Platzhalter durch echte Werte ersetzen
GEMINI_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}"
sed -i "s|GEMINI_URL_PLACEHOLDER|${GEMINI_URL}|g" /tmp/whatsapp-lead-qualifizierung.json
sed -i "s|SUPABASE_KEY_PLACEHOLDER|${SUPABASE_SERVICE_KEY}|g" /tmp/whatsapp-lead-qualifizierung.json

echo "Workflow JSON erstellt."

# SCHRITT 2: Workflow in n8n importieren
echo ""
echo "--- Schritt 2: Importiere Workflow in n8n..."

# Pruefe ob bereits vorhanden
EXISTING_ID=$(curl -s "${N8N_URL}/api/v1/workflows" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
for w in d.get('data', []):
    if w.get('name') == 'WhatsApp Lead-Qualifizierung':
        print(w['id'])
        break
" 2>/dev/null)

if [ -n "$EXISTING_ID" ]; then
  echo "Workflow bereits vorhanden (ID: $EXISTING_ID) - wird geloescht und neu erstellt"
  curl -s -X DELETE "${N8N_URL}/api/v1/workflows/${EXISTING_ID}" \
    -H "X-N8N-API-KEY: ${N8N_API_KEY}" > /dev/null
fi

RESPONSE=$(curl -s -X POST "${N8N_URL}/api/v1/workflows" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @/tmp/whatsapp-lead-qualifizierung.json)

WORKFLOW_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('id','FEHLER'))" 2>/dev/null)

if [ "$WORKFLOW_ID" = "FEHLER" ] || [ -z "$WORKFLOW_ID" ]; then
  echo "FEHLER beim Erstellen:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -20
  exit 1
fi
echo "Workflow erstellt: ID=$WORKFLOW_ID"

# SCHRITT 3: Aktivieren
echo ""
echo "--- Schritt 3: Aktiviere Workflow..."
curl -s -X PATCH "${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' | python3 -c "import sys, json; d=json.load(sys.stdin); print('Aktiv:', d.get('active'))" 2>/dev/null

# SCHRITT 4: Evolution API Webhook pruefen
echo ""
echo "--- Schritt 4: Evolution API Webhook-Status..."
CURRENT_WEBHOOK=$(curl -s "http://localhost:8080/webhook/find/${EVO_INSTANCE}" \
  -H "apikey: ${EVO_API_KEY}" 2>/dev/null)
CURRENT_URL=$(echo "$CURRENT_WEBHOOK" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  if isinstance(d, list) and d:
    print(d[0].get('url', 'nicht gesetzt'))
  elif isinstance(d, dict):
    print(d.get('url', 'nicht gesetzt'))
  else:
    print('nicht gesetzt')
except:
  print('Fehler beim Parsen')
" 2>/dev/null)
echo "Aktueller Webhook: $CURRENT_URL"

WEBHOOK_URL="http://localhost:5678/webhook/whatsapp-lead"

if echo "$CURRENT_URL" | grep -q "whatsapp-lead"; then
  echo "Webhook bereits auf Lead-Workflow gesetzt."
else
  echo "HINWEIS: Evolution API hat aktuell einen anderen Webhook: $CURRENT_URL"
  echo ""
  echo "Setze Webhook auf Lead-Workflow..."
  echo "(WARNUNG: Dies ueberschreibt den bestehenden Support-Workflow-Webhook!)"
  echo ""
  echo "Um BEIDE Workflows zu bedienen, empfehle ich:"
  echo "1. Den Lead-Workflow als Router nutzen der auch Support-Tickets erstellt"
  echo "2. ODER: Den bestehenden Support-Workflow (sJa545wYjKldjIbA) um Lead-Erkennung erweitern"
  echo ""
  read -p "Webhook auf Lead-Workflow setzen? (j/N): " CONFIRM
  if [ "$CONFIRM" = "j" ] || [ "$CONFIRM" = "J" ]; then
    curl -s -X PUT "http://localhost:8080/webhook/set/${EVO_INSTANCE}" \
      -H "apikey: ${EVO_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"url\": \"${WEBHOOK_URL}\", \"webhook_by_events\": true, \"webhook_base64\": false, \"events\": [\"MESSAGES_UPSERT\", \"CONNECTION_UPDATE\"]}"
    echo "Webhook gesetzt."
  else
    echo "Webhook NICHT geaendert. Manuell setzen wenn bereit."
  fi
fi

# SCHRITT 5: Test
echo ""
echo "--- Schritt 5: Test-Aufruf..."
curl -s -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "event": "MESSAGES_UPSERT",
      "data": {
        "key": {"fromMe": false, "remoteJid": "4917600000001@s.whatsapp.net"},
        "pushName": "Test Interessent",
        "message": {"conversation": "Hallo, ich habe einen kleinen Handwerksbetrieb und suche nach KI-Automatisierung fuer meine Buchaltung."}
      }
    }
  }' && echo " -> Test-Webhook OK"

echo ""
echo "=== SETUP ABGESCHLOSSEN ==="
echo "Workflow ID: $WORKFLOW_ID"
echo "n8n URL: http://localhost:5678/workflow/${WORKFLOW_ID}"
echo ""
echo "Naechste Schritte:"
echo "1. In n8n UI pruefen: http://localhost:5678"
echo "2. Test-Nachricht via WhatsApp senden"
echo "3. Supabase Leads-Tabelle pruefen"
