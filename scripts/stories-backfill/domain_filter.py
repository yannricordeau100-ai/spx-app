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
# Extended by sub-agent #133 (2026-05-21) following JNJ "AI Design Wins"
# hallucination + 23 stés flagged _d_stories_requires_revalidation by #128.
DOMAIN_FILTERS = {
    "healthcare": [
        "ai bookings", "cloud revenue", "cloud bookings", "saas arr",
        "subscribers", "subscription revenue", "vehicles produced",
        "barrels", "data center power", "data center capacity",
        # extended #133:
        "ai design wins", "ai design win", "manufacturing capacity add",
        "capacity add", "design wins", "design win", "arr",
        "annual recurring revenue", "saas revenue", "platform revenue",
        "wafer", "wafers", "foundry", "semiconductor", "chips shipped",
        "data center", "hyperscaler",
    ],
    "energy": [
        "subscription revenue", "cloud revenue", "ai bookings",
        "saas arr", "subscribers", "drug pipeline", "clinical trial",
        "fda approval",
        # extended #133:
        "ai design wins", "ai design win", "design wins", "design win",
        "ai productivity gain", "arr", "annual recurring revenue",
        "saas revenue", "platform revenue", "wafer", "wafers",
        "foundry", "semiconductor", "phase 3", "phase 2", "fda",
        "vaccines", "biologics",
    ],
    "financials": [
        "cloud capacity", "manufacturing capacity", "factory", "factories",
        "vehicles produced", "data center power", "drug pipeline",
        "fda approval", "barrels produced",
        # extended #133:
        "ai design wins", "ai design win", "design wins", "design win",
        "manufacturing capacity add", "capacity add", "manufacturing",
        "wafer", "wafers", "foundry", "semiconductor", "chips shipped",
        "phase 3", "phase 2", "fda", "vaccines", "biologics", "barrels",
        "production volume", "tons produced",
    ],
    "staples_or_retail": [
        "ai bookings", "cloud revenue", "saas arr", "data center",
        "drug pipeline", "clinical trial",
        # extended #133:
        "ai design wins", "ai design win", "design wins", "design win",
        "wafer", "wafers", "foundry", "semiconductor", "chips shipped",
        "phase 3", "phase 2", "fda approval", "vaccines", "biologics",
        "barrels produced", "drilling", "oil production",
    ],
    "utilities": [
        "ai bookings", "cloud revenue", "saas arr", "drug pipeline",
        "vehicles produced", "subscribers",
        # extended #133:
        "ai design wins", "ai design win", "design wins", "design win",
        "manufacturing capacity add", "wafer", "wafers", "foundry",
        "semiconductor", "chips shipped", "data center revenue",
        "phase 3", "phase 2", "fda", "vaccines", "saas revenue",
        "arr", "annual recurring revenue", "platform revenue",
    ],
    "real_estate": [
        "ai bookings", "cloud revenue", "manufacturing capacity",
        "vehicles produced", "drug pipeline",
        # extended #133:
        "ai design wins", "ai design win", "design wins", "design win",
        "manufacturing capacity add", "manufacturing", "wafer",
        "wafers", "foundry", "semiconductor", "chips shipped",
        "ai r&d", "ai r&d spend", "cloud", "data center revenue",
        "phase 3", "phase 2", "fda", "vaccines", "biologics",
        "saas arr", "saas revenue", "arr",
    ],
    "materials": [
        "ai bookings", "cloud revenue", "saas arr", "subscribers",
        "drug pipeline",
        # extended #133:
        "ai design wins", "ai design win", "design wins", "design win",
        "manufacturing capacity add", "wafer", "wafers", "foundry",
        "semiconductor", "chips shipped", "data center revenue",
        "phase 3", "phase 2", "fda", "vaccines", "biologics",
        "annual recurring revenue", "platform revenue",
    ],
    "industrials": [
        # added by #133 — generic suspicious tech KPIs on industrials
        "ai design wins", "ai design win", "ai bookings", "design wins",
        "saas arr", "arr", "annual recurring revenue",
        "subscription revenue", "platform revenue", "drug pipeline",
        "clinical trial", "fda approval", "phase 3", "phase 2",
        "vaccines", "biologics", "wafer", "wafers", "foundry",
    ],
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
