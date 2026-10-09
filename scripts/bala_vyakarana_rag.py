#!/usr/bin/env python3
"""
RAG over the బాల వ్యాకరణము corpus in Supabase — Google Gemini version.

The corpus (public.bala_vyakarana_chunks) now holds TWO kinds of chunk:
    source = 'bala_vyakarana'   465 sutras of బాల వ్యాకరణము
    source = 'pdf'              2311 chunks from the extracted PDFs
                                (బాలవ్యాకరణ ఘంటాపథము, ప్రౌఢవ్యాకరణ ఘంటాపథము,
                                 సాహిత్య సోపానములు)

Commands:
    python bala_vyakarana_rag.py embed     # fill every NULL embedding (run once)
    python bala_vyakarana_rag.py ask "సంధి అంటే ఏమిటి?"

Environment (all required):
    SUPABASE_URL          e.g. https://qndkvizszwdvhrccjxtr.supabase.co
    SUPABASE_KEY          service_role key for `embed`; anon key is enough for `ask`
    GEMINI_API_KEY        free key from https://aistudio.google.com/apikey

No third-party packages. Retries on 429/5xx; if Google retires a model the 404
body names the replacement and we switch automatically.
"""
import argparse, json, os, re, time, urllib.request, urllib.error

SB_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SB_KEY = os.environ.get("SUPABASE_KEY", "")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001")
CHAT_MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-3.8-flash")
THINKING_LEVEL = os.environ.get("GEMINI_THINKING_LEVEL", "low")
DIMS = 768
GEMINI = "https://generativelanguage.googleapis.com/v1beta"


