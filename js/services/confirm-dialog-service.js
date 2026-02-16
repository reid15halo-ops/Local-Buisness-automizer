/* ============================================
   Confirmation Dialog Service
   Reusable confirmation dialogs for destructive/irreversible actions
   ============================================ */

class ConfirmDialogService {
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
    showConfirmDialog({
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
        overlay.setAttribute('role', 'presentation');

        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-labelledby', 'confirm-title');
        dialog.setAttribute('aria-describedby', 'confirm-message');

        const titleEl = document.createElement('h3');
        titleEl.id = 'confirm-title';
        titleEl.textContent = title;

        const messageEl = document.createElement('p');
        messageEl.id = 'confirm-message';
        messageEl.textContent = message;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'confirm-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel';
        cancelBtn.type = 'button';
        cancelBtn.textContent = cancelText;

        const confirmBtn = document.createElement('button');
        confirmBtn.className = `btn-confirm ${destructive ? 'btn-destructive' : ''}`;
        confirmBtn.type = 'button';
        confirmBtn.textContent = confirmText;

        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(confirmBtn);

        dialog.appendChild(titleEl);
        dialog.appendChild(messageEl);
        dialog.appendChild(actionsDiv);

        overlay.appendChild(dialog);

        // Close on cancel
        const handleCancel = () => {
            overlay.remove();
            if (onCancel) {onCancel();}
            document.removeEventListener('keydown', handleEscape);
        };

        // Close on confirm
        const handleConfirm = () => {
            overlay.remove();
            onConfirm();
            document.removeEventListener('keydown', handleEscape);
        };

        cancelBtn.addEventListener('click', handleCancel);
        confirmBtn.addEventListener('click', handleConfirm);

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Prevent background scroll
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const cleanupOverflow = () => {
            document.body.style.overflow = originalOverflow;
        };

        overlay.addEventListener('remove', cleanupOverflow);

        document.body.appendChild(overlay);
        confirmBtn.focus();

        // Return object with remove method for manual cleanup
        return {
            remove: () => {
                overlay.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
    }

    /**
     * Promise-based version of showConfirmDialog
     * Makes it easier to use with async/await patterns
     *
     * @param {Object} options - Same as showConfirmDialog
     * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
     */
    showConfirmDialogAsync(options) {
        return new Promise((resolve) => {
            this.showConfirmDialog({
                ...options,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    }

    /**
     * Predefined confirmations for specific actions
     */

    /**
     * Angebot absenden (sending quote)
     */
    confirmSendAngebot(angebotNr, brutto, kundenName, onConfirm) {
        const formatter = window.AppUtils?.formatCurrency || ((n) => `${n.toFixed(2)}€`);
        this.showConfirmDialog({
            title: 'Angebot absenden?',
            message: `Sie senden das Angebot #${angebotNr} über ${formatter(brutto)} an ${kundenName}.`,
            confirmText: 'Ja, absenden',
            onConfirm
        });
    }

    /**
     * Angebot annehmen → creates order
     */
    confirmAcceptAngebot(angebotNr, kundenName, onConfirm) {
        this.showConfirmDialog({
            title: 'Angebot annehmen?',
            message: `Das Angebot #${angebotNr} wird angenommen und ein Auftrag für ${kundenName} erstellt. Materialien werden reserviert.`,
            confirmText: 'Ja, Auftrag erstellen',
            onConfirm
        });
    }

    /**
     * Auftrag abschließen (completing job)
     */
    confirmCompleteAuftrag(auftragNr, kundenName, onConfirm) {
        this.showConfirmDialog({
            title: 'Auftrag abschließen?',
            message: `Der Auftrag #${auftragNr} für ${kundenName} wird als erledigt markiert. Reservierte Materialien werden verbucht und eine Rechnung kann erstellt werden.`,
            confirmText: 'Ja, abschließen',
            onConfirm
        });
    }

    /**
     * Rechnung als bezahlt markieren
     */
    confirmMarkAsPaid(rechnungNr, brutto, onConfirm) {
        const formatter = window.AppUtils?.formatCurrency || ((n) => `${n.toFixed(2)}€`);
        this.showConfirmDialog({
            title: 'Rechnung als bezahlt markieren?',
            message: `Die Rechnung #${rechnungNr} über ${formatter(brutto)} wird als bezahlt verbucht. Dies wird in der Buchhaltung erfasst.`,
            confirmText: 'Ja, als bezahlt markieren',
            onConfirm
        });
    }

    /**
     * Rechnung stornieren (cancelling invoice)
     */
    confirmCancelRechnung(rechnungNr, brutto, onConfirm) {
        const formatter = window.AppUtils?.formatCurrency || ((n) => `${n.toFixed(2)}€`);
        this.showConfirmDialog({
            title: 'Rechnung stornieren?',
            message: `Die Rechnung #${rechnungNr} über ${formatter(brutto)} wird storniert. Dies kann nicht rückgängig gemacht werden.`,
            confirmText: 'Ja, stornieren',
            destructive: true,
            onConfirm
        });
    }

    /**
     * Generic delete confirmation
     */
    confirmDelete(typeName, description, onConfirm) {
        this.showConfirmDialog({
            title: `${typeName} löschen?`,
            message: `${description} wird unwiderruflich gelöscht. Dies kann nicht rückgängig gemacht werden.`,
            confirmText: 'Ja, löschen',
            destructive: true,
            onConfirm
        });
    }

    /**
     * Mahnung senden (sending dunning letter)
     */
    confirmSendMahnung(mahnstufeName, kundenName, rechnungNr, brutto, onConfirm) {
        const formatter = window.AppUtils?.formatCurrency || ((n) => `${n.toFixed(2)}€`);
        this.showConfirmDialog({
            title: 'Zahlungserinnerung senden?',
            message: `Eine ${mahnstufeName} wird an ${kundenName} gesendet für die offene Rechnung #${rechnungNr} über ${formatter(brutto)}.`,
            confirmText: 'Ja, senden',
            onConfirm
        });
    }

    /**
     * Generic email/SMS send confirmation
     */
    confirmSendMessage(messageType, recipient, onConfirm) {
        this.showConfirmDialog({
            title: 'Nachricht senden?',
            message: `Eine ${messageType} wird an ${recipient} gesendet.`,
            confirmText: 'Ja, senden',
            onConfirm
        });
    }
}

// Export as singleton
window.confirmDialogService = new ConfirmDialogService();
