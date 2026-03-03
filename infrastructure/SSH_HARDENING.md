# SSH Hardening Guide for Local Business Automizer Network

This document provides security hardening steps for SSH across your network infrastructure.

## Quick Summary

| Task | Priority | Impact |
|------|----------|--------|
| Disable password authentication | CRITICAL | Prevents brute force attacks |
| Use key-based authentication | CRITICAL | Industry standard security |
| Change default SSH port | MEDIUM | Reduces automated scan targets |
| Configure firewall | CRITICAL | Restricts SSH access to trusted IPs |
| Monitor SSH logs | MEDIUM | Early detection of attacks |
| Keep SSH updated | HIGH | Patches security vulnerabilities |

---

## SSH Server Hardening (on all remote devices)

### 1. Backup Original Configuration

Always backup before modifying SSH config:

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
```

### 2. Edit SSH Configuration

```bash
sudo nano /etc/ssh/sshd_config
```

Apply these security settings:

```
# SSH Server Hardening Configuration

# Network settings
Port 22                              # Change to 2222+ for extra security
ListenAddress 0.0.0.0
ListenAddress ::

# Authentication
PubkeyAuthentication yes             # Enable key-based auth
PasswordAuthentication no            # Disable password auth
PermitEmptyPasswords no              # Never allow empty passwords
PubkeyAcceptedAlgorithms ssh-ed25519 # Use strong key types
HostKey /etc/ssh/ssh_host_ed25519_key

# Access control
PermitRootLogin prohibit-password    # Allow root via keys only
PermitUserEnvironment no
AllowUsers pi localadmin             # Whitelist users (optional)
DenyUsers root                       # Explicitly deny root password
DenyUsers nobody
MaxAuthTries 3                       # Limit failed attempts
MaxSessions 5                        # Limit concurrent sessions

# Timeouts and keepalive
LoginGraceTime 20s                   # Grace period for login
ClientAliveInterval 300              # Keep-alive interval (5 min)
ClientAliveCountMax 2                # Disconnect if no response

# Logging
SyslogFacility AUTH
LogLevel VERBOSE                     # Detailed logging
LogFile /var/log/auth.log

# Cryptography
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com

# Security options
IgnoreRhosts yes
RhostsRSAAuthentication no
RSAAuthentication no
HostbasedAuthentication no
PermitUserRC no
Compression no                       # Disable compression to prevent attacks
X11Forwarding no                     # Disable X11 unless needed
AllowAgentForwarding no              # Disable agent forwarding unless needed
AllowTcpForwarding no                # Restrict port forwarding
GatewayPorts no
PermitTunnel no
Protocol 2                           # Use SSH v2 only

# Banner (optional but recommended)
Banner /etc/ssh/banner.txt

# Match blocks for specific rules (optional)
Match User pi
    AllowTcpForwarding yes
```

### 3. Verify Configuration

```bash
# Check syntax before restarting
sudo sshd -t

# If no errors, restart SSH
sudo systemctl restart sshd
```

### 4. Create SSH Banner (Optional)

```bash
sudo nano /etc/ssh/banner.txt
```

Add warning message:

```
╔═══════════════════════════════════════════════════════════════╗
║  Unauthorized access is prohibited and will be prosecuted     ║
║  by law. By accessing this system, you agree that your use    ║
║  may be monitored and recorded.                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Firewall Configuration

### UFW (Ubuntu/Raspberry Pi)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (standard port)
sudo ufw allow 22/tcp

# Or with custom port (example: 2222)
sudo ufw allow 2222/tcp

# Optional: Restrict to specific IP ranges
sudo ufw allow from 192.168.1.0/24 to any port 22/tcp
sudo ufw allow from <your-remote-ip> to any port 22/tcp

# Verify rules
sudo ufw status

# Show detailed rules
sudo ufw status numbered
```

### iptables (Advanced)

```bash
# Log SSH attempts to separate file
sudo iptables -I INPUT -p tcp --dport 22 -j LOG --log-prefix "SSH: "

# Limit SSH connections to 5 per minute
sudo iptables -I INPUT -p tcp --dport 22 -m limit --limit 5/min -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 22 -j DROP

# Save rules
sudo iptables-save > /etc/iptables/rules.v4
```

---

## Intrusion Detection & Prevention

### Fail2Ban (Rate Limiting)

Protects against brute force attacks:

```bash
# Install Fail2Ban
sudo apt-get install fail2ban

# Create local config
sudo nano /etc/fail2ban/jail.local
```

Configuration:

```ini
[DEFAULT]
findtime = 600          # Time window (10 minutes)
maxretry = 3            # Failed attempts before ban
bantime = 3600          # Ban duration (1 hour)
destemail = admin@example.com

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
findtime = 600
bantime = 3600
```

Enable:

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status sshd
```

---

## SSH Client Hardening

### Local SSH Config Hardening

Edit `~/.ssh/config`:

```
# Strong crypto for all hosts
Host *
    IdentitiesOnly yes
    AddKeysToAgent yes
    IdentityFile ~/.ssh/lba-network
    StrictHostKeyChecking accept-new
    VerifyHostKeyDNS yes
    UserKnownHostsFile ~/.ssh/known_hosts
    SendEnv LANG LC_*
    HashKnownHosts yes             # Hash IPs in known_hosts
    ControlMaster auto             # Reuse connections
    ControlPath ~/.ssh/control-master-%l-%h-%p-%r
    ControlPersist 600             # Keep connection alive 10 min
    ConnectionAttempts 3
    ConnectTimeout 10
```

