/* ============================================
   Team & Subcontractor Management Service
   Mitarbeiter- und Subunternehmerverwaltung
   Stundenverfolgung, Zuweisungen, Qualifikationen
   ============================================ */

class TeamService {
    constructor() {
        this.members = JSON.parse(localStorage.getItem('mhs_team_members') || '[]');
        this.timeEntries = JSON.parse(localStorage.getItem('mhs_time_entries_team') || '[]');
    }

    // ============================================
    // ID Generation
    // ============================================

    _generateId(prefix) {
        const ts = Date.now();
        const rand = Math.random().toString(36).substr(2, 6);
        return `${prefix}-${ts}-${rand}`;
    }

    // ============================================
    // Member CRUD
    // ============================================

    /**
     * Add a new team member or subcontractor
     * @param {Object} data - Member data
     * @returns {Object} Created member
     */
    addMember(data) {
        const now = new Date().toISOString();
        const member = {
            id: this._generateId('TM'),
            name: data.name || '',
            role: data.role || 'geselle', // meister|geselle|azubi|helfer|buero
            type: data.type || 'intern',  // intern|subunternehmer

            // Contact
            phone: data.phone || '',
            email: data.email || '',

            // Employment
            employedSince: data.employedSince || new Date().toISOString().split('T')[0],
            hourlyRate: typeof data.hourlyRate === 'number' ? data.hourlyRate : 0,
            billingRate: typeof data.billingRate === 'number' ? data.billingRate : 0,
            weeklyHours: typeof data.weeklyHours === 'number' ? data.weeklyHours : 40,

            // Skills / Qualifications
            qualifications: Array.isArray(data.qualifications) ? data.qualifications : [],
            trades: Array.isArray(data.trades) ? data.trades : [],

            // Subcontractor specific
            companyName: data.companyName || '',
            taxId: data.taxId || '',
            insuranceVerified: !!data.insuranceVerified,
            insuranceExpiry: data.insuranceExpiry || '',

            // Status
            status: data.status || 'aktiv', // aktiv|inaktiv|urlaub|krank

            // Avatar color for calendar/dispatch
            color: data.color || this._randomColor(),

            createdAt: now,
            updatedAt: now
        };

        this.members.push(member);
        this._saveMembers();
        return member;
    }

    /**
     * Get a single member by ID
     */
    getMember(id) {
        return this.members.find(m => m.id === id) || null;
    }

    /**
     * Get all members
     */
    getMembers() {
        return [...this.members];
    }

    /**
     * Update a member
     * @param {string} id
     * @param {Object} data - Fields to update
     * @returns {Object|null} Updated member or null
     */
    updateMember(id, data) {
        const idx = this.members.findIndex(m => m.id === id);
        if (idx === -1) { return null; }

        // Merge, preserving id and createdAt
        const existing = this.members[idx];
        this.members[idx] = {
            ...existing,
            ...data,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        };

        // Preserve array fields properly
        if (data.qualifications !== undefined) {
            this.members[idx].qualifications = Array.isArray(data.qualifications) ? data.qualifications : existing.qualifications;
        }
        if (data.trades !== undefined) {
            this.members[idx].trades = Array.isArray(data.trades) ? data.trades : existing.trades;
        }

        this._saveMembers();
        return this.members[idx];
    }

    /**
     * Remove a member (soft: sets status to inaktiv)
     */
    removeMember(id) {
        const idx = this.members.findIndex(m => m.id === id);
        if (idx === -1) { return false; }
        this.members.splice(idx, 1);
        this._saveMembers();
        return true;
    }

    /**
     * Get active members (status === 'aktiv')
     */
    getActiveMembers() {
        return this.members.filter(m => m.status === 'aktiv');
    }

    /**
     * Get all subcontractors
     */
    getSubcontractors() {
        return this.members.filter(m => m.type === 'subunternehmer');
    }

    /**
     * Get members by role
     * @param {string} role - meister|geselle|azubi|helfer|buero
     */
    getByRole(role) {
        return this.members.filter(m => m.role === role);
    }

    // ============================================
    // Time Tracking
    // ============================================

    /**
     * Log time for a member
     * @param {string} memberId
     * @param {Object} data - Time entry data
     * @returns {Object} Created time entry
     */
    logTime(memberId, data) {
        const member = this.getMember(memberId);
        if (!member) {
            throw new Error(`Mitarbeiter ${memberId} nicht gefunden`);
        }

        const totalHours = this._calculateHours(data.startTime, data.endTime, data.breakMinutes || 30);

        const entry = {
            id: this._generateId('TE'),
            memberId: memberId,
            date: data.date || new Date().toISOString().split('T')[0],

            // Time
            startTime: data.startTime || '08:00',
            endTime: data.endTime || '16:30',
            breakMinutes: typeof data.breakMinutes === 'number' ? data.breakMinutes : 30,
            totalHours: totalHours,

            // Assignment
            orderId: data.orderId || '',
            orderName: data.orderName || '',
            customerName: data.customerName || '',

            // Type
            type: data.type || 'arbeit', // arbeit|fahrt|bereitschaft|schulung

            // Notes
            notes: data.notes || '',

            // Approval
            approved: !!data.approved,
            approvedBy: data.approvedBy || '',

            createdAt: new Date().toISOString()
        };

        this.timeEntries.push(entry);
        this._saveTimeEntries();
        return entry;
    }

