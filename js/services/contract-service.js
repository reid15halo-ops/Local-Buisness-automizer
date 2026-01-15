/* ============================================
   Contract Service - Recurring Service Contracts
   Manage maintenance contracts and subscriptions
   ============================================ */

class ContractService {
    constructor() {
        this.contracts = JSON.parse(localStorage.getItem('mhs_contracts') || '[]');
        this.invoiceHistory = JSON.parse(localStorage.getItem('mhs_contract_invoices') || '[]');

        // Contract templates
        this.templates = [
            {
                id: 'wartung_standard',
                name: 'Standard Wartungsvertrag',
                description: 'Jährliche Wartung mit Prioritäts-Service',
                interval: 'yearly',
                defaultPrice: 299,
                includes: ['Jährliche Inspektion', 'Prioritäts-Terminvergabe', '10% Rabatt auf Reparaturen']
            },
            {
                id: 'wartung_premium',
                name: 'Premium Wartungsvertrag',
                description: 'Halbjährliche Wartung mit 24h-Notdienst',
                interval: 'halfyearly',
                defaultPrice: 499,
                includes: ['2x jährliche Inspektion', '24h Notdienst', '20% Rabatt auf Reparaturen', 'Kostenlose Kleinteile']
            },
            {
                id: 'service_abo',
                name: 'Service-Abo',
                description: 'Monatliches Service-Paket',
                interval: 'monthly',
                defaultPrice: 49,
                includes: ['Monatliche Kontrollbesuche', 'Unbegrenzte Anrufe', 'Prioritäts-Support']
            }
        ];
    }

    // Create new contract
    createContract(contractData) {
        const contract = {
            id: 'ctr-' + Date.now(),
            templateId: contractData.templateId || null,
            name: contractData.name,
            description: contractData.description || '',
            customerId: contractData.customerId,
            customerName: contractData.customerName,
            customerEmail: contractData.customerEmail,

            // Pricing
            amount: contractData.amount,
            currency: 'EUR',
            interval: contractData.interval, // monthly, quarterly, halfyearly, yearly

            // Dates
            startDate: contractData.startDate,
            endDate: contractData.endDate || null, // null = unlimited
            nextInvoiceDate: this.calculateNextInvoiceDate(contractData.startDate, contractData.interval),
            nextServiceDate: contractData.nextServiceDate || contractData.startDate,

            // Status
            status: 'active', // active, paused, cancelled, expired
            autoRenew: contractData.autoRenew !== false,

            // Service details
            serviceIncludes: contractData.serviceIncludes || [],
            serviceLocation: contractData.serviceLocation || '',
            equipmentList: contractData.equipmentList || [],
            notes: contractData.notes || '',

            // Tracking
            invoicesGenerated: 0,
            totalRevenue: 0,
            servicesPerformed: 0,

            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.contracts.push(contract);
        this.save();

        // Schedule first service reminder
        this.scheduleServiceReminder(contract);

        return contract;
    }

    // Create contract from template
    createFromTemplate(templateId, customerData) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return { success: false, error: 'Template not found' };

        return this.createContract({
            templateId: templateId,
            name: template.name,
            description: template.description,
            customerId: customerData.customerId,
            customerName: customerData.name,
            customerEmail: customerData.email,
            amount: template.defaultPrice,
            interval: template.interval,
            startDate: customerData.startDate || new Date().toISOString().split('T')[0],
            serviceIncludes: template.includes,
            serviceLocation: customerData.address || ''
        });
    }

    // Calculate next invoice date
    calculateNextInvoiceDate(fromDate, interval) {
        const date = new Date(fromDate);

        switch (interval) {
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'quarterly':
                date.setMonth(date.getMonth() + 3);
                break;
            case 'halfyearly':
                date.setMonth(date.getMonth() + 6);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
        }

        return date.toISOString().split('T')[0];
    }

    // Generate invoice for contract
    generateInvoice(contractId) {
        const contract = this.contracts.find(c => c.id === contractId);
        if (!contract) return { success: false, error: 'Contract not found' };
        if (contract.status !== 'active') return { success: false, error: 'Contract not active' };

        // Create invoice in system
        const invoice = {
            id: 'RE-V-' + Date.now(),
            typ: 'rechnung',
            kunde: {
                name: contract.customerName,
                email: contract.customerEmail
            },
            beschreibung: `${contract.name} - Zeitraum: ${new Date().toLocaleDateString('de-DE')} bis ${contract.nextInvoiceDate}`,
            positionen: [{
                name: contract.name,
                beschreibung: contract.description,
                menge: 1,
                einheit: 'Pauschal',
                einzelpreis: contract.amount
            }],
            betrag: contract.amount,
            datum: new Date().toISOString().split('T')[0],
            faelligkeitsdatum: this.addDays(new Date().toISOString().split('T')[0], 14),
            status: 'offen',
            istVertragsrechnung: true,
            vertragId: contract.id
        };

        // Add to main invoice store
        if (typeof store !== 'undefined' && store.rechnungen) {
            store.rechnungen.push(invoice);
            if (typeof saveStore === 'function') saveStore();
        }

        // Update contract
        contract.invoicesGenerated++;
        contract.totalRevenue += contract.amount;
        contract.lastInvoiceDate = new Date().toISOString();
        contract.nextInvoiceDate = this.calculateNextInvoiceDate(
            contract.nextInvoiceDate,
            contract.interval
        );
        contract.updatedAt = new Date().toISOString();

        // Record in history
        this.invoiceHistory.push({
            contractId: contract.id,
            invoiceId: invoice.id,
            amount: contract.amount,
            generatedAt: new Date().toISOString()
        });

        this.save();
        this.saveInvoiceHistory();

        return { success: true, invoice };
    }

