#!/usr/bin/env bash
# =============================================================================
# FreyAI Visions 95/5 Architecture — Zone 3
# Component 3.6: Gaming Rig (Heavy Forge)
# Hardware: AMD Ryzen Zen3 + NVIDIA RTX 3060 Ti
# OS      : Linux Mint (Ubuntu 22.04 base)
# Roles   : Local LLM inference (Ollama + CUDA), Flutter builds, on-demand
#
# Run as  : sudo bash gaming-rig-setup.sh
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
TAILSCALE_AUTHKEY="${TAILSCALE_AUTHKEY:-}"
OLLAMA_HOST="0.0.0.0"
OLLAMA_PORT=11434
OLLAMA_GPU_LAYERS=-1          # -1 = all layers on GPU
FLUTTER_VERSION="3.19.0"
FLUTTER_INSTALL_DIR="/opt/flutter"
FREYAI_API_CONFIG="/etc/freyai/backend.env"

# Models to pull (adjust to available VRAM — RTX 3060 Ti has 8GB)
OLLAMA_MODELS=(
    "llama3.1:8b"     # ~5GB VRAM — primary chat model
    "mistral:7b"      # ~4.1GB VRAM — coding / fast inference
    "codellama:13b"   # ~8GB VRAM — requires full GPU, no other models
)

# ── Pre-flight ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Must be run as root (sudo)."
REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo ubuntu)}"
REAL_HOME=$(getent passwd "${REAL_USER}" | cut -d: -f6)

info "============================================================"
info "  FreyAI Zone 3 — Gaming Rig Heavy Forge Setup             "
info "  Hardware: AMD Ryzen Zen3 + RTX 3060 Ti (8GB VRAM)        "
info "============================================================"

# ── 1. System update ──────────────────────────────────────────────────────────
info "[1/8] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    curl wget git ca-certificates gnupg lsb-release \
    apt-transport-https software-properties-common \
    build-essential pciutils net-tools htop jq \
    unzip xz-utils libglu1-mesa
success "System updated."

# ── 2. CUDA 12.x drivers (RTX 3060 Ti) ───────────────────────────────────────
info "[2/8] Installing CUDA 12.x + NVIDIA drivers..."
if ! command -v nvcc &>/dev/null && ! nvidia-smi &>/dev/null 2>&1; then
    # Detect Ubuntu base version for CUDA repo
    UBUNTU_VERSION=$(lsb_release -rs | tr -d '.' | cut -c1-4 || echo "2204")
    # For Linux Mint, map to Ubuntu codename
    UBUNTU_CODENAME=$(. /etc/os-release && echo "${UBUNTU_CODENAME:-jammy}")

    # CUDA keyring
    CUDA_KEYRING_PKG="cuda-keyring_1.1-1_all.deb"
    curl -fsSL -o "/tmp/${CUDA_KEYRING_PKG}" \
        "https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/${CUDA_KEYRING_PKG}"
    dpkg -i "/tmp/${CUDA_KEYRING_PKG}" || true
    rm -f "/tmp/${CUDA_KEYRING_PKG}"

    apt-get update -qq
    apt-get install -y -qq cuda-toolkit-12-3 cuda-drivers
    success "CUDA 12.3 + NVIDIA drivers installed."
    warn "NOTE: A reboot is required before CUDA acceleration works."
    warn "      Run: sudo reboot && sudo bash $0"
else
    CUDA_VER=$(nvcc --version 2>/dev/null | grep -oP 'release \K[\d.]+' || nvidia-smi | grep -oP 'CUDA Version: \K[\d.]+' || echo "already installed")
    warn "CUDA already installed: ${CUDA_VER}"
fi

# Add CUDA to PATH for the real user
CUDA_PROFILE=/etc/profile.d/cuda.sh
if [[ ! -f "${CUDA_PROFILE}" ]]; then
    cat > "${CUDA_PROFILE}" <<'EOF'
export PATH=/usr/local/cuda/bin:$PATH
export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH
EOF
    source "${CUDA_PROFILE}" 2>/dev/null || true
fi

# ── 3. Install Ollama ─────────────────────────────────────────────────────────
info "[3/8] Installing Ollama (local LLM inference)..."
if ! command -v ollama &>/dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
    success "Ollama installed."
else
    warn "Ollama already installed: $(ollama --version 2>/dev/null || echo 'unknown version')."
fi

