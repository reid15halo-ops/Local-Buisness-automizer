/* ============================================
   Keyboard Shortcuts
   Global keyboard shortcut handling
   ============================================ */

class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.enabled = true;

        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;

            // Check if user is typing in input/textarea
            const activeElement = document.activeElement;
            const isTyping = activeElement.tagName === 'INPUT' ||
                           activeElement.tagName === 'TEXTAREA' ||
                           activeElement.isContentEditable;

            // Build key combination string
            const parts = [];
            if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');
            parts.push(e.key.toUpperCase());
            const combo = parts.join('+');

            // Escape key always works (close modals)
            if (e.key === 'Escape') {
                this.handleEscape();
                return;
            }

            // Other shortcuts only when not typing
            if (isTyping) {
                // Allow Ctrl+S in text fields (for Save)
                if (combo === 'Ctrl+S') {
                    e.preventDefault();
                    this.trigger(combo);
                }
                return;
            }

            // Trigger shortcut if registered
            if (this.shortcuts.has(combo)) {
                e.preventDefault();
                this.trigger(combo);
            }
        });

        this.registerDefaultShortcuts();
    }

    registerDefaultShortcuts() {
        // Ctrl+K - Global Search
        this.register('Ctrl+K', () => {
            const searchInput = document.getElementById('global-search');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }, 'Suche öffnen');

        // Ctrl+N - New Inquiry
        this.register('Ctrl+N', () => {
            const btn = document.getElementById('btn-neue-anfrage');
            if (btn) btn.click();
        }, 'Neue Anfrage');

        // Ctrl+S - Save (prevent browser default)
        this.register('Ctrl+S', () => {
            // If a modal is open and has a form, submit it
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                const form = activeModal.querySelector('form');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            }
        }, 'Speichern');

        // Ctrl+D - Dashboard
        this.register('Ctrl+D', () => {
            if (window.navigationController) {
                window.navigationController.navigateTo('dashboard');
            }
        }, 'Dashboard öffnen');

        // Ctrl+B - Buchhaltung
        this.register('Ctrl+B', () => {
            if (window.navigationController) {
                window.navigationController.navigateTo('buchhaltung');
            }
        }, 'Buchhaltung öffnen');

        // ? - Show keyboard shortcuts help
        this.register('Shift+/', () => {
            this.showHelp();
        }, 'Tastenkürzel anzeigen');
    }

    register(combo, callback, description = '') {
        this.shortcuts.set(combo, { callback, description });
    }

    trigger(combo) {
        const shortcut = this.shortcuts.get(combo);
        if (shortcut && typeof shortcut.callback === 'function') {
            try {
                shortcut.callback();
            } catch (error) {
                console.error(`Shortcut ${combo} failed:`, error);
            }
        }
    }

    handleEscape() {
        // Close active modal
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.classList.remove('active');
            return;
        }

        // Close global search if focused
        const searchInput = document.getElementById('global-search');
        if (searchInput === document.activeElement) {
            searchInput.blur();
            return;
        }

        // Close any open dropdown/menu
        document.querySelectorAll('.dropdown.active, .menu.active').forEach(el => {
            el.classList.remove('active');
        });
    }

    showHelp() {
        const shortcuts = Array.from(this.shortcuts.entries());
        const helpHTML = `
            <div style="padding: 24px;">
                <h2>⌨️ Tastenkürzel</h2>
                <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <th style="text-align: left; padding: 8px;">Tastenkombination</th>
                            <th style="text-align: left; padding: 8px;">Aktion</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${shortcuts.map(([combo, data]) => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <td style="padding: 8px;">
                                    <kbd style="background: var(--bg-card); padding: 4px 8px; border-radius: 4px; font-family: monospace;">
                                        ${combo.replace(/\+/g, ' + ')}
                                    </kbd>
                                </td>
                                <td style="padding: 8px;">${data.description}</td>
                            </tr>
                        `).join('')}
                        <tr>
                            <td style="padding: 8px;">
                                <kbd style="background: var(--bg-card); padding: 4px 8px; border-radius: 4px; font-family: monospace;">
                                    Esc
                                </kbd>
                            </td>
                            <td style="padding: 8px;">Dialog schließen / Fokus entfernen</td>
                        </tr>
                    </tbody>
                </table>
                <div style="margin-top: 16px; text-align: right;">
                    <button class="btn btn-secondary modal-close">Schließen</button>
                </div>
            </div>
        `;

        const helpModal = document.getElementById('modal-help');
        if (helpModal) {
            const content = helpModal.querySelector('.help-content, .modal-content > div');
            if (content) {
                content.innerHTML = helpHTML;
            }
            helpModal.classList.add('active');
        }
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    unregister(combo) {
        this.shortcuts.delete(combo);
    }

    getAll() {
        return Array.from(this.shortcuts.entries());
    }
}

// Initialize keyboard shortcuts
window.keyboardShortcuts = new KeyboardShortcuts();
