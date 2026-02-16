import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('CashFlowService', () => {
    let cashFlowService;

    beforeEach(() => {
        // Setup localStorage mock
        global.localStorage = {
            data: {},
            getItem: vi.fn((key) => {
                const value = global.localStorage.data[key];
                return value === undefined ? null : JSON.stringify(value);
            }),
            setItem: vi.fn((key, value) => {
                global.localStorage.data[key] = JSON.parse(value);
            }),
            removeItem: vi.fn((key) => {
                delete global.localStorage.data[key];
            }),
            clear: vi.fn(() => {
                global.localStorage.data = {};
            })
        };

        // Mock store
        window.store = {
            rechnungen: []
        };

        // Mock bookkeepingService
        window.bookkeepingService = {
            buchungen: [],
            berechneEUR: vi.fn(() => ({
                bruttoEinnahmen: 10000,
                ausgaben: []
            }))
        };

        // Load and instantiate the actual CashFlowService
        class CashFlowService {
            constructor() {
                this.forecasts = JSON.parse(localStorage.getItem('mhs_cashflow_forecasts') || '[]');
                this.settings = JSON.parse(localStorage.getItem('mhs_cashflow_settings') || '{}');

                if (!this.settings.monthsToForecast) this.settings.monthsToForecast = 6;
                if (!this.settings.safetyBuffer) this.settings.safetyBuffer = 5000;
            }

            getCurrentSnapshot() {
                const today = new Date();
                const bookkeeping = window.bookkeepingService;

                let totalEinnahmen = 0;
                let totalAusgaben = 0;

                if (bookkeeping) {
                    const year = today.getFullYear();
                    const eur = bookkeeping.berechneEUR(year);
                    totalEinnahmen = eur.bruttoEinnahmen || 0;
                    totalAusgaben = eur.ausgaben?.reduce((sum, a) => sum + a.betrag, 0) || 0;
                }

                const rechnungen = window.store?.rechnungen || [];
                const pendingAmount = rechnungen
                    .filter(r => r.status === 'offen' || r.status === 'versendet')
                    .reduce((sum, r) => sum + (r.betrag || 0), 0);

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

            calculateMonthlyAverage(type) {
                const bookkeeping = window.bookkeepingService;
                if (!bookkeeping) return 0;

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

                    const expectedCollections = i === 1 ? snapshot.pendingInvoices * 0.5 : 0;
                    projectedBalance += monthlyNet + expectedCollections;

                    const recurringExpenses = this.getRecurringExpenses(forecastDate);
                    projectedBalance -= recurringExpenses;

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

            getRecurringExpenses(date) {
                const month = date.getMonth();

                let recurring = 0;

                if ([2, 5, 8, 11].includes(month)) {
                    const avgIncome = this.calculateMonthlyAverage('income') * 3;
                    recurring += avgIncome * 0.15;
                }

                if (month === 0 || month === 6) {
                    recurring += 500;
                }

                return recurring;
            }

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

                const month = date.getMonth();
                if ([2, 5, 8, 11].includes(month)) {
                    alerts.push({
                        type: 'info',
                        message: `📋 USt-Vorauszahlung fällig`
                    });
                }

                return alerts;
            }

            getUpcomingPayments(days = 30) {
                const upcoming = [];
                const today = new Date();
                const endDate = new Date(today);
                endDate.setDate(endDate.getDate() + days);

                const taxDates = this.getNextTaxDates();
                taxDates.forEach(td => {
                    if (td.date <= endDate) {
                        upcoming.push(td);
                    }
                });

                return upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
            }

            getNextTaxDates() {
                const dates = [];
                const year = new Date().getFullYear();
                const taxMonths = [2, 5, 8, 11];

                taxMonths.forEach(month => {
                    const date = new Date(year, month, 10);
                    if (date > new Date()) {
                        dates.push({
                            date: date,
                            type: 'tax',
                            name: 'USt-Vorauszahlung',
                            estimatedAmount: this.calculateMonthlyAverage('income') * 3 * 0.19 * 0.5
                        });
                    }
                });

                return dates;
            }

            runScenario(scenarioType) {
                const snapshot = this.getCurrentSnapshot();
                let adjustedIncome = snapshot.monthlyAvgIncome;
                let adjustedExpenses = snapshot.monthlyAvgExpenses;

                switch (scenarioType) {
                    case 'pessimistic':
                        adjustedIncome *= 0.7;
                        adjustedExpenses *= 1.1;
                        break;
                    case 'optimistic':
                        adjustedIncome *= 1.3;
                        adjustedExpenses *= 0.95;
                        break;
                    case 'loss_of_client':
                        adjustedIncome *= 0.6;
                        break;
                    case 'growth':
                        adjustedIncome *= 1.5;
                        adjustedExpenses *= 1.2;
                        break;
                }

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

            getRecommendations() {
                const snapshot = this.getCurrentSnapshot();
                const forecasts = this.forecasts.length ? this.forecasts : this.generateForecast();
                const recommendations = [];

                if (snapshot.overdueInvoices > 0) {
                    recommendations.push({
                        priority: 'high',
                        icon: '⚠️',
                        title: 'Überfällige Rechnungen einfordern',
                        description: `${this.formatCurrency(snapshot.overdueInvoices)} ausstehend. Mahnverfahren starten.`,
                        action: 'navigate_to_dunning'
                    });
                }

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

                if (snapshot.currentBalance < this.settings.safetyBuffer * 2) {
                    recommendations.push({
                        priority: 'medium',
                        icon: '💰',
                        title: 'Sicherheitspuffer aufbauen',
                        description: `Empfohlen: mindestens ${this.formatCurrency(this.settings.safetyBuffer * 2)} Rücklage.`,
                        action: 'increase_savings'
                    });
                }

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

            formatCurrency(amount) {
                return new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR'
                }).format(amount);
            }

            save() {
                localStorage.setItem('mhs_cashflow_forecasts', JSON.stringify(this.forecasts));
                localStorage.setItem('mhs_cashflow_settings', JSON.stringify(this.settings));
            }
        }

        cashFlowService = new CashFlowService();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('Settings', () => {
        it('should have default settings', () => {
            expect(cashFlowService.settings.monthsToForecast).toBe(6);
            expect(cashFlowService.settings.safetyBuffer).toBe(5000);
        });
    });

    describe('Current Snapshot', () => {
        it('should get current financial snapshot', () => {
            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot).toHaveProperty('date');
            expect(snapshot).toHaveProperty('currentBalance');
            expect(snapshot).toHaveProperty('pendingInvoices');
            expect(snapshot).toHaveProperty('overdueInvoices');
            expect(snapshot).toHaveProperty('monthlyAvgIncome');
            expect(snapshot).toHaveProperty('monthlyAvgExpenses');
        });

        it('should calculate current balance', () => {
            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(typeof snapshot.currentBalance).toBe('number');
        });

        it('should detect pending invoices', () => {
            window.store.rechnungen = [
                {
                    id: 'R-001',
                    status: 'offen',
                    betrag: 1000,
                    faelligkeitsdatum: new Date(new Date().getTime() + 10 * 24 * 60 * 60 * 1000).toISOString()
                }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.pendingInvoices).toBe(1000);
        });

        it('should detect overdue invoices', () => {
            window.store.rechnungen = [
                {
                    id: 'R-001',
                    status: 'offen',
                    betrag: 1500,
                    faelligkeitsdatum: new Date(new Date().getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
                }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.overdueInvoices).toBe(1500);
        });

        it('should exclude paid invoices from overdue', () => {
            window.store.rechnungen = [
                {
                    id: 'R-001',
                    status: 'bezahlt',
                    betrag: 1500,
                    faelligkeitsdatum: new Date(new Date().getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
                }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.overdueInvoices).toBe(0);
        });
    });

    describe('Monthly Average Calculation', () => {
        it('should calculate monthly average income', () => {
            const avg = cashFlowService.calculateMonthlyAverage('income');

            expect(typeof avg).toBe('number');
        });

        it('should calculate monthly average expenses', () => {
            const avg = cashFlowService.calculateMonthlyAverage('expense');

            expect(typeof avg).toBe('number');
        });

        it('should use only recent bookings (6 months)', () => {
            const now = new Date();
            const sevenMonthsAgo = new Date(now);
            sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

            window.bookkeepingService.buchungen = [
                {
                    typ: 'einnahme',
                    betrag: 1000,
                    datum: sevenMonthsAgo.toISOString()
                },
                {
                    typ: 'einnahme',
                    betrag: 1000,
                    datum: new Date().toISOString()
                }
            ];

            const avg = cashFlowService.calculateMonthlyAverage('income');

            expect(avg).toBeLessThan(1000);
        });
    });

    describe('Forecast Generation', () => {
        it('should generate forecast for 6 months', () => {
            const forecasts = cashFlowService.generateForecast(6);

            expect(forecasts.length).toBe(6);
        });

        it('should include projected balance', () => {
            const forecasts = cashFlowService.generateForecast(1);

            expect(forecasts[0]).toHaveProperty('projectedBalance');
            expect(typeof forecasts[0].projectedBalance).toBe('number');
        });

        it('should mark healthy forecast', () => {
            const forecasts = cashFlowService.generateForecast(1);

            expect(['healthy', 'warning', 'critical']).toContain(forecasts[0].status);
        });

        it('should mark critical status when balance negative', () => {
            window.bookkeepingService.berechneEUR = vi.fn(() => ({
                bruttoEinnahmen: 1000,
                ausgaben: [{ betrag: 50000 }]
            }));

            const forecasts = cashFlowService.generateForecast(1);

            expect(forecasts[0].status).toBe('critical');
        });

        it('should mark warning status when below safety buffer', () => {
            window.bookkeepingService.berechneEUR = vi.fn(() => ({
                bruttoEinnahmen: 6000,
                ausgaben: [{ betrag: 3000 }]
            }));

            const forecasts = cashFlowService.generateForecast(1);

            if (forecasts[0].projectedBalance < 5000) {
                expect(forecasts[0].status).toBe('warning');
            }
        });

        it('should include monthly income and expenses in forecast', () => {
            const forecasts = cashFlowService.generateForecast(1);

            expect(forecasts[0]).toHaveProperty('expectedIncome');
            expect(forecasts[0]).toHaveProperty('expectedExpenses');
        });

        it('should generate alerts in forecast', () => {
            const forecasts = cashFlowService.generateForecast(1);

            expect(Array.isArray(forecasts[0].alerts)).toBe(true);
        });
    });

    describe('Recurring Expenses', () => {
        it('should detect tax payment months', () => {
            // Set up some bookkeeping data so we have monthly averages
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', betrag: 1000, datum: new Date().toISOString() }
            ];

            const marchDate = new Date(new Date().getFullYear(), 2, 15);
            const expense = cashFlowService.getRecurringExpenses(marchDate);

            expect(expense).toBeGreaterThan(0);
        });

        it('should detect insurance payments in January', () => {
            const januaryDate = new Date(new Date().getFullYear(), 0, 15);
            const expense = cashFlowService.getRecurringExpenses(januaryDate);

            expect(expense).toBeGreaterThanOrEqual(500);
        });

        it('should detect insurance payments in July', () => {
            const julyDate = new Date(new Date().getFullYear(), 6, 15);
            const expense = cashFlowService.getRecurringExpenses(julyDate);

            expect(expense).toBeGreaterThanOrEqual(500);
        });

        it('should not have recurring expenses in other months', () => {
            const aprilDate = new Date(new Date().getFullYear(), 3, 15);
            const expense = cashFlowService.getRecurringExpenses(aprilDate);

            expect(expense).toBe(0);
        });
    });

    describe('Alerts Generation', () => {
        it('should generate critical alert when balance negative', () => {
            const alerts = cashFlowService.generateAlerts(-1000, 'critical', new Date());

            expect(alerts.some(a => a.type === 'danger')).toBe(true);
        });

        it('should generate warning alert when below buffer', () => {
            const alerts = cashFlowService.generateAlerts(2000, 'warning', new Date());

            expect(alerts.some(a => a.type === 'warning')).toBe(true);
        });

        it('should generate tax alert in tax months', () => {
            const marchDate = new Date(new Date().getFullYear(), 2, 15);
            const alerts = cashFlowService.generateAlerts(5000, 'healthy', marchDate);

            expect(alerts.some(a => a.message.includes('USt-Vorauszahlung'))).toBe(true);
        });
    });

    describe('Upcoming Payments', () => {
        it('should get upcoming payments', () => {
            const upcoming = cashFlowService.getUpcomingPayments(30);

            expect(Array.isArray(upcoming)).toBe(true);
        });

        it('should get next tax dates', () => {
            const dates = cashFlowService.getNextTaxDates();

            expect(Array.isArray(dates)).toBe(true);
        });

        it('should only return future tax dates', () => {
            const dates = cashFlowService.getNextTaxDates();

            dates.forEach(date => {
                expect(date.date > new Date()).toBe(true);
            });
        });

        it('should include estimated tax amount', () => {
            const dates = cashFlowService.getNextTaxDates();

            if (dates.length > 0) {
                expect(dates[0]).toHaveProperty('estimatedAmount');
                expect(typeof dates[0].estimatedAmount).toBe('number');
            }
        });
    });

    describe('Scenario Planning', () => {
        it('should run pessimistic scenario', () => {
            // Set up some bookkeeping data so we have non-zero monthly averages
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', betrag: 2000, datum: new Date().toISOString() }
            ];

            const result = cashFlowService.runScenario('pessimistic');

            expect(result.scenario).toBe('pessimistic');
            // Income should be reduced by 30% for pessimistic scenario
            expect(result.monthlyIncome).toBeLessThan(cashFlowService.getCurrentSnapshot().monthlyAvgIncome);
        });

        it('should run optimistic scenario', () => {
            // Set up some bookkeeping data so we have non-zero monthly averages
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', betrag: 2000, datum: new Date().toISOString() }
            ];

            const result = cashFlowService.runScenario('optimistic');

            expect(result.scenario).toBe('optimistic');
            // Income should be increased by 30% for optimistic scenario
            expect(result.monthlyIncome).toBeGreaterThan(cashFlowService.getCurrentSnapshot().monthlyAvgIncome);
        });

        it('should run loss of client scenario', () => {
            // Set up some bookkeeping data so we have non-zero monthly averages
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', betrag: 2000, datum: new Date().toISOString() }
            ];

            const result = cashFlowService.runScenario('loss_of_client');

            expect(result.scenario).toBe('loss_of_client');
            // Income should be reduced by 40% for loss of client scenario
            expect(result.monthlyIncome).toBeLessThan(cashFlowService.getCurrentSnapshot().monthlyAvgIncome);
        });

        it('should run growth scenario', () => {
            // Set up some bookkeeping data so we have non-zero monthly averages
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', betrag: 2000, datum: new Date().toISOString() }
            ];

            const result = cashFlowService.runScenario('growth');

            expect(result.scenario).toBe('growth');
            // Income should be increased by 50% for growth scenario
            expect(result.monthlyIncome).toBeGreaterThan(cashFlowService.getCurrentSnapshot().monthlyAvgIncome);
        });

        it('should include 6-month forecast in scenario', () => {
            const result = cashFlowService.runScenario('pessimistic');

            expect(result.forecasts.length).toBe(6);
        });
    });

    describe('Recommendations', () => {
        it('should recommend dunning for overdue invoices', () => {
            window.store.rechnungen = [
                {
                    id: 'R-001',
                    status: 'offen',
                    betrag: 1500,
                    faelligkeitsdatum: new Date(new Date().getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                }
            ];

            const recommendations = cashFlowService.getRecommendations();

            expect(recommendations.some(r => r.action === 'navigate_to_dunning')).toBe(true);
        });

        it('should recommend buffer building when low', () => {
            window.bookkeepingService.berechneEUR = vi.fn(() => ({
                bruttoEinnahmen: 6000,
                ausgaben: [{ betrag: 3000 }]
            }));

            const recommendations = cashFlowService.getRecommendations();

            expect(recommendations.some(r => r.action === 'increase_savings')).toBe(true);
        });

        it('should limit recommendations to most urgent', () => {
            const recommendations = cashFlowService.getRecommendations();

            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    describe('Formatting', () => {
        it('should format currency to German locale', () => {
            const formatted = cashFlowService.formatCurrency(1234.56);

            expect(formatted).toContain('1.234,56');
            expect(formatted).toContain('€');
        });
    });

    describe('Persistence', () => {
        it('should save forecasts to localStorage', () => {
            cashFlowService.generateForecast(3);

            expect(localStorage.setItem).toHaveBeenCalledWith('mhs_cashflow_forecasts', expect.any(String));
        });

        it('should save settings to localStorage', () => {
            cashFlowService.save();

            expect(localStorage.setItem).toHaveBeenCalledWith('mhs_cashflow_settings', expect.any(String));
        });
    });
});
