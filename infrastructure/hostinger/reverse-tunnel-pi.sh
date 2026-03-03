#!/usr/bin/env bash
# =============================================================================
# FreyAI — Reverse SSH tunnel setup for Raspberry Pi
#
# Run this script ON YOUR RASPBERRY PI (as root or with sudo).
# It installs autossh and creates a systemd service that keeps a persistent
# reverse tunnel open to the Hostinger VPS.
#
# After this runs the VPS can SSH into the Pi:
#   ssh -p 2222 pi@localhost          (from VPS shell)
#   ssh pi@localhost -p 2222          (same thing)
#
# And into any device on your LAN by chaining:
#   ssh -p 2222 pi@localhost ssh admin@192.168.1.11   (NAS)
#   ssh -p 2222 pi@localhost ssh admin@192.168.1.12   (ThinkCentre)
# =============================================================================
set -euo pipefail

VPS_IP="21.0.0.114"
VPS_USER="root"
VPS_SSH_PORT=22
TUNNEL_PORT=2222          # Port on VPS that maps to Pi's SSH
LOCAL_SSH_PORT=22         # Pi's local SSH port

# ── 1. Add VPS public key to Pi's authorized_keys ────────────────────────────
echo "Adding VPS public key to authorized_keys..."
mkdir -p ~/.ssh && chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys

VPS_PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGDsiydqrVbQ21HwnYt8CpIUIW6z2kicaQbPgunbedeN hostinger-vps-20260303"

if ! grep -qF "${VPS_PUBKEY}" ~/.ssh/authorized_keys 2>/dev/null; then
    echo "${VPS_PUBKEY}" >> ~/.ssh/authorized_keys
    echo "  Public key added."
else
    echo "  Public key already present — skipped."
fi

# ── 2. Install autossh ────────────────────────────────────────────────────────
echo "Installing autossh..."
apt-get update -qq && apt-get install -y autossh
echo "  autossh installed."

# ── 3. Create systemd service ─────────────────────────────────────────────────
echo "Creating systemd service freyai-reverse-tunnel.service..."
cat > /etc/systemd/system/freyai-reverse-tunnel.service <<EOF
[Unit]
Description=FreyAI Reverse SSH Tunnel → Hostinger VPS
After=network-online.target
Wants=network-online.target

[Service]
User=pi
Environment="AUTOSSH_GATETIME=0"
ExecStart=/usr/bin/autossh -M 0 \\
    -o "ServerAliveInterval=30" \\
    -o "ServerAliveCountMax=3" \\
    -o "ExitOnForwardFailure=yes" \\
    -o "StrictHostKeyChecking=no" \\
    -o "PasswordAuthentication=no" \\
    -N \\
    -R ${TUNNEL_PORT}:localhost:${LOCAL_SSH_PORT} \\
    ${VPS_USER}@${VPS_IP} -p ${VPS_SSH_PORT}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now freyai-reverse-tunnel.service

echo ""
echo "============================================================"
echo "  Reverse tunnel service started!"
echo ""
echo "  From the VPS you can now SSH into this Pi:"
echo "    ssh -p ${TUNNEL_PORT} pi@localhost"
echo ""
echo "  And reach any LAN device:"
echo "    ssh -p ${TUNNEL_PORT} pi@localhost ssh admin@192.168.1.11"
echo "============================================================"
