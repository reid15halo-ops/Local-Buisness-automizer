---
name: email-templates
description: |
  Create German business email templates for FreyAI Visions customer communication.
  Use this skill when the user asks to write, draft, or send any business email --
  including Angebots-Mail, Auftragsbestaetigung, Rechnungs-Versand, Zahlungserinnerung,
  Mahnung (1./2./3. Mahnung), Willkommens-Mail, Terminbestaetigung, or follow-up emails.
  Also trigger on: "email", "E-Mail", "Mahnung", "Zahlungserinnerung", "Angebots-Mail",
  "Bestaetigung", "Willkommen", "Erinnerung schreiben", "Kundenmail", "Nachfass-Mail",
  "E-Mail-Vorlage", "Rechnung verschicken", "Angebot senden", "Termin bestaetigen",
  "Auftragsbestaetigung", "Stornierung", "Entschuldigung", "Statusbericht".
  This skill enforces brand voice, legal compliance, and consistent structure for all
  outbound emails sent via the VPS email relay (kontakt@freyaivisions.de).
---

# E-Mail-Vorlagen -- FreyAI Visions Geschaeftskorrespondenz

Professional German business emails. Every email sounds like Jonas wrote it -- direct, premium, never corporate-template.

## Absender

- **Von:** Jonas von FreyAI / kontakt@freyaivisions.de
- **Relay:** `send-email` Edge Function -> VPS Email Relay (Port 3100)
- **Payload:** `{ to, subject, body, replyTo?, cc?, bcc?, attachments? }`
- **Attachments:** Base64-encoded, max 10MB total. Common: PDF Angebot, PDF Rechnung.

## Template-Kategorien

| Kategorie | Betreff-Muster | Eskalation |
|-----------|---------------|------------|
| **Angebots-Versand** | Ihr Angebot von FreyAI Visions -- [ANG-ID] | -- |
| **Auftragsbestaetigung** | Auftragsbestaetigung -- [AUF-ID] | -- |
| **Rechnungs-Versand** | Rechnung [RE-ID] -- FreyAI Visions | -- |
| **Zahlungserinnerung** | Zahlungserinnerung -- Rechnung [RE-ID] | Mahnstufe 1 |
| **1. Mahnung** | 1. Mahnung -- Rechnung [RE-ID] | Mahnstufe 2 |
| **2. Mahnung** | 2. Mahnung -- Rechnung [RE-ID] | Mahnstufe 3 |
| **Letzte Mahnung** | Letzte Mahnung -- Rechnung [RE-ID] | Mahnstufe 4 |
| **Willkommen** | Willkommen bei FreyAI Visions | -- |
| **Terminbestaetigung** | Terminbestaetigung -- [Datum] | -- |
| **Nachfass (Follow-up)** | Kurze Rueckmeldung zu [Kontext] | -- |
| **Stornierung** | Stornierung -- [AUF-ID/RE-ID] | -- |
| **Statusbericht** | Monatsbericht [Monat YYYY] -- FreyAI Visions | -- |

## Pflichtstruktur jeder E-Mail

Jede E-Mail folgt diesem Aufbau:

1. **Anrede:** `Sehr geehrte/r [Anrede] [Name],` (immer "Sie", nie "du")
2. **Betreff:** Klar, deutsch, mit Referenznummer wenn vorhanden
3. **Inhalt:** Maximal 3-5 Absaetze. Kurz, konkret, handlungsorientiert.
4. **Handlungsaufforderung:** Was soll der Empfaenger tun? Frist nennen wenn relevant.
5. **Grussformel:** `Mit freundlichen Gruessen` + Leerzeile + Signatur
6. **Signatur:**
   ```
   Jonas Glawion
   FreyAI Visions
   kontakt@freyaivisions.de | +49 163 6727787
   freyaivisions.de
   ```
7. **Rechtlicher Fussbereich:**
   ```
   --
   FreyAI Visions -- Jonas Glawion
   Grabenstrasse 135, 63762 Grossostheim
   Kleinunternehmer gemaess par. 19 UStG
   Datenschutz: freyaivisions.de/datenschutz
   Abmelden: Antworten Sie auf diese E-Mail mit "Abmelden"
   ```

