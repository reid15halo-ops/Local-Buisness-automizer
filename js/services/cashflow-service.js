/* ============================================
   Cash Flow Service - Forecasting & Predictions
   ============================================ */
// TODO: read from company settings
const DEFAULT_TAX_RATE = 0.19; // Standard German VAT rate

class CashFlowService {
    constructor() {
        this.forecasts = JSON.parse(localStorage.getItem('freyai_cashflow_forecasts') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_cashflow_settings') || '{}');

        // Default settings
        if (!this.settings.monthsToForecast) {this.settings.monthsToForecast = 6;}
        if (!this.settings.safetyBuffer) {this.settings.safetyBuffer = 5000;} // Minimum cash buffer
    }

    // Get current financial snapshot
    getCurrentSnapshot() {
        const today = new Date();
        const bookkeeping = window.bookkeepingService;

        // Calculate current balances
        let totalEinnahmen = 0;
        let totalAusgaben = 0;

        if (bookkeeping) {
            const year = today.getFullYear();
            const eur = bookkeeping.berechneEUR(year);
            totalEinnahmen = eur.bruttoEinnahmen || 0;
            totalAusgaben = eur.ausgaben?.reduce((sum, a) => sum + a.betrag, 0) || 0;
        }

        // Get pending invoices
        const rechnungen = store?.rechnungen || [];
        const pendingAmount = rechnungen
            .filter(r => r.status === 'offen' || r.status === 'versendet')
            .reduce((sum, r) => sum + (r.betrag || 0), 0);

        // Get overdue invoices
        const overdueAmount = rechnungen
            .filter(r => {
                if (r.status !== 'bezahlt') {
                    const dueDate = new Date(r.faelligkeitsdatum);
                    return dueDate < today;
                }
                return false;
            })
            .reduce((sum, r) => sum + (r.betrag || 0), 0);

        return {
            date: today.toISOString(),
            currentBalance: totalEinnahmen - totalAusgaben,
            pendingInvoices: pendingAmount,
            overdueInvoices: overdueAmount,
            monthlyAvgIncome: this.calculateMonthlyAverage('income'),
            monthlyAvgExpenses: this.calculateMonthlyAverage('expense')
        };
    }

    // Calculate monthly average from historical data
    calculateMonthlyAverage(type) {
        const bookkeeping = window.bookkeepingService;
        if (!bookkeeping) {return 0;}

        const buchungen = bookkeeping.buchungen || [];
        const last6Months = new Date();
        last6Months.setMonth(last6Months.getMonth() - 6);

        const relevantBuchungen = buchungen.filter(b => {
            const bDate = new Date(b.datum);
            const isRecent = bDate >= last6Months;
            const isType = type === 'income' ? b.typ === 'einnahme' : b.typ === 'ausgabe';
            return isRecent && isType;
        });

        const total = relevantBuchungen.reduce((sum, b) => sum + b.betrag, 0);
        return total / 6;
    }

    // Generate future cash flow forecast
    generateForecast(months = 6) {
        const snapshot = this.getCurrentSnapshot();
        const forecasts = [];

        let projectedBalance = snapshot.currentBalance;
        const monthlyIncome = snapshot.monthlyAvgIncome;
        const monthlyExpenses = snapshot.monthlyAvgExpenses;
        const monthlyNet = monthlyIncome - monthlyExpenses;

        const today = new Date();

        for (let i = 1; i <= months; i++) {
            const forecastDate = new Date(today);
            forecastDate.setMonth(forecastDate.getMonth() + i);

            // Add pending invoice payments (assume 50% collected each month)
            const expectedCollections = i === 1 ? snapshot.pendingInvoices * 0.5 : 0;

            projectedBalance += monthlyNet + expectedCollections;

            // Check for known recurring expenses
            const recurringExpenses = this.getRecurringExpenses(forecastDate);
            projectedBalance -= recurringExpenses;

            // Determine status
            let status = 'healthy';
            if (projectedBalance < 0) {
                status = 'critical';
            } else if (projectedBalance < this.settings.safetyBuffer) {
                status = 'warning';
            }

            forecasts.push({
                month: forecastDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
                date: forecastDate.toISOString(),
                projectedBalance: Math.round(projectedBalance * 100) / 100,
                expectedIncome: monthlyIncome + expectedCollections,
                expectedExpenses: monthlyExpenses + recurringExpenses,
                status: status,
                alerts: this.generateAlerts(projectedBalance, status, forecastDate)
            });
        }

        this.forecasts = forecasts;
        this.save();
        return forecasts;
    }

    // Get known recurring expenses for a given month
    getRecurringExpenses(date) {
        // Common German business recurring expenses by month
        const month = date.getMonth();

        let recurring = 0;

        // Quarterly tax payments (März, Juni, September, Dezember)
        if ([2, 5, 8, 11].includes(month)) {
            const avgIncome = this.calculateMonthlyAverage('income') * 3;
            recurring += avgIncome * 0.15; // ~15% estimated tax
        }

        // Insurance payments (often quarterly or annual)
        if (month === 0 || month === 6) {
            recurring += 500; // Example insurance
        }

        return recurring;
    }

    // Generate alerts for forecast
    generateAlerts(balance, status, date) {
        const alerts = [];

        if (status === 'critical') {
            alerts.push({
                type: 'danger',
                message: `⚠️ Negative Liquidität erwartet! Maßnahmen erforderlich.`
            });
        }

        if (status === 'warning') {
            alerts.push({
                type: 'warning',
                message: `📉 Liquidität unter Sicherheitspuffer (${this.formatCurrency(this.settings.safetyBuffer)})`
            });
        }

        // Check for tax payment months
        const month = date.getMonth();
        if ([2, 5, 8, 11].includes(month)) {
            alerts.push({
                type: 'info',
                message: `📋 USt-Vorauszahlung fällig`
            });
        }

        return alerts;
    }

    // Get upcoming payment obligations
    getUpcomingPayments(days = 30) {
        const upcoming = [];
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + days);

        // Check for recurring known obligations
        const taxDates = this.getNextTaxDates();
        taxDates.forEach(td => {
            if (td.date <= endDate) {
                upcoming.push(td);
            }
        });

        // Check for overdue invoices we owe
        // (Would integrate with supplier invoice tracking)

        return upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Get next tax payment dates
    getNextTaxDates() {
        const dates = [];
        const year = new Date().getFullYear();
        const taxMonths = [2, 5, 8, 11]; // März, Juni, Sep, Dez

        taxMonths.forEach(month => {
            const date = new Date(year, month, 10); // 10th of month
            if (date > new Date()) {
                dates.push({
                    date: date,
                    type: 'tax',
                    name: 'USt-Vorauszahlung',
                    estimatedAmount: this.calculateMonthlyAverage('income') * 3 * DEFAULT_TAX_RATE * 0.5
                });
            }
        });

        return dates;
    }

    // Scenario planning
    runScenario(scenarioType) {
        const snapshot = this.getCurrentSnapshot();
        let adjustedIncome = snapshot.monthlyAvgIncome;
        let adjustedExpenses = snapshot.monthlyAvgExpenses;

        switch (scenarioType) {
            case 'pessimistic':
                adjustedIncome *= 0.7; // 30% less income
                adjustedExpenses *= 1.1; // 10% more expenses
                break;
            case 'optimistic':
                adjustedIncome *= 1.3; // 30% more income
                adjustedExpenses *= 0.95; // 5% less expenses
                break;
            case 'loss_of_client':
                adjustedIncome *= 0.6; // Major client loss
                break;
            case 'growth':
                adjustedIncome *= 1.5;
                adjustedExpenses *= 1.2;
                break;
        }

        // Generate forecast with adjusted values
        const forecasts = [];
        let projectedBalance = snapshot.currentBalance;
        const monthlyNet = adjustedIncome - adjustedExpenses;
        const today = new Date();

        for (let i = 1; i <= 6; i++) {
            const forecastDate = new Date(today);
            forecastDate.setMonth(forecastDate.getMonth() + i);
            projectedBalance += monthlyNet;

            forecasts.push({
                month: forecastDate.toLocaleDateString('de-DE', { month: 'short' }),
                balance: Math.round(projectedBalance)
            });
        }

        return {
            scenario: scenarioType,
            monthlyIncome: adjustedIncome,
            monthlyExpenses: adjustedExpenses,
            forecasts: forecasts,
            finalBalance: projectedBalance
        };
    }

    // Generate recommendations
    getRecommendations() {
        const snapshot = this.getCurrentSnapshot();
        const forecasts = this.forecasts.length ? this.forecasts : this.generateForecast();
        const recommendations = [];

        // Check overdue invoices
        if (snapshot.overdueInvoices > 0) {
            recommendations.push({
                priority: 'high',
                icon: '⚠️',
                title: 'Überfällige Rechnungen einfordern',
                description: `${this.formatCurrency(snapshot.overdueInvoices)} ausstehend. Mahnverfahren starten.`,
                action: 'navigate_to_dunning'
            });
        }

        // Check upcoming negative forecasts
        const criticalMonth = forecasts.find(f => f.status === 'critical');
        if (criticalMonth) {
            recommendations.push({
                priority: 'high',
                icon: '🚨',
                title: 'Liquiditätsengpass erwartet',
                description: `In ${criticalMonth.month} wird negative Liquidität erwartet.`,
                action: 'review_forecast'
            });
        }

        // Suggest buffer building
        if (snapshot.currentBalance < this.settings.safetyBuffer * 2) {
            recommendations.push({
                priority: 'medium',
                icon: '💰',
                title: 'Sicherheitspuffer aufbauen',
                description: `Empfohlen: mindestens ${this.formatCurrency(this.settings.safetyBuffer * 2)} Rücklage.`,
                action: 'increase_savings'
            });
        }

        // Tax payment reminders
        const nextTax = this.getNextTaxDates()[0];
        if (nextTax) {
            const daysUntil = Math.ceil((nextTax.date - new Date()) / (1000 * 60 * 60 * 24));
            if (daysUntil < 30) {
                recommendations.push({
                    priority: 'medium',
                    icon: '📋',
                    title: 'Steuervorauszahlung planen',
                    description: `${nextTax.name} in ${daysUntil} Tagen (ca. ${this.formatCurrency(nextTax.estimatedAmount)})`,
                    action: 'prepare_tax'
                });
            }
        }

        return recommendations;
    }

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    // Persistence
    save() {
        localStorage.setItem('freyai_cashflow_forecasts', JSON.stringify(this.forecasts));
        localStorage.setItem('freyai_cashflow_settings', JSON.stringify(this.settings));
    }
}

window.cashFlowService = new CashFlowService();
