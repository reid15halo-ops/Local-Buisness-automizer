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
window.APP_CONFIG = {};
window.calendarService = null;
window.customerService = null;
window.taskService = null;
window.communicationService = null;
window.demoGuardService = null;
window.supabaseConfig = null;

// Prevent real setInterval/setTimeout from running
vi.useFakeTimers();

await import('../js/services/sms-reminder-service.js');

const svc = () => window.smsReminderService;

// ============================================
// Tests
// ============================================

describe('SmsReminderService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        vi.clearAllTimers();
        window.smsReminderService = new window.smsReminderService.constructor();
    });

    // ── Settings ──

    describe('Settings', () => {
        it('has default settings', () => {
            expect(svc().settings.enabled).toBe(true);
            expect(svc().settings.reminder24h).toBe(true);
            expect(svc().settings.reminder1h).toBe(true);
            expect(svc().settings.senderName).toBe('FreyAI Visions');
        });

        it('updates settings', () => {
            svc().updateSettings({ senderName: 'Metallbau Schmidt' });
            expect(svc().settings.senderName).toBe('Metallbau Schmidt');
        });
    });

    // ── Templates ──

    describe('formatMessage', () => {
        it('replaces placeholders', () => {
            const msg = svc().formatMessage('Termin bei {business} um {time} Uhr', {
                business: 'Test GmbH',
                time: '14:00',
            });
            expect(msg).toContain('Test GmbH');
            expect(msg).toContain('14:00');
        });

        it('replaces multiple occurrences', () => {
            const msg = svc().formatMessage('{x} und {x}', { x: 'A' });
            expect(msg).toBe('A und A');
        });
    });

    // ── Schedule Reminder ──

    describe('scheduleReminder', () => {
        it('schedules reminders for future appointment', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 2);
            const dateStr = tomorrow.toISOString().split('T')[0];

            const result = svc().scheduleReminder({
                id: 'apt-1',
                date: dateStr,
                startTime: '14:00',
                kunde: { name: 'Meier', telefon: '+491234567890' },
            });

            expect(result.success).toBe(true);
            expect(svc().reminders.length).toBeGreaterThan(0);
        });

        it('does not duplicate reminders', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 2);
            const dateStr = tomorrow.toISOString().split('T')[0];

            const apt = { id: 'apt-1', date: dateStr, startTime: '14:00', kunde: { name: 'A', telefon: '+491234' } };
            svc().scheduleReminder(apt);
            const countBefore = svc().reminders.length;
            svc().scheduleReminder(apt);
            expect(svc().reminders.length).toBe(countBefore);
        });
    });

    // ── Send SMS (Demo Mode) ──

    describe('sendSms', () => {
        it('sends in demo mode when no provider configured', async () => {
            const result = await svc().sendSms('+491234567890', 'Test message');
            expect(result.success).toBe(true);
            expect(result.method).toBe('demo');
        });

        it('throttles repeated sends to same number', async () => {
            await svc().sendSms('+491234567890', 'First');
            const result = await svc().sendSms('+491234567890', 'Second');
            expect(result.success).toBe(false);
            expect(result.throttled).toBe(true);
        });

        it('allows sends to different numbers', async () => {
            await svc().sendSms('+491111111111', 'First');
            const result = await svc().sendSms('+492222222222', 'Second');
            expect(result.success).toBe(true);
        });

        it('blocks in demo guard mode', async () => {
            window.demoGuardService = { allowExternalAction: vi.fn(() => false) };
            const result = await svc().sendSms('+491234567890', 'Test');
            expect(result.success).toBe(true);
            expect(result.demo).toBe(true);
            window.demoGuardService = null;
        });
    });

    // ── Incoming Replies ──

    describe('handleIncomingReply', () => {
        beforeEach(() => {
            svc().reminders = [{
                id: 'rem-1',
                appointmentId: 'apt-1',
                recipient: '+491234567890',
                status: 'sent',
                sentAt: new Date().toISOString(),
            }];
        });

        it('handles confirmation reply', () => {
            const result = svc().handleIncomingReply('+491234567890', 'ja');
            expect(result.handled).toBe(true);
            expect(result.action).toBe('confirmed');
        });

        it('handles cancellation reply', () => {
            const result = svc().handleIncomingReply('+491234567890', 'nein');
            expect(result.handled).toBe(true);
            expect(result.action).toBe('cancelled');
        });

        it('handles reschedule request', () => {
            const result = svc().handleIncomingReply('+491234567890', 'verschieben bitte');
            expect(result.handled).toBe(true);
            expect(result.action).toBe('reschedule_requested');
        });

        it('returns no_context for unknown sender', () => {
            const result = svc().handleIncomingReply('+490000000000', 'ja');
            expect(result.handled).toBe(false);
            expect(result.action).toBe('no_context');
        });

        it('returns unknown_reply for unrecognized message', () => {
            const result = svc().handleIncomingReply('+491234567890', 'random text');
            expect(result.handled).toBe(false);
            expect(result.action).toBe('unknown_reply');
        });
    });

    // ── No-Show Tracking ──

    describe('trackNoShow', () => {
        it('tracks cancellations', () => {
            svc().trackNoShow('+491234567890', 'cancellation');
            expect(svc().noShowTracking).toHaveLength(1);
            expect(svc().noShowTracking[0].type).toBe('cancellation');
        });
    });

    // ── Cancel Reminders ──

    describe('cancelReminders', () => {
        it('cancels scheduled reminders for appointment', () => {
            svc().reminders = [
                { appointmentId: 'apt-1', status: 'scheduled' },
                { appointmentId: 'apt-1', status: 'sent' },
                { appointmentId: 'apt-2', status: 'scheduled' },
            ];
            svc().cancelReminders('apt-1');
            expect(svc().reminders[0].status).toBe('cancelled');
            expect(svc().reminders[1].status).toBe('sent');
            expect(svc().reminders[2].status).toBe('scheduled');
        });
    });

    // ── Statistics ──

    describe('getStatistics', () => {
        it('returns stats', () => {
            svc().reminders = [
                { status: 'scheduled' },
                { status: 'sent' },
                { status: 'failed' },
            ];
            svc().sentMessages = [{ id: 's1' }, { id: 's2' }];
            svc().noShowTracking = [{ type: 'no_show' }];

            const stats = svc().getStatistics();
            expect(stats.totalSent).toBe(2);
            expect(stats.scheduled).toBe(1);
            expect(stats.failed).toBe(1);
            expect(stats.noShowCount).toBe(1);
        });
    });

    // ── Queries ──

    describe('Queries', () => {
        it('gets pending reminders sorted by date', () => {
            svc().reminders = [
                { status: 'scheduled', sendAt: '2024-03-16T12:00:00Z' },
                { status: 'sent', sendAt: '2024-03-15T12:00:00Z' },
                { status: 'scheduled', sendAt: '2024-03-15T12:00:00Z' },
            ];
            const pending = svc().getPendingReminders();
            expect(pending).toHaveLength(2);
            expect(new Date(pending[0].sendAt) <= new Date(pending[1].sendAt)).toBe(true);
        });

        it('gets sent messages with limit', () => {
            svc().sentMessages = Array.from({ length: 10 }, (_, i) => ({
                id: `s${i}`,
                sentAt: new Date(2024, 2, i + 1).toISOString(),
            }));
            const msgs = svc().getSentMessages(5);
            expect(msgs).toHaveLength(5);
        });
    });
});
