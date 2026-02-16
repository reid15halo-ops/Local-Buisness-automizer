/* ============================================
   Activity Indicator Service
   Smart visual indicators for sidebar navigation
   ============================================ */

class ActivityIndicatorService {
    constructor() {
        this.updateInterval = 30000; // Update every 30 seconds
        this.intervalId = null;
        this.initCSS();
        this.subscribe();
    }

    /**
     * Initialize CSS styles for indicators
     */
    initCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Badge styling for nav items */
            .nav-item .badge {
                position: absolute;
                top: -8px;
                right: -8px;
                background: var(--accent-primary);
                color: white;
                font-size: 10px;
                font-weight: 700;
                padding: 3px 6px;
                border-radius: 50%;
                min-width: 22px;
                height: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 0 2px var(--bg-sidebar);
                transition: all 0.3s ease;
            }

            .nav-item .badge.badge-danger {
                background: var(--accent-danger);
                animation: pulse-red 2s infinite;
            }

            .nav-item .badge.badge-warning {
                background: var(--accent-warning);
                animation: pulse-amber 2s infinite;
            }

            .nav-item .badge.badge-info {
                background: var(--accent-info);
                animation: pulse-blue 2s infinite;
            }

            .nav-item .badge.badge-success {
                background: var(--accent-success);
            }

            /* Glow animations */
            @keyframes pulse-red {
                0%, 100% {
                    box-shadow: 0 0 0 2px var(--bg-sidebar), 0 0 10px var(--accent-danger);
                    opacity: 1;
                }
                50% {
                    box-shadow: 0 0 0 2px var(--bg-sidebar), 0 0 20px var(--accent-danger);
                    opacity: 0.8;
                }
            }

            @keyframes pulse-amber {
                0%, 100% {
                    box-shadow: 0 0 0 2px var(--bg-sidebar), 0 0 10px var(--accent-warning);
                    opacity: 1;
                }
                50% {
                    box-shadow: 0 0 0 2px var(--bg-sidebar), 0 0 20px var(--accent-warning);
                    opacity: 0.8;
                }
            }

            @keyframes pulse-blue {
                0%, 100% {
                    box-shadow: 0 0 0 2px var(--bg-sidebar), 0 0 10px var(--accent-info);
                    opacity: 1;
                }
                50% {
                    box-shadow: 0 0 0 2px var(--bg-sidebar), 0 0 20px var(--accent-info);
                    opacity: 0.8;
                }
            }

