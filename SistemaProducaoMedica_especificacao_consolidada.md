# SistemaProduçãoMedica (ContiliMed / CirurgiCash) — Especificação Consolidada (MD)

> Documento-base para orientar a construção do projeto no **Antigravity**.  
> Escopo: **cadastros, telas, fluxos, validações, cálculos, faturamento, cobranças, conciliação e glosas**.

---

## 1) Visão do produto

### 1.1 Objetivo macro
Centralizar o ciclo completo de **produção médica → faturamento → cobrança → recebimento → glosas**, com rastreabilidade e cálculo automático conforme **convênio + tabela vigente na data do procedimento**.

### 1.2 Problemas que resolve
- Lançamentos descentralizados (Excel/WhatsApp/portal).
- Erros por falta de campos/anexos/senha/autorização.
- Divergências de valor por **vigência de tabela** e regras de convênio.
- Falta de trilha de auditoria (quem mudou o quê/quando).
- Dificuldade em acompanhar **lotes**, **recebíveis**, **glosas** e **recursos**.

### 1.3 Princípios do produto
- **Simples** para o operacional, **rigoroso** para auditoria.
- **Multiempresas (multi-tenant)** com permissões por empresa.
- Cálculos sempre **derivados de regra + tabela**, com **snapshot** no evento.
- Fluxos com **checklists** e estados claros: rascunho → pronto → enviado → pago/glosado.

---

## 2) Escopo funcional (módulos)

1. **Autenticação & Multiempresa**
2. **Cadastros (Lookups)**
   - Convênios
   - Tabelas de preço e itens (vigências)
   - Médicos
   - Hospitais
   - (Futuro) Pacientes, Setor/Unidade, Motivos de glosa, Snippets
3. **Eventos (Produção)**
   - Novo evento: Procedimento Médico (RGO/Honorário)
   - Novo evento: Consulta
   - Novo evento: Exame / SP / SADT
4. **Faturamento**
   - Eventos (fila de conferência)
   - Lotes (criar, fechar, enviar, acompanhar)
   - Produção (consolidado)
   - Relatório de transações (extrato)
5. **Cobranças**
   - Fila de emissão (NFS-e)
   - Remessas / faturas ao convênio (quando não houver NFS-e por item)
   - Conciliação de rece bíveis (importação + pareamento)
6. **Recursos / Glosas**
   - Pipeline (nova → enviada → deferida/indeferida etc.)
   - Prazos e evidências
7. **Anexos & Qualidade**
   - Pastas por categoria; somente PDFs (MVP)
   - Controle de documentos rejeitados e motivos (padrão/qualidade)

---

## 3) Decisões de UI/UX já definidas

### 3.1 Tema & Identidade
- **Dark/Light automático**
- Paleta baseada na **Contili** (azul principal, apoio laranja quando necessário)

### 3.2 Menu lateral (mínimo)
- Dashboard
- Novo evento
  - Procedimento Médico
  - Consulta
  - Exame / SP / SADT
- Eventos (Faturamento › Eventos)
- Lotes
- Cobranças
- Recursos (Glosas)
- Cadastros
  - Convênio
  - Médico
  - Hospital
  - (Tabelas por convênio)
- Configurações

---

## 4) Entidades de dados (modelo lógico)

### 4.1 Núcleo
- **Empresa (Tenant)**
- **Usuário**
- **Permissões / Papéis (RBAC)**

### 4.2 Cadastros
- **Convenio**
  - id, empresa_id (se for por empresa) ou global, nome, status, observações
- **Medico**
  - id, nome, cpf, crm, especialidade, convenios_que_atende (tags + “todos”), ativo
- **Hospital**
  - id, nome, cnpj, cnes, telefone, contato, email, apelido, convenios_atendidos (tags + “todos”), ativo

### 4.3 Tabelas de preço (vigência)
- **TabelaPreco**
  - id
  - convenio_id
  - nome_origem (ex.: CBHPM/AMB/TUSS/Particular)
  - descricao
  - vigencia_inicio (date)
  - vigencia_fim (date, opcional/aberta)
  - status: Rascunho | Ativa | Arquivada
  - moeda
  - arredondamento (ex.: 2 casas; opção futura de arredondar no cálculo final)
  - anexo_referencia_pdf (file)
  - observacoes
