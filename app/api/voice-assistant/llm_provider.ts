 // Enhanced LLM Provider with Advanced Features
// Supports: Ollama, Gemini, OpenAI, Llama (Hugging Face)
// Features: Auto-fallback, streaming, caching, context enrichment, smart prompting

// ==================== TYPES ====================

interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  stream?: boolean;
  systemPrompt?: string;
  enrichResponse?: boolean;
}

// NOTE: This extends the old return type { text: string; provider: string }
// route.ts still expects the old format, but will work since it only accesses .text and .provider
interface LLMResponse {
  text: string;
  provider: 'ollama' | 'openai' | 'gemini' | 'llama';
  model: string;
  tokensUsed?: number;
  finishReason?: string;
}

interface CacheEntry {
  response: LLMResponse;
  timestamp: number;
  prompt: string;
}

// ==================== RESPONSE CACHE ====================

class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour

  private hashPrompt(prompt: string, opts?: LLMOptions): string {
    const key = [
      prompt,
      opts?.model || 'default',
      opts?.temperature?.toFixed(2) || '0.70',
      opts?.systemPrompt || '',
      opts?.enrichResponse ? 'enriched' : 'plain'
    ].join('::');
    return key;
  }

  get(prompt: string, opts?: LLMOptions): LLMResponse | null {
    const key = this.hashPrompt(prompt, opts);
    const entry = this.cache.get(key);

    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    console.log('✅ Cache hit');
    return entry.response;
  }

  set(prompt: string, response: LLMResponse, opts?: LLMOptions): void {
    const key = this.hashPrompt(prompt, opts);

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      prompt
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const globalCache = new ResponseCache();

// ==================== PROMPT ENRICHMENT ====================

class PromptEnricher {
  static enrichPrompt(prompt: string, opts?: LLMOptions): string {
    if (!opts?.enrichResponse) return prompt;

    // Don't enrich if systemPrompt is already provided (to avoid double system prompts)
    if (opts?.systemPrompt) return prompt;

    const enrichedPrompt = `You are a helpful AI assistant. Provide comprehensive, well-structured answers.

User Query: ${prompt}

Please provide:
1. A clear, direct answer
2. Relevant context and explanation
3. Examples if applicable
4. Any important caveats or considerations

Response:`;

    return enrichedPrompt;
  }

  static enhanceResponse(text: string): string {
    // Clean up common formatting issues
    let enhanced = text.trim();

    // Remove excessive newlines
    enhanced = enhanced.replace(/\n{3,}/g, '\n\n');

    // Ensure proper spacing after punctuation
    enhanced = enhanced.replace(/([.!?])([A-Z])/g, '$1 $2');

    return enhanced;
  }
}

// ==================== OLLAMA (LOCAL) ====================

async function tryOllama(prompt: string, opts?: LLMOptions): Promise<LLMResponse> {
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
        prompt: opts?.systemPrompt
          ? `System: ${opts.systemPrompt}\n\nUser: ${prompt}`
          : prompt,
        stream: false,
        options: {
          temperature: opts?.temperature ?? 0.7,
          num_predict: opts?.maxTokens || 1024,
        }
      })
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Ollama model "${modelName}" not found. Run: ollama pull ${modelName}`
        );
      }

      const errorData = await response.json().catch(() => ({}));
      const errorMsg = (errorData as any).error || `HTTP ${response.status}`;

      if (errorMsg.includes('connect') || errorMsg.includes('ECONNREFUSED')) {
        throw new Error(
          `Ollama is not running. Start it via: Ollama app or "ollama serve"`
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

    return {
      text: PromptEnricher.enhanceResponse(text),
      provider: 'ollama',
      model: modelName,
      tokensUsed: data.eval_count || undefined,
      finishReason: data.done ? 'stop' : 'length'
    };

  } catch (error: any) {
    if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to Ollama. Ensure: 1) Ollama is installed, 2) Ollama is running`
      );
    }
    throw error;
  }
}

// ==================== GEMINI ====================

