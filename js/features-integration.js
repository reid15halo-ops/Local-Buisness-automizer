/* ============================================
   New Features Integration
   Render functions and event handlers for new services
   ============================================ */

// ============================================
// Email View
// ============================================
function renderEmails() {
    const container = document.getElementById('email-list');
    if (!container || !window.emailService) {return;}

    const emails = window.emailService.getAllEmails();

    // Update stats
    const unreadEl = document.getElementById('emails-unread');
    const anfragenEl = document.getElementById('emails-anfragen');
    const badgeEl = document.getElementById('emails-badge');

    if (unreadEl) {unreadEl.textContent = window.emailService.getUnreadCount();}
    if (anfragenEl) {anfragenEl.textContent = emails.filter(e => e.category === 'anfrage').length;}
    if (badgeEl) {badgeEl.textContent = window.emailService.getUnreadCount();}

    if (emails.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine E-Mails. Klicke "Demo-Mails laden" zum Testen.</p>';
        return;
    }

    const sanitize = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));
    container.innerHTML = emails.map(email => `
        <div class="email-item ${email.read ? '' : 'unread'}" data-id="${sanitize(email.id)}">
            <div class="email-category-icon">${sanitize(window.emailService.getCategoryIcon(email.category))}</div>
            <div class="email-content">
                <div class="email-sender">${sanitize(email.fromName)}</div>
                <div class="email-subject">${sanitize(email.subject)}</div>
                <div class="email-preview">${sanitize(email.body.substring(0, 100))}...</div>
                <div class="email-actions">
                    <button class="btn btn-small btn-primary" onclick="createTaskFromEmail('${sanitize(email.id)}')">📋 Aufgabe erstellen</button>
                    <button class="btn btn-small btn-secondary" onclick="createAnfrageFromEmail('${sanitize(email.id)}')">📥 Als Anfrage</button>
                </div>
            </div>
            <div class="email-meta">
                <div>${sanitize(window.emailService.getRelativeTime(email.date))}</div>
                <div class="status-badge">${sanitize(window.emailService.getCategoryLabel(email.category))}</div>
            </div>
        </div>
    `).join('');

    // Click handlers
    container.querySelectorAll('.email-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('button')) {return;}
            const id = item.dataset.id;
            window.emailService.markAsRead(id);
            renderEmails();
        });
    });
}

window.createTaskFromEmail = createTaskFromEmail;
function createTaskFromEmail(emailId) {
    const email = window.emailService.emails.find(e => e.id === emailId);
    if (email && window.taskService && window.emailService) {
        const task = window.taskService.generateTasksFromEmail(email, window.emailService);
        showToast('Aufgabe erstellt: ' + task.title, 'success');
        renderEmails();
        renderTasks();
    }
}

