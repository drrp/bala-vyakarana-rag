#!/usr/bin/env python3
"""Parse andhrabharati.com 'బాల వ్యాకరణము' (Bala Vyakarana) HTML pages into structured JSON.

Source: static HTML pages under https://andhrabharati.com/bhAshha/bAlavyAkaraNamu/
Content layout (per page):
  <div class="wmsect">
     <table>                     <- one or more top-level content tables
       <tr>                      <- one row per sutra (rule)
         <td>1.</td>             <- sutra number
         <td>                    <- content cell
            <font color='#0000ff'>SUTRA TEXT</font>
            <table>...</table>   <- zero or more example tables (nested)
         </td>
       </tr>
       <tr><td colspan=2>HEADING</td></tr>   <- optional section heading row
     </table>
  </div>
"""
import json, os, re, sys
from bs4 import BeautifulSoup

BASE = "https://andhrabharati.com/bhAshha/bAlavyAkaraNamu/"
ARCH = "/scratch/work/arch"

PARICCHEDAS = [
    ("pIThika",    "పీఠిక",              "Peethika",          "Preface"),
    ("saMJNa",     "సంజ్ఞా పరిచ్ఛేదము",  "Samjna Pariccheda", "Chapter on technical terms (samjnas)"),
    ("saMdhi",     "సంధి పరిచ్ఛేదము",    "Sandhi Pariccheda", "Chapter on sandhi (euphonic combination)"),
    ("tatsama",    "తత్సమ పరిచ్ఛేదము",   "Tatsama Pariccheda","Chapter on tatsama (Sanskrit loans)"),
    ("Achchhika",  "ఆచ్ఛిక పరిచ్ఛేదము",  "Achchhika Pariccheda","Chapter on achchhika (pure Telugu words)"),
    ("kAraka",     "కారక పరిచ్ఛేదము",    "Karaka Pariccheda", "Chapter on karaka (cases)"),
    ("samAsa",     "సమాస పరిచ్ఛేదము",    "Samasa Pariccheda", "Chapter on samasa (compounds)"),
    ("taddhita",   "తద్ధిత పరిచ్ఛేదము",  "Taddhita Pariccheda","Chapter on taddhita (secondary suffixes)"),
    ("kriya",      "క్రియా పరిచ్ఛేదము",  "Kriya Pariccheda",  "Chapter on kriya (verbs)"),
    ("kRidaMta",   "కృదంత పరిచ్ఛేదము",   "Krudanta Pariccheda","Chapter on krudanta (verbal derivatives)"),
    ("prakIrNaka", "ప్రకీర్ణ పరిచ్ఛేదము", "Prakirnaka Pariccheda","Miscellaneous chapter"),
]


def clean(s):
    if s is None:
        return ""
    s = s.replace("\u00a0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\s*\n\s*", "\n", s)
    return s.strip()


def cell_text(td):
    """Text of a cell, ignoring nested tables; <br> becomes newline."""
    frag = BeautifulSoup(str(td), "lxml")
    for t in frag.find_all("table"):
        t.extract()
    for br in frag.find_all("br"):
        br.replace_with("\n")
    txt = frag.get_text()
    return clean(txt)


def rows_of(table):
    """Rows of a table as lists of cell texts (nested tables excluded)."""
    rows = []
    for tr in table.find_all("tr", recursive=True):
        # skip rows that belong to a nested table
        parent_tbl = tr.find_parent("table")
        if parent_tbl is not table:
            continue
        cells = [cell_text(td) for td in tr.find_all("td", recursive=False)]
        if not cells:
            cells = [cell_text(td) for td in tr.find_all(["td", "th"], recursive=False)]
        if cells:
            rows.append(cells)
    return rows


def top_level_tables(container):
    """Tables that are not nested inside another table within the container."""
    out = []
    for t in container.find_all("table"):
        if t.find_parent("table") is None:
            out.append(t)
    return out


