/* ============================================
   Service Worker for FreyAI Visions PWA
   Offline capability and background sync
   ============================================ */

const CACHE_NAME = 'freyai-visions-v16';
const OFFLINE_URL = 'offline.html';

// API URL patterns that should use network-first strategy
const API_PATTERNS = [
    /\/api\//,
    /supabase\.co/,
    /googleapis\.com\/(?!css)/,
    /stripe\.com/,
    /\/auth\//
];

// Files to cache for offline use
const STATIC_ASSETS = [
    // --- Core HTML ---
    '/',
    '/index.html',
    '/auth.html',
    '/landing.html',
    '/offline.html',
    '/booking.html',
    '/portal.html',
    
    

    // --- CSS files ---
    '/css/core.css',
    '/css/components.css',
    '/css/fonts.css',
    '/css/purchase-orders.css',
    '/css/reorder-engine.css',
    '/css/admin-panel.css',
    '/css/agent-workflows.css',
    '/css/boomer-guide.css',
    '/css/field-app.css',

    // --- Core JS ---
    '/js/app.js',
    '/js/app-new.js',
    '/js/features-integration.js',
    '/js/new-features-ui.js',
    '/js/excel-import-integration.js',
    '/js/init-lazy-services.js',

    // --- JS Modules ---
    '/js/modules/activity.js',
    '/js/modules/anfragen.js',
    '/js/modules/angebote.js',
    '/js/modules/auftraege.js',
    '/js/modules/dashboard.js',
    '/js/modules/error-boundary.js',
    '/js/modules/event-handlers.js',
    '/js/modules/invoice-payment-integration.js',
    '/js/modules/material-picker.js',
    '/js/modules/modals.js',
    '/js/modules/quick-actions.js',
    '/js/modules/rechnungen.js',
    '/js/modules/wareneingang.js',
    '/js/modules/utils.js',

    // --- JS Services ---
    '/js/services/activity-indicator-service.js',
    '/js/services/admin-panel-service.js',
    '/js/services/agent-workflow-service.js',
    '/js/services/ai-assistant-service.js',
    '/js/services/approval-service.js',
    '/js/services/aufmass-service.js',
    '/js/services/auth-service.js',
    '/js/services/automation-api.js',
    '/js/services/banking-service.js',
    '/js/services/barcode-service.js',
    '/js/services/booking-service.js',
    '/js/services/bookkeeping-service.js',
    '/js/services/calendar-service.js',
    '/js/services/calendar-ui-service.js',
    '/js/services/cashflow-service.js',
    '/js/services/chatbot-service.js',
    '/js/services/communication-hub-controller.js',
    '/js/services/communication-service.js',
    '/js/services/confirm-dialog-service.js',
    '/js/services/contract-service.js',
    '/js/services/customer-service.js',
    '/js/services/dashboard-charts-service.js',
    '/js/services/data-export-service.js',
    '/js/services/datev-export-service.js',
    '/js/services/db-service.js',
    '/js/services/demo-data-service.js',
    '/js/services/demo-guard-service.js',
    '/js/services/document-service.js',
    '/js/services/dunning-service.js',
    '/js/services/einvoice-service.js',
    '/js/services/email-automation-service.js',
    '/js/services/email-service.js',
    '/js/services/email-template-service.js',
    '/js/services/error-display-service.js',
    '/js/services/field-app-service.js',
    '/js/services/form-validation-service.js',
    '/js/services/error-handler.js',
    '/js/services/error-handler-utils.js',
    '/js/services/excel-recognition-service.js',
    '/js/services/gemini-service.js',
    '/js/services/i18n-service.js',
    '/js/services/invoice-numbering-service.js',
    '/js/services/invoice-service.js',
    '/js/services/invoice-template-service.js',
    '/js/services/lazy-loader.js',
    '/js/services/lead-service.js',
    '/js/services/llm-service.js',
    '/js/services/bon-scanner-service.js',
    '/js/services/material-service.js',
    '/js/services/notification-service.js',
    '/js/services/ocr-scanner-service.js',
    '/js/services/onboarding-tutorial-service.js',
    '/js/services/payment-service.js',
    '/js/services/pdf-generation-service.js',
    '/js/services/pdf-service.js',
    '/js/services/phone-service.js',
    '/js/services/photo-service.js',
    '/js/services/print-digital-service.js',
    '/js/services/profitability-service.js',
    '/js/services/purchase-order-service.js',
    '/js/services/push-messenger-service.js',
    '/js/services/pwa-install-service.js',
    '/js/services/qrcode-service.js',
    '/js/services/recurring-task-service.js',
    '/js/services/reorder-engine-service.js',
    '/js/services/report-service.js',
    '/js/services/route-service.js',
    '/js/services/sanitize-service.js',
    '/js/services/search-service.js',
    '/js/services/security-backup-service.js',
    '/js/services/security-service.js',
    '/js/services/setup-wizard-service.js',
    '/js/services/sms-reminder-service.js',
    '/js/services/store-service.js',
    '/js/services/stripe-service.js',
    '/js/services/supabase-config.js',
    '/js/services/supabase-db-service.js',
    '/js/services/sync-service.js',
    '/js/services/task-service.js',
    '/js/services/theme-manager.js',
    '/js/services/theme-service.js',
    '/js/services/timetracking-service.js',
    '/js/services/trash-service.js',
    '/js/services/unified-comm-service.js',
    '/js/services/user-manager-service.js',
    '/js/services/user-mode-service.js',
    '/js/services/version-control-service.js',
    '/js/services/voice-command-service.js',
    '/js/services/warranty-service.js',
    '/js/services/webhook-service.js',
    '/js/services/work-estimation-service.js',
    '/js/services/workflow-builder-service.js',
    '/js/services/workflow-service.js',
    '/js/services/portal-service.js',
    '/js/services/offline-sync-service.js',

    // --- JS UI Components ---
    '/js/ui/admin-panel-ui.js',
    '/js/ui/admin-settings-ui.js',
    '/js/ui/agent-workflow-ui.js',
    '/js/ui/aufmass-ui.js',
    '/js/ui/boomer-guide-ui.js',
    '/js/ui/excel-import-wizard.js',
    '/js/ui/field-app-ui.js',
    '/js/ui/gantt-timeline-ui.js',
    '/js/ui/keyboard-shortcuts.js',
    '/js/ui/ki-transparency-ui.js',
    '/js/ui/mode-toggle-ui.js',
    '/js/ui/navigation.js',
    '/js/ui/purchase-order-ui.js',
    '/js/ui/reorder-engine-ui.js',
    '/js/ui/setup-wizard-ui.js',
    '/js/ui/ui-helpers.js',
    '/js/ui/work-estimation-ui.js',
    '/js/ui/workflow-builder-ui.js',

    // --- i18n (Internationalization) ---
    '/js/i18n/de.js',
    '/js/i18n/en.js',
    '/js/i18n/i18n-ui.js',

    // --- PWA Manifest & Icons ---
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// External CDN resources to cache
const CDN_ASSETS = [
    'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                // Cache static assets (some may fail, that's ok)
                return Promise.allSettled(
                    STATIC_ASSETS.map(url =>
                        cache.add(url).catch(err => console.log(`[SW] Failed to cache: ${url}`))
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Check if a URL matches an API pattern (network-first)
function isApiRequest(url) {
    return API_PATTERNS.some(pattern => pattern.test(url.href));
}

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip chrome-extension and other non-http requests
    if (!url.protocol.startsWith('http')) return;

    // Network-first strategy for API calls
    if (isApiRequest(url)) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Cache-first (stale-while-revalidate) for static assets
    event.respondWith(cacheFirst(request));
});

// Cache-first strategy: return cached version immediately, update in background
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        // Return cached version, but update cache in background
        updateCache(request);
        return cachedResponse;
    }

    // Not in cache, fetch from network
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (e) {
        // Network failed, return offline page for navigation requests
        if (request.mode === 'navigate') {
            const offlinePage = await caches.match(OFFLINE_URL);
            return offlinePage || caches.match('/index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

// Network-first strategy: try network, fall back to cache
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (e) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        // No cache and no network for navigation - show offline page
        if (request.mode === 'navigate') {
            const offlinePage = await caches.match(OFFLINE_URL);
            return offlinePage || caches.match('/index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

// Update cache in background (stale-while-revalidate)
async function updateCache(request) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await fetch(request);
        if (response.ok) {
            await cache.put(request, response);
        }
    } catch (e) {
        // Network request failed, that's fine
    }
}

// Background Sync for offline data
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-data') {
        event.waitUntil(syncOfflineData());
    }

    if (event.tag === 'sync-invoices') {
        event.waitUntil(syncInvoices());
    }

    if (event.tag === 'sync-time-entries') {
        event.waitUntil(syncTimeEntries());
    }
});

