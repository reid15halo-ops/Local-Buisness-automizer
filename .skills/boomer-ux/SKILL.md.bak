---
name: boomer-ux
description: |
  UX patterns and rules for making the FreyAI Visions app usable by non-technical German Handwerker (craftsmen) aged 45-65+ with zero IT skills. Use this skill ANY time you are modifying UI, adding features, creating new views, editing HTML/CSS/JS that affects user interaction, or reviewing the app for usability. Also trigger when the user mentions: accessibility, usability, "easy to use", "simple", "Handwerker", "non-technical", "boomer", user-friendly, onboarding, tooltips, confirmations, or error messages. This is the most important skill for this project — the target user is NOT a developer.
---

# Boomer UX — Design Rules for Non-Technical Handwerker

## Who Is The User?

Picture Herr Müller, 57, Fliesenleger (tiler) from Schwäbisch Hall. He:

- Uses WhatsApp and maybe Excel. That's his entire tech stack.
- Thinks "API" is a type of beer.
- Will abandon the app within 30 seconds if confused.
- Types with two index fingers, slowly.
- Has reading glasses and doesn't always wear them.
- Doesn't know what "sync", "cache", "pipeline", or "dashboard" mean.
- Knows his business inside out: customers, quotes, jobs, invoices.
- Speaks German. Not English. Not tech-German. Regular German.

Every UI decision must pass the "Herr Müller Test": Would a 57-year-old craftsman with no IT training understand what to do within 3 seconds of looking at this screen?

## Core Principles

### 1. One Screen, One Job

Each view does exactly one thing. No multi-purpose screens. No tabs-within-tabs.
If you're tempted to add a tab strip inside a modal, stop — you've gone too far.

**Maximum 3 clicks from home screen to any core action.** If it takes 4 or more clicks, restructure the navigation.

### 2. Big, Obvious, Labeled Buttons

- Minimum touch target: 48x48px (ideally 56px+)
- Every button has a TEXT LABEL — never icon-only
- Icons are supplementary, never the sole affordance
- Use verbs Herr Müller knows: "Angebot erstellen", "Rechnung schreiben", not "Neues Dokument generieren"
- Primary action buttons: full-width on mobile, prominent color, large font (18px+)

### 3. German, Human, Non-Technical Language

Bad: "Datensynchronisation fehlgeschlagen. Retry?"
Good: "Die Daten konnten gerade nicht gespeichert werden. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut."

Bad: "Pipeline: Anfrage → Angebot → Auftrag → Rechnung"
Good: "Wie läuft's? Kunde hat angefragt → Sie haben ein Angebot geschrieben → Der Auftrag läuft → Rechnung ist raus"

Rules:
- No English words (no "Dashboard", "Export", "Settings" — use "Übersicht", "Herunterladen", "Einstellungen")
- No technical jargon (no "synchronisieren", "Cache", "Token", "API")
- No abbreviations the user wouldn't know (KPI, CSV, JSON, BOM, COGS — say what you mean)
- Error messages must explain what happened AND what to do next, in plain German
- Use "Sie" (formal), never "du"

### 4. Progressive Disclosure — Beginner Mode by Default

The app has two modes:
- **Einfacher Modus** (Simple Mode) — DEFAULT for new users
- **Profi-Modus** (Pro Mode) — Unlocked explicitly by the user

**Toggle mechanism:** In Einstellungen → "Ansicht", a clearly labeled switch:
```
[ Einfacher Modus  ●────  Profi-Modus ]
```
- Switching to Profi-Modus shows a plain-German confirmation: "Möchten Sie alle Funktionen einblenden? Sie können jederzeit zurückwechseln."
- Mode is persisted in profile (Supabase) so it survives logins.

In Simple Mode, hide:
- Lagerverwaltung (Inventory/BOM management)
- Bestellwesen (Purchase Orders)
- Nachbestellungen (Reorder Engine)
- Kommunikations-Hub (Communication Hub)
- Kalender (Calendar — unless appointments exist)
- Datenexport/-import (Data Export/Import)
- Buchhaltung details (show only "Einnahmen diesen Monat: €X")
- Dashboard-Diagramme (KPI Charts)
- Tastaturkürzel (Keyboard shortcuts)
- Any developer/admin settings

