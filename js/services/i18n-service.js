/* ============================================
   i18n Service - Multilingual Support
   German, English, Turkish translations
   ============================================ */

class I18nService {
    constructor() {
        this.settings = JSON.parse(localStorage.getItem('mhs_i18n_settings') || '{}');
        this.currentLocale = this.settings.locale || 'de';

        // Translations
        this.translations = {
            de: {
                // Navigation
                'nav.dashboard': 'Dashboard',
                'nav.inquiries': 'Anfragen',
                'nav.quotes': 'Angebote',
                'nav.orders': 'Aufträge',
                'nav.invoices': 'Rechnungen',
                'nav.dunning': 'Mahnwesen',
                'nav.customers': 'Kunden',
                'nav.calendar': 'Kalender',
                'nav.tasks': 'Aufgaben',
                'nav.documents': 'Dokumente',
                'nav.timetracking': 'Zeiterfassung',
                'nav.settings': 'Einstellungen',

                // Common actions
                'action.save': 'Speichern',
                'action.cancel': 'Abbrechen',
                'action.delete': 'Löschen',
                'action.edit': 'Bearbeiten',
                'action.add': 'Hinzufügen',
                'action.search': 'Suchen',
                'action.filter': 'Filtern',
                'action.export': 'Exportieren',
                'action.import': 'Importieren',
                'action.print': 'Drucken',
                'action.send': 'Senden',
                'action.confirm': 'Bestätigen',

                // Status
                'status.open': 'Offen',
                'status.pending': 'Ausstehend',
                'status.completed': 'Abgeschlossen',
                'status.paid': 'Bezahlt',
                'status.overdue': 'Überfällig',
                'status.cancelled': 'Storniert',

                // Time
                'time.today': 'Heute',
                'time.yesterday': 'Gestern',
                'time.thisWeek': 'Diese Woche',
                'time.thisMonth': 'Dieser Monat',
                'time.thisYear': 'Dieses Jahr',

                // Messages
                'msg.success': 'Erfolgreich',
                'msg.error': 'Fehler',
                'msg.loading': 'Wird geladen...',
                'msg.noData': 'Keine Daten vorhanden',
                'msg.confirmDelete': 'Möchten Sie wirklich löschen?'
            },

            en: {
                // Navigation
                'nav.dashboard': 'Dashboard',
                'nav.inquiries': 'Inquiries',
                'nav.quotes': 'Quotes',
                'nav.orders': 'Orders',
                'nav.invoices': 'Invoices',
                'nav.dunning': 'Dunning',
                'nav.customers': 'Customers',
                'nav.calendar': 'Calendar',
                'nav.tasks': 'Tasks',
                'nav.documents': 'Documents',
                'nav.timetracking': 'Time Tracking',
                'nav.settings': 'Settings',

                // Common actions
                'action.save': 'Save',
                'action.cancel': 'Cancel',
                'action.delete': 'Delete',
                'action.edit': 'Edit',
                'action.add': 'Add',
                'action.search': 'Search',
                'action.filter': 'Filter',
                'action.export': 'Export',
                'action.import': 'Import',
                'action.print': 'Print',
                'action.send': 'Send',
                'action.confirm': 'Confirm',

                // Status
                'status.open': 'Open',
                'status.pending': 'Pending',
                'status.completed': 'Completed',
                'status.paid': 'Paid',
                'status.overdue': 'Overdue',
                'status.cancelled': 'Cancelled',

                // Time
                'time.today': 'Today',
                'time.yesterday': 'Yesterday',
                'time.thisWeek': 'This Week',
                'time.thisMonth': 'This Month',
                'time.thisYear': 'This Year',

                // Messages
                'msg.success': 'Success',
                'msg.error': 'Error',
                'msg.loading': 'Loading...',
                'msg.noData': 'No data available',
                'msg.confirmDelete': 'Are you sure you want to delete?'
            },

            tr: {
                // Navigation
                'nav.dashboard': 'Gösterge Paneli',
                'nav.inquiries': 'Sorular',
                'nav.quotes': 'Teklifler',
                'nav.orders': 'Siparişler',
                'nav.invoices': 'Faturalar',
                'nav.dunning': 'Ödeme Hatırlatma',
                'nav.customers': 'Müşteriler',
                'nav.calendar': 'Takvim',
                'nav.tasks': 'Görevler',
                'nav.documents': 'Belgeler',
                'nav.timetracking': 'Zaman Takibi',
                'nav.settings': 'Ayarlar',

                // Common actions
                'action.save': 'Kaydet',
                'action.cancel': 'İptal',
                'action.delete': 'Sil',
                'action.edit': 'Düzenle',
                'action.add': 'Ekle',
                'action.search': 'Ara',
                'action.filter': 'Filtrele',
                'action.export': 'Dışa Aktar',
                'action.import': 'İçe Aktar',
                'action.print': 'Yazdır',
                'action.send': 'Gönder',
                'action.confirm': 'Onayla',

                // Status
                'status.open': 'Açık',
                'status.pending': 'Beklemede',
                'status.completed': 'Tamamlandı',
                'status.paid': 'Ödendi',
                'status.overdue': 'Vadesi Geçmiş',
                'status.cancelled': 'İptal Edildi',

                // Time
                'time.today': 'Bugün',
                'time.yesterday': 'Dün',
                'time.thisWeek': 'Bu Hafta',
                'time.thisMonth': 'Bu Ay',
                'time.thisYear': 'Bu Yıl',

                // Messages
                'msg.success': 'Başarılı',
                'msg.error': 'Hata',
                'msg.loading': 'Yükleniyor...',
                'msg.noData': 'Veri bulunamadı',
                'msg.confirmDelete': 'Silmek istediğinizden emin misiniz?'
            }
        };
    }

