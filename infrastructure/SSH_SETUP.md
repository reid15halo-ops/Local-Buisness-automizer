# SSH Access Setup for Local Business Automizer Network

This guide covers SSH access configuration for your entire network infrastructure.

## Network Devices

Your network consists of the following devices:

### Zone3 Infrastructure
- **Pi4**: Raspberry Pi 4 - Primary edge server
- **Gaming Rig**: Local computing resource
- **HP T640 Kiosk**: Thin client terminal
- **ThinK Center**: Secondary workstation
- **NAS Backup**: Network attached storage

### Cloud Infrastructure
- **Hetzner VPS**: Primary cloud hosting
- **Email Relay VPS**: Email service provider

### Mesh Network
- **Tailscale**: Secure mesh VPN connecting all devices

---

## SSH Key Setup

### 1. Generate SSH Keys

Generate a strong SSH key pair for your network access:

```bash
ssh-keygen -t ed25519 -C "your-email@example.com" -f ~/.ssh/lba-network
# Optional: For older systems that don't support Ed25519, use RSA:
# ssh-keygen -t rsa -b 4096 -C "your-email@example.com" -f ~/.ssh/lba-network
```

### 2. Secure Your Private Key

```bash
# Set proper permissions (read-only for owner)
chmod 600 ~/.ssh/lba-network

# Optionally, encrypt the key with a passphrase (done during generation)
```

### 3. Store Public Key Safely

- Keep `~/.ssh/lba-network.pub` (public key) in your password manager
- Add it to each device's `~/.ssh/authorized_keys`
- Save backup copies in secure storage

---

## SSH Config File

Create/update `~/.ssh/config` for easy access to all your devices:

```
# Zone3 Infrastructure

# Raspberry Pi 4
Host pi4
    HostName 192.168.1.100
    User pi
    IdentityFile ~/.ssh/lba-network
    Port 22
    StrictHostKeyChecking accept-new
    UserKnownHostsFile ~/.ssh/known_hosts

# Gaming Rig
Host gaming-rig
    HostName 192.168.1.101
    User localadmin
    IdentityFile ~/.ssh/lba-network
    Port 22

# HP T640 Kiosk
Host hp-kiosk
    HostName 192.168.1.102
    User kiosk
    IdentityFile ~/.ssh/lba-network
    Port 22

# ThinK Center
Host thinkcenter
    HostName 192.168.1.103
    User admin
    IdentityFile ~/.ssh/lba-network
    Port 22

# NAS Backup
Host nas-backup
    HostName 192.168.1.104
    User nas-admin
    IdentityFile ~/.ssh/lba-network
    Port 22

# Cloud Infrastructure

# Hetzner VPS
Host hetzner-vps
    HostName [YOUR_HETZNER_IP]
    User root
    IdentityFile ~/.ssh/lba-network
    Port 22

# Email Relay VPS
Host email-relay
    HostName [YOUR_EMAIL_VPS_IP]
    User deploy
    IdentityFile ~/.ssh/lba-network
    Port 22

# Tailscale Mesh Network
Host pi4-tailscale
    HostName [PI4_TAILSCALE_IP]
    User pi
    IdentityFile ~/.ssh/lba-network
    StrictHostKeyChecking accept-new
```

**Usage:**
```bash
ssh pi4           # Connect to Raspberry Pi
ssh gaming-rig    # Connect to Gaming Rig
ssh hetzner-vps   # Connect to Hetzner
# etc.
```

---

## Setting Up SSH on Each Device

### Raspberry Pi 4

```bash
ssh pi@192.168.1.100
# Add your public key
mkdir -p ~/.ssh
cat >> ~/.ssh/authorized_keys << 'EOF'
[PASTE YOUR PUBLIC KEY HERE]
EOF
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### Hetzner VPS

```bash
ssh root@[HETZNER_IP]
# Add your public key
mkdir -p ~/.ssh
cat >> ~/.ssh/authorized_keys << 'EOF'
[PASTE YOUR PUBLIC KEY HERE]
EOF
chmod 600 ~/.ssh/authorized_keys

