/**
 * Données de la page d'aide /sandbox/aide.
 * 100% en français, ton accessible (16 ans, non-tech).
 *
 * IMPORTANT : ne PAS commit de secrets ici (tokens, mots de passe, clés).
 * Les valeurs sensibles vivent dans .env.local et Vercel env vars.
 */

export type HelpURL = {
  label: string;
  url: string;
  description: string;
  aliases: string[]; // mots-clés pour la recherche
  category: "url" | "github" | "vercel" | "supabase" | "spaceship" | "stripe";
};

export type HelpProblem = {
  id: string;
  title: string;
  symptoms: string[];   // "comment ça se manifeste"
  cause: string;        // "pourquoi ça arrive"
  solution: string[];   // étapes claires
  aliases: string[];    // mots-clés pour la recherche
  severity: "critical" | "warning" | "info";
  context: "front" | "back-office" | "deploy" | "data" | "auth" | "general";
};

// =============================================================================
// URLs canoniques (à mémoriser)
// =============================================================================
export const URLS: HelpURL[] = [
  {
    label: "Site live (production)",
    url: "https://mettrik.vercel.app",
    description: "Le vrai site, ce que voient tes utilisateurs. Connecté à la branche `main` de GitHub. Sera basculé sur mettrik.ai quand le DNS Spaceship sera branché.",
    aliases: ["site live", "production", "prod", "vrai site", "users voient", "main"],
    category: "url",
  },
  {
    label: "Antichambre (staging)",
    url: "https://mettrik-staging.vercel.app",
    description: "Tes modifs en cours, sans risquer la prod. Connecté à la branche `staging` de GitHub. Quand tu valides ce que tu vois ici, je merge dans main et ça part en prod.",
    aliases: ["staging", "preview", "antichambre", "test", "experiment", "brouillon"],
    category: "url",
  },
  {
    label: "Page maintenance (FR)",
    url: "https://mettrik.vercel.app/fr/maintenance",
    description: "Page fun affichée quand on bascule MAINTENANCE_MODE=on dans Vercel. Bilingue FR/EN avec switcher. ETA customisable via ?eta=2h dans l'URL.",
    aliases: ["maintenance", "site en construction", "down", "panne", "amélioration"],
    category: "url",
  },
  {
    label: "Desk interne (back office)",
    url: "https://mettrik.vercel.app/desk-mtk9x4kp",
    description: "Ton bureau privé. Notes, to-dos, idées, calendrier, brouillons. URL secrète, accessible uniquement avec ton email yannricordeau100@gmail.com.",
    aliases: ["desk", "back office", "bureau", "to-do", "notes", "interne", "privé"],
    category: "url",
  },
  {
    label: "GitHub repo (code)",
    url: "https://github.com/yannricordeau100-ai/spx-app",
    description: "Le code source du site. Privé. 2 branches : `main` (prod) et `staging` (antichambre).",
    aliases: ["github", "code source", "repo", "git"],
    category: "github",
  },
  {
    label: "Vercel dashboard",
    url: "https://vercel.com/yannricordeau100-7226s-projects/mettrik",
    description: "Console Vercel : historique des deploys, logs, variables d'env, settings. Tu peux y rollback en 1 click si un deploy casse la prod.",
    aliases: ["vercel", "dashboard", "deploy", "hébergement", "rollback"],
    category: "vercel",
  },
  {
    label: "Vercel variables d'env",
    url: "https://vercel.com/yannricordeau100-7226s-projects/mettrik/settings/environment-variables",
    description: "Là où tu changes MAINTENANCE_MODE, ajoutes des clés API, etc. Toute modif déclenche un redeploy auto.",
    aliases: ["env vars", "variables", "secrets", "maintenance mode", "api keys"],
    category: "vercel",
  },
  {
    label: "Supabase dashboard",
    url: "https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq",
    description: "Console Supabase : tes 12 tables (notes, todos, etc.), authentification, migrations SQL.",
    aliases: ["supabase", "base de données", "bdd", "sql", "auth"],
    category: "supabase",
  },
  {
    label: "Supabase SQL editor",
    url: "https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq/sql/new",
    description: "Là où tu colles les migrations SQL que je te donne (ex : ajouter une catégorie, modifier une contrainte).",
    aliases: ["sql editor", "migration", "alter table", "constraint"],
    category: "supabase",
  },
  {
    label: "Supabase auth settings",
    url: "https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq/auth/url-configuration",
    description: "URLs de redirection OAuth. À configurer après avoir branché un nouveau domaine (mettrik.ai par ex).",
    aliases: ["redirect url", "oauth", "google login", "callback"],
    category: "supabase",
  },
  {
    label: "Stripe dashboard (test)",
    url: "https://dashboard.stripe.com/test/dashboard",
    description: "Console Stripe en mode TEST. Aucun paiement réel ne passe. Pour switcher en LIVE, il faut un toggle en haut à droite.",
    aliases: ["stripe", "paiement", "billing", "checkout", "subscription"],
    category: "stripe",
  },
  {
    label: "Spaceship (DNS du domaine)",
    url: "https://www.spaceship.com",
    description: "Ton registrar pour mettrik.ai. C'est là que tu vas pour pointer le domaine vers Vercel via les records DNS A et CNAME.",
    aliases: ["spaceship", "domaine", "dns", "mettrik.ai", "registrar"],
    category: "spaceship",
  },
];

