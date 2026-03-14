---
name: customer-onboarding
description: |
  Design and manage the customer onboarding flow for FreyAI Visions.
  Use this skill when the user asks about the setup wizard, Fragebogen (questionnaire),
  data import, customer training, onboarding steps, or the journey from signup to go-live.
  Also trigger when the user says "onboarding", "setup wizard", "Fragebogen",
  "Kundeneinrichtung", "questionnaire", "data import", "Excel import",
  "customer setup", "training", "go-live", or any request involving new customer activation.
---

# Customer Onboarding Skill — FreyAI Setup Flow

Design and manage the 3-layer customer onboarding: Auth → Setup Wizard → Fragebogen, mapping to the €3.5k–7.5k setup engagement.

Read `references/onboarding-flow.md` for the complete journey before making changes.

## 1. Onboarding Architecture

Three sequential layers, each building on the previous:

```
Layer 1: Authentication (auth.html)
  ↓ User signs up / logs in
Layer 2: Setup Wizard (3 steps, 13 fields)
  ↓ Basic company info captured
Layer 3: Fragebogen (52 questions, 11 sections)
  ↓ Deep business analysis
→ Ready for: Angebot creation, data import, system configuration
```

### Key Files
| Component | Location | Purpose |
|-----------|----------|---------|
| Auth page | `auth.html` | Login/signup with Supabase Auth |
| Setup Wizard | `js/modules/setup-wizard.js` | 3-step company setup |
| Fragebogen | `js/modules/fragebogen.js` | 52-question business questionnaire |
| Import Service | `js/services/fragebogen-import-service.js` | Maps questionnaire → system config |
| Tutorial | `js/services/onboarding-tutorial.js` | 10-step interactive walkthrough |

## 2. Layer 1: Authentication

### Flow
```
Landing page → "Jetzt starten" → auth.html
  ├─→ Email/Password signup
  ├─→ Google OAuth
  └─→ Magic Link
→ Profile created in profiles table
→ Redirect to dashboard (index.html)
→ Setup wizard auto-triggers if profile incomplete
```

### Auth Rules
- Supabase Auth handles all credential management
- Profile row auto-created via database trigger
- Double-submit protection on signup form
- German error messages for auth failures
- DSGVO consent checkbox mandatory before account creation

## 3. Layer 2: Setup Wizard

### 3 Steps (Welcome → Integrations → Complete)

**Step 1: Welcome (User Profile) — 13 Fields**
| Field (localStorage key) | Type | Required |
|--------------------------|------|----------|
| `company_name` | Text | Yes |
| `owner_name` | Text | Yes |
| `address_street` | Text | Yes |
| `address_postal` | Text | Yes |
| `address_city` | Text | Yes |
| `tax_number` | Text | Yes |
| `email` | Email | Yes (pre-filled) |
| `phone` | Tel | No |
| `iban` | Text | No |
| `bic` | Text | No |
| `kleinunternehmer` | Checkbox | No |
| `business_type` | Text | No |
| `company_logo` | File | No |

**Step 2: Integrations (Optional)**
- Paperless-ngx (URL + API token)
- Cal.com (URL + API key)
- Postiz (URL + API key)
- WhatsApp (API URL + key + instance)

**Step 3: Complete** — Success screen

### Wizard Rules
1. Each step validates before allowing "Weiter" (Next)
2. Data saves to `profiles` table on completion
3. Wizard only shows once (flagged in profile)
4. "Zurück" (Back) preserves entered data
5. Skip option available but discouraged
6. Data also persists in Supabase + IndexedDB to survive session loss

## 4. Layer 3: Fragebogen (Questionnaire)

### 11 Sections, 52 Questions

