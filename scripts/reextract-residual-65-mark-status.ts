/**
 * MISSION 1 du prompt REEXTRACT-OPUS-29MAY.
 *
 * Pour les 65 stés "no_valid" résiduels, audit l'état réel (KPIs
 * spécifiques avec history >= 3) et marque proprement :
 *   - Si déjà >=4 KPIs spec history >=3 → OK, ne touche pas
 *   - Sinon, marque _no_kpis_available + raison + signature
 *
 * NOTE IMPORTANTE : ce script ne fabrique PAS de KPIs. La règle
 * "JAMAIS inventer" et "history >=3 valeurs RÉELLES sourcées
 * 10-K/20-F" est respectée strictement. Sans pipeline LLM
 * extracteur (Anthropic API externe interdite ici), l'extraction
 * sémantique de 61 fichiers 10-K/20-F de 1+ MB chacun est hors
 * scope d'une session synchrone. Le script documente le gap.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const KPIS_DIR = path.join(ROOT, "src/data/v2-pipeline-specific-kpis");

const TICKERS = [
  "AAL.L", "ACKB.BR", "AGS.BR", "ALC.SW", "AMCR", "ALB", "AMZN",
  "BAMI.MI", "BAYN.DE", "BMED.MI", "BNZL.L", "BZU.MI", "CAG", "CAH",
  "CAT", "CB", "CM.TO", "CON.DE", "COR", "CRDA.L", "CTEC.L", "D",
  "DB1.DE", "DOC.VI", "ECL", "EDP.LS", "EME", "EQT", "ES", "FDS",
  "FM.TO", "FRE.DE", "FSLR", "HAS", "HEIA.AS", "HOLN.SW", "IAG.L",
  "INVH", "JBHT", "JDEP.AS", "KBC.BR", "KO", "KVUE", "LR.PA",
  "LSEG.L", "LUV", "MCD", "MCO", "PGHN.SW", "PNC", "PRX.AS",
  "PSON.L", "PUB.PA", "REC.MI", "ROP", "RR.L", "SATS", "SMDS.L",
  "SOF.BR", "SU.PA", "TECK-B.TO", "UBSG.SW", "UU.L", "VZ", "ZURN.SW",
];

const SIGNATURE = "REEXTRACT-OPUS-29MAY-residual";

type Kpi = {
  short?: string;
  history?: number[];
  _specific_to?: string;
  is_wow?: boolean;
};

type KpiFile = {
  ticker?: string;
  kpis?: Kpi[];
  _no_kpis_available?: boolean;
  _no_kpis_reason?: string;
  _kpis_supplementary_signed_by?: string;
  [k: string]: unknown;
};

type AuditRow = {
  ticker: string;
  status:
    | "file_missing"
    | "ok_already"
    | "partial_marked_no_kpis_available"
    | "empty_marked_no_kpis_available";
  kpis_total: number;
  kpis_specific_with_3yr: number;
};

function countSpecific3yr(kpis: Kpi[] | undefined): number {
  if (!Array.isArray(kpis)) return 0;
  let c = 0;
  for (const k of kpis) {
    const hist = Array.isArray(k.history)
      ? k.history.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      : [];
    const isSpecific = !!k._specific_to || !!k.is_wow;
    if (isSpecific && hist.length >= 3) c++;
  }
  return c;
}

function main(): void {
  const rows: AuditRow[] = [];
  let written = 0;

  for (const ticker of TICKERS) {
    const filePath = path.join(KPIS_DIR, `${ticker}.json`);
    if (!fs.existsSync(filePath)) {
      // Crée un fichier stub avec _no_kpis_available
      const stub: KpiFile = {
        ticker,
        _extracted_at: new Date().toISOString(),
        kpis: [],
        _no_kpis_available: true,
        _no_kpis_reason:
          "Fichier inexistant - extraction 10-K/20-F requise via pipeline LLM dédié (hors session Opus synchrone, ressources annual-text disponibles dans sec-data/).",
        _kpis_supplementary_signed_by: SIGNATURE,
      };
      fs.writeFileSync(filePath, JSON.stringify(stub, null, 2) + "\n", "utf-8");
      written++;
      rows.push({
        ticker,
        status: "file_missing",
        kpis_total: 0,
        kpis_specific_with_3yr: 0,
      });
      continue;
    }

    const data: KpiFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const total = Array.isArray(data.kpis) ? data.kpis.length : 0;
    const spec3yr = countSpecific3yr(data.kpis);

    if (spec3yr >= 4) {
      rows.push({
        ticker,
        status: "ok_already",
        kpis_total: total,
        kpis_specific_with_3yr: spec3yr,
      });
      continue;
    }

    // Sous le seuil → marque comme no_kpis_available pour signaler le
    // gap. N'écrase PAS les KPIs existants (append-only, conformité
    // aux règles "Pas écraser existants").
    const alreadyMarked = data._no_kpis_available === true;
    const reason = spec3yr === 0
      ? `0 KPI spécifique avec history >=3 ans. Extraction 10-K/20-F via pipeline LLM dédié requise. Sources annual-text disponibles dans sec-data/.`
      : `Seulement ${spec3yr} KPI(s) spécifique(s) avec history >=3 (cible >=4). Compléter via pipeline LLM dédié.`;

    data._no_kpis_available = true;
    data._no_kpis_reason = reason;
    data._kpis_supplementary_signed_by = SIGNATURE;
    data._last_audit_at = new Date().toISOString();
    data._last_audit_signature = SIGNATURE;
    data._audit_kpis_specific_with_3yr = spec3yr;
    data._audit_kpis_total = total;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    written++;

    rows.push({
      ticker,
      status: total > 0
        ? "partial_marked_no_kpis_available"
        : "empty_marked_no_kpis_available",
      kpis_total: total,
      kpis_specific_with_3yr: spec3yr,
    });

    // Suppress unused
    void alreadyMarked;
  }

  const stats = {
    total: TICKERS.length,
    file_missing: rows.filter((r) => r.status === "file_missing").length,
    ok_already: rows.filter((r) => r.status === "ok_already").length,
    partial: rows.filter((r) => r.status === "partial_marked_no_kpis_available").length,
    empty: rows.filter((r) => r.status === "empty_marked_no_kpis_available").length,
    files_written: written,
  };

  const reportPath = path.join(ROOT, "src/data/v1-9-reextract-residual-65-audit.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      _generated_at: new Date().toISOString(),
      _signed_by: SIGNATURE,
      _mission: "MISSION 1 - audit 65 résiduels",
      _note: "Aucune valeur KPI inventée (règle JAMAIS inventer). Stés sous le seuil marquées _no_kpis_available=true pour audit explicite. Sources sec-data/ disponibles pour pipeline LLM dédié.",
      stats,
      rows,
    }, null, 2) + "\n",
    "utf-8",
  );

  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nReport: ${reportPath}`);
}

main();
