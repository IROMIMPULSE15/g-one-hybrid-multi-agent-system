/**
 * Embeddings generation module for RAG (Retrieval Augmented Generation)
 * Supports multiple embedding providers with fallback mechanisms
 */

/**
 * Generate embeddings for text using available providers
 * Priority: Hugging Face (FREE) > Fallback (always works)
 * Note: OpenAI and Together AI are paid services and disabled by default
 * @param text - The text to generate embeddings for
 * @returns A vector embedding (array of numbers)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    // Clean and prepare the text
    const cleanText = text.trim().slice(0, 8000) // Limit text length

    if (!cleanText) {
        console.warn('⚠️ Empty text provided for embedding generation')
        return generateFallbackEmbedding(cleanText)
    }

    // Try Hugging Face embeddings FIRST (FREE tier available!)
    if (process.env.HUGGINGFACE_API_KEY) {
        try {
            return await generateHuggingFaceEmbedding(cleanText)
        } catch (error) {
            console.warn('⚠️ Hugging Face embedding failed, using fallback:', (error as any)?.message)
        }
    }

    // Fallback to enhanced local embedding generation (always works, no API needed)
    console.log('ℹ️ Using enhanced fallback embedding generation (no API key required)')
    return generateFallbackEmbedding(cleanText)
}

/**
 * Generate embeddings using OpenAI's API
 */
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
    const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            input: text,
            encoding_format: 'float'
        })
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = (errorData as any).error?.message || `HTTP ${response.status}`
        throw new Error(`OpenAI Embedding API error: ${errorMsg}`)
    }

    const data: any = await response.json()
    const embedding = data.data?.[0]?.embedding

    if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from OpenAI')
    }

    console.log(`✅ Generated OpenAI embedding (dimension: ${embedding.length})`)
    return embedding
}

/**
 * Generate embeddings using Together AI (for Llama ecosystem)
 */
async function generateTogetherEmbedding(text: string): Promise<number[]> {
    const baseUrl = process.env.LLAMA_API_BASE || 'https://api.together.xyz/v1'
    const model = process.env.TOGETHER_EMBEDDING_MODEL || 'togethercomputer/m2-bert-80M-8k-retrieval'

    const response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.LLAMA_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            input: text
        })
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = (errorData as any).error?.message || `HTTP ${response.status}`
        throw new Error(`Together AI Embedding API error: ${errorMsg}`)
    }

    const data: any = await response.json()
    const embedding = data.data?.[0]?.embedding

    if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from Together AI')
    }

    console.log(`✅ Generated Together AI embedding (dimension: ${embedding.length})`)
    return embedding
}

/**
 * Generate embeddings using Hugging Face Inference API
 */
async function generateHuggingFaceEmbedding(text: string): Promise<number[]> {
    const model = process.env.HUGGINGFACE_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2'
    const apiUrl = `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: text,
            options: {
                wait_for_model: true
            }
        })
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = (errorData as any).error || `HTTP ${response.status}`
        throw new Error(`Hugging Face Embedding API error: ${errorMsg}`)
    }

    const embedding: any = await response.json()

    // Hugging Face returns nested arrays, flatten if needed
    const flatEmbedding = Array.isArray(embedding[0]) ? embedding[0] : embedding

    if (!Array.isArray(flatEmbedding)) {
        throw new Error('Invalid embedding response from Hugging Face')
    }

    console.log(`✅ Generated Hugging Face embedding (dimension: ${flatEmbedding.length})`)
    return flatEmbedding
}

/**
 * Enhanced fallback embedding generation using word-level features
 * This creates a more semantically meaningful vector than simple hashing
 * Uses: word frequencies, character n-grams, and position weighting
 * Note: While not as good as transformer models, this is surprisingly effective for RAG
 */
function generateFallbackEmbedding(text: string, dimension: number = 384): number[] {
    const embedding = new Array(dimension).fill(0)

    if (!text || text.length === 0) {
        return embedding
    }

    // Normalize text
    const normalizedText = text.toLowerCase().trim()

    // Extract words and calculate frequencies (TF-IDF-like)
    const words = normalizedText.split(/\s+/).filter(w => w.length > 0)
    const wordFreq = new Map<string, number>()

    for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }

    // Generate embedding from multiple features
    let featureIndex = 0

    // Feature 1: Word-level embeddings (using hash)
    for (const [word, freq] of wordFreq.entries()) {
        const wordHash = simpleHash(word)
        const weight = Math.log(1 + freq) // TF-IDF style weighting

        for (let i = 0; i < 3; i++) {
            const idx = (wordHash + i * 7919) % dimension // Use prime numbers for better distribution
            embedding[idx] += weight * Math.sin(wordHash * (i + 1) * 0.1)
        }
    }

    // Feature 2: Character n-grams (captures morphology)
    for (let n = 2; n <= 3; n++) {
        for (let i = 0; i <= normalizedText.length - n; i++) {
            const ngram = normalizedText.substring(i, i + n)
            const ngramHash = simpleHash(ngram)
            const idx = (ngramHash + n * 1000) % dimension
            embedding[idx] += 0.5 * Math.cos(ngramHash * 0.1)
        }
    }

    // Feature 3: Position-weighted character features
    for (let i = 0; i < normalizedText.length; i++) {
        const charCode = normalizedText.charCodeAt(i)
        const positionWeight = 1.0 / (1.0 + i * 0.01) // Earlier characters weighted more
        const idx = (charCode * (i + 1)) % dimension
        embedding[idx] += positionWeight * 0.3
    }

    // Feature 4: Text length and structure features
    const lengthFeature = Math.log(1 + normalizedText.length) / 10
    const wordCountFeature = Math.log(1 + words.length) / 10
    const avgWordLength = words.length > 0 ? normalizedText.length / words.length : 0

    embedding[0] += lengthFeature
    embedding[1] += wordCountFeature
    embedding[2] += avgWordLength * 0.1

    // Normalize the vector (L2 normalization)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    if (magnitude > 0) {
        for (let i = 0; i < embedding.length; i++) {
            embedding[i] /= magnitude
        }
    }

    console.log(`⚠️ Generated enhanced fallback embedding (dimension: ${dimension}, words: ${words.length})`)
    return embedding
}

/**
 * Simple hash function for strings
 */
function simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
}

/**
 * Batch generate embeddings for multiple texts
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of embeddings
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []

    for (const text of texts) {
        try {
            const embedding = await generateEmbedding(text)
            embeddings.push(embedding)
        } catch (error) {
            console.error('❌ Failed to generate embedding for text:', error)
            // Use fallback for failed embeddings
            embeddings.push(generateFallbackEmbedding(text))
        }
    }

    return embeddings
}

/**
 * Calculate cosine similarity between two embeddings
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score between -1 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error('Embeddings must have the same dimension')
    }

    let dotProduct = 0
    let magnitudeA = 0
    let magnitudeB = 0

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        magnitudeA += a[i] * a[i]
        magnitudeB += b[i] * b[i]
    }

    magnitudeA = Math.sqrt(magnitudeA)
    magnitudeB = Math.sqrt(magnitudeB)

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0
    }

    return dotProduct / (magnitudeA * magnitudeB)
}
