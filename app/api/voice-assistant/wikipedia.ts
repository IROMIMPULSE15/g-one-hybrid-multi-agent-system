/**
 * Wikipedia Search API Integration
 * No API key required - Direct API access
 * 
 * Wikipedia is for knowledge, background, and reference information
 * NOT for current news or real-time events
 */

import axios from 'axios';

const WIKIPEDIA_API_BASE = 'https://en.wikipedia.org/w/api.php';
const SEARCH_TIMEOUT = 8000; // 8 seconds timeout

export interface WikipediaSearchResult {
  title: string;
  snippet: string;
  pageid: number;
  wordcount: number;
}

export interface WikipediaPageContent {
  title: string;
  extract: string;
  pageid: number;
  url: string;
}

export interface WikipediaSearchResponse {
  success: boolean;
  results: WikipediaSearchResult[];
  totalResults: number;
  query: string;
  error?: string;
}

export interface WikipediaContentResponse {
  success: boolean;
  content: WikipediaPageContent | null;
  error?: string;
}

/**
 * Search Wikipedia for articles matching the query
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 5)
 * @returns Search results with snippets
 */
export async function searchWikipedia(
  query: string,
  limit: number = 5
): Promise<WikipediaSearchResponse> {
  try {
    console.log(`🔍 Searching Wikipedia for: "${query}"`);

    const params = {
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: limit.toString(),
      format: 'json',
      origin: '*', // Enable CORS
      srprop: 'snippet|titlesnippet|wordcount',
    };

    const response = await axios.get(WIKIPEDIA_API_BASE, {
      params,
      timeout: SEARCH_TIMEOUT,
      headers: {
        'User-Agent': 'VoiceAssistant/1.0 (Educational Purpose)',
      },
    });

    if (!response.data || !response.data.query || !response.data.query.search) {
      return {
        success: false,
        results: [],
        totalResults: 0,
        query,
        error: 'No results found',
      };
    }

    const searchResults: WikipediaSearchResult[] = response.data.query.search.map((item: any) => ({
      title: item.title,
      snippet: item.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
      pageid: item.pageid,
      wordcount: item.wordcount || 0,
    }));

    console.log(`✅ Found ${searchResults.length} Wikipedia results`);

    return {
      success: true,
      results: searchResults,
      totalResults: response.data.query.searchinfo?.totalhits || searchResults.length,
      query,
    };
  } catch (error: any) {
    console.error('❌ Wikipedia search error:', error.message);
    return {
      success: false,
      results: [],
      totalResults: 0,
      query,
      error: error.message || 'Failed to search Wikipedia',
    };
  }
}

/**
 * Get detailed content from a Wikipedia page
 * @param pageId - Wikipedia page ID
 * @param sentences - Number of sentences to extract (default: 5 for free, 10 for pro)
 * @returns Page content with extract
 */
export async function getWikipediaContent(
  pageId: number,
  sentences: number = 5
): Promise<WikipediaContentResponse> {
  try {
    console.log(`📖 Fetching Wikipedia content for page ID: ${pageId}`);

    const params = {
      action: 'query',
      pageids: pageId.toString(),
      prop: 'extracts|info',
      exsentences: sentences.toString(),
      explaintext: 'true', // Plain text, no HTML
      inprop: 'url',
      format: 'json',
      origin: '*',
    };

    const response = await axios.get(WIKIPEDIA_API_BASE, {
      params,
      timeout: SEARCH_TIMEOUT,
      headers: {
        'User-Agent': 'VoiceAssistant/1.0 (Educational Purpose)',
      },
    });

    if (!response.data || !response.data.query || !response.data.query.pages) {
      return {
        success: false,
        content: null,
        error: 'Page not found',
      };
    }

    const page = response.data.query.pages[pageId];

    if (!page || page.missing) {
      return {
        success: false,
        content: null,
        error: 'Page does not exist',
      };
    }

    const content: WikipediaPageContent = {
      title: page.title,
      extract: page.extract || 'No content available',
      pageid: page.pageid,
      url: page.fullurl || `https://en.wikipedia.org/?curid=${pageId}`,
    };

    console.log(`✅ Retrieved Wikipedia content for: ${content.title}`);

    return {
      success: true,
      content,
    };
  } catch (error: any) {
    console.error('❌ Wikipedia content fetch error:', error.message);
    return {
      success: false,
      content: null,
      error: error.message || 'Failed to fetch Wikipedia content',
    };
  }
}

