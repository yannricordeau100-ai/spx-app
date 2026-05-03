"use client";

import { useEffect, useState } from "react";
import { Save, RotateCcw, Power } from "lucide-react";
import { DeskCard, HelpTip, Input, PrimaryButton } from "./ui";
import { DEFAULT_REFERRAL_SETTINGS, type ReferralSettings } from "@/lib/referrals";

/**
 * Backoffice settings du programme de parrainage.
 * Tous les paramètres ajustables sont ici. Modifs persistées en BDD via
 * /api/desk/referrals-settings (PATCH). Visible uniquement par le owner du desk.
 */
export function TabReferrals() {
  const [settings, setSettings] = useState<ReferralSettings>(DEFAULT_REFERRAL_SETTINGS);
  const [draft, setDraft] = useState<ReferralSettings>(DEFAULT_REFERRAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/desk/referrals-settings");
    if (r.ok) {
      const data = await r.json();
      if (data) {
        setSettings(data);
        setDraft(data);
      }
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const r = await fetch("/api/desk/referrals-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (r.ok) {
      const data = await r.json();
      setSettings(data);
      setDraft(data);
      setSavedAt(new Date());
    }
    setSaving(false);
  }

  function reset() {
    setDraft(settings);
  }

  function update<K extends keyof ReferralSettings>(key: K, value: ReferralSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  if (loading) {
    return <div className="text-[12px] text-zinc-500">Chargement…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Statut on/off */}
      <DeskCard className={draft.enabled ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-amber-500/30 bg-amber-500/[0.04]"}>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 text-[13px] font-medium text-zinc-100">
              <Power className={`size-3.5 ${draft.enabled ? "text-emerald-300" : "text-amber-300"}`} />
              Programme de parrainage : {draft.enabled ? "ACTIF" : "SUSPENDU"}
              <HelpTip>
                Si suspendu, la page /parrainage affiche un message « programme temporairement suspendu » aux
                visiteurs. Les codes existants restent valides mais aucune nouvelle génération.
              </HelpTip>
            </div>
            <p className="text-[11.5px] text-zinc-400">
              {draft.enabled
                ? "Les utilisateurs peuvent générer des codes de parrainage et les filleuls peuvent en bénéficier."
                : "Aucune nouvelle génération possible. Les codes existants restent affichés mais désactivés côté API."}
            </p>
          </div>
          <button
            onClick={() => update("enabled", !draft.enabled)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              draft.enabled
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                : "border-amber-500/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
            }`}
          >
            {draft.enabled ? "Suspendre" : "Activer"}
          </button>
        </div>
      </DeskCard>

      {/* Paramètres récompense */}
      <DeskCard>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-100">Récompense</span>
          <HelpTip>
            Combien de mois offerts aux 2 parties (parrain + filleul) quand le filleul souscrit un plan payant.
            S&apos;applique sur le plan respectif de chacun.
          </HelpTip>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Mois offerts"
            value={draft.reward_months}
            min={1}
            max={12}
            onChange={(v) => update("reward_months", v)}
          />
          <SelectField
            label="Plan requis pour le filleul"
            value={draft.required_plan}
            onChange={(v) => update("required_plan", v as ReferralSettings["required_plan"])}
            options={[
              { value: "any_paid", label: "N'importe quel plan payant" },
              { value: "monthly_only", label: "Mensuel uniquement" },
              { value: "annual_only", label: "Annuel uniquement" },
            ]}
          />
        </div>
      </DeskCard>

      {/* Quotas et durée */}
      <DeskCard>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-100">Quotas et durée</span>
          <HelpTip>
            Limite anti-abus. Un parrain ne peut pas envoyer un nombre illimité de codes. Les codes ont aussi
            une date d&apos;expiration au-delà de laquelle ils sont automatiquement marqués &quot;expired&quot;.
          </HelpTip>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Max filleuls par parrain"
            value={draft.max_referees_per_user}
            min={1}
            max={1000}
            onChange={(v) => update("max_referees_per_user", v)}
          />
          <NumberField
            label="Validité du code (jours)"
            value={draft.code_validity_days}
            min={1}
            max={365}
            onChange={(v) => update("code_validity_days", v)}
          />
        </div>
      </DeskCard>

      {/* Bannières FR et EN */}
      <DeskCard>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-100">Texte de la bannière (FR + EN)</span>
          <HelpTip>
            Phrase d&apos;accroche affichée sur la page /parrainage. Une version FR (visible sur /fr/parrainage)
            et une version EN (visible sur /parrainage). Sois concis (max ~80 caractères).
          </HelpTip>
        </div>
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">FR</span>
            <Input
              value={draft.banner_text_fr}
              onChange={(e) => update("banner_text_fr", e.target.value)}
              maxLength={120}
              className="w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">EN</span>
            <Input
              value={draft.banner_text_en}
              onChange={(e) => update("banner_text_en", e.target.value)}
              maxLength={120}
              className="w-full"
            />
          </label>
        </div>
      </DeskCard>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-zinc-500">
          {savedAt && `Enregistré ${savedAt.toLocaleTimeString("fr-FR")}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="size-3" />
            Annuler
          </button>
          <PrimaryButton onClick={save} disabled={!isDirty || saving}>
            <Save className="size-3.5" />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </PrimaryButton>
        </div>
      </div>

      {/* Lien vers la page publique */}
      <DeskCard className="border-cyan-500/20 bg-cyan-500/[0.03]">
        <p className="text-[12px] text-zinc-300">
          Aperçu côté visiteur :{" "}
          <a href="/parrainage" target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">
            mettrik.ai/parrainage
          </a>{" "}
          (EN) ·{" "}
          <a href="/fr/parrainage" target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">
            mettrik.ai/fr/parrainage
          </a>{" "}
          (FR)
        </p>
      </DeskCard>
    </div>
  );
}

function NumberField({
  label, value, onChange, min, max,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        min={min}
        max={max}
        className="block w-full rounded-md border border-[#262626] bg-[#0c0c0c] px-3 py-2 text-[14px] text-zinc-100 outline-none focus:border-violet-400/60"
      />
    </label>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-[#262626] bg-[#0c0c0c] px-3 py-2 text-[14px] text-zinc-100 outline-none focus:border-violet-400/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