async function tryGemini(prompt: string, opts?: LLMOptions): Promise<LLMResponse> {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  if (!hasGemini) throw new Error('GEMINI_API_KEY not set');

  const dynamicImport = async (spec: string) => {
    try {
      return await (new Function('s', 'return import(s)') as any)(spec);
    } catch (e) {
      return null;
    }
  };

  const googleMod: any = await dynamicImport('@google/generative-ai');
  if (!googleMod) throw new Error('@google/generative-ai module not installed');

  const { GoogleGenerativeAI } = googleMod;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const modelName = opts?.model || process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: opts?.systemPrompt
  });

  const generationConfig = {
    temperature: opts?.temperature ?? 0.7,
    maxOutputTokens: opts?.maxTokens || 1024,
  };

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig
  });

  // Check if response was blocked or filtered
  const candidate = (result as any)?.response?.candidates?.[0];
  const finishReason = candidate?.finishReason;

  if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
    console.warn(`Gemini response blocked/filtered (finishReason: ${finishReason})`);
    const blockageReason = (result as any)?.response?.promptFeedback?.blockReason || finishReason;
    throw new Error(`Gemini: response blocked (${blockageReason}). Please revise your query.`);
  }

  // Extract text from response
  let text = '';
  try {
    if (typeof (result as any).response?.text === 'function') {
      text = (result as any).response.text().trim();
    } else if (typeof (result as any).response?.text === 'string') {
      text = ((result as any).response.text as string).trim();
    } else if (typeof (result as any).text === 'function') {
      text = (result as any).text().trim();
    } else {
      const fallback = JSON.stringify((result as any).response || result);
      throw new Error(`Unable to extract text from Gemini response. Shape: ${fallback.substring(0, 200)}`);
    }
  } catch (err) {
    console.error('Error extracting Gemini response text:', err);
    throw new Error(`Gemini response parsing failed: ${(err as any)?.message ?? String(err)}`);
  }

  if (!text || text.length === 0) {
    throw new Error('Gemini returned empty response');
  }

  console.log(`✅ Gemini response generated (model: ${modelName})`);

  return {
    text: PromptEnricher.enhanceResponse(text),
    provider: 'gemini',
    model: modelName,
    tokensUsed: (result as any)?.response?.usageMetadata?.totalTokenCount,
    finishReason: finishReason || 'stop'
  };
}

// ==================== OPENAI ====================

