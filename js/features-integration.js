/* ============================================
   New Features Integration
   Render functions and event handlers for new services
   ============================================ */

// ============================================
// Email View
// ============================================
function renderEmails() {
    const container = document.getElementById('email-list');
    if (!container || !window.emailService) return;

    const emails = window.emailService.getAllEmails();

    // Update stats
    const unreadEl = document.getElementById('emails-unread');
    const anfragenEl = document.getElementById('emails-anfragen');
    const badgeEl = document.getElementById('emails-badge');

    if (unreadEl) unreadEl.textContent = window.emailService.getUnreadCount();
    if (anfragenEl) anfragenEl.textContent = emails.filter(e => e.category === 'anfrage').length;
    if (badgeEl) badgeEl.textContent = window.emailService.getUnreadCount();

    if (emails.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine E-Mails. Klicke "Demo-Mails laden" zum Testen.</p>';
        return;
    }

    container.innerHTML = emails.map(email => `
        <div class="email-item ${email.read ? '' : 'unread'}" data-id="${email.id}">
            <div class="email-category-icon">${window.emailService.getCategoryIcon(email.category)}</div>
            <div class="email-content">
                <div class="email-sender">${email.fromName}</div>
                <div class="email-subject">${email.subject}</div>
                <div class="email-preview">${email.body.substring(0, 100)}...</div>
                <div class="email-actions">
                    <button class="btn btn-small btn-primary" onclick="createTaskFromEmail('${email.id}')">📋 Aufgabe erstellen</button>
                    <button class="btn btn-small btn-secondary" onclick="createAnfrageFromEmail('${email.id}')">📥 Als Anfrage</button>
                </div>
            </div>
            <div class="email-meta">
                <div>${window.emailService.getRelativeTime(email.date)}</div>
                <div class="status-badge">${window.emailService.getCategoryLabel(email.category)}</div>
            </div>
        </div>
    `).join('');

    // Click handlers
    container.querySelectorAll('.email-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            const id = item.dataset.id;
            window.emailService.markAsRead(id);
            renderEmails();
        });
    });
}

function createTaskFromEmail(emailId) {
    const email = window.emailService.emails.find(e => e.id === emailId);
    if (email && window.taskService && window.emailService) {
        const task = window.taskService.generateTasksFromEmail(email, window.emailService);
        showToast('Aufgabe erstellt: ' + task.title, 'success');
        renderEmails();
        renderTasks();
    }
}

function createAnfrageFromEmail(emailId) {
    const email = window.emailService.emails.find(e => e.id === emailId);
    if (email && window.emailService) {
        const anfrage = window.emailService.createAnfrageFromEmail(email);
        store.anfragen.push(anfrage);
        saveStore();
        showToast('Anfrage erstellt von E-Mail', 'success');
        renderEmails();
        renderAnfragen();
        updateDashboard();
    }
}

function initEmails() {
    document.getElementById('btn-load-demo-emails')?.addEventListener('click', () => {
        const demoEmails = window.emailService.getDemoEmails();
        demoEmails.forEach(email => window.emailService.addEmail(email));
        renderEmails();
        showToast('Demo-Mails geladen', 'info');
    });

    document.getElementById('btn-refresh-emails')?.addEventListener('click', () => {
        renderEmails();
        showToast('E-Mails aktualisiert', 'info');
    });
}