// =============================================================================
// Problèmes connus + solutions (16 ans, non-tech)
// =============================================================================
export const PROBLEMS: HelpProblem[] = [
  // ===== FRONT (site public) =====
  {
    id: "site-down",
    title: "Le site live est inaccessible",
    symptoms: [
      "mettrik.vercel.app affiche une page d'erreur",
      "Erreur 500 ou 503",
      "Page complètement blanche",
    ],
    cause: "Soit Vercel est en panne (rare), soit un deploy récent a cassé quelque chose.",
    solution: [
      "1. Va sur https://www.vercel-status.com pour vérifier que Vercel n'est pas down (vert = ok).",
      "2. Si Vercel est ok, va sur ton dashboard Vercel → Deployments → trouve le dernier deploy ROUGE.",
      "3. Click le deploy précédent qui était VERT → bouton 'Promote to Production' → 1 click → la prod revient en arrière en 30 sec.",
      "4. Ping-moi pour que je débogue le commit fautif sur staging avant de retenter.",
    ],
    aliases: ["site down", "site cassé", "500", "erreur serveur", "page blanche", "rollback", "revenir en arrière"],
    severity: "critical",
    context: "front",
  },
  {
    id: "site-lent",
    title: "Le site est lent ou répond pas",
    symptoms: [
      "Pages mettent plus de 5 secondes à charger",
      "Spinner qui tourne sans fin",
    ],
    cause: "Souvent une fonction serverless en timeout (Vercel kill à 60s par défaut), ou un problème Supabase.",
    solution: [
      "1. Vérifie sur https://status.supabase.com que Supabase est vert.",
      "2. Va dans Vercel → Logs → cherche les requêtes qui prennent >10s.",
      "3. Ping-moi avec l'URL qui rame, je trouve le goulot d'étranglement.",
    ],
    aliases: ["lent", "lag", "timeout", "qui rame", "performances"],
    severity: "warning",
    context: "front",
  },
  {
    id: "login-fail",
    title: "Un user n'arrive pas à se connecter",
    symptoms: [
      "Email/mot de passe valides mais erreur",
      "Magic link cliqué mais redirige vers home avec ?error=",
      "Google OAuth échoue",
    ],
    cause: "Soit une URL de redirection Supabase pas configurée, soit un cookie auth bloqué.",
    solution: [
      "1. Demande à l'user le message d'erreur exact.",
      "2. Vérifie dans Supabase → Auth → URL Configuration que la `Site URL` est bien la prod.",
      "3. Vérifie que les `Redirect URLs` listent bien : https://mettrik.vercel.app/auth/callback (et /fr/auth/callback).",
      "4. Si un user spécifique a le souci : Supabase → Authentication → Users → cherche son email → vérifie qu'il est confirmé.",
    ],
    aliases: ["login", "connexion", "auth", "magic link", "google oauth", "redirect", "callback"],
    severity: "critical",
    context: "auth",
  },
  {
    id: "404-domaine",
    title: "mettrik.ai retourne 404 (pas mettrik.vercel.app)",
    symptoms: [
      "mettrik.ai ne charge pas",
      "DNS_PROBE_FINISHED_NXDOMAIN",
    ],
    cause: "Le DNS Spaceship pointe pas encore vers Vercel.",
    solution: [
      "1. Ouvre https://www.spaceship.com → connecte-toi (biométrie).",
      "2. Domaines → mettrik.ai → DNS.",
      "3. Vérifie qu'il y a bien : un record A pour `@` qui pointe vers 76.76.21.21, et un record CNAME pour `www` vers cname.vercel-dns.com.",
      "4. Si pas le cas, ajoute-les. Patience 5-30 min pour la propagation.",
      "5. Côté Vercel : Settings → Domains → vérifie que mettrik.ai est ajouté et 'Valid Configuration'.",
    ],
    aliases: ["dns", "mettrik.ai", "domaine", "404", "nxdomain", "propagation", "spaceship"],
    severity: "critical",
    context: "deploy",
  },
  {
    id: "deploy-fail",
    title: "Un deploy Vercel échoue (build error)",
    symptoms: [
      "Vercel CLI dit 'deploy_failed'",
      "Email Vercel 'Deployment Failed'",
    ],
    cause: "Soit erreur de TypeScript, soit env var manquante, soit problème team gate (auteur git pas reconnu).",
    solution: [
      "1. Va sur Vercel dashboard → Deployments → click le deploy rouge → onglet 'Build Logs'.",
      "2. Si l'erreur dit 'Git author must have access' : le commit a été fait avec le mauvais email. Solution : le prochain commit doit utiliser yannricordeau100@gmail.com comme auteur. Ping-moi je le règle.",
      "3. Si l'erreur dit 'Type error' : faut fixer le TypeScript. Ping-moi avec le message d'erreur.",
      "4. Si l'erreur dit 'env var missing' : ajoute la variable manquante dans Vercel → Settings → Env Vars.",
    ],
    aliases: ["deploy fail", "build error", "team gate", "vercel error", "typescript error"],
    severity: "warning",
    context: "deploy",
  },
  // ===== BACK OFFICE (desk) =====
  {
    id: "desk-404",
    title: "/desk-mtk9x4kp retourne 404",
    symptoms: [
      "Page 'Cette page est introuvable' sur ton desk",
    ],
    cause: "Pas connecté avec le bon email (DESK_OWNER_EMAIL = yannricordeau100@gmail.com).",
    solution: [
      "1. Va sur /whoami pour voir avec quel email tu es connecté.",
      "2. Si l'email ne match pas, déconnecte-toi et reconnecte-toi avec yannricordeau100@gmail.com.",
      "3. Si toujours 404 : vérifie sur Vercel que la var d'env DESK_OWNER_EMAIL contient bien yannricordeau100@gmail.com.",
    ],
    aliases: ["desk 404", "desk introuvable", "owner email", "whoami"],
    severity: "warning",
    context: "back-office",
  },
  {
    id: "todo-add-fail",
    title: "Une to-do n'apparaît pas après 'Ajouter'",
    symptoms: [
      "Click sur Ajouter, le champ se vide, mais la tâche n'apparaît pas dans la liste",
      "Refresh : rien dans la BDD",
    ],
    cause: "Le plus souvent : la valeur de catégorie envoyée n'est pas acceptée par la contrainte SQL (ex: nouvelle catégorie ajoutée mais migration pas lancée).",
    solution: [
      "1. Ouvre la console du navigateur (F12 → Console). Tape une nouvelle tâche, click Ajouter, regarde s'il y a une erreur 400 ou 500.",
      "2. Si erreur 'check constraint violation' : il faut lancer la migration SQL associée à la nouvelle catégorie. Ping-moi je te donne le SQL à coller.",
      "3. Sinon, ping-moi avec le message d'erreur de la console.",
    ],
    aliases: ["todo", "tâche", "ajouter ne fait rien", "check constraint", "v2.5", "extra", "5e catégorie"],
    severity: "critical",
    context: "back-office",
  },
  {
    id: "donnees-perdues",
    title: "J'ai écrit du contenu et il n'est pas sauvegardé",
    symptoms: [
      "Note / to-do / idée tapée mais après refresh elle est partie",
    ],
    cause: "Soit pas connecté quand tu as écrit, soit erreur réseau, soit (rare) bug de validation côté serveur.",
    solution: [
      "1. Ouvre F12 → Network → écris quelque chose → click sauvegarder → regarde les requêtes POST/PATCH vers /api/desk/...",
      "2. Si tu vois une réponse 401 : tu n'es pas connecté. Reconnecte-toi.",
      "3. Si tu vois 4xx/5xx : copie le message d'erreur, ping-moi.",
      "4. RAPPEL : si tu trouves du contenu tapé qui n'a jamais été visible après refresh, le texte est perdu (rien en BDD, rien en logs).",
    ],
    aliases: ["données perdues", "data perdue", "rien sauvegardé", "disparu", "perdu après refresh"],
    severity: "critical",
    context: "back-office",
  },
  // ===== DATA / PIPELINE =====
  {
    id: "soc-non-trouve",
    title: "Une société n'apparaît pas dans la liste V1.7",
    symptoms: [
      "Page /sandbox/v1-7 : ticker en gris 'à venir'",
    ],
    cause: "Le pipeline LLM (autre conversation) n'a pas encore extrait les données de cette société.",
    solution: [
      "1. C'est normal. CONV-DATA traite ~50 sociétés par jour.",
      "2. Si urgent : ping-moi le ticker, je signale dans SHARED-STATUS pour que CONV-DATA prioritise.",
    ],
    aliases: ["société manquante", "ticker à venir", "v1.7", "non extrait", "pipeline"],
    severity: "info",
    context: "data",
  },
  {
    id: "soc-fr-zero",
    title: "Aucune société française dans la BDD",
    symptoms: [
      "/fr/sandbox/v1-7 : toutes les cartes sont grises",
    ],
    cause: "CONV-DATA n'a pas encore traité les .PA (CAC 40 / SBF 120). SEC EDGAR ne couvre pas les sociétés françaises, il faut sources alternatives (AMF / Euronext IR pages).",
    solution: [
      "1. Patiente. CONV-DATA est consciente du besoin (tracé dans SHARED-STATUS).",
      "2. Si urgent : ping-moi pour que je propose un workaround (scraping IR pages).",
    ],
    aliases: ["france", "francaise", "cac 40", "sbf 120", ".pa", "lvmh", "totalenergies"],
    severity: "info",
    context: "data",
  },
  // ===== ACTIVATION MAINTENANCE =====
  {
    id: "activer-maintenance",
    title: "Activer la page de maintenance",
    symptoms: [
      "Tu veux cacher la prod aux users le temps d'une grosse mise à jour",
    ],
    cause: "Pas une erreur, juste une action volontaire.",
    solution: [
      "1. Va sur https://vercel.com/yannricordeau100-7226s-projects/mettrik/settings/environment-variables",
      "2. Trouve MAINTENANCE_MODE → click Edit → change `off` en `on` → Save.",
      "3. Vercel redeploie auto en ~1 min.",
      "4. Vérifie sur mettrik.vercel.app que la page maintenance s'affiche.",
      "5. Pour désactiver : pareil mais `on` → `off`.",
      "6. Tu peux customiser l'ETA via mettrik.vercel.app/maintenance?eta=2h",
    ],
    aliases: ["maintenance", "mode maintenance", "couper le site", "site en construction", "en travaux", "mettre en pause"],
    severity: "info",
    context: "deploy",
  },
  // ===== AUTRES =====
  {
    id: "stripe-test",
    title: "Tester Stripe en mode TEST",
    symptoms: [
      "Tu veux vérifier que le checkout Stripe marche",
    ],
    cause: "Cartes test à utiliser (vraies cartes interdites).",
    solution: [
      "1. Sur la page checkout, utilise la carte test : 4242 4242 4242 4242.",
      "2. Date d'expiration : n'importe quelle date future (ex 12/30).",
      "3. CVC : 3 chiffres au hasard (ex 123).",
      "4. Code postal : 12345.",
      "5. Tu verras la transaction dans Stripe → Mode TEST → Payments.",
    ],
    aliases: ["stripe test", "carte test", "4242", "checkout", "test paiement"],
    severity: "info",
    context: "general",
  },
  {
    id: "rollback-deploy",
    title: "Revenir à une version précédente du site",
    symptoms: [
      "La prod a un bug, tu veux revenir à la version d'avant",
    ],
    cause: "Pas une erreur, juste une action.",
    solution: [
      "1. Vercel dashboard → Deployments.",
      "2. Trouve le deploy précédent (étiquette VERT 'Ready' qui n'est pas le dernier).",
      "3. Click les 3 points (...) → 'Promote to Production'.",
      "4. Confirme. La prod revient à cette version en 30 sec.",
      "5. Note : ça ne touche pas le code GitHub. Ping-moi pour que je règle le bug avant de re-promouvoir staging.",
    ],
    aliases: ["rollback", "annuler deploy", "revenir avant", "version précédente", "undo"],
    severity: "info",
    context: "deploy",
  },
  {
    id: "secret-leaked",
    title: "Un secret (token, mot de passe) a été commité par accident",
    symptoms: [
      "Tu vois une clé API dans GitHub, ou un token dans un fichier public",
    ],
    cause: "Faute de fichier mal placé dans le repo, ou env var écrite en dur dans le code.",
    solution: [
      "1. ACTION URGENTE : invalide la clé immédiatement (Vercel → Tokens / GitHub → Settings → Tokens / Stripe → Developers → API keys).",
      "2. Génère un nouveau token et mets à jour la var d'env Vercel.",
      "3. Ping-moi pour que je supprime le fichier de l'historique git (git filter-repo).",
      "4. Le fait que GitHub soit privé limite le risque mais ne l'élimine pas (employés GitHub, fuite de credentials, etc.).",
    ],
    aliases: ["secret commité", "token leak", "clé api visible", "credentials exposés"],
    severity: "critical",
    context: "deploy",
  },
];
