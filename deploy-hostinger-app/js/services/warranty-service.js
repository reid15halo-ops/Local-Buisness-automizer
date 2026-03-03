/* ============================================
   Warranty Tracking Service
   Track warranty periods, remind for follow-ups
   ============================================ */

class WarrantyService {
    constructor() {
        this.warranties = JSON.parse(localStorage.getItem('freyai_warranties') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_warranty_settings') || '{}');

        // Default settings
        if (!this.settings.defaultWarrantyMonths) {this.settings.defaultWarrantyMonths = 24;}
        if (!this.settings.reminderDaysBefore) {this.settings.reminderDaysBefore = 30;}
    }

    // Add warranty for a job/product
    addWarranty(data) {
        const warranty = {
            id: 'war-' + Date.now(),
            jobId: data.jobId,
            invoiceId: data.invoiceId,
            customerId: data.customerId,
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            customerPhone: data.customerPhone,

            // Product/Service details
            productName: data.productName || data.description,
            productType: data.productType || 'service', // product, service, installation
            serialNumber: data.serialNumber || null,

            // Warranty period
            startDate: data.startDate || new Date().toISOString().split('T')[0],
            durationMonths: data.durationMonths || this.settings.defaultWarrantyMonths,
            endDate: null, // Calculated

            // Coverage
            coverageType: data.coverageType || 'full', // full, parts, labor
            terms: data.terms || 'Standard-Garantie gemäß Lieferbedingungen',
            exclusions: data.exclusions || [],

            // Status
            status: 'active', // active, expired, claimed, voided
            claims: [],

            // Notes
            notes: data.notes || '',
            attachments: data.attachments || [],

            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Calculate end date
        warranty.endDate = this.calculateEndDate(warranty.startDate, warranty.durationMonths);

        this.warranties.push(warranty);
        this.save();

        // Schedule reminder
        this.scheduleExpiryReminder(warranty);

        return warranty;
    }

    // Calculate warranty end date
    calculateEndDate(startDate, months) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + months);
        return date.toISOString().split('T')[0];
    }

    // Add warranty claim
    addClaim(warrantyId, claimData) {
        const warranty = this.warranties.find(w => w.id === warrantyId);
        if (!warranty) {return { success: false, error: 'Warranty not found' };}
        if (warranty.status !== 'active') {return { success: false, error: 'Warranty not active' };}

        const claim = {
            id: 'claim-' + Date.now(),
            date: new Date().toISOString(),
            issue: claimData.issue,
            description: claimData.description,
            resolution: claimData.resolution || 'pending',
            cost: claimData.cost || 0,
            coveredByWarranty: claimData.coveredByWarranty !== false,
            technician: claimData.technician || '',
            status: 'open' // open, in_progress, resolved, rejected
        };

        warranty.claims.push(claim);
        warranty.status = 'claimed';
        warranty.updatedAt = new Date().toISOString();

        this.save();

        // Create task for claim
        if (window.taskService) {
            window.taskService.addTask({
                title: `Garantiefall: ${warranty.productName}`,
                description: `Kunde: ${warranty.customerName}\nProblem: ${claim.issue}`,
                priority: 'high',
                source: 'warranty',
                dueDate: new Date().toISOString().split('T')[0]
            });
        }

        return { success: true, claim };
    }

    // Resolve claim
    resolveClaim(warrantyId, claimId, resolution) {
        const warranty = this.warranties.find(w => w.id === warrantyId);
        if (!warranty) {return { success: false };}

        const claim = warranty.claims.find(c => c.id === claimId);
        if (!claim) {return { success: false };}

        claim.status = 'resolved';
        claim.resolution = resolution.description;
        claim.resolvedAt = new Date().toISOString();
        claim.cost = resolution.cost || 0;

        // Reset warranty status if no open claims
        const hasOpenClaims = warranty.claims.some(c => c.status === 'open' || c.status === 'in_progress');
        if (!hasOpenClaims) {
            warranty.status = 'active';
        }

        warranty.updatedAt = new Date().toISOString();
        this.save();

        return { success: true };
    }

