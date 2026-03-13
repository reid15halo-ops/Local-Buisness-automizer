#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions 95/5 — Zone 3 Rack Recovery
# Master script to bring all Zone 3 services back online after power loss,
# re-cabling, or any physical disruption to the server rack.
#
# Boot order (dependency chain):
#   1. Switch (HE2) — must be powered first (no software, just hardware)
#   2. Pi4 (HE6)    — DNS + Tailscale subnet router (everything depends on this)
#   3. NAS (HE3)    — Backup vault (needs network from Pi4)
#   4. ThinkCentre (HE5) — Docker + staging (needs DNS from Pi4)
#   5. t640 (HE7)   — Kiosk display (needs ThinkCentre services to show)
#   6. Gaming Rig   — On-demand, not auto-started
#
# Run from: ANY Zone 3 device on the 192.168.1.0/24 LAN
# Usage:    sudo bash recover-rack.sh [--force]
#           --force  skip confirmation prompts
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

wait_for_host() {
    local IP="$1" NAME="$2" MAX="${3:-30}"
    local I=0
    while [[ $I -lt $MAX ]]; do
        if ping -c 1 -W 1 "$IP" &>/dev/null; then
            return 0
        fi
        ((I++))
        sleep 2
    done
    return 1
}

wait_for_http() {
    local URL="$1" MAX="${2:-15}"
    local I=0
    while [[ $I -lt $MAX ]]; do
        if curl -s --max-time 3 -o /dev/null "$URL" 2>/dev/null; then
            return 0
        fi
        ((I++))
        sleep 2
    done
    return 1
}

ssh_cmd() {
    local HOST="$1"; shift
    ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$HOST" "$@" 2>/dev/null
}

# =============================================================================
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║        FreyAI Zone 3 — Rack Recovery Sequence               ║"
echo "  ║        $(date '+%Y-%m-%d %H:%M:%S')                            ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [[ "${FORCE}" != "--force" ]]; then
    echo -e "  ${YELLOW}Vor dem Start sicherstellen:${NC}"
    echo "    1. PDU (HE8) ist eingeschaltet"
    echo "    2. Switch (HE2) hat Strom und LEDs leuchten"
    echo "    3. Alle Ethernet-Kabel sind eingesteckt (siehe rack-labels.txt)"
    echo ""
    read -rp "  Weiter? (j/n) " CONFIRM
    [[ "${CONFIRM}" != "j" && "${CONFIRM}" != "J" && "${CONFIRM}" != "y" ]] && exit 0
fi

# =============================================================================
# PHASE 1: Pi4 — Network Guardian (MUST come up first)
# =============================================================================
header "Phase 1: Pi4 — Network Guardian (192.168.1.10)"
log "Warte auf Pi4 Boot (max 120s)..."

if wait_for_host "192.168.1.10" "Pi4" 60; then
    ok "Pi4 erreichbar auf 192.168.1.10"

    # Check Tailscale
    TS_STATE=$(ssh_cmd 192.168.1.10 "tailscale status --json 2>/dev/null | grep -o '\"BackendState\":\"[^\"]*\"'" || echo "")
    if echo "$TS_STATE" | grep -q "Running"; then
        ok "Tailscale läuft auf Pi4"
    else
        warn "Tailscale nicht aktiv — versuche Neustart..."
        ssh_cmd 192.168.1.10 "sudo systemctl restart tailscaled && sleep 3 && sudo tailscale up --advertise-routes=192.168.1.0/24 --advertise-exit-node --accept-dns=false --hostname=pi4-guardian" && fixed "Tailscale neu gestartet" || fail "Tailscale konnte nicht gestartet werden"
    fi

    # Check Pi-hole
    PIHOLE_STATE=$(ssh_cmd 192.168.1.10 "systemctl is-active pihole-FTL" || echo "inactive")
    if [[ "$PIHOLE_STATE" == "active" ]]; then
        ok "Pi-hole DNS aktiv"
    else
        warn "Pi-hole nicht aktiv — versuche Neustart..."
        ssh_cmd 192.168.1.10 "sudo systemctl restart pihole-FTL" && fixed "Pi-hole neu gestartet" || fail "Pi-hole konnte nicht gestartet werden"
    fi

    # Check DNS resolution
    DNS_OK=$(ssh_cmd 192.168.1.10 "dig +short +time=3 @127.0.0.1 google.com" || echo "")
    if [[ -n "$DNS_OK" ]]; then
        ok "DNS-Auflösung funktioniert (google.com → $DNS_OK)"
    else
        fail "DNS-Auflösung fehlgeschlagen"
    fi

    # Check Uptime Kuma
    KUMA_STATE=$(ssh_cmd 192.168.1.10 "docker ps --filter name=uptime-kuma --format '{{.Status}}'" || echo "")
    if echo "$KUMA_STATE" | grep -qi "up"; then
        ok "Uptime Kuma Container läuft"
    else
        warn "Uptime Kuma nicht aktiv — versuche Neustart..."
        ssh_cmd 192.168.1.10 "docker compose -f /opt/freyai/uptime-kuma/docker-compose.yml up -d" && fixed "Uptime Kuma neu gestartet" || fail "Uptime Kuma konnte nicht gestartet werden"
    fi

    # Verify Uptime Kuma HTTP
    if wait_for_http "http://192.168.1.10:3001" 5; then
        ok "Uptime Kuma Web-UI erreichbar (Port 3001)"
    else
        warn "Uptime Kuma Web-UI noch nicht erreichbar"
    fi
