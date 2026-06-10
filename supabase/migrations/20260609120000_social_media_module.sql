-- ============================================================
-- MÓDULO SOCIAL MEDIA — JG Interno
-- Criado em: 2026-06-09
-- Módulos: 1-Agenda IA | 2-Planilha Posts | 3-Chat IA |
--          4-Gestão Clientes SM | 5-Aprovação de Conteúdo
-- ============================================================
-- TIPOS: clients.id=text | profiles.id=uuid | google_calendar_connection.id=integer

-- ────────────────────────────────────────────────────────────
-- MÓDULO 4 — Configurações de Social Media por Cliente
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sm_client_configs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  active_platforms      text[]  NOT NULL DEFAULT '{}',
  post_frequency        jsonb   NOT NULL DEFAULT '{}',
  responsible_id        uuid    REFERENCES profiles(id) ON DELETE SET NULL,

  contract_start        date,
  contract_end          date,
  contract_notes        text,
  client_webhook_url    text,
  is_active             boolean NOT NULL DEFAULT true,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (client_id)
);

-- ────────────────────────────────────────────────────────────
-- MÓDULO 2 — Planilha de Controle de Postagens
-- ────────────────────────────────────────────────────────────

CREATE TYPE sm_post_status   AS ENUM ('rascunho', 'agendado', 'publicado', 'pendente', 'atrasado', 'cancelado');
CREATE TYPE sm_platform      AS ENUM ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter', 'pinterest', 'outro');
CREATE TYPE sm_post_type     AS ENUM ('feed_foto', 'feed_video', 'reels', 'stories', 'carrossel', 'live', 'shorts', 'outro');

CREATE TABLE IF NOT EXISTS sm_posts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  title                 text NOT NULL,
  description           text,
  caption               text,
  hashtags              text,

  platform              sm_platform NOT NULL,
  post_type             sm_post_type NOT NULL DEFAULT 'feed_foto',
  status                sm_post_status NOT NULL DEFAULT 'rascunho',

  scheduled_at          timestamptz,
  published_at          timestamptz,

  google_event_id       text,
  google_calendar_id    text,

  responsible_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,

  media_url             text,
  media_type            text,
  thumbnail_url         text,

  approval_id           uuid,

  notes                 text,

  created_by            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- MÓDULO 5 — Fluxo de Aprovação de Conteúdo
-- ────────────────────────────────────────────────────────────

CREATE TYPE sm_approval_status AS ENUM ('aguardando', 'aprovado', 'reprovado', 'revisao_solicitada');

CREATE TABLE IF NOT EXISTS sm_approvals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id               uuid NOT NULL REFERENCES sm_posts(id) ON DELETE CASCADE,
  client_id             text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  piece_url             text,
  piece_file_path       text,
  piece_type            text NOT NULL DEFAULT 'static',

  status                sm_approval_status NOT NULL DEFAULT 'aguardando',

  client_feedback       text,
  client_responded_at   timestamptz,

  webhook_sent_at       timestamptz,
  webhook_response      jsonb,

  created_by            uuid REFERENCES profiles(id) ON DELETE SET NULL,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- FK circular: sm_posts.approval_id -> sm_approvals
ALTER TABLE sm_posts
  ADD CONSTRAINT fk_sm_posts_approval
  FOREIGN KEY (approval_id) REFERENCES sm_approvals(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- MÓDULO 3 — Log de Ações da IA
-- ────────────────────────────────────────────────────────────

CREATE TYPE sm_ai_action_type AS ENUM (
  'schedule_post',
  'edit_post',
  'cancel_post',
  'suggest_slots',
  'create_approval',
  'update_status',
  'generate_report',
  'custom_command'
);

CREATE TABLE IF NOT EXISTS sm_ai_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  client_id     text REFERENCES clients(id) ON DELETE SET NULL,

  command       text NOT NULL,
  action_type   sm_ai_action_type,

  result        text,
  result_data   jsonb,

  post_id       uuid REFERENCES sm_posts(id) ON DELETE SET NULL,
  approval_id   uuid REFERENCES sm_approvals(id) ON DELETE SET NULL,

  success       boolean NOT NULL DEFAULT true,
  error_message text,

  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- MÓDULO 1 — Eventos do Google Agenda (Social Media)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sm_calendar_events (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id                uuid REFERENCES sm_posts(id) ON DELETE CASCADE,
  client_id              text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  google_event_id        text NOT NULL,
  google_calendar_id     text NOT NULL,
  calendar_connection_id integer REFERENCES google_calendar_connection(id) ON DELETE SET NULL,

  event_title            text,
  event_start            timestamptz,
  event_end              timestamptz,
  event_description      text,
  event_url              text,

  last_synced_at         timestamptz NOT NULL DEFAULT now(),

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (google_event_id, google_calendar_id)
);

-- ────────────────────────────────────────────────────────────
-- MÓDULO 4 — Relatórios Mensais
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sm_monthly_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  reference_month     date NOT NULL,

  total_posts         int NOT NULL DEFAULT 0,
  posts_published     int NOT NULL DEFAULT 0,
  posts_scheduled     int NOT NULL DEFAULT 0,
  posts_pending       int NOT NULL DEFAULT 0,
  posts_late          int NOT NULL DEFAULT 0,

  by_platform         jsonb NOT NULL DEFAULT '{}',

  ai_summary          text,
  ai_suggestions      text,

  generated_by        text NOT NULL DEFAULT 'ai',
  generated_at        timestamptz NOT NULL DEFAULT now(),

  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (client_id, reference_month)
);