- **TabelaPrecoItem**
  - id
  - tabela_preco_id
  - codigo (texto, preserva zeros)
  - descricao
  - valor (numérico)
  - notas (opcional)
  - índice único: (tabela_preco_id, codigo)

**Regra crítica:** não permitir **sobreposição de vigência** para o mesmo convênio e mesma origem/família.

### 4.4 Eventos (produção)
- **Evento**
  - id, empresa_id, tipo_evento (Procedimento/Consulta/Exame)
  - status_operacional: Rascunho | Pendencias | Pronto | Enviado | Pago | Glosado | Cancelado
  - paciente_nome, paciente_cpf (opcional conforme toggle), paciente_nascimento
  - convenio_id, hospital_id, setor_unidade_id (futuro)
  - data_procedimento, hora_inicio, hora_fim
  - medico_principal_id, medico_aux1_id (opcional), medico_aux2_id (opcional)
  - urgencia: Eletiva | Emergencia
  - campos_adicionais (JSON) — conforme Configurações (campos obrigatórios por empresa/usuário)
  - observacoes_evento (texto), observacoes_guia (texto) + tags/snippets
  - adicional (num), coparticipativo (num) **(ver decisão de rodapé abaixo)**
  - totais_calculados (JSON): por médico + total
  - auditoria (created_at/by, updated_at/by)

- **EventoItem (procedimento lançado)**
  - id, evento_id
  - codigo, descricao
  - via_acesso: Exclusiva | Compartilhada
  - percentual: 100 | 70 | 50 (configurável por convênio no futuro)
  - quantidade (default 1)
  - origem_valor: Tabela (lock)
  - valor_unitario_tabela_snapshot
  - tabela_preco_id_snapshot (e vigência)
  - valor_calculado_item_snapshot
  - rateio_por_medico_snapshot (JSON)
  - notas_item (opcional)

### 4.5 Anexos
- **Anexo**
  - id, evento_id (e/ou lote_id)
  - categoria: Guia | Ficha | RGO | Termo | APA | Outro
  - arquivo (PDF), nome_original, tamanho, created_at/by

### 4.6 Faturamento / Lotes
- **Lote**
  - id, empresa_id
  - convenio_id
  - periodo_inicio, periodo_fim (competência)
  - hospital_id (opcional)
  - descricao, responsavel_user_id
  - status: Rascunho | Fechado | Enviado | Recebido | Pago | Parcial | Glosado | Cancelado
  - numero_lote_interno
  - numero_lote_operadora (opcional)
  - totais: cobrado, estimado_receber, pago, glosado, diferenca (derivado)
  - anexos_lote (lista)
  - auditoria/log

- **LoteItem**
  - id, lote_id, evento_id (ou evento_item_id se granular)
  - snapshots (valores, tabela, dados relevantes para auditoria)

### 4.7 Cobranças / NFS-e / Conciliação
- **NFSeFila**
  - id, empresa_id
  - municipio, serie_rps, numero_rps
  - convenio_cliente (tomador)
  - referencia (lote_id/evento_id)
  - valor
  - status: Pendente | EmEmissao | Emitida | Erro | Cancelada | Substituida
  - tentativas, ultimo_retorno, pdf/xml (files)

- **ConfiguracaoNFSe**
  - empresa_id, municipio
  - provedor (ABRASF/Betha/GINFES/etc), modo (API/Portal)
  - credenciais/certificado
  - cnae, codigo_servico, aliquota_iss, regime, retenções
  - tomador_padrao_por_convenio (JSON)
  - mensagem_padrao, emails_envio

- **Recebimento**
  - id, empresa_id, data, valor, origem (importado/manual)
  - hash/identificador do extrato, observações

- **Conciliacao**
  - id, recebimento_id, referencia (lote/evento/nfse)
  - tipo: Total | Parcial | Rateio
  - diferenca (num) + motivo (glosa/tarifa/outros)

