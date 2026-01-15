/* ============================================
   Navigation Handler
   Manages view switching and sidebar state
   ============================================ */

class NavigationController {
    constructor() {
        this.currentView = 'dashboard';
        this.views = document.querySelectorAll('.view');
        this.navItems = document.querySelectorAll('.nav-item');

        this.init();
        this.initMobileNav();
    }

    init() {
        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                const viewId = item.dataset.view;
                this.navigateTo(viewId);
            });
        });

        // Handle browser history (optional improvement)
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.view) {
                this.navigateTo(e.state.view, false);
            }
        });

        // Handle clickable dashboard cards
        document.querySelectorAll('[data-navigate]').forEach(el => {
            el.addEventListener('click', () => {
                this.navigateTo(el.dataset.navigate);
            });
        });
    }

    initMobileNav() {
        const toggle = document.getElementById('mobile-menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        if (toggle && sidebar) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (sidebar.classList.contains('active') &&
                    !sidebar.contains(e.target) &&
                    e.target !== toggle) {
                    sidebar.classList.remove('active');
                }
            });

            this.navItems.forEach(item => {
                item.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        sidebar.classList.remove('active');
                    }
                });
            });
        }
    }

    navigateTo(viewId, pushState = true) {
        if (!document.getElementById(`view-${viewId}`)) {
            console.error(`View not found: ${viewId}`);
            return;
        }

        // Update active class on view
        this.views.forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');

        // Update active class on nav item
        this.navItems.forEach(n => n.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Update current view reference
        this.currentView = viewId;

        // Push to history
        if (pushState) {
            history.pushState({ view: viewId }, '', `#${viewId}`);
        }

        // Trigger view-specific refreshes
        this.handleViewEnter(viewId);
    }

    handleViewEnter(viewId) {
        // Dispatch custom event for loose coupling
        const event = new CustomEvent('viewchange', { detail: { view: viewId } });
        document.dispatchEvent(event);

        // Call global render functions (legacy support until fully refactored)
        // Ideally these should listen to the 'viewchange' event instead
        switch (viewId) {
            case 'dashboard':
                if (window.updateDashboard) window.updateDashboard();
                break;
            case 'anfragen':
                if (window.renderAnfragen) window.renderAnfragen();
                break;
            case 'angebote':
                if (window.renderAngebote) window.renderAngebote();
                break;
            case 'auftraege':
                if (window.renderAuftraege) window.renderAuftraege();
                break;
            case 'rechnungen':
                if (window.renderRechnungen) window.renderRechnungen();
                break;
            // New features (Self-initializing via their own listeners, but good to ensure)
            case 'workflows':
            case 'scanner':
            case 'backup':
                // Handled by new-features-ui.js
                break;
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.navigationController = new NavigationController();
});
