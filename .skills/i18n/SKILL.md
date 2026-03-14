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

## 2. Anti-Patterns — VERBOTEN

**Niemals hardcoded User-facing Text in HTML oder JS verwenden.**

```javascript
// FALSCH — hardcoded Text
element.textContent = 'Rechnung erstellt';
element.innerHTML = '<span>Gesamt: 1.234,56 EUR</span>';
throw new Error('Ungültige Eingabe');

// RICHTIG — immer über i18n-Key
element.textContent = window.t('invoices.created');
element.innerHTML = `<span>${window.t('invoices.total', { amount: formatted })}</span>`;
throw new Error(window.t('errors.validation.invalid_input'));
```

```html
<!-- FALSCH — hardcoded Text im HTML -->
<button>Speichern</button>
<label>Kundenname</label>
<p>Keine Daten vorhanden</p>

<!-- RICHTIG — data-i18n Attribut mit Fallback -->
<button data-i18n="common.save">Speichern</button>
<label data-i18n="customers.name_label">Kundenname</label>
<p data-i18n="common.no_data">Keine Daten vorhanden</p>
```

### Audit — Hardcoded Strings finden
```bash
# HTML: Text-Nodes ohne data-i18n (grobe Suche)
grep -rn 'textContent\s*=' js/ --include="*.js" | grep -v "window.t("
grep -rn 'innerHTML\s*=' js/ --include="*.js" | grep -v "window.t("

# HTML-Dateien auf rohen Text pruefen (Elemente ohne data-i18n)
grep -n '>[A-ZÜÄÖ][^<]*</' *.html | grep -v 'data-i18n' | grep -v 'data-lang'
```

## 3. Adding New Translation Keys

### Step-by-Step
1. Add key to `js/i18n/de.js` (German FIRST — primary language)
2. Add same key to `js/i18n/en.js` (English translation)
3. Use in HTML: `<span data-i18n="section.key">Fallback Text</span>` — Fallback ist PFLICHT
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
7. **Fallback in HTML ist Pflicht** — `data-i18n` Elemente MUESSEN einen deutschen Fallback-Text enthalten

## 4. Parameter Interpolation

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
- Zahlen, Datumsangaben und Waehrungen VOR der Uebergabe an `window.t()` formatieren (nicht in der Translation)

### JS-Fallback fuer fehlende Keys
```javascript
// Sicher: Fallback wenn Key fehlt oder undefined
const label = window.t('section.key') || 'Standardtext';

// Bei optionalen Parametern: Pruefen vor Uebergabe
const amount = value != null ? formatCurrency(value) : '—';
window.t('invoices.total', { amount });
```

## 5. Deutsches Format — Zahlen, Datum, Waehrung

**Alle deutschen Ausgaben MUESSEN folgende Formate verwenden:**

| Typ | Deutsches Format | Beispiel | Falsch |
|-----|-----------------|---------|--------|
| Dezimalzahl | Komma als Dezimaltrennzeichen, Punkt als Tausender | `1.234,56` | `1,234.56` |
| Waehrung | Betrag Komma Dezimal + Leerzeichen + EUR oder € am Ende | `1.234,56 EUR` / `1.234,56 €` | `EUR 1234.56` |
| Datum | DD.MM.YYYY | `15.03.2026` | `2026-03-15` / `03/15/2026` |
| Uhrzeit | HH:MM Uhr | `14:30 Uhr` | `2:30 PM` |
| Prozentzahl | Zahl + Leerzeichen + % | `12,5 %` | `12.5%` |

### Intl API verwenden
```javascript
// Waehrung formatieren (vor Uebergabe an window.t)
const formatCurrency = (value) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
// → "1.234,56 €"

// Zahl formatieren
const formatNumber = (value) =>
  new Intl.NumberFormat('de-DE').format(value);
// → "1.234,56"

// Datum formatieren
const formatDate = (date) =>
  new Intl.DateTimeFormat('de-DE').format(new Date(date));
// → "15.3.2026"

// Datum mit fuehrender Null
const formatDateFull = (date) =>
  new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
// → "15.03.2026"
```

## 6. Deutsche Grammatik und Rechtschreibung

**Pflichtregeln fuer alle deutschen Texte:**

