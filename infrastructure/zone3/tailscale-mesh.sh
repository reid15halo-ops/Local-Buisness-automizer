#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions 95/5 Architecture — Zone 3
# Master Tailscale Mesh Configuration
# Run this FIRST before setting up individual devices.
#
# Purpose:
#   - Documents full network topology
#   - Generates tailscale-acl.json for Tailscale admin panel upload
#   - Tests connectivity between all nodes
#   - Enrolls devices (if TAILSCALE_AUTHKEY is set)
#
# Run as: bash tailscale-mesh.sh [enroll|acl|test|topology]
# Idempotent: Yes
# =============================================================================
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${NC}"; }

# =============================================================================
# NETWORK TOPOLOGY
# =============================================================================
# Zone labels and Tailscale hostnames:
#
#   Tag            | Hostname          | Device                | Role
#   ---------------|-------------------|-----------------------|-------------------
#   Z3-NAS         | nas-vault         | UGREEN NAS 2300       | Sovereign Vault
#   Z3-COMPUTE     | thinkcenter-m75n  | Lenovo ThinkCentre    | Edge Compute / Staging
#   Z3-PI          | pi4-guardian      | Raspberry Pi 4        | Subnet Router / DNS
#   Z3-KIOSK       | hp-t640-kiosk     | HP t640 Thin Client   | Command Center Display
#   Z3-GAMING      | gaming-forge      | Gaming Rig (on-demand)| LLM Heavy Forge
#   Z2-VPS         | hetzner-vps       | Hetzner CX21 VPS      | Production (Zone 2)
#
# Subnet routed by pi4-guardian: 192.168.1.0/24
# All Zone 3 devices are on the 192.168.1.0/24 LAN (physical)
# Tailscale provides encrypted overlay: 100.x.x.x address space
# =============================================================================

# ── Node definitions ──────────────────────────────────────────────────────────
declare -A NODE_HOSTNAME NODE_TAG NODE_IP NODE_ROLE NODE_ZONE NODE_ALWAYS_ON

# Zone 3 — Home Network Rack
NODE_HOSTNAME[nas]="nas-vault"
NODE_TAG[nas]="tag:zone3-nas"
NODE_IP[nas]="192.168.1.11"
NODE_ROLE[nas]="Backup vault, Restic repository"
NODE_ZONE[nas]="3"
NODE_ALWAYS_ON[nas]="true"

NODE_HOSTNAME[compute]="thinkcenter-m75n"
NODE_TAG[compute]="tag:zone3-compute"
NODE_IP[compute]="192.168.1.12"
NODE_ROLE[compute]="Docker host, n8n staging, Portainer, Coolify"
NODE_ZONE[compute]="3"
NODE_ALWAYS_ON[compute]="true"

NODE_HOSTNAME[pi]="pi4-guardian"
NODE_TAG[pi]="tag:zone3-pi"
NODE_IP[pi]="192.168.1.10"
NODE_ROLE[pi]="Tailscale subnet router, Pi-hole DNS, Uptime Kuma"
NODE_ZONE[pi]="3"
NODE_ALWAYS_ON[pi]="true"

NODE_HOSTNAME[kiosk]="hp-t640-kiosk"
NODE_TAG[kiosk]="tag:zone3-kiosk"
NODE_IP[kiosk]="192.168.1.13"
NODE_ROLE[kiosk]="Kiosk display, Command center"
NODE_ZONE[kiosk]="3"
NODE_ALWAYS_ON[kiosk]="true"

NODE_HOSTNAME[gaming]="gaming-forge"
NODE_TAG[gaming]="tag:zone3-gaming"
NODE_IP[gaming]="192.168.1.20"
NODE_ROLE[gaming]="LLM inference (Ollama), Flutter builds — on-demand"
NODE_ZONE[gaming]="3"
NODE_ALWAYS_ON[gaming]="false"

# Zone 2 — Hetzner VPS
NODE_HOSTNAME[vps]="hetzner-vps"
NODE_TAG[vps]="tag:zone2-vps"
NODE_IP[vps]="10.0.0.1"         # Hetzner private; actual TS IP assigned dynamically
NODE_ROLE[vps]="Production: n8n, FastAPI, Postgres"
NODE_ZONE[vps]="2"
NODE_ALWAYS_ON[vps]="true"

TAILSCALE_AUTHKEY="${TAILSCALE_AUTHKEY:-}"
OUTPUT_DIR="${OUTPUT_DIR:-$(dirname "$0")}"
ACL_FILE="${OUTPUT_DIR}/tailscale-acl.json"
MODE="${1:-topology}"