else
    fail "Pi4 nicht erreichbar nach 120s — manuell prüfen!"
    echo -e "  ${RED}KRITISCH: Pi4 ist das Fundament (DNS, Tailscale). Ohne Pi4 funktioniert nichts.${NC}"
    echo "  → Kabel Z3-PI4-ETH-SW1 (Port 5) prüfen"
    echo "  → USB-C Stromkabel Z3-PI4-USB-PWR prüfen"
    echo "  → SD-Karte sitzt fest?"
fi

# =============================================================================
# PHASE 2: NAS — Sovereign Vault
# =============================================================================
header "Phase 2: NAS — Sovereign Vault (192.168.1.11)"
log "Warte auf NAS (max 90s)..."

if wait_for_host "192.168.1.11" "NAS" 45; then
    ok "NAS erreichbar auf 192.168.1.11"

    # Check SSH/SFTP
    NAS_SSH=$(ssh_cmd 192.168.1.11 "echo OK" || echo "")
    if [[ "$NAS_SSH" == "OK" ]]; then
        ok "NAS SSH/SFTP-Zugang funktioniert (Backup-Pfad OK)"
    else
        warn "NAS SSH nicht möglich — Backup-Pfad prüfen (SSH-Key?)"
    fi

    # Check SMB
    if command -v smbclient &>/dev/null; then
        SMB_SHARES=$(smbclient -L "192.168.1.11" -N 2>/dev/null | grep -c "Disk" || echo "0")
        if [[ "$SMB_SHARES" -gt 0 ]]; then
            ok "NAS SMB aktiv ($SMB_SHARES Shares)"
        else
            warn "NAS SMB nicht erreichbar"
        fi
    fi
else
    fail "NAS nicht erreichbar — Kabel Z3-NAS-ETH-SW1 (Port 3) prüfen"
fi

# =============================================================================
# PHASE 3: ThinkCentre — Edge Compute
# =============================================================================
header "Phase 3: ThinkCentre — Edge Compute (192.168.1.12)"
log "Warte auf ThinkCentre (max 90s)..."

