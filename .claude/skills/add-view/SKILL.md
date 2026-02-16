---
name: add-view
description: Add a new navigation view/section to the SPA — sidebar nav item, view container, render function, and data binding.
argument-hint: [view-name] [icon]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add a Navigation View

**Arguments:** `$ARGUMENTS` — parse as `[view-name] [icon-emoji]`

### Steps

1. **Read** `index.html` — find the sidebar `nav-menu` and the view containers.
2. **Read** `js/ui/navigation.js` for the view switching pattern.
3. **Read** `js/app.js` for the render function pattern.

### Checklist

#### A. Sidebar nav item (in `index.html`, inside `.nav-menu`)
```html
<button class="nav-item" data-view="<view-name>">
    <span class="nav-icon"><icon></span>
    <ViewLabel>
    <span class="badge" id="<view-name>-badge">0</span>
</button>
```

#### B. View container (in `index.html`, after existing views)
```html
<div class="view" id="view-<view-name>" style="display: none;">
    <div class="view-header">
        <h2><icon> <ViewLabel></h2>
        <button class="btn btn-primary" id="btn-neue-<item>">
            ➕ Neu
        </button>
    </div>
    <div id="<view-name>-list" class="items-grid"></div>
</div>
```

#### C. Render function (in `js/app.js`)
```javascript
function render<ViewName>() {
    const container = document.getElementById('<view-name>-list');
    const items = store.<view-name> || [];
    // ... render items as cards
}
window.render<ViewName> = render<ViewName>;
```

#### D. Navigation registration
The navigation controller in `js/ui/navigation.js` auto-detects `data-view` buttons, so no extra registration needed.

### Conventions
- German labels for nav items and headings
- Use `.item-card` class for list items
- Use `window.UI.sanitize()` for all user-provided text
- Badge shows count of "active" items
