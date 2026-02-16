# Progressive Disclosure Mode System - Implementation Guide

## Overview

This document describes the implementation of the "Einfacher Modus" (Simple Mode) vs "Profi-Modus" (Pro Mode) progressive disclosure system for the MHS Workflow PWA. This system prevents non-technical German craftsmen (Handwerker) from being overwhelmed by advanced features.

## Architecture

### Core Components

#### 1. **User Mode Service** (`js/services/user-mode-service.js`)
The backend service that manages mode state and persistence.

**Key Methods:**
```javascript
// Get current mode ('simple' or 'pro')
window.userModeService.getCurrentMode()

// Check mode status
window.userModeService.isProMode()     // boolean
window.userModeService.isSimpleMode()  // boolean

// Set mode and persist
window.userModeService.setMode('pro')
window.userModeService.setMode('simple')

// Toggle between modes
window.userModeService.toggleMode()

// Check if a specific view is visible
window.userModeService.isViewVisible('angebote')

// Get visibility rules
window.userModeService.getVisibilityRules()
```

**Storage:**
- Uses `localStorage` under key: `mhs_user_mode`
- Default mode for new users: `'simple'`
- Persists across page reloads and browser sessions

**Events:**
- Fires custom event `mhs:mode-changed` whenever mode changes
- Event detail includes: `{ mode, isProMode, isSimpleMode, timestamp }`

#### 2. **Mode Toggle UI** (`js/ui/mode-toggle-ui.js`)
The frontend UI controller that responds to mode changes and updates the interface.

**Key Methods:**
```javascript
// Initialize the mode system
window.modeToggleUI.init()

// Apply mode visibility to the sidebar
window.modeToggleUI.applyMode('simple')
window.modeToggleUI.applyMode('pro')

// Refresh current view based on mode
window.modeToggleUI.refreshCurrentView()
```

**Features:**
- Dynamically shows/hides sidebar items based on mode
- Smooth slide animations for items appearing/disappearing
- Updates dashboard content complexity
- Updates form field visibility (pro-only fields)
- Updates table columns
- Creates mode toggle button at bottom of sidebar
- Shows welcome tooltip on first Pro mode activation

### HTML Integration

All navigation items in `index.html` have been updated with `data-mode` attributes:

```html
<!-- Simple Mode Items (shown in both modes) -->
<button class="nav-item" data-view="anfragen" data-mode="simple">
    <span class="nav-icon">📥</span>
    Anfragen
</button>

<!-- Pro Mode Items (hidden in Simple mode) -->
<button class="nav-item" data-view="dashboard" data-mode="pro">
    <span class="nav-icon">📊</span>
    Auswertungen
</button>
```

## Feature Visibility Rules

### Simple Mode (Default for New Users)
Shows only core, essential features:
- 🏠 **Startseite** (Home/Quick Actions)
- 📥 **Anfragen** (Inquiries/Requests)
- 📝 **Angebote** (Quotes)
- 🔧 **Aufträge** (Jobs/Orders)
- 💰 **Rechnungen** (Invoices)
- 👥 **Kunden** (Customers)
- ⚙️ **Einstellungen** (Settings)

### Pro Mode (Advanced Features)
All features from Simple Mode plus:
- 📊 **Auswertungen** (Dashboard/Analytics)
- 📋 **Aufgaben** (Tasks)
- 💬 **Kommunikation** (Communication Hub)
- 📅 **Kalender** (Calendar)
- ⏱️ **Zeiterfassung** (Time Tracking)
- 📧 **E-Mails** (Email Management)
- 🤖 **E-Mail Automation** (Email Automation)
- 📄 **Dokumente** (Documents)
- 🤖 **KI-Chatbot** (AI Chatbot)
- 📦 **Lager** (Inventory/Material)
- 🛒 **Bestellungen** (Purchase Orders)
- ⚠️ **Mahnwesen** (Dunning Management)
- 💰 **Buchhaltung** (Bookkeeping)
- 📊 **Berichte** (Reports)
- ⚡ **Workflows** (Automations)
- 📷 **Scanner** (Document Scanner)
- 🔒 **Daten verwalten** (Data Export/Import)

## How It Works

### 1. Initialization
When the page loads, the system:
1. Loads the saved mode from `localStorage` (or defaults to `'simple'`)
2. The `UserModeService` initializes with the saved mode
3. The `ModeToggleUI` initializes and applies the current mode visibility
4. Sidebar items are shown/hidden based on the mode
5. Mode toggle button is created at the bottom of the sidebar

### 2. User Switches Mode
When a user clicks the mode toggle button:
1. `UserModeService.toggleMode()` is called
2. Mode is saved to `localStorage`
3. Custom event `mhs:mode-changed` is fired
4. `ModeToggleUI` listens for the event and:
   - Shows/hides sidebar items with smooth animation
   - Updates the toggle button label
   - Shows a welcome tooltip (first Pro activation only)
   - Refreshes the current view

