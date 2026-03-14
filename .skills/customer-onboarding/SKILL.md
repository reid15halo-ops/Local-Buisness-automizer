---
name: customer-onboarding
description: |
  Design and manage the customer onboarding flow for FreyAI Visions.
  Use this skill when the user asks about the setup wizard, Fragebogen (questionnaire),
  data import, customer training, onboarding steps, or the journey from signup to go-live.
  Also trigger when the user says "onboarding", "setup wizard", "Fragebogen",
  "Kundeneinrichtung", "questionnaire", "data import", "Excel import",
  "customer setup", "training", "go-live", or any request involving new customer activation.
  Covers: auth flow, 3-step wizard, 52-question Fragebogen, tier recommendation,
  Excel/CSV import, tutorial walkthrough, portal token generation, and feature toggle mapping.
---

# Customer Onboarding Skill -- FreyAI Setup Flow

Design and manage the 3-layer customer onboarding: Auth -> Setup Wizard -> Fragebogen, mapping to the 3.5k-7.5k EUR setup engagement.

Read `references/onboarding-flow.md` for the complete journey before making changes.

## 1. Onboarding Architecture

Three sequential layers, each building on the previous:

```
Layer 1: Authentication (auth.html)
  | User signs up / logs in
Layer 2: Setup Wizard (3 steps, 13 fields)
  | Basic company info captured
Layer 3: Fragebogen (52 questions, 11 sections)
  | Deep business analysis
-> Ready for: Angebot creation, data import, system configuration
```

### Key Files
| Component | Location | Purpose |
|-----------|----------|---------|
| Auth page | `auth.html` | Login/signup with Supabase Auth |
| Setup Wizard | `js/modules/setup-wizard.js` | 3-step company setup |
| Fragebogen | `js/modules/fragebogen.js` | 52-question business questionnaire |
| Import Service | `js/services/fragebogen-import-service.js` | Maps questionnaire -> system config |
| Tutorial | `js/services/onboarding-tutorial.js` | 10-step interactive walkthrough |

## 2. Layer 1: Authentication

### Flow
```
Landing page -> "Jetzt starten" -> auth.html
  |- Email/Password signup
  |- Google OAuth
  |- Magic Link
-> Profile created in profiles table (via DB trigger)
-> Redirect to dashboard (index.html)
-> Setup wizard auto-triggers if profile incomplete
```

### Auth Rules
- Supabase Auth handles all credential management
- Profile row auto-created via database trigger on `auth.users`
- Double-submit protection on signup form (disable button after first click)
- German error messages for auth failures (map Supabase error codes to German text)
- DSGVO consent checkbox mandatory before account creation
- Redirect loop prevention: check `setup_complete` flag before showing wizard

### Auth Error Handling
| Supabase Error | German Message |
|----------------|----------------|
| `user_already_exists` | "Diese E-Mail-Adresse ist bereits registriert." |
| `invalid_credentials` | "E-Mail oder Passwort falsch." |
| `email_not_confirmed` | "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse." |
| `rate_limit_exceeded` | "Zu viele Versuche. Bitte warten Sie einen Moment." |

## 3. Layer 2: Setup Wizard

### 3 Steps (Welcome -> Integrations -> Complete)

**Step 1: Welcome (User Profile) -- 13 Fields**
| Field (localStorage key) | Type | Required | Validation |
|--------------------------|------|----------|------------|
| `company_name` | Text | Yes | min 2 chars |
| `owner_name` | Text | Yes | min 2 chars |
| `address_street` | Text | Yes | min 3 chars |
| `address_postal` | Text | Yes | exactly 5 digits (German PLZ) |
| `address_city` | Text | Yes | min 2 chars |
| `tax_number` | Text | Yes | format: XX/XXX/XXXXX or DE+9 digits |
| `email` | Email | Yes (pre-filled) | valid email format |
| `phone` | Tel | No | starts with +49 or 0 |
| `iban` | Text | No | DE + 20 digits |
| `bic` | Text | No | 8 or 11 alphanumeric |
| `kleinunternehmer` | Checkbox | No | boolean |
| `business_type` | Text | No | free text |
| `company_logo` | File | No | max 2MB, jpg/png/svg |

**Step 2: Integrations (Optional)**
- Paperless-ngx (URL + API token)
- Cal.com (URL + API key)
- Postiz (URL + API key)
- WhatsApp (API URL + key + instance)

**Step 3: Complete** -- Success screen with CTA to start tutorial

