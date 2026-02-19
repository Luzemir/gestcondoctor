-- Criação de Tabelas para Gestcon Doctor

-- 1. Empresas (Multi-tenant)
CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Convenios
CREATE TABLE convenios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id),
    nome TEXT NOT NULL,
    status TEXT DEFAULT 'Ativo',
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Medicos
CREATE TABLE medicos (
    id PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id),
    nome TEXT NOT NULL,
    cpf TEXT,
    crm TEXT,
    especialidade TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Hospitais
CREATE TABLE hospitais (
    id PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id),
    nome TEXT NOT NULL,
    cnpj TEXT,
    cnes TEXT,
    telefone TEXT,
    contato TEXT,
    email TEXT,
    apelido TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabelas de Preço
CREATE TABLE tabelas_preco (
    id PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id),
    convenio_id UUID REFERENCES convenios(id),
    nome_origem TEXT NOT NULL, -- ex: CBHPM, AMB, TUSS
    descricao TEXT,
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE,
    status TEXT DEFAULT 'Ativa', -- Rascunho, Ativa, Arquivada
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Itens da Tabela
CREATE TABLE tabelas_preco_itens (
    id PRIMARY KEY DEFAULT uuid_generate_v4(),
    tabela_preco_id UUID REFERENCES tabelas_preco(id),
    codigo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tabela_preco_id, codigo)
);