// ============================================
// Tasks View (Kanban)
// ============================================
function renderTasks() {
    if (!window.taskService) return;

    const stats = window.taskService.getStatistics();
    const kanban = window.taskService.getKanbanData();

    // Update stats
    document.getElementById('tasks-open')?.textContent && (document.getElementById('tasks-open').textContent = stats.open);
    document.getElementById('tasks-overdue')?.textContent && (document.getElementById('tasks-overdue').textContent = stats.overdue);
    document.getElementById('tasks-today')?.textContent && (document.getElementById('tasks-today').textContent = stats.dueToday);
    document.getElementById('tasks-done')?.textContent && (document.getElementById('tasks-done').textContent = stats.completed);

    const badge = document.getElementById('aufgaben-badge');
    if (badge) badge.textContent = stats.open + stats.overdue;

    // Render Kanban columns
    ['offen', 'in_bearbeitung', 'warten', 'erledigt'].forEach(status => {
        const container = document.getElementById(`kanban-${status}`);
        if (!container) return;

        const tasks = kanban[status] || [];
        container.innerHTML = tasks.map(task => `
            <div class="kanban-task" data-id="${task.id}">
                <div class="kanban-task-priority">${window.taskService.getPriorityIcon(task.priority)}</div>
                <div class="kanban-task-title">${task.title}</div>
                <div class="kanban-task-meta">
                    <span>${task.dueDate ? window.taskService.formatDate(task.dueDate) : ''}</span>
                    ${task.customer?.name ? `<span>👤 ${task.customer.name}</span>` : ''}
                </div>
            </div>
        `).join('');

        // Click handlers
        container.querySelectorAll('.kanban-task').forEach(item => {
            item.addEventListener('click', () => {
                const task = window.taskService.getTask(item.dataset.id);
                if (task) {
                    // Simple status cycling for now
                    const statusOrder = ['offen', 'in_bearbeitung', 'warten', 'erledigt'];
                    const currentIndex = statusOrder.indexOf(task.status);
                    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
                    window.taskService.updateTask(task.id, { status: nextStatus });
                    renderTasks();
                    showToast(`Aufgabe auf "${window.taskService.getStatusLabel(nextStatus)}" gesetzt`, 'info');
                }
            });
        });
    });
}

function initTasks() {
    document.getElementById('btn-neue-aufgabe')?.addEventListener('click', () => {
        const title = prompt('Aufgabentitel:');
        if (title) {
            window.taskService.addTask({
                title: title,
                priority: 'normal',
                dueDate: new Date().toISOString().split('T')[0]
            });
            renderTasks();
            showToast('Aufgabe erstellt', 'success');
        }
    });
}

// ============================================
// Customers View
// ============================================
function renderCustomers() {
    const container = document.getElementById('customers-list');
    if (!container || !window.customerService) return;

    const customers = window.customerService.getAllCustomers();

    // Update stats
    document.getElementById('customers-total')?.textContent && (document.getElementById('customers-total').textContent = customers.length);
    document.getElementById('customers-active')?.textContent && (document.getElementById('customers-active').textContent = window.customerService.getActiveCustomers().length);

    const badge = document.getElementById('kunden-badge');
    if (badge) badge.textContent = customers.length;

    if (customers.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine Kunden vorhanden</p>';
        return;
    }

    container.innerHTML = customers.map(c => `
        <div class="customer-card" data-id="${c.id}">
            <div class="customer-avatar">${(c.name || '?').charAt(0).toUpperCase()}</div>
            <div class="customer-name">${c.name || 'Unbekannt'}</div>
            <div class="customer-company">${c.firma || ''}</div>
            <div class="customer-contact">
                ${c.email ? `<a href="mailto:${c.email}">📧 ${c.email}</a>` : ''}
                ${c.telefon ? `<a href="tel:${c.telefon}" onclick="window.phoneService?.makeCall('${c.telefon}', {id:'${c.id}',name:'${c.name}'})">📞 ${c.telefon}</a>` : ''}
            </div>
            <div class="customer-stats-inline">
                <span>💰 ${formatCurrency(c.umsatzGesamt || 0)}</span>
                <span>📦 ${c.anzahlAuftraege || 0} Aufträge</span>
            </div>
        </div>
    `).join('');
}

