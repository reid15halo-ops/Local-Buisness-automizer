/**
 * auth-page.js — Auth page logic extracted from inline script in auth.html
 * Handles tab switching, login, register, password reset, and session redirect.
 */
document.addEventListener('DOMContentLoaded', function () {

    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.auth-tab').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.auth-form').forEach(function (f) { f.classList.remove('active'); });
            tab.classList.add('active');

            var formId = 'form-' + tab.dataset.tab;
            document.getElementById(formId).classList.add('active');
            hideMessage();
        });
    });

    // Forgot password link
    document.getElementById('link-forgot').addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('.auth-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.auth-form').forEach(function (f) { f.classList.remove('active'); });
        document.getElementById('form-reset').classList.add('active');
    });

    document.getElementById('link-back-login').addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('.auth-form').forEach(function (f) { f.classList.remove('active'); });
        document.getElementById('form-login').classList.add('active');
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
    });

    function showMessage(text, type) {
        if (!type) { type = 'error'; }
        var el = document.getElementById('auth-message');
        el.textContent = text;
        el.className = 'auth-message ' + type;
    }

    function hideMessage() {
        var el = document.getElementById('auth-message');
        el.className = 'auth-message';
    }

    // Check Supabase config (wait for async init)
    async function waitForSupabase() {
        if (window.supabaseClient && window.supabaseClient.init) {
            await window.supabaseClient.init();
        }
        return window.supabaseConfig.isConfigured();
    }

    waitForSupabase().then(function (configured) {
        if (!configured) {
            document.getElementById('setup-notice').style.display = 'block';
        }
    });

    // Login
    document.getElementById('form-login').addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = document.getElementById('login-email').value.trim();
        var password = document.getElementById('login-password').value;
        var btn = document.getElementById('btn-login');

        var configured = await waitForSupabase();
        if (!configured) {
            showMessage('Supabase nicht konfiguriert. Nutze die Demo oder richte Supabase in den Einstellungen ein.');
            return;
        }

        // C2: Rate limit login attempts (5 per 60s)
        if (window.securityService) {
            var rl = window.securityService.checkRateLimit('login', 5, 60000);
            if (!rl.allowed) {
                window.securityService.logSecurityEvent('rate_limit', { action: 'login', email: email });
                showMessage('Zu viele Versuche. Bitte warten Sie einen Moment.');
                return;
            }
        }

        btn.disabled = true;
        btn.textContent = 'Wird angemeldet...';
        hideMessage();

        try {
            await window.authService.login(email, password);
            window.location.href = 'index.html';
        } catch (err) {
            var msg = err.message;
            var translated =
                msg === 'Invalid login credentials' ? 'E-Mail oder Passwort falsch.' :
                msg.includes('Failed to fetch') || msg.includes('NetworkError') ? 'Verbindung zum Server fehlgeschlagen. Bitte versuche es erneut.' :
                msg;
            showMessage(translated);
            // H5: Log failed login attempt
            if (window.securityService) {
                window.securityService.logSecurityEvent('auth_failure', { action: 'login', email: email });
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Anmelden';
        }
    });

    // Register
    document.getElementById('form-register').addEventListener('submit', async function (e) {
        e.preventDefault();
        var company = document.getElementById('reg-company').value.trim();
        var name = document.getElementById('reg-name').value.trim();
        var email = document.getElementById('reg-email').value.trim();
        var password = document.getElementById('reg-password').value;
        var btn = document.getElementById('btn-register');

        var regConfigured = await waitForSupabase();
        if (!regConfigured) {
            showMessage('Supabase nicht konfiguriert. Richte es zuerst in den Einstellungen ein.');
            return;
        }

        // H-06: Password strength validation
        if (password.length < 8) {
            showMessage('Passwort muss mindestens 8 Zeichen lang sein.');
            return;
        }
        if (!/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
            showMessage('Passwort muss mindestens eine Zahl und ein Sonderzeichen enthalten.');
            return;
        }

        // Check AGB/Datenschutz checkbox
        var agbCheckbox = document.getElementById('register-agb-checkbox');
        if (!agbCheckbox.checked) {
            showMessage('Bitte akzeptieren Sie die AGB und Datenschutzerkl\u00e4rung.');
            return;
        }

        // CSRF validation for state-changing registration
        if (window.securityService && !window.securityService.validateCSRFToken()) {
            showMessage('CSRF-Token ung\u00fcltig. Bitte Seite neu laden.');
            window.securityService.logSecurityEvent('csrf_failure', { action: 'register', email: email });
            return;
        }

        // C2: Rate limit registration attempts (3 per 5min)
        if (window.securityService) {
            var rl = window.securityService.checkRateLimit('register', 3, 300000);
            if (!rl.allowed) {
                window.securityService.logSecurityEvent('rate_limit', { action: 'register', email: email });
                showMessage('Zu viele Versuche. Bitte warten Sie einen Moment.');
                return;
            }
        }

        btn.disabled = true;
        btn.textContent = 'Wird registriert...';
        hideMessage();

        try {
            await window.authService.register(email, password, {
                companyName: company,
                fullName: name
            });
            showMessage('Registrierung erfolgreich! Bitte best\u00e4tige deine E-Mail.', 'success');
        } catch (err) {
            var msg = err.message;
            var translated =
                msg === 'User already registered' ? 'Diese E-Mail ist bereits registriert.' :
                msg === 'Password should be at least 6 characters' ? 'Passwort muss mindestens 6 Zeichen lang sein.' :
                msg === 'Unable to validate email address: invalid format' ? 'Ung\u00fcltiges E-Mail-Format.' :
                msg.includes('Failed to fetch') || msg.includes('NetworkError') ? 'Verbindung zum Server fehlgeschlagen. Bitte versuche es erneut.' :
                msg;
            showMessage(translated);
            // H5: Log failed registration attempt
            if (window.securityService) {
                window.securityService.logSecurityEvent('auth_failure', { action: 'register', email: email });
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Kostenlos registrieren';
        }
    });

    // Reset Password
    document.getElementById('form-reset').addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = document.getElementById('reset-email').value.trim();

        if (!window.supabaseConfig.isConfigured()) {
            showMessage('Supabase nicht konfiguriert.');
            return;
        }

        // CSRF validation for state-changing password reset
        if (window.securityService && !window.securityService.validateCSRFToken()) {
            showMessage('CSRF-Token ung\u00fcltig. Bitte Seite neu laden.');
            window.securityService.logSecurityEvent('csrf_failure', { action: 'password_reset', email: email });
            return;
        }

        // C2: Rate limit password reset attempts (3 per 5min)
        if (window.securityService) {
            var rl = window.securityService.checkRateLimit('password_reset', 3, 300000);
            if (!rl.allowed) {
                window.securityService.logSecurityEvent('rate_limit', { action: 'password_reset', email: email });
                showMessage('Zu viele Versuche. Bitte warten Sie einen Moment.');
                return;
            }
        }

        try {
            await window.authService.resetPassword(email);
            showMessage('Reset-Link wurde gesendet! Pr\u00fcfe deine E-Mails.', 'success');
        } catch (err) {
            showMessage(err.message);
            // H5: Log failed password reset attempt
            if (window.securityService) {
                window.securityService.logSecurityEvent('auth_failure', { action: 'password_reset', email: email });
            }
        }
    });

    // If already logged in, redirect
    (async function () {
        if (window.supabaseConfig.isConfigured()) {
            var session = await window.authService.getSession();
            if (session) {
                window.location.href = 'index.html';
            }
        }
    })();

    // Password toggle buttons
    document.querySelectorAll('.password-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var input = btn.parentElement.querySelector('input');
            var isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            btn.style.opacity = isHidden ? '1' : '0.5';
        });
    });

    // Demo button
    var demoBtn = document.getElementById('btn-demo');
    if (demoBtn) {
        demoBtn.addEventListener('click', function () {
            window.location.href = 'index.html';
        });
    }

});
