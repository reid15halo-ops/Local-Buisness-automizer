/* ============================================
   i18n UI Integration
   Handles language switching and DOM updates
   ============================================ */

class I18nUI {
    constructor() {
        this.translationCache = new Map();
    }

    // Initialize language selector
    init() {
        const selector = document.getElementById('language-select');
        if (selector) {
            // Set initial language
            selector.value = window.i18nService.getLocale();

            // Listen for language changes
            selector.addEventListener('change', (e) => {
                const newLocale = e.target.value;
                window.i18nService.setLocale(newLocale);
                this.translatePage();
                // Show notification
                window.showToast?.(`Sprache auf ${newLocale === 'de' ? 'Deutsch' : 'English'} geändert`, 'success');
            });
        }

        // Listen for locale change events from i18n service
        window.addEventListener('localeChanged', (e) => {
            const selector = document.getElementById('language-select');
            if (selector) {
                selector.value = e.detail.locale;
            }
            this.translatePage();
        });

        // Initial translation
        this.translatePage();
    }

    // Translate page content
    translatePage() {
        const t = window.t;

        // Translate navigation items
        this.translateNavigationItems();

        // Translate all elements with data-i18n attribute
        this.translateDataI18nElements();

        // Translate specific UI sections
        this.translateViewHeaders();
        this.translateFormLabels();
        this.translateButtons();
        this.translatePlaceholders();
        this.translateAria();

        // Update document language
        document.documentElement.lang = window.i18nService.getLocale();
    }

    // Translate navigation menu items
    translateNavigationItems() {
        const navMap = {
            'Dashboard': 'nav.dashboard',
            'Anfragen': 'nav.inquiries',
            'Angebote': 'nav.quotes',
            'Aufträge': 'nav.orders',
            'Rechnungen': 'nav.invoices',
            'Aufgaben': 'nav.tasks',
            'Kunden': 'nav.customers',
            'Kalender': 'nav.calendar',
            'Zeiterfassung': 'nav.timetracking',
            'E-Mails': 'nav.emails',
            'E-Mail Automation': 'nav.emailAutomation',
            'Dokumente': 'nav.documents',
            'KI-Chatbot': 'nav.chatbot',
            'Material': 'nav.material',
            'Mahnwesen': 'nav.dunning',
            'Buchhaltung': 'nav.buchhaltung',
            'Berichte': 'nav.reports',
            'Einstellungen': 'nav.settings',
            'Workflows': 'nav.workflows'
        };

        document.querySelectorAll('.nav-item').forEach(btn => {
            const text = btn.textContent.trim();
            // Extract just the label part (before badges)
            const label = text.split('\n')[0].trim();

            for (const [de, key] of Object.entries(navMap)) {
                if (label === de || text.includes(de)) {
                    const translated = window.t(key);
                    btn.childNodes[1].textContent = translated;
                    break;
                }
            }
        });
    }

