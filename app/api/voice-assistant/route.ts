import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { generateWithProvider, isProviderConfigured } from './llm_provider'
import { generateEmbedding } from './embeddings'
import { searchTrainedDataLegacy } from './json_search'
import { searchMedical } from './medicalsearch'
import type { Pinecone } from "@pinecone-database/pinecone"
import axios from "axios"
import crypto from "crypto"

// ==================== TYPE DEFINITIONS ====================

interface Capabilities {
  systemIntegration: boolean
  webSearch: boolean
  conversationalAI: boolean
  aiPowered: boolean
  realTimeActions: boolean
  chainOfThought: boolean
  ragEnabled: boolean
}

interface ConversationSession {
  sessionId: string
  userId: string
  startTime: Date
  lastActivityTime: Date
  messageCount: number
  totalTokens: number
  conversationHistory: ConversationEntry[]
  metadata: Record<string, any>
}

interface RateLimitData {
  requestCount: number
  tokens: number
  resetTime: number
  blocked: boolean
}

interface ConversationEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sentiment?: string
  processed?: boolean
  topics?: string[]
  importance?: number
}

interface UserData {
  userName: string | null
  userMood: string
  interests: string[]
  conversationHistory: ConversationEntry[]
  lastSearchQuery: string | null
  systemOS: string
  preferences?: Record<string, any>
  history?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
  learningProfile: {
    preferredTopics: string[]
    responseStyle: 'concise' | 'detailed' | 'conversational'
    expertiseLevel: Record<string, 'beginner' | 'intermediate' | 'advanced'>
  }
}

interface ConversationContext {
  userName: string | null
  userMood: string
  interests: string[]
  systemOS: string
  conversationLength: number
  lastSearchQuery: string | null
  lastMessage?: string
  lastAction?: string
  conversationHistory: ConversationEntry[]
  history?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
  preferences: Record<string, any>
  sessionStartTime: Date
  topicContinuity: string[]
}

interface KnowledgeEntry {
  id: string
  content: string
  category: string
  timestamp: Date
  relevanceScore?: number
  embedding?: number[]
  tags: string[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  accessCount: number
  lastAccessed: Date
}

interface RAGResult {
  entries: KnowledgeEntry[]
  totalRelevance: number
  categories: string[]
  searchQuery: string
  processingTime: number
}

interface ChainOfThoughtStep {
  step: number
  thought: string
  action?: string
  result?: string
  confidence: number
}

interface ChainOfThoughtProcess {
  steps: ChainOfThoughtStep[]
  finalReasoning: string
  confidence: number
}

interface ApiResponse {
  success: boolean
  response: string | ApiResponse
  capabilities: Capabilities
  error?: string
  suggestion?: string
  timestamp?: string
  mode?: string
  source?: string
  context?: {
    userName: string | null
    userMood: string
    interests: string[]
    conversationLength: number
    systemOS: string
    lastSearchQuery: string | null
  }
  metadata?: {
    model?: string
    responseTime?: number
    reasoning?: string
    sources?: string[]
    ragResults?: number
    cotSteps?: string[]
    confidence?: number
    provider?: string
    sessionId?: string
    messageCount?: number
    totalTokensUsed?: number
    rateLimitReset?: number
    cacheHit?: boolean
  }
}

// ==================== GLOBAL STATE ====================

declare global {
  var userData: UserData
  var conversationContext: ConversationContext
  var message: string | undefined
  var voiceSessionStorage: Map<string, ConversationSession>
  var apiRateLimiter: Map<string, RateLimitData>
  var responseCache: Map<string, { response: ApiResponse; timestamp: number }>
}

const defaultCapabilities: Capabilities = {
  systemIntegration: false,
  webSearch: true,
  conversationalAI: true,
  aiPowered: true,
  realTimeActions: true,
  chainOfThought: true,
  ragEnabled: true
}

// Initialize global storage
if (!global.voiceSessionStorage) {
  global.voiceSessionStorage = new Map()
}
if (!global.apiRateLimiter) {
  global.apiRateLimiter = new Map()
}
if (!global.responseCache) {
  global.responseCache = new Map()
}

// ==================== CONFIGURATION ====================

const CONFIG = {
  RATE_LIMIT_WINDOW: 60 * 1000,
  MAX_REQUESTS_PER_MINUTE: 30,
  MAX_TOKENS_PER_MINUTE: 10000,
  SESSION_TIMEOUT: 30 * 60 * 1000,
  CACHE_TTL: 10 * 1000, // 10 seconds - short cache for fresh Llama responses
  MAX_MESSAGE_LENGTH: 1000,
  MAX_CONTEXT_HISTORY: 10,
  RAG_TOP_K: 8,
  LLM_MAX_TOKENS: 1500,  // Increased from 800 to allow comprehensive responses
  LLM_TEMPERATURE: 0.7,   // Increased from 0.2 for more natural, conversational responses
  WEB_SEARCH_TIMEOUT: 8000,
  MEDICAL_API_TIMEOUT: 10000,
  MAX_RAG_RETRY_ATTEMPTS: 3
}

// ==================== INITIALIZATION ====================

if (!global.userData) {
  global.userData = {
    userName: null,
    userMood: 'neutral',
    interests: [],
    conversationHistory: [],
    lastSearchQuery: null,
    systemOS: process.platform,
    preferences: {},
    history: [],
    learningProfile: {
      preferredTopics: [],
      responseStyle: 'conversational',
      expertiseLevel: {}
    }
  }
}

if (!global.conversationContext) {
  global.conversationContext = {
    userName: global.userData.userName,
    userMood: global.userData.userMood || 'neutral',
    interests: [...(global.userData.interests || [])],
    systemOS: global.userData.systemOS || process.platform,
    lastSearchQuery: global.userData.lastSearchQuery || null,
    lastMessage: '',
    lastAction: '',
    conversationHistory: [...(global.userData.conversationHistory || [])],
    preferences: { ...(global.userData.preferences || {}) },
    history: [...(global.userData.history || [])],
    conversationLength: 0,
    sessionStartTime: new Date(),
    topicContinuity: []
  }
}

const conversationContext = global.conversationContext

// ==================== UTILITY FUNCTIONS ====================

function createDefaultResponse(overrides: Partial<ApiResponse> = {}): ApiResponse {
  const defaultResponse: ApiResponse = {
    success: true,
    response: '',
    capabilities: { ...defaultCapabilities },
    timestamp: new Date().toISOString(),
    mode: 'enhanced',
    context: {
      userName: global.conversationContext?.userName ?? null,
      userMood: global.conversationContext?.userMood || 'neutral',
      interests: [...(global.conversationContext?.interests || [])],
      conversationLength: global.conversationContext?.conversationLength || 0,
      systemOS: global.conversationContext?.systemOS || process.platform,
      lastSearchQuery: global.conversationContext?.lastSearchQuery || null
    }
  }

  return {
    ...defaultResponse,
    ...overrides,
    capabilities: {
      ...defaultResponse.capabilities,
      ...(overrides.capabilities || {})
    },
    context: overrides.context ? {
      ...defaultResponse.context,
      ...overrides.context
    } : defaultResponse.context
  }
}

function generateSessionId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generateCacheKey(message: string, userId: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(`${userId}:${message.toLowerCase().trim()}`)
  return hash.digest('hex')
}

// ==================== SESSION MANAGEMENT ====================

function getOrCreateSession(userId: string): ConversationSession {
  const existing = global.voiceSessionStorage?.get(userId)
  if (existing && Date.now() - existing.lastActivityTime.getTime() < CONFIG.SESSION_TIMEOUT) {
    existing.lastActivityTime = new Date()
    return existing
  }

  const session: ConversationSession = {
    sessionId: generateSessionId(),
    userId,
    startTime: new Date(),
    lastActivityTime: new Date(),
    messageCount: 0,
    totalTokens: 0,
    conversationHistory: [],
    metadata: {}
  }

  global.voiceSessionStorage?.set(userId, session)
  return session
}

function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [userId, session] of global.voiceSessionStorage?.entries() || []) {
    if (now - session.lastActivityTime.getTime() > CONFIG.SESSION_TIMEOUT) {
      global.voiceSessionStorage?.delete(userId)
      console.log(`🧹 Cleaned up expired session for user: ${userId}`)
    }
  }
}

