import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { FilePlus, Save, AlertCircle, Plus, Trash2, Search, ArrowRight } from 'lucide-react'

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

        setSuccessMsg('Evento Médico registrado com sucesso! (Fase 1)')

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

                {/* BLOCO 4: PROCEDIMENTOS (EM BREVE NO PRÓXIMO PASSO) */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl border-dashed">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-2">
                        <h3 className="text-xl font-bold text-white">4. Procedimentos Realizados</h3>
                        <button type="button" disabled className="text-sm px-3 py-1.5 bg-blue-600/50 text-white rounded-lg opacity-50 cursor-not-allowed flex items-center space-x-2">
                            <Plus size={16} /> <span>Adicionar Código (Via Tabela)</span>
                        </button>
                    </div>
                    <div className="text-center py-8 text-slate-500">
                        <p>O seletor inteligente de códigos de tabela (itens) será engatado nesta seção.</p>
                        <p className="text-xs mt-2">Salve o cabeçalho base para validar a inserção de banco de dados.</p>
                    </div>
                </div>

            </form>

            {/* BARRA INFERIOR FIXA */}
            <div className="fixed bottom-0 left-64 right-0 p-4 bg-slate-900/90 backdrop-blur-md border-t border-slate-700 flex justify-between items-center z-40">
                <div className="text-sm">
                    <span className="text-slate-400">Total prévio (R$): </span>
                    <span className="text-2xl font-bold text-white">0,00</span>
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

        </div>
    )
}
