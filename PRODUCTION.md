# Production Deployment Guide
**Projekt:** Local-Business-Automizer v2.0
**Status:** ✅ Production Ready
**Datum:** 2026-02-14

## Quick Start

Production Build ist fertig im `./dist` Ordner.

### Option 1: Netlify (Empfohlen - Einfachst)
1. Gehe zu [netlify.app](https://app.netlify.com)
2. Drag & Drop den `dist` Ordner
3. Fertig! URL: https://deine-app.netlify.app

### Option 2: Raspberry Pi (Lokales Netzwerk)
```bash
# Von diesem PC aus:
scp -r dist/* pi@raspberrypi.local:/var/www/html/

# Oder siehe: raspberry-pi-setup.md
```

### Option 3: Apache/XAMPP (Lokaler Server)
1. Kopiere `dist/*` nach `C:\xampp\htdocs\mhs`
2. Öffne http://localhost/mhs

## Was ist im Production Build?

```
dist/
├── index.html              # Haupt-HTML
├── manifest.json           # PWA Manifest
├── service-worker.js       # Offline Support
├── .htaccess              # Apache Security Headers
├── netlify.toml           # Netlify Config
├── css/                   # Alle Styles
├── js/
│   ├── services/          # 48+ Service Module
│   ├── ui/               # UI Components
│   ├── app.js            # Main App
│   ├── features-integration.js
│   └── ...
└── config/               # n8n Workflow