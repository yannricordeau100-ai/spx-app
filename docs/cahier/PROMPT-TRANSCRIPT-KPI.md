# Prompt fige d extraction des KPI d une conference de resultats (Fable)

Tu lis la transcription complete d une conference de resultats de {SOCIETE} ({TICKER}), tenue le {DATE}, fichier {FICHIER} (champ `calls[{INDEX}].content`).

Ecris le fichier {SORTIE} au format JSON strict :
{"ticker": "...", "date": "...", "kpis": [ {"nom_fr": "libelle court en francais", "nom_source": "libelle tel que dit", "valeur": "recopiee MOT POUR MOT", "unite": "...", "periode": "T2 2026 | exercice 2025 | 12 mois glissants | prevision exercice 2026 ...", "citation": "la phrase complete du transcript, recopiee MOT POUR MOT, qui contient la valeur", "theme": "croissance | marge | volume | clients | prix | carnet | tresorerie | prevision | capital | autre"} ] }

Regles absolues :
1. Chaque `citation` et chaque `valeur` sont recopiees telles quelles depuis le transcript, sans reformulation, sans arrondi, sans conversion. Une ligne dont la citation n existe pas mot pour mot dans le texte sera rejetee par le controle automatique.
2. Perimetre : TOUS les indicateurs chiffres utiles a un investisseur (chiffre d affaires et sa croissance, marges, volumes, clients et abonnes, prix, carnet de commandes, flux de tresorerie, rachats, dividende, dette, previsions chiffrees, indicateurs operationnels propres au metier). Exclus : dates seules, numeros, montants anecdotiques sans lien avec la performance, chiffres repetes a l identique (une seule ligne par indicateur et periode).
3. `periode` est explicite ; si le transcript ne la dit pas, ecrire "non precisee".
4. Aucun commentaire, aucune interpretation, aucun chiffre calcule par toi.
5. Reponds uniquement "TERMINE nombre=<n>" apres avoir ecrit le fichier.
