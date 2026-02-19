# FreyAI Visions Automation Tool - AI Development Guide

## Project Overview

**FreyAI Visions Demo** is a comprehensive small business automation tool for German craftsmen and service providers (Handwerker). It automates the complete quote-to-invoice workflow and provides 22+ service modules for business operations.

---

## Architecture

```
📁 Automation/
├── index.html                 # Single-page app entry point
├── 📁 css/
│   └── styles.css             # All styles (dark theme, modern UI)
├── 📁 js/
│   ├── app.js                 # Core app logic, navigation, state
│   ├── features-integration.js # Render functions for new views
│   └── 📁 services/           # 21 modular service files
│       ├── gemini-service.js       # AI (Gemini API)
│       ├── chatbot-service.js      # WhatsApp AI chatbot
│       ├── email-service.js        # Email parsing
│       ├── task-service.js         # Kanban tasks
│       ├── customer-service.js     # CRM
│       ├── calendar-service.js     # Appointments
│       ├── booking-service.js      # Customer self-booking
│       ├── timetracking-service.js # Clock in/out
│       ├── document-service.js     # OCR scanning
│       ├── report-service.js       # Ad-hoc report generation (date-range)
│       ├── periodic-report-service.js # Weekly/Monthly/Quarterly/Yearly reports + charts
│       ├── bookkeeping-service.js  # EÜR, DATEV
│       ├── dunning-service.js      # Payment reminders
│       ├── material-service.js     # Inventory
│       ├── communication-service.js # Unified messaging
│       ├── phone-service.js        # Click-to-call
│       ├── cashflow-service.js     # Forecasting
│       ├── lead-service.js         # Sales pipeline
│       ├── version-control-service.js # Document history
│       ├── approval-service.js     # Multi-step approvals
│       ├── print-digital-service.js # Paper migration
│       └── work-estimation-service.js # AI hour estimation
│           # 22 services total
├── 📁 config/
│   └── n8n-workflow.json      # n8n automation workflow
└── 📁 docs/
    ├── SmallBusinessAutomationTool_FeaturePlan.md
    └── FeatureComparison.md
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML5, CSS3, JavaScript ES6+ |
| Styling | Custom CSS with CSS variables (dark theme) |
| Storage | localStorage with `freyai_` prefix |
| AI | Google Gemini 2.0 Flash API |
| Charts | Chart.js 4.4.7 (loaded lazily via CDN) |
| OCR | Tesseract.js (via CDN) |
| Excel | SheetJS (via CDN) |
| Automation | n8n (external) |
| Localization | German (de-DE) |

---

## Code Patterns & Conventions

### Service Class Pattern
All services follow this structure:
```javascript
class ExampleService {
    constructor() {
        // Load from localStorage
        this.data = JSON.parse(localStorage.getItem('freyai_example') || '[]');
        // Initialize settings/defaults
    }

    // CRUD operations
    add(item) { /* ... */ this.save(); return item; }
    update(id, updates) { /* ... */ this.save(); }
    delete(id) { /* ... */ this.save(); }
    getAll() { return this.data; }
    getById(id) { return this.data.find(x => x.id === id); }

    // Business logic methods
    calculate...() { }
    generate...() { }
    
    // Persistence
    save() {
        localStorage.setItem('freyai_example', JSON.stringify(this.data));
    }
}

window.exampleService = new ExampleService();
```

### ID Generation
```javascript
generateId() {
    return 'prefix-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}
```

### German Localization
- All UI text in German
- Date format: `de-DE` (DD.MM.YYYY)
- Currency: EUR with `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`
- Time format: 24-hour

### CSS Variables (Dark Theme)
```css
--bg-primary: #0f172a;
--bg-card: #1e293b;
--text-primary: #f1f5f9;
--accent-primary: #6366f1;
--accent-success: #22c55e;
--accent-warning: #f59e0b;
--accent-danger: #ef4444;
```

### Chart.js Pattern (Lazy Load + Dark Theme)

Chart.js is loaded on first use via `ensureChartJS()` (defined in `features-integration.js`).
Always insert canvas HTML into the DOM **before** calling `new Chart()`:

```javascript
// 1. Ensure library is loaded
await ensureChartJS();

// 2. Put canvas in DOM
outputEl.innerHTML = `<canvas id="my-chart" height="260"></canvas>`;

// 3. Draw after paint — chart reads canvas dimensions at render time
requestAnimationFrame(() => {
    new window.Chart(document.getElementById('my-chart'), {
        type: 'bar',
        data: { labels: [...], datasets: [{ data: [...], backgroundColor: '#6366f1', borderRadius: 4 }] },
        options: {
            plugins: { legend: { labels: { color: '#a1a1aa' } } },
            scales: {
                x: { ticks: { color: '#71717a' }, grid: { color: '#ffffff08' } },
                y: { ticks: { color: '#71717a' }, grid: { color: '#ffffff08' } }
            }
        }
    });
});
```

**Palette for multi-series charts:**
```javascript
['#6366f1','#22c55e','#f59e0b','#60a5fa','#a78bfa','#f472b6','#34d399','#fb923c']
```

### Periodic Report Service Pattern

`PeriodicReportService` auto-dates all four report periods and renders full HTML + Chart.js:

```javascript
const svc = window.periodicReportService;

// Generate (returns structured data object)
const report = svc.generateWeekly();     // last 7 days
const report = svc.generateMonthly();    // last calendar month
const report = svc.generateQuarterly();  // last full quarter (auto-detected)
const report = svc.generateYearly();     // last calendar year

// Render HTML then draw charts
outputEl.innerHTML = svc.renderHTML(report);
requestAnimationFrame(() => svc.renderCharts(report));

// Export
svc.downloadCSV('weekly');  // triggers browser download (.csv, UTF-8 BOM, semicolon-delimited)
```

Charts per report type:
- **Weekly** — Doughnut: Bezahlt / Offen / Ausstehend
- **Monthly** — Doughnut (income vs. expenses) + horizontal bar (top customers)
- **Quarterly** — Grouped bar (month-by-month paid/open) + doughnut (income vs. expenses)
- **Yearly** — Bar (12 months) + bar (4 quarters) + doughnut (expense categories)

---

## Adding New Features

### 1. Create Service File
```javascript
// js/services/new-feature-service.js
class NewFeatureService {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('freyai_newfeature') || '[]');
    }
    // ... methods
    save() { localStorage.setItem('freyai_newfeature', JSON.stringify(this.data)); }
}
window.newFeatureService = new NewFeatureService();
```

### 2. Add Script to index.html
```html
<script src="js/services/new-feature-service.js"></script>
```

### 3. Add Navigation Item (if needed)
```html
<button class="nav-item" data-view="newfeature">
    <span class="nav-icon">🆕</span>
    Neue Funktion
