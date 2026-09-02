"use client";

/**
 * Logothèque — sandbox (Yann 31 août 2026, refonte 2 sept 2026).
 *
 * 1. IMAGES DE MARQUE : les fichiers réellement fournis par Yann (logo PNG,
 *    image de partage, favicon...) avec la liste de TOUTES les pages et
 *    usages hors site (emails, exports) où chacun est présent. Le back-office
 *    est exclu des listes.
 * 2. EMPLACEMENTS : une ligne par emplacement du site, un clic sur une
 *    vignette active cette variante pour cet emplacement (base, effet
 *    immédiat en prod).
 *
 * Chaque logo (image de marque ou création) a une croix de retrait et une
 * case à cocher pour retirer plusieurs éléments d'un coup. Le retrait est
 * persisté en base et réversible : aucun fichier n'est détruit.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import activeWordmark from "@/data/active-wordmark.json";
import {
  WORDMARK_VARIANT_META,
  getWordmarkVariant,
} from "@/components/wordmark-variants";
import {
  ASSETS_MARQUE,
  EMPLACEMENTS,
  type MasquesLogotheque,
  type ReglagesLogotheque,
} from "@/lib/logotheque";
import { rafraichitLogotheque } from "@/components/logo-mettrik";

type Etat = "repos" | "envoi" | "ok" | "erreur";

function CroixEtCase({
  coche,
  onCoche,
  onCroix,
  titre,
}: {
  coche: boolean;
  onCoche: () => void;
  onCroix: () => void;
  titre: string;
}) {
  return (
    <span className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={coche}
        onChange={onCoche}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Sélectionner ${titre}`}
        className="size-3.5 cursor-pointer accent-purple-500"
      />
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onCroix();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.stopPropagation();
            onCroix();
          }
        }}
        aria-label={`Retirer ${titre}`}
        title="Retirer de la logothèque"
        className="flex size-4 cursor-pointer items-center justify-center rounded-full border border-[#3a3a3a] bg-[#111] text-[10px] leading-none text-zinc-500 hover:border-red-500/60 hover:text-red-400"
      >
        ✕
      </span>
    </span>
  );
}

export function LogothequeClient({
  initial,
  masquesInitial,
}: {
  initial: ReglagesLogotheque;
  masquesInitial: MasquesLogotheque;
}) {
  const [reglages, setReglages] = useState<ReglagesLogotheque>(initial);
  const [masques, setMasques] = useState<MasquesLogotheque>(masquesInitial);
  const [selection, setSelection] = useState<{ variantes: string[]; assets: string[] }>({
    variantes: [],
    assets: [],
  });
  const [etat, setEtat] = useState<Etat>("repos");
  const [message, setMessage] = useState("");
  const [familleFiltre, setFamilleFiltre] = useState<string>("Toutes");

  const variantesVisibles = useMemo(
    () => WORDMARK_VARIANT_META.filter((v) => !masques.variantes.includes(v.id)),
    [masques.variantes],
  );
  const familles = useMemo(
    () => ["Toutes", ...Array.from(new Set(variantesVisibles.map((v) => v.family)))],
    [variantesVisibles],
  );
  const visibles = useMemo(
    () =>
      familleFiltre === "Toutes"
        ? variantesVisibles
        : variantesVisibles.filter((v) => v.family === familleFiltre),
    [familleFiltre, variantesVisibles],
  );
  const assetsVisibles = ASSETS_MARQUE.filter((a) => !masques.assets.includes(a.id));
  const nbSelection = selection.variantes.length + selection.assets.length;
  const nbMasques = masques.variantes.length + masques.assets.length;

  async function enregistre(suivant: ReglagesLogotheque) {
    setReglages(suivant);
    setEtat("envoi");
    setMessage("");
    try {
      const r = await fetch("/api/logotheque", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reglages: suivant }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "echec");
      rafraichitLogotheque(j.reglages ?? suivant);
      setEtat("ok");
      setMessage("Enregistré. Visible au rechargement suivant, sans redéploiement.");
    } catch (err) {
      setEtat("erreur");
      setMessage(err instanceof Error ? err.message : "échec de l'enregistrement");
    }
  }

  async function enregistreMasques(suivant: MasquesLogotheque, msg: string) {
    setMasques(suivant);
    setEtat("envoi");
    setMessage("");
    try {
      const r = await fetch("/api/logotheque", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ masques: suivant }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "echec");
      setEtat("ok");
      setMessage(msg);
    } catch (err) {
      setEtat("erreur");
      setMessage(err instanceof Error ? err.message : "échec de l'enregistrement");
    }
  }

  const retireVariante = (id: string) =>
    void enregistreMasques(
      { ...masques, variantes: [...masques.variantes, id] },
      "Création retirée. Restaurable en bas de page, aucun fichier détruit.",
    );
  const retireAsset = (id: string) =>
    void enregistreMasques(
      { ...masques, assets: [...masques.assets, id] },
      "Image retirée de la logothèque. Restaurable en bas de page, le fichier reste en ligne.",
    );
  const retireSelection = () => {
    if (!nbSelection) return;
    void enregistreMasques(
      {
        variantes: [...masques.variantes, ...selection.variantes],
        assets: [...masques.assets, ...selection.assets],
      },
      `${nbSelection} élément(s) retiré(s). Restaurables en bas de page.`,
    );
    setSelection({ variantes: [], assets: [] });
  };
  const restaure = (type: "variantes" | "assets", id: string) =>
    void enregistreMasques(
      { ...masques, [type]: masques[type].filter((x) => x !== id) },
      "Élément restauré.",
    );

  const basculeSelection = (type: "variantes" | "assets", id: string) =>
    setSelection((s) => ({
      ...s,
      [type]: s[type].includes(id) ? s[type].filter((x) => x !== id) : [...s[type], id],
    }));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/sandbox" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Sandbox
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-100">Logothèque</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        En haut : les images de marque fournies, avec tous leurs usages sur le
        site et hors site (back-office exclu). En dessous : le choix du logo
        affiché à chaque emplacement. La croix retire un élément, les cases
        permettent d&apos;en retirer plusieurs d&apos;un coup : rien n&apos;est
        détruit, tout est restaurable en bas de page.
      </p>

      {nbSelection > 0 && (
        <div className="sticky top-2 z-20 mt-4 flex items-center gap-3 rounded-xl border border-purple-500/50 bg-[#141019] px-4 py-2.5">
          <span className="text-sm text-zinc-200">{nbSelection} sélectionné(s)</span>
          <button
            onClick={retireSelection}
            className="rounded-full border border-red-500/50 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
          >
            Retirer la sélection
          </button>
          <button
            onClick={() => setSelection({ variantes: [], assets: [] })}
            className="rounded-full border border-[#3a3a3a] px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Tout décocher
          </button>
        </div>
      )}

      {etat !== "repos" && (
        <p className={`mt-4 text-sm ${etat === "erreur" ? "text-red-400" : "text-emerald-400"}`}>
          {etat === "envoi" ? "Enregistrement…" : message}
        </p>
      )}

      {/* ── 1. Images de marque fournies ─────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-medium text-zinc-100">Images de marque fournies</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Les fichiers réels de la marque et chaque endroit où ils apparaissent.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {assetsVisibles.map((a) => (
            <div
              key={a.id}
              className="relative rounded-xl border border-[#262626] bg-[#0a0a0a] p-4"
            >
              <CroixEtCase
                coche={selection.assets.includes(a.id)}
                onCoche={() => basculeSelection("assets", a.id)}
                onCroix={() => retireAsset(a.id)}
                titre={a.label}
              />
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-20 w-32 shrink-0 items-center justify-center rounded-lg border border-[#1c1c1c] p-2 ${
                    a.fondClair ? "bg-zinc-100" : "bg-[#111]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.src} alt={a.label} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-zinc-100">{a.label}</h3>
                    {a.orphelin && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                        plus utilisé
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{a.fichier}</p>
                  <ul className="mt-2 space-y-1">
                    {a.usages.map((u) => (
                      <li key={u} className="flex gap-1.5 text-xs leading-snug text-zinc-400">
                        <span className="text-purple-400">•</span>
                        <span>{u}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. Emplacements du site ──────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-lg font-medium text-zinc-100">Logo affiché par emplacement</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Un clic active la variante pour l&apos;emplacement de la ligne. Sans
          choix explicite, l&apos;emplacement suit la variante générale (
          {activeWordmark.id}).
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {familles.map((f) => (
            <button
              key={f}
              onClick={() => setFamilleFiltre(f)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                familleFiltre === f
                  ? "border-purple-500 bg-purple-500/15 text-purple-200"
                  : "border-[#262626] bg-[#0a0a0a] text-zinc-400 hover:border-[#3a3a3a]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-10">
          {EMPLACEMENTS.map((e) => {
            const actif = reglages[e.id] ?? activeWordmark.id;
            const herite = !reglages[e.id];
            return (
              <section key={e.id}>
                <div className="flex flex-wrap items-baseline gap-3">
                  <h3 className="text-base font-medium text-zinc-100">{e.label}</h3>
                  <span className="text-xs text-zinc-500">{e.ou}</span>
                  {herite ? (
                    <span className="rounded-full border border-[#262626] px-2 py-0.5 text-[11px] text-zinc-500">
                      hérite du réglage général
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        const suivant = { ...reglages };
                        delete suivant[e.id];
                        void enregistre(suivant);
                      }}
                      className="rounded-full border border-[#262626] px-2 py-0.5 text-[11px] text-zinc-400 hover:border-[#3a3a3a] hover:text-zinc-200"
                    >
                      revenir au réglage général
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibles.map((v) => {
                    const Variante = getWordmarkVariant(v.id);
                    const choisi = actif === v.id;
                    return (
                      <div
                        key={`${e.id}-${v.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => void enregistre({ ...reglages, [e.id]: v.id })}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") void enregistre({ ...reglages, [e.id]: v.id });
                        }}
                        className={`relative flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border px-4 py-5 text-center transition-colors ${
                          choisi
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-[#262626] bg-[#0a0a0a] hover:border-[#3a3a3a]"
                        }`}
                      >
                        <CroixEtCase
                          coche={selection.variantes.includes(v.id)}
                          onCoche={() => basculeSelection("variantes", v.id)}
                          onCroix={() => retireVariante(v.id)}
                          titre={v.label}
                        />
                        <Variante size="sm" animated={false} showRail={false} />
                        <span className="text-[11px] leading-tight text-zinc-500">{v.label}</span>
                        {choisi && (
                          <span className="text-[11px] font-medium text-purple-300">actif ici</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {/* ── 3. Éléments retirés (restauration) ───────────────────────── */}
      {nbMasques > 0 && (
        <section className="mt-12 rounded-xl border border-[#262626] bg-[#0a0a0a] p-4">
          <h2 className="text-sm font-medium text-zinc-300">
            Éléments retirés ({nbMasques})
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Retirés de l&apos;affichage uniquement : aucun fichier détruit.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {masques.assets.map((id) => {
              const a = ASSETS_MARQUE.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  onClick={() => restaure("assets", id)}
                  className="rounded-full border border-[#3a3a3a] px-3 py-1 text-xs text-zinc-400 hover:border-purple-500/60 hover:text-zinc-200"
                  title="Cliquer pour restaurer"
                >
                  {a?.label ?? id} ↩
                </button>
              );
            })}
            {masques.variantes.map((id) => {
              const v = WORDMARK_VARIANT_META.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  onClick={() => restaure("variantes", id)}
                  className="rounded-full border border-[#3a3a3a] px-3 py-1 text-xs text-zinc-400 hover:border-purple-500/60 hover:text-zinc-200"
                  title="Cliquer pour restaurer"
                >
                  {v?.label ?? id} ↩
                </button>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
