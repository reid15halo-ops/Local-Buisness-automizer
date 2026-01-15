/* ============================================
   Profitability Service - Job Profit Analysis
   Track actual vs estimated, calculate margins
   ============================================ */

class ProfitabilityService {
    constructor() {
        this.jobAnalytics = JSON.parse(localStorage.getItem('mhs_job_analytics') || '[]');
        this.overheadSettings = JSON.parse(localStorage.getItem('mhs_overhead_settings') || '{}');

        // Default overhead settings
        if (!this.overheadSettings.hourlyOverhead) this.overheadSettings.hourlyOverhead = 25; // €/hour
        if (!this.overheadSettings.materialMarkup) this.overheadSettings.materialMarkup = 15; // %
        if (!this.overheadSettings.targetMargin) this.overheadSettings.targetMargin = 25; // %
    }

    // Analyze a completed job
    analyzeJob(jobData) {
        const {
            jobId,
            jobType, // auftrag, rechnung, etc.
            customerId,
            customerName,
            description,
            invoicedAmount, // What we charged
            estimatedHours,
            actualHours,
            laborRate, // €/hour
            materialCosts = 0,
            travelCosts = 0,
            otherCosts = 0,
            startDate,
            endDate
        } = jobData;

        // Calculate costs
        const laborCost = actualHours * laborRate;
        const overheadCost = actualHours * this.overheadSettings.hourlyOverhead;
        const totalCost = laborCost + overheadCost + materialCosts + travelCosts + otherCosts;

        // Calculate profit
        const grossProfit = invoicedAmount - totalCost;
        const profitMargin = invoicedAmount > 0 ? (grossProfit / invoicedAmount) * 100 : 0;

        // Efficiency metrics
        const hoursDifference = actualHours - estimatedHours;
        const hoursEfficiency = estimatedHours > 0 ? (estimatedHours / actualHours) * 100 : 100;

        // Calculate effective hourly rate
        const effectiveHourlyRate = actualHours > 0 ? invoicedAmount / actualHours : 0;

        const analysis = {
            id: 'prof-' + Date.now(),
            jobId: jobId,
            jobType: jobType,
            customerId: customerId,
            customerName: customerName,
            description: description,

            // Financial
            invoicedAmount: invoicedAmount,
            totalCost: totalCost,
            grossProfit: grossProfit,
            profitMargin: Math.round(profitMargin * 100) / 100,

            // Cost breakdown
            costs: {
                labor: laborCost,
                overhead: overheadCost,
                material: materialCosts,
                travel: travelCosts,
                other: otherCosts
            },

            // Time analysis
            estimatedHours: estimatedHours,
            actualHours: actualHours,
            hoursDifference: hoursDifference,
            hoursEfficiency: Math.round(hoursEfficiency * 100) / 100,

            // Rates
            laborRate: laborRate,
            effectiveHourlyRate: Math.round(effectiveHourlyRate * 100) / 100,

            // Performance indicators
            isProfitable: grossProfit > 0,
            meetsTargetMargin: profitMargin >= this.overheadSettings.targetMargin,
            onTime: hoursDifference <= 0,

            // Dates
            startDate: startDate,
            endDate: endDate,
            analyzedAt: new Date().toISOString()
        };

        this.jobAnalytics.push(analysis);
        this.save();

        return analysis;
    }

    // Quick analyze from invoice
    analyzeFromInvoice(invoice, timeData = {}) {
        const estimatedHours = timeData.estimatedHours ||
            (invoice.positionen?.reduce((sum, p) => sum + (p.stunden || 0), 0)) || 4;

        const actualHours = timeData.actualHours || estimatedHours;
        const laborRate = timeData.laborRate || 65;

        return this.analyzeJob({
            jobId: invoice.id || invoice.nummer,
            jobType: 'rechnung',
            customerId: invoice.kunde?.id,
            customerName: invoice.kunde?.name || invoice.kunde?.firma,
            description: invoice.beschreibung || invoice.subject,
            invoicedAmount: invoice.betrag,
            estimatedHours: estimatedHours,
            actualHours: actualHours,
            laborRate: laborRate,
            materialCosts: invoice.materialkosten || 0,
            startDate: invoice.startdatum,
            endDate: invoice.datum
        });
    }