function initCustomers() {
    document.getElementById('btn-neuer-kunde')?.addEventListener('click', () => {
        const name = prompt('Kundenname:');
        if (name) {
            window.customerService.addCustomer({ name: name });
            renderCustomers();
            showToast('Kunde erstellt', 'success');
        }
    });

    document.getElementById('customer-search')?.addEventListener('input', (e) => {
        const query = e.target.value;
        const container = document.getElementById('customers-list');
        if (!query) {
            renderCustomers();
            return;
        }
        const results = window.customerService.searchCustomers(query);
        // Re-render with filtered results
        container.innerHTML = results.map(c => `
            <div class="customer-card">
                <div class="customer-avatar">${(c.name || '?').charAt(0).toUpperCase()}</div>
                <div class="customer-name">${c.name}</div>
                <div class="customer-company">${c.firma || ''}</div>
            </div>
        `).join('');
    });

    document.getElementById('customer-csv-import')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const result = window.customerService.importFromCSV(ev.target.result);
                showToast(`${result.success} Kunden importiert`, 'success');
                renderCustomers();
            };
            reader.readAsText(file);
        }
    });
}

// ============================================
// Calendar View
// ============================================
let calendarStartDate = new Date();

function renderCalendar() {
    const container = document.getElementById('calendar-week');
    const header = document.getElementById('calendar-header');
    if (!container || !window.calendarService) return;

    // Set start to Monday
    const start = new Date(calendarStartDate);
    start.setDate(start.getDate() - start.getDay() + 1);

    const weekData = window.calendarService.getWeekViewData(start.toISOString().split('T')[0]);

    if (header) {
        const endDate = new Date(start);
        endDate.setDate(endDate.getDate() + 6);
        header.innerHTML = `<span class="calendar-title">${start.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>`;
    }

    container.innerHTML = weekData.map(day => `
        <div class="calendar-day ${day.isToday ? 'is-today' : ''}">
            <div class="calendar-day-header">
                <span class="calendar-day-name">${day.dayName}</span>
                <span class="calendar-day-number">${day.dayNumber}</span>
            </div>
            <div class="calendar-events">
                ${day.appointments.map(apt => `
                    <div class="calendar-event" style="border-color: ${apt.color || '#6366f1'}">
                        <strong>${apt.startTime}</strong> ${apt.title}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function initCalendar() {
    document.getElementById('btn-prev-week')?.addEventListener('click', () => {
        calendarStartDate.setDate(calendarStartDate.getDate() - 7);
        renderCalendar();
    });

    document.getElementById('btn-next-week')?.addEventListener('click', () => {
        calendarStartDate.setDate(calendarStartDate.getDate() + 7);
        renderCalendar();
    });

    document.getElementById('btn-today')?.addEventListener('click', () => {
        calendarStartDate = new Date();
        renderCalendar();
    });

    document.getElementById('btn-neuer-termin')?.addEventListener('click', () => {
        const title = prompt('Termintitel:');
        if (title) {
            const dateStr = prompt('Datum (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
            const timeStr = prompt('Uhrzeit (HH:MM):', '09:00');
            if (dateStr && timeStr) {
                window.calendarService.addAppointment({
                    title: title,
                    date: dateStr,
                    startTime: timeStr,
                    endTime: window.calendarService.minutesToTime(window.calendarService.timeToMinutes(timeStr) + 60)
                });
                renderCalendar();
                showToast('Termin erstellt', 'success');
            }
        }
    });
}

// ============================================
// Time Tracking View
// ============================================
let clockInterval = null;

function renderTimeTracking() {
    const display = document.getElementById('time-clock-display');
    const entriesList = document.getElementById('time-entries-list');
    if (!window.timeTrackingService) return;

    const isActive = window.timeTrackingService.isClockActive();
    const timer = window.timeTrackingService.getActiveTimer();
    const today = new Date().toISOString().split('T')[0];
    const entries = window.timeTrackingService.getEntriesForDay(today);

    // Update clock display
    if (display) {
        display.className = 'time-clock-display' + (isActive ? ' active' : '');
        display.querySelector('.clock-status').textContent = isActive ? 'Eingestempelt seit ' + timer.startTime : 'Nicht eingestempelt';
        display.querySelector('.clock-timer').textContent = isActive ? timer.elapsedFormatted : '00:00';
    }

    // Update toggle button
    const toggleBtn = document.getElementById('btn-clock-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = isActive ? '⏹️ Ausstempeln' : '▶️ Einstempeln';
        toggleBtn.className = isActive ? 'btn btn-danger btn-large' : 'btn btn-success btn-large';
    }

    // Update stats
    document.getElementById('time-today')?.textContent && (document.getElementById('time-today').textContent = window.timeTrackingService.formatDuration(window.timeTrackingService.getTotalHoursForDay(today) * 60).replace(':undefined', ''));

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    document.getElementById('time-week')?.textContent && (document.getElementById('time-week').textContent = window.timeTrackingService.getTotalHoursForWeek(weekStart.toISOString().split('T')[0]).toFixed(1) + 'h');

    // Render entries
    if (entriesList) {
        if (entries.length === 0) {
            entriesList.innerHTML = '<p class="empty-state">Keine Zeiteinträge für heute</p>';
        } else {
            entriesList.innerHTML = entries.map(e => `
                <div class="item-card">
                    <div class="item-header">
                        <span class="item-title">${e.startTime} - ${e.endTime}</span>
                        <span class="status-badge">${e.durationHours}h</span>
                    </div>
                    <div class="item-description">${e.description || 'Keine Beschreibung'}</div>
                </div>
            `).join('');
        }
    }
}

function initTimeTracking() {
    document.getElementById('btn-clock-toggle')?.addEventListener('click', () => {
        const isActive = window.timeTrackingService.isClockActive();
        if (isActive) {
            const notes = prompt('Notizen zur Arbeit:', '');
            window.timeTrackingService.clockOut('default', notes || '');
            clearInterval(clockInterval);
            showToast('Ausgestempelt', 'success');
        } else {
            window.timeTrackingService.clockIn();
            // Start timer update
            clockInterval = setInterval(() => {
                const display = document.getElementById('time-clock-display');
                const timer = window.timeTrackingService.getActiveTimer();
                if (display && timer) {
                    display.querySelector('.clock-timer').textContent = timer.elapsedFormatted;
                }
            }, 1000);
            showToast('Eingestempelt', 'success');
        }
        renderTimeTracking();
    });

    // Restore timer if active
    if (window.timeTrackingService?.isClockActive()) {
        clockInterval = setInterval(() => {
            const display = document.getElementById('time-clock-display');
            const timer = window.timeTrackingService.getActiveTimer();
            if (display && timer) {
                display.querySelector('.clock-timer').textContent = timer.elapsedFormatted;
            }
        }, 1000);
    }
}

// ============================================
// Documents View
// ============================================
function renderDocuments() {
    const container = document.getElementById('documents-list');
    if (!container || !window.documentService) return;

    const docs = window.documentService.getAllDocuments();

    document.getElementById('docs-total')?.textContent && (document.getElementById('docs-total').textContent = docs.length);
    document.getElementById('docs-receipts')?.textContent && (document.getElementById('docs-receipts').textContent = docs.filter(d => d.category === 'quittung').length);

    if (docs.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine Dokumente. Scanne oder lade ein Dokument hoch.</p>';
        return;
    }

    container.innerHTML = docs.map(doc => `
        <div class="document-card" data-id="${doc.id}">
            <div class="document-icon">${window.documentService.getCategoryIcon(doc.category)}</div>
            <div class="document-name">${doc.name}</div>
            <div class="document-meta">
                ${window.documentService.getCategoryLabel(doc.category)} • 
                ${new Date(doc.createdAt).toLocaleDateString('de-DE')}
            </div>
        </div>
    `).join('');
}

function initDocuments() {
    document.getElementById('btn-scan-document')?.addEventListener('click', async () => {
        const result = await window.documentService.scanAndProcess({ fromCamera: true });
        if (result.success) {
            showToast('Dokument gescannt und verarbeitet', 'success');
            renderDocuments();

            // If receipt data extracted, offer to create Ausgabe
            if (result.extractedData?.betrag) {
                if (confirm(`Betrag ${result.extractedData.betrag}€ erkannt. Als Ausgabe erfassen?`)) {
                    const buchung = window.documentService.createBuchungFromScan(result.document);
                    if (buchung && window.bookkeepingService) {
                        window.bookkeepingService.addAusgabe(buchung);
                        showToast('Ausgabe erfasst', 'success');
                    }
                }
            }
        } else {
            showToast('Fehler: ' + result.error, 'error');
        }
    });

    document.getElementById('btn-upload-document')?.addEventListener('click', async () => {
        const result = await window.documentService.scanAndProcess({ fromCamera: false });
        if (result.success) {
            showToast('Dokument hochgeladen', 'success');
            renderDocuments();
        }
    });

    document.getElementById('document-search')?.addEventListener('input', (e) => {
        const query = e.target.value;
        if (!query) {
            renderDocuments();
            return;
        }
        const results = window.documentService.searchDocuments(query);
        const container = document.getElementById('documents-list');
        container.innerHTML = results.map(doc => `
            <div class="document-card">
                <div class="document-icon">${window.documentService.getCategoryIcon(doc.category)}</div>
                <div class="document-name">${doc.name}</div>
            </div>
        `).join('');
    });
}

// ============================================
// Reports View
// ============================================
let selectedReportType = 'sales';

function initReports() {
    // Set default dates
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('report-start-date')?.setAttribute('value', startOfMonth.toISOString().split('T')[0]);
    document.getElementById('report-end-date')?.setAttribute('value', today.toISOString().split('T')[0]);

    // Report type selection
    document.querySelectorAll('.report-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.report-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedReportType = card.dataset.report;
        });
    });

    // Generate report
    document.getElementById('btn-generate-report')?.addEventListener('click', () => {
        generateReport();
    });
}