# Configure Ollama for GPU + remote access
OLLAMA_ENV_FILE=/etc/systemd/system/ollama.service.d/override.conf
mkdir -p "$(dirname "${OLLAMA_ENV_FILE}")"
cat > "${OLLAMA_ENV_FILE}" <<EOF
[Service]
Environment="OLLAMA_HOST=${OLLAMA_HOST}:${OLLAMA_PORT}"
Environment="OLLAMA_GPU_LAYERS=${OLLAMA_GPU_LAYERS}"
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="CUDA_VISIBLE_DEVICES=0"
EOF

systemctl daemon-reload
systemctl enable --now ollama
# Give Ollama a moment to start
sleep 3
success "Ollama service configured with GPU acceleration."

# ── 4. Pull Ollama models ─────────────────────────────────────────────────────
info "[4/8] Pulling LLM models (this may take a while)..."
info "RTX 3060 Ti has 8GB VRAM. Only one 13B model can run at a time."

# Pull models (idempotent — skips if already present)
for MODEL in "${OLLAMA_MODELS[@]}"; do
    info "Pulling ${MODEL}..."
    if ollama show "${MODEL}" &>/dev/null 2>&1; then
        warn "${MODEL} already pulled — skipping."
    else
        ollama pull "${MODEL}" \
        && success "${MODEL} ready." \
        || warn "Failed to pull ${MODEL} — check disk space and connectivity."
    fi
done

info "Available models:"
ollama list 2>/dev/null || true

# ── 5. Install Tailscale (on-demand) ─────────────────────────────────────────
info "[5/8] Installing Tailscale (on-demand connection)..."
if ! command -v tailscale &>/dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    success "Tailscale installed."
else
    warn "Tailscale already installed."
fi
# Note: NOT auto-starting Tailscale — gaming rig connects on-demand
systemctl disable tailscaled 2>/dev/null || true
success "Tailscale installed (not auto-started — on-demand only)."

# ── 6. Install Flutter SDK ────────────────────────────────────────────────────
info "[6/8] Installing Flutter SDK ${FLUTTER_VERSION}..."
if [[ ! -d "${FLUTTER_INSTALL_DIR}" ]]; then
    FLUTTER_ARCHIVE="flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"
    curl -fsSL -o "/tmp/${FLUTTER_ARCHIVE}" \
        "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/${FLUTTER_ARCHIVE}"
    mkdir -p "$(dirname "${FLUTTER_INSTALL_DIR}")"
    tar xf "/tmp/${FLUTTER_ARCHIVE}" -C "$(dirname "${FLUTTER_INSTALL_DIR}")"
    rm -f "/tmp/${FLUTTER_ARCHIVE}"
    success "Flutter extracted to ${FLUTTER_INSTALL_DIR}."
else
    warn "Flutter already at ${FLUTTER_INSTALL_DIR}."
fi

# Flutter PATH for all users
FLUTTER_PROFILE=/etc/profile.d/flutter.sh
cat > "${FLUTTER_PROFILE}" <<EOF
export PATH=${FLUTTER_INSTALL_DIR}/bin:\$PATH
EOF
source "${FLUTTER_PROFILE}" 2>/dev/null || true

# Run flutter doctor as real user (non-root)
sudo -u "${REAL_USER}" HOME="${REAL_HOME}" "${FLUTTER_INSTALL_DIR}/bin/flutter" \
    doctor --no-version-check 2>&1 | head -20 || true
success "Flutter installed."

# ── 7. FreyAI connect helper script ──────────────────────────────────────────
info "[7/8] Creating freyai-connect.sh helper..."
CONNECT_SCRIPT=/usr/local/bin/freyai-connect.sh
cat > "${CONNECT_SCRIPT}" <<'CONNECT_EOF'
#!/usr/bin/env bash
# =============================================================================
# FreyAI Gaming Rig — On-Demand Cluster Connect
# Usage: freyai-connect.sh [start|stop|status]
# =============================================================================
set -euo pipefail

TAILSCALE_AUTHKEY="${TAILSCALE_AUTHKEY:-}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
ACTION="${1:-start}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[FreyAI]${NC} $*"; }
success() { echo -e "${GREEN}[FreyAI]${NC} $*"; }