# =============================================================================
# TOPOLOGY — print the network map
# =============================================================================
do_topology() {
    header "FreyAI Tailscale Mesh Topology"
    echo ""
    printf "${BOLD}%-14s %-22s %-18s %-8s %s${NC}\n" "Label" "Hostname" "LAN IP" "Zone" "Role"
    printf "%-14s %-22s %-18s %-8s %s\n" "──────────────" "──────────────────────" "──────────────────" "────────" "────────────────────────────────"

    for KEY in nas compute pi kiosk gaming vps; do
        ALWAYS="${NODE_ALWAYS_ON[$KEY]}"
        MARKER=$([[ "${ALWAYS}" == "true" ]] && echo "" || echo " (on-demand)")
        printf "%-14s %-22s %-18s %-8s %s%s\n" \
            "Z${NODE_ZONE[$KEY]}-${KEY^^}" \
            "${NODE_HOSTNAME[$KEY]}" \
            "${NODE_IP[$KEY]}" \
            "Zone ${NODE_ZONE[$KEY]}" \
            "${NODE_ROLE[$KEY]}" \
            "${MARKER}"
    done

    echo ""
    echo "  Subnet routed by pi4-guardian: 192.168.1.0/24"
    echo "  All Zone 3 devices also reachable at their LAN IPs via subnet route."
    echo ""
    echo "  Traffic flow:"
    echo "    Hetzner VPS  ──── Tailscale ────  pi4-guardian (subnet router)"
    echo "                                              │"
    echo "                                   192.168.1.0/24 LAN"
    echo "                              ┌────────────────────────────┐"
    echo "                          nas-vault   thinkcenter-m75n  hp-t640-kiosk"
    echo "                                         gaming-forge (on-demand)"
}

# =============================================================================
# ACL — generate Tailscale ACL JSON
# =============================================================================
do_acl() {
    header "Generating Tailscale ACL (${ACL_FILE})"

    cat > "${ACL_FILE}" <<'ACL_EOF'
{
  "//": "FreyAI Visions 95/5 — Tailscale ACL",
  "//version": "2024-02",

  "tagOwners": {
    "tag:zone2-vps":      ["autogroup:admin"],
    "tag:zone3-nas":      ["autogroup:admin"],
    "tag:zone3-compute":  ["autogroup:admin"],
    "tag:zone3-pi":       ["autogroup:admin"],
    "tag:zone3-kiosk":    ["autogroup:admin"],
    "tag:zone3-gaming":   ["autogroup:admin"]
  },

  "acls": [
    {
      "//": "Zone 2 VPS can reach ALL Zone 3 devices (monitoring, backups, deploys)",
      "action": "accept",
      "src":  ["tag:zone2-vps"],
      "dst":  [
        "tag:zone3-nas:*",
        "tag:zone3-compute:*",
        "tag:zone3-pi:*",
        "tag:zone3-kiosk:*",
        "tag:zone3-gaming:*"
      ]
    },
    {
      "//": "Zone 3 devices can reach the Hetzner VPS (pull backups, push metrics)",
      "action": "accept",
      "src":  [
        "tag:zone3-nas",
        "tag:zone3-compute",
        "tag:zone3-pi",
        "tag:zone3-kiosk",
        "tag:zone3-gaming"
      ],
      "dst":  ["tag:zone2-vps:*"]
    },
    {
      "//": "Zone 3 intra-cluster: all devices can talk to each other",
      "action": "accept",
      "src":  [
        "tag:zone3-nas",
        "tag:zone3-compute",
        "tag:zone3-pi",
        "tag:zone3-kiosk",
        "tag:zone3-gaming"
      ],
      "dst":  [
        "tag:zone3-nas:*",
        "tag:zone3-compute:*",
        "tag:zone3-pi:*",
        "tag:zone3-kiosk:*",
        "tag:zone3-gaming:*"
      ]
    },
    {
      "//": "Admins (owners) can reach everything",
      "action": "accept",
      "src":  ["autogroup:admin"],
      "dst":  ["*:*"]
    }
  ],

  "ssh": [
    {
      "//": "Admin SSH access to all devices",
      "action": "accept",
      "src":    ["autogroup:admin"],
      "dst":    ["autogroup:self"],
      "users":  ["autogroup:nonroot", "root"]
    },
    {
      "//": "VPS can SSH into Zone 3 devices (for deployment scripts)",
      "action": "accept",
      "src":    ["tag:zone2-vps"],
      "dst":    ["tag:zone3-nas", "tag:zone3-compute", "tag:zone3-pi"],
      "users":  ["ubuntu", "admin", "pi"]
    }
  ],

  "derpMap": {
    "//": "Using Tailscale's global DERP; add custom DERP if needed",
    "OmitDefaultRegions": false,
    "Regions": {}
  },

  "nodeAttrs": [
    {
      "//": "Pi4 advertises subnet and exit node",
      "target": ["tag:zone3-pi"],
      "attr":   ["funnel"]
    }
  ]
}
ACL_EOF

    success "Tailscale ACL written to: ${ACL_FILE}"
    echo ""
    echo "  Upload this file to:"
    echo "  https://login.tailscale.com/admin/acls"
    echo ""
    echo "  After upload, in Tailscale Admin approve:"
    echo "    - Subnet route: 192.168.1.0/24 (from pi4-guardian)"
    echo "    - Exit node: pi4-guardian"
}

