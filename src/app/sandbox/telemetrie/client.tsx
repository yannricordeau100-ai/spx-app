"use client";

/**
 * Analytics du site (Yann 31 août 2026, refonte 15 oct 2026).
 * Calcul serveur : src/lib/telemetrie/analytics-site.ts.
 *  - fenêtre du … au … en heure suisse sur toutes les vues ;
 *  - « Exclure mes visites » actif par défaut (Yann, ses comptes, robots) ;
 *  - quatre styles de vue, choix mémorisé par navigateur.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { OngletPaiements } from "@/components/sandbox/onglet-paiements";
import type { AnalyticsSite, Duo, FicheCompte, Visite } from "@/lib/telemetrie/analytics-site";

type Stats = AnalyticsSite & { actif: boolean };
type Style = "cartes" | "graphiques" | "tableau" | "chrono";
const STYLES: [Style, string][] = [["cartes", "Cartes chiffrées"], ["graphiques", "Graphiques"], ["tableau", "Tableau dense"], ["chrono", "Fil des visites"]];
const CLE_STYLE = "mtk-analytics-style";

const CATS: Record<string, string> = {
  js: "Erreur JavaScript", hydratation: "Erreur d’hydratation", http404: "Page introuvable (404)", http5xx: "Erreur serveur (5xx)",
  fetch: "Requête en échec", image: "Image ou logo cassé", lent: "Page lente (LCP, INP, CLS)", rage: "Clics de rage", mort: "Clics morts",
  formulaire: "Formulaire en échec", captcha: "Captcha en échec", bientot: "Blocs « Disponible bientôt »", ecran_blanc: "Écran blanc",
};

/** Maintenant, ou maintenant moins h heures, en heure murale suisse « AAAA-MM-JJTHH:MM ». */
function murZurich(decalageH = 0): string {
  const d = new Date(Date.now() - decalageH * 3600_000);
  const o: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d)) o[p.type] = p.value;
  return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}`;
}
const hz = (iso: string) => new Date(iso).toLocaleString("fr-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const nf = (n: number | null | undefined, suf = "") => (n == null ? "—" : `${n.toLocaleString("fr-FR")}${suf}`);
const duree = (s: number | null) => (s == null ? "—" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`);
const argent = (m: Record<string, number>) => Object.entries(m).map(([d, v]) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${d}`).join(" · ") || "0";

function Carte({ titre, valeur, detail }: { titre: string; valeur: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{titre}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{valeur}</div>
      {detail && <div className="text-xs text-zinc-500">{detail}</div>}
    </div>
  );
}

function Tableau({ titre, lignes, vide, lien }: { titre: string; lignes: Duo[]; vide?: string; lien?: boolean }) {
  const max = lignes[0]?.[1] ?? 1;
  return (
    <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-200">{titre}</h3>
      {lignes.length === 0 && <p className="text-xs text-zinc-600">{vide ?? "Rien sur la fenêtre."}</p>}
      <div className="space-y-1.5">
        {lignes.map(([nom, n]) => (
          <div key={nom} className="relative overflow-hidden rounded px-2 py-1">
            <div className="absolute inset-y-0 left-0 bg-purple-500/10" style={{ width: `${(n / max) * 100}%` }} />
            <div className="relative flex items-baseline justify-between gap-3 text-xs">
              {lien && nom.startsWith("/") ? <a href={nom} target="_blank" rel="noreferrer" className="truncate text-violet-300 hover:underline">{nom}</a> : <span className="truncate text-zinc-300">{nom}</span>}
              <span className="shrink-0 font-mono text-zinc-400">{n.toLocaleString("fr-FR")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Barres({ titre, points, hauteur = 96 }: { titre: string; points: Duo[]; hauteur?: number }) {
  const max = Math.max(1, ...points.map(([, n]) => n));
  return (
    <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-4">
      <h3 className="mb-2 text-sm font-medium text-zinc-200">{titre}</h3>
      {points.length === 0 ? <p className="text-xs text-zinc-600">Rien sur la fenêtre.</p> : (
        <>
          <div className="flex items-end gap-[2px]" style={{ height: hauteur }}>
            {points.map(([k, n]) => (
              <div key={k} title={`${k} : ${n}`} className="flex-1 rounded-t bg-purple-500/60" style={{ height: `${n ? Math.max(4, (n / max) * 100) : 1}%` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-zinc-600"><span>{points[0][0]}</span><span>max {max}</span><span>{points[points.length - 1][0]}</span></div>
        </>
      )}
    </div>
  );
}

function Grille({ titre, entetes, lignes, vide }: { titre: string; entetes: string[]; lignes: React.ReactNode[][]; vide?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#262626] bg-[#0a0a0a] p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-200">{titre}</h3>
      {lignes.length === 0 ? <p className="text-xs text-zinc-600">{vide ?? "Rien sur la fenêtre."}</p> : (
        <table className="w-full text-xs">
          <thead><tr>{entetes.map((e, i) => <th key={e} className={`pb-1 font-normal text-zinc-500 ${i ? "text-right" : "text-left"}`}>{e}</th>)}</tr></thead>
          <tbody>{lignes.map((l, i) => <tr key={i} className="border-t border-white/5">{l.map((c, j) => <td key={j} className={`py-1 ${j ? "text-right font-mono text-zinc-400" : "text-zinc-300"}`}>{c}</td>)}</tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

const NON_MESURABLES = [
  "Valeur vie client (LTV) : il faut au moins 12 mois d’abonnés payants.",
  "Retour sur coût d’acquisition (CAC payback) : sans publicité, aucun coût d’acquisition suivi.",
  "Score de recommandation (NPS) : aucun questionnaire n’est posé aux utilisateurs.",
  "Revenu d’expansion (montée en gamme) : une seule formule payante pour l’instant.",
  "Quick ratio SaaS et marge brute : l’historique du MRR et les coûts d’hébergement ne sont pas suivis ici.",
  "Coefficient viral (K) : les invitations du parrainage ne sont pas reliées aux inscriptions.",
  "Rétention à 12 mois par cohorte : le service est trop jeune.",
];

function BlocSaas({ s, dense, debut }: { s: Stats["saas"]; dense?: boolean; debut?: string }) {
  const r = s.retention;
  const lignes: [string, string, string][] = [
    ["Activation", nf(s.activation.pct, " %"), `${s.activation.actives} / ${s.activation.comptes} nouveaux comptes ont ouvert une fiche, un KPI ou une comparaison sous 7 jours`],
    ["Délai jusqu’à la première valeur", s.premiere_valeur_min == null ? "—" : s.premiere_valeur_min < 60 ? `${Math.round(s.premiere_valeur_min)} min` : `${(s.premiere_valeur_min / 60).toFixed(1)} h`, "médiane entre l’inscription et la première action clé"],
    ["Rétention J1", nf(r.j1.pct, " %"), `${r.j1.revenus} / ${r.j1.eligibles} comptes revenus le lendemain`],
    ["Rétention J7", nf(r.j7.pct, " %"), `${r.j7.revenus} / ${r.j7.eligibles}`],
    ["Rétention J30", nf(r.j30.pct, " %"), `${r.j30.revenus} / ${r.j30.eligibles}`],
    ["Comptes actifs jour / semaine / mois", `${s.dau} / ${s.wau} / ${s.mau}`, "jusqu’à la fin de la fenêtre"],
    ["Adhérence (actifs jour / mois)", nf(s.adherence_pct, " %"), "au-delà de 20 % : usage régulier"],
    ["Essai vers payant", nf(s.essai_vers_payant.pct, " %"), `${s.essai_vers_payant.payes} / ${s.essai_vers_payant.essais} essais commencés dans la fenêtre`],
    ["MRR (début → fin)", `${argent(s.mrr_debut)} → ${argent(s.mrr_fin)}`, "revenu mensuel récurrent, abonnements actifs"],
    ["Désabonnement", nf(s.desabonnement.pct, " %"), `${s.desabonnement.perdus} / ${s.desabonnement.actifs_debut} abonnés actifs au début`],
    ["Revenu net retenu", Object.entries(s.nrr_pct).map(([d, v]) => `${nf(v, " %")} ${d}`).join(" · ") || "—", "MRR à la fin des abonnés présents au début"],
  ];
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-zinc-100">Indicateurs SaaS<span className="ml-2 text-xs font-normal text-zinc-500">{debut}</span></h2>
      {dense ? (
        <Grille titre="Indicateurs mesurés" entetes={["Indicateur", "Valeur", "Détail"]} lignes={lignes.map((l) => [l[0], l[1], l[2]])} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{lignes.map(([t, v, d]) => <Carte key={t} titre={t} valeur={v} detail={d} />)}</div>
      )}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Grille titre="Fonctionnalités clés utilisées (comptes)" entetes={["Fonctionnalité", "Comptes", "Fois"]} lignes={s.fonctions.map((f) => [f.fonction, f.comptes, f.fois])} vide="Aucun compte connecté actif sur la fenêtre." />
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-100/80">
          <h3 className="mb-2 text-sm font-medium text-amber-200">Non mesurables pour l’instant</h3>
          <ul className="list-disc space-y-1 pl-4">{NON_MESURABLES.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}

function BlocProblemes({ p, style, debut }: { p: Stats["problemes"]; style: Style; debut?: string }) {
  const total = p.categories.reduce((a, c) => a + c.visiteurs, 0);
  const catsTxt = (c: Record<string, number>) => Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${CATS[k] ?? k} ${n}`).join(", ");
  return (
    <section className="mt-6">
      <h2 className="mb-1 text-lg font-semibold text-zinc-100">Problèmes vus par les visiteurs<span className="ml-2 text-xs font-normal text-zinc-500">{debut} (erreurs JavaScript plus anciennes comprises)</span></h2>
      <p className="mb-3 text-xs text-zinc-500">Visiteurs touchés : IP hachées distinctes. Vitaux médians : LCP {nf(p.vitaux.lcp_ms, " ms")}, INP {nf(p.vitaux.inp_ms, " ms")}, CLS {p.vitaux.cls ?? "—"} ({p.vitaux.mesures} mesures).</p>
      {style === "cartes" && total > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{p.categories.map((c) => <Carte key={c.cat} titre={CATS[c.cat] ?? c.cat} valeur={nf(c.visiteurs)} detail={`${c.occurrences} occurrences`} />)}</div>
      )}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Grille titre="Pages à problème (par visiteurs touchés)" entetes={["Page", "Visiteurs", "Occurrences", "Nature"]}
          lignes={p.pages.map((x) => [<a key="a" href={x.chemin} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">{x.chemin}</a>, x.visiteurs, x.occurrences, <span key="c" className="font-sans text-[11px] text-zinc-500">{catsTxt(x.cats)}</span>])}
          vide="Aucun problème signalé sur la fenêtre." />
        <Grille titre="Erreurs regroupées (React minifié par code)" entetes={["Erreur", "Visiteurs", "Fois", "Pages"]}
          lignes={p.messages.map((m) => [<span key="n"><span className="text-zinc-500">{CATS[m.cat] ?? m.cat} · </span>{m.nom}</span>, m.visiteurs, m.occurrences, <span key="p" className="font-sans text-[11px]">{m.pages.join(" ")}</span>])} />
        {style !== "cartes" && <Grille titre="Par nature" entetes={["Nature", "Visiteurs", "Occurrences"]} lignes={p.categories.map((c) => [CATS[c.cat] ?? c.cat, c.visiteurs, c.occurrences])} />}
        {style === "graphiques"
          ? <Barres titre="Problèmes par jour" points={p.par_jour.map((j) => [j.jour, Object.values(j.cats).reduce((a, b) => a + b, 0)] as Duo)} />
          : <Grille titre="Par jour (heure suisse)" entetes={["Jour", "Détail"]} lignes={p.par_jour.map((j) => [j.jour, <span key="d" className="font-sans text-[11px]">{catsTxt(j.cats)}</span>])} />}
        <Grille titre="Par appareil" entetes={["Appareil", "Détail"]} lignes={p.par_appareil.map((a) => [a.appareil, <span key="d" className="font-sans text-[11px]">{catsTxt(a.cats)}</span>])} />
      </div>
    </section>
  );
}

function Fil({ fil }: { fil: Visite[] }) {
  return (
    <div className="mt-6 space-y-2">
      {fil.length === 0 && <p className="text-sm text-zinc-500">Aucune visite sur la fenêtre.</p>}
      {fil.map((v) => (
        <div key={v.id} className="rounded-xl border border-[#262626] bg-[#0a0a0a] px-4 py-2 text-xs">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-zinc-300">{hz(v.debut)}</span>
            <span className="rounded-full bg-violet-500/15 px-2 text-violet-200">{v.origine}{v.detail ? ` · ${v.detail}` : ""}</span>
            {v.utm_campaign && <span className="text-zinc-500">campagne {v.utm_campaign}</span>}
            <span className="text-zinc-400">{[v.ville, v.pays].filter(Boolean).join(", ") || "lieu inconnu"}</span>
            <span className="text-zinc-500">{v.appareil}</span>
            <span className="text-zinc-500">{v.revenant ? "revenant" : "nouveau"}{v.connecte ? " · connecté" : ""}</span>
            <span className="ml-auto font-mono text-zinc-400">{v.pages} p. · {duree(v.duree_s)}{v.rebond ? " · rebond" : ""}</span>
          </div>
          <div className="mt-1 truncate text-zinc-500">{v.parcours.join(" → ")}</div>
        </div>
      ))}
    </div>
  );
}

export function TelemetrieClient() {
  const [du, setDu] = useState(() => murZurich(24));
  const [au, setAu] = useState(() => murZurich(0));
  const [exclureMoi, setExclureMoi] = useState(true);
  const [style, setStyle] = useState<Style>("cartes");
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState<"trafic" | "paiements">("trafic");

  useEffect(() => {
    try { const s = localStorage.getItem(CLE_STYLE) as Style | null; if (s && STYLES.some(([k]) => k === s)) setStyle(s); } catch { /* stockage indisponible */ }
  }, []);
  const choisitStyle = (s: Style) => { setStyle(s); try { localStorage.setItem(CLE_STYLE, s); } catch { /* idem */ } };

  const charge = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const q = new URLSearchParams({ du, au, moi: exclureMoi ? "1" : "0" });
      const r = await fetch(`/api/sandbox/telemetrie?${q}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "echec");
      setStats(j);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "échec du chargement");
    } finally {
      setChargement(false);
    }
  }, [du, au, exclureMoi]);

  useEffect(() => { void charge(); }, [charge]);

  async function bascule() {
    if (!stats) return;
    const suivant = !stats.actif;
    setStats({ ...stats, actif: suivant });
    await fetch("/api/sandbox/telemetrie", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actif: suivant }) });
  }
  const preset = (h: number) => { setAu(murZurich(0)); setDu(murZurich(h)); };
  const jetonAudit = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("audit_token") : null;
  const s = stats;
  const dep = (k: string) => { const d = s?.debuts?.[k]; return d ? ` · données depuis le ${d.split("-").reverse().join(".")}` : ""; };
  const [fiche, setFiche] = useState<FicheCompte | null>(null);
  const ouvreFiche = async (id: string) => {
    const r = await fetch(`/api/sandbox/telemetrie/compte?id=${id}`, { cache: "no-store" });
    if (r.ok) setFiche(await r.json());
  };
  const bouton = (actif: boolean) => `rounded-full border px-3 py-1 text-xs ${actif ? "border-purple-500 bg-purple-500/15 text-purple-200" : "border-[#262626] text-zinc-400 hover:border-[#3a3a3a]"}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-5">
      <Link href="/sandbox" className="text-sm text-zinc-500 hover:text-zinc-300">← Sandbox</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-100">Statistiques</h1>
        <div className="inline-flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5">
          {(["trafic", "paiements"] as const).map((o) => (
            <button key={o} onClick={() => setOnglet(o)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${onglet === o ? "bg-violet-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
              {o === "trafic" ? "Trafic" : "Paiements"}
            </button>
          ))}
        </div>
        {s && (
          <button onClick={() => void bascule()} className={`rounded-full border px-3 py-1 text-xs font-medium ${s.actif ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-red-500 bg-red-500/15 text-red-300"}`}>
            {s.actif ? "Collecte active : cliquer pour couper" : "Collecte COUPÉE : cliquer pour activer"}
          </button>
        )}
      </div>

      {onglet === "paiements" && <OngletPaiements jeton={jetonAudit} />}
      {onglet === "trafic" && (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#262626] bg-[#0a0a0a] p-3 text-xs text-zinc-400">
            <label className="flex flex-col gap-1">Du (heure suisse)
              <input type="datetime-local" value={du} onChange={(e) => e.target.value && setDu(e.target.value)} className="rounded border border-[#333] bg-black px-2 py-1 text-zinc-200" />
            </label>
            <label className="flex flex-col gap-1">Au (heure suisse)
              <input type="datetime-local" value={au} onChange={(e) => e.target.value && setAu(e.target.value)} className="rounded border border-[#333] bg-black px-2 py-1 text-zinc-200" />
            </label>
            <div className="flex gap-1.5">
              {([[24, "24 h"], [168, "7 j"], [720, "30 j"], [2160, "90 j"]] as [number, string][]).map(([h, l]) => <button key={h} onClick={() => preset(h)} className={bouton(false)}>{l}</button>)}
              <button onClick={() => { setAu(murZurich(0)); setDu("2026-08-31T00:00"); }} className={bouton(false)}>Tout l’historique</button>
            </div>
            <label className="flex cursor-pointer items-center gap-2" data-track="exclure-mes-visites">
              <input type="checkbox" checked={exclureMoi} onChange={(e) => setExclureMoi(e.target.checked)} className="size-4 accent-violet-500" />
              <span className="text-zinc-200">Exclure mes visites</span>
            </label>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {STYLES.map(([k, l]) => <button key={k} onClick={() => choisitStyle(k)} className={bouton(style === k)}>{l}</button>)}
            </div>
          </div>
          {s && (
            <p className="mt-2 text-xs text-zinc-500">
              Fenêtre du {s.du_zurich} au {s.au_zurich} (heure suisse).{" "}
              {s.exclure_moi
                ? `Exclues : ${s.exclusion.visites_exclues} visites de Yann ou de robots (comptes, IP, cookie, agent utilisateur).`
                : `Toutes les visites, y compris les ${s.exclusion.visites_exclues} de Yann et des robots.`}
              {s.tronque ? " Fenêtre tronquée à 60 000 événements." : ""}
            </p>
          )}

          {erreur === "table_absente" && <p className="mt-6 text-sm text-amber-300">La table de télémétrie n’existe pas encore (supabase/migrations/20260831_telemetrie.sql).</p>}
          {erreur && erreur !== "table_absente" && <p className="mt-6 text-sm text-red-400">{erreur}</p>}
          {chargement && <p className="mt-4 text-sm text-zinc-500">Chargement…</p>}

          {s && style === "chrono" && <Fil fil={s.fil} />}

          {s && style !== "chrono" && (
            <>
              {style === "tableau" ? (
                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Grille titre="Audience" entetes={["Mesure", "Valeur"]} lignes={[
                    ["Visites", nf(s.visites)], ["Visiteurs (IP distinctes)", nf(s.visiteurs)], ["Pages vues", nf(s.pages_vues)],
                    ["Pages par visite", nf(s.pages_par_visite)], ["Durée moyenne / médiane", `${duree(s.duree_moyenne_s)} / ${duree(s.duree_mediane_s)}`],
                    ["Rebond", nf(s.rebond_pct, " %")], ["Nouveaux / revenants", `${s.nouveaux} / ${s.revenants}`], ["Comptes créés", nf(s.comptes_crees)],
                    ["Appareils", s.appareils.map(([a, n]) => `${a} ${n}`).join(", ") || "—"], ["Événements", nf(s.evenements)],
                  ]} />
                  <Grille titre="Origine des visiteurs" entetes={["Origine", "Visites"]} lignes={s.origines.map(([o, n]) => [o, n])} />
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  <Carte titre="Visites" valeur={nf(s.visites)} detail={`${s.visiteurs} visiteurs`} />
                  <Carte titre="Pages / visite" valeur={nf(s.pages_par_visite)} detail={`${s.pages_vues} pages vues`} />
                  <Carte titre="Durée" valeur={duree(s.duree_moyenne_s)} detail={`médiane ${duree(s.duree_mediane_s)}`} />
                  <Carte titre="Rebond" valeur={nf(s.rebond_pct, " %")} detail="1 page et moins de 10 s" />
                  <Carte titre="Nouveaux" valeur={nf(s.nouveaux)} detail={`${s.revenants} revenants`} />
                  <Carte titre="Comptes créés" valeur={nf(s.comptes_crees)} />
                  <Carte titre="Mobile" valeur={nf(s.appareils.find(([a]) => a === "mobile")?.[1] ?? 0)} detail={`ordinateur ${s.appareils.find(([a]) => a === "ordinateur")?.[1] ?? 0}`} />
                  <Carte titre="Depuis X" valeur={nf(s.origines.find(([o]) => o === "X")?.[1] ?? 0)} detail="visites" />
                </div>
              )}

              {style !== "cartes" && (
                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <Barres titre={`Visites par ${s.serie_pas} (heure suisse)`} points={s.serie} />
                  <Barres titre="Visites selon l’heure de la journée (heure suisse)" points={s.par_heure_du_jour.map((n, h) => [`${h} h`, n] as Duo)} />
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {style !== "tableau" && <Tableau titre={`Origine des visiteurs${dep("visites")}`} lignes={s.origines} />}
                <Tableau titre={`Détail des origines (appli X, sites)${dep("visites")}`} lignes={s.origines_detail} />
                <Tableau titre={`Campagnes (utm_source / utm_campaign)${dep("visites")}`} lignes={s.campagnes} />
                <Tableau titre={`Pages d’arrivée${dep("visites")}`} lignes={s.pages_arrivee} lien />
                <Tableau titre={`Parcours (4 premières pages)${dep("visites")}`} lignes={s.parcours} />
                <Tableau titre="Pages vues par visite" lignes={s.pages_vues_par_visite} />
                <Tableau titre={`Pays${dep("visites")}`} lignes={s.pays} />
                <Tableau titre={`Villes${dep("ville")}`} lignes={s.villes} />
                <Tableau titre="Pages les plus vues" lignes={s.top_pages} lien />
                {style !== "cartes" && <Tableau titre="Clics les plus fréquents" lignes={s.top_clics} />}
                {style !== "cartes" && <Tableau titre="Navigateurs" lignes={s.navigateurs} />}
                {style !== "cartes" && <Tableau titre={`API (${s.api.appels} appels, p50 ${s.api.p50_ms ?? "—"} ms, p95 ${s.api.p95_ms ?? "—"} ms)`} lignes={s.api.top_routes} />}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                <Grille titre={`Conversion par origine${dep("visites")}`} entetes={["Origine", "Visites", "Inscriptions", "Essais", "Paiements"]}
                  lignes={s.conversion.map((c) => [c.origine, c.visites, c.inscriptions, c.essais, c.paiements])} />
                {style === "graphiques"
                  ? <Barres titre="Comptes créés par jour (heure suisse)" points={s.comptes_par_jour} />
                  : <Grille titre="Comptes créés par jour (heure suisse)" entetes={["Jour", "Comptes"]} lignes={s.comptes_par_jour.map(([j, n]) => [j, n])} vide="Aucun compte créé sur la fenêtre." />}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                <Grille titre={`Sociétés les plus regardées (fenêtre)${dep("visites")}`} entetes={["Société", "Vues", "Visiteurs"]}
                  lignes={s.societes.map((x) => [<a key="a" href={`/${x.ticker.toLowerCase()}`} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">{x.nom} ({x.ticker})</a>, x.vues, x.visiteurs])} />
                <Grille titre={`Sociétés les plus regardées, par jour${dep("visites")}`} entetes={["Jour", "Classement (vues · visiteurs)"]}
                  lignes={s.societes_par_jour.map((j) => [j.jour, <span key="t" className="font-sans text-[11px]">{j.top.map((x, i) => `${i + 1}. ${x.ticker} ${x.vues}·${x.visiteurs}`).join("  ")}</span>])} />
              </div>

              <Grille titre={`Comptes créés (heure suisse, cliquer pour la fiche)${dep("comptes")}`} entetes={["Créé le", "Email", "Origine"]}
                lignes={s.comptes_liste.map((c) => [hz(c.cree), <button key="e" onClick={() => void ouvreFiche(c.id)} className="text-violet-300 hover:underline">{c.email ?? c.id}{c.moi ? " (Yann)" : ""}</button>, c.origine])}
                vide="Aucun compte créé sur la fenêtre." />
              <BlocProblemes p={s.problemes} style={style} debut={dep("problemes")} />
              <BlocSaas s={s.saas} dense={style === "tableau"} debut={`${dep("comptes")}${s.debuts?.stripe ? ` · paiements depuis le ${s.debuts.stripe.split("-").reverse().join(".")}` : ""}`} />
            </>
          )}
        </>
      )}
      {fiche && <Fiche f={fiche} ferme={() => setFiche(null)} />}
    </main>
  );
}

function Fiche({ f, ferme }: { f: FicheCompte; ferme: () => void }) {
  const ligne = (t: string, v: React.ReactNode) => <div className="flex gap-3 border-t border-white/5 py-1.5"><span className="w-44 shrink-0 text-zinc-500">{t}</span><span className="min-w-0 text-zinc-200">{v ?? "—"}</span></div>;
  const pv = f.premiere_visite;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={ferme}>
      <div className="mt-10 w-full max-w-2xl rounded-2xl border border-[#333] bg-[#0b0b0b] p-5 text-xs" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-semibold text-zinc-100">{f.email}</h3><button onClick={ferme} className="text-zinc-400 hover:text-zinc-100">Fermer</button></div>
        {ligne("Page d’arrivée (1re visite)", pv ? <a href={pv.arrivee ?? "/"} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">{pv.arrivee}</a> : "aucune visite mesurée")}
        {ligne("Origine", pv ? `${pv.origine}${pv.origine_detail ? ` · ${pv.origine_detail}` : ""}${pv.utm_source ? ` · utm ${pv.utm_source}${pv.utm_campaign ? ` / ${pv.utm_campaign}` : ""}` : ""}` : null)}
        {ligne("Première visite", pv?.quand)}
        {ligne("Inscription", f.cree)}
        {ligne("Délai visite → inscription", f.delai_inscription_min == null ? null : f.delai_inscription_min < 120 ? `${f.delai_inscription_min} min` : `${(f.delai_inscription_min / 60).toFixed(1)} h`)}
        {ligne("Pays, ville", [f.ville, f.pays].filter(Boolean).join(", ") || null)}
        {ligne("Appareil, navigateur", [f.appareil, f.navigateur].filter(Boolean).join(" · ") || null)}
        {ligne("Pages avant l’inscription", f.pages_avant_inscription.join(" → ") || null)}
        {ligne("Sociétés consultées", f.societes.map((x) => `${x.ticker} (${x.vues})`).join(", ") || null)}
        {ligne("Forfait", f.abonnements.length ? f.abonnements.map((a: Record<string, unknown>) => `${a.plan} · ${a.status}`).join(" ; ") : "gratuit")}
        {ligne("Essai et paiements", f.facturation.map((e) => `${e.quand} ${e.type} ${e.detail}`).join(" ; ") || null)}
        {ligne("Dernière activité", `${f.derniere_activite ?? "—"} (connexion : ${f.derniere_connexion ?? "—"})`)}
        <h4 className="mb-1 mt-3 text-zinc-300">Visites suivantes</h4>
        {f.visites_suivantes.length === 0 ? <p className="text-zinc-600">Aucune.</p> : f.visites_suivantes.map((v) => (
          <div key={v.quand} className="border-t border-white/5 py-1 text-zinc-400"><span className="font-mono text-zinc-300">{v.quand}</span> · {v.pages} p. · {duree(v.duree_s)} · {v.parcours.join(" → ")}</div>
        ))}
      </div>
    </div>
  );
}
