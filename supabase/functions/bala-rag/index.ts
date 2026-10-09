// bala-rag — retrieve sutra/commentary excerpts and answer with Gemini.
//
// Deploy:  supabase functions deploy bala-rag
// Secret:  supabase secrets set GEMINI_API_KEY=...
//
// POST body: { messages: [{role,content}, ...] }   (or { question: "..." })
//          optional: match_count (default 8), source ('pdf' | 'bala_vyakarana')
// Response:  { answer, sources: [{source, doc, ref, similarity, content}] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
let EMBED_MODEL = Deno.env.get("GEMINI_EMBED_MODEL") ?? "gemini-embedding-001";
let CHAT_MODEL = Deno.env.get("GEMINI_CHAT_MODEL") ?? "gemini-3.8-flash";
const THINKING_LEVEL = Deno.env.get("GEMINI_THINKING_LEVEL") ?? "low";
const EMBED_DIMS = 768;
const HISTORY_TURNS = 12;

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function callModel(model: string, method: string, payload: unknown, key: string) {
  const r = await fetch(`${GEMINI_BASE}/models/${model}:${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(payload),
  });
  return { status: r.status, text: await r.text() };
}

// If a model has been retired, Google's 404 body names the replacement; retry once with it.
function suggestedModel(text: string): string | null {
  const m = text.match(/models\/([A-Za-z0-9._\-]+)/);
  return m ? m[1] : null;
}

async function callWithFallback(model: string, method: string, payload: unknown, key: string) {
  let res = await callModel(model, method, payload, key);
  let used = model;
  if (res.status === 404) {
    const s = suggestedModel(res.text);
    if (s && s !== model) {
      used = s;
      res = await callModel(s, method, payload, key);
    }
  }
  return { status: res.status, text: res.text, model: used };
}

async function embed(text: string, key: string, taskType: string): Promise<number[]> {
  const payload = { content: { parts: [{ text }] }, taskType, output_dimensionality: EMBED_DIMS };
  const { status, text: body, model } = await callWithFallback(EMBED_MODEL, "embedContent", payload, key);
  if (status !== 200) throw new Error(`embedding failed [${status}] (model ${model}): ${body}`);
  if (model !== EMBED_MODEL) EMBED_MODEL = model;
  return JSON.parse(body).embedding.values as number[];
}

async function answer(system: string, messages: Array<{ role: string; content: string }>, key: string) {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content ?? "") }],
  }));
  // temperature / top_p / top_k are not supported on Gemini 3+ — omit them.
  const base = { systemInstruction: { parts: [{ text: system }] }, contents };
  const withThinking = { ...base, generationConfig: { thinkingConfig: { thinkingLevel: THINKING_LEVEL } } };

  let res = await callWithFallback(CHAT_MODEL, "generateContent", withThinking, key);
  if (res.status === 400 && /thinking/i.test(res.text)) {
    res = await callWithFallback(CHAT_MODEL, "generateContent", base, key);
  }
  if (res.status !== 200) throw new Error(`chat failed [${res.status}] (model ${res.model}): ${res.text}`);
  if (res.model !== CHAT_MODEL) CHAT_MODEL = res.model;
  const j = JSON.parse(res.text);
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p?.text ?? "").join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const matchCount: number = body.match_count ?? 8;
    const sourceFilter: string | null = body.source ?? null;

    const messages: Array<{ role: string; content: string }> = Array.isArray(body.messages)
      ? body.messages
      : (typeof body.question === "string" ? [{ role: "user", content: body.question }] : []);
    if (!messages.length) return json({ error: "provide `messages` (array) or `question` (string)" }, 400);

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return json({ error: "no user message found" }, 400);

    const KEY = Deno.env.get("GEMINI_API_KEY");
    if (!KEY) {
      console.error("bala-rag: GEMINI_API_KEY is not set");
      return json({ error: "GEMINI_API_KEY secret is not set for this function" }, 500);
    }

    const priorUser = [...messages].reverse().filter((m) => m.role === "user")[1];
    const queryText = priorUser ? `${priorUser.content}\n${lastUser.content}` : lastUser.content;
    const embedding = await embed(queryText, KEY, "RETRIEVAL_QUERY");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: matches, error } = await sb.rpc("match_rag", {
      query_embedding: embedding,
      match_count: matchCount,
      source_filter: sourceFilter,
    });
    if (error) throw new Error("vector match failed: " + error.message);

    const context = (matches ?? []).length
      ? (matches ?? [])
        .map((m: any, i: number) => `[${i + 1}] (${m.doc} · ${m.ref}) ${m.content}`)
        .join("\n")
      : "(no excerpts were retrieved — the embeddings may not be loaded yet)";

    const system =
      "You are ‘బాల వ్యాకరణము సహాయకుడు’, a friendly Telugu grammar tutor for బాల వ్యాకరణము (Bala Vyakarana) by చిన్నయ సూరి (Chinnaya Suri). " +
      "You are given numbered excerpts from two kinds of source: the sutras of the grammar itself, and pages of printed commentaries on it (the ఘంటాపథము books). " +
      "Prefer the sutra wording for the rule itself and use the commentary excerpts to explain it, giving వృత్తి/వ్యాఖ్య details and examples. " +
      "Ground every claim in the excerpts and cite them as [n]. " +
      "Have a natural conversation and connect to earlier turns. " +
      "Reply in Telugu when the user writes in Telugu, otherwise in the user's language. " +
      "If the excerpts do not cover the question, say so honestly and mark anything from general knowledge as such. " +
      "Be concise: aim for a short, focused answer. " +
      "FORMATTING: write plain prose only. Do NOT use markdown — no **bold**, no *italics*, no ## headings, no bullet or numbered lists, no backticks. Just ordinary sentences and paragraph breaks." +
      "\n\nExcerpts:\n" + context;

    const text = await answer(system, messages.slice(-HISTORY_TURNS), KEY);

    return json({
      answer: text,
      sources: (matches ?? []).map((m: any) => ({
        source: m.source,
        doc: m.doc,
        ref: m.ref,
        similarity: m.similarity,
        content: m.content,
      })),
    });
  } catch (e) {
    console.error("bala-rag error:", e);
    return json({ error: String(e) }, 500);
  }
});
