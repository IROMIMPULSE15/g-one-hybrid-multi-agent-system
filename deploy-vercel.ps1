# Quick Deploy to Vercel Script
# Run this script to deploy your app to Vercel

Write-Host "🚀 G-One AI Assistant - Vercel Deployment Script" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
Write-Host "Checking for Vercel CLI..." -ForegroundColor Yellow
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
    Write-Host "✅ Vercel CLI installed successfully!" -ForegroundColor Green
} else {
    Write-Host "✅ Vercel CLI found!" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Pre-deployment checklist:" -ForegroundColor Cyan
Write-Host "  1. Have you set up a Vercel account? (https://vercel.com/signup)"
Write-Host "  2. Do you have all environment variables ready?"
Write-Host "  3. Has the app been tested locally?"
Write-Host ""

$continue = Read-Host "Continue with deployment? (y/n)"

if ($continue -ne "y") {
    Write-Host "❌ Deployment cancelled." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🔨 Building the application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Please fix errors and try again." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Yellow
Write-Host "   (You may need to login to Vercel if this is your first time)" -ForegroundColor Gray
Write-Host ""

vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host "🎉 Your app is now live on Vercel!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Set up environment variables in Vercel dashboard"
    Write-Host "  2. Configure custom domain (optional)"
    Write-Host "  3. Set up MongoDB Atlas database"
    Write-Host "  4. Deploy medical-agent backend separately"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above and try again." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "For more help, see: .agent/deployment_guide.md" -ForegroundColor Gray