## Tonregeln

- **Stimme:** Jonas persoenlich -- direkt, sachlich, respektvoll. Kein Konzern-Deutsch.
- **Siezen:** Immer "Sie/Ihnen/Ihr". Keine Ausnahmen.
- **Kein Englisch:** Null englische Woerter. Kein "Update", "Feedback", "Tool", "Service", "Follow-up". Deutsch: "Rueckmeldung", "Werkzeug", "Dienstleistung", "Nachfass". **Ausnahme:** Produkt- und Paketnamen (z.B. "Professional-Paket", "Enterprise-Paket") sind Eigennamen.
- **Kein KI-Geschwaetz:** Keine "innovative Loesung", "Potenzial entfalten", "optimieren", "revolutionieren".
- **Premium-Ton:** Selbstbewusst, nie bittstellend. Auch Mahnungen bleiben sachlich-bestimmt.
- **Kuerze:** Geschaeftsleute lesen keine Romane. Auf den Punkt kommen.

## HTML-Template-Struktur

Alle E-Mails werden als HTML gesendet. Grundstruktur:

```html
<!-- Inline CSS only (no external stylesheets, email client compatibility) -->
<div style="max-width:600px; margin:0 auto; font-family:'Segoe UI',Tahoma,sans-serif; color:#e0e0e0; background:#1a1a2e; padding:32px; border-radius:8px;">
  <!-- Header -->
  <div style="border-bottom:2px solid #6c63ff; padding-bottom:16px; margin-bottom:24px;">
    <h2 style="color:#6c63ff; margin:0;">FreyAI Visions</h2>
  </div>
  <!-- Body -->
  <div style="line-height:1.6;">
    <!-- Email content here -->
  </div>
  <!-- Footer -->
  <div style="margin-top:32px; padding-top:16px; border-top:1px solid #333; font-size:12px; color:#888;">
    <!-- Signatur + rechtlicher Fussbereich -->
  </div>
</div>
```

### Positions-Tabelle (fuer Angebote/Rechnungen)
```html
<table style="width:100%; border-collapse:collapse; margin:16px 0;">
  <thead>
    <tr style="background:#2a2a4a; color:#6c63ff;">
      <th style="padding:8px; text-align:left;">Pos.</th>
      <th style="padding:8px; text-align:left;">Beschreibung</th>
      <th style="padding:8px; text-align:right;">Menge</th>
      <th style="padding:8px; text-align:right;">Einzelpreis</th>
      <th style="padding:8px; text-align:right;">Gesamt</th>
    </tr>
  </thead>
  <tbody>
    <!-- Rows with alternating bg: transparent / rgba(255,255,255,0.03) -->
  </tbody>
  <tfoot>
    <tr style="border-top:2px solid #6c63ff; font-weight:bold;">
      <td colspan="4" style="padding:8px;">Gesamtbetrag (netto = brutto)</td>
      <td style="padding:8px; text-align:right;">[Betrag] EUR</td>
    </tr>
  </tfoot>
</table>
```

## Mahnungs-Eskalation

| Stufe | Tage ueberfaellig | Ton | Frist | Gebuehr |
|-------|-------------------|-----|-------|---------|
| Zahlungserinnerung | 0+ | Freundlich-sachlich, "sicher nur uebersehen" | 7 Tage | 0 EUR |
| 1. Mahnung | 14+ | Bestimmt, dringende Bitte | 7 Tage | 0 EUR |
| 2. Mahnung | 28+ | Ernst, Ankuendigung gerichtliches Mahnverfahren | 5 Werktage | 5 EUR Mahngebuehr |
| Letzte Mahnung | 42+ | Letzte aussergerichtliche Aufforderung, Inkasso-Ankuendigung | 3 Werktage | 10 EUR Mahngebuehr |

Betraege immer in deutschem Format: `1.234,56 EUR`.

## Vollstaendige Vorlagen

