/* ============================================
   KI Transparency UI
   Marks all AI-generated content with clear badges
   and provides confirm/reject controls.

   Herr Mueller muss IMMER das letzte Wort haben.
   ============================================ */

class KITransparencyUI {
    constructor() {
        this.activeWrappers = new Map(); // targetId -> wrapper state
        this.stylesInjected = false;
        this.injectStyles();
        console.log('[KITransparencyUI] Initialisiert');
    }

    // ============================================
    // Public API
    // ============================================

    /**
     * Wraps the target element with a KI indicator frame,
     * banner, and confirm/reject/edit action buttons.
     *
     * @param {string} targetElementId - ID of the element to wrap
     * @param {Object} options
     * @param {string}   options.type        - identifier for this suggestion context
     * @param {Function} options.onConfirm   - called when user confirms
     * @param {Function} options.onReject    - called when user rejects
     * @param {Function} options.onEdit      - called when user clicks edit (optional)
     */
    wrapAIContent(targetElementId, options = {}) {
        const target = document.getElementById(targetElementId);
        if (!target) {
            console.warn('[KITransparencyUI] Element nicht gefunden:', targetElementId);
            return;
        }

        // Clean up any existing wrapper on the same target
        this.unwrap(targetElementId);

        const parent = target.parentNode;

        // --- Build wrapper structure ---
        const wrapper = document.createElement('div');
        wrapper.className = 'ki-suggestion-wrapper';
        wrapper.dataset.kiTarget = targetElementId;

        // Banner
        const banner = document.createElement('div');
        banner.className = 'ki-suggestion-banner';
        banner.innerHTML = '<span class="ki-banner-icon">&#129302;</span>' +
            '<span class="ki-banner-text">KI-Vorschlag &mdash; Bitte pr\u00fcfen und bei Bedarf anpassen</span>';

        // Action bar
        const actions = this.createConfirmRejectBar({
            confirmText: '\u2713 Vorschlag \u00fcbernehmen',
            rejectText: '\u2715 Vorschlag verwerfen',
            editText: '\u270E Anpassen',
            onConfirm: () => {
                const wasEdited = this._wasEdited(targetElementId);
                this.unwrap(targetElementId);
                // Insert permanent badge
                this._insertPermanentBadge(target, wasEdited);
                if (typeof options.onConfirm === 'function') {
                    options.onConfirm();
                }
            },
            onReject: () => {
                this.unwrap(targetElementId);
                if (typeof options.onReject === 'function') {
                    options.onReject();
                }
            },
            onEdit: () => {
                // Focus the element for editing
                target.focus();
                if (typeof options.onEdit === 'function') {
                    options.onEdit();
                }
            }
        });

        // Insert wrapper into DOM: parent -> wrapper -> (banner + target + actions)
        parent.insertBefore(wrapper, target);
        wrapper.appendChild(banner);
        wrapper.appendChild(target);
        wrapper.appendChild(actions);

        // Track state
        const state = {
            wrapper,
            banner,
            actions,
            target,
            parentRef: parent,
            edited: false,
            originalValue: target.value || target.textContent || '',
            inputListener: null
        };
        this.activeWrappers.set(targetElementId, state);

        // Listen for user edits to update the banner
        const inputListener = () => {
            if (!state.edited) {
                state.edited = true;
                banner.classList.add('ki-suggestion-banner--edited');
                banner.querySelector('.ki-banner-text').textContent =
                    'KI-Vorschlag \u2014 von Ihnen angepasst';
            }
        };

        state.inputListener = inputListener;
        target.addEventListener('input', inputListener);

        // Scroll the wrapper into view nicely
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Remove the KI wrapper and restore the target element to its
     * original position in the DOM.
     */
    unwrap(targetElementId) {
        const state = this.activeWrappers.get(targetElementId);
        if (!state) { return; }

        const { wrapper, target, inputListener } = state;

        // Remove input listener
        if (inputListener) {
            target.removeEventListener('input', inputListener);
        }

        // Move target back to its original position
        if (wrapper.parentNode) {
            wrapper.parentNode.insertBefore(target, wrapper);
            wrapper.remove();
        }

        this.activeWrappers.delete(targetElementId);
    }

    /**
     * Add a small non-intrusive KI badge to any element.
     *
     * @param {HTMLElement} element
     * @param {string} text
     */
    showAIBadge(element, text = 'KI-Vorschlag') {
        if (!element) { return; }
        this.removeAIBadge(element);

        const badge = document.createElement('span');
        badge.className = 'ki-inline-badge';
        badge.textContent = '\uD83E\uDD16 ' + text;
        element.dataset.kiBadge = 'true';

        // Insert after the element
        if (element.nextSibling) {
            element.parentNode.insertBefore(badge, element.nextSibling);
        } else {
            element.parentNode.appendChild(badge);
        }
    }

    /**
     * Remove a KI badge from an element.
     *
     * @param {HTMLElement} element
     */
    removeAIBadge(element) {
        if (!element) { return; }
        delete element.dataset.kiBadge;

        // Find and remove the badge that follows the element
        let next = element.nextSibling;
        while (next) {
            if (next.nodeType === 1 && next.classList?.contains('ki-inline-badge')) {
                next.remove();
                break;
            }
            next = next.nextSibling;
        }
    }

    /**
     * Create a confirm/reject/edit action bar as a DOM element.
     *
     * @param {Object} options
     * @param {Function} options.onConfirm
     * @param {Function} options.onReject
     * @param {Function} options.onEdit
     * @param {string}   options.confirmText
     * @param {string}   options.rejectText
     * @param {string}   options.editText
     * @returns {HTMLElement}
     */
    createConfirmRejectBar(options = {}) {
        const bar = document.createElement('div');
        bar.className = 'ki-suggestion-actions';

        // Confirm button
        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'btn ki-btn-confirm';
        confirmBtn.textContent = options.confirmText || '\u2713 \u00dcbernehmen';
        confirmBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof options.onConfirm === 'function') { options.onConfirm(); }
        });

        // Reject button
        const rejectBtn = document.createElement('button');
        rejectBtn.type = 'button';
        rejectBtn.className = 'btn ki-btn-reject';
        rejectBtn.textContent = options.rejectText || '\u2715 Verwerfen';
        rejectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof options.onReject === 'function') { options.onReject(); }
        });

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn ki-btn-edit';
        editBtn.textContent = options.editText || '\u270E Anpassen';
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof options.onEdit === 'function') { options.onEdit(); }
        });

        bar.appendChild(confirmBtn);
        bar.appendChild(editBtn);
        bar.appendChild(rejectBtn);

        return bar;
    }

    // ============================================
    // Private helpers
    // ============================================

    _wasEdited(targetElementId) {
        const state = this.activeWrappers.get(targetElementId);
        return state ? state.edited : false;
    }

    _insertPermanentBadge(target, wasEdited) {
        // Remove any existing permanent badge
        const existing = target.parentNode?.querySelector('.ki-badge-permanent');
        if (existing) { existing.remove(); }

        const badge = document.createElement('div');
        badge.className = 'ki-badge-permanent';
        badge.innerHTML = wasEdited
            ? '&#129302; Manuell angepasster KI-Vorschlag'
            : '&#129302; Basierend auf KI-Vorschlag';

        // Insert right after the target element
        if (target.nextSibling) {
            target.parentNode.insertBefore(badge, target.nextSibling);
        } else {
            target.parentNode.appendChild(badge);
        }
    }

    // ============================================
    // CSS injection
    // ============================================

    injectStyles() {
        if (this.stylesInjected) { return; }
        this.stylesInjected = true;

        const style = document.createElement('style');
        style.id = 'ki-transparency-styles';
        style.textContent = `
/* ==========================================
   KI Transparency UI Styles
   ========================================== */

/* --- Wrapper around AI-generated content --- */
.ki-suggestion-wrapper {
    position: relative;
    border: 2px solid #f59e0b44;
    border-radius: 8px;
    padding: 0;
    margin: 8px 0;
    transition: border-color 0.3s ease;
}

.ki-suggestion-wrapper:hover {
    border-color: #f59e0b88;
}

/* --- Banner above AI content --- */
.ki-suggestion-banner {
    background: linear-gradient(135deg, #f59e0b22, #f59e0b11);
    border-bottom: 1px solid #f59e0b44;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #f59e0b;
    font-weight: 600;
    border-radius: 6px 6px 0 0;
    user-select: none;
}

.ki-suggestion-banner .ki-banner-icon {
    font-size: 18px;
    flex-shrink: 0;
}

.ki-suggestion-banner .ki-banner-text {
    flex: 1;
}

/* Banner state: user has edited the content */
.ki-suggestion-banner--edited {
    background: linear-gradient(135deg, #f59e0b11, #f59e0b08);
    color: #d4930a;
    border-bottom-color: #f59e0b33;
}

/* Make textarea/div inside wrapper look seamless */
.ki-suggestion-wrapper textarea,
.ki-suggestion-wrapper .ki-wrapped-content {
    border-radius: 0;
    border-left: none;
    border-right: none;
    margin: 0;
    width: 100%;
    box-sizing: border-box;
}

/* --- Action bar below AI content --- */
.ki-suggestion-actions {
    display: flex;
    gap: 8px;
    padding: 10px 16px;
    background: #1c1c21;
    border-top: 1px solid #2a2a32;
    border-radius: 0 0 6px 6px;
    flex-wrap: wrap;
}

/* --- Action buttons --- */
.ki-btn-confirm {
    background: #16a34a !important;
    color: #fff !important;
    border: 1px solid #16a34a !important;
    padding: 6px 16px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    transition: background 0.2s, transform 0.1s !important;
}
.ki-btn-confirm:hover {
    background: #15803d !important;
    transform: translateY(-1px) !important;
}

.ki-btn-reject {
    background: transparent !important;
    color: #9ca3af !important;
    border: 1px solid #374151 !important;
    padding: 6px 16px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    transition: background 0.2s, color 0.2s !important;
}
.ki-btn-reject:hover {
    background: #dc2626 !important;
    color: #fff !important;
    border-color: #dc2626 !important;
}

.ki-btn-edit {
    background: transparent !important;
    color: #60a5fa !important;
    border: 1px solid #2563eb44 !important;
    padding: 6px 16px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    transition: background 0.2s, color 0.2s !important;
}
.ki-btn-edit:hover {
    background: #2563eb !important;
    color: #fff !important;
    border-color: #2563eb !important;
}

/* --- Permanent badge (after confirmation) --- */
.ki-badge-permanent {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #f59e0b15;
    color: #f59e0b99;
    border: 1px solid #f59e0b22;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    margin-top: 4px;
    user-select: none;
}

/* --- Inline badge (showAIBadge) --- */
.ki-inline-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #f59e0b22;
    color: #f59e0b;
    border: 1px solid #f59e0b44;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    margin-left: 6px;
    user-select: none;
    vertical-align: middle;
    white-space: nowrap;
}

/* --- Animations --- */
@keyframes ki-slide-in {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.ki-suggestion-wrapper {
    animation: ki-slide-in 0.3s ease-out;
}

/* --- Responsive adjustments --- */
@media (max-width: 600px) {
    .ki-suggestion-actions {
        flex-direction: column;
    }
    .ki-suggestion-actions .btn {
        width: 100%;
        text-align: center;
    }
}
`;
        document.head.appendChild(style);
    }
}

// Create global instance
window.kiTransparencyUI = new KITransparencyUI();
