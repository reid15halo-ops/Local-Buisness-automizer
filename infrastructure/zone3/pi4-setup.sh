#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions 95/5 Architecture — Zone 3
# Component 3.3: Raspberry Pi 4 (Network Guardian)
# Roles: Tailscale subnet router, Pi-hole DNS, Uptime Kuma monitoring
#
# Target OS : Raspberry Pi OS Bullseye (64-bit recommended)
# Run as    : sudo bash pi4-setup.sh
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
STATIC_IP="${STATIC_IP:-192.168.1.10}"
STATIC_ROUTER="${STATIC_ROUTER:-192.168.1.1}"
STATIC_DNS="${STATIC_DNS:-127.0.0.1}"           # Pi-hole will answer locally
SUBNET_TO_ADVERTISE="${SUBNET_TO_ADVERTISE:-192.168.1.0/24}"
TAILSCALE_AUTHKEY="${TAILSCALE_AUTHKEY:-}"       # export TAILSCALE_AUTHKEY=tskey-...
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
SUPABASE_URL="${SUPABASE_URL:-}"                 # https://xxxx.supabase.co
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
UPTIME_KUMA_PORT=3001
PIHOLE_WEB_PASSWORD="${PIHOLE_WEB_PASSWORD:-changeme_pihole}"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Must be run as root (sudo)."
command -v apt-get &>/dev/null || die "This script requires apt-get (Debian/Raspberry Pi OS)."

info "============================================================"
info "  FreyAI Zone 3 — Raspberry Pi 4 (Network Guardian) Setup  "
info "============================================================"

# ── 1. System update ──────────────────────────────────────────────────────────
info "[1/9] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    curl wget git apt-transport-https ca-certificates \
    gnupg2 software-properties-common lsb-release \
    dnsutils net-tools htop unzip
success "System packages updated."

# ── 2. Static IP via dhcpcd.conf ──────────────────────────────────────────────
info "[2/9] Configuring static IP ${STATIC_IP}..."
DHCPCD_CONF=/etc/dhcpcd.conf
if ! grep -q "# FreyAI static IP" "${DHCPCD_CONF}" 2>/dev/null; then
    cat >> "${DHCPCD_CONF}" <<EOF

# FreyAI static IP — managed by pi4-setup.sh
interface eth0
static ip_address=${STATIC_IP}/24
static routers=${STATIC_ROUTER}
static domain_name_servers=${STATIC_DNS}
EOF
    success "Static IP configured in ${DHCPCD_CONF}."
else
    warn "Static IP block already present in ${DHCPCD_CONF} — skipping."
fi

# ── 3. SSH hardening ──────────────────────────────────────────────────────────
info "[3/9] Hardening SSH (key-only, no passwords)..."
SSHD_CONF=/etc/ssh/sshd_config
# Back up original once
[[ ! -f "${SSHD_CONF}.bak" ]] && cp "${SSHD_CONF}" "${SSHD_CONF}.bak"

apply_sshd_setting() {
    local key="$1" val="$2"
    if grep -qE "^#?${key}" "${SSHD_CONF}"; then
        sed -i "s|^#\?${key}.*|${key} ${val}|g" "${SSHD_CONF}"
    else
        echo "${key} ${val}" >> "${SSHD_CONF}"
    fi
}

apply_sshd_setting "PasswordAuthentication"    "no"
apply_sshd_setting "ChallengeResponseAuthentication" "no"
apply_sshd_setting "UsePAM"                    "no"
apply_sshd_setting "PermitRootLogin"           "no"
apply_sshd_setting "PubkeyAuthentication"      "yes"
apply_sshd_setting "AuthorizedKeysFile"        ".ssh/authorized_keys"
apply_sshd_setting "X11Forwarding"             "no"
apply_sshd_setting "MaxAuthTries"              "3"

systemctl reload sshd
success "SSH hardened — password auth disabled."

# ── 4. Enable IP forwarding (required for subnet router) ─────────────────────
info "[4/9] Enabling IP forwarding for Tailscale subnet router..."
SYSCTL_FILE=/etc/sysctl.d/99-freyai-forward.conf
cat > "${SYSCTL_FILE}" <<EOF
# FreyAI — IP forwarding for Tailscale subnet router
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
EOF
sysctl --system -q
success "IP forwarding enabled."

# ── 5. Install Tailscale ──────────────────────────────────────────────────────
info "[5/9] Installing Tailscale..."
if ! command -v tailscale &>/dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    success "Tailscale installed."
else
    warn "Tailscale already installed — skipping install."
fi

systemctl enable --now tailscaled

if tailscale status &>/dev/null 2>&1 | grep -q "Logged out" || \
   ! tailscale status --json 2>/dev/null | grep -q '"BackendState":"Running"'; then
    if [[ -n "${TAILSCALE_AUTHKEY}" ]]; then
        info "Connecting Tailscale (subnet router + exit node)..."
        tailscale up \
            --authkey="${TAILSCALE_AUTHKEY}" \
            --advertise-routes="${SUBNET_TO_ADVERTISE}" \
            --advertise-exit-node \
            --accept-dns=false \
            --hostname=pi4-guardian
        success "Tailscale connected as pi4-guardian."
    else
        warn "TAILSCALE_AUTHKEY not set — run manually:"
        warn "  tailscale up --advertise-routes=${SUBNET_TO_ADVERTISE} --advertise-exit-node --accept-dns=false --hostname=pi4-guardian"
    fi
