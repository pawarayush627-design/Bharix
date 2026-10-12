import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI is not configured yet. Add OPENROUTER_API_KEY in your local .env.local file or Netlify environment variables." }, { status: 500 });
  }

  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const useSearch = Boolean(body.webSearch);
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
    const safeMessages = messages
      .filter((m: any) => ["user", "assistant"].includes(m.role))
      .slice(-30)
      .map((m: any) => ({ role: m.role, content: m.content }));

    const payload: Record<string, any> = {
      model,
      stream: true,
      messages: [
        { role: "system", content: "You are Bharix AI, a warm, capable, honest assistant. Be useful and clear. Use Markdown when it helps. Never claim to have performed actions you have not performed." },
        ...safeMessages
      ]
    };
    if (useSearch) payload.plugins = [{ id: "web", search_prompt: "Search the web for relevant, current information and cite sources in your answer." }];

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "Bharix AI"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return Response.json({ error: `OpenRouter error (${upstream.status}): ${detail.slice(0, 700)}` }, { status: upstream.status });
    }
    if (!upstream.body) return Response.json({ error: "The AI provider returned an empty stream." }, { status: 502 });
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no"
      }
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}
