# Metallbau Buchert App — Hostinger Upload-Anleitung
**app.freyaivisions.de**

## Build erstellen

```bash
./deploy-app.sh
```

Das Script erstellt den Ordner `deploy-hostinger-app/` mit allen Dateien.

---

## Hostinger: Subdomain einrichten

### 1. Subdomain erstellen
1. Login unter https://hpanel.hostinger.com
2. **Webseiten** → **freyaivisions.de** → **Verwalten**
3. **Domains** → **Subdomains** → **Subdomain erstellen**
4. Subdomain eingeben: `app`
5. Document Root: `public_html/app` (oder `domains/app.freyaivisions.de/public_html`)
6. **Erstellen** klicken

### 2. SSL aktivieren
1. **Security** → **SSL**
2. SSL für `app.freyaivisions.de` aktivieren (Let's Encrypt)
3. Warten bis Zertifikat aktiv ist (ca. 1-5 Minuten)

### 3. Dateien hochladen

**Option A — ZIP Upload (empfohlen):**
1. `deploy-hostinger-app/` Ordner als ZIP komprimieren
2. Hostinger **File Manager** → zum Document Root der Subdomain navigieren
3. **Upload** → ZIP-Datei hochladen
4. ZIP auswählen → **Entpacken**
5. Sicherstellen, dass `index.html` direkt im Root liegt (nicht in Unterordner)

**Option B — Einzeln hochladen:**
1. Alle Ordner zuerst erstellen: `css/`, `js/`, `fonts/`, `icons/`, `config/`
2. Dateien in die jeweiligen Ordner hochladen
3. `.htaccess` nicht vergessen (versteckte Datei!)

### 4. Testen

Nach dem Upload:
- `https://app.freyaivisions.de/` → Haupt-App (Dashboard)
- `https://app.freyaivisions.de/auth.html` → Login
- `https://app.freyaivisions.de/customer-portal.html` → Kundenportal

---

## Dateistruktur

```
public_html/app/  (oder domains/app.freyaivisions.de/public_html/)
├── .htaccess               ← Security, Caching, SPA-Routing
├── index.html              ← Haupt-App
├── auth.html               ← Login/Register
├── customer-portal.html    ← Kundenportal
├── offline.html            ← Offline-Fallback
├── manifest.json           ← PWA-Manifest
├── service-worker.js       ← PWA Service Worker
├── favicon.ico
├── favicon-32x32.png
├── favicon.png
├── apple-touch-icon.png
├── config/
│   └── app-config.js
├── css/
│   ├── core.css
│   ├── components.css
│   ├── fonts.css
│   └── ... (15 CSS-Dateien)
├── fonts/
│   ├── inter-latin.woff2
│   └── inter-latin-ext.woff2
├── icons/
│   ├── icon-192x192.png
│   ├── icon-192x192-maskable.png
│   ├── icon-512x512.png
│   └── icon-512x512-maskable.png
└── js/
    ├── app-new.js
    ├── init-auth-gate.js
    ├── init-lazy-services.js
    ├── ...
    ├── modules/    (15 Module)
    ├── services/   (108 Services)
    ├── ui/         (23 UI-Komponenten)
    └── i18n/       (Übersetzungen)
```

---

## Wichtige Hinweise

### .htaccess
Die `.htaccess` Datei enthält:
- HTTPS-Erzwingung
- Security Headers (CSP, HSTS, X-Frame-Options)
- Caching (Fonts 1 Jahr, CSS/JS 1 Woche, HTML nie)
- Gzip-Kompression
- SPA-Routing (alle Routen → index.html)
- Blockiert sensible Dateien (.env, .sql, etc.)

### Supabase-Verbindung
Die App verbindet sich automatisch mit Supabase über die Konfiguration in `js/services/supabase-config.js`. Die CORS-Origin `https://app.freyaivisions.de` ist bereits in allen Supabase Edge Functions konfiguriert.

### PWA / Offline
Die App funktioniert als Progressive Web App:
- Kann auf dem Homescreen installiert werden
- Service Worker cached statische Assets
- Offline-Modus zeigt offline.html

---

*Erstellt: 2026-03-03 | Metallbau Buchert*