case "${ACTION}" in
start)
    info "Connecting gaming rig to FreyAI cluster..."

    # Start Tailscale
    if ! systemctl is-active tailscaled &>/dev/null; then
        sudo systemctl start tailscaled
    fi
    if ! tailscale status &>/dev/null 2>&1 | grep -q "gaming-forge"; then
        if [[ -n "${TAILSCALE_AUTHKEY}" ]]; then
            sudo tailscale up --authkey="${TAILSCALE_AUTHKEY}" --hostname=gaming-forge
        else
            sudo tailscale up --hostname=gaming-forge
        fi
    fi
    success "Tailscale connected as gaming-forge."
    info "Tailscale IP: $(tailscale ip -4 2>/dev/null || echo 'pending')"

    # Ensure Ollama is running
    if ! systemctl is-active ollama &>/dev/null; then
        sudo systemctl start ollama
        sleep 2
    fi

    OLLAMA_STATUS=$(curl -sf "http://localhost:${OLLAMA_PORT}/api/tags" | jq -r '.models | length' 2>/dev/null || echo 0)
    success "Ollama running — ${OLLAMA_STATUS} models available."
    success "Ollama API: http://$(tailscale ip -4 2>/dev/null || hostname -I | awk '{print $1}'):${OLLAMA_PORT}"

    info "GPU status:"
    nvidia-smi --query-gpu=name,memory.used,memory.free,temperature.gpu \
        --format=csv,noheader 2>/dev/null || echo "  nvidia-smi not available"
    ;;

stop)
    info "Disconnecting from FreyAI cluster..."
    sudo tailscale down 2>/dev/null || true
    # Optionally stop Ollama to free VRAM for gaming
    read -rp "Stop Ollama service to free VRAM for gaming? [y/N] " ans
    [[ "${ans,,}" == "y" ]] && sudo systemctl stop ollama && success "Ollama stopped."
    success "Gaming rig disconnected from cluster."
    ;;

status)
    info "=== Gaming Rig Status ==="
    echo "  Tailscale: $(tailscale status --json 2>/dev/null | jq -r '.BackendState' || echo 'not running')"
    echo "  Ollama   : $(systemctl is-active ollama 2>/dev/null)"
    echo "  Models   : $(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' | tr '\n' ', ')"
    echo "  GPU      :"
    nvidia-smi --query-gpu=name,memory.used,memory.free,temperature.gpu,utilization.gpu \
        --format=csv,noheader 2>/dev/null | sed 's/^/    /' || echo "    (nvidia-smi unavailable)"
    ;;

*)
    echo "Usage: $0 [start|stop|status]"
    exit 1
    ;;
esac
CONNECT_EOF
chmod +x "${CONNECT_SCRIPT}"
success "freyai-connect.sh created at ${CONNECT_SCRIPT}."

# ── 8. Register Ollama as alternative LLM backend in FreyAI config ────────────
info "[8/8] Registering Ollama backend in FreyAI API config..."
mkdir -p /etc/freyai

# This file is sourced by the FastAPI backend startup
cat > "${FREYAI_API_CONFIG}" <<EOF
# FreyAI Backend — LLM Backend Configuration
# Generated by gaming-rig-setup.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)

# Primary LLM backend (set in deployment)
# LLM_BACKEND=openai       # Production
# LLM_BACKEND=ollama       # Local heavy workload

# Ollama backend (Gaming Rig — connect via Tailscale)
OLLAMA_BASE_URL=http://gaming-forge:${OLLAMA_PORT}
OLLAMA_DEFAULT_MODEL=llama3.1:8b
OLLAMA_CODE_MODEL=codellama:13b
OLLAMA_FAST_MODEL=mistral:7b

# GPU inference settings
OLLAMA_TIMEOUT=120           # seconds (13B models are slower)
OLLAMA_MAX_TOKENS=4096
OLLAMA_TEMPERATURE=0.7

# Fallback chain: Ollama → OpenAI (if Ollama unreachable)
LLM_FALLBACK_ENABLED=true
EOF

success "FreyAI API config written to ${FREYAI_API_CONFIG}."

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Zone 3 — Gaming Rig Heavy Forge — COMPLETE                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  GPU             : $(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null || echo 'RTX 3060 Ti (reboot needed for CUDA)')"
echo "  Ollama          : http://localhost:${OLLAMA_PORT}"
echo "  Flutter         : ${FLUTTER_INSTALL_DIR}/bin/flutter"
echo ""
echo "  LLM Models:"
ollama list 2>/dev/null | tail -n +2 | awk '{printf "    %-30s %s\n", $1, $3}' || true
echo ""
echo "  Usage:"
echo "    freyai-connect.sh start    # Join cluster + start Ollama API"
echo "    freyai-connect.sh stop     # Disconnect + optionally free VRAM"
echo "    freyai-connect.sh status   # Show GPU/Ollama/Tailscale status"
echo ""
echo "  IMPORTANT: Reboot required if CUDA drivers were just installed."
echo ""
