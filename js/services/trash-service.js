/* ============================================
   Trash Service — Soft Delete + Undo + Orphan Protection

   Instead of permanently deleting records, items go to
   a trash bin. Users get an "Rückgängig" (undo) toast
   for 10 seconds. After 30 days in trash, items are
   permanently purged.

   Follows boomer-ux rules: no data loss from accidental clicks.
   ============================================ */

class TrashService {
    constructor() {
        this.TRASH_KEY = 'mhs_trash';
        this.UNDO_TIMEOUT = 10000; // 10 seconds to undo
        this.PURGE_DAYS = 30; // auto-purge after 30 days
        this.undoTimers = new Map();
        this.trash = JSON.parse(localStorage.getItem(this.TRASH_KEY) || '[]');
    }

    /* ──────────────────────────────────────────
       Soft Delete — moves item to trash
       Returns the trashed item for undo
       ────────────────────────────────────────── */
    softDelete(entityType, item, options = {}) {
        if (!item || !item.id) {
            console.error('TrashService: Cannot trash item without id');
            return null;
        }

        // Check for orphans before allowing delete
        if (!options.skipOrphanCheck) {
            const orphanWarning = this.checkOrphans(entityType, item.id);
            if (orphanWarning) {
                return { blocked: true, reason: orphanWarning };
            }
        }

        const trashedItem = {
            id: 'trash-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            entityType: entityType, // 'kunde', 'anfrage', 'angebot', 'auftrag', 'rechnung', 'material'
            originalId: item.id,
            data: JSON.parse(JSON.stringify(item)), // deep clone
            deletedAt: new Date().toISOString(),
            deletedBy: this.getCurrentUser(),
            description: this.getItemDescription(entityType, item)
        };

        this.trash.push(trashedItem);
        this.saveTrash();

        // Actually remove from the source
        this.removeFromSource(entityType, item.id);

        // Show undo toast
        this.showUndoToast(trashedItem);

        return trashedItem;
    }

    /* ──────────────────────────────────────────
       Undo — restores item from trash
       ────────────────────────────────────────── */
    undo(trashId) {
        const index = this.trash.findIndex(t => t.id === trashId);
        if (index === -1) {
            console.warn('TrashService: Item not found in trash:', trashId);
            return false;
        }

        const trashedItem = this.trash[index];

        // Restore to source
        this.restoreToSource(trashedItem.entityType, trashedItem.data);

        // Remove from trash
        this.trash.splice(index, 1);
        this.saveTrash();

        // Cancel any pending undo timer
        if (this.undoTimers.has(trashId)) {
            clearTimeout(this.undoTimers.get(trashId));
            this.undoTimers.delete(trashId);
        }

        // Show success feedback
        if (window.ErrorDisplay) {
            window.ErrorDisplay.showSuccess(`${this.getEntityLabel(trashedItem.entityType)} wiederhergestellt ✅`);
        }

        return true;
    }

