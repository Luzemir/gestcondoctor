import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { FileText, Calendar, Plus, Edit2, Archive, ArrowLeft, X, Save, AlertCircle, Copy, Trash2, Loader2 } from 'lucide-react'
import TabelasItens from './TabelasItens'

export default function TabelasPreco({ convenioId, onBack }) {
    const [tabelas, setTabelas] = useState([])
    const [loading, setLoading] = useState(true)
    const [convenioNome, setConvenioNome] = useState('')
    const [selectedTabelaId, setSelectedTabelaId] = useState(null)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTabela, setEditingTabela] = useState(null)
    const [formData, setFormData] = useState({
        nome_origem: '',
        descricao: '',
        vigencia_inicio: '',
        vigencia_fim: '',
        status: 'Rascunho'
    })
    const [errorMsg, setErrorMsg] = useState('')
    const [saving, setSaving] = useState(false)
    const [processingAction, setProcessingAction] = useState({ id: null, action: '' })

    // Session state to add required empresa_id to inserts
    const [empresaId, setEmpresaId] = useState(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            // Como não temos empresa_id complexo ainda, vamos simular ou pegar do convênio se existir.
            // O Supabase RLs não está rígido, mas precisamos de algum valor se o schema exigir.
        })

        if (convenioId) {
            fetchTabelas()
            fetchConvenio()
        }
    }, [convenioId])

    async function fetchConvenio() {
        const { data } = await supabase.from('convenios').select('nome, empresa_id').eq('id', convenioId).single()
        if (data) {
            setConvenioNome(data.nome)
            setEmpresaId(data.empresa_id) // Assumindo hereditaridade da empresa_id
        }
    }

    async function fetchTabelas() {
        setLoading(true)
        const { data, error } = await supabase
            .from('tabelas_preco')
            .select('*')
            .eq('convenio_id', convenioId)
            .order('vigencia_inicio', { ascending: false })

        if (error) console.error(error)
        else setTabelas(data || [])

        setLoading(false)
    }

    const handleOpenModal = (tabela = null) => {
        setErrorMsg('')
        if (tabela) {
            setEditingTabela(tabela)
            setFormData({
                nome_origem: tabela.nome_origem || '',
                descricao: tabela.descricao || '',
                vigencia_inicio: tabela.vigencia_inicio || '',
                vigencia_fim: tabela.vigencia_fim || '',
                status: tabela.status || 'Rascunho'
            })
        } else {
            setEditingTabela(null)
            setFormData({
                nome_origem: '',
                descricao: '',
                vigencia_inicio: new Date().toISOString().split('T')[0],
                vigencia_fim: '',
                status: 'Rascunho'
            })
        }
        setIsModalOpen(true)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setErrorMsg('')

        // Validação básica
        if (!formData.nome_origem || !formData.vigencia_inicio) {
            setErrorMsg('Nome/Origem e Início de Vigência são obrigatórios.')
            return
        }

        if (formData.vigencia_fim && new Date(formData.vigencia_fim) < new Date(formData.vigencia_inicio)) {
            setErrorMsg('A data de fim não pode ser anterior à data de início.')
            return
        }

        // Regra Crítica: Validação de Sobreposição de Vigência
        // Mesma origem e mesmo convênio não podem ter datas conflitantes
        const hasOverlap = tabelas.some(tab => {
            if (editingTabela && tab.id === editingTabela.id) return false // Ignora a si mesmo na edição
            if (tab.nome_origem.trim().toLowerCase() !== formData.nome_origem.trim().toLowerCase()) return false

            const newStart = new Date(formData.vigencia_inicio)
            const newEnd = formData.vigencia_fim ? new Date(formData.vigencia_fim) : new Date('2099-12-31')
            const currStart = new Date(tab.vigencia_inicio)
            const currEnd = tab.vigencia_fim ? new Date(tab.vigencia_fim) : new Date('2099-12-31')

            // Condição de sobreposição: (StartA <= EndB) and (EndA >= StartB)
            return (newStart <= currEnd) && (newEnd >= currStart)
        })

        if (hasOverlap) {
            setErrorMsg(`Já existe uma tabela "${formData.nome_origem}" com vigência que conflita com as datas informadas.`)
            return
        }

        setSaving(true)
        const payload = {
            convenio_id: convenioId,
            empresa_id: empresaId,
            nome_origem: formData.nome_origem,
            descricao: formData.descricao,
            vigencia_inicio: formData.vigencia_inicio,
            vigencia_fim: formData.vigencia_fim || null,
            status: formData.status
        }

        if (editingTabela) {
            const { error } = await supabase.from('tabelas_preco').update(payload).eq('id', editingTabela.id)
            if (error) setErrorMsg('Erro ao atualizar: ' + error.message)
            else {
                setIsModalOpen(false)
                fetchTabelas()
            }
        } else {
            const { error } = await supabase.from('tabelas_preco').insert([payload])
            if (error) setErrorMsg('Erro ao cadastrar: ' + error.message)
            else {
                setIsModalOpen(false)
                fetchTabelas()
            }
        }
        setSaving(false)
    }

    const handleStatusChange = async (id, newStatus) => {
        await supabase.from('tabelas_preco').update({ status: newStatus }).eq('id', id)
        fetchTabelas()
    }

    const handleDuplicate = async (tab) => {
        if (!window.confirm(`Deseja realmente duplicar a tabela "${tab.nome_origem}" e todos os seus itens?`)) return
        setProcessingAction({ id: tab.id, action: 'Duplicando...' })

        try {
            // 1. Criar nova tabela
            const novaTabela = {
                convenio_id: tab.convenio_id,
                empresa_id: tab.empresa_id,
                nome_origem: `${tab.nome_origem} (Cópia)`,
                descricao: tab.descricao,
                vigencia_inicio: new Date().toISOString().split('T')[0],
                vigencia_fim: null,
                status: 'Rascunho'
            }

            const { data: newTabObj, error: tabErr } = await supabase.from('tabelas_preco').insert([novaTabela]).select().single()
            if (tabErr) throw tabErr

            // 2. Buscar itens da antiga
            const { data: itens, error: itensErr } = await supabase.from('tabelas_preco_itens').select('*').eq('tabela_preco_id', tab.id)
            if (itensErr) throw itensErr

            // 3. Inserir itens na nova (em lotes)
            if (itens && itens.length > 0) {
                const payloads = itens.map(i => ({
                    tabela_preco_id: newTabObj.id,
                    codigo: i.codigo,
                    descricao: i.descricao,
                    valor: i.valor
                }))

                const chunkSize = 500;
                for (let i = 0; i < payloads.length; i += chunkSize) {
                    const chunk = payloads.slice(i, i + chunkSize);
                    const { error: insertErr } = await supabase.from('tabelas_preco_itens').insert(chunk)
                    if (insertErr) console.error("Erro ao inserir lote", insertErr)
                }
            }
            fetchTabelas()
        } catch (err) {
            alert('Erro ao duplicar: ' + err.message)
        } finally {
            setProcessingAction({ id: null, action: '' })
        }
    }

    const handleDelete = async (tab) => {
        if (!window.confirm(`ATENÇÃO: Deseja EXCLUIR permanentemente a tabela "${tab.nome_origem}" e todos os seus preços? Esta ação não pode ser desfeita.`)) return
        setProcessingAction({ id: tab.id, action: 'Excluindo...' })
        try {
            const { error } = await supabase.from('tabelas_preco').delete().eq('id', tab.id)
            if (error) throw error
            fetchTabelas()
        } catch (err) {
            alert('Erro ao excluir: ' + err.message)
        } finally {
            setProcessingAction({ id: null, action: '' })
        }
    }

    if (selectedTabelaId) {
        return <TabelasItens tabelaId={selectedTabelaId} convenioNome={convenioNome} onBack={() => setSelectedTabelaId(null)} />
    }

    return (
        <div className="space-y-6 relative">
            <div className="flex items-center space-x-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                        <span>Tabelas de Preço</span>
                    </h2>
                    <p className="text-slate-400 text-sm">Convênio: <strong className="text-blue-400">{convenioNome}</strong></p>
                </div>
                <div className="ml-auto">
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        <Plus size={20} />
                        <span>Nova Tabela</span>
                    </button>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Carregando tabelas...</div>
                ) : tabelas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium text-white mb-2">Nenhuma tabela cadastrada</p>
                        <p className="text-sm max-w-sm">Adicione uma tabela (como CBHPM, AMB, TUSS) para começar a calcular os honorários cirúrgicos neste convênio.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-700/50 text-slate-300 text-sm uppercase">
                                <th className="px-6 py-4 font-semibold">Tabela / Origem</th>
                                <th className="px-6 py-4 font-semibold">Vigência</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Itens</th>
                                <th className="px-6 py-4 font-semibold text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {tabelas.map((tab) => (
                                <tr key={tab.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-white font-bold">{tab.nome_origem}</div>
                                        <div className="text-slate-400 text-xs truncate max-w-[200px]">{tab.descricao || 'Sem descrição'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2 text-slate-300">
                                            <Calendar size={14} className="text-slate-500" />
                                            <span className="text-sm">
                                                {new Date(tab.vigencia_inicio).toLocaleDateString()}
                                                {' a '}
                                                {tab.vigencia_fim ? new Date(tab.vigencia_fim).toLocaleDateString() : 'Atual'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${tab.status === 'Ativa' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                            tab.status === 'Arquivada' ? 'bg-slate-700 text-slate-400 border border-slate-600' :
                                                'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                            }`}>
                                            {tab.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-sm">
                                        <button
                                            onClick={() => setSelectedTabelaId(tab.id)}
                                            className="text-blue-500 hover:text-blue-400 underline decoration-blue-500/30 underline-offset-4"
                                        >
                                            Gerenciar Itens
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                                        {processingAction.id === tab.id ? (
                                            <div className="inline-flex items-center space-x-2 text-blue-400 text-sm">
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>{processingAction.action}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <button onClick={() => handleOpenModal(tab)} className="text-slate-400 hover:text-blue-400 transition-colors" title="Editar">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDuplicate(tab)} className="text-slate-400 hover:text-emerald-400 transition-colors" title="Duplicar Tabela (+ Itens)">
                                                    <Copy size={16} />
                                                </button>
                                                {tab.status !== 'Arquivada' && (
                                                    <button onClick={() => handleStatusChange(tab.id, 'Arquivada')} className="text-slate-400 hover:text-amber-400 transition-colors" title="Arquivar">
                                                        <Archive size={16} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(tab)} className="text-slate-400 hover:text-red-400 transition-colors" title="Excluir Definitivamente">
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal Nova/Editar Tabela */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 flex flex-col max-h-full">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
                            <h3 className="text-xl font-bold text-white">
                                {editingTabela ? 'Editar Tabela de Preço' : 'Nova Tabela de Preço'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {errorMsg && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-3 text-red-500">
                                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                    <span className="text-sm font-medium">{errorMsg}</span>
                                </div>
                            )}

                            <form id="tabelaForm" onSubmit={handleSave} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Nome/Origem da Tabela *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: CBHPM 2022, AMB 92, TUSS"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        value={formData.nome_origem}
                                        onChange={e => setFormData({ ...formData, nome_origem: e.target.value })}
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">Identificador único para aplicar regras (ex: não sobrepor vigências).</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Início da Vigência *</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            value={formData.vigencia_inicio}
                                            onChange={e => setFormData({ ...formData, vigencia_inicio: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Fim da Vigência</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            value={formData.vigencia_fim}
                                            onChange={e => setFormData({ ...formData, vigencia_fim: e.target.value })}
                                        />
                                        <p className="text-[11px] text-slate-500 mt-1">Deixe em branco se for a tabela atual vigente.</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="Rascunho">Rascunho (Em edição)</option>
                                        <option value="Ativa">Ativa (Aplicável)</option>
                                        <option value="Arquivada">Arquivada (Histórico)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Descrição / Observações</label>
                                    <textarea
                                        rows="3"
                                        placeholder="Detalhes ou regras específicas desta tabela..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                                        value={formData.descricao}
                                        onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                    ></textarea>
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-slate-700 bg-slate-800/80 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="tabelaForm"
                                disabled={saving}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                            >
                                <Save size={18} />
                                <span>{saving ? 'Salvando...' : 'Salvar Tabela'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
