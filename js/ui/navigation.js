/* ============================================
   Navigation Handler
   Manages view switching and sidebar state
   ============================================ */

class NavigationController {
    constructor() {
        this.currentView = 'quick-actions';
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

    async navigateTo(viewId, pushState = true) {
        if (!document.getElementById(`view-${viewId}`)) {
            console.error(`View not found: ${viewId}`);
            return;
        }

        // Lazy load services for this view
        if (window.lazyLoader) {
            try {
                await window.lazyLoader.loadForView(viewId);
            } catch (error) {
                console.error('Failed to load services for view:', error);
            }
        }

        // Update active class on view
        this.views.forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');

        // Update active class on nav item
        this.navItems.forEach(n => n.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (activeNav) {activeNav.classList.add('active');}

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

        // Refresh boomer guide nav visuals on every view change
        if (window.boomerGuideUI) {
            window.boomerGuideUI._applyNavVisuals();
        }

        // Call global render functions (legacy support until fully refactored)
        // Ideally these should listen to the 'viewchange' event instead
        switch (viewId) {
            case 'quick-actions':
                if (window.boomerGuideUI) {
                    window.boomerGuideUI._renderHomeFeed();
                } else if (window.QuickActionsModule?.init) {
                    window.QuickActionsModule.init();
                }
                break;
            case 'dashboard':
                if (window.updateDashboard) {window.updateDashboard();}
                break;
            case 'anfragen':
                if (window.renderAnfragen) {window.renderAnfragen();}
                break;
            case 'angebote':
                if (window.renderAngebote) {window.renderAngebote();}
                break;
            case 'auftraege':
                if (window.renderAuftraege) {window.renderAuftraege();}
                break;
            case 'rechnungen':
                if (window.renderRechnungen) {window.renderRechnungen();}
                break;
            case 'admin-panel':
                if (window.adminPanelUI) {window.adminPanelUI.init();}
                break;
            // New features (Self-initializing via their own listeners, but good to ensure)
            case 'workflows':
            case 'scanner':
            case 'backup':
                // Handled by new-features-ui.js
                break;

            // Handwerker Operations
            case 'bautagebuch':
                if (window.bautagebuchUI) { window.bautagebuchUI.init(); }
                break;
            case 'routenplanung':
                if (window.routePlanningUI) { window.routePlanningUI.mount('route-planning-container'); }
                break;
            case 'team':
                if (window.teamUI) { window.teamUI.render('team-container'); }
                break;
            case 'kalkulation':
                if (window.tradeCalculatorUI) { window.tradeCalculatorUI.render('#trade-calculator-container'); }
                break;
            case 'marketing':
                if (window.marketingUI) { window.marketingUI.render('marketing-container'); }
                break;
            case 'ausbildung':
                if (window.apprenticeUI) { window.apprenticeUI.mount('apprentice-container'); }
                break;
            case 'gewaehrleistung':
                if (window.warrantyMaintenanceUI) { window.warrantyMaintenanceUI.init('warranty-maintenance-container'); }
                break;
            case 'lieferanten':
                this.renderSupplierView();
                break;
        }
    }
    renderSupplierView() {
        const sc = document.getElementById('supplier-container');
        if (!sc || sc.dataset.initialized === 'true') return;
        sc.dataset.initialized = 'true';

        const svc = window.supplierService;
        if (!svc) {
            sc.innerHTML = '<p style="padding:20px;color:var(--text-muted);">Lieferanten-Service wird geladen...</p>';
            return;
        }

        const suppliers = svc.getSuppliers();
        const products = svc.getAllProductNames();

        let html = '<div style="max-width:1000px;margin:0 auto;padding:16px;">';

        // Summary cards
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px;">';
        html += `<div class="stat-card-mini"><span class="stat-icon-mini">🏭</span><div class="stat-content-mini"><span class="stat-value-mini">${suppliers.length}</span><span class="stat-label-mini">Lieferanten</span></div></div>`;
        html += `<div class="stat-card-mini"><span class="stat-icon-mini">📦</span><div class="stat-content-mini"><span class="stat-value-mini">${products.length}</span><span class="stat-label-mini">Produkte</span></div></div>`;
        html += `<div class="stat-card-mini"><span class="stat-icon-mini">⭐</span><div class="stat-content-mini"><span class="stat-value-mini">${svc.getCategories().length}</span><span class="stat-label-mini">Kategorien</span></div></div>`;
        html += '</div>';

        // Supplier list
        html += '<div class="panel"><h3>Lieferanten</h3>';
        if (suppliers.length === 0) {
            html += '<p class="empty-state">Keine Lieferanten vorhanden. Nutzen Sie den Service, um Lieferanten hinzuzufügen.</p>';
        } else {
            html += '<div class="table-container"><table class="data-table"><thead><tr><th>Name</th><th>Kategorie</th><th>Bewertung</th><th>Status</th></tr></thead><tbody>';
            suppliers.forEach(s => {
                html += `<tr><td>${s.name || '-'}</td><td>${s.category || '-'}</td><td>${s.rating ? s.rating + '/5' : '-'}</td><td>${s.active !== false ? 'Aktiv' : 'Inaktiv'}</td></tr>`;
            });
            html += '</tbody></table></div>';
        }
        html += '</div>';

        // Product comparison
        if (products.length > 0) {
            html += '<div class="panel"><h3>Preisvergleich</h3>';
            html += '<p style="color:var(--text-muted);font-size:13px;">Vergleichen Sie Preise verschiedener Lieferanten pro Produkt.</p>';
            const topProducts = products.slice(0, 10);
            topProducts.forEach(name => {
                const comparison = svc.compareProduct(name);
                if (comparison && comparison.length > 0) {
                    html += `<details style="margin-bottom:8px;"><summary style="cursor:pointer;font-weight:600;">${name} (${comparison.length} Angebote)</summary>`;
                    html += '<ul style="margin:8px 0 0 16px;">';
                    comparison.forEach(c => {
                        html += `<li>${c.supplierName || 'Unbekannt'}: ${(c.price || 0).toFixed(2)} EUR</li>`;
                    });
                    html += '</ul></details>';
                }
            });
            html += '</div>';
        }

        html += '</div>';
        sc.innerHTML = html;
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.navigationController = new NavigationController();
});
