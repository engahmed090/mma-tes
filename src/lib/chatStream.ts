/** OpenAI-compatible SSE; only provider text is yielded, never a fabricated reply. */
export async function* chatText(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = '', received = false, finished = false;
  try {
    while (!finished) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() + '\n' : decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trimEnd(); buffer = buffer.slice(end + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') { finished = true; break; }
        let event: any;
        try { event = JSON.parse(data); } catch { throw new Error('Invalid AI provider stream.'); }
        if (event.error) throw new Error('AI provider interrupted the response. Please retry.');
        const text = event.choices?.[0]?.delta?.content;
        if (text != null && typeof text !== 'string') throw new Error('Invalid AI provider text.');
        if (text) { received = true; yield text; }
      }
      if (done) break;
      if (buffer.length > 100000) throw new Error('Invalid AI provider stream.');
    }
    if (!received) throw new Error('AI provider returned no text.');
    if (!finished) throw new Error('AI response ended unexpectedly. Please retry.');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
