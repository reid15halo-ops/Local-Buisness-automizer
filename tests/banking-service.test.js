import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockStorage = {};
globalThis.localStorage = {
    getItem: vi.fn(k => mockStorage[k] || null),
    setItem: vi.fn((k, v) => { mockStorage[k] = v; }),
    removeItem: vi.fn(k => { delete mockStorage[k]; }),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => {
        const raw = mockStorage[key];
        return raw ? JSON.parse(raw) : fallback;
    }),
    setJSON: vi.fn((key, val) => {
        mockStorage[key] = JSON.stringify(val);
        return true;
    }),
    safeDate: vi.fn(s => s ? new Date(s) : null),
};

globalThis.window = globalThis;
Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => Math.random().toString(36).substring(2) },
    writable: true,
    configurable: true,
});
window.supabaseConfig = null;
window.authService = null;
window.storeService = null;
window.bookkeepingService = null;
window.formatCurrency = vi.fn(a => `${a.toFixed(2)} €`);

await import('../js/services/banking-service.js');

const svc = () => window.bankingService;

// ============================================
// Tests
// ============================================

describe('BankingService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        window.bankingService = new window.bankingService.constructor();
    });

    // ── Mode Detection ──

    describe('Mode Detection', () => {
        it('is in demo mode when no supabaseConfig', () => {
            window.supabaseConfig = null;
            expect(svc().isLiveMode()).toBe(false);
        });

        it('is in live mode when supabase configured', () => {
            window.supabaseConfig = { isConfigured: () => true };
            expect(svc().isLiveMode()).toBe(true);
            window.supabaseConfig = null;
        });
    });

    // ── Confidence Tiers ──

    describe('Confidence Tiers', () => {
        it('has correct confidence values', () => {
            const Cls = svc().constructor;
            expect(Cls.CONFIDENCE.REFERENCE_MATCH).toBe(0.95);
            expect(Cls.CONFIDENCE.AMOUNT_AND_NAME).toBe(0.85);
            expect(Cls.CONFIDENCE.AMOUNT_FUZZY).toBe(0.70);
        });
    });

    // ── Transaction Categorization ──

    describe('categorizeTransaction', () => {
        it('detects customer payment', () => {
            expect(svc().categorizeTransaction({ purpose: 'Zahlung Rechnung RE-001', amount: 500 })).toBe('einnahme_kunde');
        });

        it('detects fuel purchase', () => {
            expect(svc().categorizeTransaction({ purpose: 'Shell Diesel', amount: -80 })).toBe('fahrzeug');
        });

        it('detects rent', () => {
            expect(svc().categorizeTransaction({ purpose: 'Werkstattmiete Januar', amount: -1200 })).toBe('miete');
        });

        it('detects insurance', () => {
            expect(svc().categorizeTransaction({ purpose: 'Betriebsversicherung', amount: -250 })).toBe('versicherung');
        });

        it('detects telecom', () => {
            expect(svc().categorizeTransaction({ purpose: 'Telekom Mobilfunk', amount: -50 })).toBe('kommunikation');
        });

        it('detects utilities', () => {
            expect(svc().categorizeTransaction({ purpose: 'Strom Abschlag', amount: -120 })).toBe('nebenkosten');
        });

        it('detects personnel costs', () => {
            expect(svc().categorizeTransaction({ purpose: 'Lohn Februar', amount: -3000 })).toBe('personal');
        });

        it('detects material purchases from known suppliers', () => {
            expect(svc().categorizeTransaction({ purpose: 'Bestellung Hornbach', amount: -200 })).toBe('material');
            expect(svc().categorizeTransaction({ purpose: 'Einkauf OBI Markt', amount: -150 })).toBe('material');
            expect(svc().categorizeTransaction({ purpose: 'Bauhaus Einkauf', amount: -80 })).toBe('material');
        });

        it('detects material by keyword', () => {
            expect(svc().categorizeTransaction({ purpose: 'Werkzeug Bohrmaschine', amount: -300 })).toBe('material');
        });

        it('defaults credit to sonstige_einnahme', () => {
            expect(svc().categorizeTransaction({ purpose: 'Sonstiges', amount: 100 })).toBe('sonstige_einnahme');
        });

        it('defaults debit to sonstige_ausgabe', () => {
            expect(svc().categorizeTransaction({ purpose: 'Sonstiges', amount: -100 })).toBe('sonstige_ausgabe');
        });
    });

    // ── Supplier Identification ──

    describe('identifySupplier', () => {
        it('identifies Wurth', () => {
            const result = svc().identifySupplier({ name: 'Wurth GmbH', purpose: '' });
            expect(result.name).toBe('Wuerth');
            expect(result.type).toBe('wuerth');
        });

        it('identifies Hornbach', () => {
            const result = svc().identifySupplier({ purpose: 'Hornbach Baumarkt Einkauf' });
            expect(result.name).toBe('Hornbach');
        });

        it('returns generic for unknown supplier', () => {
            const result = svc().identifySupplier({ name: 'Random GmbH', purpose: '' });
            expect(result.type).toBe('generic');
        });
    });

    // ── Demo Bank Connection ──

    describe('Demo Mode', () => {
        it('lists demo banks', async () => {
            const banks = await svc().listInstitutions('DE');
            expect(banks.length).toBeGreaterThan(0);
            expect(banks[0].id).toMatch(/^DEMO_/);
        });

        it('connects demo bank account', async () => {
            const result = await svc().connectBank({ bankName: 'Test Bank', iban: 'DE1234' });
            expect(result.success).toBe(true);
            expect(result.account).toBeTruthy();
            expect(svc().getAccounts()).toHaveLength(1);
        });

        it('disconnects bank account', async () => {
            const result = await svc().connectBank({ bankName: 'Test' });
            svc().disconnectBank(result.account.id);
            expect(svc().getAccounts()).toHaveLength(0);
        });
    });

    // ── Transaction Filtering ──

    describe('getTransactions', () => {
        beforeEach(async () => {
            const result = await svc().connectBank({ bankName: 'Test' });
            // Demo transactions are auto-generated
        });

        it('returns all transactions by default', () => {
            const txs = svc().getTransactions();
            expect(txs.length).toBeGreaterThan(0);
        });

        it('filters by type', () => {
            const credits = svc().getTransactions({ type: 'credit' });
            credits.forEach(tx => expect(tx.type).toBe('credit'));
        });

        it('filters by search query', () => {
            const txs = svc().getTransactions({ search: 'Rechnung' });
            txs.forEach(tx => {
                const combined = (tx.purpose + tx.name + tx.reference).toLowerCase();
                expect(combined).toContain('rechnung');
            });
        });
    });

    // ── Random Transaction Generation ──

    describe('generateRandomTransactions', () => {
        it('generates requested number of transactions', () => {
            const txs = svc().generateRandomTransactions('acc-1', 10);
            expect(txs).toHaveLength(10);
        });

        it('assigns correct account ID', () => {
            const txs = svc().generateRandomTransactions('acc-1', 3);
            txs.forEach(tx => expect(tx.accountId).toBe('acc-1'));
        });

        it('generates both credit and debit', () => {
            const txs = svc().generateRandomTransactions('acc-1', 50);
            const types = new Set(txs.map(t => t.type));
            expect(types.size).toBe(2);
        });
    });

    // ── Balance Calculation ──

    describe('calculateBalance', () => {
        it('sums transaction amounts for account', () => {
            svc().transactions = [
                { accountId: 'a1', amount: 100 },
                { accountId: 'a1', amount: -50 },
                { accountId: 'a2', amount: 200 },
            ];
            expect(svc().calculateBalance('a1')).toBe(50);
        });
    });

    // ── Reconciliation Status ──

    describe('getReconciliationStatus', () => {
        it('returns reconciliation overview', () => {
            svc().accounts = [{ id: 'a1', balance: 1000 }];
            svc().transactions = [
                { type: 'credit', amount: 500, matched: true, matchConfidence: 0.95 },
                { type: 'credit', amount: 300, matched: false },
                { type: 'debit', amount: -200 },
            ];

            const status = svc().getReconciliationStatus();
            expect(status.accountCount).toBe(1);
            expect(status.totalBalance).toBe(1000);
            expect(status.matchedCount).toBe(1);
            expect(status.unmatchedCreditsCount).toBe(1);
            expect(status.averageMatchConfidence).toBe(95);
        });
    });

    // ── Unmatched Transaction Handling ──

    describe('Unmatched Transactions', () => {
        it('gets unmatched credit transactions', () => {
            svc().transactions = [
                { type: 'credit', amount: 500, matched: false },
                { type: 'credit', amount: 300, matched: true },
                { type: 'debit', amount: -200, matched: false },
                { type: 'credit', amount: 100, matched: false, dismissed: true },
            ];
            const unmatched = svc().getUnmatchedTransactions();
            expect(unmatched).toHaveLength(1);
            expect(unmatched[0].amount).toBe(500);
        });

        it('dismisses a transaction', () => {
            svc().transactions = [{ id: 'tx1', type: 'credit', amount: 500, matched: false }];
            const result = svc().dismissTransaction('tx1', 'Steuerrueckerstattung');
            expect(result.success).toBe(true);
            expect(svc().transactions[0].dismissed).toBe(true);
            expect(svc().transactions[0].dismissReason).toBe('Steuerrueckerstattung');
        });
    });

    // ── Payment Matching ──

    describe('unmatchPayment', () => {
        it('unmatches a previously matched payment', () => {
            svc().transactions = [{
                id: 'tx1', type: 'credit', amount: 500,
                matched: true, matchedTo: { type: 'rechnung', id: 'inv-1' },
                matchConfidence: 0.95, matchMethod: 'reference_match',
            }];
            svc().matchedPayments = [{ transactionId: 'tx1', invoiceId: 'inv-1' }];

            svc().unmatchPayment('tx1');
            expect(svc().transactions[0].matched).toBe(false);
            expect(svc().transactions[0].matchedTo).toBeNull();
            expect(svc().matchedPayments).toHaveLength(0);
        });
    });

    // ── Wareneingang ──

    describe('Material Purchase Tracking', () => {
        it('gets unprocessed material purchases', () => {
            svc().transactions = [
                { type: 'debit', category: 'material', wareneingangProcessed: false, amount: -200 },
                { type: 'debit', category: 'material', wareneingangProcessed: true, amount: -100 },
                { type: 'debit', category: 'fahrzeug', wareneingangProcessed: false, amount: -80 },
            ];
            const unprocessed = svc().getUnprocessedMaterialPurchases();
            expect(unprocessed).toHaveLength(1);
            expect(unprocessed[0].amount).toBe(-200);
        });

        it('marks transaction as processed by Wareneingang', () => {
            svc().transactions = [{ id: 'tx1', type: 'debit', category: 'material' }];
            svc().markAsWareneingangProcessed('tx1', 'we-001');
            expect(svc().transactions[0].wareneingangProcessed).toBe(true);
            expect(svc().transactions[0].wareneingangId).toBe('we-001');
        });
    });

    // ── Category Labels ──

    describe('getCategoryLabel', () => {
        it('returns German labels', () => {
            expect(svc().getCategoryLabel('einnahme_kunde')).toBe('Kundeneinnahme');
            expect(svc().getCategoryLabel('material')).toBe('Materialeinkauf');
            expect(svc().getCategoryLabel('miete')).toBe('Miete/Pacht');
        });

        it('returns raw key for unknown category', () => {
            expect(svc().getCategoryLabel('unknown')).toBe('unknown');
        });
    });
});
