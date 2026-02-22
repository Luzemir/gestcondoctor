-- 1. Atualizar tabela medicos
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS conselho_tipo TEXT DEFAULT 'CRM';
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS conselho_uf TEXT DEFAULT 'SP';
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS conselho_numero TEXT;
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ativo';

-- Migrar dados antigos (se houver) para as novas colunas
UPDATE medicos SET conselho_numero = crm WHERE crm IS NOT NULL;
UPDATE medicos SET status = CASE WHEN ativo = true THEN 'Ativo' ELSE 'Arquivado' END;

-- 2. Atualizar tabela hospitais
ALTER TABLE hospitais ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE hospitais ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
ALTER TABLE hospitais ADD COLUMN IF NOT EXISTS uf TEXT DEFAULT 'SP';
ALTER TABLE hospitais ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE hospitais ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ativo';

-- Migrar dados antigos de hospitais
UPDATE hospitais SET nome_fantasia = nome WHERE nome IS NOT NULL;
UPDATE hospitais SET status = CASE WHEN ativo = true THEN 'Ativo' ELSE 'Arquivado' END;
