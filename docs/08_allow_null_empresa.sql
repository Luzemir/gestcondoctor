-- SCRIPT 08: FLEXIBILIZAÇÃO DA FOREIGN KEY DE EMPRESAS NO MVP
-- Como a versão atual do sistema convive com usuários de fase de teste/migração 
-- que geram logins Auth mas não estão totalmente cadastrados na tabela 'empresas',
-- precisamos afrouxar o rigor do banco de dados (NOT NULL) nestas chaves estrangeiras.

-- Remover restrição NOT NULL das tabelas do Módulo de Faturamento
ALTER TABLE public.faturamento_lotes ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE public.notas_fiscais ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE public.cobranca_follow_up ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE public.glosas_recursos ALTER COLUMN empresa_id DROP NOT NULL;

-- As Foreign Keys continuarão válidas: se for enviado um UUID, ele DEVE existir na tabela empresas.
-- Mas se for enviado NULL, o banco ACEITARÁ graciosamente, sem pânico de integridade.
