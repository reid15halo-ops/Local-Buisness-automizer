# FreyAI Visions — Hostinger Upload-Anleitung
**freyaivisions.de**

## Schritt-für-Schritt: Dateien hochladen

### 1. Hostinger File Manager öffnen
1. Login unter https://hpanel.hostinger.com
2. Gehe zu **Webseiten** → **Verwalten** → **Dateien** → **File Manager**
3. Navigiere ins Root-Verzeichnis: `public_html/`

### 2. Alle Dateien aus DIESEM Ordner hochladen

Lade die komplette Ordnerstruktur in `public_html/` hoch:

```
public_html/
├── index.html          ← Landing Page (Startseite)
├── booking.html        ← Terminbuchung
├── manifest.json       ← PWA-Manifest
├── favicon.ico
├── favicon-32x32.png
├── favicon.png
├── apple-touch-icon.png
├── css/
│   └── fonts.css
├── fonts/
│   ├── inter-latin.woff2
│   └── inter-latin-ext.woff2
├── js/
│   └── services/
│       └── booking-service.js
└── icons/
    ├── icon-192x192.png
    ├── icon-192x192-maskable.png
    ├── icon-512x512.png
    └── icon-512x512-maskable.png
```

### 3. Im Hostinger File Manager

**Option A — Zip hochladen (schneller):**
1. Alle Dateien in diesem Ordner als ZIP komprimieren
2. Im File Manager auf **Upload** klicken → ZIP hochladen
3. ZIP-Datei im File Manager auswählen → **Entpacken**
4. Sicherstellen, dass alle Dateien direkt in `public_html/` liegen (nicht in einem Unterordner)

**Option B — Einzeln hochladen:**
1. Ordner `css/`, `fonts/`, `js/`, `icons/` zuerst erstellen
2. Dann Dateien in die jeweiligen Ordner hochladen

### 4. Testen

Nach dem Upload:
- `https://freyaivisions.de/` → Landing Page
- `https://freyaivisions.de/booking.html` → Terminbuchung

---

## Wichtige Hinweise

### SSL-Zertifikat
Stelle sicher, dass SSL/HTTPS für freyaivisions.de aktiv ist:
**Hostinger → Security → SSL** → Let's Encrypt aktivieren

### DNS
Falls die Domain noch nicht verbunden ist:
**Hostinger → Domains → freyaivisions.de → DNS Records**

---

## Was die Seite enthält

| Seite | Inhalt |
|---|---|
| `index.html` | Landing Page mit Problem-Sektion, Workflow, Features, Beta-Angebot, 3-Tier-Preise, Garantien, CTA |
| `booking.html` | Online-Terminbuchung (4 Schritte: Service → Datum → Daten → Bestätigung) |

### Buchungsarten auf der Terminseite:
- Erstberatung (kostenlos, 60 Min.)
- Digital-Audit (kostenlos, 90 Min.)
- Produktdemo Video-Call (45 Min.)
- Onboarding-Termin (120 Min.)

### Beta-Angebot auf der Startseite:
- 30% Rabatt auf alle Setup-Pakete
- 1. Monat Retainer gratis
- Kostenloser Digital-Audit (Wert 490-890€)
- 30 Tage Geld-zurück-Garantie
- Fortschrittsbalken: "9 von 10 Plätzen verfügbar"

---

*© 2026 FreyAI Visions — Jonas Frey*
