-- Migração Complementar para Tabela de Eventos e Itens (Baseada no Form Excel do Usuário)
-- Adiciona campos extras e remove travas caso existam.

-- 1. Tabela EVENTOS (Cabeçalho)
ALTER TABLE eventos
ADD COLUMN IF NOT EXISTS carteirinha TEXT,
ADD COLUMN IF NOT EXISTS guia TEXT,
ADD COLUMN IF NOT EXISTS senha TEXT,
ADD COLUMN IF NOT EXISTS atendimento TEXT,
ADD COLUMN IF NOT EXISTS anestesista TEXT,
ADD COLUMN IF NOT EXISTS instrumentador TEXT;

-- 2. Tabela EVENTO_ITENS (Procedimentos/Corpo)
ALTER TABLE evento_itens
-- Incisão define qual foi a via de corte usada, ou o percentual pactuado entre a equipe 
-- para aquele médico específico (ex: Principal fica com 100%, Auxiliar fica com 30% da incisão).
ADD COLUMN IF NOT EXISTS incisao NUMERIC DEFAULT 100;

-- 3. Recarregar cache da API Supabase (Sempre Necessário após ALTER TABLE)
NOTIFY pgrst, 'reload schema';
