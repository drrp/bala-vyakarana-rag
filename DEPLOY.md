# Deploying the web app

**Live now: <https://drrp.github.io/bala-vyakarana-rag/>** — deployed from this repository by GitHub Actions.

Everything in `web/` is a **static site**: plain HTML, plus a manifest, a service worker and icons. There is no server to run and no build step. It talks to Supabase (and through it, the Edge Functions) from the browser.

---

## How it deploys today — GitHub Pages

`.github/workflows/pages.yml` publishes the `web/` folder to GitHub Pages on every push to `main` that touches `web/**` or the workflow file itself.

- **Trigger a deploy:** push any change under `web/`, or run it by hand — **Actions → Deploy site to GitHub Pages → Run workflow**.
- Pages is configured with **`build_type: workflow`** and **HTTPS enforced**.
- **This needs the repository to be public.** GitHub Pages on a private repository requires a paid plan.
- The site lives under a subpath (`/bala-vyakarana-rag/`). All links in the pages are relative, and the manifest's `start_url`/`scope` are `./`, so the PWA installs correctly from there.

If you would rather keep the repository private, use one of the alternatives below.

---

## Alternatives

### Netlify (private repo supported)

1. **Add new site → Import an existing project → GitHub.**
2. Authorize the Netlify GitHub App — for a private repo choose *Only select repositories* and tick `bala-vyakarana-rag`. (If the repo doesn't appear, fix it at GitHub → Settings → Applications → Netlify → Configure.)
3. Pick the repository, branch `main`.
4. Netlify reads `netlify.toml` from the repo and fills in the settings: **publish directory `web`, no build command**. Deploy.

`netlify.toml` also sets `Cache-Control: no-cache` on `sw.js` and the HTML entry points, so a redeploy is never served stale.

### Cloudflare Pages

Workers & Pages → Create → Pages → Connect to Git → pick the repo → framework preset **None**, build command **empty**, output directory **`web`**.

### Netlify Drop (no repository)

Drag the `web/` folder onto <https://app.netlify.com/drop>. Fastest possible deploy, but you must re-drag after every change.

---

## Installing it on a phone (PWA)

Served over HTTPS it is installable — no app store involved:

- **Android (Chrome):** open the site → menu → **Install app**.
- **iPhone (Safari):** open the site → **Share** → **Add to Home Screen**.

It then launches fullscreen with its own icon. The **offline viewer** and the **retrieval demo** keep working with no network at all (their data is embedded); the chatbot, RAG page and embed page need connectivity because they call the Edge Functions.

To test locally:

```bash
cd web && python3 -m http.server 8080
# then open http://localhost:8080
```

(A plain `file://` open works too, but the service worker only registers over `http(s)://`.)

---

## If the site looks stale after a redeploy

The pages register a service worker that caches the app shell for offline use. HTML is fetched **network-first**, so a redeploy is normally picked up on the next load — but a browser with an *older* worker installed can keep serving old pages:

1. DevTools → **Application** → **Service Workers** → **Unregister**
2. Same tab → **Clear storage** → **Clear site data**
3. Reload

Opening the site in a private window also bypasses any installed worker — the quickest way to check whether you are looking at a cached copy.

---

## Before you make it public

**1. The anon key.** By default each page asks the visitor to paste your Supabase **anon** key and keeps it in `localStorage`. That is fine for a private or personal deployment. For a genuinely public site, put the URL and key in **`web/config.js`** and nobody is ever prompted — but **only after enabling Row Level Security**, because with RLS disabled that key lets anyone read *and write* every table:

```sql
alter table public.bala_vyakarana_chunks      enable row level security;
alter table public.bala_vyakarana_items       enable row level security;
alter table public.bala_vyakarana_paricchedas enable row level security;
alter table public.bala_vyakarana_document    enable row level security;

-- then allow public read-only access
create policy "read chunks" on public.bala_vyakarana_chunks
  for select to anon using (true);
-- …and similarly for the other tables the site should read
```

Enabling RLS with no policies blocks *all* client access, so add the `select` policies in the same pass.

**2. The project URL.** The pages carry `https://<your-project>.supabase.co` as a convenience default. Change it to a placeholder if you would rather not publish your project reference — and note that `config.js` is the single place to set it for a real deployment.

**3. CORS** is already open on both Edge Functions (`Access-Control-Allow-Origin: *`), so a deployed site can call them without changes.

**4. Secrets.** No API keys are in this repository. The Gemini key lives only in Edge Function secrets (`supabase secrets set GEMINI_API_KEY=…`).
