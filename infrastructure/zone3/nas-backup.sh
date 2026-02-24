#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions 95/5 Architecture — Zone 3
# Component 3.1: UGREEN NAS 2300 (Sovereign Vault)
# Role: Restic backup receiver — pulls encrypted backups from Hetzner VPS
#
# Run on  : The machine that can SSH to both the NAS and the Hetzner VPS
#           (e.g., the ThinkCentre or Pi4 over Tailscale)
# Idempotent: Yes — safe to re-run
# =============================================================================
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[$(date '+%H:%M:%S')] [INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] [OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[$(date '+%H:%M:%S')] [WARN]${NC}  $*"; }
die()     { echo -e "${RED}[$(date '+%H:%M:%S')] [ERROR]${NC} $*" >&2; exit 1; }

# ── Configuration ─────────────────────────────────────────────────────────────
# NAS connection (SSH)
NAS_HOST="${NAS_HOST:-nas-vault}"               # Tailscale hostname or IP
NAS_USER="${NAS_USER:-admin}"                   # NAS SSH user
NAS_SSH_KEY="${NAS_SSH_KEY:-${HOME}/.ssh/id_freyai_nas}"

# Hetzner VPS connection (via Tailscale)
HETZNER_HOST="${HETZNER_HOST:-hetzner-vps}"    # Tailscale hostname
HETZNER_USER="${HETZNER_USER:-ubuntu}"
HETZNER_SSH_KEY="${HETZNER_SSH_KEY:-${HOME}/.ssh/id_freyai_hetzner}"

# Restic configuration
RESTIC_REPO_BASE="/volume1/backups/freyai"     # Path on NAS
RESTIC_POSTGRES_REPO="${RESTIC_REPO_BASE}/postgres"
RESTIC_N8N_REPO="${RESTIC_REPO_BASE}/n8n"
RESTIC_PASSWORD_FILE="${RESTIC_PASSWORD_FILE:-/etc/freyai/restic-password}"
export RESTIC_PASSWORD_FILE

# Supabase notification endpoint
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
SUPABASE_EDGE_FN="${SUPABASE_URL}/functions/v1/backup-status"

# Retention policy
RETENTION_DAILY=7
RETENTION_WEEKLY=4
RETENTION_MONTHLY=6

# ── Mode selection ─────────────────────────────────────────────────────────────
MODE="${1:-backup}"   # backup | verify | install | status

# =============================================================================
# INSTALL MODE — sets up Restic + cron on the NAS (via SSH)
# =============================================================================
do_install() {
    info "=== INSTALL MODE: Setting up Restic on NAS (${NAS_HOST}) ==="

    # Detect NAS architecture for correct Restic binary
    NAS_ARCH=$(ssh -i "${NAS_SSH_KEY}" "${NAS_USER}@${NAS_HOST}" "uname -m" 2>/dev/null || echo "x86_64")
    case "${NAS_ARCH}" in
        x86_64)         RESTIC_ARCH="amd64" ;;
        aarch64|arm64)  RESTIC_ARCH="arm64" ;;
        armv7l)         RESTIC_ARCH="arm"   ;;
        *)              RESTIC_ARCH="amd64" ;;
    esac

    RESTIC_VERSION="0.16.4"
    RESTIC_URL="https://github.com/restic/restic/releases/download/v${RESTIC_VERSION}/restic_${RESTIC_VERSION}_linux_${RESTIC_ARCH}.bz2"

    info "Installing Restic ${RESTIC_VERSION} (${RESTIC_ARCH}) on NAS..."
    ssh -i "${NAS_SSH_KEY}" "${NAS_USER}@${NAS_HOST}" bash <<NASEOF
set -euo pipefail
if ! command -v restic &>/dev/null; then
    curl -fsSL "${RESTIC_URL}" -o /tmp/restic.bz2
    bunzip2 /tmp/restic.bz2
    chmod +x /tmp/restic
    mv /tmp/restic /usr/local/bin/restic
    echo "Restic installed: \$(restic version)"
else
    echo "Restic already installed: \$(restic version)"
fi

# Create backup directory tree
mkdir -p ${RESTIC_REPO_BASE}/{postgres,n8n}

# Password file for Restic (generate once)
mkdir -p /etc/freyai
if [[ ! -f /etc/freyai/restic-password ]]; then
    openssl rand -base64 48 > /etc/freyai/restic-password
    chmod 600 /etc/freyai/restic-password
    echo "Restic password generated at /etc/freyai/restic-password"
    echo "IMPORTANT: Back up this password — without it backups are unrecoverable."
else
    echo "Restic password file already exists."
fi

# Initialize Restic repos (idempotent)
export RESTIC_PASSWORD_FILE=/etc/freyai/restic-password
restic -r ${RESTIC_POSTGRES_REPO} snapshots &>/dev/null \
    || restic -r ${RESTIC_POSTGRES_REPO} init
restic -r ${RESTIC_N8N_REPO} snapshots &>/dev/null \
    || restic -r ${RESTIC_N8N_REPO} init

