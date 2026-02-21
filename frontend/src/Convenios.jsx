import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { ShieldCheck, Files, Plus, Edit2, Archive, X, Save, AlertCircle } from 'lucide-react'
import TabelasPreco from './TabelasPreco'

export default function Convenios() {
    const [convenios, setConvenios] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedConvenioId, setSelectedConvenioId] = useState(null)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingConvenio, setEditingConvenio] = useState(null)
    const [formData, setFormData] = useState({
        nome: '',
        observacoes: '',
        status: 'Ativo'
    })
    const [errorMsg, setErrorMsg] = useState('')
    const [saving, setSaving] = useState(false)

    // Auth State
    const [empresaId, setEmpresaId] = useState(null)

    useEffect(() => {
        // In a real multi-tenant app, you'd fetch the user's empresa_id from their profile
        // For MVP, we'll proceed without it if it's not strictly enforced, or grab from session if available
        fetchConvenios()
    }, [])

    async function fetchConvenios() {
        setLoading(true)
        const { data, error } = await supabase
            .from('convenios')
            .select('*')
            .order('nome', { ascending: true })

        if (error) {
            console.error(error)
        } else {
            setConvenios(data || [])
        }
        setLoading(false)
    }

    const handleOpenModal = (convenio = null) => {
        setErrorMsg('')
        if (convenio) {
            setEditingConvenio(convenio)
            setFormData({
                nome: convenio.nome || '',
                observacoes: convenio.observacoes || '',
                status: convenio.status || 'Ativo'
            })
        } else {
            setEditingConvenio(null)
            setFormData({
                nome: '',
                observacoes: '',
                status: 'Ativo'
            })
        }
        setIsModalOpen(true)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setErrorMsg('')

        if (!formData.nome.trim()) {
            setErrorMsg('O nome do convênio é obrigatório.')
            return
        }

        setSaving(true)
        const payload = {
            nome: formData.nome,
            observacoes: formData.observacoes,
            status: formData.status
        }

        // if (empresaId) payload.empresa_id = empresaId

        if (editingConvenio) {
            const { error } = await supabase.from('convenios').update(payload).eq('id', editingConvenio.id)
            if (error) setErrorMsg('Erro ao atualizar: ' + error.message)
            else {
                setIsModalOpen(false)
                fetchConvenios()
            }
        } else {
            const { error } = await supabase.from('convenios').insert([payload])
            if (error) setErrorMsg('Erro ao cadastrar: ' + error.message)
            else {
                setIsModalOpen(false)
                fetchConvenios()
            }
        }
        setSaving(false)
    }

    if (selectedConvenioId) {
        return <TabelasPreco convenioId={selectedConvenioId} onBack={() => setSelectedConvenioId(null)} />
    }

    return (
        <div className="space-y-6 relative">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Convênios</h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={20} />
                    <span>Novo Convênio</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full p-8 text-center text-slate-400">Carregando convênios...</div>
                ) : convenios.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-slate-800 rounded-xl border border-slate-700">
                        <ShieldCheck size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium text-white mb-2">Nenhum convênio cadastrado</p>
                        <p className="text-sm max-w-sm mb-6">Cadastre o primeiro convênio para começar a configurar as tabelas de preços.</p>
                        <button
                            onClick={() => handleOpenModal()}
                            className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-colors font-medium"
                        >
                            Começar Agora
                        </button>
                    </div>
                ) : (
                    convenios.map((convenio) => (
                        <div key={convenio.id} className="p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-blue-500 transition-all shadow-lg group relative overflow-hidden flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                                    <ShieldCheck size={24} />
                                </div>
                                <div className="flex flex-col items-end space-y-2">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${convenio.status === 'Ativo' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}>
                                        {convenio.status}
                                    </span>
                                    <button
                                        onClick={() => handleOpenModal(convenio)}
                                        className="text-slate-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                        title="Editar Convênio"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2">{convenio.nome}</h3>
                            <p className="text-slate-400 text-sm mb-6 line-clamp-2 flex-grow">{convenio.observacoes || 'Sem observações.'}</p>

                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700">
                                <button
                                    onClick={() => setSelectedConvenioId(convenio.id)}
                                    className="flex items-center space-x-1 text-sm text-blue-500 hover:text-blue-400 font-bold transition-colors w-full justify-center bg-blue-500/5 hover:bg-blue-500/10 py-2 rounded-lg"
                                >
                                    <Files size={16} />
                                    <span>Gerenciar Tabelas & Valores</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Novo/Editar Convênio */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700 flex flex-col max-h-full">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
                            <h3 className="text-xl font-bold text-white">
                                {editingConvenio ? 'Editar Convênio' : 'Novo Convênio'}
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

                            <form id="convenioForm" onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Nome do Convênio *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: SulAmérica Saúde, Bradesco..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        value={formData.nome}
                                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="Ativo">Ativo</option>
                                        <option value="Inativo">Inativo</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Observações Gerais</label>
                                    <textarea
                                        rows="3"
                                        placeholder="Regras gerais do convênio..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                                        value={formData.observacoes}
                                        onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
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
                                form="convenioForm"
                                disabled={saving}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                            >
                                <Save size={18} />
                                <span>{saving ? 'Salvando...' : 'Salvar Convênio'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