In Simple Mode, show:
- Kunden (Customers) — big list, search, add
- Angebote (Quotes) — create, send, track
- Aufträge (Jobs) — status, complete
- Rechnungen (Invoices) — create, mark paid
- Übersicht (Overview) — simple summary, not a "dashboard"

### 5. Quick Actions — The Home Screen

The first thing a user sees after login must be 3-4 big action cards:

```
┌─────────────────────────────────────┐
│  Guten Morgen, Herr Müller!         │
│                                     │
│  Was möchten Sie tun?               │
│                                     │
│  ┌───────────┐  ┌───────────┐      │
│  │  👤 Neuer │  │  📝 Neues │      │
│  │   Kunde   │  │  Angebot  │      │
│  └───────────┘  └───────────┘      │
│  ┌───────────┐  ┌───────────┐      │
│  │  📋 Neue  │  │  💶 Neue  │      │
│  │  Anfrage  │  │ Rechnung  │      │
│  └───────────┘  └───────────┘      │
│                                     │
│  ── Letzte Aktivitäten ──          │
│  • Angebot für Schmidt: €2.340     │
│  • Rechnung #47 bezahlt: €890     │
└─────────────────────────────────────┘
```

These cards must:
- Be at least 120x120px
- Have clear icon + label
- Go directly to the creation form (no intermediate screen)
- Be visible without scrolling on any device

### 6. Confirmation Before Every Irreversible Action

Any action that changes business state needs a confirmation dialog:

**Must confirm:**
- Angebot absenden (sending a quote to customer)
- Angebot annehmen (accepting a quote → creates order)
- Auftrag abschließen (completing a job → triggers stock, billing)
- Rechnung als bezahlt markieren (marking invoice paid → bookkeeping entry)
- Rechnung stornieren (cancelling an invoice)
- Mahnung senden (sending a dunning letter)
- Anything that sends an email/SMS/message
- Deleting any record

**Confirmation dialog pattern:**
```
┌──────────────────────────────────────┐
│  Angebot absenden?                   │
│                                      │
│  Sie senden das Angebot #42 über     │
│  €2.340,00 an Herrn Schmidt.         │
│                                      │
│  [  Abbrechen  ]   [ Ja, absenden ]  │
└──────────────────────────────────────┘
```

Rules:
- Always show WHAT will happen in plain language, including amounts and names
- "Abbrechen" (Cancel) is always on the left, muted color
- Confirm button is on the right, uses the action verb (not just "OK" or "Ja")
- Confirm button is NOT red unless the action is destructive (delete/cancel)
- Never auto-dismiss. User must click.

### 7. Friendly Error Handling

Every error must:
1. Explain what happened in plain German
2. NOT show technical details (no stack traces, no error codes, no "undefined")
3. Suggest what the user should do next
4. Offer a way to try again or go back
5. Never blame the user

**Error message template:**
```html
<div class="error-friendly">
  <span class="error-icon">⚠️</span>
  <h3>Das hat leider nicht geklappt</h3>
  <p>[What happened in plain German]</p>
  <p>[What to do next]</p>
  <button>Nochmal versuchen</button>
  <button>Zurück zur Übersicht</button>
</div>
```

**Examples:**
- Network error: "Die Verbindung zum Server wurde unterbrochen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es in einer Minute erneut."
- Save failed: "Ihre Änderungen konnten nicht gespeichert werden. Keine Sorge — Ihre Eingaben sind noch da. Bitte versuchen Sie es erneut."
- Not found: "Dieser Eintrag wurde nicht gefunden. Möglicherweise wurde er gelöscht. Zurück zur Übersicht?"

### 8. Visual Hierarchy & Readability

