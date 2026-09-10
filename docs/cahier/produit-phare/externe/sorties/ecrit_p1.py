import json,pathlib,sys,datetime
p=pathlib.Path(__file__).resolve().parent
soc={x['ticker']:x for x in json.loads((p.parent/'societes-a-traiter.json').read_text())}
for r in json.load(sys.stdin):
 t,prod,kpi,unit,typ,conf,just,urls=r
 d=dict(ticker=t,nom=soc[t]['nom'],produit=prod,kpi=kpi,unite=unit,type=typ,donnees_probables=[dict(url=u,note='Source consultée pour identifier le produit ; série annuelle à rechercher.') for u in urls],kpi_existant=None,existant_10_ans=False,hesitation=None,pas_de_produit=prod is None,raison=just if prod is None else None,confiance=conf,justification=just)
 (p/'P1'/f'{t}.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
 with (p/'JOURNAL.md').open('a') as f:f.write(f'{datetime.datetime.now().astimezone().isoformat()} | {t} | P1 | Deux recherches effectuées ; identification écrite ; série décennale non vérifiée.\n')