setInterval(cleanupExpiredSessions, 10 * 60 * 1000)

// ==================== RATE LIMITING ====================

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  let limiter = global.apiRateLimiter?.get(userId)

  if (!limiter || now > limiter.resetTime) {
    limiter = {
      requestCount: 0,
      tokens: 0,
      resetTime: now + CONFIG.RATE_LIMIT_WINDOW,
      blocked: false
    }
    global.apiRateLimiter?.set(userId, limiter)
  }

  const allowed = limiter.requestCount < CONFIG.MAX_REQUESTS_PER_MINUTE &&
    limiter.tokens < CONFIG.MAX_TOKENS_PER_MINUTE &&
    !limiter.blocked
  const remaining = Math.max(0, CONFIG.MAX_REQUESTS_PER_MINUTE - limiter.requestCount)
  const resetIn = Math.max(0, limiter.resetTime - now)

  return { allowed, remaining, resetIn }
}

function recordRequest(userId: string, tokens: number): void {
  let limiter = global.apiRateLimiter?.get(userId)
  if (limiter) {
    limiter.requestCount++
    limiter.tokens += tokens
  }
}

function blockUser(userId: string, durationMs: number = 60000): void {
  let limiter = global.apiRateLimiter?.get(userId)
  if (limiter) {
    limiter.blocked = true
    setTimeout(() => {
      const current = global.apiRateLimiter?.get(userId)
      if (current) current.blocked = false
    }, durationMs)
  }
}

// ==================== CACHING ====================

function getCachedResponse(cacheKey: string): ApiResponse | null {
  const cached = global.responseCache?.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_TTL) {
    console.log('✅ Cache hit!')
    return { ...cached.response, metadata: { ...cached.response.metadata, cacheHit: true } }
  }
  if (cached) {
    global.responseCache?.delete(cacheKey)
  }
  return null
}

function setCachedResponse(cacheKey: string, response: ApiResponse): void {
  global.responseCache?.set(cacheKey, {
    response: { ...response },
    timestamp: Date.now()
  })

  if (global.responseCache && global.responseCache.size > 100) {
    const firstKey = global.responseCache.keys().next().value
    if (firstKey) {
      global.responseCache.delete(firstKey)
    }
  }
}

// ==================== PINECONE RAG SYSTEM ====================

async function initializePinecone(): Promise<any> {
  const apiKey = process.env.PINECONE_API_KEY
  if (!apiKey) return null

  try {
    const pineconePkg: any = await import('@pinecone-database/pinecone')
    const PineconeClientConstructor = pineconePkg.Pinecone || pineconePkg.PineconeClient ||
      pineconePkg.default?.Pinecone || pineconePkg.default?.PineconeClient ||
      pineconePkg.default

    if (!PineconeClientConstructor) {
      console.warn('⚠️ Pinecone package loaded but no constructor found')
      return null
    }

    const pine = new PineconeClientConstructor({ apiKey })

    // Note: Newer Pinecone SDK versions don't require init() - constructor handles initialization
    if (typeof pine.init === 'function') {
      await pine.init({ apiKey })
    } else if (typeof pine.initialize === 'function') {
      await pine.initialize({ apiKey })
    }

    return pine
  } catch (error) {
    console.error('❌ Pinecone initialization failed:', error)
    return null
  }
}

