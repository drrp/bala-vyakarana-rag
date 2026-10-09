// Offline shell for the బాల వ్యాకరణము site.
// Caches this origin's own files only — Supabase / Gemini / font CDNs always go to the network.
const CACHE = "bala-vyakarana-v2";
const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest", "./pwa.js", "./config.js",
  "./bala_vyakarana_viewer.html",
  "./bala_vyakarana_supabase_viewer.html",
  "./bala_vyakarana_rag_demo.html",
  "./bala_vyakarana_chatbot.html",
  "./bala_vyakarana_rag.html",
  "./bala_vyakarana_embed.html",
  "./bala_vyakarana_chatbot_widget.js",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/icon-512-maskable.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch API/CDN traffic

  // HTML pages: network first, so a redeploy is picked up on the next load
  if (req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") !== -1) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // everything else: cache first, fall back to the network
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
    )
  );
});