| # | Section | Questions | Purpose |
|---|---------|-----------|---------|
| 1 | Geschäftsübersicht | 5 | Company basics, revenue, goals |
| 2 | Aktuelle IT-Infrastruktur | 5 | Existing software, pain points |
| 3 | Kundenverwaltung | 5 | How customers are tracked today |
| 4 | Angebots- & Auftragswesen | 5 | Quote/order workflow |
| 5 | Rechnungsstellung | 5 | Invoicing process, payment terms |
| 6 | Kommunikation | 4 | Email, phone, messaging habits |
| 7 | Terminplanung | 4 | Scheduling, calendar usage |
| 8 | Lagerverwaltung | 4 | Inventory, ordering, suppliers |
| 9 | Buchhaltung | 5 | Bookkeeping, DATEV, tax advisor |
| 10 | Marketing | 5 | Online presence, social media |
| 11 | Wünsche & Prioritäten | 5 | Feature priorities, budget, timeline |

### Question Types
- **Text**: Free-form input
- **Select**: Dropdown with predefined options
- **Multi-select**: Checkbox group
- **Number**: Numeric input with validation
- **Scale**: 1-5 rating (priority/satisfaction)

### Fragebogen Rules
1. Can be filled incrementally (auto-saves per section)
2. Section progress tracked visually
3. Completion triggers notification to admin (Jonas)
4. Data stored in `fragebogen_responses` or profile JSONB
5. Can be sent to customer as link (portal token)

## 5. Data Import (Fragebogen → System)

### Field Mapping (12 core mappings + extras)
```javascript
// fragebogen-import-service.js fieldMapping array
// Fragebogen field → Setup wizard key → Store settings key
const fieldMapping = [
  { fragebogen: 'firmenname',    wizard: 'company_name',    store: 'companyName' },
  { fragebogen: 'inhaber',       wizard: 'owner_name',      store: 'owner' },
  { fragebogen: 'gewerk',        wizard: 'business_type',   store: 'businessType' },
  { fragebogen: 'strasse',       wizard: 'address_street',  store: null },
  { fragebogen: 'plz',           wizard: 'address_postal',  store: null },
  { fragebogen: 'ort',           wizard: 'address_city',    store: null },
  { fragebogen: 'telefon',       wizard: null,              store: 'phone' },
  { fragebogen: 'email',         wizard: null,              store: 'email' },
  { fragebogen: 'steuernummer',  wizard: 'tax_number',      store: 'taxId' },
  { fragebogen: 'ust_id',        wizard: null,              store: 'vatId' },
  { fragebogen: 'iban',          wizard: null,              store: 'iban' },
  { fragebogen: 'bic',           wizard: null,              store: 'bic' },
];

// Extra fields stored in localStorage blob (not in main mapping):
// rechtsform, kleinunternehmer, mitarbeiter, website,
// satz_geselle, satz_meister, satz_azubi, satz_notdienst
```

### Import Flow
```
Fragebogen completed
  → fragebogen-import-service.js processes responses
  → Maps to: profile fields, system settings, feature toggles
  → Generates: recommended tier (Starter/Professional/Enterprise)
  → Creates: draft Angebot with matched positions
  → Triggers: onboarding tutorial for selected features
```

## 6. Tier Recommendation Logic

Based on Fragebogen responses, the import service assigns one of three tiers:

### Starter (€3.500 Setup + €200/Monat)
**Criteria (any of the following):**
- Mitarbeiter (employees): 1–3
- Jahresumsatz: unter €300.000
- Wünsche & Prioritäten: only basic modules selected (Kunden, Angebote, Rechnungen)
- No DATEV integration needed
- No inventory/BOM management needed
- Budget (Section 11): unter €250/Monat

**Features enabled:** Kunden, Angebote, Aufträge, Rechnungen, Einstellungen

### Professional (€5.500 Setup + €400/Monat)
**Criteria (any of the following):**
- Mitarbeiter: 4–7
- Jahresumsatz: €300.000–€1.000.000
- Wünsche & Prioritäten: includes automation modules (WhatsApp, Kalender, Mahnwesen)
- DATEV integration needed (Section 9, `datev_nutzung = true`)
- Budget: €250–€600/Monat