### 4.8 Glosas / Recursos
- **Glosa**
  - id, empresa_id
  - origem: Item | Lote
  - referencia_id (evento_item_id/lote_item_id)
  - convenio_id, hospital_id, medico_ids (array)
  - status: Nova | EmAnalise | RecursoPreparado | RecursoEnviado | Deferida | Parcial | Indeferida | Reapresentada
  - motivo (taxonomia), subtipo
  - referencia_normativa/guia
  - valor_glosado, valor_recuperado
  - prazo_limite (date)
  - responsavel_user_id
  - anexos (files)
  - observacoes + tags/snippets
  - historico/log (mudanças de status, protocolos, datas)

---

## 5) Telas e formulários (detalhamento)

## 5.1 Login / Landing
- Logo (será enviado depois)
- Tema dark/light automático
- CTA de login
- (Futuro) esqueceu senha, SSO

---

## 5.2 Cadastros

### 5.2.1 Cadastros → Convênio (Lista)
- Busca incremental + contador
- Ações:
  - Adicionar (+)
  - Exportar (ícone seta)
  - (Futuro) Importar
- Colunas: Nome (padrão), (futuro: status/vigência)

### 5.2.2 Convênio → Tabelas de Preços (por convênio)
**Lista de Tabelas**
- Filtros: status, origem, intervalo de vigência
- Ações: Adicionar | Clonar | Arquivar | Exportar CSV | Importar CSV/XLSX | Anexar PDF
- Badge de vigência “YYYY-MM-DD a …”
- Validação: impedir sobreposição de vigência (mesma origem)

**Itens da Tabela**
- Grid: Código | Descrição | Valor
- Busca por código/termo
- Validações: valor ≥ 0; código único na tabela; alertar duplicados
- Info: contador de itens e valor médio (leve)
- Ações: Adicionar linha | Importar | Limpar (protegido)
- Auditoria: log de alterações (quem/quando)

### 5.2.3 Cadastros → Médico
- Campos: Nome, CPF, CRM, Especialidade, Convênios que atende (tags, inclui “todos”)
- Lookup com ícone “+” nos formulários para inclusão rápida

### 5.2.4 Cadastros → Hospital
- Campos: Nome, CNPJ, CNES, Telefone, Contato, E-mail, Apelido, Convênios atendidos (tags, inclui “todos”)
- Lookup com ícone “+” nos formulários para inclusão rápida

---

## 5.3 Eventos — Novo evento (Procedimento Médico / RGO)

### 5.3.1 Estrutura do formulário
1) **Cabeçalho**: [Voltar]
2) **Identificação do paciente**
   - Tipo: [Honorário] (select)
   - Toggle: “Tem CPF?”
   - CPF (máscara)
   - Nome do paciente* (input + ícone de busca)
   - Nascimento (date)
   - Convênio* (select + busca) — obrigatório
   - Botões: [DADOS ADICIONAIS], [INFORMAÇÕES DO PACIENTE]
   - Setor/Unidade (select) — ex.: Enfermaria
3) **Anexos** (cards com botão +)
   - Guia, Ficha, RGO, Termo, APA, Outro (upload múltiplo **somente PDF**)
4) **Procedimentos (0)** *obrigatório*
   - Lista de itens selecionados (vazia inicialmente)
   - Botão [Adicionar itens] (abre seletor)
   - Urgência: toggle [Eletiva | Emergência] (impacta cálculo)
5) **Bloco lateral (detalhes do evento)**
   - Data do procedimento* (date)
   - Hora Início (time)
   - Hora Fim (time)
   - Médico Principal* (select + add)
   - Médico Auxiliar 1 (select + add)
   - Médico Auxiliar 2 (select + add) (quando aplicável)
   - Hospital* (select + add)
   - Observações (textarea) com abas: [EVENTO] [GUIA]
