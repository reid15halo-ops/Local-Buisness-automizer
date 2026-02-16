---
name: add-automation
description: Create an n8n automation workflow JSON — triggers, Supabase nodes, email/SMS actions, conditional logic, and error handling.
argument-hint: [workflow-name] [trigger-event]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Create n8n Automation Workflow

**Arguments:** `$ARGUMENTS` — parse as `[workflow-name] [trigger-event]`
Examples: `invoice-reminder overdue`, `welcome-email signup`, `slack-notify new-order`

### Steps

1. **Read** `config/n8n-workflow.json` for existing workflow patterns.
2. **Read** `supabase_schema.sql` for the relevant table structure.
3. Create or update the workflow JSON.

### Workflow Structure

```json
{
  "name": "<workflow-name>",
  "nodes": [
    {
      "name": "Trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "<trigger-path>"
      }
    },
    {
      "name": "Supabase Query",
      "type": "n8n-nodes-base.supabase",
      "parameters": {
        "operation": "getAll",
        "tableId": "<table-name>",
        "filters": {}
      }
    },
    {
      "name": "Action",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {}
    }
  ],
  "connections": {}
}
```

### Common Workflow Patterns

| Pattern | Trigger | Action |
|---------|---------|--------|
| Invoice reminder | Cron (daily 8am) | Query overdue invoices → send email |
| Welcome email | Webhook (signup) | Get profile → send welcome email |
| Slack notification | Webhook (new order) | Format message → post to Slack |
| Dunning escalation | Cron (weekly) | Query overdue >30d → create dunning entry |
| Backup export | Cron (weekly) | Export all tables → store as CSV |

### Integration Points
- **Trigger URL**: `https://n8n.yourdomain.com/webhook/<path>`
- **Supabase connection**: Use service role key in n8n credentials
- **Frontend hook**: Call trigger from `automation-api.js`
