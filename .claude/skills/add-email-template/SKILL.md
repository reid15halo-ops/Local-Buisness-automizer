---
name: add-email-template
description: Create a transactional email template — HTML layout, dynamic variables, German business copy, and Supabase Edge Function sender.
argument-hint: [template-name]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Create Email Template

**Argument:** `$ARGUMENTS` — e.g., `invoice-sent`, `quote-followup`, `welcome`, `payment-reminder`, `dunning-notice`

### Steps

1. **Read** existing Edge Functions in `supabase/functions/send-email/` for patterns.
2. **Read** `supabase_schema.sql` for relevant data fields.
3. Create the template.

### Template Structure

Create `supabase/functions/send-email/templates/<template-name>.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; }
        .header { background: #6366f1; color: white; padding: 24px; border-radius: 8px 8px 0 0; }
        .body { padding: 24px; background: #f8fafc; }
        .footer { padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
        .btn { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{company_name}}</h1>
    </div>
    <div class="body">
        <p>Sehr geehrte(r) {{contact_person}},</p>
        <!-- Template-specific content -->
        <p>Mit freundlichen Grüßen,<br>{{owner_name}}</p>
    </div>
    <div class="footer">
        {{company_name}} | {{address}} | {{email}} | {{phone}}
    </div>
</body>
</html>
```

### Variable Substitution

Use `{{variable}}` placeholders. Common variables:
- `{{company_name}}`, `{{owner_name}}`, `{{address}}`, `{{phone}}`, `{{email}}`
- `{{contact_person}}`, `{{customer_company}}`
- `{{invoice_number}}`, `{{invoice_date}}`, `{{due_date}}`, `{{total_gross}}`
- `{{quote_id}}`, `{{order_id}}`
- `{{portal_link}}` (for customer portal)

### German Business Email Conventions
- Formal salutation: "Sehr geehrte(r) Frau/Herr..."
- Sign-off: "Mit freundlichen Grüßen"
- Include legal footer: company name, address, tax ID, Geschäftsführer
- Reference invoice/quote numbers explicitly
