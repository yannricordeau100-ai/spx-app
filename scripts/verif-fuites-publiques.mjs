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
 *         node scripts/verif-fuites-publiques.mjs --static DOSSIER_BUILD [--json] [--public URL_BASE]
 *         URL_BASE par defaut : https://mettrik.ai (ou variable BASE)
 * --static : analyse le build local (ex. .next ou .next-audit apres
 *         `NEXT_DIST_DIR=.next-audit npx next build`) : TOUS les fichiers de
 *         static/ (ce que l on obtient en telechargeant tout le code public) et
 *         les pages prerendues. Les fichiers atteignables depuis les pages
 *         publiques (manifestes des routes publiques) sont en rouge ; les
 *         autres (outillage, servi seulement aux admins) en orange.
 *         node scripts/verif-fuites-publiques.mjs --source [--json]
 * --source : sans build Next (trop lourd pour le Mac) : regroupe avec esbuild
 *         tous les composants client des routes publiques (src/, hors outillage),
 *         applique le meme chargeur que le build (src/build/assainir-json-client.cjs)
 *         et analyse le JS obtenu (equivalent du code navigateur servi).
 * Code de retour : 0 aucun rouge, 1 au moins un rouge, 2 controle impossible.
 * Branche dans scripts/verif-release.py (bloc 10, 8 oct 2026) : feu rouge si
 * un rouge sur la preversion niveau2 (celle qui est promue sur mettrik.ai).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const STRICT = args.includes("--strict");