    /* ──────────────────────────────────────────
       Orphan Protection — blocks delete if item
       is referenced by other records
       ────────────────────────────────────────── */
    checkOrphans(entityType, itemId) {
        const store = window.storeService;
        if (!store) { return null; }

        const data = store.getData();

        if (entityType === 'kunde') {
            // Check if customer has Angebote, Aufträge, or Rechnungen
            const angebote = (data.angebote || []).filter(a =>
                a.kundeId === itemId || a.kunde?.id === itemId
            );
            const auftraege = (data.auftraege || []).filter(a =>
                a.kundeId === itemId || a.kunde?.id === itemId
            );
            const rechnungen = (data.rechnungen || []).filter(r =>
                r.kundeId === itemId || r.kunde?.id === itemId
            );

            const refs = [];
            if (angebote.length > 0) { refs.push(`${angebote.length} Angebot${angebote.length > 1 ? 'e' : ''}`); }
            if (auftraege.length > 0) { refs.push(`${auftraege.length} Auftrag${auftraege.length > 1 ? '¨e' : ''}`); }
            if (rechnungen.length > 0) { refs.push(`${rechnungen.length} Rechnung${rechnungen.length > 1 ? 'en' : ''}`); }

            if (refs.length > 0) {
                return `Dieser Kunde hat noch ${refs.join(', ')}. Bitte löschen oder archivieren Sie diese zuerst.`;
            }
        }

        if (entityType === 'angebot') {
            // Check if Angebot was converted to Auftrag
            const auftraege = (data.auftraege || []).filter(a =>
                a.angebotId === itemId || a.ausAngebot === itemId
            );
            if (auftraege.length > 0) {
                return `Dieses Angebot wurde bereits in einen Auftrag umgewandelt. Der Auftrag muss zuerst gelöscht werden.`;
            }
        }

        if (entityType === 'auftrag') {
            // Check if Auftrag has Rechnungen
            const rechnungen = (data.rechnungen || []).filter(r =>
                r.auftragId === itemId || r.ausAuftrag === itemId
            );
            if (rechnungen.length > 0) {
                return `Zu diesem Auftrag gibt es noch ${rechnungen.length} Rechnung${rechnungen.length > 1 ? 'en' : ''}. Bitte löschen Sie diese zuerst.`;
            }
        }

        if (entityType === 'rechnung') {
            // Block delete of paid invoices — bookkeeping integrity
            const rechnung = (data.rechnungen || []).find(r => r.id === itemId);
            if (rechnung && rechnung.status === 'bezahlt') {
                return `Diese Rechnung wurde bereits bezahlt und in der Buchhaltung erfasst. Bezahlte Rechnungen können nicht gelöscht werden — verwenden Sie stattdessen "Stornieren".`;
            }
        }

        return null; // No orphans, safe to delete
    }

