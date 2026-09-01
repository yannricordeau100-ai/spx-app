/**
 * Concepts : 3 propositions de mise en page MOBILE du bloc graph (Yann 2 sept 2026).
 * Maquettes statiques (chart factice), a comparer sur telephone :
 *   /concepts/graph-mobile
 * A = ce qui est en ligne (menu Reglages + graph + valeur/texte cote a cote)
 * B = graph bord a bord, controles reduits en dessous, valeur fusionnee au titre
 * C = carte unique, gros chiffre a cote du titre, onglets en bas de carte
 */

export const metadata = { title: "Concepts · Graph mobile · Mettrik AI" };

function FauxChart({ h = 150 }: { h?: number }) {
  const bars = [42, 55, 48, 52, 60, 45, 58, 63, 50, 68, 72, 66, 78, 84, 90];
  return (
    <svg viewBox="0 0 340 110" style={{ width: "100%", height: h }} aria-hidden>
      {bars.map((v, i) => (
        <rect key={i} x={8 + i * 22} y={104 - v} width={13} height={v} rx={2.5} fill="#2563eb" />
      ))}
      <text x={8} y={12} fontSize={9} fill="#a1a1aa" fontFamily="monospace">Mds €</text>
      {[0, 4, 8, 12].map((i) => (
        <text key={i} x={12 + i * 22} y={109} fontSize={7.5} fill="#a1a1aa" fontFamily="monospace">T{(i % 4) + 1}</text>
      ))}
    </svg>
  );
}

function Pill({ children, actif = false }: { children: React.ReactNode; actif?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
        actif ? "border-violet-400/60 bg-violet-500/15 text-zinc-100" : "border-white/10 bg-white/[0.03] text-zinc-400"
      }`}
    >
      {children}
    </span>
  );
}

export default function GraphMobileConcepts() {
  return (
    <div className="min-h-screen bg-[#050507] px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-md space-y-10">
        <header>
          <h1 className="text-[22px] font-bold">Bloc graph mobile : 3 propositions</h1>
          <p className="mt-1 text-[13px] text-zinc-400">
            À comparer sur téléphone. A est déjà en ligne ; B et C sont des pistes pour aller plus loin en lisibilité.
          </p>
        </header>

        {/* ── A : en ligne ─────────────────────────────────────────── */}
        <section>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-violet-300">Proposition A · en ligne aujourd&apos;hui</h2>
          <div className="rounded-2xl border border-[#222] bg-gradient-to-b from-[#0b0e1a] to-[#080808] p-4">
            <div className="mb-2 flex flex-wrap justify-center gap-2">
              <Pill actif>⚙ Réglages ▾</Pill>
              <Pill>Par an ▾</Pill>
              <Pill>▮ ∿ ↗</Pill>
              <Pill>⇪</Pill>
            </div>
            <div className="text-center text-[17px] font-semibold">Prises de commandes</div>
            <FauxChart />
            <div className="mt-3 flex items-start gap-3">
              <div className="w-[45%] space-y-1.5">
                <div className="font-display text-[26px] font-bold">27,9 <span className="text-[13px] font-normal text-zinc-400">Mds €</span></div>
                <Pill actif>↗ +12,9 %</Pill>
                <Pill>Bon</Pill>
                <Pill>+10,8 %/an</Pill>
              </div>
              <div className="w-[52%] rounded-xl border border-[#1a1a1a] bg-[#070707] p-3 text-[12px] leading-relaxed text-zinc-300">
                Les prises de commandes sont le premier chiffre de chaque communiqué Siemens et le meilleur indicateur avancé du groupe.
              </div>
            </div>
          </div>
        </section>

        {/* ── B : graph bord à bord ───────────────────────────────── */}
        <section>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-cyan-300">Proposition B · graph bord à bord</h2>
          <div className="overflow-hidden rounded-2xl border border-[#222] bg-[#080808]">
            <div className="flex items-baseline justify-between px-4 pt-3">
              <div>
                <div className="text-[15px] font-semibold leading-tight">Prises de commandes</div>
                <div className="font-display text-[24px] font-bold leading-tight">27,9 <span className="text-[12px] font-normal text-zinc-400">Mds €</span> <span className="text-[13px] font-semibold text-emerald-400">+12,9 %</span></div>
              </div>
              <Pill>⇪</Pill>
            </div>
            <div className="-mx-1">
              <FauxChart h={170} />
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2">
              <div className="flex gap-1.5">
                <Pill actif>▮</Pill>
                <Pill>∿</Pill>
                <Pill>↗</Pill>
              </div>
              <div className="flex gap-1.5">
                <Pill>Trim.</Pill>
                <Pill actif>5 ans</Pill>
                <Pill>⚙</Pill>
              </div>
            </div>
            <div className="px-4 pb-4 pt-2 text-[12px] leading-relaxed text-zinc-300">
              Les prises de commandes sont le premier chiffre de chaque communiqué Siemens et le meilleur indicateur avancé du groupe.
            </div>
          </div>
          <p className="mt-1.5 text-[11.5px] text-zinc-500">+ de place pour le graph, le chiffre colle au titre, barre d&apos;actions unique en bas.</p>
        </section>

        {/* ── C : carte unique, chiffre à côté du titre ───────────── */}
        <section>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-amber-300">Proposition C · lecture en Z</h2>
          <div className="rounded-2xl border border-[#222] bg-[#080808] p-4">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold">Prises de commandes</div>
              <div className="text-right">
                <div className="font-display text-[22px] font-bold leading-none">27,9 <span className="text-[11px] font-normal text-zinc-400">Mds €</span></div>
                <div className="text-[12px] font-semibold text-emerald-400">↗ +12,9 % vs N-1</div>
              </div>
            </div>
            <FauxChart h={160} />
            <div className="mt-2 rounded-xl border border-[#1a1a1a] bg-[#070707] p-3 text-[12px] leading-relaxed text-zinc-300">
              Les prises de commandes sont le premier chiffre de chaque communiqué Siemens et le meilleur indicateur avancé du groupe.
            </div>
            <div className="mt-3 flex justify-center gap-2">
              <Pill actif>▮ Barres</Pill>
              <Pill>∿</Pill>
              <Pill>↗</Pill>
              <Pill>⚙ Réglages</Pill>
              <Pill>⇪</Pill>
            </div>
          </div>
          <p className="mt-1.5 text-[11.5px] text-zinc-500">Titre à gauche, chiffre à droite (lecture en Z), texte pleine largeur, contrôles centrés en bas.</p>
        </section>

        <p className="text-[12.5px] text-zinc-400">
          Dis-moi la lettre retenue (ou un mélange) et je l&apos;applique au vrai bloc.
        </p>
      </div>
    </div>
  );
}
