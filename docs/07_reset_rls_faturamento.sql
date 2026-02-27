-- ATENÇÃO SUPABASE DEDICADO: DESATIVANDO AS RESTRIÇÕES DE SEGURANÇA NA V1
-- Como o script 06 não sobrepôs as configurações originais mantigas ativas, 
-- este script 07 APAGA e RECRIA as regras nativas para "aceitar inserções incondicionais" (true)

-- Desabilitando RLS para permitir inserções limpas no React
ALTER TABLE public.faturamento_lotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_follow_up DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.glosas_recursos DISABLE ROW LEVEL SECURITY;

-- Limpando definitivamente as políticas restritivas do Autor
DROP POLICY IF EXISTS "Empresa isola faturamento_lotes" ON public.faturamento_lotes;
DROP POLICY IF EXISTS "Empresa isola notas_fiscais" ON public.notas_fiscais;
DROP POLICY IF EXISTS "Empresa isola cobranca_follow_up" ON public.cobranca_follow_up;
DROP POLICY IF EXISTS "Empresa isola glosas_recursos" ON public.glosas_recursos;

-- Criando políticas universais para CRUD Global no MVP
CREATE POLICY "RLS Global Lotes" ON public.faturamento_lotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "RLS Global NF" ON public.notas_fiscais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "RLS Global FollowUp" ON public.cobranca_follow_up FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "RLS Global Glosas" ON public.glosas_recursos FOR ALL USING (true) WITH CHECK (true);

-- Religando as portas com as novas fechaduras quebradas
ALTER TABLE public.faturamento_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_follow_up ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glosas_recursos ENABLE ROW LEVEL SECURITY;