// Sync offline data when back online
async function syncOfflineData() {
    console.log('[SW] Syncing offline data...');

    // Notify clients to trigger their OfflineSyncService.processQueue()
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'PROCESS_OFFLINE_QUEUE',
            timestamp: new Date().toISOString()
        });
        client.postMessage({
            type: 'SYNC_COMPLETE',
            timestamp: new Date().toISOString()
        });
    });
}

async function syncInvoices() {
    console.log('[SW] Syncing invoices...');
    // Sync invoices with cloud/DATEV
}

async function syncTimeEntries() {
    console.log('[SW] Syncing time entries...');
    // Sync time tracking data
}

// Push notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

    let data = { title: 'FreyAI Visions', body: 'Neue Benachrichtigung' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%236366f1" width="100" height="100" rx="20"/><text x="50" y="62" font-size="45" text-anchor="middle" fill="white">⚙️</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle fill="%23ef4444" cx="50" cy="50" r="50"/></svg>',
        vibrate: [100, 50, 100],
        data: data.data || {},
        actions: data.actions || [
            { action: 'open', title: 'Öffnen' },
            { action: 'dismiss', title: 'Ignorieren' }
        ],
        tag: data.tag || 'freyai-notification',
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'dismiss') return;

    // Open or focus the app
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes('/index.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open new window
                if (self.clients.openWindow) {
                    return self.clients.openWindow('/index.html');
                }
            })
    );
});

// Message handler for client communication
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }

    if (event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({ success: true });
        });
    }
});

console.log('[SW] Service Worker loaded');
