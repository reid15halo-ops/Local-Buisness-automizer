---
name: email-templates
description: |
  Create German business email templates for FreyAI Visions customer communication.
  Use this skill when the user asks to write, draft, or send any business email —
  including Angebots-Mail, Auftragsbestätigung, Rechnungs-Versand, Zahlungserinnerung,
  Mahnung (1./2./3. Mahnung), Willkommens-Mail, Terminbestätigung, or follow-up emails.
  Also trigger on: "email", "E-Mail", "Mahnung", "Zahlungserinnerung", "Angebots-Mail",
  "Bestätigung", "Willkommen", "Erinnerung schreiben", "Kundenmail", "Nachfass-Mail",
  "E-Mail-Vorlage", "Rechnung verschicken", "Angebot senden", "Termin bestätigen".
  This skill enforces brand voice, legal compliance, and consistent structure for all
  outbound emails sent via the VPS email relay (kontakt@freyaivisions.de).
---

# E-Mail-Vorlagen — FreyAI Visions Geschäftskorrespondenz

Professional German business emails. Every email sounds like Jonas wrote it — direct, premium, never corporate-template.

## Absender

- **Von:** Jonas von FreyAI / kontakt@freyaivisions.de
- **Relay:** `send-email` Edge Function → VPS Email Relay (Proton Mail Bridge)
- **Payload:** `{ to, subject, body, replyTo?, cc?, bcc? }`

## Template-Kategorien

| Kategorie | Betreff-Muster | Eskalation |
|-----------|---------------|------------|
| **Angebots-Versand** | Ihr Angebot von FreyAI Visions — [ANG-ID] | — |
| **Auftragsbestätigung** | Auftragsbestätigung — [AUF-ID] | — |
| **Rechnungs-Versand** | Rechnung [RE-ID] — FreyAI Visions | — |
| **Zahlungserinnerung** | Zahlungserinnerung — Rechnung [RE-ID] | Mahnstufe 1 |
| **1. Mahnung** | 1. Mahnung — Rechnung [RE-ID] | Mahnstufe 2 |
| **2. Mahnung** | 2. Mahnung — Rechnung [RE-ID] | Mahnstufe 3 |
| **Letzte Mahnung** | Letzte Mahnung — Rechnung [RE-ID] | Mahnstufe 4 |
| **Willkommen** | Willkommen bei FreyAI Visions | — |
| **Terminbestätigung** | Terminbestätigung — [Datum] | — |

## Pflichtstruktur jeder E-Mail

Jede E-Mail folgt diesem Aufbau:

1. **Anrede:** `Sehr geehrte/r [Anrede] [Name],` (immer "Sie", nie "du")
2. **Betreff:** Klar, deutsch, mit Referenznummer wenn vorhanden
3. **Inhalt:** Maximal 3-5 Absätze. Kurz, konkret, handlungsorientiert.
4. **Handlungsaufforderung:** Was soll der Empfänger tun? Frist nennen wenn relevant.
5. **Grußformel:** `Mit freundlichen Grüßen` + Leerzeile + Signatur
6. **Signatur:**
   ```
   Jonas Glawion
   FreyAI Visions
   kontakt@freyaivisions.de | +49 163 6727787
   freyaivisions.de
   ```
7. **Rechtlicher Fußbereich:**
   ```
   --
   FreyAI Visions — Jonas Glawion
   Grabenstraße 135, 63762 Großostheim
   Kleinunternehmer gemäß §19 UStG
   Datenschutz: freyaivisions.de/datenschutz
   Abmelden: Antworten Sie auf diese E-Mail mit "Abmelden"
   ```

## Tonregeln

- **Stimme:** Jonas persönlich — direkt, sachlich, respektvoll. Kein Konzern-Deutsch.
- **Siezen:** Immer "Sie/Ihnen/Ihr". Keine Ausnahmen.
- **Kein Englisch:** Null englische Wörter. Kein "Update", "Feedback", "Tool", "Service", "Follow-up". Deutsch: "Rückmeldung", "Werkzeug", "Dienstleistung", "Nachfass". **Ausnahme:** Produkt- und Paketnamen (z.B. "Professional-Paket", "Enterprise-Paket") sind Eigennamen und von dieser Regel ausgenommen.
- **Kein KI-Geschwätz:** Keine "innovative Lösung", "Potenzial entfalten", "optimieren", "revolutionieren".
- **Premium-Ton:** Selbstbewusst, nie bittstellend. Auch Mahnungen bleiben sachlich-bestimmt.
- **Kürze:** Geschäftsleute lesen keine Romane. Auf den Punkt kommen.

## Mahnungs-Eskalation

| Stufe | Tage überfällig | Ton | Frist |
|-------|----------------|-----|-------|
| Zahlungserinnerung | 0+ | Freundlich-sachlich, "sicher nur übersehen" | 7 Tage |
| 1. Mahnung | 14+ | Bestimmt, dringende Bitte | 7 Tage |
| 2. Mahnung | 28+ | Ernst, Ankündigung gerichtliches Mahnverfahren | 5 Werktage |
| Letzte Mahnung | 42+ | Letzte außergerichtliche Aufforderung, Inkasso-Ankündigung | 3 Werktage |

Beträge immer in deutschem Format: `1.234,56 EUR`.

