import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const store = {};
global.localStorage = {
    getItem: vi.fn(key => store[key] || null),
    setItem: vi.fn((key, val) => { store[key] = val; }),
    removeItem: vi.fn(key => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); })
};

// Mock document.hidden (default: not hidden so push notifications are suppressed)
Object.defineProperty(global, 'document', {
    value: { hidden: false, dispatchEvent: vi.fn() },
    writable: true
});

// Mock window.Notification
global.Notification = vi.fn(function (title, options) {
    this.title = title;
    this.options = options;
});
global.Notification.permission = 'granted';
global.Notification.requestPermission = vi.fn(() => Promise.resolve('granted'));
global.window = { Notification: global.Notification, notificationService: null };

// ============================================
// NotificationService — inline for testing
// Extracted from js/services/notification-service.js
// ============================================
class NotificationService {
    constructor() {
        this.notificationHistory = [];
        this.maxNotifications = 20;
        this.notificationTypes = {
            anfrage_neu: { icon: '\u{1F4E5}', color: '#3b82f6', label: 'Neue Anfrage eingegangen' },
            angebot_akzeptiert: { icon: '\u2705', color: '#10b981', label: 'Angebot wurde akzeptiert' },
            angebot_vorlaeufig: { icon: '\u{1F4E8}', color: '#c8956c', label: 'Vorl\u00e4ufiges Angebot gesendet \u2014 bitte pr\u00fcfen' },
            rechnung_ueberfaellig: { icon: '\u26A0\uFE0F', color: '#ef4444', label: 'Rechnung ist \u00fcberf\u00e4llig' },
            rechnung_bezahlt: { icon: '\u{1F4B0}', color: '#10b981', label: 'Zahlung eingegangen' },
            termin_erinnerung: { icon: '\u23F0', color: '#f59e0b', label: 'Termin in 30 Minuten' },
            aufgabe_faellig: { icon: '\u270F\uFE0F', color: '#f59e0b', label: 'Aufgabe f\u00e4llig' },
            system: { icon: '\u2699\uFE0F', color: '#6b7280', label: 'System-Mitteilung' }
        };
        this.storageKey = 'freyai-notifications';
        this.unreadCount = 0;
        this.listeners = [];
        this.loadFromStorage();
    }