async function addToKnowledgeBase(
  content: string,
  category: string,
  tags: string[] = [],
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  userId: string = 'anonymous'
): Promise<void> {
  try {
    const pine = await initializePinecone()
    if (!pine) return

    const indexName = process.env.PINECONE_INDEX || 'voice-assistant-knowledge'
    const idx = typeof pine.Index === 'function' ? pine.Index(indexName) :
      (typeof pine.index === 'function' ? pine.index(indexName) : null)

    if (!idx) {
      console.warn('⚠️ Pinecone index accessor not found')
      return
    }

    const embedding = await generateEmbedding(content)
    const id = `knowledge_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const vectors = [{
      id,
      values: embedding,
      metadata: {
        content,
        category,
        tags,
        priority,
        timestamp: new Date().toISOString(),
        userId: userId
      }
    }]

    try {
      await idx.upsert({ vectors })
      console.log(`✅ Added to knowledge base for user ${userId}: ${id}`)
    } catch (upsertErr) {
      try {
        await idx.upsert({ upsertRequest: { vectors } })
        console.log(`✅ Added to knowledge base (legacy) for user ${userId}: ${id}`)
      } catch (err2) {
        console.warn('⚠️ Pinecone upsert failed:', (err2 as any)?.message)
      }
    }
  } catch (e) {
    console.warn('⚠️ addToKnowledgeBase skipped:', (e as any)?.message)
  }
}

async function enhancedRAGSearch(
  query: string,
  limit: number = CONFIG.RAG_TOP_K,
  userId: string = 'anonymous'
): Promise<RAGResult> {
  const startTime = Date.now()

  try {
    const pine = await initializePinecone()
    if (!pine) {
      console.warn('⚠️ Pinecone not configured; skipping RAG search')
      return {
        entries: [],
        totalRelevance: 0,
        categories: [],
        searchQuery: query,
        processingTime: Date.now() - startTime
      }
    }

    const indexName = process.env.PINECONE_INDEX || 'voice-assistant-knowledge'
    const idx = typeof pine.Index === 'function' ? pine.Index(indexName) :
      (typeof pine.index === 'function' ? pine.index(indexName) : null)

    if (!idx) {
      console.warn('⚠️ Pinecone index not accessible')
      return {
        entries: [],
        totalRelevance: 0,
        categories: [],
        searchQuery: query,
        processingTime: Date.now() - startTime
      }
    }

    const queryEmbedding = await generateEmbedding(query)
    let results: any = null
    let attempts = 0

    while ((!results || !results.matches || results.matches.length === 0) && attempts < CONFIG.MAX_RAG_RETRY_ATTEMPTS) {
      attempts++
      const currentLimit = limit + (attempts - 1) * 2

      try {
        results = await idx.query({
          vector: queryEmbedding,
          topK: currentLimit,
          includeMetadata: true,
          filter: {
            userId: { $eq: userId }
          }
        })
        if (results?.matches && results.matches.length > 0) break
      } catch (errQuery) {
        try {
          results = await idx.query({
            queryRequest: {
              vector: queryEmbedding,
              topK: currentLimit,
              includeMetadata: true,
              filter: {
                userId: { $eq: userId }
              }
            }
          })
          if (results?.matches && results.matches.length > 0) break
        } catch (err2) {
          console.warn(`⚠️ Pinecone query attempt ${attempts}/${CONFIG.MAX_RAG_RETRY_ATTEMPTS} failed`)
          if (attempts >= CONFIG.MAX_RAG_RETRY_ATTEMPTS) {
            console.error('❌ All Pinecone query attempts failed')
            return {
              entries: [],
              totalRelevance: 0,
              categories: [],
              searchQuery: query,
              processingTime: Date.now() - startTime
            }
          }
        }
      }
    }

    const matches = results?.matches || []
    console.log(`📚 RAG search retrieved ${matches.length} results for user ${userId}: "${query}"`)

    const entries: KnowledgeEntry[] = matches
      .filter((match: any) => match && match.metadata && match.metadata.content)
      .map((match: any) => ({
        id: match.id,
        content: match.metadata?.content || '',
        category: match.metadata?.category || 'unknown',
        timestamp: match.metadata?.timestamp ? new Date(match.metadata.timestamp) : new Date(),
        tags: match.metadata?.tags || [],
        priority: match.metadata?.priority || 'medium',
        relevanceScore: match.score || 0,
        accessCount: 0,
        lastAccessed: new Date(),
        embedding: undefined
      }))
      .slice(0, limit)

    const totalRelevance = entries.reduce((sum, entry) => sum + (entry.relevanceScore || 0), 0)
    const categories = [...new Set(entries.map(entry => entry.category))]

    console.log(`✅ RAG search completed for user ${userId}: ${entries.length} entries, relevance: ${totalRelevance.toFixed(2)}`)

    return {
      entries,
      totalRelevance,
      categories,
      searchQuery: query,
      processingTime: Date.now() - startTime
    }
  } catch (e) {
    console.warn('⚠️ enhancedRAGSearch failed:', (e as any)?.message)
    return {
      entries: [],
      totalRelevance: 0,
      categories: [],
      searchQuery: query,
      processingTime: Date.now() - startTime
    }
  }
}

// ==================== CHAIN OF THOUGHT HELPERS ====================

function extractEntities(message: string): string[] {
  const entities: string[] = []
  const lowerMessage = message.toLowerCase()

  // Extract named entities (capitalized words)
  const capitalizedWords = message.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
  entities.push(...capitalizedWords)

  // Extract numbers and quantities
  const numbers = message.match(/\b\d+(?:\.\d+)?(?:\s*(?:million|billion|thousand|hundred|percent|%))?\b/g) || []
  entities.push(...numbers)

  // Extract dates and times
  const dates = message.match(/\b(?:today|tomorrow|yesterday|\d{4}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/gi) || []
  entities.push(...dates)

  // Extract technical terms
  const techTerms = ['AI', 'ML', 'API', 'CPU', 'GPU', 'RAM', 'SSD', 'HDD', 'USB', 'HTTP', 'HTTPS', 'DNS', 'IP']
  techTerms.forEach(term => {
    if (new RegExp(`\\b${term}\\b`, 'i').test(message)) {
      entities.push(term)
    }
  })

  return [...new Set(entities)].slice(0, 10) // Limit to 10 unique entities
}

function analyzeQueryComplexity(message: string, intent: string): {
  level: 'simple' | 'moderate' | 'complex' | 'expert'
  requirements: string[]
} {
  const requirements: string[] = []
  let complexityScore = 0

  // Word count complexity
  const wordCount = message.split(/\s+/).length
  if (wordCount > 20) complexityScore += 2
  else if (wordCount > 10) complexityScore += 1

  // Technical terms
  if (/\b(algorithm|quantum|neural|blockchain|cryptocurrency|machine learning|deep learning|API|database|server|cloud|encryption)\b/i.test(message)) {
    complexityScore += 2
    requirements.push('technical knowledge')
  }

  // Multi-part questions
  if (/\band\b.*\?|\?.*\band\b/i.test(message) || message.split('?').length > 2) {
    complexityScore += 2
    requirements.push('multi-part answer')
  }

  // Comparison or analysis
  if (/compare|versus|difference|better|worse|pros|cons|advantages|disadvantages/i.test(message)) {
    complexityScore += 1
    requirements.push('comparison analysis')
  }

  // Explanation or reasoning
  if (/why|how|explain|describe|elaborate|detail/i.test(message)) {
    complexityScore += 1
    requirements.push('detailed explanation')
  }

  // Mathematical or computational
  if (/calculate|compute|solve|equation|formula|algorithm/i.test(message)) {
    complexityScore += 2
    requirements.push('calculation')
  }

  // Determine level
  let level: 'simple' | 'moderate' | 'complex' | 'expert' = 'simple'
  if (complexityScore >= 6) level = 'expert'
  else if (complexityScore >= 4) level = 'complex'
  else if (complexityScore >= 2) level = 'moderate'

  if (requirements.length === 0) requirements.push('basic response')

  return { level, requirements }
}

function detectMultiHopReasoning(message: string, ragResults: RAGResult): {
  required: boolean
  depth: number
  intermediateSteps: string[]
} {
  const intermediateSteps: string[] = []
  let depth = 1

  // Check for causal chains (A causes B causes C)
  if (/because|therefore|thus|hence|consequently|as a result|leads to|causes/i.test(message)) {
    depth++
    intermediateSteps.push('causal inference')
  }

  // Check for conditional reasoning (if-then)
  if (/if|then|when|unless|provided that|assuming/i.test(message)) {
    depth++
    intermediateSteps.push('conditional logic')
  }

  // Check for comparison requiring multiple lookups
  if (/compare|versus|difference between/i.test(message)) {
    depth++
    intermediateSteps.push('multi-entity comparison')
  }

  // Check for temporal reasoning (before/after)
  if (/before|after|first|then|next|finally|sequence|order/i.test(message)) {
    depth++
    intermediateSteps.push('temporal reasoning')
  }

  // Check for aggregation (combining multiple facts)
  if (/all|every|total|sum|average|overall|combined/i.test(message)) {
    depth++
    intermediateSteps.push('aggregation')
  }

  // Check if RAG results span multiple categories (requires synthesis)
  if (ragResults.categories.length > 2) {
    depth++
    intermediateSteps.push('cross-domain synthesis')
  }

  const required = depth > 1

  return { required, depth, intermediateSteps }
}

function predictResponseQuality(
  ragResults: RAGResult,
  complexity: { level: string; requirements: string[] },
  context: ConversationContext
): {
  score: number
  confidence: number
  gaps: string[]
} {
  let score = 5 // Base score
  const gaps: string[] = []

  // RAG quality contribution
  const avgRelevance = ragResults.totalRelevance / Math.max(ragResults.entries.length, 1)
  if (avgRelevance > 0.8) score += 2
  else if (avgRelevance > 0.5) score += 1
  else if (avgRelevance < 0.3) {
    score -= 1
    gaps.push('low knowledge relevance')
  }

  // Knowledge coverage
  if (ragResults.entries.length === 0) {
    score -= 2
    gaps.push('no prior knowledge')
  } else if (ragResults.entries.length < 3) {
    score -= 1
    gaps.push('limited knowledge')
  } else if (ragResults.entries.length >= 5) {
    score += 1
  }

  // Complexity match
  if (complexity.level === 'expert' && ragResults.entries.length < 5) {
    score -= 1
    gaps.push('insufficient depth for expert query')
  }

  // Context continuity
  if (context.conversationLength > 5 && context.topicContinuity.length > 0) {
    score += 1 // Good conversation flow
  }

  // Ensure score is between 1-10
  score = Math.max(1, Math.min(10, score))

  // Calculate confidence based on available information
  let confidence = 0.5
  if (ragResults.entries.length > 0) confidence += 0.2
  if (avgRelevance > 0.6) confidence += 0.2
  if (gaps.length === 0) confidence += 0.1

  confidence = Math.min(0.95, confidence)

  return { score, confidence, gaps }
}

// ==================== CHAIN OF THOUGHT ====================

function executeChainOfThought(
  userMessage: string,
  context: ConversationContext,
  ragResults: RAGResult
): ChainOfThoughtProcess {
  const steps: ChainOfThoughtStep[] = []

  // Step 1: Intent Analysis
  const intent = analyzeIntent(userMessage)
  steps.push({
    step: 1,
    thought: "Analyzing user intent and identifying key components of the query",
    action: "parse_intent",
    result: `Query: "${userMessage}" - Intent: ${intent}`,
    confidence: 0.8
  })

  // Step 2: Entity Extraction
  const entities = extractEntities(userMessage)
  steps.push({
    step: 2,
    thought: "Extracting key entities, topics, and concepts from the query",
    action: "extract_entities",
    result: `Entities: ${entities.join(', ') || 'None'} | Topics: ${extractTopics(userMessage).join(', ')}`,
    confidence: entities.length > 0 ? 0.85 : 0.6
  })

  // Step 3: Context Evaluation
  steps.push({
    step: 3,
    thought: "Evaluating conversation history, user preferences, and current context",
    action: "assess_context",
    result: `User: ${context.userName || 'Anonymous'}, Mood: ${context.userMood}, History: ${context.conversationLength} messages, Recent topics: ${context.topicContinuity.slice(-3).join(', ') || 'None'}`,
    confidence: 0.9
  })

  // Step 4: Knowledge Retrieval Analysis
  const ragQuality = ragResults.totalRelevance / Math.max(ragResults.entries.length, 1)
  steps.push({
    step: 4,
    thought: "Analyzing retrieved knowledge and determining relevance to user query",
    action: "analyze_rag",
    result: `Found ${ragResults.entries.length} relevant entries | Avg relevance: ${ragQuality.toFixed(2)} | Categories: ${ragResults.categories.join(', ') || 'None'}`,
    confidence: ragResults.totalRelevance > 5 ? 0.9 : 0.6
  })

  // Step 5: Complexity Analysis
  const complexity = analyzeQueryComplexity(userMessage, intent)
  steps.push({
    step: 5,
    thought: "Determining query complexity and required reasoning depth",
    action: "analyze_complexity",
    result: `Complexity: ${complexity.level} | Requires: ${complexity.requirements.join(', ')}`,
    confidence: 0.85
  })

  // Step 6: Information Needs Assessment
  const needsCurrentInfo = /current|latest|recent|today|now|news|update|2024|2025/i.test(userMessage)
  const needsCalculation = /calculate|compute|how many|how much|sum|total|average/i.test(userMessage)
  const needsComparison = /compare|versus|vs|difference|better|worse/i.test(userMessage)

  steps.push({
    step: 6,
    thought: "Determining specific information needs and data requirements",
    action: "check_info_needs",
    result: `Current info: ${needsCurrentInfo} | Calculation: ${needsCalculation} | Comparison: ${needsComparison}`,
    confidence: 0.95
  })

  // Step 7: Multi-hop Reasoning Detection
  const requiresMultiHop = detectMultiHopReasoning(userMessage, ragResults)
  steps.push({
    step: 7,
    thought: "Detecting if multi-hop reasoning or chain inference is required",
    action: "detect_multihop",
    result: `Multi-hop required: ${requiresMultiHop.required} | Reasoning chain depth: ${requiresMultiHop.depth} | Intermediate steps: ${requiresMultiHop.intermediateSteps.join(' → ')}`,
    confidence: requiresMultiHop.required ? 0.75 : 0.9
  })

  // Step 8: Fact Verification Needs
  const needsVerification = /is it true|fact check|verify|confirm|accurate/i.test(userMessage) ||
    intent === 'information_seeking'
  steps.push({
    step: 8,
    thought: "Assessing need for fact verification and source credibility",
    action: "verify_facts",
    result: `Verification needed: ${needsVerification} | RAG sources: ${ragResults.entries.length} | Web search: ${needsCurrentInfo}`,
    confidence: 0.8
  })

  // Step 9: Response Strategy Planning
  const strategy = determineResponseStrategy(userMessage, context, ragResults, needsCurrentInfo)
  steps.push({
    step: 9,
    thought: "Formulating optimal response strategy based on comprehensive analysis",
    action: "plan_response",
    result: `Strategy: ${strategy} | Length: ${complexity.level} | Sources: ${needsCurrentInfo ? 'RAG + Web' : 'RAG only'}`,
    confidence: 0.85
  })

  // Step 10: Quality Prediction
  const qualityPrediction = predictResponseQuality(ragResults, complexity, context)
  steps.push({
    step: 10,
    thought: "Predicting response quality and identifying potential gaps",
    action: "predict_quality",
    result: `Expected quality: ${qualityPrediction.score}/10 | Confidence: ${qualityPrediction.confidence} | Gaps: ${qualityPrediction.gaps.join(', ') || 'None'}`,
    confidence: qualityPrediction.confidence
  })

  const avgConfidence = steps.reduce((sum, step) => sum + step.confidence, 0) / steps.length

  return {
    steps,
    finalReasoning: generateFinalReasoning(steps, ragResults),
    confidence: avgConfidence
  }
}

function analyzeIntent(message: string): string {
  const lowerMessage = message.toLowerCase()

  if (/\b(what|how|why|when|where|who)\b/.test(lowerMessage)) return "information_seeking"
  if (/\b(help|assist|support)\b/.test(lowerMessage)) return "help_request"
  if (/\b(hello|hi|hey|greet)\b/.test(lowerMessage)) return "greeting"
  if (/\b(thank|thanks|appreciate)\b/.test(lowerMessage)) return "gratitude"
  if (/\b(bye|goodbye|exit|quit)\b/.test(lowerMessage)) return "farewell"
  if (/\b(news|current|latest|update)\b/.test(lowerMessage)) return "current_information"
  if (/\b(pain|hurt|sick|symptom|medical|health|doctor)\b/.test(lowerMessage)) return "medical_query"

  return "general_conversation"
}

function determineResponseStrategy(
  message: string,
  context: ConversationContext,
  ragResults: RAGResult,
  needsCurrentInfo: boolean
): string {
  if (needsCurrentInfo) return "web_search_then_synthesize"
  if (ragResults.totalRelevance > 8) return "knowledge_based_response"
  if (context.conversationLength < 3) return "introductory_approach"
  return "conversational_synthesis"
}

function generateFinalReasoning(steps: ChainOfThoughtStep[], ragResults: RAGResult): string {
  return `Based on ${steps.length}-step analysis: ${steps[steps.length - 1].result}. ` +
    `Knowledge base provided ${ragResults.entries.length} relevant sources. ` +
    `Confidence level: ${(steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length * 100).toFixed(1)}%`
}

// ==================== WEB SEARCH ====================

async function performEnhancedWebSearch(query: string, cotProcess: ChainOfThoughtProcess): Promise<string> {
  try {
    console.log('🔍 Enhanced web search initiated with CoT guidance')

    const enhancedQuery = cotProcess.steps.some(step =>
      typeof step.result === 'string' && step.result.includes('current_information')
    ) ? `${query} latest 2024` : query

    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(enhancedQuery)}&format=json&no_html=1&skip_disambig=1`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.WEB_SEARCH_TIMEOUT)

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VoiceAssistant/2.0' }
    })

    clearTimeout(timeoutId)

    if (!response.ok) throw new Error(`Search API failed: ${response.status}`)

    const data = await response.json()

    if (data.Abstract) {
      return `🌐 **Current Information:**\n${data.Abstract}\n\n📍 Source: ${data.AbstractURL || 'DuckDuckGo'}`
    } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topics = data.RelatedTopics
        .slice(0, 3)
        .map((topic: any) => `• ${topic.Text}`)
        .join('\n')
      return `🔍 **Related Information:**\n${topics}\n\n📍 Source: DuckDuckGo`
    }

    return `🔍 Search completed for "${query}" - Try a more specific query for detailed results.`
  } catch (error) {
    console.error('❌ Enhanced web search error:', error)
    return `⚠️ Search temporarily unavailable for "${query}". Please try again shortly.`
  }
}

