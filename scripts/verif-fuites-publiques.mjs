#!/usr/bin/env node
/**
 * Controle des fuites publiques (7 oct 2026, audit visiteur anonyme).
 *
 * Refait, comme un visiteur sans compte (fetch simple, aucun cookie, aucune
 * ecriture), les recherches de l audit : tout ce qu un anonyme peut lire ne
 * doit contenir ni secret, ni cuisine interne, ni liste/compte exact de
 * l univers (liste des indices, nombre de societes Premium/Max).
 *
 * Ce qui est controle :
 *   1. Pages publiques (accueil, /pricing, quelques fiches) : HTML + donnees
 *      serialisees (__next_f / RSC).
 *   2. Tous les chunks JS/CSS references (et ceux references par les chunks).
 *   3. Cartes de source (.map) : doivent repondre 404.
 *   4. robots.txt, sitemap.xml, en-tetes HTTP.
 *   5. Routes API en GET simple sans connexion (liste ROUTES_API).
 *   6. Base Supabase avec la cle anonyme trouvee dans le JS client : lecture
 *      seule (GET + Prefer: count=exact, limit=1) des tables TABLES_SUPABASE.
 *   7. Optionnel (--previews) : les preversions publiques mettrik-niveau1/2.
 *
 * Gravite : "rouge" = fuite a corriger (code de retour 1) ; "orange" = a
 * examiner (code 0, sauf --strict).
 *
 * Usage : node scripts/verif-fuites-publiques.mjs [URL_BASE] [--json] [--strict] [--previews]
 *         URL_BASE par defaut : https://mettrik.ai (ou variable BASE)
 * Code de retour : 0 aucun rouge, 1 au moins un rouge, 2 controle impossible.
 * Non branche : a appeler plus tard depuis scripts/verif-release.py, comme
 * verif-export-png.mjs (lecture du --json, feu rouge/orange/vert).
 */

