"use client";

import { useState } from "react";
import { Mail, Smartphone, Monitor, Copy, Check } from "lucide-react";

/**
 * MOCKUPS — 3 propositions de templates email Mettrik AI.
 *
 * Chaque template est rendu pour 4 cas d'usage :
 *   - Confirm signup
 *   - Magic link
 *   - Password reset
 *   - Welcome (premier email après confirmation)
 *
 * Tu choisis 1 design, je l'applique à tous les templates et on les colle
 * dans Supabase Dashboard → Auth → Email Templates.
 *
 * Adresses expéditeur existantes (Spacemail) : contact@mettrik.ai,
 *                                              support@mettrik.ai
 * À créer si besoin pour les transactionnels : noreply@mettrik.ai
 *
 * Affichage : sender = "Mettrik AI <noreply@mettrik.ai>" pour les emails
 * automatiques (signup, magic link, reset). Pour les comm humaines (réponse
 * support, newsletter) : utilise contact@ ou support@.
 */

type Template = "confirm" | "magic" | "reset" | "welcome";
type Design = "minimal" | "branded" | "editorial";

const TEMPLATE_LABELS: Record<Template, { label: string; subject: string; sender: string }> = {
  confirm: { label: "Confirm signup", subject: "Confirme ton inscription Mettrik AI", sender: "noreply@mettrik.ai" },
  magic: { label: "Magic link", subject: "Ton lien de connexion Mettrik AI", sender: "noreply@mettrik.ai" },
  reset: { label: "Password reset", subject: "Réinitialise ton mot de passe Mettrik AI", sender: "noreply@mettrik.ai" },
  welcome: { label: "Welcome", subject: "Bienvenue sur Mettrik AI", sender: "contact@mettrik.ai" },
};

const DESIGN_LABELS: Record<Design, { label: string; description: string; tone: "violet" | "amber" | "cyan" }> = {
  minimal: { label: "Minimal", description: "Très épuré, fond blanc, structure type Stripe / Linear, max 1 couleur d'accent (violet brand).", tone: "violet" },
  branded: { label: "Branded", description: "Fond sombre, accents néon violet/cyan, wordmark Mettrik AI en hero, le plus marqué brand.", tone: "cyan" },
  editorial: { label: "Editorial", description: "Cream warm, typographie display, ton plus chaleureux, parle au lecteur en first-person.", tone: "amber" },
};

export function MockupEmailTemplates() {
  const [tpl, setTpl] = useState<Template>("confirm");
  const [design, setDesign] = useState<Design>("branded");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState(false);

  const html = renderTemplate(tpl, design);

  async function copyHTML() {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-[12px] text-amber-200">
        ⚠️ <strong>3 propositions de templates email Mettrik AI</strong>. Switch design / template / device avec les boutons ci-dessous. Une fois choisi : copie le HTML et colle-le dans Supabase Dashboard → Auth → Email Templates.
      </div>

      <h2 className="mb-4 font-display text-[24px] font-bold tracking-tight text-zinc-50">
        Email templates · 3 designs
      </h2>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">Template :</span>
          <div className="inline-flex gap-0.5 rounded-md border border-white/10 bg-white/[0.03] p-0.5">
            {(Object.entries(TEMPLATE_LABELS) as [Template, typeof TEMPLATE_LABELS["confirm"]][]).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setTpl(k)}
                className={`rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                  tpl === k ? "bg-violet-500/25 text-violet-100" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <span className="text-zinc-600">·</span>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">Design :</span>
          <div className="inline-flex gap-0.5 rounded-md border border-white/10 bg-white/[0.03] p-0.5">
            {(Object.entries(DESIGN_LABELS) as [Design, typeof DESIGN_LABELS["minimal"]][]).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setDesign(k)}
                className={`rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                  design === k ? "bg-violet-500/25 text-violet-100" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <span className="text-zinc-600">·</span>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">Device :</span>
          <div className="inline-flex gap-0.5 rounded-md border border-white/10 bg-white/[0.03] p-0.5">
            <button onClick={() => setDevice("desktop")}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11.5px] font-medium ${device === "desktop" ? "bg-violet-500/25 text-violet-100" : "text-zinc-400"}`}>
              <Monitor className="size-3" /> Desktop
            </button>
            <button onClick={() => setDevice("mobile")}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11.5px] font-medium ${device === "mobile" ? "bg-violet-500/25 text-violet-100" : "text-zinc-400"}`}>
              <Smartphone className="size-3" /> Mobile
            </button>
          </div>
        </div>

        <button
          onClick={copyHTML}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-medium text-violet-100 hover:bg-violet-500/25"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copié" : "Copier le HTML"}
        </button>
      </div>

      {/* Sender card */}
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-baseline gap-3 text-[13px]">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">FROM :</span>
          <span className="font-mono text-zinc-200">Mettrik AI &lt;{TEMPLATE_LABELS[tpl].sender}&gt;</span>
          <span className="text-zinc-600">·</span>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">SUBJECT :</span>
          <span className="text-zinc-100">{TEMPLATE_LABELS[tpl].subject}</span>
        </div>
        <p className="mt-2 text-[11.5px] text-zinc-500">{DESIGN_LABELS[design].description}</p>
      </div>

      {/* Preview */}
      <div className={`mx-auto rounded-xl border border-white/10 bg-zinc-100 p-4 ${device === "mobile" ? "max-w-sm" : "max-w-2xl"}`}>
        <div className="rounded-lg overflow-hidden bg-white">
          <iframe
            srcDoc={html}
            className="block w-full"
            style={{ height: device === "mobile" ? "640px" : "720px", border: "none" }}
            title="Email preview"
          />
        </div>
      </div>

      {/* HTML source toggle */}
      <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <summary className="cursor-pointer text-[12.5px] font-medium text-zinc-300">Voir le HTML source ({html.length} caractères)</summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-400">
          {html}
        </pre>
      </details>
    </div>
  );
}

