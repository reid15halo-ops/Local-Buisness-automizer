/* ============================================
   Report Service - Berichterstellung
   Benutzerdefinierte Berichte und Analysen
   ============================================ */

class ReportService {
    constructor() {
        this.savedReports = StorageUtils.getJSON('freyai_saved_reports', [], { service: 'reportService' });
        this.reportTypes = [
            { id: 'sales', name: 'Umsatzbericht', icon: '💰' },
            { id: 'customer', name: 'Kundenbericht', icon: '👥' },
            { id: 'time', name: 'Zeitbericht', icon: '⏱️' },
            { id: 'tasks', name: 'Aufgabenbericht', icon: '📋' },
            { id: 'bookkeeping', name: 'Buchhaltungsbericht', icon: '📊' }
        ];
    }

    // Generate Sales Report
    generateSalesReport(startDate, endDate) {
        if (!startDate || !endDate) { return { error: 'Start- und Enddatum erforderlich' }; }
        const rechnungen = window.storeService?.state?.rechnungen || [];
        const filtered = rechnungen.filter(r => {
            const date = r.datum?.split('T')[0] || r.datum;
            return date >= startDate && date <= endDate;
        });

        const totalBrutto = filtered.reduce((sum, r) => sum + (r.brutto || 0), 0);
        const totalNetto = filtered.reduce((sum, r) => sum + (r.netto || 0), 0);
        const paid = filtered.filter(r => r.status === 'bezahlt');
        const open = filtered.filter(r => r.status === 'offen');

        // Group by month
        const byMonth = {};
        filtered.forEach(r => {
            const month = (r.datum?.substring(0, 7)) || 'unknown';
            if (!byMonth[month]) {byMonth[month] = { count: 0, sum: 0 };}
            byMonth[month].count++;
            byMonth[month].sum += r.brutto || 0;
        });

        return {
            type: 'sales',
            title: 'Umsatzbericht',
            period: { start: startDate, end: endDate },
            generatedAt: new Date().toISOString(),
            summary: {
                anzahlRechnungen: filtered.length,
                gesamtBrutto: totalBrutto,
                gesamtNetto: totalNetto,
                bezahlt: paid.reduce((sum, r) => sum + (r.brutto || 0), 0),
                offen: open.reduce((sum, r) => sum + (r.brutto || 0), 0),
                anzahlBezahlt: paid.length,
                anzahlOffen: open.length
            },
            byMonth: Object.entries(byMonth).map(([month, data]) => ({
                month,
                count: data.count,
                sum: data.sum
            })).sort((a, b) => a.month.localeCompare(b.month)),
            details: filtered
        };
    }

    // Generate Customer Report
    generateCustomerReport(startDate, endDate) {
        if (!startDate || !endDate) { return { error: 'Start- und Enddatum erforderlich' }; }
        const customers = window.customerService?.getAllCustomers() || [];
        const rechnungen = window.storeService?.state?.rechnungen || [];

        // Calculate revenue per customer
        const customerRevenue = {};
        rechnungen.forEach(r => {
            if (r.datum < startDate || r.datum > endDate) {return;}
            const key = r.kunde?.email || r.kunde?.name || 'unknown';
            if (!customerRevenue[key]) {
                customerRevenue[key] = {
                    name: r.kunde?.name || 'Unbekannt',
                    email: r.kunde?.email || '',
                    revenue: 0,
                    count: 0
                };
            }
            customerRevenue[key].revenue += r.brutto || 0;
            customerRevenue[key].count++;
        });

        const topCustomers = Object.values(customerRevenue)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        return {
            type: 'customer',
            title: 'Kundenbericht',
            period: { start: startDate, end: endDate },
            generatedAt: new Date().toISOString(),
            summary: {
                totalCustomers: customers.length,
                activeCustomers: Object.keys(customerRevenue).length,
                newCustomers: customers.filter(c =>
                    c.erstelltAm >= startDate && c.erstelltAm <= endDate
                ).length
            },
            topCustomers,
            allCustomerRevenue: customerRevenue
        };
    }

