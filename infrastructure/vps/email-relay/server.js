// HandwerkFlow Email Relay
// Runs on VPS, connects to Proton Mail Bridge SMTP
//
// Setup:
// 1. Install Proton Mail Bridge on VPS (headless):
//    https://proton.me/mail/bridge#download
//    protonmail-bridge --cli
//
// 2. Configure .env (see .env.example)
// 3. npm install && npm start
//
// Proton Bridge SMTP defaults:
//   Host: 127.0.0.1
//   Port: 1025
//   Security: STARTTLS
//   Username: your proton email
//   Password: bridge-generated password (NOT your Proton password)

const Fastify = require('fastify');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// safeCompare performs a constant-time string comparison by hashing both values to the
// same fixed length with SHA-256 before calling timingSafeEqual.  This removes the
// token-length side-channel that an early-exit length check would introduce.
function safeCompare(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// sanitizeEmailHtml strips <script> tags and inline event handlers from inbound HTML bodies
// before passing them to nodemailer, preventing XSS payloads from reaching email clients.
function sanitizeEmailHtml(html) {
    if (!html) return html;
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
}

// --- Config from environment ---
const PORT = parseInt(process.env.PORT || '3100');
const API_SECRET = process.env.API_SECRET || '';

// Refuse to start without API_SECRET configured
if (!API_SECRET) {
    console.error('[email-relay] FATAL: API_SECRET not configured. Set it in .env');
    process.exit(1);
}

const SMTP_HOST = process.env.SMTP_HOST || '127.0.0.1';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '1025');
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SENDER_NAME = process.env.SENDER_NAME || 'HandwerkFlow';
const SENDER_EMAIL = process.env.SENDER_EMAIL || SMTP_USER;

// --- SMTP Transporter ---
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
    tls: {
        // Proton Bridge uses self-signed cert on localhost only
        // If SMTP_HOST is not localhost, enforce certificate validation
        rejectUnauthorized: SMTP_HOST !== '127.0.0.1' && SMTP_HOST !== 'localhost',
    },
});

// --- Recipient Validator ---
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 50;

function validateRecipients(recipients) {
  if (!Array.isArray(recipients)) return { valid: false, error: 'recipients must be an array' };
  if (recipients.length === 0) return { valid: false, error: 'recipients array is empty' };
  if (recipients.length > MAX_RECIPIENTS) return { valid: false, error: `too many recipients (max ${MAX_RECIPIENTS})` };
  const invalid = recipients.filter(r => !EMAIL_REGEX.test(r));
  if (invalid.length > 0) return { valid: false, error: `invalid recipient emails: ${invalid.join(', ')}` };
  return { valid: true };
}

// --- Rate limiter (keyed by authenticated API key hash) ---
const rateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX_SINGLE = 100; // /send-email: max 100 per 5 min
const RATE_LIMIT_MAX_BULK = 200; // /send-bulk: max 200 per 5 min

// Periodic cleanup of expired rate limit entries (every 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimits) {
        if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
            rateLimits.delete(key);
        }
    }
}, 10 * 60 * 1000);

function checkRateLimit(key, max) {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

function getRateLimitKey(request, endpoint) {
    // Key by authenticated token hash, not client-supplied data
    const token = (request.headers['authorization'] || '').replace('Bearer ', '');
    return crypto.createHash('sha256').update(token + endpoint).digest('hex').slice(0, 16);
}

// --- HTML detection (more robust than simple < > check) ---
function looksLikeHtml(text) {
    return /<[a-z][\s\S]*>/i.test(text);
}

// --- Fastify Server ---
const app = Fastify({ logger: true });

// Auth middleware
app.addHook('onRequest', async (request, reply) => {
    // Skip health check
    if (request.url === '/health') return;

    const authHeader = request.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '');

    // Use constant-time comparison via SHA-256 hashes to prevent timing side-channel attacks.
    if (!safeCompare(token, API_SECRET)) {
        reply.code(401).send({ error: 'Ungültiger API Key' });
        return;
    }
});

// Health check
app.get('/health', async () => {
    let smtpOk = false;
    try {
        await transporter.verify();
        smtpOk = true;
    } catch (e) {
        // SMTP not ready
    }
    return { status: 'ok', smtp: smtpOk, timestamp: new Date().toISOString() };
});

