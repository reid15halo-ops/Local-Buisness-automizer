---
name: offer
description: |
  Create, manage, and send professional Angebote (quotes/offers) for FreyAI Visions services.
  Use this skill when the user asks to create a quote, generate an offer, prepare a proposal,
  build an Angebot, price a project, send a quote to a customer, generate quote variants,
  or manage the offer lifecycle (Anfrage → Angebot → Auftrag).
  Also trigger when the user says "Angebot erstellen", "was soll ich dem Kunden anbieten",
  "price this out", "prepare a proposal", "how much should I charge", "quote for",
  "send offer to", "convert quote to order", or any request involving pricing FreyAI services.
  This skill covers the full lifecycle from initial inquiry to accepted order.
---

# Offer Skill — FreyAI Angebot Creator

Create professional, legally compliant Angebote (quotes) for FreyAI Visions services. Covers the full lifecycle: pricing, position building, email sending, customer portal, and order conversion.

Read `references/pricing-guide.md` for service tiers and pricing ranges before creating any offer.

## 1. Understand the Request

Before creating an Angebot, gather:

| Required | How to get it |
|----------|--------------|
| Customer name | Ask user or check `kunden` table |
| Customer email | Ask user or check `kunden` table |
| Service scope | User describes what the customer needs |
| Complexity tier | Determine from scope: Starter / Professional / Enterprise |

If creating from an existing Anfrage (inquiry), read the anfrage data first:
```javascript
const anfrage = store.store.anfragen.find(a => a.id === anfrageId);
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
  "details": "Umfassende Analyse aller Geschäftsprozesse inkl. Digitalisierungspotenzial"
}
```

### Required Fields
- `beschreibung` — Clear German description of the service
- `menge` — Quantity (use 1 for Pauschal items)
- `einheit` — Unit: `Pauschal`, `Std.`, `Stk.`, `Monat`, `m`, `m²`
- `einzelpreis` — Unit price in EUR (net)

### Pricing Rules
1. **Kleinunternehmer §19 UStG**: FreyAI charges NO VAT. Set `mwst: 0`.
2. **Netto = Brutto** for all quotes (no MwSt line).
3. All prices in EUR with 2 decimal places.
4. Always include "Erstgespräch & Betriebsanalyse" as position 1 at €0 (free consultation).
5. Validity: 30 days from creation (`gueltig_bis`).

### Calculation
```javascript
const netto = positionen.reduce((sum, p) => sum + (p.menge * p.einzelpreis), 0);
const mwst = 0; // Kleinunternehmer
const brutto = netto;
```

## 3. Select Service Tier

Read `references/pricing-guide.md` for detailed position catalogs per tier.

| Tier | Setup Range | Monthly Retainer | Target Customer |
|------|-------------|-----------------|-----------------|
| **Starter** | €3,500–4,500 | €300/month | 1-3 employees, basic digitalization |
| **Professional** | €5,000–6,500 | €400/month | 4-7 employees, full automation |
| **Enterprise** | €6,500–7,500 | €500/month | 8-10+ employees, custom integrations |

### Variant Generation (Budget/Standard/Premium)
When the user wants options, generate 3 variants:
- **Budget (Sparpaket)**: Core positions only, labor discounted 20%, no premium add-ons
- **Standard (Empfohlen)**: Full recommended scope, marked as "EMPFOHLEN"
- **Premium (Komplettpaket)**: Full scope + premium extras (extended warranty, priority support, advanced integrations), 1.25× premium factor

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
  createdAt: new Date().toISOString()
};
```

### Status Workflow
```
entwurf → offen → angenommen → (auto-creates Auftrag)
                 → abgelehnt
```

## 5. Generate Angebot Text

The professional text block accompanies the positions. Must include:

1. **Greeting**: "Sehr geehrte/r [Anrede] [Name],"
2. **Reference**: What was discussed / the inquiry
3. **Scope summary**: 2-3 sentences describing the project
4. **Kleinunternehmer notice**: "Gemäß §19 UStG wird keine Umsatzsteuer berechnet."
5. **Validity**: "Dieses Angebot ist 30 Tage gültig."
6. **Call to action**: Invitation to discuss or accept
7. **Closing**: "Mit freundlichen Grüßen, Jonas Glawion — FreyAI Visions"

Read `references/templates-guide.md` for full text templates.

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

### Customer Portal
Customers can approve/reject via portal token:
- `portal_approve_quote(token, angebot_id)` — sets status to 'angenommen'
- `portal_reject_quote(token, angebot_id, reason)` — sets status to 'abgelehnt'

## 7. Convert to Auftrag (Order)

When status changes to 'angenommen':
```javascript
store.acceptAngebot(angebotId);
// Automatically creates Auftrag with:
// - Same positionen, kunde, leistungsart
// - Status: 'in_bearbeitung'
// - Reference back to angebotId
```

## 8. Quality Checklist

Before sending any Angebot, verify all 12 items:

1. [ ] Customer name and email are correct
2. [ ] All positionen have beschreibung, menge, einheit, einzelpreis
3. [ ] Position 1 is "Erstgespräch & Betriebsanalyse" at €0
4. [ ] Prices are within tier range (Starter 3.5-4.5k, Professional 5-6.5k, Enterprise 6.5-7.5k)
5. [ ] MwSt is 0 (Kleinunternehmer §19 UStG)
6. [ ] Netto equals Brutto (no VAT)
7. [ ] Gültig bis is set to 30 days from creation
8. [ ] Angebot text includes Kleinunternehmer notice
9. [ ] Monthly retainer position is included (if applicable)
10. [ ] Status is 'entwurf' before review, 'offen' when sent
11. [ ] All text is in German (Handwerker target audience)
12. [ ] No PII sent to external AI services (DSGVO)

## References

- `references/pricing-guide.md` — Service tiers, position catalog, pricing ranges
- `references/workflow-guide.md` — Full lifecycle: Anfrage → Angebot → Auftrag → Rechnung
- `references/templates-guide.md` — Email templates, Angebot text templates, position templates
