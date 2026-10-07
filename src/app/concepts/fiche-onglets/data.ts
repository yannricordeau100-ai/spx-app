import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { loadV17Company } from "@/lib/company-core/load-company";
import { assainirPourClient } from "@/lib/company-core/assainir-payload";
import { gateAttForTier } from "@/lib/att";
import { gateTheseForTier } from "@/lib/these";
import type { Company } from "@/lib/data";
import type { TranscriptDoc } from "@/components/transcript-stories";
import type { TranscriptBulletsSummary } from "@/components/transcript-bullets-block";
import type { RachatsFiche } from "@/components/rachats-block";
import RACHATS_CLASSEMENT from "@/data/rachats-classement.json";
import { SOCIETES_DEMO } from "./liste";

/**
 * Donnees REELLES de la fiche pour les concepts d'onglets : meme chargeur que
 * src/app/[ticker]/page.tsx (loadV17Company, palier Max pour tout montrer),
 * memes fichiers de transcripts et de rachats. Rien n'est invente : une partie
 * sans donnee n'a pas d'onglet.
 */
export type FicheDemo = {
  ticker: string;
  company: Company;
  transcript: TranscriptDoc | null;
  summary: TranscriptBulletsSummary | null;
  rachats: RachatsFiche | null;
};

async function lireJson<T>(rel: string[]): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), ...rel), "utf-8")) as T;
  } catch {
    return null;
  }
}

async function chargeRachats(ticker: string): Promise<RachatsFiche> {
  const cl = RACHATS_CLASSEMENT as { depuis: number; us: { ticker: string; nom: string; nb: number }[]; eu: { ticker: string; nom: string; nb: number }[] };
  const d = await lireJson<{ nb: number; rachats: { nom: string; annee: number | null; montant: string | null }[]; aucun_rachat_confirme?: string }>(["src/data/rachats", `${ticker.toLowerCase()}.json`]);
  const societe = d
    ? { nb: d.nb, rachats: d.rachats.map((r) => ({ nom: r.nom, annee: r.annee, montant: r.montant })), couverte: d.nb > 0 || Boolean(d.aucun_rachat_confirme) }
    : null;
  return { depuis: cl.depuis, societe, classement: { us: cl.us, eu: cl.eu } };
}

async function chargeUne(ticker: string): Promise<FicheDemo | null> {
  const r = await loadV17Company(ticker, { mode: "v18", locale: "fr" });
  if (r.kind !== "ready") return null;
  const c = r.company as Company;
  const gated = {
    ...c,
    ...(c.att ? { att: gateAttForTier(c.att, "max") } : {}),
    ...(c.these ? { these: gateTheseForTier(c.these, "max") } : {}),
  } as Company;
  const t = ticker.toUpperCase();
  const [transcript, summary, rachats] = await Promise.all([
    lireJson<TranscriptDoc>(["src/data/transcripts", `${t}.json`]).then((x) => x ?? lireJson<TranscriptDoc>(["src/data/transcripts", `${ticker.toLowerCase()}.json`])),
    lireJson<TranscriptBulletsSummary>(["src/data/transcript-summaries", `${ticker.toLowerCase()}.json`]),
    chargeRachats(ticker),
  ]);
  return {
    ticker: t,
    company: assainirPourClient(gated),
    transcript: assainirPourClient(transcript),
    summary: assainirPourClient(summary),
    rachats,
  };
}

export async function chargeFiches(): Promise<FicheDemo[]> {
  const l = await Promise.all(SOCIETES_DEMO.map((t) => chargeUne(t)));
  return l.filter((x): x is FicheDemo => x !== null);
}
