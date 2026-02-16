---
name: add-i18n
description: Add or update internationalization strings — extract hardcoded German text, add translation keys, or add a new locale.
argument-hint: [action] [locale]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Internationalization

**Arguments:** `$ARGUMENTS` — parse as `[action] [locale]`
Actions: `extract`, `add-locale`, `translate`

### Steps

1. **Read** `js/services/i18n-service.js` for the existing i18n pattern.

### Actions

#### extract — Find hardcoded German strings
- Scan `index.html` and `js/app.js` for hardcoded German text
- Output a list of strings that should be translation keys
- Suggest key names following the pattern: `<section>.<element>.<property>`
  - e.g., `nav.dashboard`, `form.anfrage.submit`, `status.neu`

#### add-locale — Add a new language
- Read the existing locale structure in `i18n-service.js`
- Create a new locale object with all existing keys
- Copy German values as placeholders with `// TODO: translate` markers

#### translate — Translate keys to a target locale
- Read the German (de) strings
- Generate translations for the target locale
- Common business terms to handle:
  - Anfrage → Inquiry/Request
  - Angebot → Quote/Offer
  - Auftrag → Order/Job
  - Rechnung → Invoice
  - Kunde → Customer/Client
  - Mahnwesen → Dunning
  - Buchhaltung → Accounting
  - MwSt → VAT

### Key Format
```javascript
const translations = {
    de: {
        'nav.dashboard': 'Dashboard',
        'nav.anfragen': 'Anfragen',
        'status.neu': 'Neu',
        'status.offen': 'Offen',
        'btn.save': 'Speichern',
        'btn.cancel': 'Abbrechen',
    },
    en: { ... }
};
```
