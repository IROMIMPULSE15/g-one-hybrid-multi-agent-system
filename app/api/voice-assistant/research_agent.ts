/**
 * ScholarMind — Research Paper Simplifier Agent
 * ================================================
 * Voice/Text → Paper Analysis → Plain-English Breakdown
 *
 * Features:
 *   1. Title/Abstract parsing — Extracts key info from pasted text
 *   2. Plain-English Explanation — Jargon-free summary
 *   3. Key Contributions — What the paper actually achieved
 *   4. Limitations — Honest assessment of weaknesses
 *   5. Real-World Applications — Practical use cases
 *   6. Technical Term Glossary — Explains jargon inline
 *
 * Uses the configured LLM (Ollama/Gemini/OpenAI) for intelligent
 * summarization. Zero external API cost if using local Ollama.
 */

import { generateWithProvider } from './llm_provider'

// ==================== TYPES ====================

interface PaperAnalysis {
    title: string
    plainExplanation: string
    keyContributions: string[]
    limitations: string[]
    realWorldApplications: string[]
    technicalTerms: Record<string, string>
    fieldOfStudy: string
    difficultyLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
}

interface ScholarResult {
    response: string
    analysis?: PaperAnalysis
    cotSteps: string[]
    sources: string[]
    cached: boolean
}

interface CacheEntry {
    result: ScholarResult
    timestamp: number
}

// ==================== CONFIGURATION ====================

const CACHE_TTL_MS = 2 * 60 * 60 * 1000  // 2 hours (papers don't change)
const MAX_CACHE_SIZE = 30
const MAX_INPUT_LENGTH = 15000  // Max characters of paper text to process

// ==================== IN-MEMORY CACHE ====================

const scholarCache = new Map<string, CacheEntry>()

function getCacheKey(text: string): string {
    // Use first 200 chars as key (enough to identify a paper)
    return text.toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 200)
}

function getCachedResult(text: string): ScholarResult | null {
    const key = getCacheKey(text)
    const entry = scholarCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        scholarCache.delete(key)
        return null
    }
    return { ...entry.result, cached: true }
}

function setCachedResult(text: string, result: ScholarResult): void {
    const key = getCacheKey(text)
    if (scholarCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = scholarCache.keys().next().value
        if (oldestKey) scholarCache.delete(oldestKey)
    }
    scholarCache.set(key, { result, timestamp: Date.now() })
}

// ==================== INTENT DETECTION ====================

const RESEARCH_PATTERNS = [
    /\b(research paper|paper|journal|publication|arxiv|ieee|acm|springer)\b/i,
    /\b(simplif|explain|break ?down|summarize|summarise|summary|eli5|plain english)\b.*\b(paper|article|study|thesis|dissertation|abstract)\b/i,
    /\b(paper|article|study|thesis)\b.*\b(simplif|explain|break ?down|summarize|summarise|summary)\b/i,
    /\b(scholar ?mind|research agent|paper simplifier|paper agent)\b/i,
    /\b(abstract|introduction|methodology|conclusion)\b.*\b(paper|study|research)\b/i,
    /\b(what does this (paper|study|research) (say|mean|propose))\b/i,
    /\b(analyze|analyse) (this |the )?(paper|study|research|article)\b/i,
]

/**
 * Detect if the text contains an academic paper or abstract.
 * Looks for structural markers typical of research papers.
 */
const PAPER_CONTENT_MARKERS = [
    /\babstract\s*[:\-—]/i,
    /\bintroduction\s*\n/i,
    /\bwe propose\b/i,
    /\bour (method|approach|model|framework|system|algorithm)\b/i,
    /\bexperimental results?\b/i,
    /\brelated work\b/i,
    /\bstate[- ]of[- ]the[- ]art\b/i,
    /\b(outperform|baseline|benchmark|dataset|epoch|training|inference)\b/i,
    /\bet al\.\b/i,
    /\b(doi|isbn|issn|arxiv)\b/i,
    /\b(fig\.|figure \d|table \d)\b/i,
    /\bconclusion\s*\n/i,
]

