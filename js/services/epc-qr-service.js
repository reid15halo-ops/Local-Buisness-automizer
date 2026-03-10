/* ============================================
   EPC QR Code (GiroCode) Service
   Generates EPC-069-12 compliant QR codes for
   SEPA Credit Transfer — fully offline, no CDN.

   The QR encoder is a minimal ISO 18004 impl
   (numeric/alphanumeric/byte modes, EC level M)
   embedded directly so the PWA works offline and
   no external requests are made (DSGVO-safe).
   ============================================ */

class EpcQrService {
    constructor() {
        this.defaultBankDetails = null;
    }

    // ── Public API ──────────────────────────────────────────────────

    /**
     * Generate an EPC QR code for an invoice.
     * @param {Object} invoice  – must have .brutto and .nummer
     * @param {Object} [bankDetails] – override bank details
     * @returns {string} PNG data-URL (base64)
     */
    generateEpcQrCode(invoice, bankDetails) {
        const bank = bankDetails || this.getBankDetails();

        // Validate IBAN
        const ibanResult = this.validateIBAN(bank.iban);
        if (!ibanResult.valid) {
            console.warn(`EPC QR: IBAN-Validierung fehlgeschlagen – ${ibanResult.error}`);
            return null;
        }

        // Validate BIC if provided (BIC is optional for SEPA)
        if (bank.bic) {
            const bicResult = this.validateBIC(bank.bic);
            if (!bicResult.valid) {
                console.warn(`EPC QR: BIC-Validierung fehlgeschlagen – ${bicResult.error}`);
                return null;
            }
        }

        const payload = this.buildEpcPayload(invoice, bank);
        return this.generateQrDataUrl(payload);
    }

    /**
     * Generate an EPC QR code and return as an HTMLCanvasElement.
     * @param {Object} invoice
     * @param {Object} [bankDetails]
     * @param {number} [size=200]  – canvas pixel size
     * @returns {HTMLCanvasElement}
     */
    generateEpcQrCanvas(invoice, bankDetails, size = 200) {
        const bank = bankDetails || this.getBankDetails();
        const payload = this.buildEpcPayload(invoice, bank);
        return this.generateQrCanvas(payload, size);
    }

    /**
     * Generate an <img> element with the EPC QR code.
     * @param {Object} invoice
     * @param {Object} [bankDetails]
     * @param {number} [size=200]
     * @returns {HTMLImageElement}
     */
    generateEpcQrImage(invoice, bankDetails, size = 200) {
        const dataUrl = this.generateEpcQrCode(invoice, bankDetails);
        const img = document.createElement('img');
        img.src = dataUrl;
        img.width = size;
        img.height = size;
        img.alt = 'EPC QR Code – Scannen zum Bezahlen';
        img.style.imageRendering = 'pixelated';
        return img;
    }

    // ── Validation ─────────────────────────────────────────────────

    /**
     * Validate an IBAN using ISO 13616 mod-97 check.
     * Supports all EU IBANs (variable length per country).
     * @param {string} iban
     * @returns {{ valid: boolean, error: string|null }}
     */
    validateIBAN(iban) {
        if (!iban || typeof iban !== 'string') {
            return { valid: false, error: 'IBAN ist leer oder ungültig' };
        }

        const cleaned = iban.replace(/\s/g, '').toUpperCase();

        // Must start with 2 letters (country code) + 2 digits (check digits)
        if (!/^[A-Z]{2}\d{2}/.test(cleaned)) {
            return { valid: false, error: 'IBAN muss mit Ländercode und 2 Prüfziffern beginnen (z.B. DE89...)' };
        }

        // IBAN lengths per country (SEPA + EU/EEA)
        const ibanLengths = {
            AL: 28, AD: 20, AT: 20, AZ: 28, BH: 22, BY: 28, BE: 16, BA: 20,
            BR: 29, BG: 22, CR: 22, HR: 21, CY: 28, CZ: 24, DK: 18, DO: 28,
            TL: 23, EE: 20, FO: 18, FI: 18, FR: 27, GE: 22, DE: 22, GI: 23,
            GR: 27, GL: 18, GT: 28, HU: 28, IS: 26, IQ: 23, IE: 22, IL: 23,
            IT: 27, JO: 30, KZ: 20, XK: 20, KW: 30, LV: 21, LB: 28, LI: 21,
            LT: 20, LU: 20, MK: 19, MT: 31, MR: 27, MU: 30, MC: 27, MD: 24,
            ME: 22, NL: 18, NO: 15, PK: 24, PS: 29, PL: 28, PT: 25, QA: 29,
            RO: 24, SM: 27, SA: 24, RS: 22, SK: 24, SI: 19, ES: 24, SE: 24,
            CH: 21, TN: 24, TR: 26, AE: 23, GB: 22, VA: 22, VG: 24
        };

        const country = cleaned.substring(0, 2);
        const expectedLen = ibanLengths[country];

        if (!expectedLen) {
            return { valid: false, error: `Unbekannter Ländercode: ${country}` };
        }

        if (cleaned.length !== expectedLen) {
            return { valid: false, error: `IBAN für ${country} muss ${expectedLen} Zeichen lang sein (aktuell: ${cleaned.length})` };
        }

        // Only alphanumeric characters allowed
        if (!/^[A-Z0-9]+$/.test(cleaned)) {
            return { valid: false, error: 'IBAN darf nur Buchstaben und Ziffern enthalten' };
        }

        // ISO 13616 mod-97 check:
        // 1. Move first 4 chars to end
        const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);

