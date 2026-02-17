/* ============================================
   Calendar UI Service - Full Calendar System
   Monthly, Weekly, Daily Views with Events
   ============================================ */

class CalendarUIService {
    constructor() {
        this.currentDate = new Date();
        this.currentView = 'month'; // 'month', 'week', 'day'
        this.selectedDate = null;
        this.viewContainer = null;
        this.editingEvent = null;
        this.colors = {
            termin: '#6366f1',
            auftrag: '#f59e0b',
            deadline: '#ef4444',
            besichtigung: '#22c55e',
            reparatur: '#f59e0b',
            meeting: '#3b82f6'
        };

        // Initialize CSS
        this.injectStyles();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Calendar Container */
            .calendar-ui-container {
                width: 100%;
                background: #0f0f12;
                color: #e4e4e7;
                border-radius: 8px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                height: 100%;
            }

            /* View Switcher */
            .calendar-view-switcher {
                display: flex;
                gap: 8px;
                padding: 16px;
                border-bottom: 1px solid #2a2a32;
                background: #1c1c21;
                flex-wrap: wrap;
            }

            .calendar-view-switcher button {
                padding: 8px 16px;
                border: 1px solid #3a3a42;
                border-radius: 6px;
                background: #1c1c21;
                color: #a1a1a8;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 14px;
            }

            .calendar-view-switcher button.active {
                background: #6366f1;
                color: white;
                border-color: #6366f1;
            }

            .calendar-view-switcher button:hover:not(.active) {
                border-color: #6366f1;
                color: #e4e4e7;
            }

            /* Calendar Navigation */
            .calendar-nav {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px;
                background: #1c1c21;
                border-bottom: 1px solid #2a2a32;
            }

            .calendar-nav-title {
                font-size: 18px;
                font-weight: 600;
                color: #e4e4e7;
                min-width: 200px;
                text-align: center;
            }

            .calendar-nav-buttons {
                display: flex;
                gap: 8px;
            }

            .calendar-nav-buttons button {
                padding: 8px 12px;
                border: 1px solid #3a3a42;
                border-radius: 6px;
                background: #0f0f12;
                color: #a1a1a8;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 12px;
            }

            .calendar-nav-buttons button:hover {
                background: #2a2a32;
                border-color: #6366f1;
                color: #e4e4e7;
            }

            /* Month View */
            .calendar-month {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 1px;
                background: #2a2a32;
                padding: 1px;
                flex: 1;
                overflow: auto;
            }

            .calendar-month-header {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 1px;
                background: #2a2a32;
                padding: 1px;
            }

            .calendar-month-day-header {
                padding: 12px 8px;
                background: #1c1c21;
                font-weight: 600;
                font-size: 13px;
                color: #a1a1a8;
                text-align: center;
                border-bottom: 2px solid #2a2a32;
            }

            .calendar-day-cell {
                background: #0f0f12;
                padding: 8px;
                min-height: 100px;
                cursor: pointer;
                transition: background 0.2s;
                position: relative;
                display: flex;
                flex-direction: column;
            }

            .calendar-day-cell:hover {
                background: #1a1a22;
            }

            .calendar-day-cell.today {
                border: 2px solid #6366f1;
            }

            .calendar-day-cell.other-month {
                opacity: 0.4;
            }

            .calendar-day-cell.weekend {
                background: #131316;
            }

            .calendar-day-number {
                font-weight: 600;
                font-size: 13px;
                color: #e4e4e7;
                margin-bottom: 4px;
            }

            .calendar-day-cell.other-month .calendar-day-number {
                color: #52525c;
            }

            .calendar-day-events {
                display: flex;
                flex-direction: column;
                gap: 2px;
                flex: 1;
                overflow: hidden;
            }

            .calendar-event-dot {
                width: 4px;
                height: 4px;
                border-radius: 50%;
                margin-right: 4px;
                flex-shrink: 0;
            }

            .calendar-event-mini {
                font-size: 11px;
                padding: 2px 4px;
                border-radius: 3px;
                color: #e4e4e7;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                border-left: 3px solid;
                cursor: pointer;
                transition: all 0.2s;
            }

            .calendar-event-mini:hover {
                transform: translateX(2px);
                opacity: 0.8;
            }

            /* Week View */
            .calendar-week {
                display: grid;
                grid-template-columns: 80px 1fr;
                gap: 1px;
                background: #2a2a32;
                flex: 1;
                overflow: auto;
            }

            .calendar-week-times {
                background: #1c1c21;
                border-right: 1px solid #2a2a32;
                display: flex;
                flex-direction: column;
            }

            .calendar-time-slot {
                min-height: 40px;
                padding: 4px 8px;
                font-size: 11px;
                color: #a1a1a8;
                text-align: right;
                border-bottom: 1px solid #2a2a32;
                display: flex;
                align-items: flex-start;
                background: #0f0f12;
            }

            .calendar-week-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 1px;
                background: #2a2a32;
                position: relative;
            }

