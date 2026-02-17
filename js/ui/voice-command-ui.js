/* ============================================
   Voice Command UI
   Floating microphone button, command help overlay,
   toast notifications, and listening indicators for
   the MHS Workflow voice system.

   All CSS is injected inline via initCSS() — no
   separate stylesheet required.
   ============================================ */

class VoiceCommandUI {
    constructor() {
        this._service = null; // resolved lazily
        this._fabEl = null;
        this._overlayEl = null;
        this._toastEl = null;
        this._headerDot = null;
        this._longPressTimer = null;
        this._initialized = false;

        this._init();
    }

    // ========================================================
    //  Initialization
    // ========================================================

    _init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._setup());
        } else {
            this._setup();
        }
    }

    _setup() {
        if (this._initialized) { return; }
        this._initialized = true;

        this._service = window.voiceCommandService;

        // If the browser does not support speech at all, stay hidden
        if (!this._service || !this._service.isSupported()) {
            console.log('[VoiceUI] Spracherkennung nicht unterstuetzt – UI wird nicht angezeigt');
            return;
        }

        this.initCSS();
        this._createFAB();
        this._createToastContainer();
        this._createHeaderDot();
        this._bindEvents();
    }

    // ========================================================
    //  CSS (injected inline)
    // ========================================================

    initCSS() {
        if (document.getElementById('mhs-voice-ui-styles')) { return; }

        const style = document.createElement('style');
        style.id = 'mhs-voice-ui-styles';
        style.textContent = `
            /* ---- Floating Mic Button ---- */
            .mhs-voice-fab {
                position: fixed;
                bottom: 24px;
                left: 24px;
                width: 52px;
                height: 52px;
                border-radius: 50%;
                border: none;
                background: var(--bg-card, #23232b);
                color: #fff;
                font-size: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 16px rgba(0,0,0,0.35);
                z-index: 9990;
                transition: background 0.3s, box-shadow 0.3s, transform 0.2s;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
            }
            .mhs-voice-fab:hover {
                transform: scale(1.08);
            }
            .mhs-voice-fab:active {
                transform: scale(0.95);
            }

            /* Idle (grey tint) */
            .mhs-voice-fab--idle {
                background: var(--bg-card, #23232b);
                border: 2px solid var(--border-color, #3a3a44);
            }

            /* Listening (pulsing green) */
            .mhs-voice-fab--listening {
                background: #16a34a;
                border: 2px solid #22c55e;
                animation: mhsVoicePulseGreen 1.5s ease-in-out infinite;
            }

            /* Dictating (pulsing blue) */
            .mhs-voice-fab--dictating {
                background: #2563eb;
                border: 2px solid #3b82f6;
                animation: mhsVoicePulseBlue 1.5s ease-in-out infinite;
            }

            @keyframes mhsVoicePulseGreen {
                0%, 100% {
                    box-shadow: 0 0 0 0 rgba(34,197,94,0.5), 0 4px 16px rgba(0,0,0,0.35);
                }
                50% {
                    box-shadow: 0 0 0 12px rgba(34,197,94,0), 0 4px 16px rgba(0,0,0,0.35);
                }
            }

            @keyframes mhsVoicePulseBlue {
                0%, 100% {
                    box-shadow: 0 0 0 0 rgba(59,130,246,0.5), 0 4px 16px rgba(0,0,0,0.35);
                }
                50% {
                    box-shadow: 0 0 0 12px rgba(59,130,246,0), 0 4px 16px rgba(0,0,0,0.35);
                }
            }

            /* Sound wave bars inside the FAB when active */
            .mhs-voice-fab-bars {
                display: none;
                gap: 2px;
                align-items: center;
                justify-content: center;
                height: 20px;
            }
            .mhs-voice-fab--listening .mhs-voice-fab-bars,
            .mhs-voice-fab--dictating .mhs-voice-fab-bars {
                display: flex;
            }
            .mhs-voice-fab--listening .mhs-voice-fab-icon,
            .mhs-voice-fab--dictating .mhs-voice-fab-icon {
                display: none;
            }
            .mhs-voice-fab-bar {
                width: 3px;
                border-radius: 2px;
                background: #fff;
                animation: mhsVoiceBar 0.8s ease-in-out infinite;
            }
            .mhs-voice-fab-bar:nth-child(1) { height: 8px;  animation-delay: 0s; }
            .mhs-voice-fab-bar:nth-child(2) { height: 14px; animation-delay: 0.15s; }
            .mhs-voice-fab-bar:nth-child(3) { height: 18px; animation-delay: 0.3s; }
            .mhs-voice-fab-bar:nth-child(4) { height: 14px; animation-delay: 0.45s; }
            .mhs-voice-fab-bar:nth-child(5) { height: 8px;  animation-delay: 0.6s; }

            @keyframes mhsVoiceBar {
                0%, 100% { transform: scaleY(0.5); }
                50%      { transform: scaleY(1.3); }
            }

            /* ---- Header Listening Dot ---- */
            .mhs-voice-header-dot {
                display: none;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-left: 8px;
                flex-shrink: 0;
            }
            .mhs-voice-header-dot--listening {
                display: inline-block;
                background: #22c55e;
                animation: mhsVoiceDotPulse 1.2s ease-in-out infinite;
            }
            .mhs-voice-header-dot--dictating {
                display: inline-block;
                background: #3b82f6;
                animation: mhsVoiceDotPulse 1.2s ease-in-out infinite;
            }

            @keyframes mhsVoiceDotPulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50%      { opacity: 0.5; transform: scale(0.7); }
            }

            /* ---- Toast Notification ---- */
            .mhs-voice-toast-container {
                position: fixed;
                top: 16px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10100;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }
            .mhs-voice-toast {
                background: var(--bg-card, #23232b);
                color: var(--text-primary, #e5e5e5);
                border: 1px solid var(--border-color, #3a3a44);
                border-radius: 10px;
                padding: 10px 20px;
                font-size: 14px;
                box-shadow: 0 6px 24px rgba(0,0,0,0.4);
                opacity: 0;
                transform: translateY(-16px);
                animation: mhsVoiceToastIn 0.3s ease forwards;
                pointer-events: auto;
                max-width: 90vw;
                text-align: center;
            }
            .mhs-voice-toast--out {
                animation: mhsVoiceToastOut 0.3s ease forwards;
            }

            @keyframes mhsVoiceToastIn {
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes mhsVoiceToastOut {
                from { opacity: 1; transform: translateY(0); }
                to   { opacity: 0; transform: translateY(-16px); }
            }

            /* ---- Command Help Overlay ---- */
            .mhs-voice-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.6);
                z-index: 10050;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: mhsVoiceOverlayIn 0.25s ease;
            }
            .mhs-voice-overlay--out {
                animation: mhsVoiceOverlayOut 0.2s ease forwards;
            }

            @keyframes mhsVoiceOverlayIn {
                from { opacity: 0; }
                to   { opacity: 1; }
            }
            @keyframes mhsVoiceOverlayOut {
                from { opacity: 1; }
                to   { opacity: 0; }
            }

            .mhs-voice-help-card {
                background: var(--bg-card, #23232b);
                border: 1px solid var(--border-color, #3a3a44);
                border-radius: 16px;
                width: 420px;
                max-width: 92vw;
                max-height: 80vh;
                overflow-y: auto;
                padding: 28px 24px 20px;
                box-shadow: 0 12px 48px rgba(0,0,0,0.5);
                animation: mhsVoiceCardSlide 0.3s ease;
            }

            @keyframes mhsVoiceCardSlide {
                from { transform: translateY(24px); opacity: 0; }
                to   { transform: translateY(0); opacity: 1; }
            }

            .mhs-voice-help-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
            }
            .mhs-voice-help-title {
                font-size: 18px;
                font-weight: 700;
                color: var(--text-primary, #e5e5e5);
            }
            .mhs-voice-help-close {
                background: none;
                border: none;
                font-size: 22px;
                cursor: pointer;
                color: var(--text-muted, #888);
                padding: 4px 8px;
                border-radius: 6px;
                transition: background 0.15s;
            }
            .mhs-voice-help-close:hover {
                background: var(--bg-hover, #2a2a32);
            }

            .mhs-voice-help-group {
                margin-bottom: 18px;
            }
            .mhs-voice-help-group-title {
                font-size: 13px;
                font-weight: 600;
                color: var(--text-muted, #888);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
                padding-bottom: 4px;
                border-bottom: 1px solid var(--border-color, #3a3a44);
            }
            .mhs-voice-help-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 7px 0;
                font-size: 14px;
                color: var(--text-primary, #e5e5e5);
            }
            .mhs-voice-help-phrase {
                background: var(--bg-hover, #2a2a32);
                border-radius: 6px;
                padding: 3px 10px;
                font-family: monospace;
                font-size: 13px;
                color: #22c55e;
                white-space: nowrap;
            }
            .mhs-voice-help-label {
                flex: 1;
                color: var(--text-secondary, #b0b0b0);
            }

            .mhs-voice-help-footer {
                margin-top: 16px;
                padding-top: 12px;
                border-top: 1px solid var(--border-color, #3a3a44);
                font-size: 12px;
                color: var(--text-muted, #888);
                text-align: center;
                line-height: 1.5;
            }

            /* ---- Dictating Input Visual ---- */
            .mhs-voice-dictating {
                outline: 2px solid #3b82f6 !important;
                animation: mhsVoiceDictBorder 1.5s ease-in-out infinite;
            }
            @keyframes mhsVoiceDictBorder {
                0%, 100% { outline-color: #3b82f6; }
                50%      { outline-color: #93c5fd; }
            }

            /* ---- Responsive ---- */
            @media (max-width: 768px) {
                .mhs-voice-fab {
                    bottom: 80px;
                    left: 16px;
                    width: 48px;
                    height: 48px;
                    font-size: 20px;
                }
                .mhs-voice-help-card {
                    width: 100%;
                    max-width: 95vw;
                    border-radius: 12px;
                    padding: 20px 16px 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ========================================================
    //  Floating Action Button (Mic)
    // ========================================================

    _createFAB() {
        if (this._fabEl) { return; }

        const fab = document.createElement('button');
        fab.className = 'mhs-voice-fab mhs-voice-fab--idle';
        fab.id = 'mhs-voice-fab';
        fab.setAttribute('aria-label', 'Sprachsteuerung ein/aus');
        fab.setAttribute('title', 'Sprachsteuerung (lang druecken = Hilfe)');

        // Mic icon
        const icon = document.createElement('span');
        icon.className = 'mhs-voice-fab-icon';
        icon.textContent = '\uD83C\uDFA4'; // microphone emoji
        fab.appendChild(icon);

        // Sound wave bars (shown when active)
        const bars = document.createElement('span');
        bars.className = 'mhs-voice-fab-bars';
        for (let i = 0; i < 5; i++) {
            const bar = document.createElement('span');
            bar.className = 'mhs-voice-fab-bar';
            bars.appendChild(bar);
        }
        fab.appendChild(bars);

        document.body.appendChild(fab);
        this._fabEl = fab;

        // Click = toggle listening
        fab.addEventListener('click', (e) => {
            // Only act if this is not the end of a long-press
            if (this._longPressHandled) {
                this._longPressHandled = false;
                return;
            }
            if (this._service) {
                this._service.toggle();
            }
        });

        // Long-press = open help overlay (500ms)
        fab.addEventListener('pointerdown', (e) => {
            this._longPressHandled = false;
            this._longPressTimer = setTimeout(() => {
                this._longPressHandled = true;
                this._showHelpOverlay();
            }, 500);
        });
        fab.addEventListener('pointerup', () => {
            clearTimeout(this._longPressTimer);
        });
        fab.addEventListener('pointerleave', () => {
            clearTimeout(this._longPressTimer);
        });
        fab.addEventListener('pointercancel', () => {
            clearTimeout(this._longPressTimer);
        });
    }

    // ========================================================
    //  Toast Notifications
    // ========================================================

    _createToastContainer() {
        if (document.getElementById('mhs-voice-toast-container')) { return; }

        const container = document.createElement('div');
        container.className = 'mhs-voice-toast-container';
        container.id = 'mhs-voice-toast-container';
        document.body.appendChild(container);
        this._toastEl = container;
    }

    /**
     * Show a brief toast at the top of the screen.
     * @param {string} text - safe text to display
     * @param {number} [duration=2500] - ms before auto-dismiss
     */
    _showToast(text, duration) {
        if (!this._toastEl) { return; }
        duration = duration || 2500;

        const toast = document.createElement('div');
        toast.className = 'mhs-voice-toast';
        // XSS-safe: use textContent
        toast.textContent = text;
        this._toastEl.appendChild(toast);

        // Auto-remove
        setTimeout(() => {
            toast.classList.add('mhs-voice-toast--out');
            toast.addEventListener('animationend', () => toast.remove(), { once: true });
        }, duration);
    }

    // ========================================================
    //  Header Listening Dot
    // ========================================================

    _createHeaderDot() {
        // Place a small dot indicator next to the mobile header title or search bar
        const header = document.querySelector('.mobile-header') ||
                       document.querySelector('.header') ||
                       document.querySelector('header');
        if (!header) { return; }

        const dot = document.createElement('span');
        dot.className = 'mhs-voice-header-dot';
        dot.id = 'mhs-voice-header-dot';

        // Try to insert next to the first heading/title in the header
        const title = header.querySelector('h1, h2, .header-title, .mobile-header-title');
        if (title) {
            title.style.display = 'flex';
            title.style.alignItems = 'center';
            title.appendChild(dot);
        } else {
            header.appendChild(dot);
        }

        this._headerDot = dot;
    }

    // ========================================================
    //  Command Help Overlay
    // ========================================================

    _showHelpOverlay() {
        // Prevent duplicates
        if (this._overlayEl) { return; }

        const overlay = document.createElement('div');
        overlay.className = 'mhs-voice-overlay';
        overlay.id = 'mhs-voice-help-overlay';

        const card = document.createElement('div');
        card.className = 'mhs-voice-help-card';

        // --- Header ---
        const header = document.createElement('div');
        header.className = 'mhs-voice-help-header';

        const title = document.createElement('div');
        title.className = 'mhs-voice-help-title';
        title.textContent = '\uD83C\uDFA4 Sprachbefehle';
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'mhs-voice-help-close';
        closeBtn.setAttribute('aria-label', 'Schliessen');
        closeBtn.textContent = '\u2715'; // multiplication sign (x)
        closeBtn.addEventListener('click', () => this._closeHelpOverlay());
        header.appendChild(closeBtn);

        card.appendChild(header);

        // --- Command List ---
        const commands = this._service ? this._service.getAvailableCommands() : [];

        // Group by category
        const groups = {};
        for (const cmd of commands) {
            const cat = cmd.category || 'Sonstiges';
            if (!groups[cat]) { groups[cat] = []; }
            groups[cat].push(cmd);
        }

        // Desired order
        const categoryOrder = ['Navigation', 'Erstellen', 'Suche', 'Zeiterfassung', 'Hilfe', 'Benutzerdefiniert', 'Sonstiges'];
        const sortedCategories = Object.keys(groups).sort((a, b) => {
            const ia = categoryOrder.indexOf(a);
            const ib = categoryOrder.indexOf(b);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });

        for (const cat of sortedCategories) {
            const groupEl = document.createElement('div');
            groupEl.className = 'mhs-voice-help-group';

            const groupTitle = document.createElement('div');
            groupTitle.className = 'mhs-voice-help-group-title';
            groupTitle.textContent = cat;
            groupEl.appendChild(groupTitle);

            for (const cmd of groups[cat]) {
                const item = document.createElement('div');
                item.className = 'mhs-voice-help-item';

                const phrase = document.createElement('span');
                phrase.className = 'mhs-voice-help-phrase';
                // Show first phrase (textContent for XSS safety)
                phrase.textContent = '"' + (cmd.phrases[0] || '') + '"';
                item.appendChild(phrase);

                const label = document.createElement('span');
                label.className = 'mhs-voice-help-label';
                label.textContent = cmd.label;
                item.appendChild(label);

                groupEl.appendChild(item);
            }

            card.appendChild(groupEl);
        }

        // --- Footer ---
        const footer = document.createElement('div');
        footer.className = 'mhs-voice-help-footer';
        footer.textContent = 'Tipp: Sprechen Sie klar und deutlich. Befehle werden auf Deutsch erkannt.';
        card.appendChild(footer);

        overlay.appendChild(card);
        document.body.appendChild(overlay);
        this._overlayEl = overlay;

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this._closeHelpOverlay();
            }
        });

        // Close on Escape
        this._helpEscHandler = (e) => {
            if (e.key === 'Escape') {
                this._closeHelpOverlay();
            }
        };
        document.addEventListener('keydown', this._helpEscHandler);
    }

    _closeHelpOverlay() {
        if (!this._overlayEl) { return; }

        this._overlayEl.classList.add('mhs-voice-overlay--out');
        this._overlayEl.addEventListener('animationend', () => {
            if (this._overlayEl) {
                this._overlayEl.remove();
                this._overlayEl = null;
            }
        }, { once: true });

        if (this._helpEscHandler) {
            document.removeEventListener('keydown', this._helpEscHandler);
            this._helpEscHandler = null;
        }
    }

    // ========================================================
    //  Event Binding
    // ========================================================

    _bindEvents() {
        // Listen for state changes from the service
        document.addEventListener('mhs:voice-state', (e) => {
            const { listening, dictating } = e.detail;
            this._updateFABState(listening, dictating);
            this._updateHeaderDot(listening, dictating);
        });

        // Listen for command recognition events (show toast)
        document.addEventListener('mhs:voice-command', (e) => {
            const { label, matched } = e.detail;
            if (matched && label) {
                this._showToast('\uD83C\uDFA4 ' + label);
            } else if (!matched) {
                this._showToast('\uD83C\uDFA4 Befehl nicht erkannt', 2000);
            }
        });

        // Listen for the "show help" event dispatched by the service's "Hilfe" command
        document.addEventListener('mhs:voice-show-help', () => {
            this._showHelpOverlay();
        });
    }

    // ========================================================
    //  State Updates
    // ========================================================

    _updateFABState(listening, dictating) {
        if (!this._fabEl) { return; }

        // Remove all state classes
        this._fabEl.classList.remove(
            'mhs-voice-fab--idle',
            'mhs-voice-fab--listening',
            'mhs-voice-fab--dictating'
        );

        if (dictating) {
            this._fabEl.classList.add('mhs-voice-fab--dictating');
        } else if (listening) {
            this._fabEl.classList.add('mhs-voice-fab--listening');
        } else {
            this._fabEl.classList.add('mhs-voice-fab--idle');
        }
    }

    _updateHeaderDot(listening, dictating) {
        if (!this._headerDot) { return; }

        this._headerDot.classList.remove(
            'mhs-voice-header-dot--listening',
            'mhs-voice-header-dot--dictating'
        );

        if (dictating) {
            this._headerDot.classList.add('mhs-voice-header-dot--dictating');
        } else if (listening) {
            this._headerDot.classList.add('mhs-voice-header-dot--listening');
        }
        // If neither, the dot stays display:none via CSS default
    }
}

// ============================================================
//  Global Singleton
// ============================================================
window.voiceCommandUI = new VoiceCommandUI();
