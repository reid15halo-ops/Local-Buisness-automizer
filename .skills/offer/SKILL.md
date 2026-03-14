---
name: offer
description: |
  Create, manage, and send professional Angebote (quotes/offers) for FreyAI Visions services.
  Use this skill when the user asks to create a quote, generate an offer, prepare a proposal,
  build an Angebot, price a project, send a quote to a customer, generate quote variants,
  or manage the offer lifecycle (Anfrage -> Angebot -> Auftrag).
  Also trigger when the user says "Angebot erstellen", "was soll ich dem Kunden anbieten",
  "price this out", "prepare a proposal", "how much should I charge", "quote for",
  "send offer to", "convert quote to order", or any request involving pricing FreyAI services.
  This skill covers the full lifecycle from initial inquiry to accepted order,
  including variant generation, discount logic, follow-up automation, and portal approval.
---

# Offer Skill -- FreyAI Angebot Creator

Create professional, legally compliant Angebote (quotes) for FreyAI Visions services. Covers the full lifecycle: pricing, position building, variant generation, email sending, PDF export, customer portal, follow-up, and order conversion.

Read `references/pricing-guide.md` for service tiers and pricing ranges before creating any offer.

## 1. Understand the Request

Before creating an Angebot, gather:

| Required | How to get it |
|----------|--------------|
| Customer name | Ask user or lookup via Supabase `kunden` table |
| Customer email | Ask user or lookup via Supabase `kunden` table |
| Service scope | User describes what the customer needs |
| Complexity tier | Determine from scope: Starter / Professional / Enterprise |

### Supabase Customer Lookup

Always try Supabase first before asking the user:

```javascript
// Lookup existing customer by name or email
const { data: kunde, error } = await supabase
  .from('kunden')
  .select('id, name, email, telefon, anrede')
  .or(`name.ilike.%${searchTerm}%,email.eq.${searchTerm}`)
  .limit(1)
  .single();

if (error || !kunde) {
  // Customer not found -- ask user for details
}
```

If creating from an existing Anfrage (inquiry), read the anfrage data first:
```javascript
const { data: anfrage } = await supabase
  .from('anfragen')
  .select('*')
  .eq('id', anfrageId)
  .single();
// Extract: kunde_name, leistungsart, beschreibung, budget_hinweis
```

## 2. Build Positionen (Line Items)

Every Angebot needs structured positionen. Read `references/pricing-guide.md` for the full position catalog.

### Position Structure
```json
{
  "beschreibung": "Digital-Audit & Prozessanalyse",
  "menge": 1,
  "einheit": "Pauschal",
  "einzelpreis": 490,
  "details": "Umfassende Analyse aller Geschaeftsprozesse inkl. Digitalisierungspotenzial"
}
```

### Required Fields per Position
- `beschreibung` -- Clear German description of the service
- `menge` -- Quantity (use 1 for Pauschal items)
- `einheit` -- Unit: `Pauschal`, `Std.`, `Stk.`, `Monat`, `m`, `m2`
- `einzelpreis` -- Unit price in EUR (net, 2 decimal places)

### Optional Fields
- `details` -- Extended description shown in PDF/email (max 200 chars)
- `rabatt` -- Discount percentage (0-100, applied to this position only)

### Pricing Rules
1. **Kleinunternehmer par. 19 UStG**: FreyAI charges NO VAT. Set `mwst: 0`.
2. **Netto = Brutto** for all quotes (no MwSt line).
3. All prices in EUR with 2 decimal places.
4. Always include "Erstgespraech & Betriebsanalyse" as position 1 at 0 EUR (free consultation).
5. Validity: 30 days from creation (`gueltig_bis`).

### Calculation
```javascript
const netto = positionen.reduce((sum, p) => {
  const posTotal = p.menge * p.einzelpreis;
  const discount = p.rabatt ? posTotal * (p.rabatt / 100) : 0;
  return sum + posTotal - discount;
}, 0);
const mwst = 0; // Kleinunternehmer
const brutto = netto;
```

## 3. Select Service Tier

Read `references/pricing-guide.md` for detailed position catalogs per tier.

| Tier | Setup Range | Monthly Retainer | Target Customer |
|------|-------------|-----------------|-----------------|
| **Starter** | 3.500-4.500 EUR | 300 EUR/month | 1-3 employees, basic digitalization |
| **Professional** | 5.000-6.500 EUR | 400 EUR/month | 4-7 employees, full automation |
| **Enterprise** | 6.500-7.500 EUR | 500 EUR/month | 8-10+ employees, custom integrations |

### Variant Generation (Budget/Standard/Premium)
When the user wants options, generate 3 variants as separate Angebot objects:

