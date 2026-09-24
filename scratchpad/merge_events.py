import json, os, shutil
picked = json.load(open("/Users/yann/spx-app/scratchpad/picked_events.json"))
ok=[]; fail=[]
for tk, new_events in picked.items():
    p = f"/Users/yann/spx-app/src/data/companies/{tk}.json"
    plow = f"/Users/yann/spx-app/src/data/companies/{tk.lower()}.json"
    try:
        d = json.load(open(p))
    except Exception as e:
        fail.append(f"{tk}:{e}")
        continue
    existing = d.get("events") or []
    existing_dates = { (e.get("date"), (e.get("title") or "")[:40]) for e in existing }
    added = 0
    for ev in new_events:
        key = (ev["date"], ev["title"][:40])
        if key in existing_dates: continue
        existing.append(ev)
        added += 1
    # Sort desc by date
    def sk(e):
        return e.get("date") or f"{e.get('year',0)}-{e.get('month',0):02d}-01"
    existing.sort(key=sk, reverse=True)
    d["events"] = existing
    d["_events_8k_backfill_at"] = "2026-07-12"
    tmp = p + ".tmp"
    json.dump(d, open(tmp,'w'), ensure_ascii=False, indent=2)
    os.replace(tmp, p)
    # Sync lowercase copy if it exists as a separate file
    try:
        if os.path.exists(plow) and os.stat(plow).st_ino != os.stat(p).st_ino:
            shutil.copy(p, plow)
    except Exception:
        pass
    ok.append(f"{tk}:{len(existing)}")
print(json.dumps({"ok":ok,"fail":fail}, ensure_ascii=False))
