#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions 95/5 — Zone 3 Rack Health Check
# Post-Reconnection Verification Script
#
# Run after any physical change to the server rack (power cycle, re-cabling,
# adding/removing devices, switch changes).
#
# Checks:
#   1. LAN connectivity — ping all Zone 3 devices
#   2. Switch ports     — verify all 7 active ports
#   3. Services         — HTTP health of all running services
#   4. Docker           — container status on ThinkCentre
#   5. Tailscale        — mesh VPN status & peer connectivity
#   6. DNS              — Pi-hole resolution
#   7. Zone 2 VPS       — Hetzner production reachability
#   8. Zone 1 Supabase  — cloud API health
#   9. Backup path      — NAS reachability from VPS
#  10. Summary report   — pass/fail/warn totals
#
# Usage: bash check-rack.sh [--quick|--full]
#   --quick  LAN ping + services only (default)
#   --full   All checks including cross-zone and backup verification
#
# Idempotent: Yes (read-only, no changes)
# =============================================================================
set -uo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

PASS=0; FAIL=0; WARN=0; SKIP=0
FAILURES=()

pass()  { echo -e "  ${GREEN}✓${NC} $*"; ((PASS++)); }
fail()  { echo -e "  ${RED}✗${NC} $*"; ((FAIL++)); FAILURES+=("$*"); }
warn()  { echo -e "  ${YELLOW}⚠${NC} $*"; ((WARN++)); }
skip()  { echo -e "  ${DIM}⊘${NC} $*"; ((SKIP++)); }
header(){ echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}"; }

MODE="${1:---quick}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ── Device definitions ───────────────────────────────────────────────────────
declare -A DEVICES=(
    [Z3-PI4]="192.168.1.10"
    [Z3-NAS]="192.168.1.11"
    [Z3-M75N]="192.168.1.12"
    [Z3-T640]="192.168.1.13"
    [Z3-GAMING]="192.168.1.20"
)

declare -A DEVICE_ROLES=(
    [Z3-PI4]="Network Guardian (Tailscale, Pi-hole, Uptime Kuma)"
    [Z3-NAS]="Sovereign Vault (Restic, SFTP, SMB)"
    [Z3-M75N]="Edge Compute (Docker, n8n staging, Portainer)"
    [Z3-T640]="Command Center (4-monitor kiosk)"
    [Z3-GAMING]="Heavy Forge (Ollama LLM, on-demand)"
)

declare -A ALWAYS_ON=(
    [Z3-PI4]="true"
    [Z3-NAS]="true"
    [Z3-M75N]="true"
    [Z3-T640]="true"
    [Z3-GAMING]="false"
)

# ── Service endpoints (HTTP) ─────────────────────────────────────────────────
declare -A SERVICES=(
    # Pi4 services
    ["Pi-hole Admin"]="http://192.168.1.10/admin"
    ["Uptime Kuma"]="http://192.168.1.10:3001"
    # ThinkCentre services
    ["n8n Staging"]="http://192.168.1.12:5679"
    ["Portainer"]="http://192.168.1.12:9001"
    # Gaming Rig (on-demand)
    ["Ollama LLM"]="http://192.168.1.20:11434"
)

declare -A SERVICE_OPTIONAL=(
    ["Pi-hole Admin"]="false"
    ["Uptime Kuma"]="false"
    ["n8n Staging"]="false"
    ["Portainer"]="false"
    ["Ollama LLM"]="true"
)

# =============================================================================
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║        FreyAI Zone 3 — Post-Reconnection Check             ║"
echo "  ║        ${TIMESTAMP}                            ║"
echo "  ║        Mode: ${MODE}                                        ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# CHECK 1: LAN CONNECTIVITY
# =============================================================================
header "1. LAN Connectivity (Ping)"

for DEVICE in Z3-PI4 Z3-NAS Z3-M75N Z3-T640 Z3-GAMING; do
    IP="${DEVICES[$DEVICE]}"
    ROLE="${DEVICE_ROLES[$DEVICE]}"
    REQUIRED="${ALWAYS_ON[$DEVICE]}"

    echo -n "  ${DEVICE} (${IP}) — ${ROLE} ... "
    if ping -c 2 -W 2 "${IP}" &>/dev/null; then
        echo -e "${GREEN}REACHABLE${NC}"
        ((PASS++))
    else
        if [[ "${REQUIRED}" == "true" ]]; then
            echo -e "${RED}UNREACHABLE${NC}"
            ((FAIL++))
            FAILURES+=("${DEVICE} (${IP}) not reachable on LAN")
        else
            echo -e "${YELLOW}OFFLINE (on-demand device)${NC}"
            ((WARN++))
        fi
    fi
