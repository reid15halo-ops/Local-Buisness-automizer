# Customer Onboarding Flow — FreyAI Visions

## Complete Journey Map

```
Prospect visits freyaivisions.de
  ↓ Clicks "Jetzt starten" or "Demo buchen"
  ↓
AUTH (auth.html)
  ├─→ Email/Password signup
  ├─→ Google OAuth
  └─→ Magic Link
  ↓ Profile auto-created
  ↓
SETUP WIZARD (3 steps)
  Step 1: Unternehmen → Company basics (5 fields)
  Step 2: Kontakt → Contact info (5 fields)
  Step 3: Präferenzen → Communication prefs (3 fields)
  ↓ Profile enriched
  ↓
ONBOARDING TUTORIAL (10 steps)
  Interactive overlay walkthrough of key features
  ↓ Can skip/resume
  ↓
FRAGEBOGEN (52 questions, 11 sections)
  Deep business analysis for scope determination
  ↓ Auto-saves per section
  ↓
DATA IMPORT (optional)
  Excel/CSV upload of existing customer data
  ↓ Column mapping → validation → batch insert
  ↓
TIER RECOMMENDATION
  System suggests Starter/Professional/Enterprise
  based on fragebogen answers
  ↓
ANGEBOT CREATION
  Draft quote with matched positions
  ↓ Human review → send to customer
  ↓
GO-LIVE
  Training → Feintuning → Production use
```

## Setup Wizard Details

### js/modules/setup-wizard.js

#### Step 1: Unternehmen
```javascript
const step1Fields = {
  firmenname: { type: 'text', required: true, label: 'Firmenname' },
  branche: {
    type: 'select', required: true, label: 'Branche',
    options: [
      'Metallbau', 'Sanitär', 'Heizung', 'Elektro', 'Malerei',
      'Schreinerei', 'Dachdeckerei', 'Landschaftsbau', 'KFZ',
      'Gebäudereinigung', 'Sonstige'
    ]
  },
  mitarbeiteranzahl: { type: 'number', required: true, label: 'Mitarbeiteranzahl', min: 1, max: 100 },
  gruendungsjahr: { type: 'number', required: false, label: 'Gründungsjahr', min: 1900, max: 2026 },
  website: { type: 'url', required: false, label: 'Website' }
};
```

#### Step 2: Kontakt
```javascript
const step2Fields = {
  ansprechpartner: { type: 'text', required: true, label: 'Ansprechpartner' },
  email: { type: 'email', required: true, label: 'E-Mail', prefilled: true },
  telefon: { type: 'tel', required: true, label: 'Telefon', pattern: '+49...' },
  adresse: { type: 'text', required: true, label: 'Adresse' },
  plz_ort: { type: 'text', required: true, label: 'PLZ / Ort' }
};
```

#### Step 3: Präferenzen
```javascript
const step3Fields = {
  kommunikation: {
    type: 'multi-select', required: true, label: 'Bevorzugte Kommunikation',
    options: ['E-Mail', 'Telefon', 'WhatsApp', 'Telegram', 'Vor Ort']
  },
  sprache: {
    type: 'select', required: true, label: 'Sprache',
    options: [{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]
  },
  datenschutz_akzeptiert: { type: 'checkbox', required: true, label: 'Datenschutz akzeptiert (DSGVO)' }
};
```

### Wizard Behavior
- Progress bar shows step 1/2/3
- Validation on "Weiter" click (required fields, format checks)
- "Zurück" navigates back with preserved data
- Final "Abschließen" saves all data to profiles table
- Flag `setup_completed: true` prevents re-showing
- Mobile-responsive (single-column layout on small screens)

## Fragebogen Details

### js/modules/fragebogen.js

#### Section Structure
```javascript
const sections = [
  {
    id: 'geschaeft',
    title: 'Geschäftsübersicht',
    questions: [
      { id: 'umsatz_jaehrlich', type: 'select', label: 'Jahresumsatz (ca.)',
        options: ['< 100.000 €', '100.000–500.000 €', '500.000–1 Mio €', '> 1 Mio €'] },
      { id: 'wachstumsziel', type: 'text', label: 'Wachstumsziel für die nächsten 12 Monate' },
      { id: 'groesste_herausforderung', type: 'text', label: 'Größte geschäftliche Herausforderung' },
      { id: 'digitalisierungsgrad', type: 'scale', label: 'Aktueller Digitalisierungsgrad (1-5)' },
      { id: 'zeitaufwand_admin', type: 'select', label: 'Wöchentlicher Zeitaufwand für Admin',
        options: ['< 5 Std.', '5-10 Std.', '10-20 Std.', '> 20 Std.'] }
    ]
  },
  // ... 10 more sections
];
```

#### Section Completion Logic
```javascript
// Each section auto-saves on blur/change
async saveSection(sectionId) {
  const responses = this.collectSectionResponses(sectionId);
  await store.updateFragebogenSection(sectionId, responses);
  this.updateProgress(sectionId);
}

// Progress: completed_sections / total_sections
getProgress() {
  return this.sections.filter(s => s.isComplete).length / this.sections.length;
}
```

