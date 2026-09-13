#!/usr/bin/env python3
"""Chaine 23h (Mac) : declenche l alerte rouge des mises a jour, calculee en ligne
par /api/cron/alertes-maj (independante des crons de mise a jour). --email : envoi
du courriel si le rouge a change. Jeton : VISUAL_AUDIT_TOKEN de .env.local."""
import os,sys,json,urllib.request,urllib.parse
env={}
for l in open(os.path.join(os.path.dirname(__file__),"..",".env.local")):
    if "=" in l and not l.startswith("#"): k,v=l.rstrip("\n").split("=",1); env[k]=v.strip('"')
j=env.get("VISUAL_AUDIT_TOKEN")
if not j: print("jeton absent"); sys.exit(0)
url="https://mettrik-niveau2.vercel.app/api/cron/alertes-maj?"+urllib.parse.urlencode({"audit_token":j,"email":"1" if "--email" in sys.argv else "0"})
try:
    with urllib.request.urlopen(url,timeout=290) as r: d=json.load(r)
    print("alerte :",d.get("rougesTotal"),"rouge(s) ;",d.get("stesRouges"),"ste(s) ; email",d.get("email"))
    os.makedirs(os.path.join(os.path.dirname(__file__),"..","src","data"),exist_ok=True)
    json.dump(d,open(os.path.join(os.path.dirname(__file__),"..","src","data","alertes-maj.json"),"w"),ensure_ascii=False,indent=1)
except Exception as e: print("alerte impossible :",e)
