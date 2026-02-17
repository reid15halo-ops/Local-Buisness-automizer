/* ============================================
   UI Helpers
   Shared formatting and UI utility functions
   ============================================ */

window.UI = {
    // --- Formatting ---

    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0);
    },

    formatDate(dateStr) {
        if (!dateStr) {return '-';}
        return new Date(dateStr).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    formatDateTime(dateStr) {
        if (!dateStr) {return '-';}
        return new Date(dateStr).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    getRelativeTime(dateStr) {
        if (!dateStr) {return '-';}
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {return 'Gerade eben';}
        if (diffMins < 60) {return `vor ${diffMins} Min.`;}
        if (diffHours < 24) {return `vor ${diffHours} Std.`;}
        if (diffDays < 7) {return `vor ${diffDays} Tagen`;}
        return this.formatDate(dateStr);
    },

    getLeistungsartLabel(key) {
        const labels = {
            'metallbau': 'Metallbau / Stahlkonstruktion',
            'schweissen': 'Schweißarbeiten',
            'rohrleitungsbau': 'Rohrleitungsbau',
            'industriemontage': 'Industriemontage',
            'hydraulik': 'Hydraulikschläuche',
            'reparatur': 'Reparatur / Wartung',
            'sonstiges': 'Sonstiges'
        };
        return labels[key] || key;
    },

    // --- Security ---

    sanitize(str) {
        if (!str) {return '';}
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    // --- Modal Management ---

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            // Auto-focus first input
            const input = modal.querySelector('input, textarea');
            if (input) {input.focus();}
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },

    // --- Dynamic Loading ---

    loadScript(src, id) {
        return new Promise((resolve, reject) => {
            if (document.getElementById(id)) { resolve(); return; }
            const script = document.createElement('script');
            script.src = src;
            script.id = id;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    },

    // --- Global Loader ---
    showLoading(text = 'Laden...') {
        let loader = document.querySelector('.global-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.className = 'global-loader';
            loader.innerHTML = '<div class="spinner"></div><div class="loader-text"></div>';
            document.body.appendChild(loader);
        }
        loader.querySelector('.loader-text').textContent = text;
        loader.classList.add('active');
    },

    hideLoading() {
        const loader = document.querySelector('.global-loader');
        if (loader) {
            loader.classList.remove('active');
        }
    },

    exportAllData() {
        const data = localStorage.getItem('freyai-workflow-store');
        if (!data) {
            this.showToast('Keine Daten vorhanden', 'warning');
            return;
        }

        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `freyai-backup-full-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Daten exportiert!', 'success');
    },

    // Update AI Model
    updateAIModel: function (modelName) {
        if (window.llmService) {
            window.llmService.saveConfig({ ollamaModel: modelName });
            showToast(`KI-Modell auf "${modelName}" gewechselt`, 'info');
        }
    },

    // Reset Application to Demo State
    resetApp: function () {
        if (confirm('Möchten Sie wirklich die gesamte App zurücksetzen?\n\nAlle eigenen Daten werden gelöscht und durch Demo-Daten ersetzt.')) {
            if (window.storeService) {
                window.storeService.resetToDemo();
                showToast('App wird neu gestartet...', 'info');
                setTimeout(() => location.reload(), 1000);
            }
        }
    },

    toggleAIProvider() {
        const provider = document.getElementById('ai-provider').value;
        const geminiConf = document.getElementById('conf-gemini');
        const ollamaConf = document.getElementById('conf-ollama');
        if (geminiConf) {geminiConf.style.display = provider === 'gemini' ? 'block' : 'none';}
        if (ollamaConf) {ollamaConf.style.display = provider === 'ollama' ? 'block' : 'none';}
    },

    saveAIConfig() {
        const provider = document.getElementById('ai-provider').value;
        const config = { provider };

        if (provider === 'gemini') {
            config.apiKey = document.getElementById('gemini-api-key').value.trim();
        } else {
            config.ollamaUrl = document.getElementById('ollama-url').value.trim();
            config.ollamaModel = document.getElementById('ollama-model').value.trim();
        }

        if (window.llmService) {
            window.llmService.saveConfig(config);
            this.showToast('AI Konfiguration gespeichert!', 'success');
        }
    },

    initSettingsLogic() {
        if (window.storeService && window.storeService.state.settings) {
            const settings = window.storeService.state.settings;
            if (document.getElementById('company-name')) {document.getElementById('company-name').value = settings.companyName || '';}
            if (document.getElementById('company-owner')) {document.getElementById('company-owner').value = settings.owner || '';}
            if (document.getElementById('company-address')) {document.getElementById('company-address').value = settings.address || '';}
            if (document.getElementById('company-taxid')) {document.getElementById('company-taxid').value = settings.taxId || '';}
            if (document.getElementById('company-vatid')) {document.getElementById('company-vatid').value = settings.vatId || '';}

            if (settings.theme === 'light') {
                document.body.classList.add('light-theme');
                const toggle = document.getElementById('theme-toggle');
                if (toggle) {toggle.checked = false;}
            }
        }

        // Init AI Settings
        if (window.llmService) {
            const config = window.llmService.config;
            const providerSelect = document.getElementById('ai-provider');
            if (providerSelect) {
                providerSelect.value = config.provider || 'gemini';
                this.toggleAIProvider();
            }
            if (document.getElementById('gemini-api-key')) {document.getElementById('gemini-api-key').value = config.apiKey || '';}
            if (document.getElementById('ollama-url')) {document.getElementById('ollama-url').value = config.ollamaUrl || 'http://localhost:11434';}
            if (document.getElementById('ollama-model')) {document.getElementById('ollama-model').value = config.ollamaModel || 'mistral';}
        }

        const form = document.getElementById('settings-company-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!window.storeService.state.settings) {window.storeService.state.settings = {};}

                const newSettings = {
                    ...window.storeService.state.settings,
                    companyName: document.getElementById('company-name').value,
                    owner: document.getElementById('company-owner').value,
                    address: document.getElementById('company-address').value,
                    taxId: document.getElementById('company-taxid').value,
                    vatId: document.getElementById('company-vatid').value
                };
                window.storeService.state.settings = newSettings;
                window.storeService.save();
                // Regenerate sender email when company name changes
                if (typeof generateSenderEmail === 'function') {generateSenderEmail();}
                window.UI.showToast('Einstellungen gespeichert', 'success');
            });
        }

        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', (e) => {
                const isDark = e.target.checked;
                if (isDark) {
                    document.body.classList.remove('light-theme');
                    if (window.storeService.state.settings) {window.storeService.state.settings.theme = 'dark';}
                } else {
                    document.body.classList.add('light-theme');
                    if (window.storeService.state.settings) {window.storeService.state.settings.theme = 'light';}
                }
                window.storeService.save();
            });
        }
    },

    initSearchLogic() {
        const input = document.getElementById('global-search');
        if (!input) {return;}

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                window.UI.showToast(`Suche nach "${input.value}"... (Demo)`, 'info');
            }
        });

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                input.focus();
            }
        });
    },

    initHotkeys() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                document.querySelector('.btn-new-anfrage')?.click();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                window.storeService?.save();
                // Ensure showToast exists or use fallback
                if (window.showToast) {window.showToast('💾 Gespeichert', 'success');}
                else if (window.errorHandler?.showToast) {window.errorHandler.showToast('💾 Gespeichert', 'success');}
            }
        });
    },

    initModals() {
        // Close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                modal.classList.remove('active');
            });
        });

        // Click outside to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('modal-overlay')) {
                    modal.classList.remove('active');
                }
            });
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
            }
        });
    }
};

// HTML escape shorthand used throughout app.js for XSS prevention
window.h = window.UI.sanitize;

// Backwards compatibility for app.js calls
window.formatCurrency = window.UI.formatCurrency;
window.formatDate = window.UI.formatDate;
window.formatDateTime = window.UI.formatDateTime;
window.getRelativeTime = window.UI.getRelativeTime;
window.getLeistungsartLabel = window.UI.getLeistungsartLabel;
window.openModal = window.UI.openModal;
window.closeModal = window.UI.closeModal;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.UI.initModals();
    window.UI.initHotkeys();
    window.UI.initSettingsLogic();
    window.UI.initSearchLogic();
});
