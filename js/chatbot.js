/**
 * FreyAI Website Chatbot Widget
 * Kommuniziert mit n8n Webhook Backend + Gemini 2.0 Flash
 * Session-Management via localStorage session_id
 */
(function () {
    'use strict';

    // ── Config ─────────────────────────────────────────────────────────
    const CHAT_CONFIG = {
        // n8n Webhook URL — wird beim Einbinden gesetzt
        webhookUrl: window.FREYAI_CHAT_WEBHOOK || 'https://app.freyaivisions.de/n8n/webhook/website-chat',
        botName: 'FreyAI Assistent',
        botAvatar: '🤖',
        userAvatar: '👤',
        greetingDelay: 800,
        typingDelay: 600,
        quickReplies: [
            'Was bietet ihr an?',
            'Kosten & Preise',
            'Termin buchen',
            'Für Handwerker?'
        ],
        initialMessage: 'Hallo! Ich bin der KI-Assistent von FreyAI Visions. Wie kann ich Ihnen heute helfen? Ich beantworte gerne Fragen zu unseren Leistungen rund um Automatisierung und KI für Ihren Betrieb.',
        privacyNotice: 'Dieser Chat wird zur Verbesserung unserer Beratung anonymisiert ausgewertet. Details in unserer <a href="/datenschutz.html" target="_blank" style="color:#c8956c">Datenschutzerklärung</a>.'
    };

    // ── State ──────────────────────────────────────────────────────────
    let sessionId = null;
    let isOpen = false;
    let isTyping = false;
    let quickRepliesShown = false;
    let typingTimeout = null;

    // ── DOM Refs ───────────────────────────────────────────────────────
    let toggleBtn, chatWindow, messagesEl, inputEl, sendBtn, badge, quickRepliesEl;

    // ── Init ───────────────────────────────────────────────────────────
    function init() {
        // Load or generate session ID
        sessionId = localStorage.getItem('freyai_chat_session_id') || generateSessionId();
        localStorage.setItem('freyai_chat_session_id', sessionId);

        injectHTML();
        bindRefs();
        bindEvents();

        // Show privacy notice + greeting after short delay
        setTimeout(() => {
            if (CHAT_CONFIG.privacyNotice) {
                const notice = document.createElement('div');
                notice.className = 'freyai-chat-privacy';
                notice.innerHTML = CHAT_CONFIG.privacyNotice;
                messagesEl.appendChild(notice);
            }
            addBotMessage(CHAT_CONFIG.initialMessage);
            setTimeout(() => showQuickReplies(), 400);
        }, CHAT_CONFIG.greetingDelay);

        // Show badge on toggle button
        setTimeout(() => {
            if (!isOpen && badge) badge.style.display = 'flex';
        }, 1500);
    }

    function generateSessionId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return 'chat_' + crypto.randomUUID();
        }
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ── HTML Injection ─────────────────────────────────────────────────
    function injectHTML() {
        const container = document.createElement('div');
        container.id = 'freyai-chatbot-container';
        container.innerHTML = `
<!-- Toggle Button -->
<button id="freyai-chat-toggle" aria-label="Chat öffnen" title="Chat mit FreyAI Assistent">
    <svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
    </svg>
    <svg class="icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
    <span id="freyai-chat-badge" style="display:none">1</span>
</button>

<!-- Chat Window -->
<div id="freyai-chat-window" role="dialog" aria-label="FreyAI Chat" aria-modal="false">
    <!-- Header -->
    <div id="freyai-chat-header">
        <div id="freyai-chat-avatar">${CHAT_CONFIG.botAvatar}</div>
        <div id="freyai-chat-header-info">
            <div id="freyai-chat-name">${CHAT_CONFIG.botName}</div>
            <div id="freyai-chat-status">Online — antwortet sofort</div>
        </div>
    </div>

    <!-- Messages -->
    <div id="freyai-chat-messages" role="log" aria-live="polite" aria-label="Chatverlauf"></div>

    <!-- Quick Replies -->
    <div id="freyai-quick-replies"></div>

    <!-- Input -->
    <div id="freyai-chat-input-area">
        <textarea
            id="freyai-chat-input"
            placeholder="Nachricht schreiben..."
            rows="1"
            maxlength="500"
            aria-label="Nachricht eingeben"
        ></textarea>
        <button id="freyai-chat-send" aria-label="Senden" title="Senden">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        </button>
    </div>

    <!-- Footer -->
    <div id="freyai-chat-footer">
        Powered by <a href="https://freyaivisions.de" target="_blank" rel="noopener noreferrer">FreyAI Visions</a> &amp; Gemini AI
    </div>
</div>
        `.trim();

        document.body.appendChild(container);
    }

    // ── Bind DOM Refs ──────────────────────────────────────────────────
    function bindRefs() {
        toggleBtn     = document.getElementById('freyai-chat-toggle');
        chatWindow    = document.getElementById('freyai-chat-window');
        messagesEl    = document.getElementById('freyai-chat-messages');
        inputEl       = document.getElementById('freyai-chat-input');
        sendBtn       = document.getElementById('freyai-chat-send');
        badge         = document.getElementById('freyai-chat-badge');
        quickRepliesEl = document.getElementById('freyai-quick-replies');
    }

    // ── Events ─────────────────────────────────────────────────────────
    function bindEvents() {
        toggleBtn.addEventListener('click', toggleChat);

        sendBtn.addEventListener('click', handleSend);

        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Auto-resize textarea
        inputEl.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });

        // Close on Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen) closeChat();
        });
    }

    // ── Toggle ─────────────────────────────────────────────────────────
    function toggleChat() {
        if (isOpen) {
            closeChat();
        } else {
            openChat();
        }
    }

    function openChat() {
        isOpen = true;
        toggleBtn.classList.add('open');
        chatWindow.classList.add('open');
        chatWindow.setAttribute('aria-modal', 'true');
        if (badge) badge.style.display = 'none';
        setTimeout(() => inputEl.focus(), 300);
        scrollToBottom();
    }

    function closeChat() {
        isOpen = false;
        toggleBtn.classList.remove('open');
        chatWindow.classList.remove('open');
        chatWindow.setAttribute('aria-modal', 'false');
    }

    // ── Messages ───────────────────────────────────────────────────────
    function addBotMessage(text) {
        const msgEl = createMessageEl('bot', text);
        messagesEl.appendChild(msgEl);
        scrollToBottom();
    }

    function addUserMessage(text) {
        const msgEl = createMessageEl('user', text);
        messagesEl.appendChild(msgEl);
        scrollToBottom();
    }

    function createMessageEl(role, text) {
        const wrapper = document.createElement('div');
        wrapper.className = `chat-msg ${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'chat-msg-avatar';
        avatar.textContent = role === 'bot' ? CHAT_CONFIG.botAvatar : CHAT_CONFIG.userAvatar;

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        // Sanitize: use textContent for plain text, allow line breaks
        bubble.textContent = text;

        const time = document.createElement('div');
        time.className = 'chat-msg-time';
        time.textContent = formatTime(new Date());

        const inner = document.createElement('div');
        inner.style.display = 'flex';
        inner.style.flexDirection = 'column';
        if (role === 'user') inner.style.alignItems = 'flex-end';
        inner.appendChild(bubble);
        inner.appendChild(time);

        wrapper.appendChild(avatar);
        wrapper.appendChild(inner);

        return wrapper;
    }

    function showTyping() {
        hideTyping();
        const el = document.createElement('div');
        el.className = 'chat-msg bot';
        el.id = 'freyai-typing-indicator';

        const avatar = document.createElement('div');
        avatar.className = 'chat-msg-avatar';
        avatar.textContent = CHAT_CONFIG.botAvatar;

        const dots = document.createElement('div');
        dots.className = 'chat-typing';
        dots.innerHTML = '<span></span><span></span><span></span>';

        el.appendChild(avatar);
        el.appendChild(dots);
        messagesEl.appendChild(el);
        scrollToBottom();
    }

    function hideTyping() {
        const existing = document.getElementById('freyai-typing-indicator');
        if (existing) existing.remove();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        });
    }

    function formatTime(date) {
        return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }

    // ── Quick Replies ──────────────────────────────────────────────────
    function showQuickReplies() {
        if (quickRepliesShown) return;
        quickRepliesShown = true;
        quickRepliesEl.innerHTML = '';

        CHAT_CONFIG.quickReplies.forEach(text => {
            const btn = document.createElement('button');
            btn.className = 'quick-reply-btn';
            btn.textContent = text;
            btn.addEventListener('click', () => {
                sendMessage(text);
                quickRepliesEl.innerHTML = '';
            });
            quickRepliesEl.appendChild(btn);
        });
    }

    // ── Send Message ───────────────────────────────────────────────────
    function handleSend() {
        const text = inputEl.value.trim();
        if (!text || isTyping) return;

        // Clear quick replies on first real send
        quickRepliesEl.innerHTML = '';

        sendMessage(text);

        // Reset input
        inputEl.value = '';
        inputEl.style.height = 'auto';
    }

    async function sendMessage(text) {
        if (isTyping) return;

        isTyping = true;
        sendBtn.disabled = true;

        addUserMessage(text);

        // Show typing after brief delay (store ref to clear on fast response)
        typingTimeout = setTimeout(showTyping, CHAT_CONFIG.typingDelay);

        try {
            const response = await fetch(CHAT_CONFIG.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    session_id: sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Update session ID if server returned a new one
            if (data.session_id) {
                sessionId = data.session_id;
                localStorage.setItem('freyai_chat_session_id', sessionId);
            }

            clearTimeout(typingTimeout);
            hideTyping();
            addBotMessage(data.reply || 'Entschuldigung, ich konnte Ihre Anfrage nicht verarbeiten.');

        } catch (err) {
            console.error('[FreyAI Chat] Error:', err);
            clearTimeout(typingTimeout);
            hideTyping();
            addBotMessage('Es tut mir leid, gerade gibt es ein technisches Problem. Bitte schreiben Sie uns direkt an anfragen@freyaivisions.de oder buchen Sie ein kostenloses Erstgespräch unter buchung.freyaivisions.de');
        } finally {
            isTyping = false;
            sendBtn.disabled = false;
            inputEl.focus();
        }
    }

    // ── Bootstrap ──────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