    // Check for due invoices
    checkDueInvoices() {
        const today = new Date().toISOString().split('T')[0];
        const dueContracts = this.contracts.filter(c =>
            c.status === 'active' &&
            c.nextInvoiceDate <= today
        );

        const generated = [];
        dueContracts.forEach(contract => {
            const result = this.generateInvoice(contract.id);
            if (result.success) {
                generated.push(result.invoice);
            }
        });

        return { generated: generated.length, invoices: generated };
    }

    // Schedule service reminder
    scheduleServiceReminder(contract) {
        if (window.calendarService && contract.nextServiceDate) {
            window.calendarService.addAppointment({
                title: `Wartung: ${contract.customerName}`,
                type: 'service',
                date: contract.nextServiceDate,
                startTime: '09:00',
                endTime: '11:00',
                kunde: {
                    name: contract.customerName,
                    email: contract.customerEmail
                },
                beschreibung: `Vertrags-Wartung: ${contract.name}`,
                contractId: contract.id,
                location: contract.serviceLocation
            });
        }
    }

    // Record service performed
    recordService(contractId, serviceData) {
        const contract = this.contracts.find(c => c.id === contractId);
        if (!contract) return { success: false };

        contract.servicesPerformed++;
        contract.lastServiceDate = new Date().toISOString();
        contract.nextServiceDate = this.calculateNextServiceDate(contract);
        contract.updatedAt = new Date().toISOString();

        // Schedule next service
        this.scheduleServiceReminder(contract);

        this.save();
        return { success: true, nextServiceDate: contract.nextServiceDate };
    }

    // Calculate next service date
    calculateNextServiceDate(contract) {
        const date = new Date();

        switch (contract.interval) {
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'quarterly':
                date.setMonth(date.getMonth() + 3);
                break;
            case 'halfyearly':
                date.setMonth(date.getMonth() + 6);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
        }

        return date.toISOString().split('T')[0];
    }

    // Renew contract
    renewContract(contractId, newEndDate = null) {
        const contract = this.contracts.find(c => c.id === contractId);
        if (!contract) return { success: false };

        if (newEndDate) {
            contract.endDate = newEndDate;
        } else if (contract.endDate) {
            // Extend by original duration
            const originalDuration = new Date(contract.endDate) - new Date(contract.startDate);
            contract.endDate = new Date(new Date(contract.endDate).getTime() + originalDuration)
                .toISOString().split('T')[0];
        }

        contract.status = 'active';
        contract.renewedAt = new Date().toISOString();
        contract.updatedAt = new Date().toISOString();

        this.save();
        return { success: true, contract };
    }

    // Cancel contract
    cancelContract(contractId, reason = '') {
        const contract = this.contracts.find(c => c.id === contractId);
        if (!contract) return { success: false };

        contract.status = 'cancelled';
        contract.cancelledAt = new Date().toISOString();
        contract.cancellationReason = reason;
        contract.updatedAt = new Date().toISOString();

        this.save();
        return { success: true };
    }

    // Get contracts
    getContracts(filters = {}) {
        let contracts = [...this.contracts];

        if (filters.status) {
            contracts = contracts.filter(c => c.status === filters.status);
        }
        if (filters.customerId) {
            contracts = contracts.filter(c => c.customerId === filters.customerId);
        }
        if (filters.interval) {
            contracts = contracts.filter(c => c.interval === filters.interval);
        }

        return contracts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Get contract by ID
    getContract(id) {
        return this.contracts.find(c => c.id === id);
    }

    // Get expiring contracts
    getExpiringContracts(daysAhead = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + daysAhead);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        return this.contracts.filter(c =>
            c.status === 'active' &&
            c.endDate &&
            c.endDate <= cutoffStr
        );
    }

    // Get statistics
    getStatistics() {
        const active = this.contracts.filter(c => c.status === 'active');
        const monthlyRecurring = active.reduce((sum, c) => {
            switch (c.interval) {
                case 'monthly': return sum + c.amount;
                case 'quarterly': return sum + (c.amount / 3);
                case 'halfyearly': return sum + (c.amount / 6);
                case 'yearly': return sum + (c.amount / 12);
                default: return sum;
            }
        }, 0);

        return {
            totalContracts: this.contracts.length,
            activeContracts: active.length,
            monthlyRecurringRevenue: monthlyRecurring,
            annualRecurringRevenue: monthlyRecurring * 12,
            totalContractValue: active.reduce((sum, c) => sum + c.amount, 0),
            expiringThisMonth: this.getExpiringContracts(30).length
        };
    }

    // Helper: Add days to date
    addDays(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    // Persistence
    save() { localStorage.setItem('mhs_contracts', JSON.stringify(this.contracts)); }
    saveInvoiceHistory() { localStorage.setItem('mhs_contract_invoices', JSON.stringify(this.invoiceHistory)); }
}

window.contractService = new ContractService();
