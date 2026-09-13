import { promises as fs } from "fs";
import path from "path";
import { ONBOARDING_TEMPLATES, ONBOARDING_DAYS, type OnboardingKey } from "@/lib/email/onboarding-templates";
import { WELCOME_BODY, WELCOME_SUBJECT, BILLING_BODY, BILLING_SUBJECT } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

/** Yann 13 sept 2026 : tous les emails envoyes par Mettrik, avec leur rendu reel. */
type Mail = { id: string; titre: string; sujet: string; envoi: string; html: string };

async function authMails(): Promise<Mail[]> {
  const dir = path.join(process.cwd(), "email-templates");
  const fiches: { f: string; titre: string; sujet: string; envoi: string }[] = [
    { f: "confirm-signup.html", titre: "Confirmation d inscription", sujet: "Confirme ton adresse", envoi: "À l inscription par email" },
    { f: "change-email.html", titre: "Changement d adresse email", sujet: "Confirme ta nouvelle adresse", envoi: "Quand l utilisateur change son email depuis son compte" },
    { f: "password-reset.html", titre: "Réinitialisation du mot de passe", sujet: "Choisis un nouveau mot de passe", envoi: "Depuis « mot de passe oublié » ou l administration" },
    { f: "magic-link.html", titre: "Lien de connexion", sujet: "Ton lien de connexion", envoi: "Connexion sans mot de passe" },
    { f: "invite.html", titre: "Invitation", sujet: "Tu es invité sur Mettrik", envoi: "Invitation envoyée depuis l administration" },
  ];
  const out: Mail[] = [];
  for (const x of fiches) {
    try {
      const html = await fs.readFile(path.join(dir, x.f), "utf-8");
      out.push({ id: x.f, titre: x.titre, sujet: x.sujet, envoi: x.envoi, html });
    } catch { /* modele absent */ }
  }
  return out;
}

function appMails(): Mail[] {
  const onb = (Object.keys(ONBOARDING_TEMPLATES) as OnboardingKey[]).map((k) => ({
    id: `onboarding-${k}`,
    titre: `Accompagnement, jour ${ONBOARDING_DAYS[k]}`,
    sujet: ONBOARDING_TEMPLATES[k].subject.fr,
    envoi: `Automatique, ${ONBOARDING_DAYS[k]} jour(s) après l inscription`,
    html: ONBOARDING_TEMPLATES[k].body.fr("Yann"),
  }));
  return [
    { id: "welcome", titre: "Bienvenue", sujet: WELCOME_SUBJECT.fr, envoi: "À la création du compte", html: WELCOME_BODY.fr("Yann") },
    ...onb,
    { id: "billing-failed", titre: "Échec de paiement", sujet: BILLING_SUBJECT.fr, envoi: "Quand un prélèvement échoue", html: BILLING_BODY.fr },
  ];
}

function Carte({ m }: { m: Mail }) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-[13.5px] font-semibold text-zinc-100">{m.titre}</h3>
        <span className="font-mono text-[10.5px] text-zinc-500">{m.id}</span>
      </div>
      <p className="mt-0.5 text-[12px] text-zinc-400">Objet : {m.sujet}</p>
      <p className="text-[11.5px] text-zinc-500">{m.envoi}</p>
      <iframe title={m.titre} srcDoc={m.html} className="mt-2 h-[460px] w-full rounded-lg border border-white/10 bg-white" />
    </section>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  if (process.env.VISUAL_AUDIT_TOKEN && sp.audit_token !== process.env.VISUAL_AUDIT_TOKEN) {
    return <main className="p-8 text-zinc-300">Jeton requis.</main>;
  }
  const [auth, app] = [await authMails(), appMails()];
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <h1 className="font-display text-[26px] font-bold">Tous les emails envoyés</h1>
      <p className="mt-1 text-[13px] text-zinc-400">
        {app.length + auth.length} emails : {app.length} envoyés par Mettrik et {auth.length} par le service de connexion, dont celui de changement d adresse email. Rendu réel, en français.
      </p>
      <h2 className="mt-6 text-[16px] font-semibold">Envoyés par Mettrik ({app.length})</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">{app.map((m) => <Carte key={m.id} m={m} />)}</div>
      <h2 className="mt-8 text-[16px] font-semibold">Connexion et sécurité ({auth.length})</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">{auth.map((m) => <Carte key={m.id} m={m} />)}</div>
    </main>
  );
}
