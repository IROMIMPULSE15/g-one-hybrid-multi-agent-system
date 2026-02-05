/**
 * Meditron Medical LLM Integration
 * 
 * Meditron is a suite of open-source medical LLMs designed specifically for medical domain text.
 * Models: Meditron-7B, Meditron-70B
 * Source: https://github.com/epfLLM/meditron
 * Hosted on: Hugging Face
 * 
 * This module provides integration with Meditron models via:
 * 1. Local Ollama (recommended for production)
 * 2. Hugging Face Inference API (for testing/fallback)
 */

import axios from 'axios';

// ==================== TYPES ====================

export interface MeditronOptions {
    model?: 'meditron-7b' | 'meditron-70b' | string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    useLocal?: boolean; // Use local Ollama vs Hugging Face API
}

export interface MeditronResponse {
    text: string;
    model: string;
    provider: 'ollama' | 'huggingface';
    confidence: number;
    tokensUsed?: number;
    medicalContext?: {
        specialty?: string;
        complexity?: 'basic' | 'intermediate' | 'advanced';
        requiresFollowup?: boolean;
    };
}

// ==================== CONFIGURATION ====================

const MEDITRON_MODELS = {
    '7b': {
        ollama: 'meditron:7b',
        huggingface: 'epfl-llm/meditron-7b',
        description: 'Meditron 7B - Faster, good for general medical queries'
    },
    '70b': {
        ollama: 'meditron:70b',
        huggingface: 'epfl-llm/meditron-70b',
        description: 'Meditron 70B - More accurate, better for complex medical reasoning'
    }
};

const DEFAULT_MEDICAL_SYSTEM_PROMPT = `You are Meditron, a medical AI assistant trained on medical literature and clinical text. 
Provide accurate, evidence-based medical information while always emphasizing that:
1. This is for educational purposes only
2. Users should consult healthcare professionals for personalized medical advice
3. In emergencies, users should call emergency services immediately

Be clear, concise, and use appropriate medical terminology while remaining accessible to patients.`;

// ==================== OLLAMA INTEGRATION (LOCAL) ====================

/**
 * Use Meditron via local Ollama installation
 * This is the recommended approach for production use
 */
async function generateWithOllama(
    prompt: string,
    opts?: MeditronOptions
): Promise<MeditronResponse> {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const modelSize = opts?.model?.includes('70b') ? '70b' : '7b';
    const modelName = MEDITRON_MODELS[modelSize].ollama;

    console.log(`🏥 Using Meditron ${modelSize.toUpperCase()} via Ollama...`);

    try {
        const response = await axios.post(`${ollamaUrl}/api/generate`, {
            model: modelName,
            prompt: opts?.systemPrompt
                ? `System: ${opts.systemPrompt}\n\nUser: ${prompt}`
                : `System: ${DEFAULT_MEDICAL_SYSTEM_PROMPT}\n\nUser: ${prompt}`,
            stream: false,
            options: {
                temperature: opts?.temperature ?? 0.3, // Lower temp for medical accuracy
                num_predict: opts?.maxTokens || 2048,
                top_p: 0.9,
                top_k: 40,
            }
        });

        if (!response.data || !response.data.response) {
            throw new Error('Ollama returned empty response');
        }

        const text = response.data.response.trim();

        console.log(`✅ Meditron ${modelSize.toUpperCase()} response generated via Ollama`);

        return {
            text,
            model: modelName,
            provider: 'ollama',
            confidence: calculateMedicalConfidence(text),
            tokensUsed: response.data.eval_count,
            medicalContext: analyzeMedicalContext(text)
        };

    } catch (error: any) {
        if (error.response?.status === 404) {
            throw new Error(
                `Meditron model not found in Ollama. Please run:\n` +
                `  ollama pull ${modelName}\n\n` +
                `Or install from: https://ollama.com/library/meditron`
            );
        }

        if (error.code === 'ECONNREFUSED' || error.message?.includes('connect')) {
            throw new Error(
                `Cannot connect to Ollama. Please ensure:\n` +
                `1. Ollama is installed: https://ollama.com\n` +
                `2. Ollama is running: Start the Ollama app or run 'ollama serve'`
            );
        }

        throw new Error(`Ollama error: ${error.message}`);
    }
}

