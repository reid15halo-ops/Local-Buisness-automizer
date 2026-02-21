/* ============================================
   Modals Module
   Modal open/close/form handling with focus trap
   ============================================ */

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus first focusable element
    requestAnimationFrame(() => {
        const focusable = modal.querySelector('input:not([type="hidden"]), select, textarea, button:not(.modal-close)');
        if (focusable) { focusable.focus(); }
    });

    // Set up focus trap
    modal._focusTrapHandler = (e) => {
        if (e.key !== 'Tab') return;
        const focusableEls = modal.querySelectorAll(
            'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableEls.length === 0) return;
        const first = focusableEls[0];
        const last = focusableEls[focusableEls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };
    modal.addEventListener('keydown', modal._focusTrapHandler);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Remove focus trap
    if (modal._focusTrapHandler) {
        modal.removeEventListener('keydown', modal._focusTrapHandler);
        delete modal._focusTrapHandler;
    }
}

function initModals() {
    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            const modal = overlay.closest('.modal');
            modal.classList.remove('active');
            document.body.style.overflow = '';
            if (modal._focusTrapHandler) {
                modal.removeEventListener('keydown', modal._focusTrapHandler);
                delete modal._focusTrapHandler;
            }
        });
    });

    // Close on X button
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            modal.classList.remove('active');
            document.body.style.overflow = '';
            if (modal._focusTrapHandler) {
                modal.removeEventListener('keydown', modal._focusTrapHandler);
                delete modal._focusTrapHandler;
            }
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
                if (modal._focusTrapHandler) {
                    modal.removeEventListener('keydown', modal._focusTrapHandler);
                    delete modal._focusTrapHandler;
                }
            });
            document.body.style.overflow = '';
        }
    });
}

// Export modal functions
window.ModalsModule = {
    openModal,
    closeModal,
    initModals
};