    /**
     * Get time entries for a member in a date range
     * @param {string} memberId
     * @param {string} startDate - YYYY-MM-DD
     * @param {string} endDate - YYYY-MM-DD
     */
    getTimeEntries(memberId, startDate, endDate) {
        return this.timeEntries.filter(e => {
            if (e.memberId !== memberId) { return false; }
            if (startDate && e.date < startDate) { return false; }
            if (endDate && e.date > endDate) { return false; }
            return true;
        }).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    }

    /**
     * Get all time entries linked to a specific order
     * @param {string} orderId
     */
    getTimeEntriesForOrder(orderId) {
        return this.timeEntries.filter(e => e.orderId === orderId)
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Approve a time entry
     * @param {string} entryId
     * @param {string} approverName
     */
    approveTimeEntry(entryId, approverName) {
        const idx = this.timeEntries.findIndex(e => e.id === entryId);
        if (idx === -1) { return null; }

        this.timeEntries[idx].approved = true;
        this.timeEntries[idx].approvedBy = approverName || '';
        this._saveTimeEntries();
        return this.timeEntries[idx];
    }

    /**
     * Get total hours for a member in a given week
     * @param {string} memberId
     * @param {string} weekStartDate - YYYY-MM-DD (Monday)
     */
    getWeeklyHours(memberId, weekStartDate) {
        const start = new Date(weekStartDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const endStr = end.toISOString().split('T')[0];

        const entries = this.getTimeEntries(memberId, weekStartDate, endStr);
        return Math.round(entries.reduce((sum, e) => sum + e.totalHours, 0) * 100) / 100;
    }

    /**
     * Get total hours for a member in a given month
     * @param {string} memberId
     * @param {number} year
     * @param {number} month (1-12)
     */
    getMonthlyHours(memberId, year, month) {
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        const entries = this.timeEntries.filter(e =>
            e.memberId === memberId && e.date.startsWith(monthStr)
        );
        return Math.round(entries.reduce((sum, e) => sum + e.totalHours, 0) * 100) / 100;
    }

    // ============================================
    // Availability / Status
    // ============================================

    /**
     * Set member status
     * @param {string} memberId
     * @param {string} status - aktiv|inaktiv|urlaub|krank
     */
    setStatus(memberId, status) {
        const validStatuses = ['aktiv', 'inaktiv', 'urlaub', 'krank'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Ungültiger Status: ${status}`);
        }
        return this.updateMember(memberId, { status });
    }

    /**
     * Get members available on a given date
     * Available = status is 'aktiv'
     * @param {string} date - YYYY-MM-DD (reserved for future calendar integration)
     */
    getAvailableMembers(date) {
        // Currently checks status only; future: cross-reference with calendar/vacation data
        return this.members.filter(m => m.status === 'aktiv');
    }

    // ============================================
    // Calculations
    // ============================================

    /**
     * Calculate total labour cost for an order
     * @param {string} orderId
     * @returns {Object} { totalHours, totalCost, totalBillable, entries }
     */
    calculateLabourCost(orderId) {
        const entries = this.getTimeEntriesForOrder(orderId);
        let totalCost = 0;
        let totalBillable = 0;
        let totalHours = 0;

        entries.forEach(entry => {
            const member = this.getMember(entry.memberId);
            if (!member) { return; }

            totalHours += entry.totalHours;
            totalCost += entry.totalHours * member.hourlyRate;
            totalBillable += entry.totalHours * member.billingRate;
        });

        return {
            totalHours: Math.round(totalHours * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
            totalBillable: Math.round(totalBillable * 100) / 100,
            entries: entries
        };
    }

    /**
     * Calculate overtime for a member in a month
     * Overtime = actual hours - (weeklyHours * weeks in month)
     * @param {string} memberId
     * @param {number} month (1-12)
     * @param {number} year
     */
    getOvertime(memberId, month, year) {
        const member = this.getMember(memberId);
        if (!member) { return 0; }

        const actualHours = this.getMonthlyHours(memberId, year, month);

        // Calculate working days in the month (Mon-Fri)
        const daysInMonth = new Date(year, month, 0).getDate();
        let workDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const day = new Date(year, month - 1, d).getDay();
            if (day !== 0 && day !== 6) { workDays++; }
        }

        const dailyHours = member.weeklyHours / 5;
        const expectedHours = workDays * dailyHours;

        return Math.round((actualHours - expectedHours) * 100) / 100;
    }

    // ============================================
    // Subcontractor
    // ============================================

    /**
     * Check if a subcontractor's insurance expires within 30 days
     * @param {string} memberId
     */
    isInsuranceExpiringSoon(memberId) {
        const member = this.getMember(memberId);
        if (!member || member.type !== 'subunternehmer' || !member.insuranceExpiry) {
            return false;
        }

        const expiry = new Date(member.insuranceExpiry);
        const now = new Date();
        const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

        return diffDays >= 0 && diffDays <= 30;
    }

    /**
     * Get all subcontractors whose insurance is expiring within 30 days
     */
    getExpiringInsurances() {
        return this.getSubcontractors().filter(m => {
            if (!m.insuranceExpiry) { return false; }
            const expiry = new Date(m.insuranceExpiry);
            const now = new Date();
            const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
            return diffDays <= 30;
        }).map(m => {
            const expiry = new Date(m.insuranceExpiry);
            const now = new Date();
            const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
            return {
                member: m,
                daysLeft: daysLeft,
                expired: daysLeft < 0
            };
        });
    }

    // ============================================
    // Export
    // ============================================

    /**
     * Export monthly report for a member as CSV string
     * @param {string} memberId
     * @param {number} year
     * @param {number} month (1-12)
     * @returns {string} CSV content
     */
    exportMonthlyReport(memberId, year, month) {
        const member = this.getMember(memberId);
        if (!member) { return ''; }

        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        const entries = this.timeEntries
            .filter(e => e.memberId === memberId && e.date.startsWith(monthStr))
            .sort((a, b) => a.date.localeCompare(b.date));

        const monthName = new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

        let csv = `Stundennachweis;${member.name};${monthName}\n`;
        csv += 'Datum;Wochentag;Start;Ende;Pause (Min);Stunden;Auftrag;Typ;Notizen;Genehmigt\n';

        let totalHours = 0;
        entries.forEach(e => {
            const dayName = new Date(e.date).toLocaleDateString('de-DE', { weekday: 'short' });
            const approvedStr = e.approved ? 'Ja' : 'Nein';
            csv += `${e.date};${dayName};${e.startTime};${e.endTime};${e.breakMinutes};${e.totalHours.toFixed(2).replace('.', ',')};${e.orderName || '-'};${e.type};${e.notes || ''};${approvedStr}\n`;
            totalHours += e.totalHours;
        });

        const overtime = this.getOvertime(memberId, month, year);
        csv += `\nGesamt;;;;;;;${totalHours.toFixed(2).replace('.', ',')} Std\n`;
        csv += `Überstunden;;;;;;;${overtime.toFixed(2).replace('.', ',')} Std\n`;
        csv += `Kosten (intern);;;;;;;${(totalHours * member.hourlyRate).toFixed(2).replace('.', ',')} EUR\n`;

        return csv;
    }

    /**
     * Export full team overview as CSV string
     * @returns {string} CSV content
     */
    exportTeamOverview() {
        let csv = 'ID;Name;Rolle;Typ;Status;Telefon;E-Mail;Stundensatz;Abrechnungssatz;Wochenstunden;Eingestellt seit;Qualifikationen;Gewerke\n';

        this.members.forEach(m => {
            csv += `${m.id};${m.name};${m.role};${m.type};${m.status};${m.phone};${m.email};`;
            csv += `${m.hourlyRate.toFixed(2).replace('.', ',')};${m.billingRate.toFixed(2).replace('.', ',')};`;
            csv += `${m.weeklyHours};${m.employedSince};`;
            csv += `${(m.qualifications || []).join(', ')};${(m.trades || []).join(', ')}\n`;
        });

        return csv;
    }

    // ============================================
    // Helpers (private)
    // ============================================

    /**
     * Calculate net hours from start/end/break
     */
    _calculateHours(startTime, endTime, breakMinutes) {
        if (!startTime || !endTime) { return 0; }
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        const netMins = Math.max(0, endMins - startMins - (breakMinutes || 0));
        return Math.round(netMins / 60 * 100) / 100;
    }

    /**
     * Generate a random hex color for member avatar
     */
    _randomColor() {
        const colors = [
            '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
            '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
            '#eab308', '#84cc16', '#22c55e', '#14b8a6',
            '#06b6d4', '#0ea5e9', '#3b82f6', '#2563eb'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // ============================================
    // Persistence
    // ============================================

    _saveMembers() {
        localStorage.setItem('mhs_team_members', JSON.stringify(this.members));
    }

    _saveTimeEntries() {
        localStorage.setItem('mhs_time_entries_team', JSON.stringify(this.timeEntries));
    }
}

window.teamService = new TeamService();