    async requestPermission() {
        if (!('Notification' in window)) return 'denied';
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission !== 'denied') {
            try {
                const permission = await Notification.requestPermission();
                return permission;
            } catch { return 'denied'; }
        }
        return Notification.permission;
    }

    sendNotification(title, options = {}) {
        if (!('Notification' in window)) return;
        if (!document.hidden) return;
        if (Notification.permission === 'granted') {
            try {
                new Notification(title, { icon: '/img/icon-192.png', badge: '/img/icon-96.png', ...options });
            } catch { /* noop */ }
        }
    }

    addNotification(type, title, description = '', metadata = {}) {
        const notificationType = this.notificationTypes[type] || this.notificationTypes.system;
        const dedupKey = `${type}:${title}`;
        const recentDupe = this.notificationHistory.find(n => {
            if (`${n.type}:${n.title}` !== dedupKey) return false;
            const age = Date.now() - new Date(n.timestamp).getTime();
            return age < 60000;
        });
        if (recentDupe) return recentDupe;

        const notification = {
            ...metadata,
            id: this.generateId(),
            type,
            icon: notificationType.icon,
            color: notificationType.color,
            title,
            description: description || notificationType.label,
            timestamp: new Date().toISOString(),
            read: false
        };
        this.notificationHistory.unshift(notification);
        if (this.notificationHistory.length > this.maxNotifications) {
            this.notificationHistory = this.notificationHistory.slice(0, this.maxNotifications);
        }
        this.updateUnreadCount();
        this.saveToStorage();
        this.notifyListeners({ event: 'notification-added', notification });
        if (document.hidden) {
            this.sendNotification(title, { body: description || notificationType.label, tag: type });
        }
        return notification;
    }

    markAsRead(notificationId) {
        const notification = this.notificationHistory.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.updateUnreadCount();
            this.saveToStorage();
            this.notifyListeners({ event: 'notification-read', notificationId });
        }
    }

    markAllAsRead() {
        this.notificationHistory.forEach(n => { n.read = true; });
        this.updateUnreadCount();
        this.saveToStorage();
        this.notifyListeners({ event: 'all-marked-read' });
    }

    deleteNotification(notificationId) {
        const index = this.notificationHistory.findIndex(n => n.id === notificationId);
        if (index !== -1) {
            this.notificationHistory.splice(index, 1);
            this.updateUnreadCount();
            this.saveToStorage();
            this.notifyListeners({ event: 'notification-deleted', notificationId });
        }
    }

    clearAll() {
        this.notificationHistory = [];
        this.updateUnreadCount();
        this.saveToStorage();
        this.notifyListeners({ event: 'all-cleared' });
    }

    getNotifications() { return this.notificationHistory; }
    getUnreadCount() { return this.unreadCount; }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    getRelativeTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now.getTime() - time.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1) return 'gerade eben';
        if (minutes < 60) return `vor ${minutes} Min`;
        if (hours < 24) return `vor ${hours} Std`;
        if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
        return time.toLocaleDateString('de-DE');
    }

    notifyNewAnfrage(anfrage) {
        this.addNotification('anfrage_neu', 'Neue Anfrage eingegangen',
            `Von: ${anfrage.kunde?.name || 'Unbekannt'}`,
            { entityType: 'anfrage', entityId: anfrage.id, link: `#anfragen/${anfrage.id}` });
    }

    notifyAngebotAccepted(angebot) {
        this.addNotification('angebot_akzeptiert', 'Angebot wurde akzeptiert',
            `Von: ${angebot.kunde?.name || 'Unbekannt'}`,
            { entityType: 'angebot', entityId: angebot.id, link: `#angebote/${angebot.id}` });
    }

    notifyRechnungOverdue(rechnung) {
        this.addNotification('rechnung_ueberfaellig', 'Rechnung ist \u00fcberf\u00e4llig',
            `Betrag: ${rechnung.brutto}\u20AC | Kunde: ${rechnung.kunde?.name || 'Unbekannt'}`,
            { entityType: 'rechnung', entityId: rechnung.id, link: `#rechnungen/${rechnung.id}` });
    }

    notifyRechnungPaid(rechnung) {
        this.addNotification('rechnung_bezahlt', 'Zahlung eingegangen',
            `Betrag: ${rechnung.brutto}\u20AC | Kunde: ${rechnung.kunde?.name || 'Unbekannt'}`,
            { entityType: 'rechnung', entityId: rechnung.id, link: `#rechnungen/${rechnung.id}` });
    }

    notifyTerminReminder(termin) {
        this.addNotification('termin_erinnerung', 'Termin in 30 Minuten',
            termin.beschreibung || 'Bitte bereite dich vor',
            { entityType: 'termin', entityId: termin.id, link: `#termine/${termin.id}` });
    }

    notifyAufgabeDue(aufgabe) {
        this.addNotification('aufgabe_faellig', 'Aufgabe f\u00e4llig',
            aufgabe.titel || 'Bitte bearbeite die Aufgabe',
            { entityType: 'aufgabe', entityId: aufgabe.id, link: `#aufgaben/${aufgabe.id}` });
    }

    notifySystem(message) {
        this.addNotification('system', 'System-Mitteilung', message);
    }

    updateUnreadCount() {
        this.unreadCount = this.notificationHistory.filter(n => !n.read).length;
        this.notifyListeners({ event: 'unread-count-updated', count: this.unreadCount });
    }

    notifyListeners(data) {
        this.listeners.forEach(callback => {
            try { callback(data); } catch { /* swallow */ }
        });
    }

    saveToStorage() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.notificationHistory)); }
        catch { /* swallow */ }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                this.notificationHistory = Array.isArray(parsed) ? parsed : [];
                this.updateUnreadCount();
            }
        } catch {
            this.notificationHistory = [];
        }
    }

    generateId() {
        return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
}