    // Generate Time Report
    generateTimeReport(startDate, endDate, employeeId = null) {
        if (!startDate || !endDate) { return { error: 'Start- und Enddatum erforderlich' }; }
        if (!window.timeTrackingService) {
            return { error: 'Zeiterfassung nicht verfügbar' };
        }

        const entries = window.timeTrackingService.entries.filter(e => {
            if (e.date < startDate || e.date > endDate) {return false;}
            if (employeeId && e.employeeId !== employeeId) {return false;}
            return true;
        });

        const totalHours = entries.reduce((sum, e) => sum + (e.durationHours || 0), 0);
        const billableHours = entries.filter(e => e.billable).reduce((sum, e) => sum + (e.durationHours || 0), 0);

        // Group by day
        const byDay = {};
        entries.forEach(e => {
            if (!byDay[e.date]) {byDay[e.date] = 0;}
            byDay[e.date] += e.durationHours || 0;
        });

        // Group by project/Auftrag
        const byProject = {};
        entries.forEach(e => {
            const key = e.auftragId || 'ohne-zuordnung';
            if (!byProject[key]) {byProject[key] = 0;}
            byProject[key] += e.durationHours || 0;
        });

        return {
            type: 'time',
            title: 'Zeitbericht',
            period: { start: startDate, end: endDate },
            employeeId,
            generatedAt: new Date().toISOString(),
            summary: {
                totalEntries: entries.length,
                totalHours: Math.round(totalHours * 100) / 100,
                billableHours: Math.round(billableHours * 100) / 100,
                nonBillableHours: Math.round((totalHours - billableHours) * 100) / 100,
                avgHoursPerDay: entries.length > 0 ?
                    Math.round(totalHours / Object.keys(byDay).length * 100) / 100 : 0
            },
            byDay: Object.entries(byDay).map(([date, hours]) => ({ date, hours })),
            byProject: Object.entries(byProject).map(([project, hours]) => ({ project, hours })),
            details: entries
        };
    }

    // Generate Task Report
    generateTaskReport(startDate, endDate) {
        if (!startDate || !endDate) { return { error: 'Start- und Enddatum erforderlich' }; }
        if (!window.taskService) {
            return { error: 'Aufgabenverwaltung nicht verfügbar' };
        }

        const tasks = window.taskService.getAllTasks().filter(t => {
            const created = t.createdAt?.split('T')[0];
            return created >= startDate && created <= endDate;
        });

        const completed = tasks.filter(t => t.status === 'erledigt');
        const overdue = tasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split('T')[0] && t.status !== 'erledigt');

        // Group by priority
        const byPriority = {
            urgent: tasks.filter(t => t.priority === 'urgent').length,
            high: tasks.filter(t => t.priority === 'high').length,
            normal: tasks.filter(t => t.priority === 'normal').length,
            low: tasks.filter(t => t.priority === 'low').length
        };

        // Group by category
        const byCategory = {};
        tasks.forEach(t => {
            const cat = t.category || 'allgemein';
            if (!byCategory[cat]) {byCategory[cat] = 0;}
            byCategory[cat]++;
        });

