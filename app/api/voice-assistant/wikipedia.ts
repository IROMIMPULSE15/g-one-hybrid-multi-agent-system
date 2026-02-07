import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import axios from "axios";
import { generateWithProvider, isProviderConfigured } from "./llm_provider";

const pinecone = new Pinecone();
const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX || "voice-assistant-knowledge");

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

    // 1️⃣ Fetch from Wikipedia API
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const wikiData = await axios.get(wikiUrl).then(res => res.data).catch(() => null);

    if (!wikiData || !wikiData.extract)
      return NextResponse.json({ success: false, message: "No Wikipedia result found." });

    // 2️⃣ Add Wikipedia data to Pinecone for semantic recall
    await pineconeIndex.upsert([
      {
        id: `wiki_${Date.now()}`,
        values: Array.from({ length: 512 }, () => Math.random()),
        metadata: {
          content: wikiData.extract,
          category: "wikipedia",
          tags: [query],
          source: "Wikipedia"
        }
      }
    ]);

    const prompt = `You are a research AI assistant. Summarize this Wikipedia content clearly and briefly for a general user. If relevant, provide one surprising fact.\n\nWikipedia extract:\n"${wikiData.extract}"\n\nUser Query: "${query}"`;

    if (isProviderConfigured()) {
      try {
        const aiSummary = await generateWithProvider(prompt, { maxTokens: 300, temperature: 0.2, model: process.env.LLM_MODEL });
        const provider = (aiSummary as any)?.provider || 'fallback';
        const summaryText = (aiSummary as any)?.text || String(aiSummary || wikiData.extract);
        return NextResponse.json({ success: true, type: "wikipedia", title: wikiData.title, source: wikiData.content_urls?.desktop?.page, extract: wikiData.extract, aiSummary: summaryText, provider });
      } catch (e) {
        console.warn('Wikipedia LLM summarization failed, returning web extract:', e);
      }
    }

    return NextResponse.json({ success: true, type: "wikipedia", title: wikiData.title, source: wikiData.content_urls?.desktop?.page, extract: wikiData.extract });
  } catch (error) {
    console.error("Wikipedia Search Error:", error);
    return NextResponse.json({ success: false, error: "Wikipedia search failed." });
  }
}
