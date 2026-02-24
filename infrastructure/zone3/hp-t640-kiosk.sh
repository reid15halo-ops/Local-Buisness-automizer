#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions 95/5 Architecture — Zone 3
# Component 3.5: HP t640 Thin Client (Command Center Dashboard)
# Roles: Kiosk display, 4-monitor array, Flutter dashboard, Grafana viewer
#
# Target OS : Ubuntu 22.04 Minimal (Server ISO + manual minimal install)
# Run as    : sudo bash hp-t640-kiosk.sh
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
KIOSK_USER="kiosk"
PRIMARY_URL="${PRIMARY_URL:-http://thinkcenter-m75n:3000}"
GRAFANA_URL="${GRAFANA_URL:-http://thinkcenter-m75n:3001}"
HOSTNAME_NEW="hp-t640-kiosk"

# Monitor layout (adjust DISPLAY_OUTPUTS to match your physical setup)
# HP t640 supports 4x DisplayPort via AMD Radeon embedded
DISPLAY_OUTPUTS=(
    "DP-1"   # Monitor 1 — Primary dashboard
    "DP-2"   # Monitor 2 — Grafana metrics
    "DP-3"   # Monitor 3 — Reserved / Uptime Kuma
    "DP-4"   # Monitor 4 — Reserved / Logs
)
MONITOR_RESOLUTION="1920x1080"
MONITOR_RATE="60"

# ── Pre-flight ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Must be run as root (sudo)."

info "============================================================"
info "  FreyAI Zone 3 — HP t640 Thin Client (Command Center)     "
info "============================================================"

# ── 1. System update & hostname ───────────────────────────────────────────────
info "[1/8] Updating system and setting hostname..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    curl wget ca-certificates git xauth \
    dbus-x11 at-spi2-core

hostnamectl set-hostname "${HOSTNAME_NEW}" 2>/dev/null || true
success "Hostname set to ${HOSTNAME_NEW}."

# ── 2. Create kiosk user ──────────────────────────────────────────────────────
info "[2/8] Creating restricted kiosk user..."
if ! id "${KIOSK_USER}" &>/dev/null; then
    useradd -m -s /bin/bash \
        --groups audio,video,plugdev \
        --comment "FreyAI Kiosk Display User" \
        "${KIOSK_USER}"
    # Lock password — login only via autologin/PAM, not password
    passwd -l "${KIOSK_USER}"
    success "Kiosk user '${KIOSK_USER}' created (password locked)."
else
    warn "Kiosk user '${KIOSK_USER}' already exists."
fi
KIOSK_HOME=$(getent passwd "${KIOSK_USER}" | cut -d: -f6)

# ── 3. Install minimal desktop (Openbox) ─────────────────────────────────────
info "[3/8] Installing minimal Openbox desktop environment..."
apt-get install -y -qq \
    xorg xserver-xorg xinit openbox \
    lightdm lightdm-autologin-greeter \
    x11-xserver-utils x11-utils \
    xdotool wmctrl unclutter \
    pulseaudio alsa-utils \
    fonts-liberation fonts-noto

success "Openbox + LightDM installed."

# ── 4. Install Chromium browser ───────────────────────────────────────────────
info "[4/8] Installing Chromium browser..."
# Prefer chromium-browser snap or apt
if ! command -v chromium-browser &>/dev/null && ! command -v chromium &>/dev/null; then
    # Try apt first (Debian/Ubuntu)
    apt-get install -y -qq chromium-browser 2>/dev/null \
        || apt-get install -y -qq chromium 2>/dev/null \
        || snap install chromium 2>/dev/null \
        || die "Could not install Chromium."
fi
CHROMIUM_BIN=$(command -v chromium-browser 2>/dev/null || command -v chromium 2>/dev/null)
success "Chromium installed at ${CHROMIUM_BIN}."

# ── 5. Configure LightDM autologin ───────────────────────────────────────────
info "[5/8] Configuring LightDM autologin for kiosk user..."
LIGHTDM_CONF=/etc/lightdm/lightdm.conf
mkdir -p /etc/lightdm

cat > "${LIGHTDM_CONF}" <<EOF
[LightDM]
run-directory=/run/lightdm

[Seat:*]
autologin-guest=false
autologin-user=${KIOSK_USER}
autologin-user-timeout=0
user-session=openbox
greeter-session=lightdm-autologin-greeter

[XDMCPServer]
enabled=false
EOF

systemctl enable lightdm
success "LightDM autologin configured for '${KIOSK_USER}'."

# ── 6. Configure Openbox autostart (kiosk mode) ───────────────────────────────
info "[6/8] Configuring Openbox kiosk session..."
OPENBOX_CONF_DIR="${KIOSK_HOME}/.config/openbox"
mkdir -p "${OPENBOX_CONF_DIR}"

