# n8n Node Patterns -- FreyAI Visions

Common node configurations extracted from production workflows. Copy and adapt these patterns.

---

## Table of Contents

1. [Triggers](#1-triggers)
2. [Supabase Operations](#2-supabase-operations)
3. [Ollama / LLM Calls](#3-ollama--llm-calls)
4. [Telegram Bot API](#4-telegram-bot-api)
5. [Supabase Edge Functions](#5-supabase-edge-functions)
6. [Control Flow](#6-control-flow)
7. [Code Nodes](#7-code-nodes)
8. [Error Handling](#8-error-handling)
9. [Webhook Responses](#9-webhook-responses)

---

## 1. Triggers

### Schedule Trigger (Cron)

```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 8 * * *"
        }
      ]
    },
    "timezone": "Europe/Berlin"
  },
  "name": "Daily 08:00 Berlin",
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "notes": "Runs every day at 08:00 Europe/Berlin. CRON: 0 8 * * *"
}
```

Common schedules:
- `0 7 * * *` -- Morning briefing (07:00)
- `0 8 * * *` -- Dunning check (08:00)
- `*/5 * * * *` -- Health monitoring (every 5 min)
- `0 9 * * 1` -- Weekly report (Monday 09:00)
- `0 0 1 * *` -- Monthly report (1st of month)

### Webhook Trigger

```json
{
  "parameters": {
    "path": "my-webhook-path",
    "httpMethod": "POST",
    "responseMode": "responseNode",
    "options": {}
  },
  "name": "Webhook: Description",
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "notes": "POST /webhook/my-webhook-path. Expects JSON body with required fields."
}
```

Key: Use `responseMode: "responseNode"` when you need to control the HTTP response (use a
`respondToWebhook` node later in the flow). Use `responseMode: "lastNode"` for simple cases.

---

## 2. Supabase Operations

### getAll (SELECT with filter)

```json
{
  "parameters": {
    "operation": "getAll",
    "tableId": "rechnungen",
    "returnAll": true,
    "filterType": "string",
    "filterString": "status=eq.offen"
  },
  "name": "SELECT Offene Rechnungen",
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "credentials": {
    "supabaseApi": {
      "id": "cred-supabase-api",
      "name": "Supabase API"
    }
  },
  "continueOnFail": true,
  "notes": "Fetches rechnungen where status='offen'."
}
```

Filter string uses PostgREST syntax:
- `status=eq.offen` -- equals
- `brutto=gte.100` -- greater than or equal
- `status=in.(aktiv,in_bearbeitung)` -- in list
- `created_at=gte.2026-01-01` -- date comparison
- Chain with `&`: `status=eq.offen&zahlungsziel_tage=gt.0`

### create (INSERT)

```json
{
  "parameters": {
    "operation": "create",
    "tableId": "automation_log",
    "dataToSend": "defineBelow",
    "fieldsToSend": {
      "fieldValues": [
        { "fieldId": "action", "fieldValue": "workflow_name.completed" },
        { "fieldId": "target", "fieldValue": "={{ $json.id }}" },
        {
          "fieldId": "metadata",
          "fieldValue": "={{ JSON.stringify({ key: 'value', timestamp: new Date().toISOString() }) }}"
        }
      ]
    }
  },
  "name": "INSERT automation_log",
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "credentials": {
    "supabaseApi": { "id": "cred-supabase-api", "name": "Supabase API" }
  }
}
```

### update (UPDATE with filter)

```json
{
  "parameters": {
    "operation": "update",
    "tableId": "rechnungen",
    "filters": {
      "conditions": [
        {
          "keyName": "id",
          "condition": "eq",
          "keyValue": "={{ $json.rechnung_id }}"
        }
      ]
    },
    "dataToSend": "defineBelow",
    "fieldsToSend": {
      "fieldValues": [
        { "fieldId": "status", "fieldValue": "bezahlt" },
        { "fieldId": "paid_at", "fieldValue": "={{ new Date().toISOString() }}" }
      ]
    }
  },
  "name": "UPDATE rechnungen status",
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "credentials": {
    "supabaseApi": { "id": "cred-supabase-api", "name": "Supabase API" }
  }
}
```

---

## 3. Ollama / LLM Calls

### Chat Completion via HTTP Request

```json
{
  "parameters": {
    "method": "POST",
    "url": "={{ $env['OLLAMA_BASE_URL'] || 'http://172.19.0.1:11434' }}/api/chat",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ model: $env['OLLAMA_MODEL'] || 'mistral-small', messages: [ { role: 'system', content: 'Du bist ein professioneller Assistent fuer einen deutschen Handwerksbetrieb.' }, { role: 'user', content: 'Generate content based on: ' + JSON.stringify($json) } ], stream: false, options: { temperature: 0.3, num_predict: 1024 } }) }}",
    "options": {
      "timeout": 120000,
      "response": { "response": { "neverError": true } }
    }
  },
  "name": "Generate Content (Ollama)",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "continueOnFail": true,
  "notes": "Calls local Ollama on VPS. Response: response.message.content. Timeout 120s for local inference."
}
```

### Extracting Ollama Response

The Ollama `/api/chat` response has this structure:
```json
{
  "message": {
    "role": "assistant",
    "content": "The generated text..."
  },
  "done": true
}
```

Access the text: `{{ $json.message.content }}` or with fallback:
`{{ $json.message ? $json.message.content : 'Fallback text' }}`

---

## 4. Telegram Bot API

### Send Message

```json
{
  "parameters": {
    "method": "POST",
    "url": "=https://api.telegram.org/bot{{ $env['TELEGRAM_BOT_TOKEN'] }}/sendMessage",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"chat_id\": \"{{ $env['TELEGRAM_CTO_CHAT_ID'] }}\",\n  \"text\": \"<b>Title</b>\\n\\nMessage body here\",\n  \"parse_mode\": \"HTML\",\n  \"disable_notification\": false\n}",
    "options": { "timeout": 10000 }
  },
  "name": "Send Telegram Message",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "continueOnFail": true,
  "notes": "Sends message via Telegram Bot API. Uses HTML parse_mode for formatting."
}
```

Telegram HTML formatting:
- `<b>bold</b>`, `<i>italic</i>`, `<code>monospace</code>`
- `<a href="url">link</a>`
- Newlines: `\n`
- Max message length: 4096 characters (truncate if needed)

---

## 5. Supabase Edge Functions

### Call send-email Edge Function

```json
{
  "parameters": {
    "method": "POST",
    "url": "=https://{{ $env['SUPABASE_PROJECT_REF'] }}.supabase.co/functions/v1/send-email",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Authorization", "value": "=Bearer {{ $env['SUPABASE_SERVICE_ROLE_KEY'] }}" },
        { "name": "Content-Type", "value": "application/json" },
        { "name": "apikey", "value": "={{ $env['SUPABASE_ANON_KEY'] }}" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"to\": \"{{ $json.email }}\",\n  \"subject\": \"{{ $json.subject }}\",\n  \"body\": {{ JSON.stringify($json.html_body) }}\n}",
    "options": { "timeout": 15000 }
  },
  "name": "Send Email (Edge Function)",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "continueOnFail": true,
  "notes": "Calls Supabase send-email edge function. Requires SUPABASE_PROJECT_REF, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY."
}
```

### Call send-sms Edge Function

Same pattern but URL ends in `/functions/v1/send-sms` and body is:
```json
{ "to": "+49...", "message": "SMS text" }
```

---

## 6. Control Flow

### IF Node (Conditional)

```json
{
  "parameters": {
    "conditions": {
      "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict" },
      "conditions": [
        {
          "id": "check-id",
          "leftValue": "={{ $json.days_overdue }}",
          "rightValue": 0,
          "operator": { "type": "number", "operation": "gt" }
        }
      ],
      "combinator": "and"
    }
  },
  "name": "Is Overdue?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2
}
```

Common operators:
- Number: `gt`, `gte`, `lt`, `lte`, `eq`
- String: `equals`, `notEquals`, `contains`, `notEmpty`, `isEmpty`
- Boolean: `true`, `false`

### Switch Node (Multi-branch routing)

```json
{
  "parameters": {
    "rules": {
      "values": [
        {
          "conditions": {
            "conditions": [
              {
                "leftValue": "={{ $json.intent }}",
                "rightValue": "appointment_request",
                "operator": { "type": "string", "operation": "equals" }
              }
            ],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "appointment"
        },
        {
          "conditions": {
            "conditions": [
              {
                "leftValue": "={{ $json.intent }}",
                "rightValue": "quote_request",
                "operator": { "type": "string", "operation": "equals" }
              }
            ],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "quote"
        }
      ]
    }
  },
  "name": "Route by Intent",
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3
}
```

### Split In Batches

```json
{
  "parameters": {
    "batchSize": 5,
    "options": {}
  },
  "name": "Split In Batches",
  "type": "n8n-nodes-base.splitInBatches",
  "typeVersion": 3
}
```

Use when processing >10 items to avoid memory issues. Batch size 5-10 is the sweet spot.

### Merge Node

```json
{
  "parameters": {
    "mode": "combine",
    "combinationMode": "multiplex",
    "options": {}
  },
  "name": "Merge Results",
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3
}
```

Modes:
- `multiplex` -- Combine items from multiple inputs into one stream
- `append` -- Concatenate all items from all inputs
- `chooseBranch` -- Wait for all inputs, pass through one branch

### Set Node (Field Mapping)

```json
{
  "parameters": {
    "mode": "expression",
    "assignments": {
      "assignments": [
        {
          "id": "field-id",
          "name": "output_field",
          "value": "={{ $json.input_field || 'default' }}",
          "type": "string"
        }
      ]
    },
    "includeOtherFields": true,
    "options": {}
  },
  "name": "Prepare Data",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4
}
```

---

## 7. Code Nodes

### JavaScript Code Node

```json
{
  "parameters": {
    "jsCode": "const items = $('Previous Node Name').all().map(i => i.json);\n\n// Process data\nconst result = items.map(item => ({\n  id: item.id,\n  processed: true\n}));\n\nreturn [{ json: { items: result, count: result.length } }];"
  },
  "name": "Process Data",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "notes": "Aggregates and transforms data from previous node."
}
```

Key patterns in Code nodes:
- Access previous node: `$('Node Name').all()` returns array of items
- Access current input: `$input.all()` or `$input.first()`
- Return format: `return [{ json: { ... } }]` (always array of items)
- Multi-item return: `return items.map(item => ({ json: item }))`

---

## 8. Error Handling

### Error Handler Node Pattern

```json
{
  "parameters": {
    "operation": "create",
    "tableId": "automation_log",
    "dataToSend": "defineBelow",
    "fieldsToSend": {
      "fieldValues": [
        { "fieldId": "action", "fieldValue": "workflow_name.error" },
        { "fieldId": "target", "fieldValue": "={{ $json.id || 'unknown' }}" },
        {
          "fieldId": "metadata",
          "fieldValue": "={{ JSON.stringify({ error: $json.error || 'Unknown error', node: $json.node || '', timestamp: new Date().toISOString() }) }}"
        }
      ]
    }
  },
  "name": "Error Handler: Log to automation_log",
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "credentials": {
    "supabaseApi": { "id": "cred-supabase-api", "name": "Supabase API" }
  },
  "notes": "Catches and logs any step failure to automation_log."
}
```

### continueOnFail Pattern

Set `"continueOnFail": true` at the node's top level (not inside parameters) for any node that
calls an external service. This ensures the workflow continues even if that service is down.

When a node fails with continueOnFail, the output includes `$json.error` with the error details.
Use this in the next node to detect failures:

```
={{ $json.error ? 'Fallback value' : $json.expected_field }}
```

---

## 9. Webhook Responses

### Respond to Webhook (Success)

```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ success: true, message: 'Processed successfully', data: $json }) }}",
    "options": {
      "responseCode": 200
    }
  },
  "name": "Respond: Success",
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.1
}
```

### Respond to Webhook (Error)

```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ success: false, error: 'Validation failed', details: $json.validation_errors || [] }) }}",
    "options": {
      "responseCode": 400
    }
  },
  "name": "Respond: Validation Error (400)",
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.1
}
```

---

## Workflow JSON Skeleton

Use this as a starting template for new workflows:

```json
{
  "name": "Workflow Name (English Subtitle)",
  "nodes": [],
  "connections": {},
  "active": false,
  "settings": {
    "executionOrder": "v1",
    "saveManualExecutions": true,
    "callerPolicy": "workflowsFromSameOwner",
    "errorWorkflow": ""
  },
  "staticData": null,
  "tags": ["tag1", "tag2"],
  "triggerCount": 1,
  "updatedAt": "2026-03-13T00:00:00.000Z",
  "versionId": "1",
  "meta": {
    "templateCredsSetupCompleted": false,
    "instanceId": "freyai-hetzner-vps"
  },
  "pinData": {},
  "notes": "## Workflow Name\n\n### Schedule\n...\n\n### Flow\n1. ...\n\n### Setup Required\n1. **Credentials**: ...\n2. **Env Vars**: ..."
}
```

### Connection Format

```json
{
  "Source Node Name": {
    "main": [
      [
        { "node": "Target Node Name", "type": "main", "index": 0 }
      ]
    ]
  }
}
```

For nodes with multiple outputs (IF, Switch):
- Output 0 (true/first branch): `"main": [ [{ ... }], [] ]`
- Output 1 (false/second branch): `"main": [ [], [{ ... }] ]`

### Node Position Convention

Start at [240, 300] for the trigger node. Space nodes ~220px apart horizontally.
Parallel branches offset vertically by ~160px.