### Wizard Rules
1. Each step validates before allowing "Weiter" (Next)
2. Data saves to `profiles` table on completion (upsert by user_id)
3. Wizard only shows once (flagged via `setup_complete = true` in profile)
4. "Zurueck" (Back) preserves entered data (held in component state)
5. Skip option available but discouraged (show warning modal)
6. Data persists in Supabase + IndexedDB to survive session loss
7. On validation failure: highlight field with red border + German error text below field

## 4. Layer 3: Fragebogen (Questionnaire)

### 11 Sections, 52 Questions

| # | Section | Questions | Purpose |
|---|---------|-----------|---------|
| 1 | Geschaeftsuebersicht | 5 | Company basics, revenue, goals |
| 2 | Aktuelle IT-Infrastruktur | 5 | Existing software, pain points |
| 3 | Kundenverwaltung | 5 | How customers are tracked today |
| 4 | Angebots- & Auftragswesen | 5 | Quote/order workflow |
| 5 | Rechnungsstellung | 5 | Invoicing process, payment terms |
| 6 | Kommunikation | 4 | Email, phone, messaging habits |
| 7 | Terminplanung | 4 | Scheduling, calendar usage |
| 8 | Lagerverwaltung | 4 | Inventory, ordering, suppliers |
| 9 | Buchhaltung | 5 | Bookkeeping, DATEV, tax advisor |
| 10 | Marketing | 5 | Online presence, social media |
| 11 | Wuensche & Prioritaeten | 5 | Feature priorities, budget, timeline |

### Question Types
- **Text**: Free-form input (max 500 chars)
- **Select**: Dropdown with predefined options
- **Multi-select**: Checkbox group (store as JSON array)
- **Number**: Numeric input with min/max validation
- **Scale**: 1-5 rating (priority/satisfaction, rendered as star/dot selector)

### Fragebogen Rules
1. Can be filled incrementally (auto-saves per section to IndexedDB + Supabase)
2. Section progress tracked visually (progress bar per section + overall)
3. Completion triggers notification to admin (Jonas) via Telegram
4. Data stored in `fragebogen_responses` table or profile JSONB field
5. Can be sent to customer as link with portal token (valid 30 days)
6. Sections can be filled in any order (non-linear navigation)
7. "Pflichtfelder" (required fields) marked with asterisk, validated on section submit

### Portal Token Generation
```javascript
// Generate unique portal token for customer self-service
const token = crypto.randomUUID();
// Store in profiles table: portal_token, portal_token_expires (NOW() + 30 days)
// URL: https://app.freyaivisions.de/portal?token={token}
// Token grants read/write access ONLY to own fragebogen + angebot approval
```

## 5. Data Import (Fragebogen -> System)

### Field Mapping (12 core mappings + extras)
```javascript
// fragebogen-import-service.js fieldMapping array
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
```

### Import Flow
```
Fragebogen completed
  -> fragebogen-import-service.js processes responses
  -> Maps to: profile fields, system settings, feature toggles
  -> Generates: recommended tier (Starter/Professional/Enterprise)
  -> Creates: draft Angebot with matched positions
  -> Triggers: onboarding tutorial for selected features
  -> Sends: Telegram notification to Jonas with tier + summary
```

### Import Error Handling
- Missing required fields: skip import, show error summary, allow retry
- Duplicate customer (same email): merge data, prefer newer values, log conflict
- Invalid field values (e.g., non-numeric PLZ): highlight field, show correction prompt
- Network failure during save: queue in IndexedDB, retry on reconnect

## 6. Tier Recommendation Logic

Based on Fragebogen responses, the import service assigns one of three tiers:

### Starter (3.500 EUR Setup + 200 EUR/Monat)
**Criteria (any of the following):**
- Mitarbeiter (employees): 1-3
- Jahresumsatz: unter 300.000 EUR
- Only basic modules selected (Kunden, Angebote, Rechnungen)
- No DATEV integration needed
- No inventory/BOM management needed
- Budget (Section 11): unter 250 EUR/Monat

**Features enabled:** Kunden, Angebote, Auftraege, Rechnungen, Einstellungen

### Professional (5.500 EUR Setup + 400 EUR/Monat)
**Criteria (any of the following):**
- Mitarbeiter: 4-7
- Jahresumsatz: 300.000-1.000.000 EUR
- Includes automation modules (WhatsApp, Kalender, Mahnwesen)
- DATEV integration needed (Section 9, `datev_nutzung = true`)
- Budget: 250-600 EUR/Monat

**Features enabled:** All Starter + WhatsApp-Integration, Kalender, Mahnwesen, DATEV-Export, Kommunikations-Hub

