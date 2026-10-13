/**
 * Tri en memoire de PostgreSQL, porte a l identique (13 oct 2026).
 *
 * Source : src/include/lib/sort_template.h (Bentley et McIlroy, tri par
 * insertion sous 7 elements, controle « deja trie », mediane de trois).
 * Sert a reproduire EXACTEMENT l ordre qu une requete « ORDER BY colonne »
 * donnait aux lignes de meme valeur, a partir des lignes lues dans l ordre
 * physique de la table (lecture sans ORDER BY). Utilise par tables-fiche.ts :
 * l ordre des graphiques moyen terme d une fiche reste celui d avant la mise
 * en cache de la table (verifie sur les 60 societes concernees, 13 oct 2026).
 */
export function triPostgres<T>(tab: T[], cmp: (a: T, b: T) => number): T[] {
  const a = tab.slice();
  const swap = (i: number, j: number) => { const t = a[i]; a[i] = a[j]; a[j] = t; };
  const swapn = (i: number, j: number, n: number) => { for (let k = 0; k < n; k++) swap(i + k, j + k); };
  const c = (i: number, j: number) => cmp(a[i], a[j]);
  const med3 = (x: number, y: number, z: number) =>
    c(x, y) < 0 ? (c(y, z) < 0 ? y : c(x, z) < 0 ? z : x) : c(y, z) > 0 ? y : c(x, z) < 0 ? x : z;
  const trie = (debut: number, n0: number): void => {
    let base = debut, n = n0;
    for (;;) {
      if (n < 7) {
        for (let pm = base + 1; pm < base + n; pm++) for (let pl = pm; pl > base && c(pl - 1, pl) > 0; pl--) swap(pl, pl - 1);
        return;
      }
      let presorted = true;
      for (let pm = base + 1; pm < base + n; pm++) if (c(pm - 1, pm) > 0) { presorted = false; break; }
      if (presorted) return;
      let pm = base + Math.floor(n / 2);
      if (n > 7) {
        let pl = base, pn = base + n - 1;
        if (n > 40) { const d = Math.floor(n / 8); pl = med3(pl, pl + d, pl + 2 * d); pm = med3(pm - d, pm, pm + d); pn = med3(pn - 2 * d, pn - d, pn); }
        pm = med3(pl, pm, pn);
      }
      swap(base, pm);
      let pa = base + 1, pb = pa, pc = base + n - 1, pd = pc;
      for (;;) {
        let r: number;
        while (pb <= pc && (r = c(pb, base)) <= 0) { if (r === 0) { swap(pa, pb); pa++; } pb++; }
        while (pb <= pc && (r = c(pc, base)) >= 0) { if (r === 0) { swap(pc, pd); pd--; } pc--; }
        if (pb > pc) break;
        swap(pb, pc); pb++; pc--;
      }
      const pn = base + n;
      let d1 = Math.min(pa - base, pb - pa); swapn(base, pb - d1, d1);
      d1 = Math.min(pd - pc, pn - pd - 1); swapn(pb, pn - d1, d1);
      d1 = pb - pa; const d2 = pd - pc;
      if (d1 <= d2) {
        if (d1 > 1) trie(base, d1);
        if (d2 > 1) { base = pn - d2; n = d2; continue; }
        return;
      } else {
        if (d2 > 1) trie(pn - d2, d2);
        if (d1 > 1) { n = d1; continue; }
        return;
      }
    }
  };
  trie(0, a.length);
  return a;
}
