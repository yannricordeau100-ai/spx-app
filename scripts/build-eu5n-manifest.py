import os, json, hashlib, sys
from datetime import datetime, timezone

COUNTRY_MAP = {
    ".PA": "France",
    ".DE": "Allemagne",
    ".MI": "Italie",
    ".SW": "Suisse",
    ".AS": "Pays-Bas",
    ".ST": "Suède",
    ".CO": "Danemark",
    ".HE": "Finlande",
    ".OL": "Norvège",
}

ROOT = "/Users/yann/spx-app/sec-data/cat3-european"
TICKERS_FILE = "/tmp/eu5n-cohort-5-5-tickers.txt"
OVERLAP_FILE = "/Users/yann/spx-app/sec-data/_meta/eu5n-vs-v195-overlap.json"
OUT = "/Users/yann/spx-app/sec-data/_meta/eu5n-cohort.json"

with open(TICKERS_FILE) as f:
    tickers = sorted([l.strip() for l in f if l.strip()])

with open(OVERLAP_FILE) as f:
    overlap_data = json.load(f)

shared_set = set(overlap_data["shared"])

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def country_for(ticker):
    for suf, name in COUNTRY_MAP.items():
        if ticker.endswith(suf):
            return name, suf
    return "Unknown", ""

stes = []
by_country = {}
total_bytes_all = 0

for tk in tickers:
    country, suf = country_for(tk)
    by_country[country] = by_country.get(country, 0) + 1
    at_dir = os.path.join(ROOT, tk, "annual-text")
    years_present = []
    hashes = {}
    sizes = {}
    total_bytes = 0
    for yr in ["2020", "2021", "2022", "2023", "2024"]:
        path = os.path.join(at_dir, f"{yr}.txt")
        if os.path.exists(path):
            years_present.append(yr)
            sz = os.path.getsize(path)
            sizes[yr] = sz
            total_bytes += sz
            hashes[yr] = sha256_file(path)
    total_bytes_all += total_bytes
    stes.append({
        "ticker": tk,
        "country": country,
        "suffix": suf,
        "sec_data_path": f"cat3-european/{tk}/annual-text/",
        "years_present": years_present,
        "total_bytes": total_bytes,
        "bytes_per_year": sizes,
        "sha256_per_year": hashes,
        "in_v195": tk in shared_set,
    })

manifest = {
    "cohort_name": "EU5+N",
    "frozen_at": datetime.now(timezone.utc).isoformat(),
    "definition": "France .PA + Allemagne .DE + Italie .MI + Suisse .SW + Pays-Bas .AS + Suède .ST + Danemark .CO + Finlande .HE + Norvège .OL",
    "window": "2020-2024 (5 ans)",
    "criteria": "5/5 annual-text files validés anti-cross-pollution",
    "source_root": "/Users/yann/spx-app/sec-data/cat3-european",
    "total_stes": len(stes),
    "total_bytes": total_bytes_all,
    "by_country": dict(sorted(by_country.items())),
    "v195_overlap": {
        "v195_source": overlap_data["v195_source"],
        "v195_total": overlap_data["v195_total"],
        "shared_count": overlap_data["overlap_count"],
        "eu5n_only_count": overlap_data["eu5n_only_count"],
        "v195_only_count": overlap_data["v195_only_count"],
        "shared": overlap_data["shared"],
        "eu5n_only": overlap_data["eu5n_only"],
    },
    "stes": stes,
    "notes": [
        "official_name est laissé null : sera enrichi via lookup nom sté ultérieurement.",
        "Étanchéité : aucune sté EU5+N n'est référencée dans src/data/v1-9-*.json sauf si listée dans v195_overlap.shared.",
        "Réutilisation V2.0 : ce manifest est self-contained, restorable depuis le tarball backup.",
    ]
}

with open(OUT, "w") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print(f"Manifest written: {OUT}")
print(f"Total stés: {len(stes)}, total bytes: {total_bytes_all:,}")
print(f"By country: {dict(sorted(by_country.items()))}")
