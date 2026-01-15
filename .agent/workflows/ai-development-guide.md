# MHS Workflow Automation Tool - AI Development Guide

## Project Overview

**MHS Workflow Demo** is a comprehensive small business automation tool for German craftsmen and service providers (Handwerker). It automates the complete quote-to-invoice workflow and provides 21+ service modules for business operations.

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
│       ├── report-service.js       # Report generation
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
| Storage | localStorage with `mhs_` prefix |
| AI | Google Gemini 2.0 Flash API |
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
        this.data = JSON.parse(localStorage.getItem('mhs_example') || '[]');
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
        localStorage.setItem('mhs_example', JSON.stringify(this.data));
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

---

## Adding New Features

### 1. Create Service File
```javascript
// js/services/new-feature-service.js
class NewFeatureService {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('mhs_newfeature') || '[]');
    }
    // ... methods
    save() { localStorage.setItem('mhs_newfeature', JSON.stringify(this.data)); }
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
4. **Analytics Dashboard**
   - Interactive charts (Chart.js or D3)
   - KPI tracking widgets
   - Year-over-year comparisons

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

*Last Updated: 2026-01-15*
*Version: 2.0 (21 services)*