/**
 * Search Wikipedia and get the first result's content
 * This is a convenience function for quick lookups
 * @param query - Search query
 * @param sentences - Number of sentences to extract (5 for free, 10 for pro)
 * @param isPro - Whether user has pro version (affects depth of search)
 * @returns Combined search and content response
 */
export async function quickWikipediaLookup(
  query: string,
  sentences: number = 5,
  isPro: boolean = false
): Promise<{
  success: boolean;
  title?: string;
  summary?: string;
  url?: string;
  relatedTopics?: string[];
  error?: string;
  isPro?: boolean;
}> {
  try {
    // Pro users get more search results
    const searchLimit = isPro ? 5 : 3;

    // First, search for the topic
    const searchResults = await searchWikipedia(query, searchLimit);

    if (!searchResults.success || searchResults.results.length === 0) {
      return {
        success: false,
        error: 'No Wikipedia articles found for this query',
        isPro,
      };
    }

    // Get content from the first result
    const firstResult = searchResults.results[0];
    const contentResponse = await getWikipediaContent(firstResult.pageid, sentences);

    if (!contentResponse.success || !contentResponse.content) {
      return {
        success: false,
        error: 'Failed to retrieve article content',
        isPro,
      };
    }

    // Extract related topics from other search results
    const relatedTopics = searchResults.results
      .slice(1)
      .map(result => result.title);

    return {
      success: true,
      title: contentResponse.content.title,
      summary: contentResponse.content.extract,
      url: contentResponse.content.url,
      relatedTopics,
      isPro,
    };
  } catch (error: any) {
    console.error('❌ Quick Wikipedia lookup error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to perform Wikipedia lookup',
      isPro,
    };
  }
}

/**
 * Format Wikipedia results for voice assistant response
 * @param lookupResult - Result from quickWikipediaLookup
 * @returns Formatted string for voice response
 */
export function formatWikipediaResponse(lookupResult: {
  success: boolean;
  title?: string;
  summary?: string;
  url?: string;
  relatedTopics?: string[];
  error?: string;
  isPro?: boolean;
}): string {
  if (!lookupResult.success) {
    return `I couldn't find information on Wikipedia. ${lookupResult.error || 'Please try a different search term.'}`;
  }

  const proIndicator = lookupResult.isPro ? ' 🌟 **Pro Search**' : '';
  let response = `**${lookupResult.title}**${proIndicator}\n\n${lookupResult.summary}`;

  if (lookupResult.relatedTopics && lookupResult.relatedTopics.length > 0) {
    response += `\n\n**Related topics:** ${lookupResult.relatedTopics.join(', ')}`;
  }

  if (lookupResult.url) {
    response += `\n\n[Read more on Wikipedia](${lookupResult.url})`;
  }

  if (lookupResult.isPro) {
    response += `\n\n*Enhanced results with Pro version*`;
  }

  return response;
}

/**
 * Detect if a query is suitable for Wikipedia search
 * Wikipedia is best for: historical facts, biographies, concepts, definitions
 * NOT for: current news, real-time data, opinions
 */
export function isWikipediaSuitable(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Keywords that suggest Wikipedia is appropriate
  const wikipediaKeywords = [
    'who is', 'who was', 'what is', 'what was', 'what are',
    'tell me about', 'information about', 'explain',
    'history of', 'biography', 'definition of',
    'when was', 'where is', 'how did',
    'wikipedia', 'wiki',
  ];

  // Keywords that suggest Wikipedia is NOT appropriate (use news API instead)
  const newsKeywords = [
    'latest', 'current', 'today', 'now', 'recent',
    'breaking', 'news', 'update', 'happening',
    'stock price', 'weather', 'score',
  ];

  // Check if query contains news keywords (not suitable for Wikipedia)
  const hasNewsKeywords = newsKeywords.some(keyword => lowerQuery.includes(keyword));
  if (hasNewsKeywords) {
    return false;
  }

  // Check if query contains Wikipedia keywords (suitable)
  const hasWikipediaKeywords = wikipediaKeywords.some(keyword => lowerQuery.includes(keyword));
  if (hasWikipediaKeywords) {
    return true;
  }

  // Default: suitable for general knowledge queries
  // (unless it's clearly a command or action)
  const isCommand = /^(open|close|start|stop|play|pause|set|turn|switch)/i.test(lowerQuery);
  return !isCommand;
}
