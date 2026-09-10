# Mode d emploi (pour Yann) : confier une mission à ChatGPT ou Grok

L IA externe ne voit pas le Mac toute seule. Deux cas :

1. Application avec accès aux fichiers (ChatGPT Desktop avec le dossier ~/spx-app autorisé, ou un agent qui a le disque) : colle le contenu de `PROMPT-A-COLLER.md`, c est tout ; elle ouvrira MISSION.md et les fichiers du dossier.
2. Sans accès aux fichiers (site web, appli mobile) : colle le prompt ET joins les fichiers du dossier `externe/` (MISSION.md, societes-a-traiter.json, identification-deja-faite.json, valide.py, le dossier exemples). Elle rendra ses résultats en pièces jointes ou en blocs de texte, avec les noms de fichiers demandés ; tu les déposes ensuite dans `docs/cahier/produit-phare/externe/sorties/` et je fais l étape 4 (pose) en quelques minutes.

Même principe pour le kit support : prompt en fin de `docs/cahier/support/MISSION-KIT-SUPPORT.md`, fichier joint si pas d accès disque ; le kit revient dans `kits/support/<nom-ia>/`.

L adresse support@mettrik.ai est déjà écrite dans le document du kit.
