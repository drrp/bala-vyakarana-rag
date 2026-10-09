/* =====================================================================
   Site configuration — loaded before each page's own script.

   MODE 1 (private / personal use) — leave `supabaseAnonKey` empty.
   Each page asks for the anon key once, then remembers it in this
   browser. Because all pages now share one storage slot, you only
   paste it once and the whole site is connected.

   MODE 2 (public site) — paste the project's anon key below and no
   visitor is ever prompted. READ THE WARNING FIRST.
   ===================================================================== */
window.BALA_CONFIG = {
  // Row Level Security is now enabled on every bala_vyakarana_* table, with
  // read-only policies for the anon role — so the key below is safe to publish.
  supabaseUrl: "https://qndkvizszwdvhrccjxtr.supabase.co",

  // Paste the project's legacy anon key (starts with eyJ…) on the line below
  // and no visitor is ever asked for it. It is a publishable credential:
  // shipping it in a web page is intended, and RLS limits it to reading.
  supabaseAnonKey: ""
};

/* Seed the shared storage the pages read, so a filled-in config means
   nobody sees a prompt anywhere on the site. */
(function () {
  try {
    var C = window.BALA_CONFIG || {};
    if (C.supabaseUrl && C.supabaseUrl.indexOf("YOUR-PROJECT") === -1) {
      localStorage.setItem("bala_url", C.supabaseUrl);
    }
    if (C.supabaseAnonKey) {
      localStorage.setItem("bala_key", C.supabaseAnonKey);
    }
  } catch (e) { /* private mode / storage disabled — the prompt still works */ }
})();
