-- Correção Temporária de RLS (Row-Level Security) para o MVP 1
-- O Supabase ativa o RLS por padrão bloqueando INSERTS e UPDATES se não houver Políticas explícitas.
-- Como estamos na fase inicial e o modelo Multi-tenant com empresa_id ainda será validado,
-- desabilitaremos ou criaremos políticas permissivas para testes.

-- Opção 1: Desabilitar o RLS temporariamente nestas tabelas (Recomendado para acelerar o desenvolvimento local/teste).
ALTER TABLE convenios DISABLE ROW LEVEL SECURITY;
ALTER TABLE medicos DISABLE ROW LEVEL SECURITY;
ALTER TABLE hospitais DISABLE ROW LEVEL SECURITY;
ALTER TABLE tabelas_preco DISABLE ROW LEVEL SECURITY;
ALTER TABLE tabelas_preco_itens DISABLE ROW LEVEL SECURITY;

-- Se o sistema do Supabase insistir, podemos forçar permissão total temporária:
-- DROP POLICY IF EXISTS "Permitir tudo convenios" ON convenios;
-- CREATE POLICY "Permitir tudo convenios" ON convenios FOR ALL USING (true) WITH CHECK (true);