            .calendar-week-day {
                background: #0f0f12;
                display: flex;
                flex-direction: column;
                position: relative;
            }

            .calendar-week-day-header {
                padding: 8px;
                background: #1c1c21;
                border-bottom: 1px solid #2a2a32;
                font-size: 12px;
                font-weight: 600;
                color: #e4e4e7;
                text-align: center;
                min-height: 60px;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            .calendar-week-day-header.today {
                background: #6366f1;
                color: white;
            }

            .calendar-week-day-name {
                font-size: 11px;
                color: #a1a1a8;
                margin-bottom: 2px;
            }

            .calendar-week-day-number {
                font-size: 14px;
                font-weight: 600;
            }

            .calendar-week-hours {
                display: flex;
                flex-direction: column;
                position: relative;
                min-height: 1200px;
            }

            .calendar-hour {
                min-height: 40px;
                border-bottom: 1px solid #2a2a32;
                position: relative;
            }

            .calendar-hour.now::after {
                content: '';
                position: absolute;
                left: 0;
                right: 0;
                height: 2px;
                background: #ef4444;
                z-index: 10;
            }

            .calendar-event-block {
                position: absolute;
                left: 2px;
                right: 2px;
                border-radius: 4px;
                padding: 4px;
                font-size: 11px;
                color: white;
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                transition: all 0.2s;
                border-left: 3px solid;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                z-index: 5;
            }

            .calendar-event-block:hover {
                transform: scale(1.02);
                box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                z-index: 6;
            }

            /* Day View */
            .calendar-day {
                display: flex;
                flex-direction: column;
                gap: 1px;
                background: #2a2a32;
                flex: 1;
                overflow: auto;
            }

            .calendar-day-header {
                padding: 16px;
                background: #1c1c21;
                border-bottom: 1px solid #2a2a32;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .calendar-day-title {
                font-size: 16px;
                font-weight: 600;
                color: #e4e4e7;
            }

            .calendar-day-hours {
                display: flex;
                flex-direction: column;
                gap: 1px;
                background: #2a2a32;
                padding: 1px;
            }

            .calendar-day-hour-row {
                display: grid;
                grid-template-columns: 80px 1fr;
                gap: 1px;
                background: #2a2a32;
                min-height: 80px;
            }

            .calendar-day-time {
                background: #1c1c21;
                padding: 8px;
                font-size: 12px;
                color: #a1a1a8;
                font-weight: 600;
                border-right: 1px solid #2a2a32;
            }

            .calendar-day-hour {
                background: #0f0f12;
                padding: 8px;
                position: relative;
            }

            /* Event Cards */
            .calendar-event-card {
                background: #1c1c21;
                border: 1px solid #2a2a32;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: all 0.2s;
                border-left: 4px solid;
            }

            .calendar-event-card:hover {
                border-color: #3a3a42;
                background: #2a2a32;
                transform: translateY(-2px);
            }

            .calendar-event-card-type {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                opacity: 0.7;
                margin-bottom: 4px;
            }

            .calendar-event-card-title {
                font-weight: 600;
                color: #e4e4e7;
                margin-bottom: 4px;
            }

            .calendar-event-card-time {
                font-size: 12px;
                color: #a1a1a8;
                margin-bottom: 4px;
            }

            .calendar-event-card-customer {
                font-size: 11px;
                color: #a1a1a8;
            }

            /* New Event Modal */
            .calendar-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                z-index: 1000;
                align-items: center;
                justify-content: center;
            }

            .calendar-modal.active {
                display: flex;
            }

            .calendar-modal-content {
                background: #1c1c21;
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                border: 1px solid #2a2a32;
            }

            .calendar-modal-header {
                font-size: 18px;
                font-weight: 600;
                color: #e4e4e7;
                margin-bottom: 16px;
            }

            .calendar-form-group {
                margin-bottom: 16px;
            }

            .calendar-form-label {
                display: block;
                font-size: 13px;
                font-weight: 600;
                color: #a1a1a8;
                margin-bottom: 6px;
            }

            .calendar-form-input,
            .calendar-form-select,
            .calendar-form-textarea {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #2a2a32;
                border-radius: 6px;
                background: #0f0f12;
                color: #e4e4e7;
                font-family: inherit;
                font-size: 14px;
                transition: border 0.2s;
            }

