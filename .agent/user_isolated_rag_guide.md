# User-Isolated RAG Implementation Guide

**Problem:** RAG system currently shares knowledge across all users, causing privacy issues.

**Goal:** Isolate user data so User A's conversations are NOT visible to User B.

---

## 🎯 **Implementation Approach**

### **Option 1: Metadata Filtering (Recommended) ⭐**

Add `userId` to Pinecone metadata and filter queries by user.

#### **Pros:**
- ✅ Single index for all users
- ✅ Easy to implement
- ✅ Cost-effective
- ✅ Fast queries with metadata filtering

#### **Cons:**
- ⚠️ Requires Pinecone metadata filtering support
- ⚠️ All user data in same index (less isolation)

---

### **Option 2: Namespace Isolation**

Use Pinecone namespaces to separate user data.

#### **Pros:**
- ✅ Strong isolation
- ✅ Easy to delete user data
- ✅ Better privacy

#### **Cons:**
- ⚠️ Requires Pinecone paid plan (namespaces not in free tier)
- ⚠️ More complex queries

---

### **Option 3: Separate Indexes per User**

Create separate Pinecone index for each user.

#### **Pros:**
- ✅ Complete isolation
- ✅ Maximum privacy

#### **Cons:**
- ❌ Very expensive (each index costs money)
- ❌ Not scalable
- ❌ Complex management

---

## 📝 **Recommended: Metadata Filtering Implementation**

### **Step 1: Modify `addToKnowledgeBase()` to Include userId**

**Current Code (route.ts, line 425-470):**
```typescript
async function addToKnowledgeBase(
  content: string,
  category: string,
  tags: string[] = [],
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<void> {
  // ... code ...
  
  const vectors = [{
    id,
    values: embedding,
    metadata: {
      content,
      category,
      tags,
      priority,
      timestamp: new Date().toISOString()
      // ❌ Missing userId!
    }
  }]
}
```

**Updated Code:**
```typescript
async function addToKnowledgeBase(
  content: string,
  category: string,
  tags: string[] = [],
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  userId: string = 'anonymous'  // ✅ ADD THIS
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
        userId: userId  // ✅ ADD THIS - Critical for user isolation
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
```

---

### **Step 2: Modify `enhancedRAGSearch()` to Filter by userId**

**Current Code (route.ts, line 472-585):**
```typescript
async function enhancedRAGSearch(query: string, limit: number = CONFIG.RAG_TOP_K): Promise<RAGResult> {
  // ... code ...
  
  try {
    results = await idx.query({
      vector: queryEmbedding,
      topK: currentLimit,
      includeMetadata: true
      // ❌ No user filtering!
    })
  } catch (errQuery) {
    // ... error handling ...
  }
}
```

**Updated Code:**
```typescript
async function enhancedRAGSearch(
  query: string, 
  limit: number = CONFIG.RAG_TOP_K,
  userId: string = 'anonymous'  // ✅ ADD THIS
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
            userId: { $eq: userId }  // ✅ ADD THIS - Only return this user's data
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
                userId: { $eq: userId }  // ✅ ADD THIS
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
```

---

### **Step 3: Update All Calls to Pass userId**

#### **3a. Update `callEnhancedLlamaWithCoTAndRAG()`**

**Current:**
```typescript
async function callEnhancedLlamaWithCoTAndRAG(
  userMessage: string,
  context: ConversationContext
): Promise<{...}> {
  console.log('🧠 Starting Enhanced LLM processing with CoT and RAG...')

  const ragResults = await enhancedRAGSearch(userMessage, CONFIG.RAG_TOP_K)
  // ❌ No userId passed
}
```

