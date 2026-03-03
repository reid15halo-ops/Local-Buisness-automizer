/* ============================================
   Utility Module
   Shared formatting, helpers, and common functions
   ============================================ */
(function() {

// Lazy Core Service Shims (evaluated on access, not at parse time)
const store = new Proxy({}, {
    get(_, prop) { return window.storeService?.state?.[prop]; },
    set(_, prop, val) { if (window.storeService?.state) {window.storeService.state[prop] = val;} return true; }
});
const saveStore = () => window.storeService?.save();
const addActivity = (icon, title) => window.storeService?.addActivity(icon, title);
const generateId = (prefix) => window.storeService?.generateId(prefix);

// Lazy convenience shortcuts to window.UI functions (safe if UI not loaded yet)
const formatCurrency = (...args) => window.UI?.formatCurrency?.(...args) ?? '0,00 €';
const formatDate = (...args) => window.UI?.formatDate?.(...args) ?? '';
const formatDateTime = (...args) => window.UI?.formatDateTime?.(...args) ?? '';
const getRelativeTime = (...args) => window.UI?.getRelativeTime?.(...args) ?? '';
const getLeistungsartLabel = (...args) => window.UI?.getLeistungsartLabel?.(...args) ?? '';
const openModal = (...args) => window.UI?.openModal?.(...args);
const closeModal = (...args) => window.UI?.closeModal?.(...args);
const h = (...args) => window.UI?.sanitize?.(...args) ?? String(args[0] ?? '');
const switchView = window.switchView || ((viewId) => {
    const element = document.querySelector(`[data-view="${viewId}"]`);
    if (element) {element.click();}
});

// Delay utility
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('Toast container not found');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Export utilities
window.AppUtils = {
    store,
    saveStore,
    addActivity,
    generateId,
    formatCurrency,
    formatDate,
    formatDateTime,
    getRelativeTime,
    getLeistungsartLabel,
    openModal,
    closeModal,
    h,
    switchView,
    delay,
    showToast
};

})();
