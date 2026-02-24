#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions – Hetzner VPS Backup Script
# Destination: NAS via Tailscale + Restic (SFTP)
# Schedule: Daily cron at 02:00 UTC
# =============================================================================
# Backs up:
#   1. n8n_data Docker volume (workflows, credentials, settings)
#   2. Postgres database dump (pg_dump → compressed SQL)
#   3. Application config files (.env, nginx.conf, docker-compose.yml)
#
# Restic retention: 7 daily, 4 weekly, 6 monthly snapshots
# Notifications: Supabase notifications table on success/failure
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration – loaded from environment or /opt/freyai/infrastructure/hetzner/.env
# -----------------------------------------------------------------------------
ENV_FILE="${ENV_FILE:-/opt/freyai/infrastructure/hetzner/.env}"
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a; source "${ENV_FILE}"; set +a
fi

# Required variables (will error if unset)
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required (e.g. sftp:nas-vault:/backups/hetzner)}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"

export RESTIC_REPOSITORY RESTIC_PASSWORD

# -----------------------------------------------------------------------------
# Paths and constants
# -----------------------------------------------------------------------------
BACKUP_TMP="/tmp/freyai-backup-$$"
LOG_FILE="/var/log/freyai-backup.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
HOSTNAME_SHORT=$(hostname -s)
DB_CONTAINER="${DB_CONTAINER:-freyai-postgres}"
N8N_VOLUME="${N8N_VOLUME:-n8n_data}"
CONFIG_DIR="/opt/freyai/infrastructure/hetzner"

# NAS SSH config for Restic SFTP
NAS_SSH_USER="${NAS_SSH_USER:-backup}"
NAS_TAILSCALE_HOSTNAME="${NAS_TAILSCALE_HOSTNAME:-nas-vault}"

# Restic tags
RESTIC_TAGS=(
  "--tag" "freyai"
  "--tag" "hetzner"
  "--tag" "${HOSTNAME_SHORT}"
  "--tag" "$(date -u +%Y-%m-%d)"
)

# Track overall status for notification
BACKUP_STATUS="success"
BACKUP_ERRORS=()

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
log() {
  local level="$1"; shift
  echo "[${TIMESTAMP}] [${level}] $*" | tee -a "${LOG_FILE}"
}
log_info()    { log "INFO " "$*"; }
log_success() { log "OK   " "$*"; }
log_warn()    { log "WARN " "$*"; }
log_error()   { log "ERROR" "$*"; BACKUP_STATUS="failure"; BACKUP_ERRORS+=("$*"); }