| Variant | Label | Pricing Logic | Visual Marker |
|---------|-------|---------------|---------------|
| **Budget (Sparpaket)** | "Basis" | Core positions only, 20% labor discount | -- |
| **Standard (Empfohlen)** | "Empfohlen" | Full recommended scope | Badge: "EMPFOHLEN" |
| **Premium (Komplettpaket)** | "Premium" | Full scope + extras, 1.25x premium factor | -- |

Each variant gets its own Angebot ID (ANG-xxx-budget, ANG-xxx-standard, ANG-xxx-premium).
Customer can accept any one variant. Accepting one auto-rejects the others.

### Discount Rules
| Scenario | Max Discount | Requires Approval |
|----------|-------------|-------------------|
| Referral (existing customer referred them) | 10% on setup | No |
| Bundle (3+ modules) | 5% on total | No |
| Annual prepay (12 months retainer upfront) | 15% on retainer | No |
| Custom negotiation | Up to 20% | Yes (Jonas decides) |
| Never discount below | Starter: 2.800 EUR / Professional: 4.000 EUR / Enterprise: 5.200 EUR | -- |

## 4. Create the Angebot Object

```javascript
const angebot = {
  id: `ANG-${Date.now()}`,
  anfrageId: anfrage?.id || null,
  kunde: { name, email, telefon },
  kunde_name: name,
  kunde_email: email,
  kunde_telefon: telefon,
  leistungsart: 'KI-Beratung & Setup',
  positionen: [...],
  text: generateAngebotText(kunde, positionen),
  netto: calculatedNetto,
  mwst: 0,
  brutto: calculatedNetto,
  status: 'entwurf',
  gueltig_bis: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  createdAt: new Date().toISOString(),
  variante: null, // 'budget' | 'standard' | 'premium' | null
  rabatt_gesamt: 0, // total discount in EUR
  rabatt_grund: null // reason for discount
};
```

### Status Workflow
```
entwurf -> offen -> angenommen -> (auto-creates Auftrag)
                 -> abgelehnt -> (optional: follow-up nach 7 Tagen)
                 -> abgelaufen -> (auto after gueltig_bis, send reminder 3 days before)
```

## 5. Generate Angebot Text

The professional text block accompanies the positions. Must include:

1. **Greeting**: "Sehr geehrte/r [Anrede] [Name],"
2. **Reference**: What was discussed / the inquiry
3. **Scope summary**: 2-3 sentences describing the project
4. **Kleinunternehmer notice**: "Gemaess par. 19 UStG wird keine Umsatzsteuer berechnet."
5. **Validity**: "Dieses Angebot ist 30 Tage gueltig."
6. **Call to action**: Invitation to discuss or accept
7. **Closing**: "Mit freundlichen Gruessen, Jonas Glawion -- FreyAI Visions"

Read `references/templates-guide.md` for full text templates.

### Text Rules
- All text in German (target: Handwerker)
- Siezen always (Sie/Ihnen/Ihr)
- No English words except product names (Professional-Paket, Enterprise-Paket)
- No KI-Geschwaesel ("innovative Loesung", "Potenzial entfalten")
- Direct, premium tone -- confident, never begging

## 6. Send the Angebot

### Email
Use the email template service:
```javascript
const { subject, html } = emailTemplateService.getAngebotEmail(angebot, company);
```

Email includes:
- Professional HTML with dark theme branding
- Positions table with all line items
- Totals section (netto only, Kleinunternehmer notice)
- 30-day validity note
- Company footer (kontakt@freyaivisions.de, IBAN, Steuernummer)
- Portal link for online approval (if portal token exists)

### Customer Portal
Customers can approve/reject via portal token:
- `portal_approve_quote(token, angebot_id)` -- sets status to 'angenommen'
- `portal_reject_quote(token, angebot_id, reason)` -- sets status to 'abgelehnt' + stores reason
- Portal shows: positions table, total, validity, approve/reject buttons
- Rejection requires reason text (min 10 chars) -- feeds back to CRM

## 7. PDF Export

Every Angebot can be exported as a PDF. The PDF is generated client-side and sent as attachment.

### PDF Generation
```javascript
// Generate PDF buffer from the Angebot object
const pdfBuffer = await pdfService.generateAngebotPDF(angebot, company);

// Save locally for download
const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `Angebot-${angebot.id}.pdf`;
a.click();
URL.revokeObjectURL(url);
```

### PDF Content Requirements
The generated PDF must include:

