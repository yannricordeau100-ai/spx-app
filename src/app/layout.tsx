import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono, Bricolage_Grotesque, Sora, Fraunces } from "next/font/google";
import { PlausibleScript } from "@/components/analytics/plausible";
import { I18nProvider } from "@/lib/i18n/provider";
import { getServerLocale } from "@/lib/i18n/server";
import { UserPrefsSync } from "@/components/user-prefs-sync";
import { GlobalSocialBar } from "@/components/global-social-bar";
import { AdminFloatingPanel } from "@/components/admin-floating-panel";
import "./globals.css";

// Manrope = body/UI
const sans = Manrope({
  variable: "--font-sans-app",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

// Bricolage Grotesque = display / brand (Mettrik wordmark)
// Variable font with strong character, distinctive and modern.
const display = Bricolage_Grotesque({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// Sora = sans géométrique original et très fin (200 ExtraLight) pour les
// chiffres "stars" (prix d'action). Proportionnel : plus d'espace excessif
// autour de la virgule comme avec une mono. Fine, élégant, distinctif sans
// être tape-à-l'œil. Mobile-safe.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
  weight: ["200", "300", "400"],
});

// Fraunces = display variable serif italique pour le wordmark "Mettrik AI"
// (BrandWordmark home + chart-mini-logo + maintenance + pages internes).
// Contraste fort, swashes expressifs en italique 800. Variable.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";

// Yann 13 mai 2026 : viewport mobile-first. Sans cet export, la barre Safari
// iPhone reste blanche par défaut et certains téléphones bridgent le layout.
// theme-color sombre = la barre Safari adopte la couleur de l'app, look "native".
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#06060a" },
    { media: "(prefers-color-scheme: light)", color: "#06060a" },
  ],
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Mettrik AI · KPI Intelligence",
    template: "%s · Mettrik AI",
  },
  description:
    "Surperformer le marché avec les meilleurs KPIs de chaque action",
  applicationName: "Mettrik AI",
  authors: [{ name: "Mettrik AI" }],
  creator: "Mettrik AI",
  publisher: "Mettrik AI",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    siteName: "Mettrik AI",
    title: "Mettrik AI · KPI Intelligence",
    description: "Surperformer le marché avec les meilleurs KPIs de chaque action",
    url: SITE_URL,
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mettrik AI · KPI Intelligence",
    description: "Surperformer le marché avec les meilleurs KPIs de chaque action",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();
  return (
    <html
      lang={locale}
      data-theme="dark"
      style={{ colorScheme: "dark" }}
      className={`dark ${sans.variable} ${jetbrains.variable} ${display.variable} ${sora.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        {/* Anti-IA training opt-out (cohérent CGV/CGU). Pas 100 % efficace
            mais signal opposable juridiquement. */}
        <meta name="robots" content="noai, noimageai" />
        <meta name="googlebot" content="noai, noimageai" />
        <meta name="ai-content-declaration" content="no-training" />
      </head>
      <body className="min-h-full bg-[#050505] text-base text-zinc-100">
        <I18nProvider locale={locale}>
          {children}
          {/* Présence sociale Mettrik AI affichée en bas de toutes les
              pages de l'app (Yann 17 mai 2026). */}
          <GlobalSocialBar />
        </I18nProvider>
        <UserPrefsSync />
        <PlausibleScript />
        {/* Panel admin bottom-right (niveaux 1/2/3 uniquement). Intègre
            l'indicateur de niveau (orange/violet/gris) + 3 dropdowns :
            simulation tier, switch version (V1.7/V1.7.5/V1.8), switch
            niveau (1 ↔ 2). Masqué automatiquement en niveau 0 prod. */}
        <AdminFloatingPanel />
      </body>
    </html>
  );
}
