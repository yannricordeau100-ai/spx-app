# CONV-MODULE-LOGOS-V175 · État & Plan

> Démarrée par Yann le 2026-05-18 (bascule depuis CONV-MODULE-UI-AUDIT).
> Module au scope étroit : correction des logos faux sur l'univers V1.7.5
> (~700 stés, V1.7 ∪ V1.8 ∪ V1.7.5 dédupliqué).

---

## 1. Scope strict (ne pas dévier)

**Fichiers que je peux écrire SANS broadcast** :
- `scripts/audit-logos.ts` (nouveau)
- `scripts/fetch-logo-from-source.ts` (nouveau)
- `src/data/v175-logos-audit.json` (nouveau)
- `public/logos/*.png` (replacement uniquement, après vérif visuelle)
- `SHARED-STATUS.md` (broadcasts uniquement)
- `.conv-state/CONV-MODULE-LOGOS-V175.md` (ce fichier)

**Je NE TOUCHE JAMAIS** :
- `src/data/v2-pipeline/` (CONV-DATA scope)
- `src/components/company-header.tsx` (CONV-CONCEPTS scope)
- `src/components/logos.tsx` (CONV-CONCEPTS scope, SVG custom)
- Code rendu / résolution path logo (sauf si broadcast)
- Aucun push prod, aucun deploy Vercel

**Règles globales** : pas d'em-dash, FR strict, DOB, commits locaux,
Mac fragile (pas de download massif en parallèle).

---

## 2. Convention logos identifiée (à confirmer)

- Format : PNG uniquement (1638 fichiers actuellement)
- Naming : ticker avec `.` remplacé par `-`
  - `TTE.PA` → `TTE-PA.png`
  - `9984.T` → `9984-T.png`
  - `005930.KS` → `005930-KS.png`
  - `AAPL` → `AAPL.png`
- Path : `public/logos/<TICKER>.png` (résolu côté frontend)
- Logo_treatment dans dataset : `orbit` (TTE.PA exemple), autres à explorer

---

## 3. Critères de détection "faux logo"

Heuristiques à valider sur échantillon :
1. **Taille fichier < 2 KB** : probablement un favicon récupéré au lieu du logo
2. **Dimensions < 64×64 px** : trop petit pour rendu Mettrik
3. **Ratio extrême** (largeur/hauteur < 0.3 ou > 3.5) : icon vs logo
4. **Hash dupliqué** : 2+ stés avec exactement le même fichier (= placeholder)
5. **Couleur dominante = blanc/transparent uniquement** : probablement vide/cassé

---

## 4. Sources logos fiables candidates (à valider)

### Globales
- **Clearbit Logo API** (`https://logo.clearbit.com/<domain>`) : gratuit, ~80 % coverage
- **Brandfetch** (`https://brandfetch.io/<domain>`) : meilleure qualité, freemium
- **Wikipedia Commons** : logos officiels libres de droit (recherche par nom sté)
- **Logo.dev** (`https://img.logo.dev/<domain>?token=...`) : freemium 10k/mo gratuit

### Par pays (fallback)
- **FR** : sites IR officiels (TotalEnergies, LVMH, etc.) ; Euronext fact sheets
- **DE** : Deutsche Börse, IR sites Frankfurt
- **JP** : TSE company directory, IR sites japonais
- **UK** : LSE company info, IR sites
- **CH** : SIX Swiss Exchange listings
- **Nordics** : Nasdaq Nordic, sites IR
- **CN/HK** : HKEX, IR sites
- **AU** : ASX, IR sites

Stratégie : tester Clearbit d'abord (largeur de couverture), Brandfetch
en fallback (qualité), Wikipedia Commons en dernier recours (officiel).

---

## 5. Plan de travail

### Phase 1 (30-45 min) · Inventaire + sourcing
- [ ] Script `scripts/audit-logos.ts` : scanne `public/logos/`, calcule taille/hash/dimensions, cross-référence avec V1.7/V1.8/V1.7.5 datasets
- [ ] Output `src/data/v175-logos-audit.json` : suspects par code (TINY, DUPLICATE_HASH, BAD_RATIO, MISSING)
- [ ] Tester Clearbit/Brandfetch/Wikipedia sur 5 stés témoins (TTE.PA, 9984.T, ASML, MSCI, GOOGL)
- [ ] Identifier 3 sources les + fiables par taux de réussite

### Phase 2 · Sourcing automatisé (durée variable)
- [ ] Script `scripts/fetch-logo-from-source.ts` : pour chaque suspect, télécharge depuis source fiable, sauvegarde en `public/logos/<TICKER>.png.candidate`
- [ ] Audit qualité du candidate (taille, dimensions, hash diff avec ancien)
- [ ] Si OK, replace l'ancien par le candidate

### Phase 3 · Validation
- [ ] Re-audit post-replacement
- [ ] Compte stés fixées vs encore suspectes
- [ ] Broadcast résultats SHARED-STATUS

---

## 6. Pings à surveiller

- @CONV-CONCEPTS : si elle touche aux logos en parallèle (route `logo-lab` existante)
- @CONV-SYSTEMS : si page admin Logo coverage matrice
- @CONV-DATA : éventuel field `logo_url` à ajouter aux datasets

---

## 7. État

Phase 1 démarrée le 2026-05-18. Aucun commit logos pour l'instant.