## Vollständige Vorlagen

### Angebots-Versand

**Betreff:** Ihr Angebot von FreyAI Visions — [ANG-ID]

```
Sehr geehrte/r [Anrede] [Nachname],

anbei erhalten Sie Ihr Angebot [ANG-ID] über [Betrag] EUR für [Leistungsbeschreibung].

Gemäß §19 UStG wird keine Umsatzsteuer berechnet.

Das Angebot ist 30 Tage gültig. Für Rückfragen stehe ich Ihnen jederzeit zur Verfügung.
Sobald Sie das Angebot annehmen möchten, genügt eine kurze Rückmeldung — ich kümmere mich um alles Weitere.

Mit freundlichen Grüßen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de

--
FreyAI Visions — Jonas Glawion
Grabenstraße 135, 63762 Großostheim
Kleinunternehmer gemäß §19 UStG
Datenschutz: freyaivisions.de/datenschutz
Abmelden: Antworten Sie auf diese E-Mail mit "Abmelden"
```

### Zahlungserinnerung

**Betreff:** Zahlungserinnerung — Rechnung [RE-ID]

```
Sehr geehrte/r [Anrede] [Nachname],

wir möchten Sie freundlich daran erinnern, dass Rechnung [RE-ID] über [Betrag] EUR
am [Fälligkeitsdatum] fällig war.

Möglicherweise hat die Zahlung unsere Bank noch nicht erreicht oder ist in der Post
unterwegs — dann betrachten Sie diese Erinnerung bitte als gegenstandslos.

Falls die Zahlung noch aussteht, bitten wir Sie, den Betrag bis zum [Datum + 7 Tage]
zu begleichen.

Mit freundlichen Grüßen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de

--
FreyAI Visions — Jonas Glawion
Grabenstraße 135, 63762 Großostheim
Kleinunternehmer gemäß §19 UStG
Datenschutz: freyaivisions.de/datenschutz
Abmelden: Antworten Sie auf diese E-Mail mit "Abmelden"
```

### 2. Mahnung

**Betreff:** 2. Mahnung — Rechnung [RE-ID]

```
Sehr geehrte/r [Anrede] [Nachname],

trotz unserer vorherigen Mahnung ist der Betrag über [Betrag] EUR aus Rechnung [RE-ID]
bis heute nicht bei uns eingegangen.

Wir fordern Sie hiermit letztmalig auf, den ausstehenden Betrag bis zum
[Datum + 5 Werktage] auf unser Konto zu überweisen.

Sollte die Zahlung bis zu diesem Termin nicht eingehen, sind wir gezwungen,
ein gerichtliches Mahnverfahren einzuleiten. Die daraus entstehenden Kosten
gehen zu Ihren Lasten.

Mit freundlichen Grüßen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de

--
FreyAI Visions — Jonas Glawion
Grabenstraße 135, 63762 Großostheim
Kleinunternehmer gemäß §19 UStG
Datenschutz: freyaivisions.de/datenschutz
Abmelden: Antworten Sie auf diese E-Mail mit "Abmelden"
```

### Willkommens-Mail (nach Onboarding)

**Betreff:** Willkommen bei FreyAI Visions

```
Sehr geehrte/r [Anrede] [Nachname],

herzlich willkommen — Ihr [Paketname] ist eingerichtet und bereit.

In den nächsten Tagen erhalten Sie von mir eine persönliche Einführung in Ihr System.
Bis dahin können Sie sich bereits einloggen und einen ersten Blick werfen.

Ihre Zugangsdaten:
Adresse: app.freyaivisions.de
Benutzername: [E-Mail-Adresse]

Bei Fragen melden Sie sich jederzeit — per E-Mail oder telefonisch.

Mit freundlichen Grüßen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de

--
FreyAI Visions — Jonas Glawion
Grabenstraße 135, 63762 Großostheim
Kleinunternehmer gemäß §19 UStG
Datenschutz: freyaivisions.de/datenschutz
Abmelden: Antworten Sie auf diese E-Mail mit "Abmelden"
```

## Qualitätsprüfung

Bei Angeboten/Rechnungen immer einfügen: "Gemäß §19 UStG wird keine Umsatzsteuer berechnet."

Vor dem Absenden jede E-Mail prüfen:

- [ ] Empfängername korrekt geschrieben
- [ ] Referenznummer (ANG-/AUF-/RE-ID) im Betreff wenn zutreffend
- [ ] Betrag korrekt formatiert (deutsches Format, EUR)
- [ ] Frist genannt (bei Mahnungen/Zahlungserinnerungen)
- [ ] Gültigkeitszeitraum bei Angeboten (30 Tage)
- [ ] Klare Handlungsaufforderung (nächste Schritte für Empfänger)
- [ ] Signatur vollständig (Name, Firma, E-Mail, +49 163 6727787, Web)
- [ ] Rechtlicher Fußbereich vorhanden (Adresse, §19, Datenschutz, Abmelden)
- [ ] Null englische Wörter (Ausnahme: Produkt-/Paketnamen als Eigennamen)
- [ ] Kein KI-Geschwätz
- [ ] Siezen durchgängig
- [ ] DSGVO-konform (Abmeldemöglichkeit, Absender-Identität)
