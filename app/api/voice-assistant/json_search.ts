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

export async function searchTrainedData(query: string): Promise<SearchResult> {
  // Stub implementation: return no results. Replace with real logic or dataset.
  return {
    matches: [],
    total: 0,
  }
}

export default searchTrainedData

// Backwards-compatible wrapper for older callers that expect { found, response }
export async function searchTrainedDataLegacy(query: string) {
  const res = await searchTrainedData(query)
  return {
    found: res.total > 0,
    response: res.total > 0 ? res.matches.map(m => m.text).join('\n') : undefined,
    entries: res.matches,
  }
}

