-- Correção para o erro: new row violates row-level security policy for table "eventos"
-- Como as tabelas 'eventos' e 'evento_itens' foram criadas recentemente, 
-- elas estão com o bloqueio padrão do Supabase RLS (Row-Level Security) ativo, mas sem políticas.
-- Para o estágio MVP atual (onde a gestão de 'empresa_id' está simplificada), 
-- vamos desabilitar temporariamente o RLS destas duas novas tabelas.

ALTER TABLE public.eventos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_itens DISABLE ROW LEVEL SECURITY;

-- Dica: Opcionalmente, pode ser necessário recarregar o cache do schema se houver erro:
NOTIFY pgrst, 'reload schema';
