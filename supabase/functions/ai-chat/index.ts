import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Round-robin between two Groq keys
const getGroqKey = () => {
  const k1 = Deno.env.get("GROQ_API_KEY_1");
  const k2 = Deno.env.get("GROQ_API_KEY_2");
  if (!k1 && !k2) return null;
  if (!k2) return k1!;
  if (!k1) return k2!;
  return Math.random() < 0.5 ? k1 : k2;
};

async function tavilySearch(query: string): Promise<string> {
  const key = Deno.env.get("TAVILY_API_KEY");
  if (!key) return "Tavily search unavailable (no API key).";

  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "advanced",
        max_results: 5,
        include_answer: true,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Tavily error:", resp.status, t);
      return `Search failed (${resp.status}).`;
    }

    const data = await resp.json();
    let result = "";
    if (data.answer) {
      result += `SEARCH SUMMARY: ${data.answer}\n\n`;
    }
    if (data.results) {
      result += "SOURCES:\n";
      for (const r of data.results.slice(0, 5)) {
        result += `- [${r.title}](${r.url}): ${r.content?.slice(0, 300)}\n`;
      }
    }
    return result || "No results found.";
  } catch (e) {
    console.error("Tavily error:", e);
    return "Search failed.";
  }
}

/** Try OpenRouter first (better model), fall back to Groq */
async function callLLM(messages: any[], stream: boolean) {
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const groqKey = getGroqKey();

  // Try OpenRouter first if available
  if (openRouterKey) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://metamaterial-absorber-ai-platform-v5.lovable.app",
          "X-Title": "Metamaterial Absorber AI Platform",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1",
          messages,
          stream,
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (resp.ok) {
        return { response: resp, provider: "openrouter" };
      }
      const errText = await resp.text();
      console.error("OpenRouter error:", resp.status, errText);
      // Fall through to Groq
    } catch (e) {
      console.error("OpenRouter fetch error:", e);
      // Fall through to Groq
    }
  }

  // Fallback to Groq
  if (!groqKey) {
    throw new Error("No AI provider available. Configure OPENROUTER_API_KEY or GROQ_API_KEY.");
  }

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      stream,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Groq API error (${resp.status}): ${t}`);
  }

  return { response: resp, provider: "groq" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, brain, knowledge } = await req.json();

    // For reference brain, do a Tavily search with the last user message
    let searchContext = "";
    if (brain === "ref") {
      const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
      if (lastUser) {
        searchContext = await tavilySearch(
          `metamaterial absorber ${lastUser.content}`
        );
      }
    }

    const systemPrompt =
      brain === "cst"
        ? `You are Ahmed's AI Expert on metamaterial absorbers. You have deep knowledge of microwave absorber design, CST simulation, and electromagnetic theory.

You have access to the user's REAL CST simulation data:
${knowledge || "No data loaded yet."}

RULES:
- Always reference the actual data when answering about specific shapes or frequencies
- Provide specific numbers: S11 values, absorption percentages, optimal dimensions
- If a frequency is outside the data range, say so clearly
- Use markdown formatting for readability
- Be concise but thorough`
        : `You are Ahmed's AI Expert on metamaterial absorbers with access to the latest research literature.

You have searched the web and found the following information:
${searchContext}

RULES:
- Provide specific absorber designs with FULL dimensions (P, patch size, substrate thickness, material)
- Always cite sources with links when available
- Compare designs and recommend the best option
- Include practical simulation setup tips for CST
- Use markdown formatting`;

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const { response, provider } = await callLLM(llmMessages, true);

    console.log(`Using provider: ${provider}`);

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add provider header so client knows which model answered
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-AI-Provider": provider,
      },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
