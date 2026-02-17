/**
 * Mode Toggle UI - Handles visual updates for Simple/Pro mode
 *
 * Responsibilities:
 * - Show/hide sidebar items based on mode
 * - Animate transitions when items appear/disappear
 * - Update view-specific content based on mode
 * - Display mode toggle at bottom of sidebar
 * - Show tooltip on first Pro mode activation
 */

class ModeToggleUI {
    constructor() {
        this.userModeService = window.userModeService;
        this.toggleShown = false;
        this.firstProModeActivation = true;

        // Listen for mode changes
        document.addEventListener('freyai:mode-changed', (e) => {
            this.onModeChanged(e.detail);
        });

        console.log('[ModeToggleUI] Initialized');
    }

    /**
     * Initialize the mode toggle UI
     * Call this after the sidebar is fully loaded
     */
    init() {
        this.applyMode(this.userModeService.getCurrentMode());
        this.createModeToggle();
        console.log('[ModeToggleUI] Init complete');
    }

    /**
     * Apply mode visibility to UI
     * Shows/hides sidebar items based on current mode
     */
    applyMode(mode) {
        const rules = this.userModeService.getVisibilityRules();
        const visibleViews = rules[mode] || [];

        // Get all nav items
        const navItems = document.querySelectorAll('.nav-item');

        // Show/hide based on mode
        navItems.forEach((item) => {
            const viewName = item.getAttribute('data-view');

            if (!viewName) {
                // Items without data-view (like Help button) are always shown
                return;
            }

            const isVisible = visibleViews.includes(viewName);

            if (isVisible) {
                this.showNavItem(item);
            } else {
                this.hideNavItem(item);
            }
        });

        // Update dashboard content for Simple vs Pro mode
        this.updateDashboardContent(mode);

        // Update form complexity based on mode
        this.updateFormFields(mode);

        // Update list view columns
        this.updateListColumns(mode);
    }

    /**
     * Show a nav item with animation
     * @private
     */
    showNavItem(item) {
        item.style.display = '';
        item.style.animation = 'slideInLeft 0.3s ease forwards';
        item.classList.remove('mode-hidden');
    }

    /**
     * Hide a nav item with animation
     * @private
     */
    hideNavItem(item) {
        item.style.animation = 'slideOutLeft 0.2s ease forwards';
        setTimeout(() => {
            item.style.display = 'none';
            item.classList.add('mode-hidden');
        }, 200);
    }

    /**
     * Update dashboard content based on mode
     * Simple mode: simple stats (Einnahmen, offene Rechnungen, nächste Termine)
     * Pro mode: full KPI charts and detailed analytics
     * @private
     */
    updateDashboardContent(mode) {
        const statsContainer = document.querySelector('.dashboard-stats');
        if (!statsContainer) {
            return;
        }

        if (mode === 'simple') {
            // Hide advanced dashboard elements
            const advancedElements = document.querySelectorAll('.dashboard-stats [data-chart]');
            advancedElements.forEach(el => {
                el.style.display = 'none';
            });

            // Show only basic stats
            const basicStats = document.querySelectorAll('.stat-card');
            basicStats.forEach(stat => {
                stat.style.display = '';
            });
        } else {
            // Show all elements in Pro mode
            const allElements = document.querySelectorAll('.dashboard-stats *');
            allElements.forEach(el => {
                el.style.display = '';
            });
        }
    }

    /**
     * Update form fields based on mode
     * Simple mode: show only required fields
     * Pro mode: show all fields including advanced options
     * @private
     */
    updateFormFields(mode) {
        const forms = document.querySelectorAll('form');

        forms.forEach(form => {
            const optionalFields = form.querySelectorAll('[data-mode="pro-only"]');

            if (mode === 'simple') {
                optionalFields.forEach(field => {
                    field.style.display = 'none';
                });
            } else {
                optionalFields.forEach(field => {
                    field.style.display = '';
                });
            }
        });
    }

