#!/usr/bin/env node
/**
 * Morpheus Fix Script — Replace empty-catch localStorage patterns
 * with StorageUtils.getJSON() calls across all service/module files.
 *
 * Usage: node tools/fix-storage-patterns.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = process.cwd();
const dirs = ['js/services', 'js/modules'];

let totalFixed = 0;
let totalFiles = 0;
const report = [];

// Financial service keys that need { financial: true }
const FINANCIAL_KEYS = new Set([
    'freyai_buchungen', 'freyai_buchhaltung_settings',
    'freyai_mahnungen', 'freyai_inkasso',
    'freyai_einvoice_settings', 'freyai_einvoice_generated',
    'freyai_datev_exports', 'freyai_datev_settings',
    'freyai_payments', 'freyai_payment_links', 'freyai_payment_settings',
    'freyai_cashflow_forecasts', 'freyai_cashflow_settings',
    'freyai_bank_accounts', 'freyai_bank_transactions', 'freyai_matched_payments',
    'freyai_banking_settings',
]);

function getServiceName(filePath) {
    const base = filePath.split(/[/\\]/).pop().replace('.js', '');
    return base.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function isFinancialKey(key) {
    return FINANCIAL_KEYS.has(key);
}

function processFile(filePath) {
    let content = readFileSync(filePath, 'utf8');
    const original = content;
    const serviceName = getServiceName(filePath);
    let fileFixed = 0;

    // Pattern 1: Single-line constructor pattern
    // try { this.VAR = JSON.parse(localStorage.getItem('KEY') || 'FALLBACK'); } catch { this.VAR = FALLBACK; }
    const p1 = /try\s*\{\s*(this\.\w+)\s*=\s*JSON\.parse\(localStorage\.getItem\((['"`])([\w_]+)\2\)\s*\|\|\s*(['"`])(\[\]|\{\})\4\);\s*\}\s*catch\s*(?:\([\w_]*\)\s*)?\{\s*\1\s*=\s*(\[\]|\{\});\s*\}/g;
    content = content.replace(p1, (match, varRef, _q1, key, _q2, fallbackStr) => {
        fileFixed++;
        const fallback = fallbackStr === '[]' ? '[]' : '{}';
        const opts = isFinancialKey(key)
            ? `{ financial: true, service: '${serviceName}' }`
            : `{ service: '${serviceName}' }`;
        return `${varRef} = StorageUtils.getJSON('${key}', ${fallback}, ${opts});`;
    });

    // Pattern 1b: Same but with let/const VAR = ...
    const p1b = /try\s*\{\s*((?:let|const|var)\s+\w+)\s*=\s*JSON\.parse\(localStorage\.getItem\((['"`])([\w_]+)\2\)\s*\|\|\s*(['"`])(\[\]|\{\})\4\);\s*\}\s*catch\s*(?:\([\w_]*\)\s*)?\{\s*(?:let|const|var\s+)?\w+\s*=\s*(\[\]|\{\});\s*\}/g;
    content = content.replace(p1b, (match, varDecl, _q1, key, _q2, fallbackStr) => {
        fileFixed++;
        const fallback = fallbackStr === '[]' ? '[]' : '{}';
        const opts = isFinancialKey(key)
            ? `{ financial: true, service: '${serviceName}' }`
            : `{ service: '${serviceName}' }`;
        return `${varDecl} = StorageUtils.getJSON('${key}', ${fallback}, ${opts});`;
    });

    // Pattern 1c: let VAR; ... try { VAR = JSON.parse(...) } catch { VAR = ...; }
    // Where the variable was already declared
    const p1c = /try\s*\{\s*(\w+)\s*=\s*JSON\.parse\(localStorage\.getItem\((['"`])([\w_]+)\2\)\s*\|\|\s*(['"`])(\[\]|\{\})\4\);\s*\}\s*catch\s*(?:\([\w_]*\)\s*)?\{\s*\1\s*=\s*(\[\]|\{\});\s*\}/g;
    content = content.replace(p1c, (match, varName, _q1, key, _q2, fallbackStr) => {
        // Skip if already replaced (this.xxx was caught by p1)
        if (match.includes('this.')) return match;
        fileFixed++;
        const fallback = fallbackStr === '[]' ? '[]' : '{}';
        const opts = isFinancialKey(key)
            ? `{ financial: true, service: '${serviceName}' }`
            : `{ service: '${serviceName}' }`;
        return `${varName} = StorageUtils.getJSON('${key}', ${fallback}, ${opts});`;
    });

    // Pattern 2: IIFE pattern
    // (() => { try { return JSON.parse(localStorage.getItem('KEY') || '{}'); } catch { return {}; } })()
    const p2 = /\(\(\)\s*=>\s*\{\s*try\s*\{\s*return\s+JSON\.parse\(localStorage\.getItem\((['"`])([\w_]+)\1\)\s*\|\|\s*(['"`])(\[\]|\{\})\3\);\s*\}\s*catch\s*(?:\([\w_]*\)\s*)?\{\s*return\s+(\[\]|\{\});\s*\}\s*\}\)\(\)/g;
    content = content.replace(p2, (match, _q1, key, _q2, fallbackStr) => {
        fileFixed++;
        const fallback = fallbackStr === '[]' ? '[]' : '{}';
        const opts = isFinancialKey(key)
            ? `{ financial: true, service: '${serviceName}' }`
            : `{ service: '${serviceName}' }`;
        return `StorageUtils.getJSON('${key}', ${fallback}, ${opts})`;
    });

    // Pattern 3: Dynamic key with this.STORAGE_KEY or this.SOME_KEY
    // try { this.VAR = JSON.parse(localStorage.getItem(this.KEY) || 'FALLBACK'); } catch { this.VAR = FALLBACK; }
    const p3 = /try\s*\{\s*(this\.\w+)\s*=\s*JSON\.parse\(localStorage\.getItem\((this\.\w+)\)\s*\|\|\s*(['"`])(\[\]|\{\})\3\);\s*\}\s*catch\s*(?:\([\w_]*\)\s*)?\{\s*\1\s*=\s*(\[\]|\{\});\s*\}/g;
    content = content.replace(p3, (match, varRef, keyRef, _q, fallbackStr) => {
        fileFixed++;
        const fallback = fallbackStr === '[]' ? '[]' : '{}';
        return `${varRef} = StorageUtils.getJSON(${keyRef}, ${fallback}, { service: '${serviceName}' });`;
    });

    // Pattern 4: Dynamic key with template literal or concatenation
    // try { this.VAR = JSON.parse(localStorage.getItem(this.PREFIX + 'suffix') || '[]'); } catch { this.VAR = []; }
    const p4 = /try\s*\{\s*(this\.\w+)\s*=\s*JSON\.parse\(localStorage\.getItem\((this\.\w+\s*\+\s*['"`][^'"]+['"`])\)\s*\|\|\s*(['"`])(\[\]|\{\})\3\);\s*\}\s*catch\s*(?:\([\w_]*\)\s*)?\{\s*\1\s*=\s*(\[\]|\{\});\s*\}/g;
    content = content.replace(p4, (match, varRef, keyExpr, _q, fallbackStr) => {
        fileFixed++;
        const fallback = fallbackStr === '[]' ? '[]' : '{}';
        return `${varRef} = StorageUtils.getJSON(${keyExpr}, ${fallback}, { service: '${serviceName}' });`;
    });

    // Pattern 5: Multiline return pattern
    // try { return JSON.parse(localStorage.getItem('KEY') || '[]'); } catch { return []; }
    // Also handles catch (e) { return []; }
    const p5 = /try\s*\{\s*\n?\s*return\s+JSON\.parse\(localStorage\.getItem\((['"`])([\w_]+)\1\)\s*\|\|\s*(['"`])(\[\]|\{\})\3\);\s*\n?\s*\}\s*catch\s*(?:\([\w_]*\)\s*)?\{\s*\n?\s*return\s+(\[\]|\{\});\s*\n?\s*\}/g;
    content = content.replace(p5, (match, _q1, key, _q2, fallbackStr) => {
        fileFixed++;
        const fallback = fallbackStr === '[]' ? '[]' : '{}';
        const opts = isFinancialKey(key)
            ? `{ financial: true, service: '${serviceName}' }`
            : `{ service: '${serviceName}' }`;
        return `return StorageUtils.getJSON('${key}', ${fallback}, ${opts});`;
    });

    if (content !== original) {
        totalFiles++;
        totalFixed += fileFixed;
        report.push(`  ${filePath}: ${fileFixed} replacements`);
        if (!DRY_RUN) {
            writeFileSync(filePath, content, 'utf8');
        }
    }
}

// Process all files
for (const dir of dirs) {
    const fullDir = join(ROOT, dir);
    let files;
    try {
        files = readdirSync(fullDir).filter(f => f.endsWith('.js'));
    } catch { continue; }
    for (const file of files) {
        processFile(join(fullDir, file));
    }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Morpheus Storage Fix Report`);
console.log(`${'='.repeat(50)}`);
console.log(`Files modified: ${totalFiles}`);
console.log(`Patterns replaced: ${totalFixed}`);
console.log(`\nDetails:`);
report.forEach(r => console.log(r));

if (DRY_RUN) {
    console.log('\nRun without --dry-run to apply changes.');
}
