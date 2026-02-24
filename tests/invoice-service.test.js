import { describe, it, expect, beforeEach } from 'vitest';

// Self-contained InvoiceService logic (extracted from js/services/invoice-service.js)
// Tests focus on the pure calculation and state logic without browser globals

const InvoiceCalculator = {
    calculateTotals19(netto) {
        const mwst = netto * 0.19;
        const brutto = netto * 1.19;
        return { netto, mwst, brutto };
    },

    calculateTotals7(netto) {
        const mwst = netto * 0.07;
        const brutto = netto * 1.07;
        return { netto, mwst, brutto };
    },

    applyDiscount(netto, discountPercent) {
        if (discountPercent < 0 || discountPercent > 100) {
            throw new Error('Discount must be between 0 and 100 percent');
        }
        const discountAmount = netto * (discountPercent / 100);
        return {
            nettoOriginal: netto,
            discountAmount,
            nettoAfterDiscount: netto - discountAmount,
            discountPercent
        };
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    },

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },

    validateInvoiceFields(invoice) {
        const errors = [];
        if (!invoice.kunde || !invoice.kunde.name) { errors.push('Kundenname ist Pflichtfeld'); }
        if (!invoice.netto && invoice.netto !== 0) { errors.push('Netto-Betrag ist Pflichtfeld'); }
        if (invoice.netto < 0) { errors.push('Netto-Betrag darf nicht negativ sein'); }
        return { valid: errors.length === 0, errors };
    }
};

class InvoiceManager {
    constructor() {
        this.rechnungen = [];
        this._counter = 0;
    }

    _generateId() {
        return `RE-TEST-${++this._counter}`;
    }

    createInvoice({ kunde, netto, materialKosten = 0, paymentTermDays = 14 }) {
        if (!kunde || !kunde.name) { throw new Error('Kundenname ist Pflichtfeld'); }
        if (netto === undefined || netto === null) { throw new Error('Netto-Betrag ist Pflichtfeld'); }
        if (netto < 0) { throw new Error('Netto-Betrag darf nicht negativ sein'); }

        const totalNetto = netto + materialKosten;
        const mwst = totalNetto * 0.19;
        const brutto = totalNetto * 1.19;
        const now = new Date();
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + paymentTermDays);

        const invoice = {
            id: this._generateId(),
            nummer: `RE-2026-${String(this._counter).padStart(3, '0')}`,
            kunde,
            netto: totalNetto,
            mwst,
            brutto,
            status: 'offen',
            datum: now.toISOString(),
            faelligkeitsdatum: dueDate.toISOString(),
            createdAt: now.toISOString()
        };

        this.rechnungen.push(invoice);
        return invoice;
    }

    markAsPaid(invoiceId, paymentData = {}) {
        const invoice = this.rechnungen.find(r => r.id === invoiceId);
        if (!invoice) { throw new Error('Invoice not found'); }
        invoice.status = 'bezahlt';
        invoice.paidAt = new Date().toISOString();
        invoice.paymentMethod = paymentData.method || 'Überweisung';
        return invoice;
    }

    cancelInvoice(invoiceId, reason = '') {
        const invoice = this.rechnungen.find(r => r.id === invoiceId);
        if (!invoice) { throw new Error('Invoice not found'); }
        if (invoice.status === 'bezahlt') { throw new Error('Cannot cancel paid invoice'); }
        invoice.status = 'storniert';
        invoice.cancelledAt = new Date().toISOString();
        invoice.cancellationReason = reason;
        return invoice;
    }

    getOverdueInvoices() {
        const now = new Date();
        return this.rechnungen.filter(inv => {
            if (inv.status !== 'offen') { return false; }
            const dueDate = new Date(inv.faelligkeitsdatum || inv.createdAt);
            return dueDate < now;
        });
    }

    getInvoicesByStatus(status) {
        return this.rechnungen.filter(r => r.status === status);
    }

    getStatistics() {
        const invoices = this.rechnungen;
        return {
            total: invoices.length,
            offen: invoices.filter(r => r.status === 'offen').length,
            bezahlt: invoices.filter(r => r.status === 'bezahlt').length,
            storniert: invoices.filter(r => r.status === 'storniert').length,
            summeOffen: invoices.filter(r => r.status === 'offen').reduce((sum, r) => sum + (r.brutto || 0), 0),
            summeBezahlt: invoices.filter(r => r.status === 'bezahlt').reduce((sum, r) => sum + (r.brutto || 0), 0)
        };
    }
}