def parse_pariccheda(slug, html):
    soup = BeautifulSoup(html, "lxml")
    div = soup.find("div", class_="wmsect")
    if div is None:
        div = soup.body or soup

    items = []          # ordered list of sutras and headings
    sections = []       # section headings encountered
    counter = 0

    for tbl in top_level_tables(div):
        for tr in tbl.find_all("tr", recursive=True):
            if tr.find_parent("table") is not tbl:
                continue
            tds = tr.find_all("td", recursive=False)
            if not tds:
                continue

            # heading row: single cell spanning both columns
            if len(tds) == 1 and tds[0].get("colspan"):
                h = clean(tds[0].get_text()).strip("*").strip()
                if h:
                    item = {"type": "heading", "title": h}
                    items.append(item)
                    sections.append(h)
                continue

            if len(tds) == 1:
                # pIThika-style paragraph / verse row (no number column)
                txt = cell_text(tds[0])
                if txt:
                    items.append({"type": "paragraph", "text": txt})
                continue

            num_raw = clean(tds[0].get_text())
            content_td = tds[1]

            # sutra text: prefer the blue <font>, else all direct text
            frag = BeautifulSoup(str(content_td), "lxml")
            blocks_html = frag.find_all("table")
            blocks = [rows_of(b) for b in blocks_html]
            for b in blocks_html:
                b.extract()
            for br in frag.find_all("br"):
                br.replace_with("\n")
            full_text = clean(frag.get_text())

            font = frag.find("font")
            sutra_text = clean(font.get_text()) if font else full_text
            sutra_text = sutra_text.strip("*").strip()

            # any extra text outside the font and tables (rare)
            extra = full_text
            if font:
                extra = clean(full_text.replace(sutra_text, "", 1))

            num = None
            m = re.match(r"^(\d+)", num_raw)
            if m:
                num = int(m.group(1))
            counter += 1

            itype = "sutra" if num is not None else ("verse" if num_raw else "paragraph")
            item = {
                "type": itype,
                "number": num,
                "number_raw": num_raw,
                "text": sutra_text,
                "examples": [b for b in blocks if b],
            }
            if extra and extra != sutra_text and extra.strip():
                item["extra_text"] = extra
            items.append(item)

    return items


def parse_index(html):
    soup = BeautifulSoup(html, "lxml")
    div = soup.find("div", class_="wmsect")
    toc = []
    if div:
        for a in div.find_all("a"):
            toc.append({"title": clean(a.get_text()), "href": a.get("href")})
    return toc


def main():
    out = {
        "work": {
            "title_te": "బాల వ్యాకరణము",
            "title_translit": "Bala Vyakarana",
            "author_te": "చిన్నయ సూరి",
            "author_translit": "Chinnaya Suri",
            "language": "te",
            "script": "Telugu",
            "source_site": "ఆంధ్రభారతి (andhrabharati.com)",
            "index_url": BASE + "index.html",
            "scraped_at": "2026-10-09",
            "notes": (
                "Text scraped from the HTML tables of each pariccheda page. "
                "Each pariccheda has an ordered 'items' list; item.type is one of "
                "'sutra' (numbered rule), 'heading' (section title), 'verse' (unnumbered "
                "verse line) or 'paragraph'. A 'sutra' carries number, number_raw, text, "
                "and 'examples'. 'examples' is a list of tables; each table is a list of "
                "rows; each row is a list of cell strings (e.g. [word, '+', word, '=', result])."
            ),
        },
        "stats": {},
        "contents": [],
        "paricchedas": [],
    }

    idx = os.path.join(ARCH, "index.html")
    if os.path.exists(idx):
        out["contents"] = parse_index(open(idx, encoding="utf-8").read())

    for order, (slug, title_te, title_tr, title_en) in enumerate(PARICCHEDAS, 1):
        path = os.path.join(ARCH, slug + ".html")
        if not os.path.exists(path):
            print("MISSING", slug)
            continue
        html = open(path, encoding="utf-8").read()
        items = parse_pariccheda(slug, html)
        n_sutra = sum(1 for i in items if i["type"] == "sutra")
        nums = [i["number"] for i in items if i["type"] == "sutra" and i["number"]]
        headings = [i["title"] for i in items if i["type"] == "heading"]
        out["paricchedas"].append({
            "order": order,
            "id": slug,
            "title_te": title_te,
            "title_translit": title_tr,
            "title_en": title_en,
            "url": BASE + slug + ".html",
            "sutra_count": n_sutra,
            "sutra_numbers": nums,
            "headings": headings,
            "items": items,
        })
        print(f"{order:2} {slug:11} items={len(items):4} sutras={n_sutra:3} headings={sum(1 for i in items if i['type']=='heading')}")

    out["stats"] = {
        "paricchedas": len(out["paricchedas"]),
        "sutras_total": sum(p["sutra_count"] for p in out["paricchedas"]),
    }

    with open("/scratch/work/bala_vyakarana.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("written /scratch/work/bala_vyakarana.json")


if __name__ == "__main__":
    main()
