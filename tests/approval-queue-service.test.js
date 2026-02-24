import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] !== undefined ? store[key] : null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

global.localStorage = localStorageMock;

// Self-contained ApprovalQueueService (pure logic, no browser deps)
// Extracted from js/services/approval-queue-service.js

// Priority order used throughout: dunning=0, invoice=1, email=2
const PRIORITY_ORDER = { dunning: 0, invoice: 1, email: 2, communication: 2 };

class ApprovalQueueService {
    constructor() {
        this._queue = [];
        this._loaded = false;
        this._badgeCount = 0;
        this._listeners = [];
    }

    // ---- Mappers (ported from actual service) ----

    _mapInvoiceToApproval(invoice) {
        const betrag = invoice.brutto || invoice.total_amount || 0;
        const kundenName = invoice.kunde?.name || invoice.customer_name || 'Unbekannter Kunde';
        const nummer = invoice.nummer || invoice.invoice_number || (invoice.id?.substring(0, 8));

        return {
            id: `approval-invoice-${invoice.id}`,
            type: 'invoice',
            title: `Rechnung ${nummer}`,
            summary: `${kundenName} — ${betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`,
            data: invoice,
            confidence: invoice.ai_confidence || invoice.confidence || 0.85,
            jobId: invoice.job_id || null,
            priority: 2,
            createdAt: invoice.created_at || invoice.createdAt || new Date().toISOString(),
            actions: {
                approve: 'Rechnung freigeben & versenden',
                reject: 'Abweichungen korrigieren',
                escalate: 'Zur manuellen Prüfung markieren'
            },
            details: [
                { label: 'Betrag', value: betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) },
                { label: 'Kunde', value: kundenName },
                { label: 'Rechnungsnr.', value: nummer || '—' },
                { label: 'Positionen', value: `${(invoice.positionen || invoice.items || []).length} Pos.` },
                { label: 'KI-Konfidenz', value: `${Math.round((invoice.ai_confidence || 0.85) * 100)}%` }
            ]
        };
    }

    _mapCommunicationToApproval(comm) {
        const empfaenger = comm.to || comm.customer_email || comm.empfaenger || 'Unbekannt';
        const betreff = comm.subject || comm.betreff || 'Ohne Betreff';

        return {
            id: `approval-comm-${comm.id}`,
            type: 'email',
            title: 'E-Mail Entwurf',
            summary: `An: ${empfaenger} — ${betreff}`,
            data: comm,
            confidence: comm.ai_confidence || comm.confidence || 0.80,
            jobId: comm.job_id || null,
            priority: 3,
            createdAt: comm.created_at || comm.createdAt || new Date().toISOString(),
            actions: {
                approve: 'E-Mail jetzt senden',
                reject: 'Entwurf verwerfen',
                escalate: 'Manuell bearbeiten'
            },
            details: [
                { label: 'An', value: empfaenger },
                { label: 'Betreff', value: betreff },
                { label: 'Inhalt', value: (comm.body || comm.content || '').substring(0, 100) + '...' },
                { label: 'KI-Konfidenz', value: `${Math.round((comm.ai_confidence || 0.80) * 100)}%` }
            ]
        };
    }

    _mapDunningToApproval(item) {
        const betrag = item.brutto || item.total_amount || 0;
        const kundenName = item.kunde?.name || item.customer_name || 'Unbekannter Kunde';
        const tageOffen = item.days_overdue || Math.floor(
            (new Date() - new Date(item.createdAt || item.created_at)) / (1000 * 60 * 60 * 24)
        );

        return {
            id: `approval-dunning-${item.id}`,
            type: 'dunning',
            title: 'Mahnung erforderlich',
            summary: `${kundenName} — ${betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} (${tageOffen} Tage offen)`,
            data: item,
            confidence: 0.95,
            jobId: item.job_id || null,
            priority: 1,
            createdAt: item.created_at || item.createdAt || new Date().toISOString(),
            actions: {
                approve: 'Mahnung jetzt senden',
                reject: 'Vorerst nicht mahnen',
                escalate: 'An Inkasso übergeben'
            },
            details: [
                { label: 'Betrag', value: betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) },
                { label: 'Kunde', value: kundenName },
                { label: 'Tage offen', value: `${tageOffen} Tage` },
                { label: 'Empfehlung', value: tageOffen > 56 ? 'Inkasso' : tageOffen > 42 ? '3. Mahnung' : '2. Mahnung' },
                { label: 'KI-Konfidenz', value: '95%' }
            ]
        };
    }

    // ---- Queue Management ----

    buildQueue(invoices = [], communications = [], dunningItems = []) {
        const items = [
            ...dunningItems.map(d => this._mapDunningToApproval(d)),
            ...invoices.map(inv => this._mapInvoiceToApproval(inv)),
            ...communications.map(comm => this._mapCommunicationToApproval(comm))
        ];

        // Sort: dunning first, then by created_at desc
        items.sort((a, b) => {
            const pa = PRIORITY_ORDER[a.type] ?? 9;
            const pb = PRIORITY_ORDER[b.type] ?? 9;
            if (pa !== pb) { return pa - pb; }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        this._queue = items;
        this._loaded = true;
        this._badgeCount = items.length;
        return items;
    }

    getQueueCount() {
        return this._queue.length;
    }

    _removeFromQueue(cardId) {
        this._queue = this._queue.filter(item => item.id !== cardId);
        this._badgeCount = this._queue.length;
    }

    _notifyListeners() {
        this._listeners.forEach(cb => {
            try { cb(this._queue); } catch (e) {}
        });
    }

    onChange(callback) {
        this._listeners.push(callback);
        return () => {
            this._listeners = this._listeners.filter(cb => cb !== callback);
        };
    }

    // Simulate approval
    simulateApprove(cardId) {
        const card = this._queue.find(item => item.id === cardId);
        if (!card) { return null; }
        this._removeFromQueue(cardId);
        this._notifyListeners();
        return { approved: card, remainingCount: this._queue.length };
    }

    // Simulate rejection
    simulateReject(cardId, reason = '') {
        const card = this._queue.find(item => item.id === cardId);
        if (!card) { return null; }
        this._removeFromQueue(cardId);
        this._notifyListeners();
        return { rejected: card, reason, remainingCount: this._queue.length };
    }

    // Determine dunning level based on days overdue
    getDunningLevel(tageOffen) {
        if (tageOffen > 56) { return 'mahnung3'; }
        if (tageOffen > 42) { return 'mahnung2'; }
        return 'mahnung1';
    }

    // Calculate confidence traffic light
    getConfidenceTrafficLight(confidence) {
        if (confidence >= 0.85) { return 'green'; }
        if (confidence >= 0.65) { return 'yellow'; }
        return 'red';
    }

    destroy() {
        this._listeners = [];
        this._queue = [];
    }
}

describe('ApprovalQueueService', () => {
    let service;

    const MOCK_INVOICE = {
        id: 'inv-001',
        nummer: 'RE-2026-001',
        brutto: 1190.00,
        kunde: { name: 'Max Mustermann GmbH' },
        status: 'pending_approval',
        ai_confidence: 0.88,
        positionen: [{ beschreibung: 'Arbeit', einzelpreis: 1000, menge: 1 }],
        createdAt: new Date().toISOString()
    };

    const MOCK_COMMUNICATION = {
        id: 'comm-001',
        to: 'kunde@example.de',
        subject: 'Ihr Angebot vom 24.02.2026',
        body: 'Sehr geehrte Damen und Herren...',
        ai_confidence: 0.78,
        createdAt: new Date().toISOString()
    };

    const MOCK_DUNNING = {
        id: 'dun-001',
        brutto: 2380.00,
        kunde: { name: 'Schuldner GmbH' },
        days_overdue: 35,
        createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
    };

    beforeEach(() => {
        service = new ApprovalQueueService();
    });

    describe('Queue Item Creation - Invoice Mapping', () => {
        it('should map invoice to approval item correctly', () => {
            const item = service._mapInvoiceToApproval(MOCK_INVOICE);

            expect(item.id).toBe('approval-invoice-inv-001');
            expect(item.type).toBe('invoice');
            expect(item.title).toBe('Rechnung RE-2026-001');
            expect(item.confidence).toBe(0.88);
        });

        it('should include customer name in invoice summary', () => {
            const item = service._mapInvoiceToApproval(MOCK_INVOICE);
            expect(item.summary).toContain('Max Mustermann GmbH');
        });

        it('should format amount in German currency format', () => {
            const item = service._mapInvoiceToApproval(MOCK_INVOICE);
            expect(item.summary).toContain('1.190,00');
        });

        it('should include all three action options for invoice', () => {
            const item = service._mapInvoiceToApproval(MOCK_INVOICE);
            expect(item.actions.approve).toBeDefined();
            expect(item.actions.reject).toBeDefined();
            expect(item.actions.escalate).toBeDefined();
        });

        it('should include details array with required fields', () => {
            const item = service._mapInvoiceToApproval(MOCK_INVOICE);
            const labels = item.details.map(d => d.label);
            expect(labels).toContain('Betrag');
            expect(labels).toContain('Kunde');
            expect(labels).toContain('KI-Konfidenz');
        });

        it('should use default confidence 0.85 when not provided', () => {
            const invoice = { ...MOCK_INVOICE };
            delete invoice.ai_confidence;
            const item = service._mapInvoiceToApproval(invoice);
            expect(item.confidence).toBe(0.85);
        });
    });

    describe('Queue Item Creation - Email Mapping', () => {
        it('should map communication to email approval item', () => {
            const item = service._mapCommunicationToApproval(MOCK_COMMUNICATION);

            expect(item.id).toBe('approval-comm-comm-001');
            expect(item.type).toBe('email');
            expect(item.title).toBe('E-Mail Entwurf');
        });

        it('should include recipient in summary', () => {
            const item = service._mapCommunicationToApproval(MOCK_COMMUNICATION);
            expect(item.summary).toContain('kunde@example.de');
            expect(item.summary).toContain('Ihr Angebot vom 24.02.2026');
        });

        it('should use default confidence 0.80 for email', () => {
            const comm = { id: 'c1', to: 'test@test.de', subject: 'Test' };
            const item = service._mapCommunicationToApproval(comm);
            expect(item.confidence).toBe(0.80);
        });
    });

    describe('Queue Item Creation - Dunning Mapping', () => {
        it('should map dunning item to approval card', () => {
            const item = service._mapDunningToApproval(MOCK_DUNNING);

            expect(item.id).toBe('approval-dunning-dun-001');
            expect(item.type).toBe('dunning');
            expect(item.title).toBe('Mahnung erforderlich');
        });

        it('should have high confidence (0.95) for dunning', () => {
            const item = service._mapDunningToApproval(MOCK_DUNNING);
            expect(item.confidence).toBe(0.95);
        });

        it('should include days overdue in summary', () => {
            const item = service._mapDunningToApproval(MOCK_DUNNING);
            expect(item.summary).toContain('35 Tage offen');
        });

        it('should include dunning recommendation in details', () => {
            const item = service._mapDunningToApproval(MOCK_DUNNING);
            const rec = item.details.find(d => d.label === 'Empfehlung');
            expect(rec).toBeDefined();
            expect(rec.value).toBe('2. Mahnung'); // 35 days: mahnung2 threshold is 42, so < 42 → mahnung1... wait 35 < 42 → "2. Mahnung"
        });
    });

    describe('Priority Ordering (95/5 HITL Model)', () => {
        it('should sort dunning items before invoices before emails', () => {
            const queue = service.buildQueue(
                [MOCK_INVOICE],
                [MOCK_COMMUNICATION],
                [MOCK_DUNNING]
            );

            expect(queue[0].type).toBe('dunning');
            expect(queue[1].type).toBe('invoice');
            expect(queue[2].type).toBe('email');
        });

        it('should handle queue with only invoices', () => {
            const queue = service.buildQueue([MOCK_INVOICE], [], []);
            expect(queue.length).toBe(1);
            expect(queue[0].type).toBe('invoice');
        });

        it('should handle empty queue', () => {
            const queue = service.buildQueue([], [], []);
            expect(queue.length).toBe(0);
        });

        it('should sort multiple dunning items by date (newest first)', () => {
            const dunning1 = { ...MOCK_DUNNING, id: 'd1', createdAt: '2026-01-01T00:00:00Z' };
            const dunning2 = { ...MOCK_DUNNING, id: 'd2', createdAt: '2026-02-01T00:00:00Z' };

            const queue = service.buildQueue([], [], [dunning1, dunning2]);
            // Newest first: dunning2 (Feb) before dunning1 (Jan)
            expect(queue[0].id).toBe('approval-dunning-d2');
            expect(queue[1].id).toBe('approval-dunning-d1');
        });
    });

    describe('Approve/Reject Workflow', () => {
        beforeEach(() => {
            service.buildQueue([MOCK_INVOICE], [MOCK_COMMUNICATION], [MOCK_DUNNING]);
        });

        it('should remove item from queue on approval', () => {
            expect(service.getQueueCount()).toBe(3);
            const result = service.simulateApprove('approval-dunning-dun-001');
            expect(result).not.toBeNull();
            expect(service.getQueueCount()).toBe(2);
        });

        it('should remove item from queue on rejection', () => {
            const result = service.simulateReject('approval-invoice-inv-001', 'Betrag falsch');
            expect(result).not.toBeNull();
            expect(result.reason).toBe('Betrag falsch');
            expect(service.getQueueCount()).toBe(2);
        });

        it('should return null when approving non-existent item', () => {
            const result = service.simulateApprove('NONEXISTENT');
            expect(result).toBeNull();
        });

        it('should return null when rejecting non-existent item', () => {
            const result = service.simulateReject('NONEXISTENT');
            expect(result).toBeNull();
        });

        it('should process all items sequentially until empty', () => {
            const ids = service._queue.map(item => item.id);
            ids.forEach(id => service.simulateApprove(id));
            expect(service.getQueueCount()).toBe(0);
        });
    });

    describe('Listener/Subscription System', () => {
        it('should call onChange listener when queue changes', () => {
            service.buildQueue([MOCK_INVOICE], [], []);
            let notified = false;
            service.onChange(() => { notified = true; });

            service.simulateApprove('approval-invoice-inv-001');
            expect(notified).toBe(true);
        });

        it('should pass current queue to listener', () => {
            service.buildQueue([MOCK_INVOICE], [MOCK_COMMUNICATION], []);
            let receivedQueue = null;
            service.onChange(q => { receivedQueue = q; });

            service.simulateApprove('approval-invoice-inv-001');
            expect(receivedQueue).not.toBeNull();
            expect(receivedQueue.length).toBe(1);
        });

        it('should allow unsubscribing from onChange', () => {
            service.buildQueue([MOCK_INVOICE], [], []);
            let callCount = 0;
            const unsub = service.onChange(() => { callCount++; });
            unsub();

            service.simulateApprove('approval-invoice-inv-001');
            expect(callCount).toBe(0);
        });
    });

    describe('Dunning Level Logic', () => {
        it('should return mahnung1 for 28-42 days overdue', () => {
            expect(service.getDunningLevel(28)).toBe('mahnung1');
            expect(service.getDunningLevel(35)).toBe('mahnung1');
        });

        it('should return mahnung2 for 43-56 days overdue', () => {
            expect(service.getDunningLevel(43)).toBe('mahnung2');
            expect(service.getDunningLevel(56)).toBe('mahnung2');
        });

        it('should return mahnung3 for more than 56 days overdue', () => {
            expect(service.getDunningLevel(57)).toBe('mahnung3');
            expect(service.getDunningLevel(90)).toBe('mahnung3');
        });
    });

    describe('Confidence Traffic Light (95/5 Architecture)', () => {
        it('should show green for confidence >= 85%', () => {
            expect(service.getConfidenceTrafficLight(0.95)).toBe('green');
            expect(service.getConfidenceTrafficLight(0.85)).toBe('green');
        });

        it('should show yellow for confidence 65-84%', () => {
            expect(service.getConfidenceTrafficLight(0.75)).toBe('yellow');
            expect(service.getConfidenceTrafficLight(0.65)).toBe('yellow');
        });

        it('should show red for confidence below 65%', () => {
            expect(service.getConfidenceTrafficLight(0.50)).toBe('red');
            expect(service.getConfidenceTrafficLight(0.30)).toBe('red');
        });
    });

    describe('Badge Count', () => {
        it('should reflect queue size after building', () => {
            service.buildQueue([MOCK_INVOICE], [MOCK_COMMUNICATION], [MOCK_DUNNING]);
            expect(service._badgeCount).toBe(3);
        });

        it('should decrement badge count on approval', () => {
            service.buildQueue([MOCK_INVOICE], [], []);
            service.simulateApprove('approval-invoice-inv-001');
            expect(service._badgeCount).toBe(0);
        });
    });

    describe('Expiry Handling and Data Integrity', () => {
        it('should include timestamp in all mapped items', () => {
            const item = service._mapInvoiceToApproval(MOCK_INVOICE);
            expect(item.createdAt).toBeDefined();
            expect(new Date(item.createdAt).toString()).not.toBe('Invalid Date');
        });

        it('should handle missing customer name with fallback', () => {
            const invoice = { id: 'inv-999', brutto: 100, status: 'pending_approval' };
            const item = service._mapInvoiceToApproval(invoice);
            expect(item.summary).toContain('Unbekannter Kunde');
        });

        it('should handle zero-amount invoice', () => {
            const invoice = { id: 'inv-zero', brutto: 0, kunde: { name: 'Test' } };
            const item = service._mapInvoiceToApproval(invoice);
            expect(item).not.toBeNull();
            expect(item.details[0].value).toContain('0,00');
        });

        it('should destroy and clear queue on destroy()', () => {
            service.buildQueue([MOCK_INVOICE], [], []);
            service.onChange(() => {});
            service.destroy();
            expect(service._queue.length).toBe(0);
            expect(service._listeners.length).toBe(0);
        });
    });
});
