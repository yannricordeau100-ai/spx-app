import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  getStoryKpi,
  upsertStoryKpi,
  buildStoryPrompt,
} from "@/lib/desk/story-kpis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Récupère le texte d'une URL. Pour un post X, l'API publique n'est pas
 * accessible sans jeton : on passe par r.jina.ai, qui rend le contenu d'une
 * page en texte brut, y compris pour x.com. Même chemin pour le web, ça
 * évite d'avoir à parser du HTML côté serveur.
 */
async function fetchText(url: string): Promise<string> {
  const clean = url.trim();
  const proxied = `https://r.jina.ai/${clean}`;
  const res = await fetch(proxied, {
    headers: { "User-Agent": "Mettrik/1.0 (+https://mettrik.ai)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`lecture de la source impossible (${res.status})`);
  const txt = await res.text();
  if (!txt || txt.trim().length < 40) throw new Error("source vide ou protégée");
  return txt;
}

export async function POST(req: Request) {
  await requireDeskOwner();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const kpi = await getStoryKpi(id);
  if (!kpi) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    await upsertStoryKpi({ id, status: "error", error_msg: "GROQ_API_KEY manquante" });
    return NextResponse.json({ error: "GROQ_API_KEY manquante" }, { status: 500 });
  }

  await upsertStoryKpi({ id, status: "in_progress", error_msg: null });

  try {
    const pageText = await fetchText(kpi.source_url);
    const prompt = buildStoryPrompt(kpi, pageText);
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Tu extrais des indicateurs depuis un texte source. Tu ne calcules jamais, tu ne complètes jamais. Réponse en JSON pur.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Groq ${res.status} : ${raw.slice(0, 200)}`);
    const parsed = JSON.parse(JSON.parse(raw).choices[0].message.content);

    // Garde-fou : le chiffre doit apparaître dans la citation retournée.
    const evidence = String(parsed.evidence ?? "");
    const value = typeof parsed.value === "number" ? parsed.value : null;
    const digits = value != null ? String(value).replace(/\D/g, "") : "";
    const evidenceOk =
      value == null ||
      (digits.length > 0 &&
        evidence.replace(/[\s,. ]/g, "").includes(digits.slice(0, Math.min(4, digits.length))));

    const saved = await upsertStoryKpi({
      id,
      kpi_short: parsed.kpi_short ?? null,
      kpi_name_fr: parsed.kpi_name_fr ?? null,
      kpi_name_en: parsed.kpi_name_en ?? null,
      kpi_value: value,
      kpi_unit: parsed.unit ?? null,
      kpi_period: parsed.period ?? null,
      signal_fr: parsed.signal_fr ?? null,
      signal_en: parsed.signal_en ?? null,
      evidence: evidence || null,
      family: parsed.family ?? null,
      source_label: parsed.source_label ?? null,
      source_published_at: parsed.source_published_at ?? null,
      llm_raw: raw.slice(0, 20000),
      status: value == null ? "error" : "done",
      error_msg:
        value == null
          ? "aucun chiffre exploitable dans la source"
          : evidenceOk
            ? null
            : "chiffre absent de la citation : à vérifier à la main",
    });
    return NextResponse.json({ item: saved, evidence_ok: evidenceOk });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await upsertStoryKpi({ id, status: "error", error_msg: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