const PREVIEWS = args.includes("--previews");
const BASE = (args.find((a) => /^https?:\/\//.test(a)) || process.env.BASE || "https://mettrik.ai").replace(/\/$/, "");
const STATIC_DIR = args.includes("--static") ? args[args.indexOf("--static") + 1] : null;
const SOURCE = args.includes("--source");

const PAGES = ["/", "/pricing", "/nvda", "/mc.pa", "/spcx", "/partenaires", "/llms.txt", "/llms-full.txt"];
const UA = "Mozilla/5.0 (verif-fuites-publiques)";
const CONCURRENCE = 6; // Mac fragile : pas plus

// Routes API GET a sonder sans connexion. attendu = "ferme" (4xx/3xx attendu)
// ou "public" (200 normal, mais le contenu est controle) ; "ferme-orange" =
// ouverte signalee en orange seulement.
const ROUTES_API = [
  // 8 oct 2026 : liste complete reservee aux admins ; la recherche publique
  // passe par /api/recherche-societes (10 resultats au plus).
  ["/api/online-tickers", "ferme"],
  ["/api/recherche-societes", "public"],
  ["/api/recherche-societes?q=a", "public"],
  ["/api/recherche-societes?q=ba", "public"],
  ["/api/visibles-gratuit", "public"],
  ["/api/floutage-zones", "public"],
  ["/api/billing/health", "public"], // 8 oct 2026 : { ok: true } seulement pour un visiteur
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
// 8 oct 2026 : la liste est completee automatiquement par TOUTES les tables
// exposees par l API Supabase (description OpenAPI lue avec la cle anonyme) :
// une nouvelle table ouverte par erreur est detectee sans modifier ce script.
const TABLES_PUBLIQUES = new Set(["pricing_plans", "pricing_prices", "pricing_features", "pricing_plan_features"]);
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
  ["infra-niveaux", /mettrik-niveau[0-9]|shadow prod|Stripe en test mode|Resend en dry-run|Supabase séparée/g, "rouge", "nom d hote ou description de l infrastructure"],
  // 8 oct 2026 : notes internes des JSON (retirees par src/build/assainir-json-client.cjs)
  ["note-interne", /(?<=[{,\s"'])_(?:[a-z0-9]+_)*(note|doc|comment)(?:_[0-9a-z]+)?["']?\s*:\s*["'`]/g, "rouge", "note interne (_note, _doc...)"],
  ["compte-univers", /\bcount:\s*[0-9]{3,4}(?![0-9.])|\\?"count\\?":\s*[0-9]{3,4}(?![0-9.])|\],\\?"?total\\?"?:\s*[0-9]{3,4}(?![0-9.])|\bstes:\s*[0-9]{3,4}\b|\\?"?(nb_societes|universe_size|nb_stes)\\?"?:\s*[0-9]{3,4}\b/g, "rouge", "compte exact de societes"],
  ["compte-kpi", /\bglobal:\{[a-z_]+:[0-9]{3,}|regle:"KPI total =|\b(avances|ic|stories):\s*[0-9]{4,}\b/g, "rouge", "compte global de KPI (dont KPI exclusifs/avances)"],
  ["cle-indices", /["']?(sp500|nasdaq100|cac40|smi20|sox30|aex25|dax40|stoxx50)["']?\s*:\s*[\[{]/gi, "rouge", "liste d indice structuree"],
  ["kpi-exclusifs", /[0-9][0-9 ]{2,6}\s*KPI exclusifs/gi, "rouge", "nombre de KPI exclusifs"],
];

const EMAILS_ADMIS = new Set([
  "contact@mettrik.ai", "support@mettrik.ai", "noreply@mettrik.ai", "you@example.com", "vous@exemple.com",
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

// Routes de l application ouvertes a un visiteur ou a un inscrit gratuit
// (inscription libre) : leur code est considere comme public. Le reste
// (sandbox, admin, desk-..., concepts, chart-lab, email-lab, whoami, faq,
// populaire-investisseurs) repond 404 sur mettrik.ai et n est servi qu aux admins.
const ROUTES_NON_PUBLIQUES = /^\/(sandbox|admin|desk-[^/]+|concepts|chart-lab|email-lab|whoami|faq|populaire-investisseurs|_not-found-desk)(\/|$)/;

function fichiers(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) fichiers(p, out);
    else out.push(p);
  }
  return out;
}

/** Analyse statique d un build local : tout static/ + pages prerendues. */
async function analyseStatique(dir) {
  if (!existsSync(join(dir, "BUILD_ID"))) {
    console.error(`controle impossible : ${dir}/BUILD_ID absent (build incomplet)`);
    process.exit(2);
  }
  const statiques = fichiers(join(dir, "static")).filter((f) => /\.(js|css|json|txt)$/.test(f));
  // Fichiers atteignables depuis les routes publiques : manifestes de references client.
  const manifestes = fichiers(join(dir, "server", "app")).filter((f) => f.endsWith("_client-reference-manifest.js"));
  const atteignables = new Set();
  const refStatique = /static\/[A-Za-z0-9_.~\-\/]+?\.(?:js|css)/g;
  let routesPubliques = 0;
  for (const m of manifestes) {
    const route = "/" + relative(join(dir, "server", "app"), m).replace(/(^|\/)page_client-reference-manifest\.js$/, "").replace(/\/?route_client-reference-manifest\.js$/, "").replace(/\([^)]*\)\/?/g, "");
    if (ROUTES_NON_PUBLIQUES.test(route.replace(/\/+$/, "") || "/")) continue;
    routesPubliques++;
    for (const r of readFileSync(m, "utf8").match(refStatique) || []) atteignables.add(r);
  }
  // Pages prerendues (HTML / RSC) : seulement les routes publiques.
  const prerendues = fichiers(join(dir, "server", "app")).filter((f) => /\.(html|rsc|body|segments)$/.test(f) || /\.segment\.rsc$/.test(f));
  for (const f of prerendues) {
    const route = "/" + relative(join(dir, "server", "app"), f);
    if (ROUTES_NON_PUBLIQUES.test(route)) continue;
    const texte = readFileSync(f, "utf8");
    for (const r of texte.match(refStatique) || []) atteignables.add(r);
    scanner(route, texte);
  }
  // Fermeture : chunks references par des chunks atteignables (imports dynamiques).
  const contenu = new Map(statiques.map((f) => [ "static/" + relative(join(dir, "static"), f), f ]));
  let ajout = true;
  for (let passe = 0; ajout && passe < 8; passe++) {
    ajout = false;
    for (const c of [...atteignables]) {
      const f = contenu.get(c);
      if (!f || !f.endsWith(".js")) continue;
      for (const m of readFileSync(f, "utf8").match(/(?:static\/)?(?:immutable\/)?chunks\/[A-Za-z0-9_.~\-]+\.(?:js|css)/g) || []) {
        const k = "static/" + (c.includes("/immutable/") && !m.includes("immutable/") ? "immutable/" : "") + m.replace(/^static\//, "");
        if (contenu.has(k) && !atteignables.has(k)) { atteignables.add(k); ajout = true; }
      }
    }
  }
  const avant = constats.length;
  for (const [cle, f] of contenu) {
    const debut = constats.length;
    scanner(cle.split("/").pop(), readFileSync(f, "utf8"));
    if (!atteignables.has(cle)) {
      // Code d outillage (servi aux seuls admins) : signale en orange.
      for (let i = debut; i < constats.length; i++) {
        if (constats[i].gravite === "rouge") { constats[i].gravite = "orange"; constats[i].id = "hors-public:" + constats[i].id; }
      }
    }
  }
  void avant;
  if (/sourceMappingURL=/.test(statiques.filter((f) => f.endsWith(".js")).map((f) => readFileSync(f, "utf8").slice(-300)).join("\n"))) {
    constat("rouge", "sourcemap-ref", dir, "sourceMappingURL present dans un chunk");
  }
  if (statiques.some((f) => f.endsWith(".map"))) constat("rouge", "sourcemap", dir, "fichiers .map dans static/");
  return { fichiers: statiques.length, atteignables: atteignables.size, routesPubliques, manifestes: manifestes.length };
}

/** Regroupe le code client public avec esbuild (chargeur d assainissement compris) et l analyse. */
async function analyseSource() {
  const racine = new URL("..", import.meta.url).pathname;
  const { createRequire } = await import("node:module");
  const req = createRequire(join(racine, "package.json"));
  const esbuild = req("esbuild");
  const assainir = req("./src/build/assainir-json-client.cjs");
  const EXCLUS = /^src\/(app\/(sandbox|admin|desk-[^/]+|concepts|chart-lab|email-lab|whoami|faq|populaire-investisseurs)\/|components\/(desk|sandbox|email-lab|lab)\/)/;
  const entrees = fichiers(join(racine, "src"))
    .filter((f) => /\.(tsx?|jsx?)$/.test(f))
    .map((f) => relative(racine, f))
    .filter((f) => !EXCLUS.test(f))
    .filter((f) => /^\s*["']use client["']/.test(readFileSync(join(racine, f), "utf8")));
  const plugin = {
    name: "mettrik",
    setup(b) {
      b.onResolve({ filter: /^@\// }, async (a) => {
        const base = join(racine, "src", a.path.slice(2));
        for (const ext of ["", ".ts", ".tsx", ".js", ".jsx", ".json", "/index.ts", "/index.tsx"]) {
          if (existsSync(base + ext) && statSync(base + ext).isFile()) return { path: base + ext };
        }
        return { path: a.path, external: true };
      });
      b.onResolve({ filter: /^[^./]/ }, (a) => (a.path.startsWith("@/") ? undefined : { path: a.path, external: true }));
      b.onLoad({ filter: /\/src\/data\/.*\.json$/ }, (a) => ({
        contents: assainir.call({ resourcePath: a.path }, readFileSync(a.path, "utf8")),
        loader: "js",
      }));
      b.onLoad({ filter: /\.(css|png|svg|jpg|woff2?)$/ }, () => ({ contents: "", loader: "js" }));
      // Fichiers "use server" : jamais envoyes au navigateur (Next les remplace par
      // des references d action). On les remplace par des souches vides.
      b.onLoad({ filter: /\/src\/.*\.(ts|tsx)$/ }, (a) => {
        const texte = readFileSync(a.path, "utf8");
        if (!/^\s*["']use server["']/.test(texte)) return undefined;
        const noms = [...texte.matchAll(/export\s+(?:async\s+)?(?:function|const|let)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
        return { contents: noms.map((n) => `export const ${n} = () => {};`).join("\n") || "export {};", loader: "js" };
      });
    },
  };
  const res = await esbuild.build({
    entryPoints: entrees.map((f) => join(racine, f)),
    bundle: true, write: false, splitting: true, format: "esm", platform: "browser",
    outdir: "/tmp/verif-fuites-source", minify: true, legalComments: "none", logLevel: "silent", metafile: true,
    jsx: "automatic", plugins: [plugin],
    define: { "process.env.NODE_ENV": '"production"' },
  }).catch((e) => ({ errors: e.errors || [String(e)], outputFiles: [] }));
  for (const f of res.outputFiles || []) scanner("bundle:" + f.path.split("/").pop(), f.text);
  return { fichiers: (res.outputFiles || []).length, entrees: entrees.length, erreurs: (res.errors || []).length };
}

async function main() {
  if (SOURCE) {
    const info = await analyseSource();
    const rouges = constats.filter((c) => c.gravite === "rouge");
    const oranges = constats.filter((c) => c.gravite === "orange");
    if (JSON_OUT) console.log(JSON.stringify({ mode: "source", ...info, rouges: rouges.length, oranges: oranges.length, constats }, null, 1));
    else {
      console.log(`Code client public : ${info.entrees} composants, ${info.fichiers} fichiers produits, ${info.erreurs} erreur(s) esbuild`);
      for (const c of [...rouges, ...oranges]) console.log(`${c.gravite.toUpperCase().padEnd(6)} ${c.id.padEnd(22)} ${c.ou.slice(0, 40).padEnd(40)} ${c.extrait}`);
      console.log(`\n${rouges.length} rouge(s), ${oranges.length} orange(s)`);
    }
    process.exit(info.fichiers === 0 ? 2 : rouges.length > 0 || (STRICT && oranges.length > 0) ? 1 : 0);
  }
  if (STATIC_DIR) {
    const info = await analyseStatique(STATIC_DIR);
    const rouges = constats.filter((c) => c.gravite === "rouge");
    const oranges = constats.filter((c) => c.gravite === "orange");
    if (JSON_OUT) {
      console.log(JSON.stringify({ build: STATIC_DIR, ...info, rouges: rouges.length, oranges: oranges.length, constats }, null, 1));
    } else {
      console.log(`Build ${STATIC_DIR} : ${info.fichiers} fichiers statiques, ${info.atteignables} atteignables depuis ${info.routesPubliques} routes publiques (${info.manifestes} manifestes)`);
      for (const c of [...rouges, ...oranges]) console.log(`${c.gravite.toUpperCase().padEnd(6)} ${c.id.padEnd(30)} ${c.ou.slice(0, 40).padEnd(40)} ${c.extrait}`);
      console.log(`\n${rouges.length} rouge(s), ${oranges.length} orange(s)`);
    }
    process.exit(rouges.length > 0 || (STRICT && oranges.length > 0) ? 1 : 0);
  }
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
  for (let passe = 0; passe < 6; passe++) {
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
    if (route.startsWith("/api/recherche-societes") && Array.isArray(j?.resultats) && j.resultats.length > 10) {
      constat("rouge", "api-univers", route, `${j.resultats.length} resultats (10 au plus attendus)`);
    }
    if (route === "/api/billing/health" && j && Object.keys(j).some((k) => k !== "ok")) {
      constat("rouge", "api-ouverte", route, `detail de configuration servi a un anonyme : ${r.body.slice(0, 100)}`);
    }
    scanner(route, r.body);
  }

  // 6. Supabase avec la cle anonyme du JS client (relevee pendant la lecture des chunks)
  if (cleAnon && urlSupabase) {
    const h = { apikey: cleAnon, authorization: `Bearer ${cleAnon}`, prefer: "count=exact" };
    const toutes = new Map(TABLES_SUPABASE);
    try {
      const api = await get(`${urlSupabase}/rest/v1/`, { headers: { apikey: cleAnon, authorization: `Bearer ${cleAnon}` } });
      const doc = JSON.parse(api.body || "{}");
      for (const chemin of Object.keys(doc.paths || {})) {
        const t = chemin.replace(/^\//, "");
        if (t && !t.startsWith("rpc/") && !toutes.has(t)) toutes.set(t, TABLES_PUBLIQUES.has(t));
      }
    } catch { /* description indisponible : liste fixe seulement */ }
    for (const { t, pub, r } of await parLots([...toutes.entries()], async ([t, pub]) => ({ t, pub, r: await get(`${urlSupabase}/rest/v1/${t}?select=*&limit=1`, { headers: h }) }))) {
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
        if (r.status === 200 || (r.status >= 300 && r.status < 400 && p !== "/")) constat(p === "/" ? "orange" : "rouge", "preversion-publique", hote + p, p === "/" ? "200 sans connexion" : `${r.status} sans connexion (404 attendu)`);
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