### Enterprise (7.500 EUR Setup + 700 EUR/Monat)
**Criteria (any of the following):**
- Mitarbeiter: 8+
- Jahresumsatz: ueber 1.000.000 EUR
- All modules or custom integrations needed
- Multiple locations or teams
- Budget: ueber 600 EUR/Monat

**Features enabled:** All Professional + Lagerverwaltung, Bestellwesen, Nachbestellungen, individuelle Automatisierungen

### Tier Conflict Resolution
When criteria point to multiple tiers (e.g., 2 employees but wants DATEV):
1. Budget is the strongest signal -- never recommend above stated budget
2. Feature needs override employee count (small team can need Professional features)
3. When ambiguous, recommend Professional and note upgrade/downgrade options

### Feature Toggle Mapping from Fragebogen
```javascript
// Section 9 (Buchhaltung) -> DATEV toggle
if (responses.datev_nutzung === true) featureToggles.datevExport = true;

// Section 8 (Lagerverwaltung) -> Inventory toggle
if (responses.lager_vorhanden === true) featureToggles.lagerverwaltung = true;

// Section 7 (Terminplanung) -> Calendar toggle
if (responses.kalender_genutzt === true || responses.kundentermine > 5) featureToggles.kalender = true;

// Section 6 (Kommunikation) -> WhatsApp toggle
if (responses.whatsapp_nutzung === true) featureToggles.whatsappIntegration = true;
```

## 7. Excel/CSV Import

### 4-Step Import Wizard
1. **Upload**: Drag-drop or browse for .xlsx/.csv file (max 5MB)
2. **Map Columns**: Match source columns to FreyAI fields (auto-detect common German headers)
3. **Preview**: Show first 10 rows with validation warnings (red = error, yellow = warning)
4. **Import**: Batch insert into `kunden` table (upsert on email)

### Auto-Detection Headers
| Source Header (case-insensitive) | Maps to |
|----------------------------------|---------|
| firma, firmenname, unternehmen | firmenname |
| name, ansprechpartner, kontakt | ansprechpartner |
| mail, e-mail, email | email |
| tel, telefon, phone, mobil | telefon |
| strasse, str | adresse |
| postleitzahl, plz | plz |
| stadt, ort, city | ort |

### Import Rules
1. Validate email format before import (show invalid rows separately)
2. Deduplicate on email address (upsert: update if exists, insert if new)
3. Show error rows separately (don't block valid imports)
4. Maximum 500 rows per import (show warning if file has more)
5. UTF-8 encoding required (handle German umlauts: ae, oe, ue, ss)
6. Empty rows silently skipped
7. Import summary shown after completion: X inserted, Y updated, Z failed

## 8. Onboarding Tutorial

### 10 Interactive Steps
1. Dashboard overview (highlight KPI cards)
2. Kunden (Customers) tab
3. Adding a new customer (open modal)
4. Anfragen (Inquiries) tab
5. Creating an Angebot (Quote)
6. Rechnungen (Invoices) tab
7. Kalender (Calendar) -- only if feature enabled
8. E-Mail integration
9. Einstellungen (Settings)
10. Support & Help (ticket system)

### Tutorial Rules
- Highlights UI elements with semi-transparent overlay + spotlight on target
- "Ueberspringen" (Skip) always available (top-right X button)
- Progress saved in localStorage (`tutorial_step`) -- can resume later
- Only shows on first login (or manual trigger from Settings > "Einfuehrung wiederholen")
- Steps for disabled features are automatically skipped
- Each step has: title, description (2-3 sentences), target element selector

## 9. Quality Checklist

Before modifying onboarding, verify all items:

1. [ ] Setup wizard validates all required fields per step (see validation column above)
2. [ ] Fragebogen auto-saves per section (no data loss on navigation or browser crash)
3. [ ] Auth page has double-submit protection
4. [ ] All user-facing error messages are in German
5. [ ] Data maps correctly from fragebogen to profiles table (test all 12 core fields)
6. [ ] Excel import handles German umlauts and auto-detects common headers
7. [ ] Tutorial highlights correct DOM elements (test after any layout changes)
8. [ ] Tier recommendation logic matches pricing (Starter/Professional/Enterprise)
9. [ ] DSGVO consent checkbox is mandatory and blocks signup if unchecked
10. [ ] Onboarding state persists across sessions (IndexedDB + Supabase dual-write)
11. [ ] Portal token expires after 30 days and grants minimal access
12. [ ] Tier conflict resolution follows budget > features > headcount priority
13. [ ] Import error handling shows actionable German error messages

## References

- `references/onboarding-flow.md` -- Complete journey map, field definitions, data flow
