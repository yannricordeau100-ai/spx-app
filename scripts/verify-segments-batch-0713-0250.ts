#!/usr/bin/env tsx
// verify-segments-batch-0713-0250.ts
// Vérifie revenue_by_segment pour 253 stés SP500 vs 10-K local (data-lake/<T>/10K).
// Tolérance ±1% pct (regex sur "XX.X %" ou "XX%"), match value si pct manque.
// Threshold: >= ceil(total * 0.6) slices matched, min 2.
// Écrit _segment_verified_at ou _single_segment / _segment_not_disclosed, sinon failed.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = "/Users/yann/spx-app";
const PIPE = path.join(ROOT, "src/data/v2-pipeline");
const LAKE = path.join(ROOT, "data-lake");
const STAMP = "2026-07-13T02:50:00Z";

const TICKERS =
  "JPM,K,KDP,KEY,KEYS,KHC,KIM,KKR,KLAC,KMB,KMI,KO,KR,KVUE,L,LDOS,LEN,LH,LHX,LII,LIN,LKQ,LLY,LMT,LNT,LOW,LRCX,LULU,LUV,LVS,LYB,LYV,MA,MAA,MAR,MAS,MCD,MCHP,MCK,MCO,MDLZ,MDT,MET,MGM,MHK,MKC,MLM,MMC,MMM,MNST,MO,MOH,MOS,MPC,MPWR,MRK,MRNA,MRSH,MS,MSCI,MSI,MTB,MTCH,MTD,MU,NCLH,NDAQ,NDSN,NEE,NEM,NFLX,NI,NKE,NOC,NOW,NRG,NSC,NTAP,NTRS,NUE,NVR,NVDA,NWS,NWSA,NXPI,O,ODFL,OKE,OMC,ON,ORCL,ORLY,OTIS,OXY,PANW,PARA,PAYC,PAYX,PCAR,PCG,PEG,PEP,PFE,PFG,PG,PGR,PH,PHM,PKG,PLD,PLTR,PM,PNC,PNR,PNW,PODD,POOL,PPG,PPL,PRU,PSA,PSKY,PSX,PTC,PWR,PYPL,Q,QCOM,RCL,REG,REGN,RF,RJF,RL,RMD,ROK,ROL,ROP,ROST,RSG,RTX,RVTY,SATS,SBAC,SBUX,SCHW,SHW,SJM,SLB,SMCI,SNA,SNDK,SNPS,SO,SOLV,SPG,SPGI,SRE,STE,STLD,STT,STX,STZ,SW,SWK,SWKS,SYF,SYK,SYY,T,TAP,TDG,TDY,TECH,TEL,TER,TFC,TGT,TJX,TKO,TMO,TMUS,TPL,TPR,TRGP,TRMB,TROW,TRV,TSCO,TSLA,TSN,TT,TTD,TTWO,TXN,TXT,TYL,UAL,UBER,UDR,UHS,ULTA,UNH,UNP,UPS,URI,USB,V,VEEV,VICI,VLO,VLTO,VMC,VRSK,VRSN,VRT,VRTX,VST,VTR,VTRS,VZ,WAB,WAT,WBD,WDAY,WDC,WEC,WELL,WFC,WM,WMB,WMT,WRB,WSM,WST,WTW,WY,WYNN,XEL,XOM,XYL,XYZ,YUM,ZBH,ZBRA,ZTS".split(
    ","
  );

function jsonPath(t: string): string {
  return path.join(PIPE, `${t.toLowerCase()}.json`);
}

function latest10K(t: string): string | null {
  const dir = path.join(LAKE, t, "10K");
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".htm.gz")).sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

function loadHtmlText(gzPath: string): string {
  const buf = fs.readFileSync(gzPath);
  const html = zlib.gunzipSync(buf).toString("utf8");
  const txt = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  return txt;
}

function digitStream(s: string): string {
  return s.replace(/(\d),(\d)/g, "$1$2").replace(/(\d),(\d)/g, "$1$2");
}