// ==================== LLM INTEGRATION ====================

async function callEnhancedLlamaWithCoTAndRAG(
  userMessage: string,
  context: ConversationContext,
  userId: string = 'anonymous'
): Promise<{
  response: string
  reasoning: string
  sources: string[]
  ragResults: RAGResult
  cotProcess: ChainOfThoughtProcess
  confidence: number
  provider?: string
}> {
  console.log(`🧠 Starting Enhanced LLM processing with CoT and RAG for user ${userId}...`)

  const ragResults = await enhancedRAGSearch(userMessage, CONFIG.RAG_TOP_K, userId)
  console.log(`📚 RAG found ${ragResults.entries.length} relevant entries`)

  const cotProcess = executeChainOfThought(userMessage, context, ragResults)
  console.log(`🤔 CoT completed with ${cotProcess.steps.length} reasoning steps`)

  const needsCurrentInfo = cotProcess.steps.some(step =>
    typeof step.result === 'string' && (step.result.includes('current_information') || step.result.includes('web_search'))
  )

  let webSearchResults = ''
  if (needsCurrentInfo) {
    console.log('🌐 Initiating web search based on CoT analysis...')
    webSearchResults = await performEnhancedWebSearch(userMessage, cotProcess)
  }

  const cleanKnowledgeContext = ragResults.entries
    .slice(0, 5)
    .map((entry: any) => {
      let content = entry.content || ''
      content = content
        .replace(/^Q:\s*/gm, '')
        .replace(/^A:\s*/gm, '')
        .replace(/\[CONTEXT:.*?\]/g, '')
        .trim()
      return content.length > 0 ? content : null
    })
    .filter(Boolean)
    .map((content: any, idx: number) => `${idx + 1}. ${content}`)
    .join('\n\n')

  const cotSummary = `Reasoning: ${cotProcess.finalReasoning}`

  // Determine appropriate response length based on query type
  const queryType = analyzeIntent(userMessage)
  let lengthGuideline = ''

  if (['greeting', 'farewell', 'gratitude'].includes(queryType)) {
    lengthGuideline = 'CRITICAL: Keep response to 1-2 sentences maximum. Be warm but brief.'
  } else if (queryType === 'general_conversation' && userMessage.split(' ').length < 5) {
    lengthGuideline = 'Keep response concise: 2-3 sentences maximum.'
  } else if (['information_seeking', 'current_information', 'medical_query'].includes(queryType)) {
    lengthGuideline = 'Provide detailed, comprehensive response (3-5 paragraphs if needed).'
  } else {
    lengthGuideline = 'Keep response moderate: 3-4 sentences, expanding only if complexity requires it.'
  }

  const enhancedPrompt = `You are an advanced AI assistant using Chain of Thought reasoning and knowledge retrieval.

USER CONTEXT:
- Name: ${context.userName || 'Anonymous'}
- Mood: ${context.userMood}
- Conversation history length: ${context.conversationLength}
- Topics discussed: ${context.topicContinuity.slice(-3).join(', ') || 'None'}

RELEVANT KNOWLEDGE FROM PREVIOUS CONVERSATIONS:
${cleanKnowledgeContext || 'No prior knowledge available.'}

INTERNAL REASONING:
${cotSummary}

${webSearchResults ? `CURRENT INFORMATION:\n${webSearchResults}\n` : ''}

USER QUESTION: "${userMessage}"

RESPONSE LENGTH REQUIREMENT:
${lengthGuideline}

INSTRUCTIONS:
1. Provide a helpful, accurate, and conversational response
2. If the knowledge above is relevant, reference and build upon it naturally
3. Be engaging and personable - avoid robotic responses
4. STRICTLY follow the length requirement above - do not be overly verbose
5. If information might be incomplete, acknowledge it honestly
6. Match the user's expertise level and tone
7. Use markdown formatting for better readability when appropriate

Response:`

  console.log('🚀 Calling enhanced LLM provider...')

  try {
    if (isProviderConfigured()) {
      const aiResult = await generateWithProvider(enhancedPrompt, {
        maxTokens: CONFIG.LLM_MAX_TOKENS,
        temperature: CONFIG.LLM_TEMPERATURE,
        model: process.env.LLM_MODEL
      })

      const providerUsed = (aiResult && (aiResult as any).provider) || 'fallback'
      let text = (aiResult && (aiResult as any).text) ? (aiResult as any).text.trim() : ''

      const fillerPhrases = [
        'Okay!', 'Sure!', 'Unfortunately,', 'However,', 'I understand',
        'I appreciate', 'I realize', 'In summary,', 'To summarize,',
        'Based on the information provided'
      ]

      for (const phrase of fillerPhrases) {
        const regex = new RegExp(`^${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i')
        text = text.replace(regex, '')
      }

      text = text.trim()

      // Smart length enforcement based on query type
      const queryType = analyzeIntent(userMessage)
      let maxLength = 0

      if (['greeting', 'farewell', 'gratitude'].includes(queryType)) {
        maxLength = 150  // ~1-2 sentences
      } else if (queryType === 'general_conversation' && userMessage.split(' ').length < 5) {
        maxLength = 300  // ~2-3 sentences
      } else if (['information_seeking', 'current_information', 'medical_query'].includes(queryType)) {
        maxLength = 2000  // Allow detailed responses
      } else {
        maxLength = 600  // ~3-4 sentences
      }

      // Only truncate if significantly over limit (allow some flexibility)
      if (text.length > maxLength * 1.2) {
        // Find last complete sentence within limit
        const truncated = text.substring(0, maxLength)
        const lastPeriod = truncated.lastIndexOf('.')
        const lastQuestion = truncated.lastIndexOf('?')
        const lastExclamation = truncated.lastIndexOf('!')
        const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation)

        if (lastSentenceEnd > maxLength * 0.7) {
          text = text.substring(0, lastSentenceEnd + 1).trim()
        } else {
          text = truncated.trim() + '...'
        }
      }

      addToKnowledgeBase(
        `Q: ${userMessage}\nA: ${text}`,
        'conversation',
        ['user_interaction', context.userMood],
        'medium',
        userId
      ).catch(err => console.warn('⚠️ Failed to update knowledge base:', err))

      if (webSearchResults) {
        addToKnowledgeBase(
          webSearchResults,
          'current_info',
          ['web_search', 'current'],
          'high',
          userId
        ).catch(err => console.warn('⚠️ Failed to store web search results:', err))
      }

      return {
        response: text,
        reasoning: cotProcess.finalReasoning,
        sources: webSearchResults ? ['llm', 'rag', 'web_search'] : ['llm', 'rag'],
        ragResults,
        cotProcess,
        confidence: cotProcess.confidence,
        provider: providerUsed
      } as any
    }

    const fallbackText = `No LLM provider configured. Here's a synthesis based on retrieved knowledge:\n${cotProcess.finalReasoning}`
    return {
      response: fallbackText,
      reasoning: cotProcess.finalReasoning,
      sources: ['rag'],
      ragResults,
      cotProcess,
      confidence: cotProcess.confidence
    }
  } catch (e) {
    const rawMsg = (e as any)?.message ?? String(e ?? '')
    const providerRetryAfterSeconds = (e as any)?.retryAfter ?? (e as any)?.retryAfterSeconds ?? null
    const shortProviderMsg = providerRetryAfterSeconds
      ? `LLM provider rate-limited; retry in ~${Math.ceil(Number(providerRetryAfterSeconds))}s`
      : 'LLM provider temporarily unavailable'

    console.error('❌ Enhanced LLM provider failed; falling back to RAG+CoT response:', shortProviderMsg)

    let fallbackText: string
    let ragWasUsed = false

    if (ragResults && Array.isArray(ragResults.entries) && ragResults.entries.length > 0) {
      ragWasUsed = true
      const top = ragResults.entries.slice(0, 5)

      const extractedAnswers = top
        .map((e: any) => {
          let content = e.content || ''

          if (content.includes('5-step analysis') || content.includes('Confidence level:') || content.includes('enhanced_cot')) {
            return null
          }

          if (content.includes('Q:') && content.includes('A:')) {
            const aMatch = content.match(/A:\s*(.+?)(?:Q:|$)/i)
            if (aMatch) {
              content = aMatch[1].trim()
            }
          } else if (content.includes('Q:')) {
            const qIndex = content.lastIndexOf('Q:')
            content = content.substring(0, qIndex).trim()
          }

          content = content
            .replace(/^Q:\s*/gm, '')
            .replace(/^A:\s*/gm, '')
            .replace(/\[CONTEXT:.*?\]/g, '')
            .replace(/enhanced_cot_rag/g, '')
            .trim()

          return content.length > 10 ? content : null
        })
        .filter(Boolean)
        .slice(0, 2)

      if (extractedAnswers.length > 0) {
        const cleanedAnswers = extractedAnswers
          .map((ans: string) => {
            return ans
              .replace(/^(Okay!?\s*|Sure!?\s*|I can|Let me|Here's|Based on|Since we|Unfortunately,|However,)\s*/gi, '')
              .replace(/\s*(I apologize for that!?|Let me know|Feel free to|Just let me know).*/gi, '')
              .trim()
          })
          .filter((ans: string) => ans.length > 10)

        if (cleanedAnswers.length > 0) {
          fallbackText = cleanedAnswers[0]

          if (cleanedAnswers[0].length < 100 && cleanedAnswers.length > 1) {
            fallbackText += '\n\n' + cleanedAnswers[1]
          }
        } else {
          fallbackText = cotProcess.finalReasoning
        }
      } else {
        fallbackText = cotProcess.finalReasoning
      }
    } else {
      console.warn('⚠️ No RAG results available; using reasoning')
      fallbackText = cotProcess.finalReasoning
    }

    if (providerRetryAfterSeconds && fallbackText.length < 50) {
      fallbackText = `I'm currently experiencing high demand. ${fallbackText || 'Please try again in a moment.'}`
    }

    addToKnowledgeBase(
      `Q: ${userMessage}\nA: ${fallbackText}`,
      'conversation',
      ['fallback', 'provider_error'],
      'low',
      userId
    ).catch(err => console.warn('⚠️ Failed to record fallback interaction:', err))

    const usedSources = ['reasoning'] as string[]
    if (ragWasUsed && ragResults && Array.isArray(ragResults.entries) && ragResults.entries.length > 0) {
      usedSources.push('knowledge_base')
    }
    if (webSearchResults) usedSources.push('web_search')

    const result: any = {
      response: fallbackText,
      reasoning: cotProcess.finalReasoning,
      sources: usedSources,
      ragResults,
      cotProcess,
      confidence: ragWasUsed ? Math.max(0.7, cotProcess.confidence) : cotProcess.confidence,
      isRAGFallback: true
    }

    if (providerRetryAfterSeconds) {
      result.providerRetryAfterSeconds = Math.ceil(Number(providerRetryAfterSeconds))
    }
    result.providerErrorMessage = shortProviderMsg

    return result
  }
}

// ==================== SENTIMENT ANALYSIS ====================

function enhancedSentimentAnalysis(message: string): {
  sentiment: string
  confidence: number
  emotions: string[]
  intensity: number
} {
  const positiveWords = ['happy', 'joy', 'great', 'excellent', 'awesome', 'wonderful', 'fantastic', 'love', 'excited', 'amazing', 'perfect', 'brilliant']
  const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'angry', 'frustrated', 'disappointed', 'hate', 'worried', 'anxious', 'depressed', 'upset']
  const neutralWords = ['okay', 'fine', 'normal', 'regular', 'standard', 'average']

  const words = message.toLowerCase().split(/\s+/)
  let positiveCount = 0
  let negativeCount = 0
  let neutralCount = 0

  const detectedEmotions: string[] = []

  words.forEach(word => {
    if (positiveWords.includes(word)) {
      positiveCount++
      if (['happy', 'joy', 'excited'].includes(word)) detectedEmotions.push('happiness')
      if (['love', 'wonderful', 'fantastic', 'amazing'].includes(word)) detectedEmotions.push('enthusiasm')
    }
    if (negativeWords.includes(word)) {
      negativeCount++
      if (['sad', 'disappointed', 'depressed'].includes(word)) detectedEmotions.push('sadness')
      if (['angry', 'frustrated', 'upset'].includes(word)) detectedEmotions.push('anger')
      if (['worried', 'anxious'].includes(word)) detectedEmotions.push('anxiety')
    }
    if (neutralWords.includes(word)) neutralCount++
  })

  const totalEmotionalWords = positiveCount + negativeCount
  const sentimentScore = positiveCount - negativeCount
  const intensity = totalEmotionalWords / words.length

  let sentiment = 'neutral'
  let confidence = 0.5

  if (sentimentScore > 0) {
    sentiment = 'positive'
    confidence = Math.min(0.95, 0.5 + (sentimentScore / words.length))
  } else if (sentimentScore < 0) {
    sentiment = 'negative'
    confidence = Math.min(0.95, 0.5 + (Math.abs(sentimentScore) / words.length))
  } else if (neutralCount > 0) {
    confidence = 0.7
  }

  return {
    sentiment,
    confidence,
    emotions: [...new Set(detectedEmotions)],
    intensity
  }
}

// ==================== CONVERSATION MANAGEMENT ====================

function updateConversationHistory(message: string, sentimentAnalysis: any): void {
  const topics = extractTopics(message)

  conversationContext.conversationHistory.push({
    role: 'user',
    content: message,
    timestamp: new Date(),
    sentiment: sentimentAnalysis.sentiment,
    processed: true,
    topics,
    importance: calculateImportance(message, sentimentAnalysis)
  })

  if (conversationContext.conversationHistory.length > CONFIG.MAX_CONTEXT_HISTORY) {
    conversationContext.conversationHistory = conversationContext.conversationHistory.slice(-CONFIG.MAX_CONTEXT_HISTORY)
  }

  conversationContext.conversationLength++
  conversationContext.lastMessage = message
  conversationContext.topicContinuity = [...new Set([...conversationContext.topicContinuity, ...topics])].slice(-10)

  if (global.userData.learningProfile) {
    topics.forEach(topic => {
      if (!global.userData.learningProfile.preferredTopics.includes(topic)) {
        global.userData.learningProfile.preferredTopics.push(topic)
      }
    })
    global.userData.learningProfile.preferredTopics = global.userData.learningProfile.preferredTopics.slice(-20)
  }
}

function extractTopics(message: string): string[] {
  const topicKeywords: Record<string, string[]> = {
    'technology': ['tech', 'computer', 'software', 'ai', 'programming', 'code', 'digital', 'app', 'website'],
    'health': ['health', 'medical', 'doctor', 'pain', 'symptom', 'medicine', 'treatment', 'fitness', 'wellness'],
    'science': ['science', 'research', 'study', 'theory', 'experiment', 'data', 'physics', 'chemistry', 'biology'],
    'business': ['business', 'work', 'job', 'career', 'money', 'finance', 'company', 'startup', 'entrepreneur'],
    'education': ['learn', 'study', 'school', 'university', 'course', 'education', 'teacher', 'student'],
    'entertainment': ['movie', 'music', 'game', 'fun', 'entertainment', 'show', 'book', 'art', 'culture'],
    'news': ['news', 'current', 'latest', 'update', 'breaking', 'today', 'recent', 'event'],
    'personal': ['personal', 'life', 'family', 'relationship', 'friend', 'emotion', 'feeling']
  }

  const messageLower = message.toLowerCase()
  const detectedTopics: string[] = []

  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => messageLower.includes(keyword))) {
      detectedTopics.push(topic)
    }
  })

  return detectedTopics.length > 0 ? detectedTopics : ['general']
}

