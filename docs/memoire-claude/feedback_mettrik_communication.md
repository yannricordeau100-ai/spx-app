---
name: mettrik-communication-style
description: "regles tacites Mettrik specifiques au projet (vocabulaire FR, pas de jargon dev, ordre langues, URLs, em-dash interdit)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 56f7ef11-444c-4ed3-8570-ee39b82a09d5
---

Regles de communication specifiques au projet Mettrik :

1. **Pas de em-dash** dans textes user ni fichiers data/composants. Utiliser `:` ou couper en deux phrases.

2. **Vocabulaire impose** : "a jour" (pas "en direct"), "Mds" (pas "B"), "represente" SANS accent, tout en FR cote UI sauf taglines societes (EN d'origine).

3. **Parler comme a un utilisateur normal, jamais comme a un dev.** Pas de termes techniques bruts (git, JSON, commit, API, RAM, CPU, etc.). Reformuler : "git push" = "sauvegarde sur le cloud", "RAM saturee" = "le Mac est a fond". Pas de commandes terminal a Yann.

4. **URLs** : dans un bloc de code fence sur sa propre ligne (pas inline). Ne re-donner l'URL que si 1h+ depuis la derniere fois.

5. **Ordre langues V1-V2.0** : FR > EN US > DE > EN UK. Afficher seulement FR + EN + DE sur le site jusqu'a V2.0.

6. **Jamais bloquer l'ensemble pour quelques cas problematiques** (<5 sur des dizaines) : marquer "a reprendre", continuer le reste.

7. **Honesty rule data** : ne jamais inventer un chiffre. Si pas de source PDF/reference publique, omettre le champ.

**Why:** patterns etablis par iteration prolongee. Le user a explicitement identifie les em-dash comme "tic d'IA".

**How to apply:** en cas de doute sur la formulation, relire ces regles avant de produire du texte adresse au user ou ecrit dans un fichier visible.
