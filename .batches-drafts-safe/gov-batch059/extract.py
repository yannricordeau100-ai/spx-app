#!/usr/bin/env python3
"""Extract governance fields from DEF 14A html.gz files."""
import gzip, re, sys, os, json
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style'):
            self.skip += 1
    def handle_endtag(self, tag):
        if tag in ('script','style'):
            self.skip -= 1
    def handle_data(self, data):
        if self.skip == 0:
            self.parts.append(data)

def html_to_text(html):
    p = TextExtractor()
    try:
        p.feed(html)
    except Exception:
        pass
    text = ' '.join(p.parts)
    text = re.sub(r'\s+', ' ', text)
    return text

def grep_around(text, pattern, window=500, max_hits=3):
    hits = []
    for m in re.finditer(pattern, text, re.IGNORECASE):
        s = max(0, m.start()-window)
        e = min(len(text), m.end()+window)
        hits.append(text[s:e])
        if len(hits) >= max_hits:
            break
    return hits

def process(path):
    with gzip.open(path, 'rt', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    return html_to_text(html)

if __name__ == '__main__':
    path = sys.argv[1]
    outpath = sys.argv[2] if len(sys.argv) > 2 else None
    text = process(path)
    if outpath:
        with open(outpath, 'w') as f:
            f.write(text)
    print(f"Length: {len(text)}")