6) **Rodapé fixo (DECISÃO MAIS RECENTE)**
   - **Remover campos financeiros editáveis**: Adicional, Co-participativo, Valor total editável
   - Exibir **Resumo por Médico (somente leitura)**:
     - Médico Principal: R$ _
     - Auxiliar 1: R$ _
     - Auxiliar 2: R$ _ (se houver)
     - Total do Procedimento: R$ _ (soma dos itens)
   - Ações: [Finalizar depois], [Salvar agora], [Desistir] (com confirmação)

> Observação: “Campos customizados” abre modal (mantido como possibilidade), mas obrigação/visibilidade será controlada em **Configurações**.

### 5.3.2 Seletor de Procedimentos (Adicionar itens)
- Abas: [PROCEDIMENTOS] e [PACOTES]
- Busca incremental por **código** ou **descrição**
- Fonte de preço: **tabela vigente do Convênio**, definida pela **Data do procedimento** (não pela data do lançamento)
- Ao selecionar item, entra na lista com:
  - Via de acesso: [Exclusiva | Compartilhada]
  - Percentual:
    - Exclusiva → 100%
    - Compartilhada → 70% ou 50% (lista configurável por convênio no futuro)
  - Quantidade (default 1)
  - Origem do valor: “Tabela” (lock) + exibir **valor unitário base**
  - Valor calculado do item (somente leitura)
- **Snapshot obrigatório no evento**:
  - código, descrição, valor de tabela, id da tabela e vigência aplicada

### 5.3.3 Observações — comportamento
- Abas: **EVENTO** e **GUIA**
- Recursos:
  - snippets/atalhos por categoria
  - #tags (ex.: #opme, #emergência, #sem-senha, #divergência-código)
  - carimbo automático data/usuário a cada edição
  - contador de caracteres (~500–800)
- Gatilhos (futuro): detectar #tags e sugerir ações (ex.: #glosa → abrir glosa)

### 5.3.4 Anexos — comportamento
- 6 categorias fixas: Guia, Ficha, RGO, Termo, APA, Outro
- Cada botão abre “pasta” local do evento e lista arquivos
- Permite adicionar múltiplos PDFs por categoria; remover/visualizar via lista
- MVP: **armazenamento simples**, sem OCR/processamento

### 5.3.5 Validações (MVP)
- Obrigatórios:
  - Nome do paciente
  - Convênio
  - Pelo menos 1 procedimento
  - Data do procedimento
  - Médico principal
  - Hospital
- Máscaras: CPF, Data, Hora
- Itens: via de acesso e percentual válidos; impedir combinações inconsistentes

---

## 5.4 Faturamento

### 5.4.1 Faturamento › Eventos (Fila)
**Objetivo:** listar lançamentos prontos/pendentes para faturar; permitir conferência rápida e envio a lote.

**Layout**
- Topo: filtros + contadores por status + busca global
- Tabela principal (virtualizada) com colunas configuráveis
- Drawer lateral ao clicar em uma linha (Resumo/Checklist/Anexos/Histórico/Ações)

**Filtros**
- Período (data procedimento e/ou data criação)
- Convênio, Hospital, Médico (principal/aux), Tipo de evento
- Status (rascunho/pronto/pendências/enviado/pago/glosado)
- Urgência
- Presença de anexos (por tipo)
- Pendência de senha/autorização
- Faixa de valor
- Lote (sem lote / nº lote)
- Glosa (sem/com/valor > X)

**Colunas sugeridas**
- Checkbox seleção
- Nº atendimento/guia
- Data/hora
- Paciente
- Convênio
- Hospital
- Médico principal (badge aux)
- Procedimentos (ícone p/ detalhes)
- Valor cobrado (calc.)
- Pendências (badges)
- Status
- Lote
- Observações (tooltip)
- Ações

**Badges de pendência (exemplos)**
- Sem guia; Sem RGO; Sem senha (ou vencida)
- Dados obrigatórios faltantes
- Anexos incompletos
- Tabela desatualizada (vigência)
- CPF inválido
- Sem hospital/médico

**Ações em massa**
- Enviar para Lote (criar novo ou usar existente)
- Marcar pendências (gera tarefas)
- Validar agora (roda checklist)
- Exportar CSV/Excel

