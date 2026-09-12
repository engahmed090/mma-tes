# Same-repository AI chat

Normal path: ChatTab → POST /api/ai-chat → server/chat.ts → OpenRouter or Groq →
validated SSE text → SafeChatMarkdown. Supabase code is retained as legacy reference,
not an automatic fallback. No experimental measurements are included in chat context.

Set at least one server-only credential in Vercel Project Settings → Environment Variables:
OPENROUTER_API_KEY (primary) or GROQ_API_KEY (fallback). Legacy GROQ_API_KEY_1 and
GROQ_API_KEY_2 are also supported. Enable the required Preview/Production scopes and
redeploy after changing settings. Never enter provider credentials in VITE_* variables.
Optional TAVILY_API_KEY enables literature search. Without it every unsupported
literature value must remain UNVERIFIED / UNAVAILABLE; chat remains available.

OPENROUTER_MODEL and GROQ_MODEL explicitly select models. Every request checks the
provider /models catalog. Without an override, only a known text-model ID actually
present in that catalog is selected. OpenRouter preference: deepseek/deepseek-r1.
Groq preferences: openai/gpt-oss-120b, openai/gpt-oss-20b,
llama-3.3-70b-versatile, llama-3.1-8b-instant. Catalog presence does not guarantee
account access/credits; completion failure advances to the next configured provider/key.
No synthetic reply is returned. Malformed/empty streams fail; an interruption after
partial text is reported rather than silently splicing another model's answer.
Provider response bodies/credentials are never logged or exposed as error details.

Sources for implementation protocol: https://vercel.com/docs/functions/runtimes/node-js
and https://console.groq.com/docs/models . Live catalogs remain the runtime authority.

Local development: pnpm dev mounts the same Node handler before the research API proxy.
Vite loads allowlisted server variables from ignored .env.local into the server process;
restart Vite after changes. Vite preview alone cannot run the server API.
VITE_AI_CHAT_API_URL is an optional public absolute URL override; the alternate service
must implement its own CORS policy. Normal same-origin operation needs no override,
Supabase key, browser provider token, or additional frontend dependency.

The endpoint validates roles, modes, payload size and browser origin, limits conversation
length/output tokens, and applies a 50-second provider deadline. It is a public chat
endpoint, not an authenticated private service. Same-origin checks do not stop scripted
clients. Set provider spending limits and Vercel firewall/rate controls before enabling
unrestricted public traffic. No claim of distributed application-level rate limiting.

Tests use explicitly constructed provider fixtures; these are never production responses.
pnpm run typecheck checks frontend and server code. pnpm test runs stream, fallback,
security-rendering, provenance and routing regression tests.