function calculateImportance(message: string, sentimentAnalysis: any): number {
  let importance = 0.5

  importance += Math.min(0.3, message.length / 1000)
  importance += sentimentAnalysis.intensity * 0.3

  if (/\?|what|how|why|when|where|who/i.test(message)) {
    importance += 0.2
  }

  if (/urgent|important|help|problem|issue|critical/i.test(message)) {
    importance += 0.4
  }

  return Math.min(1.0, importance)
}

// ==================== MEDICAL QUERY HANDLER ====================

async function handleMedicalQuery(message: string): Promise<{
  response: string
  ragResults?: any
  cotSteps?: string[]
}> {
  console.log('🏥 Processing medical query with Llama 3...')

  try {
    const medicalResponse = await searchMedical(message, {
      model: 'llama3',
      temperature: 0.3, // Low temperature for medical accuracy
      includeRelated: true
    })

    // Format the response with disclaimer
    const formattedResponse = `${medicalResponse.answer}\n\n${medicalResponse.disclaimer}`

    // Create CoT steps for medical reasoning
    const cotSteps = [
      'Classified query as medical',
      `Confidence: ${(medicalResponse.confidence * 100).toFixed(0)}%`,
      `Sources: ${medicalResponse.sources.join(', ')}`
    ]

    if (medicalResponse.relatedTopics && medicalResponse.relatedTopics.length > 0) {
      cotSteps.push(`Related topics: ${medicalResponse.relatedTopics.join(', ')}`)
    }

    console.log(`✅ Medical query processed with ${medicalResponse.confidence.toFixed(2)} confidence`)

    return {
      response: formattedResponse,
      ragResults: {
        entries: medicalResponse.sources.map((source, idx) => ({
          id: `medical_${idx}`,
          content: source,
          category: 'medical',
          timestamp: new Date(),
          tags: ['medical', 'llama3'],
          priority: 'high' as const,
          relevanceScore: medicalResponse.confidence,
          accessCount: 0,
          lastAccessed: new Date()
        })),
        totalRelevance: medicalResponse.confidence,
        categories: ['medical'],
        searchQuery: message,
        processingTime: 0
      },
      cotSteps
    }
  } catch (error) {
    console.error('❌ Medical query processing failed:', error)

    // Fallback response
    const disclaimer = "⚠️ **Medical Disclaimer**: I'm an AI assistant, not a medical professional. This information is for educational purposes only and should not replace professional medical advice."
    return {
      response: `${disclaimer}\n\nI encountered an error processing your medical query. Please consult a healthcare professional for personalized advice. For emergencies, call emergency services immediately.`,
      ragResults: {
        entries: [],
        totalRelevance: 0,
        categories: [],
        searchQuery: message,
        processingTime: 0
      },
      cotSteps: ['Medical query processing failed', 'Returned fallback response']
    }
  }
}

