import json,pathlib,sys,datetime
p=pathlib.Path(__file__).resolve().parent
for t,prod,verdict,alt,raison in json.load(sys.stdin):
 d=dict(ticker=t,produit_verificateur=prod,verdict=verdict,produit_alternatif=alt,raison=raison)
 (p/'V1'/f'{t}.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
 with (p/'JOURNAL.md').open('a') as f:f.write(f'{datetime.datetime.now().astimezone().isoformat()} | {t} | V1 | Deux nouvelles recherches ; verdict {verdict}.\n')
