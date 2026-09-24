/**
 * Journal des emails envoyes par Mettrik et alertes de volume (Yann 25 sept 2026).
 *
 * - journaliserEmail(type, sujet, dest) : compte chaque envoi par type (nombre,
 *   dernier envoi, 30 derniers), lu par /sandbox/emails-alertes.
 * - evenement("contact" | "inscription") : compte les messages du formulaire de
 *   contact et les creations de compte, et envoie au proprietaire :
 *     notification au 5e message (seuil reglable),
 *     alerte si plus de 2 en 5 min, alerte si plus de 10 en 24 h.
 * Stockage : desk_page_content (page_key « journal_emails »), via l API REST
 * Supabase (compatible edge). Ne jette jamais, ne bloque jamais la requete.
 */
import { renderEmailLayout } from "@/lib/email/layout";

export type TypeEmail = string;
export type Evenement = "contact" | "inscription";

type Ligne = { d: string; sujet: string; dest: string };
type Etat = {
  types: Record<string, { nb: number; dernier: string | null; derniers: Ligne[] }>;
  evenements: Record<Evenement, string[]>;
  totaux: Record<Evenement, number>;
  derniereAlerte: Record<string, string>;
};
export type Reglages = {
  notifContactSeuil: number;
  rafaleNb: number;
  rafaleMinutes: number;
  jourNb: number;
  actif: boolean;
};
export const REGLAGES_DEFAUT: Reglages = { notifContactSeuil: 5, rafaleNb: 2, rafaleMinutes: 5, jourNb: 10, actif: true };

const PAGE = "journal_emails";

function base() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && cle ? { url, cle } : null;
}

async function lire<T>(section: string, defaut: T): Promise<T> {
  const b = base();
  if (!b) return defaut;
  try {
    const r = await fetch(`${b.url}/rest/v1/desk_page_content?select=content_fr&page_key=eq.${PAGE}&section_key=eq.${section}`, {
      headers: { apikey: b.cle, Authorization: `Bearer ${b.cle}` },
      cache: "no-store",
    });
    const rows = (await r.json()) as { content_fr?: string }[];
    return rows?.[0]?.content_fr ? { ...defaut, ...(JSON.parse(rows[0].content_fr) as T) } : defaut;
  } catch {
    return defaut;
  }
}

async function ecrire(section: string, valeur: unknown): Promise<void> {
  const b = base();
  if (!b) return;
  try {
    await fetch(`${b.url}/rest/v1/desk_page_content?on_conflict=page_key,section_key`, {
      method: "POST",
      headers: {
        apikey: b.cle,
        Authorization: `Bearer ${b.cle}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ page_key: PAGE, section_key: section, content_fr: JSON.stringify(valeur) }),
    });
  } catch {
    /* le journal ne casse jamais l envoi */
  }
}

const ETAT_VIDE: Etat = { types: {}, evenements: { contact: [], inscription: [] }, totaux: { contact: 0, inscription: 0 }, derniereAlerte: {} };

export async function lireJournal(): Promise<Etat> {
  const e = await lire<Etat>("etat", ETAT_VIDE);
  return { ...ETAT_VIDE, ...e, evenements: { ...ETAT_VIDE.evenements, ...e.evenements }, totaux: { ...ETAT_VIDE.totaux, ...e.totaux } };
}
export async function lireReglages(): Promise<Reglages> {
  return lire<Reglages>("reglages", REGLAGES_DEFAUT);
}
export async function ecrireReglages(r: Partial<Reglages>): Promise<Reglages> {
  const n = { ...(await lireReglages()), ...r };
  await ecrire("reglages", n);
  return n;
}

export async function journaliserEmail(type: TypeEmail, sujet: string, dest: string | string[]): Promise<void> {
  try {
    const e = await lireJournal();
    const t = e.types[type] ?? { nb: 0, dernier: null, derniers: [] };
    const d = new Date().toISOString();
    t.nb += 1;
    t.dernier = d;
    t.derniers = [{ d, sujet: sujet.slice(0, 160), dest: (Array.isArray(dest) ? dest.join(", ") : dest).slice(0, 120) }, ...t.derniers].slice(0, 30);
    e.types[type] = t;
    await ecrire("etat", e);
  } catch {
    /* jamais bloquant */
  }
}

async function envoyerProprietaire(type: string, sujet: string, corps: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const dest = process.env.DESK_OWNER_EMAIL;
  if (!apiKey || !dest) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Mettrik alertes <noreply@mettrik.ai>",
        to: [dest],
        subject: sujet,
        html: renderEmailLayout({ locale: "fr", preheader: sujet, title: sujet, bodyHtml: `<p>${corps}</p>` }),
        tags: [{ name: "type", value: type }],
      }),
    });
    await journaliserEmail(type, sujet, dest);
  } catch {
    /* jamais bloquant */
  }
}

const LIBELLE: Record<Evenement, { un: string; plusieurs: string }> = {
  contact: { un: "message du formulaire de contact", plusieurs: "messages du formulaire de contact" },
  inscription: { un: "création de compte", plusieurs: "créations de compte" },
};

/** A appeler apres chaque message de contact accepte et chaque compte cree. */
export async function evenement(kind: Evenement): Promise<void> {
  try {
    const r = await lireReglages();
    const e = await lireJournal();
    const now = Date.now();
    const iso = new Date(now).toISOString();
    const liste = [...(e.evenements[kind] ?? []), iso].filter((d) => now - Date.parse(d) < 24 * 3600 * 1000);
    e.evenements[kind] = liste;
    e.totaux[kind] = (e.totaux[kind] ?? 0) + 1;
    const envois: Promise<void>[] = [];
    const lib = LIBELLE[kind];
    if (r.actif) {
      // Notification : cap du Ne message (formulaire de contact uniquement).
      if (kind === "contact" && e.totaux.contact === r.notifContactSeuil) {
        envois.push(envoyerProprietaire("notif-contact-seuil", `Mettrik : ${r.notifContactSeuil} messages reçus par le formulaire de contact`, `Le formulaire de contact vient de dépasser ${r.notifContactSeuil} messages envoyés au total.`));
      }
      const rafale = liste.filter((d) => now - Date.parse(d) < r.rafaleMinutes * 60 * 1000).length;
      const cleR = `rafale-${kind}`;
      if (rafale > r.rafaleNb && (!e.derniereAlerte[cleR] || now - Date.parse(e.derniereAlerte[cleR]) > r.rafaleMinutes * 60 * 1000)) {
        e.derniereAlerte[cleR] = iso;
        envois.push(envoyerProprietaire(`alerte-rafale-${kind}`, `🔴 Alerte Mettrik : ${rafale} ${lib.plusieurs} en ${r.rafaleMinutes} min`, `${rafale} ${lib.plusieurs} en moins de ${r.rafaleMinutes} minutes (seuil : plus de ${r.rafaleNb}). Vérifier qu'il ne s'agit pas d'un robot.`));
      }
      const cleJ = `jour-${kind}`;
      if (liste.length > r.jourNb && (!e.derniereAlerte[cleJ] || now - Date.parse(e.derniereAlerte[cleJ]) > 24 * 3600 * 1000)) {
        e.derniereAlerte[cleJ] = iso;
        envois.push(envoyerProprietaire(`alerte-jour-${kind}`, `🔴 Alerte Mettrik : ${liste.length} ${lib.plusieurs} en 24 h`, `${liste.length} ${lib.plusieurs} sur les dernières 24 heures (seuil : plus de ${r.jourNb}).`));
      }
    }
    await ecrire("etat", e);
    await Promise.all(envois);
  } catch {
    /* jamais bloquant */
  }
}
