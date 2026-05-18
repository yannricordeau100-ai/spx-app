"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Square, CheckSquare, ListTodo, Pencil, RotateCcw, X, Check } from "lucide-react";
import { DeskCard, Empty, HelpTip, Input, PrimaryButton } from "./ui";
import {
  DEFAULT_CATEGORY_LABELS,
  readCategoryLabels,
  fetchCategoryLabels,
  writeCategoryLabels,
  resetCategoryLabels,
  type CategoryLabels,
  type DbValue,
} from "@/lib/desk/category-labels";

/**
 * Catégories "dossiers" pour les to-dos.
 *
 * IMPORTANT : on réutilise le champ `priority` existant en BDD pour ne PAS
 * casser les données existantes ni nécessiter de migration SQL. Mapping :
 *   urgent (BDD)  → label par défaut "urgent"          (rose)
 *   high   (BDD)  → label par défaut "V2"              (ambre)
 *   normal (BDD)  → label par défaut "V3"              (cyan)
 *   low    (BDD)  → label par défaut "Idée à creuser"  (zinc)
 *
 * Les LABELS sont customisables via le bouton crayon (icône Pencil) dans
 * la barre de filtres. Persistance : localStorage navigateur. Les VALEURS
 * DB ne changent jamais : tes to-dos existants survivent à tout rename.
 */

type CategoryStyle = { id: DbValue; bg: string; border: string; text: string };

