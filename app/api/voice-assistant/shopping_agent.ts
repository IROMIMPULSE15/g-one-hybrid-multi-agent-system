/**
 * MarketMind — Shopping Research Agent v2 (Intelligent Mode)
 * ===========================================================
 * Voice → Product Link → Ranked Output
 *
 * Flow:
 *   1. Detect shopping intent (expanded patterns)
 *   2. Clean & enhance query (smart normalization)
 *   3. Call SerpAPI (Google Shopping) with auto-retry
 *   4. Rank products (rating × 0.5 + log(reviews) × 0.3 − price × 0.0001)
 *   5. Return comparison-table format with buy links & quality scores
 *
 * Uses in-memory cache to conserve SerpAPI free-tier quota (100 req/month).
 */

import axios from 'axios'

// ==================== TYPES ====================

interface ShoppingProduct {
  title: string
  price: string
  extracted_price?: number
  rating?: number
  reviews?: number
  link: string
  source: string
  thumbnail?: string
  score?: number
}

interface ShoppingResult {
  response: string
  products: ShoppingProduct[]
  cotSteps: string[]
  sources: string[]
  cached: boolean
}

interface CacheEntry {
  result: ShoppingResult
  timestamp: number
}

// ==================== CONFIGURATION ====================

const CACHE_TTL_MS = 30 * 60 * 1000 // 30-minute cache
const MAX_CACHE_SIZE = 50
const SERP_API_TIMEOUT = 10000

// ==================== IN-MEMORY CACHE ====================

const shoppingCache = new Map<string, CacheEntry>()

function getCacheKey(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ')
}

function getCachedResult(query: string): ShoppingResult | null {
  const key = getCacheKey(query)
  const entry = shoppingCache.get(key)
  if (!entry) return null

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    shoppingCache.delete(key)
    return null
  }

  return { ...entry.result, cached: true }
}

function setCachedResult(query: string, result: ShoppingResult): void {
  const key = getCacheKey(query)

  // Evict oldest entry if cache is full
  if (shoppingCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = shoppingCache.keys().next().value
    if (oldestKey) shoppingCache.delete(oldestKey)
  }

  shoppingCache.set(key, {
    result,
    timestamp: Date.now()
  })
}

// ==================== SHOPPING INTENT DETECTION ====================

const SHOPPING_PATTERNS = [
  /\b(buy|purchase|order|shop|shopping)\b/i,
  /\b(price|cost|cheap|affordable|expensive|budget)\b/i,
  /\b(best|top|recommend|suggestion|suggest)\b.*\b(laptop|phone|headphone|earbuds?|camera|tablet|watch|tv|monitor|keyboard|mouse|speaker|router|printer|console|gaming|shoes?|sneakers?|bag|backpack|jacket|shirt|dress|jeans|product|gadget|device|appliance)/i,
  /\b(laptop|phone|headphone|earbuds?|camera|tablet|watch|tv|monitor|keyboard|mouse|speaker|router|printer|console|gaming|shoes?|sneakers?|bag|backpack|jacket|shirt|dress|jeans|product|gadget|device|appliance)\b.*\b(under|below|within|around|less than|for|at)\b.*\b\d/i,
  /\b(compare|comparison|vs|versus)\b.*\b(product|phone|laptop|device|brand)/i,
  /\b(where to buy|where can i (buy|get|find))\b/i,
  /\b(deal|deals|offer|offers|discount|sale|coupon)\b/i,
  /\b(amazon|flipkart|ebay|walmart|best buy)\b/i,
  /\b(review|reviews|rated|rating)\b.*\b(product|phone|laptop|device|camera)/i,
  /\b(market ?mind|shopping agent)\b/i,
  // ── v2: Expanded patterns for vague shopping queries ──
  /\b(i want|i need|get me|find me|looking for|search for|show me)\b.*\b(laptop|phone|headphone|earbuds?|camera|tablet|watch|tv|monitor|keyboard|mouse|speaker|router|printer|console|gaming|shoes?|sneakers?|bag|backpack|jacket|shirt|dress|jeans|product|gadget|device|appliance|charger|cable|stand|cooler|fan|light|bulb|bottle|mat|gloves?|socks?|cap|hat|belt|wallet|ring|bracelet|necklace|sunglasses)/i,
  /\b(a pair of|some|new)\b.*\b(shoes?|sneakers?|earbuds?|headphones?|gloves?|socks?|jeans|glasses|sunglasses)/i,
  /\b(sport|running|training|casual|formal|leather)\b.*\b(shoes?|sneakers?|boots?|sandals?)/i,
]

