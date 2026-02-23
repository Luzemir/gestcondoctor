import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Plus, Edit2, Archive, Users, Save, X, AlertCircle } from 'lucide-react'

export default function Medicos() {
    const [medicos, setMedicos] = useState([])
    const [loading, setLoading] = useState(true)

    // Form/Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingMedico, setEditingMedico] = useState(null)
    const [formData, setFormData] = useState({
        nome: '',
        conselho_tipo: 'CRM',
        conselho_uf: 'SP',
        conselho_numero: '',
        especialidade: '',
        email: '',
        telefone: '',
        status: 'Ativo'
    })
    const [formError, setFormError] = useState('')
    const [saving, setSaving] = useState(false)

    // Session state
    const [empresaId, setEmpresaId] = useState(null)

    useEffect(() => {
        fetchMedicos()
    }, [])

    async function fetchMedicos() {
        setLoading(true)
        const { data, error } = await supabase
            .from('medicos')
            .select('*')
            .order('nome', { ascending: true })

        if (error) {
            console.error('Erro ao buscar médicos:', error)
        } else {
            setMedicos(data || [])
        }
        setLoading(false)
    }

    const handleOpenModal = (medico = null) => {
        setFormError('')
        if (medico) {
            setEditingMedico(medico)
            setFormData({
                nome: medico.nome || '',
                conselho_tipo: medico.conselho_tipo || 'CRM',
                conselho_uf: medico.conselho_uf || 'SP',
                conselho_numero: medico.conselho_numero || '',
                especialidade: medico.especialidade || '',
                email: medico.email || '',
                telefone: medico.telefone || '',
                status: medico.status || 'Ativo'
            })
        } else {
            setEditingMedico(null)
            setFormData({
                nome: '',
                conselho_tipo: 'CRM',
                conselho_uf: 'SP',
                conselho_numero: '',
                especialidade: '',
                email: '',
                telefone: '',
                status: 'Ativo'
            })
        }
        setIsModalOpen(true)
    }

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setFormError('')
        if (!formData.nome || !formData.conselho_numero) {
            setFormError('Nome e Número do Conselho são obrigatórios.')
            return
        }

        setSaving(true)
        const payload = {
            empresa_id: empresaId,
            nome: formData.nome,
            conselho_tipo: formData.conselho_tipo,
            conselho_uf: formData.conselho_uf,
            conselho_numero: formData.conselho_numero,
            especialidade: formData.especialidade,
            email: formData.email,
            telefone: formData.telefone,
            status: formData.status
        }

        if (editingMedico) {
            // Update
            const { error } = await supabase.from('medicos').update(payload).eq('id', editingMedico.id)
            if (error) setFormError('Erro ao atualizar: ' + error.message)
            else {
                setIsModalOpen(false)
                fetchMedicos()
            }
        } else {
            // Insert
            const { error } = await supabase.from('medicos').insert([payload])
            if (error) setFormError('Erro ao salvar: ' + error.message)
            else {
                setIsModalOpen(false)
                fetchMedicos()
            }
        }
        setSaving(false)
    }

    const handleArchive = async (id, currentStatus) => {
        const novoStatus = currentStatus === 'Arquivado' ? 'Ativo' : 'Arquivado'
        const { error } = await supabase.from('medicos').update({ status: novoStatus }).eq('id', id)
        if (!error) fetchMedicos()
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
                        <Users className="text-blue-500" size={32} />
                        <span>Corpo Clínico (Médicos)</span>
                    </h2>
                    <p className="text-slate-400 mt-2">Gerencie os médicos executantes que farão parte do faturamento.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/40"
                >
                    <Plus size={20} />
                    <span>Novo Médico</span>
                </button>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 font-medium">Carregando corpo clínico...</div>
                ) : medicos.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <Users size={48} className="text-slate-600 mb-4" />
                        <h3 className="text-xl font-bold text-slate-300 mb-2">Nenhum médico cadastrado</h3>
                        <p className="text-slate-500 max-w-sm mb-6">Para faturar uma produção médica, você precisa cadastrar os médicos executantes do seu grupo/clínica.</p>
                        <button onClick={() => handleOpenModal()} className="text-blue-400 hover:text-blue-300 font-medium underline">Cadastrar primeiro médico</button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-700/50 text-slate-300 text-sm uppercase tracking-wider">
                                    <th className="px-6 py-4 font-semibold">Nome do Médico</th>
                                    <th className="px-6 py-4 font-semibold">Conselho / UF</th>
                                    <th className="px-6 py-4 font-semibold">Especialidade / Contato</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                    <th className="px-6 py-4 font-semibold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {medicos.map((medico) => (
                                    <tr key={medico.id} className="hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white text-lg">{medico.nome}</div>
                                            <div className="text-slate-500 text-sm">ID: {medico.id.substring(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-2">
                                                <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs font-bold font-mono">
                                                    {medico.conselho_tipo} {medico.conselho_uf}
                                                </span>
                                                <span className="text-slate-300 font-mono">{medico.conselho_numero}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-300 mb-1">{medico.especialidade || 'Clínico Geral'}</div>
                                            <div className="text-slate-500 text-xs">
                                                {medico.telefone && <span>{medico.telefone}</span>}
                                                {medico.telefone && medico.email && <span> • </span>}
                                                {medico.email && <span>{medico.email}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${medico.status === 'Ativo' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-slate-700 text-slate-400 border border-slate-600'
                                                }`}>
                                                {medico.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-3">
                                            <button onClick={() => handleOpenModal(medico)} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-blue-400 border border-slate-700 hover:border-blue-900 transition-all opacity-0 group-hover:opacity-100" title="Editar">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleArchive(medico.id, medico.status)} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-amber-400 border border-slate-700 hover:border-amber-900 transition-all opacity-0 group-hover:opacity-100" title={medico.status === 'Arquivado' ? 'Desarquivar' : 'Arquivar'}>
                                                <Archive size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Editar/Novo */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-700 flex flex-col max-h-full">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
                            <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                                <Users className="text-blue-500" size={24} />
                                <span>{editingMedico ? 'Editar Médico' : 'Novo Médico'}</span>
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-slate-700/50 hover:bg-slate-700 rounded-full p-1.5">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {formError && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-3 text-red-500">
                                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                    <span className="text-sm font-medium">{formError}</span>
                                </div>
                            )}

                            <form id="medicoForm" onSubmit={handleSave} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-sm font-medium text-slate-300">Nome Completo do Profissional *</label>
                                        <input
                                            type="text"
                                            name="nome"
                                            required
                                            placeholder="Dr. João da Silva"
                                            value={formData.nome}
                                            onChange={handleChange}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-300">Conselho e UF *</label>
                                        <div className="flex space-x-2">
                                            <select
                                                name="conselho_tipo"
                                                value={formData.conselho_tipo}
                                                onChange={handleChange}
                                                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="CRM">CRM</option>
                                                <option value="CRMO">CRMO</option>
                                            </select>
                                            <select
                                                name="conselho_uf"
                                                value={formData.conselho_uf}
                                                onChange={handleChange}
                                                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                            >
                                                {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                                                    <option key={uf} value={uf}>{uf}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-300">Número do Conselho *</label>
                                        <input
                                            type="text"
                                            name="conselho_numero"
                                            required
                                            placeholder="Ex: 123456"
                                            value={formData.conselho_numero}
                                            onChange={handleChange}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                        />
                                    </div>

                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-sm font-medium text-slate-300">Especialidade (Opcional)</label>
                                        <input
                                            type="text"
                                            name="especialidade"
                                            placeholder="Ex: Cirurgia Geral, Anestesiologia..."
                                            value={formData.especialidade}
                                            onChange={handleChange}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-300">Email (Opcional)</label>
                                        <input
                                            type="email"
                                            name="email"
                                            placeholder="medico@clinica.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-300">Telefone (Opcional)</label>
                                        <input
                                            type="tel"
                                            name="telefone"
                                            placeholder="(11) 90000-0000"
                                            value={formData.telefone}
                                            onChange={handleChange}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-300">Status</label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="Ativo">Ativo</option>
                                            <option value="Arquivado">Arquivado</option>
                                        </select>
                                    </div>
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
                                form="medicoForm"
                                disabled={saving}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 shadow-lg shadow-blue-900/40"
                            >
                                <Save size={18} />
                                <span>{saving ? 'Registrando...' : 'Registrar Médico'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
