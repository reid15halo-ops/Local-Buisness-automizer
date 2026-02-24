#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions 95/5 Architecture — Zone 3
# Component 3.2: Lenovo ThinkCentre M75n Nano (Edge Compute Node)
# Roles: Docker host, Coolify, n8n staging, Portainer
#
# Target OS : Ubuntu 22.04 LTS
# Run as    : sudo bash thinkcenter-setup.sh
# Idempotent: Yes — safe to re-run
# =============================================================================
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Configuration ─────────────────────────────────────────────────────────────
HOSTNAME_NEW="thinkcenter-m75n"
TAILSCALE_AUTHKEY="${TAILSCALE_AUTHKEY:-}"
N8N_STAGING_PORT=5679
PORTAINER_PORT=9001
COOLIFY_INSTALL_DIR="/data/coolify"
UPTIME_KUMA_PUSH_URL="${UPTIME_KUMA_PUSH_URL:-}"   # Kuma push URL from Pi4

# ── Pre-flight ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Must be run as root (sudo)."
. /etc/os-release
[[ "${ID}" != "ubuntu" ]] && warn "This script targets Ubuntu; running on ${ID}."

info "============================================================"
info "  FreyAI Zone 3 — ThinkCentre M75n Nano (Edge Compute)     "
info "============================================================"

# ── 1. System update & hostname ───────────────────────────────────────────────
info "[1/9] Updating system and setting hostname..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    curl wget git ca-certificates gnupg lsb-release \
    apt-transport-https software-properties-common \
    net-tools htop unzip jq cpufrequtils

# Set hostname
CURRENT_HOSTNAME=$(hostname)
if [[ "${CURRENT_HOSTNAME}" != "${HOSTNAME_NEW}" ]]; then
    hostnamectl set-hostname "${HOSTNAME_NEW}"
    # Update /etc/hosts
    sed -i "s|${CURRENT_HOSTNAME}|${HOSTNAME_NEW}|g" /etc/hosts 2>/dev/null || true
    echo "127.0.1.1  ${HOSTNAME_NEW}" >> /etc/hosts
    success "Hostname set to ${HOSTNAME_NEW}."
else
    warn "Hostname already ${HOSTNAME_NEW}."
fi

# ── 2. Install Docker + Docker Compose ───────────────────────────────────────
info "[2/9] Installing Docker..."
if ! command -v docker &>/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    success "Docker installed."
else
    warn "Docker already installed: $(docker --version)."
fi

# Add current SUDO_USER to docker group
REAL_USER="${SUDO_USER:-ubuntu}"
usermod -aG docker "${REAL_USER}" 2>/dev/null || true

# ── 3. Install Tailscale ──────────────────────────────────────────────────────
info "[3/9] Installing Tailscale..."
if ! command -v tailscale &>/dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    success "Tailscale installed."
else
    warn "Tailscale already installed."
fi
systemctl enable --now tailscaled

if [[ -n "${TAILSCALE_AUTHKEY}" ]]; then
    tailscale up \
        --authkey="${TAILSCALE_AUTHKEY}" \
        --hostname="${HOSTNAME_NEW}" \
        --accept-dns=false \
    2>/dev/null || warn "Tailscale already connected or authkey invalid."
    success "Tailscale connected as ${HOSTNAME_NEW}."
else
    warn "TAILSCALE_AUTHKEY not set — run manually: tailscale up --hostname=${HOSTNAME_NEW}"
fi

# ── 4. Install Portainer ──────────────────────────────────────────────────────
info "[4/9] Deploying Portainer (container management)..."
if ! docker ps --format '{{.Names}}' | grep -q "portainer"; then
    docker volume create portainer_data 2>/dev/null || true
    docker run -d \
        --name portainer \
        --restart=unless-stopped \
        -p "${PORTAINER_PORT}:9000" \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v portainer_data:/data \
        portainer/portainer-ce:latest
    success "Portainer started on http://${HOSTNAME_NEW}:${PORTAINER_PORT}."
else
    warn "Portainer already running."
fi

# ── 5. Install Coolify ────────────────────────────────────────────────────────
info "[5/9] Installing Coolify (self-hosted PaaS)..."
if [[ ! -f "${COOLIFY_INSTALL_DIR}/docker-compose.yml" ]]; then
    mkdir -p "${COOLIFY_INSTALL_DIR}"
    curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash \
    && success "Coolify installed." \
    || warn "Coolify install encountered issues — check logs."
else
    warn "Coolify already installed at ${COOLIFY_INSTALL_DIR}."
fi

# ── 6. n8n staging environment ───────────────────────────────────────────────
info "[6/9] Deploying n8n staging environment..."
N8N_STAGING_DIR=/opt/freyai/n8n-staging
mkdir -p "${N8N_STAGING_DIR}"

cat > "${N8N_STAGING_DIR}/docker-compose.yml" <<EOF
version: "3.8"

# ── n8n Staging — FreyAI Zone 3 (ThinkCentre M75n) ──────────────────────────
# Mirrors production on Hetzner but uses separate DB and is non-production.
# Access: http://thinkcenter-m75n:${N8N_STAGING_PORT}

volumes:
  n8n_staging_data:
  postgres_staging_data:

