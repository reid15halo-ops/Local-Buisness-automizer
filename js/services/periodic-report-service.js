/* ============================================
   Periodic Report Service
   Weekly / Monthly / Quarterly / Yearly reports
   ============================================ */

class PeriodicReportService {

    // ----------------------------------------
    // Date helpers
    // ----------------------------------------

    _store() {
        return window.store || window.storeService?.state || {};
    }

    _bk() {
        return window.bookkeepingService || null;
    }

    _fmt(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) { return '0,00 €'; }
        return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }

    _fmtDate(iso) {
        if (!iso) { return '—'; }
        try { return new Date(iso).toLocaleDateString('de-DE'); } catch { return iso.slice(0, 10); }
    }

    _pct(part, total) {
        if (!total) { return '0 %'; }
        return Math.round((part / total) * 100) + ' %';
    }

    // Returns {start, end} as Date objects for a given period
    _weekRange() {
        const end   = new Date(); end.setHours(23, 59, 59, 999);
        const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
        return { start, end };
    }

    _monthRange() {
        const now   = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { start, end };
    }

    _quarterRange() {
        const now = new Date();
        // Last completed quarter
        const currentQ = Math.floor(now.getMonth() / 3);
        const prevQ    = currentQ === 0 ? 3 : currentQ - 1;
        const year     = currentQ === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const start    = new Date(year, prevQ * 3, 1);
        const end      = new Date(year, prevQ * 3 + 3, 0, 23, 59, 59);
        return { start, end, quarter: prevQ + 1, year };
    }

    _yearRange() {
        const year  = new Date().getFullYear() - 1;
        const start = new Date(year, 0, 1);
        const end   = new Date(year, 11, 31, 23, 59, 59);
        return { start, end, year };
    }

    _inRange(iso, start, end) {
        if (!iso) { return false; }
        const d = new Date(iso);
        return d >= start && d <= end;
    }

    // ----------------------------------------
    // Shared data builders
    // ----------------------------------------

    _invoicesInRange(start, end) {
        return (this._store().rechnungen || []).filter(r =>
            this._inRange(r.datum || r.createdAt, start, end)
        );
    }

    _anfrageInRange(start, end) {
        return (this._store().anfragen || []).filter(r =>
            this._inRange(r.createdAt, start, end)
        );
    }

    _angebotInRange(start, end) {
        return (this._store().angebote || []).filter(r =>
            this._inRange(r.createdAt, start, end)
        );
    }

    _auftragInRange(start, end) {
        return (this._store().auftraege || []).filter(r =>
            this._inRange(r.createdAt, start, end)
        );
    }

    _revenueStats(invoices) {
        const paid = invoices.filter(r => r.status === 'bezahlt');
        const open = invoices.filter(r => r.status === 'offen' || r.status === 'versendet');
        const cancelled = invoices.filter(r => r.status === 'storniert');
        const sum = arr => arr.reduce((s, r) => s + (r.brutto || 0), 0);
        return {
            total: invoices.length,
            brutto: sum(invoices),
            paid: { count: paid.length, sum: sum(paid) },
            open: { count: open.length, sum: sum(open) },
            cancelled: { count: cancelled.length, sum: sum(cancelled) }
        };
    }

    _topCustomers(invoices, n = 5) {
        const byCustomer = {};
        invoices.filter(r => r.status === 'bezahlt').forEach(r => {
            const name = r.kunde?.name || 'Unbekannt';
            if (!byCustomer[name]) { byCustomer[name] = { name, sum: 0, count: 0 }; }
            byCustomer[name].sum += r.brutto || 0;
            byCustomer[name].count++;
        });
        return Object.values(byCustomer).sort((a, b) => b.sum - a.sum).slice(0, n);
    }

    _byLeistungsart(invoices) {
        const map = {};
        invoices.forEach(r => {
            const k = r.leistungsart || 'sonstige';
            if (!map[k]) { map[k] = { sum: 0, count: 0 }; }
            map[k].sum += r.brutto || 0;
            map[k].count++;
        });
        return Object.entries(map)
            .map(([key, v]) => ({ key, ...v }))
            .sort((a, b) => b.sum - a.sum);
    }

    _invoiceAging(allOpen) {
        const now = new Date();
        const buckets = { fresh: [], due14: [], due30: [], due60: [], critical: [] };
        allOpen.forEach(r => {
            const due = new Date(r.faelligkeitsdatum || r.datum || r.createdAt);
            const days = Math.floor((now - due) / 86400000);
            if (days <= 0)       { buckets.fresh.push(r); }
            else if (days <= 14) { buckets.due14.push(r); }
            else if (days <= 30) { buckets.due30.push(r); }
            else if (days <= 60) { buckets.due60.push(r); }
            else                 { buckets.critical.push(r); }
        });
        return buckets;
    }

    _monthlyRevenue(invoices, year) {
        const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, sum: 0, count: 0 }));
        invoices.forEach(r => {
            const d = new Date(r.datum || r.createdAt);
            if (d.getFullYear() === year) {
                const m = d.getMonth();
                months[m].sum   += r.brutto || 0;
                months[m].count += 1;
            }
        });
        return months;
    }

    _quarterRevenue(invoices, year) {
        const quarters = [
            { label: 'Q1 (Jan–Mär)', months: [0, 1, 2], sum: 0, count: 0 },
            { label: 'Q2 (Apr–Jun)', months: [3, 4, 5], sum: 0, count: 0 },
            { label: 'Q3 (Jul–Sep)', months: [6, 7, 8], sum: 0, count: 0 },
            { label: 'Q4 (Okt–Dez)', months: [9, 10, 11], sum: 0, count: 0 }
        ];
        invoices.forEach(r => {
            const d = new Date(r.datum || r.createdAt);
            if (d.getFullYear() === year) {
                const q = Math.floor(d.getMonth() / 3);
                quarters[q].sum   += r.brutto || 0;
                quarters[q].count += 1;
            }
        });
        return quarters;
    }

    _expenseCategories(start, end) {
        const bk = this._bk();
        if (!bk) { return []; }
        const map = {};
        bk.buchungen
            .filter(b => b.typ === 'ausgabe' && this._inRange(b.datum, start, end))
            .forEach(b => {
                const k = b.kategorie || 'Sonstige';
                if (!map[k]) { map[k] = 0; }
                map[k] += b.brutto || 0;
            });
        return Object.entries(map).map(([k, v]) => ({ kategorie: k, sum: v }))
            .sort((a, b) => b.sum - a.sum);
    }

    _totalIncome(start, end) {
        const bk = this._bk();
        if (!bk) { return 0; }
        return bk.buchungen
            .filter(b => b.typ === 'einnahme' && this._inRange(b.datum, start, end))
            .reduce((s, b) => s + (b.brutto || 0), 0);
    }

    _totalExpenses(start, end) {
        return this._expenseCategories(start, end).reduce((s, c) => s + c.sum, 0);
    }

    // ----------------------------------------
    // HTML building blocks
    // ----------------------------------------

    _section(title, html) {
        return `<div class="pr-section"><h3 class="pr-section-title">${title}</h3>${html}</div>`;
    }

    _kpiRow(kpis) {
        const cards = kpis.map(k => `
            <div class="pr-kpi">
                <span class="pr-kpi-label">${k.label}</span>
                <span class="pr-kpi-value ${k.cls || ''}">${k.value}</span>
                ${k.sub ? `<span class="pr-kpi-sub">${k.sub}</span>` : ''}
            </div>`).join('');
        return `<div class="pr-kpi-row">${cards}</div>`;
    }

    _table(headers, rows, emptyMsg = 'Keine Daten vorhanden') {
        if (!rows.length) { return `<p class="pr-empty">${emptyMsg}</p>`; }
        const th = headers.map(h => `<th>${h}</th>`).join('');
        const tr = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
        return `<table class="pr-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
    }

    _header(title, period, badge) {
        return `
        <div class="pr-header">
            <div>
                <h2 class="pr-title">${title}</h2>
                <p class="pr-period">${period}</p>
            </div>
            <span class="pr-badge">${badge}</span>
        </div>`;
    }

    // ----------------------------------------
    // CSS (injected once)
    // ----------------------------------------

    injectStyles() {
        if (document.getElementById('periodic-report-styles')) { return; }
        const s = document.createElement('style');
        s.id = 'periodic-report-styles';
        s.textContent = `
        .pr-wrap { font-family: inherit; color: var(--text-primary, #e4e4e7); }
        .pr-header { display: flex; justify-content: space-between; align-items: flex-start;
            background: var(--bg-card, #1c1c21); border: 1px solid var(--border-color, #27272a);
            border-radius: 10px; padding: 20px 24px; margin-bottom: 20px; }
        .pr-title { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
        .pr-period { margin: 0; color: var(--text-muted, #71717a); font-size: 13px; }
        .pr-badge { background: #6366f120; color: #818cf8; border: 1px solid #6366f140;
            border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 600;
            white-space: nowrap; margin-top: 4px; }
        .pr-section { margin-bottom: 24px; }
        .pr-section-title { font-size: 13px; font-weight: 600; text-transform: uppercase;
            letter-spacing: .5px; color: var(--text-muted, #71717a); margin: 0 0 12px; }
        .pr-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px; margin-bottom: 8px; }
        .pr-kpi { background: var(--bg-card, #1c1c21); border: 1px solid var(--border-color, #27272a);
            border-radius: 8px; padding: 14px 16px; }
        .pr-kpi-label { display: block; font-size: 11px; color: var(--text-muted, #71717a);
            text-transform: uppercase; letter-spacing: .4px; margin-bottom: 6px; }
        .pr-kpi-value { display: block; font-size: 20px; font-weight: 700; }
        .pr-kpi-value.green  { color: #22c55e; }
        .pr-kpi-value.yellow { color: #f59e0b; }
        .pr-kpi-value.red    { color: #ef4444; }
        .pr-kpi-value.blue   { color: #60a5fa; }
        .pr-kpi-sub { display: block; font-size: 11px; color: var(--text-muted, #71717a); margin-top: 4px; }
        .pr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .pr-table th { font-size: 11px; text-transform: uppercase; letter-spacing: .4px;
            color: var(--text-muted, #71717a); font-weight: 600; text-align: left;
            padding: 8px 10px; border-bottom: 1px solid var(--border-color, #27272a); }
        .pr-table td { padding: 9px 10px; border-bottom: 1px solid #ffffff08; }
        .pr-table tr:last-child td { border-bottom: none; }
        .pr-table tr:hover td { background: #ffffff04; }
        .pr-table td:last-child, .pr-table th:last-child { text-align: right; }
        .pr-empty { color: var(--text-muted, #71717a); font-size: 13px; padding: 8px 0; }
        .pr-divider { border: none; border-top: 1px solid var(--border-color, #27272a);
            margin: 20px 0; }
        .pr-eur-table td:first-child { color: var(--text-muted, #71717a); }
        .pr-eur-table tr.eur-total td { font-weight: 700; border-top: 1px solid var(--border-color, #27272a); }
        .pr-eur-table tr.eur-profit td { font-weight: 700; font-size: 15px; color: #22c55e; }
        .pr-eur-table tr.eur-loss   td { font-weight: 700; font-size: 15px; color: #ef4444; }
        .pr-export-bar { display: flex; gap: 10px; margin-bottom: 20px; }
        .pr-export-btn { background: var(--bg-card, #1c1c21); border: 1px solid var(--border-color, #27272a);
            color: var(--text-primary, #e4e4e7); padding: 8px 16px; border-radius: 6px;
            cursor: pointer; font-size: 13px; }
        .pr-export-btn:hover { border-color: #6366f1; }
        .aging-bar { display: flex; gap: 8px; align-items: center; font-size: 12px; }
        .aging-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        `;
        document.head.appendChild(s);
    }

    // ----------------------------------------
    // Generate weekly report
    // ----------------------------------------

    generateWeekly() {
        const { start, end } = this._weekRange();
        const invoices  = this._invoicesInRange(start, end);
        const anfragen  = this._anfrageInRange(start, end);
        const angebote  = this._angebotInRange(start, end);
        const auftraege = this._auftragInRange(start, end);
        const rev       = this._revenueStats(invoices);

        const startLabel = start.toLocaleDateString('de-DE');
        const endLabel   = end.toLocaleDateString('de-DE');

        // All currently open invoices (not just this week) for outstanding amount
        const allOpen = (this._store().rechnungen || []).filter(r =>
            r.status === 'offen' || r.status === 'versendet'
        );

        const completedJobs = auftraege.filter(a => a.status === 'abgeschlossen');

        return {
            type: 'weekly',
            title: 'Wochenbericht',
            period: `${startLabel} – ${endLabel}`,
            badge: 'KW ' + this._calWeek(start),
            start, end,
            kpis: [
                { label: 'Umsatz (Brutto)', value: this._fmt(rev.paid.sum), cls: 'green' },
                { label: 'Offen (gesamt)', value: this._fmt(allOpen.reduce((s,r)=>s+(r.brutto||0),0)), cls: 'yellow' },
                { label: 'Neue Anfragen', value: anfragen.length, cls: 'blue' },
                { label: 'Neue Angebote', value: angebote.length },
                { label: 'Jobs abgeschlossen', value: completedJobs.length, cls: 'green' }
            ],
            invoices, anfragen, angebote, auftraege, allOpen
        };
    }

    _calWeek(d) {
        const date = new Date(d); date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }

    // ----------------------------------------
    // Generate monthly report
    // ----------------------------------------

    generateMonthly() {
        const { start, end } = this._monthRange();
        const invoices  = this._invoicesInRange(start, end);
        const anfragen  = this._anfrageInRange(start, end);
        const angebote  = this._angebotInRange(start, end);
        const rev       = this._revenueStats(invoices);
        const topCustomers    = this._topCustomers(invoices, 5);
        const byLeistungsart  = this._byLeistungsart(invoices);
        const allOpenInvoices = (this._store().rechnungen || []).filter(r =>
            r.status === 'offen' || r.status === 'versendet'
        );
        const aging = this._invoiceAging(allOpenInvoices);
        const expenses = this._expenseCategories(start, end);
        const income   = this._totalIncome(start, end);
        const totalExp = expenses.reduce((s, c) => s + c.sum, 0);

        const monthNames = ['Januar','Februar','März','April','Mai','Juni',
                            'Juli','August','September','Oktober','November','Dezember'];
        const monthLabel = monthNames[start.getMonth()] + ' ' + start.getFullYear();

        const convRate = anfragen.length
            ? Math.round((angebote.length / anfragen.length) * 100) + ' %'
            : '—';

        return {
            type: 'monthly', title: 'Monatsbericht', period: monthLabel,
            badge: 'Monatlich',
            start, end,
            kpis: [
                { label: 'Einnahmen (bezahlt)', value: this._fmt(rev.paid.sum), cls: 'green' },
                { label: 'Ausstehend', value: this._fmt(rev.open.sum), cls: 'yellow' },
                { label: 'Ausgaben', value: this._fmt(totalExp), cls: totalExp > income ? 'red' : '' },
                { label: 'Ergebnis', value: this._fmt(income - totalExp), cls: income >= totalExp ? 'green' : 'red' },
                { label: 'Anfragen', value: anfragen.length, cls: 'blue' },
                { label: 'Angebote', value: angebote.length },
                { label: 'Konversionsrate', value: convRate }
            ],
            rev, topCustomers, byLeistungsart, aging, expenses, income, totalExp,
            invoices, anfragen, angebote
        };
    }

    // ----------------------------------------
    // Generate quarterly report
    // ----------------------------------------

    generateQuarterly() {
        const { start, end, quarter, year } = this._quarterRange();
        const invoices   = this._invoicesInRange(start, end);
        const anfragen   = this._anfrageInRange(start, end);
        const angebote   = this._angebotInRange(start, end);
        const auftraege  = this._auftragInRange(start, end);
        const rev        = this._revenueStats(invoices);
        const expenses   = this._expenseCategories(start, end);
        const totalExp   = expenses.reduce((s, c) => s + c.sum, 0);
        const income     = this._totalIncome(start, end);
        const topCustomers = this._topCustomers(invoices, 8);

        // Month-by-month within the quarter
        const qMonths = [];
        for (let m = 0; m < 3; m++) {
            const ms = new Date(year, (quarter - 1) * 3 + m, 1);
            const me = new Date(year, (quarter - 1) * 3 + m + 1, 0, 23, 59, 59);
            const mi = this._invoicesInRange(ms, me);
            const mr = this._revenueStats(mi);
            const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
            qMonths.push({
                label: monthNames[(quarter - 1) * 3 + m],
                invoices: mi.length, paid: mr.paid.sum, open: mr.open.sum
            });
        }

        // USt estimate
        const ust = this._bk()?.berechneUStVA(year, null, quarter);

        // All-time customers vs. new ones this quarter
        const allCustomers = new Set((this._store().rechnungen || []).map(r => r.kunde?.name));
        const newCustomers = new Set(invoices.map(r => r.kunde?.name).filter(n =>
            ![...(this._store().rechnungen || [])].filter(r =>
                new Date(r.datum || r.createdAt) < start
            ).some(r => r.kunde?.name === n)
        ));

        const completedJobs = auftraege.filter(a => a.status === 'abgeschlossen');

        return {
            type: 'quarterly',
            title: `Quartalsbericht Q${quarter}/${year}`,
            period: `${start.toLocaleDateString('de-DE')} – ${end.toLocaleDateString('de-DE')}`,
            badge: `Q${quarter} ${year}`,
            start, end, quarter, year,
            kpis: [
                { label: 'Einnahmen', value: this._fmt(income), cls: 'green' },
                { label: 'Ausgaben', value: this._fmt(totalExp) },
                { label: 'Ergebnis', value: this._fmt(income - totalExp), cls: income >= totalExp ? 'green' : 'red' },
                { label: 'USt-Zahllast', value: ust ? this._fmt(ust.zahllast) : '—', cls: 'yellow' },
                { label: 'Rechnungen', value: rev.total },
                { label: 'Bezahlt', value: rev.paid.count, cls: 'green' },
                { label: 'Neukunden', value: newCustomers.size, cls: 'blue' },
                { label: 'Jobs erledigt', value: completedJobs.length, cls: 'green' }
            ],
            rev, expenses, income, totalExp, topCustomers, qMonths, ust,
            newCustomers: newCustomers.size, totalCustomers: allCustomers.size,
            anfragen, angebote, auftraege
        };
    }

    // ----------------------------------------
    // Generate yearly report
    // ----------------------------------------

    generateYearly() {
        const { start, end, year } = this._yearRange();
        const allInvoices = this._store().rechnungen || [];
        const invoices    = allInvoices.filter(r =>
            this._inRange(r.datum || r.createdAt, start, end)
        );
        const anfragen  = this._anfrageInRange(start, end);
        const angebote  = this._angebotInRange(start, end);
        const auftraege = this._auftragInRange(start, end);
        const rev       = this._revenueStats(invoices);
        const topCustomers    = this._topCustomers(invoices, 10);
        const byLeistungsart  = this._byLeistungsart(invoices);
        const monthly         = this._monthlyRevenue(invoices, year);
        const quarterly       = this._quarterRevenue(invoices, year);
        const expenses        = this._expenseCategories(start, end);
        const totalExp        = expenses.reduce((s, c) => s + c.sum, 0);
        const income          = this._totalIncome(start, end);
        const eur             = this._bk()?.berechneEUR(year) || null;

        const completedJobs = auftraege.filter(a => a.status === 'abgeschlossen');
        const avgInvoice    = rev.total ? rev.brutto / rev.total : 0;

        const allCustomerNames = new Set(allInvoices.map(r => r.kunde?.name).filter(Boolean));
        const yearCustomerNames = new Set(invoices.map(r => r.kunde?.name).filter(Boolean));
        const newCustomerNames = new Set(
            invoices.map(r => r.kunde?.name).filter(name =>
                name && ![...allInvoices].filter(r =>
                    new Date(r.datum || r.createdAt) < start
                ).some(r => r.kunde?.name === name)
            )
        );

        return {
            type: 'yearly',
            title: `Jahresbericht ${year}`,
            period: `1. Januar ${year} – 31. Dezember ${year}`,
            badge: `Geschäftsjahr ${year}`,
            start, end, year,
            kpis: [
                { label: 'Jahresumsatz', value: this._fmt(rev.paid.sum), cls: 'green' },
                { label: 'Ausgaben gesamt', value: this._fmt(totalExp) },
                { label: 'Jahresgewinn', value: this._fmt(income - totalExp), cls: income >= totalExp ? 'green' : 'red' },
                { label: 'Rechnungen gesamt', value: rev.total },
                { label: 'Ø Rechnungswert', value: this._fmt(avgInvoice) },
                { label: 'Aktive Kunden', value: yearCustomerNames.size, cls: 'blue' },
                { label: 'Neukunden', value: newCustomerNames.size, cls: 'green' },
                { label: 'Jobs erledigt', value: completedJobs.length, cls: 'green' }
            ],
            rev, income, totalExp, eur, expenses, topCustomers, byLeistungsart,
            monthly, quarterly,
            anfragen, angebote, auftraege,
            avgInvoice, yearCustomerNames: yearCustomerNames.size,
            newCustomers: newCustomerNames.size,
            totalCustomers: allCustomerNames.size
        };
    }

    // ----------------------------------------
    // Render HTML
    // ----------------------------------------

    renderHTML(report) {
        this.injectStyles();
        switch (report.type) {
            case 'weekly':    return this._renderWeekly(report);
            case 'monthly':   return this._renderMonthly(report);
            case 'quarterly': return this._renderQuarterly(report);
            case 'yearly':    return this._renderYearly(report);
            default: return '<p>Unbekannter Berichtstyp</p>';
        }
    }

    _exportBtn(type) {
        return `<div class="pr-export-bar">
            <button class="pr-export-btn" onclick="window.periodicReportService.downloadCSV('${type}')">⬇ CSV herunterladen</button>
            <button class="pr-export-btn" onclick="window.print()">🖨 Drucken</button>
        </div>`;
    }

    // -- Weekly --
    _renderWeekly(r) {
        const rev = this._revenueStats(r.invoices);
        const outstd = r.allOpen.reduce((s, inv) => s + (inv.brutto || 0), 0);
        const topRows = this._topCustomers(r.invoices, 5)
            .map(c => [c.name, c.count, this._fmt(c.sum)]);

        const recentInvoices = r.invoices.slice(0, 8).map(inv => [
            inv.id, inv.kunde?.name || '—',
            this._fmt(inv.brutto),
            inv.status === 'bezahlt'
                ? '<span style="color:#22c55e">✓ Bezahlt</span>'
                : '<span style="color:#f59e0b">Offen</span>'
        ]);

        return `<div class="pr-wrap">
            ${this._header(r.title, r.period, r.badge)}
            ${this._exportBtn('weekly')}
            ${this._section('Übersicht', this._kpiRow(r.kpis))}
            ${this._section('Umsatz diese Woche',
                this._kpiRow([
                    { label: 'Bezahlt', value: this._fmt(rev.paid.sum), cls: 'green', sub: `${rev.paid.count} Rechnung(en)` },
                    { label: 'Neu offen', value: this._fmt(rev.open.sum), cls: 'yellow', sub: `${rev.open.count} Rechnung(en)` },
                    { label: 'Ausstehend (gesamt)', value: this._fmt(outstd), cls: 'yellow', sub: `${r.allOpen.length} offene Rechnungen` }
                ])
            )}
            ${r.invoices.length ? this._section('Rechnungen diese Woche',
                this._table(['Nr.', 'Kunde', 'Betrag', 'Status'], recentInvoices)
            ) : ''}
            ${topRows.length ? this._section('Top Kunden (bezahlte Rechnungen)',
                this._table(['Kunde', 'Rechnungen', 'Umsatz'], topRows)
            ) : ''}
            ${r.anfragen.length ? this._section('Neue Anfragen',
                this._table(
                    ['Kunde', 'Leistungsart', 'Eingang'],
                    r.anfragen.slice(0, 6).map(a => [
                        a.kunde?.name || '—',
                        a.leistungsart || '—',
                        this._fmtDate(a.createdAt)
                    ])
                )
            ) : ''}
        </div>`;
    }

    // -- Monthly --
    _renderMonthly(r) {
        const agingRows = [
            ['Noch nicht fällig', r.aging.fresh.length, this._fmt(r.aging.fresh.reduce((s,i)=>s+(i.brutto||0),0)), ''],
            ['1–14 Tage überfällig', r.aging.due14.length, this._fmt(r.aging.due14.reduce((s,i)=>s+(i.brutto||0),0)), '<span style="color:#f59e0b">●</span>'],
            ['15–30 Tage überfällig', r.aging.due30.length, this._fmt(r.aging.due30.reduce((s,i)=>s+(i.brutto||0),0)), '<span style="color:#f97316">●</span>'],
            ['31–60 Tage überfällig', r.aging.due60.length, this._fmt(r.aging.due60.reduce((s,i)=>s+(i.brutto||0),0)), '<span style="color:#ef4444">●</span>'],
            ['Über 60 Tage überfällig', r.aging.critical.length, this._fmt(r.aging.critical.reduce((s,i)=>s+(i.brutto||0),0)), '<span style="color:#dc2626;font-weight:700">●</span>']
        ].filter(row => row[1] > 0);

        const leistRows = r.byLeistungsart.map(l => [
            l.key, l.count, this._fmt(l.sum), this._pct(l.sum, r.rev.brutto)
        ]);

        const expRows = r.expenses.slice(0, 8).map(e => [e.kategorie, this._fmt(e.sum)]);

        return `<div class="pr-wrap">
            ${this._header(r.title, r.period, r.badge)}
            ${this._exportBtn('monthly')}
            ${this._section('Monatsübersicht', this._kpiRow(r.kpis))}
            ${this._section('Einnahmen vs. Ausgaben',
                this._kpiRow([
                    { label: 'Einnahmen', value: this._fmt(r.income), cls: 'green' },
                    { label: 'Ausgaben', value: this._fmt(r.totalExp), cls: r.totalExp > r.income ? 'red' : '' },
                    { label: 'Monatsergebnis', value: this._fmt(r.income - r.totalExp), cls: r.income >= r.totalExp ? 'green' : 'red' }
                ])
            )}
            ${r.topCustomers.length ? this._section('Top Kunden',
                this._table(
                    ['Kunde', 'Rechnungen', 'Umsatz'],
                    r.topCustomers.map(c => [c.name, c.count, this._fmt(c.sum)])
                )
            ) : ''}
            ${leistRows.length ? this._section('Umsatz nach Leistungsart',
                this._table(['Leistungsart', 'Rechnungen', 'Umsatz', 'Anteil'], leistRows)
            ) : ''}
            ${agingRows.length ? this._section('Zahlungsalterung — offene Rechnungen',
                this._table(['Zeitraum', 'Anzahl', 'Betrag', ''], agingRows)
            ) : ''}
            ${expRows.length ? this._section('Ausgaben nach Kategorie',
                this._table(['Kategorie', 'Betrag'], expRows)
            ) : ''}
        </div>`;
    }

    // -- Quarterly --
    _renderQuarterly(r) {
        const monthRows = r.qMonths.map(m => [
            m.label, m.invoices, this._fmt(m.paid), this._fmt(m.open)
        ]);

        const expRows = r.expenses.map(e => [e.kategorie, this._fmt(e.sum)]);

        const topRows = r.topCustomers.map(c => [c.name, c.count, this._fmt(c.sum)]);

        const ustSection = r.ust ? this._section('USt-Voranmeldung ' + r.ust.zeitraum,
            this._kpiRow([
                { label: 'Umsätze (netto)', value: this._fmt(r.ust.umsaetze19) },
                { label: 'Umsatzsteuer 19 %', value: this._fmt(r.ust.ust19), cls: 'yellow' },
                { label: 'Vorsteuer', value: this._fmt(r.ust.vorsteuer), cls: 'green' },
                { label: 'Zahllast', value: this._fmt(r.ust.zahllast), cls: 'red' }
            ])
        ) : '';

        return `<div class="pr-wrap">
            ${this._header(r.title, r.period, r.badge)}
            ${this._exportBtn('quarterly')}
            ${this._section('Quartalsübersicht', this._kpiRow(r.kpis))}
            ${this._section('Ergebnis',
                this._kpiRow([
                    { label: 'Einnahmen', value: this._fmt(r.income), cls: 'green' },
                    { label: 'Ausgaben', value: this._fmt(r.totalExp) },
                    { label: 'Ergebnis vor Steuer', value: this._fmt(r.income - r.totalExp), cls: r.income >= r.totalExp ? 'green' : 'red' },
                    { label: 'Neue Kunden', value: r.newCustomers, cls: 'blue' },
                    { label: 'Kunden gesamt', value: r.totalCustomers }
                ])
            )}
            ${monthRows.length ? this._section('Monatsentwicklung im Quartal',
                this._table(['Monat', 'Rechnungen', 'Bezahlt', 'Offen'], monthRows)
            ) : ''}
            ${topRows.length ? this._section('Top Kunden im Quartal',
                this._table(['Kunde', 'Rechnungen', 'Umsatz'], topRows)
            ) : ''}
            ${expRows.length ? this._section('Ausgaben nach Kategorie',
                this._table(['Kategorie', 'Betrag'], expRows)
            ) : ''}
            ${ustSection}
        </div>`;
    }

    // -- Yearly --
    _renderYearly(r) {
        const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
        const monthRows = r.monthly.map((m, i) => [
            monthNames[i], m.count, this._fmt(m.sum)
        ]);
        const qRows = r.quarterly.map(q => [q.label, q.count, this._fmt(q.sum)]);
        const topRows = r.topCustomers.map(c => [c.name, c.count, this._fmt(c.sum)]);
        const leistRows = r.byLeistungsart.map(l => [
            l.key, l.count, this._fmt(l.sum), this._pct(l.sum, r.rev.brutto)
        ]);
        const expRows = r.expenses.map(e => [e.kategorie, this._fmt(e.sum)]);

        const eurSection = r.eur ? this._section('Einnahmen-Überschuss-Rechnung (EÜR) ' + r.year, `
            <table class="pr-table pr-eur-table">
                <tbody>
                    <tr><td>Einnahmen (Brutto)</td><td style="text-align:right">${this._fmt(r.eur.einnahmen.brutto)}</td></tr>
                    <tr><td>Enthaltene Umsatzsteuer</td><td style="text-align:right">${this._fmt(r.eur.einnahmen.ust)}</td></tr>
                    <tr><td>Einnahmen (Netto)</td><td style="text-align:right">${this._fmt(r.eur.einnahmen.netto)}</td></tr>
                    <tr><td colspan="2" style="padding:4px 0"></td></tr>
                    <tr><td>Materialaufwendungen</td><td style="text-align:right">- ${this._fmt(r.eur.materialaufwendungen.brutto)}</td></tr>
                    <tr class="eur-total"><td>Rohertrag</td><td style="text-align:right">${this._fmt(r.eur.rohertrag)}</td></tr>
                    <tr><td colspan="2" style="padding:4px 0"></td></tr>
                    <tr><td>Sonstige Betriebsausgaben</td><td style="text-align:right">- ${this._fmt(r.eur.ausgaben.brutto)}</td></tr>
                    <tr><td>Vorsteuer</td><td style="text-align:right">+ ${this._fmt(r.eur.ausgaben.vorsteuer)}</td></tr>
                    <tr class="${r.eur.gewinn >= 0 ? 'eur-profit' : 'eur-loss'}">
                        <td>Jahresüberschuss / Gewinn</td>
                        <td style="text-align:right">${this._fmt(r.eur.gewinn)}</td>
                    </tr>
                    ${!r.eur.kleinunternehmer ? `
                    <tr><td colspan="2" style="padding:4px 0"></td></tr>
                    <tr><td>USt-Zahllast</td><td style="text-align:right">${this._fmt(r.eur.ustZahllast)}</td></tr>` : ''}
                </tbody>
            </table>`) : '';

        return `<div class="pr-wrap">
            ${this._header(r.title, r.period, r.badge)}
            ${this._exportBtn('yearly')}
            ${this._section('Jahresübersicht', this._kpiRow(r.kpis))}
            ${this._section('Geschäftskennzahlen',
                this._kpiRow([
                    { label: 'Ø Rechnungswert', value: this._fmt(r.avgInvoice) },
                    { label: 'Stornierte Rechnungen', value: r.rev.cancelled.count, cls: 'red' },
                    { label: 'Anfragen gesamt', value: r.anfragen.length, cls: 'blue' },
                    { label: 'Angebote gesamt', value: r.angebote.length },
                    { label: 'Aufträge gesamt', value: r.auftraege.length },
                    { label: 'Konversionsrate', value: r.anfragen.length
                        ? this._pct(r.angebote.length, r.anfragen.length) : '—' }
                ])
            )}
            ${eurSection}
            ${qRows.length ? this._section('Quartalsentwicklung',
                this._table(['Quartal', 'Rechnungen', 'Umsatz'], qRows)
            ) : ''}
            ${monthRows.length ? this._section('Monatlicher Umsatz',
                this._table(['Monat', 'Rechnungen', 'Umsatz (Brutto)'], monthRows)
            ) : ''}
            ${leistRows.length ? this._section('Umsatz nach Leistungsart',
                this._table(['Leistungsart', 'Rechnungen', 'Umsatz', 'Anteil'], leistRows)
            ) : ''}
            ${topRows.length ? this._section('Top 10 Kunden',
                this._table(['Kunde', 'Rechnungen', 'Umsatz'], topRows)
            ) : ''}
            ${expRows.length ? this._section('Ausgaben nach Kategorie',
                this._table(['Kategorie', 'Betrag'], expRows)
            ) : ''}
        </div>`;
    }

    // ----------------------------------------
    // CSV export
    // ----------------------------------------

    _lastReport = null;

    downloadCSV(type) {
        const generators = {
            weekly:    () => this.generateWeekly(),
            monthly:   () => this.generateMonthly(),
            quarterly: () => this.generateQuarterly(),
            yearly:    () => this.generateYearly()
        };
        const report = this._lastReport?.type === type
            ? this._lastReport
            : (generators[type] ? generators[type]() : null);
        if (!report) { return; }

        const lines = [];
        const sep = ';';

        lines.push(`"${report.title}"${sep}"${report.period}"`);
        lines.push('');
        lines.push('"Kennzahl"' + sep + '"Wert"');
        (report.kpis || []).forEach(k => {
            lines.push(`"${k.label}"${sep}"${String(k.value).replace(/\u00a0/g, ' ')}"`);
        });

        if (report.rev) {
            lines.push('');
            lines.push('"Rechnungen"' + sep + '"Anzahl"' + sep + '"Brutto"');
            const rev = report.rev;
            lines.push(`"Gesamt"${sep}${rev.total}${sep}"${this._fmt(rev.brutto)}"`);
            lines.push(`"Bezahlt"${sep}${rev.paid.count}${sep}"${this._fmt(rev.paid.sum)}"`);
            lines.push(`"Offen"${sep}${rev.open.count}${sep}"${this._fmt(rev.open.sum)}"`);
        }

        if (report.topCustomers?.length) {
            lines.push('');
            lines.push('"Kunde"' + sep + '"Rechnungen"' + sep + '"Umsatz"');
            report.topCustomers.forEach(c => {
                lines.push(`"${c.name}"${sep}${c.count}${sep}"${this._fmt(c.sum)}"`);
            });
        }

        if (report.expenses?.length) {
            lines.push('');
            lines.push('"Ausgabe-Kategorie"' + sep + '"Betrag"');
            report.expenses.forEach(e => {
                lines.push(`"${e.kategorie}"${sep}"${this._fmt(e.sum)}"`);
            });
        }

        const bom  = '\uFEFF';
        const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

window.periodicReportService = new PeriodicReportService();