**Checklist por convênio (pré “Pronto p/ faturar”)**
- Campos obrigatórios
- Anexos presentes
- Senha/autorização válida
- Vigência de tabela válida (pela data do procedimento)
- Procedimentos com via/percentual ok
- Total calculado
- Observações GUIA quando exigidas

**Estados/cores (referência UI)**
- Rascunho (cinza)
- Pendências (amarelo)
- Pronto (azul)
- Enviado (verde)
- Em análise (azul-claro)
- Pago (verde-escuro)
- Glosado (vermelho)

---

### 5.4.2 Faturamento › Lotes
**Criação**
- Empresa (multiempresas)
- Convênio (obrig.)
- Período (competência)
- Hospital (opcional)
- Descrição (livre)
- Responsável

**Regras**
- Itens devem estar “Pronto p/ faturar”
- Impedir evento em mais de um lote

**Lista de lotes (grid)**
- Nº lote interno
- Convênio, Empresa, Período
- Qtde itens
- Cobrado (R$)
- Status
- Data criação, última ação, responsável
- Ações: abrir, fechar, enviar, exportar, duplicar, cancelar

**Detalhe do lote**
- Header: convênio/período/valores/status/nº operadora (se houver)
- Abas:
  - Itens (com pendências/anexos)
  - Check de conferência
  - Anexos do lote
  - Histórico (log)
  - Tarefas/pendências
- Ações:
  - Adicionar/remover itens
  - Recalcular (se mudou convênio/data — com cautela)
  - Fechar lote (bloqueia edição)
  - Gerar remessa (XML TISS quando aplicável / lista para portal)
  - Enviar (marcar como enviado)
  - Registrar pagamento (atalho conciliação)
  - Abrir glosa (por item ou lote)
  - Reabrir (Admin, com motivo/log)

**Lifecycle**
- Rascunho → Fechado → Enviado → Recebido → Pago/Parcial/Glosado

---

## 5.5 Cobranças

### 5.5.1 Fila de Emissão (NFS-e)
- Colunas:
  - Empresa (emitente), Município, Série/RPS
  - Convênio/Cliente (tomador)
  - Lote/Item, Valor
  - Status (Pendente/Em emissão/Emitida/Erro/Cancelada/Substituída)
  - Tentativas, Último retorno
- Ações:
  - Emitir agora
  - Emitir em lote
  - Reprocessar erro
  - Cancelar (motivo)
  - Substituir (quando permitido)
  - Baixar PDF/XML
  - Enviar por e-mail
- Filtros:
  - período, empresa, município, status, convênio, valor, lote

### 5.5.2 Configurações NFS-e (por Empresa/Município)
- Emitente: Razão/CNPJ/Inscrições
- CNAE, código do serviço, alíquota ISS, regime (Simples/Lucro)
- Retenções (INSS/IR/CSRF), natureza da operação
- Provedor municipal (ABRASF/Betha/GINFES etc.), modo (API/Portal)
- Credenciais/certificado
- Série/numeração/RPS
- Tomador padrão por convênio (CNPJ/IE/Endereço) + e-mail padrão
- Mensagem padrão
- Preferências: ISS retido? (por convênio)

### 5.5.3 Remessas / Faturas ao Convênio
- Campos:
  - nº remessa/portal
  - data envio
  - período/competência
  - valor
  - anexo do comprovante/lista
  - status (Enviado/Recebido/Em análise/Devolvido/Aprovado)

### 5.5.4 Conciliação de Recebíveis
- Importar extrato/planilha (CSV/OFX/XLSX) ou lançamento manual
- Tela de pareamento:
  - linha do extrato ↔ lote/itens/notas (sugestões por valor/data/convênio)
- Ações:
  - Conciliar
  - Parcial
  - Dividir entre itens
  - Marcar diferença (glosa/tarifa)
  - Gerar glosa a partir da diferença
- Indicadores:
  - Recebido, Em aberto, Em atraso (comparado SLA do convênio)

---

## 5.6 Recursos (Glosas)

### 5.6.1 Pipeline
**Nova → Em análise → Recurso preparado → Recurso enviado → Deferida/Parcial/Indeferida → Reapresentada**