**Features enabled:** All Starter + WhatsApp-Integration, Kalender, Mahnwesen, DATEV-Export, Kommunikations-Hub

### Enterprise (€7.500 Setup + €700/Monat)
**Criteria (any of the following):**
- Mitarbeiter: 8+
- Jahresumsatz: über €1.000.000
- Wünsche & Prioritäten: all modules or custom integrations needed
- Multiple locations or teams
- Budget: über €600/Monat

**Features enabled:** All Professional + Lagerverwaltung, Bestellwesen, Nachbestellungen, individuelle Automatisierungen

### Feature Toggle Mapping from Fragebogen
```javascript
// Section 9 (Buchhaltung) → DATEV toggle
if (responses.datev_nutzung === true) {
  featureToggles.datevExport = true;   // → enables DATEV-Export module
}

// Section 8 (Lagerverwaltung) → Inventory toggle
if (responses.lager_vorhanden === true) {
  featureToggles.lagerverwaltung = true;
}

// Section 7 (Terminplanung) → Calendar toggle
if (responses.kalender_genutzt === true || responses.kundentermine > 5) {
  featureToggles.kalender = true;
}

// Section 6 (Kommunikation) → WhatsApp toggle
if (responses.whatsapp_nutzung === true) {
  featureToggles.whatsappIntegration = true;
}
```

### Angebot Positions from Fragebogen
The import service generates draft Angebot line items based on enabled features:
- Each enabled feature module → 1 position with setup cost + monthly rate
- DATEV-Export → "DATEV-Anbindung und Export" position
- WhatsApp-Integration → "WhatsApp Kundenservice-Automatisierung" position
- Lagerverwaltung → "Lagerverwaltung und Bestellwesen" position

## 7. Excel/CSV Import

### 4-Step Import Wizard
1. **Upload**: Drag-drop or browse for .xlsx/.csv file
2. **Map Columns**: Match source columns to FreyAI fields
3. **Preview**: Show first 10 rows with validation warnings
4. **Import**: Batch insert into `kunden` table

### Supported Fields
`firmenname`, `ansprechpartner`, `email`, `telefon`, `adresse`, `plz`, `ort`, `branche`, `notizen`

### Import Rules
1. Validate email format before import
2. Deduplicate on email address
3. Show error rows separately (don't block valid imports)
4. Maximum 500 rows per import
5. UTF-8 encoding required (handle German umlauts: ä, ö, ü, ß)

## 8. Onboarding Tutorial

### 10 Interactive Steps
1. Dashboard overview
2. Kunden (Customers) tab
3. Adding a new customer
4. Anfragen (Inquiries) tab
5. Creating an Angebot (Quote)
6. Rechnungen (Invoices) tab
7. Kalender (Calendar)
8. E-Mail integration
9. Einstellungen (Settings)
10. Support & Help

### Tutorial Rules
- Highlights UI elements with overlay
- "Überspringen" (Skip) always available
- Progress saved — can resume later
- Only shows on first login (or manual trigger from Settings)

## 9. Quality Checklist

Before modifying onboarding, verify all 10 items:

1. [ ] Setup wizard validates all required fields per step
2. [ ] Fragebogen auto-saves per section (no data loss on navigation)
3. [ ] Auth page has double-submit protection
4. [ ] Error messages are in German
5. [ ] Data maps correctly from fragebogen to profiles table
6. [ ] Excel import handles German umlauts (ä, ö, ü, ß)
7. [ ] Tutorial highlights correct DOM elements
8. [ ] Tier recommendation logic matches pricing guide (Starter/Professional/Enterprise)
9. [ ] DSGVO consent checkbox is mandatory
10. [ ] Onboarding state persists across sessions (IndexedDB + Supabase)

## References

- `references/onboarding-flow.md` — Complete journey map, field definitions, data flow