        return {
            type: 'tasks',
            title: 'Aufgabenbericht',
            period: { start: startDate, end: endDate },
            generatedAt: new Date().toISOString(),
            summary: {
                totalTasks: tasks.length,
                completed: completed.length,
                open: tasks.length - completed.length,
                overdue: overdue.length,
                completionRate: tasks.length > 0 ?
                    Math.round(completed.length / tasks.length * 100) : 0
            },
            byPriority,
            byCategory: Object.entries(byCategory).map(([cat, count]) => ({ category: cat, count })),
            details: tasks
        };
    }

    // Generate Bookkeeping Report
    generateBookkeepingReport(year) {
        if (!year) { return { error: 'Jahr erforderlich' }; }
        if (!window.bookkeepingService) {
            return { error: 'Buchhaltung nicht verfügbar' };
        }

        const eur = window.bookkeepingService.berechneEUR(year);
        const kategorien = window.bookkeepingService.getKategorienAuswertung(year);

        return {
            type: 'bookkeeping',
            title: 'Buchhaltungsbericht',
            year,
            generatedAt: new Date().toISOString(),
            eur,
            kategorien,
            summary: {
                einnahmen: eur.einnahmenBrutto,
                ausgaben: eur.ausgabenBrutto,
                gewinn: eur.gewinnVorSteuer,
                mwstZahllast: eur.mwstZahllast
            }
        };
    }

    // Generate Marketing Campaign Report
    async generateMarketingReport(campaignId) {
        try {
            const { dbService } = await import('./db-service.js');
            const supabase = dbService.supabase;

            // Fetch campaign summary
            const { data: summary, error: sumErr } = await supabase
                .from('marketing_campaign_summary')
                .select('*')
                .eq('campaign_id', campaignId)
                .single();
            if (sumErr) return { error: sumErr.message };

            // Fetch top posts by engagement
            const { data: posts } = await supabase
                .from('marketing_posts')
                .select('id, platform, caption, posted_at, status')
                .eq('campaign_id', campaignId)
                .eq('status', 'posted')
                .order('posted_at', { ascending: false })
                .limit(50);

            // Fetch latest analytics per post
            const { data: analytics } = await supabase
                .from('marketing_analytics')
                .select('post_id, impressions, reach, likes, comments, shares, saves, clicks, engagement_rate, collected_at')
                .eq('campaign_id', campaignId)
                .order('collected_at', { ascending: false });

            // Deduplicate: latest analytics per post
            const latestByPost = {};
            (analytics || []).forEach(a => {
                if (!latestByPost[a.post_id]) latestByPost[a.post_id] = a;
            });

            // Build top performers
            const postsWithAnalytics = (posts || []).map(p => ({
                ...p,
                analytics: latestByPost[p.id] || null
            }));
            const topPerformers = postsWithAnalytics
                .filter(p => p.analytics)
                .sort((a, b) => {
                    const engA = (a.analytics.likes || 0) + (a.analytics.comments || 0) + (a.analytics.shares || 0);
                    const engB = (b.analytics.likes || 0) + (b.analytics.comments || 0) + (b.analytics.shares || 0);
                    return engB - engA;
                })
                .slice(0, 5);

            // Platform breakdown
            const platformStats = {};
            postsWithAnalytics.forEach(p => {
                if (!platformStats[p.platform]) {
                    platformStats[p.platform] = { posts: 0, impressions: 0, likes: 0, comments: 0 };
                }
                platformStats[p.platform].posts++;
                if (p.analytics) {
                    platformStats[p.platform].impressions += p.analytics.impressions || 0;
                    platformStats[p.platform].likes += p.analytics.likes || 0;
                    platformStats[p.platform].comments += p.analytics.comments || 0;
                }
            });

            return {
                type: 'marketing',
                title: `Marketing-Report: ${summary.company_name}`,
                generatedAt: new Date().toISOString(),
                summary: {
                    companyName: summary.company_name,
                    package: summary.package,
                    status: summary.status,
                    period: `${summary.starts_at} — ${summary.ends_at}`,
                    totalPosts: summary.total_posts,
                    postedCount: summary.posted_count,
                    scheduledCount: summary.scheduled_count,
                    failedCount: summary.failed_count,
                    totalImpressions: summary.total_impressions,
                    totalReach: summary.total_reach,
                    totalLikes: summary.total_likes,
                    totalComments: summary.total_comments,
                    totalClicks: summary.total_clicks,
                    avgEngagementRate: summary.avg_engagement_rate
                },
                topPerformers: topPerformers.map(p => ({
                    platform: p.platform,
                    caption: (p.caption || '').substring(0, 100),
                    postedAt: p.posted_at,
                    likes: p.analytics?.likes || 0,
                    comments: p.analytics?.comments || 0,
                    impressions: p.analytics?.impressions || 0,
                    engagementRate: p.analytics?.engagement_rate || 0
                })),
                platformBreakdown: platformStats
            };
        } catch (err) {
            console.error('ReportService: Marketing-Report Fehler:', err);
            return { error: err.message || 'Unbekannter Fehler' };
        }
    }

    // Export to CSV
    exportToCSV(report) {
        let csv = '';

        const csvSafe = (v) => {
            let s = String(v ?? '');
            if (/^[=+\-@\t\r]/.test(s)) { s = "'" + s; }
            if (s.includes(';') || s.includes('"') || s.includes('\n')) { s = '"' + s.replace(/"/g, '""') + '"'; }
            return s;
        };

        if (report.type === 'sales') {
            csv = 'Rechnungs-Nr;Datum;Kunde;Netto;Brutto;Status\n';
            report.details.forEach(r => {
                csv += `${csvSafe(r.id)};${csvSafe(r.datum)};${csvSafe(r.kunde?.name || '')};${csvSafe(r.netto)};${csvSafe(r.brutto)};${csvSafe(r.status)}\n`;
            });
        } else if (report.type === 'time') {
            csv = 'Datum;Start;Ende;Dauer (Std);Beschreibung;Auftrag\n';
            report.details.forEach(e => {
                csv += `${csvSafe(e.date)};${csvSafe(e.startTime)};${csvSafe(e.endTime)};${csvSafe(e.durationHours)};${csvSafe(e.description)};${csvSafe(e.auftragId || '')}\n`;
            });
        } else if (report.type === 'tasks') {
            csv = 'Titel;Status;Priorität;Fällig;Erstellt\n';
            report.details.forEach(t => {
                csv += `${csvSafe(t.title)};${csvSafe(t.status)};${csvSafe(t.priority)};${csvSafe(t.dueDate || '')};${csvSafe(t.createdAt)}\n`;
            });
        }

        return '\uFEFF' + csv;
    }

    // Export to PDF (returns HTML for printing)
    exportToPrintableHTML(report) {
        const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        let html = `
        <html>
        <head>
            <title>${esc(report.title)}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #1a1a2e; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #f5f5f5; }
                .summary { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .summary-item { display: inline-block; margin-right: 30px; }
            </style>
        </head>
        <body>
            <h1>${esc(report.title)}</h1>
            <p>Zeitraum: ${esc(report.period?.start || report.year)} - ${esc(report.period?.end || '')}</p>
            <p>Erstellt: ${esc(new Date(report.generatedAt).toLocaleString('de-DE'))}</p>

            <div class="summary">
                <h3>Zusammenfassung</h3>
                ${Object.entries(report.summary).map(([key, value]) =>
            `<div class="summary-item"><strong>${esc(key)}:</strong> ${typeof value === 'number' ? esc(value.toLocaleString('de-DE')) : esc(value)}</div>`
        ).join('')}
            </div>
        </body>
        </html>`;

        return html;
    }

    // Save Report
    saveReport(report, name) {
        if (!report || !name) { return null; }
        const saved = {
            id: 'report-' + Date.now(),
            name: String(name).substring(0, 200),
            type: report.type,
            data: report,
            savedAt: new Date().toISOString()
        };
        this.savedReports.push(saved);
        this.save();
        return saved;
    }

    getSavedReports() { return this.savedReports; }
    deleteSavedReport(id) {
        this.savedReports = this.savedReports.filter(r => r.id !== id);
        this.save();
    }

    // Helpers
    formatCurrency(amount) {
        return window.formatCurrency(amount);
    }

    getReportTypes() { return this.reportTypes; }

    // Persistence
    save() { localStorage.setItem('freyai_saved_reports', JSON.stringify(this.savedReports)); }
}

window.reportService = new ReportService();
