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

        const anfrage = {
            id: generateId('ANF'),
            kunde: {
                name: document.getElementById('kunde-name').value,
                email: document.getElementById('kunde-email').value,
                telefon: document.getElementById('kunde-telefon').value
            },
            leistungsart: document.getElementById('leistungsart').value,
            beschreibung: document.getElementById('beschreibung').value,
            budget: parseFloat(document.getElementById('budget').value) || 0,
            termin: document.getElementById('termin').value,
            status: 'neu',
            createdAt: new Date().toISOString()
        };

        store.anfragen.push(anfrage);
        saveStore();

        addActivity('📥', `Neue Anfrage von ${anfrage.kunde.name}`);
        window.errorHandler?.success(`Anfrage von ${anfrage.kunde.name} wurde gespeichert.`);

        form.reset();
        closeModal('modal-anfrage');
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
                <h3 style="margin-bottom: 8px;">Noch keine Kundenanfragen vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Hier sehen Sie alle Anfragen Ihrer Kunden. Klicken Sie auf den Knopf unten, um die erste Anfrage einzutragen.
                </p>
                <button class="btn btn-primary" onclick="document.getElementById('btn-neue-anfrage').click()">
                    ➕ Erste Anfrage eintragen
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
            </div>
        </div>
    `).join('');
}

// Export anfragen functions
window.AnfragenModule = {
    initAnfrageForm,
    renderAnfragen
};

// Make globally available
window.renderAnfragen = renderAnfragen;
