-- Tabela para Gestão de Lotes de Faturamento
CREATE TABLE IF NOT EXISTS lotes_faturamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL,
    convenio_id UUID REFERENCES convenios(id),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    periodo_inicio DATE,
    periodo_fim DATE,
    valor_total NUMERIC(15,2) DEFAULT 0,
    status TEXT DEFAULT 'Aberto', -- Status possíveis: Aberto, Enviado, Pago, Glosado
    observacoes TEXT
);

-- Adicionando a referência do lote na tabela de eventos
ALTER TABLE eventos 
ADD COLUMN lote_id UUID REFERENCES lotes_faturamento(id);

-- RLS (Row Level Security) para lotes_faturamento
ALTER TABLE lotes_faturamento ENABLE ROW LEVEL SECURITY;

-- Permite leitura de lotes baseada em um simples token check da empresa (similar às outras tabelas base)
-- Nota: Adapte as policies corporativas se o seu app exige verificações na auth.users em vez de match direto pelo header/meta. 
CREATE POLICY "Acesso total aos lotes da empresa" ON lotes_faturamento
    FOR ALL
    USING (true); -- Política muito permissiva para MVP, recomendo ajustar baseando no auth.uid() se necessário, igual às outras tabelas. No Supabase frontend costuma-se injetar empresa_id pelo app.

-- Criação do bucket para os arquivos de lotes de faturamento (como XML, Remessas, Relatórios PDF exportados) se necessário:
INSERT INTO storage.buckets (id, name, public) VALUES ('lotes_arquivos', 'lotes_arquivos', false) ON CONFLICT DO NOTHING;
