/* ============================================
   Keyboard Shortcuts
   Global keyboard shortcut handling with chord support
   ============================================ */

class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.chords = new Map();
        this.enabled = true;
        this.lastKeyTime = 0;
        this.chordBuffer = [];
        this.chordTimeout = null;
        this.helpVisible = false;

        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) {return;}

            // Check if user is typing in input/textarea
            const activeElement = document.activeElement;
            const isTyping = activeElement.tagName === 'INPUT' ||
                           activeElement.tagName === 'TEXTAREA' ||
                           activeElement.isContentEditable;

            // Escape key always works (close modals)
            if (e.key === 'Escape') {
                this.handleEscape();
                return;
            }

            // ? or Shift+/ - Show help overlay (works even when typing)
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                e.preventDefault();
                this.toggleHelp();
                return;
            }

            // Other shortcuts only when not typing
            if (isTyping) {
                // Allow Ctrl+S in text fields (for Save)
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    this.trigger('Ctrl+S');
                }
                return;
            }

            // Build key combination string
            const parts = [];
            if (e.ctrlKey || e.metaKey) {parts.push('Ctrl');}
            if (e.altKey) {parts.push('Alt');}
            if (e.shiftKey && e.key !== '/') {parts.push('Shift');}
            parts.push(e.key.toUpperCase());
            const combo = parts.join('+');

            // Handle simple shortcuts
            if (this.shortcuts.has(combo)) {
                e.preventDefault();
                this.trigger(combo);
                return;
            }

            // Handle chord shortcuts (g d, g a, etc.)
            if (this.chords.has(e.key.toLowerCase())) {
                e.preventDefault();
                this.handleChord(e.key.toLowerCase());
            }
        });

        this.registerDefaultShortcuts();
    }

    handleChord(key) {
        // Clear existing timeout
        if (this.chordTimeout) {
            clearTimeout(this.chordTimeout);
        }

        // Add key to buffer
        this.chordBuffer.push(key);

        // Check if we have a complete chord
        const chord = this.chordBuffer.join('');
        if (this.chords.has(chord)) {
            this.trigger(chord);
            this.chordBuffer = [];
            return;
        }

        // Check if any chord starts with this buffer
        let hasMatch = false;
        for (let registeredChord of this.chords.keys()) {
            if (registeredChord.startsWith(chord)) {
                hasMatch = true;
                break;
            }
        }

        // If no match, reset buffer
        if (!hasMatch) {
            this.chordBuffer = [];
            return;
        }

        // Set timeout to reset buffer if no second key pressed
        this.chordTimeout = setTimeout(() => {
            this.chordBuffer = [];
        }, 1500);
    }

    registerDefaultShortcuts() {
        // ===== NAVIGATION CHORDS (g + key) =====
        // g d - Dashboard
        this.registerChord('gd', () => {
            this.navigateTo('dashboard');
        }, 'Zum Dashboard');

        // g a - Anfragen
        this.registerChord('ga', () => {
            this.navigateTo('anfragen');
        }, 'Zu Anfragen');

        // g o - Angebote
        this.registerChord('go', () => {
            this.navigateTo('angebote');
        }, 'Zu Angeboten');

        // g u - Aufträge
        this.registerChord('gu', () => {
            this.navigateTo('auftraege');
        }, 'Zu Aufträgen');

        // g r - Rechnungen
        this.registerChord('gr', () => {
            this.navigateTo('rechnungen');
        }, 'Zu Rechnungen');

        // g k - Kunden
        this.registerChord('gk', () => {
            this.navigateTo('kunden');
        }, 'Zu Kunden');

        // g e - Einstellungen
        this.registerChord('ge', () => {
            this.navigateTo('einstellungen');
        }, 'Zu Einstellungen');

        // ===== SIMPLE SHORTCUTS =====
        // n - New item (context-dependent)
        this.register('N', () => {
            this.createNewItem();
        }, 'Neues Element erstellen', 'Aktionen');

        // / - Focus search
        this.register('/', () => {
            const searchInput = document.getElementById('global-search');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }, 'Suche öffnen', 'Aktionen');

        // Ctrl+S - Save (prevent browser default)
        this.register('Ctrl+S', () => {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                const form = activeModal.querySelector('form');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            }
        }, 'Aktuelles Formular speichern', 'Aktionen');

        // Ctrl+K - Global Search (legacy)
        this.register('Ctrl+K', () => {
            const searchInput = document.getElementById('global-search');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }, 'Suche öffnen (Alt)', 'Aktionen');

        // Ctrl+N - New Inquiry (legacy)
        this.register('Ctrl+N', () => {
            this.createNewItem();
        }, 'Neue Anfrage erstellen (Alt)', 'Aktionen');

        // Ctrl+D - Dashboard (legacy)
        this.register('Ctrl+D', () => {
            this.navigateTo('dashboard');
        }, 'Dashboard öffnen (Alt)', 'Navigation');

        // Ctrl+B - Buchhaltung (legacy)
        this.register('Ctrl+B', () => {
            this.navigateTo('buchhaltung');
        }, 'Buchhaltung öffnen (Alt)', 'Navigation');
    }

    register(combo, callback, description = '', category = 'Allgemein') {
        this.shortcuts.set(combo, { callback, description, category });
    }

    registerChord(chord, callback, description = '', category = 'Navigation') {
        this.chords.set(chord, { callback, description, category });
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

    navigateTo(viewName) {
        const navButton = document.querySelector(`[data-view="${viewName}"]`);
        if (navButton) {
            navButton.click();
        } else {
            console.warn(`Navigation target not found: ${viewName}`);
        }
    }

    createNewItem() {
        // Get current view
        const activeView = document.querySelector('.view.active');
        const viewId = activeView?.id;

        // Determine what to create based on active view
        if (viewId === 'view-anfragen') {
            const btn = document.getElementById('btn-neue-anfrage');
            if (btn) {btn.click();}
        } else if (viewId === 'view-angebote') {
            const btn = document.getElementById('btn-neues-angebot');
            if (btn) {btn.click();}
        } else if (viewId === 'view-auftraege') {
            const btn = document.getElementById('btn-neuer-auftrag');
            if (btn) {btn.click();}
        } else if (viewId === 'view-rechnungen') {
            const btn = document.getElementById('btn-neue-rechnung');
            if (btn) {btn.click();}
        } else if (viewId === 'view-kunden') {
            const btn = document.getElementById('btn-neuer-kunde');
            if (btn) {btn.click();}
        } else {
            // Default: new Anfrage
            const btn = document.getElementById('btn-neue-anfrage');
            if (btn) {btn.click();}
        }
    }

    handleEscape() {
        // Close help overlay first if visible
        if (this.helpVisible) {
            this.toggleHelp();
            return;
        }

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

    toggleHelp() {
        if (this.helpVisible) {
            this.hideHelp();
        } else {
            this.showHelp();
        }
    }

    showHelp() {
        this.helpVisible = true;
        this.injectHelpOverlay();
    }

    hideHelp() {
        this.helpVisible = false;
        const overlay = document.getElementById('kb-shortcuts-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    injectHelpOverlay() {
        // Remove existing overlay if any
        const existing = document.getElementById('kb-shortcuts-overlay');
        if (existing) {
            existing.remove();
        }

        // Group shortcuts by category
        const shortcuts = Array.from(this.shortcuts.values());
        const chords = Array.from(this.chords.entries()).map(([key, data]) => ({
            key,
            ...data
        }));

        const categories = {};

        // Group shortcuts
        shortcuts.forEach(sh => {
            if (!categories[sh.category]) {
                categories[sh.category] = [];
            }
            categories[sh.category].push(sh);
        });

        // Group chords
        chords.forEach(ch => {
            if (!categories[ch.category]) {
                categories[ch.category] = [];
            }
            categories[ch.category].push({
                key: ch.key,
                description: ch.description,
                category: ch.category,
                isChord: true
            });
        });

        // Build HTML
        const categoryOrder = ['Navigation', 'Aktionen', 'Allgemein'];
        const orderedCategories = categoryOrder.filter(cat => categories[cat]);

        let categoriesHTML = '';
        orderedCategories.forEach(category => {
            const items = categories[category];
            const itemsHTML = items.map(item => {
                let keyDisplay = item.key || item.category;
                if (item.isChord) {
                    keyDisplay = item.key.split('').join(' + ');
                }
                return `
                    <div class="kb-shortcut-row">
                        <div class="kb-shortcut-key">${keyDisplay}</div>
                        <div class="kb-shortcut-desc">${item.description}</div>
                    </div>
                `;
            }).join('');

            categoriesHTML += `
                <div class="kb-category">
                    <h3 class="kb-category-title">${category}</h3>
                    ${itemsHTML}
                </div>
            `;
        });

        const overlayHTML = `
            <div id="kb-shortcuts-overlay" class="kb-overlay">
                <div class="kb-modal">
                    <div class="kb-header">
                        <h2>⌨️ Tastenkürzel</h2>
                        <button class="kb-close" aria-label="Schließen">&times;</button>
                    </div>
                    <div class="kb-content">
                        ${categoriesHTML}
                    </div>
                    <div class="kb-footer">
                        <p class="kb-hint">Drücken Sie <kbd>Esc</kbd> zum Schließen</p>
                    </div>
                </div>
            </div>
        `;

        // Create CSS styles
        const styleId = 'kb-shortcuts-styles';
        if (!document.getElementById(styleId)) {
            const styles = document.createElement('style');
            styles.id = styleId;
            styles.textContent = `
                .kb-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    animation: kb-fade-in 0.2s ease-out;
                }

                @keyframes kb-fade-in {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                .kb-modal {
                    background: var(--bg-secondary, #1a1a2e);
                    border: 1px solid var(--border-color, #333);
                    border-radius: 12px;
                    max-width: 800px;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                    animation: kb-slide-up 0.3s ease-out;
                }

                @keyframes kb-slide-up {
                    from {
                        transform: translateY(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                .kb-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 24px;
                    border-bottom: 1px solid var(--border-color, #333);
                }

                .kb-header h2 {
                    margin: 0;
                    font-size: 24px;
                    color: var(--text-primary, #fff);
                }

                .kb-close {
                    background: none;
                    border: none;
                    font-size: 28px;
                    color: var(--text-secondary, #ccc);
                    cursor: pointer;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: all 0.2s;
                }

                .kb-close:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: var(--text-primary, #fff);
                }

                .kb-content {
                    padding: 24px;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 32px;
                }

                .kb-category {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .kb-category-title {
                    margin: 0 0 12px 0;
                    font-size: 14px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: var(--text-muted, #888);
                }

                .kb-shortcut-row {
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                }

                .kb-shortcut-key {
                    flex-shrink: 0;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    background: var(--bg-card, #0f0f1e);
                    border: 1px solid var(--border-color, #333);
                    border-radius: 6px;
                    padding: 6px 10px;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-accent, #6366f1);
                    white-space: nowrap;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                .kb-shortcut-desc {
                    flex: 1;
                    font-size: 13px;
                    color: var(--text-primary, #fff);
                    line-height: 1.4;
                    padding-top: 4px;
                }

                .kb-footer {
                    padding: 16px 24px;
                    border-top: 1px solid var(--border-color, #333);
                    text-align: center;
                }

                .kb-hint {
                    margin: 0;
                    font-size: 12px;
                    color: var(--text-muted, #888);
                }

                .kb-hint kbd {
                    background: var(--bg-card, #0f0f1e);
                    border: 1px solid var(--border-color, #333);
                    border-radius: 4px;
                    padding: 2px 6px;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 11px;
                    color: var(--text-accent, #6366f1);
                }

                @media (max-width: 768px) {
                    .kb-modal {
                        max-width: 90vw;
                        max-height: 90vh;
                    }

                    .kb-content {
                        grid-template-columns: 1fr;
                        gap: 24px;
                    }

                    .kb-header {
                        padding: 16px;
                    }

                    .kb-content {
                        padding: 16px;
                    }

                    .kb-footer {
                        padding: 12px 16px;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        // Insert overlay
        document.body.insertAdjacentHTML('beforeend', overlayHTML);

        // Attach event listeners
        const overlay = document.getElementById('kb-shortcuts-overlay');
        const closeBtn = overlay.querySelector('.kb-close');

        closeBtn.addEventListener('click', () => {
            this.hideHelp();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideHelp();
            }
        });
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

    unregisterChord(chord) {
        this.chords.delete(chord);
    }

    getAll() {
        return Array.from(this.shortcuts.entries());
    }

    getAllChords() {
        return Array.from(this.chords.entries());
    }
}

// Initialize keyboard shortcuts
window.keyboardShortcuts = new KeyboardShortcuts();
