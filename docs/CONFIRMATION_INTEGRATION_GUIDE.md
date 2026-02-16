# Confirmation Dialog Integration Guide

This guide shows how to add confirmation dialogs to new destructive/irreversible actions in the MHS Workflow app.

## Quick Start

### 1. Access the Service

The confirmation dialog service is available globally as `window.confirmDialogService`.

```javascript
// Service is automatically initialized via <script> tag in index.html
window.confirmDialogService.showConfirmDialog({...});
```

### 2. Basic Pattern

```javascript
// BEFORE: Action executed immediately
function deleteCustomer(customerId) {
    const customer = store.kunden.find(k => k.id === customerId);
    if (!customer) return;

    store.kunden = store.kunden.filter(k => k.id !== customerId);
    saveStore();
    renderKunden();
}

// AFTER: Action with confirmation
function deleteCustomer(customerId) {
    const customer = store.kunden.find(k => k.id === customerId);
    if (!customer) return;

    window.confirmDialogService?.confirmDelete(
        'Kunde',
        `${window.UI?.sanitize?.(customer.name) || 'Unbekannt'} wird gelöscht`,
        () => {
            // Only execute if user confirms
            store.kunden = store.kunden.filter(k => k.id !== customerId);
            saveStore();
            renderKunden();
        }
    );
}
```

## Built-in Confirmation Methods

### `confirmDelete(typeName, description, onConfirm)`
For any item deletion.

```javascript
window.confirmDialogService.confirmDelete(
    'Anfrage',
    'Anfrage #ANF-001 wird unwiderruflich gelöscht',
    () => {
        store.anfragen = store.anfragen.filter(a => a.id !== anfrageId);
        saveStore();
        renderAnfragen();
    }
);
```

**Result:** Red button "Ja, löschen" - indicates destructive action

### `confirmSendAngebot(angebotNr, brutto, kundenName, onConfirm)`
For sending quotes to customers.

```javascript
const angebot = store.angebote.find(a => a.id === angebotId);
window.confirmDialogService.confirmSendAngebot(
    angebot.id,
    angebot.brutto,
    angebot.kunde.name,
    () => {
        angebot.status = 'gesendet';
        saveStore();
        renderAngebote();
    }
);
```

**Result:** Blue button "Ja, absenden"

### `confirmAcceptAngebot(angebotNr, kundenName, onConfirm)`
For accepting quotes and creating orders.

```javascript
window.confirmDialogService.confirmAcceptAngebot(
    angebot.id,
    angebot.kunde.name,
    () => {
        // Create order logic here
    }
);
```

**Result:** Blue button "Ja, Auftrag erstellen"

### `confirmCompleteAuftrag(auftragNr, kundenName, onConfirm)`
For completing jobs.

```javascript
window.confirmDialogService.confirmCompleteAuftrag(
    auftrag.id,
    auftrag.kunde.name,
    () => {
        auftrag.status = 'abgeschlossen';
        // Create invoice, consume materials, etc.
    }
);
```

**Result:** Blue button "Ja, abschließen"

### `confirmMarkAsPaid(rechnungNr, brutto, onConfirm)`
For marking invoices as paid.

```javascript
window.confirmDialogService.confirmMarkAsPaid(
    rechnung.nummer,
    rechnung.brutto,
    () => {
        rechnung.status = 'bezahlt';
        saveStore();
        renderRechnungen();
    }
);
```

**Result:** Blue button "Ja, als bezahlt markieren"

### `confirmCancelRechnung(rechnungNr, brutto, onConfirm)`
For cancelling invoices.

```javascript
window.confirmDialogService.confirmCancelRechnung(
    rechnung.nummer,
    rechnung.brutto,
    () => {
        rechnung.status = 'storniert';
        saveStore();
        renderRechnungen();
    }
);
```

**Result:** Red button "Ja, stornieren" - indicates destructive action

### `confirmSendMahnung(mahnstufeName, kundenName, rechnungNr, brutto, onConfirm)`
For sending dunning letters.

```javascript
window.confirmDialogService.confirmSendMahnung(
    '1. Mahnung',
    rechnung.kunde.name,
    rechnung.nummer,
    rechnung.brutto,
    () => {
        // Send mahnung logic
    }
);
```

**Result:** Blue button "Ja, senden"

### `confirmSendMessage(messageType, recipient, onConfirm)`
Generic email/SMS confirmation.

```javascript
window.confirmDialogService.confirmSendMessage(
    'E-Mail',
    rechnung.kunde.email,
    () => {
        // Send email logic
    }
);
```

**Result:** Blue button "Ja, senden"

## Custom Confirmations

For actions not covered by the built-in methods, use the core function:

```javascript
window.confirmDialogService.showConfirmDialog({
    title: 'Benutzerdefinierte Aktion?',
    message: 'Dies ist eine benutzerdefinierte Bestätigung mit detaillierten Informationen.',
    confirmText: 'Ja, fortfahren',
    cancelText: 'Abbrechen',
    destructive: false, // Set to true for red button
    onConfirm: () => {
        // Action logic
    },
    onCancel: () => {
        // Optional: handle cancellation
    }
});
```

## Async/Await Pattern

For more complex flows, use the Promise-based version:

```javascript
async function deleteMultipleItems(itemIds) {
    const confirmed = await window.confirmDialogService.showConfirmDialogAsync({
        title: 'Mehrere Einträge löschen?',
        message: `${itemIds.length} Einträge werden unwiderruflich gelöscht.`,
        confirmText: 'Ja, alle löschen',
        destructive: true
    });

    if (!confirmed) {
        console.log('User cancelled deletion');
        return;
    }

    // Delete items
    itemIds.forEach(id => {
        store.items = store.items.filter(i => i.id !== id);
    });

    saveStore();
    renderItems();
}
```