// ==================== FALLBACK RESPONSES ====================

function generateFallbackResponse(message: string, sentimentAnalysis: any): string {
  const mood = sentimentAnalysis.sentiment
  const emotions = sentimentAnalysis.emotions

  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening))$/i.test(message.trim())) {
    const greetings = [
      "Hello! 👋 I'm here to help with information, conversations, and questions. What's on your mind?",
      "Hi there! 😊 I'm your AI assistant with advanced reasoning capabilities. How can I assist you today?",
      "Hey! Ready to explore topics together. What would you like to discuss or learn about?"
    ]
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  if (/bye|goodbye|see you|farewell/i.test(message)) {
    return mood === 'positive'
      ? "Goodbye! 👋 It was great chatting with you. Feel free to return anytime with questions!"
      : "Take care! 💙 I'm here whenever you need assistance or just want to talk."
  }

  if (/help|what can you do|capabilities/i.test(message)) {
    return `I'm an enhanced AI assistant that can:

🧠 **Reason through complex problems** using Chain of Thought analysis
📚 **Access knowledge** from my learning database
🌐 **Search for current information** when needed
💬 **Have natural conversations** and remember our discussion context
🏥 **Provide general guidance** (with appropriate disclaimers for medical topics)
⚡ **Adapt my responses** to your mood and preferences

What would you like to explore together?`
  }

  if (/joke|funny|humor/i.test(message)) {
    const jokes = [
      "Why don't scientists trust atoms? Because they make up everything! 😄",
      "I told my computer a joke about UDP packets... I'm not sure if it got it! 🤖",
      "Why do programmers prefer dark mode? Because light attracts bugs! 💻",
      "Why did the AI go to therapy? It had too many neural issues! 🧠"
    ]
    return jokes[Math.floor(Math.random() * jokes.length)]
  }

  if (/time|what time|clock/i.test(message)) {
    const currentTime = new Date().toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: true,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    return `🕐 **Current time:** ${currentTime} (IST)`
  }

  if (mood === 'negative') {
    if (emotions.includes('sadness')) {
      return "I sense you might be feeling down. 💙 I'm here to listen and help however I can. Would you like to talk about what's on your mind, or would you prefer something to lift your spirits?"
    }
    if (emotions.includes('anger')) {
      return "It sounds like something is frustrating you. 😔 Take a deep breath - I'm here to help work through whatever is bothering you. What's going on?"
    }
    return "I'm here to help and support you. 🤝 Whether you need information, want to discuss something, or just need someone to listen, feel free to share what's on your mind."
  }

  if (mood === 'positive') {
    return "I love your positive energy! 😊✨ I'm excited to help you with whatever you're curious about. What would you like to explore or discuss today?"
  }

  return `I'd be happy to help! 🌟 I can discuss various topics, answer questions, provide information, or just have a conversation. My advanced reasoning helps me understand context and provide thoughtful responses. What interests you most right now?`
}