// Send email
app.post('/send-email', async (request, reply) => {
    const { to, subject, body, html, replyTo, cc, bcc } = request.body || {};

    if (!to || !subject) {
        return reply.code(400).send({ error: '"to" und "subject" sind erforderlich' });
    }

    // Validate recipients
    const toArray = Array.isArray(to) ? to : [to];
    const recipientCheck = validateRecipients(toArray);
    if (!recipientCheck.valid) {
        return reply.code(400).send({ error: recipientCheck.error });
    }

    // Rate limit
    const rlKey = getRateLimitKey(request, 'single');
    if (!checkRateLimit(rlKey, RATE_LIMIT_MAX_SINGLE)) {
        return reply.code(429).send({ error: 'Rate limit exceeded. Try again later.' });
    }

    if (!SMTP_USER) {
        return reply.code(500).send({ error: 'SMTP nicht konfiguriert (SMTP_USER fehlt)' });
    }

    try {
        const mailOptions = {
            from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            replyTo: replyTo || undefined,
            cc: cc || undefined,
            bcc: bcc || undefined,
        };

        // Support both plain text and HTML
        if (html) {
            mailOptions.html = sanitizeEmailHtml(html);
        } else if (body) {
            if (looksLikeHtml(body)) {
                mailOptions.html = sanitizeEmailHtml(body);
            } else {
                mailOptions.text = body;
                mailOptions.html = sanitizeEmailHtml(`<pre style="font-family: Arial, Helvetica, sans-serif; white-space: pre-wrap; line-height: 1.6;">${body}</pre>`);
            }
        }

        const info = await transporter.sendMail(mailOptions);

        return {
            success: true,
            messageId: info.messageId,
            accepted: info.accepted,
        };
    } catch (err) {
        console.error('[email-relay] Failed to send email', {
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            error: err?.message ?? err
        });
        return reply.code(500).send({
            error: 'E-Mail Versand fehlgeschlagen',
        });
    }
});

// Send bulk (for dunning batches)
app.post('/send-bulk', async (request, reply) => {
    const { emails } = request.body || {};

    if (!Array.isArray(emails) || emails.length === 0) {
        return reply.code(400).send({ error: '"emails" Array ist erforderlich' });
    }

    if (emails.length > 50) {
        return reply.code(400).send({ error: 'Maximal 50 E-Mails pro Batch' });
    }

    // Rate limit keyed by authenticated API key hash
    const rlKey = getRateLimitKey(request, 'bulk');
    if (!checkRateLimit(rlKey, RATE_LIMIT_MAX_BULK)) {
        return reply.code(429).send({ error: 'Bulk rate limit exceeded. Try again later.' });
    }

    const results = [];
    for (const email of emails) {
        // Validate each email in the batch
        if (!email.to || !email.subject) {
            results.push({ to: email.to || 'unknown', success: false, error: 'to and subject required' });
            continue;
        }
        const toArray = Array.isArray(email.to) ? email.to : [email.to];
        const recipientCheck = validateRecipients(toArray);
        if (!recipientCheck.valid) {
            results.push({ to: email.to, success: false, error: recipientCheck.error });
            continue;
        }

        try {
            const sanitizedHtml = looksLikeHtml(email.body || '')
                ? sanitizeEmailHtml(email.body)
                : sanitizeEmailHtml(`<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6;">${email.body || ''}</pre>`);
            const info = await transporter.sendMail({
                from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
                to: Array.isArray(email.to) ? email.to.join(', ') : email.to,
                subject: email.subject,
                html: sanitizedHtml,
            });
            results.push({ to: email.to, success: true, messageId: info.messageId });
        } catch (err) {
            results.push({ to: email.to, success: false, error: 'Send failed' });
        }

        // Rate limit: 100ms between emails (Proton Bridge limit)
        await new Promise(r => setTimeout(r, 100));
    }

    return {
        success: true,
        total: emails.length,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
    };
});

// SMTP connection test
app.post('/test', async (request, reply) => {
    try {
        await transporter.verify();
        return { success: true, message: 'SMTP-Verbindung OK' };
    } catch (err) {
        console.error('[email-relay] SMTP test failed', { error: err?.message ?? err });
        return reply.code(500).send({
            success: false,
            error: 'SMTP-Verbindung fehlgeschlagen',
        });
    }
});

// --- Start ---
const LISTEN_HOST = process.env.LISTEN_HOST || '127.0.0.1';
app.listen({ port: PORT, host: LISTEN_HOST }, (err) => {
    if (err) {
        console.error('[email-relay] Failed to start server', {
            error: err?.message ?? err
        });
        process.exit(1);
    }
    console.log(`Email Relay listening on ${LISTEN_HOST}:${PORT}`);
    console.log(`SMTP: ${SMTP_HOST}:${SMTP_PORT} (configured: ${SMTP_USER ? 'yes' : 'no'})`);
});