    /* ──────────────────────────────────────────
       Undo Toast — shows "Rückgängig" button
       ────────────────────────────────────────── */
    showUndoToast(trashedItem) {
        const container = document.getElementById('error-display-container') ||
            this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = 'toast toast-undo';
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">🗑️</span>
                <div class="toast-text">
                    <strong>${trashedItem.description}</strong>
                    <span>wurde gelöscht</span>
                </div>
                <button class="btn-undo" type="button" data-trash-id="${trashedItem.id}">
                    Rückgängig
                </button>
                <button class="toast-close" type="button" aria-label="Schließen">✕</button>
            </div>
            <div class="undo-progress">
                <div class="undo-progress-bar"></div>
            </div>
        `;

        // Wire up undo button
        const undoBtn = toast.querySelector('.btn-undo');
        undoBtn.addEventListener('click', () => {
            this.undo(trashedItem.id);
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        });

        // Wire up close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        });

        // Start countdown animation
        const progressBar = toast.querySelector('.undo-progress-bar');
        progressBar.style.transition = `width ${this.UNDO_TIMEOUT}ms linear`;
        requestAnimationFrame(() => {
            progressBar.style.width = '0%';
        });

        container.appendChild(toast);

        // Auto-dismiss after timeout
        const timer = setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
            this.undoTimers.delete(trashedItem.id);
        }, this.UNDO_TIMEOUT);

        this.undoTimers.set(trashedItem.id, timer);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'error-display-container';
        container.setAttribute('role', 'region');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
        return container;
    }

    /* ──────────────────────────────────────────
       Source Operations — remove/restore from
       the actual data stores
       ────────────────────────────────────────── */
    removeFromSource(entityType, itemId) {
        switch (entityType) {
        case 'kunde':
            if (window.customerService) {
                // Use the original hard delete (we already saved the backup)
                window.customerService.customers = window.customerService.customers.filter(c => c.id !== itemId);
                window.customerService.save();
            }
            break;
        case 'anfrage':
        case 'angebot':
        case 'auftrag':
        case 'rechnung': {
            const store = window.storeService;
            if (store) {
                const data = store.getData();
                const pluralKey = this.getPluralKey(entityType);
                if (data[pluralKey]) {
                    data[pluralKey] = data[pluralKey].filter(item => item.id !== itemId);
                    store.save();
                }
            }
            break;
        }
        case 'material': {
            const matService = window.materialService;
            if (matService) {
                matService.materials = matService.materials.filter(m => m.id !== itemId);
                matService.save();
            }
            break;
        }
        }
    }

    restoreToSource(entityType, itemData) {
        switch (entityType) {
        case 'kunde':
            if (window.customerService) {
                window.customerService.customers.push(itemData);
                window.customerService.save();
            }
            break;
        case 'anfrage':
        case 'angebot':
        case 'auftrag':
        case 'rechnung': {
            const store = window.storeService;
            if (store) {
                const data = store.getData();
                const pluralKey = this.getPluralKey(entityType);
                if (data[pluralKey]) {
                    data[pluralKey].push(itemData);
                    store.save();
                }
            }
            break;
        }
        case 'material': {
            const matService = window.materialService;
            if (matService) {
                matService.materials.push(itemData);
                matService.save();
            }
            break;
        }
        }

        // Refresh the current view
        if (window.switchView) {
            // Re-render current view to show restored item
            const currentView = document.querySelector('.nav-item.active')?.dataset?.view;
            if (currentView) {
                window.switchView(currentView);
            }
        }
    }

    /* ──────────────────────────────────────────
       Trash Management — view, restore, purge
       ────────────────────────────────────────── */
    getTrash() {
        return this.trash.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
    }

    getTrashByType(entityType) {
        return this.getTrash().filter(t => t.entityType === entityType);
    }

    getTrashCount() {
        return this.trash.length;
    }

    restoreFromTrash(trashId) {
        return this.undo(trashId);
    }

    permanentDelete(trashId) {
        const index = this.trash.findIndex(t => t.id === trashId);
        if (index !== -1) {
            this.trash.splice(index, 1);
            this.saveTrash();
            return true;
        }
        return false;
    }

    emptyTrash() {
        this.trash = [];
        this.saveTrash();
    }

    // Auto-purge items older than PURGE_DAYS
    purgeOldItems() {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - this.PURGE_DAYS);

        const before = this.trash.length;
        this.trash = this.trash.filter(t => new Date(t.deletedAt) > cutoff);

        if (this.trash.length < before) {
            this.saveTrash();
            console.log(`TrashService: Purged ${before - this.trash.length} items older than ${this.PURGE_DAYS} days`);
        }
    }

    /* ──────────────────────────────────────────
       Helpers
       ────────────────────────────────────────── */
    getItemDescription(entityType, item) {
        switch (entityType) {
        case 'kunde':
            return `Kunde "${item.name || item.firma || 'Unbekannt'}"`;
        case 'anfrage':
            return `Anfrage #${item.nummer || item.id?.substr(-6) || '?'}`;
        case 'angebot':
            return `Angebot #${item.nummer || item.id?.substr(-6) || '?'}`;
        case 'auftrag':
            return `Auftrag #${item.nummer || item.id?.substr(-6) || '?'}`;
        case 'rechnung':
            return `Rechnung #${item.nummer || item.id?.substr(-6) || '?'}`;
        case 'material':
            return `Material "${item.name || item.bezeichnung || 'Unbekannt'}"`;
        default:
            return `Eintrag "${item.name || item.id || 'Unbekannt'}"`;
        }
    }

    getEntityLabel(entityType) {
        const labels = {
            kunde: 'Kunde',
            anfrage: 'Anfrage',
            angebot: 'Angebot',
            auftrag: 'Auftrag',
            rechnung: 'Rechnung',
            material: 'Material'
        };
        return labels[entityType] || 'Eintrag';
    }

    getPluralKey(entityType) {
        const keys = {
            anfrage: 'anfragen',
            angebot: 'angebote',
            auftrag: 'auftraege',
            rechnung: 'rechnungen'
        };
        return keys[entityType] || entityType;
    }

    getCurrentUser() {
        try {
            const profile = JSON.parse(localStorage.getItem('mhs_company_profile') || '{}');
            return profile.name || 'Unbekannt';
        } catch {
            return 'Unbekannt';
        }
    }

    saveTrash() {
        localStorage.setItem(this.TRASH_KEY, JSON.stringify(this.trash));
    }
}

// Initialize globally
window.trashService = new TrashService();

// Auto-purge on load
window.trashService.purgeOldItems();
