import json, os

# (quarter, total_underlying, ris_underlying, consulting_underlying)
# values are % underlying revenue growth as reported in each ER
rows = [
    ("Q4-2015", 5, 4, 5),
    ("Q1-2016", 4, 2, None),
    ("Q2-2016", 3, None, None),
    ("Q3-2016", 1, None, None),
    ("Q4-2016", 3, 5, None),
    ("Q1-2017", 4, 5, 3),
    ("Q2-2017", 3, 2, 4),
    ("Q3-2017", 3, 3, 2),
    ("Q4-2017", 4, 3, 6),
    ("Q1-2018", 4, 3, 5),
    ("Q2-2018", 3, 5, 1),
    ("Q3-2018", 5, 5, 5),
    ("Q4-2018", 4, 5, 3),
    ("Q1-2019", 4, 5, 2),
    ("Q2-2019", 4, 3, 5),
    ("Q3-2019", 5, 6, 4),
    ("Q4-2019", 3, 3, 2),
    ("Q1-2020", 5, 5, 3),
    ("Q2-2020", -2, 2, -6),
    ("Q3-2020", -1, 2, -4),
    ("Q4-2020", 1, 3, -1),
    ("Q1-2021", 6, 7, 3),
    ("Q2-2021", 13, 13, 12),
    ("Q3-2021", 13, 13, 12),
    ("Q4-2021", 10, 9, 11),
    ("Q1-2022", 10, 11, 10),
    ("Q2-2022", 10, 9, 10),
    ("Q3-2022", 8, 9, 8),
    ("Q4-2022", 7, 8, 6),
    ("Q1-2023", 9, 11, 5),
    ("Q2-2023", 11, 13, 8),
    ("Q3-2023", 10, 11, 9),
    ("Q4-2023", 7, 8, 7),
    ("Q1-2024", 9, 9, 9),
    ("Q2-2024", 6, 7, 4),
    ("Q3-2024", 5, 6, 4),
    ("Q4-2024", 7, 8, 6),
    ("Q1-2025", 4, 4, 4),
    ("Q2-2025", 4, 4, 3),
    ("Q3-2025", 4, 3, 5),
    ("Q4-2025", 4, 2, 5),
    ("Q1-2026", 4, 3, 5),
]

def hist(idx):
    return [{"q": r[0], "v": r[idx]} for r in rows if r[idx] is not None]

kpis = [
    {
        "short": "Underlying revenue growth",
        "name_fr": "Croissance sous-jacente du CA (consolide)",
        "name_en": "Underlying (organic) revenue growth",
        "value": 4, "unit": "%", "yoy": None, "pv_score": 9,
        "signal": "Croissance organique consolidee, KPI operationnel phare publie chaque trimestre.",
        "frequency": "quarterly", "first_seen": "Q4-2015", "last_seen": "current",
        "discontinued": False, "history": hist(1),
    },
    {
        "short": "R&IS underlying growth",
        "name_fr": "Croissance sous-jacente Risk & Insurance Services",
        "name_en": "Risk & Insurance Services underlying revenue growth",
        "value": 3, "unit": "%", "yoy": None, "pv_score": 8,
        "signal": "Croissance organique du segment courtage assurance, coeur de metier.",
        "frequency": "quarterly", "first_seen": "Q4-2015", "last_seen": "current",
        "discontinued": False, "history": hist(2),
    },
    {
        "short": "Consulting underlying growth",
        "name_fr": "Croissance sous-jacente Consulting",
        "name_en": "Consulting underlying revenue growth",
        "value": 5, "unit": "%", "yoy": None, "pv_score": 8,
        "signal": "Croissance organique du segment conseil (Mercer, Oliver Wyman/MMC).",
        "frequency": "quarterly", "first_seen": "Q4-2015", "last_seen": "current",
        "discontinued": False, "history": hist(3),
    },
]

out = {
    "ticker": "MRSH",
    "company": "Marsh & McLennan Companies (Marsh)",
    "source": "ER+earnings-calls",
    "kpis": kpis,
    "_extracted_at": "2026-07-05",
}

path = "/Users/yann/spx-app/.batches-drafts-safe/kpis-er/MRSH.json"
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as fh:
    json.dump(out, fh, indent=2, ensure_ascii=False)
print("KPIs:", len(kpis))
