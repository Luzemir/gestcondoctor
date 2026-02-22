import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Plus, Edit2, Archive, Building2, Save, X, AlertCircle } from 'lucide-react'

export default function Hospitais() {
    const [hospitais, setHospitais] = useState([])
    const [loading, setLoading] = useState(true)

    // Form/Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingHospital, setEditingHospital] = useState(null)
    const [formData, setFormData] = useState({
        razao_social: '',
        nome_fantasia: '',
        cnpj: '',
        cidade: '',
        uf: 'SP',
        status: 'Ativo'
    })
    const [formError, setFormError] = useState('')
    const [saving, setSaving] = useState(false)

    // Session state
    const [empresaId, setEmpresaId] = useState(null)

    useEffect(() => {
        fetchSessionAndHospitais()
    }, [])

    async function fetchSessionAndHospitais() {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            const { data: userData } = await supabase
                .from('usuarios_empresas')
                .select('empresa_id')
                .eq('email', session.user.email)
                .single()

            if (userData) {
                setEmpresaId(userData.empresa_id)
                fetchHospitais(userData.empresa_id)
            }
        }
    }

    async function fetchHospitais(empId) {
        if (!empId) return
        const { data, error } = await supabase
            .from('hospitais')
            .select('*')
            .eq('empresa_id', empId)
            .order('nome_fantasia', { ascending: true })

        if (error) {
            console.error('Erro ao buscar hospitais:', error)
        } else {
            setHospitais(data || [])
        }
        setLoading(false)
    }

    const handleOpenModal = (hospital = null) => {
        setFormError('')
        if (hospital) {
            setEditingHospital(hospital)
            setFormData({
                razao_social: hospital.razao_social || '',
                nome_fantasia: hospital.nome_fantasia || '',
                cnpj: hospital.cnpj || '',
                cidade: hospital.cidade || '',
                uf: hospital.uf || 'SP',
                status: hospital.status || 'Ativo'
            })
        } else {
            setEditingHospital(null)
            setFormData({
                razao_social: '',
                nome_fantasia: '',
                cnpj: '',
                cidade: '',
                uf: 'SP',
                status: 'Ativo'
            })
        }
        setIsModalOpen(true)
    }

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const formatCNPJ = (value) => {
        return value.replace(/\D/g, '')
            .replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .substring(0, 18);
    }

    const handleCNPJChange = (e) => {
        setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setFormError('')
        if (!formData.nome_fantasia) {
            setFormError('O Nome Fantasia é obrigatório.')
            return
        }

        setSaving(true)
        const payload = {
            empresa_id: empresaId,
            razao_social: formData.razao_social,
            nome_fantasia: formData.nome_fantasia,
            cnpj: formData.cnpj,
            cidade: formData.cidade,
            uf: formData.uf,
            status: formData.status
        }

        if (editingHospital) {
            const { error } = await supabase.from('hospitais').update(payload).eq('id', editingHospital.id)
            if (error) setFormError('Erro ao atualizar: ' + error.message)
            else {
                setIsModalOpen(false)
                fetchHospitais(empresaId)
            }
        } else {
            const { error } = await supabase.from('hospitais').insert([payload])
            if (error) setFormError('Erro ao salvar: ' + error.message)
            else {
                setIsModalOpen(false)
                fetchHospitais(empresaId)
            }
        }
        setSaving(false)
    }

    const handleArchive = async (id, currentStatus) => {
        const novoStatus = currentStatus === 'Arquivado' ? 'Ativo' : 'Arquivado'
        const { error } = await supabase.from('hospitais').update({ status: novoStatus }).eq('id', id)
        if (!error) fetchHospitais(empresaId)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
                        <Building2 className="text-blue-500" size={32} />
                        <span>Hospitais</span>
                    </h2>
                    <p className="text-slate-400 mt-2">Gerencie os hospitais onde os procedimentos médicos são realizados.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/40"
                >
                    <Plus size={20} />
                    <span>Novo Hospital</span>
                </button>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 font-medium">Carregando hospitais...</div>
                ) : hospitais.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <Building2 size={48} className="text-slate-600 mb-4" />
                        <h3 className="text-xl font-bold text-slate-300 mb-2">Nenhum hospital cadastrado</h3>
                        <p className="text-slate-500 max-w-sm mb-6">Cadastre os Hospitais (Locais de Atendimento) onde a equipe atua para vincular aos eventos cirúrgicos.</p>
                        <button onClick={() => handleOpenModal()} className="text-blue-400 hover:text-blue-300 font-medium underline">Cadastrar primeiro hospital</button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-700/50 text-slate-300 text-sm uppercase tracking-wider">
                                    <th className="px-6 py-4 font-semibold">Hospital / Fantasia</th>
                                    <th className="px-6 py-4 font-semibold">Razão / CNPJ</th>
                                    <th className="px-6 py-4 font-semibold">Localidade</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                    <th className="px-6 py-4 font-semibold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {hospitais.map((hosp) => (
                                    <tr key={hosp.id} className="hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white text-lg">{hosp.nome_fantasia}</div>
                                            <div className="text-slate-500 text-sm">ID: {hosp.id.substring(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-300 text-sm mb-1">{hosp.razao_social || 'Não informada'}</div>
                                            <div className="text-slate-400 font-mono text-xs">{hosp.cnpj || 'Sem CNPJ'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-300">
                                                {hosp.cidade ? `${hosp.cidade} - ${hosp.uf}` : 'Não informada'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${hosp.status === 'Ativo' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-slate-700 text-slate-400 border border-slate-600'
                                                }`}>
                                                {hosp.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-3">
                                            <button onClick={() => handleOpenModal(hosp)} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-blue-400 border border-slate-700 hover:border-blue-900 transition-all opacity-0 group-hover:opacity-100" title="Editar">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleArchive(hosp.id, hosp.status)} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-amber-400 border border-slate-700 hover:border-amber-900 transition-all opacity-0 group-hover:opacity-100" title={hosp.status === 'Arquivado' ? 'Desarquivar' : 'Arquivar'}>
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
                                <Building2 className="text-blue-500" size={24} />
                                <span>{editingHospital ? 'Editar Hospital' : 'Novo Hospital'}</span>
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

                            <form id="hospitalForm" onSubmit={handleSave} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-sm font-medium text-slate-300">Nome Fantasia do Hospital *</label>
                                        <input
                                            type="text"
                                            name="nome_fantasia"
                                            required
                                            placeholder="Ex: Hospital Santa Casa"
                                            value={formData.nome_fantasia}
                                            onChange={handleChange}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-bold"
                                        />
                                    </div>

                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-sm font-medium text-slate-300">Razão Social (Opcional)</label>
                                        <input
                                            type="text"
                                            name="razao_social"
                                            placeholder="Irmandade da Santa Casa de Ensino..."
                                            value={formData.razao_social}
                                            onChange={handleChange}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-300">CNPJ (Opcional)</label>
                                        <input
                                            type="text"
                                            name="cnpj"
                                            placeholder="00.000.000/0000-00"
                                            value={formData.cnpj}
                                            onChange={handleCNPJChange}
                                            maxLength="18"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-300">UF / Localidade</label>
                                        <div className="flex space-x-2">
                                            <select
                                                name="uf"
                                                value={formData.uf}
                                                onChange={handleChange}
                                                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                            >
                                                {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                                                    <option key={uf} value={uf}>{uf}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                name="cidade"
                                                placeholder="S. José dos Campos"
                                                value={formData.cidade}
                                                onChange={handleChange}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all"
                                            />
                                        </div>
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
                                form="hospitalForm"
                                disabled={saving}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 shadow-lg shadow-blue-900/40"
                            >
                                <Save size={18} />
                                <span>{saving ? 'Registrando...' : 'Registrar Hospital'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
