import axios from 'axios';

// ==================== TYPES ====================

export interface BriefExplanation {
    briefAnswer: string;
    wikipediaExtract: string | null;
    wikipediaUrl: string | null;
    wikipediaTitle: string | null;
    confidence: number;
    topic: string;
    success: boolean;
}

// ==================== WIKIPEDIA INTEGRATION ====================

async function fetchWikipediaSummary(topic: string): Promise<{
    extract: string | null;
    url: string | null;
    title: string | null;
}> {
    try {
        // Clean the topic for Wikipedia search
        const cleanTopic = topic
            .replace(/^(what is|who is|explain|tell me about|describe)\s+/i, '')
            .replace(/\?+$/g, '')
            .trim();

        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTopic)}`;

        const response = await axios.get(wikiUrl, {
            timeout: 5000,
            headers: {
                'User-Agent': 'VoiceAssistant/2.0 (Educational Purpose)'
            }
        });

        if (response.data && response.data.extract) {
            return {
                extract: response.data.extract,
                url: response.data.content_urls?.desktop?.page || null,
                title: response.data.title || cleanTopic
            };
        }

        return { extract: null, url: null, title: null };
    } catch (error) {
        console.warn('⚠️ Wikipedia fetch failed:', (error as any)?.message);
        return { extract: null, url: null, title: null };
    }
}

// ==================== BRIEF EXPLANATION DETECTOR ====================

export function isBriefExplanationQuery(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();



    // EXCLUSIONS: specific patterns that should NOT be handled by brief explainer
    // verifiable facts only, not opinions or complex instructions
    const exclusionPatterns = [
        /\b(should|would|do) i (buy|get|use|choose)\b/i, // Advice
        /\b(best|top|worst|vs|versus|compare|better)\b/i, // Comparisons
        /\bhow\s+(to|do|can)\b/i, // Instructions
        /\brecommend\b/i, // Recommendations
        /\bopinion\b/i, // Opinions
        /\breview\b/i, // Reviews
        /\b(list|top|best|steps|ways|reasons|examples)\b/i, // Lists/Enumerations
        /\d+/ // Numbers (e.g. "10 animes") usually imply a list or specific count incompatible with "brief" summary
    ];

    if (exclusionPatterns.some(pattern => pattern.test(lowerMessage))) {
        return false;
    }

    // Check for explicit "briefly" requests only
    // General "explain X" queries will fall through to the main AI for detailed answers
    const briefPatterns = [
        /\bexplain\s+(briefly|brief|brif|brirf|bref)\b/i,
        /\b(briefly|brief|brif|brirf|bref)\s+explain\b/i,
        /\b(briefly|brief|brif|brirf|bref)\s+me\s+about\b/i,
        /\bgive\s+me\s+a\s+(brief|quick|short)\s+summary\b/i,
        /\bsummarize\b/i,
        /\bin\s+a\s+nutshell\b/i,
        /\btl;?dr\b/i
    ];

    return briefPatterns.some(pattern => pattern.test(lowerMessage));
}

// ==================== EXTRACT TOPIC ====================

function extractTopic(message: string): string {
    let topic = message.toLowerCase().trim();

    // Remove common conversational prefixes (order matters!)
    const prefixes = [
        /^(can|could|would)\s+you\s+(please\s+)?(tell|explain)\s+(me\s+)?(about\s+)?(what\s+is\s+)?/i,
        /^(please\s+)?(tell|explain)\s+(me\s+)?(about\s+)?(briefly\s+)?(what\s+is\s+)?/i,
        /^(briefly|brief|brif|brirf|bref)\s+explain\s+/i,
        /^explain\s+(briefly|brief|brif|brirf|bref)\s+/i,
        /^what\s+is\s+/i,
        /^who\s+is\s+/i,
        /^define\s+/i,
        /^describe\s+/i,
        /^tell\s+me\s+about\s+/i,
        /^explain\s+/i
    ];

    for (const prefix of prefixes) {
        topic = topic.replace(prefix, '');
    }

    // Remove suffixes and clean up
    topic = topic
        .replace(/\?+$/g, '') // Remove question marks
        .replace(/\b(please|thanks|thank you)\b/g, '') // Remove politeness
        .trim();

    // If topic is too long, take first few words
    const words = topic.split(/\s+/);
    if (words.length > 5) {
        topic = words.slice(0, 5).join(' ');
    }

    return topic;
}

// ==================== GENERATE BRIEF EXPLANATION ====================

export async function generateBriefExplanation(
    message: string,
    llmProvider?: (prompt: string, options?: any) => Promise<any>
): Promise<BriefExplanation> {
    const topic = extractTopic(message);

    console.log(`📝 Generating brief explanation for: "${topic}"`);

    // Fetch Wikipedia data
    const wikiData = await fetchWikipediaSummary(topic);

    // Generate brief answer using LLM if available
    let briefAnswer = '';
    let confidence = 0.7;

    if (llmProvider && wikiData.extract) {
        try {
            const prompt = `You are a concise educator. Provide a BRIEF explanation (2-3 sentences maximum) for the following topic.