function generateReport() {
    const startDate = document.getElementById('report-start-date')?.value;
    const endDate = document.getElementById('report-end-date')?.value;
    const output = document.getElementById('report-output');

    if (!output || !window.reportService) return;

    let report;
    switch (selectedReportType) {
        case 'sales':
            report = window.reportService.generateSalesReport(startDate, endDate);
            break;
        case 'customer':
            report = window.reportService.generateCustomerReport(startDate, endDate);
            break;
        case 'time':
            report = window.reportService.generateTimeReport(startDate, endDate);
            break;
        case 'tasks':
            report = window.reportService.generateTaskReport(startDate, endDate);
            break;
        case 'bookkeeping':
            report = window.reportService.generateBookkeepingReport(new Date().getFullYear());
            break;
    }

    if (!report) {
        output.innerHTML = '<p class="empty-state">Bericht konnte nicht erstellt werden</p>';
        return;
    }

    // Render report
    let html = `<h3>${report.title}</h3>`;
    html += `<p style="color: var(--text-muted); margin-bottom: 24px;">Zeitraum: ${report.period?.start || report.year} - ${report.period?.end || ''}</p>`;

    html += '<div class="report-summary">';
    for (const [key, value] of Object.entries(report.summary || {})) {
        const displayValue = typeof value === 'number' && key.includes('umsatz') || key.includes('einnahmen') || key.includes('ausgaben') || key.includes('gewinn')
            ? formatCurrency(value)
            : value;
        html += `<div class="report-stat"><div class="report-stat-value">${displayValue}</div><div class="report-stat-label">${key}</div></div>`;
    }
    html += '</div>';

    html += `<button class="btn btn-secondary" onclick="exportReportCSV()">📥 Als CSV exportieren</button>`;

    output.innerHTML = html;
}

