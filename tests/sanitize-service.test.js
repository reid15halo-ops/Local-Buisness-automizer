import { describe, it, expect } from 'vitest';

const SanitizeService = {
  escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#96;'
    };
    return str.replace(/[&<>"'\/`]/g, char => map[char]);
  },

  escapeAttr(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str.replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  },

  sanitizeEmail(email) {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase().replace(/[^a-z0-9@._+\-]/g, '');
  },

  sanitizePhone(phone) {
    if (typeof phone !== 'string') return '';
    return phone.replace(/[^0-9+\-\s()]/g, '').trim();
  },

  sanitizeText(text) {
    if (typeof text !== 'string') return '';
    return this.escapeHtml(text.trim());
  },

  sanitizeNumber(value, fallback = 0) {
    const num = parseFloat(value);
    return isNaN(num) ? fallback : num;
  },

  sanitizeUrl(url) {
    if (typeof url !== 'string') return '';
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      return parsed.href;
    } catch {
      return '';
    }
  },

  sanitizeForDataAttr(obj) {
    return this.escapeAttr(JSON.stringify(obj));
  },

  isValidIBAN(iban) {
    if (typeof iban !== 'string') return false;
    const cleaned = iban.replace(/\s/g, '').toUpperCase();
    return /^DE\d{20}$/.test(cleaned);
  },

  isValidSteuerId(id) {
    if (typeof id !== 'string') return false;
    return /^\d{10,11}$/.test(id.replace(/[\s\/]/g, ''));
  }
};

