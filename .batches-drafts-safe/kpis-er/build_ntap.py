import json

kpis = [
    {
        "short": "All-flash array revenue run rate",
        "name_fr": "Taux annualise de revenus baies 100% flash",
        "name_en": "All-flash array annualized net revenue run rate",
        "value": 4.2,
        "unit": "USD billion",
        "yoy": "+18%",
        "pv_score": 8,
        "signal": "Coeur du portefeuille stockage, croissance soutenue portee par la demande AI et le #1 part de marche all-flash.",
        "frequency": "quarterly",
        "first_seen": "Q2-2018",
        "last_seen": "Q3-2026",
        "discontinued": False,
        "history": [
            {"q": "Q2-2018", "v": 1.7},
            {"q": "Q3-2018", "v": 2.0},
            {"q": "Q4-2018", "v": 2.4},
            {"q": "Q1-2019", "v": 2.2},
            {"q": "Q2-2019", "v": 2.2},
            {"q": "Q3-2019", "v": 2.4},
            {"q": "Q2-2020", "v": 2.2},
            {"q": "Q3-2020", "v": 2.3},
            {"q": "Q2-2022", "v": 3.1},
            {"q": "Q3-2022", "v": 3.2},
            {"q": "Q4-2022", "v": 3.2},
            {"q": "Q3-2024", "v": 3.4},
            {"q": "Q4-2024", "v": 3.6},
            {"q": "Q1-2025", "v": 3.4},
            {"q": "Q2-2025", "v": 3.8},
            {"q": "Q3-2025", "v": 3.8},
            {"q": "Q4-2025", "v": 4.1},
            {"q": "Q1-2026", "v": 3.6},
            {"q": "Q2-2026", "v": 4.1},
            {"q": "Q3-2026", "v": 4.2}
        ]
    },
    {
        "short": "All-flash array quarterly revenue",
        "name_fr": "Revenus trimestriels baies 100% flash",
        "name_en": "All-flash array quarterly net revenue",
        "value": 1.2,
        "unit": "USD billion",
        "yoy": "+18%",
        "pv_score": 7,
        "signal": "Record trimestriel a 1,2 Md$ au Q4-2026, moteur principal de la croissance materielle.",
        "frequency": "quarterly",
        "first_seen": "Q1-2026",
        "last_seen": "current",
        "discontinued": False,
        "history": [
            {"q": "Q1-2026", "v": 0.893},
            {"q": "Q2-2026", "v": 1.0},
            {"q": "Q3-2026", "v": 1.0},
            {"q": "Q4-2026", "v": 1.2}
        ]
    },
    {
        "short": "Public Cloud ARR",
        "name_fr": "Revenu recurrent annualise Public Cloud",
        "name_en": "Public Cloud annualized revenue run rate (ARR)",
        "value": 630,
        "unit": "USD million",
        "yoy": None,
        "pv_score": 6,
        "signal": "Ancien indicateur cloud, croissance forte puis plateau, abandonne apres le Q4-2024 au profit du revenu de segment Public Cloud.",
        "frequency": "quarterly",
        "first_seen": "Q2-2022",
        "last_seen": "Q4-2024",
        "discontinued": True,
        "history": [
            {"q": "Q2-2022", "v": 388},
            {"q": "Q3-2022", "v": 469},
            {"q": "Q4-2022", "v": 505},
            {"q": "Q1-2023", "v": 584},
            {"q": "Q2-2023", "v": 603},
            {"q": "Q3-2023", "v": 605},
            {"q": "Q1-2024", "v": 619},
            {"q": "Q2-2024", "v": 609},
            {"q": "Q3-2024", "v": 608},
            {"q": "Q4-2024", "v": 630}
        ]
    },
    {
        "short": "Public Cloud revenue",
        "name_fr": "Revenus du segment Public Cloud",
        "name_en": "Public Cloud segment net revenue",
        "value": 182,
        "unit": "USD million",
        "yoy": "+11%",
        "pv_score": 7,
        "signal": "Segment cloud strategique, retour a la croissance porte par les services de stockage first-party et marketplace.",
        "frequency": "quarterly",
        "first_seen": "Q3-2024",
        "last_seen": "current",
        "discontinued": False,
        "history": [
            {"q": "Q3-2024", "v": 151},
            {"q": "Q1-2025", "v": 159},
            {"q": "Q2-2025", "v": 168},
            {"q": "Q3-2025", "v": 174},
            {"q": "Q4-2025", "v": 164},
            {"q": "Q1-2026", "v": 161},
            {"q": "Q2-2026", "v": 171},
            {"q": "Q3-2026", "v": 174},
            {"q": "Q4-2026", "v": 182}
        ]
    },
    {
        "short": "First-party & marketplace cloud growth",
        "name_fr": "Croissance stockage cloud first-party et marketplace",
        "name_en": "First-party and marketplace cloud storage services revenue growth",
        "value": 27,
        "unit": "% YoY",
        "yoy": None,
        "pv_score": 7,
        "signal": "Moteur du segment cloud, croissance a deux chiffres eleves via les hyperscalers (FSx, ANF, GCNV).",
        "frequency": "quarterly",
        "first_seen": "Q3-2025",
        "last_seen": "current",
        "discontinued": False,
        "history": [
            {"q": "Q1-2026", "v": 33},
            {"q": "Q2-2026", "v": 32},
            {"q": "Q3-2026", "v": 27}
        ]
    },
    {
        "short": "Billings",
        "name_fr": "Facturations (billings)",
        "name_en": "Billings",
        "value": 2163,
        "unit": "USD million",
        "yoy": "+6%",
        "pv_score": 6,
        "signal": "Indicateur avance de la demande, neuf trimestres consecutifs de croissance annuelle jusqu'au Q3-2026.",
        "frequency": "quarterly",
        "first_seen": "Q1-2023",
        "last_seen": "current",
        "discontinued": False,
        "history": [
            {"q": "Q1-2023", "v": 1560},
            {"q": "Q2-2023", "v": 1602},
            {"q": "Q3-2023", "v": 1572},
            {"q": "Q1-2024", "v": 1299},
            {"q": "Q2-2024", "v": 1454},
            {"q": "Q3-2024", "v": 1687},
            {"q": "Q4-2024", "v": 1814},
            {"q": "Q1-2025", "v": 1449},
            {"q": "Q2-2025", "v": 1586},
            {"q": "Q3-2025", "v": 1713},
            {"q": "Q4-2025", "v": 2032},
            {"q": "Q1-2026", "v": 1511},
            {"q": "Q2-2026", "v": 1646},
            {"q": "Q3-2026", "v": 1886},
            {"q": "Q4-2026", "v": 2163}
        ]
    }
]

data = {
    "ticker": "NTAP",
    "company": "NetApp, Inc.",
    "source": "ER+earnings-calls",
    "kpis": kpis,
    "_extracted_at": "2026-07-05"
}

with open("/Users/yann/spx-app/.batches-drafts-safe/kpis-er/NTAP.json", "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print("written", len(kpis), "kpis")
