# i18n pipeline · Mettrik AI

Stratégie de traduction FR ↔ EN pour le dataset (V1 = 5 sociétés, V2 = ~3000
sociétés). But : ne JAMAIS traduire à la main 3000 fiches × 4 blocs textuels.

## 1. Source de vérité = anglais (SEC EDGAR / ER)

Toutes les sociétés couvertes (US large-cap V1 + S&P 500 + Russell 1000 +
ADR + Stoxx 600 V2) déposent en **anglais** auprès de la SEC ou de l'autorité
locale. Le pipeline d'extraction (`sec-data/`) lit ces 10-K / 10-Q / 8-K en
anglais. **L'anglais est donc la langue source par construction.**

**Conséquence** : tous les champs textuels du JPI (`signal`, `description`,
`risks[].title/quote/rationale`, `ai_positioning.summary/evidence`,
`governance.voting_structure/notes`, `kpi.name_fr`/`name_en`,
`kpi.explanation`) sont d'abord générés en EN, puis traduits en FR.

## 2. Schéma JSON bilingue

```ts
// Avant (V1 monolingue FR)
type KPI = {
  name_fr: string;
  name_en?: string;        // optionnel
  explanation: string;     // FR
  signal: string;          // FR
  description: string;     // FR
  ...
};

// Après (V2 bilingue obligatoire)
type LocalizedString = { fr: string; en: string };
type KPI = {
  name: LocalizedString;        // remplace name_fr/name_en
  explanation: LocalizedString;
  signal: LocalizedString;
  description: LocalizedString;
  ...
};
```

Le composant lit `kpi.name[locale]` directement. Plus jamais de
`locale === "en" ? x.name_en : x.name_fr` dans la JSX.

## 3. Pipeline d'ingestion (V2)

```
SEC EDGAR (EN) → pdftotext / sec-api (EN) → LLM extraction (EN) → 
                                            ↓
                             company.<TICKER>.en.json (champs EN bruts)
                                            ↓
                                    LLM batch translate
                                            ↓
                             company.<TICKER>.json (bilingue {fr, en})
```

### LLM choisi : **Groq + Llama 3.3 70B** (free tier ≈ 14 400 req/jour)

- Vitesse : 250-300 tokens/s (vs OpenAI 50 t/s, DeepL 80 t/s)
- Qualité : Llama 3.3 70B traduit le vocabulaire financier mieux que DeepL
  (testé sur "10-K boilerplate", "non-GAAP measure", "deferred revenue")
- Coût : free tier suffit pour 3000 sociétés × 4 blocs × ~200 tokens =
  ~2.4M tokens, soit ~7 minutes de batch sur free tier
- Si free tier saturé (concurrence avec extraction) : Groq pay = $0.59/M
  tokens en input, $0.79/M en output → coût total ~$3 max pour les 3000

### Pourquoi pas DeepL / Google Translate

User a explicitement banni : « DeepL n'est pas le meilleur pour traduire ».
Vrai pour le jargon financier : DeepL traduit "earnings call" en
"appel de résultats" (faux) au lieu de garder "earnings call" en italique.
Llama 3.3, briefé avec un prompt strict (« garder anglicismes financiers
courants en italique »), respecte la convention Mettrik.

### Prompt template (à versionner dans `scripts/translate.ts`)

```
Tu es traducteur financier FR↔EN pour Mettrik AI, app KPI investisseurs.
Règles strictes :
1. Garde anglicismes financiers usuels en italique (earnings call, 
   guidance, run rate, backlog, net retention).
2. Pas d'em-dash (—) en FR : utiliser ":" ou couper en 2 phrases.
3. Pour les % et montants, format français (espace insécable, virgule
   décimale) en FR, format US (virgule millier, point décimal) en EN.
4. "B" = "Mds" en FR, "B" en EN (pour milliards de $).
5. Conserver tous les nombres EXACTEMENT identiques.
6. Ne jamais ajouter ni retirer de fact ; seulement traduire.

Source ({{source_lang}}) : {{text}}
Cible ({{target_lang}}) : 
```

### Cache + incrémental

```
sec-data/translations/
  <TICKER>.<hash>.json    # hash du champ source pour éviter re-trad
```

Si le champ source EN change (mise à jour 10-Q), seul ce champ est
re-traduit. Les ~95 % stables d'un trimestre à l'autre restent en cache.

## 4. Migration V1 → V2

V1 actuel : 5 sociétés écrites à la main, 100 % FR avec quelques `name_en`
optionnels. Pour passer au schéma bilingue sans re-tout-écrire :

1. Script `scripts/i18n-migrate-v1.ts` :
   - Lit chaque JSON `src/data/<ticker>.json`
   - Pour chaque champ texte : appelle Groq pour générer la version EN
   - Réécrit le JSON au format `LocalizedString`
2. Dry-run d'abord (`--dry`) pour audit humain
3. Run `--apply` une fois validé

Effort : ~30 min de batch Groq + 30 min de relecture humaine = 1h pour
les 5 sociétés. Puis le V2 ingère déjà bilingue par défaut.

## 5. UI strings (≠ data strings)

Les strings UI (boutons, labels, tooltips) restent dans
`src/lib/i18n/dictionary.ts` traduites à la main : ~300 entrées au total,
gérables. Pas de LLM ici (qualité doit être parfaite, pas de variabilité).

## 6. Roadmap

- **V1.5** : migration des 5 JSON existants au schéma bilingue (1h batch).
- **V2.0** : extraction SEC produit nativement bilingue (pipeline ci-dessus).
- **V2.1** : cache de traduction + diff incrémental sur 10-Q.
- **V3** : ajouter ES / DE / IT / ZH-Hans selon demandes investisseurs ; le
  pipeline est déjà multi-locales (`LocalizedString` étendu).

## 7. Coûts cumulés V2

| Poste | Volume | Modèle | Coût |
|---|---|---|---|
| Extraction 10-K → JSON | 3000 × 50k tokens | Groq Llama 3.3 70B | $0 (free) ou ~$110 |
| Traduction EN→FR | 3000 × 4 × 200 tokens | Groq Llama 3.3 70B | ~$3 |
| **Total V2 launch** | | | **< $115** (sous le cap $150) |

## 8. Coordination

Pipeline sous périmètre **CONV-DATA** (sec-data/, scripts d'extraction).
Schéma bilingue sous périmètre **CONV-SYSTEMS** (i18n) pour les types et
**CONV-BRAND** (data) pour la qualité du wording. Coordonner via
SHARED-STATUS.md avant la migration V1.5.