            /* Was steht an? Card */
            .priority-actions-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 24px;
                margin-bottom: 24px;
                overflow: hidden;
            }

            .priority-actions-card.has-urgent {
                border-left: 4px solid var(--accent-danger);
            }

            .priority-actions-card h2 {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .priority-actions-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .priority-action-item {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 12px;
                background: var(--bg-hover);
                border-radius: var(--border-radius-sm);
                border-left: 3px solid var(--accent-primary);
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid var(--border-color);
                border-left: 3px solid var(--accent-primary);
            }

            .priority-action-item:hover {
                background: #2a2a32;
                transform: translateX(4px);
            }

            .priority-action-item.danger {
                border-left-color: var(--accent-danger);
            }

            .priority-action-item.danger:hover {
                background: rgba(239, 68, 68, 0.1);
            }

            .priority-action-item.warning {
                border-left-color: var(--accent-warning);
            }

            .priority-action-item.warning:hover {
                background: rgba(245, 158, 11, 0.1);
            }

            .priority-action-item.info {
                border-left-color: var(--accent-info);
            }

            .priority-action-item.info:hover {
                background: rgba(59, 130, 246, 0.1);
            }

            .priority-action-icon {
                font-size: 20px;
                flex-shrink: 0;
            }

            .priority-action-content {
                flex: 1;
            }

            .priority-action-text {
                font-size: 14px;
                color: var(--text-primary);
                margin-bottom: 4px;
                font-weight: 500;
            }

            .priority-action-detail {
                font-size: 12px;
                color: var(--text-muted);
            }

            .priority-action-time {
                font-size: 11px;
                color: var(--text-muted);
                margin-top: 4px;
            }

            .priority-actions-empty {
                text-align: center;
                padding: 32px 16px;
                color: var(--text-muted);
                font-size: 14px;
            }

            .priority-actions-empty-icon {
                font-size: 36px;
                margin-bottom: 12px;
                opacity: 0.5;
            }

            /* Adjust nav item position for badges */
            .nav-item {
                position: relative;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Subscribe to store changes
     */
    subscribe() {
        if (window.storeService) {
            window.storeService.subscribe(() => {
                this.update();
            });
        }
        // Initial update
        this.update();
        // Periodic updates
        this.intervalId = setInterval(() => this.update(), this.updateInterval);
    }

    /**
     * Main update function
     */
    update() {
        if (!window.storeService) return;

        const state = window.storeService.state;

        // Update badges
        this.updateBadges(state);

        // Update priority actions card
        this.updatePriorityActionsCard(state);
    }

    /**
     * Update badge counts on nav items
     */
    updateBadges(state) {
        // Anfragen: Count of new/unread inquiries
        const newAnfragen = (state.anfragen || []).filter(a => a.status === 'neu').length;
        this.updateBadge('anfragen', newAnfragen, newAnfragen > 0 ? 'badge-warning' : '');

        // Angebote: Count of draft quotes
        const draftAngebote = (state.angebote || []).filter(a => a.status === 'entwurf').length;
        this.updateBadge('angebote', draftAngebote, draftAngebote > 0 ? 'badge-info' : '');

        // Aufträge: Count of active orders
        const activeAuftraege = (state.auftraege || []).filter(a =>
            a.status === 'in_bearbeitung' || a.status === 'aktiv'
        ).length;
        this.updateBadge('auftraege', activeAuftraege, activeAuftraege > 0 ? 'badge-info' : '');

        // Rechnungen: Count of overdue invoices
        const overdueRechnungen = this.getOverdueInvoiceCount(state);
        this.updateBadge('rechnungen', overdueRechnungen, overdueRechnungen > 0 ? 'badge-danger' : '');

        // Aufgaben: Count of tasks due today or overdue
        const urgentAufgaben = this.getUrgentTaskCount(state);
        this.updateBadge('aufgaben', urgentAufgaben, urgentAufgaben > 0 ? 'badge-warning' : '');

        // Mahnwesen: Overdue invoices (monitoring)
        this.updateBadge('mahnwesen', overdueRechnungen, overdueRechnungen > 0 ? 'badge-danger' : '');
    }

    /**
     * Update a single badge
     */
    updateBadge(view, count, badgeClass) {
        const badgeEl = document.getElementById(`${view}-badge`);
        if (!badgeEl) return;

        // Remove previous badge classes
        badgeEl.className = 'badge';

        if (count > 0) {
            badgeEl.textContent = count > 99 ? '99+' : count;
            badgeEl.style.display = 'flex';
            if (badgeClass) {
                badgeEl.classList.add(badgeClass);
            }
        } else {
            badgeEl.style.display = 'none';
        }
    }

    /**
     * Calculate overdue invoice count
     */
    getOverdueInvoiceCount(state) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return (state.rechnungen || []).filter(r => {
            if (r.status === 'bezahlt' || r.status === 'storniert') return false;

            // Check if overdue based on zahlungsziel or status
            if (r.status === 'überfällig') return true;

            // Check zahlungsziel if it exists
            if (r.zahlungsziel) {
                const deadline = new Date(r.zahlungsziel);
                deadline.setHours(0, 0, 0, 0);
                return deadline < today;
            }

            // Check createdAt + 30 days default payment term
            if (r.createdAt) {
                const created = new Date(r.createdAt);
                const dueDate = new Date(created);
                dueDate.setDate(dueDate.getDate() + 30);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate < today;
            }

            return false;
        }).length;
    }

    /**
     * Calculate urgent task count (due today or overdue)
     */
    getUrgentTaskCount(state) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // If tasks array doesn't exist, estimate from orders
        if (!state.aufgaben || state.aufgaben.length === 0) {
            // Approximate urgent tasks from order deadlines
            return (state.auftraege || []).filter(a => {
                if (!a.deadline) return false;
                const deadline = new Date(a.deadline);
                deadline.setHours(0, 0, 0, 0);
                return deadline <= today;
            }).length;
        }

        return (state.aufgaben || []).filter(task => {
            if (task.completed) return false;
            if (!task.dueDate) return false;

            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate <= today;
        }).length;
    }

    /**
     * Update priority actions card on dashboard
     */
    updatePriorityActionsCard(state) {
        const dashboard = document.getElementById('view-dashboard');
        if (!dashboard) return;

        let card = dashboard.querySelector('.priority-actions-card');
        if (!card) {
            // Create the card if it doesn't exist
            const quickActions = dashboard.querySelector('.quick-actions');
            if (!quickActions) return;

            card = document.createElement('div');
            card.className = 'priority-actions-card';
            quickActions.insertAdjacentElement('afterend', card);
        }

        // Generate priority actions
        const actions = this.generatePriorityActions(state);

        // Update card content
        let html = '<h2>❓ Was steht an?</h2>';

        if (actions.length === 0) {
            html += '<div class="priority-actions-empty"><div class="priority-actions-empty-icon">✨</div>Alles unter Kontrolle! Keine dringenden Aufgaben.</div>';
            card.classList.remove('has-urgent');
        } else {
            const hasUrgent = actions.some(a => a.severity === 'danger');
            if (hasUrgent) {
                card.classList.add('has-urgent');
            } else {
                card.classList.remove('has-urgent');
            }

            html += '<div class="priority-actions-list">';
            actions.forEach(action => {
                html += `
                    <div class="priority-action-item ${action.severity}" data-action="${action.action}" data-view="${action.view}">
                        <div class="priority-action-icon">${action.icon}</div>
                        <div class="priority-action-content">
                            <div class="priority-action-text">${action.text}</div>
                            <div class="priority-action-detail">${action.detail}</div>
                            <div class="priority-action-time">${action.time}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        card.innerHTML = html;

        // Add click handlers
        card.querySelectorAll('.priority-action-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                const action = item.dataset.action;
                if (view) {
                    // Navigate to view
                    const navBtn = document.querySelector(`[data-view="${view}"]`);
                    if (navBtn) {
                        navBtn.click();
                    }
                }
                if (action) {
                    // Execute specific action if defined
                    this.executeAction(action, state);
                }
            });
        });
    }

    /**
     * Generate priority action items
     */
    generatePriorityActions(state) {
        const actions = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Overdue invoices (red - danger)
        const overdueInvoices = (state.rechnungen || []).filter(r => {
            if (r.status === 'bezahlt' || r.status === 'storniert') return false;
            if (r.status === 'überfällig') return true;

            if (r.zahlungsziel) {
                const deadline = new Date(r.zahlungsziel);
                deadline.setHours(0, 0, 0, 0);
                return deadline < today;
            }

            if (r.createdAt) {
                const created = new Date(r.createdAt);
                const dueDate = new Date(created);
                dueDate.setDate(dueDate.getDate() + 30);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate < today;
            }

            return false;
        });

        if (overdueInvoices.length > 0) {
            const invoice = overdueInvoices[0];
            const daysOverdue = this.calculateDaysOverdue(invoice, today);
            actions.push({
                icon: '🔴',
                text: `Rechnung ${invoice.id} ist überfällig`,
                detail: `${daysOverdue} Tag(e) überfällig • ${invoice.kunde.name}`,
                time: `Betrag: ${this.formatCurrency(invoice.brutto || 0)}`,
                severity: 'danger',
                view: 'rechnungen',
                action: null
            });
        }

        // 2. New inquiries waiting >24h (amber - warning)
        const oldNewInquiries = (state.anfragen || []).filter(a => {
            if (a.status !== 'neu') return false;
            if (!a.createdAt) return false;
            const created = new Date(a.createdAt);
            const hoursAgo = (today - created) / (1000 * 60 * 60);
            return hoursAgo > 24;
        });

        if (oldNewInquiries.length > 0) {
            actions.push({
                icon: '🟠',
                text: `${oldNewInquiries.length} Anfrage(n) warten auf Bearbeitung`,
                detail: `Älteste seit ${this.getRelativeTime(oldNewInquiries[0].createdAt)}`,
                time: oldNewInquiries.map(a => a.kunde.name).slice(0, 2).join(', ') + (oldNewInquiries.length > 2 ? '...' : ''),
                severity: 'warning',
                view: 'anfragen',
                action: null
            });
        }

        // 3. New inquiries (recent) (blue - info)
        const newInquiries = (state.anfragen || []).filter(a => {
            if (a.status !== 'neu') return false;
            if (!a.createdAt) return false;
            const created = new Date(a.createdAt);
            const hoursAgo = (today - created) / (1000 * 60 * 60);
            return hoursAgo <= 24;
        });

        if (newInquiries.length > 0) {
            actions.push({
                icon: '📥',
                text: `${newInquiries.length} neue Anfrage(n)`,
                detail: `Gerade eingegangen • ${newInquiries[0].kunde.name}`,
                time: this.getRelativeTime(newInquiries[0].createdAt),
                severity: 'info',
                view: 'anfragen',
                action: null
            });
        }

        // 4. Orders near deadline (blue - info)
        const nearDeadline = (state.auftraege || []).filter(a => {
            if (!a.deadline) return false;
            const deadline = new Date(a.deadline);
            const daysUntil = (deadline - today) / (1000 * 60 * 60 * 24);
            return daysUntil > 0 && daysUntil <= 1;
        });

        if (nearDeadline.length > 0) {
            actions.push({
                icon: '⏰',
                text: `Auftrag ${nearDeadline[0].id} Deadline morgen`,
                detail: `${nearDeadline[0].kunde.name}`,
                time: `Termin: ${this.formatDate(nearDeadline[0].deadline)}`,
                severity: 'warning',
                view: 'auftraege',
                action: null
            });
        }

        // 5. Draft quotes waiting (blue - info)
        const draftQuotes = (state.angebote || []).filter(a => a.status === 'entwurf').length;
        if (draftQuotes > 0) {
            actions.push({
                icon: '📝',
                text: `${draftQuotes} Angebot(e) im Entwurf`,
                detail: 'Warten auf Versand',
                time: 'In: Angebote',
                severity: 'info',
                view: 'angebote',
                action: null
            });
        }

        // Limit to 5 actions, priority order
        return actions.slice(0, 5);
    }

    /**
     * Calculate days overdue
     */
    calculateDaysOverdue(invoice, today) {
        let dueDate;

        if (invoice.zahlungsziel) {
            dueDate = new Date(invoice.zahlungsziel);
        } else if (invoice.createdAt) {
            dueDate = new Date(invoice.createdAt);
            dueDate.setDate(dueDate.getDate() + 30);
        } else {
            return 0;
        }

        dueDate.setHours(0, 0, 0, 0);
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        return Math.max(0, daysOverdue);
    }

    /**
     * Get relative time string
     */
    getRelativeTime(dateString) {
        if (!dateString) return '';

        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'gerade eben';
        if (minutes < 60) return `vor ${minutes}m`;
        if (hours < 24) return `vor ${hours}h`;
        if (days === 1) return 'gestern';
        return `vor ${days}d`;
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    /**
     * Format currency
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    /**
     * Execute action
     */
    executeAction(action, state) {
        // Reserved for future implementations
        console.log('Action triggered:', action);
    }

    /**
     * Destroy the service
     */
    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.activityIndicatorService = new ActivityIndicatorService();
    });
} else {
    window.activityIndicatorService = new ActivityIndicatorService();
}