window.createAnfrageFromEmail = createAnfrageFromEmail;
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
    document.getElementById('btn-load-demo-emails')?.addEventListener('click', async () => {
        // Guard: Require confirmation in production mode
        if (window.demoGuardService && !window.demoGuardService.isDeveloperMode) {
            const confirmed = await window.demoGuardService.confirmDemoLoad('Demo-E-Mails laden');
            if (!confirmed) {return;}
        }

        const demoEmails = window.emailService.getDemoEmails();
        demoEmails.forEach(email => window.emailService.addEmail(email));
        renderEmails();
        showToast('Demo-Mails geladen', 'info');

        // Show demo mode banner
        if (window.demoGuardService) {
            window.demoGuardService.showDemoBanner();
            window.demoGuardService.markDemoLoaded();
        }
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
    if (!window.taskService) {return;}

    const stats = window.taskService.getStatistics();
    const kanban = window.taskService.getKanbanData();

    // Update stats
    document.getElementById('tasks-open')?.textContent && (document.getElementById('tasks-open').textContent = stats.open);
    document.getElementById('tasks-overdue')?.textContent && (document.getElementById('tasks-overdue').textContent = stats.overdue);
    document.getElementById('tasks-today')?.textContent && (document.getElementById('tasks-today').textContent = stats.dueToday);
    document.getElementById('tasks-done')?.textContent && (document.getElementById('tasks-done').textContent = stats.completed);

    const badge = document.getElementById('aufgaben-badge');
    if (badge) {badge.textContent = stats.open + stats.overdue;}

    // Render Kanban columns
    ['offen', 'in_bearbeitung', 'warten', 'erledigt'].forEach(status => {
        const container = document.getElementById(`kanban-${status}`);
        if (!container) {return;}

        const tasks = kanban[status] || [];
        const san = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));
        container.innerHTML = tasks.map(task => `
            <div class="kanban-task" data-id="${san(task.id)}">
                <div class="kanban-task-priority">${window.taskService.getPriorityIcon(task.priority)}</div>
                <div class="kanban-task-title">${san(task.title)}</div>
                <div class="kanban-task-meta">
                    <span>${task.dueDate ? window.taskService.formatDate(task.dueDate) : ''}</span>
                    ${task.customer?.name ? `<span>👤 ${san(task.customer.name)}</span>` : ''}
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
    if (!container || !window.customerService) {return;}

    const customers = window.customerService.getAllCustomers();

    // Update stats
    document.getElementById('customers-total')?.textContent && (document.getElementById('customers-total').textContent = customers.length);
    document.getElementById('customers-active')?.textContent && (document.getElementById('customers-active').textContent = window.customerService.getActiveCustomers().length);

    const badge = document.getElementById('kunden-badge');
    if (badge) {badge.textContent = customers.length;}

    if (customers.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine Kunden vorhanden</p>';
        return;
    }

    const esc = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));
    // Use Supabase portal if available, fall back to localStorage-based portal
    const useSupabasePortal = !!window.portalService && window.supabaseConfig?.isConfigured?.();
    const portalPage = useSupabasePortal ? 'portal.html' : 'customer-portal.html';
    const portalBase = window.location.origin
        + window.location.pathname.replace('index.html', '')
        + portalPage;

    container.innerHTML = customers.map(c => {
        // Check for an existing active portal token (Supabase cache)
        const existingToken = (window.customerPortalService?.tokens || []).find(
            t => t.customerId === c.id && t.isActive
        );
        const portalActive = !!existingToken;
        const portalBadge = portalActive
            ? `<span style="display:inline-block;background:#34c759;color:#fff;font-size:10px;border-radius:4px;padding:1px 5px;margin-left:6px;">Portal aktiv</span>`
            : '';

        return `
        <div class="customer-card" data-id="${esc(c.id)}">
            <div class="customer-avatar">${esc((c.name || '?').charAt(0).toUpperCase())}</div>
            <div class="customer-name">${esc(c.name || 'Unbekannt')}${portalBadge}</div>
            <div class="customer-company">${esc(c.firma || '')}</div>
            <div class="customer-contact">
                ${c.email ? `<a href="mailto:${esc(c.email)}">📧 ${esc(c.email)}</a>` : ''}
                ${c.telefon ? `<a href="tel:${esc(c.telefon)}" data-phone="${esc(c.telefon)}" data-customer-id="${esc(c.id)}" data-customer-name="${esc(c.name)}" class="phone-call-link">📞 ${esc(c.telefon)}</a>` : ''}
            </div>
            <div class="customer-stats-inline">
                <span>💰 ${formatCurrency(c.umsatzGesamt || 0)}</span>
                <span>📦 ${c.anzahlAuftraege || 0} Aufträge</span>
            </div>
            <div class="customer-portal-actions" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-sm btn-secondary customer-portal-btn"
                    data-customer-id="${esc(c.id)}"
                    data-customer-name="${esc(c.name || '')}"
                    title="Kundenportal öffnen">
                    🔗 Portal
                </button>
                <button class="btn btn-sm btn-secondary customer-portal-copy-btn"
                    data-customer-id="${esc(c.id)}"
                    title="Portal-Link kopieren">
                    📋 Link
                </button>
            </div>
        </div>`;
    }).join('');

    // Bind phone call handlers
    container.querySelectorAll('.phone-call-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const phone = link.dataset.phone;
            const id = link.dataset.customerId;
            const name = link.dataset.customerName;
            window.phoneService?.makeCall(phone, {id, name});
        });
    });

    // Bind customer card click to open detail modal
    container.querySelectorAll('.customer-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't open detail if clicking on a button or link
            if (e.target.closest('button, a, .customer-portal-actions')) {return;}
            const id = card.dataset.id;
            const nameEl = card.querySelector('.customer-name');
            const name = nameEl ? nameEl.textContent.trim() : '';
            if (window.openKundeDetail) {window.openKundeDetail(id, name);}
        });
        card.style.cursor = 'pointer';
    });

    // Helper: generate portal URL (Supabase or localStorage fallback)
    async function _getPortalUrl(customerId) {
        if (useSupabasePortal) {
            const { url } = await window.portalService.generateToken(customerId);
            return url;
        }
        // Fallback: Supabase-based customerPortalService
        if (!window.customerPortalService) {throw new Error('Portal-Service nicht verfügbar');}
        const existing = (window.customerPortalService.tokens || []).find(
            t => t.customerId === customerId && t.isActive
        );
        const tokenRecord = existing
            || await window.customerPortalService.generateAccessToken(customerId, 'full', { expiresInDays: 30 });
        return `${portalBase}?token=${encodeURIComponent(tokenRecord.token)}`;
    }

    // Bind portal open buttons
    container.querySelectorAll('.customer-portal-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const customerId = btn.dataset.customerId;
            try {
                const url = await _getPortalUrl(customerId);
                window.open(url, '_blank');
            } catch (err) {
                window.showToast?.('Portal-Link konnte nicht erstellt werden: ' + err.message, 'error');
                console.error('[Kunden] Portal token error:', err);
            }
        });
    });

    // Bind portal link copy buttons
    container.querySelectorAll('.customer-portal-copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const customerId = btn.dataset.customerId;
            try {
                if (useSupabasePortal) {
                    await window.portalService.copyPortalLink(customerId);
                    return;
                }
                const url = await _getPortalUrl(customerId);
                navigator.clipboard.writeText(url)
                    .then(() => window.showToast?.('Portal-Link kopiert', 'success'))
                    .catch(() => window.showToast?.(`Link: ${url}`, 'info'));
            } catch {
                window.showToast?.('Link konnte nicht kopiert werden', 'error');
            }
        });
    });
}

function _openKundeForm(customer) {
    const modal = document.getElementById('modal-kunde-form');
    if (!modal) {return;}
    const title = document.getElementById('modal-kunde-form-title');
    const editIdField = document.getElementById('kf-edit-id');

    // Reset form
    document.getElementById('kunde-form')?.reset?.();

    if (customer) {
        // Edit mode
        title.textContent = 'Kunde bearbeiten';
        editIdField.value = customer.id;
        document.getElementById('kf-name').value = customer.name || '';
        document.getElementById('kf-firma').value = customer.firma || '';
        document.getElementById('kf-email').value = customer.email || '';
        document.getElementById('kf-telefon').value = customer.telefon || '';
        document.getElementById('kf-strasse').value = customer.adresse?.strasse || '';
        document.getElementById('kf-plz').value = customer.adresse?.plz || '';
        document.getElementById('kf-ort').value = customer.adresse?.ort || '';
        document.getElementById('kf-kundentyp').value = customer.kundentyp || 'privat';
        document.getElementById('kf-leitwegId').value = customer.leitwegId || '';
        document.getElementById('kf-ustId').value = customer.ustId || '';
        document.getElementById('kf-notizen').value = customer.notizen || '';
    } else {
        title.textContent = 'Neuer Kunde';
        editIdField.value = '';
    }

    // Toggle Leitweg-ID visibility based on kundentyp
    const ktSelect = document.getElementById('kf-kundentyp');
    const lwGroup = document.getElementById('kf-leitweg-group');
    if (lwGroup) {
        lwGroup.style.display = (ktSelect?.value === 'behoerde') ? 'block' : 'none';
    }

    modal.classList.add('active');
}

function _saveKundeForm() {
    const nameVal = document.getElementById('kf-name')?.value?.trim();
    if (!nameVal) {
        showToast('Name ist ein Pflichtfeld', 'error');
        return;
    }

    const editId = document.getElementById('kf-edit-id')?.value;
    const data = {
        name: nameVal,
        firma: document.getElementById('kf-firma')?.value?.trim() || '',
        email: document.getElementById('kf-email')?.value?.trim() || '',
        telefon: document.getElementById('kf-telefon')?.value?.trim() || '',
        adresse: {
            strasse: document.getElementById('kf-strasse')?.value?.trim() || '',
            plz: document.getElementById('kf-plz')?.value?.trim() || '',
            ort: document.getElementById('kf-ort')?.value?.trim() || ''
        },
        kundentyp: document.getElementById('kf-kundentyp')?.value || 'privat',
        leitwegId: document.getElementById('kf-leitwegId')?.value?.trim() || '',
        ustId: document.getElementById('kf-ustId')?.value?.trim() || '',
        notizen: document.getElementById('kf-notizen')?.value?.trim() || ''
    };

    // Validate Leitweg-ID if provided
    if (data.leitwegId && window.eInvoiceService) {
        const v = window.eInvoiceService.validateLeitwegId(data.leitwegId);
        if (!v.valid) {
            showToast('Leitweg-ID ungueltig: ' + v.error, 'error');
            return;
        }
        // Also store in eInvoiceService mapping
        if (editId) {
            window.eInvoiceService.setCustomerLeitwegId(editId, data.leitwegId);
        }
    }

    if (editId) {
        window.customerService.updateCustomer(editId, data);
        showToast('Kunde aktualisiert', 'success');
    } else {
        const newCustomer = window.customerService.addCustomer(data);
        if (data.leitwegId && window.eInvoiceService) {
            window.eInvoiceService.setCustomerLeitwegId(newCustomer.id, data.leitwegId);
        }
        showToast('Kunde erstellt', 'success');
    }

    // Close modal and re-render
    const modal = document.getElementById('modal-kunde-form');
    if (modal) {modal.classList.remove('active');}
    renderCustomers();
}

function initCustomers() {
    document.getElementById('btn-neuer-kunde')?.addEventListener('click', () => {
        _openKundeForm(null);
    });

    // Save button in form modal
    document.getElementById('btn-kunde-speichern')?.addEventListener('click', () => {
        _saveKundeForm();
    });

    // Toggle Leitweg-ID field visibility when kundentyp changes
    document.getElementById('kf-kundentyp')?.addEventListener('change', (e) => {
        const lwGroup = document.getElementById('kf-leitweg-group');
        if (lwGroup) {
            lwGroup.style.display = (e.target.value === 'behoerde') ? 'block' : 'none';
        }
    });

    // Close modal via overlay/close buttons
    const formModal = document.getElementById('modal-kunde-form');
    if (formModal) {
        formModal.querySelector('.modal-overlay')?.addEventListener('click', () => formModal.classList.remove('active'));
        formModal.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => formModal.classList.remove('active')));
    }

    document.getElementById('customer-search')?.addEventListener('input', (e) => {
        const query = e.target.value;
        const container = document.getElementById('customers-list');
        if (!query) {
            renderCustomers();
            return;
        }
        const results = window.customerService.searchCustomers(query);
        const s = window.UI?.sanitize || window.sanitize?.escapeHtml || (v => v);
        // Re-render with filtered results
        container.innerHTML = results.map(c => `
            <div class="customer-card">
                <div class="customer-avatar">${s((c.name || '?').charAt(0).toUpperCase())}</div>
                <div class="customer-name">${s(c.name)}</div>
                <div class="customer-company">${s(c.firma || '')}</div>
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
    if (!container || !window.calendarService) {return;}

    // Set start to Monday
    const start = new Date(calendarStartDate);
    start.setDate(start.getDate() - start.getDay() + 1);

    const weekData = window.calendarService.getWeekViewData(start.toISOString().split('T')[0]);

    if (header) {
        const endDate = new Date(start);
        endDate.setDate(endDate.getDate() + 6);
        header.innerHTML = `<span class="calendar-title">${start.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>`;
    }

    // Inject Aufträge with dates into calendar
    const auftraege = window.storeService?.state?.auftraege || [];
    const auftragEvents = {};
    auftraege.forEach(a => {
        if (!a.startDatum && !a.endDatum) {return;}
        if (a.status === 'abgeschlossen') {return;}
        const startDate = a.startDatum || a.endDatum;
        const endDate = a.endDatum || a.startDatum;
        const s = new Date(startDate);
        const e = new Date(endDate);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            const key = d.toISOString().split('T')[0];
            if (!auftragEvents[key]) {auftragEvents[key] = [];}
            auftragEvents[key].push(a);
        }
    });

    container.innerHTML = weekData.map(day => {
        const dayKey = day.date;
        const dayAuftraege = auftragEvents[dayKey] || [];
        const calSan = window.UI?.sanitize || window.sanitize?.escapeHtml || (v => v);
        const auftraegeHtml = dayAuftraege.map(a => `
            <div class="calendar-event" style="border-color: #f59e0b; cursor:pointer;" onclick="window.openAuftragDetail && window.openAuftragDetail('${calSan(a.id)}')">
                <strong>🔧</strong> ${calSan(a.kunde?.name || 'Auftrag')}
            </div>
        `).join('');

        return `
            <div class="calendar-day ${day.isToday ? 'is-today' : ''}">
                <div class="calendar-day-header">
                    <span class="calendar-day-name">${day.dayName}</span>
                    <span class="calendar-day-number">${day.dayNumber}</span>
                </div>
                <div class="calendar-events">
                    ${day.appointments.map(apt => {
                        const aptSan = window.UI?.sanitize || window.sanitize?.escapeHtml || (v => v);
                        const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(apt.color) ? apt.color : '#6366f1';
                        return `<div class="calendar-event" style="border-color: ${safeColor}">
                            <strong>${aptSan(apt.startTime)}</strong> ${aptSan(apt.title)}
                        </div>`;
                    }).join('')}
                    ${auftraegeHtml}
                </div>
            </div>
        `;
    }).join('');
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
    if (!window.timeTrackingService) {return;}

    const isActive = window.timeTrackingService.isClockActive();
    const timer = window.timeTrackingService.getActiveTimer();
    const today = new Date().toISOString().split('T')[0];

    // Use filter date or today
    const filterDate = document.getElementById('te-filter-date')?.value || today;
    const entries = window.timeTrackingService.getEntriesForDay(filterDate);

    // Update clock display
    if (display) {
        display.className = 'time-clock-display' + (isActive ? ' active' : '');
        const statusEl = document.getElementById('clock-status-text');
        const timerEl = document.getElementById('clock-timer-display');
        if (statusEl) { statusEl.textContent = isActive ? 'Eingestempelt seit ' + timer.startTime : 'Nicht eingestempelt'; }
        if (timerEl) { timerEl.textContent = isActive ? timer.elapsedFormatted : '00:00'; }

        // Show project info if clocked in with a project
        const projInfo = document.getElementById('clock-project-info');
        if (projInfo && isActive && timer.projectId) {
            const auftrag = window.storeService?.state?.auftraege?.find(a => a.id === timer.projectId);
            projInfo.textContent = auftrag ? `Auftrag: ${auftrag.leistungsart || auftrag.id}` : '';
            projInfo.style.display = 'block';
        } else if (projInfo) {
            projInfo.style.display = 'none';
        }
    }

    // Update toggle button
    const toggleBtn = document.getElementById('btn-clock-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = isActive ? '⏹️ Ausstempeln' : '▶️ Einstempeln';
        toggleBtn.className = isActive ? 'btn btn-danger btn-large' : 'btn btn-success btn-large';
    }

    // Update stats
    const todayHours = window.timeTrackingService.getTotalHoursForDay(today);
    const todayEl = document.getElementById('time-today');
    if (todayEl) { todayEl.textContent = todayHours.toFixed(1) + 'h'; }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekHours = window.timeTrackingService.getTotalHoursForWeek(weekStart.toISOString().split('T')[0]);
    const weekEl = document.getElementById('time-week');
    if (weekEl) { weekEl.textContent = weekHours.toFixed(1) + 'h'; }

    const now = new Date();
    const monthEntries = window.timeTrackingService.getEntriesForMonth(now.getFullYear(), now.getMonth() + 1);
    const monthMinutes = monthEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
    const monthEl = document.getElementById('time-month');
    if (monthEl) { monthEl.textContent = (monthMinutes / 60).toFixed(1) + 'h'; }

    // Set filter date default
    const filterInput = document.getElementById('te-filter-date');
    if (filterInput && !filterInput.value) { filterInput.value = today; }

    // Populate Auftrags-Dropdown in form
    _populateAuftragSelect();

    // Render entries
    if (entriesList) {
        if (entries.length === 0) {
            entriesList.innerHTML = `<p class="empty-state">Keine Zeiteintr\u00e4ge f\u00fcr ${new Date(filterDate).toLocaleDateString('de-DE')}</p>`;
        } else {
            const tSan = window.UI?.sanitize || window.sanitize?.escapeHtml || (v => String(v));
            const typeLabels = { arbeit: 'Arbeit', fahrt: 'Fahrt', pause: 'Pause' };
            entriesList.innerHTML = entries.map(e => {
                const auftrag = e.auftragId ? window.storeService?.state?.auftraege?.find(a => a.id === e.auftragId) : null;
                const auftragLabel = auftrag ? `<span style="font-size:12px;color:var(--text-muted);"> | ${tSan(auftrag.leistungsart || auftrag.id)}</span>` : '';
                return `
                <div class="item-card" style="position:relative;">
                    <div class="item-header">
                        <span class="item-title">${tSan(e.startTime)} - ${tSan(e.endTime)}${auftragLabel}</span>
                        <span class="status-badge ${e.billable ? '' : 'status-badge--muted'}">${e.durationHours}h ${e.billable ? '' : '(n.a.)'}</span>
                    </div>
                    <div class="item-description">
                        <span style="font-size:11px;padding:2px 6px;background:var(--bg);border-radius:4px;margin-right:6px;">${typeLabels[e.type] || 'Arbeit'}</span>
                        ${tSan(e.description || 'Keine Beschreibung')}
                    </div>
                    <button class="btn btn-sm btn-danger time-entry-delete-btn" data-id="${tSan(e.id)}" style="position:absolute;top:8px;right:8px;padding:2px 8px;font-size:11px;" title="L\u00f6schen">&times;</button>
                </div>`;
            }).join('');

            // Bind delete buttons
            entriesList.querySelectorAll('.time-entry-delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (confirm('Zeiteintrag l\u00f6schen?')) {
                        window.timeTrackingService.deleteEntry(btn.dataset.id);
                        renderTimeTracking();
                        showToast('Eintrag gel\u00f6scht', 'success');
                    }
                });
            });
        }
    }
}

