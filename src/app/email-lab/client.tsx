"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Languages, Smartphone, Monitor, Copy, Check } from "lucide-react";
import { TEMPLATES } from "@/components/email-lab/templates";
import { TRANSLATIONS, type Lang } from "@/components/email-lab/translations";

type DeviceMode = "desktop" | "mobile";

export function EmailLabClient() {
  const [lang, setLang] = useState<Lang>("fr");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useMemo(() => TRANSLATIONS[lang], [lang]);

  const onCopy = async (id: string, html: string) => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard non dispo */
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#050507]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="size-3.5" />
              Home
            </Link>
            <h1 className="font-display text-lg font-semibold tracking-tight">
              Email Lab
            </h1>
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              {TEMPLATES.length} designs
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Lang switcher */}
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[12px]">
              <Languages className="ml-2 size-3.5 text-zinc-400" />
              {(["fr", "en", "de"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded-full px-2.5 py-1 font-semibold uppercase tracking-wider transition-colors ${
                    lang === l
                      ? "bg-violet-500/90 text-white"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Device switcher */}
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5">
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  device === "desktop"
                    ? "bg-cyan-400/15 text-cyan-200"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                aria-label="Desktop preview"
              >
                <Monitor className="size-3.5" />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  device === "mobile"
                    ? "bg-cyan-400/15 text-cyan-200"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                aria-label="Mobile preview"
              >
                <Smartphone className="size-3.5" />
                Mobile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Brief */}
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <p className="max-w-2xl text-sm text-zinc-400">
          6 directions visuelles pour l&apos;email de confirmation Mettrik. Chaque
          design est testé en FR, EN et DE (l&apos;allemand allonge les phrases
          de ~25 %, le rendu doit tenir). Choisis-en un et je le pousse dans
          Supabase.
        </p>
      </div>

      {/* Grid */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
        {TEMPLATES.map((t, i) => {
          const html = t.render(copy);
          return (
            <article
              key={t.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0e]"
            >
              <header className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
                    Design {String(i + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight">
                    {t.name}
                  </h2>
                  <p className="mt-0.5 text-[12px] text-zinc-500">{t.tagline}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(t.id, html)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
                  title="Copier le HTML"
                >
                  {copied === t.id ? (
                    <>
                      <Check className="size-3.5 text-emerald-300" />
                      <span className="text-emerald-300">Copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copier HTML
                    </>
                  )}
                </button>
              </header>

              <div className="bg-[#1a1a22] p-4">
                <div
                  className="mx-auto overflow-hidden rounded-lg shadow-2xl transition-all"
                  style={{
                    width: device === "mobile" ? 375 : "100%",
                    maxWidth: device === "mobile" ? 375 : "100%",
                  }}
                >
                  <EmailFrame html={html} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="mx-auto max-w-6xl px-4 py-12 text-center text-[12px] text-zinc-500 sm:px-6">
        Pour valider : « Je prends le design <em>Editorial</em> » (ou autre).
        Je remplace <code className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-300">{`{{ .ConfirmationURL }}`}</code>
        et tu colles dans Supabase Dashboard.
      </footer>
    </div>
  );
}

/**
 * EmailFrame — iframe sandboxée qui rend le HTML email tel quel, isolé du
 * CSS de l'app. La hauteur s'auto-ajuste sur le contentDocument.
 */
function EmailFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(620);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const onLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const body = doc.body;
        const html = doc.documentElement;
        const h = Math.max(
          body?.scrollHeight ?? 0,
          html?.scrollHeight ?? 0,
          620
        );
        setHeight(h + 16);
      } catch {
        /* cross-origin guard */
      }
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [html]);

  return (
    <iframe
      ref={ref}
      title="Email preview"
      srcDoc={html}
      sandbox="allow-same-origin"
      style={{
        width: "100%",
        height,
        border: 0,
        background: "transparent",
        display: "block",
      }}
    />
  );
}
