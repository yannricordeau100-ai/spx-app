#!/usr/bin/env python3
"""
Inventory script for AI positioning evidence FR translation backlog.

Loops over audit clean_all stés, reads v2-pipeline-enrich/<ticker>.json,
filters where ai_positioning.evidence has items AND no FR equivalent exists yet
in v2-pipeline-i18n/<ticker>.fr.json (field ai_positioning_evidence_fr or
ai_positioning.evidence translated).

Writes src/data/_ai-evidence-fr-todo.json with shape:
[{ticker, items: [{idx, text_en}]}]
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIT_PATH = os.path.join(ROOT, "src/data/v1-9-pre-publication-audit.json")
ENRICH_DIR = os.path.join(ROOT, "src/data/v2-pipeline-enrich")
I18N_DIR = os.path.join(ROOT, "src/data/v2-pipeline-i18n")
OUT_PATH = os.path.join(ROOT, "src/data/_ai-evidence-fr-todo.json")


def is_probably_french(text: str) -> bool:
    """Quick heuristic to skip items that are already French.
    Checks for FR-specific accented chars or common FR words."""
    if not isinstance(text, str) or not text.strip():
        return False
    # Strong FR signals
    fr_signals = re.search(
        r"\b(les?|des?|une?|du|aux?|pour|avec|dans|sur|qui|que|sont|est|été|leur|notre|votre|cette|ces|nos|vos|sa|son|ses|ce|cet|si|ou|où|plus|moins|toujours|jamais|aussi|encore|déjà|très|trop|peu|beaucoup|sans|sous|entre|chez|vers|selon)\b",
        text,
        re.IGNORECASE,
    )
    has_fr_accents = bool(re.search(r"[àâäéèêëïîôöùûüÿç]", text))
    # Strong EN signals
    en_signals = re.search(
        r"\b(the|and|of|to|in|for|with|on|by|from|that|this|these|those|are|is|was|were|have|has|had|will|would|could|should|may|might|can|our|their|its|new|key)\b",
        text,
        re.IGNORECASE,
    )
    en_count = len(en_signals.group(0)) if en_signals else 0
    fr_count = (len(fr_signals.group(0)) if fr_signals else 0) + (5 if has_fr_accents else 0)
    # FR if FR signals dominate or has FR accents
    return fr_count > 0 and (has_fr_accents or fr_count >= en_count)


def main() -> int:
    if not os.path.exists(AUDIT_PATH):
        print(f"[fatal] audit not found: {AUDIT_PATH}", file=sys.stderr)
        return 1

    with open(AUDIT_PATH, "r", encoding="utf-8") as f:
        audit = json.load(f)

    clean_tickers = [a["ticker"] for a in audit.get("audits", []) if a.get("is_clean_all")]
    print(f"[info] clean_all stés in audit: {len(clean_tickers)}")

    todo = []
    total_items = 0
    skipped_already_fr = 0
    skipped_no_evidence = 0
    skipped_already_translated = 0

    for ticker in clean_tickers:
        # Source enrich file (lowercase per task spec)
        enrich_path = os.path.join(ENRICH_DIR, f"{ticker.lower()}.json")
        if not os.path.exists(enrich_path):
            # try uppercase fallback
            alt = os.path.join(ENRICH_DIR, f"{ticker}.json")
            if not os.path.exists(alt):
                continue
            enrich_path = alt

        try:
            with open(enrich_path, "r", encoding="utf-8") as f:
                enrich = json.load(f)
        except Exception as e:
            print(f"[warn] {ticker} enrich parse failed: {e}", file=sys.stderr)
            continue

        ai_pos = enrich.get("ai_positioning")
        if not isinstance(ai_pos, dict):
            skipped_no_evidence += 1
            continue
        evidence = ai_pos.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            skipped_no_evidence += 1
            continue

        # Check existing FR i18n file
        i18n_fr_path = os.path.join(I18N_DIR, f"{ticker.lower()}.fr.json")
        existing_fr = None
        if os.path.exists(i18n_fr_path):
            try:
                with open(i18n_fr_path, "r", encoding="utf-8") as f:
                    existing_fr = json.load(f)
            except Exception:
                existing_fr = None

        existing_evidence_fr = None
        if existing_fr:
            # Multiple possible places:
            existing_evidence_fr = existing_fr.get("ai_positioning_evidence_fr")
            if not existing_evidence_fr and isinstance(existing_fr.get("ai_positioning"), dict):
                existing_evidence_fr = existing_fr["ai_positioning"].get("evidence")

        items_to_translate = []
        for idx, item in enumerate(evidence):
            if not isinstance(item, str) or not item.strip():
                continue
            # Already translated at this idx?
            if isinstance(existing_evidence_fr, list) and idx < len(existing_evidence_fr):
                tr = existing_evidence_fr[idx]
                if isinstance(tr, str) and tr.strip():
                    skipped_already_translated += 1
                    continue
            # Already French?
            if is_probably_french(item):
                skipped_already_fr += 1
                continue
            items_to_translate.append({"idx": idx, "text_en": item})

        if items_to_translate:
            todo.append({"ticker": ticker, "items": items_to_translate})
            total_items += len(items_to_translate)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(todo, f, ensure_ascii=False, indent=2)

    print(f"[ok] stés to translate: {len(todo)}")
    print(f"[ok] total items to translate: {total_items}")
    print(f"[info] skipped (no evidence): {skipped_no_evidence}")
    print(f"[info] skipped (already FR): {skipped_already_fr}")
    print(f"[info] skipped (already translated): {skipped_already_translated}")
    print(f"[ok] output: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
