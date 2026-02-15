# Anforderungs-Fragebogen - Local Business Automizer

**Zweck:** Refactoring-Prioritäten und Feature-Roadmap definieren
**Datum:** 2026-02-15

---

## 🎯 Teil 1: Nutzungskontext (5 Fragen)

### 1.1 Wer nutzt die App?
- [X ] A) Nur du alleine
- [ ] B) Du + 1-2 Mitarbeiter
- [ ] C) Kleines Team (3-10 Personen)
- [ ] D) Größeres Team (10+ Personen)
- [ ] E) Möchtest du die App auch an andere Handwerker verkaufen/vermieten?

### 1.2 Wo läuft die App?
- [ ] A) Nur auf deinem lokalen PC (kein Deployment nötig)
- [ ] B) Raspberry Pi im lokalen Netzwerk (nur Heimnetz/Büro)
- [ ] C) Öffentlich im Internet (Netlify/Server)
- [ ] D) Hybrid: Lokal + Cloud Backup
- [ X] E) Weiß noch nicht

### 1.3 Datenmenge erwarten?
- [ ] A) Wenig (< 100 Anfragen/Jahr)
- [X ] B) Mittel (100-1000 Anfragen/Jahr)
- [ ] C) Viel (1000-10.000 Anfragen/Jahr)
- [ ] D) Sehr viel (> 10.000 Anfragen/Jahr)

### 1.4 Wie lange soll die App genutzt werden?
- [ ] A) Nur zum Testen/Prototyp (1-3 Monate)
- [ ] B) Kurzfristig (3-12 Monate)
- [ ] C) Langfristig (1-3 Jahre)
- [ X] D) Unbegrenzt (kritisches Business-Tool)

### 1.5 Planst du die App selbst weiterzuentwickeln?
- [ ] A) Nein, ich kann kein JavaScript
- [X ] B) Ja, aber nur kleine Änderungen
- [ ] C) Ja, ich will aktiv Features hinzufügen
- [ X] D) Ja, und ich will eventuell andere Developer dazuholen

---

## 🔒 Teil 2: Security & Compliance (4 Fragen)

### 2.1 GDPR/DSGVO-Konformität wichtig?
- [ ] A) Nein, nur für privaten Gebrauch
- [ ] B) Ja, aber nur Basic-Compliance (Google Fonts Problem fixen)
- [ X] C) Ja, voll DSGVO-konform (Cookie Banner, Datenschutzerklärung, etc.)
- [ ] D) Weiß nicht / Brauche Beratung

**Kontext:** Aktuell lädt die App Google Fonts direkt → DSGVO-Abmahnung möglich

### 2.2 Wie kritisch sind Kundendaten?
- [ ] A) Unkritisch (nur Testdaten)
- [ ] B) Normal (Namen, Emails, Adressen)
- [ X] C) Sensitiv (inkl. Bankdaten, Verträge, etc.)
- [ ] D) Hochsensitiv (brauche Verschlüsselung, Audit-Logs)

### 2.3 Content Security Policy (CSP) durchsetzen?
- [ ] A) Egal, Hauptsache es funktioniert
- [ ] B) Ja, aber nur wenn es einfach zu fixen ist
- [ X] C) Ja, unbedingt (auch wenn es Refactoring braucht)

**Kontext:** Aktuell CSP mit 'unsafe-inline' → macht Security-Header fast nutzlos

### 2.4 CDN-Dependencies absichern?
- [ ] A) Ist mir egal
- [X ] B) Ja, SRI-Hashes hinzufügen (5 Min Arbeit)
- [ ] C) Nein, lieber alles selbst hosten (30 Min Setup, aber kein CDN-Risk)

---

## 🚀 Teil 3: Features & Prioritäten (6 Fragen)

### 3.1 Welche Features sind dir am wichtigsten? (Mehrfachauswahl)
- [ X] A) Workflow (Anfrage → Angebot → Rechnung) - **Core Feature**
- [ ] B) KI-Integration (Gemini Chatbot, Text-Generierung)
- [ X] C) WhatsApp-Integration
- [ X] D) Email-Versand
- [ ] E) Kalender & Zeiterfassung
- [ X] F) Buchhaltung & DATEV-Export
- [ ] G) Dokumente & OCR-Scanner
- [ X] H) Mahnwesen
- [ ]X I) Reporting & Dashboards
- [ X] J) CRM / Kundenverwaltung