export function isShoppingIntent(message: string): boolean {
  const m = message.toLowerCase().trim()
  return SHOPPING_PATTERNS.some(pattern => pattern.test(m))
}

// ==================== QUERY CLEANER (v2 — Intelligent) ====================

/**
 * Singular → Plural normalization map.
 * Covers common product terms that Google Shopping handles better in plural.
 */
const SINGULAR_PLURAL_MAP: Record<string, string> = {
  'sport shoe': 'sports shoes',
  'running shoe': 'running shoes',
  'sneaker': 'sneakers',
  'earphone': 'earphones',
  'earbud': 'earbuds',
  'headphone': 'headphones',
  'laptop bag': 'laptop bags',
  'phone case': 'phone cases',
  'charger': 'chargers',
  'smartwatch': 'smartwatches',
  'sunglasse': 'sunglasses',
}

/**
 * Filler phrases that add no search value.
 * Order matters — longer phrases first to avoid partial matches.
 */
const FILLER_PHRASES = [
  'i want to buy',
  'i would like to buy',
  'i would like',
  'i want to get',
  'can you find me',
  'can you show me',
  'can you get me',
  'can you search for',
  'please find me',
  'please show me',
  'please search for',
  'please get me',
  'i am looking for',
  'i\'m looking for',
  'looking for',
  'search for',
  'show me',
  'find me',
  'get me',
  'i want',
  'i need',
  'i like',
  'please',
  'can you',
  'could you',
  'a pair of',
  'a set of',
  'some good',
  'some nice',
]

