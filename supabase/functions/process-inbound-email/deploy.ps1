# ============================================
# PowerShell Deployment Script
# Deploy process-inbound-email Edge Function
# ============================================

Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Deploy: process-inbound-email Edge Function  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if supabase CLI is installed
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Supabase CLI not found!" -ForegroundColor Red
    Write-Host "Install: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Supabase CLI found" -ForegroundColor Green

# Check if logged in
$loginCheck = supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Not logged in to Supabase" -ForegroundColor Yellow
    Write-Host "Logging in..." -ForegroundColor Yellow
    supabase login
}

Write-Host "✅ Logged in to Supabase" -ForegroundColor Green

# Change to project directory
$projectRoot = "C:\Users\reid1\Documents\Local-Buisness-automizer"
Set-Location $projectRoot

# Link project if not linked
if (-not (Test-Path ".\.supabase\config.toml")) {
    Write-Host "⚠️  Project not linked" -ForegroundColor Yellow
    Write-Host "Linking project..." -ForegroundColor Yellow
    supabase link
}

Write-Host "✅ Project linked" -ForegroundColor Green

# Deploy database schema
Write-Host ""
Write-Host "📦 Deploying database schema..." -ForegroundColor Cyan
$schemaPath = ".\supabase\functions\process-inbound-email\schema.sql"

if (Test-Path $schemaPath) {
    # Read and execute schema
    $schema = Get-Content $schemaPath -Raw
    # Note: This requires psql or supabase db execute
    # For now, we'll just inform the user
    Write-Host "⚠️  Please execute schema.sql manually in Supabase Dashboard" -ForegroundColor Yellow
    Write-Host "   SQL Editor → New Query → Paste content of:" -ForegroundColor Yellow
    Write-Host "   $schemaPath" -ForegroundColor Yellow
} else {
    Write-Host "❌ Schema file not found: $schemaPath" -ForegroundColor Red
}

# Deploy function
Write-Host ""
Write-Host "🚀 Deploying Edge Function..." -ForegroundColor Cyan
supabase functions deploy process-inbound-email --no-verify-jwt

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Function deployed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Function deployment failed" -ForegroundColor Red
    exit 1
}

# Check environment variables
Write-Host ""
Write-Host "🔐 Checking environment variables..." -ForegroundColor Cyan

$secrets = supabase secrets list 2>&1 | Out-String
$missingVars = @()

if ($secrets -notmatch "RESEND_API_KEY") {
    $missingVars += "RESEND_API_KEY"
}

if ($secrets -notmatch "GEMINI_API_KEY") {
    $missingVars += "GEMINI_API_KEY"
}

if ($missingVars.Count -gt 0) {
    Write-Host "⚠️  Missing environment variables:" -ForegroundColor Yellow
    foreach ($var in $missingVars) {
        Write-Host "   - $var" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Set them with:" -ForegroundColor Yellow
    foreach ($var in $missingVars) {
        Write-Host "  supabase secrets set $var=your_value_here" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ All required environment variables set" -ForegroundColor Green
}

# Get function URL
Write-Host ""
Write-Host "🔗 Function URL:" -ForegroundColor Cyan
$status = supabase status 2>&1 | Out-String
if ($status -match "API URL.*https://([^.]+)\.supabase\.co") {
    $projectRef = $matches[1]
    $functionUrl = "https://$projectRef.supabase.co/functions/v1/process-inbound-email"
    Write-Host "   $functionUrl" -ForegroundColor Green
} else {
    Write-Host "   Could not determine function URL" -ForegroundColor Yellow
}

# Test function
Write-Host ""
$testChoice = Read-Host "🧪 Test function now? (y/n)"
if ($testChoice -eq "y" -or $testChoice -eq "Y") {
    Write-Host "Sending test request..." -ForegroundColor Cyan

    $testPayload = @{
        from = @{
            name = "Test User"
            email = "test@example.com"
        }
        to = "anfragen@handwerkflow.de"
        subject = "Test Anfrage"
        text = "Ich benötige ein Metalltor, 2m breit, feuerverzinkt. Budget ca. 1500 Euro."
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $functionUrl -Method Post -Body $testPayload -ContentType "application/json"
        Write-Host ""
        Write-Host "✅ Test successful!" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host ""
        Write-Host "❌ Test failed:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

# Next steps
Write-Host ""
Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║            Next Steps                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Configure Resend Inbound Route:" -ForegroundColor White
Write-Host "   https://resend.com/inbound" -ForegroundColor Yellow
Write-Host ""
if ($functionUrl) {
    Write-Host "   Webhook URL: $functionUrl" -ForegroundColor Green
}
Write-Host ""
Write-Host "2. Configure DNS Records for your domain:" -ForegroundColor White
Write-Host "   - MX: mx.resend.com (Priority: 10)" -ForegroundColor Yellow
Write-Host "   - TXT (SPF): v=spf1 include:_spf.resend.com ~all" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Send test email to: anfragen@handwerkflow.de" -ForegroundColor White
Write-Host ""
Write-Host "4. Monitor logs:" -ForegroundColor White
Write-Host "   supabase functions logs process-inbound-email --follow" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host ""

# Open README
$readmeChoice = Read-Host "📖 Open README.md for detailed setup? (y/n)"
if ($readmeChoice -eq "y" -or $readmeChoice -eq "Y") {
    $readmePath = Join-Path $projectRoot "supabase\functions\process-inbound-email\README.md"
    Start-Process notepad.exe $readmePath
}
