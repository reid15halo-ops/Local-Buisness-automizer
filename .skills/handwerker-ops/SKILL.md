---
name: handwerker-ops
description: |
  Operational feature patterns for German Handwerker (craftsmen) businesses with 1-10 employees.
  Use this skill when implementing: route planning, team management, voice commands, Bautagebuch,
  trade-specific calculations, supplier management, apprentice tracking, marketing automation,
  warranty tracking, or any domain-specific Handwerker business feature.
  Trigger words: Handwerker, Gewerk, SHK, Elektro, Maler, Bautagebuch, Berichtsheft, Azubi,
  Subunternehmer, Monteur, Baustelle, VOB, HOAI, Meister, Geselle, route, dispatch, trade.
---

# Handwerker Ops — Domain Patterns for Trade Business Features

## Business Context

German Handwerker businesses (Handwerksbetriebe) operate under specific regulations and workflows:

### Legal Requirements
- **Bautagebuch** (Construction Diary): Legally required for VOB/B contracts. Must document daily: weather, workers present, work performed, materials used, special incidents.
- **Berichtsheft** (Apprentice Report): Apprentices must submit weekly reports. The Meister signs them. Required for Gesellenprüfung (journeyman exam).
- **Gewährleistung** (Warranty): Standard 5 years for construction work (BGB), 4 years for VOB/B contracts. Must track per project.
- **Aufmaß** (Site measurement): Quantities measured on-site, basis for invoicing.

### Trade Types (Gewerke)
- **SHK** (Sanitär-Heizung-Klima): Plumbing, heating, HVAC. Heavy material costs, long projects.
- **Elektro**: Electrical. Strict safety regulations, VDE standards.
- **Maler/Lackierer**: Painting. Area-based calculations (m²), material waste factor.
- **Tischler/Schreiner**: Carpentry. Custom measurements, material cuts.
- **Dachdecker**: Roofing. Weather-dependent, safety requirements.
- **Fliesenleger**: Tiling. Area calculations with waste/cut factor.
- **Maurer**: Masonry. Volume calculations, mortar ratios.

### Workforce Structure
- **Meister** (Master): Business owner, certified. Signs off on work.
- **Geselle** (Journeyman): Qualified worker. Can work independently.
- **Azubi/Lehrling** (Apprentice): In training (3-3.5 years). Needs supervision.
- **Subunternehmer** (Subcontractor): External. Needs separate tracking.
- **Helfer** (Helper): Unskilled labor. Limited tasks.

## Architecture Patterns

### Service Pattern
```javascript
class FeatureService {
    constructor() {
        this.STORAGE_KEY = 'mhs_feature_name';
        this.data = this._load();
    }
    _load() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
        } catch { return []; }
    }
    _save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    }
}
window.featureService = new FeatureService();
```

### UI Pattern
```javascript
class FeatureUI {
    constructor() {
        this.service = window.featureService;
        this.container = null;
    }
    init() {
        this.container = document.getElementById('view-feature');
        if (!this.container) return;
        this.render();
    }
    render() { /* Build HTML */ }
    _esc(str) {
        if (!str) return '';
        const el = document.createElement('span');
        el.textContent = str;
        return el.innerHTML;
    }
}
window.featureUI = new FeatureUI();
```

### Integration Checklist
For every new feature:
1. Create `js/services/{feature}-service.js`
2. Create `js/ui/{feature}-ui.js` (if it has a view)
3. Add CSS to existing files or create `css/{feature}.css` if >100 lines
4. Add `<script>` tags to `index.html`
5. Add nav button to sidebar in `index.html` (with `data-mode="pro"`)
6. Add view section `<section class="view" id="view-{feature}">`
7. Add case in `navigation.js` `handleViewEnter()`
8. Add view to `user-mode-service.js` pro mode array
9. Add i18n keys to `js/i18n/de.js` and `js/i18n/en.js`
10. Add nav translation key

### Data Format Standards
- **Dates**: ISO 8601 strings (`new Date().toISOString()`)
- **Currency**: Numbers in cents or with 2 decimal places, format with `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`
- **IDs**: `{prefix}-{timestamp}-{random}` (e.g., `BTB-1708123456-a1b2c3`)
- **GPS**: `{ lat: number, lng: number }`

## Trade Calculation Reference

### SHK (Plumbing/Heating)
- Hourly rate: typically 55-85€/h (Meister: 75-95€/h)
- Travel flat rate: 35-65€ per trip
- Material markup: 15-30%
- Small job flat rate: 85-150€

### Elektro (Electrical)
- Hourly rate: 50-75€/h
- Emergency surcharge: 50-100%
- Material markup: 20-35%
- Measurement/inspection flat rate: 80-250€

### Maler (Painting)
- Price per m²: 8-25€ (depending on technique)
- Waste factor: 10-15% for paint
- Scaffolding: separate line item
- Prep work (Untergrund): 3-8€/m²

### General
- Fahrtkosten: 0.30€/km or flat rate
- Entsorgung (disposal): varies, track separately
- MwSt: 19% standard, 7% for certain art/restoration work
