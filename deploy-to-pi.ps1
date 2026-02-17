# ============================================
# Deploy to Raspberry Pi - PowerShell Script
# Local-Business-Automizer v2.0
# ============================================

Write-Host "🍓 Deploying to Raspberry Pi..." -ForegroundColor Green
Write-Host ""

# Configuration
$PI_HOST = "raspberrypi.local"
$PI_USER = "pi"
$DIST_DIR = ".\dist"
$REMOTE_DIR = "/tmp/freyai-deploy"
$WEB_DIR = "/var/www/html"

# Check if dist exists
if (-not (Test-Path $DIST_DIR)) {
    Write-Host "❌ dist/ directory not found!" -ForegroundColor Red
    Write-Host "   Run: bash deploy.sh first" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Build directory found" -ForegroundColor Green

# Test Pi connection
Write-Host "📡 Testing connection to $PI_HOST..." -ForegroundColor Cyan
$ping = Test-Connection -ComputerName $PI_HOST -Count 1 -Quiet
if (-not $ping) {
    Write-Host "❌ Pi not reachable!" -ForegroundColor Red
    Write-Host "   Check if Pi is powered on and connected" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Pi is reachable" -ForegroundColor Green

# Instructions for SSH setup
Write-Host ""
Write-Host "📋 DEPLOYMENT SCHRITTE:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. SSH auf Pi aktivieren (falls noch nicht geschehen):"
Write-Host "   - Pi einschalten"
Write-Host "   - sudo raspi-config"
Write-Host "   - Interface Options → SSH → Enable"
Write-Host ""
Write-Host "2. Deploy mit SCP (manuell):"
Write-Host "   scp -r .\dist\* ${PI_USER}@${PI_HOST}:${REMOTE_DIR}/"
Write-Host ""
Write-Host "3. Auf Pi installieren (SSH verbinden):"
Write-Host "   ssh ${PI_USER}@${PI_HOST}"
Write-Host "   sudo rm -rf ${WEB_DIR}/*"
Write-Host "   sudo mv ${REMOTE_DIR}/* ${WEB_DIR}/"
Write-Host "   sudo chown -R www-data:www-data ${WEB_DIR}"
Write-Host ""
Write-Host "ODER: Auto-Install Script nutzen:"
Write-Host "   ssh ${PI_USER}@${PI_HOST} 'bash -s' < raspberry-pi-auto-install.sh"
Write-Host ""
Write-Host "4. Zugriff:"
Write-Host "   http://${PI_HOST}"
Write-Host ""

# Optional: Try automatic deployment if SSH key is setup
Write-Host "🔑 Versuche automatisches Deployment..." -ForegroundColor Cyan
Write-Host "   (funktioniert nur wenn SSH-Key konfiguriert ist)" -ForegroundColor Gray
Write-Host ""

# This will only work if SSH key authentication is set up
try {
    # Test SSH without password
    $sshTest = ssh -o BatchMode=yes -o ConnectTimeout=5 ${PI_USER}@${PI_HOST} "echo 'SSH Key OK'" 2>&1

    if ($sshTest -match "SSH Key OK") {
        Write-Host "✅ SSH Key gefunden - Starte Auto-Deploy..." -ForegroundColor Green

        # Copy files
        Write-Host "📤 Uploading files..."
        scp -r "$DIST_DIR\*" "${PI_USER}@${PI_HOST}:${REMOTE_DIR}/"

        # Install on Pi
        Write-Host "🔧 Installing on Pi..."
        ssh ${PI_USER}@${PI_HOST} @"
sudo rm -rf ${WEB_DIR}/*
sudo cp -r ${REMOTE_DIR}/* ${WEB_DIR}/
sudo chown -R www-data:www-data ${WEB_DIR}
sudo chmod -R 755 ${WEB_DIR}
"@

        Write-Host ""
        Write-Host "✅ DEPLOYMENT ERFOLGREICH!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 App verfügbar unter:" -ForegroundColor Cyan
        Write-Host "   http://${PI_HOST}" -ForegroundColor White
        Write-Host ""

    } else {
        Write-Host "⚠️ SSH Key nicht konfiguriert" -ForegroundColor Yellow
        Write-Host "   Verwende manuelle Schritte oben" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️ Auto-Deploy nicht möglich" -ForegroundColor Yellow
    Write-Host "   Verwende manuelle Schritte oben" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📚 Vollständige Anleitung: raspberry-pi-setup.md" -ForegroundColor Cyan
Write-Host ""
