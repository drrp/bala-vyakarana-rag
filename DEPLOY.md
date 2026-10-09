# Deploying the web app

Everything in `web/` is a **static site** — plain HTML, plus a manifest, a service worker and icons. There is no server to run and no build step. It talks to Supabase (and through it, the Edge Functions) from the browser.

Pick any one of the three hosts below. All are free.

---

## Option A — Netlify Drop (fastest, ~30 seconds)

1. Download or unzip the site so you have a folder containing `index.html`.
2. Go to <https://app.netlify.com/drop>.
3. Drag the **`web/` folder** onto the page.
4. Netlify gives you a URL immediately (e.g. `https://random-name.netlify.app`). You can rename it in *Site settings*.

No account is strictly required to try it; sign in to keep the site permanently.

## Option B — Cloudflare Pages (good free tier, private repos supported)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick your `bala-vyakarana-rag` repository (a private repo is fine on the free plan).
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `web`
4. Deploy. Every push to `main` redeploys automatically.

## Option C — GitHub Pages

Free, but Pages on a **private** repository requires GitHub Pro. If the repo can be public:

1. Repository → **Settings** → **Pages**.
2. **Source:** Deploy from a branch → **`main`** → folder **`/web`**.
3. Save; the site appears at `https://<user>.github.io/bala-vyakarana-rag/`.

---

## Installing it on a phone (PWA)

Once the site is served over HTTPS it is installable — no app store involved:

- **Android (Chrome):** open the site → menu → **Install app** (or the install banner).
- **iPhone (Safari):** open the site → **Share** → **Add to Home Screen**.

It then launches fullscreen with its own icon, like a native app. The **offline viewer** and the **retrieval demo** keep working with no network at all (their data is embedded); the chatbot, RAG page and embed page need connectivity because they call the Edge Functions.

To test locally before deploying:

```bash
cd web && python3 -m http.server 8080
# then open http://localhost:8080
```

(A plain `file://` open works too, but the service worker only registers over `http(s)://`.)

---

## Before you make it public

**1. The anon key.** By default each page asks the visitor to paste your Supabase **anon** key, and keeps it in `localStorage`. That is fine for a private or personal deployment. For a genuinely public site you would instead hard-code the key in the page so visitors never see the prompt — but **only after enabling Row Level Security**, because with RLS disabled that key lets anyone read *and write* every table in the project:

```sql
alter table public.bala_vyakarana_chunks      enable row level security;
alter table public.bala_vyakarana_items       enable row level security;
alter table public.bala_vyakarana_paricchedas enable row level security;
alter table public.bala_vyakarana_document    enable row level security;

-- then allow public read-only access
create policy "read chunks" on public.bala_vyakarana_chunks
  for select to anon using (true);
-- …and similarly for the other tables you want the site to read
```

Enabling RLS with no policies blocks *all* client access, so add the `select` policies in the same pass.

**2. The project URL.** The pages carry `https://<your-project>.supabase.co` as a convenience default. Change it to a placeholder if you would rather not publish your project reference.

**3. CORS** is already open on both Edge Functions (`Access-Control-Allow-Origin: *`), so a deployed site can call them without changes.

**4. Secrets.** No API keys are in this repository. The Gemini key lives only in Edge Function secrets (`supabase secrets set GEMINI_API_KEY=…`).
