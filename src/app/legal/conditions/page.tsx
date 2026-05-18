import { LegalLayout } from "@/components/legal/legal-layout";
import { getServerLocale } from "@/lib/i18n/server";
import { loadLegalDoc, type LegalBlock } from "@/lib/legal-md";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conditions générales d'utilisation et de vente · Mettrik AI",
  description:
    "Conditions générales d'utilisation et de vente du site et des abonnements Mettrik AI.",
};

/**
 * Document légal unique combinant CGU (utilisation) et CGV (vente).
 *
 * Contenu lu depuis `src/data/legal/conditions-{fr,en}.md` (refactor du
 * 18 mai 2026, Yann veut pouvoir éditer le texte via /sandbox/legal-editor
 * sans toucher au code).
 */
export default async function ConditionsPage() {
  const localeRaw = await getServerLocale();
  const locale: "fr" | "en" = localeRaw === "en" || localeRaw === "en-GB" ? "en" : "fr";
  const doc = await loadLegalDoc("conditions", locale);

  return (
    <LegalLayout title={doc.title} updatedAt={doc.updatedAt} locale={locale}>
      {renderBlocks(doc.blocks)}
    </LegalLayout>
  );
}

function renderBlocks(blocks: LegalBlock[]) {
  return blocks.map((b, i) => {
    if (b.kind === "h2") {
      return (
        <h2
          key={i}
          className="mt-10 font-display text-[20px] font-bold tracking-tight text-zinc-100 sm:text-[22px]"
        >
          {b.text}
        </h2>
      );
    }
    if (b.kind === "h3") {
      return (
        <h3
          key={i}
          className="mt-7 font-display text-[16px] font-semibold tracking-tight text-zinc-100 sm:text-[17px]"
        >
          {b.text}
        </h3>
      );
    }
    if (b.kind === "ul") {
      return (
        <ul key={i} className="ml-5 list-disc space-y-2 text-zinc-300">
          {b.items.map((it, j) => (
            <li key={j}>{it}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="text-zinc-300">
        {b.text}
      </p>
    );
  });
}