export function isResearchPaperIntent(message: string): boolean {
    const m = message.toLowerCase().trim()

    // Check explicit intent patterns
    if (RESEARCH_PATTERNS.some(pattern => pattern.test(m))) return true

    // Check if the message contains paper content (pasted abstract/text)
    const markerCount = PAPER_CONTENT_MARKERS.filter(p => p.test(m)).length
    return markerCount >= 2  // At least 2 academic markers → likely a paper
}

// ==================== PRE-PROCESSING ====================

/**
 * Extract a title from the pasted text if possible.
 */
function extractTitle(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

    // First non-empty line that's not "abstract" or a common header
    for (const line of lines.slice(0, 5)) {
        if (/^(abstract|introduction|keywords|doi|arxiv)/i.test(line)) continue
        if (line.length > 10 && line.length < 200 && !line.endsWith('.')) {
            return line
        }
        if (line.length > 10 && line.length < 200) {
            return line
        }
    }

    // Fallback: first sentence
    const firstSentence = text.match(/^(.+?)[.!?]/)
    if (firstSentence) return firstSentence[1].substring(0, 150)

    return 'Research Paper'
}

/**
 * Extract the abstract section if present.
 */
function extractAbstract(text: string): string | null {
    // Pattern: "Abstract" followed by text until next section header
    const abstractMatch = text.match(
        /abstract\s*[:\-—]?\s*\n?([\s\S]+?)(?=\n\s*(?:introduction|keywords|1\.|I\.|related work|background)|\n\n\n)/i
    )
    if (abstractMatch) return abstractMatch[1].trim()

    // Fallback: look for "Abstract:" inline
    const inlineMatch = text.match(/abstract\s*[:\-—]\s*([\s\S]+?)(?:\n\n|\n(?=[A-Z]))/i)
    if (inlineMatch) return inlineMatch[1].trim()

    return null
}

/**
 * Detect the general field of study from keywords.
 */
function detectField(text: string): string {
    const m = text.toLowerCase()
    const fields: [RegExp, string][] = [
        [/\b(neural network|deep learning|machine learning|transformer|attention mechanism|cnn|rnn|lstm|gpt|bert|llm)\b/, 'Artificial Intelligence / Machine Learning'],
        [/\b(nlp|natural language|text mining|sentiment|tokeniz|word embedding|language model)\b/, 'Natural Language Processing'],
        [/\b(computer vision|image|object detection|segmentation|gan|convolutional)\b/, 'Computer Vision'],
        [/\b(iot|internet of things|sensor|embedded|smart home|edge computing|mqtt)\b/, 'Internet of Things'],
        [/\b(blockchain|distributed ledger|smart contract|ethereum|consensus)\b/, 'Blockchain / Distributed Systems'],
        [/\b(quantum|qubit|superposition|entanglement)\b/, 'Quantum Computing'],
        [/\b(robot|autonomous|navigation|slam|reinforcement learning)\b/, 'Robotics / Autonomous Systems'],
        [/\b(cyber ?security|encryption|cryptography|vulnerability|malware|intrusion)\b/, 'Cybersecurity'],
        [/\b(medicine|clinical|patient|diagnosis|healthcare|drug|pharmaceutical)\b/, 'Medical / Healthcare'],
        [/\b(climate|environment|sustainability|carbon|renewable|energy)\b/, 'Environmental Science'],
        [/\b(data mining|big data|analytics|data warehouse|etl|visualization)\b/, 'Data Science / Analytics'],
        [/\b(cloud|microservice|serverless|kubernetes|docker|devops)\b/, 'Cloud Computing / DevOps'],
    ]

    for (const [pattern, field] of fields) {
        if (pattern.test(m)) return field
    }
    return 'Computer Science / Engineering'
}

/**
 * Assess difficulty level based on jargon density.
 */
