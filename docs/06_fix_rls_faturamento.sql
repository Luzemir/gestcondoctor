-- Script de correção do RLS (Row Level Security) para o módulo de Faturamento
-- O erro anterior na criação de Lotes ocorria pois as tabelas de faturamento 
-- tentavam validar a empresa logada cruzando com a tabela 'perfis_usuarios'.
-- Como estamos no MVP, liberamos o bypass seguindo o mesmo padrão de Convênios, 
-- permitindo à Vaniele a gravação de Lotes, Notas Fiscais e Glosas.

-- 1. Faturamento Lotes
DROP POLICY IF EXISTS "Empresa isola faturamento_lotes" ON public.faturamento_lotes;
DROP POLICY IF EXISTS "Permitir tudo faturamento_lotes" ON public.faturamento_lotes;
CREATE POLICY "Permitir tudo faturamento_lotes" ON public.faturamento_lotes FOR ALL USING (true) WITH CHECK (true);

-- 2. Notas Fiscais
DROP POLICY IF EXISTS "Empresa isola notas_fiscais" ON public.notas_fiscais;
DROP POLICY IF EXISTS "Permitir tudo notas_fiscais" ON public.notas_fiscais;
CREATE POLICY "Permitir tudo notas_fiscais" ON public.notas_fiscais FOR ALL USING (true) WITH CHECK (true);

-- 3. Glosas e Recursos
DROP POLICY IF EXISTS "Empresa isola glosas_recursos" ON public.glosas_recursos;
DROP POLICY IF EXISTS "Permitir tudo glosas_recursos" ON public.glosas_recursos;
CREATE POLICY "Permitir tudo glosas_recursos" ON public.glosas_recursos FOR ALL USING (true) WITH CHECK (true);

-- 4. Follow-up de Cobrança
DROP POLICY IF EXISTS "Empresa isola cobranca_follow_up" ON public.cobranca_follow_up;
DROP POLICY IF EXISTS "Permitir tudo cobranca_follow_up" ON public.cobranca_follow_up;
CREATE POLICY "Permitir tudo cobranca_follow_up" ON public.cobranca_follow_up FOR ALL USING (true) WITH CHECK (true);
