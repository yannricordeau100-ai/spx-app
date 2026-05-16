# Résiduels 0,5 % audit Playwright (irréductibles sans refonte)

## A. FPI ADR multi-listing aliases (11 stés) — meta.title_with_company

Stés : **ASMLF, ABBNY, ABLZF, DTEGY, ADTTF, BBVXF, BPAQF, BP.L, BCLYF, NDA-DK.CO, EDPFY**

Cause : `load-company.ts` ALIASES redirige le ticker visité vers le canonical
(ex ASMLF → ASML). Le title HTML contient donc le nom canonical (ASML Holding)
mais pas l'alias du ticker visité (ASMLF). Le bot teste si le title contient
le ticker visité → fail logique mais c'est le comportement attendu (un seul
dataset, plusieurs URLs aliasées).

Solution structurelle (non implémentée) : afficher l'alias dans le title si
URL différente du canonical, mais ça crée 2× plus de pages dans le sitemap
SEO sans valeur ajoutée investisseur. Décision : **garder le comportement actuel,
calibrer le bot pour ignorer ces 11 stés**.

## B. V1 demo logos SVG hardcodés (5 stés) — header.logo_present

Stés : **GOOGL, META, MSCI, SPGI, CAT**

Cause : ces 5 stés V1 demo utilisent des logos SVG hardcodés dans
`src/components/logos.tsx` (CompanyLogo avec switch sur ticker) au lieu du
`/logos/<ticker>.png`. Le bot cherche `img[src*='/logos/']` → ne les trouve
pas. Agent J a ajouté `data-logo='true'` sur LogoTilt qui couvre tous les
cas hors V1 demo, mais le bot peut encore rater ces 5 cas spécifiques.

Solution : ajouter `data-logo='true'` aussi sur CompanyLogo SVG (composant
`src/components/logos.tsx`). À faire si le bot ne les détecte toujours pas
après le redéploi.

## C. EIPAF + MRSH 500 SSR — à investiguer collaborativement

2 stés crashent server-side. Pas accessible via curl HTML (auth gate
redirect). Besoin du stack trace Vercel runtime via dashboard, ou test
local via `npm run dev` pour bisect le composant fautif. Une fois trouvé,
fix template-level qui couvre les futures stés avec même profil data.

Statut : signalé dans SHARED-STATUS pour investigation conjointe
CONV-CONCEPTS + CONV-DATA. Pas bloquant pour les 838 autres stés.

## D. Stés avec yoy="N/A" légitime mais value non-numérique

Cas potentiels : `value="N/A"` AND `yoy="N/A"` → vrai KPI placeholder.
Mon fix `heroKpiUsable` tolère yoy="N/A" SI value est number. Si value
aussi N/A → reste rejeté (comportement OK, placeholder vraiment vide).

Aucune sté connue dans ce cas actuellement, mais le code est défensif.

## E. Faux-positifs bot subsector résiduels (~20-50 stés estimé après v3 calibration)

Bot pattern v3 : "LABEL UPPERCASE #N". Couvre la majorité mais pourrait
rater :
- Stés sans chip rang sous-secteur du tout (data manquante côté `ranks.subsector`)
- Stés où le label est en minuscule (rare)

Mesure exacte au prochain audit V1.8 (après deploy commit `3f2af36a`).