function assessDifficulty(text: string): PaperAnalysis['difficultyLevel'] {
    const m = text.toLowerCase()
    const jargonTerms = [
        'stochastic', 'gradient descent', 'backpropagation', 'convolution',
        'attention mechanism', 'transformer', 'embedding', 'latent space',
        'variational', 'bayesian', 'markov', 'entropy', 'divergence',
        'eigenvalue', 'tensor', 'fourier', 'heuristic', 'polynomial',
        'asymptotic', 'convergence', 'optimization', 'regularization',
        'hyperparameter', 'cross-entropy', 'softmax', 'sigmoid',
        'recurrent', 'generative', 'discriminative', 'adversarial',
    ]

    let count = 0
    for (const term of jargonTerms) {
        if (m.includes(term)) count++
    }

    if (count >= 10) return 'Expert'
    if (count >= 6) return 'Advanced'
    if (count >= 3) return 'Intermediate'
    return 'Beginner'
}

// ==================== LLM-POWERED ANALYSIS ====================

const SCHOLAR_SYSTEM_PROMPT = `You are ScholarMind, a research paper simplifier. Your job is to take complex academic papers and explain them so that ANYONE — even a non-technical person — can understand.

IMPORTANT RULES:
1. Use SIMPLE language — imagine explaining to a smart 15-year-old
2. NEVER use jargon without immediately explaining it in parentheses
3. Use real-world analogies (e.g., "Think of it like a recipe...")
4. Be HONEST about limitations — don't oversell the paper
5. Focus on: WHAT was done, WHY it matters, HOW it helps in real life
6. Each point should be 1-2 sentences max

You MUST respond ONLY with a JSON object (no markdown, no code fences, no extra text):
{
  "plainExplanation": "A 3-5 sentence plain-English explanation of what this paper is about and what it achieved. Use everyday language.",
  "whyItMatters": "One sentence explaining why this research is important for the world.",
  "keyContributions": ["contribution 1", "contribution 2", "contribution 3"],
  "limitations": ["limitation 1", "limitation 2"],
  "realWorldApplications": ["application 1", "application 2", "application 3"],
  "technicalTerms": {"term1": "simple definition", "term2": "simple definition"}
}

Respond ONLY with the JSON object.`

async function analyzeWithLLM(text: string, title: string): Promise<PaperAnalysis | null> {
    try {
        const truncatedText = text.substring(0, MAX_INPUT_LENGTH)

        const prompt = `Analyze this research paper and provide a plain-English breakdown.

Title: ${title}

Paper Content:
${truncatedText}

Remember: Respond ONLY with the JSON object as specified.`

        const llmResponse = await generateWithProvider(prompt, {
            maxTokens: 2048,
            temperature: 0.3,  // Low temp for factual accuracy
            systemPrompt: SCHOLAR_SYSTEM_PROMPT
        })

        // Parse the JSON response
        const responseText = llmResponse.text.trim()

        // Try to extract JSON from the response (handle potential markdown wrapping)
        let jsonStr = responseText
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            jsonStr = jsonMatch[0]
        }

        const parsed = JSON.parse(jsonStr)

        // Combine whyItMatters into explanation if present
        let explanation = parsed.plainExplanation || 'Unable to generate explanation.'
        if (parsed.whyItMatters) {
            explanation += `\n\n**Why it matters:** ${parsed.whyItMatters}`
        }

        return {
            title,
            plainExplanation: explanation,
            keyContributions: parsed.keyContributions || [],
            limitations: parsed.limitations || [],
            realWorldApplications: parsed.realWorldApplications || [],
            technicalTerms: parsed.technicalTerms || {},
            fieldOfStudy: detectField(text),
            difficultyLevel: assessDifficulty(text)
        }
    } catch (error: any) {
        console.error('❌ ScholarMind LLM analysis failed:', error?.message)
        return null
    }
}

// ==================== LOCAL FALLBACK ANALYSIS ====================

/**
 * If LLM is unavailable, perform a basic keyword-based analysis.
 */