function cleanShoppingQuery(message: string): string {
  let q = message.toLowerCase().trim()

  // 1. Remove filler phrases (longest first to avoid partial matches)
  for (const filler of FILLER_PHRASES) {
    q = q.replace(new RegExp(`\\b${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '')
  }

  // 2. Remove agent trigger words
  q = q.replace(/\b(market\s*mind|shopping agent)\b/gi, '')

  // 3. Normalize singular → plural for product terms
  for (const [singular, plural] of Object.entries(SINGULAR_PLURAL_MAP)) {
    q = q.replace(new RegExp(`\\b${singular}\\b`, 'gi'), plural)
  }

  // 4. Clean up extra whitespace and articles
  q = q.replace(/\b(a|an|the|some|any)\b/gi, '')
  q = q.trim().replace(/\s+/g, ' ')

  // 5. Auto-enhance: if the query lacks commercial intent keywords, add "best"
  const hasCommercialIntent = /\b(best|top|under|below|budget|cheap|premium|rated|popular|review|compare|vs)\b/i.test(q)
  if (!hasCommercialIntent && q.length > 2) {
    q = 'best ' + q
  }

  return q.trim()
}

// ==================== SERPAPI SEARCH ====================

async function searchSerpAPI(query: string): Promise<ShoppingProduct[]> {
  const apiKey = process.env.SERP_API_KEY

  if (!apiKey || apiKey === 'your-serpapi-key-here') {
    console.warn('⚠️ MarketMind: SERP_API_KEY not configured, using fallback')
    return []
  }

  try {
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_shopping',
        q: query,
        api_key: apiKey,
        location: 'India',
        hl: 'en',
        gl: 'in',
        num: 15
      },
      timeout: SERP_API_TIMEOUT
    })

    const results = response.data?.shopping_results || []

    return results.map((item: any) => ({
      title: item.title || 'Unknown Product',
      price: item.price || 'N/A',
      extracted_price: item.extracted_price || parseFloat((item.price || '0').replace(/[^\d.]/g, '')) || 0,
      rating: item.rating || 0,
      reviews: item.reviews || 0,
      link: item.link || item.product_link || '#',
      source: item.source || 'Unknown',
      thumbnail: item.thumbnail || null
    }))
  } catch (error: any) {
    console.error('❌ MarketMind SerpAPI error:', error?.message)
    return []
  }
}

// ==================== RANKING ENGINE ====================

function rankProducts(products: ShoppingProduct[]): ShoppingProduct[] {
  if (products.length === 0) return []

  // Calculate scores
  const scored = products.map(p => {
    const rating = p.rating || 0
    const reviews = p.reviews || 0
    const price = p.extracted_price || parseFloat((p.price || '0').replace(/[^\d.]/g, '')) || 0

    // Composite score:
    //   - Rating contributes 50% weight
    //   - Log of reviews (popularity proxy) contributes 30%
    //   - Lower price slightly preferred (20% weight, inverse)
    const score =
      rating * 0.5 +
      Math.log(reviews + 1) * 0.3 -
      price * 0.0001

    return { ...p, score: Math.round(score * 100) / 100 }
  })

  // Normalize scores to 0–10 scale for display
  const maxScore = Math.max(...scored.map(p => p.score || 0))
  const minScore = Math.min(...scored.map(p => p.score || 0))
  const range = maxScore - minScore || 1

  return scored
    .map(p => ({
      ...p,
      score: Math.round(((((p.score || 0) - minScore) / range) * 7 + 3) * 10) / 10 // Scale to 3.0–10.0
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
}

function findBestBudget(products: ShoppingProduct[]): ShoppingProduct | null {
  // Best budget = highest rating among the bottom 40% by price
  const sorted = [...products].sort(
    (a, b) => (a.extracted_price || 0) - (b.extracted_price || 0)
  )
  const budgetPool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.4)))
  return budgetPool.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || null
}

function findBestPremium(products: ShoppingProduct[]): ShoppingProduct | null {
  // Best premium = highest rating among the top 30% by price
  const sorted = [...products].sort(
    (a, b) => (b.extracted_price || 0) - (a.extracted_price || 0)
  )
  const premiumPool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.3)))
  return premiumPool.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || null
}

// ==================== RESPONSE FORMATTER (v2 — Comparison Table) ====================

/**
 * Truncate product title to keep the table clean.
 */
function truncateTitle(title: string, maxLen: number = 40): string {
  if (title.length <= maxLen) return title
  return title.substring(0, maxLen - 1) + '…'
}

/**
 * Format price for display (ensure ₹ symbol is present for INR values).
 */
function formatPrice(price: string): string {
  if (!price || price === 'N/A') return 'N/A'
  // If it already has ₹ or $ symbol, return as-is
  if (/[₹$€£]/.test(price)) return price
  // If it's a plain number, assume INR
  const num = parseFloat(price.replace(/[^\d.]/g, ''))
  if (!isNaN(num)) return `₹${num.toLocaleString('en-IN')}`
  return price
}

function formatShoppingResponse(
  query: string,
  ranked: ShoppingProduct[],
  cached: boolean
): string {
  if (ranked.length === 0) {
    return [
      `## 🛍️ MarketMind: "${query}"`,
      '',
      '❌ No products found for your search. Try refining your query with:',
      '- A specific product name (e.g., "gaming laptop")',
      '- A price range (e.g., "under 50000")',
      '- A brand name (e.g., "Samsung Galaxy")',
      '',
      '> 💡 Tip: You can say "best wireless earbuds under 3000" for better results.'
    ].join('\n')
  }

  const bestOverall = ranked[0]
  const bestBudget = findBestBudget(ranked)
  const bestPremium = findBestPremium(ranked)

  const parts: string[] = [
    `## 🛍️ MarketMind Results`,
    '',
    `**Query:** ${query}`,
    `Found **${ranked.length}** products · Ranked by quality, popularity & value`,
    cached ? '> ⚡ Cached result (saves API quota)' : '',
    '',
    '---',
    '',
    // ── Comparison Table ──
    '| Category | Product | Price | Rating | Reviews | Score | Buy |',
    '|----------|---------|-------|--------|---------|-------|-----|',
  ]

  // Best Overall (always shown)
  parts.push(formatTableRow('🥇 Best Overall', bestOverall))

  // Best Budget (only if different from overall)
  if (bestBudget && bestBudget.title !== bestOverall.title) {
    parts.push(formatTableRow('💰 Best Budget', bestBudget))
  }

  // Best Premium (only if different from overall and budget)
  if (
    bestPremium &&
    bestPremium.title !== bestOverall.title &&
    bestPremium.title !== bestBudget?.title
  ) {
    parts.push(formatTableRow('⭐ Best Premium', bestPremium))
  }

  parts.push('')

  // ── Additional Products (up to 3 more, as a simpler list) ──
  const shownTitles = new Set([
    bestOverall.title,
    bestBudget?.title,
    bestPremium?.title
  ])

  const additional = ranked
    .filter(p => !shownTitles.has(p.title))
    .slice(0, 3)

  if (additional.length > 0) {
    parts.push('---')
    parts.push('')
    parts.push('### 📋 More Options')
    parts.push('')
    parts.push('| # | Product | Price | Rating | Score | Buy |')
    parts.push('|---|---------|-------|--------|-------|-----|')
    additional.forEach((p, i) => {
      const stars = p.rating ? `⭐ ${p.rating}` : '—'
      const score = p.score ? `${p.score}/10` : '—'
      parts.push(
        `| ${i + 1} | ${truncateTitle(p.title)} | ${formatPrice(p.price)} | ${stars} | ${score} | [View →](${p.link}) |`
      )
    })
    parts.push('')
  }

  parts.push('---')
  parts.push('')
  parts.push('> 🎤 Say "compare top 2" or ask about a specific product for more details!')

  return parts.filter(Boolean).join('\n')
}

/**
 * Format a single product as a markdown table row.
 */
function formatTableRow(category: string, product: ShoppingProduct): string {
  const stars = product.rating ? `⭐ ${product.rating}` : '—'
  const reviewCount = product.reviews ? product.reviews.toLocaleString() : '—'
  const score = product.score ? `${product.score}/10` : '—'

  return `| ${category} | ${truncateTitle(product.title)} | ${formatPrice(product.price)} | ${stars} | ${reviewCount} | ${score} | [Buy →](${product.link}) |`
}

// ==================== MAIN HANDLER ====================

export async function handleShoppingQuery(
  message: string,
  userId: string = 'anonymous'
): Promise<ShoppingResult> {
  const startTime = Date.now()
  const cotSteps: string[] = []
  const sources: string[] = []

  // 1. Clean & enhance query
  const cleanedQuery = cleanShoppingQuery(message)
  cotSteps.push(`shopping_query:"${cleanedQuery}"`)
  console.log(`🛍️ MarketMind — query: "${cleanedQuery}" (from: "${message}")`)

  // 2. Check cache first
  const cachedResult = getCachedResult(cleanedQuery)
  if (cachedResult) {
    console.log(`✅ MarketMind cache hit for: "${cleanedQuery}"`)
    cotSteps.push('cache:hit')
    return cachedResult
  }
  cotSteps.push('cache:miss')

  // 3. Call SerpAPI
  let products = await searchSerpAPI(cleanedQuery)
  cotSteps.push(`serpapi_results:${products.length}`)

  // 4. ── v2: Fallback retry with enhanced query if no results ──
  if (products.length === 0) {
    const enhancedQuery = cleanedQuery.startsWith('best ')
      ? cleanedQuery.replace('best ', '') + ' online'
      : 'best ' + cleanedQuery
    console.log(`🔄 MarketMind retry with enhanced query: "${enhancedQuery}"`)
    cotSteps.push(`retry_query:"${enhancedQuery}"`)

    products = await searchSerpAPI(enhancedQuery)
    cotSteps.push(`retry_results:${products.length}`)
  }

  if (products.length === 0) {
    // Final fallback: no results even after retry
    const noResultResponse: ShoppingResult = {
      response: formatShoppingResponse(cleanedQuery, [], false),
      products: [],
      cotSteps: [...cotSteps, 'no_products_found'],
      sources: [],
      cached: false
    }
    return noResultResponse
  }

  // 5. Rank products
  const ranked = rankProducts(products)
  cotSteps.push(`ranked:${ranked.length}`)

  // Collect buy links as sources
  ranked.slice(0, 6).forEach(p => {
    if (p.link && p.link !== '#') sources.push(p.link)
  })

  // 6. Format response (v2 comparison table)
  const response = formatShoppingResponse(cleanedQuery, ranked, false)
  cotSteps.push(`response_time:${Date.now() - startTime}ms`)

  const result: ShoppingResult = {
    response,
    products: ranked,
    cotSteps,
    sources,
    cached: false
  }

  // 7. Cache for future queries
  setCachedResult(cleanedQuery, result)
  cotSteps.push('cached:true')

  return result
}

// ==================== STATISTICS ====================

interface MarketMindStats {
  totalQueries: number
  cacheHits: number
  cacheMisses: number
  cacheSize: number
  apiCallsSaved: number
}

let queryCount = 0
let cacheHitCount = 0

export function recordShoppingQuery(cached: boolean): void {
  queryCount++
  if (cached) cacheHitCount++
}

export function getMarketMindStats(): MarketMindStats {
  return {
    totalQueries: queryCount,
    cacheHits: cacheHitCount,
    cacheMisses: queryCount - cacheHitCount,
    cacheSize: shoppingCache.size,
    apiCallsSaved: cacheHitCount
  }
}

// ==================== EXPORT ====================

export default {
  isShoppingIntent,
  handleShoppingQuery,
  recordShoppingQuery,
  getMarketMindStats
}
