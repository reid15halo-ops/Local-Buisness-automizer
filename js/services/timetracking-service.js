/* ============================================
   Time Tracking Service - Zeiterfassung
   Mitarbeiter-Stunden und Projektzeiten
   ============================================ */

class TimeTrackingService {
    constructor() {
        try { this.entries = JSON.parse(localStorage.getItem('freyai_time_entries') || '[]'); } catch { this.entries = []; }
        try { this.employees = JSON.parse(localStorage.getItem('freyai_employees') || '[]'); } catch { this.employees = []; }
        try { this.activeTimers = JSON.parse(localStorage.getItem('freyai_active_timers') || '{}'); } catch { this.activeTimers = {}; }
        try { this.settings = JSON.parse(localStorage.getItem('freyai_time_settings') || '{}'); } catch { this.settings = {}; }

        // Default settings
        if (!this.settings.dailyHours) {this.settings.dailyHours = 8;}
        if (!this.settings.overtimeThreshold) {this.settings.overtimeThreshold = 40;}
        if (!this.settings.breakDuration) {this.settings.breakDuration = 30;}
    }

    // Time Entry CRUD
    addEntry(entry) {
        const newEntry = {
            id: entry.id || this.generateId(),
            employeeId: entry.employeeId || 'default',
            date: entry.date || new Date().toISOString().split('T')[0],
            startTime: entry.startTime,
            endTime: entry.endTime,
            breakMinutes: entry.breakMinutes || 0,
            projectId: entry.projectId || null,
            auftragId: entry.auftragId || null,
            customerId: entry.customerId || null,
            description: entry.description || '',
            type: entry.type || 'arbeit', // arbeit, fahrt, pause
            billable: entry.billable !== false,
            billed: entry.billed || false,
            invoiceId: entry.invoiceId || null,
            createdAt: new Date().toISOString()
        };

        // Calculate duration
        newEntry.durationMinutes = this.calculateDuration(newEntry.startTime, newEntry.endTime, newEntry.breakMinutes);
        newEntry.durationHours = Math.round(newEntry.durationMinutes / 60 * 100) / 100;

        this.entries.push(newEntry);
        this.save();
        return newEntry;
    }

    updateEntry(id, updates) {
        const index = this.entries.findIndex(e => e.id === id);
        if (index !== -1) {
            this.entries[index] = { ...this.entries[index], ...updates };
            // Recalculate duration if times changed
            if (updates.startTime || updates.endTime || updates.breakMinutes !== undefined) {
                const entry = this.entries[index];
                entry.durationMinutes = this.calculateDuration(entry.startTime, entry.endTime, entry.breakMinutes);
                entry.durationHours = Math.round(entry.durationMinutes / 60 * 100) / 100;
            }
            this.save();
            return this.entries[index];
        }
        return null;
    }

    deleteEntry(id) {
        this.entries = this.entries.filter(e => e.id !== id);
        this.save();
    }

    getEntry(id) { return this.entries.find(e => e.id === id); }

    // Clock In/Out
    clockIn(employeeId = 'default', projectId = null) {
        const now = new Date();
        this.activeTimers[employeeId] = {
            startTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            date: now.toISOString().split('T')[0],
            projectId: projectId,
            startedAt: now.toISOString()
        };
        this.saveTimers();
        return this.activeTimers[employeeId];
    }

    clockOut(employeeId = 'default', description = '') {
        const timer = this.activeTimers[employeeId];
        if (!timer) {return null;}

        const now = new Date();
        const entry = this.addEntry({
            employeeId: employeeId,
            date: timer.date,
            startTime: timer.startTime,
            endTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            projectId: timer.projectId,
            auftragId: timer.auftragId || timer.projectId,
            description: description
        });

        delete this.activeTimers[employeeId];
        this.saveTimers();
        return entry;
    }

    isClockActive(employeeId = 'default') {
        return !!this.activeTimers[employeeId];
    }

    getActiveTimer(employeeId = 'default') {
        const timer = this.activeTimers[employeeId];
        if (!timer) {return null;}

        const started = new Date(timer.startedAt);
        const now = new Date();
        const elapsedMinutes = Math.floor((now - started) / 60000);
        const isStale = elapsedMinutes > 24 * 60; // >24h without clock-out

        return {
            ...timer,
            elapsedMinutes,
            elapsedFormatted: this.formatDuration(elapsedMinutes),
            isStale
        };
    }

