import { generateWithProvider, isProviderConfigured } from "./llm_provider";
import axios from "axios";
import { storeDeepSearchResult, searchKnowledge } from "../../../lib/learning-database";

export async function handleDeepSearchQuery(
  query: string,
  userPlan: string = 'Free',
  userId: string = 'anonymous'
): Promise<{
  response: string
  ragResults?: any
  cotSteps?: string[]
}> {
  console.log(`🔍 Processing Deep Search query: "${query}" (${userPlan} plan, user: ${userId})...`);

  const cotSteps: string[] = [];

  try {
    // 1. Check local knowledge base first (continuous learning)
    console.log('🧠 Searching local knowledge base...');
    cotSteps.push('Searching local knowledge base for similar queries');

    const localResults = await searchKnowledge(query, {
      limit: 3,
      minSimilarity: 0.7,
      responseType: 'deepsearch',
      userId
    });

    if (localResults.length > 0) {
      console.log(`✅ Found ${localResults.length} similar queries in local knowledge base`);
      cotSteps.push(`Found ${localResults.length} similar previous DeepSearch results`);
    }

    // 2. Perform enhanced web search (ALWAYS do this to ensure freshness)
    console.log('🌐 Fetching deep web results...');
    cotSteps.push('Fetching fresh web context from DuckDuckGo');

    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const serp = await axios.get(searchUrl, { timeout: 8000 });

    let snippets = "";
    const relatedTopics = serp.data.RelatedTopics || [];
    const abstract = serp.data.AbstractText || "";

    if (abstract) {
      snippets += `Abstract: ${abstract}\n\n`;
    }

    if (relatedTopics.length > 0) {
      snippets += "Related Topics:\n" + relatedTopics.slice(0, 8).map((t: any) => `- ${t.Text}`).join("\n");
    }

    if (!snippets) {
      snippets = "No direct snippets found. Relying on internal knowledge base synthesis.";
    }

    cotSteps.push(`Retrieved ${relatedTopics.length} related topics from web`);

    // 3. Construct "Deep Search" prompt with enhanced structure AND reference context

    // Prepare reference context from local results
    let referenceContext = "";
    if (localResults.length > 0) {
      const topResult = localResults[0];
      if (topResult.similarity > 0.75) {
        referenceContext = `
PREVIOUS ANSWER (Reference Only):
The following answer was given to a similar question ("${topResult.content.split('\n')[0].substring(0, 100)}...") in the past.
Use this structure and depth as a guide, BUT RE-VERIFY ALL FACTS against the new Web Context.
If the previous answer contains outdated information (dates, versions, prices, events), YOU MUST UPDATE IT.

--- START PREVIOUS ANSWER ---
${topResult.content.substring(0, 1500)}
--- END PREVIOUS ANSWER ---
`;
        cotSteps.push(`Using previous answer as reference context (Similarity: ${(topResult.similarity * 100).toFixed(1)}%)`);
      }
    }

    const prompt = `You are a Deep Search Agent, an advanced AI capable of producing comprehensive, academic-grade, and highly structured responses.

CONTEXT:
User Query: "${query}"

CURRENT WEB CONTEXT (Fresh Data):
${snippets}
${referenceContext}

INSTRUCTIONS:
1.  **Analyze** the query deeply. Explore the "why" and "how".
2.  **Reference Check**: If a "PREVIOUS ANSWER" is provided above:
    *   Use its **structure and tone** as a high-quality benchmark.
    *   **CRITICAL**: Check for OUTDATED information. If the Web Context contradicts the Previous Answer, the Web Context is truth.
    *   Explicitly mention if you are updating an older perspective based on new data.
3.  **Structure** your response using the following format:
    *   **Executive Summary**: A high-level overview of the topic (2-3 sentences).
    *   **Key Pillars/Components**: Break down the topic into its core elements (use bullet points or numbered lists).
    *   **Context & Landscape**: Explain the broader context (e.g., historical background, current state, future trends).
    *   **Strategic Insights**: Provide synthesized insights that are not immediately obvious.
    *   **Practical Applications**: Real-world use cases or examples.
    *   **Conclusion**: A final wrapping thought.
4.  **Tone**: Professional, authoritative, clear, and "heavy" with information (dense but readable).
5.  **Formatting**: Use Markdown headers (##), bolding (**text**), and lists significantly to improve readability.
6.  **Synthesis**: Combine web context with any previous insights to create a comprehensive, up-to-date answer.

Generate the Deep Search response now.`;

    cotSteps.push('Generating comprehensive response using LLM');

    // 4. Generate response using LLM
    let responseText = "";
    let provider = "fallback";

    if (isProviderConfigured()) {
      try {
        const aiResult = await generateWithProvider(prompt, {
          maxTokens: 3000, // Increased token limit for comprehensive response
          temperature: 0.4, // Lower temperature for more focused/deterministic output
          model: process.env.LLM_MODEL
        });

        provider = (aiResult as any)?.provider || 'fallback';
        responseText = (aiResult as any)?.text || "";
        cotSteps.push(`Generated response using ${provider} LLM`);
      } catch (e) {
        console.warn('DeepSearch LLM failed, falling back to basic summary:', e);
        cotSteps.push('LLM generation failed, using fallback');
      }
    }

    // Fallback if LLM fails or is not configured
    if (!responseText) {
      responseText = `**Deep Search Results**\n\nI was unable to perform a full deep synthesis at this moment, but here is the information I found:\n\n${snippets}\n\nPlease try again later for a comprehensive analysis.`;
      cotSteps.push('Using fallback response due to LLM unavailability');
    }

    // 5. Store in local learning database for future use
    console.log('💾 Storing DeepSearch result in local knowledge base...');
    await storeDeepSearchResult(userId, query, responseText, snippets);
    cotSteps.push('Stored result in local knowledge base for future learning');

    // 6. Return structured result
    return {
      response: responseText,
      ragResults: {
        entries: [{
          id: 'deepsearch_result',
          content: snippets.substring(0, 500) + "...",
          category: 'deepsearch',
          timestamp: new Date(),
          tags: ['deepsearch', 'web', 'synthesis', 'local_storage'],
          priority: 'high',
          relevanceScore: 1.0,
          accessCount: 1,
          lastAccessed: new Date()
        }],
        totalRelevance: 1.0,
        categories: ['deepsearch'],
        searchQuery: query,
        processingTime: 0
      },
      cotSteps
    };

  } catch (error: any) {
    console.error("Deep Search Error:", error);
    cotSteps.push(`Error: ${error.message}`);

    return {
      response: "I encountered an error while performing the Deep Search. Please try again.",
      ragResults: { entries: [], totalRelevance: 0, categories: [], searchQuery: query, processingTime: 0 },
      cotSteps
    };
  }
}

// Keep POST for backward compatibility if needed, but wrapped
import { NextResponse } from "next/server";
export async function POST(req: Request) {
  try {
    const { query, userId = 'anonymous', userPlan = 'Free' } = await req.json();
    if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

    const result = await handleDeepSearchQuery(query, userPlan, userId);
    return NextResponse.json({ success: true, type: "deepsearch", ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Deep search failed." });
  }
}
