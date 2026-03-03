#!/bin/bash
# Postiz + Content Pipeline — Deployment Script für VPS (72.61.187.24)
# Usage: bash deploy.sh
set -e

VPS="root@72.61.187.24"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Postiz + Content Pipeline Deployment ==="
echo ""

# 1. Postiz Docker Setup
echo "[1/5] Postiz Docker Compose hochladen..."
ssh $VPS "mkdir -p /opt/postiz"
scp "$SCRIPT_DIR/docker-compose.yml" $VPS:/opt/postiz/docker-compose.yml
if [ -f "$SCRIPT_DIR/.env" ]; then
    scp "$SCRIPT_DIR/.env" $VPS:/opt/postiz/.env
else
    echo "  WARNUNG: Keine .env gefunden. Kopiere .env.example als Vorlage."
    scp "$SCRIPT_DIR/.env.example" $VPS:/opt/postiz/.env
    echo "  → Bitte /opt/postiz/.env auf dem VPS editieren!"
fi

# 2. Postiz starten
echo "[2/5] Postiz Container starten..."
ssh $VPS "cd /opt/postiz && docker compose pull && docker compose up -d"

# 3. nginx Reverse Proxy (falls noch nicht konfiguriert)
echo "[3/5] nginx Konfiguration prüfen..."
ssh $VPS "
if [ ! -f /etc/nginx/sites-available/postiz ]; then
    cat > /etc/nginx/sites-available/postiz << 'NGINX'
server {
    listen 80;
    server_name content.freyaivisions.de;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
    ln -sf /etc/nginx/sites-available/postiz /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    echo '  nginx konfiguriert'
else
    echo '  nginx bereits konfiguriert'
fi
"

# 4. Content Pipeline Script deployen
echo "[4/5] Content Pipeline Script deployen..."
scp "$REPO_ROOT/vps/scripts/content_pipeline.py" $VPS:/home/openclaw/workspace/scripts/content_pipeline.py
ssh $VPS "chmod +x /home/openclaw/workspace/scripts/content_pipeline.py"

# 5. OpenClaw Skill deployen
echo "[5/5] Content Pipeline Skill deployen..."
ssh $VPS "mkdir -p /home/openclaw/workspace/skills/content-pipeline"
scp "$REPO_ROOT/vps/skills/content-pipeline/SKILL.md" $VPS:/home/openclaw/workspace/skills/content-pipeline/SKILL.md

# 6. Cron-Job für wöchentliche Content-Generierung
echo "[6/5] Cron-Job einrichten..."
ssh $VPS "python3 << 'PYEOF'
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
echo "Postiz UI:        http://72.61.187.24:5000"
echo "Content Script:   /home/openclaw/workspace/scripts/content_pipeline.py"
echo "Content Skill:    /home/openclaw/workspace/skills/content-pipeline/"
echo "Content Ordner:   /home/openclaw/workspace/content/"
echo "Cron:             Montag 10:00 — automatische Generierung + Scheduling"
echo ""
echo "Nächste Schritte:"
echo "  1. /opt/postiz/.env editieren (DB-Passwort + JWT Secret setzen)"
echo "  2. Postiz UI öffnen und Social Media Accounts verbinden"
echo "  3. Optional: SSL via certbot für content.freyaivisions.de"
