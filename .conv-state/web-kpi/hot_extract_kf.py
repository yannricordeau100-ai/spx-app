import re, glob, os
from bs4 import BeautifulSoup

for path in sorted(glob.glob("/Users/yann/spx-app/.conv-state/web-kpi/hot_*.html")):
    with open(path, encoding="utf-8", errors="ignore") as f:
        html = f.read()
    soup = BeautifulSoup(html, "html.parser")
    divs = soup.find_all("div", attrs={"data-jst-type": "countup"})
    if not divs:
        continue
    print(f"=== {os.path.basename(path)} ===")
    for d in divs:
        val = d.get("data-value", "")
        prefix = d.get("data-prefix", "")
        suffix = d.get("data-suffix", "")
        label_p = d.find_all("p")
        label = ""
        if len(label_p) >= 2:
            label = label_p[1].get_text(strip=True)
        elif label_p:
            label = label_p[-1].get_text(strip=True)
        print(f"  {prefix}{val}{suffix} -- {label}")
