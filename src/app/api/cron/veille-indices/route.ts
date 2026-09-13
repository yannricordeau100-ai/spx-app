import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import SP500 from "@/data/sp500-tickers.json";
import NDX from "@/data/nasdaq100-members.json";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Veille des indices (Yann 13 sept 2026) : chaque jour, la composition du
 * S&P 500 et du Nasdaq 100 est relue sur Wikipedia et comparee aux listes du
 * depot. Toute entree ou sortie declenche un email au proprietaire, et l ecart
 * est memorise pour ne pas notifier deux fois. Source gratuite, sans cle.
 */
function autorise(req: NextRequest): boolean {
  const q = req.nextUrl.searchParams; const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const s = process.env.CRON_SECRET, a = process.env.VISUAL_AUDIT_TOKEN;
  return (!!s && (q.get("secret") === s || bearer === s)) || (!!a && q.get("audit_token") === a);
}
const norm = (t: string) => t.toUpperCase().replace(/\./g, "-");
function tickersWikipedia(html: string, idTable: string): { ticker: string; nom: string; ajout: string }[] {
  const i = html.indexOf(`id="${idTable}"`); if (i < 0) return [];
  const t = html.slice(i, html.indexOf("</table>", i));
  const out: { ticker: string; nom: string; ajout: string }[] = [];
  for (const m of t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const c = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((x) => x[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim());
    if (c.length < 2) continue;
    const tk = c[0];
    if (!/^[A-Z][A-Z0-9.\-]{0,6}$/.test(tk)) continue;
    out.push({ ticker: tk, nom: c[1], ajout: c[5] ?? "" });
  }
  return out;
}
export async function GET(req: NextRequest) {
  if (!autorise(req)) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  const ua = { headers: { "User-Agent": "Mozilla/5.0 (Mettrik veille indices)" } };
  const [sp, nd] = await Promise.all([
    fetch("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies", ua).then((r) => r.text()).catch(() => ""),
    fetch("https://api.nasdaq.com/api/quote/list-type/nasdaq100", { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36", Accept: "application/json" } }).then((r) => r.json()).catch(() => null),
  ]);
  const spW = tickersWikipedia(sp, "constituents");
  // Nasdaq 100 : le portail Nasdaq (JSON), Wikipedia n affiche plus les tickers.
  const ndW: { ticker: string; nom: string; ajout: string }[] = ((nd as { data?: { data?: { rows?: { symbol: string; companyName: string }[] } } } | null)?.data?.data?.rows ?? []).map((r) => ({ ticker: r.symbol.replace(/\./g, "-"), nom: r.companyName.replace(/ (Common Stock|Class [A-C].*|Ordinary Shares.*)$/, ""), ajout: "" }));
  const spLocal = new Set((SP500 as string[]).map(norm));
  const ndLocal = new Set(((NDX as { tickers: string[] }).tickers ?? []).map(norm));
  const ecart = {
    sp500: { entrees: spW.filter((x) => !spLocal.has(norm(x.ticker))), sorties: [...spLocal].filter((t) => !spW.some((x) => norm(x.ticker) === t)), lu: spW.length },
    nasdaq100: { entrees: ndW.filter((x) => !ndLocal.has(norm(x.ticker))), sorties: [...ndLocal].filter((t) => !ndW.some((x) => norm(x.ticker) === t)), lu: ndW.length },
  };
  if (spW.length < 450) return NextResponse.json({ ok: false, erreur: "lecture Wikipedia S&P 500 incomplete", lu: spW.length });
  // Garde-fou : une lecture incomplete du Nasdaq 100 ne doit jamais produire de fausses sorties.
  if (ndW.length < 90) { ecart.nasdaq100 = { entrees: [], sorties: [], lu: ndW.length }; }
  const empreinte = JSON.stringify({ a: ecart.sp500.entrees.map((x) => x.ticker), b: ecart.sp500.sorties, c: ecart.nasdaq100.entrees.map((x) => x.ticker), d: ecart.nasdaq100.sorties });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  let precedente = "";
  try { const { data } = await sb.from("desk_page_content").select("content_fr").eq("page_key", "veille_indices").eq("section_key", "empreinte").maybeSingle(); precedente = data?.content_fr ?? ""; } catch { /* premiere fois */ }
  await sb.from("desk_page_content").upsert({ page_key: "veille_indices", section_key: "etat", content_fr: JSON.stringify({ calculeLe: new Date().toISOString(), ...ecart }) }, { onConflict: "page_key,section_key" });
  const changement = ecart.sp500.entrees.length + ecart.sp500.sorties.length + ecart.nasdaq100.entrees.length + ecart.nasdaq100.sorties.length > 0;
  let email = "rien à signaler";
  if (changement && empreinte !== precedente && process.env.RESEND_API_KEY && process.env.DESK_OWNER_EMAIL) {
    const li = (l: { ticker: string; nom: string; ajout: string }[]) => l.map((x) => `<li>${x.ticker} · ${x.nom}${x.ajout ? ` (ajout ${x.ajout})` : ""}</li>`).join("");
    const html = `<p>Changement de composition détecté.</p><p><strong>S&P 500</strong> : entrées <ul>${li(ecart.sp500.entrees)}</ul> sorties : ${ecart.sp500.sorties.join(", ") || "aucune"}</p><p><strong>Nasdaq 100</strong> : entrées <ul>${li(ecart.nasdaq100.entrees)}</ul> sorties : ${ecart.nasdaq100.sorties.join(", ") || "aucune"}</p><p>À faire : ajouter les nouvelles sociétés au site (fiche complète et raccordement back-office).</p>`;
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Mettrik alertes <noreply@mettrik.ai>", to: [process.env.DESK_OWNER_EMAIL], subject: `Indices : ${ecart.sp500.entrees.length + ecart.nasdaq100.entrees.length} nouvelle(s) société(s), ${ecart.sp500.sorties.length + ecart.nasdaq100.sorties.length} sortie(s)`, html }) });
    email = r.ok ? "envoyé" : `échec ${r.status}`;
    if (r.ok) await sb.from("desk_page_content").upsert({ page_key: "veille_indices", section_key: "empreinte", content_fr: empreinte }, { onConflict: "page_key,section_key" });
  } else if (changement) email = "inchangé, déjà notifié";
  return NextResponse.json({ ok: true, ...ecart, email });
}