else
    warn "Tailscale already running — skipping up."
fi

# ── 6. Install Pi-hole (unattended) ───────────────────────────────────────────
info "[6/9] Installing Pi-hole (unattended)..."
if ! command -v pihole &>/dev/null; then
    # Write setup variables file for unattended install
    PIHOLE_SETUP_DIR=/etc/pihole
    mkdir -p "${PIHOLE_SETUP_DIR}"
    cat > "${PIHOLE_SETUP_DIR}/setupVars.conf" <<EOF
PIHOLE_INTERFACE=eth0
IPV4_ADDRESS=${STATIC_IP}/24
IPV6_ADDRESS=
PIHOLE_DNS_1=1.1.1.1
PIHOLE_DNS_2=1.0.0.1
QUERY_LOGGING=true
INSTALL_WEB_SERVER=true
INSTALL_WEB_INTERFACE=true
LIGHTTPD_ENABLED=true
CACHE_SIZE=10000
DNS_FQDN_REQUIRED=false
DNS_BOGUS_PRIV=true
DNSMASQ_LISTENING=local
WEBPASSWORD=$(echo -n "${PIHOLE_WEB_PASSWORD}" | sha256sum | awk '{print $1}')
BLOCKING_ENABLED=true
EOF

    curl -fsSL https://install.pi-hole.net | bash /dev/stdin --unattended
    success "Pi-hole installed."
else
    warn "Pi-hole already installed — skipping install."
fi

# Add extra blocklists
info "Adding Pi-hole blocklists..."
PIHOLE_DB=/etc/pihole/gravity.db
if [[ -f "${PIHOLE_DB}" ]]; then
    declare -a BLOCKLISTS=(
        "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts"
        "https://adaway.org/hosts.txt"
        "https://v.firebog.net/hosts/AdguardDNS.txt"
        "https://v.firebog.net/hosts/Easylist.txt"
        "https://raw.githubusercontent.com/nicehash/NiceHashBlockChain/master/blocklist.hosts"
        "https://raw.githubusercontent.com/DandelionSprout/adfilt/master/Alternate%20versions%20Anti-Malware%20List/AntiMalwareHosts.txt"
    )
    for LIST in "${BLOCKLISTS[@]}"; do
        sqlite3 "${PIHOLE_DB}" \
            "INSERT OR IGNORE INTO adlist (address, enabled, comment) VALUES ('${LIST}', 1, 'FreyAI auto-added');" \
            2>/dev/null || true
    done
    pihole -g 2>/dev/null || true
    success "Pi-hole blocklists added and gravity updated."
fi

# Set upstream DNS to Cloudflare via pihole config
PIHOLE_CUSTOM_DNS=/etc/dnsmasq.d/99-freyai-upstream.conf
cat > "${PIHOLE_CUSTOM_DNS}" <<EOF
# FreyAI — Cloudflare upstream DNS
server=1.1.1.1
server=1.0.0.1
# DoT option (requires DNS-over-TLS support)
# server=1.1.1.1@853
EOF
pihole restartdns 2>/dev/null || systemctl restart pihole-FTL 2>/dev/null || true
success "Pi-hole upstream DNS set to Cloudflare 1.1.1.1 / 1.0.0.1."

# ── 7. Install Docker ─────────────────────────────────────────────────────────
info "[7/9] Installing Docker..."
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker pi 2>/dev/null || true
    systemctl enable --now docker
    success "Docker installed."
else
    warn "Docker already installed — skipping."
fi

# ── 8. Install Uptime Kuma (Docker) ──────────────────────────────────────────
info "[8/9] Deploying Uptime Kuma..."
KUMA_DATA_DIR=/opt/freyai/uptime-kuma
mkdir -p "${KUMA_DATA_DIR}"

# Docker Compose for Uptime Kuma
cat > "${KUMA_DATA_DIR}/docker-compose.yml" <<EOF
version: "3.8"
services:
  uptime-kuma:
    image: louislam/uptime-kuma:latest
    container_name: uptime-kuma
    restart: unless-stopped
    ports:
      - "${UPTIME_KUMA_PORT}:3001"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_EXTRA_CA_CERTS=/app/data/custom-ca.crt
EOF

if ! docker ps --format '{{.Names}}' | grep -q "uptime-kuma"; then
    docker compose -f "${KUMA_DATA_DIR}/docker-compose.yml" up -d
    success "Uptime Kuma started on port ${UPTIME_KUMA_PORT}."
else
    warn "Uptime Kuma container already running."
fi

# Uptime Kuma auto-provisioning script (run after first start)
cat > /opt/freyai/kuma-provision.sh <<'KUMA_EOF'
#!/usr/bin/env bash
# Run AFTER Uptime Kuma is fully started to auto-add monitors.
# Requires: curl, jq
set -euo pipefail
KUMA_URL="${KUMA_URL:-http://localhost:3001}"
KUMA_USER="${KUMA_USER:-admin}"
KUMA_PASS="${KUMA_PASS:-changeme_kuma}"

