#!/usr/bin/env bash
# ============================================
# Metallbau Buchert — App Deployment Builder
# Baut deploy-hostinger-app/ für Upload auf Hostinger
# ============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR"
DIST="$SCRIPT_DIR/deploy-hostinger-app"

echo "=== Metallbau Buchert App — Build für Hostinger ==="
echo ""

# Clean previous build
if [ -d "$DIST" ]; then
    echo "Lösche altes Build..."
    rm -rf "$DIST"
fi

mkdir -p "$DIST"

# ── 1. HTML files ──────────────────────────────────────
echo "1/8  HTML-Dateien kopieren..."
cp "$SRC/index.html" "$DIST/"
cp "$SRC/auth.html" "$DIST/"
cp "$SRC/customer-portal.html" "$DIST/"
cp "$SRC/offline.html" "$DIST/"

# ── 2. CSS ──────────────────────────────────────────────
echo "2/8  CSS kopieren..."
mkdir -p "$DIST/css"
cp "$SRC/css/"*.css "$DIST/css/"

# ── 3. JavaScript ───────────────────────────────────────
echo "3/8  JavaScript kopieren..."

# js/ root files
mkdir -p "$DIST/js"
for f in "$SRC/js/"*.js; do
    [ -f "$f" ] && cp "$f" "$DIST/js/"
done

# js/services/
mkdir -p "$DIST/js/services"
cp "$SRC/js/services/"*.js "$DIST/js/services/"

# js/modules/
mkdir -p "$DIST/js/modules"
cp "$SRC/js/modules/"*.js "$DIST/js/modules/"

# js/ui/
if [ -d "$SRC/js/ui" ]; then
    mkdir -p "$DIST/js/ui"
    cp "$SRC/js/ui/"*.js "$DIST/js/ui/"
fi

# js/i18n/
if [ -d "$SRC/js/i18n" ]; then
    mkdir -p "$DIST/js/i18n"
    cp -r "$SRC/js/i18n/"* "$DIST/js/i18n/"
fi

# ── 4. Fonts (DSGVO-konform, kein Google CDN) ───────────
echo "4/8  Fonts kopieren..."
mkdir -p "$DIST/fonts"
cp "$SRC/fonts/"*.woff2 "$DIST/fonts/"

# ── 5. Icons & Favicons ────────────────────────────────
echo "5/8  Icons & Favicons kopieren..."
mkdir -p "$DIST/icons"
cp "$SRC/icons/"*.png "$DIST/icons/"
cp "$SRC/favicon.ico" "$DIST/"
cp "$SRC/favicon-32x32.png" "$DIST/"
cp "$SRC/favicon.png" "$DIST/"
cp "$SRC/apple-touch-icon.png" "$DIST/"

# ── 6. PWA files ────────────────────────────────────────
echo "6/8  PWA-Dateien kopieren..."
cp "$SRC/manifest.json" "$DIST/"
cp "$SRC/service-worker.js" "$DIST/"

# ── 7. Config ───────────────────────────────────────────
echo "7/8  Config kopieren..."
mkdir -p "$DIST/config"
cp "$SRC/config/app-config.js" "$DIST/config/"

# ── 8. .htaccess ────────────────────────────────────────
echo "8/8  .htaccess erstellen..."
cat > "$DIST/.htaccess" << 'HTACCESS'
# ============================================
# Metallbau Buchert — app.freyaivisions.de
# Apache Configuration for Hostinger
# ============================================

# ── Force HTTPS ─────────────────────────────
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# ── Security Headers ────────────────────────
<IfModule mod_headers.c>
    # Prevent clickjacking
    Header always set X-Frame-Options "SAMEORIGIN"
    # XSS protection
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    # Referrer policy
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    # HSTS (1 year)
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    # Permissions Policy
    Header always set Permissions-Policy "camera=(), microphone=(self), geolocation=(), payment=(self)"
    # Content Security Policy
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.sheetjs.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.sheetjs.com https://cdnjs.cloudflare.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
</IfModule>

# ── Caching ─────────────────────────────────
<IfModule mod_expires.c>
    ExpiresActive On

    # HTML: no cache (always fresh)
    ExpiresByType text/html "access plus 0 seconds"

    # CSS & JS: 1 week
    ExpiresByType text/css "access plus 1 week"
    ExpiresByType application/javascript "access plus 1 week"
    ExpiresByType text/javascript "access plus 1 week"

    # Fonts: 1 year (they never change)
    ExpiresByType font/woff2 "access plus 1 year"
    ExpiresByType application/font-woff2 "access plus 1 year"

    # Images: 1 month
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/x-icon "access plus 1 month"
    ExpiresByType image/svg+xml "access plus 1 month"

    # JSON: 1 day
    ExpiresByType application/json "access plus 1 day"
    ExpiresByType application/manifest+json "access plus 1 day"
</IfModule>

# ── Compression ─────────────────────────────
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json text/javascript application/manifest+json image/svg+xml font/woff2
</IfModule>

# ── SPA Routing ─────────────────────────────
# Serve index.html for any path that doesn't match a real file
# (enables client-side routing)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(?!auth\.html|customer-portal\.html|offline\.html).*$ /index.html [L]

# ── Block sensitive files ───────────────────
<FilesMatch "\.(env|sql|sh|md|toml|lock|example)$">
    Require all denied
</FilesMatch>

# ── Custom error pages ──────────────────────
ErrorDocument 404 /index.html
ErrorDocument 503 /offline.html
HTACCESS

# ── Summary ─────────────────────────────────
echo ""
echo "=== Build erfolgreich! ==="
echo ""
echo "Dateien in: $DIST/"
echo ""

# Count files
FILE_COUNT=$(find "$DIST" -type f | wc -l)
DIR_SIZE=$(du -sh "$DIST" | cut -f1)

echo "  Dateien:  $FILE_COUNT"
echo "  Größe:    $DIR_SIZE"
echo ""
echo "Nächste Schritte:"
echo "  1. Ordner deploy-hostinger-app/ als ZIP komprimieren"
echo "  2. In Hostinger File Manager hochladen nach public_html/"
echo "  3. ZIP im File Manager entpacken"
echo "  4. Fertig! App erreichbar unter https://app.freyaivisions.de"
echo ""
echo "Siehe deploy-hostinger-app/README_UPLOAD.md für Details."
