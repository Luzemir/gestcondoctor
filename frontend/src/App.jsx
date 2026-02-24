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
import {
    Users,
    Building2,
    ShieldCheck,
    LayoutDashboard,
    FilePlus,
    ClipboardList,
    LogOut,
    ChevronRight,
    BookOpen
} from 'lucide-react'

function App() {
    const [session, setSession] = useState(null)
    const [activeTab, setActiveTab] = useState('dashboard')
    const [tabKey, setTabKey] = useState(0)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [])

    if (!session) {
        return <Auth />
    }

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'medicos', label: 'Médicos', icon: Users },
        { id: 'hospitais', label: 'Hospitais', icon: Building2 },
        { id: 'convenios', label: 'Convênios', icon: ShieldCheck },
        { id: 'tabelas_ref', label: 'Tabelas Referenciais', icon: BookOpen },
        { id: 'novo_evento_medico', label: 'Procedimento Médico', icon: FilePlus, section: 'Novo Evento' },
        { id: 'eventos', label: 'Listagem de Cirurgias', icon: ClipboardList, section: 'Faturamento' },
        { id: 'faturamento', label: 'Gerar Lotes TISS', icon: ClipboardList, section: 'Faturamento' },
    ]

    return (
        <div className="flex min-h-screen bg-slate-900 text-white font-sans">
            <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-extrabold text-blue-500 italic">Gestcon<span className="text-white not-italic">Doctor</span></h1>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {menuItems.map((item) => (
                        <React.Fragment key={item.id}>
                            {item.section && <div className="pt-6 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">{item.section}</div>}
                            <button
                                onClick={() => {
                                    if (activeTab === item.id) {
                                        setTabKey(prev => prev + 1) // Força o reset do componente se já estiver na tab
                                    } else {
                                        setActiveTab(item.id)
                                        setTabKey(0)
                                    }
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all group ${activeTab === item.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <item.icon size={20} />
                                    <span className="font-medium">{item.label}</span>
                                </div>
                                {activeTab === item.id && <ChevronRight size={16} />}
                            </button>
                        </React.Fragment>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                    <div className="flex items-center space-x-3 mb-4 px-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                            {session.user.email ? session.user.email[0].toUpperCase() : '?'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold truncate">{session.user.email}</p>
                            <p className="text-[10px] text-slate-500 truncate">Operacional</p>
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

            <main className="flex-1 p-8 overflow-y-auto">
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
                {activeTab === 'medicos' && <Medicos key={tabKey} />}
                {activeTab === 'hospitais' && <Hospitais key={tabKey} />}
                {activeTab === 'convenios' && <Convenios key={tabKey} />}
                {activeTab === 'tabelas_ref' && <TabelasReferenciais key={tabKey} />}
                {activeTab === 'novo_evento_medico' && <NovoEventoMedico key={tabKey} />}
                {activeTab === 'eventos' && <Eventos key={tabKey} />}
                {activeTab === 'faturamento' && <Faturamento key={tabKey} />}
            </main>
        </div>
    )
}

export default App