## Integration Points to Add (Priority Order)

### High Priority (Critical Business Actions)
1. **Delete Anfrage** - Delete customer inquiry
2. **Delete Angebot** - Delete quote
3. **Delete Auftrag** - Delete order
4. **Delete Rechnung** - Delete invoice
5. **Delete Kunde** - Delete customer
6. **Rechnung stornieren** - Cancel invoice

### Medium Priority (Important Operations)
7. **Send Email/SMS** - All email and SMS operations
8. **Mahnung senden** - Send dunning letters
9. **Angebot absenden** - Send quote to customer (DONE)
10. **Ändern zu Mahnung** - Convert invoice to dunning

### Low Priority (Less Critical)
11. **Delete Material** - Remove from inventory
12. **Delete Anforderung** - Delete purchase order
13. **Archive Auftrag** - Archive completed orders

## Code Patterns

### Pattern 1: Simple Button Click Handler
```javascript
document.getElementById('btn-delete-anfrage').addEventListener('click', () => {
    const anfrafeId = document.getElementById('anfrage-id').value;
    const anfrage = store.anfragen.find(a => a.id === anfrageId);

    window.confirmDialogService?.confirmDelete(
        'Anfrage',
        `${anfrage.leistungsart} von ${anfrage.kunde.name}`,
        () => {
            store.anfragen = store.anfragen.filter(a => a.id !== anfrageId);
            saveStore();
            renderAnfragen();
        }
    );
});
```

### Pattern 2: Event Delegation
```javascript
// In event delegation handler
case 'delete-anfrage':
    const anfrage = store.anfragen.find(a => a.id === id);
    window.confirmDialogService?.confirmDelete(
        'Anfrage',
        `${anfrage.leistungsart}`,
        () => {
            store.anfragen = store.anfragen.filter(a => a.id !== id);
            saveStore();
            renderAnfragen();
        }
    );
    break;
```

### Pattern 3: Form Submission
```javascript
form.addEventListener('submit', (e) => {
    e.preventDefault();

    const itemId = document.getElementById('item-id').value;

    window.confirmDialogService?.confirmDelete(
        'Eintrag',
        'Dieser Eintrag wird endgültig gelöscht',
        () => {
            // Execute the action
            proceedWithDeletion(itemId);
        }
    );
});
```

## Best Practices

1. **Always show what will happen**
   ```javascript
   // ✓ Good - specific information
   message: `Die Anfrage von ${customer.name} über ${budget}€ wird gelöscht.`

   // ✗ Bad - vague
   message: 'Eintrag wird gelöscht.'
   ```

2. **Use sanitized data for display**
   ```javascript
   // ✓ Good - sanitized to prevent XSS
   window.UI?.sanitize?.(customer.name)

   // ✗ Bad - raw data could contain malicious content
   customer.name
   ```

3. **Destructive actions must use red button**
   ```javascript
   // ✓ Good - red for delete
   destructive: true

   // ✗ Bad - delete should not be blue
   destructive: false
   ```

4. **Use specific verb-based button text**
   ```javascript
   // ✓ Good - action-specific
   confirmText: 'Ja, Auftrag erstellen'

   // ✗ Bad - generic
   confirmText: 'OK'
   ```

5. **Wrap in try/catch for error handling**
   ```javascript
   try {
       window.confirmDialogService?.confirmDelete(
           'Item',
           description,
           () => {
               // Action logic
           }
       );
   } catch (error) {
       console.error('Confirmation error:', error);
       showToast('Fehler beim Bestätigen', 'error');
   }
   ```

## Testing Checklist

When adding a new confirmation:

- [ ] Dialog appears with correct title and message
- [ ] Information is accurate (names, amounts, descriptions)
- [ ] Cancel button works (closes dialog, no action)
- [ ] Confirm button works (closes dialog, executes action)
- [ ] Button colors are appropriate (blue for normal, red for destructive)
- [ ] Escape key closes dialog without action
- [ ] Mobile view is responsive and readable
- [ ] Confirm button receives focus (keyboard navigation)
- [ ] No duplicate dialogs appear
- [ ] Data is sanitized (XSS prevention)

## Common Issues

### Issue: Service not available
**Symptom:** `window.confirmDialogService is undefined`
**Solution:** Ensure script tag is in index.html AFTER store-service.js and BEFORE modules

### Issue: Dialog doesn't appear
**Symptom:** Clicking button does nothing
**Solution:** Check browser console for errors, wrap in `try/catch`, add error logging

### Issue: Action executes without confirmation
**Symptom:** Dialog shows but action happens anyway
**Solution:** Make sure action is inside `onConfirm` callback, not outside

### Issue: Dialog text shows variables instead of values
**Symptom:** "Anfrage {{anfrage.id}} wird gelöscht"
**Solution:** Use string interpolation: `` `Anfrage ${anfrage.id}...` `` not template strings

## References

- Service: `/js/services/confirm-dialog-service.js`
- Styles: `/css/core.css` - `.confirm-overlay`, `.confirm-dialog`, etc.
- UX Rules: `.skills/boomer-ux/SKILL.md` - Section 6: Confirmation Before Every Irreversible Action
- Examples: `/js/modules/angebote.js`, `/js/modules/rechnungen.js`, `/js/app.js`
