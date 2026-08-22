# Reprise mission ATT - etat au 22 aout 2026, 23h00

## Ce qui est TERMINE (ne pas refaire)
- Verification adverse des 656 ATT : 7 982 controles, 1 767 affirmations fautives corrigees.
- 4 defauts systemiques fermes : chemins internes visibles, glossaires orphelins,
  notations internes attribuees a la societe, citations traduites presentees comme verbatim.
- 17 KPI faux corriges a la source dans .batches-drafts-safe/kpis-haut/ et src/data/v2-pipeline/.
- Audit mecanique de la base KPI (28 328 KPI) : le test yoy n'est pas concluant
  (aucune serie d'historique ne porte de periode datee). Test valeur vs dernier point : 9 ecarts,
  tous traites. NE PAS relancer d'audit KPI aveugle, c'est un cul-de-sac demontre.
- Nettoyage des rouages internes visibles dans les infobulles "Preuve et source" :
  jargon d'extraction, mentions data-lake/kpis-haut, noms de fichiers sources,
  identifiants techniques frequents, codes de series majuscules, notations de severite.
- Residuels lots 1 a 3 : 24 stes traitees (aca.pa -> crh).
- Tout est commite et pousse. Dernier commit : 409f82136d.

## Ce qui RESTE (dans l'ordre)

### 1. Residuels mineurs - 52 stes, 106 points
Fichier : .conv-state/att-residuels-restants.json  (dict {ticker: [points]})
Prompt agent pret : .conv-state/att-residuels-PROMPT.txt  (remplacer __TICKERS__ n'est pas utilise,
c'est __LOT__ qu'il faut remplacer par le chemin d'un fichier de lot).
Methode : decouper en lots de 8 stes, 2 agents en parallele maximum (contrainte RAM du Mac).

### 2. Identifiants techniques restants - 180 fiches, ~500 occurrences
Fichier : .conv-state/att-identifiants-restants.json  (dict {ticker: [{champ, codes}]})
Prompt agent pret : .conv-state/att-identifiants-PROMPT.txt  (meme mecanique __LOT__).
Ce sont des singletons qui demandent du jugement au cas par cas, pas scriptables.

### 3. Table Supabase desk_att - BLOQUE, action de Yann requise
La table public.desk_att n'existe pas (verifie : PGRST205). Tout le code applicatif est deja cable
(src/app/api/desk/att/route.ts, src/lib/att-server.ts, champ _fige). Sans la table, le figeage
des ATT est inactif.
Aucun acces DDL depuis le repo : pas de projet Supabase lie, pas de chaine postgres dans .env.local.
Yann doit coller le contenu de supabase/migrations/20260814_desk_att.sql dans l'editeur SQL Supabase.

## Contraintes de travail
- 2 agents en parallele maximum, le Mac a deja crashe sur des pics de RAM.
- Chaque prompt d'agent doit porter : INTERDIT rm, autres fichiers, navigateur, git, deploiement.
- Verifier les corrections d'agent contre les sources : un agent a deja invente des trimestres.
- Si une correction rend le bear case plus fort, l'appliquer quand meme.
- Pas de tiret cadratin, francais, vocabulaire non technique.
- Ne jamais toucher une fiche pendant qu'un agent travaille dessus (tenir une liste des fiches occupees).

## Chaine de deploiement (obligatoire avant de dire "fait")
npx tsc --noEmit
git add <fichiers precis>  (jamais git add -A : 5 602 changements de type parasites dans data-lake)
git commit && git push
npx vercel deploy --prod --archive=tgz --yes        (deploy est obligatoire, pas juste "vercel --prod")
npx vercel alias set <deployment> mettrik-niveau2.vercel.app
curl de verification
