/* ============================================
   Theme Service - Dark/Light Mode Toggle
   User theme preferences
   ============================================ */

class ThemeService {
    constructor() {
        this.settings = JSON.parse(localStorage.getItem('freyai_theme_settings') || '{}');

        // Default settings
        if (!this.settings.theme) {
            // Default to dark or system preference
            this.settings.theme = this.getSystemTheme();
        }
        if (!this.settings.accentColor) {
            this.settings.accentColor = '#6366f1'; // Indigo
        }

        // Apply theme on load
        this.applyTheme();

        // Listen for system theme changes
        this.watchSystemTheme();
    }

    // Get system theme preference
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }

    // Watch for system theme changes
    watchSystemTheme() {
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (this.settings.theme === 'system') {
                    this.applyTheme();
                }
            });
        }
    }

    // Get current theme
    getCurrentTheme() {
        if (this.settings.theme === 'system') {
            return this.getSystemTheme();
        }
        return this.settings.theme;
    }

    // Set theme
    setTheme(theme) {
        this.settings.theme = theme; // 'dark', 'light', 'system'
        this.save();
        this.applyTheme();
    }

    // Toggle between dark and light
    toggleTheme() {
        const current = this.getCurrentTheme();
        this.settings.theme = current === 'dark' ? 'light' : 'dark';
        this.save();
        this.applyTheme();
        return this.settings.theme;
    }

    // Apply theme to document
    applyTheme() {
        const theme = this.getCurrentTheme();
        const root = document.documentElement;

        if (theme === 'light') {
            // Light theme colors
            root.style.setProperty('--bg-primary', '#f8fafc');
            root.style.setProperty('--bg-secondary', '#f1f5f9');
            root.style.setProperty('--bg-card', '#ffffff');
            root.style.setProperty('--bg-card-hover', '#f8fafc');
            root.style.setProperty('--text-primary', '#1e293b');
            root.style.setProperty('--text-secondary', '#64748b');
            root.style.setProperty('--text-muted', '#94a3b8');
            root.style.setProperty('--border-color', '#e2e8f0');
            root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.1)');
            document.body.classList.remove('theme-dark');
            document.body.classList.add('theme-light');
        } else {
            // Dark theme colors (default)
            root.style.setProperty('--bg-primary', '#0f172a');
            root.style.setProperty('--bg-secondary', '#1e293b');
            root.style.setProperty('--bg-card', '#1e293b');
            root.style.setProperty('--bg-card-hover', '#334155');
            root.style.setProperty('--text-primary', '#f1f5f9');
            root.style.setProperty('--text-secondary', '#94a3b8');
            root.style.setProperty('--text-muted', '#64748b');
            root.style.setProperty('--border-color', '#334155');
            root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)');
            document.body.classList.remove('theme-light');
            document.body.classList.add('theme-dark');
        }

        // Apply accent color
        this.applyAccentColor(this.settings.accentColor);
    }

    // Set accent color
    setAccentColor(color) {
        this.settings.accentColor = color;
        this.save();
        this.applyAccentColor(color);
    }

    // Apply accent color
    applyAccentColor(color) {
        const root = document.documentElement;
        root.style.setProperty('--accent-primary', color);

        // Generate lighter/darker variants
        root.style.setProperty('--accent-hover', this.adjustColor(color, 20));
        root.style.setProperty('--accent-light', this.adjustColor(color, -30, 0.2));
    }

    // Adjust color brightness
    adjustColor(hex, percent, alpha = null) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, Math.max(0, (num >> 16) + amt));
        const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt));
        const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));

        if (alpha !== null) {
            return `rgba(${R}, ${G}, ${B}, ${alpha})`;
        }
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    // Preset accent colors
    getAccentPresets() {
        return [
            { name: 'Indigo', color: '#6366f1' },
            { name: 'Blue', color: '#3b82f6' },
            { name: 'Green', color: '#22c55e' },
            { name: 'Emerald', color: '#10b981' },
            { name: 'Teal', color: '#14b8a6' },
            { name: 'Orange', color: '#f97316' },
            { name: 'Red', color: '#ef4444' },
            { name: 'Pink', color: '#ec4899' },
            { name: 'Purple', color: '#a855f7' }
        ];
    }

    // Create theme toggle button
    createToggleButton() {
        const button = document.createElement('button');
        button.className = 'theme-toggle-btn';
        button.innerHTML = this.getCurrentTheme() === 'dark' ? '☀️' : '🌙';
        button.title = 'Theme umschalten';
        button.onclick = () => {
            const newTheme = this.toggleTheme();
            button.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
        };
        return button;
    }

    // Get all settings
    getSettings() {
        return {
            theme: this.settings.theme,
            currentTheme: this.getCurrentTheme(),
            accentColor: this.settings.accentColor
        };
    }

    // Persistence
    save() {
        localStorage.setItem('freyai_theme_settings', JSON.stringify(this.settings));
    }
}

window.themeService = new ThemeService();