def http(method, url, headers, payload=None, timeout=180):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode()
            return r.status, (json.loads(body) if body else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, str(e)


def sb_headers(extra=None):
    h = {"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def g_headers():
    return {"Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY}


def gemini_call(model, method, payload, tries=6):
    """POST a Gemini method. Retries on 429/5xx with backoff; follows a 404's
    suggested replacement model once. Returns (model_used, status, body)."""
    status, body = 0, ""
    for attempt in range(tries):
        status, body = http("POST", f"{GEMINI}/models/{model}:{method}", g_headers(), payload)
        if status in (429, 500, 502, 503, 504):
            wait = 2 * (attempt + 1)
            print("  rate-limited (%s), waiting %ss…" % (status, wait), flush=True)
            time.sleep(wait)
            continue
        if status == 404 and isinstance(body, str):
            m = re.search(r"models/([A-Za-z0-9._\-]+)", body)
            if m and m.group(1) != model:
                print("  model %s retired, switching to %s" % (model, m.group(1)), flush=True)
                model = m.group(1)
                continue
        break
    return model, status, body


def embed_documents(texts):
    global EMBED_MODEL
    payload = {
        "requests": [
            {"model": "models/" + EMBED_MODEL,
             "content": {"parts": [{"text": t}]},
             "taskType": "RETRIEVAL_DOCUMENT",
             "output_dimensionality": DIMS}
            for t in texts
        ]
    }
    used, status, body = gemini_call(EMBED_MODEL, "batchEmbedContents", payload)
    if status != 200:
        raise SystemExit("Gemini batch embedding failed (%s, model %s): %s" % (status, used, body))
    EMBED_MODEL = used
    return [e["values"] for e in body["embeddings"]]


def embed_query(text):
    global EMBED_MODEL
    payload = {"content": {"parts": [{"text": text}]},
               "taskType": "RETRIEVAL_QUERY",
               "output_dimensionality": DIMS}
    used, status, body = gemini_call(EMBED_MODEL, "embedContent", payload)
    if status != 200:
        raise SystemExit("Gemini embedding failed (%s, model %s): %s" % (status, used, body))
    EMBED_MODEL = used
    return body["embedding"]["values"]


def gemini_answer(system, contents):
    global CHAT_MODEL
    # temperature / top_p / top_k are NOT supported on Gemini 3+ — omit them.
    # thinkingLevel keeps latency down (default 'medium' takes tens of seconds).
    base = {"systemInstruction": {"parts": [{"text": system}]}, "contents": contents}
    with_thinking = dict(base, generationConfig={"thinkingConfig": {"thinkingLevel": THINKING_LEVEL}})
    used, status, body = gemini_call(CHAT_MODEL, "generateContent", with_thinking)
    if status == 400 and isinstance(body, str) and "thinking" in body.lower():
        used, status, body = gemini_call(CHAT_MODEL, "generateContent", base)
    if status != 200:
        raise SystemExit("Gemini chat failed (%s, model %s): %s" % (status, used, body))
    CHAT_MODEL = used
    parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts)


def vec_literal(v):
    return "[" + ",".join("%.7f" % x for x in v) + "]"


def cmd_embed(args):
    if not (SB_URL and SB_KEY and GEMINI_KEY):
        raise SystemExit("Set SUPABASE_URL, SUPABASE_KEY and GEMINI_API_KEY first.")
    done = 0
    while True:
        status, rows = http(
            "GET",
            SB_URL + "/rest/v1/bala_vyakarana_chunks?select=id,content&embedding=is.null&limit=%d" % args.batch,
            sb_headers(),
        )
        if status != 200 or not isinstance(rows, list):
            raise SystemExit("Could not read chunks (%s): %s" % (status, rows))
        if not rows:
            break
        embeddings = embed_documents([r["content"] for r in rows])
        payload = [{"id": r["id"], "embedding": vec_literal(e)} for r, e in zip(rows, embeddings)]
        st, resp = http(
            "POST", SB_URL + "/rest/v1/rpc/set_chunk_embeddings",
            sb_headers(),
            {"payload": payload},
        )
        if st != 200:
            raise SystemExit("Could not write embeddings (%s): %s" % (st, resp))
        done += len(rows)
        print("embedded %d rows…" % done, flush=True)
        if len(rows) < args.batch:
            break
        time.sleep(args.sleep)
    print("Done. %d chunk(s) now have embeddings." % done)


def cmd_ask(args):
    if not (SB_URL and SB_KEY and GEMINI_KEY):
        raise SystemExit("Set SUPABASE_URL, SUPABASE_KEY and GEMINI_API_KEY first.")
    q = args.question
    embedding = embed_query(q)
    status, matches = http(
        "POST", SB_URL + "/rest/v1/rpc/match_rag",
        sb_headers(),
        {"query_embedding": embedding, "match_count": args.match_count, "source_filter": None},
    )
    if status != 200 or not isinstance(matches, list):
        raise SystemExit("Vector search failed (%s): %s" % (status, matches))

    context = "\n".join(
        "[%d] (%s · %s) %s" % (i + 1, m["doc"], m["ref"], m["content"])
        for i, m in enumerate(matches)
    )
    system = (
        "You are a scholarly assistant for the Telugu grammar text బాల వ్యాకరణము by చిన్నయ సూరి. "
        "You are given numbered excerpts from the sutras and from printed commentaries (ఘంటాపథము books). "
        "Answer using ONLY those excerpts, quoting and citing them as [n]. "
        "Reply in Telugu if the question is in Telugu, otherwise in the question's language. "
        "If the excerpts do not contain the answer, say so plainly rather than inventing one."
    )
    text = gemini_answer(system, [{"role": "user", "parts": [{"text": "Excerpts:\n%s\n\nQuestion: %s" % (context, q)}]}])

    print("\n=== ANSWER ===\n" + text)
    print("\n=== SOURCES ===")
    for i, m in enumerate(matches):
        print("[%d] %s · %s · similarity %.3f" % (i + 1, m["doc"], m["ref"], m["similarity"]))
        print("    " + m["content"][:160].replace("\n", " ") + ("…" if len(m["content"]) > 160 else ""))


def main():
    p = argparse.ArgumentParser(description="RAG over the బాల వ్యాకరణము corpus (Gemini)")
    sub = p.add_subparsers(dest="cmd", required=True)
    pe = sub.add_parser("embed", help="compute + store embeddings for every chunk without one")
    pe.add_argument("--batch", type=int, default=50)
    pe.add_argument("--sleep", type=float, default=1.5, help="seconds between batches")
    pe.set_defaults(func=cmd_embed)
    pa = sub.add_parser("ask", help="ask a question")
    pa.add_argument("question")
    pa.add_argument("--match-count", type=int, default=8)
    pa.set_defaults(func=cmd_ask)
    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