# Harden SSH (optional but recommended)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
#      PubkeyAuthentication yes
#      PermitRootLogin prohibit-password
sudo systemctl restart sshd
```

### All Other Devices

Repeat the process above for each device, adjusting the user and host as needed.

---

## SSH Security Best Practices

### 1. Disable Password Authentication
On all servers, update `/etc/ssh/sshd_config`:
```
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password  # For remote servers
Protocol 2
```

Restart SSH:
```bash
sudo systemctl restart sshd
```

### 2. Change Default SSH Port (Optional)
For additional security, change SSH port on servers:
```
Port 2222  # Change from default 22
```

Update your SSH config:
```
Host hetzner-vps
    Port 2222
    # ... other settings
```

### 3. Use SSH Keys Only
Never allow password-based SSH access. Always use keys.

### 4. Monitor SSH Activity
```bash
# Check SSH logs
tail -f /var/log/auth.log        # Linux
tail -f /var/log/system.log      # macOS

# Monitor failed login attempts
grep "Failed password" /var/log/auth.log | wc -l
```

### 5. Firewall Rules
```bash
# UFW (Uncomplicated Firewall) - Linux
sudo ufw allow 22/tcp   # Standard SSH
sudo ufw allow 2222/tcp # Custom SSH port

# Restrict SSH to specific IPs (optional)
sudo ufw allow from 192.168.1.0/24 to any port 22
```

---

## Tailscale VPN Access

For secure remote access through your mesh network:

### Install Tailscale
```bash
# On each device
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

### Access via Tailscale
```bash
# SSH through Tailscale IP
ssh pi@[PI4_TAILSCALE_IP]

# Or add to SSH config (see above)
ssh pi4-tailscale
```

---

## SSH Key Management

### Rotate Keys Regularly
Every 90 days, generate new keys:
```bash
# Generate new key
ssh-keygen -t ed25519 -C "your-email@example.com" -f ~/.ssh/lba-network-2

# Update authorized_keys on all servers with new public key
# Remove old key from authorized_keys
```

### Emergency Key Revocation
If a key is compromised:
```bash
# Remove old key from all servers
sed -i '/old-key-fingerprint/d' ~/.ssh/authorized_keys
```

Get fingerprints:
```bash
ssh-keygen -lf ~/.ssh/lba-network.pub
```

---

## Troubleshooting

### Connection Refused
```bash
# Verify device is online and SSH port is open
ping pi4
nmap -p 22 192.168.1.100

# Check SSH service is running
ssh pi@192.168.1.100 "sudo systemctl status ssh"
```

### Permission Denied
```bash
# Verify key permissions
ls -la ~/.ssh/lba-network
# Should show: -rw------- (600)

# Check authorized_keys permissions on remote
ssh pi@pi4 "ls -la ~/.ssh/authorized_keys"
# Should show: -rw------- (600)
```

### Host Key Changed Warning
```bash
# Remove old host key
ssh-keygen -R pi4
# Or edit ~/.ssh/known_hosts and remove the line
```

### Key Not Being Used
```bash
# Debug SSH connection
ssh -vv pi4

# Specify key explicitly
ssh -i ~/.ssh/lba-network pi@192.168.1.100
```

---

## SSH Aliases and Commands

Create convenient shortcuts in `~/.bash_aliases`:

```bash
alias ssh-pi='ssh pi4'
alias ssh-gaming='ssh gaming-rig'
alias ssh-hetzner='ssh hetzner-vps'
alias ssh-mesh='ssh pi4-tailscale'

# Copy files from Pi to local
alias scp-pi='scp -r pi4:'

# Sync with backup
alias sync-nas='rsync -avz --delete pi4: nas-backup:'
```

Load in your shell:
```bash
# Add to ~/.bashrc or ~/.zshrc
source ~/.bash_aliases
```

---

## Automated SSH Setup Script

See `setup-ssh-keys.sh` for automated SSH key generation and distribution.

---

## References

- [OpenSSH Documentation](https://man.openbsd.org/ssh_config)
- [Ed25519 Key Generation](https://wiki.archlinux.org/title/SSH_keys)
- [Tailscale Documentation](https://tailscale.com/kb/)
- [UFW Firewall](https://help.ubuntu.com/community/UFW)
