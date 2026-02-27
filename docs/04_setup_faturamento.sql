-- ========================================================================================
-- SCRIPT 04: MÓDULO DE FATURAMENTO, COBRANÇA E GLOSAS
-- Este script cria as tabelas essenciais para o ciclo de vida do Lote TISS/Faturamento.
-- ========================================================================================

-- 1. Criação da Tabela de Lotes de Faturamento
CREATE TABLE IF NOT EXISTS public.faturamento_lotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo_lote TEXT NOT NULL, -- Ex: LOTE-2026-001
    mes_competencia INTEGER NOT NULL,
    ano_competencia INTEGER NOT NULL,
    convenio_id UUID REFERENCES public.convenios(id),
    
    valor_total_calculado NUMERIC(10,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Aberto', -- Aberto, Aguardando NF, Faturado, Em Atraso, Liquidado Parcial, Liquidado Total, Cancelado
    
    data_emissao DATE DEFAULT CURRENT_DATE,
    data_vencimento DATE,
    data_pagamento DATE,
    
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS e Criar Política para Lotes
ALTER TABLE public.faturamento_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa isola faturamento_lotes" 
    ON public.faturamento_lotes FOR ALL 
    USING (empresa_id = (SELECT empresa_id FROM public.perfis_usuarios WHERE user_id = auth.uid()));


-- 2. Alteração na Tabela `eventos` para vinculação ao Lote
-- Todo RGO faturado precisa estar atrelado a um lote.
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS faturamento_lote_id UUID REFERENCES public.faturamento_lotes(id) ON DELETE SET NULL;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS status_faturamento TEXT DEFAULT 'Pendente'; 
-- Pendente, Em Lote, Faturado (NF Mapeada), Glosado Parcial, Glosado Total, Pago


-- 3. Criação da Tabela de Notas Fiscais (NFS-e)
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    faturamento_lote_id UUID REFERENCES public.faturamento_lotes(id) ON DELETE CASCADE,
    
    numero_nf TEXT NOT NULL,
    codigo_verificacao TEXT,
    data_emissao DATE NOT NULL,
    valor_nf NUMERIC(10,2) NOT NULL,
    
    url_documento TEXT, -- Link para o PDF
    status TEXT DEFAULT 'Emitida', -- Emitida, Cancelada, Substituída
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS e Criar Política para Notas Fiscais
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa isola notas_fiscais" 
    ON public.notas_fiscais FOR ALL 
    USING (empresa_id = (SELECT empresa_id FROM public.perfis_usuarios WHERE user_id = auth.uid()));


-- 4. Criação da Tabela de Régua de Cobrança (Follow-up)
-- Guarda o histórico de ligações, e-mails e anotações feitas para receber o lote.
CREATE TABLE IF NOT EXISTS public.cobranca_follow_up (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    faturamento_lote_id UUID NOT NULL REFERENCES public.faturamento_lotes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id), -- Quem fez a anotação
    
    data_contato TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    tipo_contato TEXT NOT NULL, -- Telefone, Email, Portal, WhatsApp, Outro
    anotacao TEXT NOT NULL,
    
    data_agendamento_retorno DATE, -- Para o sistema lembrar de ligar de novo
    status TEXT DEFAULT 'Pendente' -- Pendente de Ação, Resolvido
);

-- Habilitar RLS para Follow-up
ALTER TABLE public.cobranca_follow_up ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa isola cobranca_follow_up" 
    ON public.cobranca_follow_up FOR ALL 
    USING (empresa_id = (SELECT empresa_id FROM public.perfis_usuarios WHERE user_id = auth.uid()));


-- 5. Criação da Tabela de Glosas e Recursos
-- Desce ao nível granular: Qual Procedimento (Item) sofreu glosa e quanto dinheiro ele perdeu.
CREATE TABLE IF NOT EXISTS public.glosas_recursos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    evento_item_id UUID NOT NULL REFERENCES public.evento_itens(id) ON DELETE CASCADE,
    faturamento_lote_id UUID REFERENCES public.faturamento_lotes(id), -- Facilitar a busca
    
    motivo_glosa_codigo TEXT NOT NULL, -- Código TISS (Ex: 01, 15, 20)
    motivo_glosa_descricao TEXT NOT NULL,
    data_identificacao DATE NOT NULL DEFAULT CURRENT_DATE,
    
    valor_esperado NUMERIC(10,2) NOT NULL,
    valor_glosado NUMERIC(10,2) NOT NULL,
    
    status_recurso TEXT NOT NULL DEFAULT 'Não Iniciado', -- Não Iniciado, Em Recurso, Deferido (Recuperado), Indeferido (Perdido Final)
    data_julgamento DATE,
    valor_recuperado NUMERIC(10,2) DEFAULT 0,
    justificativa_recurso TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Glosas
ALTER TABLE public.glosas_recursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa isola glosas_recursos" 
    ON public.glosas_recursos FOR ALL 
    USING (empresa_id = (SELECT empresa_id FROM public.perfis_usuarios WHERE user_id = auth.uid()));
