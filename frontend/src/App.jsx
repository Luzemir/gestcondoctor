import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Medicos from './Medicos'
import Hospitais from './Hospitais'
import Convenios from './Convenios'
import TabelasReferenciais from './TabelasReferenciais'
import NovoEventoMedico from './NovoEventoMedico'
import Eventos from './Eventos'
import Faturamento from './Faturamento'
import MasterDashboard from './MasterDashboard'
import MinhaEmpresa from './MinhaEmpresa'
import NotasFiscais from './NotasFiscais'
import GlosasRecursos from './GlosasRecursos'
import {
    Users,
    Building2,
    ShieldCheck,
    LayoutDashboard,
    FilePlus,
    ClipboardList,
    LogOut,
    ChevronRight,
    ChevronDown,
    BookOpen,
    AlertCircle,
    FileText,
    Scale
} from 'lucide-react'

function App() {
    const [session, setSession] = useState(null)
    const [userProfile, setUserProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('dashboard') // aba selecionada
    const [tabKey, setTabKey] = useState(0) // chave de refresh da aba
    const [menuAberto, setMenuAberto] = useState('Cadastros') // grupo menu aberto

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            if (session) fetchUserProfile(session.user.id)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session)

            // Tratamento especial para o link de REDEFINIÇÃO DE SENHA "PASSWORD_RECOVERY" enviado por e-mail
            if (_event === 'PASSWORD_RECOVERY') {
                const newPassword = prompt("Digite sua NOVA senha (mínimo 6 caracteres):")
                if (newPassword && newPassword.length >= 6) {
                    const { error } = await supabase.auth.updateUser({ password: newPassword })
                    if (error) alert("Erro ao atualizar senha: " + error.message)
                    else alert("Senha atualizada com sucesso! Você já está logado.")
                } else {
                    alert("A senha deve ter pelo menos 6 caracteres. Atualização cancelada, solicite novo link.")
                }
            }

            if (session) {
                fetchUserProfile(session.user.id)
            } else {
                setUserProfile(null)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const fetchUserProfile = async (userId) => {
        const { data, error } = await supabase
            .from('perfis_usuarios')
            .select(`
                role, 
                empresa_id,
                empresas (nome)
            `)
            .eq('user_id', userId)
            .single()

        if (error) {
            console.error('Erro ao buscar perfil do usuário:', error)
            // Se não encontrou perfil, criar perfil zerado de proteção
            setUserProfile({ role: 'sem_perfil' })
        } else {
            setUserProfile(data)
            // Se for master e logar, jogar para o dashboard master automaticamente.
            if (data.role === 'master' && activeTab === 'dashboard') {
                setActiveTab('master_dashboard')
            }
        }
    }

    if (!session) {
        return <Auth />
    }

    if (!userProfile) {
        return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">Carregando perfil...</div>
    }

    if (userProfile.role === 'sem_perfil') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
                <AlertCircle className="text-red-500 mb-4" size={48} />
                <h2 className="text-2xl font-bold mb-2">Usuário sem vínculo!</h2>
                <p className="text-slate-400 mb-6">Seu usuário não está vinculado a nenhuma empresa ativa.</p>
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                >
                    Fazer Logout
                </button>
            </div>
        )
    }

    const isMaster = userProfile.role === 'master'

    const menuItems = []

    if (isMaster) {
        menuItems.push({ id: 'master_dashboard', label: 'Painel Master', icon: ShieldCheck, section: 'Administração Global' })
    }

    // Estrutura de Menu Agrupado
    menuItems.push(
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Cadastros' },
        { id: 'medicos', label: 'Médicos', icon: Users, section: 'Cadastros' },
        { id: 'hospitais', label: 'Hospitais', icon: Building2, section: 'Cadastros' },
        { id: 'convenios', label: 'Convênios', icon: ShieldCheck, section: 'Cadastros' },
        { id: 'tabelas_ref', label: 'Tabelas Referenciais', icon: BookOpen, section: 'Cadastros' },

        { id: 'novo_evento_medico', label: 'Procedimento Médico', icon: FilePlus, section: 'Lançamentos' },

        { id: 'eventos', label: 'Listagem de Cirurgias', icon: ClipboardList, section: 'Faturamento' },
        { id: 'faturamento', label: 'Gerar Lotes TISS', icon: ClipboardList, section: 'Faturamento' },
        { id: 'notas_fiscais', label: 'Régua de Recebíveis', icon: FileText, section: 'Faturamento' },
        { id: 'recursos', label: 'Glosas e Recursos', icon: Scale, section: 'Faturamento' },

        { id: 'minha_empresa', label: 'Minha Clínica', icon: Building2, section: 'Configurações' }
    )

    const groupedMenu = menuItems.reduce((acc, item) => {
        if (!acc[item.section]) acc[item.section] = [];
        acc[item.section].push(item);
        return acc;
    }, {});

    return (
        <div className="flex min-h-screen bg-slate-900 text-white font-sans">
            <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-extrabold text-blue-500 italic">Gestcon<span className="text-white not-italic">Doctor</span></h1>
                    {userProfile?.empresas?.nome && (
                        <div className="mt-3 px-3 py-1 bg-slate-700/50 border border-slate-600 rounded-md inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
                            <Building2 size={12} className="text-blue-400" />
                            {userProfile.empresas.nome}
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto w-full scrollbar-thin scrollbar-thumb-slate-700">
                    {Object.entries(groupedMenu).map(([section, items]) => (
                        <div key={section} className="mb-2">
                            {/* Botão Grupo */}
                            <button
                                onClick={() => setMenuAberto(menuAberto === section ? null : section)}
                                className="w-full flex items-center justify-between px-2 py-3 text-xs font-bold text-slate-500 hover:text-slate-300 uppercase tracking-wider transition-colors"
                            >
                                <span>{section}</span>
                                {menuAberto === section ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>

                            {/* Itens do Grupo Animados */}
                            <div className={`overflow-hidden transition-all duration-300 ${menuAberto === section ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="space-y-1 mt-1 pl-3 border-l-2 border-slate-700/50 ml-2">
                                    {items.map((item) => {
                                        const isActive = activeTab === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    if (isActive) {
                                                        setTabKey(prev => prev + 1)
                                                    } else {
                                                        setActiveTab(item.id)
                                                        setTabKey(0)
                                                    }
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all group ${isActive
                                                    ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30'
                                                    : 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
                                                    }`}
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <item.icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'} />
                                                    <span className={isActive ? 'font-bold' : 'font-medium'}>{item.label}</span>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                    <div className="flex items-center space-x-3 mb-4 px-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isMaster ? 'bg-red-500' : 'bg-blue-500'}`}>
                            {session.user.email ? session.user.email[0].toUpperCase() : '?'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold truncate">{session.user.email}</p>
                            <p className={`text-[10px] font-bold uppercase truncate ${isMaster ? 'text-red-400' : 'text-slate-500'}`}>
                                {userProfile.role}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => supabase.auth.signOut()}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                        <LogOut size={18} />
                        <span className="font-medium">Encerrar Sessão</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 p-8 overflow-y-auto relative">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8">
                        <h2 className="text-3xl font-bold">Olá, Bem-vindo de volta!</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {[
                                { label: 'Eventos Pendentes', value: '24', color: 'text-amber-500' },
                                { label: 'Produção Mensal', value: 'R$ 45k', color: 'text-green-500' },
                                { label: 'Lotes Enviados', value: '3', color: 'text-blue-500' },
                                { label: 'Glosas Ativas', value: '12', color: 'text-red-500' },
                            ].map((stat, i) => (
                                <div key={i} className="p-6 bg-slate-800 rounded-xl border border-slate-700 shadow-xl">
                                    <p className="text-slate-400 text-sm font-medium mb-1">{stat.label}</p>
                                    <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTab === 'master_dashboard' && <MasterDashboard key={tabKey} />}
                {activeTab === 'medicos' && <Medicos key={tabKey} />}
                {activeTab === 'hospitais' && <Hospitais key={tabKey} />}
                {activeTab === 'convenios' && <Convenios key={tabKey} />}
                {activeTab === 'tabelas_ref' && <TabelasReferenciais key={tabKey} />}
                {activeTab === 'novo_evento_medico' && <NovoEventoMedico key={tabKey} />}
                {activeTab === 'eventos' && <Eventos key={tabKey} />}
                {activeTab === 'faturamento' && <Faturamento key={tabKey} initialTab="fila" />}
                {activeTab === 'notas_fiscais' && <NotasFiscais key={tabKey} />}
                {activeTab === 'recursos' && <GlosasRecursos key={tabKey} />}
                {activeTab === 'minha_empresa' && <MinhaEmpresa key={tabKey} userProfile={userProfile} />}
            </main>
        </div>
    )
}

export default App