/* ============================================================ */
/* TEMPLATE RENDERERS                                             */
/* ============================================================ */

function renderTemplate(tpl: Template, design: Design): string {
  const content = TEMPLATE_CONTENT[tpl];
  if (design === "minimal") return designMinimal(tpl, content);
  if (design === "branded") return designBranded(tpl, content);
  return designEditorial(tpl, content);
}

const TEMPLATE_CONTENT: Record<Template, { headline: string; intro: string; cta: string; ctaUrl: string; outro: string }> = {
  confirm: {
    headline: "Confirme ton inscription",
    intro: "Bienvenue sur Mettrik AI. Click le bouton ci-dessous pour confirmer ton adresse email et accéder à l'app.",
    cta: "Confirmer mon email",
    ctaUrl: "{{ .ConfirmationURL }}",
    outro: "Si tu n'as pas créé de compte, tu peux ignorer ce message.",
  },
  magic: {
    headline: "Ton lien de connexion",
    intro: "Click le bouton ci-dessous pour te connecter à Mettrik AI. Ce lien expire dans 1 heure.",
    cta: "Me connecter",
    ctaUrl: "{{ .ConfirmationURL }}",
    outro: "Si tu n'as pas demandé ce lien, tu peux ignorer ce message.",
  },
  reset: {
    headline: "Réinitialise ton mot de passe",
    intro: "Tu as demandé à réinitialiser ton mot de passe Mettrik AI. Click le bouton pour choisir un nouveau mot de passe.",
    cta: "Choisir un nouveau mot de passe",
    ctaUrl: "{{ .ConfirmationURL }}",
    outro: "Si tu n'as pas demandé cette réinitialisation, ignore ce message. Ton mot de passe actuel reste valide.",
  },
  welcome: {
    headline: "Bienvenue sur Mettrik AI",
    intro: "Ton compte est actif. Découvre les KPIs de Google et Meta en accès libre, et passe en Premium pour accéder à toutes les sociétés couvertes.",
    cta: "Voir Google →",
    ctaUrl: "https://www.mettrik.ai/googl",
    outro: "Une question ? Réponds simplement à cet email, je te réponds personnellement.",
  },
};

