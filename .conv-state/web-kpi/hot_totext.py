import sys, glob, os
from bs4 import BeautifulSoup

for path in sorted(glob.glob("/Users/yann/spx-app/.conv-state/web-kpi/hot_*.html")):
    base = os.path.splitext(path)[0]
    outpath = base + ".txt"
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "header", "footer", "nav"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if l]
    # dedupe consecutive
    out = []
    prev = None
    for l in lines:
        if l != prev:
            out.append(l)
        prev = l
    result = "\n".join(out)
    with open(outpath, "w", encoding="utf-8") as f:
        f.write(result)
    print(f"{os.path.basename(path)} -> {len(result)} chars")