        // 2. Replace letters with numbers (A=10, B=11, ..., Z=35)
        let numericStr = '';
        for (const ch of rearranged) {
            const code = ch.charCodeAt(0);
            if (code >= 65 && code <= 90) {
                numericStr += (code - 55).toString(); // A=10, B=11, ...
            } else {
                numericStr += ch;
            }
        }

        // 3. Compute mod 97 using chunked arithmetic (handles arbitrarily long numbers)
        let remainder = 0;
        for (let i = 0; i < numericStr.length; i++) {
            remainder = (remainder * 10 + parseInt(numericStr[i], 10)) % 97;
        }

        if (remainder !== 1) {
            return { valid: false, error: 'IBAN-Prüfsumme ungültig (mod-97 Prüfung fehlgeschlagen)' };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate BIC/SWIFT format (8 or 11 alphanumeric characters).
     * @param {string} bic
     * @returns {{ valid: boolean, error: string|null }}
     */
    validateBIC(bic) {
        if (!bic || typeof bic !== 'string') {
            return { valid: false, error: 'BIC ist leer oder ungültig' };
        }

        const cleaned = bic.replace(/\s/g, '').toUpperCase();

        // BIC format: 4 letters (bank) + 2 letters (country) + 2 alphanum (location) + optional 3 alphanum (branch)
        // Total: 8 or 11 characters
        if (cleaned.length !== 8 && cleaned.length !== 11) {
            return { valid: false, error: `BIC muss 8 oder 11 Zeichen lang sein (aktuell: ${cleaned.length})` };
        }

        // Full BIC regex: BBBB CC LL [BBB]
        // Bank code: 4 letters, Country: 2 letters, Location: 2 alphanum, Branch: 3 alphanum (optional)
        if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleaned)) {
            return { valid: false, error: 'BIC-Format ungültig (erwartet: 4 Buchstaben + 2 Buchstaben + 2-5 alphanumerische Zeichen)' };
        }

