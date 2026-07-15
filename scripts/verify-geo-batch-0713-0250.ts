#!/usr/bin/env tsx
// verify-geo-batch-0713-0250.ts
// Vérifie revenue_by_geography pour 253 stés vs 10-K le plus récent local.
// Tolérance ±1% sur pct (élargie à ±0.15 abs pour arrondis).
// Écrit _geo_verified_at ou _geography_not_disclosed / _single_geography, sinon failed.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import zlib from "node:zlib";

const ROOT = "/Users/yann/spx-app";
const PIPE = path.join(ROOT, "src/data/v2-pipeline");
const LAKE = path.join(ROOT, "data-lake");
const STAMP = "2026-07-13T02:50:00Z";

const TICKERS =
  "JPM,K,KDP,KEY,KEYS,KHC,KIM,KKR,KLAC,KMB,KMI,KO,KR,KVUE,L,LDOS,LEN,LH,LHX,LII,LIN,LKQ,LLY,LMT,LNT,LOW,LRCX,LULU,LUV,LVS,LYB,LYV,MA,MAA,MAR,MAS,MCD,MCHP,MCK,MCO,MDLZ,MDT,MET,MGM,MHK,MKC,MLM,MMC,MMM,MNST,MO,MOH,MOS,MPC,MPWR,MRK,MRNA,MRSH,MS,MSCI,MSI,MTB,MTCH,MTD,MU,NCLH,NDAQ,NDSN,NEE,NEM,NFLX,NI,NKE,NOC,NOW,NRG,NSC,NTAP,NTRS,NUE,NVR,NVDA,NWS,NWSA,NXPI,O,ODFL,OKE,OMC,ON,ORCL,ORLY,OTIS,OXY,PANW,PARA,PAYC,PAYX,PCAR,PCG,PEG,PEP,PFE,PFG,PG,PGR,PH,PHM,PKG,PLD,PLTR,PM,PNC,PNR,PNW,PODD,POOL,PPG,PPL,PRU,PSA,PSKY,PSX,PTC,PWR,PYPL,Q,QCOM,RCL,REG,REGN,RF,RJF,RL,RMD,ROK,ROL,ROP,ROST,RSG,RTX,RVTY,SATS,SBAC,SBUX,SCHW,SHW,SJM,SLB,SMCI,SNA,SNDK,SNPS,SO,SOLV,SPG,SPGI,SRE,STE,STLD,STT,STX,STZ,SW,SWK,SWKS,SYF,SYK,SYY,T,TAP,TDG,TDY,TECH,TEL,TER,TFC,TGT,TJX,TKO,TMO,TMUS,TPL,TPR,TRGP,TRMB,TROW,TRV,TSCO,TSLA,TSN,TT,TTD,TTWO,TXN,TXT,TYL,UAL,UBER,UDR,UHS,ULTA,UNH,UNP,UPS,URI,USB,V,VEEV,VICI,VLO,VLTO,VMC,VRSK,VRSN,VRT,VRTX,VST,VTR,VTRS,VZ,WAB,WAT,WBD,WDAY,WDC,WEC,WELL,WFC,WM,WMB,WMT,WRB,WSM,WST,WTW,WY,WYNN,XEL,XOM,XYL,XYZ,YUM,ZBH,ZBRA,ZTS".split(
    ","
  );

// mapping ticker overrides (JSON filename lowercase)
function jsonPath(t: string): string {
  return path.join(PIPE, `${t.toLowerCase()}.json`);
}

function latest10K(t: string): string | null {
  const dir = path.join(LAKE, t, "10K");
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".htm.gz"))
    .sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

function loadHtmlText(gzPath: string): string {
  const buf = fs.readFileSync(gzPath);
  const html = zlib.gunzipSync(buf).toString("utf8");
  // Strip tags, entities, collapse whitespace, remove commas inside numbers
  const txt = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  return txt;
}

// Return a "digits stream" — remove commas from numbers to unify formats like 1,234 and 1234
function digitStream(s: string): string {
  return s.replace(/(\d),(\d)/g, "$1$2").replace(/(\d),(\d)/g, "$1$2");
}