done

# =============================================================================
# CHECK 2: SWITCH PORT VERIFICATION
# =============================================================================
header "2. Switch Port Verification"
echo -e "  ${DIM}Switch: Z3-SW1 (8-port Gigabit, HE2)${NC}"

declare -A SWITCH_PORTS=(
    [1]="ISP Router|192.168.1.1"
    [2]="Home Router|192.168.1.1"
    [3]="NAS 2300|192.168.1.11"
    [4]="ThinkCentre M75n|192.168.1.12"
    [5]="Raspberry Pi 4|192.168.1.10"
    [6]="HP t640|192.168.1.13"
    [7]="Gaming Rig|192.168.1.20"
)

for PORT in 1 2 3 4 5 6 7; do
    IFS='|' read -r NAME IP <<< "${SWITCH_PORTS[$PORT]}"
    # Port 1 and 2 share the same gateway IP
    if [[ "${PORT}" == "2" ]]; then
        skip "Port ${PORT}: ${NAME} (${IP}) — shared gateway, see Port 1"
        continue
    fi
    if ping -c 1 -W 1 "${IP}" &>/dev/null; then
        pass "Port ${PORT}: ${NAME} (${IP}) — link OK"
    else
        if [[ "${PORT}" == "7" ]]; then
            warn "Port ${PORT}: ${NAME} (${IP}) — no link (on-demand device)"
        else
            fail "Port ${PORT}: ${NAME} (${IP}) — no link detected"
        fi
    fi
done

# =============================================================================
# CHECK 3: SERVICE HEALTH
# =============================================================================
header "3. Service Health (HTTP)"

for SVC_NAME in "Pi-hole Admin" "Uptime Kuma" "n8n Staging" "Portainer" "Ollama LLM"; do
    URL="${SERVICES[$SVC_NAME]}"
    OPTIONAL="${SERVICE_OPTIONAL[$SVC_NAME]}"

    RESPONSE=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "${URL}" 2>/dev/null || true)

    if [[ "${RESPONSE}" =~ ^(200|301|302|303|401|403)$ ]]; then
        pass "${SVC_NAME} (${URL}) — HTTP ${RESPONSE}"
    elif [[ "${OPTIONAL}" == "true" ]]; then
        warn "${SVC_NAME} (${URL}) — not responding (optional/on-demand)"
    else
        fail "${SVC_NAME} (${URL}) — HTTP ${RESPONSE} or timeout"
    fi
done

# =============================================================================
# CHECK 4: DNS RESOLUTION (Pi-hole)
# =============================================================================
header "4. DNS Resolution (Pi-hole @ 192.168.1.10)"

if command -v dig &>/dev/null; then
    DNS_TOOL="dig"
elif command -v nslookup &>/dev/null; then
    DNS_TOOL="nslookup"
else
    DNS_TOOL="none"
fi

if [[ "${DNS_TOOL}" == "none" ]]; then
    skip "No dig/nslookup available — skipping DNS check"
else
    for DOMAIN in "google.com" "supabase.co" "freyaivisions.de"; do
        if [[ "${DNS_TOOL}" == "dig" ]]; then
            RESULT=$(dig +short +time=3 "@192.168.1.10" "${DOMAIN}" 2>/dev/null)
        else
            RESULT=$(nslookup "${DOMAIN}" 192.168.1.10 2>/dev/null | grep -c "Address" || true)
        fi
        if [[ -n "${RESULT}" && "${RESULT}" != "0" ]]; then
            pass "DNS resolve ${DOMAIN} via Pi-hole — OK"
        else
            fail "DNS resolve ${DOMAIN} via Pi-hole — FAILED"
        fi
    done
fi

# =============================================================================
# CHECK 5: DOCKER CONTAINERS (ThinkCentre via SSH)
# =============================================================================
header "5. Docker Status (ThinkCentre 192.168.1.12)"