            .calendar-form-input:focus,
            .calendar-form-select:focus,
            .calendar-form-textarea:focus {
                outline: none;
                border-color: #6366f1;
                background: #131316;
            }

            .calendar-form-textarea {
                resize: vertical;
                min-height: 80px;
            }

            .calendar-form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            .calendar-color-picker {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .calendar-color-option {
                width: 32px;
                height: 32px;
                border-radius: 6px;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 0.2s;
            }

            .calendar-color-option:hover {
                transform: scale(1.1);
            }

            .calendar-color-option.selected {
                border-color: #e4e4e7;
                box-shadow: 0 0 8px currentColor;
            }

            .calendar-modal-buttons {
                display: flex;
                gap: 12px;
                margin-top: 24px;
                justify-content: flex-end;
            }

            .calendar-btn {
                padding: 8px 16px;
                border: 1px solid #2a2a32;
                border-radius: 6px;
                background: #0f0f12;
                color: #e4e4e7;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: 600;
                font-size: 13px;
            }

            .calendar-btn:hover {
                background: #2a2a32;
                border-color: #3a3a42;
            }

            .calendar-btn-primary {
                background: #6366f1;
                color: white;
                border-color: #6366f1;
            }

            .calendar-btn-primary:hover {
                background: #4f46e5;
                border-color: #4f46e5;
            }

            .calendar-btn-danger {
                background: #ef4444;
                color: white;
                border-color: #ef4444;
            }

            .calendar-btn-danger:hover {
                background: #dc2626;
                border-color: #dc2626;
            }

            /* Mini Calendar */
            .calendar-mini {
                background: #1c1c21;
                border-radius: 8px;
                padding: 12px;
                border: 1px solid #2a2a32;
            }

            .calendar-mini-header {
                font-size: 13px;
                font-weight: 600;
                color: #e4e4e7;
                text-align: center;
                margin-bottom: 12px;
            }

            .calendar-mini-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 4px;
            }

            .calendar-mini-day {
                aspect-ratio: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                border-radius: 4px;
                cursor: pointer;
                color: #a1a1a8;
                background: #0f0f12;
                transition: all 0.2s;
            }

            .calendar-mini-day:hover {
                background: #2a2a32;
                color: #e4e4e7;
            }

            .calendar-mini-day.today {
                background: #6366f1;
                color: white;
                font-weight: 600;
            }

            .calendar-mini-day.selected {
                border: 1px solid #6366f1;
            }

            .calendar-mini-day.other-month {
                opacity: 0.3;
            }

            /* Export Button */
            .calendar-export-btn {
                padding: 8px 16px;
                background: #22c55e;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
                transition: background 0.2s;
                margin-top: 12px;
            }

            .calendar-export-btn:hover {
                background: #16a34a;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .calendar-day-cell {
                    min-height: 70px;
                    padding: 6px;
                }

                .calendar-event-mini {
                    font-size: 10px;
                    padding: 1px 3px;
                }

                .calendar-week {
                    grid-template-columns: 60px 1fr;
                }

                .calendar-time-slot {
                    min-height: 30px;
                    font-size: 10px;
                }

                .calendar-month-day-header {
                    padding: 8px 4px;
                    font-size: 11px;
                }

                .calendar-day-number {
                    font-size: 12px;
                }

                .calendar-modal-content {
                    width: 95%;
                    padding: 16px;
                }

