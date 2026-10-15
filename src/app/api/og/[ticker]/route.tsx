import { ImageResponse } from "next/og";
import { COMPANIES } from "@/lib/data";
import { dansUniversActif, estUniversN1 } from "@/lib/univers-actif";
import { brand } from "@/lib/brand";

export const runtime = "edge";

/**
 * OG image dynamique générée à la volée par société.
 * URL : /api/og/<ticker> → renvoie une image PNG 1200x630.
 *
 * Affichée par les meta tags `og:image` et `twitter:image` sur les pages
 * société. C'est ce qu'on voit en preview quand on partage le lien sur
 * LinkedIn / X / Slack / Discord.
 *
 * Style : dark + accent brand color de la société, wordmark Mettrik AI,
 * nom + ticker + secteur + tagline.
 */
export async function GET(req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const upper = ticker.toUpperCase();
  // 9 oct 2026 : niveau 1 (UNIVERS=sp5001000) : aucune image pour l univers principal.
  const company = estUniversN1() && !dansUniversActif(upper) ? undefined : COMPANIES[upper];

  if (!company) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#050505",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* 15 oct 2026 : vrai logo Mettrik (version claire sur fond sombre), recadre sur le trace. */}
          <div style={{ display: "flex", width: 640, height: 119, overflow: "hidden", position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${new URL(req.url).origin}/brand/mettrik-ai-white-purple.png`}
              width={716}
              height={358}
              alt="Mettrik AI"
              style={{ position: "absolute", left: -43, top: -108, width: 716, height: 358 }}
            />
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const accent = brand(upper).primary;
  const glow = brand(upper).glow ?? `${accent}33`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#050505",
          backgroundImage: `radial-gradient(ellipse 60% 50% at 70% -20%, ${glow}, transparent 60%)`,
          display: "flex",
          flexDirection: "column",
          padding: "60px 70px",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top : Mettrik AI wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* 15 oct 2026 : vrai logo Mettrik (version claire, fond sombre) a la place de la pastille + texte.
              Le PNG fait 2048x1024 avec marges : on le recadre sur le trace (1829x341 a partir de 122,309). */}
          <div style={{ display: "flex", width: 236, height: 44, overflow: "hidden", position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${new URL(req.url).origin}/brand/mettrik-ai-white-purple.png`}
              width={264}
              height={132}
              alt="Mettrik AI"
              style={{ position: "absolute", left: -16, top: -40, width: 264, height: 132 }}
            />
          </div>
          <div style={{ fontSize: 13, color: "#71717a", letterSpacing: "0.18em", textTransform: "uppercase", marginLeft: 8 }}>
            KPI Intelligence
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Big ticker pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "6px 16px",
            border: `1px solid ${accent}55`,
            background: `${accent}15`,
            color: accent,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.08em",
            borderRadius: 8,
            alignSelf: "flex-start",
          }}
        >
          {upper}
        </div>

        {/* Company name */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            marginTop: 16,
            backgroundImage: `linear-gradient(135deg, #fafafa 0%, ${accent} 100%)`,
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {company.name}
        </div>

        {/* Sector / sub-sector */}
        <div style={{ display: "flex", fontSize: 22, color: "#a1a1aa", marginTop: 12 }}>
          {`${company.sector} · ${company.subsector}`}
        </div>

        {/* Tagline */}
        {company.tagline && (
          <div
            style={{
              display: "flex",
              fontSize: 18,
              color: "#d4d4d8",
              fontStyle: "italic",
              marginTop: 18,
              maxWidth: 900,
            }}
          >
            {`« ${company.tagline} »`}
          </div>
        )}

        {/* Bottom: domain */}
        <div style={{ display: "flex", marginTop: 32, color: "#52525b", fontSize: 16, fontFamily: "monospace" }}>
          {`www.mettrik.ai/${upper.toLowerCase()}`}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