    // Translate elements with data-i18n attribute
    translateDataI18nElements() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = window.t(key);
            if (translated && translated !== key) {
                el.textContent = translated;
            }
        });
    }

    // Translate view headers
    translateViewHeaders() {
        const headerMap = {
            'Dashboard': 'nav.dashboard',
            'Anfragen': 'nav.inquiries',
            'Angebote': 'nav.quotes',
            'Aufträge': 'nav.orders',
            'Rechnungen': 'nav.invoices',
            'Aufgaben': 'nav.tasks',
            'Kunden': 'nav.customers',
            'Kalender': 'nav.calendar',
            'Zeiterfassung': 'nav.timetracking',
            'Material': 'nav.material',
            'Mahnwesen': 'nav.dunning',
            'Buchhaltung': 'nav.buchhaltung',
            'Berichte': 'nav.reports',
            'Einstellungen': 'nav.settings'
        };

        document.querySelectorAll('.view-header h1').forEach(h1 => {
            const text = h1.textContent.trim();
            const key = headerMap[text];
            if (key) {
                h1.textContent = window.t(key);
            }
        });

        // Translate status labels in headers
        const statusLabelMap = {
            'Offene Anfragen': 'dashboard.openInquiries',
            'Wartende Angebote': 'dashboard.pendingQuotes',
            'Aktive Aufträge': 'dashboard.activeOrders',
            'Offene Rechnungen': 'dashboard.openInvoices',
            'Übersicht aller Vorgänge': 'dashboard.subtitle'
        };

        document.querySelectorAll('.view-header p.subtitle').forEach(p => {
            const text = p.textContent.trim();
            const key = statusLabelMap[text];
            if (key) {
                p.textContent = window.t(key);
            }
        });
    }

    // Translate form labels
    translateFormLabels() {
        const labelMap = {
            'Kundenname': 'inquiry.customerName',
            'E-Mail': 'inquiry.email',
            'Telefon': 'inquiry.phone',
            'Leistungsart': 'inquiry.serviceType',
            'Beschreibung': 'inquiry.description',
            'Budget': 'inquiry.budget',
            'Termin': 'inquiry.deadline',
            'Status': 'inquiry.status',
            'API Key': 'settings.geminiApiKey',
            'Stundensatz (€)': 'settings.hourlyRate',
            'Präfix': 'settings.invoicePrefix',
            'Sprache': 'settings.language'
        };

        document.querySelectorAll('label').forEach(label => {
            const text = label.textContent.trim().replace(/\*$/, '');
            const key = labelMap[text];
            if (key) {
                const translated = window.t(key);
                label.textContent = translated + (text.endsWith('*') ? '*' : '');
            }
        });
    }

    // Translate buttons
    translateButtons() {
        const buttonMap = {
            'Speichern': 'action.save',
            'Abbrechen': 'action.cancel',
            'Löschen': 'action.delete',
            'Bearbeiten': 'action.edit',
            'Hinzufügen': 'action.add',
            'Suchen': 'action.search',
            'Filtern': 'action.filter',
            'Exportieren': 'action.export',
            'Importieren': 'action.import',
            'Drucken': 'action.print',
            'Senden': 'action.send',
            'Bestätigen': 'action.confirm',
            'Erstellen': 'action.create',
            'Aktualisieren': 'action.update',
            'Entfernen': 'action.remove',
            'Schließen': 'action.close',
            'Zurück': 'action.back',
            'Weiter': 'action.next',
            'Herunterladen': 'action.download',
            'Hochladen': 'action.upload',
            'Abmelden': 'action.logout',
            'Zurücksetzen': 'action.reset'
        };

        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim().split('\n')[0].trim();
            const key = buttonMap[text];
            if (key) {
                const translated = window.t(key);
                // Replace only the text, preserve emojis
                const emoji = btn.textContent.match(/[^\w\s]/g);
                const prefix = emoji ? emoji[0] + ' ' : '';
                if (btn.textContent.includes(text)) {
                    btn.textContent = btn.textContent.replace(text, translated);
                }
            }
        });
    }

    // Translate placeholders
    translatePlaceholders() {
        const placeholderMap = {
            'Suche... (Ctrl+K)': 'form.search',
            'Suchen...': 'form.search',
            'Bitte eingeben...': 'form.placeholder',
            '🔍 Material suchen...': 'form.search',
            'AIza...': 'settings.geminiApiKey',
            'Geheimschlüssel...': 'form.placeholder'
        };

        document.querySelectorAll('[placeholder]').forEach(input => {
            const text = input.getAttribute('placeholder');
            const key = placeholderMap[text];
            if (key) {
                const translated = window.t(key);
                input.setAttribute('placeholder', translated);
            }
        });
    }

    // Translate ARIA labels
    translateAria() {
        const ariaMap = {
            'Hauptmenü öffnen': 'action.search',
            'Globale Suche': 'form.search'
        };

        document.querySelectorAll('[aria-label]').forEach(el => {
            const text = el.getAttribute('aria-label');
            const key = ariaMap[text];
            if (key) {
                el.setAttribute('aria-label', window.t(key));
            }
        });
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const i18nUI = new I18nUI();
        window.i18nUI = i18nUI;
        i18nUI.init();
    });
} else {
    // If DOM is already loaded
    const i18nUI = new I18nUI();
    window.i18nUI = i18nUI;
    i18nUI.init();
}
