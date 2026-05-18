# CONV-SYSTEMS — Kickstart prompt pour nouvelle session

> **Pourquoi ce fichier ?** La conv CONV-SYSTEMS d'origine est morte (limite Claude Code "image dimension exceeds 2000px" = trop de screenshots accumulés en contexte). Pour récupérer SANS rien perdre : ouvre une **nouvelle session** dans le slot "KPI System" du groupe "KPI Boss", puis colle le kickstart ci-dessous.
> Préparé par CONV-CONCEPTS le 18 mai 2026 ~03h15.

---

## 🚀 KICKSTART PROMPT (à coller dans la nouvelle session)

```
Salut. Je reprends le projet Mettrik AI dans le slot KPI System (groupe KPI Boss).
La précédente conv est morte (limite image accumulée). Aucun travail perdu, tout
est dans le repo git (~/spx-app, branche staging).

CHARGE D'ABORD ces 3 fichiers OBLIGATOIREMENT avant de répondre :
- ~/spx-app/CLAUDE.md (règles + contexte projet)
- ~/spx-app/RULES-GOLDEN.md (10 règles d'or non négociables)
- ~/spx-app/SHARED-STATUS.md (coordination 6 convs : CONCEPTS, SYSTEMS,
  DATA, BRAND, DIV, DEPAN)

Puis lis ~/spx-app/CONV-SYSTEMS-RECOVERY.md qui contient :
1. Dernier état du travail CONV-SYSTEMS (5 derniers commits)
2. Tâches en cours non terminées
3. Bascule architecture niveau 1 prévue ce matin
4. Lien vers .conv-state/CONV-SYSTEMS.md pour le contexte long
5. Wakeup cron 5h40 lundi avec backup TODO-RAPPELS.md

Tu es CONV-SYSTEMS, scope : billing, paiement, desk interne, sandbox, infra
Supabase, i18n, légal, SEO, analytics, déploiement, bascule architecture.

À cette heure (~3h15), ta priorité ABSOLUE est la BASCULE ARCHITECTURE
NIVEAU 1 prévue d'ici 5h40 (= 2h15 max). Concrètement, voir section
"Bascule architecture" du recovery file.

Réponds DOB (Direct Objectif Bref). Ne re-explique pas ce que tu vas faire
si tu peux le faire directement. Phrases courtes, tableaux > listes.
```

---

## 📋 État avant crash

### Derniers commits CONV-SYSTEMS (chronologique inverse)

| Commit | Description |
|---|---|
| `43c9f168` | feat(concepts): `/concepts/social-cards` — 7 variants RS innovants ✅ FAIT |
| `538939ba` | feat(social): deeplinks mobile app native X + Instagram (fallback web auto) ✅ FAIT |
| `f25985f6` | feat(brand): bandeau social X + Instagram @mettrik_ai sur toutes pages ✅ FAIT |
| `d7f6262b` | fix(social-links-row): inline SVG Instagram (lucide-react deprecated) |
| `f58952b5` | v17/v18: ajouter les 5 stés démo V1.0 (CAT/GOOGL/META/MSCI/SPGI) + broadcast oubli V1.0/V1.5 |
| `7b0b469a` | i18n(data): EN+DE deep gaps comblés (326 stés, ~1335 strings) |
| `1ab67b84` | fix(vip-inspection-worker): inject VISUAL_AUDIT_TOKEN secret env var |
| `77a47746` | fix(vip-api): bascule repository_dispatch → workflow_dispatch |
| `6099f484` | fix(i18n DE): company-header sector/subsector chips locale-aware |

### Dernière tâche annoncée par Yann (avant crash)

Yann avait demandé à 03:10 (avant le crash) :