function localAnalysis(text: string, title: string): PaperAnalysis {
    const abstract = extractAbstract(text)
    const field = detectField(text)
    const difficulty = assessDifficulty(text)

    // Extract key terms
    const technicalTerms: Record<string, string> = {}
    const termPatterns: [RegExp, string][] = [
        [/\btransformer\b/i, 'A neural network architecture that processes all input data simultaneously rather than sequentially'],
        [/\bcnn\b/i, 'Convolutional Neural Network — a type of AI that excels at analyzing images'],
        [/\brnn\b/i, 'Recurrent Neural Network — AI that processes sequential data like text or time series'],
        [/\blstm\b/i, 'Long Short-Term Memory — a type of RNN that can remember long-term patterns'],
        [/\bgan\b/i, 'Generative Adversarial Network — two AIs that compete to create realistic data'],
        [/\bbenchmark\b/i, 'A standard test used to compare performance of different methods'],
        [/\baccuracy\b/i, 'How often the model gets the right answer'],
        [/\bf1[- ]score\b/i, 'A balanced measure of how precise and complete the predictions are'],
        [/\bsupervised\b/i, 'Learning from labeled examples (like learning from a textbook with answers)'],
        [/\bunsupervised\b/i, 'Learning without labels (like discovering patterns on your own)'],
        [/\breinforcement learning\b/i, 'Learning by trial and error, getting rewards for good decisions'],
        [/\biot\b/i, 'Internet of Things — everyday devices connected to the internet'],
        [/\bedge computing\b/i, 'Processing data near where it is generated instead of in a distant cloud'],
        [/\bfine[- ]tun(e|ing)\b/i, 'Taking a pre-trained AI model and customizing it for a specific task'],
        [/\bpre[- ]train(ed|ing)\b/i, 'An AI model that has already learned general knowledge from large datasets'],
        [/\bembedding\b/i, 'Converting text/data into numbers that capture meaning and relationships'],
        [/\battention mechanism\b/i, 'A technique that helps AI focus on the most important parts of input data'],
        [/\blatent space\b/i, 'A compressed, abstract representation of data that captures its essential features'],
        [/\bstate[- ]of[- ]the[- ]art\b/i, 'The current best performance on a given task'],
    ]

    for (const [pattern, definition] of termPatterns) {
        const match = text.match(pattern)
        if (match) {
            technicalTerms[match[0]] = definition
        }
    }

    return {
        title,
        plainExplanation: abstract
            ? `This paper "${title}" is in the field of ${field}. ${abstract.substring(0, 300)}...`
            : `This paper "${title}" appears to be a research study in the field of ${field}. Paste the full abstract for a better analysis.`,
        keyContributions: ['Paste the full paper text to extract key contributions'],
        limitations: ['Full analysis requires the complete paper content'],
        realWorldApplications: [`Potential applications in ${field}`],
        technicalTerms,
        fieldOfStudy: field,
        difficultyLevel: difficulty
    }
}

// ==================== RESPONSE FORMATTER ====================

function formatScholarResponse(analysis: PaperAnalysis, cached: boolean): string {
    const parts: string[] = [
        'ScholarMind - Paper Analysis',
        '',
        `Title: ${analysis.title}`,
        `Field: ${analysis.fieldOfStudy}`,
        `Difficulty: ${analysis.difficultyLevel}`,
        cached ? '(Cached analysis)' : '',
        '',
        'In Plain English:',
        analysis.plainExplanation,
        '',
    ]

    // Key Contributions
    if (analysis.keyContributions.length > 0) {
        parts.push('Key Contributions:')
        analysis.keyContributions.forEach((c, i) => {
            parts.push(`  ${i + 1}. ${c}`)
        })
    } else {
        parts.push('No specific contributions identified. Try providing more paper text.')
    }
    parts.push('')

    // Real-World Applications
    if (analysis.realWorldApplications.length > 0) {
        parts.push('Real-World Applications:')
        analysis.realWorldApplications.forEach((a, i) => {
            parts.push(`  ${i + 1}. ${a}`)
        })
    } else {
        parts.push('No specific applications identified.')
    }
    parts.push('')

    // Limitations
    if (analysis.limitations.length > 0) {
        parts.push('Limitations:')
        analysis.limitations.forEach((l, i) => {
            parts.push(`  ${i + 1}. ${l}`)
        })
    } else {
        parts.push('No specific limitations identified.')
    }

    // Technical Term Glossary
    const terms = Object.entries(analysis.technicalTerms)
    if (terms.length > 0) {
        parts.push('')
        parts.push('Glossary:')
        for (const [term, definition] of terms) {
            parts.push(`  ${term}: ${definition}`)
        }
    }

    parts.push('')
    parts.push('ScholarMind - Making research accessible to everyone.')

    return parts.filter(Boolean).join('\n')
}