// Le STYLE (couleur) est figé par DB-value. Seul le label change.
const CATEGORY_STYLES: CategoryStyle[] = [
  { id: "urgent", bg: "bg-rose-500/15",    border: "border-rose-500/40",    text: "text-rose-200" },
  { id: "high",   bg: "bg-amber-500/15",   border: "border-amber-500/40",   text: "text-amber-200" },
  { id: "normal", bg: "bg-cyan-500/15",    border: "border-cyan-500/40",    text: "text-cyan-200" },
  { id: "low",    bg: "bg-zinc-500/15",    border: "border-zinc-500/40",    text: "text-zinc-300" },
  { id: "extra",  bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-200" },
];

type Category = CategoryStyle & { label: string };

function buildCategories(labels: CategoryLabels): Category[] {
  return CATEGORY_STYLES.map((s) => ({ ...s, label: labels[s.id] }));
}

type Todo = {
  id: string;
  title: string;
  done: boolean;
  priority: DbValue;
  project: string | null;
  due_at: string | null;
  created_at: string;
};

type FilterValue = "all" | DbValue;

export function TabTodos({ ownerEmail: _ownerEmail }: { ownerEmail: string }) {
  void _ownerEmail; // RLS Supabase fait le filtrage côté DB
  // SWR cache : hydrate depuis localStorage au mount = affichage instantané.
  // Puis fetch BDD en background pour refresh.
  const [todos, setTodos] = useState<Todo[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("mettrik.desk.cache.v1.todos");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(false); // false par défaut = pas de spinner si cache présent
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<DbValue>("normal"); // = "V3" en label
  const [filter, setFilter] = useState<FilterValue>("all");
  const [showDone, setShowDone] = useState(false);

  // Labels personnalisables (BDD via API + cache localStorage).
  // Init avec défauts pour SSR-safe.
  const [labels, setLabels] = useState<CategoryLabels>(DEFAULT_CATEGORY_LABELS);
  const [editingLabels, setEditingLabels] = useState(false);
  // Hydrate les labels au mount : (a) lecture immédiate du cache localStorage
  // pour un rendu instantané, (b) fetch BDD en arrière-plan pour la vraie
  // source de vérité (survit aux changements de domaine).
  useEffect(() => {
    setLabels(readCategoryLabels());
    fetchCategoryLabels().then(setLabels).catch(() => {});
  }, []);

  const categories = useMemo(() => buildCategories(labels), [labels]);
  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])) as Record<DbValue, Category>,
    [categories]
  );

  async function load() {
    // Spinner uniquement si vraiment vide (pas de cache).
    if (todos.length === 0) setLoading(true);
    const r = await fetch("/api/desk/todos");
    if (r.ok) {
      const data = await r.json();
      setTodos(data);
      // Persiste le cache pour next mount instantané.
      try { window.localStorage.setItem("mettrik.desk.cache.v1.todos", JSON.stringify(data)); } catch {}
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!newTitle.trim()) return;
    await fetch("/api/desk/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: newTitle, priority: newCategory }),
    });
    setNewTitle("");
    load();
  }
  async function toggle(t: Todo) {
    await fetch("/api/desk/todos", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: t.id, done: !t.done }),
    });
    load();
  }
  async function changeCategory(t: Todo, cat: DbValue) {
    if (t.priority === cat) return;
    // optimistic UI
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, priority: cat } : x)));
    await fetch("/api/desk/todos", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: t.id, priority: cat }),
    });
    load();
  }
  async function rename(t: Todo, nextTitle: string) {
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === t.title) return;
    // Optimistic UI
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, title: trimmed } : x)));
    await fetch("/api/desk/todos", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: t.id, title: trimmed }),
    });
    load();
  }
  async function del(id: string) {
    await fetch(`/api/desk/todos?id=${id}`, { method: "DELETE" });
    load();
  }

  const visible = useMemo(() => {
    const filtered = todos.filter((t) => {
      if (!showDone && t.done) return false;
      if (filter !== "all" && t.priority !== filter) return false;
      return true;
    });
    // Tri : terminées en bas, sinon ordre chronologique (plus récent en haut).
    return filtered.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [todos, showDone, filter]);

  const counts = useMemo(() => {
    const c: Record<DbValue, number> = { urgent: 0, high: 0, normal: 0, low: 0, extra: 0 };
    for (const t of todos) if (!t.done) c[t.priority] = (c[t.priority] ?? 0) + 1;
    return c;
  }, [todos]);

  return (
    <div>
      {/* CRÉATION : input pleine ligne + en dessous catégories + bouton */}
      <DeskCard className="mb-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-200">Nouvelle tâche</span>
          <HelpTip>
            Tape ton texte sur la 1ère ligne, puis click sur une étiquette ci-dessous pour
            assigner la tâche à un dossier. Les noms des catégories sont customisables via
            le bouton <Pencil className="inline size-3" /> dans la barre de filtres :
            tu peux renommer <em>urgent / V2 / V3 / Idée à creuser / Bonus</em> comme tu veux.
            Tes tâches existantes restent intactes.
          </HelpTip>
        </div>
        {/* Ligne 1 : input pleine largeur */}
        <Input
          placeholder="Que faut-il faire ?"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="mb-2 w-full"
        />
        {/* Ligne 2 : 5 pills catégorie + bouton Ajouter à droite */}
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPicker value={newCategory} onChange={setNewCategory} categories={categories} />
          <PrimaryButton onClick={add} className="ml-auto">
            <Plus className="size-3.5" />
            Ajouter
          </PrimaryButton>
        </div>
      </DeskCard>

      {/* PANNEAU EDIT LABELS (conditionnel) */}
      {editingLabels && (
        <CategoryLabelEditor
          initial={labels}
          onSave={(next) => {
            setLabels(next);
            writeCategoryLabels(next);
            setEditingLabels(false);
          }}
          onReset={() => {
            resetCategoryLabels();
            setLabels(DEFAULT_CATEGORY_LABELS);
            setEditingLabels(false);
          }}
          onCancel={() => setEditingLabels(false)}
        />
      )}

      {/* FILTRE par catégorie + edit + show done */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">Filtrer :</span>
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
            filter === "all"
              ? "border-violet-500/50 bg-violet-500/15 text-violet-100"
              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
          }`}
        >
          Toutes <span className="ml-1 text-[10.5px] text-zinc-500">{todos.filter((t) => !t.done).length}</span>
        </button>
        {categories.map((c) => {
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                active ? `${c.border} ${c.bg} ${c.text}` : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {c.label}
              <span className={`text-[10.5px] ${active ? "" : "text-zinc-500"}`}>{counts[c.id]}</span>
            </button>
          );
        })}
        <button
          onClick={() => setEditingLabels((v) => !v)}
          title="Renommer les catégories"
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors ${
            editingLabels
              ? "border-violet-500/50 bg-violet-500/15 text-violet-100"
              : "border-white/10 bg-white/[0.03] text-zinc-500 hover:border-white/20 hover:text-zinc-200"
          }`}
        >
          <Pencil className="size-3" />
          renommer
        </button>
        <span className="ml-auto inline-flex items-center gap-2 text-[11.5px] text-zinc-500">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 transition-colors hover:border-white/20 hover:text-zinc-300"
          >
            {showDone ? <CheckSquare className="size-3" /> : <Square className="size-3" />}
            {showDone ? "Masquer terminées" : "Afficher terminées"}
          </button>
          <span>{todos.filter((t) => t.done).length} terminées</span>
        </span>
      </div>

      {loading && <div className="text-[12px] text-zinc-500">Chargement…</div>}

      {!loading && visible.length === 0 && (
        <Empty
          icon={ListTodo}
          title={filter === "all" ? "Aucune tâche" : `Aucune tâche dans ${categoryById[filter as DbValue].label}`}
          description={filter === "all" ? "Ajoute ta première tâche au-dessus." : "Sélectionne « Toutes » pour voir les autres."}
        />
      )}

      <div className="space-y-1.5">
        {visible.map((t) => (
          <div
            key={t.id}
            className={`group flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 transition-colors hover:border-white/15 ${t.done ? "opacity-50" : ""}`}
          >
            <button onClick={() => toggle(t)} className="text-zinc-400 hover:text-violet-300">
              {t.done ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
            </button>
            <EditableTitle todo={t} onRename={(next) => rename(t, next)} />
            <RowCategoryPicker value={t.priority} onChange={(c) => changeCategory(t, c)} categories={categories} />
            {/* Date + heure de création — petit, à droite, format FR
                "DD/MM HH:MM". Permet à Yann de retrouver quand chaque tâche
                a été ajoutée. (6 mai 2026) */}
            <span
              className="ml-auto whitespace-nowrap font-mono text-[10px] tabular-nums text-zinc-500"
              title={new Date(t.created_at).toLocaleString("fr-FR")}
            >
              {new Date(t.created_at).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button onClick={() => del(t.id)} className="text-zinc-600 hover:text-rose-400">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */
/* EditableTitle : titre cliquable pour édition inline             */
/* (double-click sur le texte OU click sur l'icône crayon)         */
/* ============================================================ */
function EditableTitle({ todo, onRename }: { todo: Todo; onRename: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);

  // Si la prop todo.title change (reload externe), resync draft.
  useEffect(() => { setDraft(todo.title); }, [todo.title]);

  const save = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== todo.title) {
      onRename(draft);
    } else {
      setDraft(todo.title);
    }
  };
  const cancel = () => {
    setDraft(todo.title);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          else if (e.key === "Escape") cancel();
        }}
        onBlur={save}
        className="min-w-0 flex-1 rounded-md border border-violet-500/40 bg-violet-500/5 px-2 py-1 text-[13px] text-zinc-100 outline-none focus:border-violet-400/70"
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        onDoubleClick={() => setEditing(true)}
        title="Double-click pour modifier"
        className={`min-w-0 flex-1 cursor-text text-[13px] ${todo.done ? "line-through text-zinc-500" : "text-zinc-100"}`}
      >
        {todo.title}
      </span>
      <button
        onClick={() => setEditing(true)}
        title="Modifier le titre"
        className="text-zinc-600 opacity-0 transition-opacity hover:text-violet-300 group-hover:opacity-100"
      >
        <Pencil className="size-3" />
      </button>
    </div>
  );
}

/* ============================================================ */
/* CategoryPicker : 4 pills "radio" pour la création              */
/* ============================================================ */
function CategoryPicker({ value, onChange, categories }: { value: DbValue; onChange: (c: DbValue) => void; categories: Category[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-md border border-white/10 bg-white/[0.03] p-0.5">
      {categories.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
              active ? `${c.bg} ${c.text}` : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ */
/* RowCategoryPicker : 4 pills inline sur la ligne d'une tâche   */
/* (toutes visibles en permanence, click pour assigner)            */
/* ============================================================ */
function RowCategoryPicker({ value, onChange, categories }: { value: DbValue; onChange: (c: DbValue) => void; categories: Category[] }) {
  return (
    <div className="inline-flex gap-0.5">
      {categories.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            title={`Assigner à : ${c.label}`}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-all ${
              active
                ? `${c.border} ${c.bg} ${c.text} shadow-[0_0_8px_rgba(255,255,255,0.06)]`
                : "border-white/8 bg-white/[0.02] text-zinc-500 hover:border-white/20 hover:text-zinc-200"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ */
/* CategoryLabelEditor : panneau pour renommer les 5 catégories   */
/* ============================================================ */
function CategoryLabelEditor({
  initial,
  onSave,
  onReset,
  onCancel,
}: {
  initial: CategoryLabels;
  onSave: (next: CategoryLabels) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CategoryLabels>(initial);

  const handleChange = (key: DbValue, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial);

  return (
    <DeskCard className="mb-3 border-violet-500/30 bg-violet-500/[0.04]">
      <div className="mb-3 flex items-baseline gap-2">
        <Pencil className="size-3.5 text-violet-300" />
        <span className="text-[13px] font-medium text-zinc-100">Renommer les 5 catégories</span>
        <HelpTip>
          Tu changes uniquement l&apos;<em>affichage</em> des catégories. Tes tâches existantes
          gardent leur catégorie en BDD intacte. Les couleurs (rose / ambre / cyan / zinc)
          restent associées à chaque emplacement (1ère / 2e / 3e / 4e). Stocké en local sur
          ce navigateur.
        </HelpTip>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {CATEGORY_STYLES.map((s) => (
          <label key={s.id} className="flex items-center gap-2">
            <span className={`inline-flex size-5 shrink-0 rounded-full border ${s.border} ${s.bg}`} aria-hidden />
            <Input
              value={draft[s.id]}
              onChange={(e) => handleChange(s.id, e.target.value)}
              placeholder={DEFAULT_CATEGORY_LABELS[s.id]}
              maxLength={40}
              className="flex-1"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={onReset}
          title="Restaurer les noms par défaut (urgent / V2 / V3 / Idée à creuser)"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
        >
          <RotateCcw className="size-3" />
          Réinitialiser
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
          >
            <X className="size-3" />
            Annuler
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={!isDirty}
            className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-medium text-violet-100 transition-colors hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="size-3" />
            Enregistrer
          </button>
        </div>
      </div>
    </DeskCard>
  );
}
