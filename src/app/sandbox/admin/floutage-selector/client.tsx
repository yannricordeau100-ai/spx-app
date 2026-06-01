"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Rect = { x: number; y: number; w: number; h: number };

type Selection = {
  id: string;
  rect: Rect;
  dom_selector: string;
  dom_text: string;
  label: string;
};

type SaveStatus = "idle" | "saving" | "ok" | "error";

/**
 * Génère un sélecteur CSS "le plus proche" pour un élément DOM.
 * Stratégie : remonte au plus 5 niveaux pour trouver un id, data-attr, ou
 * chemin tag.class.
 */
function buildSelector(el: Element | null): string {
  if (!el) return "";
  if (el.id) return `#${CSS.escape(el.id)}`;
  const dataAttrs = ["data-testid", "data-block", "data-kpi", "data-section"];
  for (const attr of dataAttrs) {
    const v = el.getAttribute(attr);
    if (v) return `[${attr}="${CSS.escape(v)}"]`;
  }
  // Remonte jusqu'à trouver un parent identifiable.
  const path: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur.nodeType === 1 && depth < 6) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) {
      part += `#${CSS.escape(cur.id)}`;
      path.unshift(part);
      break;
    }
    const cls = (cur.className && typeof cur.className === "string"
      ? cur.className.trim().split(/\s+/).slice(0, 2)
      : []) as string[];
    if (cls.length) part += "." + cls.map((c) => CSS.escape(c)).join(".");
    // nth-of-type pour désambiguïser
    const parent = cur.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === cur!.tagName,
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(cur) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }
    path.unshift(part);
    cur = cur.parentElement;
    depth++;
  }
  return path.join(" > ");
}

