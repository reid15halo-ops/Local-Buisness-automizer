/* ============================================
   Apprentice Training Tracker - Berichtsheft
   Legally required training documentation for
   German apprentices (Azubis).

   The Meister (master craftsman) must sign off
   weekly reports for the Gesellenpruefung
   (journeyman exam).

   Storage:
   - mhs_apprentices          (apprentice list)
   - mhs_berichtsheft_entries (weekly reports)
   ============================================ */

class ApprenticeService {
    constructor() {
        this.apprentices = JSON.parse(localStorage.getItem('mhs_apprentices') || '[]');
        this.reports = JSON.parse(localStorage.getItem('mhs_berichtsheft_entries') || '[]');
    }

    // ============================================
    // Persistence
    // ============================================

    _saveApprentices() {
        localStorage.setItem('mhs_apprentices', JSON.stringify(this.apprentices));
    }

    _saveReports() {
        localStorage.setItem('mhs_berichtsheft_entries', JSON.stringify(this.reports));
    }

    _generateId(prefix) {
        const ts = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        return `${prefix}-${ts}-${rand}`;
    }

    // ============================================
    // Apprentices
    // ============================================

    /**
     * Add a new apprentice.
     * @param {object} data - Apprentice fields
     * @returns {object} The created apprentice
     */
    addApprentice(data) {
        const apprentice = {
            id: this._generateId('AZB'),
            name: data.name || '',
            trade: data.trade || '',
            trainingStart: data.trainingStart || '',
            trainingEnd: data.trainingEnd || '',
            trainingYear: parseFloat(data.trainingYear) || 1,
            school: data.school || '',
            schoolDays: Array.isArray(data.schoolDays) ? data.schoolDays : [],
            phone: data.phone || '',
            email: data.email || '',
            status: data.status || 'aktiv',
            createdAt: new Date().toISOString()
        };

        this.apprentices.push(apprentice);
        this._saveApprentices();
        return apprentice;
    }

