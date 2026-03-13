import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock StorageUtils used by ContractService for persistence and date parsing
const StorageUtils = {
    getJSON: vi.fn(() => []),
    setJSON: vi.fn(() => true),
    safeDate: vi.fn((str) => {
        if (!str) return null;
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    })
};

// Mock window and globals
const window = { calendarService: null };
let store = { rechnungen: [] };
let saveStore = vi.fn();

// Self-contained ContractService (extracted from js/services/contract-service.js)
class ContractService {
    constructor() {
        this.contracts = StorageUtils.getJSON('freyai_contracts', [], { service: 'contractService' });
        this.invoiceHistory = StorageUtils.getJSON('freyai_contract_invoices', [], { service: 'contractService' });

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

    createContract(contractData) {
        const contract = {
            id: 'ctr-' + Date.now(),
            templateId: contractData.templateId || null,
            name: contractData.name,
            description: contractData.description || '',
            customerId: contractData.customerId,
            customerName: contractData.customerName,
            customerEmail: contractData.customerEmail,
            amount: contractData.amount,
            currency: 'EUR',
            interval: contractData.interval,
            startDate: contractData.startDate,
            endDate: contractData.endDate || null,
            nextInvoiceDate: this.calculateNextInvoiceDate(contractData.startDate, contractData.interval),
            nextServiceDate: contractData.nextServiceDate || contractData.startDate,
            status: 'active',
            autoRenew: contractData.autoRenew !== false,
            serviceIncludes: contractData.serviceIncludes || [],
            serviceLocation: contractData.serviceLocation || '',
            equipmentList: contractData.equipmentList || [],
            notes: contractData.notes || '',
            invoicesGenerated: 0,
            totalRevenue: 0,
            servicesPerformed: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.contracts.push(contract);
        this.save();
        this.scheduleServiceReminder(contract);
        return contract;
    }

    createFromTemplate(templateId, customerData) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) { return { success: false, error: 'Template not found' }; }

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

    calculateNextInvoiceDate(fromDate, interval) {
        const date = StorageUtils.safeDate(fromDate) || new Date();

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

    generateInvoice(contractId) {
        const contract = this.contracts.find(c => c.id === contractId);
        if (!contract) { return { success: false, error: 'Contract not found' }; }
        if (contract.status !== 'active') { return { success: false, error: 'Contract not active' }; }

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

        if (typeof store !== 'undefined' && store.rechnungen) {
            store.rechnungen.push(invoice);
            if (typeof saveStore === 'function') { saveStore(); }
        }

        contract.invoicesGenerated++;
        contract.totalRevenue += contract.amount;
        contract.lastInvoiceDate = new Date().toISOString();
        contract.nextInvoiceDate = this.calculateNextInvoiceDate(
            contract.nextInvoiceDate,
            contract.interval
        );
        contract.updatedAt = new Date().toISOString();

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

    recordService(contractId, _serviceData) {
        const contract = this.contracts.find(c => c.id === contractId);
        if (!contract) { return { success: false }; }

        contract.servicesPerformed++;
        contract.lastServiceDate = new Date().toISOString();
        contract.nextServiceDate = this.calculateNextServiceDate(contract);
        contract.updatedAt = new Date().toISOString();

        this.scheduleServiceReminder(contract);
        this.save();
        return { success: true, nextServiceDate: contract.nextServiceDate };
    }

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

    renewContract(contractId, newEndDate = null) {
        const contract = this.contracts.find(c => c.id === contractId);
        if (!contract) { return { success: false }; }

        if (newEndDate) {
            contract.endDate = newEndDate;
        } else if (contract.endDate) {
            const endD = StorageUtils.safeDate(contract.endDate);
            const startD = StorageUtils.safeDate(contract.startDate);
            if (endD && startD) {
                const originalDuration = endD - startD;
                contract.endDate = new Date(endD.getTime() + originalDuration)
                    .toISOString().split('T')[0];
            }
        }

        contract.status = 'active';
        contract.renewedAt = new Date().toISOString();
        contract.updatedAt = new Date().toISOString();

        this.save();
        return { success: true, contract };
    }

    cancelContract(contractId, reason = '') {
        const contract = this.contracts.find(c => c.id === contractId);
        if (!contract) { return { success: false }; }

        contract.status = 'cancelled';
        contract.cancelledAt = new Date().toISOString();
        contract.cancellationReason = reason;
        contract.updatedAt = new Date().toISOString();

        this.save();
        return { success: true };
    }

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

        return contracts.sort((a, b) => (StorageUtils.safeDate(b.createdAt) || 0) - (StorageUtils.safeDate(a.createdAt) || 0));
    }

    getContract(id) {
        return this.contracts.find(c => c.id === id);
    }

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
            totalContractValue: active.reduce((sum, c) => sum + (c.amount || 0), 0),
            expiringThisMonth: this.getExpiringContracts(30).length
        };
    }