// ==================== QUERY CLEANER ====================

function cleanScholarQuery(message: string): string {
    return message
        .replace(/\b(scholar\s*mind|research agent|paper simplifier|paper agent)\b/gi, '')
        .replace(/\b(can you |please |could you )?(simplify|explain|analyze|analyse|break ?down|summarize)\b/gi, '')
        .replace(/\b(this|the) (paper|study|research|article)\b/gi, '')
        .trim()
        .replace(/\s+/g, ' ')
}

// ==================== GENERAL RESEARCH QUESTION HANDLER ====================

const GENERAL_RESEARCH_PROMPT = `You are ScholarMind, an AI research explainer. The user is asking a general research or technical question (NOT pasting a paper).
You MUST respond ONLY with a JSON object (no markdown, no code fences).

JSON format:
{
  "title": "Short topic title (3-6 words)",
  "explanation": "A clear 3-5 sentence explanation in plain English. Use analogies. Imagine explaining to a curious teenager.",
  "keyConcepts": [
    {"term": "concept name", "definition": "1-2 sentence simple explanation"},
    ...
  ],
  "realWorldExamples": ["example 1", "example 2", "example 3"],
  "furtherReading": ["topic/paper suggestion 1", "topic/paper suggestion 2"]
}

Rules:
- Use SIMPLE language, avoid jargon
- Give REAL examples and facts
- keyConcepts should have 3-5 items
- Each definition must be understandable without prior knowledge`

async function handleGeneralResearchQuestion(message: string): Promise<ScholarResult> {
    const startTime = Date.now()
    const cotSteps: string[] = ['general_research_question']
    const sources: string[] = []

    try {
        const llmResponse = await generateWithProvider(message, {
            maxTokens: 2048,
            temperature: 0.5,
            systemPrompt: GENERAL_RESEARCH_PROMPT
        })

        const responseText = llmResponse.text.trim()
        let jsonStr = responseText
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) jsonStr = jsonMatch[0]

        const parsed = JSON.parse(jsonStr)

        const title = parsed.title || 'Research Topic'
        const explanation = parsed.explanation || 'Unable to generate explanation.'
        const keyConcepts: any[] = parsed.keyConcepts || []
        const realWorldExamples: string[] = parsed.realWorldExamples || []
        const furtherReading: string[] = parsed.furtherReading || []

        const parts: string[] = [
            `ScholarMind - ${title}`,
            '',
            'Explanation:',
            explanation,
            '',
        ]

        if (keyConcepts.length > 0) {
            parts.push('Key Concepts:')
            keyConcepts.forEach((c: any) => {
                parts.push(`  ${c.term}: ${c.definition}`)
            })
            parts.push('')
        }

        if (realWorldExamples.length > 0) {
            parts.push('Real-World Examples:')
            realWorldExamples.forEach((ex: string, i: number) => {
                parts.push(`  ${i + 1}. ${ex}`)
            })
            parts.push('')
        }

        if (furtherReading.length > 0) {
            parts.push('Further Reading:')
            furtherReading.forEach((r: string) => {
                parts.push(`  - ${r}`)
            })
            parts.push('')
        }

        parts.push('ScholarMind - Making research accessible to everyone.')

        cotSteps.push('llm_general:success')
        cotSteps.push(`response_time:${Date.now() - startTime}ms`)
        sources.push('llm_analysis')

        const result: ScholarResult = {
            response: parts.join('\n'),
            cotSteps,
            sources,
            cached: false
        }
        setCachedResult(message, result)
        return result

    } catch (error: any) {
        console.error('❌ ScholarMind general question LLM error:', error?.message)
        cotSteps.push('llm_general:failed')

        // Fallback response
        return {
            response: [
                'ScholarMind',
                '',
                'I would love to explain that! Unfortunately my LLM is temporarily unavailable.',
                '',
                'In the meantime, you can:',
                '  1. Paste a research paper abstract and I will analyze it locally',
                '  2. Try again in a moment for AI-powered explanations',
                '',
                'ScholarMind - Making research accessible to everyone.'
            ].join('\n'),
            cotSteps,
            sources: [],
            cached: false
        }
    }
}