    // Detect and resolve stale timers (>24h without clock-out)
    getStaleTimers() {
        const stale = [];
        const now = new Date();
        for (const [empId, timer] of Object.entries(this.activeTimers)) {
            const started = new Date(timer.startedAt);
            const elapsedMinutes = Math.floor((now - started) / 60000);
            if (elapsedMinutes > 24 * 60) {
                stale.push({ employeeId: empId, ...timer, elapsedMinutes });
            }
        }
        return stale;
    }

    autoResolveStaleTimer(employeeId, endTime = '17:00') {
        const timer = this.activeTimers[employeeId];
        if (!timer) {return null;}

        // Create entry with assumed end time on the original date
        const entry = this.addEntry({
            employeeId,
            date: timer.date,
            startTime: timer.startTime,
            endTime: endTime,
            projectId: timer.projectId,
            description: '[Auto-geschlossen: Timer vergessen]'
        });

        delete this.activeTimers[employeeId];
        this.saveTimers();
        return entry;
    }

    // Query Entries
    getEntriesForDay(date, employeeId = null) {
        return this.entries.filter(e =>
            e.date === date &&
            (!employeeId || e.employeeId === employeeId)
        ).sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    getEntriesForWeek(startDate, employeeId = null) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        return this.entries.filter(e => {
            const entryDate = new Date(e.date);
            return entryDate >= start && entryDate < end &&
                (!employeeId || e.employeeId === employeeId);
        });
    }

    getEntriesForMonth(year, month, employeeId = null) {
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        return this.entries.filter(e =>
            e.date.startsWith(monthStr) &&
            (!employeeId || e.employeeId === employeeId)
        );
    }

    getEntriesForAuftrag(auftragId) {
        return this.entries.filter(e => e.auftragId === auftragId);
    }

    getEntriesForCustomer(customerId) {
        return this.entries.filter(e => e.customerId === customerId);
    }

    // Calculations
    calculateDuration(startTime, endTime, breakMinutes = 0) {
        if (!startTime || !endTime) {return 0;}
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        let endTotal = endH * 60 + endM;
        // Handle overnight shifts (e.g. 22:00 → 06:00)
        if (endTotal < startTotal) {
            endTotal += 24 * 60;
        }
        return Math.max(0, endTotal - startTotal - breakMinutes);
    }

    getTotalHoursForDay(date, employeeId = null) {
        const entries = this.getEntriesForDay(date, employeeId);
        const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
        return Math.round(totalMinutes / 60 * 100) / 100;
    }

    getTotalHoursForWeek(startDate, employeeId = null) {
        const entries = this.getEntriesForWeek(startDate, employeeId);
        const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
        return Math.round(totalMinutes / 60 * 100) / 100;
    }

    getOvertimeForWeek(startDate, employeeId = null) {
        const totalHours = this.getTotalHoursForWeek(startDate, employeeId);
        return Math.max(0, totalHours - this.settings.overtimeThreshold);
    }

    getBillableHoursForPeriod(startDate, endDate, customerId = null) {
        return this.entries.filter(e => {
            if (!e.billable) {return false;}
            if (e.date < startDate || e.date > endDate) {return false;}
            if (customerId && e.customerId !== customerId) {return false;}
            return true;
        }).reduce((sum, e) => sum + e.durationHours, 0);
    }

    // Timesheet Generation
    generateTimesheet(employeeId, year, month) {
        const entries = this.getEntriesForMonth(year, month, employeeId);

        // Group by date
        const byDate = {};
        entries.forEach(e => {
            if (!byDate[e.date]) {byDate[e.date] = [];}
            byDate[e.date].push(e);
        });

        const daysInMonth = new Date(year, month, 0).getDate();
        const rows = [];
        let totalHours = 0;
        let totalOvertimeHours = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEntries = byDate[date] || [];
            const dayHours = dayEntries.reduce((sum, e) => sum + e.durationHours, 0);
            const dayOvertime = Math.max(0, dayHours - this.settings.dailyHours);

            const dayOfWeek = new Date(date).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            rows.push({
                date: date,
                dayName: new Date(date).toLocaleDateString('de-DE', { weekday: 'short' }),
                entries: dayEntries,
                totalHours: dayHours,
                overtime: dayOvertime,
                isWeekend: isWeekend
            });

            totalHours += dayHours;
            totalOvertimeHours += dayOvertime;
        }