# xrandr multi-monitor configuration
XRANDR_SCRIPT="${KIOSK_HOME}/.config/freyai-xrandr.sh"
cat > "${XRANDR_SCRIPT}" <<XRANDR_EOF
#!/usr/bin/env bash
# FreyAI HP t640 — 4-monitor xrandr layout
# Adjust connector names by running: xrandr --query
set -euo pipefail

sleep 2   # Give X time to settle

# Detect connected outputs
CONNECTED=()
while IFS= read -r line; do
    if echo "\${line}" | grep -q " connected"; then
        CONNECTED+=("\$(echo "\${line}" | awk '{print \$1}')")
    fi
done < <(xrandr --query 2>/dev/null)

if [[ \${#CONNECTED[@]} -eq 0 ]]; then
    echo "No connected displays found." >&2
    exit 1
fi

echo "Connected displays: \${CONNECTED[*]}"

# Build xrandr command based on number of connected monitors
case \${#CONNECTED[@]} in
1)
    xrandr --output "\${CONNECTED[0]}" \
        --mode ${MONITOR_RESOLUTION} --rate ${MONITOR_RATE} --primary
    ;;
2)
    xrandr \
        --output "\${CONNECTED[0]}" --mode ${MONITOR_RESOLUTION} --rate ${MONITOR_RATE} --primary --pos 0x0 \
        --output "\${CONNECTED[1]}" --mode ${MONITOR_RESOLUTION} --rate ${MONITOR_RATE} --right-of "\${CONNECTED[0]}"
    ;;
3)
    xrandr \
        --output "\${CONNECTED[0]}" --mode ${MONITOR_RESOLUTION} --rate ${MONITOR_RATE} --primary --pos 0x0 \
        --output "\${CONNECTED[1]}" --mode ${MONITOR_RESOLUTION} --rate ${MONITOR_RATE} --right-of "\${CONNECTED[0]}" \
        --output "\${CONNECTED[2]}" --mode ${MONITOR_RESOLUTION} --rate ${MONITOR_RATE} --right-of "\${CONNECTED[1]}"
    ;;
4|*)
    xrandr \
        --output "\${CONNECTED[0]}" --mode ${MONITOR_RESOLUTION} --rate ${MONITOR_RATE} --primary --pos 0x0 \
        --output "\${CONNECTED[1]}" --mode ${MONITOR_RESOLUTION} --rate ${MONITOR_RATE} --right-of "\${CONNECTED[0]}" \
        --output "\${CONNECTED[2]}" --mode ${MONITOR_RESOLUTION} --rate ${MONITOR_RATE} --below "\${CONNECTED[0]}" \
        --output "\${CONNECTED[3]}" --mode ${MONITOR_RESOLUTION} --rate ${MONITOR_RATE} --right-of "\${CONNECTED[2]}"
    ;;
esac

echo "xrandr layout applied for \${#CONNECTED[@]} monitor(s)."
XRANDR_EOF
chmod +x "${XRANDR_SCRIPT}"

# Chromium kiosk launcher (handles crashes, reloads, multi-window)
KIOSK_LAUNCHER="${KIOSK_HOME}/.config/freyai-kiosk.sh"
cat > "${KIOSK_LAUNCHER}" <<KIOSK_LAUNCHER_EOF
#!/usr/bin/env bash
# FreyAI Kiosk Launcher — Chromium fullscreen with crash recovery
set -euo pipefail

PRIMARY_URL="${PRIMARY_URL}"
GRAFANA_URL="${GRAFANA_URL}"
UPTIME_KUMA_URL="http://pi4-guardian:3001"
CHROMIUM="${CHROMIUM_BIN}"

# Disable screen lock / screensaver
xset s off
xset s noblank
xset -dpms

# Hide cursor after 2 seconds of inactivity
unclutter -idle 2 -root &

# Wait for network
for i in \$(seq 1 30); do
    curl -sf "http://thinkcenter-m75n:3000" &>/dev/null && break
    echo "Waiting for dashboard (\${i}/30)..."
    sleep 3
done

# Chromium flags for kiosk mode
CHROMIUM_FLAGS=(
    --kiosk
    --no-first-run
    --disable-infobars
    --disable-session-crashed-bubble
    --disable-restore-session-state
    --disable-translate
    --disable-features=TranslateUI
    --disable-component-update
    --noerrdialogs
    --disable-pinch
    --overscroll-history-navigation=0
    --force-device-scale-factor=1
    --disable-background-networking
    --safebrowsing-disable-auto-update
    --password-store=basic
    --use-mock-keychain
    --check-for-update-interval=31536000
)

# For multi-monitor: open each URL on a specific display
CONNECTED_COUNT=\$(xrandr --query | grep -c " connected" || echo 1)

