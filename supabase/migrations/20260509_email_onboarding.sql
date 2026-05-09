-- 20260509_email_onboarding.sql
-- Email marketing onboarding J+1 / J+3 / J+7 / J+14 / J+25.
-- Une ligne = 1 email planifié pour 1 user. Le cron /api/cron/email-onboarding
-- ramasse les lignes scheduled_for <= now() et sent_at IS NULL puis les envoie.

create table if not exists desk_email_sequences (
  id uuid primary key default gen_random_uuid (),
  user_email text not null,
  user_name text,
  locale text not null default 'fr',
  sequence_key text not null,
  -- 'day1' | 'day3' | 'day7' | 'day14' | 'day25'
  day_offset smallint not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  send_status text,
  -- 'sent' | 'skipped' | 'error:<msg>'
  resend_id text,
  -- ID Resend pour traçabilité
  unsubscribed_at timestamptz,
  -- si user a unsub avant l'envoi, set ici
  created_at timestamptz not null default now (),
  unique (user_email, sequence_key)
);

create index if not exists desk_email_sequences_pending_idx on desk_email_sequences (scheduled_for)
where
  sent_at is null
  and unsubscribed_at is null;

create index if not exists desk_email_sequences_user_idx on desk_email_sequences (user_email);

-- Table opt-out global (un user qui veut couper tout l'onboarding)
create table if not exists desk_email_unsubscribes (
  user_email text primary key,
  unsubscribed_at timestamptz not null default now (),
  reason text
);

-- RLS : tables manipulées uniquement par service role (cron + signup hook).
alter table desk_email_sequences enable row level security;

alter table desk_email_unsubscribes enable row level security;
