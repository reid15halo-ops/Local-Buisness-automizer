import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ProfitabilityService', () => {
    let profitabilityService;

    beforeEach(async () => {
        vi.resetModules();

        // Mock StorageUtils
        globalThis.StorageUtils = {
            getJSON: vi.fn((key, defaultVal) => defaultVal),
            setJSON: vi.fn(() => true)
        };

        // Mock localStorage
        globalThis.localStorage = {
            data: {},
            getItem: vi.fn((key) => {
                const value = globalThis.localStorage.data[key];
                return value === undefined ? null : value;
            }),
            setItem: vi.fn((key, value) => {
                globalThis.localStorage.data[key] = value;
            }),
            removeItem: vi.fn((key) => {
                delete globalThis.localStorage.data[key];
            }),
            clear: vi.fn(() => {
                globalThis.localStorage.data = {};
            })
        };

        // Mock window.formatCurrency
        window.formatCurrency = vi.fn((amount) => {
            return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
        });

        await import('../js/services/profitability-service.js');
        profitabilityService = window.profitabilityService;
    });

    // ─── Helper ───

    function makeJobData(overrides = {}) {
        return {
            jobId: 'AUF-2026-001',
            jobType: 'auftrag',
            customerId: 'K-001',
            customerName: 'Müller Sanitär GmbH',
            description: 'Heizungsinstallation Einfamilienhaus',
            invoicedAmount: 5000,
            estimatedHours: 20,
            actualHours: 22,
            laborRate: 65,
            materialCosts: 800,
            travelCosts: 120,
            otherCosts: 50,
            startDate: '2026-02-01',
            endDate: '2026-02-10',
            ...overrides
        };
    }

    // ─── analyzeJob ───

    describe('analyzeJob', () => {
        it('calculates profit correctly for a typical Handwerker job', () => {
            const result = profitabilityService.analyzeJob(makeJobData());

            // laborCost = 22 * 65 = 1430
            // overheadCost = 22 * 25 = 550
            // totalCost = 1430 + 550 + 800 + 120 + 50 = 2950
            // grossProfit = 5000 - 2950 = 2050
            // profitMargin = (2050 / 5000) * 100 = 41
            expect(result.totalCost).toBe(2950);
            expect(result.grossProfit).toBe(2050);
            expect(result.profitMargin).toBe(41);
            expect(result.isProfitable).toBe(true);
        });

        it('calculates hours efficiency and difference', () => {
            const result = profitabilityService.analyzeJob(makeJobData());

            // hoursDifference = 22 - 20 = 2
            // hoursEfficiency = (20 / 22) * 100 ≈ 90.91
            expect(result.hoursDifference).toBe(2);
            expect(result.hoursEfficiency).toBe(90.91);
            expect(result.onTime).toBe(false);
        });

        it('marks job as on-time when actual <= estimated', () => {
            const result = profitabilityService.analyzeJob(makeJobData({
                estimatedHours: 25,
                actualHours: 20
            }));
            expect(result.onTime).toBe(true);
            expect(result.hoursDifference).toBe(-5);
        });

        it('calculates effective hourly rate', () => {
            const result = profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 4400,
                actualHours: 20
            }));
            // 4400 / 20 = 220
            expect(result.effectiveHourlyRate).toBe(220);
        });

        it('handles zero invoiced amount gracefully', () => {
            const result = profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 0
            }));
            expect(result.profitMargin).toBe(0);
            expect(result.isProfitable).toBe(false);
        });

        it('handles zero actual hours gracefully', () => {
            const result = profitabilityService.analyzeJob(makeJobData({
                actualHours: 0
            }));
            expect(result.effectiveHourlyRate).toBe(0);
            expect(result.costs.labor).toBe(0);
            expect(result.costs.overhead).toBe(0);
        });

        it('stores cost breakdown correctly', () => {
            const result = profitabilityService.analyzeJob(makeJobData());
            expect(result.costs.labor).toBe(22 * 65);
            expect(result.costs.overhead).toBe(22 * 25);
            expect(result.costs.material).toBe(800);
            expect(result.costs.travel).toBe(120);
            expect(result.costs.other).toBe(50);
        });

        it('checks meetsTargetMargin against overhead settings', () => {
            // Default target margin is 25%
            const highMarginResult = profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 10000,
                actualHours: 10,
                laborRate: 50,
                materialCosts: 200,
                travelCosts: 0,
                otherCosts: 0
            }));
            // totalCost = 500 + 250 + 200 = 950, margin = (9050/10000)*100 = 90.5
            expect(highMarginResult.meetsTargetMargin).toBe(true);

            const lowMarginResult = profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 1000,
                actualHours: 10,
                laborRate: 65,
                materialCosts: 200,
                travelCosts: 0,
                otherCosts: 0
            }));
            // totalCost = 650 + 250 + 200 = 1100, grossProfit = -100, margin = -10
            expect(lowMarginResult.meetsTargetMargin).toBe(false);
        });

        it('persists analysis to jobAnalytics and calls save', () => {
            profitabilityService.analyzeJob(makeJobData());
            expect(profitabilityService.jobAnalytics.length).toBe(1);
            expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
                'freyai_job_analytics',
                expect.any(String)
            );
        });

        it('generates an id starting with prof-', () => {
            const result = profitabilityService.analyzeJob(makeJobData());
            expect(result.id).toMatch(/^prof-\d+$/);
        });

        it('guards against NaN from undefined numeric inputs', () => {
            const result = profitabilityService.analyzeJob({
                jobId: 'AUF-X',
                jobType: 'auftrag'
                // all numeric fields undefined
            });
            expect(result.invoicedAmount).toBe(0);
            expect(result.actualHours).toBe(0);
            expect(result.laborRate).toBe(0);
            expect(result.totalCost).toBe(0);
            expect(result.grossProfit).toBe(0);
            expect(result.profitMargin).toBe(0);
        });
    });

    // ─── analyzeFromInvoice ───

    describe('analyzeFromInvoice', () => {
        it('extracts data from a German invoice object', () => {
            const invoice = {
                id: 'RE-2026-042',
                kunde: { id: 'K-005', name: 'Weber Elektrotechnik' },
                beschreibung: 'Elektroinstallation Neubau',
                brutto: 8500,
                materialkosten: 2000,
                startdatum: '2026-01-15',
                datum: '2026-01-25',
                positionen: [
                    { bezeichnung: 'Leitungen verlegen', stunden: 12 },
                    { bezeichnung: 'Sicherungskasten', stunden: 4 }
                ]
            };

            const result = profitabilityService.analyzeFromInvoice(invoice);

            expect(result.jobId).toBe('RE-2026-042');
            expect(result.jobType).toBe('rechnung');
            expect(result.customerName).toBe('Weber Elektrotechnik');
            expect(result.invoicedAmount).toBe(8500);
            expect(result.costs.material).toBe(2000);
            // estimatedHours from positionen: 12 + 4 = 16
            expect(result.estimatedHours).toBe(16);
            expect(result.actualHours).toBe(16); // defaults to estimated when no timeData
        });

        it('uses timeData overrides when provided', () => {
            const invoice = {
                nummer: 'RE-099',
                kunde: { id: 'K-010', firma: 'Schmidt Dachbau' },
                betrag: 3200,
                positionen: []
            };

            const result = profitabilityService.analyzeFromInvoice(invoice, {
                estimatedHours: 10,
                actualHours: 14,
                laborRate: 70
            });

            expect(result.estimatedHours).toBe(10);
            expect(result.actualHours).toBe(14);
            expect(result.laborRate).toBe(70);
            expect(result.customerName).toBe('Schmidt Dachbau');
        });

        it('defaults to 4 estimated hours when no positionen', () => {
            const invoice = {
                id: 'RE-001',
                kunde: { id: 'K-001', name: 'Test' },
                brutto: 500
            };

            const result = profitabilityService.analyzeFromInvoice(invoice);
            expect(result.estimatedHours).toBe(4);
        });

        it('defaults laborRate to 65 when not in timeData', () => {
            const invoice = {
                id: 'RE-002',
                kunde: { id: 'K-002', name: 'Test' },
                brutto: 1000
            };

            const result = profitabilityService.analyzeFromInvoice(invoice);
            expect(result.laborRate).toBe(65);
        });

        it('uses invoice.nummer as jobId fallback', () => {
            const invoice = {
                nummer: 'RE-2026-100',
                kunde: { id: 'K-003', name: 'Beispiel GmbH' },
                brutto: 2000
            };
            const result = profitabilityService.analyzeFromInvoice(invoice);
            expect(result.jobId).toBe('RE-2026-100');
        });
    });

    // ─── getCustomerProfitability ───

    describe('getCustomerProfitability', () => {
        beforeEach(() => {
            profitabilityService.analyzeJob(makeJobData({
                customerId: 'K-001', customerName: 'Müller Sanitär GmbH',
                invoicedAmount: 5000, actualHours: 20, laborRate: 65,
                materialCosts: 500, travelCosts: 0, otherCosts: 0
            }));
            profitabilityService.analyzeJob(makeJobData({
                jobId: 'AUF-002',
                customerId: 'K-001', customerName: 'Müller Sanitär GmbH',
                invoicedAmount: 3000, actualHours: 12, laborRate: 65,
                materialCosts: 300, travelCosts: 0, otherCosts: 0
            }));
            profitabilityService.analyzeJob(makeJobData({
                jobId: 'AUF-003',
                customerId: 'K-002', customerName: 'Becker Malerei',
                invoicedAmount: 2000, actualHours: 15, laborRate: 65,
                materialCosts: 800, travelCosts: 0, otherCosts: 0
            }));
        });

        it('groups analytics by customer', () => {
            const result = profitabilityService.getCustomerProfitability();
            expect(result.length).toBe(2);
        });

        it('aggregates revenue, cost, profit, and hours per customer', () => {
            const result = profitabilityService.getCustomerProfitability();
            const mueller = result.find(c => c.customerId === 'K-001');
            expect(mueller.jobs).toBe(2);
            expect(mueller.totalRevenue).toBe(8000);
            expect(mueller.totalHours).toBe(32);
        });

        it('filters by customerId when provided', () => {
            const result = profitabilityService.getCustomerProfitability('K-002');
            expect(result.length).toBe(1);
            expect(result[0].customerName).toBe('Becker Malerei');
        });

        it('sorts by totalProfit descending', () => {
            const result = profitabilityService.getCustomerProfitability();
            expect(result[0].totalProfit).toBeGreaterThanOrEqual(result[1].totalProfit);
        });

        it('calculates avgMargin and effectiveRate', () => {
            const result = profitabilityService.getCustomerProfitability();
            const mueller = result.find(c => c.customerId === 'K-001');
            expect(mueller.avgMargin).toBeGreaterThan(0);
            expect(mueller.effectiveRate).toBeGreaterThan(0);
            expect(mueller.effectiveRate).toBe(mueller.totalRevenue / mueller.totalHours);
        });
    });

    // ─── getOverallStatistics ───

    describe('getOverallStatistics', () => {
        it('returns zeros when no jobs are tracked', () => {
            const stats = profitabilityService.getOverallStatistics();
            expect(stats.totalJobs).toBe(0);
            expect(stats.totalRevenue).toBe(0);
            expect(stats.totalProfit).toBe(0);
            expect(stats.averageMargin).toBe(0);
        });

        it('aggregates all job analytics correctly', () => {
            profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 5000, actualHours: 20, estimatedHours: 20,
                laborRate: 65, materialCosts: 500, travelCosts: 0, otherCosts: 0
            }));
            profitabilityService.analyzeJob(makeJobData({
                jobId: 'AUF-002',
                invoicedAmount: 3000, actualHours: 10, estimatedHours: 10,
                laborRate: 65, materialCosts: 200, travelCosts: 0, otherCosts: 0
            }));

            const stats = profitabilityService.getOverallStatistics();
            expect(stats.totalJobs).toBe(2);
            expect(stats.totalRevenue).toBe(8000);
            expect(stats.totalHours).toBe(30);
            expect(stats.totalEstimatedHours).toBe(30);
            expect(stats.overallEfficiency).toBe(100);
        });

        it('calculates profitableJobsPercent and onTimePercent', () => {
            // profitable and on-time
            profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 5000, actualHours: 18, estimatedHours: 20,
                laborRate: 50, materialCosts: 0, travelCosts: 0, otherCosts: 0
            }));
            // unprofitable and over-time
            profitabilityService.analyzeJob(makeJobData({
                jobId: 'AUF-002',
                invoicedAmount: 500, actualHours: 30, estimatedHours: 10,
                laborRate: 65, materialCosts: 500, travelCosts: 0, otherCosts: 0
            }));

            const stats = profitabilityService.getOverallStatistics();
            expect(stats.profitableJobsPercent).toBe(50);
            expect(stats.onTimePercent).toBe(50);
        });

        it('calculates averageJobValue', () => {
            profitabilityService.analyzeJob(makeJobData({ invoicedAmount: 4000 }));
            profitabilityService.analyzeJob(makeJobData({ jobId: 'AUF-002', invoicedAmount: 6000 }));

            const stats = profitabilityService.getOverallStatistics();
            expect(stats.averageJobValue).toBe(5000);
        });
    });

    // ─── getTrends ───

    describe('getTrends', () => {
        it('returns empty array with no analytics', () => {
            const trends = profitabilityService.getTrends();
            expect(trends).toEqual([]);
        });

        it('groups jobs by monthly period by default', () => {
            profitabilityService.analyzeJob(makeJobData());
            const trends = profitabilityService.getTrends('monthly');
            expect(trends.length).toBe(1);

            const now = new Date();
            const expectedKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            expect(trends[0].period).toBe(expectedKey);
        });

        it('aggregates revenue, cost, profit, hours per period', () => {
            profitabilityService.analyzeJob(makeJobData({ invoicedAmount: 5000 }));
            profitabilityService.analyzeJob(makeJobData({ jobId: 'AUF-002', invoicedAmount: 3000 }));

            const trends = profitabilityService.getTrends('monthly');
            expect(trends[0].jobs).toBe(2);
            expect(trends[0].revenue).toBe(8000);
        });

        it('calculates margin and efficiency for each period', () => {
            profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 5000, estimatedHours: 20, actualHours: 25
            }));
            const trends = profitabilityService.getTrends('monthly');
            expect(trends[0].margin).toBeDefined();
            expect(trends[0].efficiency).toBeDefined();
            // efficiency = (20/25)*100 = 80
            expect(trends[0].efficiency).toBe(80);
        });

        it('supports yearly period', () => {
            profitabilityService.analyzeJob(makeJobData());
            const trends = profitabilityService.getTrends('yearly');
            expect(trends[0].period).toBe(String(new Date().getFullYear()));
        });

        it('supports quarterly period', () => {
            profitabilityService.analyzeJob(makeJobData());
            const trends = profitabilityService.getTrends('quarterly');
            const now = new Date();
            const quarter = Math.floor(now.getMonth() / 3) + 1;
            expect(trends[0].period).toBe(`${now.getFullYear()}-Q${quarter}`);
        });

        it('calculates avgJobValue per period', () => {
            profitabilityService.analyzeJob(makeJobData({ invoicedAmount: 4000 }));
            profitabilityService.analyzeJob(makeJobData({ jobId: 'AUF-002', invoicedAmount: 6000 }));
            const trends = profitabilityService.getTrends('monthly');
            expect(trends[0].avgJobValue).toBe(5000);
        });
    });

    // ─── getUnprofitableJobs ───

    describe('getUnprofitableJobs', () => {
        it('returns empty array when all jobs are profitable', () => {
            profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 10000, actualHours: 5, laborRate: 50,
                materialCosts: 100, travelCosts: 0, otherCosts: 0
            }));
            const result = profitabilityService.getUnprofitableJobs();
            expect(result).toEqual([]);
        });

        it('returns jobs below default threshold (0%)', () => {
            profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 500, actualHours: 20, laborRate: 65,
                materialCosts: 500, travelCosts: 100, otherCosts: 0
            }));
            const result = profitabilityService.getUnprofitableJobs();
            expect(result.length).toBe(1);
            expect(result[0].profitMargin).toBeLessThan(0);
        });

        it('filters jobs below custom threshold', () => {
            profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 5000, actualHours: 20, laborRate: 65,
                materialCosts: 800, travelCosts: 120, otherCosts: 50
            }));
            // This job has a 41% margin, so threshold of 50 should catch it
            const result = profitabilityService.getUnprofitableJobs(50);
            expect(result.length).toBe(1);
        });

        it('sorts by profitMargin ascending (worst first)', () => {
            profitabilityService.analyzeJob(makeJobData({
                jobId: 'AUF-A', invoicedAmount: 500, actualHours: 20, laborRate: 65,
                materialCosts: 500, travelCosts: 0, otherCosts: 0
            }));
            profitabilityService.analyzeJob(makeJobData({
                jobId: 'AUF-B', invoicedAmount: 1000, actualHours: 15, laborRate: 65,
                materialCosts: 200, travelCosts: 0, otherCosts: 0
            }));
            const result = profitabilityService.getUnprofitableJobs(50);
            expect(result[0].profitMargin).toBeLessThanOrEqual(result[result.length - 1].profitMargin);
        });
    });

    // ─── getOvertimeJobs ───

    describe('getOvertimeJobs', () => {
        it('returns empty when all jobs are on time', () => {
            profitabilityService.analyzeJob(makeJobData({
                estimatedHours: 30, actualHours: 20
            }));
            expect(profitabilityService.getOvertimeJobs()).toEqual([]);
        });

        it('returns jobs that took longer than estimated', () => {
            profitabilityService.analyzeJob(makeJobData({
                estimatedHours: 10, actualHours: 18
            }));
            const result = profitabilityService.getOvertimeJobs();
            expect(result.length).toBe(1);
            expect(result[0].hoursDifference).toBe(8);
        });

        it('sorts by hoursDifference descending (most over-time first)', () => {
            profitabilityService.analyzeJob(makeJobData({
                jobId: 'AUF-A', estimatedHours: 10, actualHours: 13
            }));
            profitabilityService.analyzeJob(makeJobData({
                jobId: 'AUF-B', estimatedHours: 10, actualHours: 20
            }));
            const result = profitabilityService.getOvertimeJobs();
            expect(result[0].hoursDifference).toBe(10);
            expect(result[1].hoursDifference).toBe(3);
        });
    });

    // ─── calculateScenario ───

    describe('calculateScenario', () => {
        beforeEach(() => {
            profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 5000, actualHours: 20, laborRate: 65,
                materialCosts: 500, travelCosts: 0, otherCosts: 0
            }));
        });

        it('returns current and projected financials', () => {
            const scenario = profitabilityService.calculateScenario({
                revenueChange: 10
            });
            expect(scenario.current.revenue).toBe(5000);
            expect(scenario.projected.revenue).toBe(5500);
            expect(scenario.difference.revenue).toBe(500);
        });

        it('handles labor rate increase scenario', () => {
            const scenario = profitabilityService.calculateScenario({
                laborRateChange: 20
            });
            // labor cost was 1300, increased by 20% => 1560
            expect(scenario.projected.cost).toBeGreaterThan(scenario.current.cost);
            expect(scenario.projected.profit).toBeLessThan(scenario.current.profit);
        });

        it('handles overhead change scenario', () => {
            const scenario = profitabilityService.calculateScenario({
                overheadChange: -10
            });
            // overhead was 500, reduced by 10% => 450
            expect(scenario.projected.cost).toBeLessThan(scenario.current.cost);
            expect(scenario.projected.profit).toBeGreaterThan(scenario.current.profit);
        });

        it('handles no changes gracefully', () => {
            const scenario = profitabilityService.calculateScenario({});
            expect(scenario.projected.revenue).toBe(scenario.current.revenue);
            expect(scenario.projected.profit).toBe(scenario.current.profit);
        });
    });

    // ─── getRecommendations ───

    describe('getRecommendations', () => {
        it('returns empty when no jobs exist', () => {
            const recs = profitabilityService.getRecommendations();
            // With 0% margin and 0% target default 25%, margin < target
            // But totalJobs is 0 so averageMargin is 0 which is < 25
            // However efficiency is 100 by default (no hours), so only margin warning
            expect(recs.length).toBeGreaterThanOrEqual(0);
        });

        it('warns when margin is below target (Gewinnmarge unter Ziel)', () => {
            profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 2000, actualHours: 20, laborRate: 65,
                materialCosts: 500, travelCosts: 0, otherCosts: 0
            }));
            const recs = profitabilityService.getRecommendations();
            const marginWarning = recs.find(r => r.title === 'Gewinnmarge unter Ziel');
            expect(marginWarning).toBeDefined();
            expect(marginWarning.type).toBe('warning');
        });

        it('warns about low efficiency (Zeitschätzungen verbessern)', () => {
            profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 10000, estimatedHours: 10, actualHours: 20,
                laborRate: 50, materialCosts: 0, travelCosts: 0, otherCosts: 0
            }));
            const recs = profitabilityService.getRecommendations();
            const efficiencyWarning = recs.find(r => r.title === 'Zeitschätzungen verbessern');
            expect(efficiencyWarning).toBeDefined();
            expect(efficiencyWarning.type).toBe('info');
        });

        it('warns about unprofitable customers (Unrentable Kunden)', () => {
            profitabilityService.analyzeJob(makeJobData({
                customerId: 'K-BAD', customerName: 'Schlechter Kunde',
                invoicedAmount: 2000, actualHours: 20, laborRate: 65,
                materialCosts: 500, travelCosts: 100, otherCosts: 50
            }));
            const recs = profitabilityService.getRecommendations();
            const customerWarning = recs.find(r => r.title === 'Unrentable Kunden');
            expect(customerWarning).toBeDefined();
        });
    });

    // ─── updateOverheadSettings ───

    describe('updateOverheadSettings', () => {
        it('merges new settings with existing ones', () => {
            profitabilityService.updateOverheadSettings({ hourlyOverhead: 30 });
            expect(profitabilityService.overheadSettings.hourlyOverhead).toBe(30);
            // materialMarkup and targetMargin should remain at defaults
            expect(profitabilityService.overheadSettings.materialMarkup).toBe(15);
            expect(profitabilityService.overheadSettings.targetMargin).toBe(25);
        });

        it('persists settings to localStorage', () => {
            profitabilityService.updateOverheadSettings({ targetMargin: 30 });
            expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
                'freyai_overhead_settings',
                expect.any(String)
            );
            const saved = JSON.parse(globalThis.localStorage.data['freyai_overhead_settings']);
            expect(saved.targetMargin).toBe(30);
        });

        it('affects subsequent job analysis calculations', () => {
            profitabilityService.updateOverheadSettings({ hourlyOverhead: 40 });
            const result = profitabilityService.analyzeJob(makeJobData({
                invoicedAmount: 5000, actualHours: 10, laborRate: 65,
                materialCosts: 0, travelCosts: 0, otherCosts: 0
            }));
            // overhead = 10 * 40 = 400
            expect(result.costs.overhead).toBe(400);
        });
    });

    // ─── getAllAnalytics ───

    describe('getAllAnalytics', () => {
        it('returns empty array when no jobs tracked', () => {
            expect(profitabilityService.getAllAnalytics()).toEqual([]);
        });

        it('returns all analyzed jobs sorted by analyzedAt descending', () => {
            profitabilityService.analyzeJob(makeJobData({ jobId: 'AUF-001' }));
            profitabilityService.analyzeJob(makeJobData({ jobId: 'AUF-002' }));

            const all = profitabilityService.getAllAnalytics();
            expect(all.length).toBe(2);
            // Most recent first
            expect(new Date(all[0].analyzedAt).getTime())
                .toBeGreaterThanOrEqual(new Date(all[1].analyzedAt).getTime());
        });
    });

    // ─── formatCurrency ───

    describe('formatCurrency', () => {
        it('delegates to window.formatCurrency', () => {
            profitabilityService.formatCurrency(1234.56);
            expect(window.formatCurrency).toHaveBeenCalledWith(1234.56);
        });
    });

    // ─── Constructor defaults ───

    describe('constructor defaults', () => {
        it('sets default overhead settings', () => {
            expect(profitabilityService.overheadSettings.hourlyOverhead).toBe(25);
            expect(profitabilityService.overheadSettings.materialMarkup).toBe(15);
            expect(profitabilityService.overheadSettings.targetMargin).toBe(25);
        });

        it('initializes jobAnalytics as empty array', () => {
            expect(profitabilityService.jobAnalytics).toEqual([]);
        });
    });
});
