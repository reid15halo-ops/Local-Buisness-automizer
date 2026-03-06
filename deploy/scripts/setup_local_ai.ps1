# setup_local_ai.ps1
Write-Host "Starting Setup..."
$exists = Get-Command "ollama" -ErrorAction SilentlyContinue

if ($exists) {
    Write-Host "✅ Ollama already installed."
}

if (-not $exists) {
    Write-Host "📦 Installing Ollama..."
    winget install --id Ollama.Ollama -e --silent --accept-package-agreements --accept-source-agreements
}

# CORS
[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')
$env:OLLAMA_ORIGINS = "*"

# Start
Write-Host "🔌 Starting Ollama..."
Stop-Process -Name "ollama" -ErrorAction SilentlyContinue
Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
Start-Sleep -Seconds 5

# Pull
Write-Host "🧠 Pulling Mistral..."
# Try generic command first, if fails try full path
try {
    ollama pull mistral
}
catch {
    $user = $env:USERNAME
    & "C:\Users\$user\AppData\Local\Programs\Ollama\ollama.exe" pull mistral
}

Write-Host "🎉 Done."
