"use client";

import { useState, useTransition } from "react";
import { Plus, Copy, Trash2, Star, Save, Eye, EyeOff, Check, X, ArrowUp, ArrowDown, Pencil, Move } from "lucide-react";
import {
  CURRENCIES,
  annualSavings,
  type PricingPlan,
  type PricingPrice,
  type PricingFeature,
  type PricingPlanFeature,
  type PricingPromoCode,
  type Currency,
  type Frequency,
} from "@/lib/billing/admin-types";

type Tab = "plans" | "prices" | "features" | "promos" | "stripe";

/**
 * Back-office pricing UI complet — Yann saisit TOUT depuis ici, jamais
 * besoin d'aller dans Supabase Studio (8 mai 2026 : "c'est trop complexe
 * pour que je le fasse").
 *
 * Architecture : 5 onglets, tout éditable inline. Aucun popup d'autorisation.
 */
export function PricingAdminClient({
  initialPlans,
  initialPrices,
  initialFeatures,
  initialPlanFeatures,
  initialPromoCodes,
}: {
  initialPlans: PricingPlan[];
  initialPrices: PricingPrice[];
  initialFeatures: PricingFeature[];
  initialPlanFeatures: PricingPlanFeature[];
  initialPromoCodes: PricingPromoCode[];
}) {
  const [tab, setTab] = useState<Tab>("plans");
  const [plans, setPlans] = useState(initialPlans);
  const [prices, setPrices] = useState(initialPrices);
  const [features, setFeatures] = useState(initialFeatures);
  const [planFeatures, setPlanFeatures] = useState(initialPlanFeatures);
  const [promoCodes, setPromoCodes] = useState(initialPromoCodes);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  async function api<T>(path: string, method: string, body?: unknown, opts: { silent?: boolean } = {}): Promise<T | null> {
    setBusy(true);
    if (!opts.silent) setMsg(null);
    try {
      const r = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        if (!opts.silent) setMsg({ type: "err", text: `❌ ${err.error || r.statusText}` });
        return null;
      }
      const data = await r.json();
      if (!opts.silent && method !== "GET") {
        setMsg({ type: "ok", text: "✅ Sauvegardé" });
        setTimeout(() => setMsg(null), 1800);
      }
      return data as T;
    } finally {
      setBusy(false);
    }
  }

  async function refreshAll() {
    const [p, pr, fe, pf, pc] = await Promise.all([
      api<PricingPlan[]>("/api/billing/admin/plans", "GET", undefined, { silent: true }),
      api<PricingPrice[]>("/api/billing/admin/prices", "GET", undefined, { silent: true }),
      api<PricingFeature[]>("/api/billing/admin/features", "GET", undefined, { silent: true }),
      api<PricingPlanFeature[]>("/api/billing/admin/plan-features", "GET", undefined, { silent: true }),
      api<PricingPromoCode[]>("/api/billing/admin/promos", "GET", undefined, { silent: true }),
    ]);
    startTransition(() => {
      if (p) setPlans(p);
      if (pr) setPrices(pr);
      if (fe) setFeatures(fe);
      if (pf) setPlanFeatures(pf);
      if (pc) setPromoCodes(pc);
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-zinc-100">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Pricing admin</h1>
        <div className="text-[10.5px] uppercase tracking-wider text-zinc-500">
          {plans.length} plans · {prices.length} prix · {features.length} fonctionnalités · {promoCodes.length} promos
        </div>
      </div>

      <p className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[12px] text-amber-200">
        <strong>TTC sans mention :</strong> les prix saisis ici sont affichés bruts en
        front. Stripe est configuré pour ne PAS ajouter de tax (à régler une fois pour
        toutes dans Stripe Dashboard → Settings → Tax → "Disabled").
      </p>

      <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
        {(["plans", "prices", "features", "promos", "stripe"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-2 text-[12px] font-semibold uppercase tracking-wider transition-colors ${
              tab === t
                ? "bg-violet-500/20 text-violet-100"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
            }`}
          >
            {labelOfTab(t)}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-3 rounded-lg border px-3 py-2 text-[12px] ${
          msg.type === "ok"
            ? "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-200"
            : "border-rose-500/30 bg-rose-500/[0.05] text-rose-200"
        }`}>
          {msg.text}
        </div>
      )}

      {tab === "plans" && (
        <PlansSection plans={plans} api={api} refresh={refreshAll} busy={busy} />
      )}
      {tab === "prices" && (
        <PricesSection plans={plans} prices={prices} api={api} refresh={refreshAll} busy={busy} />
      )}
      {tab === "features" && (
        <FeaturesSection
          plans={plans}
          features={features}
          planFeatures={planFeatures}
          api={api}
          refresh={refreshAll}
          busy={busy}
        />
      )}
      {tab === "promos" && (
        <PromosSection promos={promoCodes} api={api} refresh={refreshAll} busy={busy} />
      )}
      {tab === "stripe" && <StripeSection plans={plans} prices={prices} api={api} busy={busy} />}
    </main>
  );
}

function labelOfTab(t: Tab): string {
  return t === "plans" ? "Plans" : t === "prices" ? "Prix" : t === "features" ? "Fonctionnalités" : t === "promos" ? "Codes promo" : "Stripe sync";
}

type ApiFn = <T>(path: string, method: string, body?: unknown, opts?: { silent?: boolean }) => Promise<T | null>;

/* ─── Plans tab : édition inline COMPLÈTE ──────────────────────────── */

function PlansSection({
  plans,
  api,
  refresh,
  busy,
}: {
  plans: PricingPlan[];
  api: ApiFn;
  refresh: () => Promise<void>;
  busy: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PricingPlan>>({});

  function startEdit(p: PricingPlan) {
    setEditing(p.id);
    setDraft({ ...p });
  }
  function cancel() {
    setEditing(null);
    setDraft({});
  }
  async function save() {
    if (!editing) return;
    await api(`/api/billing/admin/plans/${editing}`, "PATCH", draft);
    await refresh();
    setEditing(null);
    setDraft({});
  }
  async function togglePlan(p: PricingPlan, field: "is_active" | "is_highlight") {
    await api(`/api/billing/admin/plans/${p.id}`, "PATCH", { [field]: !p[field] });
    await refresh();
  }
  async function deletePlan(p: PricingPlan) {
    if (!confirm(`Supprimer ${p.name_fr} ? Les prix et features liés seront supprimés aussi.`)) return;
    await api(`/api/billing/admin/plans/${p.id}`, "DELETE");
    await refresh();
  }
  async function dup(p: PricingPlan) {
    const code = prompt(`Code interne du nouveau plan (ex "investisseur_pro") :`);
    if (!code) return;
    const name = prompt("Nom affiché en français :", `${p.name_fr} (copie)`);
    if (!name) return;
    await api(`/api/billing/admin/plans/${p.id}/duplicate`, "POST", { code, name_fr: name });
    await refresh();
  }
  async function newPlan() {
    const code = prompt('Code interne du nouveau plan (ex "premium_lite") :');
    if (!code) return;
    const name = prompt("Nom affiché en français :", "Nouveau plan");
    if (!name) return;
    await api("/api/billing/admin/plans", "POST", {
      code,
      name_fr: name,
      tier_order: plans.length,
      is_active: true,
      accent_color: "#a78bfa",
    });
    await refresh();
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={newPlan}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-bold text-violet-100 transition-colors hover:bg-violet-500/25 disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Nouveau plan
        </button>
      </div>

      <div className="space-y-3">
        {plans.map((p) => {
          const isEditing = editing === p.id;
          const d = isEditing ? draft : p;
          return (
            <div key={p.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              {/* Ligne haut : nom, badges, boutons */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-block size-3 shrink-0 rounded-full" style={{ background: d.accent_color || "#a78bfa" }} />
                  <div>
                    <div className="font-display text-[18px] font-bold">{d.name_fr}</div>
                    <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">{d.code}</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <IconBtn title={p.is_highlight ? "Retirer recommandé" : "Marquer recommandé"} onClick={() => togglePlan(p, "is_highlight")} disabled={busy}>
                    <Star className={`size-4 ${p.is_highlight ? "fill-amber-300 text-amber-300" : "text-zinc-600"}`} />
                  </IconBtn>
                  <IconBtn title={p.is_active ? "Désactiver" : "Activer"} onClick={() => togglePlan(p, "is_active")} disabled={busy}>
                    {p.is_active ? <Eye className="size-4 text-emerald-300" /> : <EyeOff className="size-4 text-zinc-600" />}
                  </IconBtn>
                  <IconBtn title="Dupliquer" onClick={() => dup(p)} disabled={busy}>
                    <Copy className="size-3.5 text-cyan-300" />
                  </IconBtn>
                  <IconBtn title="Supprimer" onClick={() => deletePlan(p)} disabled={busy}>
                    <Trash2 className="size-3.5 text-rose-300" />
                  </IconBtn>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      disabled={busy}
                      className="ml-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-bold text-violet-200 hover:bg-violet-500/20"
                    >
                      Éditer
                    </button>
                  ) : (
                    <div className="ml-2 flex gap-1.5">
                      <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-1.5 text-[11px] font-bold text-zinc-50 hover:bg-violet-400">
                        <Save className="size-3.5" />Enregistrer
                      </button>
                      <button type="button" onClick={cancel} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/[0.08]">
                        <X className="size-3.5" />Annuler
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Champs éditables */}
              {isEditing ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <FieldRow label="Code" value={d.code ?? ""} onChange={(v) => setDraft({ ...draft, code: v })} mono />
                  <FieldRow label="Couleur (hex)" value={d.accent_color ?? "#a78bfa"} onChange={(v) => setDraft({ ...draft, accent_color: v })} mono placeholder="#a78bfa" />
                  <FieldRow label="Ordre d'affichage" value={String(d.tier_order ?? 0)} onChange={(v) => setDraft({ ...draft, tier_order: parseInt(v) || 0 })} />

                  <FieldRow label="Nom (FR)" value={d.name_fr ?? ""} onChange={(v) => setDraft({ ...draft, name_fr: v })} />
                  <FieldRow label="Nom (EN)" value={d.name_en ?? ""} onChange={(v) => setDraft({ ...draft, name_en: v })} />
                  <FieldRow label="Nom (DE)" value={d.name_de ?? ""} onChange={(v) => setDraft({ ...draft, name_de: v })} />

                  <FieldRow label="Tagline (FR)" value={d.tagline_fr ?? ""} onChange={(v) => setDraft({ ...draft, tagline_fr: v })} cols={3} multiline />
                  <FieldRow label="Tagline (EN)" value={d.tagline_en ?? ""} onChange={(v) => setDraft({ ...draft, tagline_en: v })} cols={3} multiline />
                  <FieldRow label="Tagline (DE)" value={d.tagline_de ?? ""} onChange={(v) => setDraft({ ...draft, tagline_de: v })} cols={3} multiline />

                  <FieldRow label="Audience cible (FR)" value={d.audience_fr ?? ""} onChange={(v) => setDraft({ ...draft, audience_fr: v })} cols={3} />
                  <FieldRow label="Audience (EN)" value={d.audience_en ?? ""} onChange={(v) => setDraft({ ...draft, audience_en: v })} cols={3} />
                  <FieldRow label="Audience (DE)" value={d.audience_de ?? ""} onChange={(v) => setDraft({ ...draft, audience_de: v })} cols={3} />

                  <FieldRow label="Texte du bouton CTA (FR)" value={d.cta_label_fr ?? ""} onChange={(v) => setDraft({ ...draft, cta_label_fr: v })} />
                  <FieldRow label="CTA (EN)" value={d.cta_label_en ?? ""} onChange={(v) => setDraft({ ...draft, cta_label_en: v })} />
                  <FieldRow label="CTA (DE)" value={d.cta_label_de ?? ""} onChange={(v) => setDraft({ ...draft, cta_label_de: v })} />
                </div>
              ) : (
                <div className="space-y-1 text-[12.5px] text-zinc-400">
                  {p.tagline_fr && <p className="italic">{p.tagline_fr}</p>}
                  {p.audience_fr && <p className="text-[11.5px] text-zinc-500">{p.audience_fr}</p>}
                  {p.cta_label_fr && (
                    <p className="text-[11px] text-zinc-500">
                      Bouton CTA : <span className="text-zinc-300">{p.cta_label_fr}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className="rounded-lg p-1.5 hover:bg-white/[0.04] disabled:opacity-30">
      {children}
    </button>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  cols = 1,
  multiline = false,
  mono = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  cols?: number;
  multiline?: boolean;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={cols === 3 ? "sm:col-span-3" : cols === 2 ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className={`w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none ${mono ? "font-mono" : ""}`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none ${mono ? "font-mono" : ""}`}
        />
      )}
    </div>
  );
}

/* ─── Prices tab ───────────────────────────────────────────────────── */

function PricesSection({
  plans,
  prices,
  api,
  refresh,
  busy,
}: {
  plans: PricingPlan[];
  prices: PricingPrice[];
  api: ApiFn;
  refresh: () => Promise<void>;
  busy: boolean;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id ?? "");
  const planPrices = prices.filter((p) => p.plan_id === selectedPlanId);
  function priceFor(currency: Currency, frequency: Frequency): PricingPrice | undefined {
    return planPrices.find((p) => p.currency === currency && p.frequency === frequency);
  }
  async function setPrice(currency: Currency, frequency: Frequency, amount: number) {
    const existing = priceFor(currency, frequency);
    const monthly = priceFor(currency, "monthly")?.amount_decimal ?? 0;
    const annual = frequency === "annual" ? amount : priceFor(currency, "annual")?.amount_decimal ?? 0;
    const sav = annualSavings(monthly, annual);
    await api("/api/billing/admin/prices", "POST", {
      id: existing?.id,
      plan_id: selectedPlanId,
      currency,
      frequency,
      amount_decimal: amount,
      annual_discount_pct: frequency === "annual" ? sav.pct : null,
      is_active: existing?.is_active ?? false, // par défaut inactif jusqu'au toggle explicite
    });
    await refresh();
  }

  /**
   * Yann (11 mai 2026) : toggle activé/désactivé par devise + sync
   * automatique Stripe. Au toggle ON sans stripe_price_id → POST
   * /api/billing/admin/stripe-sync qui crée le product + price. Au
   * toggle OFF → archive le price Stripe (jamais delete).
   */
  async function togglePrice(currency: Currency, frequency: Frequency, active: boolean) {
    const existing = priceFor(currency, frequency);
    if (!existing) return;
    await api("/api/billing/admin/prices", "POST", {
      id: existing.id,
      plan_id: existing.plan_id,
      currency,
      frequency,
      amount_decimal: existing.amount_decimal,
      annual_discount_pct: existing.annual_discount_pct,
      is_active: active,
    });
    if (active) {
      // Auto-create Stripe product/price si pas déjà fait
      await api("/api/billing/admin/stripe-sync", "POST");
    }
    await refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-[12px] text-zinc-400">Plan :</label>
        <select
          value={selectedPlanId}
          onChange={(e) => setSelectedPlanId(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-zinc-100"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name_fr} ({p.code})
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.05] px-3 py-2 text-[11.5px] text-cyan-100">
        💡 Le toggle <strong>Actif</strong> active/désactive cette devise pour ce plan. Au passage à <strong>actif</strong>, le prix est créé automatiquement dans Stripe (product + price). Au passage à <strong>inactif</strong>, le price Stripe est archivé (jamais supprimé). Tu peux donc préparer toutes les devises en avance et n&apos;activer que celles que tu veux ouvrir.
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-[12.5px]">
          <thead className="bg-white/[0.03]">
            <tr>
              <th className="px-3 py-2 text-left">Devise</th>
              <th className="px-3 py-2 text-right">Mensuel</th>
              <th className="px-3 py-2 text-center">Actif</th>
              <th className="px-3 py-2 text-right">Annuel</th>
              <th className="px-3 py-2 text-center">Actif</th>
              <th className="px-3 py-2 text-right">Réduction annuelle</th>
            </tr>
          </thead>
          <tbody>
            {CURRENCIES.map((c) => {
              const m = priceFor(c, "monthly");
              const y = priceFor(c, "annual");
              const sav = m && y ? annualSavings(m.amount_decimal, y.amount_decimal) : null;
              return (
                <tr key={c} className="border-t border-white/[0.04]">
                  <td className="px-3 py-2.5 font-mono text-zinc-400">{c}</td>
                  <td className="px-3 py-2.5 text-right">
                    <PriceInput defaultValue={m?.amount_decimal ?? 0} onSave={(v) => setPrice(c, "monthly", v)} disabled={busy} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ActiveToggle
                      active={!!m?.is_active}
                      hasStripeId={!!m?.stripe_price_id}
                      hasPrice={(m?.amount_decimal ?? 0) > 0}
                      onToggle={(v) => togglePrice(c, "monthly", v)}
                      disabled={busy}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <PriceInput defaultValue={y?.amount_decimal ?? 0} onSave={(v) => setPrice(c, "annual", v)} disabled={busy} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ActiveToggle
                      active={!!y?.is_active}
                      hasStripeId={!!y?.stripe_price_id}
                      hasPrice={(y?.amount_decimal ?? 0) > 0}
                      onToggle={(v) => togglePrice(c, "annual", v)}
                      disabled={busy}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right text-zinc-300">
                    {sav ? (
                      <span>
                        <span className="font-mono text-emerald-300">−{sav.pct.toFixed(1)} %</span>
                        <span className="ml-2 text-[10.5px] text-zinc-500">(−{sav.amount.toFixed(2)} {c}/an)</span>
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActiveToggle({
  active,
  hasStripeId,
  hasPrice,
  onToggle,
  disabled,
}: {
  active: boolean;
  hasStripeId: boolean;
  hasPrice: boolean;
  onToggle: (active: boolean) => void;
  disabled: boolean;
}) {
  const canActivate = hasPrice;
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onToggle(!active)}
        disabled={disabled || !canActivate}
        title={
          !canActivate
            ? "Renseigne d'abord un prix > 0 pour pouvoir activer cette devise."
            : active
              ? "Désactiver cette devise (price Stripe archivé)"
              : hasStripeId
                ? "Réactiver cette devise"
                : "Activer cette devise (price Stripe créé automatiquement)"
        }
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          active ? "bg-emerald-500/80" : "bg-zinc-700"
        } ${disabled || !canActivate ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            active ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      {hasStripeId && (
        <span className="font-mono text-[9px] text-emerald-300/70" title="Price ID Stripe synchronisé">
          ✓
        </span>
      )}
    </div>
  );
}

function PriceInput({ defaultValue, onSave, disabled }: { defaultValue: number; onSave: (v: number) => void; disabled: boolean }) {
  const [v, setV] = useState(defaultValue.toString());
  return (
    <div className="inline-flex items-center gap-1.5">
      <input type="number" step="0.01" value={v} onChange={(e) => setV(e.target.value)} className="w-24 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-right text-[12.5px] text-zinc-100" />
      <button type="button" onClick={() => onSave(parseFloat(v) || 0)} disabled={disabled || parseFloat(v) === defaultValue} className="rounded p-1 text-violet-300 hover:bg-violet-500/15 disabled:opacity-30">
        <Save className="size-3.5" />
      </button>
    </div>
  );
}

/* ─── Features tab : matrice éditable inline + nouvelle feature ────── */

function FeaturesSection({
  plans,
  features,
  planFeatures,
  api,
  refresh,
  busy,
}: {
  plans: PricingPlan[];
  features: PricingFeature[];
  planFeatures: PricingPlanFeature[];
  api: ApiFn;
  refresh: () => Promise<void>;
  busy: boolean;
}) {
  function valueFor(planId: string, featureId: string): string {
    return planFeatures.find((pf) => pf.plan_id === planId && pf.feature_id === featureId)?.value_fr ?? "";
  }
  async function setValue(planId: string, featureId: string, value: string) {
    await api("/api/billing/admin/plan-features", "POST", {
      plan_id: planId,
      feature_id: featureId,
      value_fr: value,
      is_active: true,
    });
    await refresh();
  }
  async function copyFeatureToOthers(featureId: string, sourcePlanId: string) {
    const allOthers = plans.filter((p) => p.id !== sourcePlanId);
    if (!confirm(`Copier la valeur de cette ligne vers les ${allOthers.length} autres plans ?`)) return;
    await api(`/api/billing/admin/features/${featureId}/copy`, "POST", {
      sourcePlanId,
      targetPlanIds: allOthers.map((p) => p.id),
    });
    await refresh();
  }
  async function newFeature() {
    const label = prompt("Libellé de la fonctionnalité (FR) :");
    if (!label) return;
    const code = prompt("Code interne (ex 'feature_xyz') :", label.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
    if (!code) return;
    await api("/api/billing/admin/features", "POST", {
      code,
      label_fr: label,
      category: "Général",
      category_order: 99,
      feature_order: features.length + 1,
      is_active: true,
    });
    await refresh();
  }
  async function deleteFeature(f: PricingFeature) {
    if (!confirm(`Supprimer la ligne "${f.label_fr}" ? Les valeurs liées sur tous les plans seront supprimées aussi.`)) return;
    await api(`/api/billing/admin/features/${f.id}`, "DELETE");
    await refresh();
  }
  async function renameFeature(f: PricingFeature) {
    const label = prompt("Nouveau libellé (FR) :", f.label_fr);
    if (!label || label === f.label_fr) return;
    await api(`/api/billing/admin/features/${f.id}`, "PATCH", { label_fr: label });
    await refresh();
  }
  async function setFeatureCategory(f: PricingFeature, category: string) {
    await api(`/api/billing/admin/features/${f.id}`, "PATCH", { category });
    await refresh();
  }
  async function moveFeature(f: PricingFeature, dir: -1 | 1) {
    // Liste triée actuelle (ordre d'affichage)
    const sorted = [...features].sort((a, b) => (a.feature_order ?? 0) - (b.feature_order ?? 0));
    const idx = sorted.findIndex((x) => x.id === f.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await api("/api/billing/admin/features/swap-order", "POST", { idA: f.id, idB: other.id });
    await refresh();
  }

  // Yann (11 mai 2026) : drag-and-drop natif + sélection multiple.
  // Sélectionne via checkbox 1 ou plusieurs lignes, drag handle (Move
  // icon) pour déplacer le bloc à n'importe quelle position. POST
  // /reorder en bulk (1 seul roundtrip BDD au lieu de N swaps).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggingIds, setDraggingIds] = useState<string[] | null>(null);
  const [dropOverId, setDropOverId] = useState<string | null>(null);

  function toggleSelect(id: string, ev: React.MouseEvent) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (ev.shiftKey && prev.size > 0) {
        // Shift+click → select range entre dernier sélectionné et clic
        const sorted = [...features].sort((a, b) => (a.feature_order ?? 0) - (b.feature_order ?? 0));
        const lastSelectedIdx = sorted.findIndex((f) => prev.has(f.id));
        const targetIdx = sorted.findIndex((f) => f.id === id);
        if (lastSelectedIdx >= 0 && targetIdx >= 0) {
          const [from, to] = lastSelectedIdx < targetIdx ? [lastSelectedIdx, targetIdx] : [targetIdx, lastSelectedIdx];
          for (let i = from; i <= to; i++) next.add(sorted[i].id);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function performReorder(targetIdxBefore: number) {
    const sorted = [...features].sort((a, b) => (a.feature_order ?? 0) - (b.feature_order ?? 0));
    const movingIds = draggingIds && draggingIds.length > 0 ? draggingIds : Array.from(selectedIds);
    if (movingIds.length === 0) return;
    // Liste finale = (lignes non bougées avant la cible) + (movingIds dans leur ordre original) + (lignes non bougées après cible)
    const movingSet = new Set(movingIds);
    const movingOrdered = sorted.filter((f) => movingSet.has(f.id)).map((f) => f.id);
    const remaining = sorted.filter((f) => !movingSet.has(f.id));
    // Trouve l'index "before" dans remaining (= nb d'items remaining qui sont AVANT la position visuelle cible)
    const insertAt = Math.min(Math.max(targetIdxBefore, 0), remaining.length);
    const finalOrder = [
      ...remaining.slice(0, insertAt).map((f) => f.id),
      ...movingOrdered,
      ...remaining.slice(insertAt).map((f) => f.id),
    ];
    await api("/api/billing/admin/features/reorder", "POST", { orderedIds: finalOrder });
    setDraggingIds(null);
    setDropOverId(null);
    clearSelection();
    await refresh();
  }

  // Catégories disponibles : toutes les catégories utilisées + "Général"
  // (toujours présent par défaut). Évite la suppression accidentelle des
  // catégories saisies par Yann.
  const categoriesSet = new Set<string>(["Général"]);
  for (const f of features) if (f.category) categoriesSet.add(f.category);
  const categories = Array.from(categoriesSet).sort();

  // Liste plate triée par feature_order (ordre choisi par Yann via flèches).
  const sortedFeatures = [...features].sort((a, b) => (a.feature_order ?? 0) - (b.feature_order ?? 0));

  return (
    <div>
      <div className="mb-3 flex justify-between items-center">
        <div className="text-[11px] text-zinc-500">
          <p>Liste à plat (ordre choisi via flèches OU drag & drop).</p>
          <p className="mt-0.5 text-zinc-400">
            💡 Coche plusieurs lignes (case à gauche, ou Shift+clic pour range) puis drag la poignée <Move className="inline size-3 -translate-y-0.5" /> de n&apos;importe laquelle pour déplacer le bloc en bloc.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
              {selectedIds.size} ligne{selectedIds.size > 1 ? "s" : ""} sélectionnée{selectedIds.size > 1 ? "s" : ""}
              <button onClick={clearSelection} className="ml-2 text-violet-300 hover:text-violet-100">×</button>
            </span>
          )}
          <button
            type="button"
            onClick={newFeature}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-bold text-violet-100 transition-colors hover:bg-violet-500/25 disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            Nouvelle fonctionnalité
          </button>
        </div>
      </div>

      {features.length === 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-[12.5px] text-amber-200">
          Aucune fonctionnalité dans le catalogue. Clique « Nouvelle fonctionnalité » pour commencer.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-[12px]">
            <thead className="bg-white/[0.03]">
              <tr>
                <th className="px-2 py-2 text-center w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === sortedFeatures.length && sortedFeatures.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(sortedFeatures.map((f) => f.id)));
                      else clearSelection();
                    }}
                    className="cursor-pointer accent-violet-500"
                    title="Sélectionner tout"
                  />
                </th>
                <th className="px-1 py-2 text-center w-8" title="Drag pour déplacer"></th>
                <th className="px-2 py-2 text-center w-12">Ordre</th>
                <th className="px-3 py-2 text-left">Fonctionnalité</th>
                <th className="px-3 py-2 text-left w-40">Catégorie</th>
                {plans.map((p) => (
                  <th key={p.id} className="px-3 py-2 text-center" style={{ color: p.accent_color }}>{p.name_fr}</th>
                ))}
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedFeatures.map((f, i) => {
                const isSelected = selectedIds.has(f.id);
                const isDragging = draggingIds?.includes(f.id);
                const isDropOver = dropOverId === f.id;
                return (
                <tr
                  key={f.id}
                  className={`border-t border-white/[0.04] transition-colors ${
                    isSelected ? "bg-violet-500/[0.08]" : "hover:bg-white/[0.02]"
                  } ${isDragging ? "opacity-30" : ""} ${
                    isDropOver ? "border-t-2 border-t-violet-400" : ""
                  }`}
                  onDragOver={(e) => {
                    if (draggingIds) {
                      e.preventDefault();
                      setDropOverId(f.id);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!draggingIds) return;
                    // Index visuel cible = position de la ligne survolée parmi les non-bougées
                    const movingSet = new Set(draggingIds);
                    const remaining = sortedFeatures.filter((x) => !movingSet.has(x.id));
                    const targetIdx = remaining.findIndex((x) => x.id === f.id);
                    void performReorder(targetIdx >= 0 ? targetIdx : 0);
                  }}
                >
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => toggleSelect(f.id, e)}
                      onChange={() => {}}
                      className="cursor-pointer accent-violet-500"
                    />
                  </td>
                  <td className="px-1 py-2 text-center">
                    <div
                      draggable
                      onDragStart={(e) => {
                        // Si la ligne fait partie d'une sélection > 1 → on déplace la sélection. Sinon juste cette ligne.
                        const ids = isSelected && selectedIds.size > 1 ? Array.from(selectedIds) : [f.id];
                        setDraggingIds(ids);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", ids.join(","));
                      }}
                      onDragEnd={() => {
                        setDraggingIds(null);
                        setDropOverId(null);
                      }}
                      title={isSelected && selectedIds.size > 1 ? `Déplacer ${selectedIds.size} lignes` : "Déplacer cette ligne"}
                      className="inline-flex cursor-grab items-center justify-center rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 active:cursor-grabbing"
                    >
                      <Move className="size-3.5" />
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <IconBtn title="Monter" onClick={() => moveFeature(f, -1)} disabled={busy || i === 0}>
                        <ArrowUp className="size-3 text-zinc-300" />
                      </IconBtn>
                      <IconBtn title="Descendre" onClick={() => moveFeature(f, 1)} disabled={busy || i === sortedFeatures.length - 1}>
                        <ArrowDown className="size-3 text-zinc-300" />
                      </IconBtn>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-zinc-100">{f.label_fr}</span>
                      <button
                        type="button"
                        onClick={() => renameFeature(f)}
                        disabled={busy}
                        title="Renommer"
                        className="rounded p-0.5 text-zinc-500 hover:text-zinc-200"
                      >
                        <Pencil className="size-3" />
                      </button>
                    </div>
                    {f.help_fr && <div className="text-[10.5px] text-zinc-500">{f.help_fr}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={f.category ?? "Général"}
                      onChange={(e) => setFeatureCategory(f, e.target.value)}
                      disabled={busy}
                      className="w-full rounded border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11px] text-zinc-200"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  {plans.map((p) => (
                    <td key={p.id} className="px-2 py-1.5 text-center">
                      <ValueCell value={valueFor(p.id, f.id)} onSave={(v) => setValue(p.id, f.id, v)} disabled={busy} />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) copyFeatureToOthers(f.id, e.target.value);
                        e.target.value = "";
                      }}
                      disabled={busy}
                      className="mr-1 rounded border border-white/[0.08] bg-white/[0.02] px-1.5 py-1 text-[10.5px] text-zinc-300"
                    >
                      <option value="">Copier depuis…</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name_fr}</option>
                      ))}
                    </select>
                    <IconBtn title="Supprimer la ligne" onClick={() => deleteFeature(f)} disabled={busy}>
                      <Trash2 className="size-3 text-rose-300" />
                    </IconBtn>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[10.5px] text-zinc-500">
        Tape directement dans la cellule pour modifier la valeur affichée. <code>true</code> = ✓ vert, <code>false</code> = cadenas gris, autre texte = affiché tel quel (ex « 5 alertes », « Illimité »). Renommer une ligne avec ✏️. Réorganiser avec ↑↓.
      </p>
    </div>
  );
}

function ValueCell({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled: boolean }) {
  const [v, setV] = useState(value);
  const [edit, setEdit] = useState(false);

  function commit() {
    if (v !== value) onSave(v);
    setEdit(false);
  }

  if (!edit) {
    return (
      <button
        type="button"
        onClick={() => { setV(value); setEdit(true); }}
        disabled={disabled}
        className="w-full rounded px-1.5 py-1 text-center hover:bg-violet-500/10"
      >
        {value === "true" ? <Check className="mx-auto size-3.5 text-emerald-300" /> :
         value === "false" ? <span className="text-zinc-700">—</span> :
         value || <span className="text-zinc-700">cliquer</span>}
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1">
      <input
        autoFocus
        type="text"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEdit(false); }}
        className="w-32 rounded border border-violet-500/40 bg-white/[0.02] px-1.5 py-0.5 text-[11px] text-zinc-100"
      />
    </div>
  );
}

/* ─── Promos tab ───────────────────────────────────────────────────── */

function PromosSection({
  promos,
  api,
  refresh,
  busy,
}: {
  promos: PricingPromoCode[];
  api: ApiFn;
  refresh: () => Promise<void>;
  busy: boolean;
}) {
  async function togglePromo(p: PricingPromoCode) {
    await api(`/api/billing/admin/promos/${p.id}`, "PATCH", { is_active: !p.is_active });
    await refresh();
  }
  async function newPromo() {
    const code = prompt("Code promo (ex SUMMER2026) :")?.toUpperCase();
    if (!code) return;
    await api("/api/billing/admin/promos", "POST", {
      code,
      discount_type: "percent",
      discount_percent: 20,
      max_redemptions: null,
      max_per_user: 1,
      recurring: false,
      is_active: true,
    });
    await refresh();
  }
  async function deletePromo(p: PricingPromoCode) {
    if (!confirm(`Supprimer le code ${p.code} ?`)) return;
    await api(`/api/billing/admin/promos/${p.id}`, "DELETE");
    await refresh();
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={newPromo} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-bold text-violet-100 transition-colors hover:bg-violet-500/25">
          <Plus className="size-3.5" />Nouveau code
        </button>
      </div>
      <p className="mb-3 text-[11px] text-zinc-500">
        Réglages par ordre d'importance : <strong>code court mémorable</strong> → <strong>remise (% ou montant)</strong> → <strong>durée</strong> → <strong>usages max global et par utilisateur</strong> → <strong>ciblage plans / devises / fréquence</strong> → <strong>nouveaux clients seulement</strong>.
      </p>
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-[12.5px]">
          <thead className="bg-white/[0.03]">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-right">Remise</th>
              <th className="px-3 py-2 text-right">Usages</th>
              <th className="px-3 py-2 text-right">Expire</th>
              <th className="px-3 py-2 text-center">Actif</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {promos.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-500">Aucun code promo. Crée le premier ↑</td></tr>
            )}
            {promos.map((p) => (
              <tr key={p.id} className="border-t border-white/[0.04]">
                <td className="px-3 py-2.5 font-mono font-bold text-violet-200">{p.code}</td>
                <td className="px-3 py-2.5 text-right text-zinc-200">
                  {p.discount_type === "percent" ? `${p.discount_percent} %` : `${p.discount_amount_decimal} ${p.discount_currency ?? ""}`}
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-300">
                  {p.redemptions_count}{p.max_redemptions ? ` / ${p.max_redemptions}` : " / ∞"}
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-400">
                  {p.expires_at ? new Date(p.expires_at).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button type="button" onClick={() => togglePromo(p)} disabled={busy}>
                    {p.is_active ? <Eye className="size-4 text-emerald-300" /> : <EyeOff className="size-4 text-zinc-600" />}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button type="button" onClick={() => deletePromo(p)} disabled={busy} className="text-rose-300 hover:text-rose-200">
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Stripe sync tab ──────────────────────────────────────────────── */

function StripeSection({
  plans,
  prices,
  api,
  busy,
}: {
  plans: PricingPlan[];
  prices: PricingPrice[];
  api: ApiFn;
  busy: boolean;
}) {
  const synced = prices.filter((p) => p.stripe_price_id).length;
  const total = prices.length;
  async function sync() {
    if (!confirm(`Synchroniser ${total - synced} prix vers Stripe (test mode) ?`)) return;
    const r = await api<{ created: number; updated: number }>("/api/billing/admin/stripe-sync", "POST");
    if (r) alert(`✅ ${r.created} créés, ${r.updated} mis à jour`);
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <h2 className="mb-3 font-display text-[18px] font-bold tracking-tight">Sync Stripe</h2>
      <p className="mb-4 text-[13px] text-zinc-400">
        Pousse les prix locaux vers Stripe. Les Price IDs créés sont stockés dans <code className="mx-1 text-zinc-300">pricing_prices.stripe_price_id</code>.
      </p>
      <div className="mb-5 grid grid-cols-3 gap-3 text-center">
        <Stat label="Plans actifs" value={plans.filter((p) => p.is_active).length} />
        <Stat label="Prix locaux" value={total} />
        <Stat label="Prix synchronisés" value={synced} accent="#10b981" />
      </div>
      <button type="button" onClick={sync} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-[13.5px] font-bold text-zinc-50 transition-colors hover:bg-violet-400 disabled:opacity-50">
        Sync Stripe (test mode)
      </button>
    </div>
  );
}

function Stat({ label, value, accent = "#a78bfa" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <div className="font-mono text-[22px] font-bold tabular-nums" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}
