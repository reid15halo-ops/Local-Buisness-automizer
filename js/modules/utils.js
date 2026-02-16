/* ============================================
   Utility Module
   Shared formatting, helpers, and common functions
   ============================================ */

// Core Service Shims
const store = window.storeService.state;
const saveStore = () => window.storeService.save();
const addActivity = (icon, title) => window.storeService.addActivity(icon, title);
const generateId = (prefix) => window.storeService.generateId(prefix);

// Convenience shortcuts to window.UI functions
const formatCurrency = window.UI.formatCurrency.bind(window.UI);
const formatDate = window.UI.formatDate.bind(window.UI);
const formatDateTime = window.UI.formatDateTime.bind(window.UI);
const getRelativeTime = window.UI.getRelativeTime.bind(window.UI);
const getLeistungsartLabel = window.UI.getLeistungsartLabel.bind(window.UI);
const openModal = window.UI.openModal.bind(window.UI);
const closeModal = window.UI.closeModal.bind(window.UI);
const h = window.UI.sanitize.bind(window.UI);
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
