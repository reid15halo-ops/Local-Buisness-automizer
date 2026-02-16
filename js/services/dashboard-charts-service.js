/* ============================================
   Dashboard Charts Service
   Pure SVG KPI charts for the dashboard
   ============================================ */

class DashboardChartsService {
    constructor() {
        this.colors = {
            indigo: '#6366f1',
            green: '#22c55e',
            amber: '#f59e0b',
            red: '#ef4444',
            blue: '#3b82f6',
            slate: '#64748b',
            dark: '#1c1c21',
            darkBg: '#0f0f12',
            text: '#e4e4e7',
            textSecondary: '#a1a1aa'
        };

        this.monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    }

    /**
     * Render Revenue Chart (Umsatz) - Monthly revenue from paid invoices
     */
    renderRevenueChart(rechnungen, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Get last 6 months of paid invoices
        const last6Months = this._getLast6MonthsData(rechnungen);
        const maxValue = Math.max(...last6Months.map(d => d.amount), 1000);

        const width = 500;
        const height = 300;
        const padding = { top: 30, right: 20, bottom: 40, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        let svg = `<svg viewBox="0 0 ${width} ${height}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">`;

        // Background
        svg += `<rect width="${width}" height="${height}" fill="${this.colors.dark}"/>`;

        // Grid lines
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            const value = maxValue - (maxValue / 5) * i;
            svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${this.colors.darkBg}" stroke-width="1"/>`;
            svg += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="${this.colors.textSecondary}" font-size="11">${this._formatCurrency(value)}</text>`;
        }

        // Y-axis
        svg += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="${this.colors.textSecondary}" stroke-width="2"/>`;

        // X-axis
        svg += `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="${this.colors.textSecondary}" stroke-width="2"/>`;

        // Bars
        const barWidth = chartWidth / last6Months.length * 0.6;
        const barSpacing = chartWidth / last6Months.length;

        last6Months.forEach((month, i) => {
            const barHeight = (month.amount / maxValue) * chartHeight;
            const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
            const y = height - padding.bottom - barHeight;

            svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${this.colors.indigo}" rx="4"
                    style="cursor:pointer;transition:all 0.2s"
                    onmouseover="this.setAttribute('opacity', '0.8')"
                    onmouseout="this.setAttribute('opacity', '1')"
                    data-value="${month.amount}" data-month="${month.month}">
                    <title>${month.month}: ${this._formatCurrency(month.amount)}</title>
                    </rect>`;

            // Value label on bar
            if (month.amount > 0) {
                svg += `<text x="${x + barWidth/2}" y="${y - 8}" text-anchor="middle" fill="${this.colors.text}" font-size="12" font-weight="600">${this._formatCurrencyShort(month.amount)}</text>`;
            }

            // Month label
            svg += `<text x="${x + barWidth/2}" y="${height - padding.bottom + 20}" text-anchor="middle" fill="${this.colors.text}" font-size="12">${month.month}</text>`;
        });

        // Title
        svg += `<text x="${width/2}" y="22" text-anchor="middle" fill="${this.colors.text}" font-size="16" font-weight="700">Umsatz (Bezahlte Rechnungen)</text>`;

        svg += '</svg>';
        container.innerHTML = svg;
    }

    /**
     * Render Pipeline Funnel - Conversion rates Anfragen → Angebote → Aufträge → Rechnungen
     */
    renderPipelineFunnel(anfragen, angebote, auftraege, rechnungen, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const stages = [
            { label: 'Anfragen', count: anfragen.length, color: this.colors.blue },
            { label: 'Angebote', count: angebote.length, color: this.colors.indigo },
            { label: 'Aufträge', count: auftraege.length, color: this.colors.green },
            { label: 'Rechnungen', count: rechnungen.length, color: this.colors.amber }
        ];

        const maxCount = Math.max(...stages.map(s => s.count), 10);

        const width = 500;
        const height = 280;
        const padding = { top: 30, right: 20, bottom: 30, left: 100 };

        let svg = `<svg viewBox="0 0 ${width} ${height}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">`;

        // Background
        svg += `<rect width="${width}" height="${height}" fill="${this.colors.dark}"/>`;

        // Title
        svg += `<text x="${width/2}" y="22" text-anchor="middle" fill="${this.colors.text}" font-size="16" font-weight="700">Vertriebstrichter</text>`;

        const stageHeight = 40;
        const startY = padding.top + 20;

        stages.forEach((stage, i) => {
            const yPos = startY + i * (stageHeight + 15);
            const barWidth = (stage.count / maxCount) * (width - padding.left - padding.right);
            const x = padding.left;

            // Bar
            svg += `<rect x="${x}" y="${yPos}" width="${barWidth}" height="${stageHeight}" fill="${stage.color}" rx="6" opacity="0.9"
                    style="cursor:pointer"
                    onmouseover="this.setAttribute('opacity', '0.7')"
                    onmouseout="this.setAttribute('opacity', '0.9')">
                    <title>${stage.label}: ${stage.count}</title>
                    </rect>`;

            // Count on bar
            svg += `<text x="${x + barWidth/2}" y="${yPos + stageHeight/2 + 5}" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">${stage.count}</text>`;

            // Label
            svg += `<text x="${x - 10}" y="${yPos + stageHeight/2 + 5}" text-anchor="end" fill="${this.colors.text}" font-size="13" font-weight="600">${stage.label}</text>`;

            // Conversion rate (except last stage)
            if (i < stages.length - 1) {
                const conversionRate = stages[i + 1].count > 0 ? Math.round((stages[i + 1].count / stage.count) * 100) : 0;
                svg += `<text x="${width - padding.right - 10}" y="${yPos + stageHeight/2 + 5}" text-anchor="end" fill="${this.colors.slate}" font-size="11">${conversionRate}%</text>`;
            }
        });

        svg += '</svg>';
        container.innerHTML = svg;
    }

    /**
     * Render Overdue Invoice Tracker - Donut chart with payment status
     */
    renderOverdueTracker(rechnungen, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const now = new Date();
        const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        let onTime = 0;
        let upcoming = 0;
        let overdue = 0;
        let totalOverdueAmount = 0;

        rechnungen.forEach(r => {
            if (r.status === 'bezahlt') {
                onTime += r.brutto || 0;
            } else if (r.faelligkeitsdatum) {
                const dueDate = new Date(r.faelligkeitsdatum);
                if (dueDate < now) {
                    overdue += r.brutto || 0;
                    totalOverdueAmount += r.brutto || 0;
                } else if (dueDate <= inSevenDays) {
                    upcoming += r.brutto || 0;
                }
            }
        });

        const total = onTime + upcoming + overdue;
        const width = 400;
        const height = 300;
        const centerX = width / 2;
        const centerY = height / 2;
        const outerRadius = 70;
        const innerRadius = 45;

        let svg = `<svg viewBox="0 0 ${width} ${height}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">`;

        // Background
        svg += `<rect width="${width}" height="${height}" fill="${this.colors.dark}"/>`;

        // Title
        svg += `<text x="${centerX}" y="25" text-anchor="middle" fill="${this.colors.text}" font-size="16" font-weight="700">Überfällige Rechnungen</text>`;

        if (total === 0) {
            svg += `<text x="${centerX}" y="${centerY + 10}" text-anchor="middle" fill="${this.colors.textSecondary}" font-size="14">Keine Rechnungen</text>`;
        } else {
            const segments = [
                { value: onTime, color: this.colors.green, label: 'Bezahlt' },
                { value: upcoming, color: this.colors.amber, label: 'Fällig (7d)' },
                { value: overdue, color: this.colors.red, label: 'Überfällig' }
            ];

            let currentAngle = -Math.PI / 2;

            segments.forEach(segment => {
                const sliceAngle = (segment.value / total) * 2 * Math.PI;
                const startAngle = currentAngle;
                const endAngle = currentAngle + sliceAngle;

                // Draw arc
                const arcPath = this._createDonutSegment(centerX, centerY, outerRadius, innerRadius, startAngle, endAngle);
                svg += `<path d="${arcPath}" fill="${segment.color}" opacity="0.9" style="cursor:pointer" onmouseover="this.setAttribute('opacity', '0.7')" onmouseout="this.setAttribute('opacity', '0.9')">
                        <title>${segment.label}: ${this._formatCurrency(segment.value)}</title>
                        </path>`;

                // Label angle
                const labelAngle = startAngle + sliceAngle / 2;
                const labelRadius = (outerRadius + innerRadius) / 2;
                const labelX = centerX + labelRadius * Math.cos(labelAngle);
                const labelY = centerY + labelRadius * Math.sin(labelAngle);

                const percentage = Math.round((segment.value / total) * 100);
                if (percentage > 0) {
                    svg += `<text x="${labelX}" y="${labelY + 4}" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">${percentage}%</text>`;
                }

                currentAngle = endAngle;
            });
        }

        // Center text - overdue amount
        svg += `<text x="${centerX}" y="${centerY - 10}" text-anchor="middle" fill="${this.colors.text}" font-size="13">Überfällig</text>`;
        svg += `<text x="${centerX}" y="${centerY + 15}" text-anchor="middle" fill="${this.colors.red}" font-size="20" font-weight="700">${this._formatCurrency(totalOverdueAmount)}</text>`;

        // Legend
        const legendY = height - 50;
        const legendItems = [
            { label: 'Bezahlt', color: this.colors.green },
            { label: 'Fällig (7d)', color: this.colors.amber },
            { label: 'Überfällig', color: this.colors.red }
        ];

        let legendX = (width - legendItems.length * 120) / 2;
        legendItems.forEach(item => {
            svg += `<rect x="${legendX}" y="${legendY}" width="12" height="12" fill="${item.color}" rx="2"/>`;
            svg += `<text x="${legendX + 18}" y="${legendY + 10}" fill="${this.colors.textSecondary}" font-size="11">${item.label}</text>`;
            legendX += 120;
        });

        svg += '</svg>';
        container.innerHTML = svg;
    }

    /**
     * Render Monthly Comparison - Line chart: Income vs Expenses
     */
    renderMonthlyComparison(buchungen, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const last6Months = this._getLast6MonthsComparison(buchungen);

        const width = 550;
        const height = 300;
        const padding = { top: 30, right: 20, bottom: 40, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const maxValue = Math.max(
            ...last6Months.map(d => Math.max(d.income, d.expenses)),
            1000
        );

        let svg = `<svg viewBox="0 0 ${width} ${height}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">`;

        // Background
        svg += `<rect width="${width}" height="${height}" fill="${this.colors.dark}"/>`;

        // Grid lines
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            const value = maxValue - (maxValue / 5) * i;
            svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${this.colors.darkBg}" stroke-width="1"/>`;
            svg += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="${this.colors.textSecondary}" font-size="10">${this._formatCurrencyShort(value)}</text>`;
        }

        // Axes
        svg += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="${this.colors.textSecondary}" stroke-width="2"/>`;
        svg += `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="${this.colors.textSecondary}" stroke-width="2"/>`;

        // Calculate line points
        const xSpacing = chartWidth / (last6Months.length - 1 || 1);

        // Income line
        let incomePath = 'M';
        last6Months.forEach((month, i) => {
            const x = padding.left + i * xSpacing;
            const y = height - padding.bottom - (month.income / maxValue) * chartHeight;
            incomePath += ` ${x},${y}`;
        });
        svg += `<polyline points="${incomePath}" fill="none" stroke="${this.colors.green}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

        // Expense line
        let expensePath = 'M';
        last6Months.forEach((month, i) => {
            const x = padding.left + i * xSpacing;
            const y = height - padding.bottom - (month.expenses / maxValue) * chartHeight;
            expensePath += ` ${x},${y}`;
        });
        svg += `<polyline points="${expensePath}" fill="none" stroke="${this.colors.red}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

        // Data points and labels
        last6Months.forEach((month, i) => {
            const x = padding.left + i * xSpacing;

            // Income point
            const yIncome = height - padding.bottom - (month.income / maxValue) * chartHeight;
            svg += `<circle cx="${x}" cy="${yIncome}" r="4" fill="${this.colors.green}" opacity="0.8" style="cursor:pointer" onmouseover="this.setAttribute('opacity', '1')" onmouseout="this.setAttribute('opacity', '0.8')">
                    <title>Einnahmen ${month.month}: ${this._formatCurrency(month.income)}</title>
                    </circle>`;

            // Expense point
            const yExpense = height - padding.bottom - (month.expenses / maxValue) * chartHeight;
            svg += `<circle cx="${x}" cy="${yExpense}" r="4" fill="${this.colors.red}" opacity="0.8" style="cursor:pointer" onmouseover="this.setAttribute('opacity', '1')" onmouseout="this.setAttribute('opacity', '0.8')">
                    <title>Ausgaben ${month.month}: ${this._formatCurrency(month.expenses)}</title>
                    </circle>`;

            // Month label
            svg += `<text x="${x}" y="${height - padding.bottom + 20}" text-anchor="middle" fill="${this.colors.text}" font-size="12">${month.month}</text>`;
        });

        // Title
        svg += `<text x="${width/2}" y="22" text-anchor="middle" fill="${this.colors.text}" font-size="16" font-weight="700">Monatsvergleich: Einnahmen vs. Ausgaben</text>`;

        // Legend
        svg += `<rect x="${padding.left}" y="${height - 25}" width="12" height="12" fill="${this.colors.green}" rx="2"/>`;
        svg += `<text x="${padding.left + 18}" y="${height - 16}" fill="${this.colors.textSecondary}" font-size="11">Einnahmen</text>`;

        svg += `<rect x="${padding.left + 140}" y="${height - 25}" width="12" height="12" fill="${this.colors.red}" rx="2"/>`;
        svg += `<text x="${padding.left + 158}" y="${height - 16}" fill="${this.colors.textSecondary}" font-size="11">Ausgaben</text>`;

        svg += '</svg>';
        container.innerHTML = svg;
    }

    /**
     * Update KPI Summary Cards with computed metrics
     */
    updateSummaryCards(anfragen, angebote, auftraege, rechnungen, buchungen) {
        // Total revenue this month
        const thisMonth = this._getCurrentMonth();
        const monthlyRevenue = this._getMonthlyRevenue(rechnungen, thisMonth);
        this._updateElement('kpi-monthly-revenue', this._formatCurrency(monthlyRevenue));

        // Open invoices amount
        const openInvoices = rechnungen
            .filter(r => r.status !== 'bezahlt')
            .reduce((sum, r) => sum + (r.brutto || 0), 0);
        this._updateElement('kpi-open-invoices', this._formatCurrency(openInvoices));

        // Conversion rate
        const conversionRate = anfragen.length > 0
            ? Math.round((auftraege.length / anfragen.length) * 100)
            : 0;
        this._updateElement('kpi-conversion-rate', `${conversionRate}%`);

        // Average order value
        const avgOrderValue = auftraege.length > 0
            ? auftraege.reduce((sum, a) => sum + (a.angebotsWert || 0), 0) / auftraege.length
            : 0;
        this._updateElement('kpi-avg-order-value', this._formatCurrency(avgOrderValue));
    }

    /**
     * Initialize all dashboard charts
     */
    initDashboardCharts() {
        if (!window.storeService || !window.storeService.state) {
            console.warn('StoreService not available');
            return;
        }

        const state = window.storeService.state;

        // Create chart containers if they don't exist
        this._ensureChartContainers();

        // Render charts
        this.renderRevenueChart(state.rechnungen, 'chart-revenue');
        this.renderPipelineFunnel(state.anfragen, state.angebote, state.auftraege, state.rechnungen, 'chart-funnel');
        this.renderOverdueTracker(state.rechnungen, 'chart-overdue');

        // Buchungen might not exist yet, use empty array as fallback
        const buchungen = state.buchungen || [];
        this.renderMonthlyComparison(buchungen, 'chart-comparison');

        // Update summary cards
        this.updateSummaryCards(state.anfragen, state.angebote, state.auftraege, state.rechnungen, buchungen);
    }

    /**
     * Refresh charts when data changes
     */
    refreshCharts() {
        this.initDashboardCharts();
    }

    // ============================================
    // Helper Methods
    // ============================================

    _ensureChartContainers() {
        const dashboard = document.getElementById('view-dashboard');
        if (!dashboard) return;

        // Check if charts section exists
        let chartsSection = dashboard.querySelector('.dashboard-charts');
        if (!chartsSection) {
            // Find the workflow visual and insert charts before it
            const workflowVisual = dashboard.querySelector('.workflow-visual');
            const chartsHtml = `
                <div class="dashboard-charts">
                    <div class="charts-row">
                        <div class="chart-card">
                            <div id="chart-revenue" class="chart-container"></div>
                        </div>
                        <div class="chart-card">
                            <div id="chart-overdue" class="chart-container"></div>
                        </div>
                    </div>
                    <div class="charts-row">
                        <div class="chart-card">
                            <div id="chart-funnel" class="chart-container"></div>
                        </div>
                        <div class="chart-card">
                            <div id="chart-comparison" class="chart-container"></div>
                        </div>
                    </div>
                </div>
            `;

            if (workflowVisual) {
                workflowVisual.insertAdjacentHTML('beforebegin', chartsHtml);
            } else {
                dashboard.insertAdjacentHTML('beforeend', chartsHtml);
            }
        }

        // Ensure KPI cards exist
        const statsSection = dashboard.querySelector('.dashboard-stats');
        if (statsSection && !statsSection.querySelector('.kpi-card')) {
            // Add KPI cards if not present
            const kpiHtml = `
                <div class="kpi-cards">
                    <div class="kpi-card">
                        <div class="kpi-label">Umsatz diesen Monat</div>
                        <div class="kpi-value" id="kpi-monthly-revenue">0 €</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Offene Rechnungen</div>
                        <div class="kpi-value" id="kpi-open-invoices">0 €</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Konversionsrate</div>
                        <div class="kpi-value" id="kpi-conversion-rate">0%</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Ø Auftragswert</div>
                        <div class="kpi-value" id="kpi-avg-order-value">0 €</div>
                    </div>
                </div>
            `;
            statsSection.insertAdjacentHTML('afterend', kpiHtml);
        }
    }

    _getLast6MonthsData(rechnungen) {
        const now = new Date();
        const last6Months = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const month = date.getMonth();
            const year = date.getFullYear();

            const monthRevenue = rechnungen
                .filter(r => r.status === 'bezahlt' && r.paidAt)
                .filter(r => {
                    const paidDate = new Date(r.paidAt);
                    return paidDate.getMonth() === month && paidDate.getFullYear() === year;
                })
                .reduce((sum, r) => sum + (r.brutto || 0), 0);

            last6Months.push({
                month: this.monthNames[month],
                amount: monthRevenue,
                date: new Date(year, month, 1)
            });
        }

        return last6Months;
    }

    _getLast6MonthsComparison(buchungen) {
        const now = new Date();
        const last6Months = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const month = date.getMonth();
            const year = date.getFullYear();

            const monthBuchungen = buchungen.filter(b => {
                const bDate = new Date(b.datum);
                return bDate.getMonth() === month && bDate.getFullYear() === year;
            });

            const income = monthBuchungen
                .filter(b => b.typ === 'einnahme')
                .reduce((sum, b) => sum + (b.brutto || 0), 0);

            const expenses = monthBuchungen
                .filter(b => b.typ === 'ausgabe')
                .reduce((sum, b) => sum + (b.brutto || 0), 0);

            last6Months.push({
                month: this.monthNames[month],
                income,
                expenses,
                date: new Date(year, month, 1)
            });
        }

        return last6Months;
    }

