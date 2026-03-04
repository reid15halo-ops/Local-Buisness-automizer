#!/bin/bash
# Deploy Email Relay to Hostinger VPS
# Usage: bash deploy.sh

VPS_IP="72.61.187.24"
VPS_USER="root"
REMOTE_DIR="/opt/freyavision-email"

echo "=== FreyAI Visions Email Relay - Deploy ==="

# 1. Create remote directory
echo "[1/4] Creating remote directory..."
ssh ${VPS_USER}@${VPS_IP} "mkdir -p ${REMOTE_DIR}"

# 2. Copy files
echo "[2/4] Copying files to VPS..."
scp package.json server.js Dockerfile docker-compose.yml .env ${VPS_USER}@${VPS_IP}:${REMOTE_DIR}/

# 3. Build and start
echo "[3/4] Building and starting Docker container..."
ssh ${VPS_USER}@${VPS_IP} "cd ${REMOTE_DIR} && docker compose down 2>/dev/null; docker compose up -d --build"

# 4. Verify
echo "[4/4] Verifying..."
sleep 3
ssh ${VPS_USER}@${VPS_IP} "docker ps --filter name=freyavision-email --format '{{.Status}}'"
echo ""
echo "Health check:"
curl -s http://${VPS_IP}:3100/health | python3 -m json.tool 2>/dev/null || echo "(Health check pending...)"

echo ""
echo "=== Deploy complete ==="
echo "Outbound API: http://${VPS_IP}:3100"
