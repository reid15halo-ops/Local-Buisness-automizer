# i18n Architecture — FreyAI Visions

## System Overview

```
js/i18n/de.js ─┐
               ├─→ js/services/i18n-service.js → window.t()
js/i18n/en.js ─┘                                → applyTranslations()
                                                 → DOM [data-i18n] binding

landing.html → Inline [data-lang] blocks (31 languages, separate system)
```

## Translation Files

### js/i18n/de.js (German — Primary)
```javascript
export const de = {
  nav: {
    dashboard: 'Dashboard',
    customers: 'Kunden',
    inquiries: 'Anfragen',
    quotes: 'Angebote',
    orders: 'Aufträge',
    invoices: 'Rechnungen',
    calendar: 'Kalender',
    settings: 'Einstellungen'
  },
  dashboard: {
    welcome: 'Willkommen zurück',
    revenue: 'Umsatz',
    open_invoices: 'Offene Rechnungen',
    // ... ~456 total keys
  },
  // Nested sections: auth, customers, quotes, invoices, settings, errors, ...
};
```

### js/i18n/en.js (English — Secondary)
```javascript
export const en = {
  nav: {
    dashboard: 'Dashboard',
    customers: 'Customers',
    // ... mirrors de.js structure exactly
  }
};
```

## i18n-service.js — Key Internals

### Initialization
```javascript
class I18nService {
  constructor() {
    this.currentLanguage = localStorage.getItem('language') || 'de';
    this.translations = { de, en };
  }
}
```

### window.t() — Translation Function
```javascript
// Exposed globally for convenience
window.t = (key, params) => i18nService.translate(key, params);

// Implementation
translate(key, params = {}) {
  const keys = key.split('.');
  let value = this.translations[this.currentLanguage];
  for (const k of keys) {
    value = value?.[k];
  }
  if (!value) return key; // Fallback: return raw key

  // Parameter interpolation
  if (typeof value === 'string' && params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, name) => params[name] ?? '');
  }

  // Plural forms
  if (typeof value === 'object' && 'one' in value) {
    const n = params.n ?? params.count ?? 0;
    const form = n === 1 ? 'one' : 'other';
    return (value[form] || value.other || key)
      .replace(/\{\{(\w+)\}\}/g, (_, name) => params[name] ?? '');
  }

  return value;
}
```

### applyTranslations() — DOM Binding
```javascript
applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const translated = this.translate(key);
    if (translated !== key) {
      el.textContent = translated;
    }
  });

  // Also handle placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = this.translate(el.dataset.i18nPlaceholder);
  });

  // And titles/tooltips
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = this.translate(el.dataset.i18nTitle);
  });
}
```

### Language Switching
```javascript
setLanguage(lang) {
  this.currentLanguage = lang;
  localStorage.setItem('language', lang);
  this.applyTranslations();
  document.documentElement.lang = lang;
}
```

## Key Structure (Sections)

| Section | Key Prefix | Approx Keys | Purpose |
|---------|-----------|-------------|---------|
| Navigation | `nav.*` | 12 | Sidebar/header navigation |
| Dashboard | `dashboard.*` | 25 | Dashboard widgets and stats |
| Auth | `auth.*` | 20 | Login, signup, password reset |
| Customers | `customers.*` | 30 | Customer management |
| Quotes | `quotes.*` | 35 | Angebot/quote workflow |
| Orders | `orders.*` | 20 | Auftrag/order management |
| Invoices | `invoices.*` | 40 | Invoice management |
| Calendar | `calendar.*` | 15 | Calendar/scheduling |
| Settings | `settings.*` | 45 | All settings sections |
| Errors | `errors.*` | 30 | Error messages |
| Common | `common.*` | 40 | Shared labels (save, cancel, delete, ...) |
| Notifications | `notifications.*` | 20 | Toast/alert messages |
| Onboarding | `onboarding.*` | 25 | Setup wizard and tutorial |
| Reports | `reports.*` | 15 | Export and reporting |

## Parameter Interpolation Instances

Currently used in ~9 translation keys:
```javascript
'welcome.greeting': 'Willkommen, {{name}}!',
'invoices.count': '{{count}} Rechnungen',
'invoices.overdue': '{{count}} überfällig',
'customers.total': '{{count}} Kunden',
'quotes.valid_until': 'Gültig bis {{date}}',
'errors.min_length': 'Mindestens {{min}} Zeichen',
'errors.max_length': 'Maximal {{max}} Zeichen',
'settings.last_sync': 'Zuletzt synchronisiert: {{time}}',
'export.rows': '{{count}} Einträge exportiert'
```

## Plural Form Entries

~12 translation keys use plural forms:
```javascript
'items.count': { one: '{{n}} Eintrag', other: '{{n}} Einträge' },
'customers.selected': { one: '{{n}} Kunde ausgewählt', other: '{{n}} Kunden ausgewählt' },
// etc.
```

## Landing Page i18n (Separate System)

The landing page uses a completely different translation mechanism:

```html
<!-- Each translatable element has all 31 language variants inline -->
<h1>
  <span data-lang="de">KI-gestützte Geschäftssuite</span>
  <span data-lang="en">AI-Powered Business Suite</span>
  <span data-lang="fr">Suite d'affaires alimentée par l'IA</span>
  <!-- ... 28 more languages -->
</h1>
```

Language selector shows/hides the appropriate `data-lang` spans via CSS/JS.

## Common Anti-Patterns

1. **Hardcoded German text** — Using `"Speichern"` instead of `window.t('common.save')`
2. **Missing fallback** — No English translation → user sees `customers.new_field`
3. **HTML in translations** — `'<b>Wichtig</b>'` breaks with textContent binding
4. **Key path typos** — `window.t('customer.name')` when key is `customers.name`
5. **Stale DOM** — Dynamically rendered content not calling `applyTranslations()` after render