    addDays(dateStr, days) {
        const date = StorageUtils.safeDate(dateStr) || new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    save() {
        if (!StorageUtils.setJSON('freyai_contracts', this.contracts, { service: 'contractService' })) {
            console.error('[ContractService] CRITICAL: Failed to persist contracts');
        }
    }

    saveInvoiceHistory() {
        if (!StorageUtils.setJSON('freyai_contract_invoices', this.invoiceHistory, { service: 'contractService' })) {
            console.error('[ContractService] CRITICAL: Failed to persist invoice history');
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContractService', () => {
    let service;

    const defaultCustomer = {
        customerId: 'cust-001',
        customerName: 'Hans Müller',
        customerEmail: 'hans@example.de'
    };

    const defaultContractData = {
        ...defaultCustomer,
        name: 'Wartungsvertrag Heizung',
        description: 'Jährliche Heizungswartung',
        amount: 299,
        interval: 'yearly',
        startDate: '2026-01-01'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        StorageUtils.getJSON.mockImplementation(() => []);
        StorageUtils.setJSON.mockReturnValue(true);
        store = { rechnungen: [] };
        saveStore = vi.fn();
        window.calendarService = null;
        service = new ContractService();
    });

    // -----------------------------------------------------------------------
    // Contract Creation
    // -----------------------------------------------------------------------
    describe('Contract Creation', () => {
        it('should create a contract with status active', () => {
            const contract = service.createContract(defaultContractData);
            expect(contract.status).toBe('active');
        });

        it('should assign an id starting with ctr-', () => {
            const contract = service.createContract(defaultContractData);
            expect(contract.id).toMatch(/^ctr-/);
        });

        it('should store customer data on the contract', () => {
            const contract = service.createContract(defaultContractData);
            expect(contract.customerId).toBe('cust-001');
            expect(contract.customerName).toBe('Hans Müller');
            expect(contract.customerEmail).toBe('hans@example.de');
        });

        it('should default autoRenew to true', () => {
            const contract = service.createContract(defaultContractData);
            expect(contract.autoRenew).toBe(true);
        });

        it('should respect autoRenew=false when explicitly set', () => {
            const contract = service.createContract({ ...defaultContractData, autoRenew: false });
            expect(contract.autoRenew).toBe(false);
        });

        it('should initialize tracking counters to zero', () => {
            const contract = service.createContract(defaultContractData);
            expect(contract.invoicesGenerated).toBe(0);
            expect(contract.totalRevenue).toBe(0);
            expect(contract.servicesPerformed).toBe(0);
        });

        it('should set currency to EUR', () => {
            const contract = service.createContract(defaultContractData);
            expect(contract.currency).toBe('EUR');
        });

        it('should persist contracts via StorageUtils.setJSON after creation', () => {
            service.createContract(defaultContractData);
            expect(StorageUtils.setJSON).toHaveBeenCalledWith(
                'freyai_contracts',
                expect.any(Array),
                { service: 'contractService' }
            );
        });

        it('should set endDate to null when not provided', () => {
            const contract = service.createContract(defaultContractData);
            expect(contract.endDate).toBeNull();
        });

        it('should use startDate as nextServiceDate when none provided', () => {
            const contract = service.createContract(defaultContractData);
            expect(contract.nextServiceDate).toBe('2026-01-01');
        });
    });

    // -----------------------------------------------------------------------
    // Template Creation
    // -----------------------------------------------------------------------
    describe('Create from Template', () => {
        it('should create contract from wartung_standard template', () => {
            const contract = service.createFromTemplate('wartung_standard', {
                customerId: 'cust-002',
                name: 'Maria Schmidt',
                email: 'maria@example.de',
                startDate: '2026-03-01'
            });
            expect(contract.name).toBe('Standard Wartungsvertrag');
            expect(contract.amount).toBe(299);
            expect(contract.interval).toBe('yearly');
        });

        it('should create contract from wartung_premium template', () => {
            const contract = service.createFromTemplate('wartung_premium', {
                customerId: 'cust-003',
                name: 'Klaus Weber',
                email: 'klaus@example.de',
                startDate: '2026-04-01'
            });
            expect(contract.amount).toBe(499);
            expect(contract.interval).toBe('halfyearly');
        });

        it('should create contract from service_abo template', () => {
            const contract = service.createFromTemplate('service_abo', {
                customerId: 'cust-004',
                name: 'Lisa Braun',
                email: 'lisa@example.de'
            });
            expect(contract.amount).toBe(49);
            expect(contract.interval).toBe('monthly');
        });

        it('should return error for unknown template', () => {
            const result = service.createFromTemplate('nonexistent', {
                customerId: 'cust-005',
                name: 'Test',
                email: 'test@test.de'
            });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Template not found');
        });

        it('should copy template includes into serviceIncludes', () => {
            const contract = service.createFromTemplate('wartung_standard', {
                customerId: 'cust-006',
                name: 'Max Test',
                email: 'max@test.de',
                startDate: '2026-06-01'
            });
            expect(contract.serviceIncludes).toContain('Jährliche Inspektion');
            expect(contract.serviceIncludes).toHaveLength(3);
        });
    });

    // -----------------------------------------------------------------------
    // Next Invoice Date Calculation
    // -----------------------------------------------------------------------
    describe('calculateNextInvoiceDate', () => {
        it('should add 1 month for monthly interval', () => {
            const next = service.calculateNextInvoiceDate('2026-01-15', 'monthly');
            expect(next).toBe('2026-02-15');
        });

        it('should add 3 months for quarterly interval', () => {
            const next = service.calculateNextInvoiceDate('2026-01-01', 'quarterly');
            expect(next).toBe('2026-04-01');
        });

        it('should add 6 months for halfyearly interval', () => {
            const next = service.calculateNextInvoiceDate('2026-01-01', 'halfyearly');
            expect(next).toBe('2026-07-01');
        });

        it('should add 1 year for yearly interval', () => {
            const next = service.calculateNextInvoiceDate('2026-01-01', 'yearly');
            expect(next).toBe('2027-01-01');
        });
    });

    // -----------------------------------------------------------------------
    // Invoice Generation
    // -----------------------------------------------------------------------
    describe('generateInvoice', () => {
        it('should generate invoice for active contract', () => {
            const contract = service.createContract(defaultContractData);
            const result = service.generateInvoice(contract.id);
            expect(result.success).toBe(true);
            expect(result.invoice).toBeDefined();
            expect(result.invoice.betrag).toBe(299);
        });

        it('should return error for nonexistent contract', () => {
            const result = service.generateInvoice('ctr-nonexistent');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Contract not found');
        });

        it('should return error for cancelled contract', () => {
            const contract = service.createContract(defaultContractData);
            service.cancelContract(contract.id);
            const result = service.generateInvoice(contract.id);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Contract not active');
        });

        it('should increment invoicesGenerated counter', () => {
            const contract = service.createContract(defaultContractData);
            service.generateInvoice(contract.id);
            expect(contract.invoicesGenerated).toBe(1);
            service.generateInvoice(contract.id);
            expect(contract.invoicesGenerated).toBe(2);
        });

        it('should accumulate totalRevenue on contract', () => {
            const contract = service.createContract(defaultContractData);
            service.generateInvoice(contract.id);
            expect(contract.totalRevenue).toBe(299);
            service.generateInvoice(contract.id);
            expect(contract.totalRevenue).toBe(598);
        });

        it('should record invoice in invoiceHistory', () => {
            const contract = service.createContract(defaultContractData);
            service.generateInvoice(contract.id);
            expect(service.invoiceHistory).toHaveLength(1);
            expect(service.invoiceHistory[0].contractId).toBe(contract.id);
            expect(service.invoiceHistory[0].amount).toBe(299);
        });

        it('should set invoice as Vertragsrechnung with correct vertragId', () => {
            const contract = service.createContract(defaultContractData);
            const result = service.generateInvoice(contract.id);
            expect(result.invoice.istVertragsrechnung).toBe(true);
            expect(result.invoice.vertragId).toBe(contract.id);
        });

        it('should set invoice due date 14 days after generation', () => {
            const contract = service.createContract(defaultContractData);
            const result = service.generateInvoice(contract.id);
            const invoiceDate = new Date(result.invoice.datum);
            const dueDate = new Date(result.invoice.faelligkeitsdatum);
            const diffDays = Math.round((dueDate - invoiceDate) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(14);
        });
    });

    // -----------------------------------------------------------------------
    // Due Invoice Checking
    // -----------------------------------------------------------------------
    describe('checkDueInvoices', () => {
        it('should generate invoices for contracts with past nextInvoiceDate', () => {
            const contract = service.createContract({
                ...defaultContractData,
                startDate: '2024-01-01'
            });
            // Force nextInvoiceDate to be in the past
            contract.nextInvoiceDate = '2025-01-01';
            const result = service.checkDueInvoices();
            expect(result.generated).toBe(1);
        });

        it('should not generate invoices for future nextInvoiceDate', () => {
            const contract = service.createContract(defaultContractData);
            contract.nextInvoiceDate = '2099-12-31';
            const result = service.checkDueInvoices();
            expect(result.generated).toBe(0);
        });

        it('should skip cancelled contracts', () => {
            const contract = service.createContract(defaultContractData);
            contract.nextInvoiceDate = '2020-01-01';
            service.cancelContract(contract.id);
            const result = service.checkDueInvoices();
            expect(result.generated).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // Service Recording
    // -----------------------------------------------------------------------
    describe('recordService', () => {
        it('should increment servicesPerformed', () => {
            const contract = service.createContract(defaultContractData);
            service.recordService(contract.id, {});
            expect(contract.servicesPerformed).toBe(1);
        });

        it('should return success false for nonexistent contract', () => {
            const result = service.recordService('ctr-nonexistent', {});
            expect(result.success).toBe(false);
        });

        it('should update nextServiceDate after recording', () => {
            const contract = service.createContract(defaultContractData);
            const originalNext = contract.nextServiceDate;
            service.recordService(contract.id, {});
            expect(contract.nextServiceDate).not.toBe(originalNext);
        });
    });

    // -----------------------------------------------------------------------
    // Contract Renewal
    // -----------------------------------------------------------------------
    describe('renewContract', () => {
        it('should set status to active on renewal', () => {
            const contract = service.createContract(defaultContractData);
            service.cancelContract(contract.id);
            expect(contract.status).toBe('cancelled');
            service.renewContract(contract.id);
            expect(contract.status).toBe('active');
        });

        it('should set explicit new end date when provided', () => {
            const contract = service.createContract({ ...defaultContractData, endDate: '2027-01-01' });
            service.renewContract(contract.id, '2028-06-15');
            expect(contract.endDate).toBe('2028-06-15');
        });

        it('should extend by original duration when no newEndDate given', () => {
            const contract = service.createContract({
                ...defaultContractData,
                startDate: '2026-01-01',
                endDate: '2027-01-01'
            });
            service.renewContract(contract.id);
            // Original duration is 1 year, so endDate should move from 2027-01-01 to 2028-01-01
            expect(contract.endDate).toBe('2028-01-01');
        });

        it('should return success false for nonexistent contract', () => {
            const result = service.renewContract('ctr-nonexistent');
            expect(result.success).toBe(false);
        });

        it('should set renewedAt timestamp', () => {
            const contract = service.createContract(defaultContractData);
            service.renewContract(contract.id);
            expect(contract.renewedAt).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // Contract Cancellation
    // -----------------------------------------------------------------------
    describe('cancelContract', () => {
        it('should set status to cancelled', () => {
            const contract = service.createContract(defaultContractData);
            const result = service.cancelContract(contract.id);
            expect(result.success).toBe(true);
            expect(contract.status).toBe('cancelled');
        });

        it('should store cancellation reason', () => {
            const contract = service.createContract(defaultContractData);
            service.cancelContract(contract.id, 'Kunde umgezogen');
            expect(contract.cancellationReason).toBe('Kunde umgezogen');
        });

        it('should return success false for nonexistent contract', () => {
            const result = service.cancelContract('ctr-nonexistent');
            expect(result.success).toBe(false);
        });

        it('should set cancelledAt timestamp', () => {
            const contract = service.createContract(defaultContractData);
            service.cancelContract(contract.id);
            expect(contract.cancelledAt).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // Filtering & Retrieval
    // -----------------------------------------------------------------------
    describe('getContracts', () => {
        it('should return all contracts without filters', () => {
            service.createContract(defaultContractData);
            service.createContract({ ...defaultContractData, customerName: 'Zweiter Kunde' });
            const result = service.getContracts();
            expect(result).toHaveLength(2);
        });

        it('should filter by status', () => {
            const c1 = service.createContract(defaultContractData);
            service.createContract({ ...defaultContractData, customerName: 'B' });
            service.cancelContract(c1.id);
            const active = service.getContracts({ status: 'active' });
            expect(active).toHaveLength(1);
            expect(active[0].customerName).toBe('B');
        });

        it('should filter by customerId', () => {
            service.createContract(defaultContractData);
            service.createContract({ ...defaultContractData, customerId: 'cust-999' });
            const result = service.getContracts({ customerId: 'cust-999' });
            expect(result).toHaveLength(1);
        });

        it('should filter by interval', () => {
            service.createContract(defaultContractData); // yearly
            service.createContract({ ...defaultContractData, interval: 'monthly' });
            const monthly = service.getContracts({ interval: 'monthly' });
            expect(monthly).toHaveLength(1);
        });
    });

    describe('getContract', () => {
        it('should return contract by id', () => {
            const created = service.createContract(defaultContractData);
            const found = service.getContract(created.id);
            expect(found).toBeDefined();
            expect(found.id).toBe(created.id);
        });

        it('should return undefined for unknown id', () => {
            const found = service.getContract('ctr-nonexistent');
            expect(found).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Expiring Contracts
    // -----------------------------------------------------------------------
    describe('getExpiringContracts', () => {
        it('should return contracts expiring within given days', () => {
            const contract = service.createContract({
                ...defaultContractData,
                endDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]
            });
            const expiring = service.getExpiringContracts(30);
            expect(expiring).toHaveLength(1);
            expect(expiring[0].id).toBe(contract.id);
        });

        it('should not return contracts without endDate', () => {
            service.createContract(defaultContractData); // endDate is null
            const expiring = service.getExpiringContracts(30);
            expect(expiring).toHaveLength(0);
        });

        it('should not return cancelled contracts', () => {
            const contract = service.createContract({
                ...defaultContractData,
                endDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
            });
            service.cancelContract(contract.id);
            const expiring = service.getExpiringContracts(30);
            expect(expiring).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // Statistics
    // -----------------------------------------------------------------------
    describe('getStatistics', () => {
        it('should return zero stats for empty service', () => {
            const stats = service.getStatistics();
            expect(stats.totalContracts).toBe(0);
            expect(stats.activeContracts).toBe(0);
            expect(stats.monthlyRecurringRevenue).toBe(0);
            expect(stats.annualRecurringRevenue).toBe(0);
        });

        it('should calculate MRR for monthly contracts', () => {
            service.createContract({ ...defaultContractData, interval: 'monthly', amount: 100 });
            const stats = service.getStatistics();
            expect(stats.monthlyRecurringRevenue).toBeCloseTo(100, 2);
        });

        it('should calculate MRR for yearly contracts as amount/12', () => {
            service.createContract({ ...defaultContractData, interval: 'yearly', amount: 1200 });
            const stats = service.getStatistics();
            expect(stats.monthlyRecurringRevenue).toBeCloseTo(100, 2);
        });

        it('should calculate MRR for quarterly contracts as amount/3', () => {
            service.createContract({ ...defaultContractData, interval: 'quarterly', amount: 300 });
            const stats = service.getStatistics();
            expect(stats.monthlyRecurringRevenue).toBeCloseTo(100, 2);
        });

        it('should calculate MRR for halfyearly contracts as amount/6', () => {
            service.createContract({ ...defaultContractData, interval: 'halfyearly', amount: 600 });
            const stats = service.getStatistics();
            expect(stats.monthlyRecurringRevenue).toBeCloseTo(100, 2);
        });

        it('should calculate ARR as MRR * 12', () => {
            service.createContract({ ...defaultContractData, interval: 'monthly', amount: 100 });
            const stats = service.getStatistics();
            expect(stats.annualRecurringRevenue).toBeCloseTo(1200, 2);
        });

        it('should not count cancelled contracts in active stats', () => {
            const c = service.createContract(defaultContractData);
            service.cancelContract(c.id);
            const stats = service.getStatistics();
            expect(stats.activeContracts).toBe(0);
            expect(stats.totalContracts).toBe(1);
            expect(stats.monthlyRecurringRevenue).toBe(0);
        });

        it('should sum totalContractValue for active contracts', () => {
            service.createContract({ ...defaultContractData, amount: 200 });
            service.createContract({ ...defaultContractData, amount: 300 });
            const stats = service.getStatistics();
            expect(stats.totalContractValue).toBe(500);
        });
    });

    // -----------------------------------------------------------------------
    // addDays helper
    // -----------------------------------------------------------------------
    describe('addDays', () => {
        it('should add 14 days correctly', () => {
            const result = service.addDays('2026-02-01', 14);
            expect(result).toBe('2026-02-15');
        });

        it('should cross month boundary', () => {
            const result = service.addDays('2026-01-25', 10);
            expect(result).toBe('2026-02-04');
        });
    });

    // -----------------------------------------------------------------------
    // Calendar Integration
    // -----------------------------------------------------------------------
    describe('scheduleServiceReminder', () => {
        it('should call calendarService.addAppointment when available', () => {
            window.calendarService = { addAppointment: vi.fn() };
            service.createContract(defaultContractData);
            expect(window.calendarService.addAppointment).toHaveBeenCalledTimes(1);
            expect(window.calendarService.addAppointment).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'service',
                    date: '2026-01-01'
                })
            );
        });

        it('should not throw when calendarService is not available', () => {
            window.calendarService = null;
            expect(() => service.createContract(defaultContractData)).not.toThrow();
        });
    });
});
