import type { IncomingMessage, ServerResponse } from 'node:http';
import { once } from 'node:events';
import { handleChat } from './chat.js';

/** Shared by Vercel's Node function and local Vite middleware. */
export async function nodeChat(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  try {
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableEnded) abort.abort(); });
    let body = '';
    if (req.body != null) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    else for await (const chunk of req) {
      body += chunk.toString();
      if (body.length > 100000) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end('{"error":"Conversation too large."}'); return; }
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(name, value);
    const scheme = process.env.VERCEL ? 'https' : 'http';
    const response = await handleChat(new Request(`${scheme}://${req.headers.host}${req.url}`, {
      method: req.method, headers, signal: abort.signal, ...(!['GET', 'HEAD'].includes(req.method || '') ? { body } : {}),
    }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) for await (const chunk of response.body as any) {
      if (!res.write(chunk)) await once(res, 'drain', { signal: abort.signal });
    }
    res.end();
  } catch {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end('{"error":"AI service unavailable."}');
  }
}
