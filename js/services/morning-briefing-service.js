/* ============================================
   Morning Briefing Service - Tagesbriefing
   Daily business summary agent that gathers
   data from all services and generates a
   comprehensive morning briefing.
   ============================================ */

class MorningBriefingService {
    constructor() {
        this.STORAGE_KEY = 'freyai_morning_briefing';
        this.LAST_DATE_KEY = 'freyai_morning_briefing_date';
        this.cachedBriefing = null;

        // Load cached briefing from localStorage
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.cachedBriefing = JSON.parse(stored);
            }
        } catch { this.cachedBriefing = null; }

        // Auto-generate on first app open of the day
        this._autoGenerateIfNeeded();
    }

    // ============================================
    // Auto-Generate Check
    // ============================================

    _autoGenerateIfNeeded() {
        const today = new Date().toISOString().split('T')[0];
        const lastDate = localStorage.getItem(this.LAST_DATE_KEY);

        if (lastDate !== today) {
            // Delay to let other services initialize
            setTimeout(() => {
                this.generateBriefing().catch(err => {
                    console.warn('[MorningBriefing] Auto-generate fehlgeschlagen:', err);
                });
            }, 3000);
        }
    }

    // ============================================
    // Data Gathering (null-safe)
    // ============================================

    _getOverdueInvoices() {
        const rechnungen = window.storeService?.store?.rechnungen || [];
        const today = new Date();
        const overdue = rechnungen.filter(r => {
            if (r.status === 'bezahlt' || r.status === 'storniert') {return false;}
            if (r.faelligkeitsdatum) {
                const due = new Date(r.faelligkeitsdatum);
                return !isNaN(due.getTime()) && due < today;
            }
            // Fallback: check created_at + zahlungsziel_tage
            if (r.created_at && r.zahlungsziel_tage) {
                const created = new Date(r.created_at);
                const due = new Date(created.getTime() + r.zahlungsziel_tage * 86400000);
                return !isNaN(due.getTime()) && due < today;
            }
            return false;
        });
        const total = overdue.reduce((sum, r) => sum + (parseFloat(r.brutto) || parseFloat(r.betrag) || 0), 0);
        return { count: overdue.length, total: Math.round(total * 100) / 100, items: overdue.slice(0, 5) };
    }

    _getNewInquiries() {
        const anfragen = window.storeService?.store?.anfragen || [];
        const newOnes = anfragen.filter(a => a.status === 'neu');
        return {
            count: newOnes.length,
            items: newOnes.slice(0, 5).map(a => ({
                id: a.id,
                kunde: a.kunde_name || a.kundeName || 'Unbekannt',
                leistung: a.leistungsart || a.beschreibung || '',
                datum: a.created_at || a.erstelltAm || ''
            }))
        };
    }

    _getActiveOrders() {
        const auftraege = window.storeService?.store?.auftraege || [];
        const active = auftraege.filter(a => a.status === 'aktiv' || a.status === 'in_bearbeitung' || a.status === 'laufend');
        return { count: active.length };
    }

    _getPendingQuotes() {
        const angebote = window.storeService?.store?.angebote || [];
        const pending = angebote.filter(a => a.status === 'offen' || a.status === 'versendet' || a.status === 'erstellt');
        const today = new Date();
        const expiringCount = pending.filter(a => {
            if (a.gueltigBis || a.gueltig_bis) {
                const expiry = new Date(a.gueltigBis || a.gueltig_bis);
                const threeDays = new Date(today.getTime() + 3 * 86400000);
                return !isNaN(expiry.getTime()) && expiry <= threeDays;
            }
            return false;
        }).length;
        return { count: pending.length, expiringCount };
    }

    _getTodaysAppointments() {
        const cal = window.calendarService;
        if (!cal) {return { count: 0, items: [] };}
        try {
            const today = new Date().toISOString().split('T')[0];
            const apts = cal.getAppointmentsForDay ? cal.getAppointmentsForDay(today) : [];
            return {
                count: apts.length,
                items: apts.slice(0, 5).map(a => ({
                    title: a.title || 'Termin',
                    time: a.startTime || '',
                    location: a.location || '',
                    customer: a.customerName || ''
                }))
            };
        } catch { return { count: 0, items: [] }; }
    }

    _getMonthlyRevenue() {
        const bs = window.bookkeepingService;
        if (!bs) {return 0;}
        try {
            const year = new Date().getFullYear();
            const eur = bs.berechneEUR ? bs.berechneEUR(year) : null;
            return eur?.einnahmen?.brutto || 0;
        } catch { return 0; }
    }

    _getCashflowStatus() {
        const cf = window.cashFlowService || window.cashflowService;
        if (!cf) {return 'unknown';}
        try {
            const snapshot = cf.getCurrentSnapshot ? cf.getCurrentSnapshot() : null;
            if (!snapshot) {return 'unknown';}
            const balance = snapshot.currentBalance || 0;
            const buffer = cf.settings?.safetyBuffer || 5000;
            if (balance >= buffer * 2) {return 'healthy';}
            if (balance >= buffer) {return 'warning';}
            return 'critical';
        } catch { return 'unknown'; }
    }

    _getTeamOnDuty() {
        const tm = window.teamManagementService;
        if (!tm) {return { count: 0, members: [] };}
        try {
            const members = tm.teamData?.members || [];
            const active = members.filter(m => m.status === 'aktiv' || m.aktiv !== false);
            return {
                count: active.length,
                members: active.slice(0, 5).map(m => ({
                    name: m.name || m.vorname || 'Unbekannt',
                    role: m.rolle || m.role || ''
                }))
            };
        } catch { return { count: 0, members: [] }; }
    }

    _getOfflineQueuePending() {
        const fa = window.fieldAppService;
        if (!fa) {return 0;}
        try {
            return (fa.offlineQueue || []).length;
        } catch { return 0; }
    }

    // ============================================
    // Alert Generation
    // ============================================

    _generateAlerts(data) {
        const alerts = [];

        if (data.overdueInvoices.count > 0) {
            alerts.push({
                type: 'warning',
                icon: '\u26A0\uFE0F',
                text: `${data.overdueInvoices.count} ueberfaellige Rechnung(en) (${data.overdueInvoices.total.toFixed(2)} EUR)`
            });
        }

        if (data.pendingQuotes.expiringCount > 0) {
            alerts.push({
                type: 'warning',
                icon: '\u23F0',
                text: `${data.pendingQuotes.expiringCount} Angebot(e) laufen in 3 Tagen ab`
            });
        }

        if (data.cashflowStatus === 'critical') {
            alerts.push({
                type: 'danger',
                icon: '\u{1F6A8}',
                text: 'Cashflow kritisch - Liquiditaet pruefen!'
            });
        }

        if (data.offlineQueuePending > 0) {
            alerts.push({
                type: 'info',
                icon: '\u{1F4F1}',
                text: `${data.offlineQueuePending} Offline-Eintraege warten auf Synchronisation`
            });
        }

        return alerts;
    }

    // ============================================
    // Recommendation Generation
    // ============================================

    _generateRecommendations(data) {
        const recs = [];

        if (data.newInquiries.count > 0) {
            recs.push(`${data.newInquiries.count} neue Anfrage(n) bearbeiten, um Reaktionszeit zu optimieren.`);
        }

        if (data.overdueInvoices.count > 3) {
            recs.push('Mahnlauf starten: Mehrere ueberfaellige Rechnungen ausstehend.');
        }

        if (data.pendingQuotes.count > 5) {
            recs.push('Angebotsliste aufraumen: Viele wartende Angebote pruefen.');
        }

        if (data.todaysAppointments.count === 0) {
            recs.push('Keine Termine heute - Zeit fuer Verwaltung oder Akquise nutzen.');
        }

        if (data.cashflowStatus === 'warning') {
            recs.push('Cashflow beobachten: Puffer wird knapp. Zahlungseingaenge pruefen.');
        }

        return recs;
    }

    // ============================================
    // Greeting
    // ============================================

    _getGreeting() {
        const hour = new Date().getHours();
        let timeOfDay = 'Tag';
        if (hour < 12) {timeOfDay = 'Morgen';}
        else if (hour < 18) {timeOfDay = 'Tag';}
        else {timeOfDay = 'Abend';}

        const ownerName = window.storeService?.store?.settings?.owner
            || window.storeService?.store?.settings?.companyName
            || 'Chef';

        return `Guten ${timeOfDay}, ${ownerName}!`;
    }

    // ============================================
    // Main Generation
    // ============================================

    async generateBriefing() {
        const today = new Date().toISOString().split('T')[0];

        // Gather all data
        const overdueInvoices = this._getOverdueInvoices();
        const newInquiries = this._getNewInquiries();
        const activeOrders = this._getActiveOrders();
        const pendingQuotes = this._getPendingQuotes();
        const todaysAppointments = this._getTodaysAppointments();
        const monthlyRevenue = this._getMonthlyRevenue();
        const cashflowStatus = this._getCashflowStatus();
        const teamOnDuty = this._getTeamOnDuty();
        const offlineQueuePending = this._getOfflineQueuePending();

        const summaryData = {
            overdueInvoices,
            newInquiries,
            activeOrders,
            pendingQuotes,
            todaysAppointments,
            monthlyRevenue,
            cashflowStatus,
            teamOnDuty,
            offlineQueuePending
        };

        const alerts = this._generateAlerts(summaryData);
        let recommendations = this._generateRecommendations(summaryData);

        // Optional AI enhancement via Gemini
        let aiSummary = null;
        try {
            if (window.geminiService?.isConfigured) {
                aiSummary = await this._getAISummary(summaryData, alerts);
                if (aiSummary?.recommendations) {
                    recommendations = [...recommendations, ...aiSummary.recommendations];
                }
            }
        } catch {
            // AI enhancement optional - continue without
        }

        const briefing = {
            date: today,
            greeting: this._getGreeting(),
            summary: {
                overdueInvoices: { count: overdueInvoices.count, total: overdueInvoices.total },
                newInquiries: { count: newInquiries.count, items: newInquiries.items },
                todaysAppointments: { count: todaysAppointments.count, items: todaysAppointments.items },
                activeOrders: { count: activeOrders.count },
                pendingQuotes: { count: pendingQuotes.count, expiringCount: pendingQuotes.expiringCount },
                monthlyRevenue: monthlyRevenue,
                cashflowStatus: cashflowStatus,
                teamOnDuty: { count: teamOnDuty.count, members: teamOnDuty.members },
                offlineQueuePending: offlineQueuePending
            },
            alerts,
            recommendations,
            aiNarrative: aiSummary?.narrative || null,
            generatedAt: new Date().toISOString()
        };

        // Cache
        this.cachedBriefing = briefing;
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(briefing));
            localStorage.setItem(this.LAST_DATE_KEY, today);
        } catch { /* Storage full - ignore */ }

        // Dispatch event for UI updates
        document.dispatchEvent(new CustomEvent('morningBriefing:generated', { detail: briefing }));

        return briefing;
    }

    // ============================================
    // AI Enhancement (Gemini)
    // ============================================

    async _getAISummary(data, alerts) {
        const gs = window.geminiService;
        if (!gs || !gs.isConfigured) {return null;}

        const prompt = `Du bist ein Business-Assistent. Erstelle eine kurze, natuerliche Zusammenfassung (3-5 Saetze) des Geschaeftstages auf Deutsch. Daten:
- Ueberfaellige Rechnungen: ${data.overdueInvoices.count} (${data.overdueInvoices.total} EUR)
- Neue Anfragen: ${data.newInquiries.count}
- Termine heute: ${data.todaysAppointments.count}
- Aktive Auftraege: ${data.activeOrders.count}
- Offene Angebote: ${data.pendingQuotes.count} (${data.pendingQuotes.expiringCount} bald ablaufend)
- Monatsumsatz: ${data.monthlyRevenue} EUR
- Cashflow: ${data.cashflowStatus}
- Team: ${data.teamOnDuty.count} Mitarbeiter aktiv
- Warnungen: ${alerts.map(a => a.text).join('; ')}

Gib auch 1-2 zusaetzliche Handlungsempfehlungen als JSON-Array "recommendations" zurueck.
Antwort-Format: { "narrative": "...", "recommendations": ["...", "..."] }`;

        try {
            const result = await gs.generateText(prompt);
            if (result) {
                // Try to parse as JSON
                try {
                    const jsonMatch = result.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        return JSON.parse(jsonMatch[0]);
                    }
                } catch {
                    return { narrative: result, recommendations: [] };
                }
            }
        } catch { /* ignore */ }
        return null;
    }

    // ============================================
    // Cached Access
    // ============================================

    getCachedBriefing() {
        return this.cachedBriefing;
    }

    isTodaysBriefing() {
        if (!this.cachedBriefing) {return false;}
        const today = new Date().toISOString().split('T')[0];
        return this.cachedBriefing.date === today;
    }

    // ============================================
    // HTML Rendering
    // ============================================

    renderBriefingHTML() {
        const b = this.cachedBriefing;
        if (!b) {
            return '<div class="morning-briefing-card"><p>Kein Briefing verfuegbar. Wird beim naechsten App-Start generiert.</p></div>';
        }

        const esc = window.esc || ((s) => {
            const div = document.createElement('div');
            div.textContent = s || '';
            return div.innerHTML;
        });

        const s = b.summary;
        const cashflowBadge = {
            healthy: '<span class="badge badge-success">Gesund</span>',
            warning: '<span class="badge badge-warning">Achtung</span>',
            critical: '<span class="badge badge-danger">Kritisch</span>',
            unknown: '<span class="badge badge-secondary">Unbekannt</span>'
        };

        let alertsHtml = '';
        if (b.alerts && b.alerts.length > 0) {
            alertsHtml = '<div class="briefing-alerts">' +
                b.alerts.map(a =>
                    `<div class="briefing-alert briefing-alert-${esc(a.type)}">${a.icon || ''} ${esc(a.text)}</div>`
                ).join('') +
                '</div>';
        }

        let appointmentsHtml = '';
        if (s.todaysAppointments && s.todaysAppointments.items && s.todaysAppointments.items.length > 0) {
            appointmentsHtml = '<ul class="briefing-list">' +
                s.todaysAppointments.items.map(a =>
                    `<li><strong>${esc(a.time)}</strong> ${esc(a.title)}${a.customer ? ' - ' + esc(a.customer) : ''}${a.location ? ' (' + esc(a.location) + ')' : ''}</li>`
                ).join('') +
                '</ul>';
        }

        let recsHtml = '';
        if (b.recommendations && b.recommendations.length > 0) {
            recsHtml = '<div class="briefing-recommendations"><strong>Empfehlungen:</strong><ul>' +
                b.recommendations.map(r => `<li>${esc(r)}</li>`).join('') +
                '</ul></div>';
        }

        let narrativeHtml = '';
        if (b.aiNarrative) {
            narrativeHtml = `<div class="briefing-narrative"><em>${esc(b.aiNarrative)}</em></div>`;
        }

        return `
            <div class="morning-briefing-card">
                <div class="briefing-header">
                    <h3>${esc(b.greeting)}</h3>
                    <span class="briefing-date">${esc(b.date)}</span>
                </div>

                ${narrativeHtml}
                ${alertsHtml}

                <div class="briefing-grid">
                    <div class="briefing-stat">
                        <span class="briefing-stat-label">Ueberfaellige Rechnungen</span>
                        <span class="briefing-stat-value">${s.overdueInvoices.count}</span>
                        <span class="briefing-stat-sub">${(s.overdueInvoices.total || 0).toFixed(2)} EUR</span>
                    </div>
                    <div class="briefing-stat">
                        <span class="briefing-stat-label">Neue Anfragen</span>
                        <span class="briefing-stat-value">${s.newInquiries.count}</span>
                    </div>
                    <div class="briefing-stat">
                        <span class="briefing-stat-label">Termine heute</span>
                        <span class="briefing-stat-value">${s.todaysAppointments.count}</span>
                    </div>
                    <div class="briefing-stat">
                        <span class="briefing-stat-label">Aktive Auftraege</span>
                        <span class="briefing-stat-value">${s.activeOrders.count}</span>
                    </div>
                    <div class="briefing-stat">
                        <span class="briefing-stat-label">Offene Angebote</span>
                        <span class="briefing-stat-value">${s.pendingQuotes.count}</span>
                        ${s.pendingQuotes.expiringCount > 0 ? `<span class="briefing-stat-sub">${s.pendingQuotes.expiringCount} bald ablaufend</span>` : ''}
                    </div>
                    <div class="briefing-stat">
                        <span class="briefing-stat-label">Monatsumsatz</span>
                        <span class="briefing-stat-value">${(s.monthlyRevenue || 0).toFixed(2)} EUR</span>
                    </div>
                    <div class="briefing-stat">
                        <span class="briefing-stat-label">Cashflow</span>
                        ${cashflowBadge[s.cashflowStatus] || cashflowBadge.unknown}
                    </div>
                    <div class="briefing-stat">
                        <span class="briefing-stat-label">Team aktiv</span>
                        <span class="briefing-stat-value">${s.teamOnDuty.count}</span>
                    </div>
                    ${s.offlineQueuePending > 0 ? `
                    <div class="briefing-stat">
                        <span class="briefing-stat-label">Offline-Queue</span>
                        <span class="briefing-stat-value">${s.offlineQueuePending}</span>
                    </div>` : ''}
                </div>

                ${appointmentsHtml ? '<div class="briefing-section"><strong>Heutige Termine:</strong>' + appointmentsHtml + '</div>' : ''}
                ${recsHtml}

                <div class="briefing-footer">
                    <small>Erstellt: ${new Date(b.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</small>
                    <button class="btn btn-sm btn-outline" data-action="briefing-refresh">Aktualisieren</button>
                    <button class="btn btn-sm btn-outline" data-action="briefing-speak">Vorlesen</button>
                </div>
            </div>
        `;
    }

    /**
     * Bind briefing action buttons via event delegation (CSP-safe, no inline onclick)
     */
    bindBriefingActions(container) {
        if (!container) {return;}
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) {return;}
            if (btn.dataset.action === 'briefing-refresh') {
                this.generateBriefing().then(() => {
                    if (window.dashboardWidgetService) {window.dashboardWidgetService.refresh();}
                });
            } else if (btn.dataset.action === 'briefing-speak') {
                this.speakBriefing();
            }
        });
    }

    // ============================================
    // Voice Output
    // ============================================

    speakBriefing() {
        const b = this.cachedBriefing;
        if (!b) {return;}

        const s = b.summary;
        let text = b.greeting + ' ';

        if (b.aiNarrative) {
            text += b.aiNarrative + ' ';
        } else {
            // Build spoken summary
            if (s.todaysAppointments.count > 0) {
                text += `Du hast heute ${s.todaysAppointments.count} Termin${s.todaysAppointments.count > 1 ? 'e' : ''}. `;
            } else {
                text += 'Heute stehen keine Termine an. ';
            }

            if (s.newInquiries.count > 0) {
                text += `${s.newInquiries.count} neue Anfrage${s.newInquiries.count > 1 ? 'n' : ''} warten auf Bearbeitung. `;
            }

            if (s.overdueInvoices.count > 0) {
                text += `${s.overdueInvoices.count} Rechnung${s.overdueInvoices.count > 1 ? 'en' : ''} ${s.overdueInvoices.count > 1 ? 'sind' : 'ist'} ueberfaellig, insgesamt ${s.overdueInvoices.total.toFixed(0)} Euro. `;
            }

            text += `${s.activeOrders.count} aktive Auftraege, ${s.pendingQuotes.count} offene Angebote. `;

            if (s.cashflowStatus === 'critical') {
                text += 'Achtung: Der Cashflow ist kritisch! ';
            } else if (s.cashflowStatus === 'warning') {
                text += 'Der Cashflow erfordert Aufmerksamkeit. ';
            }
        }

        // Use voiceCommandService if available
        const vcs = window.voiceCommandService;
        if (vcs && vcs.speak) {
            vcs.speak(text);
            return;
        }

        // Fallback: direct speechSynthesis
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'de-DE';
            utterance.rate = 0.95;
            const voices = window.speechSynthesis.getVoices();
            const deVoice = voices.find(v => v.lang.startsWith('de'));
            if (deVoice) {utterance.voice = deVoice;}
            window.speechSynthesis.speak(utterance);
        }
    }
}

// Register globally
window.morningBriefingService = new MorningBriefingService();