// ============================================
// Tests
// ============================================

describe('NotificationService', () => {
    let service;

    beforeEach(() => {
        // Clear localStorage store
        Object.keys(store).forEach(k => delete store[k]);
        vi.clearAllMocks();
        document.hidden = false;
        global.Notification.permission = 'granted';
        global.Notification.requestPermission = vi.fn(() => Promise.resolve('granted'));
        // Re-expose Notification on window for 'Notification' in window checks
        global.window.Notification = global.Notification;
        service = new NotificationService();
    });

    // ---- Constructor ----

    describe('constructor', () => {
        it('initializes with empty notificationHistory', () => {
            expect(service.notificationHistory).toEqual([]);
        });

        it('sets maxNotifications to 20', () => {
            expect(service.maxNotifications).toBe(20);
        });

        it('defines exactly 8 notification types', () => {
            expect(Object.keys(service.notificationTypes)).toHaveLength(8);
        });

        it('has the expected type keys', () => {
            const keys = Object.keys(service.notificationTypes);
            expect(keys).toContain('anfrage_neu');
            expect(keys).toContain('angebot_akzeptiert');
            expect(keys).toContain('angebot_vorlaeufig');
            expect(keys).toContain('rechnung_ueberfaellig');
            expect(keys).toContain('rechnung_bezahlt');
            expect(keys).toContain('termin_erinnerung');
            expect(keys).toContain('aufgabe_faellig');
            expect(keys).toContain('system');
        });

        it('sets storageKey to freyai-notifications', () => {
            expect(service.storageKey).toBe('freyai-notifications');
        });

        it('initializes unreadCount to 0', () => {
            expect(service.unreadCount).toBe(0);
        });

        it('initializes empty listeners array', () => {
            expect(service.listeners).toEqual([]);
        });

        it('loads existing notifications from localStorage on construction', () => {
            const preloaded = [{
                id: 'notif-pre-1', type: 'system', icon: '\u2699\uFE0F', color: '#6b7280',
                title: 'Preloaded', description: 'From storage',
                timestamp: new Date().toISOString(), read: false
            }];
            store['freyai-notifications'] = JSON.stringify(preloaded);
            const fresh = new NotificationService();
            expect(fresh.getNotifications()).toHaveLength(1);
            expect(fresh.getNotifications()[0].title).toBe('Preloaded');
            expect(fresh.getUnreadCount()).toBe(1);
        });
    });

    // ---- requestPermission ----

    describe('requestPermission()', () => {
        it('returns "denied" when Notification is not in window', async () => {
            delete global.window.Notification;
            const result = await service.requestPermission();
            expect(result).toBe('denied');
            // Restore for other tests
            global.window.Notification = global.Notification;
        });

        it('returns "granted" when Notification.permission is already granted', async () => {
            global.Notification.permission = 'granted';
            const result = await service.requestPermission();
            expect(result).toBe('granted');
            expect(global.Notification.requestPermission).not.toHaveBeenCalled();
        });

        it('calls Notification.requestPermission when permission is "default"', async () => {
            global.Notification.permission = 'default';
            global.Notification.requestPermission = vi.fn(() => Promise.resolve('granted'));
            const result = await service.requestPermission();
            expect(global.Notification.requestPermission).toHaveBeenCalled();
            expect(result).toBe('granted');
        });

        it('returns "denied" when permission is already "denied"', async () => {
            global.Notification.permission = 'denied';
            const result = await service.requestPermission();
            expect(result).toBe('denied');
        });

        it('returns "denied" when requestPermission throws', async () => {
            global.Notification.permission = 'default';
            global.Notification.requestPermission = vi.fn(() => Promise.reject(new Error('blocked')));
            const result = await service.requestPermission();
            expect(result).toBe('denied');
        });
    });

    // ---- sendNotification ----

    describe('sendNotification()', () => {
        it('does nothing when document is not hidden', () => {
            document.hidden = false;
            service.sendNotification('Test', { body: 'Hello' });
            expect(global.Notification).not.toHaveBeenCalled();
        });

        it('does nothing when Notification is not in window', () => {
            document.hidden = true;
            delete global.window.Notification;
            service.sendNotification('Test', { body: 'Hello' });
            expect(global.Notification).not.toHaveBeenCalled();
            global.window.Notification = global.Notification;
        });

        it('does nothing when permission is not granted', () => {
            document.hidden = true;
            global.Notification.permission = 'denied';
            service.sendNotification('Test', { body: 'Hello' });
            // Notification constructor should not be called as a constructor
            expect(global.Notification).not.toHaveBeenCalled();
        });

        it('creates a Notification when document is hidden and permission is granted', () => {
            document.hidden = true;
            global.Notification.permission = 'granted';
            service.sendNotification('Alert!', { body: 'Something happened' });
            expect(global.Notification).toHaveBeenCalledWith('Alert!', expect.objectContaining({
                icon: '/img/icon-192.png',
                badge: '/img/icon-96.png',
                body: 'Something happened'
            }));
        });
    });

    // ---- addNotification ----

    describe('addNotification()', () => {
        it('creates a notification with correct fields', () => {
            const n = service.addNotification('anfrage_neu', 'Test Title', 'Test body');
            expect(n).toBeDefined();
            expect(n.id).toMatch(/^notif-/);
            expect(n.type).toBe('anfrage_neu');
            expect(n.title).toBe('Test Title');
            expect(n.description).toBe('Test body');
            expect(n.read).toBe(false);
            expect(n.icon).toBe('\u{1F4E5}');
            expect(n.color).toBe('#3b82f6');
            expect(n.timestamp).toBeDefined();
        });

        it('uses the type label as description when none is provided', () => {
            const n = service.addNotification('system', 'System alert');
            expect(n.description).toBe('System-Mitteilung');
        });

        it('falls back to system type for unknown types', () => {
            const n = service.addNotification('unknown_type', 'Unknown');
            expect(n.icon).toBe('\u2699\uFE0F');
            expect(n.color).toBe('#6b7280');
        });

        it('adds notifications to the beginning of the history', () => {
            service.addNotification('system', 'First');
            service.addNotification('anfrage_neu', 'Second');
            const all = service.getNotifications();
            expect(all[0].title).toBe('Second');
            expect(all[1].title).toBe('First');
        });

        it('spreads metadata into the notification object', () => {
            const n = service.addNotification('system', 'Meta test', '', {
                entityType: 'rechnung',
                entityId: 'abc-123',
                link: '#rechnungen/abc-123'
            });
            expect(n.entityType).toBe('rechnung');
            expect(n.entityId).toBe('abc-123');
            expect(n.link).toBe('#rechnungen/abc-123');
        });

        it('sends browser notification when document.hidden is true', () => {
            document.hidden = true;
            global.Notification.permission = 'granted';
            service.addNotification('system', 'Background alert', 'Check this');
            expect(global.Notification).toHaveBeenCalledWith('Background alert', expect.objectContaining({
                body: 'Check this',
                tag: 'system'
            }));
        });

        it('does not send browser notification when document is visible', () => {
            document.hidden = false;
            service.addNotification('system', 'Foreground alert', 'No push');
            expect(global.Notification).not.toHaveBeenCalled();
        });

        it('notifies listeners when notification is added', () => {
            const cb = vi.fn();
            service.subscribe(cb);
            service.addNotification('system', 'Listener test');
            const addedEvent = cb.mock.calls.find(c => c[0].event === 'notification-added');
            expect(addedEvent).toBeDefined();
            expect(addedEvent[0].notification.title).toBe('Listener test');
        });

        it('saves to storage after adding', () => {
            service.addNotification('system', 'Storage test');
            expect(localStorage.setItem).toHaveBeenCalledWith('freyai-notifications', expect.any(String));
        });
    });

    // ---- Deduplication ----

    describe('deduplication', () => {
        it('returns existing notification for duplicate type+title within 60s', () => {
            const first = service.addNotification('system', 'Dup test', 'Body A');
            const second = service.addNotification('system', 'Dup test', 'Body B');
            expect(second.id).toBe(first.id);
            expect(service.getNotifications()).toHaveLength(1);
        });

        it('allows same title with different type', () => {
            service.addNotification('system', 'Same title');
            service.addNotification('anfrage_neu', 'Same title');
            expect(service.getNotifications()).toHaveLength(2);
        });

        it('allows duplicate after 60 seconds', () => {
            const first = service.addNotification('system', 'Timed');
            // Manually backdate the timestamp by 61 seconds
            first.timestamp = new Date(Date.now() - 61000).toISOString();
            const second = service.addNotification('system', 'Timed');
            expect(second.id).not.toBe(first.id);
            expect(service.getNotifications()).toHaveLength(2);
        });
    });

    // ---- Max 20 notifications ----

    describe('max notifications limit', () => {
        it('keeps only 20 notifications, removing oldest', () => {
            for (let i = 0; i < 25; i++) {
                service.addNotification('system', `Notification ${i}`);
            }
            const all = service.getNotifications();
            expect(all).toHaveLength(20);
            expect(all[0].title).toBe('Notification 24');
            expect(all[19].title).toBe('Notification 5');
        });
    });

    // ---- markAsRead ----

    describe('markAsRead()', () => {
        it('marks a specific notification as read', () => {
            const n = service.addNotification('system', 'Read test');
            expect(n.read).toBe(false);
            service.markAsRead(n.id);
            const found = service.getNotifications().find(x => x.id === n.id);
            expect(found.read).toBe(true);
        });

        it('does nothing for non-existent ID', () => {
            service.addNotification('system', 'Exists');
            service.markAsRead('does-not-exist');
            expect(service.getUnreadCount()).toBe(1);
        });

        it('updates unread count after marking as read', () => {
            const n1 = service.addNotification('system', 'A');
            service.addNotification('anfrage_neu', 'B');
            expect(service.getUnreadCount()).toBe(2);
            service.markAsRead(n1.id);
            expect(service.getUnreadCount()).toBe(1);
        });

        it('saves to storage after marking as read', () => {
            const n = service.addNotification('system', 'Save on read');
            vi.clearAllMocks();
            service.markAsRead(n.id);
            expect(localStorage.setItem).toHaveBeenCalled();
        });

        it('notifies listeners with notification-read event', () => {
            const n = service.addNotification('system', 'Sub read');
            const cb = vi.fn();
            service.subscribe(cb);
            service.markAsRead(n.id);
            const readEvent = cb.mock.calls.find(c => c[0].event === 'notification-read');
            expect(readEvent).toBeDefined();
            expect(readEvent[0].notificationId).toBe(n.id);
        });
    });

    // ---- markAllAsRead ----

    describe('markAllAsRead()', () => {
        it('marks all notifications as read', () => {
            service.addNotification('system', 'One');
            service.addNotification('anfrage_neu', 'Two');
            service.addNotification('rechnung_ueberfaellig', 'Three');
            expect(service.getUnreadCount()).toBe(3);
            service.markAllAsRead();
            expect(service.getUnreadCount()).toBe(0);
            service.getNotifications().forEach(n => expect(n.read).toBe(true));
        });

        it('notifies listeners with all-marked-read event', () => {
            service.addNotification('system', 'All read');
            const cb = vi.fn();
            service.subscribe(cb);
            service.markAllAsRead();
            const event = cb.mock.calls.find(c => c[0].event === 'all-marked-read');
            expect(event).toBeDefined();
        });
    });

    // ---- deleteNotification ----

    describe('deleteNotification()', () => {
        it('removes a notification by ID', () => {
            const n = service.addNotification('system', 'To delete');
            expect(service.getNotifications()).toHaveLength(1);
            service.deleteNotification(n.id);
            expect(service.getNotifications()).toHaveLength(0);
        });

        it('does nothing for non-existent ID', () => {
            service.addNotification('system', 'Keep me');
            service.deleteNotification('nope');
            expect(service.getNotifications()).toHaveLength(1);
        });

        it('updates unread count after deletion', () => {
            const n = service.addNotification('system', 'Delete me');
            expect(service.getUnreadCount()).toBe(1);
            service.deleteNotification(n.id);
            expect(service.getUnreadCount()).toBe(0);
        });

        it('notifies listeners with notification-deleted event', () => {
            const n = service.addNotification('system', 'Del event');
            const cb = vi.fn();
            service.subscribe(cb);
            service.deleteNotification(n.id);
            const event = cb.mock.calls.find(c => c[0].event === 'notification-deleted');
            expect(event).toBeDefined();
            expect(event[0].notificationId).toBe(n.id);
        });
    });

    // ---- clearAll ----

    describe('clearAll()', () => {
        it('removes all notifications', () => {
            service.addNotification('system', 'A');
            service.addNotification('anfrage_neu', 'B');
            service.clearAll();
            expect(service.getNotifications()).toHaveLength(0);
            expect(service.getUnreadCount()).toBe(0);
        });

        it('saves empty array to storage', () => {
            service.addNotification('system', 'Before clear');
            vi.clearAllMocks();
            service.clearAll();
            expect(localStorage.setItem).toHaveBeenCalled();
            const saved = JSON.parse(store['freyai-notifications']);
            expect(saved).toHaveLength(0);
        });

        it('notifies listeners with all-cleared event', () => {
            service.addNotification('system', 'Clear event');
            const cb = vi.fn();
            service.subscribe(cb);
            service.clearAll();
            const event = cb.mock.calls.find(c => c[0].event === 'all-cleared');
            expect(event).toBeDefined();
        });
    });

    // ---- getNotifications ----

    describe('getNotifications()', () => {
        it('returns the full notification array', () => {
            service.addNotification('system', 'Alpha');
            service.addNotification('anfrage_neu', 'Beta');
            const all = service.getNotifications();
            expect(all).toHaveLength(2);
            expect(all[0].title).toBe('Beta');
            expect(all[1].title).toBe('Alpha');
        });

        it('returns empty array when no notifications exist', () => {
            expect(service.getNotifications()).toEqual([]);
        });
    });

    // ---- getUnreadCount ----

    describe('getUnreadCount()', () => {
        it('returns 0 when empty', () => {
            expect(service.getUnreadCount()).toBe(0);
        });

        it('counts only unread notifications', () => {
            const n1 = service.addNotification('system', 'Unread 1');
            service.addNotification('anfrage_neu', 'Unread 2');
            service.markAsRead(n1.id);
            expect(service.getUnreadCount()).toBe(1);
        });
    });

    // ---- subscribe / unsubscribe ----

    describe('subscribe()', () => {
        it('adds listener and calls it on events', () => {
            const cb = vi.fn();
            service.subscribe(cb);
            service.addNotification('system', 'Event test');
            expect(cb).toHaveBeenCalled();
        });

        it('returns an unsubscribe function that removes the listener', () => {
            const cb = vi.fn();
            const unsub = service.subscribe(cb);
            unsub();
            service.addNotification('system', 'After unsub');
            const addedEvent = cb.mock.calls.find(c => c[0]?.event === 'notification-added');
            expect(addedEvent).toBeUndefined();
        });

        it('unsubscribe is idempotent (calling twice does not break)', () => {
            const cb = vi.fn();
            const unsub = service.subscribe(cb);
            unsub();
            unsub(); // second call should not throw
            expect(service.listeners).toHaveLength(0);
        });

        it('handles listener errors gracefully without breaking other listeners', () => {
            const badCb = vi.fn(() => { throw new Error('boom'); });
            const goodCb = vi.fn();
            service.subscribe(badCb);
            service.subscribe(goodCb);
            service.addNotification('system', 'Error resilience');
            expect(goodCb).toHaveBeenCalled();
        });
    });

    // ---- getRelativeTime ----

    describe('getRelativeTime()', () => {
        it('returns "gerade eben" for timestamps less than 1 minute ago', () => {
            const ts = new Date().toISOString();
            expect(service.getRelativeTime(ts)).toBe('gerade eben');
        });

        it('returns "vor X Min" for timestamps a few minutes ago', () => {
            const ts = new Date(Date.now() - 5 * 60000).toISOString();
            expect(service.getRelativeTime(ts)).toBe('vor 5 Min');
        });

        it('returns "vor X Std" for timestamps a few hours ago', () => {
            const ts = new Date(Date.now() - 3 * 3600000).toISOString();
            expect(service.getRelativeTime(ts)).toBe('vor 3 Std');
        });

        it('returns "vor 1 Tag" for 1 day ago', () => {
            const ts = new Date(Date.now() - 1 * 86400000).toISOString();
            expect(service.getRelativeTime(ts)).toBe('vor 1 Tag');
        });

        it('returns "vor X Tagen" for multiple days ago', () => {
            const ts = new Date(Date.now() - 4 * 86400000).toISOString();
            expect(service.getRelativeTime(ts)).toBe('vor 4 Tagen');
        });

        it('returns a formatted date for timestamps older than 7 days', () => {
            const ts = new Date(Date.now() - 10 * 86400000).toISOString();
            const result = service.getRelativeTime(ts);
            expect(result).toMatch(/\d{1,2}\.\d{1,2}\.\d{4}/);
        });
    });

    // ---- Named notification helpers ----

    describe('notifyNewAnfrage()', () => {
        it('creates an anfrage_neu notification with entity metadata', () => {
            service.notifyNewAnfrage({ id: 'a-1', kunde: { name: 'Meier GmbH' } });
            const n = service.getNotifications()[0];
            expect(n.type).toBe('anfrage_neu');
            expect(n.title).toBe('Neue Anfrage eingegangen');
            expect(n.description).toContain('Meier GmbH');
            expect(n.entityType).toBe('anfrage');
            expect(n.entityId).toBe('a-1');
            expect(n.link).toBe('#anfragen/a-1');
        });

        it('uses "Unbekannt" when kunde is missing', () => {
            service.notifyNewAnfrage({ id: 'a-2' });
            expect(service.getNotifications()[0].description).toContain('Unbekannt');
        });
    });

    describe('notifyAngebotAccepted()', () => {
        it('creates an angebot_akzeptiert notification', () => {
            service.notifyAngebotAccepted({ id: 'ag-1', kunde: { name: 'Schmidt' } });
            const n = service.getNotifications()[0];
            expect(n.type).toBe('angebot_akzeptiert');
            expect(n.description).toContain('Schmidt');
            expect(n.link).toBe('#angebote/ag-1');
        });
    });

    describe('notifyRechnungOverdue()', () => {
        it('creates a rechnung_ueberfaellig notification with amount', () => {
            service.notifyRechnungOverdue({ id: 'r-1', brutto: 1500, kunde: { name: 'Huber' } });
            const n = service.getNotifications()[0];
            expect(n.type).toBe('rechnung_ueberfaellig');
            expect(n.description).toContain('1500');
            expect(n.description).toContain('Huber');
            expect(n.entityType).toBe('rechnung');
        });
    });

    describe('notifyRechnungPaid()', () => {
        it('creates a rechnung_bezahlt notification', () => {
            service.notifyRechnungPaid({ id: 'r-2', brutto: 800, kunde: { name: 'Bauer' } });
            const n = service.getNotifications()[0];
            expect(n.type).toBe('rechnung_bezahlt');
            expect(n.title).toBe('Zahlung eingegangen');
            expect(n.description).toContain('800');
        });
    });

    describe('notifyTerminReminder()', () => {
        it('creates a termin_erinnerung notification', () => {
            service.notifyTerminReminder({ id: 't-1', beschreibung: 'Kundentermin bei Firma X' });
            const n = service.getNotifications()[0];
            expect(n.type).toBe('termin_erinnerung');
            expect(n.description).toBe('Kundentermin bei Firma X');
            expect(n.link).toBe('#termine/t-1');
        });

        it('uses fallback description when beschreibung is missing', () => {
            service.notifyTerminReminder({ id: 't-2' });
            expect(service.getNotifications()[0].description).toBe('Bitte bereite dich vor');
        });
    });

    describe('notifyAufgabeDue()', () => {
        it('creates an aufgabe_faellig notification', () => {
            service.notifyAufgabeDue({ id: 'au-1', titel: 'Material bestellen' });
            const n = service.getNotifications()[0];
            expect(n.type).toBe('aufgabe_faellig');
            expect(n.description).toBe('Material bestellen');
            expect(n.entityType).toBe('aufgabe');
        });

        it('uses fallback description when titel is missing', () => {
            service.notifyAufgabeDue({ id: 'au-2' });
            expect(service.getNotifications()[0].description).toBe('Bitte bearbeite die Aufgabe');
        });
    });

    describe('notifySystem()', () => {
        it('creates a system notification with the given message', () => {
            service.notifySystem('Wartung um 22 Uhr');
            const n = service.getNotifications()[0];
            expect(n.type).toBe('system');
            expect(n.title).toBe('System-Mitteilung');
            expect(n.description).toBe('Wartung um 22 Uhr');
        });
    });

    // ---- loadFromStorage ----

    describe('loadFromStorage()', () => {
        it('parses valid JSON array from localStorage', () => {
            const data = [{ id: 'notif-1', type: 'system', title: 'Stored', read: false, timestamp: new Date().toISOString() }];
            store['freyai-notifications'] = JSON.stringify(data);
            const fresh = new NotificationService();
            expect(fresh.getNotifications()).toHaveLength(1);
            expect(fresh.getNotifications()[0].title).toBe('Stored');
        });

        it('handles invalid JSON gracefully', () => {
            store['freyai-notifications'] = 'not-json!!!';
            const fresh = new NotificationService();
            expect(fresh.getNotifications()).toHaveLength(0);
        });

        it('handles non-array data gracefully', () => {
            store['freyai-notifications'] = JSON.stringify({ not: 'an array' });
            const fresh = new NotificationService();
            expect(fresh.getNotifications()).toHaveLength(0);
        });

        it('handles null/missing localStorage data', () => {
            // store has no key, getItem returns null
            const fresh = new NotificationService();
            expect(fresh.getNotifications()).toHaveLength(0);
        });
    });

    // ---- saveToStorage ----

    describe('saveToStorage()', () => {
        it('stringifies notifications to localStorage', () => {
            service.addNotification('system', 'Persist test');
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai-notifications',
                expect.any(String)
            );
            const saved = JSON.parse(store['freyai-notifications']);
            expect(saved).toHaveLength(1);
            expect(saved[0].title).toBe('Persist test');
        });

        it('saves updated state after deleteNotification', () => {
            const n = service.addNotification('system', 'Will delete');
            vi.clearAllMocks();
            service.deleteNotification(n.id);
            expect(localStorage.setItem).toHaveBeenCalled();
        });
    });

    // ---- generateId ----

    describe('generateId()', () => {
        it('starts with "notif-"', () => {
            const id = service.generateId();
            expect(id).toMatch(/^notif-/);
        });

        it('generates unique IDs', () => {
            const ids = new Set();
            for (let i = 0; i < 50; i++) {
                ids.add(service.generateId());
            }
            expect(ids.size).toBe(50);
        });
    });
});