function generateContextualSuggestion(sentimentAnalysis: any, context: ConversationContext): string {
  const mood = sentimentAnalysis.sentiment
  const conversationLength = context.conversationLength
  const recentTopics = context.topicContinuity.slice(-3)

  if (conversationLength < 3) {
    return "Feel free to ask about current events, get explanations on topics, or just chat!"
  }

  if (mood === 'negative') {
    return "Would you like to explore solutions, or perhaps something more uplifting?"
  }

  if (mood === 'positive') {
    return "What else would you like to explore or learn about?"
  }

  if (recentTopics.includes('technology')) {
    return "Want to dive deeper into tech topics or explore something different?"
  }

  if (recentTopics.includes('health')) {
    return "Any other health questions, or shall we discuss a different topic?"
  }

  const suggestions = [
    "Ask about current news or events!",
    "Try me with a complex question that needs reasoning!",
    "What would you like to learn about today?",
    "I can help with explanations, current info, or casual conversation!"
  ]

  return suggestions[Math.floor(Math.random() * suggestions.length)]
}

function createEnhancedResponse(
  response: string,
  source: string,
  startTime: number,
  ragResults?: number,
  cotSteps?: string[]
): ApiResponse {
  return createDefaultResponse({
    success: true,
    response,
    source,
    metadata: {
      model: source.includes('ai') ? process.env.LLAMA_MODEL || 'meta-llama/Llama-3-70b-chat-hf' : undefined,
      responseTime: Date.now() - startTime,
      ragResults,
      cotSteps
    },
    suggestion: generateContextualSuggestion(
      { sentiment: conversationContext.userMood },
      conversationContext
    )
  })
}

// ==================== MESSAGE PROCESSING ====================

