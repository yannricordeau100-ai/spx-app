# Mission : sortir toutes les taches recurrentes du quota Claude (23 sept 2026)

## Pourquoi
Yann possede deux comptes Max 20x et SWITCHE de compte dans l application Mac.
Il n utilise jamais les deux en meme temps. La facturation suit le compte
CONNECTE AU MOMENT de l execution, pas celui qui a ecrit le prompt. Consequence
observee la semaine du 20 au 22 septembre : 864 M de tokens demandes depuis un
compte ont ete factures a l autre, simplement parce que la session et ses agents
tournaient encore apres le changement de compte.

## Regle permanente qui en decoule (a respecter par les deux comptes)
1. Avant de lancer quoi que ce soit, verifier `/status` : le compte affiche est
   celui qui paiera.
2. Ne jamais laisser une session longue ou des agents en cours quand Yann change
   de compte : terminer ou arreter avant.
3. Aucune tache AUTOMATIQUE (cron, launchd, veille, rafraichissement) ne doit
   appeler Claude, car elle tomberait sur le compte connecte au hasard du moment.

## Travail a faire
Quatre scripts appellent encore `claude -p` et doivent passer sur Cerebras avec
repli Groq, comme les 59 scripts Cerebras et 15 Groq deja en place. Reutiliser
exactement le meme client que les scripts existants (rotation des trois cles
Cerebras, repli Groq Llama 3.3 70B, aucune cle Anthropic).

| Script | Declencheur | Appels a remplacer |
|---|---|---|
| scripts/earnings-refresh.sh | launchd ai.mettrik.earnings-refresh, 23h00 | 3 |
| scripts/summaries-refresh.py | quotidien | 1 |
| scripts/catalogue-comparabilite.py | ponctuel | 1 |
| scripts/signaux-150.py | ponctuel | 1 |

Pour chacun :
1. Identifier ce que fait l appel Claude (extraction, redaction, arbitrage) et le
   porter sur Cerebras, repli Groq si quota ou erreur, avec les memes garde-fous
   qu aujourd hui (jamais de valeur inventee, garde-fou d echelle et d unite,
   verification des series avant ecriture).
2. Garder un mode secours manuel : si les deux moteurs gratuits echouent, le
   script ECRIT UN BROUILLON dans .conv-state et n ecrit rien dans src/data, puis
   signale le brouillon a traiter. Jamais d appel Claude automatique.
3. Tester a blanc sur trois societes, comparer avant et apres, puis activer.
4. Verifier ensuite que plus aucun script lance par launchd n appelle Claude :
   `grep -rln "claude -p\|claude --print\|npx claude" scripts/` doit ne rien
   renvoyer pour les scripts references dans ~/Library/LaunchAgents.

## Livrable attendu
Tableau des quatre scripts avec moteur retenu, resultat de l essai a blanc, et
confirmation que la commande de verification ne renvoie plus rien.