services:
  postgres-staging:
    image: postgres:15-alpine
    container_name: n8n-staging-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: n8n_staging
      POSTGRES_USER: n8n
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-changeme_staging}
    volumes:
      - postgres_staging_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U n8n -d n8n_staging"]
      interval: 30s
      timeout: 10s
      retries: 3

  n8n-staging:
    image: n8nio/n8n:latest
    container_name: n8n-staging
    restart: unless-stopped
    ports:
      - "${N8N_STAGING_PORT}:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=\${N8N_USER:-admin}
      - N8N_BASIC_AUTH_PASSWORD=\${N8N_PASSWORD:-changeme_staging}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres-staging
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n_staging
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=\${POSTGRES_PASSWORD:-changeme_staging}
      - N8N_HOST=thinkcenter-m75n
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=staging
      - WEBHOOK_URL=http://thinkcenter-m75n:${N8N_STAGING_PORT}/
      - GENERIC_TIMEZONE=UTC
      - N8N_LOG_LEVEL=info
    volumes:
      - n8n_staging_data:/home/node/.n8n
    depends_on:
      postgres-staging:
        condition: service_healthy
EOF

if ! docker compose -f "${N8N_STAGING_DIR}/docker-compose.yml" ps --quiet 2>/dev/null | grep -q .; then
    docker compose -f "${N8N_STAGING_DIR}/docker-compose.yml" up -d
    success "n8n staging started on port ${N8N_STAGING_PORT}."
else
    warn "n8n staging already running."
fi

# ── 7. Systemd auto-start services ───────────────────────────────────────────
info "[7/9] Creating systemd service for auto-start..."
cat > /etc/systemd/system/freyai-staging.service <<EOF
[Unit]
Description=FreyAI n8n Staging Stack
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${N8N_STAGING_DIR}
ExecStart=/usr/bin/docker compose -f ${N8N_STAGING_DIR}/docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f ${N8N_STAGING_DIR}/docker-compose.yml down
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable freyai-staging.service
success "freyai-staging.service enabled for auto-start."

# ── 8. Low power / performance tuning ────────────────────────────────────────
info "[8/9] Configuring low-power mode (disable turbo when idle)..."
# cpufreq ondemand governor with conservative settings
if command -v cpufreq-set &>/dev/null; then
    for CPU in /sys/devices/system/cpu/cpu[0-9]*; do
        CPU_ID=$(basename "${CPU}")
        cpufreq-set -c "${CPU_ID##cpu}" -g ondemand 2>/dev/null || true
    done
    success "CPU governor set to ondemand."
else
    warn "cpufrequtils not fully available — setting via sysfs..."
    for GOV_FILE in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
        [[ -f "${GOV_FILE}" ]] && echo ondemand > "${GOV_FILE}" 2>/dev/null || true
    done
fi

# Persist via /etc/rc.local equivalent
cat > /etc/systemd/system/freyai-lowpower.service <<EOF
[Unit]
Description=FreyAI Low Power Mode (ondemand CPU governor)
After=multi-user.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'for g in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do echo ondemand > \$g 2>/dev/null || true; done'

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable freyai-lowpower.service
success "Low-power service enabled."

# ── 9. Health reporting cron to Uptime Kuma ──────────────────────────────────
info "[9/9] Configuring health reporting cron..."
HEALTH_SCRIPT=/usr/local/bin/freyai-health-report.sh
cat > "${HEALTH_SCRIPT}" <<'HEALTH_EOF'
#!/usr/bin/env bash
# FreyAI ThinkCentre Health Report — pushes metrics to Uptime Kuma push URL
set -euo pipefail
KUMA_PUSH_URL="${UPTIME_KUMA_PUSH_URL:-}"
[[ -z "${KUMA_PUSH_URL}" ]] && exit 0

# Check n8n staging
N8N_PORT="${N8N_STAGING_PORT:-5679}"
if curl -sf "http://localhost:${N8N_PORT}" &>/dev/null; then
    STATUS="up"; MSG="n8n staging OK"
else
    STATUS="down"; MSG="n8n staging unreachable"
fi

# Push to Kuma (push monitor format)
curl -sf "${KUMA_PUSH_URL}?status=${STATUS}&msg=${MSG}&ping=$(ping -c1 8.8.8.8 | grep -oP 'time=\K[\d.]+')" \
    > /dev/null 2>&1 || true
HEALTH_EOF
chmod +x "${HEALTH_SCRIPT}"

CRON_FILE=/etc/cron.d/freyai-thinkcenter-health
cat > "${CRON_FILE}" <<CRONEOF
# FreyAI ThinkCentre health report — every 5 minutes
*/5 * * * * root N8N_STAGING_PORT=${N8N_STAGING_PORT} UPTIME_KUMA_PUSH_URL="${UPTIME_KUMA_PUSH_URL}" ${HEALTH_SCRIPT} >> /var/log/freyai-health.log 2>&1
CRONEOF

success "Health reporting cron installed."

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Zone 3 — ThinkCentre M75n Nano (Edge Compute) — COMPLETE   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Hostname        : ${HOSTNAME_NEW}"
echo "  Services:"
echo "    Coolify       : http://${HOSTNAME_NEW}:8000"
echo "    n8n Staging   : http://${HOSTNAME_NEW}:${N8N_STAGING_PORT}"
echo "    Portainer     : http://${HOSTNAME_NEW}:${PORTAINER_PORT}"
echo ""
echo "  Tailscale       : $(tailscale status --json 2>/dev/null | grep -o '"BackendState":"[^"]*"' | cut -d'"' -f4 || echo 'check manually')"
echo ""
echo "  Next steps:"
echo "    1. Set passwords in ${N8N_STAGING_DIR}/.env"
echo "    2. Open Coolify at :8000 and add projects"
echo "    3. Set UPTIME_KUMA_PUSH_URL in ${CRON_FILE}"
echo ""