async function processEnhancedUserMessage(
  message: string,
  userId: string = 'anonymous'
): Promise<ApiResponse> {
  const startTime = Date.now()

  try {
    console.log(`📝 Processing message for user ${userId}: "${message.substring(0, 50)}..."`)

    const sentimentAnalysis = enhancedSentimentAnalysis(message)
    conversationContext.userMood = sentimentAnalysis.sentiment

    try {
      const jsonResult = await searchTrainedDataLegacy(message)
      if (jsonResult.found) {
        console.log('📄 Found in trained data')
        updateConversationHistory(message, sentimentAnalysis)
        return createEnhancedResponse(jsonResult.response!, 'trained_data', startTime)
      }
    } catch (error) {
      console.log('📄 Trained data search unavailable, continuing with AI processing')
    }

    if (/my name is|call me/i.test(message)) {
      const nameMatch = message.match(/(?:my name is|call me)\s+([a-zA-Z]+)/i)
      if (nameMatch) {
        global.userData.userName = nameMatch[1]
        conversationContext.userName = nameMatch[1]
        updateConversationHistory(message, sentimentAnalysis)

        return createEnhancedResponse(
          `Nice to meet you, ${nameMatch[1]}! 👋 I'm your enhanced AI assistant with advanced reasoning capabilities. How can I help you today?`,
          'name_introduction',
          startTime
        )
      }
    }

    if (/pain|hurt|sick|symptom|medical|health|doctor/i.test(message)) {
      console.log('🏥 Medical query detected')
      updateConversationHistory(message, sentimentAnalysis)

      const medicalResponse = await handleMedicalQuery(message)
      return createEnhancedResponse(
        medicalResponse.response,
        'medical_agent',
        startTime,
        medicalResponse.ragResults,
        medicalResponse.cotSteps
      )
    }

    try {
      console.log('🤖 Starting enhanced AI processing...')
      const aiResponse = await callEnhancedLlamaWithCoTAndRAG(message, conversationContext, userId)

      updateConversationHistory(message, sentimentAnalysis)

      const providerRetryAfterSeconds = (aiResponse as any)?.providerRetryAfterSeconds ?? null
      const providerErrorMessage = (aiResponse as any)?.providerErrorMessage ?? null

      return createDefaultResponse({
        success: true,
        response: aiResponse.response,
        source: 'enhanced_ai',
        metadata: {
          model: process.env.LLAMA_MODEL || process.env.LLM_MODEL ||
            (aiResponse.provider === 'openai' ? process.env.OPENAI_MODEL : undefined) ||
            'meta-llama/Llama-3-70b-chat-hf',
          provider: aiResponse.provider ||
            (process.env.LLM_PROVIDER ||
              (process.env.OPENAI_API_KEY ? 'openai' :
                (process.env.LLAMA_API_KEY ? 'llama' :
                  (process.env.GEMINI_API_KEY ? 'gemini' : 'none')))),
          responseTime: Date.now() - startTime,
          reasoning: aiResponse.reasoning,
          sources: aiResponse.sources,
          ragResults: aiResponse.ragResults.entries.length,
          cotSteps: aiResponse.cotProcess.steps.map(step => `Step ${step.step}: ${step.thought}`),
          confidence: aiResponse.confidence,
          ...(providerRetryAfterSeconds ? { providerRetryAfterSeconds } : {}),
          ...(providerErrorMessage ? { providerErrorMessage } : {})
        },
        suggestion: generateContextualSuggestion(sentimentAnalysis, conversationContext)
      })

    } catch (aiError) {
      console.error('🚫 Enhanced AI processing failed:', aiError)

      const fallbackResponse = generateFallbackResponse(message, sentimentAnalysis)
      updateConversationHistory(message, sentimentAnalysis)

      return createEnhancedResponse(fallbackResponse, 'fallback', startTime)
    }

  } catch (error) {
    console.error('💥 Message processing failed:', error)
    return createDefaultResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      response: "I apologize, but I encountered an issue processing your message. Please try again.",
      suggestion: "Try rephrasing your question or ask about a different topic.",
      metadata: {
        responseTime: Date.now() - startTime
      }
    })
  }
}

// ==================== MODE DETECTION ====================

function detectModeFromMessage(msg: string): string {
  const m = msg.toLowerCase()

  if (/\b(pain|hurt|sick|symptom|fever|cough|doctor|medical|health|diagnosis|medicine)\b/.test(m)) {
    return 'medical'
  }

  if (/\b(who is|what is|history of|born|died|biography|was|were|who was|what year|what year did)\b/.test(m)) {
    return 'wikipedia'
  }

  if (/\b(research|analyze|comprehensive|detailed|study|review|deep search|investigate|in-depth)\b/.test(m)) {
    return 'deepsearch'
  }

  if (/\b(api|backend|server|database|deploy|docker|kubernetes|endpoint|http|rest)\b/.test(m)) {
    return 'server'
  }

  return 'enhanced'
}

// ==================== API ROUTE HANDLERS ====================

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const startTime = Date.now()

  try {
    console.log('🚀 Enhanced API request received')

    const requestBody = await request.json()
    const message = requestBody.message as string
    const manualMode = typeof requestBody.mode === 'string' ? requestBody.mode.toLowerCase() : undefined
    const userId = requestBody.userId || 'anonymous'
    const sessionId = requestBody.sessionId

    if (!message || typeof message !== 'string') {
      return NextResponse.json(createDefaultResponse({
        success: false,
        error: "Invalid message format",
        response: "Please provide a valid message string.",
        suggestion: "Try asking a question or starting a conversation!",
        metadata: { responseTime: Date.now() - startTime }
      }), { status: 400 })
    }

    if (message.length > CONFIG.MAX_MESSAGE_LENGTH) {
      return NextResponse.json(createDefaultResponse({
        success: false,
        error: "Message too long",
        response: `Please keep messages under ${CONFIG.MAX_MESSAGE_LENGTH} characters for optimal processing.`,
        suggestion: "Try breaking your question into smaller parts.",
        metadata: { responseTime: Date.now() - startTime }
      }), { status: 400 })
    }

    const rateStatus = checkRateLimit(userId)
    if (!rateStatus.allowed) {
      console.warn(`⚠️ Rate limit exceeded for user ${userId}`)
      return NextResponse.json(createDefaultResponse({
        success: false,
        error: "Rate limit exceeded",
        response: "You've exceeded the rate limit. Please wait a moment before trying again.",
        suggestion: `Available requests reset in ${Math.ceil(rateStatus.resetIn / 1000)} seconds.`,
        metadata: {
          responseTime: Date.now() - startTime,
          rateLimitReset: rateStatus.resetIn
        }
      }), { status: 429 })
    }

    const cacheKey = generateCacheKey(message, userId)
    const cachedResponse = getCachedResponse(cacheKey)
    if (cachedResponse) {
      console.log('✅ Returning cached response')
      return NextResponse.json(cachedResponse, { status: 200 })
    }

    const session = getOrCreateSession(userId)
    const activeSessionId = sessionId || session.sessionId

    const autoMode = detectModeFromMessage(message)
    const activeMode = manualMode || autoMode

    let response: ApiResponse

    if (activeMode === 'medical') {
      console.log('➡️ Routing to medical agent')
      const medicalResult = await handleMedicalQuery(message)
      response = createEnhancedResponse(
        medicalResult.response,
        'medical_agent',
        startTime,
        medicalResult.ragResults,
        medicalResult.cotSteps
      )
      response.mode = 'medical'
    } else {
      response = await processEnhancedUserMessage(message, userId)
      response.mode = activeMode
    }

    recordRequest(userId, 100)
    setCachedResponse(cacheKey, response)

    session.messageCount++
    session.totalTokens += 100

    response.metadata = {
      ...response.metadata,
      sessionId: activeSessionId,
      messageCount: session.messageCount,
      totalTokensUsed: session.totalTokens
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('💥 API route error:', error)
    return NextResponse.json(createDefaultResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      response: "An unexpected error occurred. Please try again.",
      suggestion: "If the problem persists, please contact support.",
      metadata: {
        responseTime: Date.now() - startTime
      }
    }), { status: 500 })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    message: "Voice Assistant API is running",
    version: "2.0.0",
    capabilities: defaultCapabilities,
    endpoints: {
      POST: "/api/voice-assistant - Process user messages",
      GET: "/api/voice-assistant - API status"
    }
  }, { status: 200 })
}