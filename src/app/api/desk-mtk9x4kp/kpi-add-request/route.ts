/**
 * /api/desk-mtk9x4kp/kpi-add-request — POST
 *
 * Crée une nouvelle demande KPI multi-sté en statut `pending`. Le script
 * Python scripts/run-kpi-add-request.py la prendra en charge ensuite.
 *
 * Body attendu :
 *   {
 *     description: string,
 *     kpi_short: string,
 *     kpi_name_en: string,
 *     kpi_name_fr?: string,
 *     kpi_explanation: string,
 *     kpi_type: string,
 *     kpi_expected_unit: string,
 *     extraction_prompt: string,
 *     fallback_story?: boolean,
 *     tickers: string[]
 *   }
 *
 * Réponse : { id, status: "pending" }
 *
 * Auth : requireDeskOwner().
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { createKpiRequest } from "@/lib/desk/kpi-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TICKERS = 200;

type Body = {
  description?: unknown;
  kpi_short?: unknown;
  kpi_name_en?: unknown;
  kpi_name_fr?: unknown;
  kpi_explanation?: unknown;
  kpi_type?: unknown;
  kpi_expected_unit?: unknown;
  extraction_prompt?: unknown;
  fallback_story?: unknown;
  tickers?: unknown;
};

function asStr(v: unknown, max = 5000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length > max) return null;
  return t;
}

export async function POST(req: NextRequest) {
  const owner = await requireDeskOwner();
  const body = (await req.json().catch(() => ({}))) as Body;

  const description = asStr(body.description, 2000);
  const kpi_short = asStr(body.kpi_short, 80);
  const kpi_name_en = asStr(body.kpi_name_en, 200);
  const kpi_name_fr =
    typeof body.kpi_name_fr === "string" && body.kpi_name_fr.trim()
      ? body.kpi_name_fr.trim().slice(0, 200)
      : null;
  const kpi_explanation = asStr(body.kpi_explanation, 2000);
  const kpi_type = asStr(body.kpi_type, 80);
  const kpi_expected_unit = asStr(body.kpi_expected_unit, 40);
  const extraction_prompt = asStr(body.extraction_prompt, 8000);
  const fallback_story =
    typeof body.fallback_story === "boolean" ? body.fallback_story : true;

  const missing: string[] = [];
  if (!description) missing.push("description");
  if (!kpi_short) missing.push("kpi_short");
  if (!kpi_name_en) missing.push("kpi_name_en");
  if (!kpi_explanation) missing.push("kpi_explanation");
  if (!kpi_type) missing.push("kpi_type");
  if (!kpi_expected_unit) missing.push("kpi_expected_unit");
  if (!extraction_prompt) missing.push("extraction_prompt");

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `champs requis manquants : ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.tickers)) {
    return NextResponse.json(
      { error: "tickers doit être un tableau" },
      { status: 400 },
    );
  }
  const tickers = (body.tickers as unknown[])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "au moins 1 ticker requis" },
      { status: 400 },
    );
  }
  if (tickers.length > MAX_TICKERS) {
    return NextResponse.json(
      { error: `trop de tickers (max ${MAX_TICKERS})` },
      { status: 400 },
    );
  }

  try {
    const created = await createKpiRequest({
      description: description!,
      kpi_short: kpi_short!,
      kpi_name_en: kpi_name_en!,
      kpi_name_fr,
      kpi_explanation: kpi_explanation!,
      kpi_type: kpi_type!,
      kpi_expected_unit: kpi_expected_unit!,
      extraction_prompt: extraction_prompt!,
      fallback_story,
      tickers,
      created_by: owner.userId,
    });
    return NextResponse.json({ id: created.id, status: created.status });
  } catch (e) {
    return NextResponse.json(
      { error: `BDD : ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