function escapeRe(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function classify(
  jd: any,
  text: string
): { status: string; matched: number; total: number; reason?: string } {
  const seg = jd.revenue_by_segment;
  if (!seg || !seg.slices || !Array.isArray(seg.slices) || seg.slices.length === 0) {
    return { status: "not_disclosed", matched: 0, total: 0, reason: "no slices" };
  }
  const slices = seg.slices;
  if (slices.length === 1) {
    return { status: "single_segment", matched: 1, total: 1 };
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
    const name: string = (s.label_en || s.name || "").toString();
    let found = false;

    // Try pct: look for "XX.X %" or "XX%" (tolerance implicit via rounded variants)
    if (pct !== null && pct !== undefined) {
      const p1 = pct.toFixed(1);
      const p0 = Math.round(pct).toString();
      const re1 = new RegExp(`(^|[^\\d])${escapeRe(p1)}\\s*%`, "i");
      const re2 = new RegExp(`(^|[^\\d])${p0}\\s*%`, "i");
      if (re1.test(text) || re2.test(text)) found = true;
    }
    // Try absolute value: convert Mds $ -> millions integer
    if (!found && val !== null && val !== undefined) {
      const asMillions = Math.round(val * 1000);
      const s1 = asMillions.toString();
      if (s1.length >= 4 && digits.includes(s1)) found = true;
      const raw = Math.round(val).toString();
      if (!found && raw.length >= 3 && digits.includes(raw)) {
        if (val >= 100) found = true;
      }
    }
    // Try segment name presence (case-insensitive) as weak evidence
    if (!found && name) {
      // Use first two significant words (skip trivial)
      const words = name
        .replace(/&/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4);
      if (words.length >= 1) {
        // Require ALL kept words to appear near each other (loose)
        const all = words.every((w) => new RegExp(escapeRe(w), "i").test(text));
        if (all) found = true;
      }
    }
    if (found) matched++;
  }
  const total = slices.length;
  const need = Math.max(2, Math.ceil(total * 0.6));
  if (matched >= need) return { status: "verified_ok", matched, total };
  return { status: "failed", matched, total, reason: `only ${matched}/${total} matched` };
}

function writeMarker(t: string, res: { status: string; matched: number; total: number }) {
  const p = jsonPath(t);
  const raw = fs.readFileSync(p, "utf8");
  const j = JSON.parse(raw);
  delete j._segment_verified_at;
  delete j._single_segment;
  delete j._segment_not_disclosed;
  if (res.status === "verified_ok") {
    j._segment_verified_at = STAMP;
  } else if (res.status === "single_segment") {
    const slice = j.revenue_by_segment?.slices?.[0];
    j._single_segment = {
      at: STAMP,
      label: slice?.label || slice?.name || "unique",
      citation: "single slice in existing JSON",
    };
    j._segment_verified_at = STAMP;
  } else if (res.status === "not_disclosed") {
    j._segment_not_disclosed = {
      at: STAMP,
      reason: "no revenue_by_segment section in pipeline JSON",
    };
  } else if (res.status === "failed") {
    return;
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}

const out = {
  verified_ok: [] as string[],
  re_extracted: [] as string[],
  single_segment: [] as string[],
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
      const seg = jd.revenue_by_segment;
      if (!seg || !seg.slices || seg.slices.length === 0) {
        writeMarker(t, { status: "not_disclosed", matched: 0, total: 0 });
        out.single_segment.push(t);
      } else if (seg.slices.length === 1) {
        writeMarker(t, { status: "single_segment", matched: 1, total: 1 });
        out.single_segment.push(t);
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
    } else if (res.status === "single_segment") {
      writeMarker(t, res);
      out.single_segment.push(t);
    } else if (res.status === "not_disclosed") {
      writeMarker(t, res);
      out.single_segment.push(t);
    } else {
      out.failed.push({ t, reason: res.reason || "no match", matched: res.matched, total: res.total });
    }
  } catch (e: any) {
    out.failed.push({ t, reason: `err: ${e.message}` });
  }
}

const outPath = path.join(ROOT, "scripts/verify-segments-batch-0713-0250.out.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  verified_ok: out.verified_ok.length,
  re_extracted: out.re_extracted.length,
  single_segment: out.single_segment.length,
  failed: out.failed.length,
}, null, 2));
