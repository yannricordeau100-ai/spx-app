"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, ArrowDown, ArrowUp } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

/**
 * CmdFSearch — mini "find on page" overlay déclenché par ⌘F (macOS) /
 * Ctrl+F (Windows/Linux). Surchage le natif du navigateur car le natif
 * ne sait pas mettre en évidence des fragments React stylés et on veut
 * un look cohérent avec le reste de la DA.
 *
 * Comportement :
 *  - ⌘F / Ctrl+F → ouvre l'overlay (preventDefault sur le natif)
 *  - Esc → ferme + clear highlight
 *  - Enter / Shift+Enter → next / prev match
 *  - Highlight via <mark> wrapping de tous les Text node qui matchent,
 *    accumulé dans un layer overlay sans toucher au DOM source.
 *
 * Implémentation : on insère des <mark.cmdf-match> autour de chaque
 * occurrence (case-insensitive) dans `[data-cmdf-scope]` ou tout le
 * <main> par défaut. À la fermeture, on retire les <mark> via
 * normalizeText() pour restaurer l'état initial.
 */
export function CmdFSearch({ scopeSelector = "main" }: { scopeSelector?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<HTMLElement[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘F / Ctrl+F handler
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isFind = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f";
      if (isFind) {
        e.preventDefault();
        setOpen(true);
        // Pré-remplir avec la sélection courante si l'user en a une
        const sel = window.getSelection()?.toString().trim();
        if (sel) setQuery(sel);
        setTimeout(() => inputRef.current?.focus(), 30);
        setTimeout(() => inputRef.current?.select(), 60);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-highlight on query change
  useEffect(() => {
    if (!open) return;
    clearHighlights();
    if (!query.trim()) {
      setMatches([]);
      setActiveIdx(0);
      return;
    }
    const found = highlightInScope(query, scopeSelector);
    setMatches(found);
    setActiveIdx(0);
    if (found[0]) scrollToMatch(found[0]);
  }, [query, open, scopeSelector]);

  // Update active highlight
  useEffect(() => {
    matches.forEach((el, i) => {
      el.classList.toggle("cmdf-match-active", i === activeIdx);
    });
    if (matches[activeIdx]) scrollToMatch(matches[activeIdx]);
  }, [activeIdx, matches]);

  function close() {
    clearHighlights();
    setOpen(false);
    setQuery("");
    setMatches([]);
    setActiveIdx(0);
  }

  function next() {
    if (matches.length === 0) return;
    setActiveIdx((i) => (i + 1) % matches.length);
  }

  function prev() {
    if (matches.length === 0) return;
    setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-4 top-4 z-[200] flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a]/95 px-3 py-2 shadow-2xl backdrop-blur-md"
          style={{ minWidth: 320 }}
        >
          <Search className="size-4 text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) prev();
                else next();
              }
            }}
            placeholder={t("cmdf.placeholder")}
            className="flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <span className="font-mono text-[11px] tabular-nums text-zinc-400">
            {matches.length === 0 && query ? "0" : `${matches.length === 0 ? 0 : activeIdx + 1}/${matches.length}`}
          </span>
          <button
            onClick={prev}
            disabled={matches.length === 0}
            className="inline-flex size-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-[#161616] hover:text-zinc-100 disabled:opacity-40"
            aria-label={t("cmdf.prev")}
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            onClick={next}
            disabled={matches.length === 0}
            className="inline-flex size-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-[#161616] hover:text-zinc-100 disabled:opacity-40"
            aria-label={t("cmdf.next")}
          >
            <ArrowDown className="size-3.5" />
          </button>
          <button
            onClick={close}
            className="inline-flex size-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-[#161616] hover:text-zinc-100"
            aria-label={t("cmdf.close")}
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── DOM helpers ─────────────────────────────────────────────────── */

function highlightInScope(q: string, selector: string): HTMLElement[] {
  const root = document.querySelector(selector) as HTMLElement | null;
  if (!root) return [];
  const needle = q.toLowerCase();
  const matches: HTMLElement[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || node.nodeValue.trim().length === 0) return NodeFilter.FILTER_REJECT;
      // Skip inside our own overlay or inside <script>/<style>
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-cmdf-overlay]")) return NodeFilter.FILTER_REJECT;
      return node.nodeValue.toLowerCase().includes(needle)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const targets: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) targets.push(n as Text);

  for (const text of targets) {
    const value = text.nodeValue!;
    const parts: (Text | HTMLElement)[] = [];
    let lastIdx = 0;
    const lower = value.toLowerCase();
    let idx = lower.indexOf(needle, 0);
    while (idx !== -1) {
      if (idx > lastIdx) parts.push(document.createTextNode(value.slice(lastIdx, idx)));
      const mark = document.createElement("mark");
      mark.className = "cmdf-match";
      mark.textContent = value.slice(idx, idx + needle.length);
      parts.push(mark);
      matches.push(mark);
      lastIdx = idx + needle.length;
      idx = lower.indexOf(needle, lastIdx);
    }
    if (lastIdx < value.length) parts.push(document.createTextNode(value.slice(lastIdx)));
    const parent = text.parentNode;
    if (parent) {
      for (const p of parts) parent.insertBefore(p, text);
      parent.removeChild(text);
    }
  }

  return matches;
}

function clearHighlights() {
  const marks = document.querySelectorAll("mark.cmdf-match");
  for (const mark of Array.from(marks)) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  }
}

function scrollToMatch(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}
