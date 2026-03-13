import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockStorage = {};
globalThis.localStorage = {
    getItem: vi.fn(k => mockStorage[k] || null),
    setItem: vi.fn((k, v) => { mockStorage[k] = v; }),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => {
        const raw = mockStorage[key];
        return raw ? JSON.parse(raw) : fallback;
    }),
};

globalThis.window = globalThis;
window.storeService = null;
window.customerService = null;
window.showToast = vi.fn();

await import('../js/services/communication-service.js');

const svc = () => window.communicationService;

// ============================================
// Tests
// ============================================

describe('CommunicationService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        window.communicationService = new window.communicationService.constructor();
        window.customerService = null;
    });

    // ── Message Logging ──

    describe('logMessage', () => {
        it('logs a message', () => {
            const entry = svc().logMessage({
                type: 'email',
                direction: 'outbound',
                from: 'test@firm.de',
                to: 'kunde@test.de',
                subject: 'Angebot',
                content: 'Hier Ihr Angebot',
            });
            expect(entry.id).toMatch(/^msg-/);
            expect(entry.type).toBe('email');
            expect(entry.direction).toBe('outbound');
            expect(entry.createdAt).toBeTruthy();
        });

        it('persists messages', () => {
            svc().logMessage({ type: 'sms', direction: 'outbound', content: 'Test' });
            expect(mockStorage['freyai_messages']).toBeTruthy();
        });

        it('adds customer interaction when customerService available', () => {
            const addInteraction = vi.fn();
            window.customerService = { addInteraction };
            svc().logMessage({
                type: 'email',
                direction: 'outbound',
                content: 'Test',
                customerId: 'c-1',
            });
            expect(addInteraction).toHaveBeenCalledWith('c-1', expect.objectContaining({
                type: 'email',
            }));
        });
    });

    // ── Call Logging ──

    describe('logCall', () => {
        it('logs a call', () => {
            const entry = svc().logCall({
                direction: 'inbound',
                phoneNumber: '+491234567890',
                customerName: 'Meier',
                duration: 300,
                outcome: 'connected',
            });
            expect(entry.id).toMatch(/^msg-/);
            expect(entry.phoneNumber).toBe('+491234567890');
            expect(entry.duration).toBe(300);
        });

        it('also creates a message entry', () => {
            svc().logCall({ direction: 'outbound', phoneNumber: '+491234567', notes: 'Rückruf' });
            expect(svc().messages.length).toBe(1);
            expect(svc().messages[0].type).toBe('call');
        });
    });

    // ── SMS ──

    describe('sendSMS', () => {
        it('sends SMS and logs it', async () => {
            const result = await svc().sendSMS('+491234567890', 'Test SMS', 'c-1');
            expect(result.success).toBe(true);
            expect(result.messageId).toBeTruthy();
            expect(svc().messages).toHaveLength(1);
            expect(svc().messages[0].type).toBe('sms');
        });
    });

    // ── WhatsApp ──

    describe('sendWhatsApp', () => {
        it('sends WhatsApp and returns URL', async () => {
            const result = await svc().sendWhatsApp('+491234567890', 'Hallo', 'c-1');
            expect(result.success).toBe(true);
            expect(result.whatsappUrl).toContain('wa.me');
        });
    });

    // ── Queries ──

    describe('message queries', () => {
        beforeEach(() => {
            svc().logMessage({ type: 'email', direction: 'outbound', content: 'E1', customerId: 'c-1' });
            svc().logMessage({ type: 'sms', direction: 'inbound', content: 'S1', customerId: 'c-2' });
            svc().logMessage({ type: 'email', direction: 'inbound', content: 'E2', customerId: 'c-1' });
        });

        it('getAllMessages returns all', () => {
            expect(svc().getAllMessages()).toHaveLength(3);
        });

        it('getMessagesByCustomer filters by customer', () => {
            expect(svc().getMessagesByCustomer('c-1')).toHaveLength(2);
        });

        it('getMessagesByType filters by type', () => {
            expect(svc().getMessagesByType('email')).toHaveLength(2);
            expect(svc().getMessagesByType('sms')).toHaveLength(1);
        });

        it('getRecentMessages returns sorted and limited', () => {
            const recent = svc().getRecentMessages(2);
            expect(recent).toHaveLength(2);
        });

        it('getUnreadMessages finds inbound without readAt', () => {
            const unread = svc().getUnreadMessages();
            expect(unread).toHaveLength(2);
        });

        it('markAsRead sets readAt', () => {
            const unread = svc().getUnreadMessages();
            svc().markAsRead(unread[0].id);
            expect(svc().getUnreadMessages()).toHaveLength(1);
        });
    });

    // ── Call Queries ──

    describe('call queries', () => {
        it('getCallLogs returns all', () => {
            svc().logCall({ direction: 'inbound', phoneNumber: '+491' });
            expect(svc().getCallLogs()).toHaveLength(1);
        });

        it('getCallsForCustomer filters', () => {
            svc().logCall({ direction: 'inbound', phoneNumber: '+491', customerId: 'c-1' });
            svc().logCall({ direction: 'outbound', phoneNumber: '+492', customerId: 'c-2' });
            expect(svc().getCallsForCustomer('c-1')).toHaveLength(1);
        });

        it('getRecentCalls returns limited results', () => {
            for (let i = 0; i < 30; i++) {
                svc().logCall({ direction: 'inbound', phoneNumber: `+49${i}` });
            }
            expect(svc().getRecentCalls(10)).toHaveLength(10);
        });
    });

    // ── Templates ──

    describe('templates', () => {
        it('getTemplates returns predefined templates', () => {
            const templates = svc().getTemplates();
            expect(templates.termin_bestaetigung).toBeTruthy();
            expect(templates.termin_erinnerung).toBeTruthy();
            expect(templates.rechnung_erinnerung).toBeTruthy();
        });

        it('fillTemplate replaces placeholders', () => {
            const result = svc().fillTemplate('termin_bestaetigung', {
                datum: '15.03.2024',
                uhrzeit: '14:00',
            });
            expect(result).toContain('15.03.2024');
            expect(result).toContain('14:00');
        });
    });

    // ── Statistics ──

    describe('getStatistics', () => {
        it('returns stats', () => {
            svc().logMessage({ type: 'email', direction: 'outbound', content: 'T' });
            svc().logMessage({ type: 'sms', direction: 'inbound', content: 'T' });
            svc().logCall({ direction: 'inbound', phoneNumber: '+491' });

            const stats = svc().getStatistics();
            expect(stats.totalMessages).toBeGreaterThanOrEqual(2);
            expect(stats.totalCalls).toBe(1);
            expect(stats.byType.email).toBe(1);
            expect(stats.byType.sms).toBe(1);
        });
    });

    // ── Helpers ──

    describe('helpers', () => {
        it('getTypeLabel returns German labels', () => {
            expect(svc().getTypeLabel('email')).toBe('E-Mail');
            expect(svc().getTypeLabel('sms')).toBe('SMS');
            expect(svc().getTypeLabel('call')).toBe('Anruf');
        });

        it('formatDate formats to German locale', () => {
            const formatted = svc().formatDate('2024-03-15T10:30:00Z');
            expect(formatted).toContain('15');
            expect(formatted).toContain('03');
        });
    });
});
