/* ============================================
   Theme Manager
   Dark/Light mode toggle with persistence
   ============================================ */

class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
        this.storageKey = 'freyai-theme';

        this.init();
    }

    init() {
        // Load saved theme
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            this.currentTheme = saved;
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = prefersDark ? 'dark' : 'light';
        }

        this.applyTheme(this.currentTheme);

        // Setup toggle button
        this.setupToggle();

        // Listen to system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(this.storageKey)) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    setupToggle() {
        const toggleBtn = document.getElementById('theme-toggle');
        if (!toggleBtn) {return;}

        toggleBtn.addEventListener('click', () => {
            this.toggle();
        });

        this.updateToggleButton();
    }

    toggle() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);
        localStorage.setItem(this.storageKey, theme);
        this.updateToggleButton();

        // Show toast
        if (window.showToast) {
            window.showToast(`${theme === 'dark' ? 'Dark' : 'Light'} Mode aktiviert`, 'info');
        }
    }

    applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    }

    updateToggleButton() {
        const icon = document.getElementById('theme-icon');
        const text = document.getElementById('theme-text');

        if (!icon || !text) {return;}

        if (this.currentTheme === 'dark') {
            icon.textContent = '☀️';
            text.textContent = 'Light Mode';
        } else {
            icon.textContent = '🌙';
            text.textContent = 'Dark Mode';
        }
    }

    getTheme() {
        return this.currentTheme;
    }
}

// Initialize theme manager
window.themeManager = new ThemeManager();