wait_kuma() {
    echo "Waiting for Uptime Kuma to be ready..."
    for i in $(seq 1 30); do
        curl -sf "${KUMA_URL}" &>/dev/null && break
        sleep 2
    done
}

login() {
    TOKEN=$(curl -sf -X POST "${KUMA_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"${KUMA_USER}\",\"password\":\"${KUMA_PASS}\"}" \
        | jq -r '.tokenInfo.token')
    echo "${TOKEN}"
}

add_monitor() {
    local TOKEN="$1" NAME="$2" URL="$3" TYPE="${4:-http}"
    curl -sf -X POST "${KUMA_URL}/api/monitor" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "{\"type\":\"${TYPE}\",\"name\":\"${NAME}\",\"url\":\"${URL}\",\"interval\":60}" \
        > /dev/null
    echo "Monitor added: ${NAME}"
}

wait_kuma
TOKEN=$(login)

# Add monitors — adjust URLs to match your Tailscale/public endpoints
add_monitor "${TOKEN}" "Hetzner n8n (Zone 2)"       "${N8N_URL:-https://n8n.yourdomain.com}"
add_monitor "${TOKEN}" "Supabase Health (Zone 1)"   "${SUPABASE_URL:-https://xxxx.supabase.co}/rest/v1/"
add_monitor "${TOKEN}" "FreyAI Backend API"         "${API_URL:-https://api.yourdomain.com}/health"
add_monitor "${TOKEN}" "ThinkCentre Staging"        "http://thinkcenter-m75n:3000"
add_monitor "${TOKEN}" "Pi-hole DNS"                "http://localhost/admin" "http"

echo "All monitors provisioned."
KUMA_EOF
chmod +x /opt/freyai/kuma-provision.sh

# Uptime Kuma → Supabase push script
cat > /opt/freyai/kuma-push-supabase.sh <<'PUSH_EOF'
#!/usr/bin/env bash
# Called by a webhook from Uptime Kuma (or cron) to log status to Supabase.
set -euo pipefail
SUPABASE_URL="${SUPABASE_URL}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"
SERVICE_NAME="${1:-unknown}"
STATUS="${2:-unknown}"       # up / down
LATENCY_MS="${3:-0}"

PAYLOAD=$(jq -n \
    --arg svc "${SERVICE_NAME}" \
    --arg status "${STATUS}" \
    --argjson lat "${LATENCY_MS}" \
    '{service: $svc, status: $status, latency_ms: $lat, reported_by: "pi4-guardian"}')

curl -sf -X POST \
    "${SUPABASE_URL}/rest/v1/notifications" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "${PAYLOAD}" || true
PUSH_EOF
chmod +x /opt/freyai/kuma-push-supabase.sh

# Telegram alert script
cat > /opt/freyai/telegram-alert.sh <<'TG_EOF'
#!/usr/bin/env bash
set -euo pipefail
BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
CHAT_ID="${TELEGRAM_CHAT_ID}"
MSG="$*"
curl -sf "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}&text=${MSG}&parse_mode=HTML" > /dev/null
TG_EOF
chmod +x /opt/freyai/telegram-alert.sh

success "Uptime Kuma deployment complete."

# ── 9. Systemd services & cron ────────────────────────────────────────────────
info "[9/9] Configuring systemd services..."

# Uptime Kuma auto-start (via Docker, already handled by Docker)
# Ensure Docker itself starts on boot
systemctl enable docker

# Health watchdog cron — posts Pi status to Supabase every 5 min
CRON_FILE=/etc/cron.d/freyai-pi-health
cat > "${CRON_FILE}" <<'CRONEOF'
# FreyAI Pi4 Guardian — health ping every 5 minutes
*/5 * * * * root /opt/freyai/kuma-push-supabase.sh "pi4-guardian" "up" 0 >> /var/log/freyai-health.log 2>&1
CRONEOF

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Zone 3 — Raspberry Pi 4 (Network Guardian) — COMPLETE  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Static IP      : ${STATIC_IP}"
echo "  SSH             : Key-only auth (password disabled)"
echo ""
echo "  Services running:"
echo "    Tailscale     : $(tailscale status --json 2>/dev/null | grep -o '"BackendState":"[^"]*"' | cut -d'"' -f4 || echo 'check manually')"
echo "    Pi-hole       : $(systemctl is-active pihole-FTL 2>/dev/null || echo 'inactive')"
echo "    Uptime Kuma   : http://${STATIC_IP}:${UPTIME_KUMA_PORT}"
echo "    Docker        : $(docker ps --format '{{.Names}}' 2>/dev/null | tr '\n' ' ')"
echo ""
echo "  Next steps:"
echo "    1. Run: /opt/freyai/kuma-provision.sh (after setting KUMA_PASS)"
echo "    2. In Tailscale admin, approve subnet route: ${SUBNET_TO_ADVERTISE}"
echo "    3. In Tailscale admin, approve exit node: pi4-guardian"
echo ""
