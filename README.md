# బాల వ్యాకరణము — structured corpus + Telugu grammar RAG chatbot

A complete pipeline that scrapes the Telugu grammar text **బాల వ్యాకరణము** (Bala Vyakarana, by చిన్నయ సూరి / Chinnaya Suri), stores it as structured data in Supabase, and serves a retrieval-augmented chatbot over it — grounded in the sutras and in printed commentaries.

## What's in here

```
data/
  bala_vyakarana.json          structured scrape: 11 paricchedas, 465 sutras, examples
web/
  bala_vyakarana_viewer.html         offline viewer of the scraped data
  bala_vyakarana_supabase_viewer.html viewer that reads live from Supabase
  bala_vyakarana_rag_demo.html        offline retrieval demo (TF-IDF, no keys)
  bala_vyakarana_chatbot.html         chatbot UI (multi-turn)
  bala_vyakarana_rag.html             single-shot RAG UI
  bala_vyakarana_embed.html           one-click corpus indexing
  bala_vyakarana_chatbot_widget.js    embeddable chat widget (one <script> tag)
scripts/
  bala_vyakarana_rag.py        embed + ask from the command line
  scrape_andhrabharati.py      the scraper that produced data/bala_vyakarana.json
supabase/
  schema.sql                   consolidated schema (tables, RPCs, vector index)
  functions/bala-rag/          Edge Function: retrieve + answer (Gemini)
  functions/bala-embed/        Edge Function: build embeddings in the cloud
```

## Data sources

- **Sutras** — scraped from the static pages at `andhrabharati.com/bhAshha/bAlavyAkaraNamu/` (index + 11 pariccheda pages). Each sutra keeps its number, text, and example tables.
- **Commentary** — 746 PDF-extracted pages from the `pdf_text_index` table, covering three books:
  - బాలవ్యాకరణ ఘంటాపథము (339 pp)
  - ప్రౌఢవ్యాకరణ ఘంటాపథము (245 pp)
  - సాహిత్య సోపానములు (162 pp)

All of it lives in one searchable table, `bala_vyakarana_chunks`, tagged with `source` (`bala_vyakarana` | `pdf`), `doc`, and `ref`.

## How it works

1. **Ingest** — sutras are parsed into `bala_vyakarana_items`; each item becomes a row in `bala_vyakarana_chunks`. PDF pages are chunked (~800 chars, overlapping) and added to the same table.
2. **Index** — every chunk gets a 768-dimension embedding (`gemini-embedding-001`).
3. **Retrieve** — `match_rag(query_embedding, match_count, source_filter)` returns the closest chunks by cosine distance (HNSW index).
4. **Answer** — the `bala-rag` Edge Function embeds the question, retrieves 8 excerpts, and asks `gemini-3.8-flash` to answer *only* from them, citing them as `[n]`.

## Setup

### 1. Supabase project

Run `supabase/schema.sql` in the SQL editor (it enables `pgvector`, creates the tables, the vector index and the RPCs).

### 2. Secrets

Set the Gemini key for the functions (free key from <https://aistudio.google.com/apikey>):

```bash
supabase secrets set GEMINI_API_KEY=...
```

### 3. Deploy the Edge Functions

```bash
supabase functions deploy bala-rag
supabase functions deploy bala-embed
```

### 4. Load the data

Import the JSON, then build the corpus (see `scripts/` and the SQL in the schema). The two Edge Functions do the heavy lifting in the cloud — no local toolchain needed:

- open `web/bala_vyakarana_embed.html`, paste your **legacy anon key** (`eyJ…`), and press **Build embeddings**.
- it indexes both the sutras and the PDF pages, pacing itself to stay inside the free tier.

### 5. Use it

- **Chatbot:** open `web/bala_vyakarana_chatbot.html`, paste the anon key, ask away.
- **Widget:** drop one script tag on any page (see the header of `bala_vyakarana_chatbot_widget.js`).
- **CLI:**

  ```bash
  export SUPABASE_URL=https://<project>.supabase.co
  export SUPABASE_KEY=<service_role key>
  export GEMINI_API_KEY=...
  python scripts/bala_vyakarana_rag.py embed
  python scripts/bala_vyakarana_rag.py ask "సంధి అంటే ఏమిటి?"
  ```

## Notes and caveats

- **Keys.** No API keys are committed. The browser pages take the Supabase **anon** key at runtime and keep it in `localStorage`; the Gemini key lives only in Edge Function secrets.
- **The pages contain a project URL** (`https://<project-ref>.supabase.co`) as a convenience default — change it before publishing if you don't want your project ref public.
- **Row Level Security** is not enabled by the schema. If your tables are public, enable RLS and add policies before exposing anything.
- **Gemini free tier** limits embedding requests per minute and per day; `bala-embed` paces itself and is resumable. Enabling billing makes the initial index a one-minute job.
- Model names move fast: the functions read `GEMINI_EMBED_MODEL` / `GEMINI_CHAT_MODEL` / `GEMINI_THINKING_LEVEL` from the environment and auto-follow Google's "use models/…" hint when a model is retired.
- The source text is in the public domain; check the site's terms before redistributing the scanned commentary text.

## License

No license file is included yet — add one (e.g. MIT for the code) before making the repository public.