describe('SanitizeService', () => {
  describe('XSS Prevention - escapeHtml', () => {
    it('should escape HTML angle brackets', () => {
      const input = '<script>alert("XSS")</script>';
      const output = SanitizeService.escapeHtml(input);

      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');
    });

    it('should escape ampersand', () => {
      const input = 'A & B';
      const output = SanitizeService.escapeHtml(input);
      expect(output).toBe('A &amp; B');
    });

    it('should escape double quotes', () => {
      const input = 'Hello "World"';
      const output = SanitizeService.escapeHtml(input);
      expect(output).toBe('Hello &quot;World&quot;');
    });

    it('should escape single quotes', () => {
      const input = "It's dangerous";
      const output = SanitizeService.escapeHtml(input);
      expect(output).toBe('It&#x27;s dangerous');
    });

    it('should escape forward slash', () => {
      const input = '</script>';
      const output = SanitizeService.escapeHtml(input);
      expect(output).toContain('&#x2F;');
    });

    it('should escape backticks', () => {
      const input = '`alert("xss")`';
      const output = SanitizeService.escapeHtml(input);
      expect(output).toContain('&#96;');
    });

    it('should escape multiple dangerous characters', () => {
      const input = '<img src="x" onerror="alert(\'XSS\')" />';
      const output = SanitizeService.escapeHtml(input);

      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).not.toContain('"');
      expect(output).not.toContain("'");
    });

    it('should handle empty string', () => {
      const output = SanitizeService.escapeHtml('');
      expect(output).toBe('');
    });

    it('should handle string with only safe characters', () => {
      const input = 'Hello World 123';
      const output = SanitizeService.escapeHtml(input);
      expect(output).toBe('Hello World 123');
    });

    it('should handle null and undefined', () => {
      expect(SanitizeService.escapeHtml(null)).toBe('');
      expect(SanitizeService.escapeHtml(undefined)).toBe('');
    });

    it('should handle numbers', () => {
      expect(SanitizeService.escapeHtml(123)).toBe('123');
    });
  });

  describe('HTML Attribute Escaping', () => {
    it('should escape for HTML attributes', () => {
      const input = 'value" onload="alert(\'xss\')';
      const output = SanitizeService.escapeAttr(input);

      expect(output).toContain('&quot;');
      expect(output).not.toContain('"');
    });

    it('should escape all dangerous characters', () => {
      const input = '<script>&alert"\'</script>';
      const output = SanitizeService.escapeAttr(input);

      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');
      expect(output).toContain('&quot;');
      expect(output).toContain('&#39;');
    });

    it('should handle null and undefined', () => {
      expect(SanitizeService.escapeAttr(null)).toBe('');
      expect(SanitizeService.escapeAttr(undefined)).toBe('');
    });
  });

  describe('HTML Stripping - sanitizeText', () => {
    it('should remove HTML tags and escape dangerous characters', () => {
      const input = '<b>Bold</b> & <i>Italic</i>';
      const output = SanitizeService.sanitizeText(input);

      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).toContain('Bold');
      expect(output).toContain('Italic');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const output = SanitizeService.sanitizeText(input);
      expect(output).toBe('Hello World');
    });

    it('should handle script tags', () => {
      const input = '<script>alert("xss")</script>';
      const output = SanitizeService.sanitizeText(input);

      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
    });

    it('should handle event handlers', () => {
      const input = '<img src="x" onerror="alert(1)">';
      const output = SanitizeService.sanitizeText(input);

      // The onerror will be HTML-escaped but still present in the escaped form
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).toContain('&lt;');
    });

    it('should handle empty string', () => {
      const output = SanitizeService.sanitizeText('');
      expect(output).toBe('');
    });

    it('should handle non-string input', () => {
      expect(SanitizeService.sanitizeText(null)).toBe('');
      expect(SanitizeService.sanitizeText(undefined)).toBe('');
    });
  });

  describe('Email Sanitization', () => {
    it('should accept valid email', () => {
      const input = 'user@example.com';
      const output = SanitizeService.sanitizeEmail(input);
      expect(output).toBe('user@example.com');
    });

    it('should lowercase email', () => {
      const input = 'User@EXAMPLE.COM';
      const output = SanitizeService.sanitizeEmail(input);
      expect(output).toBe('user@example.com');
    });

    it('should remove spaces', () => {
      const input = 'user @ example.com';
      const output = SanitizeService.sanitizeEmail(input);
      expect(output).toBe('user@example.com');
    });

    it('should allow valid characters', () => {
      const input = 'user.name+tag@example.co.uk';
      const output = SanitizeService.sanitizeEmail(input);
      expect(output).toBe('user.name+tag@example.co.uk');
    });

    it('should remove invalid characters', () => {
      const input = 'user<>@example.com';
      const output = SanitizeService.sanitizeEmail(input);
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
    });

    it('should remove spaces from input', () => {
      const input = '  user@example.com  ';
      const output = SanitizeService.sanitizeEmail(input);
      expect(output).toBe('user@example.com');
    });

    it('should handle empty string', () => {
      const output = SanitizeService.sanitizeEmail('');
      expect(output).toBe('');
    });

    it('should handle non-string input', () => {
      expect(SanitizeService.sanitizeEmail(null)).toBe('');
      expect(SanitizeService.sanitizeEmail(undefined)).toBe('');
    });
  });

  describe('Phone Number Sanitization', () => {
    it('should accept valid phone number', () => {
      const input = '+49 30 123456';
      const output = SanitizeService.sanitizePhone(input);
      expect(output).toBe('+49 30 123456');
    });

    it('should remove non-valid characters', () => {
      const input = '+49<30>123456';
      const output = SanitizeService.sanitizePhone(input);
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
    });

    it('should preserve formatting characters', () => {
      const input = '+49 (30) 123-456';
      const output = SanitizeService.sanitizePhone(input);
      expect(output).toContain(' ');
      expect(output).toContain('-');
      expect(output).toContain('(');
      expect(output).toContain(')');
    });

    it('should allow plus sign and dashes', () => {
      const input = '+49-30-123456';
      const output = SanitizeService.sanitizePhone(input);
      expect(output).toContain('+');
      expect(output).toContain('-');
    });

    it('should trim whitespace', () => {
      const input = '  030 123456  ';
      const output = SanitizeService.sanitizePhone(input);
      expect(output).toBe('030 123456');
    });

    it('should handle empty string', () => {
      const output = SanitizeService.sanitizePhone('');
      expect(output).toBe('');
    });

    it('should handle non-string input', () => {
      expect(SanitizeService.sanitizePhone(null)).toBe('');
      expect(SanitizeService.sanitizePhone(undefined)).toBe('');
    });
  });

  describe('Number Sanitization', () => {
    it('should parse valid numbers', () => {
      expect(SanitizeService.sanitizeNumber('123')).toBe(123);
      expect(SanitizeService.sanitizeNumber('45.67')).toBe(45.67);
    });

    it('should handle negative numbers', () => {
      expect(SanitizeService.sanitizeNumber('-123')).toBe(-123);
    });

    it('should return fallback for invalid input', () => {
      expect(SanitizeService.sanitizeNumber('abc')).toBe(0);
      expect(SanitizeService.sanitizeNumber('abc', 99)).toBe(99);
    });

    it('should handle null and undefined', () => {
      expect(SanitizeService.sanitizeNumber(null)).toBe(0);
      expect(SanitizeService.sanitizeNumber(undefined)).toBe(0);
    });

    it('should handle empty string', () => {
      expect(SanitizeService.sanitizeNumber('')).toBe(0);
    });

    it('should parse numbers with whitespace', () => {
      expect(SanitizeService.sanitizeNumber('  123  ')).toBe(123);
    });
  });

  describe('URL Sanitization', () => {
    it('should accept valid HTTPS URL', () => {
      const input = 'https://example.com';
      const output = SanitizeService.sanitizeUrl(input);
      expect(output).toBe('https://example.com/');
    });

    it('should accept valid HTTP URL', () => {
      const input = 'http://example.com';
      const output = SanitizeService.sanitizeUrl(input);
      expect(output).toBe('http://example.com/');
    });

    it('should reject non-HTTP(S) protocols', () => {
      const inputs = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd',
        'ftp://example.com'
      ];

      inputs.forEach(input => {
        const output = SanitizeService.sanitizeUrl(input);
        expect(output).toBe('');
      });
    });

    it('should reject malformed URLs', () => {
      const output = SanitizeService.sanitizeUrl('not a url');
      expect(output).toBe('');
    });

    it('should handle complex URLs', () => {
      const input = 'https://example.com/path?query=1&other=2#anchor';
      const output = SanitizeService.sanitizeUrl(input);
      expect(output).toContain('https://');
      expect(output).toContain('example.com');
    });

    it('should handle null and undefined', () => {
      expect(SanitizeService.sanitizeUrl(null)).toBe('');
      expect(SanitizeService.sanitizeUrl(undefined)).toBe('');
    });
  });

  describe('Data Attribute Sanitization', () => {
    it('should escape JSON for data attributes', () => {
      const obj = { key: 'value"dangerous' };
      const output = SanitizeService.sanitizeForDataAttr(obj);

      expect(output).not.toContain('"dangerous');
      expect(output).toContain('&quot;');
    });

    it('should handle complex objects', () => {
      const obj = {
        name: 'Test',
        values: [1, 2, 3],
        nested: { key: 'value' }
      };

      const output = SanitizeService.sanitizeForDataAttr(obj);
      expect(output).toBeDefined();
      expect(output).toContain('&quot;');
    });

    it('should escape all dangerous characters', () => {
      const obj = { html: '<tag>content</tag>' };
      const output = SanitizeService.sanitizeForDataAttr(obj);

      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');
    });
  });

  describe('IBAN Validation', () => {
    it('should accept valid German IBAN', () => {
      const validIBAN = 'DE89370400440532013000';
      expect(SanitizeService.isValidIBAN(validIBAN)).toBe(true);
    });

    it('should accept IBAN with spaces', () => {
      const validIBAN = 'DE89 3704 0044 0532 0130 00';
      expect(SanitizeService.isValidIBAN(validIBAN)).toBe(true);
    });

    it('should accept lowercase IBAN', () => {
      const validIBAN = 'de89370400440532013000';
      expect(SanitizeService.isValidIBAN(validIBAN)).toBe(true);
    });

    it('should reject non-German IBAN', () => {
      const invalidIBAN = 'FR1420041010050500013M02606';
      expect(SanitizeService.isValidIBAN(invalidIBAN)).toBe(false);
    });

    it('should reject invalid format', () => {
      expect(SanitizeService.isValidIBAN('invalid')).toBe(false);
      expect(SanitizeService.isValidIBAN('DE123')).toBe(false);
    });

    it('should reject wrong number of digits', () => {
      const shortIBAN = 'DE12345';
      expect(SanitizeService.isValidIBAN(shortIBAN)).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(SanitizeService.isValidIBAN(null)).toBe(false);
      expect(SanitizeService.isValidIBAN(undefined)).toBe(false);
    });
  });

  describe('Tax ID Validation', () => {
    it('should accept valid tax ID (10 digits)', () => {
      const validTaxId = '1234567890';
      expect(SanitizeService.isValidSteuerId(validTaxId)).toBe(true);
    });

    it('should accept valid tax ID (11 digits)', () => {
      const validTaxId = '12345678901';
      expect(SanitizeService.isValidSteuerId(validTaxId)).toBe(true);
    });

    it('should accept tax ID with spaces', () => {
      const validTaxId = '123 456 789 0';
      expect(SanitizeService.isValidSteuerId(validTaxId)).toBe(true);
    });

    it('should accept tax ID with slashes', () => {
      const validTaxId = '123/456/789/0';
      expect(SanitizeService.isValidSteuerId(validTaxId)).toBe(true);
    });

    it('should reject too short tax ID', () => {
      expect(SanitizeService.isValidSteuerId('123456789')).toBe(false);
    });

    it('should reject too long tax ID', () => {
      expect(SanitizeService.isValidSteuerId('123456789012')).toBe(false);
    });

    it('should reject non-numeric tax ID', () => {
      expect(SanitizeService.isValidSteuerId('abcdefghij')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(SanitizeService.isValidSteuerId(null)).toBe(false);
      expect(SanitizeService.isValidSteuerId(undefined)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in escapeHtml', () => {
      const input = '&<>"\'`/';
      const output = SanitizeService.escapeHtml(input);

      // Check that all dangerous characters are escaped
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).not.toContain('"');
      expect(output).toContain('&amp;');
      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');
    });

    it('should handle empty strings consistently', () => {
      expect(SanitizeService.sanitizeText('')).toBe('');
      expect(SanitizeService.sanitizeEmail('')).toBe('');
      expect(SanitizeService.sanitizePhone('')).toBe('');
      expect(SanitizeService.sanitizeUrl('')).toBe('');
    });

    it('should handle very long strings', () => {
      const longString = 'A'.repeat(10000);
      const output = SanitizeService.escapeHtml(longString);
      expect(output).toBe('A'.repeat(10000));
    });

    it('should handle mixed whitespace', () => {
      const input = '  \t\n  Text  \r\n  ';
      const output = SanitizeService.sanitizeText(input);
      expect(output).toBe('Text');
    });

    it('should handle Unicode characters', () => {
      const input = 'Hällo Wörld 你好';
      const output = SanitizeService.sanitizeText(input);
      expect(output).toContain('Hällo');
      expect(output).toContain('你好');
    });
  });
});