    _getCurrentMonth() {
        const now = new Date();
        return { month: now.getMonth(), year: now.getFullYear() };
    }

    _getMonthlyRevenue(rechnungen, monthData) {
        return rechnungen
            .filter(r => r.status === 'bezahlt' && r.paidAt)
            .filter(r => {
                const paidDate = new Date(r.paidAt);
                return paidDate.getMonth() === monthData.month &&
                       paidDate.getFullYear() === monthData.year;
            })
            .reduce((sum, r) => sum + (r.brutto || 0), 0);
    }

    _createDonutSegment(cx, cy, outerR, innerR, startAngle, endAngle) {
        const x1 = cx + outerR * Math.cos(startAngle);
        const y1 = cy + outerR * Math.sin(startAngle);
        const x2 = cx + outerR * Math.cos(endAngle);
        const y2 = cy + outerR * Math.sin(endAngle);

        const x3 = cx + innerR * Math.cos(endAngle);
        const y3 = cy + innerR * Math.sin(endAngle);
        const x4 = cx + innerR * Math.cos(startAngle);
        const y4 = cy + innerR * Math.sin(startAngle);

        const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

        return `M ${x1} ${y1}
                A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}
                L ${x3} ${y3}
                A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}
                Z`;
    }

    _formatCurrency(value) {
        if (typeof value !== 'number') return '0 €';
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }

    _formatCurrencyShort(value) {
        if (typeof value !== 'number') return '0€';
        if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'k€';
        }
        return Math.round(value) + '€';
    }

    _updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }
}

// Initialize and export
window.dashboardChartsService = new DashboardChartsService();
