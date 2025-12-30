import { NextResponse } from "next/server";
import axios from "axios";
import { generateWithProvider, isProviderConfigured } from "./llm_provider";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

    const serp = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
    const snippets = serp.data.RelatedTopics?.slice(0, 5).map((t: any) => t.Text).join("\n") || "No deep data found";
    const prompt = `Perform a deep synthesis based on web snippets:\n${snippets}\nUser query: "${query}"\nSummarize the most relevant insights and infer underlying context if possible.`;

    if (isProviderConfigured()) {
      try {
        const aiDeepResult = await generateWithProvider(prompt, { maxTokens: 800, temperature: 0.2, model: process.env.LLM_MODEL });
        const provider = (aiDeepResult as any)?.provider || 'fallback';
        const text = (aiDeepResult as any)?.text || String(aiDeepResult || snippets);
        return NextResponse.json({ success: true, type: "deepsearch", response: text, provider, sources: ["DuckDuckGo", provider !== 'fallback' ? 'LLM' : 'fallback'] });
      } catch (e) {
        console.warn('Deepsearch LLM failed, falling back to web-only summary:', e);
      }
    }
    
    // fallback web-only summary
    return NextResponse.json({ success: true, type: "deepsearch", response: snippets, sources: ["DuckDuckGo"] });
  } catch (error) {
    console.error("Deep Search Error:", error);
    return NextResponse.json({ success: false, error: "Deep search failed." });
  }
}