if ping -c 1 -W 2 192.168.1.12 &>/dev/null; then
    # Try SSH if key is available, otherwise skip
    DOCKER_OUTPUT=$(ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no \
        192.168.1.12 "docker ps --format '{{.Names}}|{{.Status}}|{{.Ports}}'" 2>/dev/null) || DOCKER_OUTPUT=""

    if [[ -n "${DOCKER_OUTPUT}" ]]; then
        while IFS='|' read -r CNAME CSTATUS CPORTS; do
            if echo "${CSTATUS}" | grep -qi "up"; then
                pass "Container ${CNAME} — ${CSTATUS}"
            else
                fail "Container ${CNAME} — ${CSTATUS}"
            fi
        done <<< "${DOCKER_OUTPUT}"
    else
        warn "Could not SSH to ThinkCentre — check SSH key or run 'docker ps' manually"
        echo -e "  ${DIM}Run on ThinkCentre: docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'${NC}"
    fi
else
    fail "ThinkCentre not reachable — cannot check Docker"
fi

# =============================================================================
# CHECK 6: TAILSCALE MESH
# =============================================================================
header "6. Tailscale Mesh VPN"

if command -v tailscale &>/dev/null; then
    TS_STATUS=$(tailscale status 2>/dev/null) || TS_STATUS=""
    if [[ -n "${TS_STATUS}" ]]; then
        pass "Tailscale daemon running"
        echo -e "  ${DIM}${TS_STATUS}${NC}" | head -10

        # Check peer connectivity
        echo ""
        for PEER in nas-vault thinkcenter-m75n pi4-guardian hp-t640-kiosk hetzner-vps; do
            if echo "${TS_STATUS}" | grep -qi "${PEER}"; then
                pass "Peer ${PEER} — visible in mesh"
            else
                if [[ "${PEER}" == "hetzner-vps" ]] && [[ "${MODE}" == "--quick" ]]; then
                    skip "Peer ${PEER} — skipped in quick mode"
                else
                    warn "Peer ${PEER} — not visible in mesh"
                fi
            fi
        done

        # Gaming rig is on-demand
        if echo "${TS_STATUS}" | grep -qi "gaming-forge"; then
            pass "Peer gaming-forge — connected (on-demand)"
        else
            skip "Peer gaming-forge — not connected (on-demand, expected)"
        fi
    else
        warn "Tailscale installed but not running or no peers"
    fi
else
    warn "Tailscale not installed on this machine"
    echo -e "  ${DIM}Install with: curl -fsSL https://tailscale.com/install.sh | sh${NC}"
fi

