"use client";

/**
 * Recherche locale dans la FAQ (Yann 21 sept 2026).
 *
 * Tout se passe dans le navigateur : le fichier src/data/faq.json est
 * embarqué dans le morceau de code chargé avec la bulle, aucune requête
 * réseau n'est faite pendant que le visiteur écrit.
 *
 * Les textes anglais sont ceux du fichier, repris tels quels. Quand un item
 * n'a pas de version anglaise, on retombe sur le français plutôt que
 * d'afficher un vide.
 */

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import faqBrut from "@/data/faq.json";
import type { LangueSupport } from "./support-strings";

type FaqItemBrut = {
  id?: string;
  categorie?: string;
  q_fr?: string;
  r_fr?: string;
  q_en?: string;
  r_en?: string;
};
type FaqCategorieBrute = { id?: string; titre_fr?: string; titre_en?: string };
type FaqFichier = { categories?: FaqCategorieBrute[]; items?: FaqItemBrut[] };

const FICHIER = (faqBrut ?? {}) as FaqFichier;

export type ReponseFaq = {
  id: string;
  question: string;
  reponse: string;
  score: number;
};

export type CategorieSupport = { id: string; titre: string };

/** Catégories proposées dans le formulaire de ticket, issues de la FAQ. */
export function categoriesSupport(langue: LangueSupport): CategorieSupport[] {
  const brutes = Array.isArray(FICHIER.categories) ? FICHIER.categories : [];
  const sorties: CategorieSupport[] = [];
  for (const c of brutes) {
    const id = (c?.id ?? "").trim();
    if (!id) continue;
    const fr = (c?.titre_fr ?? "").trim();
    const en = (c?.titre_en ?? "").trim();
    const titre = langue === "fr" ? fr || en : en || fr;
    if (!titre) continue;
    sorties.push({ id, titre });
  }
  return sorties;
}

/** Minuscules sans accents, pour comparer "données" et "donnees". */
function aplati(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const MOTS_VIDES = new Set([
  "les", "des", "une", "est", "que", "qui", "quoi", "pour", "avec", "dans",
  "sur", "pas", "vous", "nous", "mon", "mes", "son", "ses", "par", "aux",
  "ce", "cet", "cette", "comment", "pourquoi", "quel", "quelle", "quels",
  "quelles", "faire", "puis", "peut", "peux", "the", "and", "for", "with",
  "you", "your", "what", "how", "why", "can", "does", "are", "this", "that",
  "from", "have", "has", "was", "were", "about", "into",
]);

function termes(requete: string): string[] {
  const mots = aplati(requete)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m));
  return Array.from(new Set(mots)).slice(0, 8);
}

type Entree = {
  id: string;
  question: string;
  reponse: string;
  questionPlate: string;
  reponsePlate: string;
};

let cacheIndex: Partial<Record<LangueSupport, Entree[]>> = {};

function index(langue: LangueSupport): Entree[] {
  const deja = cacheIndex[langue];
  if (deja) return deja;
  const items = Array.isArray(FICHIER.items) ? FICHIER.items : [];
  const entrees: Entree[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i] ?? {};
    const qFr = (it.q_fr ?? "").trim();
    const rFr = (it.r_fr ?? "").trim();
    const qEn = (it.q_en ?? "").trim();
    const rEn = (it.r_en ?? "").trim();
    // Repli sur le français quand la version anglaise n'existe pas encore :
    // mieux vaut une réponse lisible qu'une entrée vide.
    const question = langue === "fr" ? qFr || qEn : qEn || qFr;
    const reponse = langue === "fr" ? rFr || rEn : rEn || rFr;
    if (!question || !reponse) continue;
    entrees.push({
      id: (it.id ?? "").trim() || `faq-${i}`,
      question,
      reponse,
      questionPlate: aplati(question),
      reponsePlate: aplati(reponse),
    });
  }
  cacheIndex = { ...cacheIndex, [langue]: entrees };
  return entrees;
}

/**
 * Classement par pertinence, simple et prévisible :
 * la question pèse plus que la réponse, la phrase entière donne un bonus,
 * et un item qui ne couvre aucun terme est écarté.
 */
export function chercheFaq(requete: string, langue: LangueSupport, maxi = 4): ReponseFaq[] {
  const nettoyee = (requete ?? "").trim();
  if (nettoyee.length < 3) return [];
  const mots = termes(nettoyee);
  const phrase = aplati(nettoyee).replace(/\s+/g, " ").trim();
  if (!mots.length && phrase.length < 4) return [];

  const trouves: ReponseFaq[] = [];
  for (const e of index(langue)) {
    let score = 0;
    let couverts = 0;
    for (const m of mots) {
      const dansQuestion = e.questionPlate.includes(m);
      const dansReponse = e.reponsePlate.includes(m);
      if (dansQuestion) {
        score += 6;
        if (new RegExp(`(^|[^a-z0-9])${m}`).test(e.questionPlate)) score += 3;
      }
      if (dansReponse) score += 2;
      if (dansQuestion || dansReponse) couverts += 1;
    }
    if (phrase.length >= 4) {
      if (e.questionPlate.includes(phrase)) score += 12;
      else if (e.reponsePlate.includes(phrase)) score += 5;
    }
    if (!score) continue;
    // Requête à plusieurs mots : au moins la moitié doit être couverte,
    // sinon on remonte du bruit.
    if (mots.length >= 2 && couverts * 2 < mots.length) continue;
    // Les réponses courtes qui collent au sujet passent devant les pavés.
    score += Math.max(0, 3 - Math.floor(e.reponse.length / 900));
    trouves.push({ id: e.id, question: e.question, reponse: e.reponse, score });
  }
  trouves.sort((a, b) => (b.score - a.score) || a.question.localeCompare(b.question));
  return trouves.slice(0, maxi);
}

function Paragraphes({ texte }: { texte: string }) {
  const blocs = texte.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocs.map((b, i) => (
        <p key={i} className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-300">
          {b}
        </p>
      ))}
    </>
  );
}

function CarteReponse({ reponse }: { reponse: ReponseFaq }) {
  const [ouvert, setOuvert] = useState(false);
  const idRegion = useId();
  return (
    <li className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] transition-colors hover:border-violet-400/30">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-controls={idRegion}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-inset"
      >
        <span className="flex-1">{reponse.question}</span>
        <ChevronDown
          aria-hidden
          className={`mt-0.5 size-4 shrink-0 text-zinc-500 transition-transform duration-200 ${ouvert ? "rotate-180 text-violet-300" : ""}`}
        />
      </button>
      <div
        id={idRegion}
        role="region"
        hidden={!ouvert}
        className="space-y-2 border-t border-white/10 px-3 py-2.5"
      >
        <Paragraphes texte={reponse.reponse} />
      </div>
    </li>
  );
}

export function ListeReponsesFaq({ reponses }: { reponses: ReponseFaq[] }) {
  if (!reponses.length) return null;
  return (
    <ul className="space-y-2">
      {reponses.map((r) => (
        <CarteReponse key={r.id} reponse={r} />
      ))}
    </ul>
  );
}
