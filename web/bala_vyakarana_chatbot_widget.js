/*!
 * బాల వ్యాకరణము chatbot — embeddable widget
 * Drop this on any page:
 *
 *   <script src="bala_vyakarana_chatbot_widget.js"
 *           data-url="https://<project>.supabase.co"
 *           data-key="<anon / publishable key>"
 *           data-title="బాల వ్యాకరణము"
 *           data-accent="#b4441f"></script>
 *
 * It renders a floating button; clicking it opens a chat panel that talks to the
 * `bala-rag` Edge Function. All styles live in a shadow root, so it won't clash
 * with the host page.
 */
(function () {
  var me = document.currentScript;
  var cfg = {
    url: (me && me.dataset.url || "").replace(/\/$/, ""),
    key: me && me.dataset.key || "",
    title: me && me.dataset.title || "బాల వ్యాకరణము",
    subtitle: me && me.dataset.subtitle || "Telugu grammar assistant",
    accent: me && me.dataset.accent || "#b4441f",
    greeting: me && me.dataset.greeting ||
      "నమస్కారం! Ask me anything about బాల వ్యాకరణము — I'll answer from the sutras.",
    placeholder: me && me.dataset.placeholder || "Type a message… (Telugu or English)",
  };
  if (!cfg.url || !cfg.key) {
    console.warn("[bala-chatbot] data-url and data-key are required on the script tag.");
    return;
  }
  var FN = cfg.url + "/functions/v1/bala-rag";

  var host = document.createElement("div");
  host.setAttribute("data-bala-chatbot", "");
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  root.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:"IBM Plex Sans","Noto Sans Telugu",system-ui,sans-serif}' +
    '.fab{position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;' +
      'background:' + cfg.accent + ';color:#fff;font-size:24px;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:2147483000;' +
      'display:grid;place-items:center;transition:transform .15s}' +
    '.fab:hover{transform:scale(1.06)}' +
    '.panel{position:fixed;right:20px;bottom:90px;width:380px;max-width:calc(100vw - 32px);height:min(600px,calc(100vh - 120px));' +
      'background:#faf7f2;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);z-index:2147483000;' +
      'display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(58,42,26,.14)}' +
    '.panel.open{display:flex}' +
    '.hd{background:' + cfg.accent + ';color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}' +
    '.hd .mk{width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,.18);display:grid;place-items:center;' +
      'font-family:"Noto Serif Telugu",serif;font-size:17px;font-weight:600}' +
    '.hd b{font-family:"Noto Serif Telugu",serif;font-size:15px;font-weight:600;display:block;line-height:1.25}' +
    '.hd small{opacity:.85;font-size:11px}' +
    '.hd .x{margin-left:auto;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;opacity:.9;line-height:1}' +
    '.msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}' +
    '.m{max-width:86%;padding:9px 12px;border-radius:13px;font-family:"Noto Serif Telugu",serif;font-size:14.5px;line-height:1.6;white-space:pre-wrap;overflow-wrap:break-word}' +
    '.m.u{align-self:flex-end;background:' + cfg.accent + ';color:#fff;border-bottom-right-radius:4px}' +
    '.m.a{align-self:flex-start;background:#fff;color:#2a251f;border:1px solid rgba(58,42,26,.12);border-bottom-left-radius:4px}' +
    '.m.a .src{margin-top:8px;border-top:1px dashed rgba(58,42,26,.18);padding-top:6px;font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:#9a8f80}' +
    '.m code{font-family:"IBM Plex Mono",monospace;font-size:.9em;background:rgba(120,90,60,.12);padding:0 3px;border-radius:3px}' +
    '.m p{margin:0 0 9px}.m p:last-child{margin-bottom:0}' +
    '.m .hd{font-weight:600;color:' + cfg.accent + ';margin:12px 0 5px;line-height:1.5}' +
    '.m .hd.h1{font-size:15.5px}.m .hd.h2{font-size:14.5px}.m .hd.h3{font-size:13.5px}' +
    '.m .sutra{margin:11px 0;padding:9px 12px;text-align:center;background:rgba(120,90,60,.07);border-radius:8px;line-height:1.8}' +
    '.m ul,.m ol{margin:5px 0 9px;padding-left:20px}.m li{margin:3px 0}' +
    '.m li>ul,.m li>ol{margin:3px 0;padding-left:16px}' +
    '.m strong{font-weight:600;color:' + cfg.accent + '}' +
    '.typing{align-self:flex-start;color:#9a8f80;font-family:"IBM Plex Mono",monospace;font-size:11px}' +
    '.in{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(58,42,26,.12);background:#fff}' +
    '.in textarea{flex:1;resize:none;border:1px solid rgba(58,42,26,.2);border-radius:10px;padding:9px 11px;' +
      'font-family:"Noto Serif Telugu",serif;font-size:14.5px;outline:none;max-height:110px;background:#faf7f2;color:#2a251f}' +
    '.in textarea:focus{border-color:' + cfg.accent + '}' +
    '.in button{border:none;background:' + cfg.accent + ';color:#fff;border-radius:10px;padding:0 15px;cursor:pointer;font-size:14px;font-weight:600}' +
    '.in button:disabled{opacity:.5}' +
    '.pw{font-family:"IBM Plex Mono",monospace;font-size:10px;color:#9a8f80;text-align:center;padding:0 0 8px;background:#fff}' +
    '@media(max-width:480px){.panel{right:8px;left:8px;width:auto;bottom:84px;height:calc(100vh - 108px)}.fab{right:14px;bottom:14px}}' +
    '</style>' +
    '<button class="fab" part="button" aria-label="Open chat">💬</button>' +
    '<div class="panel" role="dialog" aria-label="' + cfg.title + ' chat">' +
      '<div class="hd"><div class="mk">బా</div><div><b>' + cfg.title + '</b><small>' + cfg.subtitle + '</small></div>' +
      '<button class="x" aria-label="Close">×</button></div>' +
      '<div class="msgs"></div>' +
      '<div class="in"><textarea rows="1" placeholder="' + cfg.placeholder + '"></textarea><button class="go">Send</button></div>' +
      '<div class="pw">Answers grounded in your sutras · powered by the bala-rag function</div>' +
    '</div>';

  var fab = root.querySelector(".fab"), panel = root.querySelector(".panel"),
      msgs = root.querySelector(".msgs"), ta = root.querySelector(".in textarea"),
      go = root.querySelector(".go"), x = root.querySelector(".x");
  var history = [];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function md(s) {
    function inline(t) {
      return esc(t)
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
        .replace(/`([^`\n]+)`/g, "<code>$1</code>");
    }
    var out = [], stack = [];
    function closeOne() {
      var top = stack.pop();
      if (!top.items.length) return;
      var depth = stack.length;
      var html = "<" + top.type + ' class="lv' + depth + '">' + top.items.join("") + "</" + top.type + ">";
      if (stack.length && stack[stack.length - 1].items.length) {
        var p = stack[stack.length - 1].items;
        p[p.length - 1] = p[p.length - 1].replace(/<\/li>$/, html + "</li>");
      } else out.push(html);
    }
    function closeAll() { while (stack.length) closeOne(); }
    function item(type, level, text) {
      level = Math.min(level, 2);
      while (stack.length > level + 1) closeOne();
      if (stack.length === level + 1 && stack[stack.length - 1].type !== type) closeOne();
      while (stack.length < level + 1) stack.push({ type: type, items: [] });
      stack[stack.length - 1].items.push("<li>" + inline(text) + "</li>");
    }
    (s == null ? "" : String(s)).split("\n").forEach(function (raw) {
      var line = raw.replace(/\s+$/, ""), m;
      if ((m = line.match(/^(\s*)[-*•]\s+(.*)$/))) { item("ul", Math.floor(m[1].replace(/\t/g, "  ").length / 2), m[2]); return; }
      if ((m = line.match(/^(\s*)\d+[.)]\s+(.*)$/))) { item("ol", Math.floor(m[1].replace(/\t/g, "  ").length / 2), m[2]); return; }
      if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { closeAll(); out.push('<div class="hd h' + Math.min(m[1].length, 3) + '">' + inline(m[2]) + "</div>"); return; }
      if ((m = line.match(/^\s*>\s?(.*)$/))) { closeAll(); out.push('<div class="sutra">' + inline(m[1]) + "</div>"); return; }
      if (!line.trim()) return;
      closeAll(); out.push("<p>" + inline(line) + "</p>");
    });
    closeAll();
    return out.join("");
  }

  function add(role, text) {
    var d = document.createElement("div");
    d.className = "m " + role;
    d.innerHTML = md(text);
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function open() { panel.classList.add("open"); ta.focus(); if (!msgs.children.length) add("a", cfg.greeting); }
  function close() { panel.classList.remove("open"); }
  fab.addEventListener("click", function () { panel.classList.contains("open") ? close() : open(); });
  x.addEventListener("click", close);
  ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 110) + "px"; });
  ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  go.addEventListener("click", send);

  function send() {
    var text = ta.value.trim();
    if (!text) return;
    ta.value = ""; ta.style.height = "auto";
    add("u", text);
    history.push({ role: "user", content: text });
    var t = document.createElement("div"); t.className = "typing"; t.textContent = "బా is thinking…";
    msgs.appendChild(t); msgs.scrollTop = msgs.scrollHeight;
    go.disabled = true;
    fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.key, "apikey": cfg.key },
      body: JSON.stringify({ messages: history, match_count: 14 }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        t.remove();
        if (res.status === 401) throw new Error('401 — the key was rejected. Use the legacy anon key (starts with "eyJ…"), not the "sb_publishable_…" key.');
        if (!res.ok || res.j.error) throw new Error(res.j.error ? (res.j.error + (res.j.detail ? " — " + res.j.detail : "")) : "HTTP error");
        add("a", res.j.answer || "(no answer)", res.j.sources);
        history.push({ role: "assistant", content: res.j.answer || "" });
      })
      .catch(function (e) { t.remove(); add("a", "⚠ " + (e.message || e)); })
      .then(function () { go.disabled = false; ta.focus(); });
  }
})();
