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

    if (!API_SECRET || token.length !== API_SECRET.length ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(API_SECRET))) {
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
            mailOptions.html = html;
        } else if (body) {
            // Auto-detect HTML or convert plain text
            if (body.includes('<') && body.includes('>')) {
                mailOptions.html = body;
            } else {
                mailOptions.text = body;
                mailOptions.html = `<pre style="font-family: Arial, Helvetica, sans-serif; white-space: pre-wrap; line-height: 1.6;">${body}</pre>`;
            }
        }

        const info = await transporter.sendMail(mailOptions);

        return {
            success: true,
            messageId: info.messageId,
            accepted: info.accepted,
        };
    } catch (err) {
        request.log.error(err, 'Email send failed');
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
        console.error(err);
        process.exit(1);
    }
    console.log(`Email Relay listening on port ${PORT}`);
    console.log(`SMTP: ${SMTP_HOST}:${SMTP_PORT} (User: ${SMTP_USER || 'NOT SET'})`);
});