---

## Monitoring & Logging

### View SSH Activity

```bash
# Real-time SSH logs
sudo tail -f /var/log/auth.log

# Count failed login attempts
grep "Failed password" /var/log/auth.log | wc -l

# Show recent logins
sudo lastlog

# Monitor active connections
sudo ss -tupn | grep :22

# Watch new connections (live)
sudo watch -n 1 'ss -tupn | grep :22'
```

### Log Analysis

```bash
# Failed attempts by IP
grep "Failed password" /var/log/auth.log | \
  awk '{print $(NF-3)}' | sort | uniq -c | sort -rn

# Successful logins
grep "Accepted publickey" /var/log/auth.log | \
  awk '{print $NF}' | sort | uniq -c

# Suspicious activity summary
sudo lastlog -t 7 # Last 7 days
```

### Remote Log Aggregation (Optional)

For production systems, send logs to a central server:

```bash
# In /etc/ssh/sshd_config:
# Uncomment and modify:
# SyslogFacility LOCAL0

# Configure syslog to forward to central server:
sudo nano /etc/rsyslog.d/30-ssh-forward.conf
```

---

## SSH Key Security

### Secure Key Generation

```bash
# Generate with strong parameters
ssh-keygen -t ed25519 -C "comment" -f ~/.ssh/id_ed25519 -N "passphrase"

# For legacy systems:
ssh-keygen -t rsa -b 4096 -C "comment" -f ~/.ssh/id_rsa -N "passphrase"

# Proper permissions
chmod 600 ~/.ssh/id_*
chmod 644 ~/.ssh/*.pub
chmod 700 ~/.ssh
```

### Key Rotation Schedule

Rotate keys every 90 days:

```bash
# Generate new key
ssh-keygen -t ed25519 -C "comment-$(date +%Y-%m)" -f ~/.ssh/id_ed25519_new

# Add new key to all servers
for host in pi4 gaming-rig hetzner-vps; do
    ssh-copy-id -i ~/.ssh/id_ed25519_new $host
done

# Test new key works on all servers
ssh -i ~/.ssh/id_ed25519_new pi4 "echo OK"

# Disable old key (keep backup for 30 days)
mv ~/.ssh/id_ed25519 ~/.ssh/id_ed25519.backup-$(date +%Y-%m-%d)

# After 30 days, remove old key from all servers
```

### Key Compromise Response

If a key is compromised:

```bash
# On all remote servers, immediately remove the key:
sudo sed -i '/compromised-key-fingerprint/d' ~/.ssh/authorized_keys

# Generate new emergency key
ssh-keygen -t ed25519 -C "emergency-$(date +%s)" -f ~/.ssh/id_ed25519_emergency

# Distribute new key to all servers
# (may need temporary access via console/serial)

# Audit all active sessions and logs
sudo netstat -tupn | grep :22
sudo tail -1000 /var/log/auth.log | grep "session opened"
```

---

## Audit Checklist

Before going to production, verify:

- [ ] Password authentication disabled on all servers
- [ ] Key-based authentication enabled
- [ ] Only authorized keys in `~/.ssh/authorized_keys`
- [ ] SSH config permissions: `600` on files, `700` on directories
- [ ] Firewall rules enabled and tested
- [ ] Fail2Ban running and configured
- [ ] SSH logs being monitored
- [ ] Non-standard port configured (if using one)
- [ ] Banner displayed on login
- [ ] Known hosts hashed in `~/.ssh/known_hosts`
- [ ] SSH version updated to latest
- [ ] Backup of original sshd_config created
- [ ] SSH keys have passphrases (optional but recommended)

---

## Emergency Access Methods

For when SSH is locked out:

### Serial Console
```bash
# If device has serial port, use:
minicom /dev/ttyUSB0 115200
```

### Physical Access
```bash
# Boot into recovery mode and mount filesystem
# Manually edit /etc/ssh/sshd_config
# Or add new SSH key to /root/.ssh/authorized_keys
```

### Console Integration
For cloud providers, use console/VNC access to recover access.

---

## Testing & Validation

### Test Hardened SSH Configuration

```bash
# Verify no weak algorithms
ssh -Q key-exchange
ssh -Q cipher
ssh -Q mac

# Test connection with verbose output
ssh -vvv user@host

# Benchmark connection speed (should be <100ms)
time ssh user@host "echo OK"

# Check SSL/TLS version
ssh -Q protocol-version
```

### Security Scanning

```bash
# Use ssh-audit to check server security
sudo apt-get install ssh-audit
ssh-audit <hostname>

# Test public key encryption with nmap
nmap --script ssh2-enum-algos <hostname>

# Manual telnet test (port listening)
telnet <hostname> 22
```

---

## References

- [OpenSSH Hardening](https://man.openbsd.org/sshd_config)
- [Mozilla SSH Configuration](https://infosec.mozilla.org/guidelines/openssh)
- [Fail2Ban Documentation](https://www.fail2ban.org/)
- [SSH Best Practices (NIST)](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5)
- [CIS Benchmarks - SSH](https://www.cisecurity.org/cis-benchmarks/)

---

## Support

For issues or questions:

1. Check logs: `sudo tail -f /var/log/auth.log`
2. Test syntax: `sudo sshd -t`
3. Verify permissions: `ls -la ~/.ssh/`
4. Check connectivity: `ssh -vvv user@host`