    // Get profitability by customer
    getCustomerProfitability(customerId = null) {
        const analytics = customerId
            ? this.jobAnalytics.filter(a => a.customerId === customerId)
            : this.jobAnalytics;

        // Group by customer
        const byCustomer = {};
        analytics.forEach(job => {
            const cid = job.customerId || 'unknown';
            if (!byCustomer[cid]) {
                byCustomer[cid] = {
                    customerId: cid,
                    customerName: job.customerName,
                    jobs: 0,
                    totalRevenue: 0,
                    totalCost: 0,
                    totalProfit: 0,
                    totalHours: 0,
                    avgMargin: 0
                };
            }
            byCustomer[cid].jobs++;
            byCustomer[cid].totalRevenue += job.invoicedAmount;
            byCustomer[cid].totalCost += job.totalCost;
            byCustomer[cid].totalProfit += job.grossProfit;
            byCustomer[cid].totalHours += job.actualHours;
        });

        // Calculate averages
        Object.values(byCustomer).forEach(c => {
            c.avgMargin = c.totalRevenue > 0
                ? (c.totalProfit / c.totalRevenue) * 100
                : 0;
            c.avgMargin = Math.round(c.avgMargin * 100) / 100;
            c.effectiveRate = c.totalHours > 0
                ? c.totalRevenue / c.totalHours
                : 0;
        });

        return Object.values(byCustomer).sort((a, b) => b.totalProfit - a.totalProfit);
    }

    // Get profitability trends over time
    getTrends(period = 'monthly') {
        const trends = {};

        this.jobAnalytics.forEach(job => {
            const date = new Date(job.analyzedAt);
            let key;

            switch (period) {
                case 'weekly':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = weekStart.toISOString().split('T')[0];
                    break;
                case 'monthly':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'quarterly':
                    const quarter = Math.floor(date.getMonth() / 3) + 1;
                    key = `${date.getFullYear()}-Q${quarter}`;
                    break;
                case 'yearly':
                    key = String(date.getFullYear());
                    break;
            }

            if (!trends[key]) {
                trends[key] = {
                    period: key,
                    jobs: 0,
                    revenue: 0,
                    cost: 0,
                    profit: 0,
                    hours: 0,
                    estimatedHours: 0
                };
            }

            trends[key].jobs++;
            trends[key].revenue += job.invoicedAmount;
            trends[key].cost += job.totalCost;
            trends[key].profit += job.grossProfit;
            trends[key].hours += job.actualHours;
            trends[key].estimatedHours += job.estimatedHours;
        });

        // Calculate derived metrics
        Object.values(trends).forEach(t => {
            t.margin = t.revenue > 0 ? (t.profit / t.revenue) * 100 : 0;
            t.margin = Math.round(t.margin * 100) / 100;
            t.efficiency = t.estimatedHours > 0 ? (t.estimatedHours / t.hours) * 100 : 100;
            t.efficiency = Math.round(t.efficiency * 100) / 100;
            t.avgJobValue = t.jobs > 0 ? t.revenue / t.jobs : 0;
        });

        return Object.values(trends).sort((a, b) => a.period.localeCompare(b.period));
    }

    // Get unprofitable jobs
    getUnprofitableJobs(threshold = 0) {
        return this.jobAnalytics
            .filter(j => j.profitMargin < threshold)
            .sort((a, b) => a.profitMargin - b.profitMargin);
    }

    // Get over-time jobs (took longer than estimated)
    getOvertimeJobs() {
        return this.jobAnalytics
            .filter(j => j.hoursDifference > 0)
            .sort((a, b) => b.hoursDifference - a.hoursDifference);
    }

    // Calculate what-if scenarios
    calculateScenario(changes) {
        const {
            revenueChange = 0, // % change
            laborRateChange = 0,
            overheadChange = 0,
            efficiencyImprovement = 0
        } = changes;

        const currentStats = this.getOverallStatistics();

        const newRevenue = currentStats.totalRevenue * (1 + revenueChange / 100);
        const newLaborCost = currentStats.totalLaborCost * (1 + laborRateChange / 100);
        const newOverhead = currentStats.totalOverhead * (1 + overheadChange / 100);
        const newHours = currentStats.totalHours * (1 - efficiencyImprovement / 100);

        const newTotalCost = newLaborCost + newOverhead + currentStats.totalMaterialCost;
        const newProfit = newRevenue - newTotalCost;
        const newMargin = newRevenue > 0 ? (newProfit / newRevenue) * 100 : 0;

        return {
            scenario: changes,
            current: {
                revenue: currentStats.totalRevenue,
                cost: currentStats.totalCost,
                profit: currentStats.totalProfit,
                margin: currentStats.averageMargin
            },
            projected: {
                revenue: newRevenue,
                cost: newTotalCost,
                profit: newProfit,
                margin: Math.round(newMargin * 100) / 100
            },
            difference: {
                revenue: newRevenue - currentStats.totalRevenue,
                profit: newProfit - currentStats.totalProfit,
                margin: newMargin - currentStats.averageMargin
            }
        };
    }