    // Check for expiring warranties
    getExpiringWarranties(daysAhead = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + daysAhead);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        return this.warranties.filter(w =>
            w.status === 'active' &&
            w.endDate >= today &&
            w.endDate <= cutoffStr
        ).sort((a, b) => a.endDate.localeCompare(b.endDate));
    }

    // Get expired warranties
    getExpiredWarranties() {
        const today = new Date().toISOString().split('T')[0];
        return this.warranties.filter(w =>
            w.status === 'active' && w.endDate < today
        );
    }

    // Update expired status
    updateExpiredWarranties() {
        const today = new Date().toISOString().split('T')[0];
        let updated = 0;

        this.warranties.forEach(w => {
            if (w.status === 'active' && w.endDate < today) {
                w.status = 'expired';
                w.expiredAt = new Date().toISOString();
                updated++;
            }
        });

        if (updated > 0) {this.save();}
        return updated;
    }

    // Schedule expiry reminder
    scheduleExpiryReminder(warranty) {
        const reminderDate = new Date(warranty.endDate);
        reminderDate.setDate(reminderDate.getDate() - this.settings.reminderDaysBefore);

        // Create task if within reminder window
        if (reminderDate <= new Date()) {
            if (window.taskService) {
                window.taskService.addTask({
                    title: `Garantie läuft ab: ${warranty.productName}`,
                    description: `Kunde: ${warranty.customerName}\nAblaufdatum: ${warranty.endDate}`,
                    priority: 'normal',
                    source: 'warranty',
                    dueDate: warranty.endDate
                });
            }
        }
    }

    // Get warranty by ID
    getWarranty(id) {
        return this.warranties.find(w => w.id === id);
    }

    // Get warranties by customer
    getWarrantiesByCustomer(customerId) {
        return this.warranties.filter(w => w.customerId === customerId);
    }

    // Get warranties by job/invoice
    getWarrantiesByJob(jobId) {
        return this.warranties.filter(w => w.jobId === jobId || w.invoiceId === jobId);
    }

    // Search warranties
    searchWarranties(query) {
        const q = query.toLowerCase();
        return this.warranties.filter(w =>
            w.productName.toLowerCase().includes(q) ||
            w.customerName.toLowerCase().includes(q) ||
            (w.serialNumber && w.serialNumber.toLowerCase().includes(q))
        );
    }

    // Get all warranties with filters
    getWarranties(filters = {}) {
        let warranties = [...this.warranties];

        if (filters.status) {
            warranties = warranties.filter(w => w.status === filters.status);
        }
        if (filters.customerId) {
            warranties = warranties.filter(w => w.customerId === filters.customerId);
        }
        if (filters.productType) {
            warranties = warranties.filter(w => w.productType === filters.productType);
        }

        return warranties.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Get statistics
    getStatistics() {
        const active = this.warranties.filter(w => w.status === 'active').length;
        const expired = this.warranties.filter(w => w.status === 'expired').length;
        const claimed = this.warranties.filter(w => w.status === 'claimed').length;
        const expiringSoon = this.getExpiringWarranties(30).length;

        const totalClaims = this.warranties.reduce((sum, w) => sum + w.claims.length, 0);
        const claimCosts = this.warranties.reduce((sum, w) =>
            sum + w.claims.reduce((s, c) => s + (c.coveredByWarranty ? c.cost : 0), 0), 0
        );

        return {
            total: this.warranties.length,
            active,
            expired,
            claimed,
            expiringSoon,
            totalClaims,
            claimCosts
        };
    }

    // Void warranty
    voidWarranty(id, reason) {
        const warranty = this.warranties.find(w => w.id === id);
        if (!warranty) {return { success: false };}

        warranty.status = 'voided';
        warranty.voidedAt = new Date().toISOString();
        warranty.voidReason = reason;
        warranty.updatedAt = new Date().toISOString();

        this.save();
        return { success: true };
    }

    // Extend warranty
    extendWarranty(id, additionalMonths) {
        const warranty = this.warranties.find(w => w.id === id);
        if (!warranty) {return { success: false };}

        warranty.durationMonths += additionalMonths;
        warranty.endDate = this.calculateEndDate(warranty.startDate, warranty.durationMonths);
        warranty.extended = true;
        warranty.extendedAt = new Date().toISOString();
        warranty.updatedAt = new Date().toISOString();

        this.save();
        return { success: true, newEndDate: warranty.endDate };
    }

    // Persistence
    save() {
        localStorage.setItem('freyai_warranties', JSON.stringify(this.warranties));
    }
}

window.warrantyService = new WarrantyService();
