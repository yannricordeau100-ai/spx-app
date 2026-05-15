import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Whoami · diag",
  robots: { index: false, follow: false },
};

/**
 * Page de diagnostic : montre TON état d'authentification.
 * Sert à comprendre pourquoi le desk te répond 404.
 */
export default async function WhoamiPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const expectedOwner = (process.env.DESK_OWNER_EMAIL ?? "yannricordeau100@gmail.com").toLowerCase().trim();
  const userEmail = (user?.email ?? "").toLowerCase().trim();
  const matches = userEmail === expectedOwner;

  return (
    <div className="min-h-screen bg-[#050507] p-8 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-display text-2xl font-bold">🔍 Diagnostic auth Mettrik AI</h1>

        <div className={`mb-6 rounded-xl border p-4 ${user ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
          <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400 mb-2">Connecté ?</div>
          {user ? (
            <div className="text-emerald-300 font-bold text-lg">✅ Oui, tu es connecté</div>
          ) : (
            <div className="text-rose-300 font-bold text-lg">❌ Non, tu n'es PAS connecté</div>
          )}
          {error && <div className="mt-2 text-rose-200 text-sm">Erreur Supabase : {error.message}</div>}
        </div>

        <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <Row label="Email Supabase actuel" value={user?.email ?? "—"} />
          <Row label="Email attendu pour desk" value={expectedOwner} />
          <Row label="Match desk ?" value={matches ? "✅ OUI : tu peux accéder au desk" : "❌ NON : desk inaccessible"} highlight={matches} />
          <Row label="ID utilisateur" value={user?.id ?? "—"} mono />
          <Row label="Provider" value={user?.app_metadata?.provider ?? "—"} />
          <Row label="Email confirmé" value={user?.email_confirmed_at ? `✅ ${new Date(user.email_confirmed_at).toLocaleString("fr-FR")}` : "❌ Non confirmé"} />
          <Row label="Dernière connexion" value={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("fr-FR") : "—"} />
          <Row label="Compte créé" value={user?.created_at ? new Date(user.created_at).toLocaleString("fr-FR") : "—"} />
        </div>

        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-[13px] text-amber-200">
          <div className="font-semibold mb-1">Que faire selon le résultat :</div>
          <ul className="space-y-1">
            <li>• <strong>Si "Non connecté"</strong> : va sur <code>http://localhost:3000/</code>, click sur "Se connecter", utilise email + mot de passe (PAS magic link, ça nécessite un email reçu).</li>
            <li>• <strong>Si connecté mais mauvais email</strong> : tu t'es connecté avec un autre compte. Déconnecte-toi (icône en haut à droite) et reconnecte avec yannricordeau100@gmail.com.</li>
            <li>• <strong>Si email pas confirmé</strong> : va dans Gmail (vérifie aussi spam), clique le lien de confirmation Supabase. OU dis-moi, je peux le confirmer via l'admin Supabase.</li>
            <li>• <strong>Si tout est ✅</strong> : recharge <code>http://localhost:3000/desk-mtk9x4kp</code> et le desk doit s'ouvrir.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3">
      <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-[13.5px] ${highlight ? "font-semibold text-emerald-300" : "text-zinc-100"} ${mono ? "font-mono text-[12px]" : ""}`}>
        {value}
      </div>
    </div>
  );
}