### Angebots-Versand

**Betreff:** Ihr Angebot von FreyAI Visions -- [ANG-ID]

```
Sehr geehrte/r [Anrede] [Nachname],

anbei erhalten Sie Ihr Angebot [ANG-ID] ueber [Betrag] EUR fuer [Leistungsbeschreibung].

Gemaess par. 19 UStG wird keine Umsatzsteuer berechnet.

Das Angebot ist 30 Tage gueltig. Fuer Rueckfragen stehe ich Ihnen jederzeit zur Verfuegung.
Sobald Sie das Angebot annehmen moechten, genuegt eine kurze Rueckmeldung -- ich kuemmere mich um alles Weitere.

Mit freundlichen Gruessen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de
```

### Auftragsbestaetigung

**Betreff:** Auftragsbestaetigung -- [AUF-ID]

```
Sehr geehrte/r [Anrede] [Nachname],

vielen Dank fuer Ihr Vertrauen. Hiermit bestaetigen wir Ihren Auftrag [AUF-ID]
ueber [Leistungsbeschreibung] zum Gesamtbetrag von [Betrag] EUR.

Naechste Schritte:
- Einrichtung Ihres Systems innerhalb von [X] Werktagen
- Persoenliche Einfuehrung per Videoanruf
- Zugangsdaten per separater E-Mail

Bei Fragen melden Sie sich jederzeit.

Mit freundlichen Gruessen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de
```

### Zahlungserinnerung

**Betreff:** Zahlungserinnerung -- Rechnung [RE-ID]

```
Sehr geehrte/r [Anrede] [Nachname],

wir moechten Sie freundlich daran erinnern, dass Rechnung [RE-ID] ueber [Betrag] EUR
am [Faelligkeitsdatum] faellig war.

Moeglicherweise hat die Zahlung unsere Bank noch nicht erreicht oder ist in der Post
unterwegs -- dann betrachten Sie diese Erinnerung bitte als gegenstandslos.

Falls die Zahlung noch aussteht, bitten wir Sie, den Betrag bis zum [Datum + 7 Tage]
zu begleichen.

Mit freundlichen Gruessen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de
```

### 1. Mahnung

**Betreff:** 1. Mahnung -- Rechnung [RE-ID]

```
Sehr geehrte/r [Anrede] [Nachname],

leider konnten wir trotz unserer Zahlungserinnerung vom [Datum Erinnerung] keinen
Zahlungseingang fuer Rechnung [RE-ID] ueber [Betrag] EUR feststellen.

Wir bitten Sie dringend, den ausstehenden Betrag bis zum [Datum + 7 Tage] auf unser
Konto zu ueberweisen.

Unsere Bankverbindung:
IBAN: [IBAN]
BIC: [BIC]
Verwendungszweck: [RE-ID]

Mit freundlichen Gruessen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de
```

### 2. Mahnung

**Betreff:** 2. Mahnung -- Rechnung [RE-ID]

```
Sehr geehrte/r [Anrede] [Nachname],

trotz unserer vorherigen Mahnung ist der Betrag ueber [Betrag] EUR aus Rechnung [RE-ID]
bis heute nicht bei uns eingegangen.

Wir fordern Sie hiermit auf, den ausstehenden Betrag zzgl. 5,00 EUR Mahngebuehr,
insgesamt [Betrag + 5] EUR, bis zum [Datum + 5 Werktage] auf unser Konto zu ueberweisen.

Sollte die Zahlung bis zu diesem Termin nicht eingehen, sind wir gezwungen,
ein gerichtliches Mahnverfahren einzuleiten. Die daraus entstehenden Kosten
gehen zu Ihren Lasten.

Mit freundlichen Gruessen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de
```

### Letzte Mahnung

**Betreff:** Letzte Mahnung -- Rechnung [RE-ID]

