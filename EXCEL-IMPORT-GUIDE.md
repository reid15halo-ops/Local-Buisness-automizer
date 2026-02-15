# Excel/CSV Import - Benutzer-Anleitung

## Übersicht

Das Excel Recognition Tool ermöglicht den intelligenten Import von Kunden und Materialien aus Excel/CSV-Dateien.

## Features

### 🎯 Intelligentes Spalten-Mapping
- Automatische Erkennung von Spalten (Name, Email, Telefon, etc.)
- Unterstützt verschiedene Sprachvarianten (z.B. "E-Mail", "email", "Mail")
- Gespeicherte Mappings für Wiederverwendung

### ✅ Datenvalidierung
- Email-Validierung (Regex)
- Telefonnummern-Normalisierung (automatisch +49 für deutsche Nummern)
- Datums-Parsing (DD.MM.YYYY, YYYY-MM-DD)
- Währungsbeträge (€, EUR, Komma/Punkt)
- PLZ-Validierung (5-stellig)

### 🔍 Duplikat-Erkennung
- **Kunden:** Nach Email, Telefon, Name+Firma
- **Material:** Nach Artikelnummer

### 📊 Batch-Processing
- Import in Batches (100 Zeilen pro Batch)
- Nicht blockierend (async/await)
- Fortschrittsanzeige

## Workflow (4 Schritte)

### Schritt 1: Datei hochladen
1. Navigiere zu "Kunden" oder "Material"
2. Klicke auf "Excel/CSV Import"
3. Wähle Datei oder ziehe sie in den Upload-Bereich
4. Unterstützte Formate: `.xlsx`, `.xls`, `.csv`

**Beispiel CSV:**
```csv
Name;Firma;E-Mail;Telefon
Max Mustermann;Mustermann GmbH;max@test.de;0151 12345678
```

### Schritt 2: Spalten zuordnen
- Automatisches Mapping basierend auf Spaltennamen
- Manuelle Anpassung möglich
- Pflichtfelder sind markiert mit *
- Preview der Daten

**Mapping-Optionen:**
- Name (Pflicht für Kunden)
- Bezeichnung (Pflicht für Material)
- Email, Telefon, Mobil
- Adresse (Straße, PLZ, Ort)
- Preis, VK-Preis, Bestand (Material)

### Schritt 3: Validierung
- Automatische Datenprüfung
- Anzeige von Fehlern und Warnungen
- Fehlerhafte Zeilen werden angezeigt

**Validierungs-Regeln:**
- ✅ Pflichtfelder müssen ausgefüllt sein
- ✅ Email-Format muss gültig sein
- ⚠️ Ungültige Emails werden als Warnung angezeigt
- ⚠️ Telefonnummern werden normalisiert
- ⚠️ Preise werden auf 2 Dezimalstellen gerundet

**Import-Optionen:**
- ☑️ Duplikate überspringen (Standard)
- ☐ Bestehende Einträge aktualisieren

### Schritt 4: Import
- Automatischer Import mit Fortschrittsanzeige
- Zusammenfassung:
  - Neu importiert
  - Aktualisiert
  - Übersprungen (Duplikate)
  - Fehler

## Unterstützte Datentypen

### Kunden
**Pflichtfelder:**
- Name

**Optionale Felder:**
- Email
- Telefon
- Mobil
- Firma
- Straße
- PLZ
- Ort

**Spalten-Varianten:**
- Name: `name`, `kundenname`, `kunde`, `ansprechpartner`
- Email: `email`, `e-mail`, `mail`, `emailadresse`
- Telefon: `telefon`, `tel`, `phone`, `fon`
- PLZ: `plz`, `postleitzahl`, `zip`

### Material
**Pflichtfelder:**
- Bezeichnung

**Optionale Felder:**
- Artikelnummer
- Kategorie
- Einheit
- Preis (EK-Preis)
- VK-Preis
- Bestand
- Mindestbestand
- Lieferant

**Spalten-Varianten:**
- Artikelnummer: `artikelnummer`, `art.nr.`, `sku`
- Bezeichnung: `bezeichnung`, `beschreibung`, `name`, `artikel`
- Preis: `preis`, `ek-preis`, `einzelpreis`
- Bestand: `bestand`, `lagerbestand`, `menge`, `stock`

## Beispiel-Dateien

### Kunden CSV
```csv
Name;Firma;E-Mail;Telefon;Straße;PLZ;Ort
Max Mustermann;Mustermann GmbH;max@mustermann.de;0151 12345678;Musterstraße 1;12345;Musterstadt
Anna Schmidt;Schmidt & Co;anna.schmidt@example.com;030 98765432;Hauptstraße 42;10115;Berlin
```

### Material CSV
```csv
Artikelnummer;Bezeichnung;Kategorie;Preis;VK-Preis;Bestand;Einheit
ST-001;Stahlträger IPE 100;Stahlträger;12.50;18.00;50;m
RR-001;Rechteckrohr 50x50x3;Rohre;8.50;12.00;120;m
```

## Fehlerbehebung

### Problem: "Datei enthält keine Daten"
**Lösung:**
- Prüfe, ob die Datei Header-Zeile hat
- Stelle sicher, dass mindestens 1 Datenzeile vorhanden ist

### Problem: "Pflichtfeld fehlt"
**Lösung:**
- Kunden: Name-Spalte muss vorhanden sein
- Material: Bezeichnung-Spalte muss vorhanden sein
- Prüfe Spalten-Mapping in Schritt 2

### Problem: "Ungültige E-Mail"
**Lösung:**
- Format: `name@domain.de`
- Wird als Warnung angezeigt, Import erfolgt trotzdem

### Problem: "Duplikat gefunden"
**Lösung:**
- Option "Duplikate überspringen" aktivieren
- ODER Option "Bestehende Einträge aktualisieren" aktivieren

## Best Practices

### CSV-Format
- Delimiter: `;` (Semikolon) oder `,` (Komma)
- Encoding: UTF-8
- Erste Zeile: Header mit Spaltennamen

### Datenqualität
- Verwende eindeutige Artikelnummern (Material)
- Fülle Email-Adressen aus (Kunden)
- Formatiere Telefonnummern einheitlich
- Verwende korrekte PLZ (5-stellig)

### Performance
- Große Dateien (>1000 Zeilen): Import erfolgt in Batches
- Wird automatisch nicht-blockierend durchgeführt
- Fortschrittsanzeige zeigt aktuellen Status

## Technische Details

### Unterstützte Formate
- **Excel:** `.xlsx`, `.xls` (via SheetJS)
- **CSV:** `.csv` (Semikolon oder Komma)

### Browser-Kompatibilität
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

### Datenschutz
- Import erfolgt komplett lokal im Browser
- Keine Server-Übertragung
- Daten werden in localStorage gespeichert

## Keyboard-Shortcuts

- `Esc`: Wizard schließen
- `Enter`: Nächster Schritt (wenn verfügbar)

## Support

Bei Problemen:
1. Browser-Konsole öffnen (F12)
2. Fehler-Meldungen prüfen
3. Test-Dateien im `/test-data` Ordner verwenden
