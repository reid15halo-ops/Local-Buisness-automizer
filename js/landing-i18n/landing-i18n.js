/* ============================================
   Landing Page i18n Engine
   Lightweight translation system for the landing page
   ============================================ */

class LandingI18n {
    constructor() {
        this.currentLang = 'de';
        this.translations = {};
        this.fallbackLang = 'de';
        this._switchingLang = false;
        this._triggerButton = null;
        this.supportedLangs = [
            { code: 'de', name: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
            { code: 'en', name: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
            { code: 'fr', name: 'Fran\u00e7ais', flag: '\u{1F1EB}\u{1F1F7}' },
            { code: 'es', name: 'Espa\u00f1ol', flag: '\u{1F1EA}\u{1F1F8}' },
            { code: 'it', name: 'Italiano', flag: '\u{1F1EE}\u{1F1F9}' },
            { code: 'pt', name: 'Portugu\u00eas', flag: '\u{1F1F5}\u{1F1F9}' },
            { code: 'nl', name: 'Nederlands', flag: '\u{1F1F3}\u{1F1F1}' },
            { code: 'pl', name: 'Polski', flag: '\u{1F1F5}\u{1F1F1}' },
            { code: 'cs', name: '\u010ce\u0161tina', flag: '\u{1F1E8}\u{1F1FF}' },
            { code: 'sv', name: 'Svenska', flag: '\u{1F1F8}\u{1F1EA}' },
            { code: 'da', name: 'Dansk', flag: '\u{1F1E9}\u{1F1F0}' },
            { code: 'fi', name: 'Suomi', flag: '\u{1F1EB}\u{1F1EE}' },
            { code: 'no', name: 'Norsk', flag: '\u{1F1F3}\u{1F1F4}' },
            { code: 'ro', name: 'Rom\u00e2n\u0103', flag: '\u{1F1F7}\u{1F1F4}' },
            { code: 'hu', name: 'Magyar', flag: '\u{1F1ED}\u{1F1FA}' },
            { code: 'el', name: '\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac', flag: '\u{1F1EC}\u{1F1F7}' },
            { code: 'bg', name: '\u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438', flag: '\u{1F1E7}\u{1F1EC}' },
            { code: 'hr', name: 'Hrvatski', flag: '\u{1F1ED}\u{1F1F7}' },
            { code: 'sk', name: 'Sloven\u010dina', flag: '\u{1F1F8}\u{1F1F0}' },
            { code: 'sl', name: 'Sloven\u0161\u010dina', flag: '\u{1F1F8}\u{1F1EE}' },
            { code: 'lt', name: 'Lietuvi\u0173', flag: '\u{1F1F1}\u{1F1F9}' },
            { code: 'lv', name: 'Latvie\u0161u', flag: '\u{1F1F1}\u{1F1FB}' },
            { code: 'et', name: 'Eesti', flag: '\u{1F1EA}\u{1F1EA}' },
            { code: 'ga', name: 'Gaeilge', flag: '\u{1F1EE}\u{1F1EA}' },
            { code: 'mt', name: 'Malti', flag: '\u{1F1F2}\u{1F1F9}' },
            { code: 'is', name: '\u00cdslenska', flag: '\u{1F1EE}\u{1F1F8}' },
            { code: 'sq', name: 'Shqip', flag: '\u{1F1E6}\u{1F1F1}' },
            { code: 'sr', name: 'Srpski', flag: '\u{1F1F7}\u{1F1F8}' },
            { code: 'mk', name: '\u041c\u0430\u043a\u0435\u0434\u043e\u043d\u0441\u043a\u0438', flag: '\u{1F1F2}\u{1F1F0}' },
            { code: 'uk', name: '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430', flag: '\u{1F1FA}\u{1F1E6}' },
            { code: 'tr', name: 'T\u00fcrk\u00e7e', flag: '\u{1F1F9}\u{1F1F7}' }
        ];
        this._localeMap = {
            de: 'de_DE', en: 'en_GB', fr: 'fr_FR', es: 'es_ES', it: 'it_IT',
            pt: 'pt_PT', nl: 'nl_NL', pl: 'pl_PL', cs: 'cs_CZ', sv: 'sv_SE',
            da: 'da_DK', fi: 'fi_FI', no: 'nb_NO', ro: 'ro_RO', hu: 'hu_HU',
            el: 'el_GR', bg: 'bg_BG', hr: 'hr_HR', sk: 'sk_SK', sl: 'sl_SI',
            lt: 'lt_LT', lv: 'lv_LV', et: 'et_EE', ga: 'ga_IE', mt: 'mt_MT',
            is: 'is_IS', sq: 'sq_AL', sr: 'sr_RS', mk: 'mk_MK', uk: 'uk_UA',
            tr: 'tr_TR'
        };
    }

    // Detect language: URL param > localStorage > default German
    // German is always default — only switches if user explicitly chose a language
    detectLanguage() {
        // 1. URL parameter (?lang=en)
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && this.isSupported(urlLang)) {return urlLang;}

        // 2. localStorage — only set when user actively picks a language
        try {
            const stored = localStorage.getItem('freyai_landing_lang');
            if (stored && this.isSupported(stored)) {return stored;}
        } catch (e) { /* localStorage unavailable */ }

        // 3. Default: German (no browser detection — German business, German default)
        return this.fallbackLang;
    }

    isSupported(code) {
        return this.supportedLangs.some(l => l.code === code);
    }

    // Load translation JSON file
    async loadTranslation(lang) {
        // Check cache
        if (this.translations[lang]) {return this.translations[lang];}

        // Check localStorage cache (try-catch for incognito mode)
        const cacheKey = `freyai_i18n_${lang}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed._v && parsed._v === this._getCacheVersion()) {
                        this.translations[lang] = parsed.data;
                        return parsed.data;
                    }
                } catch (e) { /* ignore parse error */ }
            }
        } catch (e) { /* localStorage unavailable */ }

        // Fetch from server
        try {
            const response = await fetch(`/js/landing-i18n/${lang}.json`);
            if (!response.ok) {
                console.warn(`[i18n] Translation not found: ${lang}`);
                return null;
            }
            const data = await response.json();
            this.translations[lang] = data;

            // Cache in localStorage
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ _v: this._getCacheVersion(), data }));
            } catch (e) { /* quota exceeded or unavailable, ignore */ }

            return data;
        } catch (e) {
            console.warn(`[i18n] Failed to load ${lang}:`, e.message);
            return null;
        }
    }

    _getCacheVersion() {
        return '3'; // Tied to SW CACHE_NAME v34
    }

    // Deep merge: base object with override values (max 5 levels deep)
    _deepMerge(base, override, depth = 0) {
        if (depth > 5) {return override || base;}
        if (!override || typeof override !== 'object') {return base;}
        if (!base || typeof base !== 'object') {return override;}
        const result = Object.create(null);
        const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
        for (const key of Object.keys(base)) {
            if (UNSAFE.has(key)) {continue;}
            if (
                override[key] !== undefined &&
                typeof base[key] === 'object' && base[key] !== null &&
                typeof override[key] === 'object' && override[key] !== null &&
                !Array.isArray(base[key])
            ) {
                result[key] = this._deepMerge(base[key], override[key], depth + 1);
            } else if (override[key] !== undefined) {
                result[key] = override[key];
            } else {
                result[key] = base[key];
            }
        }
        // Include keys only in override
        for (const key of Object.keys(override)) {
            if (UNSAFE.has(key)) {continue;}
            if (result[key] === undefined) {
                result[key] = override[key];
            }
        }
        return result;
    }

    // Get nested value from object by dot-notation key (prototype-safe)
    _getNestedValue(obj, key) {
        const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
        return key.split('.').reduce((o, k) => {
            if (UNSAFE.has(k)) {return null;}
            return (o && Object.prototype.hasOwnProperty.call(o, k)) ? o[k] : null;
        }, obj);
    }

    // Apply translations to the DOM
    applyTranslations(translations) {
        if (!translations) {return;}

        const safeAttrs = ['alt', 'title', 'placeholder', 'content', 'aria-label'];

        // Text content elements (skip elements that only need attribute translation)
        document.querySelectorAll('[data-i18n]').forEach(el => {
            if (el.hasAttribute('data-i18n-attr')) {return;} // handled below
            const key = el.getAttribute('data-i18n');
            const value = this._getNestedValue(translations, key);
            if (value === null || typeof value !== 'string') {return;}

            if (el.hasAttribute('data-i18n-html') && el.getAttribute('data-i18n-html') !== 'false') {
                if (typeof DOMPurify !== 'undefined') {
                    el.innerHTML = DOMPurify.sanitize(value, {
                        ALLOWED_TAGS: ['span', 'br', 'a', 'strong', 'em'],
                        ALLOWED_ATTR: ['class', 'aria-hidden', 'href', 'target', 'rel']
                    });
                } else {
                    el.textContent = value; // Safe fallback: strip HTML
                }
            } else {
                el.textContent = value;
            }
        });

        // Attribute translations (whitelisted: alt, title, placeholder, content, aria-label)
        document.querySelectorAll('[data-i18n-attr]').forEach(el => {
            const attr = el.getAttribute('data-i18n-attr');
            if (!safeAttrs.includes(attr)) {return;}
            const key = el.getAttribute('data-i18n');
            const value = this._getNestedValue(translations, key);
            if (value !== null && typeof value === 'string') {
                el.setAttribute(attr, value);
            }
        });

        // Meta tags
        document.querySelectorAll('[data-i18n-meta]').forEach(el => {
            const key = el.getAttribute('data-i18n-meta');
            const value = this._getNestedValue(translations, key);
            if (value === null || typeof value !== 'string') {return;}

            if (el.tagName === 'TITLE') {
                el.textContent = value;
            } else if (el.hasAttribute('content')) {
                el.setAttribute('content', value);
            }
        });

        // Update html lang attribute
        document.documentElement.lang = this.currentLang;

        // Update og:locale (complete map for all 31 languages)
        const ogLocale = document.querySelector('meta[property="og:locale"]');
        if (ogLocale) {
            ogLocale.setAttribute('content', this._localeMap[this.currentLang] || this.currentLang);
        }
    }

    // Switch language with race condition guard and fallback merge
    async switchLanguage(lang) {
        if (!this.isSupported(lang)) {return;}
        if (this._switchingLang) {return;}
        this._switchingLang = true;

        try {
            // Load fallback (German) as base, merge target language on top
            const fallback = await this.loadTranslation(this.fallbackLang);
            if (!fallback) {return;} // Cannot proceed without fallback
            const target = lang !== this.fallbackLang ? await this.loadTranslation(lang) : fallback;
            const merged = this._deepMerge(fallback, target || {});

            // Only update state after successful load
            this.currentLang = lang;

            try {
                localStorage.setItem('freyai_landing_lang', lang);
            } catch (e) { /* localStorage unavailable */ }

            // Update URL without reload
            const url = new URL(window.location);
            if (lang === this.fallbackLang) {
                url.searchParams.delete('lang');
            } else {
                url.searchParams.set('lang', lang);
            }
            history.replaceState(null, '', url);

            this.applyTranslations(merged);

            // Update switcher button text
            const langInfo = this.supportedLangs.find(l => l.code === lang);
            const currentSpan = document.querySelector('#lang-switcher-btn .lang-current');
            if (currentSpan && langInfo) {
                currentSpan.textContent = langInfo.flag + ' ' + langInfo.code.toUpperCase();
            }

            // Update active state in modal
            document.querySelectorAll('.lang-option').forEach(el => {
                el.classList.toggle('active', el.dataset.lang === lang);
            });
        } finally {
            this._switchingLang = false;
        }
    }

    // Store bound event handlers for cleanup
    _boundHandlers = [];

    _addListener(target, event, handler, options) {
        target.addEventListener(event, handler, options);
        this._boundHandlers.push({ target, event, handler, options });
    }

    // Clean up all event listeners and DOM elements
    destroy() {
        for (const { target, event, handler, options } of this._boundHandlers) {
            target.removeEventListener(event, handler, options);
        }
        this._boundHandlers = [];
        const modal = document.getElementById('lang-modal');
        if (modal) {modal.remove();}
        const container = document.getElementById('lang-switcher');
        if (container) {container.textContent = '';}
        document.body.classList.remove('modal-open');
        this._triggerButton = null;
    }

    // Build language switcher UI into existing #lang-switcher container
    buildSwitcher() {
        const container = document.getElementById('lang-switcher');
        if (!container) {return;}

        // Prevent duplicate modal
        if (document.getElementById('lang-modal')) {return;}

        const langInfo = this.supportedLangs.find(l => l.code === this.currentLang) || this.supportedLangs[0];

        // Button (built with DOM APIs for defense-in-depth)
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lang-switcher-btn';
        btn.id = 'lang-switcher-btn';
        btn.setAttribute('aria-label', 'Sprache wechseln');
        btn.setAttribute('aria-haspopup', 'dialog');
        btn.setAttribute('aria-expanded', 'false');
        const currentSpan = document.createElement('span');
        currentSpan.className = 'lang-current';
        currentSpan.textContent = langInfo.flag + ' ' + langInfo.code.toUpperCase();
        btn.appendChild(currentSpan);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '12');
        svg.setAttribute('height', '12');
        svg.setAttribute('viewBox', '0 0 12 12');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M3 5l3 3 3-3');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
        btn.appendChild(svg);
        container.textContent = '';
        container.appendChild(btn);

        this._triggerButton = btn;

        // Modal overlay (built with DOM APIs)
        const modal = document.createElement('div');
        modal.id = 'lang-modal';
        modal.className = 'lang-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Sprache / Language');

        const modalContent = document.createElement('div');
        modalContent.className = 'lang-modal-content';

        const header = document.createElement('div');
        header.className = 'lang-modal-header';
        const h3 = document.createElement('h3');
        h3.textContent = 'Sprache / Language';
        header.appendChild(h3);
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'lang-modal-close';
        closeBtn.setAttribute('aria-label', 'Schlie\u00dfen');
        closeBtn.textContent = '\u00d7';
        header.appendChild(closeBtn);
        modalContent.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'lang-grid';
        this.supportedLangs.forEach(l => {
            const optBtn = document.createElement('button');
            optBtn.type = 'button';
            optBtn.className = 'lang-option' + (l.code === this.currentLang ? ' active' : '');
            optBtn.dataset.lang = l.code;
            const flagSpan = document.createElement('span');
            flagSpan.className = 'lang-flag';
            flagSpan.textContent = l.flag;
            optBtn.appendChild(flagSpan);
            const nameSpan = document.createElement('span');
            nameSpan.className = 'lang-name';
            nameSpan.textContent = l.name;
            optBtn.appendChild(nameSpan);
            grid.appendChild(optBtn);
        });
        modalContent.appendChild(grid);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const closeModal = () => {
            modal.classList.remove('visible');
            document.body.classList.remove('modal-open');
            this._triggerButton.setAttribute('aria-expanded', 'false');
            // Return focus to trigger button
            if (this._triggerButton) {
                this._triggerButton.focus();
            }
        };

        const openModal = () => {
            modal.classList.add('visible');
            document.body.classList.add('modal-open');
            this._triggerButton.setAttribute('aria-expanded', 'true');
            // Focus first language option
            const firstOption = modal.querySelector('.lang-option');
            if (firstOption) {firstOption.focus();}
        };

        // Events (tracked for cleanup)
        const toggleHandler = () => {
            if (modal.classList.contains('visible')) {
                closeModal();
            } else {
                openModal();
            }
        };
        this._addListener(this._triggerButton, 'click', toggleHandler);

        this._addListener(modal.querySelector('.lang-modal-close'), 'click', closeModal);
        this._addListener(modal, 'click', (e) => { if (e.target === modal) {closeModal();} });

        modal.querySelectorAll('.lang-option').forEach(opt => {
            this._addListener(opt, 'click', () => {
                this.switchLanguage(opt.dataset.lang);
                closeModal();
            });
        });

        // Keyboard: Escape to close + focus trap
        const keydownHandler = (e) => {
            if (!modal.classList.contains('visible')) {return;}

            if (e.key === 'Escape') {
                closeModal();
                return;
            }

            // Focus trap: Tab/Shift+Tab wrap within modal
            if (e.key === 'Tab') {
                const focusable = modal.querySelectorAll('button:not([disabled])');
                if (focusable.length === 0) {return;}
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };
        this._addListener(document, 'keydown', keydownHandler);
    }

    // Initialize
    async init() {
        try {
            this.currentLang = this.detectLanguage();
            this.buildSwitcher();

            if (this.currentLang !== this.fallbackLang) {
                await this.switchLanguage(this.currentLang);
            }
        } catch (e) {
            console.warn('[i18n] Init error:', e.message);
            // Graceful degradation: page stays in German (default HTML content)
        }
    }
}

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Clean up previous instance if hot-reloaded
    if (window.landingI18n && typeof window.landingI18n.destroy === 'function') {
        window.landingI18n.destroy();
    }
    window.landingI18n = new LandingI18n();
    window.landingI18n.init().catch(e => console.warn('[i18n] Init failed:', e.message));
});
