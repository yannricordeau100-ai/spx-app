import sys, re
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip=0; self.out=[]
    def handle_starttag(self,t,a):
        if t in ('script','style'): self.skip+=1
    def handle_endtag(self,t):
        if t in ('script','style'): self.skip-=1
    def handle_data(self,d):
        if not self.skip: self.out.append(d)
p=P(); p.feed(sys.stdin.read())
txt=' '.join(p.out)
txt=re.sub(r'\s+',' ',txt)
# Find ALL Item 1A occurrences; pick longest section before next Item header
matches=[m.start() for m in re.finditer(r'Item\s*1A[\.\s]+Risk\s*Factors', txt, re.IGNORECASE)]
best=''
for s in matches:
    # find next "Item 1B" or "Item 2." or "Unresolved Staff Comments" or "Item 7." after s
    sub=txt[s:s+400000]
    e=re.search(r'(Item\s*1B[\.\s]|Item\s*2\.\s*Properties|Unresolved Staff Comments|Item\s*7\.\s*Management)', sub[200:], re.IGNORECASE)
    if e:
        seg=sub[:200+e.start()]
        if len(seg)>len(best):
            best=seg
print(best if best else txt[:200000])
