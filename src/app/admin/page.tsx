import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Trash2,
  KeyRound,
  Ban,
  CircleCheck,
  AlertCircle,
  Lock,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import {
  adminDeleteUser,
  adminSendReset,
  adminBanToggle,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin · Mettrik" };

type AdminUser = {
  id: string;
  email: string;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
};

async function loadUsers(): Promise<AdminUser[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) return [];
  return data.users.map((u) => ({
    id: u.id,
    email: u.email ?? "—",
    provider: (u.app_metadata?.provider as string | undefined) ?? "email",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    banned_until: (u as any).banned_until ?? null,
  }));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();

  const sp = await searchParams;
  const users = await loadUsers();
  const total = users.length;
  const confirmed = users.filter((u) => u.email_confirmed_at).length;
  const banned = users.filter((u) => u.banned_until).length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:bg-white/[0.07]"
            >
              <ArrowLeft className="size-3.5" />
              Home
            </Link>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-50">
              Admin
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              <ShieldCheck className="size-3" />
              Restreint
            </span>
          </div>
          <div className="text-right text-[11.5px] text-zinc-500">
            Connecté : <span className="text-zinc-300">{user.email}</span>
          </div>
        </div>

        {/* Flash */}
        {sp.error && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            <AlertCircle className="size-3.5" />
            {sp.error}
          </div>
        )}
        {sp.info && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
            <CircleCheck className="size-3.5" />
            {sp.info}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Comptes" value={String(total)} accent="#a78bfa" />
          <Stat label="Confirmés" value={String(confirmed)} accent="#10b981" />
          <Stat label="Bannis" value={String(banned)} accent="#f43f5e" />
          <Stat label="MRR" value="—" sub="Paiement V1.5" accent="#22d3ee" />
        </div>

        {/* Mots de passe — bandeau d'honnêteté */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <Lock className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <div className="text-[12.5px] leading-relaxed text-amber-100/90">
            <span className="font-semibold text-amber-200">
              Les mots de passe ne sont jamais visibles.
            </span>{" "}
            Supabase ne stocke que des hashs bcrypt (algo à sens unique). Si
            un user a oublié le sien : clique « Reset » sur sa ligne pour lui
            envoyer un lien de réinitialisation. S&apos;il veut effacer son
            inscription : clique « Supprimer » et il pourra se ré-inscrire
            avec le même email.
          </div>
        </div>

        {/* Table users */}
        <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0a0a0e]">
          <div className="border-b border-white/8 bg-white/[0.02] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Utilisateurs ({total})
          </div>
          <div className="divide-y divide-white/5">
            {users.length === 0 && (
              <div className="px-4 py-6 text-center text-[13px] text-zinc-500">
                Aucun utilisateur pour l&apos;instant.
              </div>
            )}
            {users.map((u) => (
              <UserRow key={u.id} u={u} self={u.id === user.id} />
            ))}
          </div>
        </div>

        {/* Paiement / forfaits — placeholder V1.5 */}
        <section className="mt-8 rounded-xl border border-white/8 bg-[#0a0a0e] p-5">
          <header className="mb-3 flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-zinc-50">
              Paiement &amp; forfaits
            </h2>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              V1.5
            </span>
          </header>
          <p className="text-[12.5px] leading-relaxed text-zinc-400">
            Cette section affichera : forfait souscrit (Free / Pro / Premium),
            date de souscription, montant payé, code de réduction utilisé,
            renouvellement, MRR par cohorte, churn. À brancher quand Stripe
            sera intégré (V1.5). Schéma DB déjà pensé pour : table{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
              subscriptions
            </code>{" "}
            (user_id, plan, started_at, ended_at, amount_cents, currency,
            promo_code, stripe_subscription_id).
          </p>
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl border border-white/8 bg-[#0a0a0e] p-4"
      style={{ boxShadow: `inset 0 0 0 1px ${accent}10` }}
    >
      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </div>
      <div
        className="mt-1.5 font-display text-2xl font-semibold tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10.5px] text-zinc-500">{sub}</div>
      )}
    </div>
  );
}

function UserRow({ u, self }: { u: AdminUser; self: boolean }) {
  const isBanned = !!u.banned_until;
  const isConfirmed = !!u.email_confirmed_at;
  return (
    <div className="grid grid-cols-12 items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:px-5">
      <div className="col-span-12 sm:col-span-4">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-zinc-100">
            {u.email}
          </span>
          {self && (
            <span className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-violet-200">
              toi
            </span>
          )}
          {isBanned && (
            <span className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-rose-200">
              banni
            </span>
          )}
          {!isConfirmed && !isBanned && (
            <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-200">
              non confirmé
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10.5px] text-zinc-500">
          {u.id.slice(0, 8)}… · {u.provider}
        </div>
      </div>

      <div className="col-span-6 font-mono text-[11px] tabular-nums text-zinc-300 sm:col-span-3">
        <div className="text-zinc-400">Inscrit</div>
        <div>{fmtDate(u.created_at)}</div>
      </div>

      <div className="col-span-6 font-mono text-[11px] tabular-nums text-zinc-300 sm:col-span-2">
        <div className="text-zinc-400">Dernière conn.</div>
        <div>{fmtDate(u.last_sign_in_at)}</div>
      </div>

      <div className="col-span-12 flex flex-wrap items-center justify-end gap-1.5 sm:col-span-3">
        <form action={adminSendReset} className="inline">
          <input type="hidden" name="email" value={u.email} />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-md border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-100 transition-colors hover:bg-violet-500/20"
            title="Envoyer un lien de réinitialisation de mot de passe"
          >
            <KeyRound className="size-3" />
            Reset
          </button>
        </form>

        {!self && (
          <form action={adminBanToggle} className="inline">
            <input type="hidden" name="user_id" value={u.id} />
            <input type="hidden" name="ban" value={isBanned ? "0" : "1"} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-100 transition-colors hover:bg-amber-500/20"
              title={isBanned ? "Débannir cet utilisateur" : "Bannir cet utilisateur"}
            >
              <Ban className="size-3" />
              {isBanned ? "Débannir" : "Bannir"}
            </button>
          </form>
        )}

        {!self && (
          <form action={adminDeleteUser} className="inline">
            <input type="hidden" name="user_id" value={u.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100 transition-colors hover:bg-rose-500/20"
              title="Supprimer définitivement (l'email pourra ressouscrire)"
            >
              <Trash2 className="size-3" />
              Supprimer
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