| Regel | Richtig | Falsch |
|-------|---------|--------|
| Formelle Anrede | "Sie", "Ihnen", "Ihr" (gross) | "sie", "ihnen", "ihr" |
| Substantive grossschreiben | "Rechnung", "Kunde", "Betrag" | "rechnung", "kunde" |
| Umlaute korrekt | "ü", "ö", "ä", "ß" | "ue", "oe", "ae", "ss" |
| Kein Denglish | "Anmelden" | "Login" (als Button-Text) |
| Korrekte Interpunktion | "Gespeichert." | "Gespeichert!" (ausser Fehler/Erfolg) |
| Keine Abkuerzungen | "zum Beispiel" / "z. B." | "zb", "zB" |

**Checkliste vor dem Hinzufuegen einer deutschen Uebersetzung:**
- [ ] Formelle Sie-Form verwendet?
- [ ] Alle Substantive grossgeschrieben?
- [ ] Umlaute und ß korrekt (nicht ue/oe/ae/ss)?
- [ ] Kein unnoetig englischer Begriff wenn deutsches Wort existiert?
- [ ] Satzzeichen am Ende bei vollstaendigen Saetzen?

## 7. Plural Forms

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
- Beispiele mit Unterschied: `1 Rechnung` / `{{n}} Rechnungen`, `1 Eintrag` / `{{n}} Eintraege`

## 8. Landing Page Languages

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

## 9. File Structure

```
js/
  i18n/
    de.js      # Deutsche Uebersetzungen (primaer, ~402 keys)
    en.js      # Englische Uebersetzungen (~402 keys)
  services/
    i18n-service.js   # Translation Service + TR inline keys (~15)
landing.html           # 31-Sprachen Landing via data-lang
```

**Format der Sprachdateien (`.js`, kein JSON):**
```javascript
// js/i18n/de.js
export default {
  nav: {
    dashboard: 'Dashboard',
    invoices: 'Rechnungen',
  },
  invoices: {
    status: {
      paid: 'Bezahlt',
      open: 'Offen',
    },
    total: 'Gesamt: {{amount}}',
  },
};
```

**Strukturregeln:**
- Gleiche Key-Hierarchie in de.js und en.js erzwingen
- Keine flat keys auf Top-Level (immer mindestens `section.key`)
- Sektionen alphabetisch sortiert halten
- Kommentar-Trennlinien fuer grosse Sektionen erlaubt

## 10. Consistency Checks

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
6. **Fehlender Fallback** — `data-i18n` Element hat keinen Fallback-Text
7. **Falsche Zahlenformatierung** — Englisches Format `1,234.56` statt deutschem `1.234,56`

## 11. Quality Checklist

Before adding or modifying translations, verify all items:

**Keys & Struktur:**
- [ ] Key exists in BOTH de.js and en.js
- [ ] Key follows dot notation naming convention (`section.subsection.action`)
- [ ] Parameter names match between DE and EN (`{{param}}`)
- [ ] Plural forms define both `one` and `other` in both languages
- [ ] Kein hardcoded User-facing Text in HTML oder JS

**HTML Integration:**
- [ ] HTML elements use `data-i18n` attribute (not hardcoded text)
- [ ] Jedes `data-i18n` Element hat einen deutschen Fallback-Text
- [ ] Landing page additions include all 31 language variants

**Deutsches Format:**
- [ ] Zahlen: Komma als Dezimaltrennzeichen (`1.234,56`)
- [ ] Waehrung: `1.234,56 EUR` oder `1.234,56 €` (Betrag zuerst)
- [ ] Datum: DD.MM.YYYY (`15.03.2026`)
- [ ] Intl API fuer Formatierung verwendet (nicht manuelles String-Concat)

**Deutsche Grammatik:**
- [ ] Formelle Sie-Form (grossgeschrieben)
- [ ] Umlaute korrekt (ü/ö/ä/ß, keine ue/oe/ae/ss)
- [ ] Alle Substantive grossgeschrieben
- [ ] No HTML tags inside translation values

**TR (Turkish):**
- [ ] Turkish (TR) keys updated if applicable (minimal set in i18n-service.js)

## References

- `references/i18n-architecture.md` — Service internals, key structure, DOM binding