    /**
     * Update list view columns based on mode
     * Simple mode: hide advanced columns (materialId, margin%, etc)
     * Pro mode: show all columns
     * @private
     */
    updateListColumns(mode) {
        const tables = document.querySelectorAll('table');

        tables.forEach(table => {
            // Hide columns marked with data-mode="pro-only"
            const proOnlyHeaders = table.querySelectorAll('th[data-mode="pro-only"]');
            const proOnlyRows = table.querySelectorAll('td[data-mode="pro-only"]');

            if (mode === 'simple') {
                proOnlyHeaders.forEach(th => {
                    th.style.display = 'none';
                });
                proOnlyRows.forEach(td => {
                    td.style.display = 'none';
                });
            } else {
                proOnlyHeaders.forEach(th => {
                    th.style.display = '';
                });
                proOnlyRows.forEach(td => {
                    td.style.display = '';
                });
            }
        });
    }

    /**
     * Create and insert the mode toggle at the bottom of sidebar
     * @private
     */
    createModeToggle() {
        if (this.toggleShown) {
            return;
        }

        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (!sidebarFooter) {
            console.warn('[ModeToggleUI] sidebar-footer not found');
            return;
        }

        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'mode-toggle-btn';
        toggleBtn.className = 'mode-toggle-btn';
        toggleBtn.setAttribute('aria-label', 'Benutzermodus umschalten');

        // Update label based on current mode
        this.updateToggleLabel(toggleBtn);

        // Add click handler
        toggleBtn.addEventListener('click', () => {
            this.toggleMode();
        });

        // Insert at the end of sidebar-footer (before version number if present)
        const versionDiv = sidebarFooter.querySelector('[style*="font-size: 10px"]');
        if (versionDiv) {
            versionDiv.parentNode.insertBefore(toggleBtn, versionDiv);
        } else {
            sidebarFooter.appendChild(toggleBtn);
        }

        this.toggleShown = true;
        console.log('[ModeToggleUI] Mode toggle created');
    }

    /**
     * Update toggle button label based on current mode
     * @private
     */
    updateToggleLabel(btn) {
        const mode = this.userModeService.getCurrentMode();

        if (mode === 'simple') {
            btn.innerHTML = '🔓 Profi-Modus aktivieren';
        } else {
            btn.innerHTML = '🔒 Einfacher Modus';
        }
    }

    /**
     * Handle mode change event
     * @private
     */
    onModeChanged(detail) {
        console.log('[ModeToggleUI] Mode changed to:', detail.mode);

        // Apply new visibility
        this.applyMode(detail.mode);

        // Update toggle button label
        const toggleBtn = document.getElementById('mode-toggle-btn');
        if (toggleBtn) {
            this.updateToggleLabel(toggleBtn);
        }

        // Show tooltip on first Pro mode activation
        if (detail.isProMode && this.firstProModeActivation) {
            this.showProModeTooltip();
            this.firstProModeActivation = false;
        }

        // Refresh active view to reflect mode changes
        this.refreshCurrentView();
    }

    /**
     * Toggle between Simple and Pro mode
     * @private
     */
    toggleMode() {
        const newMode = this.userModeService.toggleMode();
        console.log('[ModeToggleUI] Toggled to mode:', newMode);
    }

    /**
     * Show tooltip when user activates Pro mode for first time
     * @private
     */
    showProModeTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'mode-tooltip';
        tooltip.innerHTML = `
            <div class="mode-tooltip-content">
                <span class="mode-tooltip-icon">✨</span>
                <p>Sie sehen jetzt alle Funktionen. Sie können jederzeit zurückwechseln.</p>
            </div>
        `;

        document.body.appendChild(tooltip);

        // Animate in
        setTimeout(() => {
            tooltip.classList.add('mode-tooltip-show');
        }, 100);

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
            tooltip.classList.remove('mode-tooltip-show');
            setTimeout(() => {
                tooltip.remove();
            }, 300);
        }, 4000);
    }

    /**
     * Refresh the currently active view to reflect mode changes
     * @private
     */
    refreshCurrentView() {
        // Find active view
        const activeView = document.querySelector('.view.active');
        if (!activeView) {
            return;
        }

        // Re-render the view if possible
        const viewId = activeView.id;
        if (viewId === 'view-dashboard' && window.updateDashboard) {
            window.updateDashboard();
        }
    }
}

// Initialize UI system
document.addEventListener('DOMContentLoaded', () => {
    if (window.userModeService) {
        const modeToggleUI = new ModeToggleUI();
        modeToggleUI.init();
        window.modeToggleUI = modeToggleUI;
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModeToggleUI;
}
