# Raspberry Pi Deployment Guide
**Projekt:** Local-Business-Automizer v2.0
**Ziel:** Apache Webserver auf Raspberry Pi

## Voraussetzungen

- Raspberry Pi 4 (empfohlen)
- Raspberry Pi OS (Lite oder Desktop)
- SSH Zugriff aktiviert
- Netzwerkverbindung

## 1. Raspberry Pi Vorbereitung

### SSH Verbindung
```bash
# Von Windows PC aus
ssh pi@raspberrypi.local
# Default Passwort: raspberry (ÄNDERN!)
```

### System Update
```bash
sudo apt update
sudo apt upgrade -y
```

## 2. Apache Webserver Installation

```bash
# Apache installieren
sudo apt install apache2 -y

# Apache starten
sudo systemctl start apache2
sudo systemctl enable apache2

# Status prüfen
sudo systemctl status apache2
```

### Apache Module aktivieren
```bash
# Headers für Security Headers
sudo a2enmod headers

# Rewrite für Clean URLs
sudo a2enmod rewrite

# Expires für Caching
sudo a2enmod expires

# Deflate für GZIP
sudo a2enmod deflate

# Apache neustarten
sudo systemctl restart apache2
```

## 3. Projekt Deployment

### Option A: Mit Git (Empfohlen)
```bash
# Git installieren
sudo apt install git -y

# Repository klonen
cd /var/www/html
sudo rm index.html  # Default HTML löschen
sudo git clone https://github.com/reid15halo-ops/Local-Buisness-automizer.git .

# Berechtigungen setzen
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
```

### Option B: SCP Upload (von Windows)
```bash
# Von Windows PowerShell/Git Bash
cd C:\Users\reid1\Documents\Local-Buisness-automizer

# Deployment Paket erstellen
bash deploy.sh

# Upload zum Pi
scp -r dist/* pi@raspberrypi.local:/tmp/mhs

# Auf Pi installieren (SSH verbinden)
ssh pi@raspberrypi.local
sudo mv /tmp/mhs/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html
```

### Option C: USB Stick
```bash
# 1. Kopiere dist/* auf USB Stick (Windows)
# 2. USB an Pi anschließen
# 3. Auf Pi:

# USB mounten
sudo mkdir /mnt/usb
sudo mount /dev/sda1 /mnt/usb

# Dateien kopieren
sudo cp -r /mnt/usb/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html

# USB unmounten
sudo umount /mnt/usb
```

## 4. Apache Konfiguration

### Virtual Host (optional)
```bash
sudo nano /etc/apache2/sites-available/mhs.conf
```

```apache
<VirtualHost *:80>
    ServerName raspberrypi.local
    ServerAlias mhs.local
    DocumentRoot /var/www/html

    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/mhs-error.log
    CustomLog ${APACHE_LOG_DIR}/mhs-access.log combined
</VirtualHost>
```

```bash
# Site aktivieren
sudo a2ensite mhs.conf
sudo systemctl reload apache2
```

### .htaccess Check
```bash
# Prüfen ob .htaccess vorhanden
ls -la /var/www/html/.htaccess

# Inhalt prüfen
cat /var/www/html/.htaccess
```

## 5. Firewall Konfiguration

```bash
# UFW installieren (falls nicht vorhanden)
sudo apt install ufw -y

# HTTP erlauben
sudo ufw allow 80/tcp

# HTTPS erlauben (für später)
sudo ufw allow 443/tcp

# SSH erlauben (wichtig!)
sudo ufw allow 22/tcp

# Firewall aktivieren
sudo ufw enable

# Status prüfen
sudo ufw status
```

## 6. Testing

### Lokal auf Pi
```bash
curl http://localhost
# Sollte HTML zurückgeben
```

### Von Windows PC
```
http://raspberrypi.local
# Im Browser öffnen
```

### Von Handy (im gleichen Netzwerk)
```bash
# IP-Adresse des Pi herausfinden
hostname -I

# Im Browser: http://192.168.x.x
```

## 7. HTTPS Setup (Optional aber empfohlen)

### Let's Encrypt mit Certbot
```bash
# Certbot installieren
sudo apt install certbot python3-certbot-apache -y

# Zertifikat erstellen
sudo certbot --apache -d your-domain.com

# Auto-Renewal testen
sudo certbot renew --dry-run
```

