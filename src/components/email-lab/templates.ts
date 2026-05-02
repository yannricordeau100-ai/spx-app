import { type EmailCopy } from "./translations";

/**
 * Chaque template retourne un HTML complet (DOCTYPE + body) prêt à coller
 * dans Supabase. Les copies sont passées en argument pour i18n.
 *
 * Tous les designs respectent :
 *   - largeur 560px (responsive mobile)
 *   - inline CSS (clients email = pas de <style>)
 *   - 1 seul CTA principal
 *   - {{ .ConfirmationURL }} dans Supabase, ici remplacé par copy.url pour preview
 *   - clauses anti-spam (preheader, alt-text, manual link visible)
 */
export type EmailTemplate = {
  id: string;
  name: string;
  tagline: string;
  render: (copy: EmailCopy, confirmUrl?: string) => string;
};

const wrap = (body: string, bg: string, preheader: string) => `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
</head><body style="margin:0;padding:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e7e7ec;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${bg};opacity:0;">${preheader}</div>
${body}
</body></html>`;

/* ─── 1. EDITORIAL — DA Mettrik actuelle (dark + violet/cyan glow) ────────── */
const editorial: EmailTemplate = {
  id: "editorial",
  name: "Editorial",
  tagline: "Dark éditorial · halos violet/cyan, hero en serif",
  render: (c, url) => {
    const u = url ?? c.url;
    return wrap(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050507;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#0b0b10;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(139,92,246,0.25);">
<tr><td style="background:linear-gradient(135deg,rgba(139,92,246,0.35) 0%,rgba(34,211,238,0.18) 60%,rgba(11,11,16,0) 100%);padding:28px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><span style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#fff;font-family:Georgia,'Times New Roman',serif;">${c.brand}</span><span style="margin-left:10px;font-size:10px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:#c4b5fd;">${c.subtitle}</span></td>
<td align="right" style="vertical-align:middle;"><span style="display:inline-block;padding:5px 10px;border-radius:999px;background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.35);font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#67e8f9;">${c.badge}</span></td>
</tr></table></td></tr>
<tr><td style="padding:40px 32px 24px;"><h1 style="margin:0 0 14px;font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:#fff;font-family:Georgia,'Times New Roman',serif;">${c.h1Line1}<br>${c.h1Line2}</h1>
<p style="margin:0;font-size:15px;line-height:1.65;color:#b5b5be;">${c.body}</p></td></tr>
<tr><td style="padding:8px 32px 28px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background:linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%);border-radius:14px;box-shadow:0 14px 40px -14px rgba(139,92,246,0.65);"><a href="${u}" target="_blank" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;border-radius:14px;">${c.cta} &rarr;</a></td></tr></table>
<p style="margin:14px 0 0;font-size:12px;color:#74747e;">${c.expiry}</p></td></tr>
<tr><td style="padding:8px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:14px;"><tr><td style="padding:18px 20px;">
<p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:#a78bfa;">${c.teaserTitle}</p>
${c.teasers.map((t) => `<p style="margin:6px 0;font-size:14px;color:#d6d6dc;line-height:1.55;"><span style="color:#67e8f9;">&#9670;</span>&nbsp;&nbsp;${t}</p>`).join("")}
</td></tr></table></td></tr>
<tr><td style="padding:24px 32px 8px;"><p style="margin:0 0 8px;font-size:11px;color:#74747e;">${c.manualLinkLabel}</p><p style="margin:0;font-size:12px;word-break:break-all;line-height:1.5;"><a href="${u}" style="color:#a78bfa;text-decoration:underline;">${u}</a></p></td></tr>
<tr><td style="padding:24px 32px 28px;"><div style="height:1px;background:rgba(255,255,255,0.06);"></div>
<p style="margin:14px 0 6px;font-size:12px;color:#6b6b75;">${c.footerLine1}</p>
<p style="margin:0;font-size:11px;color:#5a5a64;line-height:1.6;">${c.footerLine2}</p></td></tr>
</table></td></tr></table>`,
      "#050507",
      c.body
    );
  },
};

/* ─── 2. BRUTALIST MONO — JetBrains, ASCII, monochrome accent violet ──────── */
const brutalist: EmailTemplate = {
  id: "brutalist",
  name: "Brutalist Mono",
  tagline: "JetBrains Mono · ASCII frames · 1 accent violet",
  render: (c, url) => {
    const u = url ?? c.url;
    const mono = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
    return wrap(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;font-family:${mono};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:0;">
<tr><td style="padding:24px 28px;border-bottom:1px solid #1a1a1a;">
<p style="margin:0;font-size:11px;color:#666;font-family:${mono};letter-spacing:0.05em;">$ mettrik &mdash;version</p>
<p style="margin:6px 0 0;font-size:14px;color:#fff;font-family:${mono};">${c.brand.toLowerCase()}@v1.0.0 :: ${c.subtitle.toLowerCase()}</p>
</td></tr>
<tr><td style="padding:36px 28px 12px;">
<p style="margin:0 0 6px;font-size:11px;color:#8b5cf6;font-family:${mono};letter-spacing:0.1em;">[ welcome ]</p>
<h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:600;color:#fff;font-family:${mono};letter-spacing:-0.01em;">${c.h1Line2}</h1>
</td></tr>
<tr><td style="padding:18px 28px;"><pre style="margin:0;font-family:${mono};font-size:12px;line-height:1.7;color:#888;white-space:pre-wrap;">&gt; ${c.body}</pre></td></tr>
<tr><td style="padding:28px 28px;">
<a href="${u}" target="_blank" style="display:inline-block;padding:14px 22px;font-family:${mono};font-size:14px;font-weight:600;color:#0a0a0a;background:#a78bfa;text-decoration:none;border-radius:0;border:1px solid #a78bfa;">[&nbsp;${c.cta}&nbsp;]&nbsp;&rarr;</a>
<p style="margin:12px 0 0;font-family:${mono};font-size:11px;color:#666;">// ${c.expiry}</p>
</td></tr>
<tr><td style="padding:8px 28px 12px;">
<p style="margin:0 0 8px;font-family:${mono};font-size:10px;color:#8b5cf6;letter-spacing:0.1em;">// ${c.teaserTitle.toUpperCase()}</p>
${c.teasers.map((t, i) => `<p style="margin:4px 0;font-family:${mono};font-size:12px;color:#aaa;">[${String(i + 1).padStart(2, "0")}] ${t}</p>`).join("")}
</td></tr>
<tr><td style="padding:24px 28px 16px;border-top:1px solid #1a1a1a;">
<p style="margin:0 0 6px;font-family:${mono};font-size:10px;color:#555;">${c.manualLinkLabel}</p>
<p style="margin:0;font-family:${mono};font-size:11px;word-break:break-all;"><a href="${u}" style="color:#a78bfa;">${u}</a></p>
</td></tr>
<tr><td style="padding:14px 28px 24px;">
<p style="margin:0 0 4px;font-family:${mono};font-size:10px;color:#555;">${c.footerLine1}</p>
<p style="margin:0;font-family:${mono};font-size:10px;color:#444;line-height:1.55;">${c.footerLine2}</p>
</td></tr>
</table></td></tr></table>`,
      "#0a0a0a",
      c.body
    );
  },
};

