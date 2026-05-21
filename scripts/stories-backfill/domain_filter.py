"""
Domain filter for stories KPI extraction.

Used by stories backfill scripts to reject out-of-domain story labels
based on company sector (e.g. reject "AI Bookings" for a pharma company).

Created by sub-agent #124 (2026-05-21) following the request to add
domain validation post-hallucination concern.

Note: empirical audit on 80 paid retry tickers (#118) showed only 0 true
hallucinations in 80 stories. Filter is preventive for future runs.
"""


def canonical_sector(sector: str) -> str:
    """Map FR/EN sector names to canonical groups."""
    if not sector:
        return "unknown"
    s = sector.lower()
    if "sant" in s or "health" in s or "pharma" in s or "life sciences" in s:
        return "healthcare"
    if "énerg" in s or "energ" in s or "oil" in s or "gas" in s:
        return "energy"
    if "finan" in s or "bank" in s or "insur" in s:
        return "financials"
    if "consomm" in s or "consumer staple" in s or "staple" in s or "retail" in s:
        return "staples_or_retail"
    if "utilit" in s or "services aux collec" in s:
        return "utilities"
    if "immob" in s or "real estate" in s:
        return "real_estate"
    if "matéri" in s or "material" in s or "construction" in s:
        return "materials"
    if "industr" in s:
        return "industrials"
    if "tech" in s:
        return "technology"
    if "communicat" in s:
        return "comm_services"
    if "discré" in s or "discretionary" in s:
        return "consumer_disc"
    return "unknown"


# Out-of-domain keywords per canonical sector group.
# Empty list = no filtering (sector too broad or naturally cross-domain).
DOMAIN_FILTERS = {
    "healthcare": [
        "ai bookings", "cloud revenue", "cloud bookings", "saas arr",
        "subscribers", "subscription revenue", "vehicles produced",
        "barrels", "data center power", "data center capacity",
    ],
    "energy": [
        "subscription revenue", "cloud revenue", "ai bookings",
        "saas arr", "subscribers", "drug pipeline", "clinical trial",
        "fda approval",
    ],
    "financials": [
        "cloud capacity", "manufacturing capacity", "factory", "factories",
        "vehicles produced", "data center power", "drug pipeline",
        "fda approval", "barrels produced",
    ],
    "staples_or_retail": [
        "ai bookings", "cloud revenue", "saas arr", "data center",
        "drug pipeline", "clinical trial",
    ],
    "utilities": [
        "ai bookings", "cloud revenue", "saas arr", "drug pipeline",
        "vehicles produced", "subscribers",
    ],
    "real_estate": [
        "ai bookings", "cloud revenue", "manufacturing capacity",
        "vehicles produced", "drug pipeline",
    ],
    "materials": [
        "ai bookings", "cloud revenue", "saas arr", "subscribers",
        "drug pipeline",
    ],
    "industrials": [],
    "technology": [],
    "comm_services": [],
    "consumer_disc": [],
    "unknown": [],
}


def is_out_of_domain(story: dict, sector: str) -> bool:
    """Return True if story label suggests sector mismatch."""
    canon = canonical_sector(sector)
    filters = DOMAIN_FILTERS.get(canon, [])
    if not filters:
        return False

    # Concatenate all label-like fields
    label = " ".join(
        filter(
            None,
            [
                story.get("short") or "",
                story.get("name_fr") or "",
                story.get("name_en") or "",
                story.get("label") or "",
                story.get("title") or "",
            ],
        )
    ).lower()

    return any(kw in label for kw in filters)


def filter_stories(stories: list, sector: str) -> tuple[list, list]:
    """Return (kept, rejected) tuple."""
    kept = []
    rejected = []
    for s in stories:
        if isinstance(s, dict) and is_out_of_domain(s, sector):
            rejected.append(s)
        else:
            kept.append(s)
    return kept, rejected
