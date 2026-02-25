import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Building2, Save, Users, UserPlus, ShieldCheck, FileCheck, MapPin, Settings, PowerOff } from 'lucide-react'

export default function MinhaEmpresa({ userProfile }) {
    const [empresa, setEmpresa] = useState(null)
    const [usuarios, setUsuarios] = useState([])
    const [loading, setLoading] = useState(true)
    const [salvando, setSalvando] = useState(false)
    const [activeTab, setActiveTab] = useState('dados')

    // Form states
    const [formData, setFormData] = useState({
        nome: '',
        razao_social: '',
        cnpj: '',
        inscricao_municipal: '',
        telefone: '',
        email_contato: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: ''
    })

    // Novo Usuário Modal States
    const [isUsuarioModalOpen, setIsUsuarioModalOpen] = useState(false)
    const [novoUserEmail, setNovoUserEmail] = useState('')
    const [novoUserSenha, setNovoUserSenha] = useState('')
    const [novoUserRole, setNovoUserRole] = useState('operador')
    const [salvandoUsuario, setSalvandoUsuario] = useState(false)

    useEffect(() => {
        if (userProfile?.empresa_id) {
            fetchEmpresaData()
            fetchUsuarios()
        }
    }, [userProfile])

    const fetchEmpresaData = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('empresas')
            .select('*')
            .eq('id', userProfile.empresa_id)
            .single()

        if (error) {
            console.error('Erro ao buscar dados da empresa:', error)
        } else if (data) {
            setEmpresa(data)
            setFormData({
                nome: data.nome || '',
                razao_social: data.razao_social || '',
                cnpj: data.cnpj || '',
                inscricao_municipal: data.inscricao_municipal || '',
                telefone: data.telefone || '',
                email_contato: data.email_contato || '',
                cep: data.cep || '',
                logradouro: data.logradouro || '',
                numero: data.numero || '',
                complemento: data.complemento || '',
                bairro: data.bairro || '',
                cidade: data.cidade || '',
                uf: data.uf || ''
            })
        }
        setLoading(false)
    }

    const fetchUsuarios = async () => {
        const { data, error } = await supabase
            .from('perfis_usuarios')
            .select(`
                id,
                role,
                created_at,
                user_id,
                email
            `)
            .eq('empresa_id', userProfile.empresa_id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Erro ao buscar usuários:', error)
        } else {
            // Nota: Por segurança, o Supabase Auth cru de Client não expõe o e-mail facilmente nas tabelas referenciadas.
            // Para o MVP, mostraremos apenas a lista de Roles ativas ou o ID.
            // O ideal seria criar uma Edge Function ou Trigger para copiar o email do auth.users para perfis_usuarios.
            setUsuarios(data || [])
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSaveDados = async (e) => {
        e.preventDefault()
        setSalvando(true)
        const { error } = await supabase
            .from('empresas')
            .update(formData)
            .eq('id', userProfile.empresa_id)

        if (error) {
            alert('Erro ao salvar dados fiscais: ' + error.message)
        } else {
            alert('Dados da clínica atualizados com sucesso!')
            fetchEmpresaData() // reload
        }
        setSalvando(false)
    }

    const handleCreateUsuarioLocal = async (e) => {
        e.preventDefault()
        if (!novoUserEmail || !novoUserSenha) return alert('E-mail e senha são obrigatórios.')

        setSalvandoUsuario(true)
        // 1. Cria usuário no Auth do Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: novoUserEmail,
            password: novoUserSenha,
        })

        if (authError) {
            alert('Erro ao processar convite no Auth: ' + authError.message)
            setSalvandoUsuario(false)
            return
        }

        const userId = authData?.user?.id
        if (!userId) {
            alert('Operador criado, mas não foi possível recuperar a credencial de segurança. Tente novamente.')
            setSalvandoUsuario(false)
            return
        }

        // 2. Vincula com o Perfil/Empresa ATUAL
        const { error: perfilError } = await supabase.from('perfis_usuarios').insert([{
            user_id: userId,
            empresa_id: userProfile.empresa_id,
            role: novoUserRole,
            email: novoUserEmail
        }])

        if (perfilError) {
            alert('Erro ao amarrar permissões à sua clínica: ' + perfilError.message)
        } else {
            alert('Novo acesso criado com sucesso para sua clínica!')
            setIsUsuarioModalOpen(false)
            setNovoUserEmail('')
            setNovoUserSenha('')
            fetchUsuarios()
        }
        setSalvandoUsuario(false)
    }

    if (loading) {
        return <div className="text-center py-12 text-slate-400">Carregando painel de gestão...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold flex items-center gap-3">
                        <Building2 className="text-blue-500" size={32} />
                        Minha Empresa
                    </h2>
                    <p className="text-slate-400 mt-1">
                        Gerencie os dados da clínica, fiscais (NFS-e) e os acessos da sua equipe.
                    </p>
                </div>
            </div>

            {/* Menu de Abas */}
            <div className="flex space-x-2 border-b border-slate-700/50 mb-6">
                <button
                    onClick={() => setActiveTab('dados')}
                    className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'dados' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'}`}
                >
                    <Settings size={18} /> Dados Fiscais e Endereço
                </button>
                <button
                    onClick={() => setActiveTab('acessos')}
                    className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'acessos' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'}`}
                >
                    <Users size={18} /> Gestão de Acessos
                </button>
                <button
                    onClick={() => setActiveTab('nfse')}
                    className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'nfse' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-400'}`}
                >
                    <FileCheck size={18} /> Emissão NFS-e
                </button>
            </div>

            {/* ABA: DADOS FISCAIS */}
            {activeTab === 'dados' && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-700/50 bg-slate-800/50 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white flex gap-2 items-center">
                            Perfil Institucional
                        </h3>
                    </div>

                    <form onSubmit={handleSaveDados} className="p-6 space-y-8">
                        {/* Seção Básica */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">Identificação Principal</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Nome Fantasia / Clínica</label>
                                    <input type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Razão Social</label>
                                    <input type="text" name="razao_social" value={formData.razao_social} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" placeholder="Razão Sociedade Ltda" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">CNPJ</label>
                                        <input type="text" name="cnpj" value={formData.cnpj} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Inscrição Municipal</label>
                                        <input type="text" name="inscricao_municipal" value={formData.inscricao_municipal} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" placeholder="Cód Município" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">E-mail de Faturamento</label>
                                    <input type="email" name="email_contato" value={formData.email_contato} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" placeholder="faturamento@clinica.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Telefone Principal</label>
                                    <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" />
                                </div>
                            </div>
                        </div>

                        {/* Seção Endereço */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                                <MapPin size={16} /> Endereço Fiscal
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">CEP</label>
                                    <input type="text" name="cep" value={formData.cep} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Logradouro / Rua</label>
                                    <input type="text" name="logradouro" value={formData.logradouro} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Número</label>
                                    <input type="text" name="numero" value={formData.numero} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" />
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Complemento</label>
                                    <input type="text" name="complemento" value={formData.complemento} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Bairro</label>
                                    <input type="text" name="bairro" value={formData.bairro} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Cidade</label>
                                    <input type="text" name="cidade" value={formData.cidade} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">UF</label>
                                    <input type="text" name="uf" value={formData.uf} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white outline-none focus:border-blue-500 transition-colors" maxLength="2" placeholder="SP" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-700 flex justify-end">
                            <button
                                type="submit"
                                disabled={salvando}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-bold text-white transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                            >
                                <Save size={20} />
                                {salvando ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ABA: ACESSOS DA EMPRESA */}
            {activeTab === 'acessos' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
                        <div>
                            <h3 className="text-xl font-bold text-white">Equipe e Permissões</h3>
                            <p className="text-slate-400 text-sm mt-1">Conceda acessos de faturamento para seus colaboradores.</p>
                        </div>
                        <button
                            onClick={() => setIsUsuarioModalOpen(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg font-medium transition-all border border-blue-500/30"
                        >
                            <UserPlus size={18} /> Novo Operador
                        </button>
                    </div>

                    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-900/50 text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">E-mail de Login</th>
                                    <th className="px-6 py-4 font-semibold">Nível de Acesso (Role)</th>
                                    <th className="px-6 py-4 font-semibold">Data da Adição</th>
                                    <th className="px-6 py-4 font-semibold text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map(u => (
                                    <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-300">
                                            {u.email || `${u.user_id.substring(0, 8)}...${u.user_id.substring(u.user_id.length - 8)}`}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded-full ${u.role === 'master' ? 'bg-red-500/20 text-red-500' :
                                                u.role === 'admin' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {new Date(u.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-slate-600 rounded-md text-red-400 transition-colors" title="Revogar (Desintegrar MVP)">
                                                <PowerOff size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {usuarios.length === 0 && (
                                    <tr><td colSpan="4" className="text-center py-8 text-slate-500 italic">Nenhum operador além da matriz.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ABA: NFS-E (Em Breve) */}
            {activeTab === 'nfse' && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-12 text-center flex flex-col items-center justify-center">
                    <ShieldCheck size={64} className="text-amber-500/50 mb-6" />
                    <h3 className="text-2xl font-bold text-white mb-3">Módulo de Emissão Fiscal (NFS-e)</h3>
                    <p className="text-slate-400 max-w-lg mb-8">
                        Este ambiente se conectará com a Prefeitura para remessa automatizada das Notas Fiscais dos Procedimentos Cirúrgicos.
                        Será necessário enviar o arquivo de <strong>Certificado Digital A1</strong> (Extensão .PFX ou .P12) neste painel.
                    </p>
                    <div className="inline-block bg-amber-500/10 text-amber-500 border border-amber-500/20 px-6 py-3 rounded-lg font-medium">
                        🚀 Módulo em Roadmap (Breve)
                    </div>
                </div>
            )}

            {/* MODAL NOVO USUARIO LOCAL */}
            {isUsuarioModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b border-slate-700">
                            <h3 className="text-xl font-bold text-white">Adicionar Colaborador</h3>
                            <button onClick={() => setIsUsuarioModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                X
                            </button>
                        </div>
                        <form onSubmit={handleCreateUsuarioLocal} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">E-mail Corporativo *</label>
                                <input type="email" value={novoUserEmail} onChange={e => setNovoUserEmail(e.target.value)} className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Senha Provisória *</label>
                                <input type="password" value={novoUserSenha} onChange={e => setNovoUserSenha(e.target.value)} className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Nível de Acesso (Role) *</label>
                                <select value={novoUserRole} onChange={e => setNovoUserRole(e.target.value)} className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="operador">Operacional (Básico)</option>
                                    <option value="faturista">Conferente / Faturista</option>
                                    <option value="admin">Administrador Local</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsUsuarioModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-white transition-colors">Cancelar</button>
                                <button type="submit" disabled={salvandoUsuario} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium text-white transition-colors">
                                    {salvandoUsuario ? 'Enviando...' : 'Liberar Acesso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
