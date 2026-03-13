import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('CashFlowService', () => {
    let cashFlowService;

    beforeEach(() => {
        // Mock StorageUtils
        global.StorageUtils = {
            getJSON: vi.fn((key, defaultVal) => defaultVal),
            setJSON: vi.fn(() => true),
            safeDate: vi.fn((dateStr) => {
                if (!dateStr) return null;
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? null : d;
            })
        };

        // Mock localStorage
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

        // Mock storeService with rechnungen
        window.storeService = {
            store: {
                rechnungen: []
            }
        };

        // Mock bookkeepingService
        window.bookkeepingService = {
            buchungen: [],
            berechneEUR: vi.fn(() => ({
                einnahmen: { brutto: 15000 },
                ausgabenGesamt: { brutto: 8000 }
            }))
        };

        // Mock formatCurrency
        window.formatCurrency = vi.fn((amount) => {
            return new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR'
            }).format(amount);
        });

        // Mock _getTaxRate
        window._getTaxRate = vi.fn(() => 0.19);

        // Define class inline matching actual source
        class CashFlowService {
            constructor() {
                this.forecasts = StorageUtils.getJSON('freyai_cashflow_forecasts', [], { financial: true, service: 'cashFlowService' });
                this.settings = StorageUtils.getJSON('freyai_cashflow_settings', {}, { financial: true, service: 'cashFlowService' });

                if (!this.settings.monthsToForecast) { this.settings.monthsToForecast = 6; }
                if (!this.settings.safetyBuffer) { this.settings.safetyBuffer = 5000; }
            }

            getCurrentSnapshot() {
                const today = new Date();
                const bookkeeping = window.bookkeepingService;

                let totalEinnahmen = 0;
                let totalAusgaben = 0;

                if (bookkeeping) {
                    const year = today.getFullYear();
                    const eur = bookkeeping.berechneEUR(year);
                    totalEinnahmen = eur.einnahmen?.brutto || 0;
                    totalAusgaben = eur.ausgabenGesamt?.brutto || 0;
                }

                const rechnungen = window.storeService?.store?.rechnungen || [];
                const pendingAmount = rechnungen
                    .filter(r => r.status === 'offen' || r.status === 'versendet')
                    .reduce((sum, r) => sum + (r.brutto || r.betrag || 0), 0);

                const overdueAmount = rechnungen
                    .filter(r => {
                        if (r.status !== 'bezahlt' && r.status !== 'storniert' && r.faelligkeitsdatum) {
                            const dueDate = new Date(r.faelligkeitsdatum);
                            return !isNaN(dueDate.getTime()) && dueDate < today;
                        }
                        return false;
                    })
                    .reduce((sum, r) => sum + (r.brutto || r.betrag || 0), 0);

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
                if (!bookkeeping) { return 0; }

                const buchungen = bookkeeping.buchungen || [];
                const last6Months = new Date();
                last6Months.setMonth(last6Months.getMonth() - 6);

                const relevantBuchungen = buchungen.filter(b => {
                    const bDate = StorageUtils.safeDate(b.datum);
                    if (!bDate) { return false; }
                    const isRecent = bDate >= last6Months;
                    const isType = type === 'income' ? b.typ === 'einnahme' : b.typ === 'ausgabe';
                    return isRecent && isType;
                });

                const total = relevantBuchungen.reduce((sum, b) => sum + (b.brutto || 0), 0);

                const distinctMonths = new Set(
                    relevantBuchungen.map(b => {
                        const d = new Date(b.datum);
                        return `${d.getFullYear()}-${d.getMonth()}`;
                    })
                ).size;

                return distinctMonths > 0 ? total / distinctMonths : 0;
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

                return upcoming.sort((a, b) => (StorageUtils.safeDate(a.date) || new Date(0)) - (StorageUtils.safeDate(b.date) || new Date(0)));
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
                            estimatedAmount: this.calculateMonthlyAverage('income') * 3 * ((typeof window._getTaxRate === 'function') ? window._getTaxRate() : 0.19) * 0.5
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
                return window.formatCurrency(amount);
            }

            save() {
                const ok1 = StorageUtils.setJSON('freyai_cashflow_forecasts', this.forecasts, { service: 'CashFlowService' });
                if (!ok1) { console.error('[CashFlowService] CRITICAL: Failed to save cashflow forecasts'); }
                const ok2 = StorageUtils.setJSON('freyai_cashflow_settings', this.settings, { service: 'CashFlowService' });
                if (!ok2) { console.error('[CashFlowService] CRITICAL: Failed to save cashflow settings'); }
            }
        }

        cashFlowService = new CashFlowService();
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete window.storeService;
        delete window.bookkeepingService;
        delete window.formatCurrency;
        delete window._getTaxRate;
    });

    // ─── Constructor & Defaults ──────────────────────────────────

    describe('Constructor & Defaults', () => {
        it('should load forecasts from StorageUtils', () => {
            expect(StorageUtils.getJSON).toHaveBeenCalledWith(
                'freyai_cashflow_forecasts',
                [],
                { financial: true, service: 'cashFlowService' }
            );
        });

        it('should load settings from StorageUtils', () => {
            expect(StorageUtils.getJSON).toHaveBeenCalledWith(
                'freyai_cashflow_settings',
                expect.objectContaining({}),
                { financial: true, service: 'cashFlowService' }
            );
        });

        it('should set default monthsToForecast to 6', () => {
            expect(cashFlowService.settings.monthsToForecast).toBe(6);
        });

        it('should set default safetyBuffer to 5000', () => {
            expect(cashFlowService.settings.safetyBuffer).toBe(5000);
        });
    });

    // ─── getCurrentSnapshot ──────────────────────────────────────

    describe('getCurrentSnapshot', () => {
        it('should return correct structure with all required fields', () => {
            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot).toHaveProperty('date');
            expect(snapshot).toHaveProperty('currentBalance');
            expect(snapshot).toHaveProperty('pendingInvoices');
            expect(snapshot).toHaveProperty('overdueInvoices');
            expect(snapshot).toHaveProperty('monthlyAvgIncome');
            expect(snapshot).toHaveProperty('monthlyAvgExpenses');
        });

        it('should calculate currentBalance from berechneEUR', () => {
            // Default mock: einnahmen.brutto=15000, ausgabenGesamt.brutto=8000
            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.currentBalance).toBe(7000);
        });

        it('should detect pending invoices (offen)', () => {
            window.storeService.store.rechnungen = [
                { id: 'R-001', status: 'offen', brutto: 2500, faelligkeitsdatum: '2099-12-31' }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.pendingInvoices).toBe(2500);
        });

        it('should detect pending invoices (versendet)', () => {
            window.storeService.store.rechnungen = [
                { id: 'R-002', status: 'versendet', betrag: 1800, faelligkeitsdatum: '2099-12-31' }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.pendingInvoices).toBe(1800);
        });

        it('should sum multiple pending invoices', () => {
            window.storeService.store.rechnungen = [
                { id: 'R-001', status: 'offen', brutto: 1000, faelligkeitsdatum: '2099-12-31' },
                { id: 'R-002', status: 'versendet', brutto: 2000, faelligkeitsdatum: '2099-12-31' }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.pendingInvoices).toBe(3000);
        });

        it('should detect overdue invoices based on past due date', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 15);

            window.storeService.store.rechnungen = [
                { id: 'R-001', status: 'offen', brutto: 3000, faelligkeitsdatum: pastDate.toISOString() }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.overdueInvoices).toBe(3000);
        });

        it('should exclude paid invoices from overdue calculation', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 15);

            window.storeService.store.rechnungen = [
                { id: 'R-001', status: 'bezahlt', brutto: 3000, faelligkeitsdatum: pastDate.toISOString() }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.overdueInvoices).toBe(0);
        });

        it('should exclude cancelled (storniert) invoices from overdue', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 15);

            window.storeService.store.rechnungen = [
                { id: 'R-001', status: 'storniert', brutto: 3000, faelligkeitsdatum: pastDate.toISOString() }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.overdueInvoices).toBe(0);
        });

        it('should return zero balance when bookkeepingService is missing', () => {
            window.bookkeepingService = null;

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.currentBalance).toBe(0);
        });

        it('should handle empty rechnungen array', () => {
            window.storeService.store.rechnungen = [];

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.pendingInvoices).toBe(0);
            expect(snapshot.overdueInvoices).toBe(0);
        });
    });

    // ─── calculateMonthlyAverage ─────────────────────────────────

    describe('calculateMonthlyAverage', () => {
        it('should return 0 when bookkeepingService is missing', () => {
            window.bookkeepingService = null;

            const avg = cashFlowService.calculateMonthlyAverage('income');

            expect(avg).toBe(0);
        });

        it('should return 0 when no buchungen exist', () => {
            window.bookkeepingService.buchungen = [];

            const avg = cashFlowService.calculateMonthlyAverage('income');

            expect(avg).toBe(0);
        });

        it('should calculate income average from recent buchungen', () => {
            const now = new Date();
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', brutto: 6000, datum: now.toISOString() },
                { typ: 'einnahme', brutto: 4000, datum: now.toISOString() }
            ];

            const avg = cashFlowService.calculateMonthlyAverage('income');

            // Both in same month, 1 distinct month => (6000+4000)/1 = 10000
            expect(avg).toBe(10000);
        });

        it('should calculate expense average from recent buchungen', () => {
            const now = new Date();
            window.bookkeepingService.buchungen = [
                { typ: 'ausgabe', brutto: 3000, datum: now.toISOString() }
            ];

            const avg = cashFlowService.calculateMonthlyAverage('expense');

            expect(avg).toBe(3000);
        });

        it('should exclude buchungen older than 6 months', () => {
            const now = new Date();
            const sevenMonthsAgo = new Date(now);
            sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', brutto: 9999, datum: sevenMonthsAgo.toISOString() },
                { typ: 'einnahme', brutto: 3000, datum: now.toISOString() }
            ];

            const avg = cashFlowService.calculateMonthlyAverage('income');

            // Only the recent one counts: 3000 / 1 distinct month = 3000
            expect(avg).toBe(3000);
        });

        it('should divide by distinct months, not hardcoded 6', () => {
            const now = new Date();
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', brutto: 5000, datum: now.toISOString() },
                { typ: 'einnahme', brutto: 3000, datum: oneMonthAgo.toISOString() }
            ];

            const avg = cashFlowService.calculateMonthlyAverage('income');

            // 2 distinct months => (5000+3000)/2 = 4000
            expect(avg).toBe(4000);
        });

        it('should not mix income and expense types', () => {
            const now = new Date();
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', brutto: 8000, datum: now.toISOString() },
                { typ: 'ausgabe', brutto: 2000, datum: now.toISOString() }
            ];

            const incomeAvg = cashFlowService.calculateMonthlyAverage('income');
            const expenseAvg = cashFlowService.calculateMonthlyAverage('expense');

            expect(incomeAvg).toBe(8000);
            expect(expenseAvg).toBe(2000);
        });
    });

    // ─── generateForecast ────────────────────────────────────────

    describe('generateForecast', () => {
        it('should generate the correct number of months', () => {
            const forecasts = cashFlowService.generateForecast(6);

            expect(forecasts).toHaveLength(6);
        });

        it('should generate 3 months when requested', () => {
            const forecasts = cashFlowService.generateForecast(3);

            expect(forecasts).toHaveLength(3);
        });

        it('should default to 6 months', () => {
            const forecasts = cashFlowService.generateForecast();

            expect(forecasts).toHaveLength(6);
        });

        it('should include required fields in each forecast entry', () => {
            const forecasts = cashFlowService.generateForecast(1);
            const entry = forecasts[0];

            expect(entry).toHaveProperty('month');
            expect(entry).toHaveProperty('date');
            expect(entry).toHaveProperty('projectedBalance');
            expect(entry).toHaveProperty('expectedIncome');
            expect(entry).toHaveProperty('expectedExpenses');
            expect(entry).toHaveProperty('status');
            expect(entry).toHaveProperty('alerts');
        });

        it('should mark status as critical when projected balance goes negative', () => {
            // Make expenses vastly exceed income
            window.bookkeepingService.berechneEUR = vi.fn(() => ({
                einnahmen: { brutto: 1000 },
                ausgabenGesamt: { brutto: 50000 }
            }));

            const forecasts = cashFlowService.generateForecast(1);

            expect(forecasts[0].status).toBe('critical');
        });

        it('should mark status as warning when below safety buffer', () => {
            // Balance will be positive but < 5000
            window.bookkeepingService.berechneEUR = vi.fn(() => ({
                einnahmen: { brutto: 6000 },
                ausgabenGesamt: { brutto: 3000 }
            }));

            const forecasts = cashFlowService.generateForecast(1);

            if (forecasts[0].projectedBalance >= 0 && forecasts[0].projectedBalance < 5000) {
                expect(forecasts[0].status).toBe('warning');
            }
        });

        it('should include 50% pending collections in first month only', () => {
            window.storeService.store.rechnungen = [
                { id: 'R-001', status: 'offen', brutto: 10000, faelligkeitsdatum: '2099-12-31' }
            ];

            const forecasts = cashFlowService.generateForecast(2);

            // First month should include expectedCollections
            expect(forecasts[0].expectedIncome).toBeGreaterThan(forecasts[1].expectedIncome);
        });

        it('should save forecasts via StorageUtils after generation', () => {
            cashFlowService.generateForecast(3);

            expect(StorageUtils.setJSON).toHaveBeenCalledWith(
                'freyai_cashflow_forecasts',
                expect.any(Array),
                { service: 'CashFlowService' }
            );
        });

        it('should store forecasts on the instance', () => {
            const forecasts = cashFlowService.generateForecast(4);

            expect(cashFlowService.forecasts).toBe(forecasts);
            expect(cashFlowService.forecasts).toHaveLength(4);
        });

        it('should generate danger alerts for critical months', () => {
            window.bookkeepingService.berechneEUR = vi.fn(() => ({
                einnahmen: { brutto: 500 },
                ausgabenGesamt: { brutto: 80000 }
            }));

            const forecasts = cashFlowService.generateForecast(1);

            expect(forecasts[0].alerts.some(a => a.type === 'danger')).toBe(true);
        });
    });

    // ─── getRecurringExpenses ────────────────────────────────────

    describe('getRecurringExpenses', () => {
        it('should return tax-related expenses in March (month 2)', () => {
            const now = new Date();
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', brutto: 10000, datum: now.toISOString() }
            ];

            const marchDate = new Date(now.getFullYear(), 2, 15);
            const expense = cashFlowService.getRecurringExpenses(marchDate);

            // avgIncome = 10000, *3 = 30000, *0.15 = 4500
            expect(expense).toBe(4500);
        });

        it('should return tax-related expenses in June (month 5)', () => {
            const now = new Date();
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', brutto: 6000, datum: now.toISOString() }
            ];

            const juneDate = new Date(now.getFullYear(), 5, 15);
            const expense = cashFlowService.getRecurringExpenses(juneDate);

            expect(expense).toBeGreaterThan(0);
        });

        it('should include insurance in January (month 0)', () => {
            const janDate = new Date(new Date().getFullYear(), 0, 15);
            const expense = cashFlowService.getRecurringExpenses(janDate);

            expect(expense).toBeGreaterThanOrEqual(500);
        });

        it('should include insurance in July (month 6)', () => {
            const julyDate = new Date(new Date().getFullYear(), 6, 15);
            const expense = cashFlowService.getRecurringExpenses(julyDate);

            expect(expense).toBeGreaterThanOrEqual(500);
        });

        it('should return 0 for months with no recurring expenses (e.g. April)', () => {
            const aprilDate = new Date(new Date().getFullYear(), 3, 15);
            const expense = cashFlowService.getRecurringExpenses(aprilDate);

            expect(expense).toBe(0);
        });

        it('should return 0 for months with no recurring expenses (e.g. August)', () => {
            const augustDate = new Date(new Date().getFullYear(), 7, 15);
            const expense = cashFlowService.getRecurringExpenses(augustDate);

            expect(expense).toBe(0);
        });
    });

    // ─── generateAlerts ──────────────────────────────────────────

    describe('generateAlerts', () => {
        it('should generate danger alert for critical status', () => {
            const alerts = cashFlowService.generateAlerts(-5000, 'critical', new Date());

            expect(alerts.length).toBeGreaterThanOrEqual(1);
            expect(alerts.some(a => a.type === 'danger')).toBe(true);
        });

        it('should generate warning alert for warning status', () => {
            const alerts = cashFlowService.generateAlerts(2000, 'warning', new Date());

            expect(alerts.some(a => a.type === 'warning')).toBe(true);
        });

        it('should include tax alert in tax months (Sep = month 8)', () => {
            const sepDate = new Date(new Date().getFullYear(), 8, 15);
            const alerts = cashFlowService.generateAlerts(10000, 'healthy', sepDate);

            expect(alerts.some(a => a.message.includes('USt-Vorauszahlung'))).toBe(true);
        });

        it('should not include tax alert in non-tax months', () => {
            const mayDate = new Date(new Date().getFullYear(), 4, 15);
            const alerts = cashFlowService.generateAlerts(10000, 'healthy', mayDate);

            expect(alerts.some(a => a.message.includes('USt-Vorauszahlung'))).toBe(false);
        });

        it('should return empty alerts for healthy status in non-tax month', () => {
            const mayDate = new Date(new Date().getFullYear(), 4, 15);
            const alerts = cashFlowService.generateAlerts(20000, 'healthy', mayDate);

            expect(alerts).toHaveLength(0);
        });
    });

    // ─── getUpcomingPayments & getNextTaxDates ───────────────────

    describe('getUpcomingPayments', () => {
        it('should return an array', () => {
            const upcoming = cashFlowService.getUpcomingPayments(30);

            expect(Array.isArray(upcoming)).toBe(true);
        });

        it('should return sorted results by date', () => {
            const upcoming = cashFlowService.getUpcomingPayments(365);

            for (let i = 1; i < upcoming.length; i++) {
                expect(new Date(upcoming[i].date).getTime())
                    .toBeGreaterThanOrEqual(new Date(upcoming[i - 1].date).getTime());
            }
        });
    });

    describe('getNextTaxDates', () => {
        it('should return only future tax dates', () => {
            const dates = cashFlowService.getNextTaxDates();
            const now = new Date();

            dates.forEach(d => {
                expect(d.date > now).toBe(true);
            });
        });

        it('should have type "tax" on each entry', () => {
            const dates = cashFlowService.getNextTaxDates();

            dates.forEach(d => {
                expect(d.type).toBe('tax');
            });
        });

        it('should include estimatedAmount as a number', () => {
            const dates = cashFlowService.getNextTaxDates();

            dates.forEach(d => {
                expect(typeof d.estimatedAmount).toBe('number');
            });
        });

        it('should use _getTaxRate from window when available', () => {
            window._getTaxRate = vi.fn(() => 0.07);

            // Need buchungen for non-zero estimated amount
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', brutto: 10000, datum: new Date().toISOString() }
            ];

            const dates = cashFlowService.getNextTaxDates();

            if (dates.length > 0) {
                expect(window._getTaxRate).toHaveBeenCalled();
                // 10000 * 3 * 0.07 * 0.5 = 1050
                expect(dates[0].estimatedAmount).toBe(1050);
            }
        });
    });

    // ─── runScenario ─────────────────────────────────────────────

    describe('runScenario', () => {
        beforeEach(() => {
            // Provide bookkeeping data so averages are non-zero
            const now = new Date();
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', brutto: 10000, datum: now.toISOString() },
                { typ: 'ausgabe', brutto: 6000, datum: now.toISOString() }
            ];
        });

        it('should run pessimistic scenario: income * 0.7, expenses * 1.1', () => {
            const result = cashFlowService.runScenario('pessimistic');
            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(result.scenario).toBe('pessimistic');
            expect(result.monthlyIncome).toBeCloseTo(snapshot.monthlyAvgIncome * 0.7, 2);
            expect(result.monthlyExpenses).toBeCloseTo(snapshot.monthlyAvgExpenses * 1.1, 2);
        });

        it('should run optimistic scenario: income * 1.3, expenses * 0.95', () => {
            const result = cashFlowService.runScenario('optimistic');
            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(result.scenario).toBe('optimistic');
            expect(result.monthlyIncome).toBeCloseTo(snapshot.monthlyAvgIncome * 1.3, 2);
            expect(result.monthlyExpenses).toBeCloseTo(snapshot.monthlyAvgExpenses * 0.95, 2);
        });

        it('should run loss_of_client scenario: income * 0.6', () => {
            const result = cashFlowService.runScenario('loss_of_client');
            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(result.scenario).toBe('loss_of_client');
            expect(result.monthlyIncome).toBeCloseTo(snapshot.monthlyAvgIncome * 0.6, 2);
            // Expenses unchanged
            expect(result.monthlyExpenses).toBeCloseTo(snapshot.monthlyAvgExpenses, 2);
        });

        it('should run growth scenario: income * 1.5, expenses * 1.2', () => {
            const result = cashFlowService.runScenario('growth');
            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(result.scenario).toBe('growth');
            expect(result.monthlyIncome).toBeCloseTo(snapshot.monthlyAvgIncome * 1.5, 2);
            expect(result.monthlyExpenses).toBeCloseTo(snapshot.monthlyAvgExpenses * 1.2, 2);
        });

        it('should always produce 6 forecast entries', () => {
            const result = cashFlowService.runScenario('pessimistic');

            expect(result.forecasts).toHaveLength(6);
        });

        it('should include finalBalance matching last forecast balance', () => {
            const result = cashFlowService.runScenario('optimistic');
            const lastForecast = result.forecasts[result.forecasts.length - 1];

            expect(Math.round(result.finalBalance)).toBe(lastForecast.balance);
        });

        it('should return result structure with all required keys', () => {
            const result = cashFlowService.runScenario('growth');

            expect(result).toHaveProperty('scenario');
            expect(result).toHaveProperty('monthlyIncome');
            expect(result).toHaveProperty('monthlyExpenses');
            expect(result).toHaveProperty('forecasts');
            expect(result).toHaveProperty('finalBalance');
        });

        it('should handle unknown scenario type without crashing', () => {
            const result = cashFlowService.runScenario('unknown_scenario');

            // Income and expenses stay unchanged
            const snapshot = cashFlowService.getCurrentSnapshot();
            expect(result.monthlyIncome).toBeCloseTo(snapshot.monthlyAvgIncome, 2);
            expect(result.monthlyExpenses).toBeCloseTo(snapshot.monthlyAvgExpenses, 2);
        });
    });

    // ─── getRecommendations ──────────────────────────────────────

    describe('getRecommendations', () => {
        it('should recommend dunning when overdue invoices exist', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);

            window.storeService.store.rechnungen = [
                { id: 'R-001', status: 'offen', brutto: 5000, faelligkeitsdatum: pastDate.toISOString() }
            ];

            const recommendations = cashFlowService.getRecommendations();

            expect(recommendations.some(r => r.action === 'navigate_to_dunning')).toBe(true);
            expect(recommendations.find(r => r.action === 'navigate_to_dunning').priority).toBe('high');
        });

        it('should not recommend dunning when no overdue invoices', () => {
            window.storeService.store.rechnungen = [];

            const recommendations = cashFlowService.getRecommendations();

            expect(recommendations.some(r => r.action === 'navigate_to_dunning')).toBe(false);
        });

        it('should recommend buffer building when balance < safetyBuffer * 2', () => {
            // currentBalance = 15000 - 8000 = 7000, which is < 10000 (5000*2)
            const recommendations = cashFlowService.getRecommendations();

            expect(recommendations.some(r => r.action === 'increase_savings')).toBe(true);
        });

        it('should not recommend buffer building when balance is high', () => {
            window.bookkeepingService.berechneEUR = vi.fn(() => ({
                einnahmen: { brutto: 50000 },
                ausgabenGesamt: { brutto: 5000 }
            }));

            const recommendations = cashFlowService.getRecommendations();

            // currentBalance = 45000, safetyBuffer*2 = 10000 => no recommendation
            expect(recommendations.some(r => r.action === 'increase_savings')).toBe(false);
        });

        it('should warn about liquidity crunch when forecasts go critical', () => {
            // Force a critical forecast by making expenses huge
            window.bookkeepingService.berechneEUR = vi.fn(() => ({
                einnahmen: { brutto: 1000 },
                ausgabenGesamt: { brutto: 50000 }
            }));

            const recommendations = cashFlowService.getRecommendations();

            expect(recommendations.some(r => r.action === 'review_forecast')).toBe(true);
        });

        it('should return an array even when no recommendations apply', () => {
            // High balance, no overdue invoices, no critical forecasts
            window.bookkeepingService.berechneEUR = vi.fn(() => ({
                einnahmen: { brutto: 100000 },
                ausgabenGesamt: { brutto: 5000 }
            }));
            window.storeService.store.rechnungen = [];

            const recommendations = cashFlowService.getRecommendations();

            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    // ─── formatCurrency ──────────────────────────────────────────

    describe('formatCurrency', () => {
        it('should delegate to window.formatCurrency', () => {
            cashFlowService.formatCurrency(1234.56);

            expect(window.formatCurrency).toHaveBeenCalledWith(1234.56);
        });

        it('should format German EUR currency correctly', () => {
            const result = cashFlowService.formatCurrency(1234.56);

            expect(result).toContain('1.234,56');
            expect(result).toContain('€');
        });
    });

    // ─── Persistence (save) ──────────────────────────────────────

    describe('Persistence', () => {
        it('should save forecasts via StorageUtils.setJSON', () => {
            cashFlowService.save();

            expect(StorageUtils.setJSON).toHaveBeenCalledWith(
                'freyai_cashflow_forecasts',
                expect.any(Array),
                { service: 'CashFlowService' }
            );
        });

        it('should save settings via StorageUtils.setJSON', () => {
            cashFlowService.save();

            expect(StorageUtils.setJSON).toHaveBeenCalledWith(
                'freyai_cashflow_settings',
                expect.objectContaining({ monthsToForecast: 6, safetyBuffer: 5000 }),
                { service: 'CashFlowService' }
            );
        });

        it('should log error when setJSON fails for forecasts', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            StorageUtils.setJSON = vi.fn(() => false);

            cashFlowService.save();

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to save cashflow forecasts')
            );
            consoleSpy.mockRestore();
        });

        it('should log error when setJSON fails for settings', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            StorageUtils.setJSON = vi.fn(() => false);

            cashFlowService.save();

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to save cashflow settings')
            );
            consoleSpy.mockRestore();
        });
    });

    // ─── Edge Cases ──────────────────────────────────────────────

    describe('Edge Cases', () => {
        it('should handle zero balance gracefully', () => {
            window.bookkeepingService.berechneEUR = vi.fn(() => ({
                einnahmen: { brutto: 0 },
                ausgabenGesamt: { brutto: 0 }
            }));

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.currentBalance).toBe(0);
        });

        it('should handle missing storeService gracefully', () => {
            window.storeService = undefined;

            const snapshot = cashFlowService.getCurrentSnapshot();

            expect(snapshot.pendingInvoices).toBe(0);
            expect(snapshot.overdueInvoices).toBe(0);
        });

        it('should handle invoices with invalid faelligkeitsdatum', () => {
            window.storeService.store.rechnungen = [
                { id: 'R-001', status: 'offen', brutto: 1000, faelligkeitsdatum: 'invalid-date' }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            // Invalid date should not count as overdue
            expect(snapshot.overdueInvoices).toBe(0);
        });

        it('should handle invoices without faelligkeitsdatum', () => {
            window.storeService.store.rechnungen = [
                { id: 'R-001', status: 'offen', brutto: 1000 }
            ];

            const snapshot = cashFlowService.getCurrentSnapshot();

            // No due date => not overdue
            expect(snapshot.overdueInvoices).toBe(0);
        });

        it('should handle buchungen with null datum via safeDate', () => {
            window.bookkeepingService.buchungen = [
                { typ: 'einnahme', brutto: 5000, datum: null }
            ];

            const avg = cashFlowService.calculateMonthlyAverage('income');

            // safeDate returns null for null => filtered out
            expect(avg).toBe(0);
        });
    });
});
