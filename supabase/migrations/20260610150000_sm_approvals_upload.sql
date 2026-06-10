-- ============================================================
-- MÓDULO 5 — upload de arquivos na aprovação (PDF, DOC, imagem, vídeo...)
-- ------------------------------------------------------------
-- Além de colar um link, o social media pode ENVIAR um arquivo.
-- O arquivo vai para o bucket público "sm-aprovacoes" e a URL pública
-- entra em piece_url. Os metadados reais (nome/formato/tamanho) são
-- guardados para compor o objeto "conteudo" do webhook.
-- ============================================================

-- 1) Colunas de metadados do conteúdo
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS piece_delivery   text NOT NULL DEFAULT 'link';  -- 'link' | 'upload'
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS piece_file_name  text;
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS piece_format     text;
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS piece_size_bytes bigint;

-- 2) Bucket público para os arquivos de aprovação (limite 100 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('sm-aprovacoes', 'sm-aprovacoes', true, 104857600)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

-- 3) Políticas de Storage: upload por autenticado, leitura pública
DROP POLICY IF EXISTS "sm_aprovacoes_insert" ON storage.objects;
CREATE POLICY "sm_aprovacoes_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sm-aprovacoes');

DROP POLICY IF EXISTS "sm_aprovacoes_read" ON storage.objects;
CREATE POLICY "sm_aprovacoes_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'sm-aprovacoes');

DROP POLICY IF EXISTS "sm_aprovacoes_delete" ON storage.objects;
CREATE POLICY "sm_aprovacoes_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'sm-aprovacoes');