// ==================== HUGGING FACE INTEGRATION ====================

/**
 * Use Meditron via Hugging Face Inference API
 * Good for testing or when local Ollama is not available
 */
async function generateWithHuggingFace(
    prompt: string,
    opts?: MeditronOptions
): Promise<MeditronResponse> {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        throw new Error(
            'HUGGINGFACE_API_KEY not set. Get your free API key from:\n' +
            'https://huggingface.co/settings/tokens'
        );
    }

    const modelSize = opts?.model?.includes('70b') ? '70b' : '7b';
    const modelName = MEDITRON_MODELS[modelSize].huggingface;

    console.log(`🏥 Using Meditron ${modelSize.toUpperCase()} via Hugging Face...`);

    const apiUrl = `https://api-inference.huggingface.co/models/${modelName}`;

    // Format prompt with medical context
    const formattedPrompt = opts?.systemPrompt
        ? `<s>[INST] <<SYS>>\n${opts.systemPrompt}\n<</SYS>>\n\n${prompt} [/INST]`
        : `<s>[INST] <<SYS>>\n${DEFAULT_MEDICAL_SYSTEM_PROMPT}\n<</SYS>>\n\n${prompt} [/INST]`;

    try {
        const response = await axios.post(
            apiUrl,
            {
                inputs: formattedPrompt,
                parameters: {
                    max_new_tokens: opts?.maxTokens || 2048,
                    temperature: opts?.temperature ?? 0.3,
                    top_p: 0.9,
                    top_k: 40,
                    return_full_text: false,
                    do_sample: true,
                    repetition_penalty: 1.1
                },
                options: {
                    wait_for_model: true,
                    use_cache: false
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000 // 60 second timeout for medical queries
            }
        );

        let text = '';
        if (Array.isArray(response.data) && response.data.length > 0) {
            text = response.data[0].generated_text?.trim() || '';
        } else if (response.data.generated_text) {
            text = response.data.generated_text.trim();
        }

        if (!text) {
            throw new Error('Hugging Face returned empty response');
        }

        console.log(`✅ Meditron ${modelSize.toUpperCase()} response generated via Hugging Face`);

        return {
            text,
            model: modelName,
            provider: 'huggingface',
            confidence: calculateMedicalConfidence(text),
            medicalContext: analyzeMedicalContext(text)
        };

    } catch (error: any) {
        if (error.response?.status === 503) {
            throw new Error(
                'Meditron model is loading on Hugging Face. This may take a few minutes.\n' +
                'Please try again in 1-2 minutes, or use local Ollama for instant responses.'
            );
        }

        if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error(
                'Hugging Face API authentication failed. Please check your API key:\n' +
                'https://huggingface.co/settings/tokens'
            );
        }

        throw new Error(`Hugging Face error: ${error.message}`);
    }
}

// ==================== MAIN GENERATION FUNCTION ====================

/**
 * Generate medical response using Meditron
 * Automatically tries local Ollama first, then falls back to Hugging Face
 */
