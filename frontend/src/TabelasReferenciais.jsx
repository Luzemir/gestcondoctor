import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { FileText, Calendar, Plus, Edit2, Archive, Trash2, Save, AlertCircle, X, ArrowLeft, BookOpen } from 'lucide-react'
import TabelasItens from './TabelasItens'

export default function TabelasReferenciais() {
    const [tabelas, setTabelas] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedTabelaId, setSelectedTabelaId] = useState(null)
    const [selectedTabelaNome, setSelectedTabelaNome] = useState('')

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTabela, setEditingTabela] = useState(null)
    const [formData, setFormData] = useState({
        nome_origem: '',
        descricao: '',
        vigencia_inicio: '',
        vigencia_fim: '',
        status: 'Ativa'
    })
    const [errorMsg, setErrorMsg] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchTabelas()
    }, [])

    async function fetchTabelas() {
        setLoading(true)
        // Tabelas referenciais são aquelas que NÃO pertencem a nenhum convênio (convenio_id is null)
        const { data, error } = await supabase
            .from('tabelas_preco')
            .select('*')
            .is('convenio_id', null)
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
                status: tabela.status || 'Ativa'
            })
        } else {
            setEditingTabela(null)
            setFormData({
                nome_origem: '',
                descricao: '',
                vigencia_inicio: new Date().toISOString().split('T')[0],
                vigencia_fim: '',
                status: 'Ativa'
            })
        }
        setIsModalOpen(true)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setErrorMsg('')

        if (!formData.nome_origem || !formData.vigencia_inicio) {
            setErrorMsg('Nome/Origem e Início de Vigência são obrigatórios.')
            return
        }

        setSaving(true)
        const payload = {
            convenio_id: null, // Critical: Forces it to be referential
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

    const handleDelete = async (tab) => {
        if (!window.confirm(`ATENÇÃO: Deseja EXCLUIR permanentemente a tabela referencial "${tab.nome_origem}" e milhares de códigos?`)) return
        try {
            await supabase.from('tabelas_preco_itens').delete().eq('tabela_preco_id', tab.id)
            await supabase.from('tabelas_preco').delete().eq('id', tab.id)
            fetchTabelas()
        } catch (err) {
            alert('Erro ao excluir: ' + err.message)
        }
    }

    if (selectedTabelaId) {
        // Renderizamos o TabelasItens reaproveitando a view, enviando o 'convenioNome' fictício
        return <TabelasItens
            tabelaId={selectedTabelaId}
            convenioNome="Base Estrutural (Mãe)"
            onBack={() => setSelectedTabelaId(null)}
        />
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
                        <BookOpen className="text-blue-500" size={32} />
                        <span>Tabelas Referenciais (Mães)</span>
                    </h2>
                    <p className="text-slate-400 mt-2">Gerencie as tabelas base do sistema, como CBHPM, AMB e TUSS, que servem de consulta para novos procedimentos.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={20} />
                    <span>Nova Tabela Referencial</span>
                </button>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Carregando tabelas referenciais...</div>
                ) : tabelas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium text-white mb-2">Nenhuma tabela referencial cadastrada</p>
                        <p className="text-sm max-w-sm">Use isso para cadastrar a CBHPM estrutural que não é vinculada a nenhum convênio específico.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-700/50 text-slate-300 text-sm uppercase">
                                <th className="px-6 py-4 font-semibold">Tabela Estrutural</th>
                                <th className="px-6 py-4 font-semibold">Vigência base</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Códigos</th>
                                <th className="px-6 py-4 font-semibold text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {tabelas.map((tab) => (
                                <tr key={tab.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-blue-400 font-bold">{tab.nome_origem}</div>
                                        <div className="text-slate-400 text-xs truncate max-w-[200px]">{tab.descricao || 'Referência do sistema'}</div>
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
                                            className="text-white bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors font-medium border border-slate-600"
                                        >
                                            Verificar Códigos
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                                        <button onClick={() => handleOpenModal(tab)} className="text-slate-400 hover:text-blue-400 transition-colors" title="Editar Tabela">
                                            <Edit2 size={16} />
                                        </button>
                                        {tab.status !== 'Arquivada' && (
                                            <button onClick={() => handleStatusChange(tab.id, 'Arquivada')} className="text-slate-400 hover:text-amber-400 transition-colors" title="Arquivar">
                                                <Archive size={16} />
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(tab)} className="text-slate-400 hover:text-red-400 transition-colors" title="Excluir Definitivamente">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal Editar Tabela Referencial */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 flex flex-col max-h-full">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
                            <h3 className="text-xl font-bold text-white">
                                {editingTabela ? 'Editar Tabela Referencial' : 'Nova Tabela Referencial'}
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
                            <form id="refTableForm" onSubmit={handleSave} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Nome/Origem da Tabela *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: CBHPM 2022"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                        value={formData.nome_origem}
                                        onChange={e => setFormData({ ...formData, nome_origem: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Início da Vigência *</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                            value={formData.vigencia_inicio}
                                            onChange={e => setFormData({ ...formData, vigencia_inicio: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Fim da Vigência</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                            value={formData.vigencia_fim}
                                            onChange={e => setFormData({ ...formData, vigencia_fim: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="Rascunho">Rascunho</option>
                                        <option value="Ativa">Ativa</option>
                                        <option value="Arquivada">Arquivada</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Descrição</label>
                                    <textarea
                                        rows="2"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 resize-none"
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
                                className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white"
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="refTableForm"
                                disabled={saving}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                            >
                                <Save size={18} />
                                <span>{saving ? 'Salvando...' : 'Salvar'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
