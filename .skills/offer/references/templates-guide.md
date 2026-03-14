# FreyAI Visions — Offer Templates Guide

## Angebot Text Template

### Standard Template (Professional Tier)

```
Sehr geehrte/r [Anrede] [Nachname],

vielen Dank für Ihr Interesse an unseren Dienstleistungen und das
angenehme Erstgespräch am [Datum].

Basierend auf unserer Analyse Ihres Betriebs erstellen wir Ihnen
folgendes Angebot für die Digitalisierung Ihrer Geschäftsprozesse:

[Scope-Zusammenfassung: 2-3 Sätze, was implementiert wird]

Die aufgeführten Positionen umfassen die vollständige Implementierung,
Konfiguration, Schulung und Inbetriebnahme. Nach dem Setup steht Ihnen
unser monatlicher Support mit priorisierter Bearbeitung zur Verfügung.

Gemäß §19 UStG wird keine Umsatzsteuer berechnet.

Dieses Angebot ist 30 Tage gültig bis zum [Datum + 30 Tage].

Haben Sie Fragen oder möchten Sie Anpassungen besprechen?
Kontaktieren Sie uns gerne unter kontakt@freyaivisions.de
oder +49 163 6727787.

Mit freundlichen Grüßen,

Jonas Glawion
FreyAI Visions
Grabenstraße 135, 63762 Großostheim
kontakt@freyaivisions.de | freyaivisions.de
```

### Starter Template (Simpler Tone)

```
Sehr geehrte/r [Anrede] [Nachname],

vielen Dank für Ihre Anfrage. Gerne unterstützen wir Sie bei der
Digitalisierung Ihres Betriebs.

Wir haben für Sie ein Starter-Paket zusammengestellt, das die
wichtigsten Grundfunktionen abdeckt: [Kurzbeschreibung].

Gemäß §19 UStG wird keine Umsatzsteuer berechnet.
Dieses Angebot ist 30 Tage gültig.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen,
Jonas Glawion — FreyAI Visions
```

### Pilot/Friend Template (€0 Offer)

```
Hallo [Vorname],

wie besprochen stelle ich dir das FreyAI-System als Pilotprojekt
kostenlos zur Verfügung. Alle Positionen sind aufgelistet, damit
wir den vollen Prozess durchlaufen können.

Dein Feedback hilft mir, das System für zukünftige Kunden zu
optimieren. Im Gegenzug bekommst du die komplette Suite ohne Kosten.

Gemäß §19 UStG wird keine Umsatzsteuer berechnet.

Meld dich bei Fragen einfach direkt.

Beste Grüße,
Jonas
```

## Email Template Structure

The `getAngebotEmail()` method generates:

```html
<!-- Header: Dark theme (#0c1a1a) with company logo -->
<div style="background: #0c1a1a; color: #fafafa; padding: 32px;">
  <h1>FreyAI Visions</h1>
  <p>Angebot Nr. ANG-XXXX</p>
</div>

<!-- Customer Address Block -->
<div>
  <p>[Kunde Name]</p>
  <p>[Kunde Email]</p>
</div>

<!-- Angebot Text (from template above) -->
<div>[angebots_text]</div>

<!-- Positions Table -->
<table>
  <tr><th>Pos</th><th>Beschreibung</th><th>Menge</th><th>Einzelpreis</th><th>Gesamtpreis</th></tr>
  <!-- One row per position -->
</table>

<!-- Totals -->
<div>
  <p>Netto: €X.XXX,XX</p>
  <!-- NO MwSt line (Kleinunternehmer) -->
  <p><strong>Gesamt: €X.XXX,XX</strong></p>
  <p><small>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</small></p>
</div>

<!-- Validity -->
<p>Gültig bis: [Date + 30 days]</p>

<!-- CTA -->
<p>Haben Sie Fragen? Kontaktieren Sie uns unter kontakt@freyaivisions.de</p>

<!-- Footer -->
<div style="background: #0c1a1a; color: #888; padding: 24px;">
  <p>FreyAI Visions | Jonas Glawion</p>
  <p>Grabenstraße 135, 63762 Großostheim</p>
  <p>kontakt@freyaivisions.de | +49 163 6727787</p>
  <p>IBAN: [from company settings] | Steuernummer: [from settings]</p>
</div>
```

## Position Templates by Category

### KI-Beratung & Setup (FreyAI Core Services)

| Beschreibung | Einheit | Preis-Range (€) |
|-------------|---------|-----------------|
| Erstgespräch & Betriebsanalyse | Pauschal | 0 (always free) |
| Digital-Audit & Prozessanalyse | Pauschal | 490–690 |
| Starter-Setup | Pauschal | 1.800–2.200 |
| Professional-Setup | Pauschal | 2.800–3.200 |
| Enterprise-Setup | Pauschal | 3.200–3.800 |
| E-Mail-Automatisierung | Pauschal | 580–980 |
| Angebots-KI | Pauschal | 680–780 |
| Mahnwesen-Automatisierung | Pauschal | 480–580 |
| Chatbot-Integration | Pauschal | 580–780 |
| Social-Media-Integration | Pauschal | 580–780 |
| Lagerverwaltung & Bestellwesen | Pauschal | 680 |
| DATEV-Schnittstelle | Pauschal | 480 |
| Schulung & Einweisung | Std. | 120 |
| Go-Live-Begleitung | Pauschal | 390–690 |
| Basis-Retainer | Monat | 300 |
| Professional-Retainer | Monat | 400 |
| Premium-Retainer | Monat | 500 |

### Premium Add-Ons (for Enterprise/Premium variants)

| Beschreibung | Einheit | Preis (€) |
|-------------|---------|-----------|
| Erweiterte Garantie (12 Monate) | Pauschal | 350 |
| Priority-Support SLA (4h Reaktionszeit) | Monat | +100 |
| Dedizierter Ansprechpartner | Monat | +150 |
| Custom API-Integration | Pauschal | 480–980 |
| Multi-Standort-Setup | Pauschal | 680 |
| White-Label Kundenportal | Pauschal | 580 |

## Number Formatting

German locale for all prices:
- Decimal separator: `,` (Komma)
- Thousands separator: `.` (Punkt)
- Currency symbol after number: `3.500,00 €`
- In code: `netto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })`

## Company Contact Block

Always include in offers:
```
FreyAI Visions
Jonas Glawion
Grabenstraße 135
63762 Großostheim

kontakt@freyaivisions.de
+49 163 6727787
freyaivisions.de

Kleinunternehmer gemäß §19 UStG
Gemeinde-ID: 09671122
```
