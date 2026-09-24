-- À exécuter une seule fois après relecture, dans l'éditeur SQL Supabase.
begin;
create table public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default clock_timestamp(),
 email text not null check (email = lower(btrim(email)) and length(email) <= 254),
 subject text not null check (length(subject) between 3 and 160),
 category text not null check (category in ('Compte','Abonnement et paiement','Données et KPI','Fiches sociétés','Confidentialité','Problème technique')),
 message text not null check (length(message) between 10 and 5000),
 capture text not null default '' check (length(capture) <= 699074),
 support_sent boolean not null default false,
 receipt_sent boolean not null default false
);
create index support_tickets_email_created on public.support_tickets(email, created_at);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from public, anon, authenticated;
-- Aucune politique pour anon/authenticated : refus implicite de toute opération.
create policy support_service_only on public.support_tickets for all to service_role using (true) with check (true);
grant select, insert, update on public.support_tickets to service_role;
create function public.create_support_ticket(p_email text, p_subject text, p_category text, p_message text, p_capture text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare ticket_id uuid; recent_count integer;
begin
 -- Verrou transactionnel par adresse : le comptage et l'insertion sont indivisibles.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(btrim(p_email)), 0));
 select count(*) into recent_count from public.support_tickets
 where email = lower(btrim(p_email)) and created_at > clock_timestamp() - interval '1 hour';
 if recent_count >= 5 then raise exception 'SUPPORT_RATE_LIMIT' using errcode = 'P0001'; end if;
 insert into public.support_tickets(email,subject,category,message,capture)
 values(lower(btrim(p_email)),p_subject,p_category,p_message,p_capture) returning id into ticket_id;
 return ticket_id;
end;
$$;
revoke all on function public.create_support_ticket(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_support_ticket(text,text,text,text,text) to service_role;
commit;