// ==================== MAIN HANDLER ====================

export async function handleResearchQuery(
    message: string,
    userId: string = 'anonymous'
): Promise<ScholarResult> {
    const startTime = Date.now()
    const cotSteps: string[] = []
    const sources: string[] = []

    const cleanedText = cleanScholarQuery(message)
    cotSteps.push(`scholar_input_length:${cleanedText.length}`)
    console.log(`📚 ScholarMind — input length: ${cleanedText.length} chars`)

    // Check cache
    const cached = getCachedResult(cleanedText)
    if (cached) {
        console.log('✅ ScholarMind cache hit')
        cotSteps.push('cache:hit')
        return cached
    }
    cotSteps.push('cache:miss')

    // VERY short queries (< 15 chars like just "research") — show help
    if (cleanedText.length < 15) {
        const helpResponse = [
            'ScholarMind',
            '',
            'I can help with:',
            '  1. Analyze a paper - Paste abstract text',
            '  2. Explain a concept - Ask "How does a transformer work?"',
            '  3. Technical deep-dive - Ask "What is attention mechanism?"',
            '',
            'ScholarMind - Making research accessible to everyone.'
        ].join('\n')

        return {
            response: helpResponse,
            cotSteps: [...cotSteps, 'help_shown'],
            sources: [],
            cached: false
        }
    }

    // Short/medium queries (< 200 chars, no paper markers) — treat as general research question
    const markerCount = PAPER_CONTENT_MARKERS.filter(p => p.test(cleanedText.toLowerCase())).length
    if (cleanedText.length < 200 && markerCount < 2) {
        cotSteps.push('general_research_question')
        console.log('📚 ScholarMind — routing to general research question handler')
        return handleGeneralResearchQuestion(message)
    }

    // Long text with paper markers — treat as pasted paper
    const title = extractTitle(cleanedText)
    cotSteps.push(`title:"${title.substring(0, 50)}"`)

    const field = detectField(cleanedText)
    cotSteps.push(`field:${field}`)

    let analysis: PaperAnalysis | null = null

    // Try LLM analysis
    if (cleanedText.length > 100) {
        cotSteps.push('attempting_llm_analysis')
        analysis = await analyzeWithLLM(cleanedText, title)
        if (analysis) {
            cotSteps.push('llm_analysis:success')
            sources.push('llm_analysis')
        } else {
            cotSteps.push('llm_analysis:failed')
        }
    }

    // Fallback to local analysis
    if (!analysis) {
        cotSteps.push('local_analysis')
        analysis = localAnalysis(cleanedText, title)
        sources.push('local_analysis')
    }

    // Format response
    const response = formatScholarResponse(analysis, false)
    cotSteps.push(`response_time:${Date.now() - startTime}ms`)

    const result: ScholarResult = {
        response,
        analysis,
        cotSteps,
        sources,
        cached: false
    }

    setCachedResult(cleanedText, result)
    cotSteps.push('cached:true')

    return result
}

// ==================== STATISTICS ====================

interface ScholarMindStats {
    totalQueries: number
    llmAnalyses: number
    localAnalyses: number
    cacheSize: number
}

let queryCount = 0
let llmCount = 0
let localCount = 0

export function recordScholarQuery(usedLLM: boolean): void {
    queryCount++
    if (usedLLM) llmCount++
    else localCount++
}

export function getScholarMindStats(): ScholarMindStats {
    return {
        totalQueries: queryCount,
        llmAnalyses: llmCount,
        localAnalyses: localCount,
        cacheSize: scholarCache.size
    }
}

// ==================== EXPORT ====================

export default {
    isResearchPaperIntent,
    handleResearchQuery,
    recordScholarQuery,
    getScholarMindStats
}