# =============================================================================
# ENROLL — connect each device to Tailscale using the authkey
# =============================================================================
do_enroll() {
    header "Tailscale Device Enrollment"
    [[ -z "${TAILSCALE_AUTHKEY}" ]] && die "TAILSCALE_AUTHKEY must be set. Export it before running."

    info "This generates enrollment commands for each device."
    info "Run the appropriate command ON each device."
    echo ""

    for KEY in nas compute pi kiosk gaming vps; do
        HOST="${NODE_HOSTNAME[$KEY]}"
        TAG="${NODE_TAG[$KEY]}"
        echo -e "${BOLD}# ${HOST} (${TAG})${NC}"

        EXTRA_FLAGS=""
        # Pi4 needs subnet router + exit node flags
        if [[ "${KEY}" == "pi" ]]; then
            EXTRA_FLAGS="--advertise-routes=192.168.1.0/24 --advertise-exit-node"
        fi
        # Gaming rig: no auto-start, just the connect command
        if [[ "${KEY}" == "gaming" ]]; then
            EXTRA_FLAGS="# Note: run on-demand only"
        fi

        echo "  tailscale up \\"
        echo "    --authkey=\"\${TAILSCALE_AUTHKEY}\" \\"
        echo "    --hostname=${HOST} \\"
        if [[ "${KEY}" == "pi" ]]; then
            echo "    --advertise-routes=192.168.1.0/24 \\"
            echo "    --advertise-exit-node \\"
        fi
        echo "    --accept-dns=false"
        echo ""
    done

    info "After enrolling all devices, run: $0 test"
}

# =============================================================================
# TEST — verify connectivity between all nodes
# =============================================================================
do_test() {
    header "Tailscale Mesh Connectivity Test"
    PASS=0; FAIL=0

    # Check tailscale is available
    if ! command -v tailscale &>/dev/null; then
        die "Tailscale not installed on this machine. Run tests from a node in the mesh."
    fi

    info "Current node status:"
    tailscale status 2>/dev/null || warn "tailscale status failed"
    echo ""

    info "Pinging all nodes by hostname..."
    for KEY in nas compute pi kiosk vps; do
        HOST="${NODE_HOSTNAME[$KEY]}"
        echo -n "  ${HOST} ... "
        if tailscale ping --c=3 "${HOST}" &>/dev/null 2>&1; then
            echo -e "${GREEN}REACHABLE${NC}"
            ((PASS++))
        else
            echo -e "${RED}UNREACHABLE${NC}"
            ((FAIL++))
        fi
    done

    # Gaming rig — skip if not connected (on-demand)
    HOST_GAMING="${NODE_HOSTNAME[gaming]}"
    echo -n "  ${HOST_GAMING} (on-demand) ... "
    if tailscale ping --c=2 "${HOST_GAMING}" &>/dev/null 2>&1; then
        echo -e "${GREEN}REACHABLE${NC}"
        ((PASS++))
    else
        echo -e "${YELLOW}OFFLINE (expected if on-demand)${NC}"
    fi

    echo ""
    info "Service checks (via Tailscale hostnames)..."
    declare -A SVC_CHECKS
    SVC_CHECKS["${NODE_HOSTNAME[compute]}:3000"]="FreyAI Dashboard (staging)"
    SVC_CHECKS["${NODE_HOSTNAME[compute]}:5679"]="n8n Staging"
    SVC_CHECKS["${NODE_HOSTNAME[pi]}:3001"]="Uptime Kuma"
    SVC_CHECKS["${NODE_HOSTNAME[pi]}/admin"]="Pi-hole Admin"

    for ENDPOINT in "${!SVC_CHECKS[@]}"; do
        SVC_NAME="${SVC_CHECKS[$ENDPOINT]}"
        echo -n "  ${SVC_NAME} (${ENDPOINT}) ... "
        if curl -sf --max-time 5 "http://${ENDPOINT}" &>/dev/null; then
            echo -e "${GREEN}UP${NC}"
            ((PASS++))
        else
            echo -e "${YELLOW}DOWN or unreachable from here${NC}"
        fi
    done

    echo ""
    echo -e "  Results: ${GREEN}${PASS} passed${NC}  ${RED}${FAIL} failed${NC}"
    [[ ${FAIL} -gt 0 ]] && warn "Some nodes unreachable — check device power and Tailscale enrollment."
}

# =============================================================================
# Dispatch
# =============================================================================
case "${MODE}" in
    topology) do_topology ;;
    acl)      do_acl      ;;
    enroll)   do_enroll   ;;
    test)     do_test     ;;
    all)
        do_topology
        do_acl
        do_enroll
        ;;
    *)
        echo "Usage: $0 [topology|acl|enroll|test|all]"
        echo ""
        echo "  topology  — Print the Zone 3 network map"
        echo "  acl       — Generate tailscale-acl.json for admin panel"
        echo "  enroll    — Print enrollment commands for each device"
        echo "  test      — Test connectivity to all mesh nodes"
        echo "  all       — Run topology + acl + enroll"
        exit 1
        ;;
esac
