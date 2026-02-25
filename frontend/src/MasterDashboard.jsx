import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Plus, Building2, UserPlus, Search, RefreshCw, PowerOff, ShieldCheck, X, UserCog } from 'lucide-react'

export default function MasterDashboard() {
    const [empresas, setEmpresas] = useState([])
    const [loading, setLoading] = useState(true)

    // Estados do Modal de Nova Empresa
    const [isNovaEmpresaModalOpen, setIsNovaEmpresaModalOpen] = useState(false)
    const [novaEmpresaNome, setNovaEmpresaNome] = useState('')
    const [novaEmpresaCnpj, setNovaEmpresaCnpj] = useState('')
    const [salvandoEmpresa, setSalvandoEmpresa] = useState(false)

    // Estados do Modal de Usuários da Empresa
    const [isUsuarioModalOpen, setIsUsuarioModalOpen] = useState(false)
    const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState(null)
    const [novoUserEmail, setNovoUserEmail] = useState('')
    const [novoUserSenha, setNovoUserSenha] = useState('')
    const [novoUserRole, setNovoUserRole] = useState('operador')
    const [salvandoUsuario, setSalvandoUsuario] = useState(false)
    const fetchEmpresas = async () => {
        setLoading(true)
        const { data, error } = await supabase.from('empresas').select('*').order('nome')
        if (error) {
            console.error('Erro ao buscar empresas', error)
            alert('Não foi possível carregar as empresas.')
        } else {
            setEmpresas(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchEmpresas()
    }, [])

    const handleCreateEmpresa = async (e) => {
        e.preventDefault()
        if (!novaEmpresaNome) return alert('O nome da empresa é obrigatório.')

        setSalvandoEmpresa(true)
        const { error } = await supabase.from('empresas').insert([{
            nome: novaEmpresaNome,
            cnpj: novaEmpresaCnpj || null,
            status: 'Ativa'
        }])

        if (error) {
            console.error(error)
            alert('Erro ao criar empresa: ' + error.message)
        } else {
            setIsNovaEmpresaModalOpen(false)
            setNovaEmpresaNome('')
            setNovaEmpresaCnpj('')
            fetchEmpresas()
        }
        setSalvandoEmpresa(false)
    }

    const toggleStatusEmpresa = async (empresa) => {
        const novoStatus = empresa.status === 'Ativa' ? 'Inativa' : 'Ativa'
        if (!window.confirm(`Tem certeza que deseja mudar a empresa "${empresa.nome}" para ${novoStatus}?`)) return

        const { error } = await supabase.from('empresas').update({ status: novoStatus }).eq('id', empresa.id)
        if (error) {
            alert('Erro ao alterar status: ' + error.message)
        } else {
            fetchEmpresas()
        }
    }

    const handleOpenUsuarioModal = (empresaId) => {
        setEmpresaSelecionadaId(empresaId)
        setNovoUserEmail('')
        setNovoUserSenha('')
        setNovoUserRole('operador')
        setIsUsuarioModalOpen(true)
    }

    const handleCreateUsuario = async (e) => {
        e.preventDefault()
        if (!novoUserEmail || !novoUserSenha) return alert('E-mail e senha são obrigatórios.')

        setSalvandoUsuario(true)
        // 1. Cria usuário no Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: novoUserEmail,
            password: novoUserSenha,
        })

        if (authError) {
            alert('Erro ao criar usuário no Auth: ' + authError.message)
            setSalvandoUsuario(false)
            return
        }

        const userId = authData?.user?.id
        if (!userId) {
            alert('Usuário criado, mas não foi possível recuperar o ID.')
            setSalvandoUsuario(false)
            return
        }

        // 2. Vincula com o Perfil/Empresa
        const { error: perfilError } = await supabase.from('perfis_usuarios').insert([{
            user_id: userId,
            empresa_id: empresaSelecionadaId,
            role: novoUserRole
        }])

        if (perfilError) {
            alert('Erro ao vincular perfil de usuário à empresa: ' + perfilError.message)
        } else {
            alert('Usuário criado e vinculado com sucesso!')
            setIsUsuarioModalOpen(false)
        }
        setSalvandoUsuario(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold flex items-center gap-3">
                        <ShieldCheck className="text-red-500" size={32} />
                        Painel Master
                    </h2>
                    <p className="text-slate-400 mt-1">Gestão de Multi-Tenancy (Empresas e Perfis)</p>
                </div>
                <button
                    onClick={fetchEmpresas}
                    className="p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-slate-300"
                >
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CRIAR EMPRESA CARD */}
                <div className="p-6 bg-slate-800 rounded-xl border border-slate-700 shadow-xl col-span-1 flex flex-col items-center justify-center text-center">
                    <Building2 size={48} className="text-blue-500 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Nova Empresa</h3>
                    <p className="text-sm text-slate-400 mb-6">Cadastre um novo cliente (Tenant) na plataforma.</p>
                    <button
                        onClick={() => setIsNovaEmpresaModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors w-full justify-center"
                    >
                        <Plus size={20} /> Cadastrar
                    </button>
                </div>

                <div className="col-span-1 md:col-span-2 bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Empresas Cadastradas ({empresas.length})</h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar empresa..."
                                className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none w-64"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-900/50 text-slate-400 p-2">
                                <tr>
                                    <th className="px-4 py-3 font-semibold rounded-tl-lg rounded-bl-lg">Nome</th>
                                    <th className="px-4 py-3 font-semibold">CNPJ</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold rounded-tr-lg rounded-br-lg text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td colSpan="4" className="text-center py-6 text-slate-500">Carregando empresas...</td>
                                    </tr>
                                )}
                                {!loading && empresas.map(emp => (
                                    <tr key={emp.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors group">
                                        <td className="px-4 py-4 font-medium text-white">{emp.nome}</td>
                                        <td className="px-4 py-4">{emp.cnpj || '—'}</td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${emp.status === 'Ativa' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {emp.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right opacity-50 group-hover:opacity-100 transition-opacity">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenUsuarioModal(emp.id)}
                                                    className="p-2 hover:bg-slate-600 rounded-md text-blue-400 transition-colors"
                                                    title="Novo Usuário para esta Empresa"
                                                    disabled={emp.status !== 'Ativa'}
                                                >
                                                    <UserPlus size={16} />
                                                </button>
                                                <button
                                                    onClick={() => toggleStatusEmpresa(emp)}
                                                    className="p-2 hover:bg-slate-600 rounded-md text-red-400 transition-colors"
                                                    title={emp.status === 'Ativa' ? 'Inativar Empresa' : 'Reativar Empresa'}
                                                >
                                                    <PowerOff size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL NOVA EMPRESA */}
            {isNovaEmpresaModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b border-slate-700">
                            <h3 className="text-xl font-bold text-white">Cadastrar Empresa</h3>
                            <button onClick={() => setIsNovaEmpresaModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateEmpresa} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Empresa *</label>
                                <input
                                    type="text"
                                    value={novaEmpresaNome}
                                    onChange={e => setNovaEmpresaNome(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">CNPJ</label>
                                <input
                                    type="text"
                                    value={novaEmpresaCnpj}
                                    onChange={e => setNovaEmpresaCnpj(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsNovaEmpresaModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={salvandoEmpresa}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium text-white transition-colors"
                                >
                                    {salvandoEmpresa ? 'Salvando...' : 'Salvar Empresa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* MODAL NOVO USUÁRIO */}
            {isUsuarioModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b border-slate-700">
                            <h3 className="text-xl font-bold text-white flex gap-2 items-center"><UserCog size={24} className="text-blue-500" /> Criar Acesso</h3>
                            <button onClick={() => setIsUsuarioModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateUsuario} className="p-6 space-y-4">
                            <div className="bg-blue-900/20 text-blue-400 px-4 py-3 rounded-lg border border-blue-900/50 mb-4 text-sm">
                                Este usuário já nascerá vinculado a esta empresa.
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">E-mail de Login *</label>
                                <input
                                    type="email"
                                    value={novoUserEmail}
                                    onChange={e => setNovoUserEmail(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Senha (Mínimo 6) *</label>
                                <input
                                    type="password"
                                    value={novoUserSenha}
                                    onChange={e => setNovoUserSenha(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Nível de Permissão (Role) *</label>
                                <select
                                    value={novoUserRole}
                                    onChange={e => setNovoUserRole(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="operador">Operacional</option>
                                    <option value="conferente">Conferente / Faturista</option>
                                    <option value="financeiro">Financeiro / Gestão</option>
                                    <option value="master">Painel Master Geral</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsUsuarioModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={salvandoUsuario}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium text-white transition-colors"
                                >
                                    {salvandoUsuario ? 'Criando...' : 'Criar e Vincular'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
