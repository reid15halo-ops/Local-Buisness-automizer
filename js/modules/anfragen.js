/* ============================================
   Anfragen Module
   Anfragen (requests/inquiries) CRUD and UI
   ============================================ */

const { store, saveStore, addActivity, generateId, formatDate, formatCurrency, getLeistungsartLabel, openModal, closeModal, switchView } = window.AppUtils;

function initAnfrageForm() {
    const btn = document.getElementById('btn-neue-anfrage');
    const form = document.getElementById('form-anfrage');

    if (!btn || !form) {return;}

    btn.addEventListener('click', () => openModal('modal-anfrage'));

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Validate form inputs with inline error highlighting
        const requiredFields = [
            { id: 'kunde-name', label: 'Kundenname' },
            { id: 'beschreibung', label: 'Beschreibung' }
        ];
        let hasErrors = false;

        // Clear previous errors
        form.querySelectorAll('.field-error').forEach(el => el.remove());
        form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

        requiredFields.forEach(({ id, label }) => {
            const input = document.getElementById(id);
            if (input && !input.value.trim()) {
                hasErrors = true;
                input.classList.add('input-error');
                const errorEl = document.createElement('div');
                errorEl.className = 'field-error';
                errorEl.textContent = `${label} ist ein Pflichtfeld`;
                input.parentElement.appendChild(errorEl);
            }
        });

        if (window.formValidation) {
            const result = window.formValidation.validateDOMForm(form, {
                'kunde-name': ['required', 'minLength(2)'],
                'kunde-email': ['email'],
                'kunde-telefon': ['phone'],
                'beschreibung': ['required'],
                'budget': ['number']
            });
            if (!result.valid) { hasErrors = true; }
        }

        if (hasErrors) {
            if (window.showToast) showToast('Bitte Pflichtfelder korrekt ausfüllen', 'warning');
            // Scroll to first error
            const firstError = form.querySelector('.input-error');
            if (firstError) { firstError.focus(); }
            return;
        }

        const anfrage = {
            id: generateId('ANF'),
            kunde: {
                name: document.getElementById('kunde-name').value.trim(),
                email: document.getElementById('kunde-email').value.trim(),
                telefon: document.getElementById('kunde-telefon').value.trim()
            },
            leistungsart: document.getElementById('leistungsart').value,
            beschreibung: document.getElementById('beschreibung').value.trim(),
            budget: parseFloat(document.getElementById('budget').value) || 0,
            termin: document.getElementById('termin').value,
            status: 'neu',
            createdAt: new Date().toISOString()
        };

        store.anfragen.push(anfrage);
        saveStore();

        addActivity('📥', `Neue Anfrage von ${anfrage.kunde.name}`);

        form.reset();
        closeModal('modal-anfrage');
        if (window.showToast) { showToast('Anfrage erfolgreich erstellt', 'success'); }
        switchView('anfragen');
        document.querySelector('[data-view="anfragen"]').click();
    });
}

function renderAnfragen() {
    const container = document.getElementById('anfragen-list');
    if (!container) {return;}
    const anfragen = store?.anfragen?.filter(a => a.status === 'neu') || [];

    if (anfragen.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 60px 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                <h3 style="margin-bottom: 8px;">Keine Anfragen vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Erstelle deine erste Kundenanfrage um loszulegen.
                </p>
                <button class="btn btn-primary" onclick="document.getElementById('btn-neue-anfrage').click()">
                    ➕ Neue Anfrage erstellen
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = anfragen.map(a => `
        <div class="item-card">
            <div class="item-header">
                <h3 class="item-title">${window.UI.sanitize(a.kunde.name)}</h3>
                <span class="item-id">${a.id}</span>
            </div>
            <div class="item-meta">
                <span>📧 ${window.UI.sanitize(a.kunde.email) || '-'}</span>
                <span>📞 ${window.UI.sanitize(a.kunde.telefon) || '-'}</span>
                <span>📅 ${formatDate(a.termin)}</span>
            </div>
            <p class="item-description">
                <strong>${getLeistungsartLabel(a.leistungsart)}:</strong> ${window.UI.sanitize(a.beschreibung)}
            </p>
            ${a.budget ? `<p class="item-description">💰 Budget: ${formatCurrency(a.budget)}</p>` : ''}
            <div class="item-actions">
                <span class="status-badge status-neu">● Neu</span>
                <button class="btn btn-primary" onclick="createAngebotFromAnfrage('${a.id}')">
                    📝 Angebot erstellen
                </button>
                <button class="btn btn-secondary btn-small" onclick="deleteAnfrage('${a.id}')" title="Anfrage löschen">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

function deleteAnfrage(id) {
    if (window.confirmDialogService) {
        window.confirmDialogService.show({
            title: 'Anfrage löschen',
            message: 'Möchtest du diese Anfrage wirklich löschen?',
            confirmText: 'Löschen',
            cancelText: 'Abbrechen',
            destructive: true,
            onConfirm: () => {
                store.anfragen = store.anfragen.filter(a => a.id !== id);
                saveStore();
                renderAnfragen();
                if (window.showToast) { showToast('Anfrage gelöscht', 'success'); }
            }
        });
    } else {
        store.anfragen = store.anfragen.filter(a => a.id !== id);
        saveStore();
        renderAnfragen();
        if (window.showToast) { showToast('Anfrage gelöscht', 'success'); }
    }
}
window.deleteAnfrage = deleteAnfrage;

// Export anfragen functions
window.AnfragenModule = {
    initAnfrageForm,
    renderAnfragen,
    deleteAnfrage
};

// Make globally available
window.renderAnfragen = renderAnfragen;
