import { renderEmailLayout, emailParagraph as p } from "@/lib/email/layout";

/**
 * E-mail du code de seconde verification admin (9 oct 2026). Envoi direct
 * par Resend, expediteur de la marque. Pas de passage par sendEmail : la
 * regle « aucun e-mail client » et le mode EMAIL_DRY_RUN de niveau 1 ne
 * doivent pas couper l acces du proprietaire a ses outils.
 */
export async function envoyerCodeAdmin(email: string, code: string, apiKey: string): Promise<{ ok: boolean; statut?: number; id?: string }> {
  const corps =
    p(`Voici votre code pour accéder aux outils internes :`) +
    `<p style="margin:18px 0;font-size:32px;letter-spacing:8px;font-weight:700;color:#ffffff;font-family:monospace">${code}</p>` +
    p(`Il est valable 10 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message et changez votre mot de passe.`);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Mettrik AI <noreply@mettrik.ai>",
      to: [email],
      subject: `Votre code de vérification Mettrik : ${code}`,
      text: `Votre code de vérification Mettrik : ${code}\nValable 10 minutes.`,
      html: renderEmailLayout({ locale: "fr", preheader: "Code de vérification valable 10 minutes", title: "Code de vérification", bodyHtml: corps }),
      tags: [{ name: "type", value: "admin-2fa" }],
    }),
  }).catch(() => null);
  if (!r || !r.ok) return { ok: false, statut: r?.status };
  const j = (await r.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: j.id };
}
