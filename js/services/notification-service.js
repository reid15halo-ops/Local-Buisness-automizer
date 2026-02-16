/* ============================================
   Notification Service
   Browser push notifications and in-app notification center
   ============================================ */

class NotificationService {
    constructor() {
        this.notificationHistory = [];
        this.maxNotifications = 20;
        this.notificationTypes = {
            anfrage_neu: { icon: '📥', color: '#3b82f6', label: 'Neue Anfrage eingegangen' },
            angebot_akzeptiert: { icon: '✅', color: '#10b981', label: 'Angebot wurde akzeptiert' },
            rechnung_ueberfaellig: { icon: '⚠️', color: '#ef4444', label: 'Rechnung ist überfällig' },
            rechnung_bezahlt: { icon: '💰', color: '#10b981', label: 'Zahlung eingegangen' },
            termin_erinnerung: { icon: '⏰', color: '#f59e0b', label: 'Termin in 30 Minuten' },
            aufgabe_faellig: { icon: '✏️', color: '#f59e0b', label: 'Aufgabe fällig' },
            system: { icon: '⚙️', color: '#6b7280', label: 'System-Mitteilung' }
        };

        this.storageKey = 'mhs-notifications';
        this.unreadCount = 0;
        this.listeners = [];

        // Load notifications from localStorage
        this.loadFromStorage();

        // Subscribe to store changes if available
        if (window.storeService) {
            window.storeService.subscribe(() => {
                this.checkForStoreChanges();
            });
        }
    }

