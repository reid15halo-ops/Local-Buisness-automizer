# Confirmation Dialog Patterns

Reusable confirmation dialog implementations for the MHS Workflow app.

## Base Pattern: `showConfirmDialog(options)`

```javascript
/**
 * Shows a confirmation dialog before any irreversible action.
 *
 * @param {Object} options
 * @param {string} options.title - Short question, e.g., "Angebot absenden?"
 * @param {string} options.message - Plain German explanation of what will happen
 * @param {string} options.confirmText - Verb-based confirm button, e.g., "Ja, absenden"
 * @param {string} [options.cancelText="Abbrechen"] - Cancel button text
 * @param {boolean} [options.destructive=false] - If true, confirm button is red
 * @param {Function} options.onConfirm - Called when user confirms
 * @param {Function} [options.onCancel] - Called when user cancels
 */
function showConfirmDialog({
    title,
    message,
    confirmText,
    cancelText = 'Abbrechen',
    destructive = false,
    onConfirm,
    onCancel
}) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-dialog" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-message">
            <h3 id="confirm-title">${title}</h3>
            <p id="confirm-message">${message}</p>
            <div class="confirm-actions">
                <button class="btn-cancel" type="button">${cancelText}</button>
                <button class="btn-confirm ${destructive ? 'btn-destructive' : ''}" type="button">${confirmText}</button>
            </div>
        </div>
    `;

    const cancel = overlay.querySelector('.btn-cancel');
    const confirm = overlay.querySelector('.btn-confirm');

    cancel.addEventListener('click', () => {
        overlay.remove();
        if (onCancel) onCancel();
    });

    confirm.addEventListener('click', () => {
        overlay.remove();
        onConfirm();
    });

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            if (onCancel) onCancel();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Prevent background scroll
    document.body.style.overflow = 'hidden';
    overlay.addEventListener('remove', () => {
        document.body.style.overflow = '';
    });

    document.body.appendChild(overlay);
    confirm.focus();
}
```

## CSS for Confirmation Dialogs

```css
.confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
}

.confirm-dialog {
    background: var(--bg-card, #fff);
    border-radius: 12px;
    padding: 2rem;
    max-width: 440px;
    width: 100%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.confirm-dialog h3 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0 0 0.75rem 0;
    color: var(--text-primary, #1a1a1a);
}

.confirm-dialog p {
    font-size: 1rem;
    line-height: 1.5;
    margin: 0 0 1.5rem 0;
    color: var(--text-secondary, #555);
}

.confirm-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
}

.confirm-actions button {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    min-height: 48px;
    border: none;
}

.btn-cancel {
    background: var(--bg-muted, #f0f0f0);
    color: var(--text-secondary, #555);
}

.btn-cancel:hover {
    background: var(--bg-muted-hover, #e0e0e0);
}

.btn-confirm {
    background: var(--color-primary, #2563eb);
    color: #fff;
}

.btn-confirm:hover {
    background: var(--color-primary-hover, #1d4ed8);
}

.btn-destructive {
    background: var(--color-danger, #dc2626);
}

.btn-destructive:hover {
    background: var(--color-danger-hover, #b91c1c);
}
```

## Pre-built Confirmations

### Angebot absenden
```javascript
showConfirmDialog({
    title: 'Angebot absenden?',
    message: `Sie senden das Angebot #${angebotNr} über ${formatCurrency(brutto)} an ${kundenName}.`,
    confirmText: 'Ja, absenden',
    onConfirm: () => sendAngebot(angebotId)
});
```

### Angebot annehmen → Auftrag erstellen
```javascript
showConfirmDialog({
    title: 'Angebot annehmen?',
    message: `Das Angebot #${angebotNr} wird angenommen und ein Auftrag für ${kundenName} erstellt. Materialien werden reserviert.`,
    confirmText: 'Ja, Auftrag erstellen',
    onConfirm: () => acceptAngebot(angebotId)
});
```

### Auftrag abschließen
```javascript
showConfirmDialog({
    title: 'Auftrag abschließen?',
    message: `Der Auftrag #${auftragNr} für ${kundenName} wird als erledigt markiert. Reservierte Materialien werden verbucht und eine Rechnung kann erstellt werden.`,
    confirmText: 'Ja, abschließen',
    onConfirm: () => completeAuftrag(auftragId)
});
```

### Rechnung als bezahlt markieren
```javascript
showConfirmDialog({
    title: 'Rechnung als bezahlt markieren?',
    message: `Die Rechnung #${rechnungNr} über ${formatCurrency(brutto)} wird als bezahlt verbucht. Dies wird in der Buchhaltung erfasst.`,
    confirmText: 'Ja, als bezahlt markieren',
    onConfirm: () => markAsPaid(rechnungId)
});
```

### Rechnung stornieren
```javascript
showConfirmDialog({
    title: 'Rechnung stornieren?',
    message: `Die Rechnung #${rechnungNr} über ${formatCurrency(brutto)} wird storniert. Dies kann nicht rückgängig gemacht werden.`,
    confirmText: 'Ja, stornieren',
    destructive: true,
    onConfirm: () => cancelRechnung(rechnungId)
});
```

### Eintrag löschen (generic)
```javascript
showConfirmDialog({
    title: `${typeName} löschen?`,
    message: `${itemDescription} wird unwiderruflich gelöscht. Dies kann nicht rückgängig gemacht werden.`,
    confirmText: 'Ja, löschen',
    destructive: true,
    onConfirm: () => deleteItem(itemId)
});
```

### Mahnung senden
```javascript
showConfirmDialog({
    title: 'Zahlungserinnerung senden?',
    message: `Eine ${mahnstufeName} wird an ${kundenName} gesendet für die offene Rechnung #${rechnungNr} über ${formatCurrency(brutto)}.`,
    confirmText: 'Ja, senden',
    onConfirm: () => sendMahnung(rechnungId, stufe)
});
```
