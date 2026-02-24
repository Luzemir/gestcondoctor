-- Criar tabela de anexos para o evento
CREATE TABLE IF NOT EXISTS public.evento_anexos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL, -- Public URL assinada do Supabase Storage
    nome_original TEXT NOT NULL,
    tamanho_bytes BIGINT,
    tipo_documento TEXT DEFAULT 'Outros' -- 'Guia', 'Relatório Cirúrgico', 'NFe', 'Outros'
);

-- Habilitar RLS (Row Level Security) na tabela temporariamente suspenso para fase MVP
ALTER TABLE public.evento_anexos DISABLE ROW LEVEL SECURITY;

-- Índice para a busca de anexos por evento
CREATE INDEX idx_evento_anexos_evento_id ON public.evento_anexos(evento_id);

-- DICA AO USUARIO:
-- Para o funcionamento do Storage, vá até o Painel Web do Supabase (https://supabase.com/dashboard)
-- 1. No menu esquerdo, vá em Storage.
-- 2. Clique em "New bucket"
-- 3. Nomeie o bucket exatamente como: eventos_anexos
-- 4. Marque "Public bucket" (para facilitar o acesso via URL pública no MVP)
-- 5. Clique em "Save"