cleanup() {
  log_info "Cleaning up temp directory ${BACKUP_TMP}"
  rm -rf "${BACKUP_TMP}"
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
# Notify Supabase – insert into notifications table
# Called on success and failure
# -----------------------------------------------------------------------------
notify_supabase() {
  local status="$1"
  local message="$2"
  local details="${3:-{}}"

  curl -sS --max-time 15 \
    -X POST \
    "${SUPABASE_URL}/rest/v1/notifications" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{
      \"type\": \"backup_${status}\",
      \"source\": \"hetzner-backup\",
      \"message\": \"${message}\",
      \"metadata\": ${details},
      \"created_at\": \"${TIMESTAMP}\"
    }" 2>&1 || log_warn "Supabase notification failed (non-fatal)"
}

# -----------------------------------------------------------------------------
# Pre-flight checks
# -----------------------------------------------------------------------------
preflight() {
  log_info "Running pre-flight checks..."

  # Check restic is installed
  command -v restic >/dev/null 2>&1 || { log_error "restic not installed"; exit 1; }

  # Check Docker is running
  docker info >/dev/null 2>&1 || { log_error "Docker daemon not running"; exit 1; }

  # Check Tailscale connectivity to NAS
  if ! ping -c 1 -W 5 "${NAS_TAILSCALE_HOSTNAME}" >/dev/null 2>&1; then
    log_error "Cannot reach NAS at ${NAS_TAILSCALE_HOSTNAME} via Tailscale"
    exit 1
  fi
  log_success "Pre-flight checks passed"

  # Initialise Restic repository if it doesn't exist yet
  if ! restic snapshots --quiet >/dev/null 2>&1; then
    log_info "Initialising Restic repository at ${RESTIC_REPOSITORY}..."
    restic init
    log_success "Restic repository initialised"
  fi
}

# -----------------------------------------------------------------------------
# STEP 1 – Backup n8n_data Docker volume
# Strategy: Docker volume → tar.gz in temp dir → Restic
# -----------------------------------------------------------------------------
backup_n8n_volume() {
  log_info "Backing up n8n volume: ${N8N_VOLUME}"

  local n8n_backup_dir="${BACKUP_TMP}/n8n"
  mkdir -p "${n8n_backup_dir}"

  # Use a disposable Alpine container to tar the volume contents
  docker run --rm \
    -v "${N8N_VOLUME}:/source:ro" \
    -v "${n8n_backup_dir}:/dest" \
    alpine:3 \
    tar -czf "/dest/n8n_data.tar.gz" -C /source .

  local size
  size=$(du -sh "${n8n_backup_dir}/n8n_data.tar.gz" | cut -f1)
  log_success "n8n volume archived: ${size}"
}

# -----------------------------------------------------------------------------
# STEP 2 – Postgres database dump
# Strategy: pg_dump via docker exec → compressed SQL → temp dir
# -----------------------------------------------------------------------------
backup_postgres() {
  log_info "Dumping Postgres database: ${POSTGRES_DB}"

  local pg_backup_dir="${BACKUP_TMP}/postgres"
  mkdir -p "${pg_backup_dir}"

  # Check the db container is running
  if ! docker inspect "${DB_CONTAINER}" --format "{{.State.Running}}" 2>/dev/null | grep -q "true"; then
    log_error "Postgres container ${DB_CONTAINER} is not running"
    return 1
  fi

  docker exec "${DB_CONTAINER}" \
    pg_dump \
      -U "${POSTGRES_USER}" \
      -d "${POSTGRES_DB}" \
      --no-password \
      --format=custom \
      --compress=9 \
      --verbose \
    > "${pg_backup_dir}/n8n_$(date -u +%Y%m%d_%H%M%S).pgdump" \
    2>>"${LOG_FILE}"

  local size
  size=$(du -sh "${pg_backup_dir}" | cut -f1)
  log_success "Postgres dump complete: ${size}"
}

# -----------------------------------------------------------------------------
# STEP 3 – Backup configuration files
# Includes: .env (encrypted by Restic), docker-compose.yml, nginx.conf
# -----------------------------------------------------------------------------
backup_config() {
  log_info "Backing up configuration files from ${CONFIG_DIR}"

  local config_backup_dir="${BACKUP_TMP}/config"
  mkdir -p "${config_backup_dir}"

  # Copy config files (sensitive – Restic will encrypt at rest)
  for f in docker-compose.yml nginx.conf coolify-app.json .env; do
    if [[ -f "${CONFIG_DIR}/${f}" ]]; then
      cp "${CONFIG_DIR}/${f}" "${config_backup_dir}/"
    fi
  done

  # Also backup n8n workflow exports if they exist
  local workflows_dir="/opt/freyai/config/n8n-workflows"
  if [[ -d "${workflows_dir}" ]]; then
    cp -r "${workflows_dir}" "${config_backup_dir}/n8n-workflows"
  fi

  log_success "Config files staged for backup"
}

# -----------------------------------------------------------------------------
# STEP 4 – Restic backup to NAS
# -----------------------------------------------------------------------------
run_restic_backup() {
  log_info "Running Restic backup to ${RESTIC_REPOSITORY}"

  # Configure SSH for Restic SFTP
  export RESTIC_SFTP_COMMAND="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 -l ${NAS_SSH_USER}"

  restic backup \
    "${RESTIC_TAGS[@]}" \
    --host "${HOSTNAME_SHORT}" \
    --verbose \
    "${BACKUP_TMP}" \
    2>&1 | tee -a "${LOG_FILE}"

  log_success "Restic backup complete"
}

# -----------------------------------------------------------------------------
# STEP 5 – Apply retention policy and prune old snapshots
# Keep: 7 daily, 4 weekly, 6 monthly
# -----------------------------------------------------------------------------
run_restic_forget() {
  log_info "Applying retention policy (7d / 4w / 6m)..."

  restic forget \
    --host "${HOSTNAME_SHORT}" \
    --tag "freyai" \
    --keep-daily 7 \
    --keep-weekly 4 \
    --keep-monthly 6 \
    --prune \
    --verbose \
    2>&1 | tee -a "${LOG_FILE}"

  log_success "Retention policy applied and old snapshots pruned"
}

# -----------------------------------------------------------------------------
# STEP 6 – Verify latest snapshot integrity
# -----------------------------------------------------------------------------
run_restic_check() {
  log_info "Verifying latest snapshot integrity..."

  restic check \
    --read-data-subset=5% \
    2>&1 | tee -a "${LOG_FILE}"

  log_success "Snapshot integrity verified"
}

# -----------------------------------------------------------------------------
# STEP 7 – Report snapshot list
# -----------------------------------------------------------------------------
report_snapshots() {
  log_info "Current snapshots in repository:"
  restic snapshots \
    --host "${HOSTNAME_SHORT}" \
    --tag "freyai" \
    --compact \
    2>&1 | tee -a "${LOG_FILE}"
}

# -----------------------------------------------------------------------------
# Main execution
# -----------------------------------------------------------------------------
main() {
  log_info "====== FreyAI Hetzner Backup Starting ======"
  log_info "Timestamp : ${TIMESTAMP}"
  log_info "Repository: ${RESTIC_REPOSITORY}"
  log_info "Temp dir  : ${BACKUP_TMP}"

  mkdir -p "${BACKUP_TMP}"

  # Run all backup steps, capture errors individually
  preflight          || { log_error "Pre-flight failed"; BACKUP_STATUS="failure"; }
  backup_n8n_volume  || { log_error "n8n volume backup failed"; BACKUP_STATUS="failure"; }
  backup_postgres    || { log_error "Postgres backup failed"; BACKUP_STATUS="failure"; }
  backup_config      || { log_error "Config backup failed"; BACKUP_STATUS="failure"; }

  if [[ "${BACKUP_STATUS}" != "failure" ]]; then
    run_restic_backup   || { log_error "Restic backup failed"; BACKUP_STATUS="failure"; }
    run_restic_forget   || log_warn "Restic forget had issues (non-fatal)"
    run_restic_check    || log_warn "Restic check had issues (non-fatal)"
    report_snapshots
  fi

  # -----------------------------------------------------------------------------
  # Send notification to Supabase
  # -----------------------------------------------------------------------------
  local n8n_size postgres_count
  n8n_size=$(du -sh "${BACKUP_TMP}/n8n" 2>/dev/null | cut -f1 || echo "unknown")
  postgres_count=$(ls -1 "${BACKUP_TMP}/postgres" 2>/dev/null | wc -l || echo "0")

  if [[ "${BACKUP_STATUS}" == "success" ]]; then
    local details
    details=$(cat << DETAILS_EOF
{
  "repository": "${RESTIC_REPOSITORY}",
  "n8n_volume_size": "${n8n_size}",
  "postgres_dumps": ${postgres_count},
  "timestamp": "${TIMESTAMP}",
  "host": "${HOSTNAME_SHORT}",
  "errors": []
}
DETAILS_EOF
)
    notify_supabase "success" "Hetzner backup completed successfully" "${details}"
    log_success "====== Backup SUCCEEDED ======"
    exit 0
  else
    local errors_json
    errors_json=$(printf '%s\n' "${BACKUP_ERRORS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
    local details
    details=$(cat << DETAILS_EOF
{
  "repository": "${RESTIC_REPOSITORY}",
  "timestamp": "${TIMESTAMP}",
  "host": "${HOSTNAME_SHORT}",
  "errors": ${errors_json}
}
DETAILS_EOF
)
    notify_supabase "failure" "Hetzner backup FAILED – check logs on ${HOSTNAME_SHORT}" "${details}"
    log_error "====== Backup FAILED – check ${LOG_FILE} ======"
    exit 1
  fi
}

main "$@"
