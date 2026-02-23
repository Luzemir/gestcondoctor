-- 1. Criação da Tabela de Eventos (Produção Médica)
CREATE TABLE IF NOT EXISTS eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id),
    tipo_evento TEXT NOT NULL DEFAULT 'Procedimento Médico',
    status_operacional TEXT NOT NULL DEFAULT 'Rascunho', -- Rascunho | Pendencias | Pronto | Enviado | Pago | Glosado | Cancelado
    
    -- Identificação do Paciente
    paciente_nome TEXT NOT NULL,
    paciente_cpf TEXT,
    paciente_nascimento DATE,
    
    -- Local e Convênio
    convenio_id UUID REFERENCES convenios(id) NOT NULL,
    hospital_id UUID REFERENCES hospitais(id) NOT NULL,
    
    -- Dados do Procedimento
    data_procedimento DATE NOT NULL,
    hora_inicio TIME,
    hora_fim TIME,
    urgencia TEXT DEFAULT 'Eletiva', -- Eletiva | Emergencia
    
    -- Equipe Médica
    medico_principal_id UUID REFERENCES medicos(id) NOT NULL,
    medico_aux1_id UUID REFERENCES medicos(id),
    medico_aux2_id UUID REFERENCES medicos(id),
    
    -- Observações e Metadados
    observacoes_evento TEXT,
    observacoes_guia TEXT,
    campos_adicionais JSONB, -- Flexibilidade para campos por empresa
    totais_calculados JSONB, -- Armazenará o total e a parte de cada médico
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para auto-atualizar o updated_at (opcional mas recomendado)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_eventos_updated_at ON eventos;
CREATE TRIGGER trigger_eventos_updated_at
BEFORE UPDATE ON eventos
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();


-- 2. Criação da Tabela de Itens do Evento (Detalhe dos códigos tabelados)
CREATE TABLE IF NOT EXISTS evento_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evento_id UUID REFERENCES eventos(id) ON DELETE CASCADE NOT NULL,
    
    -- Snapshot e Identificação
    codigo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    quantidade INTEGER DEFAULT 1 NOT NULL,
    
    -- Regras (Via de Acesso e Perfil)
    via_acesso TEXT DEFAULT 'Exclusiva', -- Exclusiva | Compartilhada
    percentual NUMERIC DEFAULT 100, -- 100, 70, 50, etc
    
    -- Snapshots Financeiros
    origem_valor TEXT DEFAULT 'Tabela',
    tabela_preco_id_snapshot UUID REFERENCES tabelas_preco(id),
    valor_unitario_tabela_snapshot NUMERIC(15,2) NOT NULL,
    valor_calculado_item_snapshot NUMERIC(15,2) NOT NULL,
    rateio_por_medico_snapshot JSONB, -- Ex: {"principal": X, "aux1": Y}
    
    notas_item TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recarregar schema (para que a API do Supabase/PostgREST mapeie as novas tabelas instantaneamente)
NOTIFY pgrst, 'reload schema';
