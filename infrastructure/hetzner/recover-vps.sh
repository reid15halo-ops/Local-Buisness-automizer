#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions 95/5 — Zone 2 Hetzner VPS Recovery
# Brings all production services back online after issues.
#
# Services managed:
#   - Traefik (reverse proxy + TLS)
#   - PostgreSQL (n8n metadata)
#   - n8n (workflow engine — the "95")
#   - Backend (FastAPI — the "5")
#   - Watchtower (auto-updates)
#   - Postiz stack (social media scheduling)
#   - Email Relay (SMTP bridge)
#
# Run on:  Hetzner VPS (hetzner-vps / freyai-hetzner)
# Usage:   sudo bash recover-vps.sh [--force]
# =============================================================================
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

PASS=0; FAIL=0; FIXED=0
FORCE="${1:---interactive}"

log()     { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()      { echo -e "  ${GREEN}✓${NC} $*"; ((PASS++)); }
fail()    { echo -e "  ${RED}✗${NC} $*"; ((FAIL++)); }
fixed()   { echo -e "  ${GREEN}⚡${NC} $* ${DIM}(auto-fixed)${NC}"; ((FIXED++)); }
warn()    { echo -e "  ${YELLOW}⚠${NC} $*"; }
header()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${NC}"; }

COMPOSE_DIR="${COMPOSE_DIR:-/opt/freyai}"
POSTIZ_DIR="${POSTIZ_DIR:-/opt/postiz}"
DOMAIN="${DOMAIN:-n8n.freyaivisions.de}"

echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║        FreyAI Zone 2 — VPS Recovery Sequence                ║"
echo "  ║        $(date '+%Y-%m-%d %H:%M:%S')                            ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# PHASE 1: System Health
# =============================================================================
header "Phase 1: System Health"

# Docker daemon
DOCKER_STATE=$(systemctl is-active docker 2>/dev/null || echo "inactive")
if [[ "$DOCKER_STATE" == "active" ]]; then
    ok "Docker Daemon aktiv"
else
    log "Docker starten..."
    systemctl start docker && fixed "Docker gestartet" || fail "Docker konnte nicht gestartet werden"
fi

# Disk space
DISK_PCT=$(df / --output=pcent | tail -1 | tr -dc '0-9')
if [[ "$DISK_PCT" -lt 90 ]]; then
    ok "Festplatte: ${DISK_PCT}% belegt"
else
    warn "Festplatte: ${DISK_PCT}% belegt — Speicher knapp!"
    log "Docker Cleanup..."
    docker system prune -f --volumes 2>/dev/null || true
    fixed "Docker Cleanup durchgeführt"
fi

# Memory
MEM_AVAIL=$(awk '/MemAvailable/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo "0")
if [[ "$MEM_AVAIL" -gt 512 ]]; then
    ok "RAM verfügbar: ${MEM_AVAIL} MB"
else
    warn "RAM knapp: nur ${MEM_AVAIL} MB frei"
fi

# Tailscale
if command -v tailscale &>/dev/null; then
    TS_STATE=$(tailscale status --json 2>/dev/null | grep -o '"BackendState":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    if [[ "$TS_STATE" == "Running" ]]; then
        ok "Tailscale VPN aktiv (State: $TS_STATE)"
    else
        log "Tailscale neu starten..."
        systemctl restart tailscaled && sleep 3 && tailscale up --hostname=hetzner-vps 2>/dev/null
        fixed "Tailscale neu gestartet" || fail "Tailscale konnte nicht gestartet werden"
    fi
else
    warn "Tailscale nicht installiert"
fi

# Firewall
UFW_STATUS=$(ufw status 2>/dev/null | head -1 || echo "")
if echo "$UFW_STATUS" | grep -qi "active"; then
    ok "UFW Firewall aktiv"
else
    warn "UFW Firewall nicht aktiv"
fi

# =============================================================================
# PHASE 2: Core Stack (Traefik + Postgres + n8n + Backend)
# =============================================================================
header "Phase 2: Core Production Stack"

if [[ -f "${COMPOSE_DIR}/docker-compose.yml" ]]; then
    log "Docker Compose Status prüfen..."

    # Check each container
    declare -A EXPECTED_CONTAINERS=(
        [freyai-traefik]="Traefik Reverse Proxy"
        [freyai-postgres]="PostgreSQL (n8n DB)"
        [freyai-n8n]="n8n Workflow Engine"
        [freyai-backend]="FastAPI Backend"
        [freyai-watchtower]="Watchtower Auto-Updates"
    )

    NEEDS_RESTART=false
    for CNAME in freyai-traefik freyai-postgres freyai-n8n freyai-backend freyai-watchtower; do
        CSTATUS=$(docker ps --filter "name=${CNAME}" --format '{{.Status}}' 2>/dev/null || echo "")
        CDESC="${EXPECTED_CONTAINERS[$CNAME]}"

        if echo "$CSTATUS" | grep -qi "up"; then
            # Check health status
            CHEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$CNAME" 2>/dev/null || echo "none")
            if [[ "$CHEALTH" == "healthy" || "$CHEALTH" == "none" ]]; then
                ok "${CDESC} (${CNAME}) — UP ${CHEALTH:+(${CHEALTH})}"
            else
                warn "${CDESC} (${CNAME}) — UP but ${CHEALTH}"
                NEEDS_RESTART=true
            fi
        else
            fail "${CDESC} (${CNAME}) — NICHT AKTIV"
            NEEDS_RESTART=true
        fi
    done

    if [[ "$NEEDS_RESTART" == "true" ]]; then
        log "Stack neu starten..."
        cd "${COMPOSE_DIR}"
        docker compose down 2>/dev/null || true
        sleep 3
        docker compose up -d

        # Wait for health checks
        log "Warte auf Health Checks (max 60s)..."
        for I in $(seq 1 12); do
            PG_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' freyai-postgres 2>/dev/null || echo "")
            [[ "$PG_HEALTH" == "healthy" ]] && break
            sleep 5
        done

        # Re-check
        for CNAME in freyai-traefik freyai-postgres freyai-n8n freyai-backend; do
            CSTATUS=$(docker ps --filter "name=${CNAME}" --format '{{.Status}}' 2>/dev/null || echo "")
            if echo "$CSTATUS" | grep -qi "up"; then
                fixed "${EXPECTED_CONTAINERS[$CNAME]} neu gestartet und läuft"
            else
                fail "${EXPECTED_CONTAINERS[$CNAME]} konnte nicht gestartet werden"
                echo -e "  ${DIM}Logs: docker logs ${CNAME} --tail 30${NC}"
            fi
        done
    fi
else
    fail "docker-compose.yml nicht gefunden in ${COMPOSE_DIR}"
    echo -e "  ${DIM}Erwartet: ${COMPOSE_DIR}/docker-compose.yml${NC}"
fi

# =============================================================================
# PHASE 3: n8n Verification
# =============================================================================
header "Phase 3: n8n Production Verifikation"

# Check n8n HTTP response
N8N_CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "http://localhost:5678" 2>/dev/null || echo "000")
if [[ "$N8N_CODE" =~ ^(200|301|302|401)$ ]]; then
    ok "n8n intern erreichbar (HTTP $N8N_CODE)"
else
    fail "n8n intern nicht erreichbar (HTTP $N8N_CODE)"
    log "Container Logs:"
    docker logs freyai-n8n --tail 10 2>&1 | sed 's/^/  /'
fi

# Check n8n via Traefik (HTTPS)
N8N_EXT=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "https://${DOMAIN}" 2>/dev/null || echo "000")
if [[ "$N8N_EXT" =~ ^(200|301|302|401)$ ]]; then
    ok "n8n extern erreichbar via Traefik (https://${DOMAIN} → HTTP $N8N_EXT)"
else
    warn "n8n extern nicht erreichbar (HTTP $N8N_EXT) — TLS-Zertifikat Problem?"
    echo -e "  ${DIM}Traefik Logs: docker logs freyai-traefik --tail 20${NC}"
fi

# Check backend health
BACKEND_CODE=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://localhost:8001/health" 2>/dev/null || echo "000")
if [[ "$BACKEND_CODE" == "200" || "$BACKEND_CODE" == "401" || "$BACKEND_CODE" == "403" ]]; then
    ok "FastAPI Backend Health OK (HTTP $BACKEND_CODE)"
else
    fail "FastAPI Backend nicht erreichbar (HTTP $BACKEND_CODE)"
fi

# =============================================================================
# PHASE 4: Postiz Stack (Social Media)
# =============================================================================
header "Phase 4: Postiz Social Media Stack"

if [[ -f "${POSTIZ_DIR}/docker-compose.yml" ]]; then
    POSTIZ_CONTAINERS=$(docker ps --filter "name=postiz" --format '{{.Names}}|{{.Status}}' 2>/dev/null || echo "")

    if [[ -n "$POSTIZ_CONTAINERS" ]]; then
        while IFS='|' read -r CNAME CSTATUS; do
            if echo "$CSTATUS" | grep -qi "up"; then
                ok "Postiz: ${CNAME} — UP"
            else
                warn "Postiz: ${CNAME} — ${CSTATUS}"
            fi
        done <<< "$POSTIZ_CONTAINERS"
    else
        warn "Kein Postiz Container läuft — starte Stack..."
        cd "${POSTIZ_DIR}"
        docker compose up -d && fixed "Postiz Stack gestartet" || fail "Postiz konnte nicht gestartet werden"
    fi

    # Check content.freyaivisions.de
    sleep 3
    CONTENT_CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "http://localhost:5000" 2>/dev/null || echo "000")
    if [[ "$CONTENT_CODE" =~ ^(200|301|302|307)$ ]]; then
        ok "Postiz intern erreichbar (HTTP $CONTENT_CODE)"
    else
        warn "Postiz intern nicht erreichbar (HTTP $CONTENT_CODE)"
    fi
