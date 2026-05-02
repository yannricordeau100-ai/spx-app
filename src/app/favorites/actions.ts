"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server Actions favoris — toutes auth-protected via RLS Supabase
 * (pas besoin de check `user.id` côté code, RLS rejette les ops non
 * propriétaires).
 */

export type FavoriteCompany = {
  id: string;
  ticker: string;
  created_at: string;
};

export type FavoriteKpi = {
  id: string;
  ticker: string;
  kpi_short: string;
  is_super: boolean;
  created_at: string;
};

/* ─── Companies ─────────────────────────────────────────────────────── */

export async function toggleCompanyFavorite(ticker: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non connecté" };
  }

  // Check existant
  const { data: existing } = await supabase
    .from("favorite_companies")
    .select("id")
    .eq("user_id", user.id)
    .eq("ticker", ticker.toUpperCase())
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorite_companies")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, favorited: false };
  } else {
    const { error } = await supabase
      .from("favorite_companies")
      .insert({ user_id: user.id, ticker: ticker.toUpperCase() });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, favorited: true };
  }
}

export async function listCompanyFavorites(): Promise<FavoriteCompany[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("favorite_companies")
    .select("id, ticker, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function isCompanyFavorited(ticker: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("favorite_companies")
    .select("id")
    .eq("user_id", user.id)
    .eq("ticker", ticker.toUpperCase())
    .maybeSingle();
  return !!data;
}

/* ─── KPIs ──────────────────────────────────────────────────────────── */

export async function toggleKpiFavorite(
  ticker: string,
  kpiShort: string,
  isSuper = false
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non connecté" };
  }

  const { data: existing } = await supabase
    .from("favorite_kpis")
    .select("id")
    .eq("user_id", user.id)
    .eq("ticker", ticker.toUpperCase())
    .eq("kpi_short", kpiShort)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorite_kpis")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, favorited: false };
  } else {
    const { error } = await supabase
      .from("favorite_kpis")
      .insert({
        user_id: user.id,
        ticker: ticker.toUpperCase(),
        kpi_short: kpiShort,
        is_super: isSuper,
      });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, favorited: true };
  }
}

export async function listKpiFavorites(): Promise<FavoriteKpi[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("favorite_kpis")
    .select("id, ticker, kpi_short, is_super, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function isKpiFavorited(
  ticker: string,
  kpiShort: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("favorite_kpis")
    .select("id")
    .eq("user_id", user.id)
    .eq("ticker", ticker.toUpperCase())
    .eq("kpi_short", kpiShort)
    .maybeSingle();
  return !!data;
}
