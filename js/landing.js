(function() {
    'use strict';

    // ---- Smooth Scroll ----
    document.querySelectorAll('a[href^="#"]').forEach(function(link) {
        link.addEventListener('click', function(e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                var offset = 70;
                var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top: top, behavior: 'smooth' });
                // Close mobile nav if open
                var nav = document.getElementById('nav-menu');
                if (nav) nav.classList.remove('open');
                var toggle = document.querySelector('.mobile-toggle');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            }
        });
    });

    // ---- Mobile Nav Toggle ----
    var toggle = document.querySelector('.mobile-toggle');
    var navMenu = document.getElementById('nav-menu');
    if (toggle && navMenu) {
        toggle.addEventListener('click', function() {
            var isOpen = navMenu.classList.toggle('open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.innerHTML = isOpen ? '&#10005;' : '&#9776;';
        });
    }

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
            });
            // Toggle current
            if (!isOpen) {
                item.classList.add('open');
                this.setAttribute('aria-expanded', 'true');
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

    // ---- Waitlist Form ----
    var form = document.getElementById('waitlist-form');
    var successMsg = document.getElementById('waitlist-success');

    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var email = form.querySelector('input[name="email"]').value.trim();
            if (!email) return;

            // Try Supabase first
            var SUPABASE_URL = 'https://incbhhaiiayohrjqevog.supabase.co';
            var SUPABASE_ANON_KEY = null; // Set this if you have an anon key configured

            if (SUPABASE_ANON_KEY) {
                fetch(SUPABASE_URL + '/rest/v1/waitlist', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        email: email,
                        source: 'landing',
                        created_at: new Date().toISOString()
                    })
                }).then(function(res) {
                    if (res.ok) {
                        showSuccess();
                    } else {
                        saveLocal(email);
                        showSuccess();
                    }
                }).catch(function() {
                    saveLocal(email);
                    showSuccess();
                });
            } else {
                saveLocal(email);
                showSuccess();
            }
        });
    }

    function saveLocal(email) {
        try {
            var list = JSON.parse(localStorage.getItem('freyai_waitlist') || '[]');
            list.push({ email: email, date: new Date().toISOString() });
            localStorage.setItem('freyai_waitlist', JSON.stringify(list));
        } catch(e) { /* silent */ }
    }

    function showSuccess() {
        form.style.display = 'none';
        if (successMsg) successMsg.classList.add('visible');
    }

})();
