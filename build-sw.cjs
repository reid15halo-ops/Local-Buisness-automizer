#!/usr/bin/env node
/**
 * build-sw.cjs — Generate cache-busting version for service-worker.js
 *
 * Replaces the CACHE_NAME version string with a git-commit-based hash
 * so browsers pick up new service worker versions on deploy.
 *
 * Called by: deploy/scripts/deploy.sh (Step 0)
 * Idempotent: Yes
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const SW_FILE = path.join(__dirname, 'service-worker.js');

// Get short git commit hash, fallback to timestamp
let version;
try {
    const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    version = `freyai-visions-${hash}`;
} catch {
    // No git available (CI, Docker, etc.) — use timestamp
    const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    version = `freyai-visions-${ts}`;
}

// Read service worker
let content = fs.readFileSync(SW_FILE, 'utf-8');

// Replace CACHE_NAME value
const oldPattern = /const CACHE_NAME = '[^']+';/;
const newLine = `const CACHE_NAME = '${version}';`;

if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newLine);
    fs.writeFileSync(SW_FILE, content, 'utf-8');
    console.log(`Service worker cache version: ${version}`);
} else {
    console.warn('Warning: CACHE_NAME pattern not found in service-worker.js');
    process.exit(0);
}