# =============================================================================
# FULL MODE: Cross-zone checks
# =============================================================================
if [[ "${MODE}" == "--full" ]]; then

    # ── CHECK 7: Zone 2 Hetzner VPS ─────────────────────────────────────────
    header "7. Zone 2 — Hetzner VPS (Production)"

    # Try Tailscale hostname first, then direct
    VPS_REACHABLE=false
    if command -v tailscale &>/dev/null; then
        if tailscale ping --c=2 hetzner-vps &>/dev/null 2>&1; then
            pass "Hetzner VPS reachable via Tailscale mesh"
            VPS_REACHABLE=true
        else
            warn "Hetzner VPS not reachable via Tailscale"
        fi
    fi

    # Check n8n production
    N8N_DOMAIN="${N8N_DOMAIN:-n8n.freyaivisions.de}"
    N8N_RESPONSE=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "https://${N8N_DOMAIN}" 2>/dev/null || echo "000")
    if [[ "${N8N_RESPONSE}" =~ ^(200|301|302|401)$ ]]; then
        pass "n8n Production (https://${N8N_DOMAIN}) — HTTP ${N8N_RESPONSE}"
    else
        fail "n8n Production (https://${N8N_DOMAIN}) — HTTP ${N8N_RESPONSE} or timeout"
    fi

    # Check backend health
    BACKEND_DOMAIN="${BACKEND_DOMAIN:-app.freyaivisions.de}"
    BACKEND_RESPONSE=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "https://${BACKEND_DOMAIN}/health" 2>/dev/null || echo "000")
    if [[ "${BACKEND_RESPONSE}" =~ ^(200|401|403)$ ]]; then
        pass "FastAPI Backend (https://${BACKEND_DOMAIN}/health) — HTTP ${BACKEND_RESPONSE}"
    else
        warn "FastAPI Backend (https://${BACKEND_DOMAIN}/health) — HTTP ${BACKEND_RESPONSE}"
    fi

    # ── CHECK 8: Zone 1 Supabase ────────────────────────────────────────────
    header "8. Zone 1 — Supabase (Cloud)"

    SUPABASE_URL="${SUPABASE_URL:-}"
    if [[ -n "${SUPABASE_URL}" ]]; then
        SB_RESPONSE=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/rest/v1/" 2>/dev/null || echo "000")
        if [[ "${SB_RESPONSE}" =~ ^(200|401|403)$ ]]; then
            pass "Supabase REST API — HTTP ${SB_RESPONSE}"
        else
            fail "Supabase REST API — HTTP ${SB_RESPONSE} or timeout"
        fi

        SB_AUTH=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/auth/v1/health" 2>/dev/null || echo "000")
        if [[ "${SB_AUTH}" == "200" ]]; then
            pass "Supabase Auth health — HTTP 200"
        else
            warn "Supabase Auth health — HTTP ${SB_AUTH}"
        fi
    else
        skip "SUPABASE_URL not set — skipping Supabase checks"
        echo -e "  ${DIM}Export SUPABASE_URL=https://your-project.supabase.co to enable${NC}"
    fi

    # ── CHECK 9: Backup Path ────────────────────────────────────────────────
    header "9. Backup Path Verification"

    # Check NAS SSH/SFTP
    if ping -c 1 -W 2 192.168.1.11 &>/dev/null; then
        NAS_SSH=$(ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no \
            192.168.1.11 "echo OK" 2>/dev/null) || NAS_SSH=""
        if [[ "${NAS_SSH}" == "OK" ]]; then
            pass "NAS SSH access — OK (backup SFTP path available)"
        else
            warn "NAS ping OK but SSH failed — check SSH keys for backup user"
        fi
    else
        fail "NAS not reachable — backup path broken"
    fi

    # Check SMB if smbclient available
    if command -v smbclient &>/dev/null; then
        SMB_RESULT=$(smbclient -L "192.168.1.11" -N 2>/dev/null | grep -c "Disk" || true)
        if [[ "${SMB_RESULT}" -gt 0 ]]; then
            pass "NAS SMB shares available (${SMB_RESULT} shares)"
        else
            warn "NAS SMB not responding or no shares"
        fi
    else
        skip "smbclient not installed — SMB check skipped"
    fi

    # Check Restic repository
    if command -v restic &>/dev/null; then
        RESTIC_REPO="${RESTIC_REPOSITORY:-}"
        if [[ -n "${RESTIC_REPO}" ]]; then
            if restic -r "${RESTIC_REPO}" snapshots --last --json 2>/dev/null | grep -q "time"; then
                pass "Restic backup repository accessible — snapshots found"
            else
                warn "Restic repository not accessible or empty"
            fi
        else
            skip "RESTIC_REPOSITORY not set — skipping Restic check"
        fi
    else
        skip "Restic not installed on this machine"
    fi
fi

# =============================================================================
# CHECK 10: SUMMARY
# =============================================================================
header "SUMMARY"
echo ""
echo -e "  ${GREEN}✓ Passed:  ${PASS}${NC}"
echo -e "  ${RED}✗ Failed:  ${FAIL}${NC}"
echo -e "  ${YELLOW}⚠ Warnings: ${WARN}${NC}"
echo -e "  ${DIM}⊘ Skipped: ${SKIP}${NC}"
echo ""

if [[ ${FAIL} -eq 0 ]]; then
    echo -e "  ${GREEN}${BOLD}All critical checks passed.${NC}"
    echo -e "  ${DIM}Rack reconnection verified — all systems operational.${NC}"
else
    echo -e "  ${RED}${BOLD}${FAIL} critical failure(s) detected:${NC}"
    for F in "${FAILURES[@]}"; do
        echo -e "    ${RED}→${NC} ${F}"
    done
    echo ""
    echo -e "  ${BOLD}Recommended actions:${NC}"
    echo "    1. Check physical cable connections (see rack-labels.txt)"
    echo "    2. Verify power to all devices (PDU on HE8)"
    echo "    3. Check switch LED indicators on Z3-SW1"
    echo "    4. Run 'tailscale status' on affected devices"
    echo "    5. Check Docker: ssh 192.168.1.12 'docker ps -a'"
fi

echo ""
echo -e "${DIM}─── Check completed at $(date '+%H:%M:%S') ───${NC}"

# Exit code reflects health
[[ ${FAIL} -eq 0 ]] && exit 0 || exit 1
