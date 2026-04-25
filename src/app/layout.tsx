import type { Metadata } from "next";
import { Manrope, JetBrains_Mono, Bricolage_Grotesque } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Mettrik · KPI Intelligence",
  description:
    "Le moteur d'intelligence KPI du S&P 500 : chaque indicateur lu, interprété, et instantanément comparable.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${sans.variable} ${jetbrains.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#050505] text-base text-zinc-100">{children}</body>
    </html>
  );
}
