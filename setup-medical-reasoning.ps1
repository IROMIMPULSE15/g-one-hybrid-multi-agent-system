# Medical Reasoning Setup Script
# Run this to set up Llama 3 for medical reasoning

Write-Host "🏥 V64 Medical Reasoning Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is installed
Write-Host "Checking Ollama installation..." -ForegroundColor Yellow
$ollamaInstalled = Get-Command ollama -ErrorAction SilentlyContinue

if (-not $ollamaInstalled) {
    Write-Host "❌ Ollama is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Ollama from: https://ollama.ai" -ForegroundColor Yellow
    Write-Host "After installation, run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Ollama is installed" -ForegroundColor Green
Write-Host ""

# Check if Ollama is running
Write-Host "Checking if Ollama is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -ErrorAction Stop
    Write-Host "✅ Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ollama is not running" -ForegroundColor Yellow
    Write-Host "Starting Ollama..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}
Write-Host ""

# List available models
Write-Host "Checking installed models..." -ForegroundColor Yellow
$models = ollama list
Write-Host $models
Write-Host ""

# Ask user which model to install
Write-Host "Which Llama 3 model would you like to use for medical reasoning?" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. llama3.2:3b  (Recommended - Fast, 4GB RAM)" -ForegroundColor White
Write-Host "2. llama3      (Best Quality - 8GB RAM)" -ForegroundColor White
Write-Host "3. llama3.2:1b (Fastest - 2GB RAM)" -ForegroundColor White
Write-Host "4. llama3.1:8b (Advanced - 8GB RAM)" -ForegroundColor White
Write-Host "5. Skip (already installed)" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Enter your choice (1-5)"

$modelName = switch ($choice) {
    "1" { "llama3.2:3b" }
    "2" { "llama3" }
    "3" { "llama3.2:1b" }
    "4" { "llama3.1:8b" }
    "5" { $null }
    default { "llama3.2:3b" }
}

if ($modelName) {
    Write-Host ""
    Write-Host "Pulling $modelName..." -ForegroundColor Yellow
    Write-Host "This may take several minutes depending on your internet connection..." -ForegroundColor Gray
    Write-Host ""
    
    ollama pull $modelName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Model $modelName installed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Failed to install model" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Testing medical reasoning..." -ForegroundColor Yellow

# Test the model with a medical query
$testModel = if ($modelName) { $modelName } else { "llama3" }

Write-Host "Using model: $testModel" -ForegroundColor Gray
Write-Host ""

$testPrompt = @"
You are a medical knowledge assistant. Provide a brief, accurate answer.

Question: What is diabetes in simple terms?

Answer (2-3 sentences):
"@

Write-Host "Sending test query..." -ForegroundColor Yellow

$body = @{
    model = $testModel
    prompt = $testPrompt
    stream = $false
    options = @{
        temperature = 0.3
        num_predict = 200
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method POST -Body $body -ContentType "application/json"
    
    Write-Host ""
    Write-Host "✅ Test successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host $response.response -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Update .env file
Write-Host "Updating .env configuration..." -ForegroundColor Yellow

$envPath = ".env"
$envContent = if (Test-Path $envPath) { Get-Content $envPath -Raw } else { "" }

# Update or add OLLAMA_MODEL
if ($modelName) {
    if ($envContent -match "OLLAMA_MODEL=") {
        $envContent = $envContent -replace "OLLAMA_MODEL=.*", "OLLAMA_MODEL=$modelName"
    } else {
        $envContent += "`nOLLAMA_MODEL=$modelName"
    }
}

# Ensure OLLAMA_URL is set
if ($envContent -notmatch "OLLAMA_URL=") {
    $envContent += "`nOLLAMA_URL=http://localhost:11434"
}

# Set Ollama as primary provider
if ($envContent -match "LLM_PROVIDER=") {
    $envContent = $envContent -replace "LLM_PROVIDER=.*", "LLM_PROVIDER=ollama"
} else {
    $envContent += "`nLLM_PROVIDER=ollama"
}

Set-Content -Path $envPath -Value $envContent.Trim()

Write-Host "✅ .env file updated" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "================================" -ForegroundColor Cyan
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Model: $testModel" -ForegroundColor White
Write-Host "  URL: http://localhost:11434" -ForegroundColor White
Write-Host "  Provider: Ollama (Primary)" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Start your development server: npm run dev" -ForegroundColor White
Write-Host "  2. Try a medical query in the voice assistant" -ForegroundColor White
Write-Host "  3. Check .agent/medical_reasoning_guide.md for usage examples" -ForegroundColor White
Write-Host ""
Write-Host "Example Usage:" -ForegroundColor Yellow
Write-Host '  import { searchMedical } from "./medicalsearch";' -ForegroundColor Gray
Write-Host '  const response = await searchMedical("What is diabetes?");' -ForegroundColor Gray
Write-Host ""
Write-Host "For more information, see: .agent/medical_reasoning_guide.md" -ForegroundColor Cyan
Write-Host ""
