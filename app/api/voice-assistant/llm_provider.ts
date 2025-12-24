// Lazy LLM provider abstraction with fallback behaviour.
// Supports Ollama (local), Gemini, OpenAI, and Llama (via Hugging Face).
// Behavior:
// - If LLM_PROVIDER is set, attempt that provider first.
// - Otherwise prefer Ollama (local, free) > OpenAI > Llama > Gemini.
// - If the chosen provider fails at runtime (network/error/invalid key), try the other provider if configured.
// This makes the app resilient when one provider's key is missing or temporarily failing.

// ==================== OLLAMA (LOCAL) ====================

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

// ==================== GEMINI ====================

async function tryGemini(prompt: string, opts?: { maxTokens?: number; temperature?: number; model?: string; }): Promise<{ text: string; provider: 'gemini' }> {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  if (!hasGemini) throw new Error('GEMINI_API_KEY not set');
  // dynamic import bypassing bundler static resolution
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
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);

  // Check if response was blocked or filtered
  const finishReason = (result as any)?.response?.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
    console.warn(`Gemini response blocked/filtered (finishReason: ${finishReason})`);
    const blockageReason = (result as any)?.response?.promptFeedback?.blockReason || finishReason;
    throw new Error(`Gemini: response blocked (${blockageReason}). Please revise your query.`);
  }

  // Gemini SDK: response.text() is a method that returns the text directly (not async)
  let text = '';
  try {
    // Try new API: result.response.text is a method
    if (typeof (result as any).response?.text === 'function') {
      text = (result as any).response.text().trim();
    }
    // Fallback: result.response.text is a string property
    else if (typeof (result as any).response?.text === 'string') {
      text = ((result as any).response.text as string).trim();
    }
    // Older SDK or different response shape: check result.text directly
    else if (typeof (result as any).text === 'function') {
      text = (result as any).text().trim();
    }
    // Last resort: try stringifying and searching for content
    else {
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

  return { text, provider: 'gemini' };
}

async function tryOpenAI(prompt: string, opts?: { maxTokens?: number; temperature?: number; model?: string; }): Promise<{ text: string; provider: 'openai' }> {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  if (!hasOpenAI) throw new Error('OPENAI_API_KEY not set');
  const openaiMod: any = await (new Function('s', 'return import(s)') as any)('openai');
  if (!openaiMod) throw new Error('openai module not installed');
  const Client = openaiMod.default || openaiMod.OpenAI || openaiMod.OpenAIClient || openaiMod;
  const client = new Client({ apiKey: process.env.OPENAI_API_KEY });
  const modelName = opts?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // Chat-style API
  try {
    if (client.chat && client.chat.completions && typeof client.chat.completions.create === 'function') {
      const resp: any = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts?.maxTokens || 512,
        temperature: opts?.temperature || 0.2
      });
      const text = resp.choices?.[0]?.message?.content ?? JSON.stringify(resp);
      return { text, provider: 'openai' };
    }
  } catch (e) {
    // fall through to other checks/fallback
    throw e;
  }

  // Fallback to completion endpoint
  if (typeof client.createCompletion === 'function') {
    const resp: any = await client.createCompletion({ model: modelName, prompt, max_tokens: opts?.maxTokens || 512 });
    const txt = resp.choices?.[0]?.text ?? JSON.stringify(resp);
    return { text: txt, provider: 'openai' };
  }

  throw new Error('OpenAI client does not expose compatible completion API');
}

async function tryLlama(prompt: string, opts?: { maxTokens?: number; temperature?: number; model?: string; }): Promise<{ text: string; provider: 'llama' }> {
  const hasLlama = !!process.env.LLAMA_API_KEY || !!process.env.HUGGINGFACE_API_KEY;
  if (!hasLlama) throw new Error('LLAMA_API_KEY or HUGGINGFACE_API_KEY not set');

  // Use Hugging Face Inference API (FREE tier available!)
  const apiKey = process.env.LLAMA_API_KEY || process.env.HUGGINGFACE_API_KEY;
  const modelName = opts?.model || process.env.LLAMA_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';

  // Hugging Face Inference API endpoint
  // Note: api-inference.huggingface.co is being deprecated, but still works for now
  const apiUrl = `https://api-inference.huggingface.co/models/${modelName}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: opts?.maxTokens || 512,
        temperature: opts?.temperature ?? 0.7,
        return_full_text: false,
        do_sample: true
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

    // Check if it's a model access issue
    if (response.status === 403 || response.status === 401) {
      throw new Error(`Llama API error: Access denied. Please check your API key has access to ${modelName}. You may need to accept the model's license on Hugging Face.`);
    }

    throw new Error(`Llama API error: ${errorMsg}`);
  }

  const data: any = await response.json();

  // Hugging Face returns array of results
  let text = '';
  if (Array.isArray(data) && data.length > 0) {
    text = data[0].generated_text?.trim() || data[0].text?.trim() || '';
  } else if (typeof data === 'object' && data.generated_text) {
    text = data.generated_text.trim();
  }

  if (!text) {
    throw new Error(`Llama returned empty response`);
  }

  return { text, provider: 'llama' };
}

