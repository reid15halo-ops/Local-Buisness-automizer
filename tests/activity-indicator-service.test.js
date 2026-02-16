import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ActivityIndicatorService', () => {
    let activityService;

    beforeEach(() => {
        // Mock DOM
        document.body.innerHTML = '';
        document.head.innerHTML = '';

        // Mock storeService
        window.storeService = {
            state: {
                anfragen: [],
                angebote: [],
                auftraege: [],
                rechnungen: [],
                aufgaben: []
            },
            subscribe: vi.fn((callback) => {
                // Store the callback for later use
                window.storeService._callback = callback;
                return callback;
            })
        };

        // Create ActivityIndicatorService class
        const ActivityIndicatorServiceClass = class ActivityIndicatorService {
            constructor() {
                this.updateInterval = 30000;
                this.intervalId = null;
                this.initCSS();
                this.subscribe();
            }

            initCSS() {
                const style = document.createElement('style');
                style.textContent = '.nav-item .badge { position: absolute; }';
                document.head.appendChild(style);
            }

            subscribe() {
                if (window.storeService) {
                    window.storeService.subscribe(() => {
                        this.update();
                    });
                }
                this.update();
                this.intervalId = setInterval(() => this.update(), this.updateInterval);
            }

            update() {
                if (!window.storeService) return;

                const state = window.storeService.state;

                this.updateBadges(state);
                this.updatePriorityActionsCard(state);
            }

            updateBadges(state) {
                const newAnfragen = (state.anfragen || []).filter(a => a.status === 'neu').length;
                this.updateBadge('anfragen', newAnfragen, newAnfragen > 0 ? 'badge-warning' : '');

                const draftAngebote = (state.angebote || []).filter(a => a.status === 'entwurf').length;
                this.updateBadge('angebote', draftAngebote, draftAngebote > 0 ? 'badge-info' : '');

                const activeAuftraege = (state.auftraege || []).filter(a =>
                    a.status === 'in_bearbeitung' || a.status === 'aktiv'
                ).length;
                this.updateBadge('auftraege', activeAuftraege, activeAuftraege > 0 ? 'badge-info' : '');

                const overdueRechnungen = this.getOverdueInvoiceCount(state);
                this.updateBadge('rechnungen', overdueRechnungen, overdueRechnungen > 0 ? 'badge-danger' : '');

                const urgentAufgaben = this.getUrgentTaskCount(state);
                this.updateBadge('aufgaben', urgentAufgaben, urgentAufgaben > 0 ? 'badge-warning' : '');

                this.updateBadge('mahnwesen', overdueRechnungen, overdueRechnungen > 0 ? 'badge-danger' : '');
            }

            updateBadge(view, count, badgeClass) {
                const badgeEl = document.getElementById(`${view}-badge`);
                if (!badgeEl) return;

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

            getOverdueInvoiceCount(state) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                return (state.rechnungen || []).filter(r => {
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
                }).length;
            }

            getUrgentTaskCount(state) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (!state.aufgaben || state.aufgaben.length === 0) {
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

            updatePriorityActionsCard(state) {
                const dashboard = document.getElementById('view-dashboard');
                if (!dashboard) return;

                let card = dashboard.querySelector('.priority-actions-card');
                if (!card) {
                    const quickActions = dashboard.querySelector('.quick-actions');
                    if (!quickActions) return;

                    card = document.createElement('div');
                    card.className = 'priority-actions-card';
                    quickActions.insertAdjacentElement('afterend', card);
                }

                const actions = this.generatePriorityActions(state);

                let html = '<h2>Was steht an?</h2>';

                if (actions.length === 0) {
                    html += '<div class="priority-actions-empty">Alles unter Kontrolle!</div>';
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
                        html += `<div class="priority-action-item ${action.severity}">${action.text}</div>`;
                    });
                    html += '</div>';
                }

                card.innerHTML = html;
            }

            generatePriorityActions(state) {
                const actions = [];
                const today = new Date();
                today.setHours(0, 0, 0, 0);

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
                        text: `Rechnung ${invoice.id} ist ${daysOverdue} Tag(e) überfällig`,
                        detail: `${invoice.kunde?.name || 'Unknown'}`,
                        severity: 'danger',
                        view: 'rechnungen',
                        action: null
                    });
                }

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
                        severity: 'warning',
                        view: 'anfragen',
                        action: null
                    });
                }

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
                        detail: newInquiries[0].kunde?.name || 'Unknown',
                        severity: 'info',
                        view: 'anfragen',
                        action: null
                    });
                }

                return actions.slice(0, 5);
            }

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

            formatDate(dateString) {
                if (!dateString) return '';
                const date = new Date(dateString);
                return date.toLocaleDateString('de-DE', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            }

            formatCurrency(amount) {
                return new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR'
                }).format(amount);
            }

            executeAction(action, state) {
                console.log('Action triggered:', action);
            }

            destroy() {
                if (this.intervalId) {
                    clearInterval(this.intervalId);
                }
            }
        };

        activityService = new ActivityIndicatorServiceClass();
    });

    afterEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        document.head.innerHTML = '';
        if (activityService) {
            activityService.destroy();
        }
    });

    describe('Initialization', () => {
        it('should initialize with CSS styles', () => {
            const styles = document.head.querySelectorAll('style');
            expect(styles.length).toBeGreaterThan(0);
        });

        it('should subscribe to store changes', () => {
            expect(window.storeService.subscribe).toHaveBeenCalled();
        });
    });

    describe('Badge Updates', () => {
        it('should create badge element', () => {
            const badge = document.createElement('div');
            badge.id = 'anfragen-badge';
            document.body.appendChild(badge);

            activityService.updateBadge('anfragen', 5, 'badge-warning');

            expect(badge.textContent).toBe('5');
            expect(badge.classList.contains('badge-warning')).toBe(true);
        });

        it('should show 99+ for high badge counts', () => {
            const badge = document.createElement('div');
            badge.id = 'anfragen-badge';
            document.body.appendChild(badge);

            activityService.updateBadge('anfragen', 150, 'badge-warning');

            expect(badge.textContent).toBe('99+');
        });

        it('should hide badge when count is 0', () => {
            const badge = document.createElement('div');
            badge.id = 'anfragen-badge';
            badge.style.display = 'flex';
            document.body.appendChild(badge);

            activityService.updateBadge('anfragen', 0, '');

            expect(badge.style.display).toBe('none');
        });
    });

    describe('Overdue Invoice Detection', () => {
        it('should detect overdue invoices based on zahlungsziel', () => {
            const today = new Date();
            const yesterday = new Date(today - 24 * 60 * 60 * 1000);

            window.storeService.state.rechnungen = [
                {
                    id: 'R-001',
                    status: 'offen',
                    zahlungsziel: yesterday.toISOString(),
                    kunde: { name: 'Test' }
                }
            ];

            const count = activityService.getOverdueInvoiceCount(window.storeService.state);

            expect(count).toBe(1);
        });

        it('should detect overdue invoices based on createdAt + 30 days', () => {
            const today = new Date();
            const thirtyOneDaysAgo = new Date(today - 31 * 24 * 60 * 60 * 1000);

            window.storeService.state.rechnungen = [
                {
                    id: 'R-001',
                    status: 'offen',
                    createdAt: thirtyOneDaysAgo.toISOString(),
                    kunde: { name: 'Test' }
                }
            ];

            const count = activityService.getOverdueInvoiceCount(window.storeService.state);

            expect(count).toBe(1);
        });

        it('should not count paid invoices as overdue', () => {
            const today = new Date();
            const yesterday = new Date(today - 24 * 60 * 60 * 1000);

            window.storeService.state.rechnungen = [
                {
                    id: 'R-001',
                    status: 'bezahlt',
                    zahlungsziel: yesterday.toISOString(),
                    kunde: { name: 'Test' }
                }
            ];

            const count = activityService.getOverdueInvoiceCount(window.storeService.state);

            expect(count).toBe(0);
        });

        it('should not count cancelled invoices as overdue', () => {
            const today = new Date();
            const yesterday = new Date(today - 24 * 60 * 60 * 1000);

            window.storeService.state.rechnungen = [
                {
                    id: 'R-001',
                    status: 'storniert',
                    zahlungsziel: yesterday.toISOString(),
                    kunde: { name: 'Test' }
                }
            ];

            const count = activityService.getOverdueInvoiceCount(window.storeService.state);

            expect(count).toBe(0);
        });

        it('should detect invoices marked as überfällig', () => {
            window.storeService.state.rechnungen = [
                {
                    id: 'R-001',
                    status: 'überfällig',
                    kunde: { name: 'Test' }
                }
            ];

            const count = activityService.getOverdueInvoiceCount(window.storeService.state);

            expect(count).toBe(1);
        });
    });

    describe('Urgent Task Detection', () => {
        it('should detect urgent tasks (due today or overdue)', () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            window.storeService.state.aufgaben = [
                {
                    id: 'T-001',
                    completed: false,
                    dueDate: today.toISOString()
                }
            ];

            const count = activityService.getUrgentTaskCount(window.storeService.state);

            expect(count).toBe(1);
        });

        it('should not count completed tasks as urgent', () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            window.storeService.state.aufgaben = [
                {
                    id: 'T-001',
                    completed: true,
                    dueDate: today.toISOString()
                }
            ];

            const count = activityService.getUrgentTaskCount(window.storeService.state);

            expect(count).toBe(0);
        });

        it('should estimate tasks from orders when aufgaben is empty', () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            window.storeService.state.auftraege = [
                {
                    id: 'A-001',
                    deadline: today.toISOString()
                }
            ];

            const count = activityService.getUrgentTaskCount(window.storeService.state);

            expect(count).toBe(1);
        });
    });

    describe('Priority Actions Generation', () => {
        it('should generate overdue invoice action', () => {
            const today = new Date();
            const yesterday = new Date(today - 24 * 60 * 60 * 1000);

            window.storeService.state.rechnungen = [
                {
                    id: 'R-001',
                    status: 'offen',
                    zahlungsziel: yesterday.toISOString(),
                    kunde: { name: 'Test Customer' }
                }
            ];

            const actions = activityService.generatePriorityActions(window.storeService.state);

            expect(actions.some(a => a.text.includes('überfällig'))).toBe(true);
        });

        it('should mark overdue invoice action as danger', () => {
            const today = new Date();
            const yesterday = new Date(today - 24 * 60 * 60 * 1000);

            window.storeService.state.rechnungen = [
                {
                    id: 'R-001',
                    status: 'offen',
                    zahlungsziel: yesterday.toISOString(),
                    kunde: { name: 'Test' }
                }
            ];

            const actions = activityService.generatePriorityActions(window.storeService.state);

            expect(actions.some(a => a.severity === 'danger')).toBe(true);
        });

        it('should generate waiting inquiry action', () => {
            const today = new Date();
            const twoDaysAgo = new Date(today - 2 * 24 * 60 * 60 * 1000);

            window.storeService.state.anfragen = [
                {
                    id: 'ANF-001',
                    status: 'neu',
                    createdAt: twoDaysAgo.toISOString(),
                    kunde: { name: 'Test' }
                }
            ];

            const actions = activityService.generatePriorityActions(window.storeService.state);

            expect(actions.some(a => a.text.includes('warten'))).toBe(true);
        });

        it('should limit actions to maximum 5', () => {
            window.storeService.state.anfragen = Array.from({ length: 10 }, (_, i) => ({
                id: `ANF-${i}`,
                status: 'neu',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test' }
            }));

            const actions = activityService.generatePriorityActions(window.storeService.state);

            expect(actions.length).toBeLessThanOrEqual(5);
        });
    });

    describe('Priority Actions Card', () => {
        it('should create priority actions card if not exists', () => {
            const dashboard = document.createElement('div');
            dashboard.id = 'view-dashboard';
            const quickActions = document.createElement('div');
            quickActions.className = 'quick-actions';
            dashboard.appendChild(quickActions);
            document.body.appendChild(dashboard);

            activityService.updatePriorityActionsCard(window.storeService.state);

            const card = dashboard.querySelector('.priority-actions-card');
            expect(card).toBeDefined();
        });

        it('should show empty state when no actions', () => {
            const dashboard = document.createElement('div');
            dashboard.id = 'view-dashboard';
            const quickActions = document.createElement('div');
            quickActions.className = 'quick-actions';
            dashboard.appendChild(quickActions);
            document.body.appendChild(dashboard);

            activityService.updatePriorityActionsCard(window.storeService.state);

            const card = dashboard.querySelector('.priority-actions-card');
            expect(card.textContent).toContain('Alles unter Kontrolle');
        });

        it('should mark card with urgent class when danger action exists', () => {
            const dashboard = document.createElement('div');
            dashboard.id = 'view-dashboard';
            const quickActions = document.createElement('div');
            quickActions.className = 'quick-actions';
            dashboard.appendChild(quickActions);
            document.body.appendChild(dashboard);

            const today = new Date();
            const yesterday = new Date(today - 24 * 60 * 60 * 1000);
            window.storeService.state.rechnungen = [
                {
                    id: 'R-001',
                    status: 'offen',
                    zahlungsziel: yesterday.toISOString(),
                    kunde: { name: 'Test' }
                }
            ];

            activityService.updatePriorityActionsCard(window.storeService.state);

            const card = dashboard.querySelector('.priority-actions-card');
            expect(card.classList.contains('has-urgent')).toBe(true);
        });
    });

    describe('Days Overdue Calculation', () => {
        it('should calculate days overdue correctly', () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tenDaysAgo = new Date(today);
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

            const invoice = {
                id: 'R-001',
                zahlungsziel: tenDaysAgo.toISOString()
            };

            const daysOverdue = activityService.calculateDaysOverdue(invoice, today);

            expect(daysOverdue).toBe(10);
        });

        it('should return 0 for current or future due dates', () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const invoice = {
                id: 'R-001',
                zahlungsziel: tomorrow.toISOString()
            };

            const daysOverdue = activityService.calculateDaysOverdue(invoice, today);

            expect(daysOverdue).toBe(0);
        });
    });

    describe('Relative Time Formatting', () => {
        it('should format recent time as minutes', () => {
            const now = new Date();
            const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

            const relative = activityService.getRelativeTime(fiveMinutesAgo.toISOString());

            expect(relative).toMatch(/vor \d+m/);
        });

        it('should format hours correctly', () => {
            const now = new Date();
            const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

            const relative = activityService.getRelativeTime(twoHoursAgo.toISOString());

            expect(relative).toMatch(/vor \d+h/);
        });

        it('should format yesterday correctly', () => {
            const now = new Date();
            const yesterday = new Date(now - 24 * 60 * 60 * 1000);

            const relative = activityService.getRelativeTime(yesterday.toISOString());

            expect(relative).toBe('gestern');
        });
    });

    describe('Currency Formatting', () => {
        it('should format currency to German locale', () => {
            const formatted = activityService.formatCurrency(1234.56);

            expect(formatted).toContain('1.234,56');
            expect(formatted).toContain('€');
        });
    });

    describe('Service Cleanup', () => {
        it('should clear interval on destroy', () => {
            const spy = vi.spyOn(window, 'clearInterval');

            activityService.destroy();

            expect(spy).toHaveBeenCalled();
        });
    });
});
