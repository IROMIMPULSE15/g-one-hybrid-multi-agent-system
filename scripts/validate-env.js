#!/usr/bin/env node

/**
 * Pre-Deployment Validation Script
 * Checks your environment configuration for common issues before deploying to Vercel
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 G-One AI - Pre-Deployment Validation\n');
console.log('='.repeat(60));

// Load .env file
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key) {
            envVars[key.trim()] = valueParts.join('=').trim();
        }
    }
});

let criticalIssues = 0;
let warnings = 0;
let passed = 0;

function checkRequired(key, description) {
    if (!envVars[key] || envVars[key] === '') {
        console.log(`❌ CRITICAL: ${key} is missing`);
        console.log(`   ${description}\n`);
        criticalIssues++;
        return false;
    }
    return true;
}

function checkPlaceholder(key, placeholders, description) {
    if (!envVars[key]) return;

    const value = envVars[key].toLowerCase();
    const isPlaceholder = placeholders.some(p => value.includes(p.toLowerCase()));

    if (isPlaceholder) {
        console.log(`⚠️  WARNING: ${key} appears to be a placeholder`);
        console.log(`   Current: ${envVars[key]}`);
        console.log(`   ${description}\n`);
        warnings++;
        return false;
    }
    return true;
}

function checkUrl(key, shouldBeLocalhost = true) {
    if (!envVars[key]) return;

    const value = envVars[key];
    const isLocalhost = value.includes('localhost') || value.includes('127.0.0.1');

    if (shouldBeLocalhost && !isLocalhost) {
        console.log(`⚠️  WARNING: ${key} doesn't point to localhost (for local dev)`);
        console.log(`   Current: ${value}\n`);
        warnings++;
    } else if (!shouldBeLocalhost && isLocalhost) {
        console.log(`❌ CRITICAL: ${key} points to localhost (won't work in production)`);
        console.log(`   Current: ${value}`);
        console.log(`   Should be: https://your-vercel-domain.vercel.app\n`);
        criticalIssues++;
    }
}

console.log('\n📋 Checking Critical Requirements...\n');

// Database
if (checkRequired('MONGODB_URI', 'MongoDB connection string is required')) {
    if (envVars.MONGODB_URI.includes('mongodb+srv://')) {
        console.log(`✅ MONGODB_URI is configured (MongoDB Atlas)\n`);
        passed++;
    } else if (envVars.MONGODB_URI.includes('localhost')) {
        console.log(`⚠️  WARNING: MONGODB_URI points to localhost`);
        console.log(`   This won't work on Vercel. Use MongoDB Atlas.\n`);
        warnings++;
    }
}

// Authentication
if (checkRequired('NEXTAUTH_SECRET', 'Required for NextAuth session encryption')) {
    if (!checkPlaceholder('NEXTAUTH_SECRET', ['your-secret', 'change-this', 'here'],
        'Generate with: openssl rand -base64 32')) {
        criticalIssues++;
    } else {
        console.log(`✅ NEXTAUTH_SECRET is set\n`);
        passed++;
    }
}

if (checkRequired('NEXTAUTH_URL', 'Required for NextAuth callbacks')) {
    console.log(`✅ NEXTAUTH_URL is set: ${envVars.NEXTAUTH_URL}\n`);
    passed++;
}

// Google OAuth
if (checkRequired('GOOGLE_CLIENT_ID', 'Required for Google sign-in')) {
    console.log(`✅ GOOGLE_CLIENT_ID is configured\n`);
    passed++;
}

if (checkRequired('GOOGLE_CLIENT_SECRET', 'Required for Google sign-in')) {
    console.log(`✅ GOOGLE_CLIENT_SECRET is configured\n`);
    passed++;
}

console.log('\n🤖 Checking LLM Provider Configuration...\n');

const llmProvider = envVars.LLM_PROVIDER?.toLowerCase() || 'ollama';
console.log(`   Primary LLM Provider: ${llmProvider}\n`);

let hasWorkingLLM = false;

// Check Ollama
if (llmProvider === 'ollama' || !envVars.LLM_PROVIDER) {
    if (envVars.OLLAMA_URL) {
        if (envVars.OLLAMA_URL.includes('localhost')) {
            console.log(`❌ CRITICAL: OLLAMA_URL points to localhost`);
            console.log(`   Current: ${envVars.OLLAMA_URL}`);
            console.log(`   Ollama won't work on Vercel. Either:`);
            console.log(`   1. Host Ollama separately (Railway, Render, VPS)`);
            console.log(`   2. Switch to Gemini or OpenAI\n`);
            criticalIssues++;
        } else {
            console.log(`✅ OLLAMA_URL is configured for production: ${envVars.OLLAMA_URL}\n`);
            hasWorkingLLM = true;
            passed++;
        }
    }
}

// Check OpenAI
if (envVars.OPENAI_API_KEY) {
    if (!checkPlaceholder('OPENAI_API_KEY', ['your-', 'sk-your', 'here'],
        'Get from: https://platform.openai.com')) {
        // It's a placeholder
    } else {
        console.log(`✅ OPENAI_API_KEY is configured (fallback available)\n`);
        hasWorkingLLM = true;
        passed++;
    }
}

// Check Gemini
if (envVars.GEMINI_API_KEY) {
    if (!checkPlaceholder('GEMINI_API_KEY', ['your-', 'here'],
        'Get from: https://makersuite.google.com')) {
        // It's a placeholder
    } else {
        console.log(`✅ GEMINI_API_KEY is configured (fallback available)\n`);
        hasWorkingLLM = true;
        passed++;
    }
}

if (!hasWorkingLLM) {
    console.log(`❌ CRITICAL: No working LLM provider configured!`);
    console.log(`   You need at least ONE of:`);
    console.log(`   - Ollama (hosted separately, not localhost)`);
    console.log(`   - OpenAI API key`);
    console.log(`   - Gemini API key\n`);
    criticalIssues++;
}

console.log('\n💳 Checking Payment Configuration...\n');

if (envVars.STRIPE_PUBLIC_KEY && envVars.STRIPE_SECRET_KEY) {
    if (envVars.STRIPE_PUBLIC_KEY.includes('pk_test_') ||
        envVars.STRIPE_SECRET_KEY.includes('sk_test_')) {
        console.log(`⚠️  WARNING: Using Stripe TEST keys`);
        console.log(`   Real payments won't work. Use live keys for production.\n`);
        warnings++;
    }

    if (checkPlaceholder('STRIPE_PUBLIC_KEY', ['your-', 'here'],
        'Get from: https://dashboard.stripe.com')) {
        // Placeholder
    } else {
        console.log(`✅ Stripe keys are configured\n`);
        passed++;
    }
}

console.log('\n🗄️  Checking Vector Database...\n');

if (envVars.PINECONE_API_KEY) {
    if (!checkPlaceholder('PINECONE_API_KEY', ['your-', 'here'],
        'Get from: https://www.pinecone.io')) {
        // Placeholder
    } else {
        console.log(`✅ PINECONE_API_KEY is configured\n`);
        passed++;
    }
}

console.log('\n' + '='.repeat(60));
console.log('\n📊 SUMMARY\n');
console.log(`✅ Passed: ${passed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`❌ Critical Issues: ${criticalIssues}\n`);

if (criticalIssues > 0) {
    console.log('🚫 DEPLOYMENT BLOCKED');
    console.log('   Fix critical issues before deploying to production.\n');
    console.log('📖 See DEPLOYMENT_CHECKLIST.md for detailed solutions.\n');
    process.exit(1);
} else if (warnings > 0) {
    console.log('⚠️  DEPLOYMENT POSSIBLE (with warnings)');
    console.log('   Review warnings to ensure production readiness.\n');
    console.log('📖 See DEPLOYMENT_CHECKLIST.md for recommendations.\n');
    process.exit(0);
} else {
    console.log('✅ ALL CHECKS PASSED!');
    console.log('   Your environment is ready for deployment.\n');
    console.log('🚀 Next steps:');
    console.log('   1. Set these env vars in Vercel Dashboard');
    console.log('   2. Update URLs to your Vercel domain');
    console.log('   3. Update Google OAuth redirect URIs');
    console.log('   4. Deploy with: vercel --prod\n');
    process.exit(0);
}