- Base font size: 16px minimum, 18px preferred for body text
- Headers: 24px+
- Buttons: 16px+ label text
- Contrast ratio: WCAG AA minimum (4.5:1 for text, 3:1 for large text)
- Line height: 1.5 for body text
- Padding: generous — never cram elements together
- Colors: use meaning consistently:
  - Green = success, paid, complete
  - Yellow/Orange = attention needed, pending
  - Red = overdue, error, destructive action
  - Blue = interactive, clickable, informational
- Status indicators: always icon + color + text (never color alone — colorblind users)

### 9. Forms That Don't Intimidate

- Show only required fields initially
- Optional fields behind "Mehr Angaben" (More details) expandable section
- One column on mobile, two max on desktop
- Inline validation with friendly messages ("Bitte geben Sie eine gültige E-Mail-Adresse ein")
- Auto-save drafts — NEVER lose the user's input
- Large input fields (min-height: 44px)
- Clear labels ABOVE inputs (not placeholder-only)
- Pre-fill where possible (customer name from selection, dates default to today)

### 10. Loading States — Never Leave the User Guessing

Any operation taking more than 300ms must show a loading indicator:

- **Short operations (300ms–2s):** Spinner on the button that was clicked. Button text changes to "Wird geladen…" and is disabled.
- **Long operations (2s+):** Full-screen overlay with progress message in plain German:
  ```
  ┌──────────────────────────────────┐
  │  ⏳ Angebot wird erstellt...      │
  │  Bitte warten Sie einen Moment.  │
  └──────────────────────────────────┘
  ```
- **Background saves:** Subtle "Wird gespeichert…" text near the bottom — never a blocking modal.
- **After success:** Brief green confirmation ("Gespeichert ✓") that fades after 3 seconds.
- Never show a blank screen or a frozen button without feedback.

### 11. Mobile-First — The App Runs on Phones

Herr Müller uses his app on a smartphone at the job site, not behind a desk.

- Design for 390px viewport width first (iPhone 14 equivalent)
- All core actions must be reachable with one thumb (no reaching to top corners)
- Navigation: bottom tab bar on mobile (not hamburger menus)
- Tables become card lists on mobile — no horizontal scrolling
- File uploads support camera capture (Kamera öffnen) as first option on mobile
- Form inputs must not cause zoom on iOS (font-size 16px minimum on inputs)
- Test every new feature at 390px width before considering it done

### 12. The Setup Must Be Invisible for End Users

The first-run experience for Herr Müller as an end customer is minimal:
1. He opens the app
2. He sees "Willkommen! Legen Sie Ihren ersten Kunden an."
3. He enters a customer name
4. Done. He's using the app.

**Note:** The onboarding Setup Wizard (13 fields, 3 steps) and Fragebogen (52 questions) are for the initial FreyAI Visions customer engagement — filled out once by the business owner during the paid setup phase, guided by Jonas. They are NOT a self-service sign-up flow. After setup, the app must feel like it was already configured — not like a tool that still needs setting up.

All technical setup (Supabase, Stripe, API keys, n8n webhooks) must be:
- Pre-configured by the installer/admin (Jonas)
- Hidden behind "Einstellungen → Technische Einstellungen" (locked behind a code/password)
- Never shown during regular app usage

## Implementation Checklist

When modifying any UI component, verify:

- [ ] All text is in plain German (no English, no jargon)
- [ ] Buttons have text labels (not icon-only)
- [ ] Touch targets are 48px+
- [ ] Font size is 16px+
- [ ] Destructive actions have confirmation dialogs with amounts and names
- [ ] Error states show friendly German messages with recovery actions
- [ ] The feature respects Simple/Pro mode visibility
- [ ] Forms have labels above inputs (not just placeholders)
- [ ] Status uses icon + color + text (not color alone)
- [ ] The feature is reachable in ≤3 clicks from the home screen
- [ ] Loading states are shown for operations >300ms
- [ ] Layout tested at 390px (mobile-first)
- [ ] Auto-save prevents data loss on navigation or network failure

## Reference: Common German UI Labels

Read `references/german-ui-labels.md` for the full translation table of UI terms.

## Reference: Confirmation Dialog Patterns

Read `references/confirmation-patterns.md` for reusable dialog implementations.
