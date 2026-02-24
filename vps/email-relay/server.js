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
    // Strip script tags and inline event handlers to prevent XSS into email clients
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
}

// --- Config from environment ---
const PORT = parseInt(process.env.PORT || '3100');
const API_SECRET = process.env.API_SECRET || '';

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

// --- Recipient Validator (TODO 4) ---
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

// --- Per-sender rate limiter for bulk endpoint (TODO 3) ---
const senderRateLimits = new Map();
const BULK_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BULK_RATE_LIMIT_MAX = 200; // max 200 emails per sender per 5 min window

function checkBulkRateLimit(senderKey) {
  const now = Date.now();
  const entry = senderRateLimits.get(senderKey);
  if (!entry || now - entry.windowStart > BULK_RATE_LIMIT_WINDOW_MS) {
    senderRateLimits.set(senderKey, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= BULK_RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// --- Fastify Server ---
const app = Fastify({ logger: true });

// Auth middleware
app.addHook('onRequest', async (request, reply) => {
    // Skip health check
    if (request.url === '/health') return;

    const authHeader = request.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '');

    if (!API_SECRET) {
        reply.code(500).send({ error: 'API_SECRET nicht konfiguriert' });
        return;
    }

    // Use constant-time comparison via SHA-256 hashes to prevent timing side-channel attacks.
    // Hashing both values to equal fixed length avoids the length leak that an early-exit
    // length check would introduce before timingSafeEqual.
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

    // Validate recipients (TODO 4)
    const toArray = Array.isArray(to) ? to : [to];
    const recipientCheck = validateRecipients(toArray);
    if (!recipientCheck.valid) {
        return reply.code(400).send({ error: recipientCheck.error });
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
            // Auto-detect HTML or convert plain text
            if (body.includes('<') && body.includes('>')) {
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
        const recipient = Array.isArray(to) ? to.join(', ') : to;
        const emailSubject = subject;
        console.error('[email-relay] Failed to send email', {
            to: recipient,
            subject: emailSubject,
            error: err?.message ?? err
        });
        return reply.code(500).send({
            error: 'E-Mail Versand fehlgeschlagen',
            details: err.message,
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

    // Per-sender rate limit (TODO 3)
    const senderKey = request.body?.from || request.ip;
    if (!checkBulkRateLimit(senderKey)) {
        return reply.code(429).send({ error: 'Bulk rate limit exceeded. Try again later.' });
    }

    const results = [];
    for (const email of emails) {
        try {
            const info = await transporter.sendMail({
                from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
                to: email.to,
                subject: email.subject,
                html: email.body?.includes('<')
                    ? email.body
                    : `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6;">${email.body}</pre>`,
            });
            results.push({ to: email.to, success: true, messageId: info.messageId });
        } catch (err) {
            results.push({ to: email.to, success: false, error: err.message });
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
        return { success: true, message: 'SMTP-Verbindung zu Proton Mail Bridge OK' };
    } catch (err) {
        return reply.code(500).send({
            success: false,
            error: 'SMTP-Verbindung fehlgeschlagen',
            details: err.message,
        });
    }
});

// --- Start ---
app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error('[email-relay] Failed to start server', {
            error: err?.message ?? err
        });
        process.exit(1);
    }
    console.log(`Email Relay listening on port ${PORT}`);
    console.log(`SMTP: ${SMTP_HOST}:${SMTP_PORT} (User: ${SMTP_USER || 'NOT SET'})`);
});
