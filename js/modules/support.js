/* ============================================
   Support Dashboard Module
   Ticket management, conversation threads, KB editor
   ============================================ */
(function() {
'use strict';

const SB_URL = window.SUPABASE_URL || 'https://incbhhaiiayohrjqevog.supabase.co';
const RELAY_URL = 'https://freyaivisions.de/api';

let tickets = [];
let kbArticles = [];
let currentFilter = { status: '', priority: '', search: '' };
let currentTicket = null;

async function getHeaders() {
    const key = window.SUPABASE_ANON_KEY || '';
    let token = key;
    // Use authenticated session token if available (required for write operations)
    const sb = window.supabaseConfig?.get?.();
    if (sb) {
        try {
            const { data } = await sb.auth.getSession();
            if (data?.session?.access_token) token = data.session.access_token;
        } catch (e) { /* fallback to anon key */ }
    }
    return { 'apikey': key, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
}

async function fetchTickets() {
    let url = SB_URL + '/rest/v1/support_tickets?order=created_at.desc&limit=100&select=*';
    if (currentFilter.status) url += '&status=eq.' + currentFilter.status;
    if (currentFilter.priority) url += '&priority=eq.' + currentFilter.priority;
    if (currentFilter.search) url += '&or=(ticket_number.ilike.*' + currentFilter.search + '*,subject.ilike.*' + currentFilter.search + '*,customer_email.ilike.*' + currentFilter.search + '*)';

    try {
        const resp = await fetch(url, { headers: await getHeaders() });
        tickets = await resp.json();
        if (!Array.isArray(tickets)) tickets = [];
    } catch (e) {
        console.error('Support: Failed to fetch tickets', e);
        tickets = [];
    }
}

async function fetchMessages(ticketId) {
    try {
        const resp = await fetch(
            SB_URL + '/rest/v1/ticket_messages?ticket_id=eq.' + ticketId + '&order=created_at.asc&select=*',
            { headers: await getHeaders() }
        );
        const msgs = await resp.json();
        return Array.isArray(msgs) ? msgs : [];
    } catch (e) {
        return [];
    }
}

async function fetchKB() {
    try {
        const resp = await fetch(SB_URL + '/rest/v1/support_kb?order=sort_order.asc,created_at.desc&select=*', { headers: await getHeaders() });
        kbArticles = await resp.json();
        if (!Array.isArray(kbArticles)) kbArticles = [];
    } catch (e) {
        kbArticles = [];
    }
}

async function fetchStats() {
    const h = await getHeaders();
    try {
        const [openR, todayR, aiR] = await Promise.all([
            fetch(SB_URL + '/rest/v1/support_tickets?status=in.(offen,in_bearbeitung,warte_auf_kunde,ai_beantwortet)&select=id', { headers: h }).then(r => r.json()),
            fetch(SB_URL + '/rest/v1/support_tickets?created_at=gte.' + new Date().toISOString().split('T')[0] + 'T00:00:00Z&select=id', { headers: h }).then(r => r.json()),
            fetch(SB_URL + '/rest/v1/support_tickets?status=eq.ai_beantwortet&select=id', { headers: h }).then(r => r.json()),
        ]);
        return {
            open: Array.isArray(openR) ? openR.length : 0,
            today: Array.isArray(todayR) ? todayR.length : 0,
            ai: Array.isArray(aiR) ? aiR.length : 0,
            total: tickets.length
        };
    } catch (e) {
        return { open: 0, today: 0, ai: 0, total: 0 };
    }
}

function statusLabel(s) {
    const map = { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', warte_auf_kunde: 'Warte auf Kunde', ai_beantwortet: 'KI beantwortet', geloest: 'Geloest', geschlossen: 'Geschlossen' };
    return map[s] || s;
}

function priorityLabel(p) {
    const map = { niedrig: 'Niedrig', normal: 'Normal', hoch: 'Hoch', dringend: 'Dringend' };
    return map[p] || p || '-';
}

function channelIcon(ch) {
    const map = { email: 'E-Mail', chat: 'Chat', whatsapp: 'WhatsApp', telefon: 'Telefon', system: 'System' };
    return map[ch] || ch || '-';
}

function timeAgo(dateStr) {
    if (!dateStr) return '-';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + ' Min.';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' Std.';
    return Math.floor(hours / 24) + ' Tage';
}

function esc(str) {
    if (!str) return '';
    if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(str);
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ---- Render Functions ----

function renderStats(stats) {
    const el = document.getElementById('support-stats');
    if (!el) return;
    el.innerHTML = `
        <div class="support-stat-card"><div class="stat-value">${stats.open}</div><div class="stat-label">Offen</div></div>
        <div class="support-stat-card"><div class="stat-value">${stats.today}</div><div class="stat-label">Heute neu</div></div>
        <div class="support-stat-card"><div class="stat-value">${stats.ai}</div><div class="stat-label">KI beantwortet</div></div>
        <div class="support-stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">Gesamt</div></div>
    `;
}

function renderTicketList() {
    const el = document.getElementById('support-ticket-list');
    if (!el) return;

    if (tickets.length === 0) {
        el.innerHTML = '<div class="support-empty">Keine Tickets gefunden.</div>';
        return;
    }

    el.innerHTML = tickets.map(t => `
        <div class="support-ticket-row" data-id="${esc(t.id)}">
            <span class="ticket-number">${esc(t.ticket_number)}</span>
            <span class="ticket-subject">${esc(t.subject)}</span>
            <span class="ticket-customer">${esc(t.customer_name || t.customer_email)}</span>
            <span><span class="support-badge ${t.status}">${statusLabel(t.status)}</span></span>
            <span><span class="support-badge ${t.priority}">${priorityLabel(t.priority)}</span></span>
            <span style="color:var(--text-muted);font-size:12px">${timeAgo(t.created_at)}</span>
        </div>
    `).join('');

    el.querySelectorAll('.support-ticket-row').forEach(row => {
        row.addEventListener('click', () => openTicketDetail(row.dataset.id));
    });
}

async function openTicketDetail(ticketId) {
    currentTicket = tickets.find(t => t.id === ticketId);
    if (!currentTicket) return;

    const messages = await fetchMessages(ticketId);
    const overlay = document.getElementById('support-detail-overlay');
    if (!overlay) return;

    overlay.innerHTML = `
        <div class="support-detail-panel">
            <div class="support-detail-header">
                <h2>${esc(currentTicket.ticket_number)} — ${esc(currentTicket.subject)}</h2>
                <button class="support-detail-close" id="support-detail-close">&times;</button>
            </div>
            <div class="support-detail-meta">
                <span class="meta-item">Kunde: <strong>${esc(currentTicket.customer_name || '-')}</strong></span>
                <span class="meta-item">Email: ${esc(currentTicket.customer_email)}</span>
                <span class="meta-item">Kanal: ${channelIcon(currentTicket.channel)}</span>
                <span class="meta-item">Erstellt: ${new Date(currentTicket.created_at).toLocaleString('de-DE')}</span>
            </div>
            <div class="support-detail-actions">
                <select id="support-status-select">
                    ${['offen','in_bearbeitung','warte_auf_kunde','ai_beantwortet','geloest','geschlossen'].map(s =>
                        '<option value="' + s + '"' + (s === currentTicket.status ? ' selected' : '') + '>' + statusLabel(s) + '</option>'
                    ).join('')}
                </select>
                <select id="support-priority-select">
                    ${['niedrig','normal','hoch','dringend'].map(p =>
                        '<option value="' + p + '"' + (p === currentTicket.priority ? ' selected' : '') + '>' + priorityLabel(p) + '</option>'
                    ).join('')}
                </select>
                <button class="btn-primary" id="support-save-meta">Speichern</button>
            </div>
            <div class="support-thread" id="support-thread">
                ${messages.length === 0 ? '<div class="support-empty">Keine Nachrichten</div>' : messages.map(m => `
                    <div class="support-message ${m.direction}">
                        <div>${esc(m.body_text)}</div>
                        <div class="msg-meta">${esc(m.sender_name || m.sender_type)} — ${new Date(m.created_at).toLocaleString('de-DE')} — ${channelIcon(m.channel)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="support-reply-box">
                <textarea id="support-reply-text" placeholder="Antwort schreiben..."></textarea>
                <button id="support-send-reply">Senden</button>
            </div>
        </div>
    `;

    overlay.classList.add('open');

    document.getElementById('support-detail-close').addEventListener('click', () => {
        overlay.classList.remove('open');
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
    });

    document.getElementById('support-save-meta').addEventListener('click', async () => {
        const newStatus = document.getElementById('support-status-select').value;
        const newPriority = document.getElementById('support-priority-select').value;
        try {
            await fetch(SB_URL + '/rest/v1/support_tickets?id=eq.' + ticketId, {
                method: 'PATCH',
                headers: { ...(await getHeaders()), 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    status: newStatus,
                    priority: newPriority,
                    ...(newStatus === 'geschlossen' ? { resolved_at: new Date().toISOString() } : {})
                })
            });
            if (window.showToast) window.showToast('Ticket aktualisiert', 'success');
            await refresh();
        } catch (e) {
            if (window.showToast) window.showToast('Fehler beim Speichern', 'error');
        }
    });

    document.getElementById('support-send-reply').addEventListener('click', async () => {
        const text = document.getElementById('support-reply-text').value.trim();
        if (!text) return;

        try {
            await fetch(RELAY_URL + '/support/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_id: ticketId,
                    body: text,
                    sender_type: 'agent',
                    new_status: 'warte_auf_kunde'
                })
            });
            if (window.showToast) window.showToast('Antwort gesendet', 'success');
            openTicketDetail(ticketId);
        } catch (e) {
            if (window.showToast) window.showToast('Fehler beim Senden', 'error');
        }
    });

    // Scroll thread to bottom
    const thread = document.getElementById('support-thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
}

function renderKBList() {
    const el = document.getElementById('support-kb-list');
    if (!el) return;

    if (kbArticles.length === 0) {
        el.innerHTML = '<div class="support-empty">Keine KB-Artikel vorhanden.</div>';
        return;
    }

    el.innerHTML = kbArticles.map(a => `
        <div class="support-kb-item" data-id="${esc(a.id)}">
            <div>
                <div class="kb-title">${esc(a.title)}</div>
                <div class="kb-category">${esc(a.category || '-')} ${a.is_public ? '' : '(intern)'}</div>
            </div>
            <div class="support-kb-actions">
                <button class="kb-edit-btn" data-id="${esc(a.id)}">Bearbeiten</button>
                <button class="kb-delete-btn" data-id="${esc(a.id)}">Loeschen</button>
            </div>
        </div>
    `).join('');

    el.querySelectorAll('.kb-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editKBArticle(btn.dataset.id);
        });
    });
    el.querySelectorAll('.kb-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('KB-Artikel wirklich loeschen?')) return;
            await fetch(SB_URL + '/rest/v1/support_kb?id=eq.' + btn.dataset.id, {
                method: 'DELETE',
                headers: await getHeaders()
            });
            await fetchKB();
            renderKBList();
        });
    });
}

function editKBArticle(id) {
    const article = id ? kbArticles.find(a => a.id === id) : null;
    const formEl = document.getElementById('support-kb-form-area');
    if (!formEl) return;

    formEl.innerHTML = `
        <div class="support-kb-form">
            <label>Titel</label>
            <input type="text" id="kb-edit-title" value="${esc(article?.title || '')}">
            <label>Kategorie</label>
            <input type="text" id="kb-edit-category" value="${esc(article?.category || '')}">
            <label>Inhalt (Markdown)</label>
            <textarea id="kb-edit-content">${esc(article?.content_md || '')}</textarea>
            <label>Suchbegriffe (kommagetrennt)</label>
            <input type="text" id="kb-edit-keywords" value="${esc((article?.keywords || []).join(', '))}">
            <label style="display:flex;align-items:center;gap:6px">
                <input type="checkbox" id="kb-edit-public" ${article?.is_public !== false ? 'checked' : ''}>
                Oeffentlich sichtbar
            </label>
            <div class="form-actions">
                <button id="kb-cancel-btn">Abbrechen</button>
                <button class="btn-primary" id="kb-save-btn" style="background:var(--primary,#6366f1);color:white;border:none">Speichern</button>
            </div>
        </div>
    `;

    document.getElementById('kb-cancel-btn').addEventListener('click', () => { formEl.innerHTML = ''; });
    document.getElementById('kb-save-btn').addEventListener('click', async () => {
        const data = {
            title: document.getElementById('kb-edit-title').value.trim(),
            category: document.getElementById('kb-edit-category').value.trim(),
            content_md: document.getElementById('kb-edit-content').value,
            keywords: document.getElementById('kb-edit-keywords').value.split(',').map(k => k.trim()).filter(Boolean),
            is_public: document.getElementById('kb-edit-public').checked,
            slug: document.getElementById('kb-edit-title').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
        };

        if (!data.title) {
            if (window.showToast) window.showToast('Titel ist Pflichtfeld', 'warning');
            return;
        }

        try {
            if (id) {
                await fetch(SB_URL + '/rest/v1/support_kb?id=eq.' + id, {
                    method: 'PATCH',
                    headers: { ...(await getHeaders()), 'Prefer': 'return=minimal' },
                    body: JSON.stringify(data)
                });
            } else {
                await fetch(SB_URL + '/rest/v1/support_kb', {
                    method: 'POST',
                    headers: { ...(await getHeaders()), 'Prefer': 'return=minimal' },
                    body: JSON.stringify(data)
                });
            }
            formEl.innerHTML = '';
            await fetchKB();
            renderKBList();
            if (window.showToast) window.showToast('KB-Artikel gespeichert', 'success');
        } catch (e) {
            if (window.showToast) window.showToast('Fehler beim Speichern', 'error');
        }
    });
}

async function refresh() {
    await fetchTickets();
    const stats = await fetchStats();
    renderStats(stats);
    renderTicketList();
    // Update nav badge
    const badge = document.getElementById('support-badge');
    if (badge) badge.textContent = stats.open || '';
}

let initialized = false;

function bindListeners() {
    if (initialized) return;
    initialized = true;

    const statusFilter = document.getElementById('support-filter-status');
    const priorityFilter = document.getElementById('support-filter-priority');
    const searchInput = document.getElementById('support-filter-search');

    if (statusFilter) statusFilter.addEventListener('change', async () => {
        currentFilter.status = statusFilter.value;
        await fetchTickets();
        renderTicketList();
    });
    if (priorityFilter) priorityFilter.addEventListener('change', async () => {
        currentFilter.priority = priorityFilter.value;
        await fetchTickets();
        renderTicketList();
    });

    let searchTimeout;
    if (searchInput) searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            currentFilter.search = searchInput.value.trim();
            await fetchTickets();
            renderTicketList();
        }, 400);
    });

    document.querySelectorAll('.support-tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.support-tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.support-tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById('support-panel-' + tab.dataset.tab);
            if (target) target.classList.add('active');
        });
    });

    const newKBBtn = document.getElementById('support-new-kb');
    if (newKBBtn) newKBBtn.addEventListener('click', () => editKBArticle(null));
}

async function init() {
    bindListeners();

    await Promise.all([fetchTickets(), fetchKB()]);
    const stats = await fetchStats();
    renderStats(stats);
    renderTicketList();
    renderKBList();

    const badge = document.getElementById('support-badge');
    if (badge) badge.textContent = stats.open || '';
}

// Expose globally
window.renderSupport = init;

})();