### 5.6.2 Campos principais
- Motivo (taxonomia) + subtipo
- Referência normativa/guia
- Valor glosado, valor recuperado
- Prazo limite (dias úteis/corridos — parametrizável)
- Responsável
- Convênio, hospital, médico(s)
- Anexos/evidências
- Observações GUIA com snippets e #tags

### 5.6.3 Lista (kanban/tabela alternável)
- Filtros: período, convênio, hospital, status, motivo, valor, responsável, prazo (vencido/hoje/7d)
- Contadores e soma por status

### 5.6.4 Detalhe da glosa
- Abas:
  - Evidências (anexos/links)
  - Histórico (log)
  - Tarefas (to-dos e prazos)
  - Comunicações (protocolos/e-mails)
  - Cálculo (snapshot do item e regra aplicada)
  - Andamentos (mudanças de status)
- Ações:
  - Preparar recurso (gera checklist + modelo)
  - Anexar evidências
  - Registrar envio (protocolo/data)
  - Reapresentar
  - Marcar deferida/parcial/indeferida

---

## 6) Cálculos (motor de regras)

> Importante: os valores **serão calculados automaticamente** pelas regras do convênio/tabela (definição detalhada por convênio vem depois).  
> Mesmo assim, já existe a estrutura de cálculo e os pontos onde o cálculo “engata”.

### 6.1 Seleção de tabela vigente (regra)
- Base: **Data do procedimento**
- Seleção:
  1) pegar tabela **Ativa** cuja vigência contém a data (início ≤ data ≤ fim ou fim aberto)
  2) fallback: a mais recente com início ≤ data (quando não houver fim)
- Guardar snapshot: id da tabela + data de vigência aplicada + valor unitário por código

### 6.2 Cálculo do item (mínimo)
- Variáveis:
  - valor_unitario_tabela
  - quantidade
  - via (Exclusiva/Compartilhada)
  - percentual (100/70/50...)
  - urgência (Eletiva/Emergência)
- Fórmula base (exemplo genérico):
  - `valor_base = valor_unitario_tabela * quantidade`
  - `valor_via = valor_base * (percentual/100)`
  - `valor_urgencia = aplicar_regra_urgencia(convenio, valor_via, urgencia)` *(placeholder)*
  - `valor_item = arredondar(valor_urgencia, regra_tabela)`

### 6.3 Rateio por médico (snapshot)
- Para cada item, calcular divisão conforme regra do convênio:
  - Principal: X%
  - Aux1: Y%
  - Aux2: Z%
- Exibir preview por item (tooltip/expansível)
- Consolidar no rodapé geral:
  - soma por médico + total do procedimento

### 6.4 Auditoria dos cálculos
- Gravar:
  - valor_unitario_tabela_snapshot
  - valor_calculado_item_snapshot
  - rateio_por_medico_snapshot
- Permitir relatório posterior por item/código e por médico

---

## 7) Configurações (campos obrigatórios e comportamento)

### 7.1 “Dados adicionais” (ficha extensa)
- Controle em **Configurações** para definir quais campos são obrigatórios por empresa/usuário
- Na ficha “Dados Adicionais”:
  - toggle “Mostrar somente campos obrigatórios” (UX para facilitar)

### 7.2 Convênio por último na modelagem (observação)
- Campo Convênio é sensível porque dirige regras/tabela/cálculo; manter consistente e bem validado.

---

## 8) Exportações, importações e padrões de arquivo

### 8.1 Exportações (mínimo)
- CSV/Excel por tela:
  - Eventos (resultado filtrado)
  - Lotes (itens)
  - Glosas
  - Transações/Extrato
- Opção de exportar “detalhado por item”

### 8.2 Padrão CSV — “Ficha de Cirurgia Descritiva” (padronização)
Cada linha = **1 procedimento**. Campos:
- DATA, HORA, TIPO (NORMAL/URGENTE), CARTEIRINHA (texto),
- GUIA, SENHA, ATENDIMENTO, PACIENTE,
- CONVENIO / FONTE, HOSPITAL,
- MÉDICO / CIRURGIÃO, CIRURGIÃO 1º AUXILIAR, CIRURGIÃO 2º AUXILIAR,
- CÓDIGO, DESCRIÇÃO

