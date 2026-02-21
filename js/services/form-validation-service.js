/* ============================================
   Form Validation Service
   Lightweight validation for all main forms
   ============================================ */

class FormValidationService {
    constructor() {
        this.rules = {
            required: (v) => (v !== null && v !== undefined && String(v).trim() !== '') || 'Pflichtfeld',
            email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) || 'Ungültige E-Mail-Adresse',
            phone: (v) => (!v || /^[\d\s+\-()\/]{6,20}$/.test(v)) || 'Ungültige Telefonnummer',
            plz: (v) => (!v || /^\d{4,5}$/.test(v)) || 'Ungültige PLZ (4-5 Ziffern)',
            iban: (v) => (!v || /^[A-Z]{2}\d{2}\s?[\dA-Z\s]{10,30}$/.test(v.replace(/\s/g, ''))) || 'Ungültiges IBAN-Format',
            minLength: (min) => (v) => (!v || v.length >= min) || `Mindestens ${min} Zeichen`,
            maxLength: (max) => (v) => (!v || v.length <= max) || `Maximal ${max} Zeichen`,
            positiveNumber: (v) => (!v || (Number(v) > 0 && !isNaN(v))) || 'Muss eine positive Zahl sein',
            number: (v) => (!v || !isNaN(Number(v))) || 'Muss eine Zahl sein',
            date: (v) => (!v || !isNaN(Date.parse(v))) || 'Ungültiges Datum',
            ustId: (v) => (!v || /^DE\d{9}$/.test(v.replace(/\s/g, ''))) || 'Format: DE123456789'
        };

        this._initOnBlurValidation();
    }

    /**
     * Validate a single value against rules
     * @param {*} value
     * @param {Array} rules - Array of rule names or rule functions
     * @returns {{ valid: boolean, error: string|null }}
     */
    validate(value, rules) {
        for (const rule of rules) {
            const fn = typeof rule === 'function' ? rule : this.rules[rule];
            if (!fn) continue;
            const result = fn(value);
            if (result !== true) {
                return { valid: false, error: result };
            }
        }
        return { valid: true, error: null };
    }

    /**
     * Validate a form object against a schema
     * @param {Object} data - { fieldName: value }
     * @param {Object} schema - { fieldName: [rules] }
     * @returns {{ valid: boolean, errors: Object }}
     */
    validateForm(data, schema) {
        const errors = {};
        let valid = true;

        for (const [field, rules] of Object.entries(schema)) {
            const result = this.validate(data[field], rules);
            if (!result.valid) {
                errors[field] = result.error;
                valid = false;
            }
        }

        return { valid, errors };
    }

    /**
     * Validate a DOM form element and show inline errors
     * @param {HTMLFormElement} form
     * @param {Object} schema - { inputId: [rules] }
     * @returns {{ valid: boolean, data: Object, errors: Object }}
     */
    validateDOMForm(form, schema) {
        const data = {};
        const errors = {};
        let valid = true;

        for (const [inputId, rules] of Object.entries(schema)) {
            const el = form.querySelector(`#${inputId}`) || form.querySelector(`[name="${inputId}"]`);
            if (!el) continue;

            const value = el.type === 'checkbox' ? el.checked : el.value;
            data[inputId] = value;

            const result = this.validate(value, rules);
            this._setFieldError(el, result.valid ? null : result.error);

            if (!result.valid) {
                errors[inputId] = result.error;
                valid = false;
            }
        }

        return { valid, data, errors };
    }

    /**
     * Show/clear inline error for a field
     */
    _setFieldError(el, error) {
        // Remove existing error
        const existingError = el.parentElement?.querySelector('.field-error');
        if (existingError) existingError.remove();
        el.classList.remove('input-error');

        if (error) {
            el.classList.add('input-error');
            const errEl = document.createElement('span');
            errEl.className = 'field-error';
            errEl.textContent = error;
            errEl.style.cssText = 'color: var(--color-error, #ef4444); font-size: 12px; display: block; margin-top: 2px;';
            el.parentElement?.appendChild(errEl);
        }
    }

    /**
     * Auto-validate on blur for fields with data-validate attribute
     */
    _initOnBlurValidation() {
        document.addEventListener('focusout', (e) => {
            const el = e.target;
            if (!el?.dataset?.validate) return;

            const rules = el.dataset.validate.split(',').map(r => r.trim());
            const value = el.type === 'checkbox' ? el.checked : el.value;
            const result = this.validate(value, rules);
            this._setFieldError(el, result.valid ? null : result.error);
        });
    }
}

window.formValidation = new FormValidationService();