## Fragebogen Import Service

### js/services/fragebogen-import-service.js

Maps fragebogen responses to actionable system configuration:

```javascript
const fieldMappings = {
  // Profile enrichment
  'geschaeft.branche': { target: 'profiles.branche', transform: 'direct' },
  'geschaeft.umsatz_jaehrlich': { target: 'profiles.umsatz_klasse', transform: 'direct' },
  'kontakt.mitarbeiter': { target: 'profiles.mitarbeiteranzahl', transform: 'parseInt' },

  // Feature toggles
  'buchhaltung.datev': { target: 'settings.datev_enabled', transform: 'boolean' },
  'kommunikation.email_provider': { target: 'settings.email_integration', transform: 'direct' },
  'marketing.social_media': { target: 'settings.social_channels', transform: 'array' },

  // Tier recommendation
  'wuensche.budget': { target: 'recommendation.budget_range', transform: 'direct' },
  'geschaeft.digitalisierungsgrad': { target: 'recommendation.complexity', transform: 'invert' },
  'kontakt.mitarbeiter': { target: 'recommendation.size_factor', transform: 'tier_lookup' },

  // Angebot position matching
  'angebote.pro_monat': { target: 'angebot.quote_volume', transform: 'parseInt' },
  'rechnungen.zahlungsziel': { target: 'angebot.payment_terms', transform: 'direct' },
  'lager.vorhanden': { target: 'angebot.needs_inventory', transform: 'boolean' },
  'buchhaltung.steuerberater': { target: 'angebot.needs_datev', transform: 'boolean' },

  // Workflow configuration
  'kommunikation.bevorzugt': { target: 'workflow.primary_channel', transform: 'first' },
  'termine.kalender': { target: 'workflow.calendar_sync', transform: 'boolean' },
  'wuensche.prioritaet_1': { target: 'workflow.implementation_order', transform: 'direct' }
};
```

### Tier Recommendation Logic
```javascript
function recommendTier(responses) {
  const employees = responses['kontakt.mitarbeiter'];
  const budget = responses['wuensche.budget'];
  const features = countSelectedFeatures(responses);

  if (employees <= 3 && features <= 4) return 'starter';
  if (employees <= 7 && features <= 8) return 'professional';
  return 'enterprise';
}
```

## Excel/CSV Import

### 4-Step Wizard
```
Step 1: Upload
  → Drag-drop zone + file browser
  → Accepts: .xlsx, .csv
  → Max file size: 5 MB
  → UTF-8 encoding validation

Step 2: Column Mapping
  → Auto-detect common column names (Name, Email, Telefon)
  → Manual mapping dropdown for unmatched columns
  → Preview first 3 rows per column

Step 3: Validation Preview
  → Show all rows with validation status
  → Green: valid, ready to import
  → Yellow: warning (e.g., missing optional field)
  → Red: error (e.g., invalid email format)
  → Error summary at top

Step 4: Import
  → Progress bar during batch insert
  → Success count + error count
  → Download error report (CSV)
  → Option to retry failed rows
```

### Supported Target Fields
```javascript
const importableFields = [
  'firmenname',      // Company name
  'ansprechpartner', // Contact person
  'email',           // Email (validated, dedup key)
  'telefon',         // Phone
  'adresse',         // Street address
  'plz',             // Postal code
  'ort',             // City
  'branche',         // Industry
  'notizen',         // Notes
  'kundennummer'     // Customer number (optional)
];
```

## Onboarding Tutorial

### js/services/onboarding-tutorial.js

10-step interactive overlay:
```javascript
const tutorialSteps = [
  { target: '#dashboard-section', title: 'Dashboard', text: 'Ihr Überblick über alle Geschäftsdaten' },
  { target: '#customers-tab', title: 'Kunden', text: 'Verwalten Sie Ihre Kundendaten' },
  { target: '#add-customer-btn', title: 'Neuer Kunde', text: 'Fügen Sie einen neuen Kunden hinzu' },
  { target: '#inquiries-tab', title: 'Anfragen', text: 'Eingehende Kundenanfragen' },
  { target: '#quotes-tab', title: 'Angebote', text: 'Erstellen und versenden Sie Angebote' },
  { target: '#invoices-tab', title: 'Rechnungen', text: 'Rechnungsstellung und Zahlungsübersicht' },
  { target: '#calendar-tab', title: 'Kalender', text: 'Termine und Aufgabenplanung' },
  { target: '#email-section', title: 'E-Mail', text: 'E-Mail-Integration und Vorlagen' },
  { target: '#settings-tab', title: 'Einstellungen', text: 'System- und Firmeneinstellungen' },
  { target: '#help-btn', title: 'Hilfe', text: 'Support und Dokumentation' }
];
```

### Tutorial Behavior
- Shows tooltip overlay with highlight on target element
- "Weiter" / "Zurück" / "Überspringen" buttons
- Progress dots at bottom
- Saves progress to `profiles.tutorial_step`
- Can be restarted from Settings → "Tutorial erneut starten"