/* ─── 3. MAGAZINE COVER — gros titre serif, mise en page éditoriale ───────── */
const magazine: EmailTemplate = {
  id: "magazine",
  name: "Magazine Cover",
  tagline: "Hero typographique · pleine page · style édito print",
  render: (c, url) => {
    const u = url ?? c.url;
    const serif = "'Playfair Display',Georgia,'Times New Roman',serif";
    return wrap(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0e0a0a;">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#0e0a0a;">
<tr><td style="padding:24px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><span style="font-family:${serif};font-size:26px;font-weight:700;letter-spacing:0.04em;color:#fff;font-style:italic;">${c.brand}</span></td>
<td align="right"><span style="font-size:10px;letter-spacing:0.32em;color:#c9a86a;text-transform:uppercase;font-weight:600;">VOL. 01 &middot; ${c.subtitle}</span></td>
</tr></table>
<div style="height:2px;background:#c9a86a;margin:14px 0 0;"></div>
</td></tr>
<tr><td style="padding:60px 28px 30px;">
<p style="margin:0 0 18px;font-size:11px;letter-spacing:0.32em;color:#c9a86a;text-transform:uppercase;font-weight:700;">— ${c.badge} —</p>
<h1 style="margin:0;font-family:${serif};font-size:54px;line-height:0.98;font-weight:900;letter-spacing:-0.025em;color:#fff;">${c.h1Line1}<br><em style="font-weight:400;color:#c9a86a;">${c.h1Line2}</em></h1>
</td></tr>
<tr><td style="padding:0 28px 24px;"><div style="width:80px;height:1px;background:#c9a86a;margin:8px 0 24px;"></div>
<p style="margin:0;font-size:16px;line-height:1.7;color:#cfc6bf;font-family:${serif};">${c.body}</p>
</td></tr>
<tr><td style="padding:8px 28px 36px;">
<a href="${u}" target="_blank" style="display:inline-block;padding:16px 32px;font-size:13px;font-weight:700;letter-spacing:0.18em;color:#0e0a0a;background:#c9a86a;text-decoration:none;text-transform:uppercase;border-radius:0;">${c.cta}</a>
<p style="margin:14px 0 0;font-size:11px;color:#7a7066;font-style:italic;">${c.expiry}</p>
</td></tr>
<tr><td style="padding:0 28px 28px;">
<div style="border-top:1px solid #2a2018;padding-top:20px;">
<p style="margin:0 0 12px;font-size:10px;letter-spacing:0.3em;color:#c9a86a;text-transform:uppercase;font-weight:700;">${c.teaserTitle}</p>
${c.teasers.map((t, i) => `<p style="margin:8px 0;font-family:${serif};font-size:14px;color:#cfc6bf;line-height:1.5;"><span style="color:#c9a86a;font-weight:700;">${String(i + 1).padStart(2, "0")}.</span> &nbsp; ${t}</p>`).join("")}
</div>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #2a2018;">
<p style="margin:0 0 6px;font-size:10px;color:#7a7066;letter-spacing:0.05em;">${c.manualLinkLabel}</p>
<p style="margin:0;font-size:11px;word-break:break-all;"><a href="${u}" style="color:#c9a86a;text-decoration:underline;">${u}</a></p>
</td></tr>
<tr><td style="padding:14px 28px 28px;">
<p style="margin:0 0 4px;font-size:10px;color:#7a7066;font-style:italic;">${c.footerLine1}</p>
<p style="margin:0;font-size:9px;color:#5a5048;line-height:1.6;">${c.footerLine2}</p>
</td></tr>
</table></td></tr></table>`,
      "#0e0a0a",
      c.body
    );
  },
};

/* ─── 4. HOLOGRAPHIC — gradient mesh iridescent + frosted glass card ──────── */
const holographic: EmailTemplate = {
  id: "holographic",
  name: "Holographic",
  tagline: "Mesh iridescent multi-couleurs · carte glass",
  render: (c, url) => {
    const u = url ?? c.url;
    return wrap(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#04040a;background-image:radial-gradient(ellipse at 20% 0%,rgba(168,85,247,0.45) 0%,transparent 45%),radial-gradient(ellipse at 80% 30%,rgba(34,211,238,0.4) 0%,transparent 50%),radial-gradient(ellipse at 50% 100%,rgba(244,114,182,0.35) 0%,transparent 55%);">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:rgba(10,10,20,0.55);border:1px solid rgba(255,255,255,0.18);border-radius:24px;">
<tr><td style="padding:28px 32px 0;">
<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:linear-gradient(90deg,#a855f7,#22d3ee,#f472b6);font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#04040a;">${c.brand} &middot; ${c.subtitle}</span>
</td></tr>
<tr><td style="padding:28px 32px 8px;">
<h1 style="margin:0;font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;background:linear-gradient(135deg,#fff 0%,#a855f7 40%,#22d3ee 70%,#f472b6 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#fff;">${c.h1Line1}<br>${c.h1Line2}</h1>
</td></tr>
<tr><td style="padding:8px 32px 24px;">
<p style="margin:0;font-size:15px;line-height:1.7;color:#d8d8e4;">${c.body}</p>
</td></tr>
<tr><td style="padding:0 32px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background:linear-gradient(90deg,#a855f7 0%,#22d3ee 50%,#f472b6 100%);border-radius:14px;padding:1px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background:#0a0a14;border-radius:13px;"><a href="${u}" target="_blank" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;border-radius:13px;">${c.cta} &rarr;</a></td></tr></table></td></tr></table>
<p style="margin:14px 0 0;font-size:11px;color:#9090a8;">${c.expiry}</p>
</td></tr>
<tr><td style="padding:0 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;backdrop-filter:blur(20px);">
<tr><td style="padding:18px 20px;">
<p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;background:linear-gradient(90deg,#a855f7,#22d3ee);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#a855f7;">${c.teaserTitle}</p>
${c.teasers.map((t, i) => {
  const color = ["#a855f7", "#22d3ee", "#f472b6"][i];
  return `<p style="margin:6px 0;font-size:13.5px;color:#d8d8e4;line-height:1.55;"><span style="color:${color};font-weight:700;">●</span>&nbsp;&nbsp;${t}</p>`;
}).join("")}
</td></tr></table>
</td></tr>
<tr><td style="padding:0 32px 16px;">
<p style="margin:0 0 6px;font-size:10px;color:#7a7a8e;">${c.manualLinkLabel}</p>
<p style="margin:0;font-size:11px;word-break:break-all;"><a href="${u}" style="color:#a855f7;text-decoration:underline;">${u}</a></p>
</td></tr>
<tr><td style="padding:14px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);">
<p style="margin:0 0 4px;font-size:11px;color:#9090a8;">${c.footerLine1}</p>
<p style="margin:0;font-size:10px;color:#6a6a80;line-height:1.6;">${c.footerLine2}</p>
</td></tr>
</table></td></tr></table>`,
      "#04040a",
      c.body
    );
  },
};