describe('InvoiceService', () => {
    let manager;

    beforeEach(() => {
        manager = new InvoiceManager();
    });

    describe('Total Calculation - 19% MwSt', () => {
        it('should calculate correct netto, mwst, brutto for standard rate', () => {
            const result = InvoiceCalculator.calculateTotals19(1000);
            expect(result.netto).toBe(1000);
            expect(result.mwst).toBeCloseTo(190, 2);
            expect(result.brutto).toBeCloseTo(1190, 2);
        });

        it('should calculate 19% MwSt for small amount', () => {
            const result = InvoiceCalculator.calculateTotals19(100);
            expect(result.mwst).toBeCloseTo(19, 2);
            expect(result.brutto).toBeCloseTo(119, 2);
        });

        it('should calculate 19% MwSt for large amount', () => {
            const result = InvoiceCalculator.calculateTotals19(10000);
            expect(result.mwst).toBeCloseTo(1900, 2);
            expect(result.brutto).toBeCloseTo(11900, 2);
        });

        it('should handle zero netto correctly', () => {
            const result = InvoiceCalculator.calculateTotals19(0);
            expect(result.netto).toBe(0);
            expect(result.mwst).toBe(0);
            expect(result.brutto).toBe(0);
        });

        it('netto + mwst should equal brutto (consistency)', () => {
            const result = InvoiceCalculator.calculateTotals19(837.50);
            expect(result.netto + result.mwst).toBeCloseTo(result.brutto, 10);
        });
    });

    describe('Total Calculation - 7% MwSt (reduced rate)', () => {
        it('should calculate correct totals for 7% reduced rate', () => {
            const result = InvoiceCalculator.calculateTotals7(1000);
            expect(result.netto).toBe(1000);
            expect(result.mwst).toBeCloseTo(70, 2);
            expect(result.brutto).toBeCloseTo(1070, 2);
        });

        it('should compute 7% of 100 as 7.00', () => {
            const result = InvoiceCalculator.calculateTotals7(100);
            expect(result.mwst).toBeCloseTo(7, 2);
            expect(result.brutto).toBeCloseTo(107, 2);
        });
    });

    describe('Discount Application', () => {
        it('should apply 10% discount correctly', () => {
            const result = InvoiceCalculator.applyDiscount(1000, 10);
            expect(result.discountAmount).toBeCloseTo(100, 2);
            expect(result.nettoAfterDiscount).toBeCloseTo(900, 2);
        });

        it('should apply 0% discount (no change)', () => {
            const result = InvoiceCalculator.applyDiscount(500, 0);
            expect(result.discountAmount).toBe(0);
            expect(result.nettoAfterDiscount).toBe(500);
        });

        it('should apply 100% discount (free)', () => {
            const result = InvoiceCalculator.applyDiscount(500, 100);
            expect(result.nettoAfterDiscount).toBe(0);
        });

        it('should throw error for negative discount', () => {
            expect(() => InvoiceCalculator.applyDiscount(1000, -5)).toThrow();
        });

        it('should throw error for discount > 100%', () => {
            expect(() => InvoiceCalculator.applyDiscount(1000, 101)).toThrow();
        });

        it('should retain original netto value in result', () => {
            const result = InvoiceCalculator.applyDiscount(750, 20);
            expect(result.nettoOriginal).toBe(750);
            expect(result.discountPercent).toBe(20);
        });
    });

    describe('Invoice Creation', () => {
        it('should create invoice with correct status offen', () => {
            const invoice = manager.createInvoice({ kunde: { name: 'Max Mustermann' }, netto: 1000 });
            expect(invoice.status).toBe('offen');
        });

        it('should assign a unique invoice number', () => {
            const inv1 = manager.createInvoice({ kunde: { name: 'Kunde A' }, netto: 100 });
            const inv2 = manager.createInvoice({ kunde: { name: 'Kunde B' }, netto: 200 });
            expect(inv1.nummer).not.toBe(inv2.nummer);
        });

        it('should calculate brutto as netto * 1.19', () => {
            const invoice = manager.createInvoice({ kunde: { name: 'Test' }, netto: 1000 });
            expect(invoice.brutto).toBeCloseTo(1190, 2);
        });

        it('should add material costs to netto before calculating MwSt', () => {
            const invoice = manager.createInvoice({ kunde: { name: 'Test' }, netto: 800, materialKosten: 200 });
            expect(invoice.netto).toBe(1000);
            expect(invoice.brutto).toBeCloseTo(1190, 2);
        });

        it('should set due date correctly for 14 day payment term', () => {
            const invoice = manager.createInvoice({ kunde: { name: 'Test' }, netto: 500, paymentTermDays: 14 });
            const created = new Date(invoice.createdAt);
            const due = new Date(invoice.faelligkeitsdatum);
            const diffDays = Math.round((due - created) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(14);
        });

        it('should throw error if kunde name is missing', () => {
            expect(() => manager.createInvoice({ netto: 100 })).toThrow();
        });

        it('should throw error if netto is negative', () => {
            expect(() => manager.createInvoice({ kunde: { name: 'Test' }, netto: -100 })).toThrow();
        });
    });

    describe('Status Transitions: offen → bezahlt → überfällig', () => {
        it('should transition invoice from offen to bezahlt', () => {
            const invoice = manager.createInvoice({ kunde: { name: 'Test' }, netto: 500 });
            expect(invoice.status).toBe('offen');
            const paid = manager.markAsPaid(invoice.id, { method: 'Überweisung' });
            expect(paid.status).toBe('bezahlt');
            expect(paid.paidAt).toBeDefined();
            expect(paid.paymentMethod).toBe('Überweisung');
        });

        it('should transition invoice from offen to storniert', () => {
            const invoice = manager.createInvoice({ kunde: { name: 'Test' }, netto: 500 });
            const cancelled = manager.cancelInvoice(invoice.id, 'Stornierung auf Kundenwunsch');
            expect(cancelled.status).toBe('storniert');
            expect(cancelled.cancellationReason).toBe('Stornierung auf Kundenwunsch');
        });

        it('should not allow cancelling a paid invoice', () => {
            const invoice = manager.createInvoice({ kunde: { name: 'Test' }, netto: 500 });
            manager.markAsPaid(invoice.id);
            expect(() => manager.cancelInvoice(invoice.id)).toThrow('Cannot cancel paid invoice');
        });

        it('should detect overdue invoices (past due date)', () => {
            const invoice = manager.createInvoice({ kunde: { name: 'Test' }, netto: 500, paymentTermDays: 14 });
            invoice.faelligkeitsdatum = new Date('2020-01-01').toISOString();
            const overdue = manager.getOverdueInvoices();
            expect(overdue.length).toBe(1);
            expect(overdue[0].id).toBe(invoice.id);
        });

        it('should not include paid invoices in overdue list', () => {
            const invoice = manager.createInvoice({ kunde: { name: 'Test' }, netto: 500 });
            invoice.faelligkeitsdatum = new Date('2020-01-01').toISOString();
            manager.markAsPaid(invoice.id);
            const overdue = manager.getOverdueInvoices();
            expect(overdue.length).toBe(0);
        });

        it('should filter invoices by status correctly', () => {
            manager.createInvoice({ kunde: { name: 'A' }, netto: 100 });
            manager.createInvoice({ kunde: { name: 'B' }, netto: 200 });
            const inv3 = manager.createInvoice({ kunde: { name: 'C' }, netto: 300 });
            manager.markAsPaid(inv3.id);
            const offene = manager.getInvoicesByStatus('offen');
            const bezahlte = manager.getInvoicesByStatus('bezahlt');
            expect(offene.length).toBe(2);
            expect(bezahlte.length).toBe(1);
        });
    });

    describe('German Number Formatting', () => {
        it('should format 1234.56 as German currency string', () => {
            const formatted = InvoiceCalculator.formatCurrency(1234.56);
            expect(formatted).toContain('1.234,56');
            expect(formatted).toContain('€');
        });

        it('should format 0 as 0,00 €', () => {
            const formatted = InvoiceCalculator.formatCurrency(0);
            expect(formatted).toContain('0,00');
        });

        it('should format large amounts with thousand separators', () => {
            const formatted = InvoiceCalculator.formatCurrency(1000000);
            expect(formatted).toContain('1.000.000');
        });
    });

    describe('Required Field Validation', () => {
        it('should pass validation for valid invoice', () => {
            const result = InvoiceCalculator.validateInvoiceFields({ kunde: { name: 'Test GmbH' }, netto: 1000 });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should fail if kunde is missing', () => {
            const result = InvoiceCalculator.validateInvoiceFields({ netto: 1000 });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Kundenname ist Pflichtfeld');
        });

        it('should fail if netto is negative', () => {
            const result = InvoiceCalculator.validateInvoiceFields({ kunde: { name: 'Test' }, netto: -50 });
            expect(result.valid).toBe(false);
        });
    });

    describe('Invoice Statistics', () => {
        it('should calculate correct invoice statistics', () => {
            manager.createInvoice({ kunde: { name: 'A' }, netto: 1000 });
            manager.createInvoice({ kunde: { name: 'B' }, netto: 2000 });
            const inv3 = manager.createInvoice({ kunde: { name: 'C' }, netto: 500 });
            manager.markAsPaid(inv3.id);
            const stats = manager.getStatistics();
            expect(stats.total).toBe(3);
            expect(stats.offen).toBe(2);
            expect(stats.bezahlt).toBe(1);
            expect(stats.summeBezahlt).toBeCloseTo(595, 0);
        });

        it('should sum summeOffen correctly for multiple open invoices', () => {
            manager.createInvoice({ kunde: { name: 'A' }, netto: 100 });
            manager.createInvoice({ kunde: { name: 'B' }, netto: 200 });
            const stats = manager.getStatistics();
            expect(stats.summeOffen).toBeCloseTo(357, 0);
        });

        it('should return zero statistics for empty manager', () => {
            const stats = manager.getStatistics();
            expect(stats.total).toBe(0);
            expect(stats.summeOffen).toBe(0);
        });
    });

    describe('Date Utilities', () => {
        it('should add 14 days correctly', () => {
            const base = new Date('2026-02-01');
            const result = InvoiceCalculator.addDays(base, 14);
            expect(result.toISOString().startsWith('2026-02-15')).toBe(true);
        });

        it('should add 30 days crossing month boundary', () => {
            const base = new Date('2026-01-15');
            const result = InvoiceCalculator.addDays(base, 30);
            expect(result.toISOString().startsWith('2026-02-14')).toBe(true);
        });

        it('should not mutate original date', () => {
            const base = new Date('2026-02-01');
            const original = base.toISOString();
            InvoiceCalculator.addDays(base, 7);
            expect(base.toISOString()).toBe(original);
        });
    });
});
