#!/usr/bin/env node
/**
 * FreyAI App Build Script
 *
 * Concatenates and minifies JS files into two bundles:
 *   app-sync.min.js  — Critical path (supabase config)
 *   app-bundle.min.js — All deferred services + modules
 *
 * Usage: node scripts/build.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { transformSync } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Sync scripts (critical path, loaded before DOM parse)
const syncScripts = [
    'js/services/supabase-config.js',
    'js/services/supabase-client.js',
];

// Deferred scripts (in load order from original index.html)
const deferScripts = [
    'config/init-tokens.js',
    'config/app-config.js',
    // Core Infrastructure
    'js/services/error-handler.js',
    'js/services/storage-utils.js',
    'js/i18n/de.js',
    'js/i18n/en.js',
    'js/services/i18n-service.js',
    'js/i18n/i18n-ui.js',
    'js/services/error-handler-utils.js',
    'js/services/error-display-service.js',
    'js/modules/error-boundary.js',
    'js/services/sanitize-service.js',
    'js/services/security-service.js',
    'js/services/db-service.js',
    'js/services/demo-guard-service.js',
    'js/services/demo-data-service.js',
    'js/services/supabase-db-service.js',
    'js/services/sync-service.js',
    'js/services/auth-service.js',
    'js/services/store-service.js',
    'js/services/confirm-dialog-service.js',
    'js/services/trash-service.js',
    'js/services/user-mode-service.js',
    'js/ui/mode-toggle-ui.js',
    'js/services/form-validation-service.js',
    'js/services/excel-recognition-service.js',
    'js/ui/ui-helpers.js',
    'js/ui/excel-import-wizard.js',
    'js/services/company-settings-service.js',
    'js/services/document-template-service.js',
    'js/services/setup-wizard-service.js',
    'js/ui/setup-wizard-ui.js',
    'js/ui/admin-settings-ui.js',
    'js/services/admin-panel-service.js',
    'js/ui/admin-panel-ui.js',
    'js/services/onboarding-tutorial-service.js',
    'js/services/lazy-loader.js',
    // Navigation + UI
    'js/ui/navigation.js',
    'js/ui/keyboard-shortcuts.js',
    'js/services/search-service.js',
    'js/services/theme-manager.js',
    'js/services/activity-indicator-service.js',
    'js/services/dashboard-charts-service.js',
    'js/services/notification-service.js',
    'js/services/push-messenger-service.js',
    'js/services/boomer-guide-service.js',
    'js/ui/boomer-guide-ui.js',
    'js/services/data-export-service.js',
    'js/services/email-template-service.js',
    'js/services/pwa-install-service.js',
    'js/services/call-summary-service.js',
    'js/services/portal-service.js',
    'js/services/offline-sync-service.js',
    // Calendar & Scheduling
    'js/services/calendar-service.js',
    'js/services/booking-service.js',
    'js/services/calendar-ui-service.js',
    // App Integration
    'js/services/automation-api.js',
    'js/services/epc-qr-service.js',
    'js/services/pdf-service.js',
    'js/services/webhook-event-service.js',
    'js/services/purchase-order-service.js',
    'js/services/reorder-engine-service.js',
    'js/ui/purchase-order-ui.js',
    'js/ui/reorder-engine-ui.js',
    'js/ui/work-estimation-ui.js',
    'js/ui/ki-transparency-ui.js',
    'js/ui/gantt-timeline-ui.js',
    'js/ui/pipeline-kanban-ui.js',
    'js/features-integration.js',
    'js/new-features-ui.js',
    'js/excel-import-integration.js',
    'js/services/voice-input-service.js',
    'js/ui/field-mode-ui.js',
    'js/services/recurring-invoice-service.js',
    // Phase 6-14
    'js/services/gobd-compliance-service.js',
    'js/services/bautagebuch-service.js',
    'js/services/morning-briefing-service.js',
    // Modules
    'js/modules/utils.js',
    'js/modules/modals.js',
    'js/modules/activity.js',
    'js/modules/dashboard.js',
    'js/modules/quick-actions.js',
    'js/ui/sidebar-navigation.js',
    'js/services/finom-service.js',
    'js/modules/anfragen.js',
    'js/modules/material-picker.js',
    'js/modules/angebote.js',
    'js/modules/auftraege.js',
    'js/modules/rechnungen.js',
    'js/services/bon-scanner-service.js',
    'js/modules/wareneingang.js',
    'js/modules/support.js',
    'js/app-new.js',
    'js/modules/event-handlers.js',
    'js/init-lazy-services.js',
];

function concatenateFiles(paths) {
    const parts = [];
    for (const p of paths) {
        const fullPath = join(ROOT, p);
        if (!existsSync(fullPath)) {
            console.warn(`  WARN: ${p} not found`);
            continue;
        }
        parts.push(`/* === ${p} === */\n${readFileSync(fullPath, 'utf8')}\n`);
    }
    return parts.join('\n');
}

function minify(code, name) {
    const isCSS = name.endsWith('.css');
    try {
        const result = transformSync(code, {
            minify: true,
            target: 'es2020',
            keepNames: !isCSS,
            loader: isCSS ? 'css' : 'js',
        });
        const pct = code.length > 0 ? ((1 - result.code.length / code.length) * 100).toFixed(1) : '0.0';
        console.log(`  ${name}: ${(code.length / 1024).toFixed(0)}KB → ${(result.code.length / 1024).toFixed(0)}KB (-${pct}%)`);
        return result.code;
    } catch (e) {
        console.error(`  ERROR minifying ${name}: ${e.message}`);
        process.exit(1);
    }
}

// CSS files (in load order from index.html)
const cssFiles = [
    'css/core.css',
    'css/components.css',
    'css/purchase-orders.css',
    'css/reorder-engine.css',
    'css/admin-panel.css',
    'css/boomer-guide.css',
    'css/agent-workflows.css',
    'css/support.css',
    'css/field-app.css',
    'css/aufmass.css',
    'css/customer-portal.css',
    'css/field-app-mobile.css',
    'css/field-mode.css',
    'css/dashboard-widgets.css',
    'css/timeline.css',
    'css/kanban.css',
    'css/conflict-resolution.css',
    'css/communication.css',
    'css/fonts.css',
    'css/responsive.css',
];

// Validate all manifest files exist before building
let missing = 0;
for (const list of [syncScripts, deferScripts, cssFiles]) {
    for (const p of list) {
        if (!existsSync(join(ROOT, p))) {
            console.error(`  MISSING: ${p}`);
            missing++;
        }
    }
}
if (missing > 0) {
    console.error(`\nBuild ABORTED: ${missing} file(s) missing from manifest.`);
    process.exit(1);
}

const distJs = join(ROOT, 'dist', 'js');
const distCss = join(ROOT, 'dist', 'css');
mkdirSync(distJs, { recursive: true });
mkdirSync(distCss, { recursive: true });

console.log(`Building: ${syncScripts.length} sync + ${deferScripts.length} deferred JS, ${cssFiles.length} CSS`);

const syncMin = minify(concatenateFiles(syncScripts), 'app-sync.min.js');
const deferMin = minify(concatenateFiles(deferScripts), 'app-bundle.min.js');
const cssMin = minify(concatenateFiles(cssFiles), 'app.min.css');

// Verify bundles are non-empty
if (syncMin.length < 100) {
    console.error('Build ABORTED: app-sync.min.js suspiciously small');
    process.exit(1);
}
if (deferMin.length < 1000) {
    console.error('Build ABORTED: app-bundle.min.js suspiciously small');
    process.exit(1);
}
if (cssMin.length < 500) {
    console.error('Build ABORTED: app.min.css suspiciously small');
    process.exit(1);
}

writeFileSync(join(distJs, 'app-sync.min.js'), syncMin);
writeFileSync(join(distJs, 'app-bundle.min.js'), deferMin);
writeFileSync(join(distCss, 'app.min.css'), cssMin);

console.log('Build complete → dist/');
