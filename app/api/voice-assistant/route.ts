import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { generateWithProvider, isProviderConfigured } from './llm_provider'
import { generateEmbedding } from './embeddings'
import { searchTrainedDataLegacy } from './json_search'
import { searchMedical } from './medicalsearch'
import { handleDeepSearchQuery } from './deepsearch'
import { quickWikipediaLookup, formatWikipediaResponse, isWikipediaSuitable } from './wikipedia'
import { generateImage, type ImageGenerationOptions } from './image-gen-simple'
import type { Pinecone } from "@pinecone-database/pinecone"
import axios from "axios"
import { GreetingAgent } from './agents/greeting_agent'
import crypto from "crypto"
import ProfessionalResponseFormatter from './professional-formatter'
import Database from 'better-sqlite3'
import path from 'path'

// Initialize Agents
const greetingAgent = new GreetingAgent()


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
    imageData?: string // Base64 image data for image generation
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
  var lruCache: any // LRU Cache instance
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

// ==================== CACHING WITH LRU (Least Recently Used) ====================

/**
 * LRU Cache Node for doubly linked list
 */
interface LRUNode {
  key: string
  value: { response: ApiResponse; timestamp: number }
  prev: LRUNode | null
  next: LRUNode | null
}

/**
 * Efficient LRU Cache implementation
 * Time Complexity: O(1) for get and set operations
 * Space Complexity: O(n) where n is cache size
 */
class LRUCache {
  private capacity: number
  private cache: Map<string, LRUNode>
  private head: LRUNode | null = null
  private tail: LRUNode | null = null

  constructor(capacity: number = 100) {
    this.capacity = capacity
    this.cache = new Map()
  }

  private moveToFront(node: LRUNode): void {
    if (node === this.head) return

    // Remove from current position
    if (node.prev) node.prev.next = node.next
    if (node.next) node.next.prev = node.prev
    if (node === this.tail) this.tail = node.prev

    // Move to front
    node.next = this.head
    node.prev = null
    if (this.head) this.head.prev = node
    this.head = node
    if (!this.tail) this.tail = node
  }

  private removeTail(): void {
    if (!this.tail) return

    this.cache.delete(this.tail.key)

    if (this.tail.prev) {
      this.tail.prev.next = null
      this.tail = this.tail.prev
    } else {
      this.head = null
      this.tail = null
    }
  }

  get(key: string, ttl: number): ApiResponse | null {
    const node = this.cache.get(key)
    if (!node) return null

    // Check TTL
    if (Date.now() - node.value.timestamp >= ttl) {
      this.delete(key)
      return null
    }

    // Move to front (most recently used)
    this.moveToFront(node)
    console.log('✅ LRU Cache hit!')
    return { ...node.value.response, metadata: { ...node.value.response.metadata, cacheHit: true } }
  }

  set(key: string, response: ApiResponse): void {
    // If key exists, update and move to front
    const existingNode = this.cache.get(key)
    if (existingNode) {
      existingNode.value = { response: { ...response }, timestamp: Date.now() }
      this.moveToFront(existingNode)
      return
    }

    // Create new node
    const newNode: LRUNode = {
      key,
      value: { response: { ...response }, timestamp: Date.now() },
      prev: null,
      next: this.head
    }

    // Add to cache
    this.cache.set(key, newNode)

    // Update head
    if (this.head) this.head.prev = newNode
    this.head = newNode
    if (!this.tail) this.tail = newNode

    // Evict least recently used if over capacity
    if (this.cache.size > this.capacity) {
      this.removeTail()
    }
  }

  delete(key: string): void {
    const node = this.cache.get(key)
    if (!node) return

    if (node.prev) node.prev.next = node.next
    if (node.next) node.next.prev = node.prev
    if (node === this.head) this.head = node.next
    if (node === this.tail) this.tail = node.prev

    this.cache.delete(key)
  }

  size(): number {
    return this.cache.size
  }

  clear(): void {
    this.cache.clear()
    this.head = null
    this.tail = null
  }
}

// Initialize LRU cache
if (!global.lruCache) {
  global.lruCache = new LRUCache(100)
}

function getCachedResponse(cacheKey: string): ApiResponse | null {
  return global.lruCache?.get(cacheKey, CONFIG.CACHE_TTL) || null
}