### 3. Mode Toggle Button
- **Simple Mode:** Shows "🔓 Profi-Modus aktivieren" (subtle link)
- **Pro Mode:** Shows "🔒 Einfacher Modus" (subtle link)
- Located at the bottom of the sidebar, before the version number
- Discoverable but NOT prominent (doesn't distract beginners)

## CSS Classes & Utilities

### Modal Animation Classes
```css
/* Used to animate items sliding in/out */
@keyframes slideInLeft  { /* Item appears */ }
@keyframes slideOutLeft { /* Item disappears */ }
```

### Utility Classes
```html
<!-- Hide in Simple mode -->
<div class="mode-pro-only">Pro feature only</div>

<!-- Show in both modes (optional) -->
<div class="mode-simple-only">Simple feature</div>
```

### Mode Toggle Styling
```css
.mode-toggle-btn { /* Toggle button styling */ }
.mode-tooltip { /* Welcome tooltip on first Pro activation */ }
.mode-hidden { /* Applied to hidden items */ }
```

## Implementation Details

### localStorage Key
```javascript
const STORAGE_KEY = 'mhs_user_mode'  // Value: 'simple' or 'pro'
```

### Custom Event Format
```javascript
document.addEventListener('mhs:mode-changed', (event) => {
    const { mode, isProMode, isSimpleMode, timestamp } = event.detail
    console.log('Mode changed to:', mode)
})
```

### Nav Item Data Attribute
```html
<!-- Required on all nav items -->
<button data-view="angebote" data-mode="simple">...</button>
```

## How to Add New Features

When adding new features to the app, follow these steps:

### 1. Mark as Pro-Only (Recommended for Advanced Features)
```html
<!-- In index.html sidebar -->
<button class="nav-item" data-view="my-feature" data-mode="pro">
    <span class="nav-icon">✨</span>
    Mein Feature
</button>
```

### 2. Or Keep in Simple Mode
```html
<!-- Shows in both modes -->
<button class="nav-item" data-view="my-feature" data-mode="simple">
    <span class="nav-icon">✨</span>
    Mein Feature
</button>
```

### 3. Add to Visibility Rules
Update the `getVisibilityRules()` method in `user-mode-service.js`:

```javascript
getVisibilityRules() {
    return {
        simple: [
            'quick-actions',
            'anfragen',
            'angebote',
            // ... add your simple feature if needed
        ],
        pro: [
            // ... all simple features ...
            'my-feature',  // Add pro-only feature here
        ]
    }
}
```

### 4. Hide Pro-Only Form Fields
```html
<form>
    <!-- Always visible -->
    <input type="text" name="basic-field">

    <!-- Only visible in Pro mode -->
    <div data-mode="pro-only">
        <input type="text" name="advanced-field">
    </div>
</form>
```

### 5. Hide Pro-Only Table Columns
```html
<table>
    <thead>
        <tr>
            <th>Name</th>
            <th data-mode="pro-only">Margin %</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Product</td>
            <td data-mode="pro-only">15%</td>
        </tr>
    </tbody>
</table>
```

## User Experience Principles

Following the Boomer UX rules from `.skills/boomer-ux/SKILL.md`:

1. **Default is Simple** - New users start in Simple mode, not overwhelmed
2. **Discovery, Not Prominent** - Mode toggle is subtle, at bottom of sidebar
3. **Reversible** - Users can switch back to Simple mode anytime
4. **Smooth Transitions** - Items slide in/out smoothly, not jarring
5. **No Data Loss** - Switching modes only affects visibility, not data
6. **Persistent** - Mode preference is saved across sessions
7. **Friendly Feedback** - Welcome tooltip explains what Pro mode is

## Testing Checklist

- [ ] New users see Simple mode by default
- [ ] All simple mode items are visible
- [ ] Mode toggle button is visible in Simple mode
- [ ] Clicking toggle switches to Pro mode
- [ ] Pro mode shows all additional features
- [ ] Toggle button label updates in Pro mode
- [ ] Welcome tooltip appears on first Pro activation
- [ ] Mode preference persists across page reloads
- [ ] Switching back to Simple hides Pro items smoothly
- [ ] No console errors or warnings
- [ ] Mobile responsiveness maintained
- [ ] Sidebar animations are smooth (no lag)

## Browser Compatibility

- **localStorage:** All modern browsers (IE9+)
- **Custom Events:** All modern browsers (IE9+)
- **CSS Grid/Flex:** All modern browsers
- **ES6 Classes:** All modern browsers (transpile if supporting older browsers)

## Troubleshooting

### Mode toggle button not appearing
- Check that `sidebar-footer` element exists in HTML
- Verify `ModeToggleUI` is initialized after page load
- Check browser console for errors in `mode-toggle-ui.js`

### Mode not persisting
- Check if localStorage is enabled in browser
- Verify `localStorage.getItem('mhs_user_mode')` returns value
- Check browser's private/incognito mode restrictions

### Items not hiding properly
- Verify all nav items have `data-view` attribute
- Check that `data-view` value matches entry in `getVisibilityRules()`
- Ensure CSS rule `.mode-hidden { display: none !important; }` is applied

### Event not firing
- Check that `UserModeService` is initialized before `ModeToggleUI`
- Verify custom event listener in `ModeToggleUI` constructor
- Check browser console for JavaScript errors

## Performance Notes

- Mode service is lightweight and uses only localStorage
- No database queries needed
- Custom events are efficiently dispatched
- CSS animations use GPU-accelerated transforms
- No impact on initial page load time

## Security Considerations

- Mode preference is stored in browser's localStorage (client-side only)
- No user data is affected by mode changes
- Mode is purely a UI visibility preference
- No authentication or authorization checks needed (users can't bypass features)
- Safe to expose all code for Pro features in JavaScript (it's just UI visibility)

## Future Enhancements

Potential improvements:
1. **Guided Tour:** Show tutorial on first Pro mode activation
2. **Mode-Specific Shortcuts:** Different keyboard shortcuts for each mode
3. **Analytics:** Track which users use Pro mode (for product insights)
4. **Server Sync:** Save mode preference to user account (if authenticated)
5. **Contextual Help:** Show relevant tips when entering Pro mode
6. **Auto-Mode:** Switch to Pro based on usage patterns
