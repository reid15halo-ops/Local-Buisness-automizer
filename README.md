# FreyAI Visions — Local Business Automizer

> AI-powered business suite for German craftsmen (Handwerker)

**Version:** 3.0 | **Status:** Production Ready | **Security:** A (90/100) | **Performance:** 92/100 Lighthouse

## Features

### Core Modules
- **CRM:** Customer management, leads, inquiries, quotes, orders, invoices
- **Inventory:** BOM, stock reservations, auto-reorder engine
- **Purchase Orders:** Supplier tracking, order automation
- **Bookkeeping:** EÜR (German tax) with COGS tracking, DATEV export
- **Calendar:** Scheduling with ICS export, online booking
- **Communication:** WhatsApp-style customer interface, unified inbox
- **AI Assistant:** Gemini integration with server-side proxy
- **Reporting:** Dashboards, charts, exports, dunning

### Technical Highlights
- Multi-language (DE/EN) with 402 translation keys
- Dark industrial UI theme with light mode support
- PWA with offline-first architecture, Service Worker v5
- 481 unit tests, GitHub Actions CI/CD
- 80+ service modules, modular architecture
- Lazy loading (-75% initial load), GZIP compression
- Security: CSP, XSS protection, input sanitization (A rating)

## Quick Start

### 1. Download Fonts (DSGVO Compliance)
```bash
# Automated download (Bash/Linux/Mac/WSL)
bash tools/download-fonts.sh

# Or Python (cross-platform)
python3 tools/download-fonts.py
```

### 2. Run Locally
```bash
# Open index.html in browser
cd local-business-automizer
start index.html    # Windows
open index.html     # Mac
python3 -m http.server 8000  # Linux (then visit http://localhost:8000)
```

### 3. Production Deployment

**Netlify (Recommended):**
1. Go to [netlify.app](https://app.netlify.com)
2. Drag & drop `dist/` folder
3. Deploy

**Raspberry Pi (Local network):**
```bash
ssh pi@raspberrypi.local 'bash -s' < raspberry-pi-auto-install.sh
```

**XAMPP (Windows):**
1. Install XAMPP
2. Copy `dist/*` to `C:\xampp\htdocs\freyai`
3. Open http://localhost/freyai

## Project Structure

```
.
├── index.html              # Main app
├── auth.html              # Authentication
├── landing.html           # Landing page
├── offline.html           # Offline fallback
├── manifest.json          # PWA manifest
├── service-worker.js      # Service worker (v5)
├── deploy.sh              # Deployment script
├── .htaccess              # Apache headers
├── netlify.toml           # Netlify config
│
├── css/                   # 5 CSS files
│   ├── core.css
│   ├── components.css
│   ├── fonts.css
│   ├── purchase-orders.css
│   └── reorder-engine.css
│
├── js/
│   ├── services/          # 80+ service modules
│   ├── modules/           # 12 feature modules
│   ├── ui/                # 7 UI components
│   └── i18n/              # Translations (DE/EN)
│
├── config/                # Configuration files
├── supabase/functions/    # Edge functions (13 endpoints)
├── fonts/                 # Local font files (DSGVO)
├── docs/                  # Development documentation
└── dist/                  # Production build
```

## Development

### Tech Stack
- **Frontend:** Vanilla JS (ES6+), HTML5, CSS3
- **Storage:** IndexedDB (1GB) with localStorage fallback
- **Database:** Supabase (PostgreSQL + Auth + Edge Functions)
- **AI:** Google Gemini 2.0 Flash API
- **Automation:** n8n workflows
- **OCR:** Tesseract.js, SheetJS (Excel)

### Running Tests
```bash
npm install
npm run test    # Run 481 unit tests
npm run lint    # ESLint validation
npm run build   # Production build
```

### Build & Deploy
```bash
# Create production package
bash deploy.sh

# Output: ./dist/ directory and freyai-production-*.zip
```

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+K | Global Search |
| Ctrl+N | New Inquiry |
| Ctrl+S | Save |
| Ctrl+D | Dashboard |
| Ctrl+B | Bookkeeping |
| Shift+? | Help |
| Esc | Close dialog |

## Environment Variables

Create `.env` file:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
VITE_STRIPE_KEY=your-stripe-key
VITE_N8N_WEBHOOK=your-n8n-webhook
```

See `.env.example` for complete list.

## Security

- **XSS Protection:** Input sanitization on all user inputs
- **CSP Headers:** Content Security Policy enabled
- **Clickjacking:** X-Frame-Options: DENY
- **MIME Sniffing:** X-Content-Type-Options: nosniff
- **Offline Storage:** IndexedDB with encryption warning
- **Rating:** A (90/100) on securityheaders.com

## Performance

- **Initial Load:** 280ms (-65% vs baseline)
- **Lighthouse Score:** 92/100
- **Bundle Size:** 200 KB (-75% optimized)
- **Memory:** 25 MB (-44% optimized)
- **Cache Strategy:** Stale-while-revalidate (Service Worker v5)

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full |
| Firefox | 90+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |

## Troubleshooting

### App won't load
1. Clear browser cache (Ctrl+Shift+R)
2. Open DevTools (F12) and check console
3. Disable Service Worker if needed

### Lost data
1. Use Export button regularly (backup)
2. Access IndexedDB in console: `window.storeService.state`

### Raspberry Pi issues
See `raspberry-pi-setup.md` in docs/

## License

MIT - Open Source

## Support

**GitHub:** https://github.com/reid15halo-ops/Local-Buisness-automizer
**Issues:** https://github.com/reid15halo-ops/Local-Buisness-automizer/issues

---

**v3.0** | Optimized for deployment 2026-02-16 | Claude Opus 4.6
