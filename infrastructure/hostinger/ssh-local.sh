#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions — SSH into local network devices from Hostinger VPS
#
# Prerequisites:
#   - Tailscale running on this VPS (tailscale-compose.yml)
#   - pi4-guardian enrolled and advertising 192.168.1.0/24 subnet route
#   - Subnet route approved in Tailscale admin panel
#   - SSH public key deployed to target device's ~/.ssh/authorized_keys
#
# Usage:
#   ./ssh-local.sh pi           — SSH into Raspberry Pi 4 (192.168.1.10)
#   ./ssh-local.sh nas          — SSH into NAS (192.168.1.11)
#   ./ssh-local.sh compute      — SSH into ThinkCentre (192.168.1.12)
#   ./ssh-local.sh kiosk        — SSH into HP t640 kiosk (192.168.1.13)
#   ./ssh-local.sh gaming       — SSH into Gaming Rig (192.168.1.20)
#   ./ssh-local.sh status       — Show Tailscale mesh status
#   ./ssh-local.sh check        — Ping all local devices
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Device definitions (must match tailscale-mesh.sh) ────────────────────────
declare -A TS_HOST LAN_IP SSH_USER
TS_HOST[pi]="pi4-guardian";       LAN_IP[pi]="192.168.1.10";  SSH_USER[pi]="pi"
TS_HOST[nas]="nas-vault";         LAN_IP[nas]="192.168.1.11"; SSH_USER[nas]="admin"
TS_HOST[compute]="thinkcenter-m75n"; LAN_IP[compute]="192.168.1.12"; SSH_USER[compute]="admin"
TS_HOST[kiosk]="hp-t640-kiosk";   LAN_IP[kiosk]="192.168.1.13"; SSH_USER[kiosk]="admin"
TS_HOST[gaming]="gaming-forge";   LAN_IP[gaming]="192.168.1.20"; SSH_USER[gaming]="admin"

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o ServerAliveInterval=30"

# ── Check Tailscale is running ────────────────────────────────────────────────
check_tailscale() {
    if ! command -v tailscale &>/dev/null; then
        # Try via docker exec if running in container context
        if docker exec tailscale-vps tailscale status &>/dev/null 2>&1; then
            TS_CMD="docker exec tailscale-vps tailscale"
        else
            die "Tailscale not found. Start it: docker compose -f tailscale-compose.yml up -d"
        fi
    else
        TS_CMD="tailscale"
    fi
}

# ── status ────────────────────────────────────────────────────────────────────
do_status() {
    check_tailscale
    info "Tailscale mesh status:"
    ${TS_CMD} status
    echo ""
    info "This VPS Tailscale IP:"
    ${TS_CMD} ip -4 2>/dev/null || echo "  (not connected)"
}

# ── check — ping all local devices ───────────────────────────────────────────
do_check() {
    check_tailscale
    info "Pinging all Zone 3 devices via Tailscale..."
    PASS=0; FAIL=0

    for KEY in pi nas compute kiosk gaming; do
        HOST="${TS_HOST[$KEY]}"
        IP="${LAN_IP[$KEY]}"
        echo -n "  ${KEY} (${HOST} / ${IP}) ... "
        if ${TS_CMD} ping --c=2 "${HOST}" &>/dev/null 2>&1; then
            echo -e "${GREEN}REACHABLE via Tailscale${NC}"
            ((PASS++))
        elif ping -c1 -W3 "${IP}" &>/dev/null 2>&1; then
            echo -e "${YELLOW}REACHABLE via subnet route${NC}"
            ((PASS++))
        else
            echo -e "${RED}UNREACHABLE${NC}"
            ((FAIL++))
        fi
    done

    echo ""
    echo -e "  Results: ${GREEN}${PASS} reachable${NC}  ${RED}${FAIL} unreachable${NC}"
    [[ ${FAIL} -gt 0 ]] && warn "Ensure pi4-guardian is online and subnet route is approved in Tailscale admin."
}

# ── ssh into a device ─────────────────────────────────────────────────────────
do_ssh() {
    local DEVICE="$1"
    [[ -z "${DEVICE_LIST[${DEVICE}]+_}" ]] 2>/dev/null || true
    if [[ -z "${TS_HOST[$DEVICE]+_}" ]]; then
        echo "Unknown device: ${DEVICE}"
        echo ""
        echo "Available devices: pi, nas, compute, kiosk, gaming"
        exit 1
    fi

    check_tailscale

    HOST="${TS_HOST[$DEVICE]}"
    USER="${SSH_USER[$DEVICE]}"
    LAN="${LAN_IP[$DEVICE]}"

    info "Connecting to ${DEVICE} (${HOST} / ${LAN}) as ${USER}..."

    # Try Tailscale hostname first, fall back to LAN IP via subnet route
    if ${TS_CMD} ping --c=1 "${HOST}" &>/dev/null 2>&1; then
        TARGET="${HOST}"
    else
        warn "Tailscale hostname unreachable, trying LAN IP ${LAN} via subnet route..."
        TARGET="${LAN}"
    fi

    if [[ -f "${SSH_KEY}" ]]; then
        ssh ${SSH_OPTS} -i "${SSH_KEY}" "${USER}@${TARGET}" "${@:2}"
    else
        warn "SSH key not found at ${SSH_KEY}. Trying without -i flag..."
        ssh ${SSH_OPTS} "${USER}@${TARGET}" "${@:2}"
    fi
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
TARGET="${1:-}"

case "${TARGET}" in
    status)             do_status ;;
    check)              do_check ;;
    pi|nas|compute|kiosk|gaming)
                        do_ssh "${TARGET}" "${@:2}" ;;
    "")
        echo "Usage: $0 [pi|nas|compute|kiosk|gaming|status|check] [extra ssh args]"
        echo ""
        echo "  pi       — Raspberry Pi 4 Guardian (192.168.1.10)"
        echo "  nas      — UGREEN NAS vault      (192.168.1.11)"
        echo "  compute  — Lenovo ThinkCentre    (192.168.1.12)"
        echo "  kiosk    — HP t640 thin client   (192.168.1.13)"
        echo "  gaming   — Gaming Rig / LLM Forge (192.168.1.20)"
        echo "  status   — Show Tailscale status"
        echo "  check    — Ping all devices"
        echo ""
        echo "  SSH_KEY env override: SSH_KEY=/path/to/key $0 pi"
        exit 0
        ;;
    *)
        die "Unknown target: ${TARGET}. Run without args to see usage."
        ;;
esac
