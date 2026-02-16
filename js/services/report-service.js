/* ============================================
   Report Service - Berichterstellung
   Benutzerdefinierte Berichte und Analysen
   ============================================ */

class ReportService {
    constructor() {
        this.savedReports = JSON.parse(localStorage.getItem('mhs_saved_reports') || '[]');
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
        const rechnungen = window.store?.rechnungen || [];
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
        const customers = window.customerService?.getAllCustomers() || [];
        const rechnungen = window.store?.rechnungen || [];

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

    // Export to CSV
    exportToCSV(report) {
        let csv = '';

        if (report.type === 'sales') {
            csv = 'Rechnungs-Nr;Datum;Kunde;Netto;Brutto;Status\n';
            report.details.forEach(r => {
                csv += `${r.id};${r.datum};${r.kunde?.name || ''};${r.netto};${r.brutto};${r.status}\n`;
            });
        } else if (report.type === 'time') {
            csv = 'Datum;Start;Ende;Dauer (Std);Beschreibung;Auftrag\n';
            report.details.forEach(e => {
                csv += `${e.date};${e.startTime};${e.endTime};${e.durationHours};${e.description};${e.auftragId || ''}\n`;
            });
        } else if (report.type === 'tasks') {
            csv = 'Titel;Status;Priorität;Fällig;Erstellt\n';
            report.details.forEach(t => {
                csv += `${t.title};${t.status};${t.priority};${t.dueDate || ''};${t.createdAt}\n`;
            });
        }

        return csv;
    }

    // Export to PDF (returns HTML for printing)
    exportToPrintableHTML(report) {
        let html = `
        <html>
        <head>
            <title>${report.title}</title>
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
            <h1>${report.title}</h1>
            <p>Zeitraum: ${report.period?.start || report.year} - ${report.period?.end || ''}</p>
            <p>Erstellt: ${new Date(report.generatedAt).toLocaleString('de-DE')}</p>
            
            <div class="summary">
                <h3>Zusammenfassung</h3>
                ${Object.entries(report.summary).map(([key, value]) =>
            `<div class="summary-item"><strong>${key}:</strong> ${typeof value === 'number' ? value.toLocaleString('de-DE') : value}</div>`
        ).join('')}
            </div>
        </body>
        </html>`;

        return html;
    }

    // Save Report
    saveReport(report, name) {
        const saved = {
            id: 'report-' + Date.now(),
            name: name,
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
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
    }

    getReportTypes() { return this.reportTypes; }

    // Persistence
    save() { localStorage.setItem('mhs_saved_reports', JSON.stringify(this.savedReports)); }
}

window.reportService = new ReportService();
