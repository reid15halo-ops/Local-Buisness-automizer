#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions — SSH into local network devices from Hostinger VPS
#
# Two connection modes (auto-detected):
#   REVERSE TUNNEL (default) — Pi runs reverse-tunnel-pi.sh, no Tailscale needed
#   TAILSCALE                — Tailscale installed and pi4-guardian enrolled
#
# Prerequisites (reverse tunnel mode):
#   1. On the Pi: sudo bash reverse-tunnel-pi.sh
#   2. VPS public key (~/.ssh/id_ed25519.pub) is already baked into that script
#
# Usage:
#   ./ssh-local.sh pi           — SSH into Raspberry Pi 4 (192.168.1.10)
#   ./ssh-local.sh nas          — SSH into NAS (192.168.1.11)
#   ./ssh-local.sh compute      — SSH into ThinkCentre (192.168.1.12)
#   ./ssh-local.sh kiosk        — SSH into HP t640 kiosk (192.168.1.13)
#   ./ssh-local.sh gaming       — SSH into Gaming Rig (192.168.1.20)
#   ./ssh-local.sh status       — Show connection status
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
TUNNEL_PORT="${TUNNEL_PORT:-2222}"   # reverse tunnel port on localhost

# ── Detect connection mode ────────────────────────────────────────────────────
# Returns "tunnel", "tailscale", or "none"
detect_mode() {
    # Check reverse tunnel first (Pi connected to port 2222)
    if ss -tlnp 2>/dev/null | grep -q ":${TUNNEL_PORT}" || \
       nc -z localhost "${TUNNEL_PORT}" 2>/dev/null; then
        echo "tunnel"
        return
    fi
    # Check Tailscale
    if command -v tailscale &>/dev/null && tailscale status &>/dev/null 2>&1; then
        echo "tailscale"
        return
    fi
    if docker exec tailscale-vps tailscale status &>/dev/null 2>&1; then
        echo "tailscale"
        return
    fi
    echo "none"
}

check_tailscale() {
    if command -v tailscale &>/dev/null; then
        TS_CMD="tailscale"
    elif docker exec tailscale-vps tailscale status &>/dev/null 2>&1; then
        TS_CMD="docker exec tailscale-vps tailscale"
    else
        die "Tailscale not found. Start it: docker compose -f tailscale-compose.yml up -d"
    fi
}

# ── status ────────────────────────────────────────────────────────────────────
do_status() {
    MODE=$(detect_mode)
    info "Connection mode: ${MODE}"
    case "${MODE}" in
        tunnel)
            success "Reverse tunnel active on localhost:${TUNNEL_PORT}"
            ss -tlnp | grep ":${TUNNEL_PORT}" || true
            ;;
        tailscale)
            check_tailscale
            info "Tailscale mesh status:"
            ${TS_CMD} status
            echo ""
            info "VPS Tailscale IP:"
            ${TS_CMD} ip -4 2>/dev/null || echo "  (not connected)"
            ;;
        none)
            warn "No connection to local network."
            warn "Option 1: Run reverse-tunnel-pi.sh on the Pi"
            warn "Option 2: Set up Tailscale via tailscale-compose.yml"
            ;;
    esac
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
    if [[ -z "${TS_HOST[$DEVICE]+_}" ]]; then
        echo "Unknown device: ${DEVICE}"
        echo ""
        echo "Available devices: pi, nas, compute, kiosk, gaming"
        exit 1
    fi

    local HOST="${TS_HOST[$DEVICE]}"
    local USER="${SSH_USER[$DEVICE]}"
    local LAN="${LAN_IP[$DEVICE]}"
    local KEY_FLAG=""
    [[ -f "${SSH_KEY}" ]] && KEY_FLAG="-i ${SSH_KEY}"

    MODE=$(detect_mode)
    info "Connecting to ${DEVICE} (${LAN}) via ${MODE}..."

    case "${MODE}" in
        tunnel)
            if [[ "${DEVICE}" == "pi" ]]; then
                # Direct — Pi is the tunnel endpoint
                ssh ${SSH_OPTS} ${KEY_FLAG} -p "${TUNNEL_PORT}" "${USER}@localhost" "${@:2}"
            else
                # Jump through the Pi to reach other LAN devices
                JUMP="-J ${SSH_USER[pi]}@localhost:${TUNNEL_PORT}"
                [[ -f "${SSH_KEY}" ]] && JUMP="-J ${SSH_USER[pi]}@localhost:${TUNNEL_PORT} -i ${SSH_KEY}"
                ssh ${SSH_OPTS} ${KEY_FLAG} ${JUMP} "${USER}@${LAN}" "${@:2}"
            fi
            ;;
        tailscale)
            check_tailscale
            if ${TS_CMD} ping --c=1 "${HOST}" &>/dev/null 2>&1; then
                TARGET="${HOST}"
            else
                warn "Tailscale hostname unreachable, trying LAN IP ${LAN}..."
                TARGET="${LAN}"
            fi
            ssh ${SSH_OPTS} ${KEY_FLAG} "${USER}@${TARGET}" "${@:2}"
            ;;
        none)
            die "No connection to local network. Run reverse-tunnel-pi.sh on the Pi first."
            ;;
    esac
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