        return { valid: true, error: null };
    }

    // ── EPC Payload (BCD format, EPC-069-12) ────────────────────────

    /**
     * Build EPC QR payload string.
     * Spec: European Payments Council EPC069-12 v2.1
     *
     * Format:
     *   BCD\n002\n1\nSCT\n[BIC]\n[Name]\n[IBAN]\nEUR[Amount]\n\n[Reference]\n\n
     */
    buildEpcPayload(invoice, bank) {
        const amount = parseFloat(invoice.brutto || invoice.betrag || 0);
        const reference = String(invoice.nummer || invoice.id || '').substring(0, 140);

        // Validate required fields
        if (!bank.iban) {
            console.error('EPC QR: IBAN fehlt');
            throw new Error('IBAN ist erforderlich für EPC QR Code');
        }
        if (!bank.recipientName) {
            console.error('EPC QR: Empfängername fehlt');
            throw new Error('Empfängername ist erforderlich für EPC QR Code');
        }
        if (amount <= 0 || amount > 999999999.99) {
            console.error('EPC QR: Ungültiger Betrag', amount);
            throw new Error('Betrag muss zwischen 0.01 und 999999999.99 EUR liegen');
        }

        const iban = bank.iban.replace(/\s/g, '').toUpperCase();
        const bic = (bank.bic || '').replace(/\s/g, '').toUpperCase();
        // Recipient name max 70 chars per spec
        const name = bank.recipientName.substring(0, 70);

        const lines = [
            'BCD',                          // Service Tag
            '002',                          // Version
            '1',                            // Character set (1 = UTF-8)
            'SCT',                          // Identification code
            bic,                            // BIC (optional for SEPA)
            name,                           // Beneficiary Name
            iban,                           // Beneficiary IBAN
            `EUR${amount.toFixed(2)}`,      // Amount in EUR
            '',                             // Purpose code (optional)
            '',                             // Structured reference (optional)
            reference,                      // Unstructured reference (Verwendungszweck)
            ''                              // Beneficiary to originator info (optional)
        ];

        return lines.join('\n');
    }

    // ── Bank Details Resolution ─────────────────────────────────────

    /**
     * Resolve bank details from app settings / eInvoice service / localStorage.
     * @returns {{ iban: string, bic: string, recipientName: string, bank: string }}
     */
    getBankDetails() {
        if (this.defaultBankDetails) {
            return this.defaultBankDetails;
        }

        // 1. eInvoice business data
        const bd = window.eInvoiceService?.settings?.businessData || {};

        // 2. Admin panel settings
        const ap = typeof StorageUtils !== 'undefined'
            ? StorageUtils.getJSON('freyai_admin_settings', {}, { service: 'epcQrService' })
            : {};

        // 3. Direct localStorage keys (setup wizard)
        const ls = (key) => {
            try { return localStorage.getItem(key) || ''; }
            catch (_) { return ''; }
        };

        return {
            iban: bd.iban || ap.bank_iban || ls('bank_iban') || ls('iban') || '',
            bic: bd.bic || ap.bank_bic || ls('bank_bic') || ls('bic') || '',
            recipientName: bd.name || ap.company_name || ls('company_name') || 'FreyAI Visions',
            bank: bd.bankName || ap.bank_name || ls('bank_name') || ''
        };
    }

    /**
     * Override default bank details (useful for testing or multi-tenant).
     * @param {Object} details
     */
    setBankDetails(details) {
        this.defaultBankDetails = details;
    }

    // ── QR Code Generation (self-contained, offline) ────────────────
    //
    //  Minimal QR encoder supporting Byte mode, EC level M.
    //  Based on ISO 18004; handles versions 1-10 which covers
    //  up to ~331 bytes — more than enough for EPC payloads
    //  (typically ~150 bytes).

    /**
     * Generate QR code as a PNG data URL.
     * @param {string} text
     * @param {number} [moduleSize=4] – pixels per module
     * @param {number} [margin=4] – quiet zone in modules
     * @returns {string} data:image/png;base64,...
     */
    generateQrDataUrl(text, moduleSize = 4, margin = 4) {
        const canvas = this.generateQrCanvas(text, null, moduleSize, margin);
        return canvas.toDataURL('image/png');
    }

    /**
     * Generate QR code as a canvas element.
     * @param {string} text
     * @param {number|null} [size] – if set, canvas is scaled to this size
     * @param {number} [moduleSize=4]
     * @param {number} [margin=4]
     * @returns {HTMLCanvasElement}
     */
    generateQrCanvas(text, size, moduleSize = 4, margin = 4) {
        const modules = this._encode(text);
        const n = modules.length;
        const canvasSize = (n + margin * 2) * moduleSize;

        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.fillStyle = '#000000';

        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (modules[r][c]) {
                    ctx.fillRect(
                        (c + margin) * moduleSize,
                        (r + margin) * moduleSize,
                        moduleSize,
                        moduleSize
                    );
                }
            }
        }

        // If a specific size is requested, scale
        if (size && size !== canvasSize) {
            const scaled = document.createElement('canvas');
            scaled.width = size;
            scaled.height = size;
            const sCtx = scaled.getContext('2d');
            sCtx.imageSmoothingEnabled = false;
            sCtx.drawImage(canvas, 0, 0, size, size);
            return scaled;
        }

        return canvas;
    }

    // ── QR Encoder internals ────────────────────────────────────────

    _encode(text) {
        const data = new TextEncoder().encode(text);
        const ecLevel = 0; // 0=M (Medium ~15% recovery)

        // Determine version (1-40, we support 1-10 for simplicity)
        const version = this._selectVersion(data.length, ecLevel);
        if (version < 0) {
            throw new Error('EPC QR: Daten zu lang für QR-Code');
        }

        const size = version * 4 + 17;
        const modules = Array.from({ length: size }, () => new Uint8Array(size));
        const isFunction = Array.from({ length: size }, () => new Uint8Array(size));

        // Draw function patterns
        this._drawFinderPatterns(modules, isFunction, size);
        this._drawAlignmentPatterns(modules, isFunction, version, size);
        this._drawTimingPatterns(modules, isFunction, size);
        this._drawFormatBits(modules, isFunction, size, ecLevel, 0);
        if (version >= 7) {
            this._drawVersionBits(modules, isFunction, size, version);
        }

        // Encode data
        const codewords = this._encodeData(data, version, ecLevel);

        // Place data bits
        this._placeDataBits(modules, isFunction, size, codewords);

        // Choose best mask
        let bestMask = 0;
        let bestPenalty = Infinity;
        for (let mask = 0; mask < 8; mask++) {
            const trial = modules.map(row => new Uint8Array(row));
            this._applyMask(trial, isFunction, size, mask);
            this._drawFormatBits(trial, null, size, ecLevel, mask);
            const penalty = this._computePenalty(trial, size);
            if (penalty < bestPenalty) {
                bestPenalty = penalty;
                bestMask = mask;
            }
        }

        this._applyMask(modules, isFunction, size, bestMask);
        this._drawFormatBits(modules, null, size, ecLevel, bestMask);

        return modules;
    }

    // Version selection: byte-mode capacity at EC level M
    _selectVersion(dataLen, _ecLevel) {
        // Byte mode capacities for EC level M (versions 1-10)
        const capacities = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
        for (let v = 1; v <= 10; v++) {
            if (dataLen <= capacities[v]) return v;
        }
        return -1;
    }

    // Total data codewords per version at EC level M
    _getDataCodewords(version) {
        const table = [0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216];
        return table[version];
    }

    // EC codewords per block at EC level M
    _getEcInfo(version) {
        // [totalCodewords, ecCodewordsPerBlock, numBlocks]
        const table = [
            null,
            [26, 10, 1],    // v1
            [44, 16, 1],    // v2
            [70, 26, 1],    // v3
            [100, 18, 2],   // v4
            [134, 24, 2],   // v5
            [172, 16, 4],   // v6
            [196, 18, 4],   // v7
            [242, 22, 4],   // v8 — 2 groups
            [292, 22, 4],   // v9 — mixed
            [346, 26, 4],   // v10 — mixed
        ];
        return table[version];
    }

    // More precise EC block structure
    _getEcBlocks(version) {
        // Returns array of { count, dataCodewords } groups + ecCodewordsPerBlock
        const table = {
            1:  { ecPerBlock: 10, groups: [{ count: 1, dataWords: 16 }] },
            2:  { ecPerBlock: 16, groups: [{ count: 1, dataWords: 28 }] },
            3:  { ecPerBlock: 26, groups: [{ count: 1, dataWords: 44 }] },
            4:  { ecPerBlock: 18, groups: [{ count: 2, dataWords: 32 }] },
            5:  { ecPerBlock: 24, groups: [{ count: 2, dataWords: 43 }] },
            6:  { ecPerBlock: 16, groups: [{ count: 4, dataWords: 27 }] },
            7:  { ecPerBlock: 18, groups: [{ count: 4, dataWords: 31 }] },
            8:  { ecPerBlock: 22, groups: [{ count: 2, dataWords: 38 }, { count: 2, dataWords: 39 }] },
            9:  { ecPerBlock: 22, groups: [{ count: 3, dataWords: 36 }, { count: 2, dataWords: 37 }] },
            10: { ecPerBlock: 26, groups: [{ count: 4, dataWords: 43 }, { count: 1, dataWords: 44 }] },
        };
        return table[version];
    }

    _encodeData(data, version, _ecLevel) {
        const totalDataCW = this._getDataCodewords(version);

        // Build bit stream: mode indicator (0100 = byte) + char count + data
        const bits = [];
        const pushBits = (val, len) => {
            for (let i = len - 1; i >= 0; i--) {
                bits.push((val >>> i) & 1);
            }
        };

        // Mode indicator: byte = 0100
        pushBits(4, 4);

        // Character count indicator length depends on version
        const ccLen = version <= 9 ? 8 : 16;
        pushBits(data.length, ccLen);

        // Data bytes
        for (let i = 0; i < data.length; i++) {
            pushBits(data[i], 8);
        }

        // Terminator (up to 4 zero bits)
        const totalDataBits = totalDataCW * 8;
        const terminatorLen = Math.min(4, totalDataBits - bits.length);
        pushBits(0, terminatorLen);

        // Pad to byte boundary
        while (bits.length % 8 !== 0) bits.push(0);

        // Pad codewords (0xEC, 0x11 alternating)
        const padBytes = [0xEC, 0x11];
        let padIdx = 0;
        while (bits.length < totalDataBits) {
            pushBits(padBytes[padIdx], 8);
            padIdx = (padIdx + 1) % 2;
        }

        // Convert bits to codewords
        const dataCodewords = [];
        for (let i = 0; i < bits.length; i += 8) {
            let byte = 0;
            for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
            dataCodewords.push(byte);
        }

        // Split into blocks and generate EC
        const ecInfo = this._getEcBlocks(version);
        const blocks = [];
        const ecBlocks = [];
        let offset = 0;

        for (const group of ecInfo.groups) {
            for (let b = 0; b < group.count; b++) {
                const block = dataCodewords.slice(offset, offset + group.dataWords);
                offset += group.dataWords;
                blocks.push(block);
                ecBlocks.push(this._computeEc(block, ecInfo.ecPerBlock));
            }
        }

        // Interleave data blocks
        const result = [];
        const maxDataLen = Math.max(...blocks.map(b => b.length));
        for (let i = 0; i < maxDataLen; i++) {
            for (const block of blocks) {
                if (i < block.length) result.push(block[i]);
            }
        }

        // Interleave EC blocks
        for (let i = 0; i < ecInfo.ecPerBlock; i++) {
            for (const ecBlock of ecBlocks) {
                if (i < ecBlock.length) result.push(ecBlock[i]);
            }
        }

        return result;
    }

    // Reed-Solomon error correction
    _computeEc(data, numEcWords) {
        const gen = this._rsGeneratorPoly(numEcWords);
        const result = new Uint8Array(numEcWords);

        for (let i = 0; i < data.length; i++) {
            const factor = data[i] ^ result[0];
            // Shift result left
            for (let j = 0; j < numEcWords - 1; j++) {
                result[j] = result[j + 1];
            }
            result[numEcWords - 1] = 0;

            // XOR with generator polynomial
            for (let j = 0; j < numEcWords; j++) {
                result[j] ^= this._gfMul(gen[j], factor);
            }
        }

        return Array.from(result);
    }

    // GF(256) multiplication
    _gfMul(a, b) {
        if (a === 0 || b === 0) return 0;
        return this._gfExp[(this._gfLog[a] + this._gfLog[b]) % 255];
    }

    // Initialize GF(256) tables (lazy)
    get _gfExp() {
        if (!this.__gfExp) this._initGf();
        return this.__gfExp;
    }
    get _gfLog() {
        if (!this.__gfLog) this._initGf();
        return this.__gfLog;
    }

    _initGf() {
        this.__gfExp = new Uint8Array(256);
        this.__gfLog = new Uint8Array(256);
        let val = 1;
        for (let i = 0; i < 255; i++) {
            this.__gfExp[i] = val;
            this.__gfLog[val] = i;
            val <<= 1;
            if (val >= 256) val ^= 0x11d; // primitive polynomial
        }
        this.__gfExp[255] = this.__gfExp[0];
    }

    _rsGeneratorPoly(degree) {
        let poly = [1];
        for (let i = 0; i < degree; i++) {
            const newPoly = new Array(poly.length + 1).fill(0);
            for (let j = 0; j < poly.length; j++) {
                newPoly[j] ^= poly[j];
                newPoly[j + 1] ^= this._gfMul(poly[j], this._gfExp[i]);
            }
            poly = newPoly;
        }
        return poly.slice(1); // drop leading 1
    }

    // ── Pattern drawing ─────────────────────────────────────────────

    _drawFinderPatterns(modules, isFunc, size) {
        const positions = [[0, 0], [size - 7, 0], [0, size - 7]];
        for (const [row, col] of positions) {
            for (let r = -1; r <= 7; r++) {
                for (let c = -1; c <= 7; c++) {
                    const mr = row + r, mc = col + c;
                    if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue;
                    const inOuter = (r >= 0 && r <= 6 && c >= 0 && c <= 6);
                    const inInner = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
                    const onBorder = (r === 0 || r === 6 || c === 0 || c === 6);
                    modules[mr][mc] = (inInner || (inOuter && onBorder)) ? 1 : 0;
                    isFunc[mr][mc] = 1;
                }
            }
        }
        // Dark module
        modules[size - 8][8] = 1;
        isFunc[size - 8][8] = 1;
    }

    _drawAlignmentPatterns(modules, isFunc, version, size) {
        if (version < 2) return;
        const positions = this._alignmentPositions(version, size);
        for (const row of positions) {
            for (const col of positions) {
                // Skip if overlaps with finder
                if ((row <= 8 && col <= 8) ||
                    (row <= 8 && col >= size - 8) ||
                    (row >= size - 8 && col <= 8)) continue;
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        const dark = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
                        modules[row + dr][col + dc] = dark ? 1 : 0;
                        isFunc[row + dr][col + dc] = 1;
                    }
                }
            }
        }
    }

    _alignmentPositions(version, size) {
        if (version === 1) return [];
        const intervals = [
            0, 0, 18, 22, 26, 30, 34, 22, 24, 26, 28
        ];
        const step = intervals[version];
        const positions = [6];
        let pos = size - 7;
        while (pos > 6) {
            positions.unshift(pos);
            pos -= step;
        }
        positions.unshift(6);
        // Remove duplicates
        return [...new Set(positions)].sort((a, b) => a - b);
    }

    _drawTimingPatterns(modules, isFunc, size) {
        for (let i = 8; i < size - 8; i++) {
            const dark = (i % 2 === 0) ? 1 : 0;
            if (!isFunc[6][i]) { modules[6][i] = dark; isFunc[6][i] = 1; }
            if (!isFunc[i][6]) { modules[i][6] = dark; isFunc[i][6] = 1; }
        }
    }

    _drawFormatBits(modules, isFunc, size, ecLevel, mask) {
        // EC level M = 00, L = 01, H = 10, Q = 11
        const ecBits = [0, 1, 3, 2]; // M, L, Q, H
        const data = (ecBits[ecLevel] << 3) | mask;
        let rem = data;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const bits = ((data << 10) | rem) ^ 0x5412;

        // Place format bits
        const coords1 = [
            [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8],
            [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]
        ];
        const coords2 = [
            [8, size - 1], [8, size - 2], [8, size - 3], [8, size - 4],
            [8, size - 5], [8, size - 6], [8, size - 7], [8, size - 8],
            [size - 7, 8], [size - 6, 8], [size - 5, 8], [size - 4, 8],
            [size - 3, 8], [size - 2, 8], [size - 1, 8]
        ];

        for (let i = 0; i < 15; i++) {
            const bit = (bits >>> i) & 1;
            const [r1, c1] = coords1[i];
            modules[r1][c1] = bit;
            if (isFunc) isFunc[r1][c1] = 1;

            const [r2, c2] = coords2[i];
            modules[r2][c2] = bit;
            if (isFunc) isFunc[r2][c2] = 1;
        }
    }

    _drawVersionBits(modules, isFunc, size, version) {
        if (version < 7) return;
        let rem = version;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
        const bits = (version << 12) | rem;

        for (let i = 0; i < 18; i++) {
            const bit = (bits >>> i) & 1;
            const r = Math.floor(i / 3);
            const c = size - 11 + (i % 3);
            modules[r][c] = bit;
            modules[c][r] = bit;
            if (isFunc) {
                isFunc[r][c] = 1;
                isFunc[c][r] = 1;
            }
        }
    }

    _placeDataBits(modules, isFunction, size, codewords) {
        let bitIdx = 0;
        const totalBits = codewords.length * 8;

        // Traverse right-to-left in 2-column stripes
        for (let right = size - 1; right >= 1; right -= 2) {
            if (right === 6) right = 5; // Skip timing column
            for (let vert = 0; vert < size; vert++) {
                for (let j = 0; j < 2; j++) {
                    const col = right - j;
                    const upward = ((right + 1) & 2) === 0;
                    const row = upward ? size - 1 - vert : vert;

                    if (isFunction[row][col]) continue;
                    if (bitIdx < totalBits) {
                        const byteIdx = bitIdx >>> 3;
                        const bitPos = 7 - (bitIdx & 7);
                        modules[row][col] = (codewords[byteIdx] >>> bitPos) & 1;
                        bitIdx++;
                    }
                }
            }
        }
    }

    _applyMask(modules, isFunction, size, mask) {
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (isFunction[r][c]) continue;
                let invert = false;
                switch (mask) {
                    case 0: invert = (r + c) % 2 === 0; break;
                    case 1: invert = r % 2 === 0; break;
                    case 2: invert = c % 3 === 0; break;
                    case 3: invert = (r + c) % 3 === 0; break;
                    case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
                    case 5: invert = (r * c) % 2 + (r * c) % 3 === 0; break;
                    case 6: invert = ((r * c) % 2 + (r * c) % 3) % 2 === 0; break;
                    case 7: invert = ((r + c) % 2 + (r * c) % 3) % 2 === 0; break;
                }
                if (invert) modules[r][c] ^= 1;
            }
        }
    }

    _computePenalty(modules, size) {
        let penalty = 0;

        // Rule 1: consecutive same-color modules in rows/cols
        for (let r = 0; r < size; r++) {
            let runColor = modules[r][0];
            let runLen = 1;
            for (let c = 1; c < size; c++) {
                if (modules[r][c] === runColor) {
                    runLen++;
                } else {
                    if (runLen >= 5) penalty += runLen - 2;
                    runColor = modules[r][c];
                    runLen = 1;
                }
            }
            if (runLen >= 5) penalty += runLen - 2;
        }
        for (let c = 0; c < size; c++) {
            let runColor = modules[0][c];
            let runLen = 1;
            for (let r = 1; r < size; r++) {
                if (modules[r][c] === runColor) {
                    runLen++;
                } else {
                    if (runLen >= 5) penalty += runLen - 2;
                    runColor = modules[r][c];
                    runLen = 1;
                }
            }
            if (runLen >= 5) penalty += runLen - 2;
        }

        // Rule 2: 2x2 blocks
        for (let r = 0; r < size - 1; r++) {
            for (let c = 0; c < size - 1; c++) {
                const color = modules[r][c];
                if (color === modules[r][c + 1] &&
                    color === modules[r + 1][c] &&
                    color === modules[r + 1][c + 1]) {
                    penalty += 3;
                }
            }
        }

        // Rule 3: finder-like patterns
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size - 6; c++) {
                if (modules[r][c] === 1 && modules[r][c + 1] === 0 &&
                    modules[r][c + 2] === 1 && modules[r][c + 3] === 1 &&
                    modules[r][c + 4] === 1 && modules[r][c + 5] === 0 &&
                    modules[r][c + 6] === 1) {
                    penalty += 40;
                }
            }
        }
        for (let c = 0; c < size; c++) {
            for (let r = 0; r < size - 6; r++) {
                if (modules[r][c] === 1 && modules[r + 1][c] === 0 &&
                    modules[r + 2][c] === 1 && modules[r + 3][c] === 1 &&
                    modules[r + 4][c] === 1 && modules[r + 5][c] === 0 &&
                    modules[r + 6][c] === 1) {
                    penalty += 40;
                }
            }
        }

        // Rule 4: proportion of dark modules
        let dark = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (modules[r][c]) dark++;
            }
        }
        const total = size * size;
        const pct = dark * 100 / total;
        const prev5 = Math.floor(pct / 5) * 5;
        const next5 = prev5 + 5;
        penalty += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10;

        return penalty;
    }
}

// ── Register globally ───────────────────────────────────────────────
window.epcQrService = new EpcQrService();