    // Translate key
    t(key, params = {}) {
        const translation = this.translations[this.currentLocale]?.[key]
            || this.translations['de'][key]
            || key;

        // Replace parameters {{param}}
        return translation.replace(/\{\{(\w+)\}\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }

    // Get current locale
    getLocale() {
        return this.currentLocale;
    }

    // Set locale
    setLocale(locale) {
        if (this.translations[locale]) {
            this.currentLocale = locale;
            this.settings.locale = locale;
            this.save();

            // Update document lang attribute
            document.documentElement.lang = locale;

            // Dispatch event for UI update
            window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale } }));

            return true;
        }
        return false;
    }

    // Get available locales
    getAvailableLocales() {
        return [
            { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
            { code: 'en', name: 'English', flag: '🇬🇧' },
            { code: 'tr', name: 'Türkçe', flag: '🇹🇷' }
        ];
    }

    // Add/update translations
    addTranslations(locale, translations) {
        if (!this.translations[locale]) {
            this.translations[locale] = {};
        }
        Object.assign(this.translations[locale], translations);
    }

    // Format number
    formatNumber(number, decimals = 2) {
        return new Intl.NumberFormat(this.currentLocale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    }

    // Format currency
    formatCurrency(amount, currency = 'EUR') {
        return new Intl.NumberFormat(this.currentLocale, {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    // Format date
    formatDate(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat(this.currentLocale, {
            dateStyle: options.dateStyle || 'medium',
            ...options
        }).format(d);
    }

    // Format time
    formatTime(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat(this.currentLocale, {
            timeStyle: options.timeStyle || 'short',
            ...options
        }).format(d);
    }

    // Format date and time
    formatDateTime(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat(this.currentLocale, {
            dateStyle: options.dateStyle || 'medium',
            timeStyle: options.timeStyle || 'short',
            ...options
        }).format(d);
    }

    // Create language selector
    createLanguageSelector() {
        const select = document.createElement('select');
        select.className = 'language-selector';

        this.getAvailableLocales().forEach(locale => {
            const option = document.createElement('option');
            option.value = locale.code;
            option.textContent = `${locale.flag} ${locale.name}`;
            option.selected = locale.code === this.currentLocale;
            select.appendChild(option);
        });

        select.onchange = (e) => this.setLocale(e.target.value);
        return select;
    }

    // Persistence
    save() {
        localStorage.setItem('mhs_i18n_settings', JSON.stringify(this.settings));
    }
}

window.i18nService = new I18nService();

// Global shorthand
window.t = (key, params) => window.i18nService.t(key, params);