-- ────────────────────────────────────────────────────────────
-- MÓDULO 5 — Notificações de Aprovação
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sm_approval_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id   uuid NOT NULL REFERENCES sm_approvals(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,

  type          text NOT NULL,
  message       text,
  read          boolean NOT NULL DEFAULT false,
  read_at       timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- ÍNDICES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sm_posts_client_id       ON sm_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_sm_posts_status          ON sm_posts(status);
CREATE INDEX IF NOT EXISTS idx_sm_posts_scheduled_at    ON sm_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sm_posts_platform        ON sm_posts(platform);
CREATE INDEX IF NOT EXISTS idx_sm_posts_responsible     ON sm_posts(responsible_id);

CREATE INDEX IF NOT EXISTS idx_sm_approvals_post_id     ON sm_approvals(post_id);
CREATE INDEX IF NOT EXISTS idx_sm_approvals_client_id   ON sm_approvals(client_id);
CREATE INDEX IF NOT EXISTS idx_sm_approvals_status      ON sm_approvals(status);

CREATE INDEX IF NOT EXISTS idx_sm_ai_logs_user_id       ON sm_ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sm_ai_logs_client_id     ON sm_ai_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_sm_ai_logs_created_at    ON sm_ai_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sm_calendar_events_post  ON sm_calendar_events(post_id);
CREATE INDEX IF NOT EXISTS idx_sm_calendar_events_client ON sm_calendar_events(client_id);

CREATE INDEX IF NOT EXISTS idx_sm_monthly_reports_client ON sm_monthly_reports(client_id, reference_month DESC);

CREATE INDEX IF NOT EXISTS idx_sm_notif_approval        ON sm_approval_notifications(approval_id);
CREATE INDEX IF NOT EXISTS idx_sm_notif_user            ON sm_approval_notifications(user_id, read);

-- ────────────────────────────────────────────────────────────
-- TRIGGERS — updated_at automático
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_posts_updated_at') THEN
    CREATE TRIGGER trg_sm_posts_updated_at
      BEFORE UPDATE ON sm_posts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_approvals_updated_at') THEN
    CREATE TRIGGER trg_sm_approvals_updated_at
      BEFORE UPDATE ON sm_approvals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_client_configs_updated_at') THEN
    CREATE TRIGGER trg_sm_client_configs_updated_at
      BEFORE UPDATE ON sm_client_configs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_calendar_events_updated_at') THEN
    CREATE TRIGGER trg_sm_calendar_events_updated_at
      BEFORE UPDATE ON sm_calendar_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────
-- TRIGGER — aprovação atualiza status do post
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sm_sync_post_status_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'aprovado' THEN
      UPDATE sm_posts SET status = 'agendado', updated_at = now()
      WHERE id = NEW.post_id AND status IN ('rascunho', 'pendente');
    ELSIF NEW.status = 'reprovado' THEN
      UPDATE sm_posts SET status = 'cancelado', updated_at = now()
      WHERE id = NEW.post_id;
    ELSIF NEW.status = 'revisao_solicitada' THEN
      UPDATE sm_posts SET status = 'pendente', updated_at = now()
      WHERE id = NEW.post_id;
    END IF;

    INSERT INTO sm_approval_notifications (approval_id, type, message)
    VALUES (
      NEW.id,
      CASE NEW.status
        WHEN 'aprovado'           THEN 'client_approved'
        WHEN 'reprovado'          THEN 'client_rejected'
        WHEN 'revisao_solicitada' THEN 'revision_requested'
        ELSE 'status_changed'
      END,
      'Status da aprovação alterado para: ' || NEW.status::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sm_approval_sync_post
  AFTER UPDATE ON sm_approvals
  FOR EACH ROW EXECUTE FUNCTION sm_sync_post_status_on_approval();

-- ────────────────────────────────────────────────────────────
-- TRIGGER — evento do Google Agenda sincroniza post
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sm_sync_post_from_calendar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.post_id IS NOT NULL AND NEW.event_start IS NOT NULL THEN
    UPDATE sm_posts
    SET
      scheduled_at       = NEW.event_start,
      google_event_id    = NEW.google_event_id,
      google_calendar_id = NEW.google_calendar_id,
      status             = CASE WHEN status = 'rascunho' THEN 'agendado'::sm_post_status ELSE status END,
      updated_at         = now()
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sm_calendar_sync_post
  AFTER INSERT OR UPDATE ON sm_calendar_events
  FOR EACH ROW EXECUTE FUNCTION sm_sync_post_from_calendar();

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────

ALTER TABLE sm_posts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_approvals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_client_configs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_ai_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_calendar_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_monthly_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_approval_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SM team full access sm_posts"
  ON sm_posts FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR 'social_media' = ANY(roles) OR 'admin' = ANY(roles))
  ));

CREATE POLICY "SM team full access sm_approvals"
  ON sm_approvals FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR 'social_media' = ANY(roles) OR 'admin' = ANY(roles))
  ));

CREATE POLICY "SM team full access sm_client_configs"
  ON sm_client_configs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR 'social_media' = ANY(roles) OR 'admin' = ANY(roles))
  ));

CREATE POLICY "SM team full access sm_ai_logs"
  ON sm_ai_logs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR 'social_media' = ANY(roles) OR 'admin' = ANY(roles))
  ));

CREATE POLICY "SM team full access sm_calendar_events"
  ON sm_calendar_events FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR 'social_media' = ANY(roles) OR 'admin' = ANY(roles))
  ));

CREATE POLICY "SM team full access sm_monthly_reports"
  ON sm_monthly_reports FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR 'social_media' = ANY(roles) OR 'admin' = ANY(roles))
  ));

CREATE POLICY "SM team full access sm_approval_notifications"
  ON sm_approval_notifications FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR 'social_media' = ANY(roles) OR 'admin' = ANY(roles))
  ));