| Section | Content |
|---------|---------|
| Header | FreyAI Visions logo, Adresse (Grabenstrasse 135, 63762 Grossostheim) |
| Angebot-Nummer | `angebot.id` (ANG-xxxxx) |
| Empfaenger | Kunde Name, Adresse, Email |
| Angebotsdatum | `createdAt` formatted as DD.MM.YYYY |
| Gueltig bis | `gueltig_bis` formatted as DD.MM.YYYY |
| Positionen | Tabelle: Nr., Beschreibung, Menge, Einheit, Einzelpreis, Gesamtpreis |
| Summen | Nettobetrag, MwSt (0,00 EUR), Gesamtbetrag |
| Kleinunternehmer | "Gemaess par. 19 UStG wird keine Umsatzsteuer berechnet." |
| Angebot-Text | Professional text block |
| Signatur | "Mit freundlichen Gruessen, Jonas Glawion" |
| Footer | Steuernummer, IBAN, Kontakt |

### PDF Attachment in Email
```javascript
// Attach PDF to outgoing email
const { subject, html } = emailTemplateService.getAngebotEmail(angebot, company);
await emailService.send({
  to: angebot.kunde_email,
  subject,
  html,
  attachments: [{
    filename: `Angebot-${angebot.id}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf'
  }]
});
```

### PDF Rules
- Page size: A4 (210mm x 297mm)
- Font: Inter or system sans-serif, min 10pt body text
- Colors: Dark theme branding (as per design system)
- Margins: 20mm all sides
- Filename format: `Angebot-ANG-[ID].pdf`
- No external images -- logo must be embedded as base64

## 8. Follow-Up Automation

### Automated Follow-Ups (via n8n)
| Trigger | Action | Template |
|---------|--------|----------|
| Angebot sent + 3 days no response | Send friendly reminder email | "Kurze Rueckmeldung zu Ihrem Angebot" |
| Angebot expires in 3 days | Send expiry warning email | "Ihr Angebot laeuft in 3 Tagen aus" |
| Angebot rejected | Send "Schade" email after 1 day, offer call | "Duerfen wir nachfragen?" |
| Angebot rejected + 30 days | Re-engage with updated offer (if scope changed) | "Neues Angebot fuer Sie" |

### Manual Follow-Up
- User says "Nachfass fuer Angebot ANG-xxx" -> generate follow-up email
- Never send more than 3 automated follow-ups per Angebot

## 9. Convert to Auftrag (Order)

When status changes to 'angenommen':
```javascript
store.acceptAngebot(angebotId);
// Automatically creates Auftrag with:
// - Same positionen, kunde, leistungsart
// - Status: 'in_bearbeitung'
// - Reference back to angebotId
// - Triggers: Auftragsbestaetigung email to customer
// - Triggers: Telegram notification to Jonas
```

If variants exist, accepting one variant auto-rejects the others:
```javascript
// Find sibling variants and set status = 'abgelehnt'
const siblings = angebote.filter(a => a.anfrageId === angebot.anfrageId && a.id !== angebotId);
siblings.forEach(s => store.updateAngebot(s.id, { status: 'abgelehnt' }));
```

## 10. Quality Checklist

Before sending any Angebot, verify all items:

1. [ ] Customer name and email are correct (verified via Supabase kunden lookup)
2. [ ] All positionen have beschreibung, menge, einheit, einzelpreis
3. [ ] Position 1 is "Erstgespraech & Betriebsanalyse" at 0 EUR
4. [ ] Prices are within tier range (Starter 3.5-4.5k, Professional 5-6.5k, Enterprise 6.5-7.5k)
5. [ ] MwSt is 0 (Kleinunternehmer par. 19 UStG)
6. [ ] Netto equals Brutto (no VAT)
7. [ ] Gueltig bis is set to 30 days from creation
8. [ ] Angebot text includes Kleinunternehmer notice
9. [ ] Monthly retainer position is included (if applicable)
10. [ ] Status is 'entwurf' before review, 'offen' when sent
11. [ ] All text is in German (Handwerker target audience)
12. [ ] No PII sent to external AI services (DSGVO)
13. [ ] Discount does not breach minimum floor (2.8k / 4k / 5.2k)
14. [ ] Variants (if generated) have distinct IDs and correct labels
15. [ ] Portal link included in email if customer has portal token
16. [ ] PDF exported and attached to outgoing email
17. [ ] PDF includes all required sections (header, positions, Kleinunternehmer notice, footer)

## References

- `references/pricing-guide.md` -- Service tiers, position catalog, pricing ranges
- `references/workflow-guide.md` -- Full lifecycle: Anfrage -> Angebot -> Auftrag -> Rechnung
- `references/templates-guide.md` -- Email templates, Angebot text templates, position templates
