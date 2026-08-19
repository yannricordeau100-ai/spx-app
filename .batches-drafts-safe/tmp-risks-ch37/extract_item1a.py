#!/usr/bin/env python3
"""Extract Item 1A text from a 10-K htm.gz file."""
import sys, gzip, re
from html.parser import HTMLParser

class Stripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts=[]
        self.skip=0
    def handle_starttag(self,t,a):
        if t in ('script','style'): self.skip+=1
    def handle_endtag(self,t):
        if t in ('script','style'): self.skip=max(0,self.skip-1)
        if t in ('p','br','div','tr','li','h1','h2','h3','h4'): self.parts.append(' ')
    def handle_data(self,d):
        if not self.skip: self.parts.append(d)

def strip(html):
    s=Stripper(); s.feed(html)
    text=''.join(s.parts)
    # Unescape common entities
    text=re.sub(r'&nbsp;',' ',text)
    text=re.sub(r'&amp;','&',text)
    text=re.sub(r'&#\d+;',' ',text)
    text=re.sub(r'&[a-z]+;',' ',text)
    text=re.sub(r'\s+',' ',text)
    return text

def extract(path):
    with gzip.open(path,'rt',errors='ignore') as f:
        html=f.read()
    text=strip(html)
    # Find Item 1A start (need to skip TOC references)
    # Locate all occurrences and choose the biggest gap to Item 1B
    matches=[m.start() for m in re.finditer(r'ITEM\s*1A[\.\s]', text, re.IGNORECASE)]
    ends=[m.start() for m in re.finditer(r'ITEM\s*1B[\.\s]', text, re.IGNORECASE)]
    if not matches: return None
    # Prefer 1A that is immediately followed by "Risk Factors" heading.
    header=[m.start() for m in re.finditer(r'Item\s*1A[\.\s"]*Risk\s+Factors', text, re.IGNORECASE)]
    if header:
        # Prefer the one with most "material adverse" in the following 30k chars.
        best_h=None; best_c=-1
        for h in header:
            c=len(re.findall(r'material adverse|adversely affect', text[h:h+30000], re.IGNORECASE))
            if c>best_c:
                best_c=c; best_h=h
        if best_h is not None:
            matches=[best_h]
    # Filter out TOC-style 1A (has Item 1B within next 300 chars).
    body_starts=[s for s in matches if not re.search(r'Item\s*1B', text[s+5:s+300], re.IGNORECASE)]
    if not body_starts:
        body_starts=matches
    # Pick the 1A->1B pair maximizing "material adverse" density.
    best=None; best_ma=-1
    for s in body_starts:
        for e in ends:
            if e<=s+5000: continue
            body=text[s:e]
            ma=len(re.findall(r'material adverse|adversely affect', body, re.IGNORECASE))
            if ma > best_ma:
                best_ma=ma; best=(s,e)
    if not best:
        # Fall back to last 1A + fixed window
        s=matches[-1]
        return text[s:s+40000] if len(text)-s>5000 else None
    s,e = best
    section=text[s:e]
    return section[:40000]

if __name__=='__main__':
    r=extract(sys.argv[1])
    if r:
        print(r)
    else:
        sys.exit(1)
