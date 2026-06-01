import json, time, subprocess

UA = "Mettrik Research yannricordeau100@gmail.com"

CIKS = {
    'CPB': '0000016732',
    'CPRT': '0000900075',
    'CPT': '0000906345',
    'CRH': '0001396009',
    'CRL': '0001100682',
    'CRM': '0001108524',
    'CRWD': '0001535527',
    'CRWV': '0001769628',
    'CSCO': '0000858877',
}

def curl(url):
    r = subprocess.run(['curl','-s','-H',f'User-Agent: {UA}', url], capture_output=True, text=True, timeout=30)
    return r.stdout

results = {}
for ticker, cik in CIKS.items():
    try:
        q = f"https://efts.sec.gov/LATEST/search-index?q=%22DEF+14A%22&ciks={cik}&forms=DEF+14A"
        data = json.loads(curl(q))
        hits = data.get('hits', {}).get('hits', [])
        htm_hits = [h for h in hits if h['_id'].endswith('.htm')]
        htm_hits.sort(key=lambda h: h['_source']['file_date'], reverse=True)
        if not htm_hits:
            results[ticker] = {'err': 'no DEF14A htm found'}
            continue
        top = htm_hits[0]
        adsh = top['_source']['adsh']
        file_id = top['_id'].split(':')[1]
        file_date = top['_source']['file_date']
        period = top['_source'].get('period_ending')
        url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-','')}/{file_id}"
        results[ticker] = {'cik': cik, 'adsh': adsh, 'file': file_id, 'date': file_date, 'period_ending': period, 'url': url}
        print(f"{ticker}: {file_date} -> {url}")
    except Exception as e:
        results[ticker] = {'err': str(e)}
        print(f"{ticker}: ERR {e}")
    time.sleep(0.3)

json.dump(results, open('/tmp/gov-batch017/_def14a_urls.json','w'), indent=2)
print('Saved')
