# finish_setup.ps1
Write-Host "🧠 Finalizing Local AI Setup..."

# Ensure Env Var is set for this session too
$env:OLLAMA_ORIGINS = "*"

# Verify Installation
$ollamaPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (-not (Get-Command "ollama" -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️ Ollama command not found in PATH yet. Checking default path..." -ForegroundColor Yellow
    if (Test-Path $ollamaPath) {
        Write-Host "✅ Found Ollama at $ollamaPath" -ForegroundColor Green
        # Use full path for pull
        Write-Host "📥 Downloading Mistral Model (approx 4GB)..." -ForegroundColor Cyan
        & $ollamaPath serve # Ensure it is running
        Start-Sleep -Seconds 5
        & $ollamaPath pull mistral
    }
    else {
        Write-Host "❌ Ollama not found. Wait for the installer to finish and try again." -ForegroundColor Red
        exit 1
    }
}
else {
    # Pull Mistral via PATH
    Write-Host "📥 Downloading Mistral Model (approx 4GB)..." -ForegroundColor Cyan
    ollama serve # Ensure it is running
    Start-Sleep -Seconds 5
    ollama pull mistral
}

Write-Host "✅ Model downloaded. You can now use Local AI in the app!" -ForegroundColor Green
Write-Host "👉 Don't forget to select 'Local AI (Ollama)' in Settings." -ForegroundColor Yellow