function exportReportCSV() {
    showToast('CSV Export (Demo)', 'info');
}

// ============================================
// AI Assistant (Native/Ollama Style)
// ============================================

function renderChatbot() {
    if (!window.llmService) return;
    initAIModelSelector();
}

async function initAIModelSelector() {
    const select = document.getElementById('ai-model-select');
    if (!select) return;

    const models = await window.llmService.getAvailableModels();
    if (models.length > 0) {
        select.innerHTML = models.map(m => `<option value="${window.UI.sanitize(m.name)}" ${m.name === window.llmService.config.ollamaModel ? 'selected' : ''}>${window.UI.sanitize(m.name)}</option>`).join('');
    }
}

async function sendAiMessage() {
    const input = document.getElementById('ai-chat-input');
    const container = document.getElementById('ai-chat-messages');
    const message = input.value.trim();

    if (!message) return;

    // Remove empty state if still there
    const emptyState = container.querySelector('.ai-empty-state');
    if (emptyState) emptyState.remove();

    // 1. Add User Message
    appendAiMessage('user', message);
    input.value = '';

    // 2. Show Typing Indicator
    const typing = document.createElement('div');
    typing.className = 'ai-typing';
    typing.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    // 3. Get AI Response
    try {
        const history = window.chatbotService.conversations[0]?.messages || []; // Use first conv for history or empty
        const response = await window.chatbotService.generateResponse(message, history, {});

        typing.remove();
        appendAiMessage('bot', response);
    } catch (e) {
        typing.remove();
        appendAiMessage('bot', "⚠️ Fehler bei der Verbindung zur KI. Bitte prüfen Sie die Einstellungen.");
    }
}

