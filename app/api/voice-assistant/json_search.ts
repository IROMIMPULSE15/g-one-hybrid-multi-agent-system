import { generateEmbedding, cosineSimilarity } from './embeddings'
import fs from 'fs/promises'
import path from 'path'

export type SearchMatch = {
  id?: string
  score?: number
  text?: string
  metadata?: Record<string, unknown>
}

export type SearchResult = {
  matches: SearchMatch[]
  total: number
}

// Cache for loaded training data
interface TrainingEntry {
  human: string
  robot: string
  embedding?: number[]
}

let cachedTrainingData: TrainingEntry[] | null = null
let lastLoadTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const EMBEDDING_BATCH_SIZE = 100 // Generate embeddings in batches

/**
 * Load and cache training data from JSON file
 */
async function loadTrainingData(): Promise<TrainingEntry[]> {
  const now = Date.now()

  // Return cached data if still valid
  if (cachedTrainingData && (now - lastLoadTime) < CACHE_TTL) {
    return cachedTrainingData as TrainingEntry[]
  }

  try {
    const dataPath = path.join(process.cwd(), 'data', 'human_vs_robot.json')
    const rawData = await fs.readFile(dataPath, 'utf-8')
    cachedTrainingData = JSON.parse(rawData) as TrainingEntry[]
    lastLoadTime = now

    console.log(`📚 Loaded ${cachedTrainingData.length} training examples from JSON`)
    return cachedTrainingData
  } catch (error) {
    console.error('❌ Failed to load training data:', error)
    cachedTrainingData = []
    return []
  }
}

/**
 * Search training data using semantic similarity
 * @param query - User query
 * @param limit - Maximum number of results (default: 5)
 * @param minSimilarity - Minimum similarity threshold (default: 0.5)
 */
export async function searchTrainedData(
  query: string,
  limit: number = 5,
  minSimilarity: number = 0.5
): Promise<SearchResult> {
  try {
    // Load training data
    const trainingData = await loadTrainingData()

    if (trainingData.length === 0) {
      return { matches: [], total: 0 }
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query)

    // Calculate similarities and find matches
    const results: SearchMatch[] = []
    let processedCount = 0

    for (const item of trainingData) {
      // Generate embedding on-demand if not cached (lazy loading)
      if (!item.embedding) {
        item.embedding = await generateEmbedding(item.human)
      }

      // Calculate similarity
      const similarity = cosineSimilarity(queryEmbedding, item.embedding)

      // Only include results above threshold
      if (similarity >= minSimilarity) {
        results.push({
          id: `training_${processedCount}`,
          score: similarity,
          text: item.robot,
          metadata: {
            query: item.human,
            similarity: similarity.toFixed(4),
            source: 'training_data'
          }
        })
      }

      processedCount++

      // Log progress for large datasets
      if (processedCount % 1000 === 0) {
        console.log(`🔍 Processed ${processedCount}/${trainingData.length} training examples...`)
      }
    }

    // Sort by similarity (descending) and limit results
    results.sort((a, b) => (b.score || 0) - (a.score || 0))
    const topResults = results.slice(0, limit)

    console.log(`✅ Found ${topResults.length} relevant training examples (min similarity: ${minSimilarity})`)

    return {
      matches: topResults,
      total: topResults.length
    }
  } catch (error) {
    console.error('❌ JSON search failed:', error)
    return { matches: [], total: 0 }
  }
}

/**
 * Fast keyword-based search (fallback when embeddings are slow)
 * @param query - User query
 * @param limit - Maximum number of results
 */
export async function searchTrainedDataKeyword(
  query: string,
  limit: number = 5
): Promise<SearchResult> {
  try {
    const trainingData = await loadTrainingData()

    if (trainingData.length === 0) {
      return { matches: [], total: 0 }
    }

    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

    const results: SearchMatch[] = []

    for (let i = 0; i < trainingData.length; i++) {
      const item = trainingData[i]
      const humanLower = item.human.toLowerCase()

      // Calculate keyword match score
      let matchScore = 0
      for (const word of queryWords) {
        if (humanLower.includes(word)) {
          matchScore += 1
        }
      }

      // Exact match bonus
      if (humanLower === queryLower) {
        matchScore += 10
      }

      if (matchScore > 0) {
        results.push({
          id: `training_kw_${i}`,
          score: matchScore / queryWords.length, // Normalize score
          text: item.robot,
          metadata: {
            query: item.human,
            matchScore,
            source: 'training_data_keyword'
          }
        })
      }
    }

    // Sort by score and limit
    results.sort((a, b) => (b.score || 0) - (a.score || 0))
    const topResults = results.slice(0, limit)

    console.log(`✅ Keyword search found ${topResults.length} matches`)

    return {
      matches: topResults,
      total: topResults.length
    }
  } catch (error) {
    console.error('❌ Keyword search failed:', error)
    return { matches: [], total: 0 }
  }
}

export default searchTrainedData

// Backwards-compatible wrapper for older callers that expect { found, response }
export async function searchTrainedDataLegacy(query: string) {
  const res = await searchTrainedData(query, 5, 0.5)
  return {
    found: res.total > 0,
    response: res.total > 0 ? res.matches.map(m => m.text).join('\n') : undefined,
    entries: res.matches,
  }
}

