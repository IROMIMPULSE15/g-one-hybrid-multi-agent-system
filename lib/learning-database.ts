/**
 * Local Learning Database for V64 G-One
 * Stores user interactions for continuous learning
 * Uses SQLite for unlimited storage (no Pinecone character limits)
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { generateEmbedding } from '../app/api/voice-assistant/embeddings'

// Database path
const DB_DIR = path.join(process.cwd(), 'data', 'learning')
const DB_PATH = path.join(DB_DIR, 'knowledge.db')

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
}

// Initialize database
let db: Database.Database | null = null

function getDB(): Database.Database {
    if (!db) {
        db = new Database(DB_PATH)
        initializeSchema()
    }
    return db
}

function initializeSchema() {
    if (!db) return

    // Create tables
    db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      response TEXT NOT NULL,
      query_embedding TEXT, -- JSON array of embedding
      response_type TEXT, -- 'general', 'deepsearch', 'medical', etc.
      confidence REAL DEFAULT 1.0,
      feedback INTEGER DEFAULT 0, -- User feedback: -1 (bad), 0 (neutral), 1 (good)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      accessed_count INTEGER DEFAULT 0,
      last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_response_type ON conversations(response_type);
    CREATE INDEX IF NOT EXISTS idx_created_at ON conversations(created_at);
    CREATE INDEX IF NOT EXISTS idx_confidence ON conversations(confidence);

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      embedding TEXT, -- JSON array of embedding
      tags TEXT, -- JSON array of tags
      priority TEXT DEFAULT 'medium', -- low, medium, high, critical
      source TEXT, -- 'user_interaction', 'training_data', 'manual'
      relevance_score REAL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      accessed_count INTEGER DEFAULT 0,
      last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_category ON knowledge_base(category);
    CREATE INDEX IF NOT EXISTS idx_priority ON knowledge_base(priority);
    CREATE INDEX IF NOT EXISTS idx_source ON knowledge_base(source);

    CREATE TABLE IF NOT EXISTS learning_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      metadata TEXT, -- JSON object
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_metric_name ON learning_stats(metric_name);
  `)

    console.log('✅ Learning database initialized')
}

// ==================== CONVERSATION STORAGE ====================

export interface ConversationEntry {
    userId: string
    query: string
    response: string
    responseType: 'general' | 'deepsearch' | 'medical' | 'wikipedia' | 'greeting'
    confidence?: number
    feedback?: number
}

export async function storeConversation(entry: ConversationEntry): Promise<number> {
    const database = getDB()

    try {
        // Generate embedding for the query
        const embedding = await generateEmbedding(entry.query)
        const embeddingJSON = JSON.stringify(embedding)

        const stmt = database.prepare(`
      INSERT INTO conversations (user_id, query, response, query_embedding, response_type, confidence, feedback)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

        const result = stmt.run(
            entry.userId,
            entry.query,
            entry.response,
            embeddingJSON,
            entry.responseType,
            entry.confidence || 1.0,
            entry.feedback || 0
        )

        console.log(`📝 Stored conversation #${result.lastInsertRowid} for user ${entry.userId}`)
        return result.lastInsertRowid as number
    } catch (error) {
        console.error('❌ Failed to store conversation:', error)
        return -1
    }
}

// ==================== KNOWLEDGE RETRIEVAL ====================

export interface KnowledgeSearchResult {
    id: number
    content: string
    category: string
    similarity: number
    tags: string[]
    priority: string
    source: string
    accessCount: number
}

export async function searchKnowledge(
    query: string,
    options: {
        limit?: number
        minSimilarity?: number
        categories?: string[]
        responseType?: string
        userId?: string
    } = {}
): Promise<KnowledgeSearchResult[]> {
    const database = getDB()
    const {
        limit = 10,
        minSimilarity = 0.5,
        categories = [],
        responseType,
        userId
    } = options

    try {
        // Generate query embedding
        const queryEmbedding = await generateEmbedding(query)

        // Build SQL query
        let sql = `SELECT * FROM conversations WHERE 1=1`
        const params: any[] = []

        if (userId) {
            sql += ` AND user_id = ?`
            params.push(userId)
        }

        if (responseType) {
            sql += ` AND response_type = ?`
            params.push(responseType)
        }

        sql += ` ORDER BY created_at DESC LIMIT 1000` // Get recent conversations

        const stmt = database.prepare(sql)
        const rows = stmt.all(...params) as any[]

        // Calculate similarities
        const results: KnowledgeSearchResult[] = []

        for (const row of rows) {
            if (!row.query_embedding) continue

            try {
                const rowEmbedding = JSON.parse(row.query_embedding)
                const similarity = cosineSimilarity(queryEmbedding, rowEmbedding)

                if (similarity >= minSimilarity) {
                    results.push({
                        id: row.id,
                        content: row.response,
                        category: row.response_type,
                        similarity,
                        tags: [row.response_type],
                        priority: row.confidence > 0.8 ? 'high' : 'medium',
                        source: 'user_interaction',
                        accessCount: row.accessed_count
                    })
                }
            } catch (err) {
                // Skip invalid embeddings
                continue
            }
        }

        // Sort by similarity and limit
        results.sort((a, b) => b.similarity - a.similarity)
        const topResults = results.slice(0, limit)

        // Update access counts
        if (topResults.length > 0) {
            const ids = topResults.map(r => r.id).join(',')
            database.exec(`
        UPDATE conversations 
        SET accessed_count = accessed_count + 1, last_accessed = CURRENT_TIMESTAMP
        WHERE id IN (${ids})
      `)
        }

        console.log(`🔍 Found ${topResults.length} relevant conversations (min similarity: ${minSimilarity})`)
        return topResults
    } catch (error) {
        console.error('❌ Knowledge search failed:', error)
        return []
    }
}

// ==================== DEEPSEARCH STORAGE ====================

export async function storeDeepSearchResult(
    userId: string,
    query: string,
    response: string,
    webContext: string
): Promise<number> {
    const database = getDB()

    try {
        // Store in knowledge base for future reference
        const embedding = await generateEmbedding(query)
        const embeddingJSON = JSON.stringify(embedding)

        const stmt = database.prepare(`
      INSERT INTO knowledge_base (content, category, embedding, tags, priority, source, relevance_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

        const tags = JSON.stringify(['deepsearch', 'web', 'synthesis'])
        const result = stmt.run(
            `Query: ${query}\n\nResponse: ${response}\n\nWeb Context: ${webContext.substring(0, 500)}`,
            'deepsearch',
            embeddingJSON,
            tags,
            'high',
            'deepsearch',
            1.0
        )

        // Also store in conversations
        await storeConversation({
            userId,
            query,
            response,
            responseType: 'deepsearch',
            confidence: 1.0
        })

        console.log(`💾 Stored DeepSearch result #${result.lastInsertRowid}`)
        return result.lastInsertRowid as number
    } catch (error) {
        console.error('❌ Failed to store DeepSearch result:', error)
        return -1
    }
}

// ==================== LEARNING ANALYTICS ====================

export function getLearningStats() {
    const database = getDB()

    const stats = {
        totalConversations: 0,
        totalKnowledge: 0,
        conversationsByType: {} as Record<string, number>,
        averageConfidence: 0,
        topUsers: [] as Array<{ userId: string; count: number }>,
        recentGrowth: 0
    }

    try {
        // Total conversations
        const totalConv = database.prepare('SELECT COUNT(*) as count FROM conversations').get() as any
        stats.totalConversations = totalConv.count

        // Total knowledge base entries
        const totalKB = database.prepare('SELECT COUNT(*) as count FROM knowledge_base').get() as any
        stats.totalKnowledge = totalKB.count

        // Conversations by type
        const byType = database.prepare(`
      SELECT response_type, COUNT(*) as count 
      FROM conversations 
      GROUP BY response_type
    `).all() as any[]

        byType.forEach(row => {
            stats.conversationsByType[row.response_type] = row.count
        })

        // Average confidence
        const avgConf = database.prepare('SELECT AVG(confidence) as avg FROM conversations').get() as any
        stats.averageConfidence = avgConf.avg || 0

        // Top users
        const topUsers = database.prepare(`
      SELECT user_id, COUNT(*) as count 
      FROM conversations 
      GROUP BY user_id 
      ORDER BY count DESC 
      LIMIT 10
    `).all() as any[]

        stats.topUsers = topUsers.map(row => ({
            userId: row.user_id,
            count: row.count
        }))

        // Recent growth (last 24 hours)
        const recentGrowth = database.prepare(`
      SELECT COUNT(*) as count 
      FROM conversations 
      WHERE created_at >= datetime('now', '-1 day')
    `).get() as any
        stats.recentGrowth = recentGrowth.count

        return stats
    } catch (error) {
        console.error('❌ Failed to get learning stats:', error)
        return stats
    }
}

// ==================== FEEDBACK SYSTEM ====================

export function updateFeedback(conversationId: number, feedback: -1 | 0 | 1): boolean {
    const database = getDB()

    try {
        const stmt = database.prepare(`
      UPDATE conversations 
      SET feedback = ?, confidence = confidence + (? * 0.1)
      WHERE id = ?
    `)

        stmt.run(feedback, feedback, conversationId)
        console.log(`👍 Updated feedback for conversation #${conversationId}: ${feedback}`)
        return true
    } catch (error) {
        console.error('❌ Failed to update feedback:', error)
        return false
    }
}

// ==================== UTILITY FUNCTIONS ====================

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

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

    if (magnitudeA === 0 || magnitudeB === 0) return 0

    return dotProduct / (magnitudeA * magnitudeB)
}

// ==================== CLEANUP ====================

export function closeDatabase() {
    if (db) {
        db.close()
        db = null
        console.log('🔒 Learning database closed')
    }
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
    process.on('exit', closeDatabase)
    process.on('SIGINT', () => {
        closeDatabase()
        process.exit(0)
    })
}

export default {
    storeConversation,
    searchKnowledge,
    storeDeepSearchResult,
    getLearningStats,
    updateFeedback,
    closeDatabase
}
