"use client";

import { useState } from "react";

type SaveState =
  | { status: "idle" }
  | { status: "loading"; locale: "fr" | "en" | "both" }
  | { status: "ok"; locale: "fr" | "en" | "both" }
  | { status: "error"; locale: "fr" | "en" | "both"; message: string };

/**
 * Editor des Conditions générales (FR + EN). Deux textarea Markdown
 * côte-à-côte. Bouton "Publier" qui POST sur /api/sandbox/legal-editor
 * pour réécrire les fichiers `src/data/legal/conditions-{fr,en}.md`.
 *
 * En prod Vercel, le filesystem est read-only → l'API renvoie 503 avec
 * un message clair. Yann commit le MD manuellement après édition.
 */
export function LegalEditorClient({
  initialFr,
  initialEn,
}: {
  initialFr: string;
  initialEn: string;
}) {
  const [fr, setFr] = useState(initialFr);
  const [en, setEn] = useState(initialEn);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [pdfBusy, setPdfBusy] = useState<"fr" | "en" | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function publish(locale: "fr" | "en" | "both") {
    setSave({ status: "loading", locale });
    try {
      const payload: Record<string, string> = {};
      if (locale === "fr" || locale === "both") payload.fr = fr;
      if (locale === "en" || locale === "both") payload.en = en;
      const res = await fetch("/api/sandbox/legal-editor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "conditions", ...payload }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        hint?: string;
      };
      if (!res.ok || !data.ok) {
        const msg = [data.error, data.detail, data.hint].filter(Boolean).join(" · ");
        setSave({ status: "error", locale, message: msg || `HTTP ${res.status}` });
        return;
      }
      setSave({ status: "ok", locale });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSave({ status: "error", locale, message });
    }
  }

  async function handlePdfUpload(locale: "fr" | "en", file: File) {
    setPdfBusy(locale);
    setPdfError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/sandbox/legal-editor/pdf-to-md", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { ok?: boolean; md?: string; error?: string; detail?: string };
      if (!res.ok || !data.ok || !data.md) {
        setPdfError([data.error, data.detail].filter(Boolean).join(" · ") || `HTTP ${res.status}`);
        return;
      }
      if (locale === "fr") setFr(data.md);
      else setEn(data.md);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : String(err));
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-zinc-100">
      <header className="mb-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight">Legal editor</h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
          Édition des Conditions générales (FR + EN). Le contenu est stocké en
          Markdown dans <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">src/data/legal/conditions-&#123;fr,en&#125;.md</code> et lu côté SSR par la page
          publique <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">/legal/conditions</code>.
        </p>
        <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-amber-200/80">
          ⚠️ Vercel prod = filesystem read-only. En cas d&apos;échec (503), le MD
          est à commiter manuellement dans le repo après édition.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => publish("both")}
          disabled={save.status === "loading"}
          className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-4 py-2 text-[13px] font-semibold text-violet-100 transition-colors hover:bg-violet-500/25 disabled:opacity-50"
        >
          {save.status === "loading" && save.locale === "both" ? "Publication…" : "Publier FR + EN"}
        </button>
        <button
          onClick={() => publish("fr")}
          disabled={save.status === "loading"}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50"
        >
          {save.status === "loading" && save.locale === "fr" ? "FR…" : "Publier FR seul"}
        </button>
        <button
          onClick={() => publish("en")}
          disabled={save.status === "loading"}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50"
        >
          {save.status === "loading" && save.locale === "en" ? "EN…" : "Publier EN seul"}
        </button>
        <a
          href="/legal/conditions"
          target="_blank"
          rel="noopener"
          className="ml-auto rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-300 hover:bg-white/[0.06]"
        >
          Voir la page publique ↗
        </a>
      </div>

      {save.status === "ok" && (
        <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-100">
          ✅ Publié ({save.locale}). La page <code>/legal/conditions</code> reflète déjà la nouvelle version côté SSR.
        </div>
      )}
      {save.status === "error" && (
        <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-100">
          ❌ Échec ({save.locale}) : {save.message}
        </div>
      )}
      {pdfError && (
        <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-100">
          ❌ PDF → MD : {pdfError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <EditorPane
          label="🇫🇷 conditions-fr.md"
          value={fr}
          onChange={setFr}
          onPdf={(file) => handlePdfUpload("fr", file)}
          pdfBusy={pdfBusy === "fr"}
        />
        <EditorPane
          label="🇬🇧 conditions-en.md"
          value={en}
          onChange={setEn}
          onPdf={(file) => handlePdfUpload("en", file)}
          pdfBusy={pdfBusy === "en"}
        />
      </div>
    </main>
  );
}

function EditorPane({
  label,
  value,
  onChange,
  onPdf,
  pdfBusy,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onPdf: (f: File) => void;
  pdfBusy: boolean;
}) {
  const lineCount = value.split(/\r?\n/).length;
  const charCount = value.length;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <header className="flex items-center justify-between gap-2">
        <div className="font-mono text-[11.5px] text-zinc-300">{label}</div>
        <div className="flex items-center gap-2 text-[10.5px] text-zinc-500">
          <span>{lineCount} lignes</span>
          <span>·</span>
          <span>{charCount.toLocaleString("fr-FR")} char.</span>
        </div>
      </header>
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-zinc-200 hover:bg-white/[0.08]">
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={pdfBusy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPdf(f);
            e.target.value = "";
          }}
        />
        {pdfBusy ? "Conversion PDF…" : "📄 Remplacer par un PDF"}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="min-h-[600px] w-full resize-y rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[12.5px] leading-relaxed text-zinc-200 focus:border-violet-400/40 focus:outline-none"
      />
    </section>
  );
}
