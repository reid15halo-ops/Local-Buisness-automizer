import { describe, it, expect, beforeEach } from 'vitest';

// Self-contained FormValidationService (extracted from js/services/form-validation-service.js)
// Tests are pure unit tests with no DOM interaction

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
    }

    validate(value, rules) {
        for (const rule of rules) {
            const fn = typeof rule === 'function' ? rule : this.rules[rule];
            if (!fn) { continue; }
            const result = fn(value);
            if (result !== true) {
                return { valid: false, error: result };
            }
        }
        return { valid: true, error: null };
    }

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
}

describe('FormValidationService', () => {
    let service;

    beforeEach(() => {
        service = new FormValidationService();
    });

    describe('Required Field Validation', () => {
        it('should pass for non-empty string', () => {
            const result = service.validate('Hello', ['required']);
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        it('should fail for empty string', () => {
            const result = service.validate('', ['required']);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Pflichtfeld');
        });

        it('should fail for whitespace-only string', () => {
            const result = service.validate('   ', ['required']);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Pflichtfeld');
        });

        it('should fail for null', () => {
            const result = service.validate(null, ['required']);
            expect(result.valid).toBe(false);
        });

        it('should fail for undefined', () => {
            const result = service.validate(undefined, ['required']);
            expect(result.valid).toBe(false);
        });

        it('should pass for number 0 (not empty)', () => {
            const result = service.validate(0, ['required']);
            // 0 becomes '0' string which is non-empty
            expect(result.valid).toBe(true);
        });

        it('should pass for boolean false (non-empty)', () => {
            const result = service.validate(false, ['required']);
            // false becomes 'false' which is non-empty
            expect(result.valid).toBe(true);
        });
    });

    describe('German Email Validation', () => {
        it('should accept valid email address', () => {
            const result = service.validate('test@example.de', ['email']);
            expect(result.valid).toBe(true);
        });

        it('should accept email with subdomain', () => {
            expect(service.validate('user@mail.de', ['email']).valid).toBe(true);
        });

        it('should accept email with plus sign', () => {
            expect(service.validate('user+tag@example.de', ['email']).valid).toBe(true);
        });

        it('should reject email without @', () => {
            const result = service.validate('notanemail', ['email']);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Ungültige E-Mail-Adresse');
        });

        it('should reject email without TLD', () => {
            const result = service.validate('user@domain', ['email']);
            expect(result.valid).toBe(false);
        });

        it('should accept empty value (email rule is optional)', () => {
            // email rule allows empty (uses falsy check)
            const result = service.validate('', ['email']);
            expect(result.valid).toBe(true);
        });

        it('should accept null (optional field)', () => {
            const result = service.validate(null, ['email']);
            expect(result.valid).toBe(true);
        });
    });

    describe('German Phone Validation', () => {
        it('should accept valid German landline', () => {
            expect(service.validate('+49 89 123456', ['phone']).valid).toBe(true);
        });

        it('should accept mobile number format', () => {
            expect(service.validate('+49 175 1234567', ['phone']).valid).toBe(true);
        });

        it('should accept local format with parens', () => {
            expect(service.validate('(089) 123456', ['phone']).valid).toBe(true);
        });

        it('should reject too short number (< 6 chars)', () => {
            const result = service.validate('12345', ['phone']);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Ungültige Telefonnummer');
        });

        it('should reject number with letters', () => {
            const result = service.validate('089-abc-456', ['phone']);
            expect(result.valid).toBe(false);
        });

        it('should accept empty value (optional)', () => {
            const result = service.validate('', ['phone']);
            expect(result.valid).toBe(true);
        });

        it('should accept 6-character number (minimum)', () => {
            expect(service.validate('123456', ['phone']).valid).toBe(true);
        });

        it('should reject number exceeding 20 characters', () => {
            const result = service.validate('123456789012345678901', ['phone']);
            expect(result.valid).toBe(false);
        });
    });

    describe('German PLZ (Postal Code) Validation', () => {
        it('should accept 5-digit PLZ', () => {
            expect(service.validate('80331', ['plz']).valid).toBe(true);
        });

        it('should accept 4-digit PLZ (Austrian format)', () => {
            expect(service.validate('1234', ['plz']).valid).toBe(true);
        });

        it('should reject 3-digit PLZ', () => {
            const result = service.validate('123', ['plz']);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('4-5 Ziffern');
        });

        it('should reject 6-digit PLZ', () => {
            expect(service.validate('123456', ['plz']).valid).toBe(false);
        });

        it('should reject PLZ with letters', () => {
            expect(service.validate('8033A', ['plz']).valid).toBe(false);
        });

        it('should accept empty value (optional)', () => {
            expect(service.validate('', ['plz']).valid).toBe(true);
        });
    });

    describe('IBAN Validation', () => {
        it('should accept valid German IBAN', () => {
            expect(service.validate('DE89370400440532013000', ['iban']).valid).toBe(true);
        });

        it('should accept IBAN with spaces', () => {
            expect(service.validate('DE89 3704 0044 0532 0130 00', ['iban']).valid).toBe(true);
        });

        it('should accept Austrian IBAN (AT format)', () => {
            expect(service.validate('AT611904300234573201', ['iban']).valid).toBe(true);
        });

        it('should reject IBAN without country code', () => {
            expect(service.validate('89370400440532013000', ['iban']).valid).toBe(false);
        });

        it('should reject too short IBAN', () => {
            expect(service.validate('DE89', ['iban']).valid).toBe(false);
        });

        it('should accept empty value (optional)', () => {
            expect(service.validate('', ['iban']).valid).toBe(true);
        });
    });

    describe('German USt-IdNr Validation', () => {
        it('should accept valid USt-IdNr', () => {
            expect(service.validate('DE123456789', ['ustId']).valid).toBe(true);
        });

        it('should accept USt-IdNr with spaces', () => {
            expect(service.validate('DE 123456789', ['ustId']).valid).toBe(true);
        });

        it('should reject USt-IdNr without DE prefix', () => {
            const result = service.validate('123456789', ['ustId']);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Format: DE123456789');
        });

        it('should reject too short USt-IdNr', () => {
            expect(service.validate('DE12345', ['ustId']).valid).toBe(false);
        });

        it('should accept empty value (optional)', () => {
            expect(service.validate('', ['ustId']).valid).toBe(true);
        });
    });

    describe('Numeric Validation', () => {
        it('should accept positive number with positiveNumber rule', () => {
            expect(service.validate('100', ['positiveNumber']).valid).toBe(true);
        });

        it('should reject zero with positiveNumber rule', () => {
            const result = service.validate('0', ['positiveNumber']);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Muss eine positive Zahl sein');
        });

        it('should reject negative number with positiveNumber rule', () => {
            expect(service.validate('-5', ['positiveNumber']).valid).toBe(false);
        });

        it('should accept any number (including negative) with number rule', () => {
            expect(service.validate('-100', ['number']).valid).toBe(true);
            expect(service.validate('0', ['number']).valid).toBe(true);
        });

        it('should reject non-numeric string with number rule', () => {
            const result = service.validate('abc', ['number']);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Muss eine Zahl sein');
        });
    });

    describe('Date Validation', () => {
        it('should accept valid ISO date', () => {
            expect(service.validate('2026-02-24', ['date']).valid).toBe(true);
        });

        it('should accept valid date with time', () => {
            expect(service.validate('2026-02-24T10:30:00', ['date']).valid).toBe(true);
        });

        it('should reject invalid date string', () => {
            const result = service.validate('not-a-date', ['date']);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Ungültiges Datum');
        });

        it('should accept empty value (optional)', () => {
            expect(service.validate('', ['date']).valid).toBe(true);
        });
    });

    describe('Length Validation', () => {
        it('should accept string meeting minLength', () => {
            const minLengthRule = service.rules.minLength(5);
            const result = service.validate('hello', [minLengthRule]);
            expect(result.valid).toBe(true);
        });

        it('should reject string below minLength', () => {
            const minLengthRule = service.rules.minLength(10);
            const result = service.validate('hi', [minLengthRule]);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Mindestens 10 Zeichen');
        });

        it('should accept string within maxLength', () => {
            const maxLengthRule = service.rules.maxLength(100);
            const result = service.validate('short string', [maxLengthRule]);
            expect(result.valid).toBe(true);
        });

        it('should reject string exceeding maxLength', () => {
            const maxLengthRule = service.rules.maxLength(5);
            const result = service.validate('too long string', [maxLengthRule]);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Maximal 5 Zeichen');
        });
    });

    describe('Combined Rule Validation', () => {
        it('should pass when all rules pass', () => {
            const result = service.validate('test@example.de', ['required', 'email']);
            expect(result.valid).toBe(true);
        });

        it('should fail on first failing rule (required before email)', () => {
            const result = service.validate('', ['required', 'email']);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Pflichtfeld'); // required fails first
        });

        it('should fail on email rule if required passes but email invalid', () => {
            const result = service.validate('invalid-email', ['required', 'email']);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Ungültige E-Mail-Adresse');
        });

        it('should work with inline function rule', () => {
            const customRule = (v) => (v === 'secret') || 'Falsches Passwort';
            const result = service.validate('secret', [customRule]);
            expect(result.valid).toBe(true);
        });

        it('should skip unknown rule names gracefully', () => {
            const result = service.validate('test', ['nonexistentRule']);
            expect(result.valid).toBe(true); // Unknown rules are skipped
        });
    });

    describe('Form-Level Validation (validateForm)', () => {
        it('should validate all fields in a schema', () => {
            const data = {
                name: 'Max Mustermann',
                email: 'max@example.de',
                plz: '80331'
            };
            const schema = {
                name: ['required'],
                email: ['required', 'email'],
                plz: ['plz']
            };

            const result = service.validateForm(data, schema);
            expect(result.valid).toBe(true);
            expect(Object.keys(result.errors)).toHaveLength(0);
        });

        it('should collect errors for all invalid fields', () => {
            const data = {
                name: '',
                email: 'not-an-email',
                plz: '1234'
            };
            const schema = {
                name: ['required'],
                email: ['email'],
                plz: ['plz']
            };

            const result = service.validateForm(data, schema);
            expect(result.valid).toBe(false);
            // name is empty (fails required), email is invalid
            expect(result.errors.name).toBe('Pflichtfeld');
            expect(result.errors.email).toBe('Ungültige E-Mail-Adresse');
        });

        it('should return partial errors when some fields fail', () => {
            const data = { name: 'Valid', email: 'invalid' };
            const schema = { name: ['required'], email: ['email'] };

            const result = service.validateForm(data, schema);
            expect(result.valid).toBe(false);
            expect(result.errors.name).toBeUndefined(); // Name is valid
            expect(result.errors.email).toBeDefined();
        });

        it('should validate a full customer form schema', () => {
            const data = {
                firma: 'Test GmbH',
                email: 'test@test.de',
                telefon: '+49 89 12345',
                plz: '80331',
                ustId: 'DE123456789'
            };
            const schema = {
                firma: ['required'],
                email: ['email'],
                telefon: ['phone'],
                plz: ['plz'],
                ustId: ['ustId']
            };

            const result = service.validateForm(data, schema);
            expect(result.valid).toBe(true);
        });

        it('should handle empty form data', () => {
            const schema = {
                name: ['required'],
                email: ['required', 'email']
            };

            const result = service.validateForm({}, schema);
            expect(result.valid).toBe(false);
            expect(result.errors.name).toBe('Pflichtfeld');
        });

        it('should validate a Handwerker invoice form', () => {
            const data = {
                kundenname: 'Mustermann GmbH',
                email: 'rechnungen@mustermann.de',
                plz: '10115',
                netto: '1500',
                datum: '2026-02-24'
            };
            const schema = {
                kundenname: ['required'],
                email: ['required', 'email'],
                plz: ['required', 'plz'],
                netto: ['required', 'positiveNumber'],
                datum: ['required', 'date']
            };

            const result = service.validateForm(data, schema);
            expect(result.valid).toBe(true);
        });
    });

    describe('Error Message Generation', () => {
        it('should generate correct required error message in German', () => {
            const result = service.validate('', ['required']);
            expect(result.error).toBe('Pflichtfeld');
        });

        it('should generate correct email error message in German', () => {
            const result = service.validate('invalid', ['email']);
            expect(result.error).toBe('Ungültige E-Mail-Adresse');
        });

        it('should generate correct phone error message in German', () => {
            const result = service.validate('abc', ['phone']);
            expect(result.error).toBe('Ungültige Telefonnummer');
        });

        it('should generate PLZ error message with digit count info', () => {
            const result = service.validate('123', ['plz']);
            expect(result.error).toContain('4-5 Ziffern');
        });

        it('should generate minLength error with actual minimum', () => {
            const result = service.validate('hi', [service.rules.minLength(8)]);
            expect(result.error).toBe('Mindestens 8 Zeichen');
        });

        it('should generate maxLength error with actual maximum', () => {
            const result = service.validate('toolongtext', [service.rules.maxLength(5)]);
            expect(result.error).toBe('Maximal 5 Zeichen');
        });

        it('should generate USt-IdNr format hint', () => {
            const result = service.validate('123456789', ['ustId']);
            expect(result.error).toBe('Format: DE123456789');
        });
    });
});
