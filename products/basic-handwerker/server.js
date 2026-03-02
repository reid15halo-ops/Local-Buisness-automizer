/* ============================================================
   FreyAI Visions — Admin Save Server
   Tiny Node.js server für das Admin-Panel
   Start: node server.js
   ============================================================ */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

/* ── CONFIG ──────────────────────────────────────────────── */
const PORT      = process.env.PORT || 3001;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'handwerk2025';   // In .env setzen!
const ROOT      = __dirname;

/* ── MIME TYPES ──────────────────────────────────────────── */
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico':  'image/x-icon',
    '.woff2':'font/woff2',
    '.woff': 'font/woff',
    '.svg':  'image/svg+xml',
};

/* ── SERVER ──────────────────────────────────────────────── */
const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    // CORS for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    /* ── SAVE ENDPOINT ─────────────────────────────────── */
    if (pathname === '/admin/save' && req.method === 'POST') {
        // Basic auth check
        const auth = req.headers['authorization'] || '';
        if (auth && auth !== `Bearer ${ADMIN_PASS}`) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Unauthorized' }));
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { config } = JSON.parse(body);
                if (!config || typeof config !== 'string') throw new Error('Invalid payload');

                const configPath = path.join(ROOT, 'config.js');

                // Backup before overwriting
                const backupPath = path.join(ROOT, `config.backup.${Date.now()}.js`);
                if (fs.existsSync(configPath)) {
                    fs.copyFileSync(configPath, backupPath);
                    // Keep only last 5 backups
                    cleanOldBackups(ROOT);
                }

                fs.writeFileSync(configPath, config, 'utf8');
                console.log(`[${new Date().toLocaleString('de-DE')}] Config gespeichert.`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, saved: new Date().toISOString() }));
            } catch (err) {
                console.error('Save error:', err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    /* ── STATIC FILE SERVING ───────────────────────────── */
    let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);

    // Security: prevent directory traversal
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stat) => {
        if (err || stat.isDirectory()) {
            // Try index.html for directories
            if (stat && stat.isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('404 Not Found');
            }
        }

        const ext  = path.extname(filePath).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';

        const stream = fs.createReadStream(filePath);
        res.writeHead(200, { 'Content-Type': mime });
        stream.pipe(res);
        stream.on('error', () => {
            res.writeHead(500);
            res.end('Read error');
        });
    });
});

/* ── BACKUP CLEANUP ──────────────────────────────────────── */
function cleanOldBackups(dir) {
    try {
        const files = fs.readdirSync(dir)
            .filter(f => f.startsWith('config.backup.') && f.endsWith('.js'))
            .sort()
            .reverse();

        files.slice(5).forEach(f => {
            try { fs.unlinkSync(path.join(dir, f)); } catch {}
        });
    } catch {}
}

/* ── START ───────────────────────────────────────────────── */
server.listen(PORT, () => {
    console.log('');
    console.log('  FreyAI Visions — Handwerker Admin Server');
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  Website:     http://localhost:${PORT}/`);
    console.log(`  Admin-Panel: http://localhost:${PORT}/admin.html`);
    console.log(`  Passwort:    ${ADMIN_PASS}`);
    console.log('');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} ist bereits belegt. Anderen Port setzen: PORT=3002 node server.js`);
    } else {
        console.error('Server-Fehler:', err);
    }
    process.exit(1);
});
