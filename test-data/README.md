# Test-Daten für Excel Import

Diese Testdateien können verwendet werden, um den Excel/CSV-Import zu testen.

## Kunden-Import

**Datei:** `kunden-import-test.csv`

**Enthält:**
- 5 Testkunden
- Verschiedene Formate (mit/ohne Firma)
- Telefonnummern in verschiedenen Formaten

**Spalten:**
- Name (Pflicht)
- Firma
- E-Mail
- Telefon
- Straße
- PLZ
- Ort

## Material-Import

**Datei:** `material-import-test.csv`

**Enthält:**
- 7 Test-Materialien
- Verschiedene Kategorien (Stahlträger, Rohre, Bleche, etc.)
- Preise mit/ohne VK-Preis

**Spalten:**
- Artikelnummer
- Bezeichnung (Pflicht)
- Kategorie
- Preis
- VK-Preis
- Bestand
- Einheit
- Lieferant

## Import-Anleitung

1. Öffne die App im Browser
2. Navigiere zu "Kunden" oder "Material"
3. Klicke auf "Excel/CSV Import"
4. Wähle die entsprechende Test-CSV-Datei
5. Folge dem 4-Schritt-Wizard:
   - Schritt 1: Datei hochgeladen
   - Schritt 2: Spalten werden automatisch zugeordnet
   - Schritt 3: Validierung prüft die Daten
   - Schritt 4: Import wird durchgeführt

## Features

- **Intelligentes Mapping:** Spalten werden automatisch erkannt
- **Validierung:** E-Mail, Telefon, Preise werden geprüft
- **Duplikaterkennung:** Verhindert doppelte Einträge
- **Fehlerbehandlung:** Ungültige Einträge werden angezeigt
- **Batch-Processing:** Import erfolgt in Batches (nicht blockierend)