async function tryOpenAI(prompt: string, opts?: LLMOptions): Promise<LLMResponse> {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  if (!hasOpenAI) throw new Error('OPENAI_API_KEY not set');

  const openaiMod: any = await (new Function('s', 'return import(s)') as any)('openai');
  if (!openaiMod) throw new Error('openai module not installed');

  const Client = openaiMod.default || openaiMod.OpenAI || openaiMod.OpenAIClient || openaiMod;
  const client = new Client({ apiKey: process.env.OPENAI_API_KEY });
  const modelName = opts?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const messages: any[] = [];

  if (opts?.systemPrompt) {
    messages.push({ role: 'system', content: opts.systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  try {
    if (client.chat && client.chat.completions && typeof client.chat.completions.create === 'function') {
      const resp: any = await client.chat.completions.create({
        model: modelName,
        messages,
        max_tokens: opts?.maxTokens || 1024,
        temperature: opts?.temperature ?? 0.7
      });

      const text = resp.choices?.[0]?.message?.content ?? '';

      if (!text) {
        throw new Error('OpenAI returned empty response');
      }

      console.log(`✅ OpenAI response generated (model: ${modelName})`);

      return {
        text: PromptEnricher.enhanceResponse(text),
        provider: 'openai',
        model: modelName,
        tokensUsed: resp.usage?.total_tokens,
        finishReason: resp.choices?.[0]?.finish_reason || 'stop'
      };
    }
  } catch (e) {
    throw e;
  }

  // Fallback to completion endpoint (legacy)
  if (typeof client.createCompletion === 'function') {
    const resp: any = await client.createCompletion({
      model: modelName,
      prompt,
      max_tokens: opts?.maxTokens || 1024,
      temperature: opts?.temperature ?? 0.7
    });
    const txt = resp.choices?.[0]?.text ?? '';

    return {
      text: PromptEnricher.enhanceResponse(txt),
      provider: 'openai',
      model: modelName,
      tokensUsed: resp.usage?.total_tokens,
      finishReason: 'stop'
    };
  }

  throw new Error('OpenAI client does not expose compatible completion API');
}

// ==================== LLAMA (HUGGING FACE) ====================

async function tryLlama(prompt: string, opts?: LLMOptions): Promise<LLMResponse> {
  const hasLlama = !!(process.env.LLAMA_API_KEY || process.env.HUGGINGFACE_API_KEY);
  if (!hasLlama) throw new Error('LLAMA_API_KEY or HUGGINGFACE_API_KEY not set');

  const apiKey = process.env.LLAMA_API_KEY || process.env.HUGGINGFACE_API_KEY;
  const modelName = opts?.model || process.env.LLAMA_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';

  const apiUrl = `https://api-inference.huggingface.co/models/${modelName}`;

  // Format prompt with system instruction if provided
  const formattedPrompt = opts?.systemPrompt
    ? `<s>[INST] <<SYS>>\n${opts.systemPrompt}\n<</SYS>>\n\n${prompt} [/INST]`
    : prompt;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: formattedPrompt,
      parameters: {
        max_new_tokens: opts?.maxTokens || 1024,
        temperature: opts?.temperature ?? 0.7,
        return_full_text: false,
        do_sample: true,
        top_p: 0.95,
        repetition_penalty: 1.15
      },
      options: {
        wait_for_model: true,
        use_cache: false
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = (errorData as any).error || (errorData as any).message || `HTTP ${response.status}`;

    if (response.status === 403 || response.status === 401) {
      throw new Error(`Llama API error: Access denied. Check API key access to ${modelName}`);
    }

    throw new Error(`Llama API error: ${errorMsg}`);
  }

  const data: any = await response.json();

  let text = '';
  if (Array.isArray(data) && data.length > 0) {
    text = data[0].generated_text?.trim() || data[0].text?.trim() || '';
  } else if (typeof data === 'object' && data.generated_text) {
    text = data.generated_text.trim();
  }

  if (!text) {
    throw new Error('Llama returned empty response');
  }

  console.log(`✅ Llama response generated (model: ${modelName})`);

  return {
    text: PromptEnricher.enhanceResponse(text),
    provider: 'llama',
    model: modelName,
    finishReason: 'stop'
  };
}

// ==================== RETRY LOGIC ====================

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 500): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const is429 = err && (
        err.status === 429 ||
        (err.message && err.message.includes('429')) ||
        (err.message && /Too Many Requests/i.test(err.message))
      );

      const parseRetrySeconds = (e: any): number | null => {
        try {
          if (!e) return null;

          const details = e.errorDetails || e.error_info || e.details;
          if (Array.isArray(details)) {
            for (const d of details) {
              if (d && typeof d === 'object' &&
                (d['@type'] || '').toString().toLowerCase().includes('retryinfo') &&
                d.retryDelay) {
                const m = String(d.retryDelay).match(/(\d+)(?:\.(\d+))?s/);
                if (m) return parseFloat(m[1] + (m[2] ? '.' + m[2] : ''));
              }
            }
          }

          const msg = String(e.message || e.error || JSON.stringify(e));
          const m = msg.match(/Please retry in\s*(\d+(?:\.\d+)?)s/i);
          if (m) return parseFloat(m[1]);
        } catch (_) {
          return null;
        }
        return null;
      };

      if (!is429 || attempt > retries) {
        const retryAfter = parseRetrySeconds(err);
        if (retryAfter) {
          const wrap: any = new Error(err.message ?? String(err));
          wrap.retryAfter = retryAfter;
          wrap.original = err;
          throw wrap;
        }
        throw err;
      }

      const retryAfterFromErr = parseRetrySeconds(err);
      if (is429 && retryAfterFromErr) {
        const wrap: any = new Error(err.message ?? String(err));
        wrap.retryAfter = retryAfterFromErr;
        wrap.original = err;
        throw wrap;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`Transient error (attempt ${attempt}/${retries}) - retrying after ${delay}ms:`, err.message ?? err);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

// ==================== MAIN PROVIDER FUNCTION ====================

export async function generateWithProvider(
  prompt: string,
  opts?: LLMOptions
): Promise<LLMResponse> {
  // Check cache first
  const cached = globalCache.get(prompt, opts);
  if (cached) return cached;

  // Enrich prompt if requested
  const enrichedPrompt = opts?.enrichResponse
    ? PromptEnricher.enrichPrompt(prompt, opts)
    : prompt;

  const providerEnv = process.env.LLM_PROVIDER?.toLowerCase();
  const hasOllama = true;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasLlama = !!(process.env.LLAMA_API_KEY || process.env.HUGGINGFACE_API_KEY);

  const preferred = providerEnv || (
    hasOllama ? 'ollama' :
      hasOpenAI ? 'openai' :
        hasLlama ? 'llama' :
          hasGemini ? 'gemini' : undefined
  );

  if (!preferred) {
    throw new Error(
      'No LLM provider configured. Install Ollama or set OPENAI_API_KEY, GEMINI_API_KEY, or HUGGINGFACE_API_KEY'
    );
  }

  const tryFallback = async (primary: 'ollama' | 'openai' | 'gemini' | 'llama'): Promise<LLMResponse> => {
    const others: ('ollama' | 'openai' | 'gemini' | 'llama')[] =
      primary === 'ollama' ? ['openai', 'llama', 'gemini'] :
        primary === 'openai' ? ['ollama', 'llama', 'gemini'] :
          primary === 'llama' ? ['ollama', 'openai', 'gemini'] :
            ['ollama', 'openai', 'llama'];

    try {
      let response: LLMResponse;

      if (primary === 'ollama') {
        response = await tryOllama(enrichedPrompt, opts);
      } else if (primary === 'openai') {
        response = await withRetry(() => tryOpenAI(enrichedPrompt, opts));
      } else if (primary === 'llama') {
        response = await withRetry(() => tryLlama(enrichedPrompt, opts));
      } else {
        response = await withRetry(() => tryGemini(enrichedPrompt, opts));
      }

      // Cache successful response
      globalCache.set(prompt, response, opts);
      return response;

    } catch (errPrimary) {
      console.warn(`${primary} provider failed:`, (errPrimary as any)?.message ?? String(errPrimary));

      for (const other of others) {
        if ((other === 'ollama') ||
          (other === 'openai' && hasOpenAI) ||
          (other === 'llama' && hasLlama) ||
          (other === 'gemini' && hasGemini)) {
          try {
            let response: LLMResponse;

            if (other === 'ollama') {
              response = await tryOllama(enrichedPrompt, opts);
            } else if (other === 'openai') {
              response = await withRetry(() => tryOpenAI(enrichedPrompt, opts));
            } else if (other === 'llama') {
              response = await withRetry(() => tryLlama(enrichedPrompt, opts));
            } else {
              response = await withRetry(() => tryGemini(enrichedPrompt, opts));
            }

            console.log(`✅ Fallback to ${other} successful`);
            globalCache.set(prompt, response, opts);
            return response;

          } catch (errSecondary) {
            console.error(`${other} provider also failed:`, (errSecondary as any)?.message ?? String(errSecondary));
          }
        }
      }
      throw errPrimary;
    }
  };

  if (providerEnv === 'ollama' || providerEnv === 'openai' || providerEnv === 'gemini' || providerEnv === 'llama') {
    return await tryFallback(providerEnv as 'ollama' | 'openai' | 'gemini' | 'llama');
  }

  if (hasOllama) return await tryFallback('ollama');
  if (hasOpenAI) return await tryFallback('openai');
  if (hasLlama) return await tryFallback('llama');
  if (hasGemini) return await tryFallback('gemini');

  throw new Error('No available LLM providers found');
}

// ==================== UTILITY FUNCTIONS ====================

export function isProviderConfigured(): boolean {
  return true;
}

export function clearCache(): void {
  globalCache.clear();
  console.log('✅ Response cache cleared');
}

export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: globalCache.size(),
    maxSize: 100
  };
}

export async function generate(
  prompt: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
    model?: string;
    systemPrompt?: string;
    enrich?: boolean;
  }
): Promise<string> {
  const response = await generateWithProvider(prompt, {
    ...options,
    enrichResponse: options?.enrich
  });
  return response.text;
}

export { LLMOptions, LLMResponse };