# Handoff vers une nouvelle conversation Claude Code

## Procédure (3 étapes — 30 secondes)

### 1. Ouvrir une nouvelle session Claude Code dans ce dossier

```bash
cd ~/spx-app
claude       # ou ton raccourci habituel pour lancer Claude Code
```

Claude lit automatiquement `CLAUDE.md` au démarrage. Tout le contexte
(stack, conventions, vocabulaire, données, todo, règles d'honnêteté,
préférences, état actuel du travail) y est consigné.

### 2. Coller ce **kickstart prompt** dans le premier message

> Salut. Je reprends Mettrik — l'app KPI Intelligence pour investisseurs.
> Le contexte complet est dans `CLAUDE.md` (déjà chargé). Lis-le entièrement
> avant de répondre.
>
> Là où on s'est arrêté : on travaille sur la **refonte 3D des charts du hero**
> (Curve, Bars, Variation). Mon attente précise est documentée dans la section
> "CURRENT STATE / WHERE WE LEFT OFF" de CLAUDE.md.
>
> Ne refais pas ce qui marche déjà. Ne réinvente pas mes décisions (nom Mettrik,
> 5 sociétés, 3 variantes, vocabulaire FR sans em-dash, règles d'honnêteté data).
> Réponds court quand mon prompt est court. Vas-y direct, pas de récap inutile.
>
> Premier livrable que j'attends : montre-moi ta proposition pour le
> "face → top-right tilt" 3D camera animation pour le chart Bars (à l'écran sur
> /googl). Une seule itération, je donnerai mon feedback.

### 3. Reprendre le travail

Claude exécutera. Si tu as besoin de relire l'historique : tout est dans
`CLAUDE.md` + `git log` (commit "v1 handoff snapshot" figé à cet instant).

---

## En cas de problème

| Symptôme | Action |
|---|---|
| Claude ignore les règles tacites | Pointe-le vers la section §6 de CLAUDE.md |
| Claude veut refaire une décision | "Lis §10 de CLAUDE.md, ne renomme pas/réécris pas" |
| Claude invente des chiffres | "Règle d'honnêteté §2 : si pas de source PDF, skip" |
| Le serveur dev est down | `cd ~/spx-app && npm run dev` |
| Mobile inaccessible | Vérifie que `192.0.0.2` (ou IP hotspot actuelle) est dans `next.config.ts` |

---

## Ce que la nouvelle session NE saura PAS automatiquement

(donc à mentionner explicitement si tu en as besoin) :

- Le fait que tu prépares une démo aux fondateurs de **baggr.fr** et **iq-invest**
- Le budget V2 plafonné à **$150**
- Le domaine `mettrik.ai` est acheté chez **Spaceship**
- Tu as testé `kpulse.ai` (rejeté), `pulsair.ai` (TM USA bloquant), `pulsato`
  (italien — tu n'as pas validé), `pulzy` (français-mauvais), avant de choisir
  Mettrik
- L'app a tourné sous `localhost:3000` puis brièvement sous tunnels
  (cloudflared, localtunnel, serveo) que tu as fait annuler — pas de tunnel par
  défaut désormais

Si la nouvelle conversation a besoin de cette info, dis-le simplement.

---

## Fichiers d'ancrage

- `CLAUDE.md` (auto-chargé) — règles, état, vocabulaire, structure
- `HANDOFF.md` (ce fichier) — procédure de reprise
- `AGENTS.md` — note sur Next.js (déprécié, garde par compat)

Bonne reprise.