**Updated:**
```typescript
async function callEnhancedLlamaWithCoTAndRAG(
  userMessage: string,
  context: ConversationContext,
  userId: string = 'anonymous'  // ✅ ADD THIS
): Promise<{...}> {
  console.log('🧠 Starting Enhanced LLM processing with CoT and RAG...')

  const ragResults = await enhancedRAGSearch(userMessage, CONFIG.RAG_TOP_K, userId)
  // ✅ Pass userId
  
  // ... rest of code ...
  
  // When storing to knowledge base:
  addToKnowledgeBase(
    `Q: ${userMessage}\nA: ${text}`,
    'conversation',
    ['user_interaction', context.userMood],
    'medium',
    userId  // ✅ Pass userId
  ).catch(err => console.warn('⚠️ Failed to update knowledge base:', err))
}
```

#### **3b. Update POST Handler**

**Current (route.ts, line ~1427):**
```typescript
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const startTime = Date.now()

  try {
    console.log('🚀 Enhanced API request received')

    const requestBody = await request.json()
    const message = requestBody.message as string
    const manualMode = typeof requestBody.mode === 'string' ? requestBody.mode.toLowerCase() : undefined
    const userId = requestBody.userId || 'anonymous'
    // ✅ userId is already extracted!
    
    // ... but not passed to functions ❌
    
    response = await processEnhancedUserMessage(message)
    // ❌ Should be: processEnhancedUserMessage(message, userId)
  }
}
```

**Updated:**
```typescript
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const startTime = Date.now()

  try {
    console.log('🚀 Enhanced API request received')

    const requestBody = await request.json()
    const message = requestBody.message as string
    const manualMode = typeof requestBody.mode === 'string' ? requestBody.mode.toLowerCase() : undefined
    const userId = requestBody.userId || 'anonymous'  // ✅ Extract userId
    const sessionId = requestBody.sessionId

    // ... validation code ...

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
      response = await processEnhancedUserMessage(message, userId)  // ✅ Pass userId
      response.mode = activeMode
    }

    // ... rest of code ...
  }
}
```

#### **3c. Update `processEnhancedUserMessage()`**

**Current:**
```typescript
async function processEnhancedUserMessage(message: string): Promise<ApiResponse> {
  // ... code ...
  
  const aiResponse = await callEnhancedLlamaWithCoTAndRAG(message, conversationContext)
  // ❌ No userId
}
```

**Updated:**
```typescript
async function processEnhancedUserMessage(
  message: string,
  userId: string = 'anonymous'  // ✅ ADD THIS
): Promise<ApiResponse> {
  const startTime = Date.now()

  try {
    console.log(`📝 Processing message for user ${userId}: "${message.substring(0, 50)}..."`)

    const sentimentAnalysis = enhancedSentimentAnalysis(message)
    conversationContext.userMood = sentimentAnalysis.sentiment

    // ... other code ...

    try {
      console.log('🤖 Starting enhanced AI processing...')
      const aiResponse = await callEnhancedLlamaWithCoTAndRAG(
        message, 
        conversationContext,
        userId  // ✅ Pass userId
      )

      updateConversationHistory(message, sentimentAnalysis)

      // ... rest of code ...
    }
  }
}
```

---

## 🔒 **Privacy Benefits**

### **Before (Shared RAG):**
```
User A (ID: user_123): "My name is Alice"
  ↓ Stored in Pinecone without userId
  
User B (ID: user_456): "hello"
  ↓ RAG searches ALL vectors
  ↓ Finds Alice's conversation
  ↓ Response: "Hello Alice!" ❌ PRIVACY VIOLATION
```

### **After (User-Isolated RAG):**
```
User A (ID: user_123): "My name is Alice"
  ↓ Stored with metadata: { userId: "user_123", content: "..." }
  
User B (ID: user_456): "hello"
  ↓ RAG searches with filter: { userId: "user_456" }
  ↓ Only finds User B's conversations
  ↓ Response: "Hello! How can I help?" ✅ CORRECT
```

---

## 📋 **Implementation Checklist**

