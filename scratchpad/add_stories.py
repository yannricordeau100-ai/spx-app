#!/usr/bin/env python3
"""Append stories to data-lake/<T>/stories_fr.json (or create stories/extracted.json).
Preserves existing stories, appends new ones with is_short_history: true.
"""
import json, os, sys

BASE = "/Users/yann/spx-app/data-lake"

def add(ticker, new_stories, source_note="ER Q1 2026"):
    d = os.path.join(BASE, ticker)
    fpath = os.path.join(d, "stories_fr.json")
    fpath_alt = os.path.join(d, "stories", "extracted.json")
    target = None
    if os.path.exists(fpath):
        target = fpath
    elif os.path.exists(fpath_alt):
        target = fpath_alt
    else:
        # Create stories_fr.json
        target = fpath
        data = {"_source": f"stories_kpis ({source_note})", "stories": []}
        os.makedirs(os.path.dirname(target) or d, exist_ok=True)
        json.dump(data, open(target,"w"), ensure_ascii=False, indent=2)

    data = json.load(open(target))
    if isinstance(data, list):
        arr = data
    else:
        arr = data.get("stories") or data.get("Stories") or []
        if "Stories" in data and "stories" not in data:
            data["stories"] = arr
            del data["Stories"]

    before_cats = set()
    for x in arr:
        c = x.get("story_category") or x.get("Story_category")
        if c: before_cats.add(c)

    for s in new_stories:
        s.setdefault("is_short_history", True)
        s.setdefault("is_generic", False)
        s.setdefault("_source", source_note)
        arr.append(s)

    after_cats = set(before_cats)
    for s in new_stories:
        if s.get("story_category"):
            after_cats.add(s["story_category"])

    if isinstance(data, dict):
        data["stories"] = arr
        json.dump(data, open(target,"w"), ensure_ascii=False, indent=2)
    else:
        json.dump(arr, open(target,"w"), ensure_ascii=False, indent=2)

    return len(before_cats), len(after_cats), [s["short"] for s in new_stories]

if __name__ == "__main__":
    payload = json.loads(sys.stdin.read())
    results = {}
    for t, spec in payload.items():
        b, a, shorts = add(t, spec["stories"], spec.get("source","ER latest"))
        results[t] = {"before_cat": b, "after_cat": a, "added_shorts": shorts}
    print(json.dumps(results, ensure_ascii=False))
