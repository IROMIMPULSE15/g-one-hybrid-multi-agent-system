import { NextResponse } from "next/server";
import axios from "axios";

export type Mode = 'medical' | 'wikipedia' | 'deepsearch' | 'server' | 'enhanced' | 'auto';

interface RouterResult {
  success: boolean;
  mode: Mode;
  response: string;
  metadata?: Record<string, any>;
}

const DEFAULT_BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

function detectMode(msg: string): Mode {
  const m = (msg || '').toLowerCase();
  if (/\b(pain|hurt|sick|symptom|fever|cough|doctor|medical|health|diagnosis|medicine)\b/.test(m)) return 'medical';
  if (/\b(who is|what is|history of|born|died|biography|who was|what year)\b/.test(m)) return 'wikipedia';
  if (/\b(research|analyze|comprehensive|detailed|study|review|deep search|investigate|in-depth)\b/.test(m)) return 'deepsearch';
  if (/\b(api|backend|server|database|deploy|docker|kubernetes|endpoint|http|rest)\b/.test(m)) return 'server';
  return 'enhanced';
}

async function proxyPost(path: string, body: any, timeout = 10000) {
  const url = `${DEFAULT_BASE}${path}`;
  const res = await axios.post(url, body, { timeout });
  return res.data;
}

export async function routeMessage(message: string, mode: Mode | undefined): Promise<RouterResult> {
  const resolvedMode = (mode && mode !== 'auto') ? mode : detectMode(message);

  try {
    if (resolvedMode === 'medical') {
      // medical agent runs on a separate service (port 8000)
      try {
        const med = await axios.post('http://localhost:8000/medical-response', { text: message }, { timeout: 10000 });
        return { success: true, mode: 'medical', response: med.data.response || String(med.data), metadata: { source: 'medical-agent' } };
      } catch (err) {
        return { success: false, mode: 'medical', response: 'Medical agent unreachable', metadata: { error: String(err) } };
      }
    }

    if (resolvedMode === 'wikipedia') {
      // call the local wikipedia-like handler
      const data = await proxyPost('/api/voice-assistant/deepsearch', { query: message });
      return { success: true, mode: 'wikipedia', response: data.response || JSON.stringify(data), metadata: { source: 'deepsearch' } };
    }

    if (resolvedMode === 'deepsearch') {
      const data = await proxyPost('/api/voice-assistant/deepsearch', { query: message });
      return { success: true, mode: 'deepsearch', response: data.response || JSON.stringify(data), metadata: { source: 'deepsearch' } };
    }

    if (resolvedMode === 'server') {
      // simple technical guidance response
      return { success: true, mode: 'server', response: `Technical assistant: I can help with server or API questions. Your query: ${message}` };
    }

    // default enhanced (call main assistant endpoint)
    const main = await proxyPost('/api/voice-assistant', { message, mode: 'enhanced' });
    return { success: true, mode: 'enhanced', response: main.response || JSON.stringify(main), metadata: { source: 'assistant' } };
  } catch (error) {
    console.error('serverRouter.routeMessage error:', error);
    return { success: false, mode: resolvedMode, response: 'Routing failed', metadata: { error: String(error) } };
  }
}

// POST handler for proxying requests (keeps backward compatibility with previous simple router)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.query || body.message || '';
    const mode = (body.type || body.mode) as Mode | undefined;

    if (!message) return NextResponse.json({ success: false, error: 'Missing query/message' }, { status: 400 });

    const result = await routeMessage(message, mode);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Server Router POST error:', error);
    return NextResponse.json({ success: false, error: 'Server router failed.' }, { status: 500 });
  }
}