### 3.2 Neue Features gewünscht?
**Beispiele aus Kritik:**
- [X ] A) Multi-User Support (Team-Funktionen, Rollen)
- [ X] B) Echtzeit-Sync (mehrere Geräte gleichzeitig)
- [ X] C) Mobile App (React Native / PWA verbessern)
- [ X] D) Benachrichtigungen (Push, Email)
- [ X] E) Integrationen (Stripe, PayPal, Banking-APIs)
- [ X] F) Automatisierung (n8n Workflows ausbauen)
- [ X] G) Custom Branding (Logo, Farben, Firmendaten)
- [ X] H) Keine neuen Features, erstmal stabilisieren

### 3.3 KI-Features wichtig?
- [X ] A) Sehr wichtig, will mehr KI-Funktionen
- [ ] B) Nice-to-have, aber nicht kritisch
- [ ] C) Egal, kann auch weg
- [ ] D) Entfernen, brauche ich nicht

### 3.4 Offline-Fähigkeit (PWA) wichtig?
- [ ] A) Ja, sehr wichtig (z.B. auf Baustelle ohne Internet)
- [ ] B) Nice-to-have
- [ X] C) Nicht wichtig, habe immer Internet

### 3.5 Excel Import/Export erweitern?
- [X ] A) Ja, brauche mehr Import-Formate (CSV, XML, etc.)
- [ ] B) Aktueller Stand ist OK
- [ ] C) Nicht wichtig

### 3.6 Welche Icons bevorzugst du?
- [ X] A) Emojis behalten (aktuell, inkonsistent aber bunt)
- [X ] B) Icon Font (Lucide, Heroicons - professioneller)
- [ ] C) SVG Sprites (beste Performance)
- [ ] D) Ist mir egal

---

## 🛠️ Teil 4: Code-Qualität & Wartbarkeit (5 Fragen)

### 4.1 Wie wichtig ist Code-Qualität?
- [X ] A) Egal, Hauptsache funktioniert
- [ ] B) Mittel (grundlegende Sauberkeit)
- [ ] C) Hoch (will Code verstehen können)
- [ ] D) Sehr hoch (will später selbst erweitern)

### 4.2 Tests schreiben?
- [ ] A) Nein, brauche ich nicht
- [ ] B) Nur für kritische Business Logic (Rechnungen, Berechnungen)
- [ ] C) Ja, umfassende Test Suite
- [ X] D) Ja, und Test-Driven Development (TDD)

**Kontext:** Aktuell 0% Test Coverage

### 4.3 TypeScript statt JavaScript?
- [ ] A) Nein, JavaScript reicht
- [ ] B) Nein, aber JSDoc-Kommentare wären gut
- [ X] C) Ja, auf TypeScript migrieren
- [ ] D) Weiß nicht, was besser ist

**Benefit TypeScript:** Typ-Fehler zur Compile-Zeit, bessere IDE-Unterstützung

### 4.4 app.js aufteilen? (aktuell 2132 Zeilen in 1 Datei)
- [ ] A) Nein, ist OK so
- [ ] B) Ja, in logische Module aufteilen (requests.js, offers.js, etc.)
- [X ] C) Ja, komplett neu strukturieren
- [ ] D) Egal

### 4.5 State Management modernisieren?
- [ ] A) Aktuelles System beibehalten
- [X ] B) Leicht verbessern (Immutability, Validierung)
- [ X] C) Auf Redux/Zustand migrieren
- [ ] D) Weiß nicht

---

## ⚡ Teil 5: Performance & UX (4 Fragen)

### 5.1 Performance aktuell OK?
- [ ] A) Ja, läuft super
- [ ] B) Meistens OK, manchmal langsam
- [ ] C) Nein, zu langsam
- [X ] D) Weiß nicht, habe nicht viele Daten

### 5.2 Virtual Scrolling für große Listen?
- [ X] A) Brauche ich, habe/erwarte viele Datensätze (1000+)
- [ ] B) Nice-to-have
- [ ] C) Nicht nötig, bleibe unter 100 Items

### 5.3 Dark/Light Mode wichtig?
- [ ] A) Dark Mode reicht
- [ X] B) Beide Modi wichtig (aktuell implementiert)
- [ ] C) Light Mode bevorzugt
- [ ] D) System-Preference Auto-Switch ist perfekt