                .calendar-form-row {
                    grid-template-columns: 1fr;
                }
            }

            /* Status Badges */
            .calendar-status-badge {
                display: inline-block;
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 3px;
                font-weight: 600;
                margin-top: 4px;
            }

            .calendar-status-geplant {
                background: #3b82f6;
                color: white;
            }

            .calendar-status-bestaetigt {
                background: #22c55e;
                color: white;
            }

            .calendar-status-abgeschlossen {
                background: #6366f1;
                color: white;
            }

            .calendar-status-abgesagt {
                background: #ef4444;
                color: white;
            }
        `;
        document.head.appendChild(style);
    }

    mount(containerId) {
        this.viewContainer = document.getElementById(containerId);
        if (!this.viewContainer) {
            console.error('Calendar container not found:', containerId);
            return;
        }

        this.render();
        this.attachEventListeners();
    }

    render() {
        if (!this.viewContainer) {return;}

        const html = `
            <div class="calendar-ui-container">
                <!-- View Switcher -->
                <div class="calendar-view-switcher">
                    <button class="calendar-view-btn active" data-view="month">📅 Monat</button>
                    <button class="calendar-view-btn" data-view="week">📆 Woche</button>
                    <button class="calendar-view-btn" data-view="day">📄 Tag</button>
                    <div style="flex: 1;"></div>
                    <button class="calendar-export-btn" id="btn-export-ics">📤 Kalender exportieren</button>
                </div>

                <!-- Calendar Navigation -->
                <div class="calendar-nav">
                    <div class="calendar-nav-buttons">
                        <button id="btn-cal-prev" title="Vorherige">←</button>
                        <button id="btn-cal-today" title="Heute">Heute</button>
                        <button id="btn-cal-next" title="Nächste">→</button>
                    </div>
                    <div class="calendar-nav-title" id="calendar-nav-title"></div>
                    <button class="calendar-export-btn" id="btn-new-event" style="margin: 0;">+ Neuer Termin</button>
                </div>

                <!-- Month View -->
                <div id="calendar-month-view" style="display: none; flex: 1; overflow: auto;">
                    <div class="calendar-month-header" id="calendar-month-header"></div>
                    <div class="calendar-month" id="calendar-month"></div>
                </div>

                <!-- Week View -->
                <div id="calendar-week-view" style="display: none; flex: 1;">
                    <div class="calendar-week" id="calendar-week"></div>
                </div>

                <!-- Day View -->
                <div id="calendar-day-view" style="display: none; flex: 1; overflow: auto;">
                    <div class="calendar-day" id="calendar-day"></div>
                </div>
            </div>

            <!-- New Event Modal -->
            <div class="calendar-modal" id="calendar-modal">
                <div class="calendar-modal-content">
                    <div class="calendar-modal-header" id="modal-title">Neuer Termin</div>
                    <form id="calendar-event-form">
                        <div class="calendar-form-group">
                            <label class="calendar-form-label">Titel</label>
                            <input type="text" class="calendar-form-input" id="form-title" placeholder="z.B. Kundenbesuch" required>
                        </div>

                        <div class="calendar-form-group">
                            <label class="calendar-form-label">Kunde (optional)</label>
                            <input type="text" class="calendar-form-input" id="form-customer" placeholder="Kundennname">
                        </div>

                        <div class="calendar-form-group">
                            <label class="calendar-form-label">Typ</label>
                            <select class="calendar-form-select" id="form-type">
                                <option value="termin">Termin</option>
                                <option value="besichtigung">Besichtigung</option>
                                <option value="reparatur">Reparatur</option>
                                <option value="meeting">Meeting</option>
                            </select>
                        </div>

                        <div class="calendar-form-group">
                            <label class="calendar-form-label">Datum</label>
                            <input type="date" class="calendar-form-input" id="form-date" required>
                        </div>

                        <div class="calendar-form-row">
                            <div class="calendar-form-group">
                                <label class="calendar-form-label">Startzeit</label>
                                <input type="time" class="calendar-form-input" id="form-starttime" required>
                            </div>
                            <div class="calendar-form-group">
                                <label class="calendar-form-label">Endzeit</label>
                                <input type="time" class="calendar-form-input" id="form-endtime" required>
                            </div>
                        </div>

                        <div class="calendar-form-group">
                            <label class="calendar-form-label">Ort (optional)</label>
                            <input type="text" class="calendar-form-input" id="form-location" placeholder="Adresse">
                        </div>

                        <div class="calendar-form-group">
                            <label class="calendar-form-label">Beschreibung</label>
                            <textarea class="calendar-form-textarea" id="form-description" placeholder="Weitere Details..."></textarea>
                        </div>

                        <div class="calendar-form-group">
                            <label class="calendar-form-label">Erinnerung</label>
                            <select class="calendar-form-select" id="form-reminder">
                                <option value="0">Keine Erinnerung</option>
                                <option value="15">15 Minuten vorher</option>
                                <option value="30" selected>30 Minuten vorher</option>
                                <option value="60">1 Stunde vorher</option>
                                <option value="1440">1 Tag vorher</option>
                            </select>
                        </div>

                        <div class="calendar-form-group">
                            <label class="calendar-form-label">Farbe</label>
                            <div class="calendar-color-picker" id="form-color-picker"></div>
                        </div>

                        <div class="calendar-modal-buttons">
                            <button type="button" class="calendar-btn" id="btn-modal-cancel">Abbrechen</button>
                            <button type="button" class="calendar-btn calendar-btn-danger" id="btn-modal-delete" style="display: none;">Löschen</button>
                            <button type="submit" class="calendar-btn calendar-btn-primary">Speichern</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this.viewContainer.innerHTML = html;
        this.setupColorPicker();
        this.renderCurrentView();
    }

    setupColorPicker() {
        const picker = document.getElementById('form-color-picker');
        Object.entries(this.colors).forEach(([type, color]) => {
            const option = document.createElement('div');
            option.className = 'calendar-color-option';
            option.style.backgroundColor = color;
            option.dataset.value = type;
            option.title = type;
            picker.appendChild(option);
        });
    }

    attachEventListeners() {
        // View switcher
        document.querySelectorAll('.calendar-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.calendar-view-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentView = e.target.dataset.view;
                this.renderCurrentView();
            });
        });

        // Navigation
        document.getElementById('btn-cal-prev').addEventListener('click', () => this.previousPeriod());
        document.getElementById('btn-cal-today').addEventListener('click', () => this.goToToday());
        document.getElementById('btn-cal-next').addEventListener('click', () => this.nextPeriod());

        // New event
        document.getElementById('btn-new-event').addEventListener('click', () => this.openEventModal());
        document.getElementById('btn-export-ics').addEventListener('click', () => this.exportICS());

        // Modal
        document.getElementById('btn-modal-cancel').addEventListener('click', () => this.closeEventModal());
        document.getElementById('calendar-event-form').addEventListener('submit', (e) => this.saveEvent(e));

        // Color picker
        document.querySelectorAll('.calendar-color-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.calendar-color-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                document.getElementById('form-type').value = option.dataset.value;
            });
        });

        // Modal close on background click
        document.getElementById('calendar-modal').addEventListener('click', (e) => {
            if (e.target.id === 'calendar-modal') {
                this.closeEventModal();
            }
        });
    }

    renderCurrentView() {
        document.getElementById('calendar-month-view').style.display = 'none';
        document.getElementById('calendar-week-view').style.display = 'none';
        document.getElementById('calendar-day-view').style.display = 'none';

        switch (this.currentView) {
            case 'month':
                this.renderMonthView();
                document.getElementById('calendar-month-view').style.display = 'flex';
                break;
            case 'week':
                this.renderWeekView();
                document.getElementById('calendar-week-view').style.display = 'block';
                break;
            case 'day':
                this.renderDayView();
                document.getElementById('calendar-day-view').style.display = 'flex';
                break;
        }
    }

    renderMonthView() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        const headerDiv = document.getElementById('calendar-month-header');
        const monthDiv = document.getElementById('calendar-month');

        // Update nav title
        document.getElementById('calendar-nav-title').textContent =
            this.currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

        // Day headers
        const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        headerDiv.innerHTML = dayNames.map(day =>
            `<div class="calendar-month-day-header">${day}</div>`
        ).join('');

        // Get first day of month and total days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        let days = [];

        // Previous month days
        for (let i = (firstDay === 0 ? 6 : firstDay - 1); i > 0; i--) {
            days.push({
                date: new Date(year, month - 1, daysInPrevMonth - i + 1),
                isOtherMonth: true
            });
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({
                date: new Date(year, month, i),
                isOtherMonth: false
            });
        }

        // Next month days
        const remainingDays = 42 - days.length; // 6 rows × 7 days
        for (let i = 1; i <= remainingDays; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isOtherMonth: true
            });
        }

        // Render days
        monthDiv.innerHTML = days.map(day => this.renderMonthDayCell(day)).join('');

        // Attach event listeners
        monthDiv.querySelectorAll('.calendar-day-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const dateStr = cell.dataset.date;
                this.selectedDate = new Date(dateStr);
                this.currentView = 'day';
                this.renderCurrentView();
                document.querySelectorAll('.calendar-view-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('[data-view="day"]').classList.add('active');
            });
        });

        // Attach mini event listeners
        monthDiv.querySelectorAll('.calendar-event-mini').forEach(event => {
            event.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = event.dataset.eventId;
                this.editEventModal(eventId);
            });
        });
    }

    renderMonthDayCell(day) {
        const dateStr = day.date.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        const events = this.getEventsForDate(dateStr);
        const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

        let classes = 'calendar-day-cell';
        if (day.isOtherMonth) {classes += ' other-month';}
        if (dateStr === today) {classes += ' today';}
        if (isWeekend) {classes += ' weekend';}

        const auftragDeadlines = this.getAuftragDeadlines(dateStr);

        let eventsHtml = '';
        [...events, ...auftragDeadlines].slice(0, 3).forEach(event => {
            const color = event.color || this.colors[event.type] || '#64748b';
            const isDeadline = !event.startTime;
            eventsHtml += `
                <div class="calendar-event-mini"
                     data-event-id="${event.id}"
                     style="border-left-color: ${color}; background: ${color}22;"
                     title="${event.title}">
                    ${isDeadline ? '⏰ ' : ''}${event.title}
                </div>
            `;
        });

        if (events.length + auftragDeadlines.length > 3) {
            eventsHtml += `<div class="calendar-event-mini" style="color: #a1a1a8;">+${events.length + auftragDeadlines.length - 3} mehr</div>`;
        }

        return `
            <div class="${classes}" data-date="${dateStr}">
                <div class="calendar-day-number">${day.date.getDate()}</div>
                <div class="calendar-day-events">${eventsHtml}</div>
            </div>
        `;
    }

    renderWeekView() {
        const weekStart = this.getWeekStart(this.currentDate);
        const weekDays = [];

        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            weekDays.push(date);
        }

        // Update nav title
        const endDate = new Date(weekStart);
        endDate.setDate(endDate.getDate() + 6);
        document.getElementById('calendar-nav-title').textContent =
            `${weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${endDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

        const weekDiv = document.getElementById('calendar-week');

        // Time slots (left side)
        let timesHtml = '<div class="calendar-week-times">';
        for (let hour = 8; hour <= 18; hour++) {
            const time = `${String(hour).padStart(2, '0')}:00`;
            timesHtml += `<div class="calendar-time-slot">${time}</div>`;
        }
        timesHtml += '</div>';

        // Week grid
        let gridHtml = '<div class="calendar-week-grid">';

        // Day headers
        const today = new Date().toISOString().split('T')[0];
        weekDays.forEach(date => {
            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === today;
            gridHtml += `
                <div class="calendar-week-day-header ${isToday ? 'today' : ''}">
                    <div class="calendar-week-day-name">${date.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
                    <div class="calendar-week-day-number">${date.getDate()}</div>
                </div>
            `;
        });

        // Hours grid
        for (let hour = 8; hour <= 18; hour++) {
            weekDays.forEach(date => {
                const dateStr = date.toISOString().split('T')[0];
                const hourStr = `${String(hour).padStart(2, '0')}:00`;

                const isNow = dateStr === today && new Date().getHours() === hour;

                gridHtml += `
                    <div class="calendar-hour ${isNow ? 'now' : ''}"
                         data-date="${dateStr}"
                         data-hour="${hour}"
                         style="cursor: pointer;"
                         title="Klick für neuen Termin"></div>
                `;
            });
        }

        gridHtml += '</div>';

        weekDiv.innerHTML = timesHtml + gridHtml;

        // Add events to the grid
        weekDays.forEach(date => {
            const dateStr = date.toISOString().split('T')[0];
            const events = this.getEventsForDate(dateStr);

            events.forEach(event => {
                this.renderEventBlock(weekDiv, event, dateStr, weekDays);
            });
        });

        // Add click listeners for creating new events
        weekDiv.querySelectorAll('.calendar-hour').forEach(hour => {
            hour.addEventListener('click', () => {
                const date = hour.dataset.date;
                const hourNum = parseInt(hour.dataset.hour);
                this.selectedDate = new Date(date);
                this.openEventModal(hourNum);
            });
        });

        // Add click listeners for events
        weekDiv.querySelectorAll('.calendar-event-block').forEach(block => {
            block.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editEventModal(block.dataset.eventId);
            });
        });
    }

    renderEventBlock(container, event, dateStr, weekDays) {
        const startHour = parseInt(event.startTime.split(':')[0]);
        const startMinute = parseInt(event.startTime.split(':')[1]);
        const endHour = parseInt(event.endTime.split(':')[0]);
        const endMinute = parseInt(event.endTime.split(':')[1]);

        const startMinuteFromHour = startMinute / 60;
        const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
        const durationHours = durationMinutes / 60;

        const dayIndex = weekDays.findIndex(d => d.toISOString().split('T')[0] === dateStr);
        if (dayIndex === -1) {return;}

        const topPercent = startMinuteFromHour * (100 / 1);
        const heightPercent = durationHours * 100;

        const color = event.color || this.colors[event.type] || '#64748b';
        const blockHtml = `
            <div class="calendar-event-block"
                 data-event-id="${event.id}"
                 style="
                     top: calc(${(startHour - 8) * 40}px + ${topPercent}px);
                     height: ${durationHours * 40}px;
                     background: ${color}33;
                     border-left-color: ${color};
                     grid-column: ${dayIndex + 2};
                     grid-row: ${startHour - 8 + 2} / span ${Math.ceil(durationHours)};
                 "
                 title="${event.title} (${event.startTime} - ${event.endTime})">
                ${event.title}
            </div>
        `;

        const grid = container.querySelector('.calendar-week-grid');
        if (grid) {
            grid.insertAdjacentHTML('beforeend', blockHtml);
        }
    }

    renderDayView() {
        const dateStr = this.selectedDate ? this.selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const date = new Date(dateStr);

        document.getElementById('calendar-nav-title').textContent =
            date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

        const dayDiv = document.getElementById('calendar-day');
        const events = this.getEventsForDate(dateStr);

        let html = '<div class="calendar-day-header"><div class="calendar-day-title">' +
            date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }) +
            '</div></div>';

        html += '<div class="calendar-day-hours">';

        for (let hour = 8; hour <= 18; hour++) {
            const hourStr = `${String(hour).padStart(2, '0')}:00`;
            const hourEvents = events.filter(e => {
                const startHour = parseInt(e.startTime.split(':')[0]);
                return startHour === hour;
            });

            html += `
                <div class="calendar-day-hour-row">
                    <div class="calendar-day-time">${hourStr}</div>
                    <div class="calendar-day-hour">
                        ${hourEvents.map(event => this.renderDayEventCard(event)).join('')}
                    </div>
                </div>
            `;
        }

        html += '</div>';

        dayDiv.innerHTML = html;

        // Attach event listeners
        dayDiv.querySelectorAll('.calendar-event-card').forEach(card => {
            card.addEventListener('click', () => {
                this.editEventModal(card.dataset.eventId);
            });
        });
    }

    renderDayEventCard(event) {
        const color = event.color || this.colors[event.type] || '#64748b';
        return `
            <div class="calendar-event-card"
                 data-event-id="${event.id}"
                 style="border-left-color: ${color};">
                <div class="calendar-event-card-type">${event.type}</div>
                <div class="calendar-event-card-title">${event.title}</div>
                <div class="calendar-event-card-time">⏰ ${event.startTime} - ${event.endTime}</div>
                ${event.customerName ? `<div class="calendar-event-card-customer">👤 ${event.customerName}</div>` : ''}
                ${event.location ? `<div class="calendar-event-card-customer">📍 ${event.location}</div>` : ''}
                <div class="calendar-status-badge calendar-status-${event.status || 'geplant'}">${event.status || 'geplant'}</div>
            </div>
        `;
    }

    getEventsForDate(dateStr) {
        const events = [];

        // Get from calendar service
        if (window.calendarService) {
            events.push(...window.calendarService.getAppointmentsForDay(dateStr));
        }

        return events;
    }

    getAuftragDeadlines(dateStr) {
        const deadlines = [];

        // Get from store service
        if (window.storeService) {
            const auftraege = window.storeService.state.auftraege || [];
            auftraege.forEach(auftrag => {
                if (auftrag.endDatum && auftrag.endDatum.split('T')[0] === dateStr) {
                    const today = new Date().toISOString().split('T')[0];
                    const isOverdue = auftrag.endDatum < today;

                    deadlines.push({
                        id: 'deadline-' + auftrag.id,
                        title: `📋 ${auftrag.id}`,
                        type: 'auftrag',
                        color: isOverdue ? '#ef4444' : '#f59e0b',
                        status: auftrag.status
                    });
                }
            });
        }

        return deadlines;
    }

    openEventModal(presetHour = null) {
        const modal = document.getElementById('calendar-modal');
        document.getElementById('modal-title').textContent = 'Neuer Termin';
        document.getElementById('btn-modal-delete').style.display = 'none';

        // Clear form
        document.getElementById('calendar-event-form').reset();

        // Set date
        const dateInput = document.getElementById('form-date');
        const dateStr = this.selectedDate
            ? this.selectedDate.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        dateInput.value = dateStr;

        // Set time
        if (presetHour !== null) {
            document.getElementById('form-starttime').value = `${String(presetHour).padStart(2, '0')}:00`;
            document.getElementById('form-endtime').value = `${String(presetHour + 1).padStart(2, '0')}:00`;
        } else {
            const now = new Date();
            const currentHour = String(now.getHours()).padStart(2, '0');
            document.getElementById('form-starttime').value = `${currentHour}:00`;
            document.getElementById('form-endtime').value = `${String(now.getHours() + 1).padStart(2, '0')}:00`;
        }

        // Reset color picker
        document.querySelectorAll('.calendar-color-option').forEach(o => o.classList.remove('selected'));
        document.querySelector('[data-value="termin"]').classList.add('selected');
        document.getElementById('form-type').value = 'termin';

        this.editingEvent = null;
        modal.classList.add('active');
    }

    editEventModal(eventId) {
        const modal = document.getElementById('calendar-modal');
        const event = window.calendarService?.getAppointment(eventId);

        if (!event) {
            console.error('Event not found:', eventId);
            return;
        }

        document.getElementById('modal-title').textContent = 'Termin bearbeiten';
        document.getElementById('btn-modal-delete').style.display = 'block';

        // Populate form
        document.getElementById('form-title').value = event.title || '';
        document.getElementById('form-customer').value = event.customerName || '';
        document.getElementById('form-type').value = event.type || 'termin';
        document.getElementById('form-date').value = event.date || '';
        document.getElementById('form-starttime').value = event.startTime || '';
        document.getElementById('form-endtime').value = event.endTime || '';
        document.getElementById('form-location').value = event.location || '';
        document.getElementById('form-description').value = event.notes || '';
        document.getElementById('form-reminder').value = event.reminderMinutes || 30;

        // Set color
        document.querySelectorAll('.calendar-color-option').forEach(o => o.classList.remove('selected'));
        const typeOption = document.querySelector(`[data-value="${event.type}"]`);
        if (typeOption) {typeOption.classList.add('selected');}

        // Delete button
        document.getElementById('btn-modal-delete').onclick = () => {
            if (confirm('Termin wirklich löschen?')) {
                window.calendarService.deleteAppointment(eventId);
                this.closeEventModal();
                this.renderCurrentView();
            }
        };

        this.editingEvent = eventId;
        modal.classList.add('active');
    }

    closeEventModal() {
        document.getElementById('calendar-modal').classList.remove('active');
        this.editingEvent = null;
    }

    saveEvent(e) {
        e.preventDefault();

        const formData = {
            title: document.getElementById('form-title').value,
            customerName: document.getElementById('form-customer').value,
            type: document.getElementById('form-type').value,
            date: document.getElementById('form-date').value,
            startTime: document.getElementById('form-starttime').value,
            endTime: document.getElementById('form-endtime').value,
            location: document.getElementById('form-location').value,
            notes: document.getElementById('form-description').value,
            reminderMinutes: parseInt(document.getElementById('form-reminder').value) || 0,
            status: 'geplant'
        };

        if (this.editingEvent) {
            // Update
            window.calendarService.updateAppointment(this.editingEvent, formData);
        } else {
            // Create new
            window.calendarService.addAppointment(formData);
        }

        this.closeEventModal();
        this.renderCurrentView();

        // Show success message
        if (window.notificationService) {
            window.notificationService.show(
                this.editingEvent ? 'Termin aktualisiert' : 'Termin erstellt',
                'success'
            );
        }
    }

    previousPeriod() {
        if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        } else if (this.currentView === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() - 1);
        }
        this.renderCurrentView();
    }

    nextPeriod() {
        if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        } else if (this.currentView === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() + 1);
        }
        this.renderCurrentView();
    }

    goToToday() {
        this.currentDate = new Date();
        this.renderCurrentView();
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    exportICS() {
        const events = window.calendarService?.appointments || [];

        let icsContent = 'BEGIN:VCALENDAR\n';
        icsContent += 'VERSION:2.0\n';
        icsContent += 'PRODID:-//FreyAI Visions//Calendar Export//EN\n';
        icsContent += 'CALSCALE:GREGORIAN\n';
        icsContent += 'METHOD:PUBLISH\n';

        events.forEach(event => {
            if (event.status === 'abgesagt') {return;}

            const startDate = event.date.replace(/-/g, '');
            const startTime = event.startTime.replace(/:/g, '');
            const endTime = event.endTime.replace(/:/g, '');

            icsContent += 'BEGIN:VEVENT\n';
            icsContent += `UID:${event.id}@freyai-visions.local\n`;
            icsContent += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
            icsContent += `DTSTART:${startDate}T${startTime}00\n`;
            icsContent += `DTEND:${startDate}T${endTime}00\n`;
            icsContent += `SUMMARY:${this.escapeICSField(event.title)}\n`;
            icsContent += `DESCRIPTION:${this.escapeICSField(event.description || '')}\n`;
            if (event.location) {
                icsContent += `LOCATION:${this.escapeICSField(event.location)}\n`;
            }
            icsContent += `STATUS:${event.status === 'bestaetigt' ? 'CONFIRMED' : 'TENTATIVE'}\n`;
            icsContent += 'END:VEVENT\n';
        });

        icsContent += 'END:VCALENDAR';

        // Download file
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `calendar-${new Date().toISOString().split('T')[0]}.ics`;
        link.click();
    }

    escapeICSField(field) {
        return field
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/,/g, '\\,')
            .replace(/;/g, '\\;');
    }
}

// Initialize globally
window.calendarUIService = new CalendarUIService();
