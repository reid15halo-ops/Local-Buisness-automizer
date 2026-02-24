#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions – Hetzner VPS One-Shot Setup Script
# Target: Ubuntu 22.04 LTS (CPX31 or higher)
# Run as root or with sudo on a fresh VPS
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# Colour helpers
# -----------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_step()    { echo -e "\n${BOLD}${BLUE}==> $*${NC}"; }

die() { log_error "$*"; exit 1; }

# -----------------------------------------------------------------------------
# Prerequisite checks
# -----------------------------------------------------------------------------
[[ $EUID -ne 0 ]] && die "Please run as root: sudo bash setup-hetzner.sh"
[[ "$(lsb_release -si 2>/dev/null)" != "Ubuntu" ]] && \
  log_warn "This script is designed for Ubuntu 22.04 – proceed with caution."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="/opt/freyai"
COMPOSE_FILE="${REPO_DIR}/infrastructure/hetzner/docker-compose.yml"
ENV_FILE="${REPO_DIR}/infrastructure/hetzner/.env"
ENV_EXAMPLE="${SCRIPT_DIR}/.env.example"

echo -e "${BOLD}${CYAN}"
cat << 'BANNER'
  ___              _   _    ___   _
 | __| _ _ ___ _ _| | /_\ |_ _| | |
 | _| '_/ -_) || / |/ _ \ | |  |_|
 |_||_| \___|_, |_/_/ \_\|___| (_)
             |__/
 Hetzner VPS Setup – FreyAI Visions Zone 2
BANNER
echo -e "${NC}"

# -----------------------------------------------------------------------------
# STEP 1 – System update + base package installation
# -----------------------------------------------------------------------------
log_step "Step 1/7 – System update and package installation"

export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl \
  wget \
  git \
  ca-certificates \
  gnupg \
  lsb-release \
  htop \
  jq \
  unzip \
  fail2ban \
  ufw \
  restic \
  openssh-client \
  postgresql-client

log_success "Base packages installed"

# -----------------------------------------------------------------------------
# Docker Engine (official repo)
# -----------------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
  log_info "Installing Docker Engine..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  log_success "Docker Engine installed and running"
else
  log_info "Docker already installed: $(docker --version)"
fi

# Ensure docker compose v2 plugin alias exists
if ! docker compose version &>/dev/null; then
  apt-get install -y -qq docker-compose-plugin
fi

# -----------------------------------------------------------------------------
# STEP 2 – Firewall (UFW)
# -----------------------------------------------------------------------------
log_step "Step 2/7 – Configuring UFW firewall"

ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# SSH – keep your session alive
ufw allow 22/tcp comment "SSH"

# HTTP + HTTPS for Traefik
ufw allow 80/tcp  comment "HTTP (Traefik redirect)"
ufw allow 443/tcp comment "HTTPS (Traefik TLS)"

# Block everything else
ufw --force enable
log_success "UFW rules applied: 22, 80, 443 open; all else denied"

# -----------------------------------------------------------------------------
# fail2ban – Protect SSH
# -----------------------------------------------------------------------------
log_info "Configuring fail2ban for SSH..."
cat > /etc/fail2ban/jail.local << 'F2B'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
destemail = root@localhost
action = %(action_mwl)s

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
F2B
systemctl enable --now fail2ban
log_success "fail2ban configured and running"

# -----------------------------------------------------------------------------
# STEP 3 – Tailscale VPN
# -----------------------------------------------------------------------------
log_step "Step 3/7 – Installing and connecting Tailscale"

if ! command -v tailscale &>/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
  log_success "Tailscale installed"
else
  log_info "Tailscale already installed: $(tailscale version)"
fi

# Prompt for auth key if not set in environment
if [[ -z "${TAILSCALE_AUTHKEY:-}" ]]; then
  echo -n "Enter your Tailscale auth key (tskey-auth-...): "
  read -r -s TAILSCALE_AUTHKEY
  echo
fi

tailscale up --authkey="${TAILSCALE_AUTHKEY}" --hostname="freyai-hetzner" --accept-routes
log_success "Tailscale connected – machine: freyai-hetzner"
tailscale status

# -----------------------------------------------------------------------------
# STEP 4 – Clone / copy repository
# -----------------------------------------------------------------------------
log_step "Step 4/7 – Deploying FreyAI application files"

REPO_URL="${FREYAI_REPO_URL:-}"

if [[ -d "${REPO_DIR}/.git" ]]; then
  log_info "Repo already cloned at ${REPO_DIR}, pulling latest..."
  git -C "${REPO_DIR}" pull --ff-only
elif [[ -n "${REPO_URL}" ]]; then
  log_info "Cloning from ${REPO_URL}..."
  git clone "${REPO_URL}" "${REPO_DIR}"
else
  log_warn "FREYAI_REPO_URL not set and no existing clone found."
  log_info "Creating directory and copying local files..."
  mkdir -p "${REPO_DIR}"
  # If running from a local copy, sync current script directory
  rsync -av --exclude='.git' "${SCRIPT_DIR}/../../" "${REPO_DIR}/" 2>/dev/null || \
    log_warn "rsync not available – copy files manually to ${REPO_DIR}"
fi

# Create required runtime directories
mkdir -p "${REPO_DIR}/infrastructure/hetzner"
log_success "Application files ready at ${REPO_DIR}"

# -----------------------------------------------------------------------------
# STEP 5 – Environment file
# -----------------------------------------------------------------------------
log_step "Step 5/7 – Creating .env configuration"

if [[ -f "${ENV_FILE}" ]]; then
  log_warn ".env already exists at ${ENV_FILE} – skipping creation."
  log_warn "Delete it manually and re-run if you want to reconfigure."
