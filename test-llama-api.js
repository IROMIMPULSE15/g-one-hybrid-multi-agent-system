// Test script to verify Llama API via Hugging Face
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.HUGGINGFACE_API_KEY || process.env.LLAMA_API_KEY;
const MODEL = process.env.LLAMA_MODEL || 'meta-llama/Llama-3.2-3B-Instruct';

console.log('🧪 Testing Llama API via Hugging Face...\n');
console.log('Configuration:');
console.log(`  API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
console.log(`  Model: ${MODEL}`);
console.log(`  Endpoint: https://api-inference.huggingface.co/models/${MODEL}\n`);

if (!API_KEY) {
    console.error('❌ ERROR: No API key found!');
    console.error('Please set HUGGINGFACE_API_KEY in .env.local\n');
    process.exit(1);
}

async function testLlamaAPI() {
    const testPrompt = "Hello! Please respond with a short greeting.";

    console.log(`📤 Sending test prompt: "${testPrompt}"\n`);

    const startTime = Date.now();

    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: testPrompt,
                parameters: {
                    max_new_tokens: 100,
                    temperature: 0.7,
                    return_full_text: false,
                    do_sample: true
                },
                options: {
                    wait_for_model: true,
                    use_cache: false
                }
            })
        });

        const responseTime = Date.now() - startTime;

        console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
        console.log(`⏱️  Response Time: ${responseTime}ms\n`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ API Error Response:');
            console.error(JSON.stringify(errorData, null, 2));

            if (response.status === 401) {
                console.error('\n💡 Tip: Your API key might be invalid. Check:');
                console.error('   1. Go to https://huggingface.co/settings/tokens');
                console.error('   2. Verify your token is active');
                console.error('   3. Make sure it has "Read" permissions');
            } else if (response.status === 503) {
                console.error('\n💡 Tip: Model is loading (first request takes ~20-30 seconds)');
                console.error('   This is normal for Hugging Face free tier.');
                console.error('   Please wait and try again in a few seconds.');
            }

            return;
        }

        const data = await response.json();
        console.log('📥 Raw API Response:');
        console.log(JSON.stringify(data, null, 2));
        console.log('');

        // Parse response
        let text = '';
        if (Array.isArray(data) && data.length > 0) {
            text = data[0].generated_text?.trim() || data[0].text?.trim() || '';
        } else if (typeof data === 'object' && data.generated_text) {
            text = data.generated_text.trim();
        }

        if (text) {
            console.log('✅ SUCCESS! Llama API is working!');
            console.log(`📝 Generated Response: "${text}"\n`);
            console.log('🎉 Your voice assistant should work now!');
            console.log('   Just restart the dev server: npm run dev\n');
        } else {
            console.log('⚠️  Warning: API responded but no text was generated');
            console.log('   Response structure might be different than expected\n');
        }

    } catch (error) {
        console.error('❌ Test Failed!');
        console.error('Error:', error.message);
        console.error('\nFull error:', error);
    }
}

testLlamaAPI();
