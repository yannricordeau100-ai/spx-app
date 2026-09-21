# Copie de la memoire permanente de Claude, Mettrik

Copie faite le 21 septembre 2026, pour qu un changement de compte Claude, ou un
changement de machine, ne fasse perdre aucune regle.

L original vit dans `~/.claude/projects/-Users-yann/memory/` sur le Mac de Yann.
Ce dossier est attache a l utilisateur macOS et au chemin du projet, PAS au
compte Claude : une autre session Claude lancee sur la meme machine, dans le
meme dossier, lit donc les memes fiches, quel que soit le compte.

Sur une AUTRE machine, rien de tout cela n est present. C est la raison d etre
de cette copie : `INDEX.md` est la table des matieres (l original s appelle
MEMORY.md), chaque fichier est une regle ou un etat de chantier.

Pour restaurer sur une machine neuve :

    mkdir -p ~/.claude/projects/-Users-yann/memory
    cp docs/memoire-claude/*.md ~/.claude/projects/-Users-yann/memory/
    mv ~/.claude/projects/-Users-yann/memory/INDEX.md ~/.claude/projects/-Users-yann/memory/MEMORY.md
    rm ~/.claude/projects/-Users-yann/memory/LISEZ-MOI.md

A lire en premier de toute facon : `docs/REPRISE-2026-09-21.md`.
