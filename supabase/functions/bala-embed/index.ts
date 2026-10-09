// bala-embed — build the corpus embeddings in the cloud.
//
// Deploy:  supabase functions deploy bala-embed
// Secret:  supabase secrets set GEMINI_API_KEY=...
//
// POST body (all optional):
//   { batch_size: 20, max_batches: 2, source: 'pdf' | 'bala_vyakarana' | null }
//
// It embeds the chunks that still have no vector and reports back:
//   { embedded, remaining, rate_limited }
// Call it repeatedly until `remaining` is 0. It never throws on 429 — it returns
// rate_limited: true so the caller can pause and resume (progress is in the DB).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const EMBED_MODEL = Deno.env.get("GEMINI_EMBED_MODEL") ?? "gemini-embedding-001";
const DIMS = 768;

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function remainingCount(sb: any, source: string | null) {
  let q = sb.from("bala_vyakarana_chunks").select("*", { count: "exact", head: true }).is("embedding", null);
  if (source) q = q.eq("source", source);
  const { count } = await q;
  return count ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const batch = Math.min(Math.max(Number(body.batch_size ?? 20), 1), 100);
    const maxBatches = Math.min(Math.max(Number(body.max_batches ?? 2), 1), 10);
    const source: string | null = body.source ?? null;

    const KEY = Deno.env.get("GEMINI_API_KEY");
    if (!KEY) {
      console.error("bala-embed: GEMINI_API_KEY is not set");
      return json({ error: "GEMINI_API_KEY secret is not set for this function" }, 500);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let embedded = 0;
    for (let i = 0; i < maxBatches; i++) {
      let q = sb.from("bala_vyakarana_chunks").select("id,content").is("embedding", null).limit(batch);
      if (source) q = q.eq("source", source);
      const { data: rows, error } = await q;
      if (error) throw new Error("read failed: " + error.message);
      if (!rows || rows.length === 0) break;

      const payload = {
        requests: rows.map((r: any) => ({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: r.content }] },
          taskType: "RETRIEVAL_DOCUMENT",
          output_dimensionality: DIMS,
        })),
      };

      let r = await fetch(`${GEMINI_BASE}/models/${EMBED_MODEL}:batchEmbedContents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify(payload),
      });

      // one gentle retry on rate limit, then hand control back to the caller
      if (r.status === 429) {
        await sleep(20000);
        r = await fetch(`${GEMINI_BASE}/models/${EMBED_MODEL}:batchEmbedContents`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
          body: JSON.stringify(payload),
        });
      }
      if (r.status === 429) {
        return json({ embedded, remaining: await remainingCount(sb, source), rate_limited: true });
      }
      if (!r.ok) throw new Error("embedding failed [" + r.status + "]: " + (await r.text()));

      const j = await r.json();
      const updates = j.embeddings.map((e: any, idx: number) => ({
        id: rows[idx].id,
        embedding: "[" + e.values.join(",") + "]",
      }));
      const { error: uerr } = await sb.rpc("set_chunk_embeddings", { payload: updates });
      if (uerr) throw new Error("store failed: " + uerr.message);
      embedded += updates.length;

      if (rows.length < batch) break;
      await sleep(1500);
    }

    return json({ embedded, remaining: await remainingCount(sb, source), rate_limited: false });
  } catch (e) {
    console.error("bala-embed error:", e);
    return json({ error: String(e) }, 500);
  }
});
