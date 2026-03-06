#!/bin/bash
# Postiz + Content Pipeline — Deployment Script
# Usage: DEPLOY_TARGET=user@host bash deploy.sh
set -e

VPS="${DEPLOY_TARGET:?ERROR: DEPLOY_TARGET nicht gesetzt. Beispiel: DEPLOY_TARGET=user@192.168.1.1 bash deploy.sh}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Postiz + Content Pipeline Deployment ==="
echo "Ziel: $VPS"
echo ""

# 1. Postiz Docker Setup
echo "[1/6] Postiz Docker Compose hochladen..."
ssh "$VPS" "mkdir -p /opt/postiz"
scp "$SCRIPT_DIR/docker-compose.yml" "$VPS":/opt/postiz/docker-compose.yml
if [ -f "$SCRIPT_DIR/.env" ]; then
    scp "$SCRIPT_DIR/.env" "$VPS":/opt/postiz/.env
else
    echo "  FEHLER: Keine .env gefunden. Erstelle sie aus .env.example und passe die Werte an."
    echo "  cp $SCRIPT_DIR/.env.example $SCRIPT_DIR/.env && nano $SCRIPT_DIR/.env"
    exit 1
fi

# 2. Postiz starten
echo "[2/6] Postiz Container starten..."
ssh "$VPS" "cd /opt/postiz && docker compose pull && docker compose up -d"

# 3. nginx Reverse Proxy mit HTTPS
echo "[3/6] nginx + TLS Konfiguration..."
ssh "$VPS" "
if [ ! -f /etc/nginx/sites-available/postiz ]; then
    cat > /etc/nginx/sites-available/postiz << 'NGINX'
server {
    listen 80;
    server_name content.freyaivisions.de;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name content.freyaivisions.de;

    ssl_certificate /etc/letsencrypt/live/content.freyaivisions.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/content.freyaivisions.de/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-Frame-Options \"DENY\" always;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}
NGINX
    ln -sf /etc/nginx/sites-available/postiz /etc/nginx/sites-enabled/
    # Certbot SSL (falls noch nicht vorhanden)
    if [ ! -d /etc/letsencrypt/live/content.freyaivisions.de ]; then
        certbot certonly --nginx -d content.freyaivisions.de --non-interactive --agree-tos -m admin@freyaivisions.de
    fi
    nginx -t && systemctl reload nginx
    echo '  nginx + TLS konfiguriert'
else
    echo '  nginx bereits konfiguriert'
fi
"

# 4. Content Pipeline Script deployen
echo "[4/6] Content Pipeline Script deployen..."
scp "$REPO_ROOT/vps/scripts/content_pipeline.py" "$VPS":/home/openclaw/workspace/scripts/content_pipeline.py
ssh "$VPS" "chmod +x /home/openclaw/workspace/scripts/content_pipeline.py"

# 5. OpenClaw Skill deployen
echo "[5/6] Content Pipeline Skill deployen..."
ssh "$VPS" "mkdir -p /home/openclaw/workspace/skills/content-pipeline"
scp "$REPO_ROOT/vps/skills/content-pipeline/SKILL.md" "$VPS":/home/openclaw/workspace/skills/content-pipeline/SKILL.md

# 6. Cron-Job für wöchentliche Content-Generierung
echo "[6/6] Cron-Job einrichten..."
ssh "$VPS" "python3 << 'PYEOF'
import json

FPATH = '/root/.openclaw/cron/jobs.json'
try:
    data = json.load(open(FPATH))
except:
    data = {'jobs': []}

existing_ids = {j['id'] for j in data['jobs']}

job = {
    'id': 'content-generate-weekly',
    'cron': '0 10 * * 1',
    'prompt': 'EXEC python3 /home/openclaw/workspace/scripts/content_pipeline.py generate && python3 /home/openclaw/workspace/scripts/content_pipeline.py schedule — SCHWEIGEN. Kein Telegram senden. Nur bei Fehler benachrichtigen.',
    'enabled': True
}

if job['id'] not in existing_ids:
    data['jobs'].append(job)
    json.dump(data, open(FPATH, 'w'), indent=2, ensure_ascii=False)
    print('Cron-Job hinzugefuegt: Woechentliche Content-Generierung (Mo 10:00)')
else:
    print('Cron-Job existiert bereits')
PYEOF"

echo ""
echo "=== Deployment abgeschlossen ==="
echo ""
echo "Postiz UI:        https://content.freyaivisions.de"
echo "Content Script:   /home/openclaw/workspace/scripts/content_pipeline.py"
echo "Content Skill:    /home/openclaw/workspace/skills/content-pipeline/"
echo "Content Ordner:   /home/openclaw/workspace/content/"
echo "Cron:             Montag 10:00 — automatische Generierung + Scheduling"
echo ""
echo "Nächste Schritte:"
echo "  1. Postiz UI öffnen und Social Media Accounts verbinden"
