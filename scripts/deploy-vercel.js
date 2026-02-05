#!/usr/bin/env node

/**
 * Vercel Deployment Script
 * Automates the deployment process to Vercel with proper configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Vercel Deployment Process...\n');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, description) {
    log(`\n📦 ${description}...`, 'cyan');
    try {
        execSync(command, { stdio: 'inherit' });
        log(`✅ ${description} completed`, 'green');
        return true;
    } catch (error) {
        log(`❌ ${description} failed`, 'red');
        return false;
    }
}

// Step 1: Check if Vercel CLI is installed
log('\n🔍 Checking Vercel CLI installation...', 'bright');
try {
    execSync('vercel --version', { stdio: 'pipe' });
    log('✅ Vercel CLI is installed', 'green');
} catch (error) {
    log('❌ Vercel CLI not found. Installing...', 'yellow');
    exec('npm install -g vercel', 'Installing Vercel CLI');
}

// Step 2: Verify environment variables
log('\n🔍 Checking environment configuration...', 'bright');
const requiredEnvVars = [
    'MONGODB_URI',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
];

const missingVars = [];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        missingVars.push(varName);
    }
});

if (missingVars.length > 0) {
    log('\n⚠️  Warning: The following environment variables are not set:', 'yellow');
    missingVars.forEach(v => log(`   - ${v}`, 'yellow'));
    log('\n💡 Make sure to set these in Vercel project settings!', 'yellow');
}

// Step 3: Check for Ollama configuration
log('\n🔍 Checking Ollama configuration...', 'bright');
if (!process.env.OLLAMA_URL) {
    log('⚠️  OLLAMA_URL not set. Medical queries will use fallback providers.', 'yellow');
    log('💡 To use Ollama for medical queries with Llama3:', 'cyan');
    log('   1. Host Ollama on a separate server (Railway, Render, VPS)', 'cyan');
    log('   2. Set OLLAMA_URL in Vercel environment variables', 'cyan');
    log('   3. Ensure the model "llama3.2:3b" is pulled on that server', 'cyan');
}

// Step 4: Run build test
log('\n🏗️  Running production build test...', 'bright');
if (!exec('npm run build', 'Production build')) {
    log('\n❌ Build failed. Please fix errors before deploying.', 'red');
    process.exit(1);
}

// Step 5: Deploy to Vercel
log('\n🚀 Deploying to Vercel...', 'bright');
const deploymentType = process.argv.includes('--prod') ? 'production' : 'preview';
const deployCommand = deploymentType === 'production'
    ? 'vercel --prod'
    : 'vercel';

log(`\n📋 Deployment type: ${deploymentType}`, 'cyan');

if (exec(deployCommand, `Vercel ${deploymentType} deployment`)) {
    log('\n✅ Deployment successful!', 'green');
    log('\n📝 Next steps:', 'bright');
    log('   1. Configure environment variables in Vercel dashboard', 'cyan');
    log('   2. Set up Ollama server for medical queries (optional)', 'cyan');
    log('   3. Configure custom domain (optional)', 'cyan');
    log('   4. Enable automatic deployments from GitHub', 'cyan');
} else {
    log('\n❌ Deployment failed. Check the errors above.', 'red');
    process.exit(1);
}

log('\n🎉 Deployment process completed!', 'green');