Regras:
- Quando houver mais de 1 procedimento: repetir dados e variar apenas código/descrição
- Preservar acentuação
- CARTEIRINHA como texto (evitar notação científica)

### 8.3 Controle de qualidade (documentos rejeitados)
Manter lista de rejeitados com motivo:
- orientação paisagem
- cortes
- inclinação excessiva
- baixa nitidez
- partes críticas ilegíveis

---

## 9) Permissões (RBAC)

Papéis sugeridos:
- **Operacional**: lança/edita rascunho, anexos, corrige pendências
- **Conferente**: valida checklist, marca “Pronto”
- **Faturista**: cria/fecha/enviar lote, gera remessa, emite NFS-e
- **Financeiro**: registra recebimentos, concilia, marca diferenças/glosas
- **Admin**: configurações, reabrir/cancelar lote, cadastros globais, permissões

---

## 10) Auditoria e trilha (obrigatória)
- Log por Evento, Lote, Glosa, Tabela de Preço:
  - quem alterou
  - quando
  - o que mudou (dif)
- Log de validação/checklist (resultado + itens com pendência)
- Log de emissão/cancelamento NFS-e (tentativas e retorno)

---

## 11) Performance & UX (não-funcionais)
- Tabela virtualizada nas listas (Eventos/Lotes/Glosas)
- Paginação infinita
- Filtros salvos por usuário
- Ações assíncronas com toasts e “undo” quando possível
- Upload de PDFs com validação de tipo/tamanho

---

## 12) Roadmap sugerido (para virar épicos no Antigravity)

### MVP 1 — Produção (Eventos)
- Autenticação + multiempresa
- Cadastros: Convênio, Médico, Hospital
- Tabelas de preço: CRUD + import CSV/XLSX
- Evento Procedimento Médico (RGO) + anexos + selector
- Snapshot de tabela/valores
- Resumo por médico no rodapé (somente leitura)

### MVP 2 — Faturamento
- Tela Eventos (fila) com filtros, badges, checklist
- Lotes: criar/fechar/enviar + export
- Auditoria básica

### MVP 3 — Cobranças & Conciliação
- Fila NFS-e + configurações
- Remessas
- Conciliação (importação + pareamento)
- “Gerar glosa a partir da diferença”

### MVP 4 — Glosas
- Kanban/tabela + detalhe + evidências
- Modelos/snippets por motivo/convênio
- Prazos e alertas

### MVP 5 — Dashboards & KPIs
- Cobrado x Pago
- % glosa + recuperação
- SLA de pagamento
- Aging de glosas

---

## 13) Notas sobre legado (Excel/VBA)
- Existe base legada com:
  - tabelas por convênio em planilhas (ex.: HAPVIDA_0123)
  - busca por código para retornar descrição e valor
  - regras de incisão/percentuais e auxiliares (macro)
- Estratégia recomendada:
  - importar tabelas legadas para **TabelaPreco + TabelaPrecoItem**
  - recriar “motor de cálculo” no backend com snapshots
  - manter exportações compatíveis com os controles atuais (CSV/Excel)

---

## 14) Checklist final (para iniciar desenvolvimento no Antigravity)
- [ ] Definir stack (DB, storage, auth, front) e convenções de multi-tenant
- [ ] Criar schema das entidades (seções 4 e 6)
- [ ] Implementar Cadastros + Tabela de Preço (com validação de vigência)
- [ ] Implementar Evento (Procedimento Médico) com selector e snapshots
- [ ] Implementar cálculo mínimo (via/percentual/urgência placeholder) + resumo por médico
- [ ] Implementar Eventos (fila) + checklist + badges
- [ ] Implementar Lotes (lifecycle) + export
- [ ] Implementar Conciliação + Glosas (pipeline)
- [ ] Implantar auditoria/log em tudo

---

**Fim do documento.**
