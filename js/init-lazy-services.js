/* ============================================
   Lazy Services Initialization
   Preloads essential service groups after app init
   ============================================ */

(async function initLazyServices() {
    // Wait for DOM and core services to be ready
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }

    // Ensure lazyLoader is available
    if (!window.lazyLoader) {
        console.error('LazyLoader not initialized!');
        return;
    }

    console.log('🚀 Initializing lazy-loaded services...');

    // Load workflow services immediately (needed for dashboard)
    try {
        await window.lazyLoader.loadGroup('workflow');
        console.log('✅ Workflow services loaded');
    } catch (error) {
        console.error('Failed to load workflow services:', error);
    }

    // Preload commonly used groups in background (idle time)
    setTimeout(() => {
        window.lazyLoader.preload('crm');
        window.lazyLoader.preload('documents');
        window.lazyLoader.preload('calendar');
    }, 2000);

    // Log loading stats
    setTimeout(() => {
        const stats = window.lazyLoader.getStats();
        console.log('📊 Lazy Loading Stats:', stats);
    }, 5000);
})();
