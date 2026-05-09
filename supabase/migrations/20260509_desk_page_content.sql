-- 20260509_desk_page_content.sql
-- Yann 8 mai 2026 (édition contenu page contact via desk).
--
-- Permet d'éditer le contenu user-facing de pages clés (contact en
-- premier, extensible aux mentions légales, à propos, etc.) directement
-- depuis le back-office desk-mtk9x4kp/page-content sans recompiler.
--
-- Une ligne = un (page_key, section_key) avec contenu FR/EN/DE.
-- La page lit ce contenu en SSR avec fallback sur les strings hardcodées
-- du dictionary.ts si la BDD est vide ou inaccessible.

create table if not exists desk_page_content (
  id uuid primary key default gen_random_uuid(),
  -- Identifiant logique de la page : "contact", "about", "privacy", etc.
  page_key text not null,
  -- Sous-section dans la page : "title", "intro", "form_intro", etc.
  -- Pour la page contact V1.8, sections seedées : title, subtitle,
  -- recipient_intro, success_intro, privacy_note.
  section_key text not null,
  -- Contenu par langue
  content_fr text not null,
  content_en text,
  content_de text,
  -- Visibilité publique
  is_active boolean not null default true,
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  unique (page_key, section_key)
);

create index if not exists desk_page_content_page_idx on desk_page_content (page_key, is_active);

-- RLS
alter table desk_page_content enable row level security;

drop policy if exists "public read active page content" on desk_page_content;
create policy "public read active page content"
  on desk_page_content for select using (is_active = true);

drop policy if exists "service role write page content" on desk_page_content;
create policy "service role write page content"
  on desk_page_content for all using (auth.role() = 'service_role');

-- Trigger updated_at (réutilise tg_set_updated_at créé dans
-- 20260508_pricing_admin.sql)
drop trigger if exists desk_page_content_updated on desk_page_content;
create trigger desk_page_content_updated before update on desk_page_content
  for each row execute function tg_set_updated_at();

-- Seed initial : 5 sections clés de la page contact V1.8
insert into desk_page_content (page_key, section_key, content_fr, content_en, content_de, is_active) values
  ('contact','title',
    'Contacte l''équipe',
    'Contact the team',
    'Kontaktiere das Team',
    true),
  ('contact','subtitle',
    'Réponse sous 24 h ouvrées. Choisis la bonne destination ci-dessous.',
    'Reply within 24 business hours. Pick the right destination below.',
    'Antwort innerhalb 24 Werktagsstunden. Wähle das passende Ziel unten.',
    true),
  ('contact','recipient_intro',
    'Question générale, support technique ou demande commerciale Pro+ : on traite chaque type différemment pour aller plus vite.',
    'General question, technical support, or sales inquiry: we handle each type differently to be faster.',
    'Allgemeine Frage, technischer Support oder Vertriebsanfrage Pro+: wir behandeln jeden Typ unterschiedlich für schnellere Antworten.',
    true),
  ('contact','success_intro',
    'Message reçu. On revient vers toi sous 24 h ouvrées sur l''email associé à ton compte.',
    'Message received. We''ll get back to you within 24 business hours at your account email.',
    'Nachricht erhalten. Wir antworten innerhalb 24 Werktagsstunden an die mit deinem Konto verknüpfte E-Mail.',
    true),
  ('contact','privacy_note',
    'Tes données restent privées. Pas de revente, pas de spam marketing. Hébergement européen, RGPD-compliant.',
    'Your data stays private. No reselling, no marketing spam. EU hosting, GDPR-compliant.',
    'Deine Daten bleiben privat. Kein Weiterverkauf, kein Marketing-Spam. EU-Hosting, DSGVO-konform.',
    true)
on conflict (page_key, section_key) do nothing;