> "1) changer légèrement le style du menu déroulant de la langue en regroupant les langues proches entre elles (suisse allemand / allemand ; US / UK ; danois et suedois) le NL ne doit pas être loin de(s) autre(s) langue(s) lui ressemblant, à toi de voir laquelle / lesquelles. soit innovant et 'wow'.
>
> 2) prévenir la conv concernée + lui dire tout ce que tu as fait + changer le template (et le dire à l'autre conv concernée)"

→ **À FAIRE** : modif `language-dropdown.tsx` ou équivalent pour regrouper visuellement :
- Allemand (de) + Suisse allemand (de-CH)
- US (en) + UK (en-GB)
- Danois (da) + Suédois (sv)
- Néerlandais (nl) à placer près de l'allemand (langue cousine germanique)
- Style "wow" : séparateurs visuels, icônes drapeau, ou groupement par région

→ **À FAIRE** : prévenir CONV-CONCEPTS via SHARED-STATUS + modifier le template (= règle stocked dans CLAUDE.md ?) pour que les prochains ajouts de langue suivent ce groupement.

---

## 🚨 PRIORITÉ ABSOLUE : Bascule architecture niveau 1

Yann a mentionné un transfert d'ici 2h vers une nouvelle architecture à 3 niveaux. À 03:15, cible 5h40 lundi matin (créneau prévu).

### À préserver lors de la bascule (broadcast CONV-CONCEPTS commit `09afdba1`)

1. **Routes sandbox** :
   - `/sandbox/image-findings` (UI Yann ajout graphiques/schémas web)
   - `/sandbox/kpi-builder` (UI Yann ajout KPI sur mesure multi-stés, créé aujourd'hui)
2. **Tables Supabase** :
   - `desk_image_findings_requests` + `desk_image_findings`
   - `desk_kpi_requests` (migration 20260518 collée par Yann)
3. **API endpoints** :
   - `/api/desk-mtk9x4kp/kpi-search-tickers` (Groq Llama 3.3 70B)
   - `/api/desk-mtk9x4kp/kpi-add-request` (POST create)
   - `/api/desk-mtk9x4kp/kpi-requests` (GET/PATCH/DELETE)
   - `/api/cron/kpi-worker-tick` (NOUVEAU serverless, refactor en cours commit pending)
4. **Cron Vercel** :
   - `email-onboarding` (0 9 * * *)
   - `quality-snapshot` (0 21 * * *)
   - `kpi-worker-tick` (7 * * * *) ⚠ **3 crons sur Hobby tier limite 2** → vérifier si Yann a Pro ou si retirer 1 cron

### Recommandation Yann : déplacer les 2 blocs

Yann a dit OK pour regrouper kpi-builder + image-findings au même endroit. Ma recommandation = **migration vers `/desk-mtk9x4kp/kpi-builder` et `/desk-mtk9x4kp/image-findings`** (back office propre à côté de Pricing/Bugs/Taglines, plutôt que sandbox). Ça PEUT être intégré dans la bascule niveau 1 OU différé en niveau 2.

À toi de décider en fonction du timing.

---

## 🔄 Travail KPI builder en cours (commit en attente)

CONV-CONCEPTS (moi) a dispatché un agent G qui a refactoré le worker KPI Python → API serverless. Travail TERMINÉ en working tree, **pas encore commit** au moment du crash. Fichiers modifiés/créés :

- `src/app/api/cron/kpi-worker-tick/route.ts` (NEW, ~530 lignes) — worker GET/POST avec auth Bearer CRON_SECRET ou requireDeskOwner, cascade LLM Groq → Cerebras → Haiku, lecture étendue `sec-data/<cat>/<ticker>/`
- `vercel.json` — cron schedule `7 * * * *`
- `src/app/sandbox/kpi-builder/client.tsx` — auto-trigger 15s + bouton "Lancer maintenant"

**Limitation à noter** : `sec-data/` est dans `.vercelignore` (30 GB), donc le worker Vercel cron NE TROUVERA PAS de docs en prod. Stratégie pragmatique : Yann ouvre la page sur dev local → worker UI lit les docs locaux. Pour fix complet, ajouter fetch SEC EDGAR API direct dans le worker (extension future).

**Action immédiate après reprise** : CONV-CONCEPTS va committer + deploy ce refactor dès que CONV-SYSTEMS est de nouveau opérationnelle. Si tu veux le faire de ton côté, commit avec message "feat(kpi-worker): refactor Python → API serverless + cron Vercel + auto-trigger UI 15s".

---

## 🔧 État autres en cours

### CONV-DATA (broadcast 16:10 mai 17)

3 bugs DATA flagged par Yann :
1. **ASML R&D %** : unit mismatch (`unit="%"` mais history en USD bruts 10-32B). Re-extract pipeline LLM
2. **Nestlé NESN.SW** : Pass 3 non validé → afficher "Fiche en préparation" sur fiche. Soit valider Pass 3, soit documenter raison
3. **Search bar GOOG/GOOGL doublon** : ajouter alias TICKER_ALIASES "GOOG→GOOGL"

ETA target Yann : 2-3h, multi-agents OK.

### CONV trad i18n (broadcast SHARED-STATUS 14:35)

Conv "KPI adaptable (trad)" en cours de traduction des pages EN. Yann veut tout traduit d'ici 2-4h. Mon agent E a fixé : super-kpi.ts narratives + 8 dict keys + quality-badge tier + freshness-indicator + kpi-story-card (commits `1880a8a3` + `d791e719`). Reste pour trad conv : dataset events.description + signal + hero_kpi_rationale + super-kpi (déjà fait code, juste dataset names).

---

## 📝 .conv-state/CONV-SYSTEMS.md

Pour contexte long, lire le fichier `.conv-state/CONV-SYSTEMS.md` qui contient l'historique détaillé de ton travail (~quelques centaines de lignes). Sections clés :
- Captcha Cloudflare Turnstile désactivé (à réactiver après vérif config)
- Sections sté V1.8 absentes (TranscriptStories, KpiStories, etc.) — à investiguer
- Audit qualité KPIs top 21-50 fait, top 51-307 vérifié 0 modifs

---

## ⏰ Wakeup 5h40 et TODO-RAPPELS.md

Si le wakeup cron était programmé via CronCreate (session-only Claude Code), il est mort avec la conv. À reprogrammer dans la nouvelle session si pertinent.

Backup `TODO-RAPPELS.md` peut exister à la racine repo — vérifier.

---

## 🤝 Coordination convs

Quand tu fais une action visible, broadcast dans `SHARED-STATUS.md` log d'activité avec :
- Horodatage
- Signature `CONV-SYSTEMS`
- Action concrète
- Tagging des convs concernées (`🤝 @CONV-X`)

Acronymes Yann :
- PV = plus-value
- stés = sociétés
- DOB = Direct Objectif Bref (réponses ultra-courtes)
- V1 / V1.7 / V1.8 / V175 / V18 / V19 = versions de l'app
- wow / whaou = KPI distinctif