function _populateAuftragSelect() {
    const sel = document.getElementById('te-auftrag');
    if (!sel) { return; }
    const auftraege = window.storeService?.state?.auftraege || [];
    const currentVal = sel.value;
    const esc = window.UI?.sanitize || window.sanitize?.escapeHtml || (v => String(v));
    sel.innerHTML = '<option value="">\u2014 Kein Auftrag \u2014</option>' +
        auftraege.map(a => `<option value="${esc(a.id)}">${esc(a.leistungsart || a.id)} — ${esc(a.kunde?.name || '')}</option>`).join('');
    if (currentVal) { sel.value = currentVal; }
}

function initTimeTracking() {
    if (!window.timeTrackingService) { return; }

    // Clock toggle
    document.getElementById('btn-clock-toggle')?.addEventListener('click', () => {
        const isActive = window.timeTrackingService.isClockActive();
        if (isActive) {
            const notes = prompt('Notizen zur Arbeit:', '');
            window.timeTrackingService.clockOut('default', notes || '');
            clearInterval(clockInterval);
            showToast('Ausgestempelt', 'success');
        } else {
            // Ask for Auftrag assignment
            const auftraege = window.storeService?.state?.auftraege || [];
            let projectId = null;
            if (auftraege.length > 0) {
                const choices = auftraege.map((a, i) => `${i + 1}) ${a.leistungsart || a.id}`).join('\n');
                const pick = prompt(`Auftrag zuordnen? (Nummer eingeben, leer = ohne)\n\n${choices}`);
                if (pick && !isNaN(pick)) {
                    const idx = parseInt(pick) - 1;
                    if (auftraege[idx]) { projectId = auftraege[idx].id; }
                }
            }
            window.timeTrackingService.clockIn('default', projectId);
            _startClockInterval();
            showToast('Eingestempelt', 'success');
        }
        renderTimeTracking();
    });

    // Manual entry form toggle
    document.getElementById('btn-add-time-entry')?.addEventListener('click', () => {
        const form = document.getElementById('time-entry-form');
        if (!form) { return; }
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        if (form.style.display === 'block') {
            // Set defaults
            document.getElementById('te-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('te-start').value = '08:00';
            document.getElementById('te-end').value = '16:00';
            document.getElementById('te-break').value = '30';
            document.getElementById('te-description').value = '';
            _populateAuftragSelect();
        }
    });

    document.getElementById('btn-cancel-time-entry')?.addEventListener('click', () => {
        document.getElementById('time-entry-form').style.display = 'none';
    });

    document.getElementById('btn-save-time-entry')?.addEventListener('click', () => {
        const date = document.getElementById('te-date').value;
        const startTime = document.getElementById('te-start').value;
        const endTime = document.getElementById('te-end').value;
        const breakMin = parseInt(document.getElementById('te-break').value) || 0;
        const auftragId = document.getElementById('te-auftrag').value || null;
        const description = document.getElementById('te-description').value;
        const type = document.getElementById('te-type').value;
        const billable = document.getElementById('te-billable').checked;

        if (!date || !startTime || !endTime) {
            showToast('Datum, Beginn und Ende sind Pflichtfelder', 'error');
            return;
        }
        if (startTime >= endTime) {
            showToast('Ende muss nach Beginn liegen', 'error');
            return;
        }

        // Find customer from auftrag
        let customerId = null;
        if (auftragId) {
            const auftrag = window.storeService?.state?.auftraege?.find(a => a.id === auftragId);
            customerId = auftrag?.kunde?.id || null;
        }

        window.timeTrackingService.addEntry({
            date, startTime, endTime, breakMinutes: breakMin,
            auftragId, customerId, description, type, billable
        });

        document.getElementById('time-entry-form').style.display = 'none';
        showToast('Zeiteintrag gespeichert', 'success');
        renderTimeTracking();
    });

    // Date filter
    document.getElementById('te-filter-date')?.addEventListener('change', () => {
        renderTimeTracking();
    });

    // Restore timer if active
    if (window.timeTrackingService.isClockActive()) {
        _startClockInterval();
    }
}

function _startClockInterval() {
    clearInterval(clockInterval);
    clockInterval = setInterval(() => {
        const timerEl = document.getElementById('clock-timer-display');
        const timer = window.timeTrackingService?.getActiveTimer();
        if (timerEl && timer) {
            timerEl.textContent = timer.elapsedFormatted;
        }
    }, 1000);
}

// ============================================
// Notification Bell UI
// ============================================
function initNotificationBell() {
    const bell = document.getElementById('notification-bell');
    const panel = document.getElementById('notification-panel');
    const closeBtn = document.getElementById('notification-close');
    const clearBtn = document.getElementById('clear-notifications');
    const markReadBtn = document.getElementById('mark-all-read');
    const list = document.getElementById('notification-list');
    const badge = document.getElementById('notification-badge');

    if (!bell || !panel) { return; }

    function updateBadge() {
        const count = window.notificationService?.getUnreadCount?.() || 0;
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    function renderNotificationList() {
        if (!list || !window.notificationService) { return; }
        const notifications = window.notificationService.getNotifications();
        if (notifications.length === 0) {
            list.innerHTML = '<p style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">Keine Benachrichtigungen</p>';
            return;
        }
        const esc = window.UI?.sanitize || window.sanitize?.escapeHtml || (v => String(v));
        list.innerHTML = notifications.map(n => {
            const timeAgo = window.notificationService.getRelativeTime?.(n.timestamp) || '';
            return `
            <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${esc(n.id)}" style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;${n.read ? 'opacity:0.6;' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:${n.read ? '400' : '600'};font-size:13px;">${esc(n.icon || '')} ${esc(n.title)}</span>
                    <span style="font-size:11px;color:var(--text-muted);">${esc(timeAgo)}</span>
                </div>
                ${n.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${esc(n.description)}</div>` : ''}
            </div>`;
        }).join('');

        // Click to mark as read
        list.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                window.notificationService.markAsRead(item.dataset.id);
                renderNotificationList();
                updateBadge();
            });
        });
    }

    // Toggle panel
    bell.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) { renderNotificationList(); }
    });

    // Close panel
    closeBtn?.addEventListener('click', () => { panel.style.display = 'none'; });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== bell) {
            panel.style.display = 'none';
        }
    });

    // Mark all as read
    markReadBtn?.addEventListener('click', () => {
        window.notificationService?.markAllAsRead?.();
        renderNotificationList();
        updateBadge();
        showToast('Alle als gelesen markiert', 'success');
    });

    // Clear all
    clearBtn?.addEventListener('click', () => {
        window.notificationService?.clearAll?.();
        renderNotificationList();
        updateBadge();
        showToast('Benachrichtigungen gel\u00f6scht', 'success');
    });

    // Subscribe to changes
    window.notificationService?.subscribe?.(() => {
        updateBadge();
        if (panel.style.display !== 'none') { renderNotificationList(); }
    });

    // Initial badge update
    updateBadge();
}

// ============================================
// Gantt / Werkstattplaner Full View
// ============================================
let ganttFullMounted = false;

function renderGanttFullView() {
    if (!window.ganttTimelineUI) { return; }
    if (!ganttFullMounted) {
        window.ganttTimelineUI.mount('gantt-fullview-mount');
        ganttFullMounted = true;
    } else {
        window.ganttTimelineUI.render();
    }
}

// ============================================
// Documents View
// ============================================
function renderDocuments() {
    const container = document.getElementById('documents-list');
    if (!container || !window.documentService) {return;}

    const docs = window.documentService.getAllDocuments();

    document.getElementById('docs-total')?.textContent && (document.getElementById('docs-total').textContent = docs.length);
    document.getElementById('docs-receipts')?.textContent && (document.getElementById('docs-receipts').textContent = docs.filter(d => d.category === 'quittung').length);

    if (docs.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine Dokumente. Scanne oder lade ein Dokument hoch.</p>';
        return;
    }

    const docSan = window.UI?.sanitize || window.sanitize?.escapeHtml || (v => v);
    container.innerHTML = docs.map(doc => `
        <div class="document-card" data-id="${docSan(doc.id)}">
            <div class="document-icon">${window.documentService.getCategoryIcon(doc.category)}</div>
            <div class="document-name">${docSan(doc.name)}</div>
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
        const dsSan = window.UI?.sanitize || window.sanitize?.escapeHtml || (v => v);
        container.innerHTML = results.map(doc => `
            <div class="document-card">
                <div class="document-icon">${window.documentService.getCategoryIcon(doc.category)}</div>
                <div class="document-name">${dsSan(doc.name)}</div>
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

let currentReport = null;
let reportChart = null;

async function ensureChartJS() {
    if (window.Chart) {return;}
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
        script.integrity = 'sha384-vsrfeLOOY6KuIYKDlmVH5UiBmgIdB1oEf7p01YgWHuqmOHfZr374+odEv96n9tNC';
        script.crossOrigin = 'anonymous';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Chart.js konnte nicht geladen werden'));
        document.head.appendChild(script);
    });
}

async function generateReport() {
    const startDate = document.getElementById('report-start-date')?.value;
    const endDate = document.getElementById('report-end-date')?.value;
    const output = document.getElementById('report-output');
    const chartContainer = document.getElementById('report-chart-container');

    if (!output) {return;}

    // Use store data directly if reportService isn't available
    let report;
    if (window.reportService) {
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
    }

    // Fallback: generate from store data directly
    if (!report && window.storeService) {
        const store = window.storeService.state;
        if (selectedReportType === 'sales') {
            const rechnungen = (store.rechnungen || []).filter(r => {
                const d = (r.createdAt || r.datum || '').split('T')[0];
                return d >= (startDate || '') && d <= (endDate || '9999');
            });
            const totalBrutto = rechnungen.reduce((s, r) => s + (r.brutto || 0), 0);
            const paid = rechnungen.filter(r => r.status === 'bezahlt');
            const open = rechnungen.filter(r => r.status === 'offen');

            const byMonth = {};
            rechnungen.forEach(r => {
                const m = (r.createdAt || r.datum || '').substring(0, 7);
                if (!byMonth[m]) {byMonth[m] = { count: 0, sum: 0 };}
                byMonth[m].count++;
                byMonth[m].sum += r.brutto || 0;
            });

            report = {
                type: 'sales', title: 'Umsatzbericht',
                period: { start: startDate, end: endDate },
                summary: {
                    'Rechnungen': rechnungen.length,
                    'Umsatz (Brutto)': totalBrutto,
                    'Bezahlt': paid.reduce((s, r) => s + (r.brutto || 0), 0),
                    'Offen': open.reduce((s, r) => s + (r.brutto || 0), 0)
                },
                byMonth: Object.entries(byMonth).map(([month, d]) => ({ month, count: d.count, sum: d.sum })).sort((a, b) => a.month.localeCompare(b.month)),
                details: rechnungen
            };
        }
    }

    if (!report) {
        output.innerHTML = '<p class="empty-state">Bericht konnte nicht erstellt werden</p>';
        if (chartContainer) {chartContainer.style.display = 'none';}
        return;
    }

    currentReport = report;

    // Render summary cards
    const summaryLabels = {
        anzahlRechnungen: 'Rechnungen', gesamtBrutto: 'Umsatz (Brutto)', gesamtNetto: 'Umsatz (Netto)',
        bezahlt: 'Bezahlt', offen: 'Offen', anzahlBezahlt: 'Bezahlt (Anz.)', anzahlOffen: 'Offen (Anz.)',
        totalCustomers: 'Kunden gesamt', activeCustomers: 'Aktive Kunden', newCustomers: 'Neukunden',
        totalEntries: 'Einträge', totalHours: 'Stunden gesamt', billableHours: 'Abrechenbar',
        nonBillableHours: 'Nicht abrechenbar', avgHoursPerDay: 'Ø Std./Tag',
        totalTasks: 'Aufgaben', completed: 'Erledigt', open: 'Offen', overdue: 'Überfällig', completionRate: 'Abschlussrate',
        einnahmen: 'Einnahmen', ausgaben: 'Ausgaben', gewinn: 'Gewinn', mwstZahllast: 'USt-Zahllast',
        'Rechnungen': 'Rechnungen', 'Umsatz (Brutto)': 'Umsatz (Brutto)', 'Bezahlt': 'Bezahlt', 'Offen': 'Offen'
    };

    const currencyKeys = ['gesamtBrutto', 'gesamtNetto', 'bezahlt', 'offen', 'einnahmen', 'ausgaben', 'gewinn', 'mwstZahllast', 'Umsatz (Brutto)', 'Bezahlt', 'Offen'];

    let html = `<h3>${report.title}</h3>`;
    html += `<p style="color:var(--text-muted);margin-bottom:20px;">Zeitraum: ${report.period?.start || report.year || ''} – ${report.period?.end || ''}</p>`;

    html += '<div class="report-summary">';
    for (const [key, value] of Object.entries(report.summary || {})) {
        const label = summaryLabels[key] || key;
        const isPercent = key === 'completionRate';
        const isCurrency = currencyKeys.includes(key);
        const displayValue = isCurrency ? formatCurrency(value) : isPercent ? `${value}%` : value;
        html += `<div class="report-stat"><div class="report-stat-value">${displayValue}</div><div class="report-stat-label">${label}</div></div>`;
    }
    html += '</div>';

    // Top customers table for customer report
    if (report.topCustomers?.length > 0) {
        html += '<h4 style="margin-top:20px;">Top-Kunden nach Umsatz</h4>';
        html += '<table class="report-table"><thead><tr><th>Kunde</th><th>Rechnungen</th><th class="text-right">Umsatz</th></tr></thead><tbody>';
        const reportSan = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));
        report.topCustomers.forEach(c => {
            html += `<tr><td>${reportSan(c.name)}</td><td>${c.count}</td><td class="text-right">${formatCurrency(c.revenue)}</td></tr>`;
        });
        html += '</tbody></table>';
    }

    html += '<div style="margin-top:20px;display:flex;gap:12px;">';
    html += '<button class="btn btn-secondary" data-action="export-report-csv">CSV exportieren</button>';
    html += '</div>';

    output.innerHTML = html;

    // Draw chart
    try {
        await ensureChartJS();
        renderReportChart(report);
    } catch (e) {
        console.warn('Chart.js not available:', e);
        if (chartContainer) {chartContainer.style.display = 'none';}
    }
}

function renderReportChart(report) {
    const chartContainer = document.getElementById('report-chart-container');
    const ctx = document.getElementById('report-chart');
    if (!chartContainer || !ctx || !window.Chart) {return;}

    // Destroy previous chart
    if (reportChart) { reportChart.destroy(); reportChart = null; }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        getComputedStyle(document.body).getPropertyValue('--bg-primary').includes('1a');
    const textColor = isDark ? '#ccc' : '#555';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    let config = null;

    if (report.type === 'sales' && report.byMonth?.length > 0) {
        config = {
            type: 'bar',
            data: {
                labels: report.byMonth.map(m => m.month),
                datasets: [{
                    label: 'Umsatz (Brutto)',
                    data: report.byMonth.map(m => m.sum),
                    backgroundColor: 'rgba(45, 212, 168, 0.7)',
                    borderColor: 'rgb(99, 102, 241)',
                    borderWidth: 1,
                    borderRadius: 6
                }, {
                    label: 'Anzahl Rechnungen',
                    data: report.byMonth.map(m => m.count),
                    type: 'line',
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: textColor } } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, callback: v => '€' + v.toLocaleString('de-DE') }, grid: { color: gridColor } },
                    y1: { position: 'right', ticks: { color: textColor }, grid: { display: false } }
                }
            }
        };
    } else if (report.type === 'customer' && report.topCustomers?.length > 0) {
        config = {
            type: 'doughnut',
            data: {
                labels: report.topCustomers.map(c => c.name),
                datasets: [{
                    data: report.topCustomers.map(c => c.revenue),
                    backgroundColor: ['#2dd4a8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#64748b']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'right', labels: { color: textColor } } }
            }
        };
    } else if (report.type === 'time' && report.byDay?.length > 0) {
        config = {
            type: 'bar',
            data: {
                labels: report.byDay.map(d => d.date),
                datasets: [{
                    label: 'Stunden',
                    data: report.byDay.map(d => d.hours),
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: textColor } } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, callback: v => v + 'h' }, grid: { color: gridColor } }
                }
            }
        };
    } else if (report.type === 'tasks' && report.byPriority) {
        config = {
            type: 'doughnut',
            data: {
                labels: ['Dringend', 'Hoch', 'Normal', 'Niedrig'],
                datasets: [{
                    data: [report.byPriority.urgent || 0, report.byPriority.high || 0, report.byPriority.normal || 0, report.byPriority.low || 0],
                    backgroundColor: ['#ef4444', '#f59e0b', '#2dd4a8', '#64748b']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'right', labels: { color: textColor } } }
            }
        };
    } else if (report.type === 'bookkeeping' && report.summary) {
        const s = report.summary;
        config = {
            type: 'bar',
            data: {
                labels: ['Einnahmen', 'Ausgaben', 'Gewinn'],
                datasets: [{
                    label: 'Betrag (€)',
                    data: [s.einnahmen || 0, s.ausgaben || 0, s.gewinn || 0],
                    backgroundColor: ['rgba(34, 197, 94, 0.7)', 'rgba(239, 68, 68, 0.7)', 'rgba(45, 212, 168, 0.7)'],
                    borderColor: ['rgb(34, 197, 94)', 'rgb(239, 68, 68)', 'rgb(99, 102, 241)'],
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, callback: v => '€' + v.toLocaleString('de-DE') }, grid: { color: gridColor } }
                }
            }
        };
    }

    if (config) {
        chartContainer.style.display = 'block';
        reportChart = new window.Chart(ctx, config);
    } else {
        chartContainer.style.display = 'none';
    }
}

window.exportReportCSV = exportReportCSV;
function exportReportCSV() {
    if (!currentReport) {
        showToast('Bitte erst einen Bericht erstellen', 'warning');
        return;
    }

    let csv = '';
    if (window.reportService) {
        csv = window.reportService.exportToCSV(currentReport);
    }

    // Fallback CSV generation
    if (!csv && currentReport.details) {
        if (currentReport.type === 'sales') {
            csv = 'Nr;Datum;Kunde;Netto;Brutto;Status\n';
            currentReport.details.forEach(r => {
                csv += `${r.id};${r.createdAt || r.datum || ''};${r.kunde?.name || ''};${r.netto || 0};${r.brutto || 0};${r.status}\n`;
            });
        }
    }

    if (!csv) {
        // Generic summary export
        csv = 'Kennzahl;Wert\n';
        for (const [k, v] of Object.entries(currentReport.summary || {})) {
            csv += `${k};${v}\n`;
        }
    }

    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentReport.title || 'Bericht'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('CSV exportiert!', 'success');
}

// ============================================
// AI Assistant (Native/Ollama Style)
// ============================================

function renderChatbot() {
    if (!window.llmService) {return;}
    initAIModelSelector();
}

async function initAIModelSelector() {
    const select = document.getElementById('ai-model-select');
    if (!select) {return;}

    if (!window.llmService) {return;}
    const models = await window.llmService.getAvailableModels();
    if (models.length > 0) {
        select.innerHTML = models.map(m => `<option value="${window.UI.sanitize(m.name)}" ${m.name === window.llmService.config.ollamaModel ? 'selected' : ''}>${window.UI.sanitize(m.name)}</option>`).join('');
    }
}

async function sendAiMessage() {
    const input = document.getElementById('ai-chat-input');
    const container = document.getElementById('ai-chat-messages');
    if (!input || !container) {return;}
    const message = input.value.trim();

    if (!message) {return;}

    // Remove empty state if still there
    const emptyState = container.querySelector('.ai-empty-state');
    if (emptyState) {emptyState.remove();}

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
    } catch {
        typing.remove();
        appendAiMessage('bot', "⚠️ Fehler bei der Verbindung zur KI. Bitte prüfen Sie die Einstellungen.");
    }
}

function appendAiMessage(role, content) {
    const container = document.getElementById('ai-chat-messages');
    if (!container) {return;}
    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-message ${role}`;
    const sanitize = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));
    msgDiv.innerHTML = sanitize(content).replace(/\n/g, '<br>');
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function initChatbot() {
    const btnSend = document.getElementById('btn-send-ai');
    const input = document.getElementById('ai-chat-input');

    btnSend?.addEventListener('click', sendAiMessage);
    input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {sendAiMessage();}
    });

    // Auto-refresh model list occasionally
    setInterval(initAIModelSelector, 30000);
}

// ============================================
// Email Automation View
// ============================================
async function renderEmailAutomation() {
    const svc = window.emailAutomationService;
    if (!svc) {return;}

    const stats = await svc.getStats();
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) {el.textContent = val;} };
    setEl('stat-emails-received', stats.totalProcessed || 0);
    setEl('stat-emails-processed', stats.successful || 0);
    setEl('stat-quotes-created', stats.quotesCreated || 0);

    if (stats.totalProcessed > 0 && stats.lastProcessed) {
        const avgMs = stats.totalProcessed > 0 ? Math.round((Date.now() - new Date(stats.lastProcessed).getTime()) / stats.totalProcessed) : 0;
        setEl('stat-avg-time', avgMs < 60000 ? `${Math.round(avgMs / 1000)}s` : `${Math.round(avgMs / 60000)}min`);
    }

    // Badge
    const badge = document.getElementById('email-automation-badge');
    if (badge) {badge.textContent = stats.pending > 0 ? stats.pending : '';}

    // History list
    const filter = document.getElementById('email-history-filter')?.value || '';
    const history = await svc.getProcessedEmails(50);
    const filtered = filter ? history.filter(e => e.status === filter) : history;
    const container = document.getElementById('email-history-list');
    if (!container) {return;}

    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine E-Mails automatisch verarbeitet.</p>';
        return;
    }

    const h = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const statusIcons = { success: '✅', failed: '❌', pending: '⏳', test: '🧪' };

    container.innerHTML = filtered.map(e => `<div class="item-card" style="margin-bottom:8px;">
        <div class="item-header">
            <span>${statusIcons[e.status] || '📧'} <strong>${h(e.sender || e.from || 'Unbekannt')}</strong></span>
            <small>${e.timestamp ? new Date(e.timestamp).toLocaleString('de-DE') : '-'}</small>
        </div>
        <div class="item-meta">
            <span>${h(e.subject || 'Kein Betreff')}</span>
            ${e.quote ? `<span>→ Angebot erstellt</span>` : ''}
        </div>
    </div>`).join('');
}

