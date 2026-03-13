---
name: i18n
description: |
  Manage internationalization and translations for the FreyAI Visions app.
  Use this skill when the user asks about translations, missing keys, adding new
  translatable text, language switching, plural forms, or i18n consistency.
  Also trigger when the user says "translate", "Übersetzung", "add translation key",
  "missing translation", "i18n", "language", "Sprache", "localization",
  or any request involving multi-language support in the app.
---

# i18n Skill — FreyAI Translation Management

Manage DE/EN/TR translations, ensure key consistency, handle plural forms and parameter interpolation for the FreyAI Visions app.

Read `references/i18n-architecture.md` for the full translation system before making changes.

## 1. Translation Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| `js/i18n/de.js` | German translations | Primary language (~402 keys) |
| `js/i18n/en.js` | English translations | Secondary language (~402 keys) |
| `js/services/i18n-service.js` | Translation service | `window.t()`, language switching, DOM updates + inline TR (~15 keys) |
| `landing.html` | Landing page | 31 inline language blocks (data-lang attributes) |

**Three app languages**: DE (primary, full), EN (full), TR (minimal, ~15 keys hardcoded in i18n-service.js).

### Key API
```javascript
// Global translation function
window.t('dashboard.welcome');           // Simple key
window.t('invoices.count', { count: 5 }); // With parameter
window.t('items.plural', { n: 3 });      // Plural form

// Language switching
i18nService.setLanguage('de');
i18nService.setLanguage('en');

// DOM auto-translation
// <span data-i18n="nav.dashboard">Dashboard</span>
i18nService.applyTranslations();
```

## 2. Adding New Translation Keys

### Step-by-Step
1. Add key to `js/i18n/de.js` (German FIRST — primary language)
2. Add same key to `js/i18n/en.js` (English translation)
3. Use in HTML: `<span data-i18n="section.key">Fallback Text</span>`
4. Use in JS: `window.t('section.key')`

### Naming Convention
```
section.subsection.action
```
Examples:
- `nav.dashboard` — Navigation item
- `invoices.status.paid` — Invoice status label
- `settings.billing.upgrade` — Settings action
- `errors.auth.invalid_password` — Error message

### Rules
1. **Always add to BOTH de.js and en.js** — never add to only one language
2. **German is authoritative** — if in doubt, write the German text first
3. **Turkish is minimal** — only ~15 keys inline in i18n-service.js, not a full translation
4. **Use dot notation** — nested objects map to dot-separated keys
5. **Keep keys stable** — renaming a key requires updating all HTML data-i18n attributes
6. **No HTML in values** — translations are plain text only

## 3. Parameter Interpolation

Use `{{param}}` syntax in translation values:

```javascript
// de.js
'welcome.greeting': 'Willkommen, {{name}}!',
'invoices.total': 'Gesamt: {{amount}} EUR',

// Usage
window.t('welcome.greeting', { name: 'Jonas' });
// → "Willkommen, Jonas!"
```

### Rules
- Parameter names must match between DE and EN files
- Always provide fallback if parameter might be undefined
- Use German number formatting in German translations (`1.234,56 €`)

## 4. Plural Forms

```javascript
// de.js
'items.count': {
  one: '{{n}} Artikel',
  other: '{{n}} Artikel'
},

// en.js
'items.count': {
  one: '{{n}} item',
  other: '{{n}} items'
},

// Usage
window.t('items.count', { n: 1 });  // "1 Artikel" / "1 item"
window.t('items.count', { n: 5 });  // "5 Artikel" / "5 items"
```

### German Plural Rules
- Most German nouns: same form for singular/plural in these contexts
- Exception: explicit singular/plural when grammar requires it
- Always define both `one` and `other` keys

## 5. Landing Page Languages

The landing page (`landing.html`) uses inline language blocks, NOT the i18n service:

```html
<span data-lang="de">Willkommen</span>
<span data-lang="en">Welcome</span>
<span data-lang="fr">Bienvenue</span>
<!-- ... 31 languages total -->
```

### Supported Landing Languages
DE, EN, FR, ES, IT, PT, NL, PL, CS, RO, HU, BG, HR, SK, SL, ET, LV, LT, FI, SV, DA, EL, TR, AR, ZH, JA, KO, HI, RU, UK, TH

### Rules
- Landing translations are separate from app i18n
- Add new landing languages as `data-lang` spans
- App translations (de.js/en.js) are only DE and EN

## 6. Consistency Checks

### Finding Missing Keys
```javascript
// Compare key sets between DE and EN
const deKeys = Object.keys(flattenObject(de));
const enKeys = Object.keys(flattenObject(en));
const missingInEN = deKeys.filter(k => !enKeys.includes(k));
const missingInDE = enKeys.filter(k => !deKeys.includes(k));
```

### Common Issues
1. **Key in DE but not EN** — English users see raw key string
2. **Key in EN but not DE** — German users see raw key string
3. **Parameter mismatch** — `{{name}}` in DE but `{{user}}` in EN
4. **Plural form mismatch** — `one`/`other` in DE but flat string in EN
5. **Unused keys** — Key exists in translation files but no `data-i18n` or `window.t()` reference

## 7. Quality Checklist

Before adding or modifying translations, verify all 8 items:

1. [ ] Key exists in BOTH de.js and en.js
2. [ ] Key follows dot notation naming convention
3. [ ] Parameter names match between DE and EN (`{{param}}`)
4. [ ] Plural forms define both `one` and `other` in both languages
5. [ ] HTML elements use `data-i18n` attribute (not hardcoded text)
6. [ ] German text uses correct formatting (€, Komma decimals, formal "Sie")
7. [ ] No HTML tags inside translation values
8. [ ] Landing page additions include all 31 language variants
9. [ ] Turkish (TR) keys updated if applicable (minimal set in i18n-service.js)

## References

- `references/i18n-architecture.md` — Service internals, key structure, DOM binding