function appendAiMessage(role, content) {
    const container = document.getElementById('ai-chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-message ${role}`;
    msgDiv.innerHTML = content.replace(/\n/g, '<br>');
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function initChatbot() {
    const btnSend = document.getElementById('btn-send-ai');
    const input = document.getElementById('ai-chat-input');

    btnSend?.addEventListener('click', sendAiMessage);
    input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAiMessage();
    });

    // Auto-refresh model list occasionally
    setInterval(initAIModelSelector, 30000);
}

// ============================================
// Extended switchView
// ============================================
const originalSwitchViewNew = typeof switchViewExtended !== 'undefined' ? switchViewExtended : (typeof switchView !== 'undefined' ? switchView : null);

function switchViewNew(viewId) {
    // Call original if exists
    if (originalSwitchViewNew) {
        originalSwitchViewNew(viewId);
    } else {
        // Basic view switching
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById(`view-${viewId}`)?.classList.add('active');
        document.querySelector(`[data-view="${viewId}"]`)?.classList.add('active');
    }

    // Render new views
    switch (viewId) {
        case 'emails': renderEmails(); break;
        case 'aufgaben': renderTasks(); break;
        case 'kunden': renderCustomers(); break;
        case 'kalender': renderCalendar(); break;
        case 'zeiterfassung': renderTimeTracking(); break;
        case 'dokumente': renderDocuments(); break;
        case 'berichte': initReports(); break;
        case 'chatbot': renderChatbot(); break;
    }
}

// Override switchView
if (typeof switchViewExtended !== 'undefined') {
    switchViewExtended = switchViewNew;
} else if (typeof switchView !== 'undefined') {
    switchView = switchViewNew;
}

// ============================================
// Initialize all new features
// ============================================
function initNewFeatures() {
    initEmails();
    initTasks();
    initCustomers();
    initCalendar();
    initTimeTracking();
    initDocuments();
    initReports();
    initChatbot();

    console.log('✅ Neue Features initialisiert:', [
        'EmailService', 'TaskService', 'CustomerService', 'DocumentService',
        'CalendarService', 'BookingService', 'TimeTrackingService',
        'CommunicationService', 'PhoneService', 'ReportService', 'ChatbotService'
    ].filter(s => window[s.charAt(0).toLowerCase() + s.slice(1)]));
}

// Auto-init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewFeatures);
} else {
    // Small delay to ensure other scripts loaded
    setTimeout(initNewFeatures, 100);
}

