---
name: FreyAI Visions Development
description: Guidelines for developing the FreyAI Visions small business automation tool
---

# FreyAI Visions Development Skill

## Quick Start

This is a **German small business automation tool** with 22 service modules. Key files:

- `index.html` - Main app entry
- `js/app.js` - Core logic & state
- `js/features-integration.js` - View renderers
- `js/services/` - All business logic modules
- `css/styles.css` - Dark theme styles

## Critical Rules

1. **Always German UI** - Use German text, `de-DE` formatting
2. **Service pattern** - Extend `window.xxxService` classes
3. **localStorage** - Prefix with `freyai_`, call `save()` after mutations
4. **CSS variables** - Use existing theme variables
5. **Script order** - Services before `features-integration.js` before `app.js`

## Key Workflow

```
Anfrage → Angebot → Auftrag → Rechnung → Mahnung
(Quote)  (Offer)   (Order)   (Invoice)  (Dunning)
```

## Add New Feature

1. Create `js/services/xxx-service.js`
2. Add `<script src="js/services/xxx-service.js">` to index.html **before** `features-integration.js`
3. Add nav button + view section in index.html
4. Add render/init functions in `features-integration.js`
5. Add CSS in `css/styles.css`

## Service Access

```javascript
window.chatbotService          // AI WhatsApp bot
window.customerService         // CRM
window.taskService             // Kanban tasks
window.calendarService         // Appointments
window.bookkeepingService      // EÜR, DATEV — berechneEUR(year), berechneUStVA(year, month, quarter)
window.leadService             // Sales pipeline
window.approvalService         // Workflows
window.cashFlowService         // Forecasting
window.periodicReportService   // Weekly/Monthly/Quarterly/Yearly reports with charts
```

## Periodic Reports Pattern

`PeriodicReportService` (`js/services/periodic-report-service.js`) generates auto-dated reports:

```javascript
const svc = window.periodicReportService;

const report = svc.generateWeekly();    // last 7 days
const report = svc.generateMonthly();   // last calendar month
const report = svc.generateQuarterly(); // last full quarter
const report = svc.generateYearly();    // last calendar year

// Render HTML into DOM, then draw Chart.js charts
outputEl.innerHTML = svc.renderHTML(report);
requestAnimationFrame(() => svc.renderCharts(report));

// CSV download
svc.downloadCSV('weekly' | 'monthly' | 'quarterly' | 'yearly');
```

Each report contains: KPI cards (`report.kpis`), `report.rev` (revenue stats),
`report.topCustomers`, `report.expenses`, `report.income`, `report.totalExp`.
Charts are drawn on `<canvas id="pr-chart-{type}-{name}">` elements placed by `renderHTML()`.

## Chart.js Pattern

Chart.js is loaded lazily. Always use `ensureChartJS()` before rendering charts:

```javascript
await ensureChartJS();          // defined in features-integration.js
outputEl.innerHTML = html;      // put canvases in DOM first
requestAnimationFrame(() => {   // then draw — canvas must be visible
    svc.renderCharts(report);
});
```

## CSS Classes for Reports

```
.pr-wrap         — outer report wrapper
.pr-header       — title + period + badge row
.pr-kpi-row      — grid of KPI cards
.pr-kpi          — single KPI card
.pr-kpi-value.green / .yellow / .red / .blue — coloured values
.pr-section      — titled content block
.pr-table        — data table
.pr-chart-wrap   — chart canvas container
.pr-chart-row.cols-2 / .cols-1 — side-by-side or full-width chart rows
```

## Testing

Open `index.html` in browser, check console (F12) for errors.

## See Also

- `.agent/workflows/ai-development-guide.md` - Full documentation
- `docs/SmallBusinessAutomationTool_FeaturePlan.md` - 30 feature plan
- `docs/FeatureComparison.md` - Implementation status