else
    warn "Postiz docker-compose.yml nicht gefunden in ${POSTIZ_DIR}"
fi

# =============================================================================
# PHASE 5: Email Relay
# =============================================================================
header "Phase 5: Email Relay"

EMAIL_RELAY_CODE=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://localhost:3100/health" 2>/dev/null || echo "000")
if [[ "$EMAIL_RELAY_CODE" == "200" ]]; then
    ok "Email Relay Health OK (Port 3100)"
else
    warn "Email Relay nicht erreichbar (HTTP $EMAIL_RELAY_CODE)"
    # Try to restart if compose file exists
    RELAY_DIR="/opt/freyai/email-relay"
    if [[ -f "${RELAY_DIR}/docker-compose.yml" ]]; then
        cd "${RELAY_DIR}"
        docker compose up -d && fixed "Email Relay neu gestartet" || warn "Email Relay konnte nicht gestartet werden"
    fi
fi

# =============================================================================
# PHASE 6: TLS Certificates
# =============================================================================
header "Phase 6: TLS-Zertifikate"

# Check Traefik ACME storage
ACME_FILE=$(docker exec freyai-traefik ls -la /certs/acme.json 2>/dev/null || echo "")
if [[ -n "$ACME_FILE" ]]; then
    ok "ACME-Zertifikatsspeicher vorhanden"
