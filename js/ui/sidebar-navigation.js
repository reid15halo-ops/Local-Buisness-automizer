/**
 * Sidebar Grouped Navigation
 * Replaces flat nav-menu with collapsible grouped navigation.
 * Preserves all data-view attributes and existing event handling.
 */
(function () {
    'use strict';

    // ── CSS ────────────────────────────────────────────────────────────
    const STYLE = document.createElement('style');
    STYLE.textContent = `
        .nav-group-container {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .nav-group-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: transparent;
            border: none;
            color: var(--text-muted, #888);
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            width: 100%;
            text-align: left;
            user-select: none;
            transition: color 0.15s ease;
            margin-top: 6px;
        }

        .nav-group-header:hover {
            color: var(--text-secondary, #aaa);
        }

        .nav-group-header-icon {
            font-size: 13px;
            flex-shrink: 0;
        }

        .nav-group-header-label {
            flex: 1;
        }

        .nav-group-chevron {
            font-size: 10px;
            transition: transform 0.2s ease;
            flex-shrink: 0;
            opacity: 0.6;
        }

        .nav-group-collapsed .nav-group-chevron {
            transform: rotate(-90deg);
        }

        .nav-group-items {
            overflow: hidden;
            transition: max-height 0.25s ease, opacity 0.2s ease;
            opacity: 1;
        }

        .nav-group-collapsed .nav-group-items {
            max-height: 0 !important;
            opacity: 0;
        }

        .nav-group-bottom-divider {
            height: 1px;
            background: var(--border-color, rgba(255,255,255,0.08));
            margin: 6px 16px;
        }

        .nav-group-bottom-section {
            margin-top: auto;
            display: flex;
            flex-direction: column;
            gap: 2px;
            border-top: 1px solid var(--border-color, rgba(255,255,255,0.08));
            padding-top: 8px;
        }

        .nav-group-admin-section {
            display: flex;
            flex-direction: column;
            gap: 2px;
            border-top: 1px solid var(--border-color, rgba(255,255,255,0.08));
            padding-top: 4px;
            margin-top: 4px;
        }
    `;
    document.head.appendChild(STYLE);

    // ── Navigation structure definition ────────────────────────────────
    const NAV_STRUCTURE = {
        topItems: [
            { view: 'quick-actions', icon: '\uD83C\uDFE0', label: 'Startseite' }
        ],
        groups: [
            {
                id: 'geschaeft',
                label: 'Gesch\u00E4ft',
                icon: '\uD83D\uDCBC',
                defaultExpanded: true,
                items: [
                    { view: 'anfragen', icon: '\uD83D\uDCE5', label: 'Anfragen', badge: 'anfragen-badge' },
                    { view: 'angebote', icon: '\uD83D\uDCDD', label: 'Angebote', badge: 'angebote-badge' },
                    { view: 'auftraege', icon: '\uD83D\uDD27', label: 'Auftr\u00E4ge', badge: 'auftraege-badge' },
                    { view: 'rechnungen', icon: '\uD83D\uDCB0', label: 'Rechnungen', badge: 'rechnungen-badge' },
                    { view: 'kunden', icon: '\uD83D\uDC65', label: 'Kunden', badge: 'kunden-badge' }
                ]
            },
            {
                id: 'buero',
                label: 'B\u00FCro',
                icon: '\uD83D\uDCCB',
                items: [
                    { view: 'kalender', icon: '\uD83D\uDCC5', label: 'Kalender' },
                    { view: 'aufgaben', icon: '\uD83D\uDCCB', label: 'Aufgaben', badge: 'aufgaben-badge' },
                    { view: 'kommunikation', icon: '\uD83D\uDCAC', label: 'Kommunikation', badge: 'kommunikation-badge' },
                    { view: 'emails', icon: '\uD83D\uDCE7', label: 'E-Mails', badge: 'emails-badge' }
                ]
            },
            {
                id: 'finanzen',
                label: 'Finanzen',
                icon: '\uD83D\uDCC8',
                items: [
                    { view: 'buchhaltung', icon: '\uD83D\uDCB0', label: 'Buchhaltung' },
                    { view: 'mahnwesen', icon: '\u26A0\uFE0F', label: 'Mahnwesen', badge: 'mahnwesen-badge' },
                    { view: 'berichte', icon: '\uD83D\uDCCA', label: 'Berichte' }
                ]
            },
            {
                id: 'werkzeuge',
                label: 'Werkzeuge',
                icon: '\uD83D\uDD27',
                items: [
                    { view: 'field-mode', icon: '\uD83C\uDFD7\uFE0F', label: 'Feld-Modus' },
                    { view: 'chatbot', icon: '\uD83D\uDCAC', label: 'KI-Chatbot' },
                    { view: 'scanner', icon: '\uD83D\uDCF7', label: 'Scanner' },
                    { view: 'aufmass', icon: '\uD83D\uDCD0', label: 'Aufma\u00DF' },
                    { view: 'dokumente', icon: '\uD83D\uDCC4', label: 'Dokumente' }
                ]
            },
            {
                id: 'lager',
                label: 'Lager',
                icon: '\uD83D\uDCE6',
                items: [
                    { view: 'material', icon: '\uD83D\uDCE6', label: 'Material', badge: 'material-badge' },
                    { view: 'wareneingang', icon: '\uD83D\uDCCB', label: 'Wareneingang', badge: 'wareneingang-badge' },
                    { view: 'bestellungen', icon: '\uD83D\uDED2', label: 'Bestellungen', badge: 'bestellungen-badge' }
                ]
            }
        ],
        bottomItems: [
            { view: 'support', icon: '\uD83C\uDFAB', label: 'Support' },
            { view: 'einstellungen', icon: '\u2699\uFE0F', label: 'Einstellungen' }
        ],
        adminItems: [
            { view: 'admin-panel', icon: '\uD83D\uDD10', label: 'Verwaltung' },
            { view: 'agent-workflows', icon: '\uD83E\uDD16', label: 'KI-Agenten' },
            { view: 'workflow-builder', icon: '\uD83D\uDD27', label: 'Workflow-Builder' },
            { view: 'backup', icon: '\uD83D\uDD12', label: 'Daten verwalten' }
        ]
    };

    const STORAGE_KEY = 'sidebar_collapsed_groups';

    // ── Helpers ────────────────────────────────────────────────────────

    /** Load collapsed state from localStorage */
    function loadCollapsedState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    /** Save collapsed state to localStorage */
    function saveCollapsedState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) { /* ignore */ }
    }

    /** Create a nav button element */
    function createNavButton(item) {
        const btn = document.createElement('button');
        btn.className = 'nav-item';
        btn.setAttribute('data-view', item.view);
        btn.innerHTML =
            '<span class="nav-icon">' + item.icon + '</span>' +
            item.label +
            (item.badge ? '<span class="badge" id="' + item.badge + '"></span>' : '');
        return btn;
    }

    /** Build a collapsible group */
    function createGroup(group, isCollapsed) {
        const container = document.createElement('div');
        container.className = 'nav-group-container' + (isCollapsed ? ' nav-group-collapsed' : '');
        container.setAttribute('data-group-id', group.id);

        // Header
        const header = document.createElement('button');
        header.className = 'nav-group-header';
        header.setAttribute('type', 'button');
        header.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        header.innerHTML =
            '<span class="nav-group-header-icon">' + group.icon + '</span>' +
            '<span class="nav-group-header-label">' + group.label + '</span>' +
            '<span class="nav-group-chevron">\u25BC</span>';

        header.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleGroup(group.id);
        });

        container.appendChild(header);

        // Items wrapper
        const itemsWrap = document.createElement('div');
        itemsWrap.className = 'nav-group-items';

        group.items.forEach(function (item) {
            itemsWrap.appendChild(createNavButton(item));
        });

        container.appendChild(itemsWrap);

        // Measure and set max-height after render
        requestAnimationFrame(function () {
            if (!isCollapsed) {
                itemsWrap.style.maxHeight = itemsWrap.scrollHeight + 'px';
            }
        });

        return container;
    }

    // ── Core API ───────────────────────────────────────────────────────

    let collapsedState = {};
    let navMenu = null;

    function expandGroup(groupId) {
        collapsedState[groupId] = false;
        saveCollapsedState(collapsedState);
        const container = navMenu && navMenu.querySelector('[data-group-id="' + groupId + '"]');
        if (!container) return;
        container.classList.remove('nav-group-collapsed');
        var header = container.querySelector('.nav-group-header');
        if (header) header.setAttribute('aria-expanded', 'true');
        const items = container.querySelector('.nav-group-items');
        if (items) {
            items.style.maxHeight = items.scrollHeight + 'px';
        }
    }

    function collapseGroup(groupId) {
        collapsedState[groupId] = true;
        saveCollapsedState(collapsedState);
        const container = navMenu && navMenu.querySelector('[data-group-id="' + groupId + '"]');
        if (!container) return;
        const items = container.querySelector('.nav-group-items');
        if (items) {
            // Set explicit max-height first so transition works
            items.style.maxHeight = items.scrollHeight + 'px';
            // Force reflow
            items.offsetHeight; // eslint-disable-line no-unused-expressions
        }
        container.classList.add('nav-group-collapsed');
        var header = container.querySelector('.nav-group-header');
        if (header) header.setAttribute('aria-expanded', 'false');
    }

    function toggleGroup(groupId) {
        if (collapsedState[groupId]) {
            expandGroup(groupId);
        } else {
            collapseGroup(groupId);
        }
    }

    /** Find which group contains a given view */
    function findGroupForView(viewName) {
        for (var i = 0; i < NAV_STRUCTURE.groups.length; i++) {
            var g = NAV_STRUCTURE.groups[i];
            for (var j = 0; j < g.items.length; j++) {
                if (g.items[j].view === viewName) return g.id;
            }
        }
        return null;
    }

    function setActiveView(viewName) {
        if (!navMenu) return;
        // Remove active from all
        var allBtns = navMenu.querySelectorAll('.nav-item');
        allBtns.forEach(function (b) { b.classList.remove('active'); });

        // Set active
        var target = navMenu.querySelector('[data-view="' + viewName + '"]');
        if (target) {
            target.classList.add('active');
        }

        // Auto-expand parent group
        var groupId = findGroupForView(viewName);
        if (groupId && collapsedState[groupId]) {
            expandGroup(groupId);
        }

        // On mobile: collapse all groups except the active one
        if (window.innerWidth <= 768) {
            NAV_STRUCTURE.groups.forEach(function (g) {
                if (g.id !== groupId) {
                    collapseGroup(g.id);
                }
            });
        }
    }

    // ── Event listener refs (prevent duplicates) ──────────────────────
    var _clickHandler = null;
    var _resizeHandler = null;
    var _resizeTimer = null;

    // ── Init ───────────────────────────────────────────────────────────

    function init() {
        try {
            navMenu = document.querySelector('.nav-menu');
            if (!navMenu) {
                console.warn('[SidebarNavigation] .nav-menu not found');
                return;
            }

            collapsedState = loadCollapsedState();

            // Determine currently active view before we clear
            var currentActive = navMenu.querySelector('.nav-item.active');
            var activeView = currentActive ? currentActive.getAttribute('data-view') : 'quick-actions';

            // Clear existing content
            navMenu.innerHTML = '';

            // -- Top items (always visible) --
            NAV_STRUCTURE.topItems.forEach(function (item) {
                var btn = createNavButton(item);
                if (item.view === activeView) btn.classList.add('active');
                navMenu.appendChild(btn);
            });

            // -- Groups --
            NAV_STRUCTURE.groups.forEach(function (group) {
                var isCollapsed;
                if (collapsedState.hasOwnProperty(group.id)) {
                    isCollapsed = collapsedState[group.id];
                } else {
                    isCollapsed = !group.defaultExpanded;
                }

                var activeGroupId = findGroupForView(activeView);
                if (activeGroupId === group.id) {
                    isCollapsed = false;
                }

                var groupEl = createGroup(group, isCollapsed);

                if (activeGroupId === group.id) {
                    var btn = groupEl.querySelector('[data-view="' + activeView + '"]');
                    if (btn) btn.classList.add('active');
                }

                collapsedState[group.id] = isCollapsed;
                navMenu.appendChild(groupEl);
            });

            saveCollapsedState(collapsedState);

            // -- Bottom section --
            var bottomSection = document.createElement('div');
            bottomSection.className = 'nav-group-bottom-section';

            NAV_STRUCTURE.bottomItems.forEach(function (item) {
                var btn = createNavButton(item);
                if (item.view === activeView) btn.classList.add('active');
                bottomSection.appendChild(btn);
            });

            var adminSection = document.createElement('div');
            adminSection.className = 'nav-group-admin-section';
            adminSection.setAttribute('data-mode', 'pro');

            NAV_STRUCTURE.adminItems.forEach(function (item) {
                var btn = createNavButton(item);
                if (item.view === activeView) btn.classList.add('active');
                adminSection.appendChild(btn);
            });

            bottomSection.appendChild(adminSection);
            navMenu.appendChild(bottomSection);

            // -- Remove old listeners before adding new ones --
            if (_clickHandler) document.removeEventListener('click', _clickHandler);
            if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);

            _clickHandler = function (e) {
                var btn = e.target.closest('[data-view]');
                if (btn && navMenu.contains(btn)) {
                    setActiveView(btn.getAttribute('data-view'));
                }
            };
            document.addEventListener('click', _clickHandler);

            _resizeHandler = function () {
                clearTimeout(_resizeTimer);
                _resizeTimer = setTimeout(function () {
                    var expanded = navMenu.querySelectorAll('.nav-group-container:not(.nav-group-collapsed) .nav-group-items');
                    expanded.forEach(function (el) {
                        el.style.maxHeight = el.scrollHeight + 'px';
                    });
                }, 150);
            };
            window.addEventListener('resize', _resizeHandler);

        } catch (error) {
            console.error('[SidebarNavigation] init failed:', error);
            if (window.errorHandler) {
                window.errorHandler.handle(error, 'SidebarNavigation.init', false);
            }
        }
    }

    // ── Bootstrap ──────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ── Public API ─────────────────────────────────────────────────────

    window.SidebarNavigation = {
        init: init,
        expandGroup: expandGroup,
        collapseGroup: collapseGroup,
        setActiveView: setActiveView
    };

})();
