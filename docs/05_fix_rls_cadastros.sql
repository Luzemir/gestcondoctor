-- Script para correção do bug de Permissões (Row Level Security) 
-- no cadastro de Médicos e Hospitais pela interface (Usuário Vaniele).

-- 1. Forçar a habilitação do RLS caso não esteja
ALTER TABLE medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabelas_preco ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabelas_preco_itens ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas antigas se existirem
DROP POLICY IF EXISTS "Permitir tudo medicos" ON medicos;
DROP POLICY IF EXISTS "Permitir tudo hospitais" ON hospitais;
DROP POLICY IF EXISTS "Permitir tudo tabelas_preco" ON tabelas_preco;
DROP POLICY IF EXISTS "Permitir tudo tabelas_preco_itens" ON tabelas_preco_itens;

-- 3. Criar a política Permissiva (Igual a de Convênios que está fluindo normal)
CREATE POLICY "Permitir tudo medicos" ON medicos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo hospitais" ON hospitais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo tabelas_preco" ON tabelas_preco FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo tabelas_preco_itens" ON tabelas_preco_itens FOR ALL USING (true) WITH CHECK (true);

-- Nota: O RLS do Faturamento (faturamento_lotes, eventos, glosas, etc) continuam estritos. 
-- Estas regras abertas são exclusivas para cadastros base do MVP.
