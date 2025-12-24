/**
 * UPDATED: Hugging Face Serverless Inference API
 * The old api-inference.huggingface.co endpoint is deprecated
 * This uses the Hugging Face Hub API with text-generation-inference
 */

async function tryLlama(prompt: string, opts?: { maxTokens?: number; temperature?: number; model?: string; }): Promise<{ text: string; provider: 'llama' }> {
    const hasLlama = !!process.env.LLAMA_API_KEY || !!process.env.HUGGINGFACE_API_KEY;
    if (!hasLlama) throw new Error('LLAMA_API_KEY or HUGGINGFACE_API_KEY not set');

    const apiKey = process.env.LLAMA_API_KEY || process.env.HUGGINGFACE_API_KEY;

    // Use smaller, faster models that work with free tier
    const modelName = opts?.model || process.env.LLAMA_MODEL || 'HuggingFaceH4/zephyr-7b-beta';

    // Try Hugging Face Hub API (works with free tier)
    const apiUrl = `https://huggingface.co/api/models/${modelName}`;

    try {
        // First, try the simple text generation endpoint
        const response = await fetch(`https://api-inference.huggingface.co/models/${modelName}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: opts?.maxTokens || 256,
                    temperature: opts?.temperature ?? 0.7,
                    return_full_text: false,
                    top_p: 0.95,
                    do_sample: true
                },
                options: {
                    wait_for_model: true,
                    use_cache: false
                }
            })
        });

        if (!response.ok) {
            // If old endpoint fails, provide helpful error
            if (response.status === 410) {
                throw new Error(`Hugging Face Inference API has been deprecated. Please use Gemini (FREE) or OpenAI instead. See API_STATUS_UPDATE.md for setup instructions.`);
            }

            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as any).error || (errorData as any).message || `HTTP ${response.status}`;

            if (response.status === 403 || response.status === 401) {
                throw new Error(`Access denied to ${modelName}. Your API key may not have access to this model.`);
            }

            throw new Error(`Hugging Face API error: ${errorMsg}`);
        }

        const data: any = await response.json();

        // Parse response
        let text = '';
        if (Array.isArray(data) && data.length > 0) {
            text = data[0].generated_text?.trim() || data[0].text?.trim() || '';
        } else if (typeof data === 'object' && data.generated_text) {
            text = data.generated_text.trim();
        } else if (typeof data === 'string') {
            text = data.trim();
        }

        if (!text) {
            throw new Error(`Model returned empty response. Hugging Face free tier may be unavailable. Consider using Gemini (FREE) instead.`);
        }

        return { text, provider: 'llama' };

    } catch (error: any) {
        // Provide helpful fallback message
        if (error.message?.includes('deprecated') || error.message?.includes('410')) {
            throw new Error(
                `Hugging Face Inference API is no longer available. ` +
                `Please switch to Gemini (FREE): Get API key at https://makersuite.google.com/app/apikey ` +
                `and add GEMINI_API_KEY to .env.local`
            );
        }
        throw error;
    }
}

export { tryLlama };