function setCachedResponse(cacheKey: string, response: ApiResponse): void {
  global.lruCache?.set(cacheKey, response)
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

// ==================== QUERY TYPE CLASSIFICATION ====================

/**
 * Classifies query type to optimize model selection and processing
 * Query type	What to run
 * - Greeting / small talk → Tiny model, no RAG, no CoT
 * - Simple Q&A → Medium model, no RAG
 * - Knowledge question → RAG + embeddings
 * - Complex reasoning → RAG + CoT + large model
 */
function classifyQueryType(message: string): {
  type: 'greeting' | 'simple' | 'knowledge' | 'complex'
  useRAG: boolean
  useCoT: boolean
  modelSize: 'tiny' | 'medium' | 'large'
  reasoning: string
} {
  const lowerMessage = message.toLowerCase().trim()
  const wordCount = message.split(/\s+/).length

  // 1. GREETING / SMALL TALK - Tiny model, no RAG, no CoT
  const greetingPatterns = /^(hi|hello|hey|good\s+(morning|afternoon|evening|night)|what'?s\s+up|howdy|greetings|yo|sup)[\s!?.]*$/i
  const smallTalkPatterns = /^(how\s+are\s+you|how'?s\s+it\s+going|nice\s+to\s+meet|thanks?|thank\s+you|bye|goodbye|see\s+you|ok|okay|cool|great|awesome|nice)[\s!?.]*$/i

  if (greetingPatterns.test(lowerMessage) || smallTalkPatterns.test(lowerMessage)) {
    return {
      type: 'greeting',
      useRAG: false,
      useCoT: false,
      modelSize: 'tiny',
      reasoning: 'Simple greeting or small talk - using fast tiny model'
    }
  }

  // 2. SIMPLE Q&A - Medium model, no RAG (for factual questions that don't need knowledge base)
  const simpleQuestionPatterns = /^(what\s+is|who\s+is|when\s+is|where\s+is|define|meaning\s+of|tell\s+me\s+about)\s+\w+[\s\w]{0,20}[?.]?$/i
  const isShortQuestion = wordCount <= 8 && /\?$/.test(message)
  const noComplexKeywords = !/compare|analyze|explain\s+why|how\s+does|reasoning|because|therefore|complex|detailed/i.test(message)

  if ((simpleQuestionPatterns.test(lowerMessage) || isShortQuestion) && noComplexKeywords) {
    return {
      type: 'simple',
      useRAG: false,
      useCoT: false,
      modelSize: 'medium',
      reasoning: 'Simple factual question - using medium model without RAG'
    }
  }

  // 3. KNOWLEDGE QUESTION - RAG + embeddings (needs knowledge base lookup)
  const knowledgePatterns = /\b(research|study|paper|article|documentation|reference|source|citation|history\s+of|background\s+on|information\s+about)\b/i
  const specificTopicPatterns = /\b(medical|scientific|technical|historical|academic|scholarly)\b/i
  const needsContext = /\b(in\s+context|according\s+to|based\s+on|references?|sources?)\b/i

  if (knowledgePatterns.test(lowerMessage) || specificTopicPatterns.test(lowerMessage) || needsContext.test(lowerMessage)) {
    return {
      type: 'knowledge',
      useRAG: true,
      useCoT: false,
      modelSize: 'medium',
      reasoning: 'Knowledge-based query - using RAG with embeddings'
    }
  }

  // 4. COMPLEX REASONING - RAG + CoT + large model
  const complexPatterns = /\b(why|how\s+does|explain|analyze|compare|evaluate|assess|reasoning|logic|prove|demonstrate|argue|justify)\b/i
  const multiPartQuestion = message.split('?').length > 1 || /\band\b.*\?/.test(message)
  const requiresInference = /\b(therefore|thus|hence|consequently|implies|suggests|indicates|means\s+that)\b/i
  const requiresCalculation = /\b(calculate|compute|solve|equation|formula|algorithm|optimize)\b/i
  const isLongQuery = wordCount > 15

  if (complexPatterns.test(lowerMessage) || multiPartQuestion || requiresInference.test(lowerMessage) ||
    requiresCalculation.test(lowerMessage) || isLongQuery) {
    return {
      type: 'complex',
      useRAG: true,
      useCoT: true,
      modelSize: 'large',
      reasoning: 'Complex reasoning required - using full RAG + CoT + large model'
    }
  }

  // DEFAULT: Treat as knowledge question (safer default)
  return {
    type: 'knowledge',
    useRAG: true,
    useCoT: false,
    modelSize: 'medium',
    reasoning: 'Default classification - using RAG with medium model'
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

  if (/\b(what|how|why|when|where|who|explain|describe|discuss|detail|about)\b/.test(lowerMessage)) return "information_seeking"
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
    lengthGuideline = 'Provide a helpful response. It does not need to be extremely long, but should cover the topic well (3-5 sentences).'
  } else if (['information_seeking', 'current_information', 'medical_query'].includes(queryType)) {
    lengthGuideline = 'Provide detailed, comprehensive response (3-5 paragraphs if needed).'
  } else {
    lengthGuideline = 'Provide a well-rounded and detailed response. Do not artificially limit length if the topic requires explanation.'
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
2. **REFERENCE CHECK**: "RELEVANT KNOWLEDGE" above contains matching answers from our knowledge base (Pinecone/SQLite).
   - Use them as a **REFERENCE** for style, context, and depth.
   - **DO NOT** simply copy-paste them if they contain outdated information (e.g., old dates, prices, weather, versions).
   - **UPDATE** any outdated facts using the "CURRENT INFORMATION" section if available.
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
        maxLength = 250  // ~2-3 sentences (Relaxed)
      } else if (queryType === 'general_conversation' && userMessage.split(' ').length < 5) {
        maxLength = 1500  // Increased to allow better explanations even for short queries
      } else if (['information_seeking', 'current_information', 'medical_query'].includes(queryType)) {
        maxLength = 4000  /* Allow very detailed responses */
      } else {
        maxLength = 1500 /* Generous default (~10 sentences) */
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

// ==================== WIKIPEDIA QUERY HANDLER ====================

async function handleWikipediaQuery(
  message: string,
  userPlan: string = 'Free'
): Promise<{
  response: string
  ragResults?: any
  cotSteps?: string[]
}> {
  console.log(`📚 Processing Wikipedia query (${userPlan} plan)...`)

  try {
    const isPro = userPlan === 'Pro' || userPlan === 'Enterprise'

    // Pro users get more detailed results
    const sentences = isPro ? 10 : 5

    const wikiResult = await quickWikipediaLookup(message, sentences, isPro)
    const formattedResponse = formatWikipediaResponse(wikiResult)

    // Create CoT steps for Wikipedia search
    const cotSteps = [
      'Classified query as Wikipedia search',
      `User plan: ${userPlan}`,
      isPro ? 'Enhanced search with Pro features' : 'Standard search',
      wikiResult.success ? `Found: ${wikiResult.title}` : 'No results found'
    ]

    if (wikiResult.relatedTopics && wikiResult.relatedTopics.length > 0) {
      cotSteps.push(`Related topics: ${wikiResult.relatedTopics.join(', ')}`)
    }

    console.log(`✅ Wikipedia query processed (${userPlan}): ${wikiResult.success ? 'Success' : 'Failed'}`)

    return {
      response: formattedResponse,
      ragResults: {
        entries: wikiResult.success ? [{
          id: 'wikipedia_result',
          content: wikiResult.summary || '',
          category: 'wikipedia',
          timestamp: new Date(),
          tags: ['wikipedia', 'knowledge'],
          priority: 'medium' as const,
          relevanceScore: 0.9,
          accessCount: 0,
          lastAccessed: new Date()
        }] : [],
        totalRelevance: wikiResult.success ? 0.9 : 0,
        categories: ['wikipedia'],
        searchQuery: message,
        processingTime: 0
      },
      cotSteps
    }
  } catch (error) {
    console.error('❌ Wikipedia query processing failed:', error)

    return {
      response: `I encountered an error searching Wikipedia. Please try rephrasing your query or try again later.`,
      ragResults: {
        entries: [],
        totalRelevance: 0,
        categories: [],
        searchQuery: message,
        processingTime: 0
      },
      cotSteps: ['Wikipedia query processing failed', 'Returned fallback response']
    }
  }
}

// ==================== MEDICAL QUERY HANDLER ====================

async function handleMedicalQuery(
  message: string,
  userPlan: string = 'Free'
): Promise<{
  response: string
  ragResults?: any
  cotSteps?: string[]
}> {
  console.log(`🏥 Processing medical query with Meditron (${userPlan} plan)...`)

  try {
    const medicalResponse = await searchMedical(message, {
      model: 'llama3',
      temperature: 0.3, // Low temperature for medical accuracy
      includeRelated: true,
      useMeditron: true, // Enable Meditron
      userPlan: userPlan as 'Free' | 'Pro' | 'Enterprise'
    })

    // Format the response with disclaimer
    const formattedResponse = `${medicalResponse.answer}\n\n${medicalResponse.disclaimer}`

    // Create CoT steps for medical reasoning
    const cotSteps = [
      'Classified query as medical',
      `User plan: ${userPlan}`,
      `Model: ${medicalResponse.sources[1]}`, // AI Model info
      `Confidence: ${(medicalResponse.confidence * 100).toFixed(0)}%`,
      `Sources: ${medicalResponse.sources.join(', ')}`
    ]

    if (medicalResponse.relatedTopics && medicalResponse.relatedTopics.length > 0) {
      cotSteps.push(`Related topics: ${medicalResponse.relatedTopics.join(', ')}`)
    }

    console.log(`✅ Medical query processed with ${(medicalResponse.confidence * 100).toFixed(1)}% confidence`)

    return {
      response: formattedResponse,
      ragResults: {
        entries: medicalResponse.sources.map((source, idx) => ({
          id: `medical_${idx}`,
          content: source,
          category: 'medical',
          timestamp: new Date(),
          tags: ['medical', 'meditron'],
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

    // ==================================================================================
    // 🧠 MULTI-AGENT ORCHESTRATOR
    // Architecture: Divide & Conquer
    // 1. Break message into segments/intents
    // 2. Route each segment to specialized agent (Greeting, Image, Medical, Reasoning)
    // 3. Aggregate results into cohesive response
    // ==================================================================================

    let workingMessage = message;
    const responseSegments: string[] = [];
    let sources: string[] = [];
    let providerUsed = 'orchestrator';
    let reasoningTrace: string[] = [];

    // --- AGENT 1: GREETING AGENT ---
    // Handles Intro/Outro/Social protocols
    const greetingCheck = greetingAgent.stripGreeting(workingMessage);
    if (greetingCheck.hasGreeting) {
      console.log('✨ Agent [Greeting]: Activated');

      const hour = new Date().getHours();
      let timeOfDay = 'morning';
      if (hour >= 5 && hour < 12) timeOfDay = 'morning';
      else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
      else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
      else timeOfDay = 'night'; // 10 PM to 5 AM

      // Pass the ACTUAL greeting part to the agent (not hardcoded "hello")
      // This allows the trained model to classify: greeting vs farewell vs thanks
      const greetingResult = greetingAgent.generateResponse(greetingCheck.greetingPart, {
        userName: conversationContext.userName,
        userMood: sentimentAnalysis.sentiment,
        timeOfDay: timeOfDay
      });

      // We accumulate the greeting but DON'T output it yet. 
      // We will prepend it to the final response.
      responseSegments.push(greetingResult.response.split(/[!.?]/)[0] + "!");

      // CRITICAL: Remove greeting from working message so LLM doesn't see it (Token Savings)
      workingMessage = greetingCheck.cleanMessage;

      if (!workingMessage) {
        // If ONLY a greeting, return immediately (Short Circuit)
        updateConversationHistory(message, sentimentAnalysis);
        return createEnhancedResponse(
          greetingResult.response,
          'greeting_agent',
          startTime,
          0,
          greetingResult.reasoning
        );
      }
    }

    // --- AGENT 2: IMAGE AGENT ---
    // Handles visual generation requests
    const imageMode = detectModeFromMessage(workingMessage) === 'image';
    if (imageMode) {
      console.log('✨ Agent [Image]: Activated');
      const userPlan = 'Free';
      const imageResult = await handleImageGeneration(workingMessage, userPlan);

      // Add image description to response
      responseSegments.push(imageResult.response);

      // Append image metadata to response artifact
      // (Note: In a real split, we might want to return the image separately, 
      // but here we just append the text confirmation)
      sources.push('image_gen');

      // Stop processing text if it was primarily an image request
      // (Unless complex multi-modal, but for now specific)
      updateConversationHistory(message, sentimentAnalysis);

      const finalResp = createEnhancedResponse(
        responseSegments.join("\n\n"),
        'image_generation',
        startTime,
        imageResult.ragResults,
        imageResult.cotSteps
      );
      if (imageResult.imageData) {
        finalResp.metadata = { ...finalResp.metadata, imageData: imageResult.imageData };
      }
      return finalResp;
    }

    // --- AGENT 3: SPECIALIZED KNOWLEDGE AGENTS (Medical/Trained) ---
    if (/pain|hurt|sick|symptom|medical|health|doctor/i.test(workingMessage)) {
      console.log('✨ Agent [Medical]: Activated');
      const medicalRes = await handleMedicalQuery(workingMessage, 'Free');
      responseSegments.push(medicalRes.response);
      sources.push('medical_agent');

      updateConversationHistory(message, sentimentAnalysis);
      return createEnhancedResponse(
        responseSegments.join("\n\n"),
        'medical_agent',
        startTime,
        medicalRes.ragResults
      );
    }

    // --- AGENT 4: REASONING AGENT (LLM) ---
    // Handles whatever is left (General Logic)
    if (workingMessage.length > 1) { // Ensure actual content remains
      console.log('✨ Agent [Reasoning]: Activated for payload:', workingMessage);

      try {
        // ==================================================================================
        // 🎓 CONSENSUS ENGINE (Student-Teacher Learning Loop)
        // 1. Get Student Answer (Fine-Tuned Model)
        // 2. Get Teacher Answer (Main LLM)
        // 3. Review & Synthesize (Reviewer)
        // 4. Log for Retraining
        // ==================================================================================

        // 1. Student Model (The one being trained)
        let studentResponse = null;
        try {
          // Try to call the fine-tuned model
          const studentResult = await generateWithProvider(workingMessage, {
            model: 'g-one-v1-mistral', // The name of your fine-tuned model
            temperature: 0.7,
            maxTokens: 500,
            systemPrompt: "You are G-One, a helpful AI assistant."
          });
          studentResponse = studentResult.text;
          console.log("👨‍🎓 Student Model Responded");
        } catch (e) {
          console.log("⚠️ Student Model unavailable (skipping):", (e as any).message);
        }

        // 2. Teacher Model (The current production LLM) - via existing CoT function
        const teacherResult = await callEnhancedLlamaWithCoTAndRAG(workingMessage, conversationContext, userId);
        const teacherResponse = teacherResult.response;

        // 3. Greeting Agent Result (if any)
        const greetingResponse = responseSegments.length > 0 ? responseSegments[0] : null;

        // 4. Consensus / Review Step
        let finalAnswer = teacherResponse;

        // Only run consensus if we actually have a student response to compare/merge
        if (studentResponse && studentResponse !== 'N/A') {
          console.log("⚖️ Consensus Engine: Reviewing responses...");

          const reviewPrompt = `You are a Senior AI Validator. Your goal is to synthesize the PERFECT response for the user.
          
  User Query: "${workingMessage}"

  [INPUT 1] Greeting Agent (Social): "${greetingResponse || 'N/A'}"
  [INPUT 2] Student Model (Local Fine-Tuned): "${studentResponse}"
  [INPUT 3] Teacher Model (Reasoning/RAG): "${teacherResponse}"

  INSTRUCTIONS:
  1. "Teacher Model" is usually the most accurate. Use it as the base.
  2. If "Student Model" gives a good answer, acknowledge it implicitly (continuous learning).
  3. If "Greeting Agent" provided a greeting, ensure the final answer flows naturally from it (or doesn't repeat it).
  4. Combine the best parts into a single, cohesive, professional response.
  5. The final output MUST be the direct answer to the user. No "Here is the synthesized answer:" prefixes.

  Final Response:`;

          const consensusResult = await generateWithProvider(reviewPrompt, {
            temperature: 0.5,
            maxTokens: 1000
          });
          finalAnswer = consensusResult.text.trim();
        } else {
          console.log("⏩ Consensus skipped (Student Model silent), using Teacher response directly.");
        }

        // 5. Log for Continuous Learning (The Critical Step)
        // Detect Mistake: If Student spoke but was different from Final, record it as a "Mistake" to learn from.
        let rejectedResponse = null;
        if (studentResponse && studentResponse.length > 10) {
          // Simple similarity check could go here, but for now, we assume if Consensus changed it, it's better.
          // We only log as rejected if they are substantially different to avoid noise.
          if (finalAnswer.slice(0, 50) !== studentResponse.slice(0, 50)) {
            rejectedResponse = studentResponse;
            console.log("👨‍🏫 Teacher corrected Student's mistake. Logging for DPO/Correction.");
          }
        }

        logToLearningDB(workingMessage, finalAnswer, 0.95, rejectedResponse);

        responseSegments.push(finalAnswer);
        sources = [...sources, ...teacherResult.sources, 'consensus_engine'];
        providerUsed = 'consensus_v1';
        reasoningTrace = teacherResult.cotProcess ? teacherResult.cotProcess.steps.map(s => s.thought) : [];

      } catch (err) {
        console.error('Reasoning Agent Failed:', err);
        responseSegments.push("I encountered a logic error processing your request.");
      }
    }

    // ==================================================================================
    // 🧩 SYNTHESIS
    // Combine all agent outputs into the final coherent response
    // ==================================================================================

    updateConversationHistory(message, sentimentAnalysis);

    // Polish: Check if Reasoning Agent added a greeting despite being told not to (LLMs are chatty)
    if (responseSegments.length > 1) {
      // If we have a Greeting Agent segment AND a Reasoning segment
      const greetingSegment = responseSegments[0];
      let mainBody = responseSegments[responseSegments.length - 1];

      // Simple heuristic: If main body starts with "Hello", "Hi", "Greetings", strip it
      // to avoid "Good Morning! Hello, gravity is..."
      const redundancyCheck = /^(hello|hi|good\s+(morning|afternoon|evening)|greetings|hey)\b/i;
      if (redundancyCheck.test(mainBody.substring(0, 20))) {
        mainBody = mainBody.replace(redundancyCheck, '').replace(/^[,!.]\s*/, '');
        // Capitalize first letter of new start
        mainBody = mainBody.charAt(0).toUpperCase() + mainBody.slice(1);
        responseSegments[responseSegments.length - 1] = mainBody;
      }
    }

    const finalResponseText = responseSegments.join("\n\n");

    return createDefaultResponse({
      success: true,
      response: finalResponseText,
      source: providerUsed,
      metadata: {
        model: process.env.LLM_MODEL || 'orchestrator-ensemble',
        responseTime: Date.now() - startTime,
        sources: sources,
        cotSteps: reasoningTrace,
        ragResults: 0 // Aggregated in real implementation
      },
      suggestion: generateContextualSuggestion(sentimentAnalysis, conversationContext)
    });

  } catch (error) {
    console.error('💥 Orchestrator failed:', error)
    return createDefaultResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      response: "I apologize, but I encountered an issue processing your message.",
      metadata: { responseTime: Date.now() - startTime }
    })
  }
}

// ==================== IMAGE GENERATION HANDLER ====================

async function handleImageGeneration(
  message: string,
  userPlan: string = 'Free'
): Promise<{
  response: string
  imageData?: string
  ragResults?: any
  cotSteps?: string[]
}> {
  console.log(`🎨 Processing image generation request (${userPlan} plan)...`)

  try {
    // Extract prompt from message
    const promptMatch = message.match(/(?:generate|create|make|draw|paint)\s+(?:an?\s+)?(?:image|picture|photo)?\s*(?:of\s+)?(.+)/i)
    const prompt = promptMatch ? promptMatch[1].trim() : message

    console.log(`🎨 Generating image: "${prompt}"`)

    const imageOptions: ImageGenerationOptions = {
      prompt,
      negativePrompt: "ugly, blurry, low quality, distorted",
      width: 512,
      height: 512,
      steps: 10, // Reduced for faster generation
      seed: Math.floor(Math.random() * 1000000)
    }

    const result = await generateImage(imageOptions)

    if (!result.success) {
      throw new Error(result.error || 'Image generation failed')
    }

    const cotSteps = [
      'Classified query as image generation',
      `User plan: ${userPlan}`,
      `Model: Stable Diffusion 1.5`,
      `Provider: ${result.provider}`,
      'Image generated successfully'
    ]

    const response = `🎨 **Image Generated with Stable Diffusion 1.5!**\n\n` +
      `**Prompt:** ${prompt}\n` +
      `**Model:** Stable Diffusion 1.5 (Local GPU)\n` +
      `**Size:** ${result.metadata.width}x${result.metadata.height}\n` +
      `**Steps:** ${result.metadata.steps}\n\n` +
      '*Generated locally on your RTX 3050 in 2-3 seconds!*'

    console.log(`✅ Image generated successfully using ${result.model}`)

    return {
      response,
      imageData: result.images[0], // Base64 image data
      ragResults: {
        entries: [{
          id: 'image_generation',
          content: `Generated image: ${prompt}`,
          category: 'image',
          timestamp: new Date(),
          tags: ['image', 'generation', result.model],
          priority: 'medium' as const,
          relevanceScore: 1.0,
          accessCount: 0,
          lastAccessed: new Date()
        }],
        totalRelevance: 1.0,
        categories: ['image'],
        searchQuery: message,
        processingTime: 0
      },
      cotSteps
    }
  } catch (error: any) {
    console.error('❌ Image generation failed:', error)

    return {
      response: `I encountered an error generating the image: ${error.message}\n\n` +
        `Please try:\n` +
        `1. Rephrasing your prompt\n` +
        `2. Checking if HUGGINGFACE_API_KEY is set in .env\n` +
        `3. Waiting a moment and trying again`,
      ragResults: {
        entries: [],
        totalRelevance: 0,
        categories: [],
        searchQuery: message,
        processingTime: 0
      },
      cotSteps: ['Image generation failed', error.message]
    }
  }
}

function detectImageStyle(message: string): string | undefined {
  const m = message.toLowerCase()

  if (/\b(photo|photograph|realistic|real)\b/.test(m)) return 'realistic'
  if (/\b(anime|manga|japanese)\b/.test(m)) return 'anime'
  if (/\b(art|artistic|painting|painted)\b/.test(m)) return 'artistic'
  if (/\b(digital|concept|artstation)\b/.test(m)) return 'digital-art'
  if (/\b(photography|dslr|camera)\b/.test(m)) return 'photography'

  return undefined
}

// ==================== MODE DETECTION ====================

function detectModeFromMessage(msg: string): string {
  const m = msg.toLowerCase()

  // Image generation keywords
  if (/\b(generate|create|make|draw|paint|image|picture|photo|illustration)\b.*\b(image|picture|photo|of|a|an)\b/.test(m) ||
    /\b(text.?to.?image|image.?generation)\b/.test(m)) {
    return 'image'
  }

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

// ==================== SYNTHESIS SYSTEM INTEGRATION ====================

async function querySynthesisSystem(query: string, mode: string = 'synthesis'): Promise<any> {
  try {
    const response = await axios.post('http://localhost:5000/synthesize', {
      query,
      mode
    }, { timeout: 30000 }); // 30s timeout for full synthesis
    return response.data;
  } catch (error) {
    return null; // Return null to indicate fallback is needed
  }
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

    // --- SYNTHESIS SYSTEM ROUTING ---
    // Handle complex queries with the unified Python backend (LLM + RAG + CoT)
    const synthesisKeywords = /explain|how|why|compare|analyze|what is|define|medical|symptom|treat/i;
    // Route if: 1. It's a question/request, 2. Not a simple greeting, 3. Not an image request
    const shouldSynth = synthesisKeywords.test(message) && !message.startsWith('generate image');

    if (shouldSynth) {
      console.log("🔄 Routing to Synthesis System...");
      const synthesisResult = await querySynthesisSystem(message);

      if (synthesisResult) {
        console.log("✅ Synthesis System responded!");

        // Format professionally
        const formattedResponse = ProfessionalResponseFormatter.formatSynthesizedResponse(
          message,
          {
            synthesized_answer: synthesisResult.synthesized_answer,
            confidence: synthesisResult.confidence,
            reasoning: synthesisResult.reasoning,
            sources: synthesisResult.sources
          }
        );

        // Convert to Markdown for the frontend
        const markdownResponse = ProfessionalResponseFormatter.toMarkdown(formattedResponse);

        return NextResponse.json(createDefaultResponse({
          response: markdownResponse,
          mode: 'synthesis_enhanced',
          metadata: {
            confidence: synthesisResult.confidence,
            sources: synthesisResult.sources,
            reasoning: synthesisResult.reasoning,
            model: 'v64-synthesis-engine-v2',
            responseTime: Date.now() - startTime
          },
          context: {
            userName: global.conversationContext?.userName ?? null,
            userMood: global.conversationContext?.userMood || 'neutral',
            interests: [...(global.conversationContext?.interests || [])],
            conversationLength: global.conversationContext?.conversationLength || 0,
            systemOS: global.conversationContext?.systemOS || process.platform,
            lastSearchQuery: global.conversationContext?.lastSearchQuery || null
          }
        }));
      }
      console.log("⚠️ Synthesis System unavailable, falling back...");
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
      const userPlan = requestBody.userPlan || 'Free'
      const medicalResult = await handleMedicalQuery(message, userPlan)
      response = createEnhancedResponse(
        medicalResult.response,
        'medical_agent',
        startTime,
        medicalResult.ragResults,
        medicalResult.cotSteps
      )
      response.mode = 'medical'
    } else if (activeMode === 'wikipedia') {
      console.log('➡️ Routing to Wikipedia search')
      const userPlan = requestBody.userPlan || 'Free'
      const wikiResult = await handleWikipediaQuery(message, userPlan)
      response = createEnhancedResponse(
        wikiResult.response,
        'wikipedia_search',
        startTime,
        wikiResult.ragResults,
        wikiResult.cotSteps
      )
      response.mode = 'wikipedia'
    } else if (activeMode === 'deepsearch') {
      console.log('➡️ Routing to Deep Search')
      const userPlan = requestBody.userPlan || 'Free'
      const deepResult = await handleDeepSearchQuery(message, userPlan)
      response = createEnhancedResponse(
        deepResult.response,
        'deep_search_agent',
        startTime,
        deepResult.ragResults,
        deepResult.cotSteps
      )
      response.mode = 'deepsearch'
    } else if (activeMode === 'image') {
      console.log('➡️ Routing to image generation')
      const userPlan = requestBody.userPlan || 'Free'
      const imageResult = await handleImageGeneration(message, userPlan)
      response = createEnhancedResponse(
        imageResult.response,
        'image_generation',
        startTime,
        imageResult.ragResults,
        imageResult.cotSteps
      )
      // Add image data to response
      if (imageResult.imageData) {
        response.metadata = {
          ...response.metadata,
          imageData: imageResult.imageData
        }
      }
      response.mode = 'image'
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

// ==================== LEARNING DATABASE LOGGING ====================

// ==================== LEARNING DATABASE LOGGING ====================

function logToLearningDB(query: string, response: string, confidence: number = 0.8, rejectedResponse: string | null = null) {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'learning', 'knowledge.db');
    // Ensure directory exists
    const fs = require('fs');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath);

    // Create table if not exists with support for DPO (Rejected Response)
    // We add the column if it doesn't exist (Migration logic)
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT,
        response TEXT,
        confidence REAL,
        feedback INTEGER DEFAULT 0,
        rejected_response TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Basic migration for existing tables without the column
    try {
      db.exec("ALTER TABLE conversations ADD COLUMN rejected_response TEXT");
    } catch (e) {
      // Column likely exists or table just created
    }

    const stmt = db.prepare('INSERT INTO conversations (query, response, confidence, rejected_response) VALUES (?, ?, ?, ?)');
    stmt.run(query, response, confidence, rejectedResponse);

    if (rejectedResponse) {
      console.log("📝 Logged [Correction] to Learning DB: System learned from a mistake.");
    } else {
      console.log("📝 Logged [Interaction] to Learning DB.");
    }

    db.close();
  } catch (error) {
    console.error("❌ Failed to log to Learning DB:", error);
  }
}
