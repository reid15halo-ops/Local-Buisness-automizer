/* ============================================
   Quick Actions Module - Main Dashboard
   Home screen for non-technical Handwerker
   Boomer-friendly: big buttons, clear labels, obvious actions
   All CSS classes prefixed with 'dash-' to avoid conflicts
   ============================================ */

(function () {
    'use strict';

    // -- Inject scoped styles once --
    let stylesInjected = false;
    function injectDashboardStyles() {
        if (stylesInjected) {return;}
        stylesInjected = true;

        const style = document.createElement('style');
        style.id = 'dash-styles';
        style.textContent = `
            /* ---- Dashboard Layout ---- */
            .dash-root {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px 16px 40px;
                display: flex;
                flex-direction: column;
                gap: 24px;
            }

            /* ---- Greeting ---- */
            .dash-greeting-section {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                align-items: baseline;
                gap: 8px;
            }
            .dash-greeting {
                font-size: 1.65rem;
                font-weight: 700;
                color: var(--text-primary);
                margin: 0;
                line-height: 1.3;
            }
            .dash-date {
                font-size: 0.95rem;
                color: var(--text-secondary);
                white-space: nowrap;
            }

            /* ---- Alert Banner ---- */
            .dash-alerts {
                background: rgba(239, 68, 68, 0.08);
                border: 1px solid rgba(239, 68, 68, 0.25);
                border-radius: 10px;
                padding: 14px 18px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .dash-alert-item {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 0.92rem;
                color: #fca5a5;
            }
            .dash-alert-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #ef4444;
                flex-shrink: 0;
                animation: dash-pulse 2s ease-in-out infinite;
            }
            @keyframes dash-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }

            /* ---- KPI Cards ---- */
            .dash-kpi-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 14px;
            }
            .dash-kpi-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 18px 16px;
                cursor: pointer;
                transition: transform 0.15s, box-shadow 0.15s;
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .dash-kpi-card::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 4px;
                border-radius: 10px 0 0 10px;
            }
            .dash-kpi-card[data-color="teal"]::before { background: var(--accent-primary); }
            .dash-kpi-card[data-color="blue"]::before { background: #3b82f6; }
            .dash-kpi-card[data-color="amber"]::before { background: #f59e0b; }
            .dash-kpi-card[data-color="rose"]::before { background: #f43f5e; }
            .dash-kpi-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0,0,0,0.25);
            }
            .dash-kpi-icon {
                font-size: 1.3rem;
                opacity: 0.85;
            }
            .dash-kpi-value {
                font-size: 2rem;
                font-weight: 800;
                color: var(--text-primary);
                line-height: 1;
            }
            .dash-kpi-label {
                font-size: 0.9rem;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* ---- Financial Summary ---- */
            .dash-finance-row {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 14px;
            }
            .dash-finance-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 16px 18px;
                text-align: center;
            }
            .dash-finance-label {
                font-size: 0.8rem;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 6px;
            }
            .dash-finance-value {
                font-size: 1.35rem;
                font-weight: 700;
                color: var(--text-primary);
            }
            .dash-finance-value.dash-positive { color: #34d399; }
            .dash-finance-value.dash-negative { color: #f87171; }

            /* ---- Quick Actions Grid ---- */
            .dash-section-title {
                font-size: 1rem;
                font-weight: 600;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.8px;
                margin: 0 0 2px;
            }
            .dash-actions-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
            }
            .dash-action-btn {
                display: flex;
                align-items: center;
                gap: 12px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 18px 16px;
                cursor: pointer;
                transition: background 0.15s, border-color 0.15s, transform 0.1s;
                color: var(--text-primary);
                font-size: 0.95rem;
                font-weight: 600;
                text-align: left;
                font-family: inherit;
            }
            .dash-action-btn:hover {
                background: rgba(45, 212, 168, 0.06);
                border-color: var(--accent-primary);
                transform: translateY(-1px);
            }
            .dash-action-btn:active {
                transform: translateY(0);
            }
            .dash-action-btn--primary {
                background: rgba(45, 212, 168, 0.10);
                border-color: var(--accent-primary);
                grid-column: 1 / -1;
                justify-content: center;
                font-size: 1.1rem;
                padding: 22px 16px;
            }
            .dash-action-btn--primary:hover {
                background: rgba(45, 212, 168, 0.18);
            }
            .dash-action-icon {
                font-size: 1.5rem;
                flex-shrink: 0;
                width: 36px;
                text-align: center;
            }

            /* ---- Pipeline ---- */
            .dash-pipeline {
                display: flex;
                align-items: center;
                gap: 0;
                overflow-x: auto;
                padding: 4px 0;
            }
            .dash-pipeline-stage {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                min-width: 100px;
                flex: 1;
                position: relative;
            }
            .dash-pipeline-circle {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: var(--bg-card);
                border: 2px solid var(--border-color);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.3rem;
                font-weight: 700;
                color: var(--accent-primary);
                position: relative;
                z-index: 1;
            }
            .dash-pipeline-circle.dash-has-items {
                border-color: var(--accent-primary);
                background: rgba(45, 212, 168, 0.1);
            }
            .dash-pipeline-name {
                font-size: 0.85rem;
                color: var(--text-secondary);
                text-align: center;
                white-space: nowrap;
            }
            .dash-pipeline-arrow {
                flex-shrink: 0;
                width: 32px;
                height: 2px;
                background: var(--border-color);
                position: relative;
            }
            .dash-pipeline-arrow::after {
                content: '';
                position: absolute;
                right: 0;
                top: -4px;
                border: 5px solid transparent;
                border-left: 6px solid var(--border-color);
            }

            /* ---- Today's Agenda ---- */
            .dash-two-col {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
            }
            .dash-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 18px;
            }
            .dash-card-title {
                font-size: 0.9rem;
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .dash-agenda-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 10px 0;
                border-bottom: 1px solid rgba(255,255,255,0.04);
            }
            .dash-agenda-item:last-child { border-bottom: none; }
            .dash-agenda-time {
                font-size: 0.82rem;
                color: var(--accent-primary);
                font-weight: 600;
                min-width: 52px;
                flex-shrink: 0;
            }
            .dash-agenda-title {
                font-size: 0.9rem;
                color: var(--text-primary);
            }
            .dash-agenda-empty {
                color: var(--text-secondary);
                font-size: 0.9rem;
                padding: 12px 0;
                text-align: center;
            }

            /* ---- Activities ---- */
            .dash-activity-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 9px 0;
                border-bottom: 1px solid rgba(255,255,255,0.04);
            }
            .dash-activity-item:last-child { border-bottom: none; }
            .dash-activity-icon {
                font-size: 1rem;
                flex-shrink: 0;
                width: 24px;
                text-align: center;
                padding-top: 1px;
            }
            .dash-activity-text {
                flex: 1;
                font-size: 0.88rem;
                color: var(--text-primary);
                line-height: 1.4;
            }
            .dash-activity-time {
                font-size: 0.78rem;
                color: var(--text-secondary);
                white-space: nowrap;
                flex-shrink: 0;
            }

            /* ---- Responsive ---- */
            @media (max-width: 900px) {
                .dash-kpi-grid { grid-template-columns: repeat(2, 1fr); }
                .dash-finance-row { grid-template-columns: 1fr; }
                .dash-actions-grid { grid-template-columns: repeat(2, 1fr); }
                .dash-two-col { grid-template-columns: 1fr; }
            }
            @media (max-width: 500px) {
                .dash-kpi-grid { grid-template-columns: 1fr 1fr; }
                .dash-actions-grid { grid-template-columns: 1fr; }
                .dash-greeting { font-size: 1.3rem; }
                .dash-kpi-value { font-size: 1.5rem; }
                .dash-pipeline { flex-wrap: wrap; justify-content: center; }
                .dash-pipeline-arrow { display: none; }
            }
        `;
        document.head.appendChild(style);
    }

    // -- Helpers --
    const esc = (str) => (window.h || window.UI?.sanitize || ((s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')))(str);
    const fmtCurrency = (val) => (window.formatCurrency || window.AppUtils?.formatCurrency || ((v) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })))(val);
    const fmtDate = (val) => (window.formatDate || window.AppUtils?.formatDate || ((v) => new Date(v).toLocaleDateString('de-DE')))(val);
    const relTime = (val) => (window.UI?.getRelativeTime || window.getRelativeTime || ((v) => v ? new Date(v).toLocaleString('de-DE') : '-'))(val);

    function getTimeGreeting() {
        const h = new Date().getHours();
        if (h < 5) {return 'Gute Nacht';}
        if (h < 12) {return 'Guten Morgen';}
        if (h < 18) {return 'Guten Tag';}
        return 'Guten Abend';
    }

    function isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }

    function isThisMonth(dateStr) {
        if (!dateStr) {return false;}
        const d = new Date(dateStr);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }

    function navigateTo(viewId) {
        const sw = window.switchView || window.AppUtils?.switchView;
        if (sw) {sw(viewId);}
    }

    function clickBtn(id, delayMs) {
        const el = document.getElementById(id);
        if (el) {
            if (delayMs) {
                setTimeout(() => el.click(), delayMs);
            } else {
                el.click();
            }
        }
    }

    // -- Build alert items --
    function buildAlerts(store) {
        const alerts = [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Overdue invoices
        const overdueInvoices = (store.rechnungen || []).filter(r => {
            if (r.status !== 'offen') {return false;}
            if (!r.faelligkeitsdatum) {return false;}
            return new Date(r.faelligkeitsdatum) < today;
        });
        if (overdueInvoices.length > 0) {
            alerts.push(`${overdueInvoices.length} Rechnung${overdueInvoices.length > 1 ? 'en' : ''} \u00fcberf\u00e4llig`);
        }

        // New inquiries waiting > 24h
        const staleAnfragen = (store.anfragen || []).filter(a => {
            if (a.status !== 'neu') {return false;}
            const created = new Date(a.createdAt || a.datum || 0);
            return created < oneDayAgo;
        });
        if (staleAnfragen.length > 0) {
            alerts.push(`${staleAnfragen.length} Anfrage${staleAnfragen.length > 1 ? 'n' : ''} wartet seit \u00fcber 24h`);
        }

        // Get user name from admin settings or store
        const ap = StorageUtils.getJSON('freyai_admin_settings', {}, { service: 'quickActions' });
        const userName = ap.owner_name || store.settings?.owner || store.settings?.companyName || 'Chef';

        // Tasks overdue today
        const overdueTasks = (store.aufgaben || []).filter(t => {
            if (t.status === 'erledigt' || t.status === 'done') {return false;}
            if (!t.dueDate && !t.faellig) {return false;}
            const due = new Date(t.dueDate || t.faellig);
            return due < today;
        });
        if (overdueTasks.length > 0) {
            alerts.push(`${overdueTasks.length} Aufgabe${overdueTasks.length > 1 ? 'n' : ''} \u00fcberf\u00e4llig`);
        }

        return alerts;
    }

    // -- Build financial data --
    function buildFinancials(store) {
        const rechnungen = store.rechnungen || [];
        const buchungen = store.buchungen || [];

        // Revenue this month: sum of paid invoices this month
        const umsatz = rechnungen
            .filter(r => r.status === 'bezahlt' && isThisMonth(r.bezahltAm || r.datum || r.createdAt))
            .reduce((sum, r) => sum + (r.brutto || r.gesamtBrutto || 0), 0);

        // Outstanding: sum of open invoices
        const ausstehend = rechnungen
            .filter(r => r.status === 'offen')
            .reduce((sum, r) => sum + (r.brutto || r.gesamtBrutto || 0), 0);

        // Profit: if buchungen available, einnahmen - ausgaben this month
        let gewinn = null;
        if (buchungen.length > 0) {
            const thisMonthBuchungen = buchungen.filter(b => isThisMonth(b.datum));
            const einnahmen = thisMonthBuchungen
                .filter(b => b.typ === 'einnahme')
                .reduce((sum, b) => sum + (b.brutto || 0), 0);
            const ausgaben = thisMonthBuchungen
                .filter(b => b.typ === 'ausgabe')
                .reduce((sum, b) => sum + (b.brutto || 0), 0);
            gewinn = einnahmen - ausgaben;
        }

        return { umsatz, ausstehend, gewinn };
    }

    // -- Build today's agenda --
    function buildTodayAgenda(store) {
        const now = new Date();
        const items = [];

        // Termine today
        (store.termine || []).forEach(t => {
            const start = new Date(t.start || t.datum || t.date || 0);
            if (isSameDay(start, now)) {
                items.push({
                    time: start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                    title: t.titel || t.title || t.beschreibung || 'Termin',
                    sortKey: start.getTime(),
                    type: 'termin'
                });
            }
        });

        // Tasks due today
        (store.aufgaben || []).forEach(t => {
            if (t.status === 'erledigt' || t.status === 'done') {return;}
            const due = new Date(t.dueDate || t.faellig || 0);
            if (isSameDay(due, now)) {
                items.push({
                    time: 'Aufgabe',
                    title: t.title || t.titel || t.beschreibung || 'Aufgabe',
                    sortKey: due.getTime(),
                    type: 'task'
                });
            }
        });

        items.sort((a, b) => a.sortKey - b.sortKey);
        return items;
    }

    // -- Build pipeline counts --
    function buildPipeline(store) {
        const anfragen = (store.anfragen || []).filter(a => a.status === 'neu').length;
        const kiVorschlag = (store.anfragen || []).filter(a => a.status === 'ki_vorschlag' || a.status === 'vorschlag').length;
        const angebote = (store.angebote || []).filter(a => a.status === 'offen' || a.status === 'gesendet').length;
        const auftraege = (store.auftraege || []).filter(a => a.status === 'aktiv' || a.status === 'in_arbeit' || a.status === 'geplant').length;
        const rechnungen = (store.rechnungen || []).filter(r => r.status === 'offen').length;
        return [
            { name: 'Anfrage', icon: '\ud83d\udce5', count: anfragen },
            { name: 'KI-Vorschlag', icon: '\ud83e\udde0', count: kiVorschlag },
            { name: 'Angebot', icon: '\ud83d\udcdd', count: angebote },
            { name: 'Auftrag', icon: '\ud83d\udee0\ufe0f', count: auftraege },
            { name: 'Rechnung', icon: '\ud83d\udcb0', count: rechnungen }
        ];
    }

    // -- Main render --
    function initQuickActions() {
        try {
            const container = document.getElementById('quick-actions-container');
            if (!container) {
                console.warn('Quick Actions container not found');
                return;
            }

            injectDashboardStyles();

            const store = window.storeService?.state || {};
            const ap = (() => { try { return JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}'); } catch { return {}; } })();
            const userName = ap.owner_name || store.settings?.owner || store.settings?.companyName || 'Chef';
            const companyName = ap.company_name || store.settings?.companyName || '';

            const greeting = getTimeGreeting();
            const todayStr = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            // KPI data
            const offeneAnfragen = (store.anfragen || []).filter(a => a.status === 'neu').length;
            const wartendeAngebote = (store.angebote || []).filter(a => a.status === 'offen' || a.status === 'gesendet').length;
            const aktiveAuftraege = (store.auftraege || []).filter(a => a.status !== 'abgeschlossen' && a.status !== 'storniert').length;
            const offeneRechnungen = (store.rechnungen || []).filter(r => r.status === 'offen').length;

            // Alerts
            const alerts = buildAlerts(store);

            // Financials
            const fin = buildFinancials(store);

            // Today agenda
            const agenda = buildTodayAgenda(store);

            // Pipeline
            const pipeline = buildPipeline(store);

            // Activities (last 8)
            const activities = (store.activities || []).slice(0, 8);

            // ---- Build HTML ----
            let html = '<div class="dash-root">';

            // 1. Greeting
            html += `
                <div class="dash-greeting-section">
                    <h1 class="dash-greeting">${greeting}, ${esc(userName)}!</h1>
                    <span class="dash-date">${esc(todayStr)}</span>
                </div>
            `;

            // 2. Alert Banner (only if alerts exist)
            if (alerts.length > 0) {
                html += '<div class="dash-alerts">';
                alerts.forEach(msg => {
                    html += `<div class="dash-alert-item"><span class="dash-alert-dot"></span>${esc(msg)}</div>`;
                });
                html += '</div>';
            }

            // 3. KPI Cards
            html += `
                <div class="dash-kpi-grid">
                    <div class="dash-kpi-card" data-color="teal" data-nav="anfragen" title="Alle offenen Anfragen anzeigen" role="button" tabindex="0" aria-label="${offeneAnfragen} offene Anfragen anzeigen">
                        <span class="dash-kpi-icon">\ud83d\udce5</span>
                        <span class="dash-kpi-value">${offeneAnfragen}</span>
                        <span class="dash-kpi-label">Offene Anfragen</span>
                    </div>
                    <div class="dash-kpi-card" data-color="blue" data-nav="angebote" title="Alle wartenden Angebote anzeigen" role="button" tabindex="0" aria-label="${wartendeAngebote} wartende Angebote anzeigen">
                        <span class="dash-kpi-icon">\ud83d\udcdd</span>
                        <span class="dash-kpi-value">${wartendeAngebote}</span>
                        <span class="dash-kpi-label">Wartende Angebote</span>
                    </div>
                    <div class="dash-kpi-card" data-color="amber" data-nav="auftraege" title="Alle aktiven Auftr\u00e4ge anzeigen" role="button" tabindex="0" aria-label="${aktiveAuftraege} aktive Auftraege anzeigen">
                        <span class="dash-kpi-icon">\ud83d\udee0\ufe0f</span>
                        <span class="dash-kpi-value">${aktiveAuftraege}</span>
                        <span class="dash-kpi-label">Aktive Auftr\u00e4ge</span>
                    </div>
                    <div class="dash-kpi-card" data-color="rose" data-nav="rechnungen" title="Alle offenen Rechnungen anzeigen" role="button" tabindex="0" aria-label="${offeneRechnungen} offene Rechnungen anzeigen">
                        <span class="dash-kpi-icon">\ud83d\udcb0</span>
                        <span class="dash-kpi-value">${offeneRechnungen}</span>
                        <span class="dash-kpi-label">Offene Rechnungen</span>
                    </div>
                </div>
            `;

            // 4. Financial Summary
            const gewinnClass = fin.gewinn !== null ? (fin.gewinn >= 0 ? 'dash-positive' : 'dash-negative') : '';
            html += `
                <div class="dash-finance-row">
                    <div class="dash-finance-card">
                        <div class="dash-finance-label">Umsatz diesen Monat</div>
                        <div class="dash-finance-value dash-positive">${fmtCurrency(fin.umsatz)}</div>
                    </div>
                    <div class="dash-finance-card">
                        <div class="dash-finance-label">Ausstehend</div>
                        <div class="dash-finance-value${fin.ausstehend > 0 ? ' dash-negative' : ''}">${fmtCurrency(fin.ausstehend)}</div>
                    </div>
                    <div class="dash-finance-card">
                        <div class="dash-finance-label">Gewinn diesen Monat</div>
                        <div class="dash-finance-value ${gewinnClass}">${fin.gewinn !== null ? fmtCurrency(fin.gewinn) : '\u2013'}</div>
                    </div>
                </div>
            `;

            // 5. Quick Actions Grid
            html += `
                <div>
                    <h2 class="dash-section-title">Schnellaktionen</h2>
                    <div class="dash-actions-grid">
                        <button class="dash-action-btn dash-action-btn--primary" data-action="rechnung-scannen" title="Rechnung mit Kamera oder Datei scannen">
                            <span class="dash-action-icon">\ud83d\udcf7</span>
                            <span>Rechnung scannen</span>
                        </button>
                        <button class="dash-action-btn" data-action="neue-anfrage" title="Neue Anfrage erfassen">
                            <span class="dash-action-icon">\ud83d\udcdd</span>
                            <span>Neue Anfrage</span>
                        </button>
                        <button class="dash-action-btn" data-action="neues-angebot" title="Neues Angebot erstellen">
                            <span class="dash-action-icon">\ud83d\udccb</span>
                            <span>Neues Angebot</span>
                        </button>
                        <button class="dash-action-btn" data-action="neue-rechnung" title="Neue Rechnung schreiben">
                            <span class="dash-action-icon">\ud83d\udcb6</span>
                            <span>Neue Rechnung</span>
                        </button>
                        <button class="dash-action-btn" data-action="neuer-kunde" title="Neuen Kunden anlegen">
                            <span class="dash-action-icon">\ud83d\udc64</span>
                            <span>Neuer Kunde</span>
                        </button>
                        <button class="dash-action-btn" data-action="termin-buchen" title="Zum Kalender wechseln">
                            <span class="dash-action-icon">\ud83d\udcc5</span>
                            <span>Termin buchen</span>
                        </button>
                        <button class="dash-action-btn" data-action="ausgabe-erfassen" title="Ausgabe in der Buchhaltung erfassen">
                            <span class="dash-action-icon">\ud83d\udcc9</span>
                            <span>Ausgabe erfassen</span>
                        </button>
                        <button class="dash-action-btn" data-action="kunde-anschreiben" title="E-Mail an einen Kunden senden">
                            <span class="dash-action-icon">\u2709\ufe0f</span>
                            <span>Kunde anschreiben</span>
                        </button>
                    </div>
                </div>
            `;

            // 6. Today's Agenda + 8. Recent Activities (side by side)
            html += '<div class="dash-two-col">';

            // Agenda
            html += '<div class="dash-card"><div class="dash-card-title">\ud83d\udcc6 Heute</div>';
            if (agenda.length === 0) {
                html += '<div class="dash-agenda-empty">Keine Termine heute \u2013 Zeit zum Durchatmen! \u2615</div>';
            } else {
                agenda.forEach(item => {
                    html += `
                        <div class="dash-agenda-item">
                            <span class="dash-agenda-time">${esc(item.time)}</span>
                            <span class="dash-agenda-title">${esc(item.title)}</span>
                        </div>
                    `;
                });
            }
            html += '</div>';

            // Activities
            html += '<div class="dash-card"><div class="dash-card-title">\ud83d\udccc Letzte Aktivit\u00e4ten</div>';
            if (activities.length === 0) {
                html += '<div class="dash-agenda-empty">Noch keine Aktivit\u00e4ten vorhanden.</div>';
            } else {
                activities.forEach(a => {
                    const icon = a.icon || '\u2022';
                    const title = a.title || a.text || '';
                    const time = a.time || a.timestamp || '';
                    html += `
                        <div class="dash-activity-item">
                            <span class="dash-activity-icon">${esc(icon)}</span>
                            <span class="dash-activity-text">${esc(title)}</span>
                            <span class="dash-activity-time">${esc(String(relTime(time)))}</span>
                        </div>
                    `;
                });
            }
            html += '</div>';
            html += '</div>'; // close dash-two-col

            // 7. Workflow Pipeline
            html += `
                <div>
                    <h2 class="dash-section-title">Workflow-Pipeline</h2>
                    <div class="dash-pipeline">
            `;
            pipeline.forEach((stage, i) => {
                html += `
                    <div class="dash-pipeline-stage">
                        <div class="dash-pipeline-circle${stage.count > 0 ? ' dash-has-items' : ''}">${stage.count}</div>
                        <span class="dash-pipeline-name">${stage.icon} ${esc(stage.name)}</span>
                    </div>
                `;
                if (i < pipeline.length - 1) {
                    html += '<div class="dash-pipeline-arrow"></div>';
                }
            });
            html += '</div></div>';

            html += '</div>'; // close dash-root

            container.innerHTML = html;

            // ---- Attach event listeners ----
            attachDashboardListeners(container);

        } catch (error) {
            if (window.errorHandler) {
                window.errorHandler.handle(error, 'initQuickActions', false);
            } else {
                console.error('initQuickActions failed:', error);
            }
        }
    }

    function attachDashboardListeners(root) {
        // KPI cards -> navigate to view (click + keyboard)
        root.querySelectorAll('.dash-kpi-card[data-nav]').forEach(card => {
            const handler = () => navigateTo(card.getAttribute('data-nav'));
            card.addEventListener('click', handler);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
            });
        });

        // Quick action buttons
        root.querySelectorAll('.dash-action-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                switch (action) {
                    case 'rechnung-scannen':
                        navigateTo('scanner');
                        break;
                    case 'neue-anfrage':
                        navigateTo('anfragen');
                        clickBtn('btn-neue-anfrage', 250);
                        break;
                    case 'neues-angebot':
                        navigateTo('angebote');
                        clickBtn('btn-neues-angebot', 250);
                        break;
                    case 'neue-rechnung':
                        navigateTo('rechnungen');
                        clickBtn('btn-neue-rechnung', 250);
                        break;
                    case 'neuer-kunde':
                        navigateTo('kunden');
                        clickBtn('btn-neuer-kunde', 250);
                        break;
                    case 'termin-buchen':
                        navigateTo('kalender');
                        break;
                    case 'ausgabe-erfassen':
                        navigateTo('buchhaltung');
                        break;
                    case 'kunde-anschreiben':
                        openEmailComposeModal();
                        break;
                }
            });
        });
    }

    // -- "Kunde anschreiben" compose modal --
    function openEmailComposeModal() {
        // Remove any existing modal
        const existing = document.getElementById('dash-email-modal');
        if (existing) {existing.remove();}

        const customers = (window.customerService?.getAllCustomers?.() || [])
            .filter(c => c.email);

        // Email templates from emailService
        const templates = window.emailService?.templates || {};
        const templateKeys = Object.keys(templates);

        // Build customer <option> list
        let customerOpts = '<option value="">-- Kunde w\u00e4hlen --</option>';
        customers.forEach(c => {
            customerOpts += `<option value="${esc(c.email)}" data-name="${esc(c.name)}">${esc(c.name)} (${esc(c.email)})</option>`;
        });

        // Build template <option> list
        let templateOpts = '<option value="">-- Kein Template --</option>';
        templateKeys.forEach(key => {
            const t = templates[key];
            templateOpts += `<option value="${esc(key)}">${esc(t.name)}</option>`;
        });

        const overlay = document.createElement('div');
        overlay.id = 'dash-email-modal';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px;';

        overlay.innerHTML = `
            <div style="background:var(--bg-card,#1a2332);border:1px solid var(--border-color,#2a3a4a);border-radius:12px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:24px;position:relative;color:var(--text-primary,#e2e8f0);">
                <button id="dash-email-close" style="position:absolute;top:12px;right:14px;background:none;border:none;color:var(--text-secondary,#94a3b8);font-size:1.5rem;cursor:pointer;line-height:1;" title="Schlie\u00dfen">&times;</button>
                <h2 style="margin:0 0 18px;font-size:1.2rem;font-weight:700;">Kunde anschreiben</h2>

                <label style="display:block;font-size:0.85rem;color:var(--text-secondary,#94a3b8);margin-bottom:4px;">Empf\u00e4nger</label>
                <select id="dash-email-to" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border-color,#2a3a4a);background:var(--bg-input,#0f1923);color:var(--text-primary,#e2e8f0);font-size:0.95rem;margin-bottom:12px;">
                    ${customerOpts}
                </select>

                <label style="display:block;font-size:0.85rem;color:var(--text-secondary,#94a3b8);margin-bottom:4px;">Oder E-Mail-Adresse eingeben</label>
                <input id="dash-email-to-manual" type="email" placeholder="max@beispiel.de" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border-color,#2a3a4a);background:var(--bg-input,#0f1923);color:var(--text-primary,#e2e8f0);font-size:0.95rem;margin-bottom:12px;box-sizing:border-box;">

                <label style="display:block;font-size:0.85rem;color:var(--text-secondary,#94a3b8);margin-bottom:4px;">Vorlage (optional)</label>
                <select id="dash-email-template" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border-color,#2a3a4a);background:var(--bg-input,#0f1923);color:var(--text-primary,#e2e8f0);font-size:0.95rem;margin-bottom:12px;">
                    ${templateOpts}
                </select>

                <label style="display:block;font-size:0.85rem;color:var(--text-secondary,#94a3b8);margin-bottom:4px;">Betreff</label>
                <input id="dash-email-subject" type="text" placeholder="Betreff eingeben" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border-color,#2a3a4a);background:var(--bg-input,#0f1923);color:var(--text-primary,#e2e8f0);font-size:0.95rem;margin-bottom:12px;box-sizing:border-box;">

                <label style="display:block;font-size:0.85rem;color:var(--text-secondary,#94a3b8);margin-bottom:4px;">Nachricht</label>
                <textarea id="dash-email-body" rows="6" placeholder="Ihre Nachricht..." style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border-color,#2a3a4a);background:var(--bg-input,#0f1923);color:var(--text-primary,#e2e8f0);font-size:0.95rem;margin-bottom:16px;resize:vertical;font-family:inherit;box-sizing:border-box;"></textarea>

                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button id="dash-email-cancel" style="padding:10px 20px;border-radius:8px;border:1px solid var(--border-color,#2a3a4a);background:transparent;color:var(--text-secondary,#94a3b8);cursor:pointer;font-size:0.95rem;">Abbrechen</button>
                    <button id="dash-email-send" style="padding:10px 24px;border-radius:8px;border:none;background:var(--accent-primary,#2dd4a8);color:#0f1923;font-weight:700;cursor:pointer;font-size:0.95rem;">Senden</button>
                </div>
                <div id="dash-email-status" style="margin-top:10px;font-size:0.88rem;text-align:center;min-height:1.2em;"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        // --- Event wiring ---
        const closeModal = () => overlay.remove();
        document.getElementById('dash-email-close').addEventListener('click', closeModal);
        document.getElementById('dash-email-cancel').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) {closeModal();} });

        // Template selection fills subject + body
        document.getElementById('dash-email-template').addEventListener('change', function () {
            const key = this.value;
            if (!key || !templates[key]) {return;}
            const t = templates[key];
            // Get selected customer name for placeholder replacement
            const toSelect = document.getElementById('dash-email-to');
            const selOption = toSelect.selectedOptions[0];
            const kundeName = selOption?.dataset?.name || '';
            const filled = window.emailService?.fillTemplate?.(key, { kundeName }) || { subject: t.subject, body: t.body };
            document.getElementById('dash-email-subject').value = filled.subject;
            document.getElementById('dash-email-body').value = filled.body;
        });

        // Send button
        document.getElementById('dash-email-send').addEventListener('click', async function () {
            const statusEl = document.getElementById('dash-email-status');
            const toSelect = document.getElementById('dash-email-to').value;
            const toManual = document.getElementById('dash-email-to-manual').value.trim();
            const to = toManual || toSelect;
            const subject = document.getElementById('dash-email-subject').value.trim();
            const bodyText = document.getElementById('dash-email-body').value.trim();

            if (!to) {
                statusEl.textContent = 'Bitte einen Empf\u00e4nger w\u00e4hlen oder eingeben.';
                statusEl.style.color = '#f87171';
                return;
            }
            if (!subject) {
                statusEl.textContent = 'Bitte einen Betreff eingeben.';
                statusEl.style.color = '#f87171';
                return;
            }
            if (!bodyText) {
                statusEl.textContent = 'Bitte eine Nachricht eingeben.';
                statusEl.style.color = '#f87171';
                return;
            }

            // Basic email validation
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
                statusEl.textContent = 'Ung\u00fcltige E-Mail-Adresse.';
                statusEl.style.color = '#f87171';
                return;
            }

            // Check if relay is configured
            const relayUrl = window.APP_CONFIG?.EMAIL_RELAY_URL;
            if (!relayUrl) {
                // Fallback: open mailto link (works on mobile)
                const mailtoUrl = 'mailto:' + encodeURIComponent(to)
                    + '?subject=' + encodeURIComponent(subject)
                    + '&body=' + encodeURIComponent(bodyText);
                window.open(mailtoUrl, '_blank');
                statusEl.textContent = 'E-Mail-Programm ge\u00f6ffnet.';
                statusEl.style.color = '#34d399';
                setTimeout(closeModal, 1500);
                return;
            }

            // Send via email relay
            this.disabled = true;
            this.textContent = 'Sende...';
            statusEl.textContent = '';

            // Convert plain text to simple HTML (escape for XSS safety)
            const safeBody = esc(bodyText).replace(/\n/g, '<br>');
            const htmlBody = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;">' + safeBody + '</div>';

            try {
                const result = await window.emailService.sendEmail(to, subject, htmlBody);
                if (result.success) {
                    statusEl.textContent = 'E-Mail gesendet!';
                    statusEl.style.color = '#34d399';
                    setTimeout(closeModal, 1500);
                } else {
                    statusEl.textContent = result.error || 'Fehler beim Senden.';
                    statusEl.style.color = '#f87171';
                    this.disabled = false;
                    this.textContent = 'Senden';
                }
            } catch (err) {
                statusEl.textContent = 'Netzwerkfehler: ' + (err.message || 'Unbekannt');
                statusEl.style.color = '#f87171';
                this.disabled = false;
                this.textContent = 'Senden';
            }
        });
    }

    // -- Export --
    window.QuickActionsModule = {
        init: initQuickActions,
        update: initQuickActions
    };

})();
