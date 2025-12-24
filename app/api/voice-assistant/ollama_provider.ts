/**
 * Ollama Local LLM Integration
 * Runs models locally - completely FREE, no API limits, works offline!
 */

async function tryOllama(prompt: string, opts?: { maxTokens?: number; temperature?: number; model?: string; }): Promise<{ text: string; provider: 'ollama' }> {
    // Ollama runs locally on port 11434 by default
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const modelName = opts?.model || process.env.OLLAMA_MODEL || 'llama3.2:3b';

    try {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelName,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: opts?.temperature ?? 0.7,
                    num_predict: opts?.maxTokens || 512,
                }
            })
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(
                    `Ollama model "${modelName}" not found. ` +
                    `Run: ollama pull ${modelName}`
                );
            }

            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as any).error || `HTTP ${response.status}`;

            if (errorMsg.includes('connect') || errorMsg.includes('ECONNREFUSED')) {
                throw new Error(
                    `Ollama is not running. Please start Ollama: ` +
                    `Open Ollama app or run "ollama serve" in terminal`
                );
            }

            throw new Error(`Ollama error: ${errorMsg}`);
        }

        const data: any = await response.json();
        const text = data.response?.trim();

        if (!text) {
            throw new Error('Ollama returned empty response');
        }

        console.log(`✅ Ollama response generated (model: ${modelName})`);
        return { text, provider: 'ollama' };

    } catch (error: any) {
        if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED') {
            throw new Error(
                `Cannot connect to Ollama. Please ensure: ` +
                `1) Ollama is installed, 2) Ollama is running (check system tray or run "ollama serve")`
            );
        }
        throw error;
    }
}

export { tryOllama };