### 5.4 Mobile/Tablet-Nutzung?
- [ X] A) Nur Desktop
- [ X] B) Gelegentlich Mobile/Tablet
- [ X] C) Oft Mobile (z.B. auf Baustelle)
- [ X] D) Hauptsächlich Mobile

---

## 🎨 Teil 6: Design & Accessibility (3 Fragen)

### 6.1 Design anpassen?
- [ ] A) Aktuelles Design ist perfekt
- [ ] B) Kleinere Tweaks OK
- [ X] C) Komplett redesignen
- [ ] D) Branding anpassen (Logo, Farben, Firmendaten)

### 6.2 Accessibility (Barrierefreiheit) wichtig?
- [ ] A) Nicht wichtig
- [ ] B) Basic (Tastatur-Navigation, Screen Reader Basics)
X
**Kontext:** Aktuell teilweise WCAG A, viele Issues

### 6.3 Mehrsprachigkeit?
- [ ] A) Nur Deutsch
- [ X] B) Deutsch + Englisch
- [ ] C) Mehrere Sprachen (welche: _____________)

---

## 💰 Teil 7: Budget & Timeline (3 Fragen)

### 7.1 Wie viel Zeit/Geld kannst du investieren?
- [ ] A) Keine (nur kostenlose Lösungen)
- [X ] B) Minimal (< 50€, z.B. für Hosting)
- [ ] C) Mittel (50-500€, z.B. für Services/Tools)
- [ ] D) Größeres Budget (> 500€, z.B. für Entwickler)

### 7.2 Zeitrahmen für Verbesserungen?
- [ X] A) Sofort (diese Woche)
- [ ] B) Kurzfristig (1-2 Wochen)
- [ ] C) Mittelfristig (1-2 Monate)
- [ ] D) Langfristig (3-12 Monate)
- [ ] E) Kein Zeitdruck

### 7.3 Kritischste Probleme zuerst fixen?
**Aus Code Review, welche sind dir am wichtigsten?** (Max 3 auswählen)
- [ ] A) GDPR-Fix (Google Fonts selbst hosten)
- [ X] B) Security (CSP ohne unsafe-inline, SRI-Hashes)
- [X ] C) Error Handling (App crasht nicht bei Fehlern)
- [ ] D) Code aufräumen (app.js aufteilen)
- [ ] E) Tests schreiben
- [ ] F) Icons professionalisieren (weg von Emojis)
- [X ] G) Input Validation (Email, Budget, etc.)
- [ ] H) Performance (Virtual Scrolling)
- [ ] I) Accessibility
- [ ] J) Egal, mach was du für richtig hältst

---

## 📝 Teil 8: Offene Fragen (Freitext)

### 8.1 Was nervt dich aktuell an der App?
```
Das die nicht Funktioniert wie ich will
```

### 8.2 Was ist dein Haupt-Use-Case?
**Beispiel:** "Ich bekomme 5-10 Anfragen pro Woche, erstelle Angebote, 70% werden zu Aufträgen, dann Rechnungen"
```
klingt gut
```

### 8.3 Welche externen Tools nutzt du noch?
**Beispiel:** Excel, QuickBooks, WhatsApp Business, Google Calendar, etc.
```
Ja alle gängigen müssen abgedeckt sein
```

### 8.4 Gibt es Bugs oder Probleme?
```
Zu viele
```

### 8.5 Sonstige Wünsche/Anmerkungen?
```
(Deine Antwort)
```

---

## 🎯 Auswertung (von mir ausgefüllt nach deinen Antworten)

**Wird automatisch erstellt basierend auf deinen Antworten:**

### Priorisierte Roadmap:
1. Phase alle ...




--

**Anleitung:**
1. Checkboxen mit [x] markieren
2. Freitextfelder ausfüllen
3. Speichern und mir sagen "Fragebogen ausgefüllt"
4. Ich erstelle dann eine priorisierte Roadmap und beginne mit der Umsetzung

**Shortcut:** Du kannst auch einfach die Nummer-Buchstaben-Kombination auflisten:
```
1.1: B
1.2: C
1.3: B
...
7.3: A, B, C
8.1: "Die Emojis sehen auf Windows hässlich aus"
```