    /**
     * Get all apprentices sorted by name.
     * @returns {Array}
     */
    getApprentices() {
        return [...this.apprentices].sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get a single apprentice by ID.
     * @param {string} id
     * @returns {object|null}
     */
    getApprentice(id) {
        return this.apprentices.find(a => a.id === id) || null;
    }

    /**
     * Update an apprentice.
     * @param {string} id
     * @param {object} data - Fields to update
     * @returns {object|null}
     */
    updateApprentice(id, data) {
        const index = this.apprentices.findIndex(a => a.id === id);
        if (index === -1) { return null; }

        const { id: _id, createdAt: _ca, ...safeData } = data;

        if (safeData.trainingYear !== undefined) {
            safeData.trainingYear = parseFloat(safeData.trainingYear) || 1;
        }

        this.apprentices[index] = {
            ...this.apprentices[index],
            ...safeData
        };

        this._saveApprentices();
        return this.apprentices[index];
    }

    /**
     * Remove an apprentice and all their reports.
     * @param {string} id
     * @returns {boolean}
     */
    removeApprentice(id) {
        const index = this.apprentices.findIndex(a => a.id === id);
        if (index === -1) { return false; }

        this.apprentices.splice(index, 1);
        this._saveApprentices();

        // Remove associated reports
        this.reports = this.reports.filter(r => r.apprenticeId !== id);
        this._saveReports();

        return true;
    }

    /**
     * Get only active apprentices.
     * @returns {Array}
     */
    getActiveApprentices() {
        return this.getApprentices().filter(a => a.status === 'aktiv');
    }

    // ============================================
    // Berichtsheft (Weekly Reports)
    // ============================================

    /**
     * Create a new weekly report for an apprentice.
     * @param {string} apprenticeId
     * @param {string} weekStart - YYYY-MM-DD of Monday
     * @returns {object} The created report
     */
    createWeeklyReport(apprenticeId, weekStart) {
        const apprentice = this.getApprentice(apprenticeId);
        if (!apprentice) {
            throw new Error('Azubi nicht gefunden: ' + apprenticeId);
        }

        // Parse the weekStart to build the week
        const monday = new Date(weekStart + 'T00:00:00');
        const weekInfo = this._getISOWeekNumber(monday);
        const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
        const days = [];

        for (let i = 0; i < 5; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const dateStr = this._formatDateISO(date);
            const dayName = dayNames[i];

            // Detect school day
            const isSchoolDay = apprentice.schoolDays.includes(dayName);

            days.push({
                date: dateStr,
                dayName: dayName,
                type: isSchoolDay ? 'schule' : 'betrieb',
                hours: 8,
                activities: '',
                schoolSubjects: '',
                skills: []
            });
        }

        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const report = {
            id: this._generateId('BH'),
            apprenticeId: apprenticeId,
            weekNumber: weekInfo.week,
            year: weekInfo.year,
            weekStart: weekStart,
            weekEnd: this._formatDateISO(friday),
            trainingYear: apprentice.trainingYear,
            department: '',
            days: days,
            weeklyNotes: '',
            apprenticeSigned: false,
            apprenticeSignedAt: '',
            masterSigned: false,
            masterSignedAt: '',
            masterName: '',
            status: 'entwurf',
            feedback: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.reports.push(report);
        this._saveReports();
        return report;
    }

    /**
     * Get all weekly reports for an apprentice, sorted by week (newest first).
     * @param {string} apprenticeId
     * @returns {Array}
     */
    getWeeklyReports(apprenticeId) {
        return this.reports
            .filter(r => r.apprenticeId === apprenticeId)
            .sort((a, b) => {
                if (a.year !== b.year) { return b.year - a.year; }
                return b.weekNumber - a.weekNumber;
            });
    }

    /**
     * Get a single weekly report by ID.
     * @param {string} id
     * @returns {object|null}
     */
    getWeeklyReport(id) {
        return this.reports.find(r => r.id === id) || null;
    }

    /**
     * Update a weekly report.
     * @param {string} id
     * @param {object} data - Fields to update
     * @returns {object|null}
     */
    updateWeeklyReport(id, data) {
        const index = this.reports.findIndex(r => r.id === id);
        if (index === -1) { return null; }

        const { id: _id, apprenticeId: _aid, createdAt: _ca, ...safeData } = data;

        this.reports[index] = {
            ...this.reports[index],
            ...safeData,
            updatedAt: new Date().toISOString()
        };

        this._saveReports();
        return this.reports[index];
    }

    /**
     * Delete a weekly report.
     * @param {string} id
     * @returns {boolean}
     */
    deleteWeeklyReport(id) {
        const before = this.reports.length;
        this.reports = this.reports.filter(r => r.id !== id);
        if (this.reports.length < before) {
            this._saveReports();
            return true;
        }
        return false;
    }

    // ============================================
    // Auto-fill from time entries
    // ============================================

    /**
     * Auto-fill a week's daily activities from time tracking entries.
     * @param {string} apprenticeId
     * @param {string} weekStart - YYYY-MM-DD of Monday
     * @returns {Array} Array of daily activity objects
     */
    autoFillWeek(apprenticeId, weekStart) {
        const days = [];
        const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

        for (let i = 0; i < 5; i++) {
            const date = new Date(weekStart + 'T00:00:00');
            date.setDate(date.getDate() + i);
            const dateStr = this._formatDateISO(date);

            let activities = '';
            let hours = 0;

            // Try to pull from time tracking service
            if (window.timeTrackingService) {
                const entries = window.timeTrackingService.getEntriesForDay(dateStr, apprenticeId);
                if (entries.length > 0) {
                    const descriptions = entries
                        .filter(e => e.description)
                        .map(e => e.description);
                    activities = descriptions.join('; ');
                    hours = entries.reduce((sum, e) => sum + (e.durationHours || 0), 0);
                    hours = Math.round(hours * 100) / 100;
                }
            }

            days.push({
                date: dateStr,
                dayName: dayNames[i],
                activities: activities,
                hours: hours || 8
            });
        }

        return days;
    }

    // ============================================
    // Sign-off workflow
    // ============================================

    /**
     * Apprentice submits the report for review.
     * @param {string} reportId
     * @returns {object|null}
     */
    submitReport(reportId) {
        const report = this.getWeeklyReport(reportId);
        if (!report) { return null; }

        return this.updateWeeklyReport(reportId, {
            status: 'eingereicht',
            apprenticeSigned: true,
            apprenticeSignedAt: new Date().toISOString()
        });
    }

    /**
     * Master approves the report.
     * @param {string} reportId
     * @param {string} masterName
     * @returns {object|null}
     */
    approveReport(reportId, masterName) {
        const report = this.getWeeklyReport(reportId);
        if (!report) { return null; }

        return this.updateWeeklyReport(reportId, {
            status: 'genehmigt',
            masterSigned: true,
            masterSignedAt: new Date().toISOString(),
            masterName: masterName || ''
        });
    }

    /**
     * Master rejects the report with feedback.
     * @param {string} reportId
     * @param {string} feedback
     * @returns {object|null}
     */
    rejectReport(reportId, feedback) {
        const report = this.getWeeklyReport(reportId);
        if (!report) { return null; }

        return this.updateWeeklyReport(reportId, {
            status: 'zurueckgewiesen',
            feedback: feedback || '',
            masterSigned: false,
            masterSignedAt: ''
        });
    }

    // ============================================
    // Status & Statistics
    // ============================================

    /**
     * Get all weeks that are missing a report for an apprentice.
     * Returns an array of {weekNumber, year, weekStart} for each missing week
     * from training start until now.
     * @param {string} apprenticeId
     * @returns {Array}
     */
    getMissingReports(apprenticeId) {
        const apprentice = this.getApprentice(apprenticeId);
        if (!apprentice || !apprentice.trainingStart) { return []; }

        const existingWeeks = new Set();
        this.getWeeklyReports(apprenticeId).forEach(r => {
            existingWeeks.add(`${r.year}-${r.weekNumber}`);
        });

        const missing = [];
        const startDate = new Date(apprentice.trainingStart + 'T00:00:00');
        const now = new Date();

        // Find the Monday of the training start week
        let current = this._getMonday(startDate);
        const endMonday = this._getMonday(now);

        while (current <= endMonday) {
            const weekInfo = this._getISOWeekNumber(current);
            const key = `${weekInfo.year}-${weekInfo.week}`;

            if (!existingWeeks.has(key)) {
                missing.push({
                    weekNumber: weekInfo.week,
                    year: weekInfo.year,
                    weekStart: this._formatDateISO(current)
                });
            }

            current = new Date(current);
            current.setDate(current.getDate() + 7);
        }

        return missing;
    }

    /**
     * Get submission rate for an apprentice (percentage of weeks with reports).
     * @param {string} apprenticeId
     * @returns {number} Percentage 0-100
     */
    getSubmissionRate(apprenticeId) {
        const apprentice = this.getApprentice(apprenticeId);
        if (!apprentice || !apprentice.trainingStart) { return 0; }

        const startDate = new Date(apprentice.trainingStart + 'T00:00:00');
        const now = new Date();

        // Total weeks in training so far
        let current = this._getMonday(startDate);
        const endMonday = this._getMonday(now);
        let totalWeeks = 0;

        while (current <= endMonday) {
            totalWeeks++;
            current = new Date(current);
            current.setDate(current.getDate() + 7);
        }

        if (totalWeeks === 0) { return 100; }

        const reports = this.getWeeklyReports(apprenticeId);
        return Math.round((reports.length / totalWeeks) * 100);
    }

    // ============================================
    // Export
    // ============================================

    /**
     * Export a single report as plain text for printing.
     * @param {string} reportId
     * @returns {string|null}
     */
    exportReportAsText(reportId) {
        const report = this.getWeeklyReport(reportId);
        if (!report) { return null; }

        const apprentice = this.getApprentice(report.apprenticeId);
        const name = apprentice ? apprentice.name : 'Unbekannt';
        const trade = apprentice ? apprentice.trade : '';

        const typeLabels = {
            betrieb: 'Betrieb',
            schule: 'Berufsschule',
            urlaub: 'Urlaub',
            krank: 'Krank',
            feiertag: 'Feiertag'
        };

        let text = '';
        text += '============================================================\n';
        text += '                    BERICHTSHEFT\n';
        text += '             Ausbildungsnachweis (Wochenbericht)\n';
        text += '============================================================\n\n';
        text += `Auszubildende/r:   ${name}\n`;
        text += `Ausbildungsberuf:  ${trade}\n`;
        text += `Ausbildungsjahr:   ${report.trainingYear}\n`;
        text += `Abteilung:         ${report.department || '-'}\n`;
        text += `Kalenderwoche:     KW ${report.weekNumber} / ${report.year}\n`;
        text += `Zeitraum:          ${this._formatDateDE(report.weekStart)} - ${this._formatDateDE(report.weekEnd)}\n`;
        text += '\n------------------------------------------------------------\n\n';

        if (Array.isArray(report.days)) {
            report.days.forEach(day => {
                text += `${day.dayName}, ${this._formatDateDE(day.date)}\n`;
                text += `Typ: ${typeLabels[day.type] || day.type}  |  Stunden: ${day.hours}\n`;

                if (day.type === 'schule' && day.schoolSubjects) {
                    text += `Schulstoff: ${day.schoolSubjects}\n`;
                } else if (day.activities) {
                    text += `Taetigkeit: ${day.activities}\n`;
                }

                if (day.skills && day.skills.length > 0) {
                    text += `Erlernte Fertigkeiten: ${day.skills.join(', ')}\n`;
                }

                text += '\n';
            });
        }

        if (report.weeklyNotes) {
            text += '------------------------------------------------------------\n';
            text += `Wochennotizen: ${report.weeklyNotes}\n\n`;
        }

        text += '============================================================\n';
        text += `Unterschrift Azubi:   ${report.apprenticeSigned ? 'Ja (' + this._formatDateDE(report.apprenticeSignedAt) + ')' : '________________'}\n`;
        text += `Unterschrift Meister: ${report.masterSigned ? report.masterName + ' (' + this._formatDateDE(report.masterSignedAt) + ')' : '________________'}\n`;
        text += `Status:               ${this._getStatusLabel(report.status)}\n`;

        if (report.feedback) {
            text += `Feedback:             ${report.feedback}\n`;
        }

        text += '============================================================\n';

        return text;
    }

    /**
     * Export all reports for an apprentice (for exam preparation).
     * @param {string} apprenticeId
     * @returns {string|null}
     */
    exportAllReports(apprenticeId) {
        const apprentice = this.getApprentice(apprenticeId);
        if (!apprentice) { return null; }

        const reports = this.getWeeklyReports(apprenticeId);

        // Sort chronologically (oldest first) for exam binder
        const sorted = [...reports].sort((a, b) => {
            if (a.year !== b.year) { return a.year - b.year; }
            return a.weekNumber - b.weekNumber;
        });

        let output = '';
        output += '************************************************************\n';
        output += '            BERICHTSHEFT - GESAMTAUSGABE\n';
        output += '         Zur Vorlage bei der Gesellenpruefung\n';
        output += '************************************************************\n\n';
        output += `Name:              ${apprentice.name}\n`;
        output += `Ausbildungsberuf:  ${apprentice.trade}\n`;
        output += `Berufsschule:      ${apprentice.school}\n`;
        output += `Ausbildungszeitraum: ${this._formatDateDE(apprentice.trainingStart)} - ${this._formatDateDE(apprentice.trainingEnd)}\n`;
        output += `Anzahl Berichte:   ${sorted.length}\n`;
        output += `Abschlussquote:    ${this.getSubmissionRate(apprenticeId)}%\n`;
        output += '\n************************************************************\n\n';

        sorted.forEach((report, idx) => {
            output += `--- Bericht ${idx + 1} von ${sorted.length} ---\n\n`;
            output += this.exportReportAsText(report.id);
            output += '\n\n';
        });

        return output;
    }

    // ============================================
    // Week Helpers
    // ============================================

    /**
     * Get info about the current ISO week.
     * @returns {{weekNumber: number, year: number, weekStart: string, weekEnd: string}}
     */
    getCurrentWeek() {
        const now = new Date();
        const monday = this._getMonday(now);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        const weekInfo = this._getISOWeekNumber(monday);

        return {
            weekNumber: weekInfo.week,
            year: weekInfo.year,
            weekStart: this._formatDateISO(monday),
            weekEnd: this._formatDateISO(friday)
        };
    }

    /**
     * Get Mon-Fri dates for a given ISO week.
     * @param {number} year
     * @param {number} weekNumber
     * @returns {Array} Array of 5 date strings (YYYY-MM-DD)
     */
    getWeekDates(year, weekNumber) {
        // Find the Monday of ISO week 1 of the given year
        const jan4 = new Date(year, 0, 4);
        const monday1 = this._getMonday(jan4);

        // Offset to the desired week
        const targetMonday = new Date(monday1);
        targetMonday.setDate(monday1.getDate() + (weekNumber - 1) * 7);

        const dates = [];
        for (let i = 0; i < 5; i++) {
            const d = new Date(targetMonday);
            d.setDate(targetMonday.getDate() + i);
            dates.push(this._formatDateISO(d));
        }

        return dates;
    }

    // ============================================
    // Internal Helpers
    // ============================================

    /**
     * Get the Monday of the week containing the given date.
     * @param {Date} date
     * @returns {Date}
     */
    _getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Get ISO week number and year for a date.
     * Uses the ISO 8601 definition (weeks start Monday, week 1 contains Jan 4).
     * @param {Date} date
     * @returns {{week: number, year: number}}
     */
    _getISOWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        // Set to nearest Thursday (current date + 4 - current day number; Sunday=7)
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

        return {
            week: weekNo,
            year: d.getUTCFullYear()
        };
    }

    /**
     * Format a Date object as YYYY-MM-DD.
     * @param {Date} date
     * @returns {string}
     */
    _formatDateISO(date) {
        if (!date) { return ''; }
        if (typeof date === 'string') {
            // Already a string, check if it's a valid ISO date portion
            if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
                return date.substring(0, 10);
            }
            date = new Date(date);
        }
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Format date string as DD.MM.YYYY (German format).
     * @param {string} dateStr - YYYY-MM-DD or ISO string
     * @returns {string}
     */
    _formatDateDE(dateStr) {
        if (!dateStr) { return '-'; }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) { return dateStr; }
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }

    /**
     * Get a human-readable status label.
     * @param {string} status
     * @returns {string}
     */
    _getStatusLabel(status) {
        const labels = {
            entwurf: 'Entwurf',
            eingereicht: 'Eingereicht',
            genehmigt: 'Genehmigt',
            zurueckgewiesen: 'Zurueckgewiesen'
        };
        return labels[status] || status;
    }
}

// Create global instance
window.apprenticeService = new ApprenticeService();