    /**
     * Request browser notification permission from the user
     * @returns {Promise<string>} 'granted', 'denied', or 'default'
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('This browser does not support desktop notifications');
            return 'denied';
        }

        if (Notification.permission === 'granted') {
            return 'granted';
        }

        if (Notification.permission !== 'denied') {
            try {
                const permission = await Notification.requestPermission();
                console.log(`Notification permission: ${permission}`);
                return permission;
            } catch (error) {
                console.error('Failed to request notification permission:', error);
                return 'denied';
            }
        }

        return Notification.permission;
    }

    /**
     * Send a browser push notification if app is in background
     * @param {string} title - Notification title
     * @param {Object} options - Notification options (body, icon, tag, etc.)
     */
    sendNotification(title, options = {}) {
        if (!('Notification' in window)) {
            return;
        }

        // Only send push notification if app is in background
        if (!document.hidden && Notification.permission !== 'granted') {
            return;
        }

        if (Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    icon: '/img/icon-192.png',
                    badge: '/img/icon-96.png',
                    ...options
                });
            } catch (error) {
                console.error('Failed to send notification:', error);
            }
        }
    }

    /**
     * Add a notification to the notification center
     * @param {string} type - Notification type (see notificationTypes)
     * @param {string} title - Notification title
     * @param {string} description - Longer description
     * @param {Object} metadata - Additional metadata (entityId, link, etc.)
     */
    addNotification(type, title, description = '', metadata = {}) {
        const notificationType = this.notificationTypes[type] || this.notificationTypes.system;

        const notification = {
            id: this.generateId(),
            type,
            icon: notificationType.icon,
            color: notificationType.color,
            title,
            description: description || notificationType.label,
            timestamp: new Date().toISOString(),
            read: false,
            ...metadata
        };

        // Add to beginning of array
        this.notificationHistory.unshift(notification);

        // Keep only last 20 notifications
        if (this.notificationHistory.length > this.maxNotifications) {
            this.notificationHistory = this.notificationHistory.slice(0, this.maxNotifications);
        }

        // Update unread count
        this.updateUnreadCount();

        // Save to localStorage
        this.saveToStorage();

        // Notify listeners
        this.notifyListeners({
            event: 'notification-added',
            notification
        });

        // Send browser push notification
        if (document.hidden) {
            this.sendNotification(title, {
                body: description || notificationType.label,
                tag: type
            });
        }

        return notification;
    }

    /**
     * Mark a notification as read
     * @param {string} notificationId - ID of the notification
     */
    markAsRead(notificationId) {
        const notification = this.notificationHistory.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.updateUnreadCount();
            this.saveToStorage();
            this.notifyListeners({
                event: 'notification-read',
                notificationId
            });
        }
    }

    /**
     * Mark all notifications as read
     */
    markAllAsRead() {
        this.notificationHistory.forEach(n => {
            n.read = true;
        });
        this.updateUnreadCount();
        this.saveToStorage();
        this.notifyListeners({
            event: 'all-marked-read'
        });
    }

    /**
     * Delete a notification
     * @param {string} notificationId - ID of the notification
     */
    deleteNotification(notificationId) {
        const index = this.notificationHistory.findIndex(n => n.id === notificationId);
        if (index !== -1) {
            this.notificationHistory.splice(index, 1);
            this.updateUnreadCount();
            this.saveToStorage();
            this.notifyListeners({
                event: 'notification-deleted',
                notificationId
            });
        }
    }

    /**
     * Clear all notifications
     */
    clearAll() {
        this.notificationHistory = [];
        this.updateUnreadCount();
        this.saveToStorage();
        this.notifyListeners({
            event: 'all-cleared'
        });
    }

    /**
     * Get all notifications
     * @returns {Array} Array of notifications
     */
    getNotifications() {
        return this.notificationHistory;
    }

    /**
     * Get unread notification count
     * @returns {number} Count of unread notifications
     */
    getUnreadCount() {
        return this.unreadCount;
    }

    /**
     * Subscribe to notification changes
     * @param {Function} callback - Callback function
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index !== -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Get relative time string in German
     * @param {string} timestamp - ISO timestamp string
     * @returns {string} Relative time like "vor 5 Min"
     */
    getRelativeTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now.getTime() - time.getTime();

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) {return 'gerade eben';}
        if (minutes < 60) {return `vor ${minutes} Min`;}
        if (hours < 24) {return `vor ${hours} Std`;}
        if (days < 7) {return `vor ${days} Tag${days > 1 ? 'en' : ''}`;}

        return time.toLocaleDateString('de-DE');
    }

    // ===== Store Change Detection =====

    /**
     * Check for store changes and trigger appropriate notifications
     * (This would be called periodically or when store changes)
     */
    checkForStoreChanges() {
        // This method is called by store subscribers
        // Individual check methods can be called when specific actions happen
    }

    /**
     * Trigger notification for new Anfrage
     * @param {Object} anfrage - The inquiry object
     */
    notifyNewAnfrage(anfrage) {
        this.addNotification(
            'anfrage_neu',
            'Neue Anfrage eingegangen',
            `Von: ${anfrage.kunde?.name || 'Unbekannt'}`,
            {
                entityType: 'anfrage',
                entityId: anfrage.id,
                link: `#anfragen/${anfrage.id}`
            }
        );
    }

    /**
     * Trigger notification for accepted offer
     * @param {Object} angebot - The offer object
     */
    notifyAngebotAccepted(angebot) {
        this.addNotification(
            'angebot_akzeptiert',
            'Angebot wurde akzeptiert',
            `Von: ${angebot.kunde?.name || 'Unbekannt'}`,
            {
                entityType: 'angebot',
                entityId: angebot.id,
                link: `#angebote/${angebot.id}`
            }
        );
    }

    /**
     * Trigger notification for overdue invoice
     * @param {Object} rechnung - The invoice object
     */
    notifyRechnungOverdue(rechnung) {
        this.addNotification(
            'rechnung_ueberfaellig',
            'Rechnung ist überfällig',
            `Betrag: ${rechnung.brutto}€ | Kunde: ${rechnung.kunde?.name || 'Unbekannt'}`,
            {
                entityType: 'rechnung',
                entityId: rechnung.id,
                link: `#rechnungen/${rechnung.id}`
            }
        );
    }

    /**
     * Trigger notification for paid invoice
     * @param {Object} rechnung - The invoice object
     */
    notifyRechnungPaid(rechnung) {
        this.addNotification(
            'rechnung_bezahlt',
            'Zahlung eingegangen',
            `Betrag: ${rechnung.brutto}€ | Kunde: ${rechnung.kunde?.name || 'Unbekannt'}`,
            {
                entityType: 'rechnung',
                entityId: rechnung.id,
                link: `#rechnungen/${rechnung.id}`
            }
        );
    }

    /**
     * Trigger notification for upcoming appointment
     * @param {Object} termin - The appointment object
     */
    notifyTerminReminder(termin) {
        this.addNotification(
            'termin_erinnerung',
            'Termin in 30 Minuten',
            termin.beschreibung || 'Bitte bereite dich vor',
            {
                entityType: 'termin',
                entityId: termin.id,
                link: `#termine/${termin.id}`
            }
        );
    }

    /**
     * Trigger notification for due task
     * @param {Object} aufgabe - The task object
     */
    notifyAufgabeDue(aufgabe) {
        this.addNotification(
            'aufgabe_faellig',
            'Aufgabe fällig',
            aufgabe.titel || 'Bitte bearbeite die Aufgabe',
            {
                entityType: 'aufgabe',
                entityId: aufgabe.id,
                link: `#aufgaben/${aufgabe.id}`
            }
        );
    }

    /**
     * Trigger system notification
     * @param {string} message - The system message
     */
    notifySystem(message) {
        this.addNotification(
            'system',
            'System-Mitteilung',
            message
        );
    }

    // ===== Private Methods =====

    /**
     * Update unread notification count
     * @private
     */
    updateUnreadCount() {
        this.unreadCount = this.notificationHistory.filter(n => !n.read).length;
        this.notifyListeners({
            event: 'unread-count-updated',
            count: this.unreadCount
        });
    }

    /**
     * Notify all listeners of changes
     * @private
     */
    notifyListeners(data) {
        this.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Notification listener error:', error);
            }
        });
    }

    /**
     * Save notifications to localStorage
     * @private
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.notificationHistory));
        } catch (error) {
            console.error('Failed to save notifications to localStorage:', error);
        }
    }

    /**
     * Load notifications from localStorage
     * @private
     */
    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                this.notificationHistory = JSON.parse(data);
                this.updateUnreadCount();
            }
        } catch (error) {
            console.error('Failed to load notifications from localStorage:', error);
            this.notificationHistory = [];
        }
    }

    /**
     * Generate unique notification ID
     * @private
     */
    generateId() {
        return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Initialize as global singleton
window.notificationService = new NotificationService();
