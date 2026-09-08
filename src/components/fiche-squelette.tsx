/**
 * Squelette de chargement d une fiche societe (8 sept 2026, chantier lenteur).
 * Affiche IMMEDIATEMENT (loading.tsx des routes /<ticker> et
 * /sandbox/v1-9-5/<ticker>) pendant que le serveur assemble la fiche : le clic
 * depuis l accueil ou la barre de recherche donne un retour instantane au lieu
 * d une page figee 2 a 6 s. Forme fidele a la fiche : bandeau, en-tete, hero
 * (chiffre + graphe), tableau des indicateurs.
 */
export function FicheSquelette() {
  const bloc = "animate-pulse rounded-xl bg-white/[0.05]";
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100" aria-busy="true" aria-label="Chargement de la fiche">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <div className="flex items-center justify-between">
          <div className={`h-9 w-64 ${bloc}`} />
          <div className={`h-9 w-40 ${bloc}`} />
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className={`size-16 shrink-0 ${bloc}`} />
          <div className="flex-1">
            <div className={`h-8 w-72 ${bloc}`} />
            <div className={`mt-2 h-4 w-48 ${bloc}`} />
          </div>
          <div className={`h-14 w-56 ${bloc}`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`h-7 w-28 ${bloc}`} />
          ))}
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className={`h-4 w-32 ${bloc}`} />
            <div className={`mt-3 h-16 w-52 ${bloc}`} />
            <div className={`mt-3 h-6 w-40 ${bloc}`} />
            <div className={`mt-6 h-40 w-full ${bloc}`} />
          </div>
          <div className={`h-[380px] lg:col-span-8 ${bloc}`} />
        </div>
        <div className="mt-10 grid gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-14 w-full ${bloc}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
