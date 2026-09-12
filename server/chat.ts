import { buildLiteraturePrompt } from '../supabase/functions/ai-chat/literaturePrompt.js';
import { chatText } from '../src/lib/chatStream.js';

type Env = Record<string, string | undefined>;
const json = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
const scientificRules = buildLiteraturePrompt('No literature search requested.');

export async function handleChat(req: Request, env: Env = process.env, request: typeof fetch = fetch): Promise<Response> {
  if (req.method !== 'POST') return json('Use POST for AI chat.', 405);
  if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin)
    return json('Cross-origin chat requests are not enabled.', 403);
  if (!req.headers.get('content-type')?.includes('application/json')) return json('JSON request required.', 415);
  let input: any;
  try {
    const text = await req.text();
    if (text.length > 100000) return json('Conversation too large. Start a new chat.', 413);
    input = JSON.parse(text);
  } catch { return json('Invalid chat request.', 400); }
  const { messages, brain, knowledge } = input || {};
  if (!['cst', 'ref'].includes(brain) || !Array.isArray(messages) || !messages.length || messages.length > 40 ||
      messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 16000) ||
      messages.at(-1).role !== 'user' || (knowledge != null && (typeof knowledge !== 'string' || knowledge.length > 30000)))
    return json('Invalid conversation, mode or context. Use at most 40 messages.', 400);

  const providers = [
    { name: 'openrouter', base: 'https://openrouter.ai/api/v1', key: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL,
      preferred: ['deepseek/deepseek-r1'] },
    ...[...new Set([env.GROQ_API_KEY, env.GROQ_API_KEY_1, env.GROQ_API_KEY_2].filter(Boolean))].map(key => ({
      name: 'groq', base: 'https://api.groq.com/openai/v1', key, model: env.GROQ_MODEL,
      preferred: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    })),
  ].filter(p => p.key);
  if (!providers.length) return json('AI chat is not configured. Add OPENROUTER_API_KEY or GROQ_API_KEY in the server environment.', 503);
  // One bounded deadline covers catalog lookup, search, provider fallback and streaming.
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(50000)]);
  let context = 'Search unavailable: no retrieved evidence.';
  if (brain === 'ref' && env.TAVILY_API_KEY) {
    try {
      const found = await request('https://api.tavily.com/search', { method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: env.TAVILY_API_KEY,
          query: `metamaterial absorber ${messages.at(-1).content}`, max_results: 5, search_depth: 'advanced', include_answer: false }) });
      if (found.ok) {
        const data: any = await found.json();
        const sources = (Array.isArray(data.results) ? data.results : []).slice(0, 5).filter((r: any) =>
          typeof r.url === 'string' && /^https?:\/\//i.test(r.url) && typeof r.content === 'string');
        if (sources.length) context = sources.map((r: any) => JSON.stringify({ title: r.title, url: r.url, excerpt: r.content.slice(0, 2500) })).join('\n');
      }
    } catch { /* Explicit unavailable context, never a fabricated source. */ }
  }
  const prompt = brain === 'ref' ? buildLiteraturePrompt(context) : `${scientificRules}\nYou assist with CST absorber data.\nThe following is user-provided SIMULATION context, not independently validated experiments.\nDo not invent missing values; explain frequency limits. S11-derived absorption assumes negligible transmission.\n${knowledge || 'No CST data supplied.'}`;
  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const headers = { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' };
      // Confirm the selected model against the provider's live catalog, not a stale label.
      const catalog = await request(provider.base + '/models', { headers, signal });
      if (!catalog.ok) { failures.push(`${provider.name}: model catalog HTTP ${catalog.status}`); continue; }
      const data: any = await catalog.json();
      const available = new Set((Array.isArray(data.data) ? data.data : []).map((m: any) => m.id));
      const model = provider.model?.trim() || provider.preferred.find(m => available.has(m));
      if (!model || !available.has(model)) { failures.push(`${provider.name}: configure an available ${provider.name === 'groq' ? 'GROQ_MODEL' : 'OPENROUTER_MODEL'}`); continue; }
      const response = await request(provider.base + '/chat/completions', { method: 'POST', headers, signal,
        body: JSON.stringify({ model, messages: [{ role: 'system', content: prompt }, ...messages.map(m => ({ role: m.role, content: m.content }))], stream: true, max_tokens: 2048 }) });
      if (!response.ok) { failures.push(`${provider.name}: HTTP ${response.status}`); continue; }
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
        failures.push(`${provider.name}: invalid streaming response`); await response.body?.cancel(); continue;
      }
      const iterator = chatText(response.body), first = await iterator.next();
      const encoder = new TextEncoder();
      const event = (text: string) => encoder.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\n');
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(event(first.value as string));
          try {
            for await (const text of iterator) controller.enqueue(event(text));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch {
            controller.enqueue(encoder.encode('data: {"error":"Provider stream interrupted"}\n\n'));
          } finally { controller.close(); }
        },
        async cancel() { await iterator.return(); },
      });
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store',
        'X-AI-Provider': provider.name, 'X-AI-Model': model } });
    } catch { failures.push(`${provider.name}: unavailable or invalid response`); }
  }
  return json('AI providers unavailable. ' + [...new Set(failures)].join('; ') + '. Check server credentials, model access and quotas.', 502);
}
