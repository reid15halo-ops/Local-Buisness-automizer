/* ============================================
   i18n Service - Multilingual Support
   German, English, Turkish translations
   ============================================ */

class I18nService {
    constructor() {
        try { this.settings = JSON.parse(localStorage.getItem('freyai_i18n_settings') || '{}'); } catch { this.settings = {}; }
        this.currentLocale = this.settings.locale || 'de';

        // Translations - Load from nested key structure
        this.translations = {
            de: this.flattenTranslations(window.i18nDE || {}),
            en: this.flattenTranslations(window.i18nEN || {}),
            tr: {
                // Turkish translations (legacy format - kept for compatibility)
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
                'status.open': 'Açık',
                'status.pending': 'Beklemede',
                'status.completed': 'Tamamlandı',
                'status.paid': 'Ödendi',
                'status.overdue': 'Vadesi Geçmiş',
                'status.cancelled': 'İptal Edildi',
                'time.today': 'Bugün',
                'time.yesterday': 'Dün',
                'time.thisWeek': 'Bu Hafta',
                'time.thisMonth': 'Bu Ay',
                'time.thisYear': 'Bu Yıl',
                'msg.success': 'Başarılı',
                'msg.error': 'Hata',
                'msg.loading': 'Yükleniyor...',
                'msg.noData': 'Veri bulunamadı',
                'msg.confirmDelete': 'Silmek istediğinizden emin misiniz?'
            }
        };
    }

    // Flatten nested translation objects into dot-notation keys
    flattenTranslations(obj, parent = '', res = {}) {
        for (let key in obj) {
            const value = obj[key];
            const newKey = parent ? `${parent}.${key}` : key;

            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                this.flattenTranslations(value, newKey, res);
            } else {
                res[newKey] = value;
            }
        }
        return res;
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
        localStorage.setItem('freyai_i18n_settings', JSON.stringify(this.settings));
    }
}

window.i18nService = new I18nService();

// Global shorthand
window.t = (key, params) => window.i18nService.t(key, params);