Topic: ${topic}

Wikipedia Reference:
${wikiData.extract}

Instructions:
- Keep it to 2-3 sentences ONLY
- Use simple, clear language
- Focus on the most essential information
- Be accurate and professional
- Do NOT use phrases like "Sure!", "Okay!", or "Here's..."
- Start directly with the explanation

Brief Explanation:`;

            const result = await llmProvider(prompt, {
                maxTokens: 150,
                temperature: 0.3
            });

            const text = (result as any)?.text || String(result || '');

            // Clean up the response
            briefAnswer = text
                .replace(/^(Sure!|Okay!|Here's|Here is|Let me explain)/i, '')
                .replace(/^#+\s+/gm, '') // Remove headers
                .replace(/^[=\-]{3,}/gm, '') // Remove underlines
                .trim();

            // Ensure it's actually brief (max 3 sentences)
            const sentences = briefAnswer.split(/[.!?]+/).filter(s => s.trim().length > 0);
            if (sentences.length > 3) {
                briefAnswer = sentences.slice(0, 3).join('. ') + '.';
            }

            confidence = 0.9;
        } catch (error) {
            console.warn('⚠️ LLM brief explanation failed, using Wikipedia extract');
            // Fallback to Wikipedia extract
            if (wikiData.extract) {
                const sentences = wikiData.extract.split(/[.!?]+/).filter(s => s.trim().length > 0);
                briefAnswer = sentences.slice(0, 2).join('. ') + '.';
                confidence = 0.7;
            }
        }
    } else if (wikiData.extract) {
        // No LLM available, use Wikipedia extract
        const sentences = wikiData.extract.split(/[.!?]+/).filter(s => s.trim().length > 0);
        briefAnswer = sentences.slice(0, 2).join('. ') + '.';
        confidence = 0.7;
    } else {
        // No data available
        briefAnswer = `I don't have enough information to provide a brief explanation of "${topic}". Please try a more specific query or check the spelling.`;
        confidence = 0.3;
    }

    return {
        briefAnswer,
        wikipediaExtract: wikiData.extract,
        wikipediaUrl: wikiData.url,
        wikipediaTitle: wikiData.title,
        confidence,
        topic,
        success: wikiData.extract !== null
    };
}

// ==================== FORMAT RESPONSE ====================

export function formatBriefExplanationResponse(explanation: BriefExplanation): string {
    let response = explanation.briefAnswer;

    // Add Wikipedia research section if available
    if (explanation.wikipediaExtract && explanation.wikipediaUrl) {
        response += `\n\n---\n\n**📚 Research from Wikipedia:**\n\n${explanation.wikipediaExtract}`;

        if (explanation.wikipediaUrl) {
            response += `\n\n🔗 [Read more on Wikipedia](${explanation.wikipediaUrl})`;
        }
    }

    return response;
}
