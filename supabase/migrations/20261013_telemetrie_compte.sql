-- Analytics personnels « Mon compte et analytics » (Yann 13 oct 2026).
-- A coller par Yann dans l editeur SQL de Supabase. Idempotent.

-- 1. Index pour lire l activite d un compte (filtre user_id, tri par date).
create index if not exists telemetrie_user_ts_idx
  on public.telemetrie_evenements (user_id, ts desc)
  where user_id is not null;

-- 2. Politique de confidentialite (s6) : « Donnees de connexion : 1 an maximum,
--    puis anonymisation ». Au-dela de 12 mois, un evenement n est plus rattache
--    a personne : compte, onglet et empreinte d IP sont effaces. Les
--    statistiques globales (pages vues, erreurs, temps de reponse) restent.
create or replace function public.anonymise_telemetrie_un_an()
returns integer
language sql
security definer
set search_path = public
as $$
  with maj as (
    update public.telemetrie_evenements
       set user_id = null, session_id = null, ip_hash = null
     where ts < now() - interval '12 months'
       and (user_id is not null or session_id is not null or ip_hash is not null)
    returning 1
  )
  select count(*)::integer from maj;
$$;

revoke all on function public.anonymise_telemetrie_un_an() from public, anon, authenticated;

-- 3. Passage quotidien (3 h 15 UTC) avec pg_cron, fourni par Supabase.
create extension if not exists pg_cron;
select cron.unschedule('telemetrie-anonymisation-un-an')
 where exists (select 1 from cron.job where jobname = 'telemetrie-anonymisation-un-an');
select cron.schedule('telemetrie-anonymisation-un-an', '15 3 * * *', $$select public.anonymise_telemetrie_un_an()$$);