if wait_for_host "192.168.1.12" "ThinkCentre" 45; then
    ok "ThinkCentre erreichbar auf 192.168.1.12"

    # Check Tailscale
    TC_TS=$(ssh_cmd 192.168.1.12 "tailscale status --json 2>/dev/null | grep -o '\"BackendState\":\"[^\"]*\"'" || echo "")
    if echo "$TC_TS" | grep -q "Running"; then
        ok "Tailscale läuft auf ThinkCentre"
    else
        warn "Tailscale nicht aktiv — versuche Neustart..."
        ssh_cmd 192.168.1.12 "sudo systemctl restart tailscaled && sleep 2 && sudo tailscale up --hostname=thinkcenter-m75n --accept-dns=false" && fixed "Tailscale neu gestartet" || fail "Tailscale Neustart fehlgeschlagen"
    fi

    # Check Docker daemon
    DOCKER_STATE=$(ssh_cmd 192.168.1.12 "systemctl is-active docker" || echo "inactive")
    if [[ "$DOCKER_STATE" == "active" ]]; then
        ok "Docker Daemon aktiv"
    else
        warn "Docker nicht aktiv — versuche Neustart..."
        ssh_cmd 192.168.1.12 "sudo systemctl start docker" && fixed "Docker gestartet" || fail "Docker konnte nicht gestartet werden"
    fi

    # List running containers
    CONTAINERS=$(ssh_cmd 192.168.1.12 "docker ps --format '{{.Names}}|{{.Status}}'" || echo "")
    if [[ -n "$CONTAINERS" ]]; then
        while IFS='|' read -r CNAME CSTATUS; do
            if echo "$CSTATUS" | grep -qi "up"; then
                ok "Container ${CNAME} — ${CSTATUS}"
            else
                warn "Container ${CNAME} — ${CSTATUS} (nicht healthy)"
            fi
        done <<< "$CONTAINERS"
    else
        warn "Keine Container laufen — versuche n8n Staging zu starten..."
    fi

    # Ensure n8n staging is up
    N8N_STAGING=$(ssh_cmd 192.168.1.12 "docker ps --filter name=n8n-staging --format '{{.Status}}'" || echo "")
    if [[ -z "$N8N_STAGING" ]] || ! echo "$N8N_STAGING" | grep -qi "up"; then
        log "n8n Staging starten..."
        ssh_cmd 192.168.1.12 "docker compose -f /opt/freyai/n8n-staging/docker-compose.yml up -d" && fixed "n8n Staging gestartet" || fail "n8n Staging konnte nicht gestartet werden"
    fi

    # Ensure Portainer is up
    PORTAINER=$(ssh_cmd 192.168.1.12 "docker ps --filter name=portainer --format '{{.Status}}'" || echo "")
    if [[ -z "$PORTAINER" ]] || ! echo "$PORTAINER" | grep -qi "up"; then
        log "Portainer starten..."
        ssh_cmd 192.168.1.12 "docker start portainer 2>/dev/null || docker run -d --name portainer --restart=unless-stopped -p 9001:9000 -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest" && fixed "Portainer gestartet" || fail "Portainer konnte nicht gestartet werden"
    fi

    # Verify services HTTP
    sleep 3
    if wait_for_http "http://192.168.1.12:5679" 5; then
        ok "n8n Staging Web-UI erreichbar (Port 5679)"
    else
        warn "n8n Staging noch nicht bereit (Postgres-Init?)"
    fi

    if wait_for_http "http://192.168.1.12:9001" 3; then
        ok "Portainer Web-UI erreichbar (Port 9001)"
    else
        warn "Portainer noch nicht bereit"
    fi
else
    fail "ThinkCentre nicht erreichbar — Kabel Z3-M75N-ETH-SW1 (Port 4) prüfen"
fi

# =============================================================================
# PHASE 4: HP t640 — Command Center
# =============================================================================
header "Phase 4: HP t640 — Command Center (192.168.1.13)"

if wait_for_host "192.168.1.13" "t640" 20; then
    ok "HP t640 erreichbar auf 192.168.1.13"

    # The kiosk should auto-start Chromium via LightDM
    T640_LIGHTDM=$(ssh_cmd 192.168.1.13 "systemctl is-active lightdm" || echo "inactive")
    if [[ "$T640_LIGHTDM" == "active" ]]; then
        ok "LightDM (Kiosk-Modus) aktiv"
    else
        warn "LightDM nicht aktiv — versuche Start..."
        ssh_cmd 192.168.1.13 "sudo systemctl start lightdm" && fixed "LightDM gestartet" || warn "LightDM konnte nicht gestartet werden (manuell prüfen)"
    fi
else
    warn "HP t640 nicht erreichbar — Kabel Z3-T640-ETH-SW1 (Port 6) prüfen"
fi

# =============================================================================
# PHASE 5: Gaming Rig — Heavy Forge (on-demand)
# =============================================================================
header "Phase 5: Gaming Rig — Heavy Forge (192.168.1.20)"

