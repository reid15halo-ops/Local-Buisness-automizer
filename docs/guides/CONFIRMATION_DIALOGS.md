# Confirmation Dialogs Implementation

This document describes the confirmation dialogs that have been added to the FreyAI Visions app for all destructive and irreversible business actions.

## Overview

A new service `ConfirmDialogService` has been created to provide a consistent, accessible, and user-friendly confirmation dialog interface for all critical operations in the application.

## Files Created

### `/js/services/confirm-dialog-service.js`
The main confirmation dialog service providing:
- `showConfirmDialog(options)` - Core dialog function
- `showConfirmDialogAsync(options)` - Promise-based version for async/await usage
- Pre-built confirmation methods for specific actions:
  - `confirmSendAngebot()` - Confirm sending quote to customer
  - `confirmAcceptAngebot()` - Confirm accepting quote and creating order
  - `confirmCompleteAuftrag()` - Confirm completing a job
  - `confirmMarkAsPaid()` - Confirm marking invoice as paid
  - `confirmCancelRechnung()` - Confirm cancelling invoice
  - `confirmDelete()` - Generic delete confirmation
  - `confirmSendMahnung()` - Confirm sending dunning letter
  - `confirmSendMessage()` - Generic email/SMS send confirmation

## Files Modified

### `/css/core.css`
Added complete CSS styling for confirmation dialogs:
- `.confirm-overlay` - Backdrop with fade animation
- `.confirm-dialog` - Dialog box with slide animation
- `.confirm-actions` - Button container
- `.btn-cancel` - Cancel button (gray, muted)
- `.btn-confirm` - Confirm button (blue for normal actions, red for destructive)
- `.btn-destructive` - Red styling for dangerous operations
- Mobile responsive adjustments

### `/index.html`
Added script tag to load the confirmation dialog service:
```html
<script src="js/services/confirm-dialog-service.js"></script>
```
Placed after `store-service.js` and before user mode services to ensure proper initialization order.

### `/js/modules/angebote.js`
**Modified function: `acceptAngebot(angebotId)`**
- Shows confirmation dialog before accepting a quote and creating an order
- Dialog shows: Quote number, customer name, and confirms materials will be reserved
- Button text: "Ja, Auftrag erstellen" (blue)

### `/js/modules/rechnungen.js`
**Modified function: `showRechnung()`**
- Shows confirmation dialog in "mark as paid" button click handler
- Dialog shows: Invoice number, amount, and confirms bookkeeping entry
- Button text: "Ja, als bezahlt markieren" (blue)

### `/js/app.js`
**Modified function: `initAuftragForm()`**
- Wrapped auftrag completion form submission with confirmation dialog
- Created new function: `proceedWithAuftragCompletion(auftrag)` to handle confirmed action
- Dialog shows: Order number, customer name, confirms material consumption
- Button text: "Ja, abschließen" (blue)

**Modified function: `markInvoiceAsPaid(invoiceId)`**
- Replaced old browser `confirm()` with new confirmation dialog service
- Dialog shows: Invoice number, amount
- Button text: "Ja, als bezahlt markieren" (blue)

**Modified function: Clear Data handler (btn-clear-data)**
- Replaced old browser `confirm()` with new confirmation dialog service
- Dialog shows: Explains all data will be deleted
- Button text: "Ja, löschen" (red - destructive action)

## Confirmation Dialog Details

### 1. Angebot absenden (Send Quote)
**When triggered:** User clicks "Absenden" button on open quote
**Dialog:**
- Title: "Angebot absenden?"
- Message: "Sie senden das Angebot #[nr] über [€amount] an [kundenName]."
- Buttons: "Abbrechen" | "Ja, absenden" (blue)

### 2. Angebot annehmen (Accept Quote)
**When triggered:** User clicks "Auftrag erteilen" button on quote
**Dialog:**
- Title: "Angebot annehmen?"
- Message: "Das Angebot #[nr] wird angenommen und ein Auftrag für [kundenName] erstellt. Materialien werden reserviert."
- Buttons: "Abbrechen" | "Ja, Auftrag erstellen" (blue)

### 3. Auftrag abschließen (Complete Job)
**When triggered:** User submits the order completion form
**Dialog:**
- Title: "Auftrag abschließen?"
- Message: "Der Auftrag #[nr] für [kundenName] wird als erledigt markiert. Reservierte Materialien werden verbucht und eine Rechnung kann erstellt werden."
- Buttons: "Abbrechen" | "Ja, abschließen" (blue)