// Helper: retry function for transient errors (e.g., 429)
async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 500): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const is429 = (err && (err.status === 429 || (err.message && err.message.includes('429')) || (err.message && /Too Many Requests/i.test(err.message))));
      // helper: try to extract retry seconds from provider error messages (e.g., Gemini RetryInfo or plain text 'Please retry in Xs')
      const parseRetrySeconds = (e: any): number | null => {
        try {
          if (!e) return null;
          // If provider includes structured errorDetails with retryDelay
          const details = e.errorDetails || e.error_info || e.details || (e.body && e.body.error && e.body.error.details) || e.errorDetails;
          if (Array.isArray(details)) {
            for (const d of details) {
              if (d && typeof d === 'object' && (d['@type'] || '').toString().toLowerCase().includes('retryinfo') && d.retryDelay) {
                const m = String(d.retryDelay).match(/(\d+)(?:\.(\d+))?s/);
                if (m) return parseFloat(m[1] + (m[2] ? '.' + m[2] : ''));
              }
            }
          }
          // Fallback: parse message text like 'Please retry in 52.98s'
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

      // If provider included structured RetryInfo, don't keep retrying on the server — surface it immediately
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

export async function generateWithProvider(prompt: string, opts?: { maxTokens?: number; temperature?: number; model?: string; }): Promise<{ text: string; provider: 'openai' | 'gemini' | 'llama' | 'ollama' | 'fallback' }> {
  const providerEnv = process.env.LLM_PROVIDER?.toLowerCase();
  const hasOllama = true; // Ollama is always available if installed locally
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasLlama = !!(process.env.LLAMA_API_KEY || process.env.HUGGINGFACE_API_KEY);

  // Prefer Ollama (local, free, fast) > OpenAI > Llama > Gemini
  const preferred = providerEnv || (hasOllama ? 'ollama' : (hasOpenAI ? 'openai' : (hasLlama ? 'llama' : (hasGemini ? 'gemini' : undefined))));

  if (!preferred) {
    throw new Error('No LLM provider configured. Install Ollama (recommended) or set OPENAI_API_KEY, GEMINI_API_KEY, or LLM_PROVIDER.');
  }

  // Helper to attempt fallback
  const tryFallback = async (primary: 'ollama' | 'openai' | 'gemini' | 'llama') => {
    const others: ('ollama' | 'openai' | 'gemini' | 'llama')[] =
      primary === 'ollama' ? ['openai', 'gemini', 'llama'] :
        primary === 'openai' ? ['ollama', 'llama', 'gemini'] :
          primary === 'llama' ? ['ollama', 'openai', 'gemini'] :
            ['ollama', 'openai', 'llama'];

    try {
      if (primary === 'ollama') return await tryOllama(prompt, opts);
      if (primary === 'openai') return await withRetry(() => tryOpenAI(prompt, opts));
      if (primary === 'llama') return await withRetry(() => tryLlama(prompt, opts));
      return await withRetry(() => tryGemini(prompt, opts));
    } catch (errPrimary) {
      // If other providers are available, attempt them
      console.warn(`${primary} provider failed:`, (errPrimary as any)?.message ?? String(errPrimary));
      for (const other of others) {
        if ((other === 'ollama') ||
          (other === 'openai' && hasOpenAI) ||
          (other === 'llama' && hasLlama) ||
          (other === 'gemini' && hasGemini)) {
          try {
            if (other === 'ollama') return await tryOllama(prompt, opts);
            if (other === 'openai') return await withRetry(() => tryOpenAI(prompt, opts));
            if (other === 'llama') return await withRetry(() => tryLlama(prompt, opts));
            return await withRetry(() => tryGemini(prompt, opts));
          } catch (errSecondary) {
            console.error(`${other} provider also failed:`, (errSecondary as any)?.message ?? String(errSecondary));
          }
        }
      }
      throw errPrimary;
    }
  };

  // If user explicitly asked for a provider, try that first (with fallback)
  if (providerEnv === 'ollama' || providerEnv === 'openai' || providerEnv === 'gemini' || providerEnv === 'llama') {
    return await tryFallback(providerEnv as 'ollama' | 'openai' | 'gemini' | 'llama');
  }

  // Otherwise prefer Ollama (local) > OpenAI > Llama > Gemini
  if (hasOllama) return await tryFallback('ollama');
  if (hasOpenAI) return await tryFallback('openai');
  if (hasLlama) return await tryFallback('llama');
  if (hasGemini) return await tryFallback('gemini');

  throw new Error('No available LLM providers found');
}

export function isProviderConfigured(): boolean {
  return true; // Ollama is always available if installed, or other providers can be configured
}