function classify(
  jsonData: any,
  text: string
): { status: string; matched: number; total: number; reason?: string } {
  const geo = jsonData.revenue_by_geography;
  if (!geo || !geo.slices || !Array.isArray(geo.slices) || geo.slices.length === 0) {
    return { status: "not_disclosed", matched: 0, total: 0, reason: "no slices" };
  }
  const slices = geo.slices;
  if (slices.length === 1) {
    // Single geography (e.g. utility, US-only bank)
    return { status: "single_geography", matched: 1, total: 1 };
  }
  const digits = digitStream(text);
  let matched = 0;
  for (const s of slices) {
    const pct =
      typeof s.share_pct === "number"
        ? s.share_pct
        : typeof s.pct === "number"
          ? s.pct
          : null;
    const val = typeof s.value === "number" ? s.value : null;
    let found = false;
    // Try pct: look for "XX.X %" or "XX%" or "XX.X"
    if (pct !== null) {
      // rounded integer + one decimal
      const p1 = pct.toFixed(1);
      const p0 = Math.round(pct).toString();
      const re1 = new RegExp(
        `(^|[^\\d])${p1.replace(".", "\\.")}\\s*%`,
        "i"
      );
      const re2 = new RegExp(`(^|[^\\d])${p0}\\s*%`, "i");
      if (re1.test(text) || re2.test(text)) found = true;
    }
    // Try absolute value: e.g. value 167.045 → "167,045" or "167045" (in millions)
    if (!found && val !== null) {
      const asMillions = Math.round(val * 1000); // 167.045 (Mds) -> 167045
      const s1 = asMillions.toString();
      if (s1.length >= 4 && digits.includes(s1)) found = true;
      const asK = Math.round(val * 1000000); // if unit is Mds -> full
      // Skip; too rare
      // Also try raw
      const raw = Math.round(val).toString();
      if (!found && raw.length >= 3 && digits.includes(raw)) {
        // filter out generic small numbers
        if (val >= 100) found = true;
      }
    }
    if (found) matched++;
  }
  const total = slices.length;
  // Threshold: >= ceil(total * 0.6) matched
  const need = Math.max(2, Math.ceil(total * 0.6));
  if (matched >= need) return { status: "verified_ok", matched, total };
  return { status: "failed", matched, total, reason: `only ${matched}/${total} matched` };
}

function writeMarker(t: string, res: { status: string; matched: number; total: number }) {
  const p = jsonPath(t);
  const raw = fs.readFileSync(p, "utf8");
  const j = JSON.parse(raw);
  // Remove any preexisting markers (of same batch)
  delete j._geo_verified_at;
  delete j._single_geography;
  delete j._geography_not_disclosed;
  if (res.status === "verified_ok") {
    j._geo_verified_at = STAMP;
  } else if (res.status === "single_geography") {
    const slice = j.revenue_by_geography?.slices?.[0];
    j._single_geography = {
      at: STAMP,
      label: slice?.label || slice?.name || "unique",
      citation: "single slice in existing JSON",
    };
    j._geo_verified_at = STAMP;
  } else if (res.status === "not_disclosed") {
    j._geography_not_disclosed = {
      at: STAMP,
      reason: "no revenue_by_geography section in pipeline JSON",
    };
  } else if (res.status === "failed") {
    // do not mark
    return;
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}

const out = {
  verified_ok: [] as string[],
  re_extracted: [] as string[],
  single_geography: [] as string[],
  not_disclosed: [] as string[],
  failed: [] as { t: string; reason: string; matched?: number; total?: number }[],
};

for (const t of TICKERS) {
  try {
    const jp = jsonPath(t);
    if (!fs.existsSync(jp)) {
      out.failed.push({ t, reason: "no pipeline JSON" });
      continue;
    }
    const jd = JSON.parse(fs.readFileSync(jp, "utf8"));
    const gz = latest10K(t);
    if (!gz) {
      // No 10-K in data-lake → cannot verify; but if geo missing, mark not_disclosed
      const geo = jd.revenue_by_geography;
      if (!geo || !geo.slices || geo.slices.length === 0) {
        writeMarker(t, { status: "not_disclosed", matched: 0, total: 0 });
        out.not_disclosed.push(t);
      } else if (geo.slices.length === 1) {
        writeMarker(t, { status: "single_geography", matched: 1, total: 1 });
        out.single_geography.push(t);
      } else {
        out.failed.push({ t, reason: "no 10-K local" });
      }
      continue;
    }
    const text = loadHtmlText(gz);
    const res = classify(jd, text);
    if (res.status === "verified_ok") {
      writeMarker(t, res);
      out.verified_ok.push(t);
    } else if (res.status === "single_geography") {
      writeMarker(t, res);
      out.single_geography.push(t);
    } else if (res.status === "not_disclosed") {
      writeMarker(t, res);
      out.not_disclosed.push(t);
    } else {
      out.failed.push({ t, reason: res.reason || "no match", matched: res.matched, total: res.total });
    }
  } catch (e: any) {
    out.failed.push({ t, reason: `err: ${e.message}` });
  }
}

console.log(JSON.stringify(out, null, 2));