### 4. Rechnung als bezahlt markieren (Mark Invoice as Paid)
**When triggered:** User clicks "Als bezahlt markieren" button
**Dialog:**
- Title: "Rechnung als bezahlt markieren?"
- Message: "Die Rechnung #[nr] über [€amount] wird als bezahlt verbucht. Dies wird in der Buchhaltung erfasst."
- Buttons: "Abbrechen" | "Ja, als bezahlt markieren" (blue)

### 5. Rechnung stornieren (Cancel Invoice) - NOT YET INTEGRATED
**When triggered:** User cancels an invoice
**Dialog:**
- Title: "Rechnung stornieren?"
- Message: "Die Rechnung #[nr] über [€amount] wird storniert. Dies kann nicht rückgängig gemacht werden."
- Buttons: "Abbrechen" | "Ja, stornieren" (red)

### 6. Alle Daten löschen (Delete All Data)
**When triggered:** User clicks "Alle Daten löschen" button
**Dialog:**
- Title: "Alle Daten löschen?"
- Message: "Alle gespeicherten Daten (Kunden, Anfragen, Angebote, Aufträge, Rechnungen) werden gelöscht. Dies kann nicht rückgängig gemacht werden."
- Buttons: "Abbrechen" | "Ja, löschen" (red)

## Features

### Accessibility
- Semantic HTML with `role="alertdialog"`
- `aria-labelledby` and `aria-describedby` for screen readers
- Focus trap - confirm button receives focus by default
- Keyboard support: Escape key cancels dialog
- No auto-dismiss - user must explicitly click button

### User Experience
- Smooth animations (fade in backdrop, slide up dialog)
- Clear, plain German language
- Specific information shown (amounts, names, consequences)
- Cancel button (left, muted) vs Confirm button (right, colored)
- Destructive actions show red button
- Normal actions show blue button
- Mobile responsive - full width on small screens

### Code Integration
- Global `window.confirmDialogService` singleton
- Wrapped in try/catch blocks with fallback handling
- Compatible with async/await patterns via `showConfirmDialogAsync()`
- All text parameterized for flexibility

## Implementation Checklist

- [x] Confirm-dialog-service.js created with all required methods
- [x] CSS styling added to core.css with animations and mobile support
- [x] Script tag added to index.html in correct load order
- [x] acceptAngebot() wrapped with confirmation
- [x] showRechnung() mark as paid wrapped with confirmation
- [x] Auftrag completion form wrapped with confirmation
- [x] markInvoiceAsPaid() wrapped with confirmation
- [x] Clear data handler wrapped with confirmation
- [ ] Rechnung stornieren integration (ready but not wired yet)
- [ ] Email/SMS send confirmations (reference available, needs action points)
- [ ] Mahnung senden confirmation (reference available, needs action points)
- [ ] Generic delete operations (reference available, needs action points)

## Testing

To test the confirmation dialogs:

1. **Angebot annehmen:** Create anfrage → Create angebot → Click "Auftrag erteilen" button
2. **Auftrag abschließen:** Complete button on open auftrag → Submit form
3. **Rechnung als bezahlt markieren:** Click on invoice → Click "Als bezahlt markieren"
4. **Alle Daten löschen:** Settings → Click "Alle Daten löschen" button

All dialogs should:
- Show with smooth animation
- Display correct information (numbers, names, amounts)
- Have cancel/confirm buttons with correct styling
- Close on Escape key
- Not auto-dismiss after action

## Future Enhancements

1. **Internationalization:** Support German/English language variants
2. **Undo functionality:** Allow reverting last action within time window
3. **Batch confirmations:** Single confirmation for multiple related actions
4. **Custom icons:** Allow custom icons in dialog title
5. **Animation variants:** Different animation styles per action type
6. **Persistence:** Remember user preferences (never show again for safe actions)

## References

- UX Design Guide: `.skills/boomer-ux/SKILL.md` (Section 6: Confirmations)
- Confirmation Patterns: `.skills/boomer-ux/references/confirmation-patterns.md`
- German UI Labels: `.skills/boomer-ux/references/german-ui-labels.md`