        return {
            employeeId,
            year,
            month,
            monthName: new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'long' }),
            rows,
            totalHours: Math.round(totalHours * 100) / 100,
            regularHours: Math.round((totalHours - totalOvertimeHours) * 100) / 100,
            overtimeHours: Math.round(totalOvertimeHours * 100) / 100,
            workDays: rows.filter(r => r.totalHours > 0).length
        };
    }

    // Export
    exportToCSV(employeeId, year, month) {
        const timesheet = this.generateTimesheet(employeeId, year, month);

        let csv = 'Datum;Wochentag;Beginn;Ende;Pause (Min);Arbeitszeit (Std);Beschreibung\n';

        timesheet.rows.forEach(row => {
            if (row.entries.length === 0 && !row.isWeekend) {
                csv += `${row.date};${row.dayName};;;;;\n`;
            } else {
                row.entries.forEach(e => {
                    const desc = (e.description || '').replace(/"/g, '""');
                    csv += `${row.date};${row.dayName};${e.startTime};${e.endTime};${e.breakMinutes};${e.durationHours};"${desc}"\n`;
                });
            }
        });

        csv += `\nGesamt;;;${timesheet.totalHours} Std;;davon Überstunden: ${timesheet.overtimeHours} Std\n`;

        return csv;
    }

    // Employees
    addEmployee(employee) {
        const emp = {
            id: employee.id || 'emp-' + Date.now(),
            name: employee.name,
            email: employee.email || '',
            role: employee.role || 'Mitarbeiter',
            weeklyHours: employee.weeklyHours || 40,
            active: true
        };
        this.employees.push(emp);
        this.saveEmployees();
        return emp;
    }

    getEmployees() { return this.employees.filter(e => e.active); }
    getEmployee(id) { return this.employees.find(e => e.id === id); }

    // Statistics
    getStatistics(employeeId = null, year = null, month = null) {
        let entries = this.entries;

        if (employeeId) {entries = entries.filter(e => e.employeeId === employeeId);}
        if (year && month) {
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;
            entries = entries.filter(e => e.date.startsWith(monthStr));
        }

        const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
        const billableMinutes = entries.filter(e => e.billable).reduce((sum, e) => sum + e.durationMinutes, 0);

        return {
            totalEntries: entries.length,
            totalHours: Math.round(totalMinutes / 60 * 100) / 100,
            billableHours: Math.round(billableMinutes / 60 * 100) / 100,
            avgHoursPerDay: entries.length > 0 ? Math.round(totalMinutes / 60 / [...new Set(entries.map(e => e.date))].length * 100) / 100 : 0,
            byType: {
                arbeit: entries.filter(e => e.type === 'arbeit').reduce((sum, e) => sum + e.durationHours, 0),
                fahrt: entries.filter(e => e.type === 'fahrt').reduce((sum, e) => sum + e.durationHours, 0)
            }
        };
    }

    // ============================================
    // Zeiterfassung → Rechnung Bridge
    // Abrechnung erfasster Stunden als Rechnung
    // ============================================

    /**
     * Alle nicht-abgerechneten Zeiteintraege fuer einen Kunden
     * @param {string} customerId - Kunden-ID
     * @returns {Array} Nicht-abgerechnete, abrechenbare Eintraege
     */
    getUnbilledEntries(customerId) {
        return this.entries.filter(e =>
            e.customerId === customerId &&
            e.billable &&
            !e.billed
        ).sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Erstellt eine Rechnung aus Zeiteintraegen
     * @param {Array} entryIds - IDs der abzurechnenden Eintraege
     * @param {string} customerId - Kunden-ID
     * @param {number} stundensatz - Stundensatz in EUR
     * @param {Object} options - Optionen (groupBy: 'entry'|'project'|'day', paymentTermDays, etc.)
     * @returns {Promise<Object>} Erstellte Rechnung
     */
    async generateInvoiceFromEntries(entryIds, customerId, stundensatz, options = {}) {
        const opts = {
            groupBy: 'entry', // 'entry' = pro Zeiteintrag, 'project' = pro Projekt, 'day' = pro Tag
            paymentTermDays: 14,
            generatePDF: false,
            openPDF: false,
            downloadPDF: false,
            ...options
        };

        // Eintraege laden und validieren
        const entries = entryIds.map(id => this.getEntry(id)).filter(Boolean);
        if (entries.length === 0) {
            throw new Error('Keine gueltigen Zeiteintraege gefunden');
        }

        // Pruefen ob alle Eintraege zum Kunden gehoeren
        const invalidEntries = entries.filter(e => e.customerId !== customerId);
        if (invalidEntries.length > 0) {
            throw new Error(`${invalidEntries.length} Eintrag/Eintraege gehoeren nicht zum angegebenen Kunden`);
        }

        // Pruefen ob bereits abgerechnete Eintraege dabei sind
        const alreadyBilled = entries.filter(e => e.billed);
        if (alreadyBilled.length > 0) {
            throw new Error(`${alreadyBilled.length} Eintrag/Eintraege sind bereits abgerechnet`);
        }

        // Positionen erstellen je nach Gruppierung
        let positionen = [];

        if (opts.groupBy === 'project') {
            // Zusammenfassung pro Projekt
            const byProject = {};
            entries.forEach(e => {
                const key = e.projectId || e.auftragId || 'Allgemein';
                if (!byProject[key]) {
                    byProject[key] = { projektId: key, stunden: 0, eintraege: [], beschreibungen: [] };
                }
                byProject[key].stunden += e.durationHours;
                byProject[key].eintraege.push(e.id);
                if (e.description) { byProject[key].beschreibungen.push(e.description); }
            });

            positionen = Object.values(byProject).map(p => ({
                beschreibung: `Projekt ${p.projektId}: ${p.beschreibungen.join(', ') || 'Diverse Leistungen'}`,
                menge: Math.round(p.stunden * 100) / 100,
                einheit: 'Stunden',
                einzelpreis: stundensatz,
                gesamt: Math.round(p.stunden * stundensatz * 100) / 100,
                entryIds: p.eintraege
            }));

        } else if (opts.groupBy === 'day') {
            // Zusammenfassung pro Tag
            const byDay = {};
            entries.forEach(e => {
                if (!byDay[e.date]) {
                    byDay[e.date] = { datum: e.date, stunden: 0, eintraege: [], beschreibungen: [] };
                }
                byDay[e.date].stunden += e.durationHours;
                byDay[e.date].eintraege.push(e.id);
                if (e.description) { byDay[e.date].beschreibungen.push(e.description); }
            });

            positionen = Object.keys(byDay).sort().map(date => {
                const d = byDay[date];
                const datumFormatiert = new Date(date).toLocaleDateString('de-DE');
                return {
                    beschreibung: `${datumFormatiert}: ${d.beschreibungen.join(', ') || 'Diverse Leistungen'}`,
                    menge: Math.round(d.stunden * 100) / 100,
                    einheit: 'Stunden',
                    einzelpreis: stundensatz,
                    gesamt: Math.round(d.stunden * stundensatz * 100) / 100,
                    entryIds: d.eintraege
                };
            });

        } else {
            // Default: Pro Zeiteintrag eine Position
            positionen = entries.map(e => {
                const datumFormatiert = new Date(e.date).toLocaleDateString('de-DE');
                return {
                    beschreibung: `${datumFormatiert} – ${e.description || 'IT-Beratung'} (${e.startTime}–${e.endTime})`,
                    menge: e.durationHours,
                    einheit: 'Stunden',
                    einzelpreis: stundensatz,
                    gesamt: Math.round(e.durationHours * stundensatz * 100) / 100,
                    entryIds: [e.id]
                };
            });
        }

        // Gesamtstunden und Gesamtbetrag berechnen
        const gesamtStunden = Math.round(entries.reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;
        const gesamtNetto = Math.round(gesamtStunden * stundensatz * 100) / 100;

        // Kunden-Objekt ermitteln (aus storeService wenn verfuegbar)
        let kunde = { id: customerId };
        if (window.storeService?.state?.kunden) {
            const kundeData = window.storeService.state.kunden.find(k => k.id === customerId);
            if (kundeData) { kunde = kundeData; }
        }

        // Auftrag-Objekt fuer invoiceService zusammenbauen
        const auftrag = {
            id: 'ZE-' + Date.now(),
            kunde: kunde,
            leistungsart: 'IT-Beratung / Zeiterfassung',
            positionen: positionen,
            arbeitszeit: gesamtStunden,
            materialKosten: 0,
            netto: gesamtNetto,
            notizen: `Abrechnung aus Zeiterfassung: ${entries.length} Eintraege, ${this.formatHours(gesamtStunden)}, Stundensatz: ${stundensatz.toFixed(2).replace('.', ',')} EUR`,
            // Referenz auf Zeiteintraege
            timeEntryIds: entryIds
        };

        // Rechnung ueber invoiceService erstellen
        const invoiceService = window.invoiceService;
        if (!invoiceService) {
            throw new Error('invoiceService nicht verfuegbar');
        }

        const invoice = await invoiceService.createInvoice(auftrag, {
            paymentTermDays: opts.paymentTermDays,
            generatePDF: opts.generatePDF,
            openPDF: opts.openPDF,
            downloadPDF: opts.downloadPDF
        });

        // Zeiteintraege als abgerechnet markieren
        this.markEntriesAsBilled(entryIds, invoice.id);

        return {
            invoice: invoice,
            summary: {
                eintraegeCount: entries.length,
                gesamtStunden: gesamtStunden,
                stundensatz: stundensatz,
                gesamtNetto: gesamtNetto,
                gruppierung: opts.groupBy,
                positionenCount: positionen.length
            }
        };
    }

    /**
     * Markiert Zeiteintraege als abgerechnet
     * @param {Array} entryIds - IDs der Eintraege
     * @param {string} invoiceId - Rechnungs-ID
     */
    markEntriesAsBilled(entryIds, invoiceId) {
        let updated = 0;
        entryIds.forEach(id => {
            const entry = this.getEntry(id);
            if (entry) {
                entry.billed = true;
                entry.invoiceId = invoiceId;
                entry.billedAt = new Date().toISOString();
                updated++;
            }
        });
        this.save();

        // Supabase-Update wenn verfuegbar
        if (window.dbService?.updateTimeEntries) {
            try {
                window.dbService.updateTimeEntries(entryIds, {
                    billed: true,
                    invoice_id: invoiceId,
                    billed_at: new Date().toISOString()
                });
            } catch (err) {
                console.warn('Supabase-Update fuer abgerechnete Eintraege fehlgeschlagen:', err);
            }
        }

        return updated;
    }

    /**
     * Abrechnungszusammenfassung fuer einen Kunden
     * @param {string} customerId - Kunden-ID
     * @returns {Object} Zusammenfassung: offene Stunden, Betrag, letzte Abrechnung
     */
    getBillingSummary(customerId) {
        const alleEintraege = this.entries.filter(e => e.customerId === customerId && e.billable);
        const unbilledEntries = alleEintraege.filter(e => !e.billed);
        const billedEntries = alleEintraege.filter(e => e.billed);

        // Offene (nicht abgerechnete) Stunden
        const offeneStunden = Math.round(unbilledEntries.reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;

        // Bereits abgerechnete Stunden
        const abgerechneteStunden = Math.round(billedEntries.reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;

        // Letzte Abrechnung ermitteln
        const letzteAbrechnung = billedEntries
            .filter(e => e.billedAt)
            .sort((a, b) => b.billedAt.localeCompare(a.billedAt))[0];

        // Verwendete Rechnungs-IDs
        const rechnungsIds = [...new Set(billedEntries.map(e => e.invoiceId).filter(Boolean))];

        return {
            customerId: customerId,
            offeneEintraege: unbilledEntries.length,
            offeneStunden: offeneStunden,
            abgerechneteEintraege: billedEntries.length,
            abgerechneteStunden: abgerechneteStunden,
            gesamtStunden: Math.round((offeneStunden + abgerechneteStunden) * 100) / 100,
            letzteAbrechnung: letzteAbrechnung ? letzteAbrechnung.billedAt : null,
            letzteRechnungId: letzteAbrechnung ? letzteAbrechnung.invoiceId : null,
            rechnungsIds: rechnungsIds,
            anzahlRechnungen: rechnungsIds.length
        };
    }

    // Helpers
    generateId() { return 'time-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11); }

    formatDuration(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
    }

    formatHours(hours) {
        return hours.toFixed(2).replace('.', ',') + ' Std';
    }

    // Persistence
    save() { localStorage.setItem('freyai_time_entries', JSON.stringify(this.entries)); }
    saveTimers() { localStorage.setItem('freyai_active_timers', JSON.stringify(this.activeTimers)); }
    saveEmployees() { localStorage.setItem('freyai_employees', JSON.stringify(this.employees)); }
    saveSettings() { localStorage.setItem('freyai_time_settings', JSON.stringify(this.settings)); }
}

window.timeTrackingService = new TimeTrackingService();
