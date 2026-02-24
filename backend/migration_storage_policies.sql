-- -------------------------------------------------------------------------
-- POLÍTICAS DE AUTORIZAÇÃO DE STORAGE (RLS do Supabase)
-- -------------------------------------------------------------------------
-- Rode este arquivo no SQL Editor para liberar o upload/download de PDFs 
-- no bucket "eventos_anexos" de forma automática (bypass na UI do Storage).

-- 1. Permitir Leitura Pública (já que o bucket foi criado como Público)
CREATE POLICY "Leitura Pública do Anexo"
ON storage.objects FOR SELECT
USING ( bucket_id = 'eventos_anexos' );

-- 2. Permitir Upload Anônimo (MVP)
CREATE POLICY "Upload Anônimo de Anexo"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'eventos_anexos' );

-- 3. Permitir Exclusão (caso o usuário apague o anexo na Fila de Eventos)
CREATE POLICY "Deletar Anônimo O Anexo"
ON storage.objects FOR DELETE
USING ( bucket_id = 'eventos_anexos' );

-- 4. Permitir Update
CREATE POLICY "Atualizar Anônimo o Anexo"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'eventos_anexos' );