echo "Restic repos ready."
NASEOF
    success "Restic installed and repos initialized on NAS."

    # Deploy this script to the NAS
    info "Deploying backup script to NAS..."
    scp -i "${NAS_SSH_KEY}" "$0" "${NAS_USER}@${NAS_HOST}:/usr/local/bin/freyai-nas-backup.sh"
    ssh -i "${NAS_SSH_KEY}" "${NAS_USER}@${NAS_HOST}" "chmod +x /usr/local/bin/freyai-nas-backup.sh"

    # Install cron on NAS
    info "Installing cron job on NAS (daily 03:00)..."
    CRON_LINE="0 3 * * * /usr/local/bin/freyai-nas-backup.sh backup >> /var/log/freyai-backup.log 2>&1"
    CRON_VERIFY="30 3 * * 0 /usr/local/bin/freyai-nas-backup.sh verify >> /var/log/freyai-backup-verify.log 2>&1"
    ssh -i "${NAS_SSH_KEY}" "${NAS_USER}@${NAS_HOST}" bash <<CRONEOF
# Install cron if missing
command -v cron &>/dev/null || (apt-get install -y cron &>/dev/null && systemctl enable --now cron)
# Add cron jobs idempotently
(crontab -l 2>/dev/null | grep -v freyai-nas-backup || true; echo "${CRON_LINE}"; echo "${CRON_VERIFY}") | sort -u | crontab -
echo "Cron installed."
CRONEOF
    success "Cron job installed on NAS."
    success "Install complete. Run '$0 backup' to test."
}

# =============================================================================
# BACKUP MODE — execute backup run
# =============================================================================
do_backup() {
    info "=== BACKUP RUN: $(date '+%Y-%m-%d %H:%M:%S') ==="
    BACKUP_START=$(date +%s)
    BACKUP_ERRORS=0

    # ── Postgres backup from Hetzner ─────────────────────────────────────────
    info "Step 1/4: Dumping PostgreSQL from Hetzner VPS..."
    DUMP_DIR="/tmp/freyai-pg-dump-$(date +%Y%m%d)"
    mkdir -p "${DUMP_DIR}"

    # Run pg_dumpall on Hetzner, stream to local temp dir
    ssh -i "${HETZNER_SSH_KEY}" "${HETZNER_USER}@${HETZNER_HOST}" \
        "docker exec postgres pg_dumpall -U postgres 2>/dev/null || \
         pg_dumpall -U postgres 2>/dev/null || \
         echo 'WARN: pg_dumpall failed, check postgres container'" \
        > "${DUMP_DIR}/postgres-all.sql" \
    && success "PostgreSQL dump pulled from Hetzner." \
    || { warn "PostgreSQL dump failed."; ((BACKUP_ERRORS++)); }

    # ── Backup Postgres dump to NAS via Restic (SFTP) ────────────────────────
    info "Step 2/4: Uploading Postgres dump to NAS Restic repo..."
    restic \
        -r "sftp://${NAS_USER}@${NAS_HOST}:${RESTIC_POSTGRES_REPO}" \
        --password-file "${RESTIC_PASSWORD_FILE}" \
        backup "${DUMP_DIR}" \
        --tag "postgres,hetzner,$(date +%Y-%m-%d)" \
        --verbose=0 \
    && success "Postgres backup committed to Restic." \
    || { warn "Postgres Restic backup failed."; ((BACKUP_ERRORS++)); }

    # Clean up dump
    rm -rf "${DUMP_DIR}"

    # ── n8n volume backup from Hetzner ───────────────────────────────────────
    info "Step 3/4: Backing up n8n data volume from Hetzner..."
    N8N_DUMP_DIR="/tmp/freyai-n8n-dump-$(date +%Y%m%d)"
    mkdir -p "${N8N_DUMP_DIR}"

    # Stream n8n volume as tar from Hetzner
    ssh -i "${HETZNER_SSH_KEY}" "${HETZNER_USER}@${HETZNER_HOST}" \
        "docker run --rm -v n8n_data:/data alpine:latest tar -czf - /data 2>/dev/null" \
        > "${N8N_DUMP_DIR}/n8n-volume.tar.gz" \
    && success "n8n volume pulled from Hetzner." \
    || { warn "n8n volume pull failed."; ((BACKUP_ERRORS++)); }

    restic \
        -r "sftp://${NAS_USER}@${NAS_HOST}:${RESTIC_N8N_REPO}" \
        --password-file "${RESTIC_PASSWORD_FILE}" \
        backup "${N8N_DUMP_DIR}" \
        --tag "n8n,hetzner,$(date +%Y-%m-%d)" \
        --verbose=0 \
    && success "n8n backup committed to Restic." \
    || { warn "n8n Restic backup failed."; ((BACKUP_ERRORS++)); }

    rm -rf "${N8N_DUMP_DIR}"

    # ── Apply retention policy ────────────────────────────────────────────────
    info "Step 4/4: Applying retention policy (${RETENTION_DAILY}d/${RETENTION_WEEKLY}w/${RETENTION_MONTHLY}m)..."
    for REPO in "${RESTIC_POSTGRES_REPO}" "${RESTIC_N8N_REPO}"; do
        restic \
            -r "sftp://${NAS_USER}@${NAS_HOST}:${REPO}" \
            --password-file "${RESTIC_PASSWORD_FILE}" \
            forget \
            --keep-daily "${RETENTION_DAILY}" \
            --keep-weekly "${RETENTION_WEEKLY}" \
            --keep-monthly "${RETENTION_MONTHLY}" \
            --prune \
            --quiet \
        && success "Retention applied for ${REPO}." \
        || { warn "Retention policy failed for ${REPO}."; ((BACKUP_ERRORS++)); }
    done

    # ── Report to Supabase ────────────────────────────────────────────────────
    BACKUP_END=$(date +%s)
    BACKUP_DURATION=$(( BACKUP_END - BACKUP_START ))
    BACKUP_STATUS="success"
    [[ ${BACKUP_ERRORS} -gt 0 ]] && BACKUP_STATUS="partial_failure"

    notify_supabase "${BACKUP_STATUS}" "${BACKUP_DURATION}" "${BACKUP_ERRORS}"

    if [[ ${BACKUP_ERRORS} -eq 0 ]]; then
        success "=== Backup complete in ${BACKUP_DURATION}s — no errors ==="
    else
        warn "=== Backup finished in ${BACKUP_DURATION}s with ${BACKUP_ERRORS} error(s) ==="
        exit 1
    fi
}