/* ─── 5. LUMEN LIGHT — fond crème, espace blanc, accent violet fin ────────── */
const lumen: EmailTemplate = {
  id: "lumen",
  name: "Lumen Light",
  tagline: "Fond clair · respiration · raffiné",
  render: (c, url) => {
    const u = url ?? c.url;
    const serif = "Georgia,'Times New Roman',serif";
    return wrap(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f3ee;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#fbfaf6;border:1px solid #e8e4d9;border-radius:18px;">
<tr><td style="padding:36px 36px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><span style="font-family:${serif};font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#1a1a22;">${c.brand}</span><span style="margin-left:10px;font-size:10px;letter-spacing:0.22em;color:#8b5cf6;text-transform:uppercase;font-weight:600;">${c.subtitle}</span></td>
</tr></table>
<div style="height:1px;background:#e8e4d9;margin:18px 0 0;"></div>
</td></tr>
<tr><td style="padding:48px 36px 16px;">
<p style="margin:0 0 14px;font-size:11px;letter-spacing:0.22em;color:#8b5cf6;text-transform:uppercase;font-weight:700;">${c.badge}</p>
<h1 style="margin:0;font-family:${serif};font-size:34px;line-height:1.18;font-weight:700;letter-spacing:-0.02em;color:#1a1a22;">${c.h1Line1}<br>${c.h1Line2}</h1>
</td></tr>
<tr><td style="padding:0 36px 32px;">
<p style="margin:0;font-size:16px;line-height:1.75;color:#52525b;">${c.body}</p>
</td></tr>
<tr><td style="padding:0 36px 36px;">
<a href="${u}" target="_blank" style="display:inline-block;padding:14px 26px;font-size:14px;font-weight:700;color:#fff;background:#1a1a22;text-decoration:none;border-radius:10px;">${c.cta} &rarr;</a>
<p style="margin:14px 0 0;font-size:12px;color:#8a8a92;">${c.expiry}</p>
</td></tr>
<tr><td style="padding:0 36px 28px;">
<div style="border-top:1px solid #e8e4d9;padding-top:22px;">
<p style="margin:0 0 14px;font-size:10px;letter-spacing:0.22em;color:#8b5cf6;text-transform:uppercase;font-weight:700;">${c.teaserTitle}</p>
${c.teasers.map((t) => `<p style="margin:8px 0;font-size:14px;color:#3a3a44;line-height:1.55;"><span style="color:#8b5cf6;">&mdash;</span>&nbsp;&nbsp;${t}</p>`).join("")}
</div>
</td></tr>
<tr><td style="padding:0 36px 18px;border-top:1px solid #e8e4d9;padding-top:18px;">
<p style="margin:0 0 6px;font-size:11px;color:#8a8a92;">${c.manualLinkLabel}</p>
<p style="margin:0;font-size:11px;word-break:break-all;"><a href="${u}" style="color:#8b5cf6;text-decoration:underline;">${u}</a></p>
</td></tr>
<tr><td style="padding:8px 36px 36px;">
<p style="margin:0 0 4px;font-size:11px;color:#6a6a72;">${c.footerLine1}</p>
<p style="margin:0;font-size:10px;color:#9a9aa2;line-height:1.6;">${c.footerLine2}</p>
</td></tr>
</table></td></tr></table>`,
      "#f5f3ee",
      c.body
    );
  },
};

/* ─── 6. QUANT TERMINAL — Bloomberg-style dense + cyan-on-black ───────────── */
const quant: EmailTemplate = {
  id: "quant",
  name: "Quant Terminal",
  tagline: "Bloomberg-inspiré · cyan/black · données denses",
  render: (c, url) => {
    const u = url ?? c.url;
    const mono = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
    return wrap(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;font-family:${mono};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#020a0d;border:1px solid #134e4a;border-radius:6px;">
<tr><td style="padding:14px 22px;background:#0c1f24;border-bottom:1px solid #134e4a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><span style="font-family:${mono};font-size:11px;color:#22d3ee;font-weight:700;letter-spacing:0.05em;">METTRIK&nbsp;TERM</span><span style="margin-left:14px;font-family:${mono};font-size:10px;color:#5eead4;">v1.0.0</span></td>
<td align="right"><span style="font-family:${mono};font-size:10px;color:#22d3ee;">●&nbsp;LIVE</span></td>
</tr></table>
</td></tr>
<tr><td style="padding:32px 22px 8px;">
<p style="margin:0 0 6px;font-family:${mono};font-size:10px;color:#5eead4;letter-spacing:0.18em;">&gt;&gt;&nbsp;${c.badge.toUpperCase()}</p>
<h1 style="margin:0;font-family:${mono};font-size:24px;line-height:1.25;font-weight:700;color:#fff;letter-spacing:-0.01em;">${c.h1Line2}</h1>
</td></tr>
<tr><td style="padding:18px 22px;">
<p style="margin:0;font-family:${mono};font-size:13px;line-height:1.7;color:#94d8d0;">${c.body}</p>
</td></tr>
<tr><td style="padding:6px 22px 18px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c1f24;border:1px solid #134e4a;border-radius:4px;">
<tr><td style="padding:14px 18px;">
<p style="margin:0 0 12px;font-family:${mono};font-size:9px;color:#5eead4;letter-spacing:0.22em;">// ${c.teaserTitle.toUpperCase()}</p>
${c.teasers.map((t, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0;"><tr>
<td width="40" style="font-family:${mono};font-size:11px;color:#22d3ee;font-weight:700;">[${String(i + 1).padStart(2, "0")}]</td>
<td style="font-family:${mono};font-size:12px;color:#cbd5d0;">${t}</td>
</tr></table>`).join("")}
</td></tr></table>
</td></tr>
<tr><td style="padding:6px 22px 22px;">
<a href="${u}" target="_blank" style="display:inline-block;padding:13px 22px;font-family:${mono};font-size:13px;font-weight:700;color:#020a0d;background:#22d3ee;text-decoration:none;border-radius:4px;letter-spacing:0.05em;">▶&nbsp;&nbsp;${c.cta.toUpperCase()}</a>
<p style="margin:12px 0 0;font-family:${mono};font-size:10px;color:#5eead4;">// ${c.expiry}</p>
</td></tr>
<tr><td style="padding:14px 22px;border-top:1px solid #134e4a;">
<p style="margin:0 0 6px;font-family:${mono};font-size:9px;color:#5eead4;letter-spacing:0.05em;">${c.manualLinkLabel}</p>
<p style="margin:0;font-family:${mono};font-size:10px;word-break:break-all;"><a href="${u}" style="color:#22d3ee;text-decoration:underline;">${u}</a></p>
</td></tr>
<tr><td style="padding:14px 22px 20px;">
<p style="margin:0 0 4px;font-family:${mono};font-size:10px;color:#5eead4;">${c.footerLine1}</p>
<p style="margin:0;font-family:${mono};font-size:9px;color:#3a7a72;line-height:1.6;">${c.footerLine2}</p>
</td></tr>
</table></td></tr></table>`,
      "#000",
      c.body
    );
  },
};

export const TEMPLATES: EmailTemplate[] = [
  editorial,
  brutalist,
  magazine,
  holographic,
  lumen,
  quant,
];