### Oder Self-Signed (für lokales Netzwerk)
```bash
# Self-Signed Zertifikat
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/mhs.key \
    -out /etc/ssl/certs/mhs.crt

# Apache SSL aktivieren
sudo a2enmod ssl
sudo systemctl restart apache2
```

## 8. Performance Optimierung

### PHP (falls benötigt)
```bash
# PHP installieren
sudo apt install php libapache2-mod-php -y
```

### Caching
```bash
# APCu für PHP Caching
sudo apt install php-apcu -y

# Redis für Session Storage
sudo apt install redis-server -y
```

### Monitoring
```bash
# Apache Status Modul
sudo a2enmod status

# Server Status aufrufen
curl http://localhost/server-status
```

## 9. Backup & Maintenance

### Automatisches Backup
```bash
# Backup Script erstellen
sudo nano /usr/local/bin/mhs-backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/pi/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/mhs-$DATE.tar.gz /var/www/html
find $BACKUP_DIR -mtime +7 -delete  # Alte Backups löschen
```

```bash
# Ausführbar machen
sudo chmod +x /usr/local/bin/mhs-backup.sh

# Cronjob einrichten (täglich 2 Uhr)
crontab -e
# Zeile hinzufügen:
0 2 * * * /usr/local/bin/mhs-backup.sh
```

### Log Rotation
```bash
# Logs prüfen
sudo tail -f /var/log/apache2/access.log
sudo tail -f /var/log/apache2/error.log
```

## 10. Troubleshooting

### Apache startet nicht
```bash
# Fehlerlog prüfen
sudo tail -f /var/log/apache2/error.log

# Konfiguration testen
sudo apache2ctl configtest

# Port-Konflikte prüfen
sudo netstat -tlnp | grep :80
```

### 403 Forbidden
```bash
# Berechtigungen prüfen
ls -la /var/www/html

# Korrigieren
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
```

### .htaccess funktioniert nicht
```bash
# AllowOverride prüfen
sudo nano /etc/apache2/apache2.conf

# <Directory /var/www/> sollte haben:
# AllowOverride All

# Apache neustarten
sudo systemctl restart apache2
```

### Langsame Performance
```bash
# RAM prüfen
free -h

# CPU prüfen
top

# Apache Worker erhöhen
sudo nano /etc/apache2/mods-available/mpm_prefork.conf
sudo systemctl restart apache2
```

## 11. Network Access Setup

### Statische IP vergeben
```bash
sudo nano /etc/dhcpcd.conf
```

```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

```bash
sudo systemctl restart dhcpcd
```

### Port Forwarding (für externen Zugriff)
1. Router Admin öffnen (z.B. 192.168.1.1)
2. Port Forwarding einrichten
3. Extern Port 80 → Pi IP:80
4. Extern Port 443 → Pi IP:443

### DynDNS (für Heimnetzwerk)
```bash
# No-IP Client installieren
cd /tmp
wget http://www.noip.com/client/linux/noip-duc-linux.tar.gz
tar xzf noip-duc-linux.tar.gz
cd noip-2.1.9-1
sudo make
sudo make install

# Konfigurieren
sudo /usr/local/bin/noip2 -C
```

## 12. Monitoring Dashboard

### Glances (System Monitor)
```bash
sudo apt install glances -y
glances
```

### Netdata (Web Dashboard)
```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
# Dashboard: http://raspberrypi.local:19999
```

## Zusammenfassung

**Installation komplett:**
1. ✅ Apache Webserver
2. ✅ Security Headers (.htaccess)
3. ✅ Firewall (UFW)
4. ✅ Backup System
5. ✅ Monitoring

**Zugriff:**
- Lokal: http://raspberrypi.local
- IP: http://192.168.x.x
- Extern: http://your-domain.com (nach DynDNS)

**Nächste Schritte:**
- HTTPS einrichten (Let's Encrypt)
- Performance optimieren
- Monitoring aufsetzen

**Support:**
- Apache Docs: https://httpd.apache.org/docs/
- Raspberry Pi: https://www.raspberrypi.org/documentation/