if ping -c 1 -W 2 "192.168.1.20" &>/dev/null; then
    ok "Gaming Rig erreichbar (on-demand, aktuell online)"
    OLLAMA=$(curl -s --max-time 3 "http://192.168.1.20:11434" 2>/dev/null || echo "")
    if [[ -n "$OLLAMA" ]]; then
        ok "Ollama LLM Server erreichbar (Port 11434)"
    else
        warn "Ollama nicht aktiv — bei Bedarf: ssh 192.168.1.20 'ollama serve'"
    fi
else
    echo -e "  ${DIM}⊘ Gaming Rig offline (on-demand Gerät, erwartet)${NC}"
fi

# =============================================================================
# PHASE 6: Tailscale Mesh Connectivity
# =============================================================================
header "Phase 6: Tailscale Mesh Verifikation"

if command -v tailscale &>/dev/null; then
    TS_STATUS=$(tailscale status 2>/dev/null) || TS_STATUS=""
    if [[ -n "$TS_STATUS" ]]; then
        ok "Tailscale Daemon läuft auf diesem Gerät"

        for PEER in pi4-guardian nas-vault thinkcenter-m75n hp-t640-kiosk; do
            if echo "$TS_STATUS" | grep -qi "$PEER"; then
                ok "Tailscale Peer: $PEER sichtbar"
            else
                warn "Tailscale Peer: $PEER nicht sichtbar"
            fi
        done

        # Check VPS connectivity
        if tailscale ping --c=2 hetzner-vps &>/dev/null 2>&1; then
            ok "Tailscale → Hetzner VPS erreichbar (Zone 2 Tunnel steht)"
        else
            warn "Tailscale → Hetzner VPS nicht erreichbar"
            echo -e "  ${DIM}VPS-seitig prüfen: tailscale status auf hetzner-vps${NC}"
        fi
    else
        warn "Tailscale läuft aber keine Peers sichtbar"
    fi
else
    warn "Tailscale nicht auf diesem Gerät installiert"
fi

# =============================================================================
# PHASE 7: Cross-Zone Verification
# =============================================================================
header "Phase 7: Cross-Zone Connectivity"

# Check if Zone 3 → Zone 2 backup path works
log "Prüfe Backup-Pfad (Zone 3 NAS ← Zone 2 VPS)..."
if command -v tailscale &>/dev/null && tailscale ping --c=1 hetzner-vps &>/dev/null 2>&1; then
    ok "VPS → Zone 3 Tunnel steht (Backup-Pfad intakt)"
else
    warn "VPS nicht über Tailscale erreichbar — Backups werden fehlschlagen"
    echo -e "  ${DIM}Auf VPS prüfen: sudo tailscale up${NC}"
fi

# Check public endpoints
for ENDPOINT in "https://freyaivisions.de" "https://app.freyaivisions.de"; do
    CODE=$(curl -s --max-time 8 -o /dev/null -w "%{http_code}" "$ENDPOINT" 2>/dev/null || echo "000")
    if [[ "$CODE" =~ ^(200|301|302|307|403)$ ]]; then
        ok "$ENDPOINT — HTTP $CODE"
    else
        fail "$ENDPOINT — HTTP $CODE (nicht erreichbar)"
    fi
done

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
    echo -e "  ${GREEN}${BOLD}Alle Systeme laufen. Rack-Recovery erfolgreich.${NC}"
else
    echo -e "  ${RED}${BOLD}${FAIL} Problem(e) brauchen manuelle Hilfe:${NC}"
    echo ""
    echo "  Troubleshooting-Checkliste:"
    echo "    1. Physische Verbindungen: rack-labels.txt für Kabel-Zuordnung"
    echo "    2. Switch LEDs prüfen (HE2) — alle Ports 1-6 sollten leuchten"
    echo "    3. Geräte einzeln per HDMI + Tastatur prüfen"
    echo "    4. Tailscale Admin: https://login.tailscale.com/admin/machines"
    echo "    5. Docker Logs: docker logs <container-name> --tail 50"
fi

echo ""
echo -e "${DIM}─── Recovery abgeschlossen um $(date '+%H:%M:%S') ───${NC}"

[[ ${FAIL} -eq 0 ]] && exit 0 || exit 1
