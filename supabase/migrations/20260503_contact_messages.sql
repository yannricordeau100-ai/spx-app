-- =============================================================================
-- Contact messages : formulaire de contact + back office
-- =============================================================================
-- Table additive uniquement. Aucune perte de données existantes.
-- À lancer dans Supabase Dashboard -> SQL Editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.desk_contact_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient       text NOT NULL CHECK (recipient IN ('contact', 'support')),
  sender_name     text NOT NULL,
  sender_email    text NOT NULL,
  subject         text NOT NULL,
  body            text NOT NULL,
  source_locale   text DEFAULT NULL,                  -- locale détectée à l'envoi
  source_ip       text DEFAULT NULL,                  -- IP brute (RGPD : suppr 90j)
  user_agent      text DEFAULT NULL,
  status          text NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'read', 'replied', 'archived', 'spam')),
  read_at         timestamptz DEFAULT NULL,
  replied_at      timestamptz DEFAULT NULL,
  notes           text DEFAULT NULL,                  -- notes internes (back office)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desk_contact_messages_status_idx ON public.desk_contact_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS desk_contact_messages_email_idx  ON public.desk_contact_messages (sender_email);

-- RLS : INSERT public (anyone can submit), READ owner-only via service role
ALTER TABLE public.desk_contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_insert_public" ON public.desk_contact_messages;
CREATE POLICY "contact_insert_public" ON public.desk_contact_messages
  FOR INSERT WITH CHECK (true);

-- READ : seul le owner_email du desk (passé via service_role + check API route)
-- Donc pas de policy READ ici, géré côté API.