```
Sehr geehrte/r [Anrede] [Nachname],

trotz mehrfacher Aufforderung ist Rechnung [RE-ID] ueber [Betrag] EUR bis heute
nicht beglichen worden.

Wir fordern Sie ein letztes Mal auf, den Gesamtbetrag von [Betrag + 10] EUR
(inkl. 10,00 EUR Mahngebuehren) bis zum [Datum + 3 Werktage] zu ueberweisen.

Nach Ablauf dieser Frist werden wir ohne weitere Ankuendigung ein gerichtliches
Mahnverfahren einleiten bzw. die Forderung an ein Inkassounternehmen uebergeben.
Saemtliche daraus entstehenden Kosten gehen zu Ihren Lasten.

Mit freundlichen Gruessen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de
```

### Willkommens-Mail (nach Onboarding)

**Betreff:** Willkommen bei FreyAI Visions

```
Sehr geehrte/r [Anrede] [Nachname],

herzlich willkommen -- Ihr [Paketname] ist eingerichtet und bereit.

In den naechsten Tagen erhalten Sie von mir eine persoenliche Einfuehrung in Ihr System.
Bis dahin koennen Sie sich bereits einloggen und einen ersten Blick werfen.

Ihre Zugangsdaten:
Adresse: app.freyaivisions.de
Benutzername: [E-Mail-Adresse]

Bei Fragen melden Sie sich jederzeit -- per E-Mail oder telefonisch.

Mit freundlichen Gruessen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de
```

### Nachfass-Mail (Follow-up)

**Betreff:** Kurze Rueckmeldung zu Ihrem Angebot [ANG-ID]

```
Sehr geehrte/r [Anrede] [Nachname],

vor einigen Tagen habe ich Ihnen ein Angebot ueber [Leistung] zukommen lassen.
Gibt es noch offene Fragen oder Anpassungswuensche?

Ich stehe Ihnen gerne fuer ein kurzes Gespraech zur Verfuegung.

Mit freundlichen Gruessen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de
```

### Terminbestaetigung

**Betreff:** Terminbestaetigung -- [Datum] um [Uhrzeit]

```
Sehr geehrte/r [Anrede] [Nachname],

hiermit bestaetigen wir Ihren Termin am [Datum] um [Uhrzeit] Uhr.

Thema: [Betreff des Termins]
Ort/Medium: [Vor Ort / Videoanruf / Telefonat]
Dauer: ca. [X] Minuten

Falls Sie den Termin verschieben muessen, geben Sie mir bitte mindestens 24 Stunden
vorher Bescheid.

Mit freundlichen Gruessen

Jonas Glawion
FreyAI Visions
kontakt@freyaivisions.de | +49 163 6727787
freyaivisions.de
```

## Qualitaetspruefung

Bei Angeboten/Rechnungen immer einfuegen: "Gemaess par. 19 UStG wird keine Umsatzsteuer berechnet."

Vor dem Absenden jede E-Mail pruefen:

- [ ] Empfaengername korrekt geschrieben
- [ ] Referenznummer (ANG-/AUF-/RE-ID) im Betreff wenn zutreffend
- [ ] Betrag korrekt formatiert (deutsches Format: 1.234,56 EUR)
- [ ] Frist genannt (bei Mahnungen/Zahlungserinnerungen)
- [ ] Gueltigkeitszeitraum bei Angeboten (30 Tage)
- [ ] Klare Handlungsaufforderung (naechste Schritte fuer Empfaenger)
- [ ] Signatur vollstaendig (Name, Firma, E-Mail, +49 163 6727787, Web)
- [ ] Rechtlicher Fussbereich vorhanden (Adresse, par. 19, Datenschutz, Abmelden)
- [ ] Null englische Woerter (Ausnahme: Produkt-/Paketnamen als Eigennamen)
- [ ] Kein KI-Geschwaetz
- [ ] Siezen durchgaengig
- [ ] DSGVO-konform (Abmeldemöglichkeit, Absender-Identitaet)
- [ ] Mahngebuehren korrekt (0/0/5/10 EUR je Stufe)
- [ ] HTML-Template nutzt inline CSS (keine externen Stylesheets)
- [ ] Dark theme Farbschema (bg: #1a1a2e, accent: #6c63ff, text: #e0e0e0)
