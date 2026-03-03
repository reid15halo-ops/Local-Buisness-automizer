#!/bin/bash
# ============================================
# Raspberry Pi Auto-Installation Script
# Local-Business-Automizer v2.0
# ============================================
#
# Dieses Script auf dem Raspberry Pi ausführen:
# curl -sL https://raw.githubusercontent.com/reid15halo-ops/Local-Buisness-automizer/main/raspberry-pi-auto-install.sh | bash
#
# Oder manuell:
# wget https://raw.githubusercontent.com/reid15halo-ops/Local-Buisness-automizer/main/raspberry-pi-auto-install.sh
# chmod +x raspberry-pi-auto-install.sh
# sudo ./raspberry-pi-auto-install.sh
#
# ============================================

set -e

echo "🍓 Raspberry Pi - Metallbau Buchert Auto-Installation"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Bitte als root ausführen: sudo $0"
    exit 1
fi

# 1. System Update
echo "📦 Step 1/8: System Update..."
apt update -qq
apt upgrade -y -qq
echo "✅ System aktualisiert"

# 2. Apache Installation
echo "🌐 Step 2/8: Apache Webserver Installation..."
apt install -y apache2
systemctl enable apache2
systemctl start apache2
echo "✅ Apache installiert"

# 3. Apache Module
echo "🔧 Step 3/8: Apache Module aktivieren..."
a2enmod headers
a2enmod rewrite
a2enmod expires
a2enmod deflate
systemctl restart apache2
echo "✅ Module aktiviert"

# 4. Git Installation
echo "📚 Step 4/8: Git Installation..."
apt install -y git
echo "✅ Git installiert"

# 5. Projekt klonen
echo "📥 Step 5/8: Projekt herunterladen..."
cd /var/www/html
rm -f index.html  # Default HTML löschen

if [ -d ".git" ]; then
    git pull
    echo "✅ Projekt aktualisiert"
else
    git clone https://github.com/reid15halo-ops/Local-Buisness-automizer.git .
    echo "✅ Projekt geklont"
fi

# 6. Berechtigungen
echo "🔒 Step 6/8: Berechtigungen setzen..."
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html
echo "✅ Berechtigungen gesetzt"

# 7. Firewall
echo "🛡️ Step 7/8: Firewall konfigurieren..."
apt install -y ufw
ufw --force enable
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
echo "✅ Firewall aktiv"

# 8. Test
echo "🧪 Step 8/8: Installation testen..."
if curl -s http://localhost | grep -q "Metallbau Buchert"; then
    echo "✅ Installation erfolgreich!"
else
    echo "⚠️ Warnung: Test nicht vollständig erfolgreich"
fi

# Fertig
echo ""
echo "✅ Installation abgeschlossen!"
echo ""
echo "🌐 Zugriff:"
echo "  - Lokal: http://localhost"
echo "  - Netzwerk: http://$(hostname -I | awk '{print $1}')"
echo "  - Hostname: http://$(hostname).local"
echo ""
echo "📁 Verzeichnis: /var/www/html"
echo "📊 Logs: /var/log/apache2/"
echo ""
echo "🔧 Nächste Schritte:"
echo "  1. Browser öffnen: http://$(hostname -I | awk '{print $1}')"
echo "  2. Optional: HTTPS einrichten (siehe raspberry-pi-setup.md)"
echo "  3. Optional: DynDNS konfigurieren"
echo ""
echo "💾 Update (später):"
echo "  cd /var/www/html && sudo git pull"
echo ""