export async function generateMedicalResponse(
    prompt: string,
    opts?: MeditronOptions
): Promise<MeditronResponse> {
    const useLocal = opts?.useLocal ?? true; // Default to local Ollama

    if (useLocal) {
        try {
            return await generateWithOllama(prompt, opts);
        } catch (ollamaError: any) {
            console.warn('⚠️ Ollama failed, trying Hugging Face fallback:', ollamaError.message);

            // Only fallback to HF if we have an API key
            if (process.env.HUGGINGFACE_API_KEY) {
                try {
                    return await generateWithHuggingFace(prompt, opts);
                } catch (hfError: any) {
                    throw new Error(
                        `Both Ollama and Hugging Face failed:\n` +
                        `Ollama: ${ollamaError.message}\n` +
                        `Hugging Face: ${hfError.message}`
                    );
                }
            }

            throw ollamaError;
        }
    } else {
        return await generateWithHuggingFace(prompt, opts);
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate confidence score based on medical response quality
 */
function calculateMedicalConfidence(text: string): number {
    let confidence = 0.7; // Base confidence for Meditron

    // Check for medical terminology
    const medicalTerms = [
        'diagnosis', 'treatment', 'symptom', 'condition', 'medication',
        'therapy', 'prognosis', 'etiology', 'pathophysiology', 'clinical'
    ];
    const termCount = medicalTerms.filter(term =>
        new RegExp(`\\b${term}\\b`, 'i').test(text)
    ).length;
    confidence += Math.min(0.15, termCount * 0.03);

    // Check for structured response
    if (/\d\.|•|\*\*|###/.test(text)) confidence += 0.05;

    // Check for disclaimer/caution
    if (/consult|healthcare|professional|doctor|emergency/i.test(text)) {
        confidence += 0.05;
    }

    // Check response length (comprehensive answers are better)
    if (text.length > 500) confidence += 0.05;
    if (text.length > 1000) confidence += 0.05;

    return Math.min(confidence, 0.95);
}

/**
 * Analyze medical context from response
 */
function analyzeMedicalContext(text: string): MeditronResponse['medicalContext'] {
    const context: MeditronResponse['medicalContext'] = {};

    // Detect medical specialty
    const specialties = {
        cardiology: /heart|cardiac|cardiovascular|arrhythmia/i,
        neurology: /brain|neuro|seizure|stroke|migraine/i,
        oncology: /cancer|tumor|malignant|chemotherapy/i,
        pediatrics: /child|infant|pediatric|newborn/i,
        psychiatry: /mental|depression|anxiety|psychiatric/i,
        dermatology: /skin|rash|dermatitis|eczema/i,
        orthopedics: /bone|joint|fracture|orthopedic/i,
        gastroenterology: /digestive|stomach|intestinal|gastro/i
    };

    for (const [specialty, pattern] of Object.entries(specialties)) {
        if (pattern.test(text)) {
            context.specialty = specialty;
            break;
        }
    }

    // Detect complexity
    const advancedTerms = /pathophysiology|etiology|differential diagnosis|pharmacokinetics/i;
    const basicTerms = /common|simple|general|basic/i;

    if (advancedTerms.test(text)) {
        context.complexity = 'advanced';
    } else if (basicTerms.test(text)) {
        context.complexity = 'basic';
    } else {
        context.complexity = 'intermediate';
    }

    // Check if follow-up is recommended
    context.requiresFollowup = /follow.?up|consult|see.*doctor|medical attention/i.test(text);

    return context;
}

// ==================== SETUP INSTRUCTIONS ====================

/**
 * Get setup instructions for Meditron
 */
export function getMeditronSetupInstructions(): string {
    return `
# Meditron Setup Instructions

## Option 1: Local Ollama (Recommended)

1. Install Ollama:
   - Visit: https://ollama.com
   - Download and install for your OS

2. Pull Meditron model:
   \`\`\`bash
   # For 7B model (faster, ~4GB)
   ollama pull meditron:7b
   
   # For 70B model (more accurate, ~40GB)
   ollama pull meditron:70b
   \`\`\`

3. Start Ollama:
   - The Ollama app should start automatically
   - Or run: \`ollama serve\`

4. Test it:
   \`\`\`bash
   ollama run meditron:7b "What is hypertension?"
   \`\`\`

## Option 2: Hugging Face API (Fallback)

1. Get API key:
   - Visit: https://huggingface.co/settings/tokens
   - Create a new token (read access is sufficient)

2. Add to .env:
   \`\`\`
   HUGGINGFACE_API_KEY=your_api_key_here
   \`\`\`

3. Note: First request may take 1-2 minutes as model loads

## Model Comparison

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| Meditron-7B | ~4GB | Fast | Good | General medical queries |
| Meditron-70B | ~40GB | Slower | Excellent | Complex medical reasoning |

## Recommended Configuration

For production:
- Use local Ollama with Meditron-7B for most queries
- Use Meditron-70B for complex diagnostic reasoning
- Keep Hugging Face as fallback

For development/testing:
- Use Hugging Face API (no local installation needed)
- Switch to local Ollama for production
`;
}

// ==================== EXPORTS ====================

export {
    MEDITRON_MODELS,
    DEFAULT_MEDICAL_SYSTEM_PROMPT
};