// ============================================
// Global exports for NavigationController
// ============================================
window.renderEmails = renderEmails;
window.renderTasks = renderTasks;
window.renderCustomers = renderCustomers;
window._openKundeForm = _openKundeForm;
window.renderCalendar = renderCalendar;
window.renderTimeTracking = renderTimeTracking;
window.renderGanttFullView = renderGanttFullView;
window.renderDocuments = renderDocuments;
window.initReports = initReports;
window.renderChatbot = renderChatbot;
window.renderEmailAutomation = renderEmailAutomation;

// ============================================
// Aufträge View Toggle (Kanban / Liste / Zeitleiste)
// ============================================
function initAuftragViewToggle() {
    const kanbanBtn = document.getElementById('btn-auftrag-kanban-view');
    const listBtn = document.getElementById('btn-auftrag-list-view');
    const timelineBtn = document.getElementById('btn-auftrag-timeline-view');
    const timelineMount = document.getElementById('auftrag-timeline-mount');
    let ganttMounted = false;

    function setActiveView(mode) {
        // Reset all buttons
        [kanbanBtn, listBtn, timelineBtn].forEach(btn => {
            if (btn) {btn.classList.replace('btn-primary', 'btn-secondary');}
        });

        // Hide timeline mount
        if (timelineMount) {timelineMount.style.display = 'none';}

        if (mode === 'kanban') {
            if (kanbanBtn) {kanbanBtn.classList.replace('btn-secondary', 'btn-primary');}
            if (window.AuftraegeModule) {window.AuftraegeModule.auftragViewMode = 'kanban';}
            window.renderAuftraege?.();
        } else if (mode === 'list') {
            if (listBtn) {listBtn.classList.replace('btn-secondary', 'btn-primary');}
            if (window.AuftraegeModule) {window.AuftraegeModule.auftragViewMode = 'list';}
            window.renderAuftraege?.();
        } else if (mode === 'timeline') {
            if (timelineBtn) {timelineBtn.classList.replace('btn-secondary', 'btn-primary');}
            // Hide kanban and list
            const kanbanEl = document.getElementById('auftrag-kanban');
            const listEl = document.getElementById('auftraege-list');
            if (kanbanEl) {kanbanEl.style.display = 'none';}
            if (listEl) {listEl.style.display = 'none';}
            // Show and mount Gantt
            if (timelineMount) {
                timelineMount.style.display = 'block';
                if (!ganttMounted && window.ganttTimelineUI) {
                    window.ganttTimelineUI.mount('auftrag-timeline-mount');
                    ganttMounted = true;
                } else if (ganttMounted && window.ganttTimelineUI) {
                    window.ganttTimelineUI.render();
                }
            }
        }
    }

    kanbanBtn?.addEventListener('click', () => setActiveView('kanban'));
    listBtn?.addEventListener('click', () => setActiveView('list'));
    timelineBtn?.addEventListener('click', () => setActiveView('timeline'));
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
    initNotificationBell();
    initAuftragViewToggle();

    // Email Automation: refresh + filter
    document.getElementById('btn-refresh-email-history')?.addEventListener('click', () => {
        if (window.renderEmailAutomation) {window.renderEmailAutomation();}
    });
    document.getElementById('email-history-filter')?.addEventListener('change', () => {
        if (window.renderEmailAutomation) {window.renderEmailAutomation();}
    });

    // New features initialized
}

// Auto-init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewFeatures);
} else {
    // Small delay to ensure other scripts loaded
    setTimeout(initNewFeatures, 100);
}