- [ ] **Step 1:** Add `userId` parameter to `addToKnowledgeBase()`
- [ ] **Step 2:** Add `userId` parameter to `enhancedRAGSearch()`
- [ ] **Step 3:** Add `userId` parameter to `callEnhancedLlamaWithCoTAndRAG()`
- [ ] **Step 4:** Add `userId` parameter to `processEnhancedUserMessage()`
- [ ] **Step 5:** Update POST handler to pass `userId` through the call chain
- [ ] **Step 6:** Update all `addToKnowledgeBase()` calls to include `userId`
- [ ] **Step 7:** Test with multiple users to verify isolation
- [ ] **Step 8:** (Optional) Add user data deletion endpoint

---

## 🧪 **Testing Plan**

### **Test 1: User Isolation**
```typescript
// User A
POST /api/voice-assistant
{
  "message": "My name is Alice",
  "userId": "user_123"
}
// Expected: "Nice to meet you, Alice!"

// User B
POST /api/voice-assistant
{
  "message": "hello",
  "userId": "user_456"
}
// Expected: "Hello! How can I help?" (NOT "Hello Alice!")
```

### **Test 2: Same User Continuity**
```typescript
// User A - First message
POST /api/voice-assistant
{
  "message": "My name is Alice",
  "userId": "user_123"
}

// User A - Second message
POST /api/voice-assistant
{
  "message": "hello",
  "userId": "user_123"
}
// Expected: "Hello Alice!" ✅ (Should remember from RAG)
```

---

## 🚀 **Additional Enhancements**

### **1. User Data Deletion (GDPR Compliance)**
```typescript
async function deleteUserData(userId: string): Promise<void> {
  const pine = await initializePinecone()
  if (!pine) return

  const indexName = process.env.PINECONE_INDEX || 'voice-assistant-knowledge'
  const idx = pine.Index(indexName)

  // Delete all vectors for this user
  await idx.delete({
    filter: {
      userId: { $eq: userId }
    }
  })

  console.log(`✅ Deleted all data for user: ${userId}`)
}
```

### **2. Shared Knowledge Base (Optional)**
Some knowledge should be shared across all users (e.g., general facts):

```typescript
async function addToKnowledgeBase(
  content: string,
  category: string,
  tags: string[] = [],
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  userId: string = 'anonymous',
  isShared: boolean = false  // ✅ New parameter
): Promise<void> {
  // ... code ...
  
  const vectors = [{
    id,
    values: embedding,
    metadata: {
      content,
      category,
      tags,
      priority,
      timestamp: new Date().toISOString(),
      userId: isShared ? 'SHARED' : userId,  // ✅ Use special "SHARED" userId
      isShared: isShared
    }
  }]
}

// Then in RAG search:
async function enhancedRAGSearch(
  query: string, 
  limit: number = CONFIG.RAG_TOP_K,
  userId: string = 'anonymous'
): Promise<RAGResult> {
  // ... code ...
  
  results = await idx.query({
    vector: queryEmbedding,
    topK: currentLimit,
    includeMetadata: true,
    filter: {
      $or: [
        { userId: { $eq: userId } },        // User's own data
        { userId: { $eq: 'SHARED' } }       // Shared knowledge
      ]
    }
  })
}
```

---

## 📊 **Summary**

**Current State:** ❌ All users share same RAG knowledge base  
**Target State:** ✅ Each user has isolated knowledge base  

**Implementation:**
1. Add `userId` to Pinecone metadata
2. Filter RAG queries by `userId`
3. Pass `userId` through entire call chain
4. Test user isolation

**Estimated Time:** 2-3 hours  
**Complexity:** Medium  
**Impact:** High (Critical for privacy)

---

## ⚠️ **Important Notes**

1. **Existing Data:** Old vectors without `userId` will need migration or deletion
2. **Performance:** Metadata filtering is fast but adds slight overhead
3. **Pinecone Limits:** Free tier supports metadata filtering
4. **Testing:** Thoroughly test with multiple users before production

Would you like me to implement this for you?
