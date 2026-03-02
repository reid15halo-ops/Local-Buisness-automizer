# Morgenblick — Produktbeschreibung

---

## Auf einen Blick

| | |
|---|---|
| **Produktname** | Morgenblick — Dein Tagesplan auf einen Blick |
| **Interner Codename** | `morgenblick` |
| **Zielgruppe** | Handwerker, Dienstleister mit Außenterminen |
| **Preis** | €29/Monat (monatlich kündbar) |
| **Setup** | Kostenlos |
| **Testphase** | 30 Tage kostenlos |
| **Hauptversprechen** | Jeden Morgen wissen, was ansteht — ohne Papierchaos |

---

## 1. Das Problem

Handwerker organisieren sich mit:
- Zetteln in der Hosentasche
- WhatsApp-Nachrichten an sich selbst
- Einem Kalender an der Werkstattwand
- Kopf-Erinnerungen ("Müller war doch Dienstag, oder?")

**Ergebnis:**
- Vergessene Termine
- Unvorbereitete Kundenbesuche
- Offene Angebote, die niemand nachverfolgt
- Rechnungen, die monatelang unbezahlt bleiben

---

## 2. Die Lösung

Jeden Morgen um **7:00 Uhr** bekommt der Handwerker eine kurze, klare Zusammenfassung per E-Mail:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MORGENBLICK — Dienstag, 04. März 2026
  Guten Morgen, Klaus!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  HEUTE
  ─────
  08:00  Heizung reparieren — Müller, Hauptstr. 12, München
         Tel: 0176 123 456 78
  11:00  Kostenvoranschlag — Bauer, Am Ring 5, Dachau
         Tel: 0151 987 654 32
  14:30  Bad komplett — Schmidt, Seeweg 8, Starnberg
         Tel: 0170 555 444 33

  OFFENE ANGEBOTE (Nachfassen!)
  ──────────────────────────────
  ⚠️  Huber (14 Tage alt) — Bad-Renovierung — €4.800
  ⚠️  Weber (9 Tage alt) — Heizungstausch — €3.200
      Meier (3 Tage alt) — Elektro-Check — €890

  UNBEZAHLTE RECHNUNGEN
  ─────────────────────
  🔴  Fischer — RE-2026-041 — €2.340 — fällig seit 22 Tagen
      Schmitz — RE-2026-043 — €1.180 — fällig seit 8 Tagen

  ERINNERUNGEN
  ────────────
  📋  Material bestellen für Schmidt-Projekt (Fliesen + Armaturen)
  📋  Lehrling-Beurteilung bis Freitag

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  → Termine verwalten: morgenblick.freyai-visions.de
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 3. Features

### MVP (Version 1.0)
- [ ] Web-Oberfläche: Termine, Angebote, Rechnungen, Notizen eintragen
- [ ] Tägliche E-Mail-Zusammenfassung um 7:00 Uhr
- [ ] Kalender-Ansicht (Woche/Monat)
- [ ] Kunden-Datenbank (Name, Telefon, Adresse, Notizen)
- [ ] Offene Angebote mit Alter-Tracking
- [ ] Unbezahlte Rechnungen mit Fälligkeits-Alarm
- [ ] Erinnerungen / Notizen
- [ ] Mobil-optimiert (Handy-first)

### Version 2.0 (Später)
- [ ] Telegram/WhatsApp-Benachrichtigung statt E-Mail
- [ ] Kunden-Erinnerung: automatische SMS/E-Mail an Kunden 24h vor Termin
- [ ] Google Calendar Sync
- [ ] Wetter-Integration (relevant für Außenarbeiten)
- [ ] Fahrtrouten-Optimierung (mehrere Termine am Tag)
- [ ] Wochen-Zusammenfassung (freitags)

---

## 4. Dateneingabe — So einfach wie möglich

Der Handwerker muss Daten eingeben. Das ist die größte Hürde.

**Lösung: Minimal-Eingabe**

Neuen Termin anlegen:
```
[Datum]  [Uhrzeit]  [Was?]  [Wer?]  [Wo?]
```

Das war's. Keine Pflichtfelder außer Datum und Was.

**Quick-Add per Formular:**
```
┌─────────────────────────────────────┐
│  + Neuer Termin                     │
│                                     │
│  Was?     [Heizung reparieren    ]  │
│  Wann?    [04.03.2026] [08:00   ]  │
│  Kunde?   [Müller ▾ (Vorschlag) ]  │
│  Wo?      [Hauptstr. 12, München]  │
│  Notiz?   [Ersatzteile mitnehmen]  │
│                                     │
│        [✓ Speichern]                │
└─────────────────────────────────────┘
```

---

## 5. Warum €29/Monat?

### ROI-Rechnung:
```
Vergessene / zu spät nachgefasste Angebote pro Monat:    2
Durchschnittlicher Auftragswert:                         €3.000
Entgangener Umsatz:                                      €6.000/Monat
Kosten Morgenblick:                                      €29/Monat

Wenn nur 1 von 10 vergessenen Angeboten doch noch kommt: €3.000 Gewinn
```

**Verkaufsargument:** *"29 Euro im Monat, damit Sie kein Angebot und keinen Termin mehr vergessen. Wenn dadurch nur ein einziger Auftrag pro Jahr nicht durch die Lappen geht, haben Sie das Tool für 10 Jahre bezahlt."*

---

## 6. Abgrenzung zu bestehenden Lösungen

| Lösung | Problem |
|---|---|
| Google Calendar | Keine Angebots-/Rechnungs-Übersicht |
| Excel-Liste | Wird nicht gepflegt, nicht mobil |
| Zettelwirtschaft | Geht verloren, kein Überblick |
| Craft / Lexoffice | Zu komplex, zu teuer, zu viele Features |
| **Morgenblick** | **Genau das was ein Handwerker braucht — nicht mehr** |

---

## 7. Upsell-Pfade

```
Morgenblick-Kunde
     │
     ├──→ "Sie haben 23 offene Angebote — senden Sie diese professionell als PDF!"
     │    → Schnell-Angebot (€49/Monat)
     │
     ├──→ "45 zufriedene Kunden diesen Monat — holen Sie sich deren Google-Bewertungen!"
     │    → Review Booster (€29/Monat)
     │
     └──→ "Sie verwalten schon Kunden und Termine — zeigen Sie sich jetzt auch online!"
          → Website-Paket (€119/Monat)
```

---

*FreyAI Visions · Intern*