else
    warn "ACME-Zertifikatsspeicher nicht gefunden — Traefik erstellt neue Zertifikate"
fi

# Quick TLS check on domain
if command -v openssl &>/dev/null; then
    TLS_EXPIRY=$(echo | openssl s_client -servername "${DOMAIN}" -connect "${DOMAIN}:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "")
    if [[ -n "$TLS_EXPIRY" ]]; then
        ok "TLS-Zertifikat für ${DOMAIN} gültig bis: $TLS_EXPIRY"
    else
        warn "TLS-Zertifikat konnte nicht geprüft werden"
    fi
fi

# =============================================================================
# PHASE 7: Tailscale → Zone 3 Connectivity
# =============================================================================
header "Phase 7: Tailscale → Zone 3 Konnektivität"

if command -v tailscale &>/dev/null; then
    for PEER in pi4-guardian nas-vault thinkcenter-m75n; do
        if tailscale ping --c=2 "$PEER" &>/dev/null 2>&1; then
            ok "Zone 3 Peer $PEER erreichbar"
        else
            warn "Zone 3 Peer $PEER nicht erreichbar (Rack offline?)"
        fi
    done
else
    warn "Tailscale nicht verfügbar — Zone 3 Konnektivität kann nicht geprüft werden"
fi

# =============================================================================
# PHASE 8: Backup Verification
# =============================================================================
header "Phase 8: Backup-Status"

if command -v restic &>/dev/null; then
    RESTIC_REPO="${RESTIC_REPOSITORY:-}"
    if [[ -n "$RESTIC_REPO" ]]; then
        LAST_SNAPSHOT=$(restic -r "$RESTIC_REPO" snapshots --last --json 2>/dev/null | grep -o '"time":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
        if [[ -n "$LAST_SNAPSHOT" ]]; then
            ok "Letztes Backup: $LAST_SNAPSHOT"
        else
            warn "Kein Backup-Snapshot gefunden"
        fi
    else
        warn "RESTIC_REPOSITORY nicht gesetzt"
    fi
else
    warn "Restic nicht installiert — Backup-Status nicht prüfbar"
fi

# Check cron job
if crontab -l 2>/dev/null | grep -q "backup-hetzner\|freyai-backup"; then
    ok "Backup Cron-Job eingerichtet"
else
    warn "Backup Cron-Job nicht gefunden"
fi

# =============================================================================
# SUMMARY
# =============================================================================
header "RECOVERY ABGESCHLOSSEN"
echo ""
echo -e "  ${GREEN}✓ OK:        ${PASS}${NC}"
echo -e "  ${GREEN}⚡ Gefixt:    ${FIXED}${NC}"
echo -e "  ${RED}✗ Fehler:    ${FAIL}${NC}"
echo ""

if [[ ${FAIL} -eq 0 ]]; then
    echo -e "  ${GREEN}${BOLD}Alle VPS-Services laufen. Production ist online.${NC}"
else
    echo -e "  ${RED}${BOLD}${FAIL} Problem(e) brauchen Aufmerksamkeit:${NC}"
    echo ""
    echo "  Troubleshooting:"
    echo "    docker ps -a                         # Alle Container (auch gestoppte)"
    echo "    docker logs <name> --tail 50         # Container-Logs"
    echo "    docker compose -f /opt/freyai/docker-compose.yml logs"
    echo "    journalctl -u docker --since '1 hour ago'"
    echo "    tailscale status                     # VPN-Status"
fi

echo ""
echo -e "${DIM}─── Recovery abgeschlossen um $(date '+%H:%M:%S') ───${NC}"

[[ ${FAIL} -eq 0 ]] && exit 0 || exit 1
