(function() {
    'use strict';

    // Remove no-js class (enables CSS reveal animations)
    document.documentElement.classList.remove('no-js');

    // ---- Smooth Scroll ----
    document.querySelectorAll('a[href^="#"]').forEach(function(link) {
        link.addEventListener('click', function(e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                var offset = 70;
                var top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: top, behavior: 'smooth' });
                // Close mobile nav if open
                closeMobileNav();
            }
        });
    });

    // ---- Mobile Nav Toggle ----
    var toggle = document.querySelector('.mobile-toggle');
    var navMenu = document.getElementById('nav-menu');

    function closeMobileNav() {
        if (navMenu && navMenu.classList.contains('open')) {
            navMenu.classList.remove('open');
            if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
                toggle.textContent = '\u2630';
            }
        }
    }

    if (toggle && navMenu) {
        toggle.addEventListener('click', function() {
            var isOpen = navMenu.classList.toggle('open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.textContent = isOpen ? '\u2715' : '\u2630';
        });
    }

    // Close mobile nav on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeMobileNav();
    });

    // ---- Nav Scroll Effect ----
    var nav = document.querySelector('.nav');
    if (nav) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 60) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        }, { passive: true });
    }

    // ---- FAQ Accordion ----
    document.querySelectorAll('.faq-question').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var item = this.closest('.faq-item');
            var isOpen = item.classList.contains('open');
            // Close all
            document.querySelectorAll('.faq-item.open').forEach(function(openItem) {
                openItem.classList.remove('open');
                openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                openItem.querySelector('.faq-answer').setAttribute('aria-hidden', 'true');
            });
            // Toggle current
            if (!isOpen) {
                item.classList.add('open');
                this.setAttribute('aria-expanded', 'true');
                item.querySelector('.faq-answer').setAttribute('aria-hidden', 'false');
            }
        });
    });

    // ---- Scroll Reveal ----
    var reveals = document.querySelectorAll('.reveal');
    if (reveals.length > 0 && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
        reveals.forEach(function(el) { observer.observe(el); });
    } else {
        // Fallback: show everything
        reveals.forEach(function(el) { el.classList.add('visible'); });
    }

})();
