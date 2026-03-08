/* ============================================
   Service Worker for FreyAI Visions PWA
   Offline capability and background sync
   ============================================ */

const CACHE_NAME = 'freyai-visions-v34';
const OFFLINE_URL = 'offline.html';

// API URL patterns that should use network-first strategy
const API_PATTERNS = [
    /\/api\//,
    /supabase\.co/,
    /googleapis\.com\/(?!css)/,
    /stripe\.com/,
    /\/auth\//
];

// Files to pre-cache for the app shell.
// Lazy-loaded services are cached on-demand by the fetch handler, not pre-cached here.
const STATIC_ASSETS = [
    // --- Core HTML ---
    '/',
    '/index.html',
    '/auth.html',
    '/landing.html',
    '/js/landing.js',
    '/js/vendor/purify.min.js',
    '/js/landing-i18n/landing-i18n.js',
    '/js/landing-i18n/de.json',
    '/impressum.html',
    '/datenschutz.html',
    '/agb.html',
    '/offline.html',
    '/booking.html',
    '/customer-portal.html',
    '/fragebogen-beta-v1.html',

    // --- Config ---
    '/config/app-config.js',

    // --- CSS files (small, pre-cache all) ---
    '/css/core.css',
    '/css/landing.css',
    '/css/legal.css',
    '/css/components.css',
    '/css/fonts.css',
    '/css/purchase-orders.css',
    '/css/reorder-engine.css',
    '/css/admin-panel.css',
    '/css/agent-workflows.css',
    '/css/boomer-guide.css',
    '/css/field-app.css',
    '/css/field-app-mobile.css',
    '/css/field-mode.css',
    '/css/responsive.css',
    '/css/aufmass.css',
    '/css/customer-portal.css',
    '/css/dashboard-widgets.css',
    '/css/conflict-resolution.css',
    '/css/support.css',
    '/css/kanban.css',
    '/css/communication.css',
    '/css/timeline.css',

    // --- Core JS (app shell entry points) ---
    '/js/app-new.js',
    '/js/features-integration.js',
    '/js/new-features-ui.js',
    '/js/excel-import-integration.js',
    '/js/init-lazy-services.js',

    // --- Core JS Modules (app shell UI) ---
    '/js/modules/dashboard.js',
    '/js/modules/error-boundary.js',
    '/js/modules/event-handlers.js',
    '/js/modules/modals.js',
    '/js/modules/utils.js',

    // --- Core Services (required for app shell) ---
    '/js/services/store-service.js',
    '/js/services/lazy-loader.js',
    '/js/services/error-handler.js',
    '/js/services/error-handler-utils.js',
    '/js/services/error-display-service.js',
    '/js/services/supabase-config.js',
    '/js/services/supabase-db-service.js',
    '/js/services/supabase-client.js',
    '/js/services/auth-service.js',
    '/js/services/db-service.js',
    '/js/services/sanitize-service.js',
    '/js/services/confirm-dialog-service.js',
    '/js/services/user-mode-service.js',
    '/js/services/notification-service.js',
    '/js/services/activity-indicator-service.js',
    '/js/services/sync-service.js',
    '/js/services/demo-data-service.js',
    '/js/services/demo-guard-service.js',
    '/js/services/search-service.js',
    '/js/services/form-validation-service.js',

    // --- Core UI (navigation & shell) ---
    '/js/ui/navigation.js',
    '/js/ui/ui-helpers.js',
    '/js/ui/mode-toggle-ui.js',
    '/js/ui/keyboard-shortcuts.js',

    // --- i18n (Internationalization) ---
    '/js/i18n/de.js',
    '/js/i18n/en.js',
    '/js/i18n/i18n-ui.js',

    // --- PWA Manifest & Icons ---
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/favicon.ico',
    '/favicon-32x32.png',
    '/apple-touch-icon.png'
];

// External CDN resources to cache
const CDN_ASSETS = [
    'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.8/purify.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
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
                    [...STATIC_ASSETS, ...CDN_ASSETS].map(url =>
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
            return (await caches.match(OFFLINE_URL))
                || (await caches.match('/index.html'))
                || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

// Network-first strategy: try network, fall back to cache
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            // Never cache auth-related responses (tokens, sessions)
            const url = new URL(request.url);
            const isAuthRequest = /\/auth\//.test(url.pathname) || /token/.test(url.pathname);
            if (!isAuthRequest) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, networkResponse.clone());
            }
        }
        return networkResponse;
    } catch (e) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        // No cache and no network for navigation - show offline page
        if (request.mode === 'navigate') {
            return (await caches.match(OFFLINE_URL))
                || (await caches.match('/index.html'))
                || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
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
    });
}

async function syncInvoices() {
    console.log('[SW] Syncing invoices...');
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_INVOICES', timestamp: new Date().toISOString() });
    });
}

async function syncTimeEntries() {
    console.log('[SW] Syncing time entries...');
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_TIME_ENTRIES', timestamp: new Date().toISOString() });
    });
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
    if (!event.data) {return;}
    console.log('[SW] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }

    if (event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ success: true });
            }
        });
    }
});

console.log('[SW] Service Worker loaded');