if [[ \${CONNECTED_COUNT} -ge 2 ]]; then
    # Display 1 — Primary dashboard
    DISPLAY=:0 "\${CHROMIUM}" "\${CHROMIUM_FLAGS[@]}" \
        --window-position=0,0 \
        --window-size=1920,1080 \
        "\${PRIMARY_URL}" &

    sleep 2

    # Display 2 — Grafana (new window on second monitor)
    DISPLAY=:0 "\${CHROMIUM}" "\${CHROMIUM_FLAGS[@]}" \
        --window-position=1920,0 \
        --window-size=1920,1080 \
        --new-window "\${GRAFANA_URL}" &

    if [[ \${CONNECTED_COUNT} -ge 3 ]]; then
        sleep 1
        # Display 3 — Uptime Kuma
        DISPLAY=:0 "\${CHROMIUM}" "\${CHROMIUM_FLAGS[@]}" \
            --window-position=0,1080 \
            --window-size=1920,1080 \
            --new-window "\${UPTIME_KUMA_URL}" &
    fi
else
    # Single monitor — tabbed kiosk
    DISPLAY=:0 "\${CHROMIUM}" "\${CHROMIUM_FLAGS[@]}" \
        "\${PRIMARY_URL}" &
fi

wait
KIOSK_LAUNCHER_EOF
chmod +x "${KIOSK_LAUNCHER}"

# Openbox autostart
cat > "${OPENBOX_CONF_DIR}/autostart" <<AUTOSTART_EOF
# FreyAI Kiosk — Openbox autostart
# Apply monitor layout
bash ~/.config/freyai-xrandr.sh &

# Disable screen saver via X settings
xset s off &
xset s noblank &
xset -dpms &

# Launch kiosk
bash ~/.config/freyai-kiosk.sh &
AUTOSTART_EOF

# Minimal Openbox config (no right-click menu escape)
mkdir -p "${OPENBOX_CONF_DIR}"
cat > "${OPENBOX_CONF_DIR}/rc.xml" <<RC_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!-- FreyAI Kiosk — Minimal Openbox config (no desktop escape) -->
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <resistance><strength>10</strength><screen_edge_strength>20</screen_edge_strength></resistance>
  <focus><focusNew>yes</focusNew><followMouse>no</followMouse></focus>
  <placement><policy>UnderMouse</policy></placement>
  <theme><name>Clearlooks</name><titleLayout></titleLayout><keepBorder>no</keepBorder></theme>
  <desktops><number>1</number><firstdesk>1</firstdesk><names><name>FreyAI</name></names></desktops>
  <resize><drawContents>yes</drawContents></resize>
  <keyboard>
    <!-- Disable all escape hotkeys -->
    <!-- <keybind key="..."> intentionally empty -->
  </keyboard>
  <mouse>
    <!-- Remove right-click desktop menu to prevent kiosk escape -->
    <context name="Desktop"></context>
  </mouse>
  <applications>
    <application class="*">
      <decor>no</decor>
      <maximized>yes</maximized>
    </application>
  </applications>
</openbox_config>
RC_EOF

# Fix ownership
chown -R "${KIOSK_USER}:${KIOSK_USER}" "${KIOSK_HOME}/.config"
success "Openbox kiosk session configured."

# ── 7. Disable screen saver and power management ──────────────────────────────
info "[7/8] Disabling screen saver and power management..."
# System-level (no display sleep/hibernate)
cat > /etc/systemd/logind.conf.d/no-sleep.conf <<EOF
[Login]
IdleAction=ignore
IdleActionSec=0
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
EOF
mkdir -p /etc/systemd/logind.conf.d

# Xorg power management off via config
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/10-dpms-off.conf <<EOF
Section "ServerFlags"
    Option "BlankTime"  "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime"    "0"
EndSection

Section "Monitor"
    Identifier "Monitor0"
    Option "DPMS" "false"
EndSection
EOF
success "Screen saver and DPMS disabled."

# ── 8. Systemd kiosk service (backup — LightDM is primary) ───────────────────
info "[8/8] Creating systemd kiosk service..."
cat > /etc/systemd/system/freyai-kiosk.service <<EOF
[Unit]
Description=FreyAI Command Center Kiosk Display
After=graphical.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${KIOSK_USER}
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/${KIOSK_USER}/.Xauthority
ExecStart=${KIOSK_LAUNCHER}
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
EOF
systemctl daemon-reload
systemctl enable freyai-kiosk.service
success "freyai-kiosk.service enabled."

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Zone 3 — HP t640 Thin Client (Command Center) — COMPLETE  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Hostname        : ${HOSTNAME_NEW}"
echo "  Kiosk user      : ${KIOSK_USER} (password locked)"
echo "  Primary URL     : ${PRIMARY_URL}"
echo "  Grafana URL     : ${GRAFANA_URL}"
echo "  Desktop WM      : Openbox (minimal, no escape routes)"
echo "  Display login   : LightDM auto-login"
echo ""
echo "  Monitor setup   : Run '${XRANDR_SCRIPT}' to reconfigure"
echo "  Browser flags   : --kiosk (fullscreen, no address bar)"
echo ""
echo "  Next steps:"
echo "    1. Reboot to apply autologin"
echo "    2. Connect monitors and verify xrandr output"
echo "    3. Confirm ${PRIMARY_URL} is reachable"
echo ""