function nextId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function FloutageSelectorClient({
  ticker,
  auditToken,
}: {
  ticker: string;
  auditToken: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [selections, setSelections] = useState<Selection[]>([]);
  const [drawing, setDrawing] = useState<Rect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeSize, setIframeSize] = useState({ w: 1280, h: 4000 });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");

  const iframeSrc =
    `/sandbox/v1-9-5/${ticker.toLowerCase()}` +
    (auditToken ? `?audit_token=${encodeURIComponent(auditToken)}` : "");

  // Récupère sélection précédente si dispo (rechargement Yann).
  useEffect(() => {
    let aborted = false;
    fetch(`/api/desk-mtk9x4kp/floutage-selections?ticker=${ticker}`)
      .then((r) => r.json())
      .then((data: { latest?: { selections?: Selection[] } | null }) => {
        if (aborted) return;
        const prev = data?.latest?.selections;
        if (Array.isArray(prev) && prev.length > 0) {
          setSelections(
            prev.map((s) => ({
              id: nextId(),
              rect: s.rect,
              dom_selector: s.dom_selector,
              dom_text: s.dom_text,
              label: s.label,
            })),
          );
        }
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, [ticker]);

  // Redraw canvas
  const redraw = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Rects existants
    for (const sel of selections) {
      ctx.fillStyle = "rgba(168, 85, 247, 0.25)"; // violet-500/25
      ctx.fillRect(sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h);
      ctx.strokeStyle = "rgba(168, 85, 247, 0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h);
      // Label
      ctx.fillStyle = "rgba(168, 85, 247, 0.95)";
      ctx.font = "bold 11px ui-sans-serif, system-ui";
      const labelText = sel.label || "(sans nom)";
      ctx.fillText(labelText, sel.rect.x + 4, sel.rect.y + 14);
    }

    // Rect en cours de dessin
    if (drawing) {
      ctx.fillStyle = "rgba(236, 72, 153, 0.2)"; // pink-500/20
      ctx.fillRect(drawing.x, drawing.y, drawing.w, drawing.h);
      ctx.strokeStyle = "rgba(236, 72, 153, 1)";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(drawing.x, drawing.y, drawing.w, drawing.h);
      ctx.setLineDash([]);
    }
  }, [selections, drawing]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Resize canvas to iframe doc size
  useEffect(() => {
    if (!iframeLoaded) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const h = Math.max(
        doc.documentElement.scrollHeight,
        doc.body?.scrollHeight ?? 0,
        1000,
      );
      const w = Math.max(
        doc.documentElement.scrollWidth,
        doc.body?.scrollWidth ?? 0,
        1280,
      );
      setIframeSize({ w, h });
    } catch {
      // cross-origin (shouldn't happen, same origin)
    }
  }, [iframeLoaded]);

  // Mouse handlers on overlay
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    startRef.current = { x, y };
    setDrawing({ x, y, w: 0, h: 0 });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!startRef.current) return;
    const canvas = overlayRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const sx = startRef.current.x;
    const sy = startRef.current.y;
    setDrawing({
      x: Math.min(x, sx),
      y: Math.min(y, sy),
      w: Math.abs(x - sx),
      h: Math.abs(y - sy),
    });
  };

  const onMouseUp = () => {
    if (!startRef.current || !drawing) {
      startRef.current = null;
      setDrawing(null);
      return;
    }
    const finalRect = drawing;
    startRef.current = null;
    setDrawing(null);

    // Ignore les clics involontaires (rect trop petit).
    if (finalRect.w < 8 || finalRect.h < 8) return;

    // Capture DOM via iframe.contentDocument.elementFromPoint
    const iframe = iframeRef.current;
    let domSelector = "";
    let domText = "";
    try {
      const doc = iframe?.contentDocument;
      if (doc) {
        // On utilise le centre du rect pour trouver l'élément.
        const cx = finalRect.x + finalRect.w / 2;
        const cy = finalRect.y + finalRect.h / 2;
        const el = doc.elementFromPoint(cx, cy);
        domSelector = buildSelector(el);
        domText = (el?.textContent ?? "").trim().slice(0, 200);
      }
    } catch {
      // cross-origin safety
    }

    const label = window.prompt(
      `Nom de cette zone à flouter (ex : "Hero KPI value", "Risks score"):`,
      domText.slice(0, 40) || "Zone floutée",
    );
    if (label === null) return; // user cancel

    setSelections((prev) => [
      ...prev,
      {
        id: nextId(),
        rect: finalRect,
        dom_selector: domSelector,
        dom_text: domText,
        label: label.trim() || "Zone floutée",
      },
    ]);
  };

  const removeSelection = (id: string) => {
    setSelections((prev) => prev.filter((s) => s.id !== id));
  };

  const clearAll = () => {
    if (window.confirm("Effacer toutes les sélections ?")) {
      setSelections([]);
    }
  };

  const saveSelections = async (toSave: Selection[]) => {
    setSaveStatus("saving");
    setSaveMessage("");
    try {
      const res = await fetch("/api/desk-mtk9x4kp/floutage-selections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticker,
          selections: toSave.map((s) => ({
            rect: s.rect,
            dom_selector: s.dom_selector,
            dom_text: s.dom_text,
            label: s.label,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
        details?: string;
        hint?: string;
        submission_id?: string;
        count?: number;
      };
      if (!res.ok || !data.ok) {
        setSaveStatus("error");
        const detail =
          [data.error, data.code, data.hint, data.details]
            .filter(Boolean)
            .join(" · ") || `HTTP ${res.status}`;
        setSaveMessage(detail);
        return;
      }
      setSaveStatus("ok");
      setSaveMessage(
        `Enregistré (${data.count} zones, id ${data.submission_id?.slice(0, 8)}…)`,
      );
    } catch (err) {
      setSaveStatus("error");
      setSaveMessage((err as Error).message);
    }
  };

  const save = async () => {
    await saveSelections(selections);
  };

  const saveSingle = async (sel: Selection) => {
    await saveSelections([sel]);
  };

  return (
    <div className="min-h-screen bg-[#0a0612] text-white">
      <header className="sticky top-0 z-30 border-b border-violet-500/30 bg-[#0a0612]/95 backdrop-blur px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center text-xs font-bold">
            FX
          </div>
          <div>
            <div className="text-sm font-semibold">
              Sélecteur visuel floutage · étalon free tier
            </div>
            <div className="text-xs text-violet-300">
              Ticker : <span className="font-mono">{ticker}</span> · Drag avec
              la souris pour dessiner une zone
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-violet-300">
            {selections.length} zone{selections.length > 1 ? "s" : ""}
          </span>
          {saveStatus === "saving" && (
            <span className="text-yellow-300">Enregistrement…</span>
          )}
          {saveStatus === "ok" && (
            <span className="text-emerald-300">{saveMessage}</span>
          )}
          {saveStatus === "error" && (
            <span className="text-rose-300">Erreur : {saveMessage}</span>
          )}
        </div>
      </header>

      <div className="flex">
        {/* Zone iframe + overlay */}
        <main className="flex-1 overflow-auto">
          <div
            ref={wrapperRef}
            className="relative mx-auto bg-black"
            style={{ width: iframeSize.w, height: iframeSize.h }}
          >
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              onLoad={() => setIframeLoaded(true)}
              className="absolute inset-0 border-0"
              style={{
                width: iframeSize.w,
                height: iframeSize.h,
                pointerEvents: "none",
              }}
              title="GOOGL preview"
            />
            <canvas
              ref={overlayRef}
              width={iframeSize.w}
              height={iframeSize.h}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              className="absolute inset-0 cursor-crosshair"
              style={{
                width: iframeSize.w,
                height: iframeSize.h,
              }}
            />
          </div>
        </main>

        {/* Sidebar */}
        <aside className="w-80 shrink-0 border-l border-violet-500/30 bg-[#120822]/95 sticky top-[73px] self-start max-h-[calc(100vh-73px)] overflow-y-auto">
          <div className="p-4 border-b border-violet-500/20">
            <h2 className="text-sm font-semibold mb-1">Zones sélectionnées</h2>
            <p className="text-xs text-violet-300/70">
              Sauvegarde individuelle ou globale.
            </p>
          </div>
          <ul className="divide-y divide-violet-500/10">
            {selections.length === 0 && (
              <li className="p-4 text-xs text-violet-300/50 italic">
                Aucune zone. Dessine ta première zone à la souris sur l&apos;aperçu.
              </li>
            )}
            {selections.map((sel, i) => (
              <li
                key={sel.id}
                className="p-3 hover:bg-violet-500/10"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-violet-200 truncate">
                      #{i + 1} · {sel.label}
                    </div>
                    <div className="text-[10px] text-violet-400/70 font-mono truncate mt-0.5">
                      {sel.dom_selector || "(pas de sélecteur)"}
                    </div>
                    <div className="text-[10px] text-violet-300/50 mt-0.5 font-mono">
                      x={sel.rect.x} · y={sel.rect.y} · w={sel.rect.w} · h={sel.rect.h}
                    </div>
                    {sel.dom_text && (
                      <div className="text-[10px] text-violet-300/60 mt-1 italic truncate">
                        « {sel.dom_text} »
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveSingle(sel)}
                      disabled={saveStatus === "saving"}
                      className="flex-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Sauvegarder cette zone
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSelection(sel.id)}
                      className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                      aria-label="Supprimer cette zone"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {selections.length > 0 && (
            <div className="p-4 border-t border-violet-500/20">
              <button
                type="button"
                onClick={clearAll}
                className="w-full text-xs text-rose-300 hover:text-rose-200 underline"
              >
                Tout effacer
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Sticky footer bouton Valider */}
      <div className="sticky bottom-0 z-30 border-t border-violet-500/30 bg-[#0a0612]/95 backdrop-blur px-6 py-3 flex items-center gap-3">
        {/* Yann (2 juin 2026) : bouton EN PREMIER (gauche) pour ne pas
            chevaucher le panel admin niveau bottom-right. */}
        <button
          type="button"
          disabled={selections.length === 0 || saveStatus === "saving"}
          onClick={save}
          className="px-4 py-2 rounded-md bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm font-semibold hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Valider et Enregistrer
        </button>
        <div className="text-xs text-violet-300/70 ml-2">
          {selections.length === 0
            ? "Dessine au moins 1 zone avant d'enregistrer."
            : `${selections.length} zone${selections.length > 1 ? "s" : ""} à enregistrer.`}
        </div>
      </div>
    </div>
  );
}