# =============================================================================
# VERIFY MODE — run restic check on both repos (weekly)
# =============================================================================
do_verify() {
    info "=== VERIFY MODE: $(date '+%Y-%m-%d %H:%M:%S') ==="
    VERIFY_ERRORS=0

    for REPO_NAME in "postgres" "n8n"; do
        REPO="${RESTIC_REPO_BASE}/${REPO_NAME}"
        info "Verifying ${REPO_NAME} repo..."
        restic \
            -r "sftp://${NAS_USER}@${NAS_HOST}:${REPO}" \
            --password-file "${RESTIC_PASSWORD_FILE}" \
            check \
            --read-data-subset=10% \
        && success "${REPO_NAME} repo integrity OK." \
        || { warn "${REPO_NAME} repo integrity check FAILED."; ((VERIFY_ERRORS++)); }
    done

    notify_supabase "verify_$([ ${VERIFY_ERRORS} -eq 0 ] && echo 'ok' || echo 'failed')" 0 "${VERIFY_ERRORS}"

    [[ ${VERIFY_ERRORS} -eq 0 ]] && success "All repos verified." || { warn "Verification had errors."; exit 1; }
}

# =============================================================================
# STATUS MODE — list recent snapshots
# =============================================================================
do_status() {
    info "=== STATUS: Recent Snapshots ==="
    for REPO_NAME in "postgres" "n8n"; do
        REPO="${RESTIC_REPO_BASE}/${REPO_NAME}"
        echo ""
        info "--- ${REPO_NAME} snapshots ---"
        restic \
            -r "sftp://${NAS_USER}@${NAS_HOST}:${REPO}" \
            --password-file "${RESTIC_PASSWORD_FILE}" \
            snapshots --last 5 \
        || warn "Could not list ${REPO_NAME} snapshots."
    done
}

# =============================================================================
# Supabase notification helper
# =============================================================================
notify_supabase() {
    local STATUS="$1" DURATION="${2:-0}" ERRORS="${3:-0}"
    if [[ -z "${SUPABASE_URL}" ]] || [[ -z "${SUPABASE_ANON_KEY}" ]]; then
        warn "SUPABASE_URL or SUPABASE_ANON_KEY not set — skipping notification."
        return 0
    fi
    PAYLOAD=$(jq -n \
        --arg status "${STATUS}" \
        --argjson duration "${DURATION}" \
        --argjson errors "${ERRORS}" \
        --arg source "nas-backup" \
        --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{status: $status, duration_seconds: $duration, error_count: $errors, source: $source, timestamp: $ts}')

    # Try Edge Function first, fall back to direct table insert
    curl -sf -X POST "${SUPABASE_EDGE_FN}" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "${PAYLOAD}" > /dev/null 2>&1 \
    || curl -sf -X POST "${SUPABASE_URL}/rest/v1/notifications" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "${PAYLOAD}" > /dev/null 2>&1 \
    || warn "Supabase notification failed (non-fatal)."

    success "Supabase notified: status=${STATUS}."
}

# =============================================================================
# Dispatch
# =============================================================================
case "${MODE}" in
    install) do_install ;;
    backup)  do_backup  ;;
    verify)  do_verify  ;;
    status)  do_status  ;;
    *)       die "Unknown mode '${MODE}'. Usage: $0 [install|backup|verify|status]" ;;
esac