/* DESIGN 1 : MINIMAL */
function designMinimal(tpl: Template, c: typeof TEMPLATE_CONTENT["confirm"]): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mettrik AI</title>
<style>
  body { margin: 0; padding: 0; background: #f7f7f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #0a0a0a; }
  .wrap { max-width: 540px; margin: 0 auto; padding: 40px 24px; }
  .card { background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 32px; }
  .brand { font-weight: 700; font-size: 14px; color: #0a0a0a; letter-spacing: -0.01em; margin-bottom: 24px; }
  .brand-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #7c3aed; margin-right: 8px; vertical-align: middle; }
  h1 { font-size: 22px; font-weight: 700; line-height: 1.3; margin: 0 0 16px; color: #0a0a0a; }
  p { font-size: 14px; line-height: 1.6; color: #404040; margin: 0 0 16px; }
  .btn { display: inline-block; background: #0a0a0a; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 8px 0; }
  .outro { font-size: 12px; color: #737373; margin-top: 24px; }
  .footer { font-size: 11px; color: #a3a3a3; text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5; }
  .footer a { color: #737373; text-decoration: none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="brand"><span class="brand-dot"></span>Mettrik AI</div>
      <h1>${c.headline}</h1>
      <p>${c.intro}</p>
      <a href="${c.ctaUrl}" class="btn">${c.cta}</a>
      <p class="outro">${c.outro}</p>
    </div>
    <div class="footer">
      Mettrik AI · KPI Intelligence pour investisseurs<br>
      <a href="https://www.mettrik.ai">www.mettrik.ai</a> · <a href="mailto:contact@mettrik.ai">contact@mettrik.ai</a>
    </div>
  </div>
</body>
</html>`;
}

/* DESIGN 2 : BRANDED */
function designBranded(tpl: Template, c: typeof TEMPLATE_CONTENT["confirm"]): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mettrik AI</title>
<style>
  body { margin: 0; padding: 0; background: #050507; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #fafafa; }
  .wrap { max-width: 540px; margin: 0 auto; padding: 32px 16px; }
  .header { text-align: center; padding: 20px 0 32px; }
  .brand { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; background: linear-gradient(135deg, #a78bfa, #22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tagline { font-size: 11px; color: #a1a1aa; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 4px; }
  .card { background: linear-gradient(180deg, #0a0a0a, #070707); border: 1px solid #1f1f1f; border-radius: 16px; padding: 36px; position: relative; overflow: hidden; }
  .glow { position: absolute; top: -60px; right: -60px; width: 200px; height: 200px; background: radial-gradient(ellipse, rgba(167,139,250,0.18), transparent 70%); pointer-events: none; }
  h1 { font-size: 24px; font-weight: 700; line-height: 1.3; margin: 0 0 16px; color: #fafafa; position: relative; }
  p { font-size: 14px; line-height: 1.65; color: #d4d4d8; margin: 0 0 20px; position: relative; }
  .btn { display: inline-block; background: linear-gradient(135deg, #a78bfa, #7c3aed); color: #ffffff !important; text-decoration: none; padding: 13px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; margin: 8px 0; box-shadow: 0 4px 16px rgba(124,58,237,0.3); position: relative; }
  .outro { font-size: 12px; color: #71717a; margin-top: 24px; padding-top: 20px; border-top: 1px solid #1f1f1f; position: relative; }
  .footer { font-size: 11px; color: #71717a; text-align: center; margin-top: 28px; line-height: 1.6; }
  .footer a { color: #a1a1aa; text-decoration: none; }
  .footer a:hover { color: #a78bfa; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="brand">Mettrik AI</div>
      <div class="tagline">KPI Intelligence</div>
    </div>
    <div class="card">
      <div class="glow"></div>
      <h1>${c.headline}</h1>
      <p>${c.intro}</p>
      <a href="${c.ctaUrl}" class="btn">${c.cta}</a>
      <div class="outro">${c.outro}</div>
    </div>
    <div class="footer">
      <strong style="color: #d4d4d8;">Mettrik AI</strong> · KPI Intelligence pour investisseurs<br>
      <a href="https://www.mettrik.ai">www.mettrik.ai</a> · <a href="mailto:contact@mettrik.ai">contact@mettrik.ai</a><br>
      <span style="font-size: 10px; color: #52525b; display: inline-block; margin-top: 8px;">Le contenu de ce site ne constitue pas un conseil en investissement.</span>
    </div>
  </div>
</body>
</html>`;
}

/* DESIGN 3 : EDITORIAL */
function designEditorial(tpl: Template, c: typeof TEMPLATE_CONTENT["confirm"]): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mettrik AI</title>
<style>
  body { margin: 0; padding: 0; background: #faf8f3; font-family: Georgia, "Iowan Old Style", serif; color: #1a1410; }
  .wrap { max-width: 540px; margin: 0 auto; padding: 48px 24px; }
  .brand { font-family: Georgia, serif; font-style: italic; font-size: 26px; font-weight: 700; color: #1a1410; margin-bottom: 4px; letter-spacing: -0.01em; }
  .tagline { font-size: 11px; color: #7c6c58; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 32px; }
  hr.line { border: none; border-top: 1px solid #e8dfd1; margin: 24px 0; }
  h1 { font-family: Georgia, serif; font-size: 26px; font-weight: 700; line-height: 1.25; margin: 0 0 20px; color: #1a1410; letter-spacing: -0.005em; }
  p { font-size: 15px; line-height: 1.7; color: #2c2520; margin: 0 0 18px; font-family: Georgia, serif; }
  p.lead { font-size: 17px; color: #1a1410; }
  .btn { display: inline-block; background: #1a1410; color: #faf8f3 !important; text-decoration: none; padding: 13px 26px; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.01em; margin: 12px 0 8px; }
  .outro { font-size: 13px; color: #7c6c58; margin-top: 24px; font-style: italic; }
  .signature { margin-top: 28px; font-size: 14px; color: #2c2520; font-family: Georgia, serif; }
  .signature .name { font-weight: 700; }
  .footer { font-size: 11px; color: #9b8a72; text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e8dfd1; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  .footer a { color: #7c6c58; text-decoration: none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">Mettrik <em style="font-style: italic;">AI</em></div>
    <div class="tagline">KPI Intelligence pour investisseurs</div>
    <hr class="line">
    <h1>${c.headline}</h1>
    <p class="lead">${c.intro}</p>
    <a href="${c.ctaUrl}" class="btn">${c.cta}</a>
    <p class="outro">${c.outro}</p>
    ${tpl === "welcome" ? `
    <div class="signature">
      <div class="name">— L'équipe Mettrik AI</div>
      <div style="color: #7c6c58; font-size: 12px;">contact@mettrik.ai</div>
    </div>` : ""}
    <div class="footer">
      <a href="https://www.mettrik.ai">www.mettrik.ai</a> · <a href="mailto:contact@mettrik.ai">contact@mettrik.ai</a><br>
      <span style="font-size: 10px; display: inline-block; margin-top: 8px;">Le contenu de ce site ne constitue pas un conseil en investissement.</span>
    </div>
  </div>
</body>
</html>`;
}