</button>
```

### 4. Add View Section
```html
<section class="view" id="view-newfeature">
    <header class="view-header">
        <h1>🆕 Neue Funktion</h1>
    </header>
    <!-- Content -->
</section>
```

### 5. Add Render Function (features-integration.js)
```javascript
function renderNewFeature() {
    // Update UI from service data
}

function initNewFeature() {
    // Event listeners
}

// Add to switchViewNew:
case 'newfeature': renderNewFeature(); break;

// Add to initNewFeatures:
initNewFeature();
```

### 6. Add CSS Styles (css/styles.css)
```css
/* New Feature Styles */
.newfeature-container { /* ... */ }
```

---

## Improvement Ideas

### High Priority
1. **Real API Integrations**
   - WhatsApp Business API for chatbot
   - DATEV online for bookkeeping
   - Google Calendar API for sync
   - German SMS gateway (sipgate, etc.)

2. **Data Persistence Upgrade**
   - Migrate from localStorage to IndexedDB
   - Add cloud sync option (Firebase, Supabase)
   - Implement proper backup/restore

3. **PWA Capabilities**
   - Add service worker for offline
   - Web push notifications
   - Install prompt

### Medium Priority
4. **Analytics Dashboard** ✅ IMPLEMENTED
   - Periodic reports (weekly/monthly/quarterly/yearly) with Chart.js charts
   - KPI cards, revenue tables, customer rankings, EÜR
   - CSV export and print — see `js/services/periodic-report-service.js`

5. **Multi-User Support**
   - User authentication
   - Role-based permissions
   - Activity logging

6. **Mobile Optimization**
   - Responsive navigation
   - Touch-friendly Kanban
   - Mobile-first calendar

### Lower Priority
7. **Integrations**
   - Zapier/Make webhooks
   - PDF generation library
   - QR code for invoices

8. **AI Enhancements**
   - Voice commands
   - Predictive text for emails
   - Smart categorization

---

## Brainstorming Prompts

When asked to brainstorm, consider:

1. **What manual tasks remain?**
   - Paper forms being filled?
   - Repeated data entry?
   - Manual calculations?

2. **What integrations would help?**
   - Banking APIs (PSD2)?
   - Shipping providers?
   - Supplier catalogs?

3. **What frustrates small businesses?**
   - Late payments → Better dunning
   - No-shows → Deposit system
   - Material waste → Inventory alerts

4. **What's trending in business software?**
   - AI-powered everything
   - Mobile-first
   - Voice interfaces
   - Real-time collaboration

---

## Testing Approach

### Manual Testing Checklist
1. Open `index.html` in browser
2. Check console for errors (F12)
3. Navigate all views
4. Test CRUD operations
5. Verify localStorage persistence (refresh test)
6. Test on mobile viewport

### Service Testing Template
```javascript
// In browser console:
// Test service exists
console.log(window.exampleService);

// Test add
const item = window.exampleService.add({ name: 'Test' });
console.log('Created:', item);

// Test get
console.log('All:', window.exampleService.getAll());

// Test persistence (refresh page, check again)
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Service undefined | Check script order in index.html |
| Styles not loading | Verify path `css/styles.css` |
| Data lost on refresh | Ensure `save()` called after changes |
| Gemini API errors | Check API key in settings |
| Navigation broken | Check `data-view` matches `id="view-XXX"` |

---

## Contact & Context

- **Industry**: German Handwerk (craftsmen, service providers)
- **User Profile**: Non-technical, transitioning from paper
- **Language**: German (formal but friendly)
- **Currency/Tax**: EUR, German VAT (19%/7%)
- **Key Workflow**: Anfrage → Angebot → Auftrag → Rechnung → Mahnung

---

*Last Updated: 2026-02-19*
*Version: 2.1 (22 services — periodic-report-service added)*