    // Get overall statistics
    getOverallStatistics() {
        const jobs = this.jobAnalytics;
        if (jobs.length === 0) {
            return {
                totalJobs: 0,
                totalRevenue: 0,
                totalCost: 0,
                totalProfit: 0,
                averageMargin: 0
            };
        }

        const totalRevenue = jobs.reduce((sum, j) => sum + j.invoicedAmount, 0);
        const totalCost = jobs.reduce((sum, j) => sum + j.totalCost, 0);
        const totalProfit = jobs.reduce((sum, j) => sum + j.grossProfit, 0);
        const totalHours = jobs.reduce((sum, j) => sum + j.actualHours, 0);
        const totalEstimatedHours = jobs.reduce((sum, j) => sum + j.estimatedHours, 0);
        const totalLaborCost = jobs.reduce((sum, j) => sum + j.costs.labor, 0);
        const totalOverhead = jobs.reduce((sum, j) => sum + j.costs.overhead, 0);
        const totalMaterialCost = jobs.reduce((sum, j) => sum + j.costs.material, 0);

        const profitableJobs = jobs.filter(j => j.isProfitable).length;
        const onTimeJobs = jobs.filter(j => j.onTime).length;

        return {
            totalJobs: jobs.length,
            totalRevenue: totalRevenue,
            totalCost: totalCost,
            totalProfit: totalProfit,
            averageMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : 0,
            totalHours: totalHours,
            totalEstimatedHours: totalEstimatedHours,
            overallEfficiency: totalEstimatedHours > 0
                ? Math.round((totalEstimatedHours / totalHours) * 10000) / 100
                : 100,
            totalLaborCost: totalLaborCost,
            totalOverhead: totalOverhead,
            totalMaterialCost: totalMaterialCost,
            profitableJobsPercent: (profitableJobs / jobs.length) * 100,
            onTimePercent: (onTimeJobs / jobs.length) * 100,
            averageJobValue: totalRevenue / jobs.length,
            effectiveHourlyRate: totalHours > 0 ? totalRevenue / totalHours : 0
        };
    }

    // Get recommendations
    getRecommendations() {
        const stats = this.getOverallStatistics();
        const recommendations = [];

        // Low margin alert
        if (stats.averageMargin < this.overheadSettings.targetMargin) {
            recommendations.push({
                type: 'warning',
                title: 'Gewinnmarge unter Ziel',
                description: `Aktuelle Marge ${stats.averageMargin}% liegt unter dem Ziel von ${this.overheadSettings.targetMargin}%`,
                action: 'Preise oder Effizienz überprüfen'
            });
        }

        // Low efficiency
        if (stats.overallEfficiency < 90) {
            recommendations.push({
                type: 'info',
                title: 'Zeitschätzungen verbessern',
                description: `Effizienz bei ${stats.overallEfficiency}% - Aufträge dauern oft länger als geschätzt`,
                action: 'Schätzungen nach oben korrigieren'
            });
        }

        // Unprofitable customers
        const customers = this.getCustomerProfitability();
        const unprofitable = customers.filter(c => c.avgMargin < 10);
        if (unprofitable.length > 0) {
            recommendations.push({
                type: 'warning',
                title: 'Unrentable Kunden',
                description: `${unprofitable.length} Kunden haben Marge unter 10%`,
                action: 'Preise für diese Kunden anpassen'
            });
        }

        return recommendations;
    }

    // Update overhead settings
    updateOverheadSettings(settings) {
        this.overheadSettings = { ...this.overheadSettings, ...settings };
        localStorage.setItem('mhs_overhead_settings', JSON.stringify(this.overheadSettings));
    }

    // Get all analytics
    getAllAnalytics() {
        return this.jobAnalytics.sort((a, b) =>
            new Date(b.analyzedAt) - new Date(a.analyzedAt)
        );
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
        localStorage.setItem('mhs_job_analytics', JSON.stringify(this.jobAnalytics));
    }
}

window.profitabilityService = new ProfitabilityService();