const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const STRICT = args.includes("--strict");
const PREVIEWS = args.includes("--previews");
const BASE = (args.find((a) => /^https?:\/\//.test(a)) || process.env.BASE || "https://mettrik.ai").replace(/\/$/, "");

const PAGES = ["/", "/pricing", "/nvda", "/mc.pa", "/spcx", "/partenaires", "/llms.txt", "/llms-full.txt"];
const UA = "Mozilla/5.0 (verif-fuites-publiques)";
const CONCURRENCE = 6; // Mac fragile : pas plus

// Routes API GET a sonder sans connexion. attendu = "ferme" (4xx/3xx attendu)
// ou "public" (200 normal, mais le contenu est controle) ; "ferme-orange" =
// ouverte signalee en orange seulement.
const ROUTES_API = [
  ["/api/online-tickers", "public"],
  ["/api/visibles-gratuit", "public"],
  ["/api/floutage-zones", "public"],
  ["/api/billing/health", "ferme-orange"],
  ["/api/carte-pays", "public"],
  ["/api/popular-stocks", "public"],
  ["/api/version", "public"],
  ["/api/telemetrie", "public"],
  ["/api/logotheque", "public"],
  ["/api/transcripts/NVDA", "public"],
  ["/api/sandbox/kpi-search/details?short=Revenue", "ferme"],
  ["/api/admin/kpi-institutionnels", "public"], // repond {"admin":false} : normal
  ["/api/admin/kpis-toggle/list-overrides", "ferme"],
  ["/api/billing/admin/plans", "ferme"],
  ["/api/billing/admin/promos", "ferme"],
  ["/api/desk/curated-companies", "ferme"],
  ["/api/desk/visibles-gratuit", "ferme"],
  ["/api/desk/page-content", "ferme"],
  ["/api/desk/special-kpis", "ferme"],
  ["/api/desk/story-kpis", "ferme"],
  ["/api/desk/ir-sources", "ferme"],
  ["/api/desk/bugs", "ferme"],
  ["/api/desk-mtk9x4kp/support", "ferme"],
  ["/api/desk-mtk9x4kp/taglines", "ferme"],
  ["/api/sandbox/synchro", "ferme"],
  ["/api/sandbox/telemetrie", "ferme"],
  ["/api/sandbox/paiements", "ferme"],
  ["/api/kpis-existants", "ferme"],
  ["/api/v1-9/export", "ferme"],
  ["/api/vip-inspection", "ferme"],
  ["/api/support/tickets", "ferme"],
];

// Tables lues avec la cle anonyme. public=true : lecture anonyme admise
// (grille tarifaire affichee sur /pricing), sinon toute ligne lisible = rouge.
const TABLES_SUPABASE = [
  ["desk_curated_companies", false],
  ["desk_page_content", false],
  ["pricing_promo_codes", false],
  ["pricing_promo_redemptions", false],
  ["desk_referral_settings", false],
  ["desk_kpi_non_financiers", false],
  ["desk_hero_kpi_overrides", false],
  ["desk_todos", false],
  ["desk_notes", false],
  ["desk_ideas", false],
  ["desk_bugs", false],
  ["desk_drafts", false],
  ["desk_pipeline", false],
  ["desk_kpi_requests", false],
  ["subscriptions", false],
  ["support_tickets", false],
  ["pricing_plans", true],
  ["pricing_prices", true],
  ["pricing_features", true],
  ["pricing_plan_features", true],
];

// Motifs recherches dans pages + chunks + robots + sitemap.
// [id, regex, gravite, description]
const MOTIFS = [
  ["cle-stripe-secrete", /\b(sk|rk)_(live|test)_[A-Za-z0-9]{10,}/g, "rouge", "cle Stripe secrete"],
  ["webhook-secret", /\bwhsec_[A-Za-z0-9]{10,}/g, "rouge", "secret de webhook Stripe"],
  ["cle-resend", /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}/g, "rouge", "cle Resend"],
  ["cle-aws", /\bAKIA[0-9A-Z]{16}\b/g, "rouge", "cle AWS"],
  ["jeton-github", /\bgh[pousr]_[A-Za-z0-9]{30,}/g, "rouge", "jeton GitHub"],
  ["cle-anthropic-openai", /\bsk-(ant-)?[A-Za-z0-9_\-]{20,}/g, "rouge", "cle d API IA"],
  ["service-role-texte", /service_role/g, "rouge", "mention service_role"],
  ["chemin-local", /\/Users\/[a-z]+\/|\.conv-state|\.batches-drafts|data-lake|scratchpad|docs\/cahier/g, "rouge", "chemin ou dossier interne"],
  ["script-interne", /scripts\/[A-Za-z0-9_\-]+\.(py|ts|mjs|cjs|sh)/g, "orange", "nom de script interne"],
  ["route-cachee", /desk-mtk9x4kp/g, "rouge", "route d administration cachee"],
  ["route-admin", /["'`]\/(sandbox|concepts)\/[a-z0-9\-\/]+/g, "orange", "route sandbox/concepts"],
  ["prenom", /\b(Yann|ordre Yann|validation Yann)\b/g, "rouge", "prenom du fondateur dans le code servi"],
  ["modele-ia", /\b(Fable|Sonnet|Opus 4|Haiku|claude-[a-z0-9\-]{3,}|gpt-[0-9])\b/g, "rouge", "nom de modele IA"],
  ["cuisine-interne", /kpis-haut|kpis_haut|en doute|à trancher|a trancher|KEPT_SOURCES|qualifieur PASS|stes ajoutees|chaines EU|chaine d integration/gi, "rouge", "vocabulaire interne"],
  ["infra-niveaux", /mettrik-niveau[0-9]|shadow prod|Stripe en test mode|Resend en dry-run|Supabase séparée/g, "orange", "description de l infrastructure"],
  ["compte-univers", /\bcount:\s*[0-9]{3,4}(?![0-9.])|\\?"count\\?":\s*[0-9]{3,4}(?![0-9.])|\],\\?"?total\\?"?:\s*[0-9]{3,4}(?![0-9.])|\bstes:\s*[0-9]{3,4}\b|\\?"?(nb_societes|universe_size|nb_stes)\\?"?:\s*[0-9]{3,4}\b/g, "rouge", "compte exact de societes"],
  ["compte-kpi", /\bglobal:\{[a-z_]+:[0-9]{3,}|regle:"KPI total =|\b(avances|ic|stories):\s*[0-9]{4,}\b/g, "rouge", "compte global de KPI (dont KPI exclusifs/avances)"],
  ["cle-indices", /["']?(sp500|nasdaq100|cac40|smi20|sox30|aex25|dax40|stoxx50)["']?\s*:\s*[\[{]/gi, "rouge", "liste d indice structuree"],
  ["kpi-exclusifs", /[0-9][0-9 ]{2,6}\s*KPI exclusifs/gi, "rouge", "nombre de KPI exclusifs"],
];

const EMAILS_ADMIS = new Set([
  "contact@mettrik.ai", "support@mettrik.ai", "you@example.com", "vous@exemple.com",
  "sie@beispiel.com", "u@voorbeeld.com", "warren@buffet.com",
]);

const constats = [];
function constat(gravite, id, ou, extrait) {
  constats.push({ gravite, id, ou, extrait: String(extrait).replace(/\s+/g, " ").slice(0, 160) });
}

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout ?? 25000);
  try {
    const r = await fetch(url, { redirect: "manual", headers: { "user-agent": UA, ...(opts.headers || {}) }, signal: ctrl.signal });
    const body = opts.noBody ? "" : await r.text();
    return { status: r.status, headers: r.headers, body };
  } catch (e) {
    return { status: 0, headers: new Headers(), body: "", erreur: String(e) };
  } finally {
    clearTimeout(t);
  }
}

async function parLots(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += CONCURRENCE) {
    out.push(...(await Promise.all(items.slice(i, i + CONCURRENCE).map(fn))));
  }
  return out;
}

function extrait(texte, index, longueur = 60) {
  return texte.slice(Math.max(0, index - longueur), index + longueur);
}

function scanner(nom, texte) {
  for (const [id, re, gravite, desc] of MOTIFS) {
    re.lastIndex = 0;
    const vus = new Set();
    let m;
    while ((m = re.exec(texte)) && vus.size < 3) {
      if (vus.has(m[0])) continue;
      vus.add(m[0]);
      constat(gravite, id, nom, `${desc} : ${extrait(texte, m.index)}`);
    }
  }
  // Courriels hors liste admise
  for (const m of new Set(texte.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[a-z]{2,}/g) || [])) {
    if (EMAILS_ADMIS.has(m) || /\.(png|jpg|svg|webp|js|css)$/.test(m) || /@[0-9]/.test(m)) continue;
    constat("rouge", "courriel", nom, m);
  }
  // Jetons JWT : seuls les jetons role=anon sont admis
  for (const m of new Set(texte.match(/eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g) || [])) {
    try {
      const charge = JSON.parse(Buffer.from(m.split(".")[1], "base64url").toString());
      if (charge.role !== "anon") constat("rouge", "jwt-non-anon", nom, `JWT role=${charge.role}`);
    } catch { /* ignore */ }
  }
  // Grandes listes de tickers dans le JS (permettent de compter l univers)
  const listeRe = /\[((?:\\?"[A-Z0-9][A-Z0-9.\-]{0,9}\\?",?){300,})\]/g;
  let l;
  while ((l = listeRe.exec(texte))) {
    const n = l[1].split(",").length;
    constat("rouge", "liste-tickers", nom, `tableau de ${n} tickers : ${l[1].slice(0, 80)}`);
  }
  const cles = new Set(texte.match(/"[A-Z][A-Z0-9]{0,5}(?:[.\-][A-Z]{1,3})?":[{[]/g) || []);
  if (cles.size >= 300) constat("orange", "dictionnaire-tickers", nom, `objet indexe par ${cles.size} tickers (permet de compter l univers)`);
}

async function main() {
  // 1. Pages
  const pages = await parLots(PAGES, async (p) => ({ p, r: await get(BASE + p) }));
  if (pages.every(({ r }) => r.status !== 200)) {
    console.error(`controle impossible : aucune page lisible sur ${BASE}`);
    process.exit(2);
  }
  const chunks = new Set();
  const refRe = /\/_next\/static\/[^"'\s\\)]+?\.(?:js|css)/g;
  for (const { p, r } of pages) {
    if (r.status !== 200) { constat("orange", "page", p, `statut ${r.status}`); continue; }
    scanner(p, r.body);
    for (const m of r.body.match(refRe) || []) chunks.add(m);
    // En-tetes
    for (const h of ["x-powered-by", "x-mettrik-version", "x-mettrik-level", "server-timing"]) {
      const v = r.headers.get(h);
      if (v) constat("orange", "en-tete", p, `${h}: ${v}`);
    }
  }

  // 2. Chunks (deux passes pour les chunks references par des chunks)
  const lus = new Map();
  let cleAnon = null;
  let urlSupabase = null;
  for (let passe = 0; passe < 2; passe++) {
    const aLire = [...chunks].filter((c) => !lus.has(c));
    const res = await parLots(aLire, async (c) => ({ c, r: await get(BASE + c) }));
    for (const { c, r } of res) {
      lus.set(c, r.status);
      if (r.status !== 200) continue;
      if (!cleAnon) {
        const k = r.body.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIs[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/);
        if (k) cleAnon = k[0];
      }
      if (!urlSupabase) {
        const u = r.body.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/);
        if (u) urlSupabase = u[0];
      }
      scanner(c.split("/").pop(), r.body);
      if (/sourceMappingURL=/.test(r.body)) constat("rouge", "sourcemap-ref", c, "sourceMappingURL present");
      for (const m of r.body.match(/(?:static\/)?(?:immutable\/)?chunks\/[A-Za-z0-9_.~\-]+\.(?:js|css)/g) || []) {
        const prefixe = c.includes("/immutable/") ? "/_next/static/immutable/" : "/_next/static/";
        chunks.add(prefixe + m.replace(/^(static\/)?(immutable\/)?/, ""));
      }
    }
  }

  // 3. Source maps (echantillon de 10 chunks JS)
  const echantillon = [...lus.keys()].filter((c) => c.endsWith(".js")).slice(0, 10);
  for (const { c, r } of await parLots(echantillon, async (c) => ({ c, r: await get(BASE + c + ".map", { noBody: true }) }))) {
    if (r.status === 200) constat("rouge", "sourcemap", c + ".map", "carte de source publique");
  }

  // 4. robots + sitemap
  const robots = await get(BASE + "/robots.txt");
  if (robots.status === 200) {
    scanner("robots.txt", robots.body);
    if (/Disallow:\s*\/desk-/.test(robots.body)) constat("orange", "robots", "robots.txt", "Disallow: /desk- (signale l existence d une route cachee)");
  }
  const sitemap = await get(BASE + "/sitemap.xml");
  if (sitemap.status === 200) {
    const n = (sitemap.body.match(/<loc>/g) || []).length;
    constat("orange", "sitemap", "sitemap.xml", `${n} URL (le sitemap donne le nombre exact de fiches, inevitable si on veut le SEO)`);
  }

  // 5. API
  for (const { route, attendu, r } of await parLots(ROUTES_API, async ([route, attendu]) => ({ route, attendu, r: await get(BASE + route) }))) {
    if (r.status === 200 && attendu.startsWith("ferme")) {
      constat(attendu === "ferme-orange" ? "orange" : "rouge", "api-ouverte", route, `200 sans connexion : ${r.body.slice(0, 120)}`);
      continue;
    }
    if (r.status !== 200) continue;
    let j = null;
    try { j = JSON.parse(r.body); } catch { /* non JSON */ }
    if (route === "/api/online-tickers" && Array.isArray(j?.tickers) && j.tickers.length > 20) {
      constat("rouge", "api-univers", route, `${j.tickers.length} tickers renvoyes a un anonyme (nombre exact de societes)`);
    }
    scanner(route, r.body);
  }

  // 6. Supabase avec la cle anonyme du JS client (relevee pendant la lecture des chunks)
  if (cleAnon && urlSupabase) {
    const h = { apikey: cleAnon, authorization: `Bearer ${cleAnon}`, prefer: "count=exact" };
    for (const { t, pub, r } of await parLots(TABLES_SUPABASE, async ([t, pub]) => ({ t, pub, r: await get(`${urlSupabase}/rest/v1/${t}?select=*&limit=1`, { headers: h }) }))) {
      if (r.status !== 200 && r.status !== 206) continue;
      const total = Number((r.headers.get("content-range") || "").split("/")[1] || 0);
      if (total > 0 && !pub) constat("rouge", "supabase-anon", t, `${total} ligne(s) lisibles avec la cle anonyme : ${r.body.slice(0, 100)}`);
      if (total > 0 && pub) scanner(`supabase:${t}`, r.body);
    }
    // Lignes sensibles de desk_page_content
    const pc = await get(`${urlSupabase}/rest/v1/desk_page_content?select=page_key,section_key,content_fr`, { headers: h });
    if (pc.status === 200) scanner("supabase:desk_page_content", pc.body);
  } else {
    constat("orange", "supabase", "-", "cle anonyme ou URL Supabase non trouvee dans le JS (controle des tables non fait)");
  }

  // 7. Preversions publiques
  if (PREVIEWS) {
    for (const hote of ["https://mettrik-niveau1.vercel.app", "https://mettrik-niveau2.vercel.app"]) {
      for (const p of ["/", "/sandbox/v1-9-5", "/concepts"]) {
        const r = await get(hote + p, { noBody: true });
        if (r.status === 200) constat(p === "/" ? "orange" : "rouge", "preversion-publique", hote + p, "200 sans connexion");
      }
    }
  }

  // Sortie
  const rouges = constats.filter((c) => c.gravite === "rouge");
  const oranges = constats.filter((c) => c.gravite === "orange");
  if (JSON_OUT) {
    console.log(JSON.stringify({ base: BASE, chunks: lus.size, rouges: rouges.length, oranges: oranges.length, constats }, null, 1));
  } else {
    console.log(`Base ${BASE} : ${PAGES.length} pages, ${lus.size} chunks, ${ROUTES_API.length} routes API, ${TABLES_SUPABASE.length} tables`);
    for (const c of [...rouges, ...oranges]) console.log(`${c.gravite.toUpperCase().padEnd(6)} ${c.id.padEnd(22)} ${c.ou.slice(0, 40).padEnd(40)} ${c.extrait}`);
    console.log(`\n${rouges.length} rouge(s), ${oranges.length} orange(s)`);
  }
  process.exit(rouges.length > 0 || (STRICT && oranges.length > 0) ? 1 : 0);
}

main().catch((e) => {
  console.error("controle impossible :", e);
  process.exit(2);
});
