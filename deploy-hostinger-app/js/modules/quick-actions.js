/* ============================================
   Quick Actions Module
   Home screen for non-technical Handwerker
   Shows greeting, 4 main action cards, and recent activity
   ============================================ */

function initQuickActions() {
    try {
        const container = document.getElementById('quick-actions-container');
        if (!container) {
            console.warn('Quick Actions container not found');
            return;
        }

        // Get user name from admin settings or store
        const store = window.storeService?.state || {};
        const ap = (() => { try { return JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}'); } catch { return {}; } })();
        const userName = ap.owner_name || store.settings?.owner || store.settings?.companyName || 'Chef';

        // Get current time for greeting
        const greeting = getTimeBasedGreeting(userName);

        // Get stats
        const offeneAnfragen = store.anfragen?.filter(a => a.status === 'neu').length || 0;
        const wartendeAngebote = store.angebote?.filter(a => a.status === 'offen').length || 0;
        const aktiveAuftraege = store.auftraege?.filter(a => a.status !== 'abgeschlossen').length || 0;
        const offeneRechnungen = store.rechnungen?.filter(r => r.status === 'offen').length || 0;

        // Get recent activities (last 5)
        const activities = (store.activities || []).slice(0, 5);

        // Check if user is new (no data yet)
        const totalItems = offeneAnfragen + wartendeAngebote + aktiveAuftraege + offeneRechnungen;
        const isNewUser = totalItems === 0 && activities.length === 0;

        // Build HTML
        let html = `
            <div class="quick-actions-view">
                <div class="qa-greeting-section">
                    <h1 class="qa-greeting">${greeting}</h1>
                    <p class="qa-subtitle">${isNewUser ? 'Willkommen! So funktioniert dein Workflow:' : 'Was möchten Sie tun?'}</p>
                </div>

                ${isNewUser ? `
                <div class="qa-onboarding" style="background: var(--accent-primary-light); border: 1px solid var(--accent-primary); border-radius: var(--border-radius); padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin-bottom: 12px; color: var(--accent-primary-hover);">Dein Workflow in 4 Schritten</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
                        <div style="text-align: center; padding: 12px;">
                            <div class="quick-action-icon">1. 📥</div>
                            <div style="font-weight: 600; margin: 4px 0;">Anfrage</div>
                            <div class="quick-action-label">Kundenanfrage erfassen</div>
                        </div>
                        <div style="text-align: center; padding: 12px;">
                            <div class="quick-action-icon">2. 📝</div>
                            <div style="font-weight: 600; margin: 4px 0;">Angebot</div>
                            <div class="quick-action-label">KI erstellt Angebot</div>
                        </div>
                        <div style="text-align: center; padding: 12px;">
                            <div class="quick-action-icon">3. ✅</div>
                            <div style="font-weight: 600; margin: 4px 0;">Auftrag</div>
                            <div class="quick-action-label">Angebot angenommen</div>
                        </div>
                        <div style="text-align: center; padding: 12px;">
                            <div class="quick-action-icon">4. 💰</div>
                            <div style="font-weight: 600; margin: 4px 0;">Rechnung</div>
                            <div class="quick-action-label">Automatisch erstellt</div>
                        </div>
                    </div>
                    <p style="text-align: center; margin-top: 12px; font-size: 13px; color: var(--text-secondary);">
                        Starte mit einer neuen Anfrage oder probiere den Demo-Workflow aus!
                    </p>
                </div>
                ` : ''}

                <div class="qa-cards-grid">
                    <button class="qa-card" id="qa-neuer-kunde" title="Neuen Kunden hinzufügen">
                        <div class="qa-card-icon">👤</div>
                        <div class="qa-card-label">Neuer Kunde</div>
                    </button>
                    <button class="qa-card" id="qa-neues-angebot" title="Neues Angebot erstellen">
                        <div class="qa-card-icon">📝</div>
                        <div class="qa-card-label">Neues Angebot</div>
                    </button>
                    <button class="qa-card" id="qa-neue-anfrage" title="Neue Anfrage erfassen">
                        <div class="qa-card-icon">📋</div>
                        <div class="qa-card-label">Neue Anfrage</div>
                    </button>
                    <button class="qa-card" id="qa-neue-rechnung" title="Neue Rechnung schreiben">
                        <div class="qa-card-icon">💶</div>
                        <div class="qa-card-label">Neue Rechnung</div>
                    </button>
                </div>

                <div class="qa-activities-section">
                    <h2 class="qa-section-title">Letzte Aktivitäten</h2>
                    <div class="qa-activities-list" id="qa-activities-list">
                        ${renderActivitiesList(activities)}
                    </div>
                </div>

                <div class="qa-stats-section">
                    <button class="qa-stat-badge" id="qa-stat-anfragen" data-navigate="anfragen" title="Alle offenen Anfragen anzeigen">
                        <span class="qa-stat-value">${offeneAnfragen}</span>
                        <span class="qa-stat-label">Offene Anfrage${offeneAnfragen !== 1 ? 'n' : ''}</span>
                    </button>
                    <button class="qa-stat-badge" id="qa-stat-angebote" data-navigate="angebote" title="Alle wartenden Angebote anzeigen">
                        <span class="qa-stat-value">${wartendeAngebote}</span>
                        <span class="qa-stat-label">Wartende Angebot${wartendeAngebote !== 1 ? 'e' : ''}</span>
                    </button>
                    <button class="qa-stat-badge" id="qa-stat-auftraege" data-navigate="auftraege" title="Alle aktiven Aufträge anzeigen">
                        <span class="qa-stat-value">${aktiveAuftraege}</span>
                        <span class="qa-stat-label">Aktive Auftrag${aktiveAuftraege !== 1 ? 'e' : ''}</span>
                    </button>
                    <button class="qa-stat-badge" id="qa-stat-rechnungen" data-navigate="rechnungen" title="Alle offenen Rechnungen anzeigen">
                        <span class="qa-stat-value">${offeneRechnungen}</span>
                        <span class="qa-stat-label">Offene Rechnung${offeneRechnungen !== 1 ? 'en' : ''}</span>
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Attach event listeners
        attachQuickActionListeners();

    } catch (error) {
        if (window.errorHandler) {
            window.errorHandler.handle(error, 'initQuickActions', false);
        } else {
            console.error('initQuickActions failed:', error);
        }
    }
}

function getTimeBasedGreeting(userName) {
    const hour = new Date().getHours();
    let timeOfDay;

    if (hour < 12) {
        timeOfDay = 'Morgen';
    } else if (hour < 18) {
        timeOfDay = 'Tag';
    } else {
        timeOfDay = 'Abend';
    }

    return `Guten ${timeOfDay}, ${userName}!`;
}

function renderActivitiesList(activities) {
    if (!activities || activities.length === 0) {
        return '<p class="qa-empty-state">Noch keine Aktivitäten. Starten Sie mit einer neuen Anfrage!</p>';
    }

    return activities.map(activity => `
        <div class="qa-activity-item">
            <span class="qa-activity-icon">${activity.icon}</span>
            <div class="qa-activity-content">
                <div class="qa-activity-title">${window.UI?.sanitize?.(activity.title) || activity.title}</div>
                <div class="qa-activity-time">${window.UI?.getRelativeTime?.(activity.time) || ''}</div>
            </div>
        </div>
    `).join('');
}

function attachQuickActionListeners() {
    // Card buttons
    const neuerKundeBtn = document.getElementById('qa-neuer-kunde');
    const neuesAngebotBtn = document.getElementById('qa-neues-angebot');
    const neueAnfrageBtn = document.getElementById('qa-neue-anfrage');
    const neueRechnungBtn = document.getElementById('qa-neue-rechnung');

    if (neuerKundeBtn) {
        neuerKundeBtn.addEventListener('click', () => {
            // Open customer creation - use the existing button or modal
            const kundenBtn = document.querySelector('[data-view="kunden"]');
            if (kundenBtn) {kundenBtn.click();}
            // If customer creation has a specific button
            const btnNeuerKunde = document.getElementById('btn-neuer-kunde');
            if (btnNeuerKunde) {
                setTimeout(() => btnNeuerKunde.click(), 200);
            }
        });
    }

    if (neuesAngebotBtn) {
        neuesAngebotBtn.addEventListener('click', () => {
            // Navigate to Angebote view and trigger creation
            switchView('angebote');
            const btnNeuesAngebot = document.getElementById('btn-neues-angebot');
            if (btnNeuesAngebot) {
                setTimeout(() => btnNeuesAngebot.click(), 200);
            }
        });
    }

    if (neueAnfrageBtn) {
        neueAnfrageBtn.addEventListener('click', () => {
            // Navigate to Anfragen view and trigger creation
            switchView('anfragen');
            const btnNeueAnfrage = document.getElementById('btn-neue-anfrage');
            if (btnNeueAnfrage) {
                setTimeout(() => btnNeueAnfrage.click(), 200);
            }
        });
    }

    if (neueRechnungBtn) {
        neueRechnungBtn.addEventListener('click', () => {
            // Navigate to Rechnungen view and trigger creation
            switchView('rechnungen');
            const btnNeueRechnung = document.getElementById('btn-neue-rechnung');
            if (btnNeueRechnung) {
                setTimeout(() => btnNeueRechnung.click(), 200);
            }
        });
    }

    // Stat badges (navigate to respective views)
    document.querySelectorAll('.qa-stat-badge').forEach(badge => {
        badge.addEventListener('click', (e) => {
            const viewId = e.currentTarget.getAttribute('data-navigate');
            if (viewId) {
                switchView(viewId);
            }
        });
    });
}

// Export functions
window.QuickActionsModule = {
    init: initQuickActions,
    update: initQuickActions // Calling init also updates
};
