import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { FilePlus, Save, AlertCircle, Plus, Trash2, Search, ArrowRight, BookOpen } from 'lucide-react'

export default function NovoEventoMedico() {
    const [loadingData, setLoadingData] = useState(true)
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    // Combobox data
    const [convenios, setConvenios] = useState([])
    const [hospitais, setHospitais] = useState([])
    const [medicos, setMedicos] = useState([])

    // Event Data State
    const [eventoId, setEventoId] = useState(null) // If editing
    const [formData, setFormData] = useState({
        paciente_nome: '',
        paciente_cpf: '',
        paciente_nascimento: '',
        carteirinha: '',
        guia: '',
        senha: '',
        atendimento: '',
        convenio_id: '',
        hospital_id: '',
        data_procedimento: new Date().toISOString().split('T')[0],
        hora_inicio: '',
        hora_fim: '',
        urgencia: 'Eletiva',
        medico_principal_id: '',
        medico_aux1_id: '',
        medico_aux2_id: '',
        anestesista: '',
        instrumentador: '',
        observacoes_evento: '',
        observacoes_guia: ''
    })

    // Itens Data State
    const [itens, setItens] = useState([])

    // UI States for Modal Picker
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [pickerLoading, setPickerLoading] = useState(false)
    const [pickerResults, setPickerResults] = useState([])

    // Tabela Vigente
    const [tabelaVigente, setTabelaVigente] = useState(null)

    useEffect(() => {
        fetchSupportData()
    }, [])

    async function fetchSupportData() {
        setLoadingData(true)

        // Em paralelo, busca convenios, hospitais e medicos
        const [resConvenios, resHospitais, resMedicos] = await Promise.all([
            supabase.from('convenios').select('id, nome, status').eq('status', 'Ativo').order('nome'),
            supabase.from('hospitais').select('id, nome_fantasia, status').eq('status', 'Ativo').order('nome_fantasia'),
            supabase.from('medicos').select('id, nome, especialidade, status').eq('status', 'Ativo').order('nome')
        ])

        if (resConvenios.data) setConvenios(resConvenios.data)
        if (resHospitais.data) setHospitais(resHospitais.data)
        if (resMedicos.data) setMedicos(resMedicos.data)

        setLoadingData(false)
    }

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setErrorMsg('')
        setSuccessMsg('')

        if (!formData.paciente_nome || !formData.convenio_id || !formData.hospital_id || !formData.data_procedimento || !formData.medico_principal_id) {
            setErrorMsg('Preencha todos os campos obrigatórios (marcados com *).')
            return
        }

        setSaving(true)

        // 1. Inserir Evento PAI
        const eventoPayload = {
            tipo_evento: 'Procedimento Médico',
            status_operacional: itens.length > 0 ? 'Pronto' : 'Rascunho', // Logica inicial simplificada
            paciente_nome: formData.paciente_nome,
            paciente_cpf: formData.paciente_cpf || null,
            paciente_nascimento: formData.paciente_nascimento || null,
            carteirinha: formData.carteirinha || null,
            guia: formData.guia || null,
            senha: formData.senha || null,
            atendimento: formData.atendimento || null,
            convenio_id: formData.convenio_id,
            hospital_id: formData.hospital_id,
            data_procedimento: formData.data_procedimento,
            hora_inicio: formData.hora_inicio || null,
            hora_fim: formData.hora_fim || null,
            urgencia: formData.urgencia,
            medico_principal_id: formData.medico_principal_id,
            medico_aux1_id: formData.medico_aux1_id || null,
            medico_aux2_id: formData.medico_aux2_id || null,
            anestesista: formData.anestesista || null,
            instrumentador: formData.instrumentador || null,
            observacoes_evento: formData.observacoes_evento,
            observacoes_guia: formData.observacoes_guia
        }

        const { data: eventoSalvo, error: errorEvento } = await supabase
            .from('eventos')
            .insert([eventoPayload])
            .select()
            .single()

        if (errorEvento) {
            setErrorMsg('Erro ao salvar cabeçalho do evento: ' + errorEvento.message)
            setSaving(false)
            return
        }

        // 2. Inserir Itens FILHO (se existirem)
        if (itens.length > 0) {
            const itensPayload = itens.map(item => ({
                evento_id: eventoSalvo.id,
                tabela_preco_id_snapshot: item.tabela_preco_id_snapshot,
                codigo: item.codigo,
                descricao: item.descricao,
                quantidade: item.quantidade,
                via_acesso: item.via_acesso,
                percentual: item.percentual,
                incisao: item.incisao,
                valor_unitario_tabela_snapshot: item.valor_unitario_tabela_snapshot,
                valor_calculado_item_snapshot: item.valor_calculado_item_snapshot,
                notas_item: item.notas_item || ''
            }))

            const { error: errorItens } = await supabase
                .from('evento_itens')
                .insert(itensPayload)

            if (errorItens) {
                setErrorMsg('Evento criado, mas houve erro ao salvar os procedimentos: ' + errorItens.message)
                setSaving(false)
                return
            }
        }

        setSuccessMsg('Evento Médico e Procedimentos registrados com sucesso!')

        // Reset (comportamento de NOVO EVENTO)
        // Aqui no futuro poderíamos ir para a tela de Detalhes do Evento ou limpar.
        // Vou apenas limpar parcialmente para facilitar múltiplos lançamentos.
        setFormData({
            ...formData,
            paciente_nome: '',
            paciente_cpf: '',
            paciente_nascimento: '',
            observacoes_evento: '',
            observacoes_guia: ''
        })
        setItens([])

        setSaving(false)
    }

    // LÓGICA DO PICKER DE PROCEDIMENTOS
    // 1. Encontrar tabela vigente quando Convênio ou Data mudam
    useEffect(() => {
        if (formData.convenio_id && formData.data_procedimento) {
            buscarTabelaVigente(formData.convenio_id, formData.data_procedimento)
        } else {
            setTabelaVigente(null)
        }
    }, [formData.convenio_id, formData.data_procedimento])

    async function buscarTabelaVigente(convenioId, dataStr) {
        const { data, error } = await supabase
            .from('tabelas_preco')
            .select('id, nome_origem, descricao')
            .eq('convenio_id', convenioId)
            .eq('status', 'Ativa')
            // Logica simplificada para MVP: Pega a primeira ativa.
            // Numa segunda fase, implementamos strictly o `vigencia_inicio` <= dataStr
            .limit(1)
            .single()

        if (data) setTabelaVigente(data)
        else setTabelaVigente(null)
    }

    // 2. Busca com Debounce no Modal
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (isPickerOpen && searchTerm.length >= 2 && tabelaVigente) {
                realizarBuscaItens()
            } else if (searchTerm.length < 2) {
                setPickerResults([])
            }
        }, 500)

        return () => clearTimeout(delayDebounceFn)
    }, [searchTerm, isPickerOpen])

    async function realizarBuscaItens() {
        setPickerLoading(true)
        const { data, error } = await supabase
            .from('tabelas_preco_itens')
            .select('*')
            .eq('tabela_preco_id', tabelaVigente.id)
            .or(`codigo.ilike.%${searchTerm}%,descricao.ilike.%${searchTerm}%`)
            .limit(30)

        if (data) setPickerResults(data)
        setPickerLoading(false)
    }

    const addItem = (itemDb) => {
        const novoItem = {
            id_uuid_temp: crypto.randomUUID(),
            tabela_preco_id_snapshot: itemDb.tabela_preco_id,
            codigo: itemDb.codigo,
            descricao: itemDb.descricao,
            quantidade: 1,
            via_acesso: 'Exclusiva',
            percentual: 100, // Incisão padrão para Principal
            incisao: 100, // Compat legada
            valor_unitario_tabela_snapshot: itemDb.valor,
            valor_calculado_item_snapshot: itemDb.valor
        }
        setItens([...itens, novoItem])
        setIsPickerOpen(false)
        setSearchTerm('')
    }

    const removerItem = (uuidTemp) => {
        setItens(itens.filter(i => i.id_uuid_temp !== uuidTemp))
    }

    const atualizarItem = (uuidTemp, field, value) => {
        setItens(itens.map(item => {
            if (item.id_uuid_temp === uuidTemp) {
                const newItem = { ...item, [field]: value }
                // Recalcula o valor na hora se a quantidade ou percentual(incisao) mudarem
                if (field === 'quantidade' || field === 'percentual' || field === 'incisao') {
                    const pct = Number(newItem.incisao || newItem.percentual) / 100
                    newItem.valor_calculado_item_snapshot = (newItem.valor_unitario_tabela_snapshot * newItem.quantidade) * pct
                }
                return newItem
            }
            return item
        }))
    }

    const totalCalculado = itens.reduce((acc, item) => acc + Number(item.valor_calculado_item_snapshot || 0), 0)

    if (loadingData) {
        return <div className="p-8 text-center text-slate-400">Carregando formulário e bases...</div>
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-24">
            <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
                        <FilePlus className="text-blue-500" size={32} />
                        <span>Novo Procedimento Médico</span>
                    </h2>
                    <p className="text-slate-400 mt-2">Dossiê principal: Registre honorários, cirurgias e detalhes do paciente.</p>
                </div>
            </div>

            {errorMsg && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-3 text-red-500">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{errorMsg}</span>
                </div>
            )}

            {successMsg && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start space-x-3 text-green-500">
                    <span className="text-sm font-medium">{successMsg}</span>
                </div>
            )}

            <form id="eventoForm" onSubmit={handleSave} className="space-y-8">
                {/* BLOCO 1: PACIENTE */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">1. Identificação do Paciente</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-slate-300">Nome do Paciente *</label>
                            <input
                                type="text"
                                name="paciente_nome"
                                required
                                placeholder="João da Silva"
                                value={formData.paciente_nome}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Data de Nascimento</label>
                            <input
                                type="date"
                                name="paciente_nascimento"
                                value={formData.paciente_nascimento}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">CPF</label>
                            <input
                                type="text"
                                name="paciente_cpf"
                                placeholder="000.000.000-00"
                                value={formData.paciente_cpf}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono"
                            />
                        </div>

                        {/* Campos Extras - Faturamento Tradicional */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Carteirinha</label>
                            <input
                                type="text"
                                name="carteirinha"
                                placeholder="..."
                                value={formData.carteirinha}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Nº da Guia</label>
                            <input
                                type="text"
                                name="guia"
                                placeholder="..."
                                value={formData.guia}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Senha / Autorização</label>
                            <input
                                type="text"
                                name="senha"
                                placeholder="..."
                                value={formData.senha}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Atendimento</label>
                            <input
                                type="text"
                                name="atendimento"
                                placeholder="..."
                                value={formData.atendimento}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono"
                            />
                        </div>

                        {/* Separador Visual */}
                        <div className="md:col-span-3 border-t border-slate-700/50 my-2"></div>

                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-slate-300">Convênio Faturado *</label>
                            <select
                                name="convenio_id"
                                required
                                value={formData.convenio_id}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="">-- Selecione o Convênio --</option>
                                {convenios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">Este convênio ditará qual Tabela de Preços estará válida na data do procedimento.</p>
                        </div>
                    </div>
                </div>

                {/* BLOCO 2: DETALHES DO PROCEDIMENTO */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">2. Detalhes Clínicos e Local</h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-slate-300">Hospital / Local *</label>
                            <select
                                name="hospital_id"
                                required
                                value={formData.hospital_id}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="">-- Selecione o Hospital --</option>
                                {hospitais.map(h => <option key={h.id} value={h.id}>{h.nome_fantasia}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Data do Proc. *</label>
                            <input
                                type="date"
                                name="data_procedimento"
                                required
                                value={formData.data_procedimento}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-bold text-blue-400 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Urgência</label>
                            <select
                                name="urgencia"
                                value={formData.urgencia}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="Eletiva">Eletiva (Normal)</option>
                                <option value="Emergencia">Emergência</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Hora Início</label>
                            <input
                                type="time"
                                name="hora_inicio"
                                value={formData.hora_inicio}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Hora Fim</label>
                            <input
                                type="time"
                                name="hora_fim"
                                value={formData.hora_fim}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                            />
                        </div>
                    </div>
                </div>

                {/* BLOCO 3: EQUIPE MÉDICA */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">3. Equipe Cirúrgica</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-blue-400">✅ Médico Principal *</label>
                            <select
                                name="medico_principal_id"
                                required
                                value={formData.medico_principal_id}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-blue-900/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="">-- Selecione o Cirurgião --</option>
                                {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-400">1º Auxiliar</label>
                            <select
                                name="medico_aux1_id"
                                value={formData.medico_aux1_id}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="">-- Opcional --</option>
                                {medicos.filter(m => m.id !== formData.medico_principal_id).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-400">2º Auxiliar</label>
                            <select
                                name="medico_aux2_id"
                                value={formData.medico_aux2_id}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="">-- Opcional --</option>
                                {medicos.filter(m => m.id !== formData.medico_principal_id && m.id !== formData.medico_aux1_id).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                        </div>

                        {/* Separador visual */}
                        <div className="md:col-span-3 border-t border-slate-700/50 my-2"></div>

                        <div className="space-y-1 md:col-span-1">
                            <label className="text-sm font-medium text-slate-400">Anestesista (Texto)</label>
                            <input
                                type="text"
                                name="anestesista"
                                placeholder="..."
                                value={formData.anestesista}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-1 md:col-span-1">
                            <label className="text-sm font-medium text-slate-400">Instrumentador (Texto)</label>
                            <input
                                type="text"
                                name="instrumentador"
                                placeholder="..."
                                value={formData.instrumentador}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* BLOCO 4: PROCEDIMENTOS */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-2">
                        <div>
                            <h3 className="text-xl font-bold text-white">4. Calculadora de Produção Médica</h3>
                            {tabelaVigente ? (
                                <p className="text-sm text-green-400 mt-1 flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                    Tabela Acoplada: {tabelaVigente.nome_origem}
                                </p>
                            ) : (
                                <p className="text-sm text-amber-500 mt-1 flex items-center">
                                    <AlertCircle size={14} className="mr-1" />
                                    Selecione o Convênio para habilitar a busca de itens.
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPickerOpen(true)}
                            disabled={!tabelaVigente}
                            className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors font-medium shadow-lg shadow-blue-900/20"
                        >
                            <Search size={16} /> <span>Anexar Procedimento</span>
                        </button>
                    </div>

                    {itens.length === 0 ? (
                        <div className="text-center py-10 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
                            <p className="text-slate-400">Nenhum procedimento médico registrado nesta guia.</p>
                            <p className="text-xs text-slate-500 mt-2">Os itens herdarão valores da tabela atual deste convênio.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-slate-700 text-slate-300 text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 rounded-tl-lg">Código</th>
                                        <th className="px-4 py-3">Descrição e Notas</th>
                                        <th className="px-4 py-3 w-24">Qtde</th>
                                        <th className="px-4 py-3 w-32">Via</th>
                                        <th className="px-4 py-3 w-28 text-center">% Incisão</th>
                                        <th className="px-4 py-3 text-right">R$ Tabela</th>
                                        <th className="px-4 py-3 text-right">R$ Lançado</th>
                                        <th className="px-4 py-3 rounded-tr-lg w-12 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {itens.map(item => (
                                        <tr key={item.id_uuid_temp} className="hover:bg-slate-700/30 transition-colors group">
                                            <td className="px-4 py-3 font-mono text-blue-400">{item.codigo}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-white line-clamp-2" title={item.descricao}>{item.descricao}</p>
                                                <input
                                                    type="text"
                                                    placeholder="Anotações internas..."
                                                    value={item.notas_item || ''}
                                                    onChange={(e) => atualizarItem(item.id_uuid_temp, 'notas_item', e.target.value)}
                                                    className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:border-blue-500 focus:outline-none placeholder-slate-600"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantidade}
                                                    onChange={(e) => atualizarItem(item.id_uuid_temp, 'quantidade', parseInt(e.target.value) || 1)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={item.via_acesso}
                                                    onChange={(e) => atualizarItem(item.id_uuid_temp, 'via_acesso', e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
                                                >
                                                    <option value="Exclusiva">Exclusiva (100%)</option>
                                                    <option value="Mesma Via">M. Via (70%)</option>
                                                    <option value="Diferente Via">D. Via (50%)</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.incisao}
                                                        onChange={(e) => atualizarItem(item.id_uuid_temp, 'incisao', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2 pr-6 py-1.5 focus:outline-none focus:border-blue-500 text-center font-bold text-amber-400"
                                                    />
                                                    <span className="absolute right-2 top-2 text-slate-500 text-xs">%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-400">
                                                {Number(item.valor_unitario_tabela_snapshot).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-green-400">
                                                {Number(item.valor_calculado_item_snapshot).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removerItem(item.id_uuid_temp)}
                                                    className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </form>

            {/* BARRA INFERIOR FIXA */}
            <div className="fixed bottom-0 left-64 right-0 p-4 bg-slate-900/90 backdrop-blur-md border-t border-slate-700 flex justify-between items-center z-40">
                <div className="text-sm">
                    <span className="text-slate-400">Total prévio (R$): </span>
                    <span className="text-2xl font-bold text-green-400">R$ {totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex space-x-3">
                    <button type="button" className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors">
                        Descartar
                    </button>
                    <button
                        type="submit"
                        form="eventoForm"
                        disabled={saving}
                        className="flex items-center space-x-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-bold shadow-lg shadow-blue-900/40 disabled:opacity-50"
                    >
                        <Save size={20} />
                        <span>{saving ? 'Registrando Honorário...' : 'Registrar Evento'}</span>
                    </button>
                </div>
            </div>

            {/* MODAL PICKER DE PROCEDIMENTOS */}
            {isPickerOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-700 flex flex-col h-[80vh]">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center">
                                    <Search className="mr-3 text-blue-500" /> Consultar Tabela
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">Busque por código (ex: 3100) ou termo (ex: artroscopia).</p>
                            </div>
                            <button onClick={() => { setIsPickerOpen(false); setSearchTerm('') }} className="text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1 text-sm font-medium transition-colors">
                                Cancelar
                            </button>
                        </div>

                        <div className="p-4 border-b border-slate-700 bg-slate-900">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input
                                    type="text"
                                    placeholder="Digite ao menos 2 caracteres para buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-800 border-2 border-slate-700 focus:border-blue-500 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-500 outline-none shadow-inner"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 bg-slate-900/50">
                            {pickerLoading ? (
                                <div className="flex items-center justify-center h-full text-slate-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                                    Buscando na matriz TUSS/CBHPM...
                                </div>
                            ) : pickerResults.length > 0 ? (
                                <ul className="space-y-2 p-2">
                                    {pickerResults.map(item => (
                                        <li
                                            key={item.id}
                                            onClick={() => addItem(item)}
                                            className="bg-slate-800 border border-slate-700 rounded-xl p-4 cursor-pointer hover:border-blue-500 hover:bg-slate-750 transition-all flex justify-between items-center group"
                                        >
                                            <div className="pr-4">
                                                <span className="font-mono text-blue-400 font-bold tracking-wider">{item.codigo}</span>
                                                <p className="text-white mt-1 text-sm leading-relaxed">{item.descricao}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Valor</p>
                                                <p className="text-emerald-400 font-bold text-lg">
                                                    R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                                <div className="opacity-0 group-hover:opacity-100 flex items-center text-blue-400 text-xs font-bold uppercase tracking-wider mt-2 justify-end transition-opacity">
                                                    Inserir <ArrowRight size={14} className="ml-1" />
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : searchTerm.length >= 2 ? (
                                <div className="text-center py-20 text-slate-500">
                                    <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                                    Nenhum procedimento encontrado para "{searchTerm}".
                                </div>
                            ) : (
                                <div className="text-center py-20 text-slate-600">
                                    <BookOpen size={48} className="mx-auto mb-4 opacity-10" />
                                    Aguardando digitação para buscar na base.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
