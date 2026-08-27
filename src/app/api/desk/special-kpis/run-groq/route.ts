import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  getSpecialKpi,
  upsertSpecialKpi,
  buildExtractionPrompt,
  type SpecialKpiData,
} from "@/lib/desk/special-kpis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lance l'extraction du KPI via Groq Llama 3.3 70B (free tier).
 * Marque le statut in_progress → done / error.
 * Sauvegarde data + llm_response_raw.
 */
export async function POST(req: Request) {
  await requireDeskOwner();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const kpi = await getSpecialKpi(id);
  if (!kpi) return NextResponse.json({ error: "not found" }, { status: 404 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    await upsertSpecialKpi({
      id,
      status: "error",
      error_msg: "GROQ_API_KEY manquante côté Vercel",
    });
    return NextResponse.json({ error: "GROQ_API_KEY manquante" }, { status: 500 });
  }

  await upsertSpecialKpi({ id, status: "in_progress", error_msg: null });
  const prompt = buildExtractionPrompt(kpi);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Tu es un extracteur de KPIs financiers strict. Réponses en JSON pur." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      await upsertSpecialKpi({
        id,
        status: "error",
        error_msg: `Groq HTTP ${res.status} : ${errText.slice(0, 300)}`,
      });
      return NextResponse.json({ error: `Groq ${res.status}`, detail: errText }, { status: 500 });
    }
    const j = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = j.choices?.[0]?.message?.content ?? "";

    // Extraire le JSON (peut être encapsulé dans ```json … ```)
    let parsed: SpecialKpiData = {};
    try {
      const m = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = m ? m[1] : content.trim();
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      await upsertSpecialKpi({
        id,
        status: "error",
        error_msg: `Parse JSON Groq échoué : ${e instanceof Error ? e.message : String(e)}`,
        llm_response_raw: content,
        llm_prompt: prompt,
        llm_provider: "groq-llama-3.3-70b",
        llm_at: new Date().toISOString(),
      });
      return NextResponse.json({ error: "JSON parse failed", raw: content }, { status: 500 });
    }

    // `data` est ecrase par la reponse du moteur : on y recopie les parametres
    // de recherche saisis par Yann, sinon ils seraient perdus a chaque passage.
    const donnees: SpecialKpiData = {
      ...parsed,
      params: kpi.data?.params ?? {},
      official_source: parsed.official_source ?? false,
    };

    await upsertSpecialKpi({
      id,
      status: "done",
      data: donnees,
      data_source: (parsed as SpecialKpiData & { data_source?: string }).data_source ?? null,
      llm_response_raw: content,
      llm_prompt: prompt,
      llm_provider: "groq-llama-3.3-70b",
      llm_at: new Date().toISOString(),
      error_msg: null,
    });
    return NextResponse.json({ ok: true, data: parsed });
  } catch (e) {
    await upsertSpecialKpi({
      id,
      status: "error",
      error_msg: `Exception Groq : ${e instanceof Error ? e.message : String(e)}`,
    });
    return NextResponse.json({ error: "exception", detail: String(e) }, { status: 500 });
  }
}