else
  if [[ ! -f "${ENV_EXAMPLE}" ]]; then
    # Fallback: look in repo
    ENV_EXAMPLE="${REPO_DIR}/infrastructure/hetzner/.env.example"
  fi

  [[ ! -f "${ENV_EXAMPLE}" ]] && die "Cannot find .env.example at ${ENV_EXAMPLE}"

  cp "${ENV_EXAMPLE}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"

  echo ""
  echo -e "${YELLOW}You must fill in the following required values in ${ENV_FILE}:${NC}"
  echo ""

  # Interactive prompt for critical variables
  prompt_var() {
    local key="$1" desc="$2" current
    current=$(grep "^${key}=YOUR_" "${ENV_FILE}" 2>/dev/null || true)
    if [[ -n "${current}" ]]; then
      echo -n "  ${desc} [${key}]: "
      read -r -s value
      echo
      if [[ -n "${value}" ]]; then
        sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
      fi
    fi
  }

  prompt_var "DOMAIN"                    "Your n8n domain (e.g. n8n.freyai.io)"
  prompt_var "TRAEFIK_EMAIL"             "Email for Let's Encrypt"
  prompt_var "N8N_ENCRYPTION_KEY"        "n8n encryption key (32+ chars)"
  prompt_var "N8N_BASIC_AUTH_USER"       "n8n admin username"
  prompt_var "N8N_BASIC_AUTH_PASSWORD"   "n8n admin password"
  prompt_var "POSTGRES_USER"             "Postgres username"
  prompt_var "POSTGRES_PASSWORD"         "Postgres password"
  prompt_var "SUPABASE_URL"              "Supabase project URL"
  prompt_var "SUPABASE_SERVICE_ROLE_KEY" "Supabase service role key"
  prompt_var "OPENAI_API_KEY"            "OpenAI API key"
  prompt_var "BACKEND_API_KEY"           "Backend shared secret (32+ chars)"
  prompt_var "TAILSCALE_AUTHKEY"         "Tailscale auth key"

  log_success ".env created at ${ENV_FILE}"
  log_warn "Review ${ENV_FILE} and fill in any remaining YOUR_xxx values before continuing."
  echo ""
  echo -n "Press ENTER when .env is complete to continue, or Ctrl+C to abort: "
  read -r
fi

# Validate no placeholder values remain
remaining=$(grep -c "YOUR_" "${ENV_FILE}" 2>/dev/null || true)
if [[ "${remaining}" -gt 0 ]]; then
  log_warn "${remaining} placeholder value(s) still in .env – review before production use."
fi

# -----------------------------------------------------------------------------
# STEP 6 – Docker Compose up
# -----------------------------------------------------------------------------
log_step "Step 6/7 – Starting Docker services"

COMPOSE_DIR="$(dirname "${COMPOSE_FILE}")"

# Ensure acme.json permissions are correct for Traefik
CERTS_DIR="${COMPOSE_DIR}/certs"
mkdir -p "${CERTS_DIR}"
touch "${CERTS_DIR}/acme.json"
chmod 600 "${CERTS_DIR}/acme.json"

log_info "Pulling latest images..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" pull

log_info "Starting services..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d

# Wait for n8n to become healthy
log_info "Waiting for n8n to become ready (up to 60s)..."
for i in $(seq 1 12); do
  if docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" \
      exec -T n8n wget -qO- http://localhost:5678/healthz &>/dev/null; then
    log_success "n8n is healthy"
    break
  fi
  sleep 5
  [[ $i -eq 12 ]] && log_warn "n8n health check timed out – check logs with: docker compose logs n8n"
done

# Install backup cron
log_info "Installing nightly backup cron job..."
BACKUP_SCRIPT="${REPO_DIR}/infrastructure/hetzner/backup-hetzner.sh"
if [[ -f "${BACKUP_SCRIPT}" ]]; then
  chmod +x "${BACKUP_SCRIPT}"
  CRON_LINE="0 2 * * * ${BACKUP_SCRIPT} >> /var/log/freyai-backup.log 2>&1"
  (crontab -l 2>/dev/null | grep -v "backup-hetzner"; echo "${CRON_LINE}") | crontab -
  log_success "Backup cron installed (02:00 UTC daily)"
else
  log_warn "backup-hetzner.sh not found – skipping cron install"
fi

# -----------------------------------------------------------------------------
# STEP 7 – Summary
# -----------------------------------------------------------------------------
log_step "Step 7/7 – Setup complete"

DOMAIN_VAL=$(grep "^DOMAIN=" "${ENV_FILE}" | cut -d= -f2)

echo ""
echo -e "${BOLD}${GREEN}FreyAI Hetzner VPS is live!${NC}"
echo ""
echo -e "  n8n Interface : ${CYAN}https://${DOMAIN_VAL}${NC}"
echo -e "  Traefik       : ${CYAN}https://${DOMAIN_VAL}/traefik${NC}"
echo -e "  Tailscale IP  : ${CYAN}$(tailscale ip -4 2>/dev/null || echo 'run: tailscale ip -4')${NC}"
echo ""
echo -e "  Docker status : ${CYAN}docker compose -f ${COMPOSE_FILE} ps${NC}"
echo -e "  View logs     : ${CYAN}docker compose -f ${COMPOSE_FILE} logs -f${NC}"
echo -e "  Backup now    : ${CYAN}${BACKUP_SCRIPT:-/opt/freyai/infrastructure/hetzner/backup-hetzner.sh}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Verify DNS A record for ${DOMAIN_VAL} → this VPS IP"
echo "  2. Import your n8n workflows from config/n8n-workflows/"
echo "  3. Configure Supabase tables for notification logging"
echo "  4. Test GoCardless webhook endpoints"
echo ""
