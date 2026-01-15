---
name: MHS Workflow Development
description: Guidelines for developing the MHS small business automation tool
---

# MHS Workflow Development Skill

## Quick Start

This is a **German small business automation tool** with 21 service modules. Key files:

- `index.html` - Main app entry
- `js/app.js` - Core logic & state
- `js/features-integration.js` - View renderers
- `js/services/` - All business logic modules
- `css/styles.css` - Dark theme styles

## Critical Rules

1. **Always German UI** - Use German text, `de-DE` formatting
2. **Service pattern** - Extend `window.xxxService` classes
3. **localStorage** - Prefix with `mhs_`, call `save()` after mutations
4. **CSS variables** - Use existing theme variables
5. **Script order** - Services before `features-integration.js` before `app.js`

## Key Workflow

```
Anfrage → Angebot → Auftrag → Rechnung → Mahnung
(Quote)  (Offer)   (Order)   (Invoice)  (Dunning)
```

## Add New Feature

1. Create `js/services/xxx-service.js`
2. Add `<script src="js/services/xxx-service.js">` to index.html
3. Add nav button + view section in index.html
4. Add render/init functions in `features-integration.js`
5. Add CSS in `css/styles.css`

## Service Access

```javascript
window.chatbotService      // AI WhatsApp bot
window.customerService     // CRM
window.taskService         // Kanban tasks
window.calendarService     // Appointments
window.bookkeepingService  // EÜR, DATEV
window.leadService         // Sales pipeline
window.approvalService     // Workflows
window.cashFlowService     // Forecasting
```

## Testing

Open `index.html` in browser, check console (F12) for errors.

## See Also

- `.agent/workflows/ai-development-guide.md` - Full documentation
- `docs/SmallBusinessAutomationTool_FeaturePlan.md` - 30 feature plan
- `docs/FeatureComparison.md` - Implementation status
