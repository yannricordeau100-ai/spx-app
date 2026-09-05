/**
 * Numero de version affiche dans le badge de niveau (n2 / n0), 5 sept 2026.
 * Regle : chaque push sur staging incremente ce numero et ajoute une entree
 * dans CHANGELOG.md (scripts/version-bump.sh "resume"). Format :
 * AAAA.MM.JJ.n ; la mise en ligne n0 reprend le numero du n2 promu.
 */
export const VERSION = "2026.09.05.35";
