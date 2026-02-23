import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { ClipboardList, Search, Edit2, Trash2, Filter, Eye } from 'lucide-react'

export default function Eventos() {
    const [eventos, setEventos] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Lookup caches para exibição amigável
    const [conveniosCache, setConveniosCache] = useState({})
    const [hospitaisCache, setHospitaisCache] = useState({})

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)

        // Em paralelo, buscamos os eventos e os dados relacionais para fazer os joins / caches
        const [resEventos, resConvenios, resHospitais] = await Promise.all([
            supabase.from('eventos').select('*').order('data_procedimento', { ascending: false }),
            supabase.from('convenios').select('id, nome'),
            supabase.from('hospitais').select('id, nome_fantasia')
        ])

        if (resConvenios.data) {
            const cCache = {}
            resConvenios.data.forEach(c => cCache[c.id] = c.nome)
            setConveniosCache(cCache)
        }

        if (resHospitais.data) {
            const hCache = {}
            resHospitais.data.forEach(h => hCache[h.id] = h.nome_fantasia)
            setHospitaisCache(hCache)
        }

        if (resEventos.data) {
            setEventos(resEventos.data)
        }

        setLoading(false)
    }

    const filteredEventos = eventos.filter(ev =>
        ev.paciente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.guia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conveniosCache[ev.convenio_id]?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja apagar este Evento? Todos os procedimentos vinculados serão perdidos (Apagamento em Cascata).')) return

        // Supabase foreign key na tabela evento_itens geralmente é configurada ON DELETE CASCADE
        // Caso não seja, seria necessário deletar os itens primeiro: 
        // await supabase.from('evento_itens').delete().eq('evento_id', id)

        const { error } = await supabase.from('eventos').delete().eq('id', id)
        if (!error) {
            setEventos(eventos.filter(e => e.id !== id))
        } else {
            alert('Erro ao excluir: ' + error.message)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
                        <ClipboardList className="text-blue-500" size={32} />
                        <span>Fila de Eventos (Produção)</span>
                    </h2>
                    <p className="text-slate-400 mt-2">Gerencie e confira todos os procedimentos e cirurgias registradas no sistema antes do Faturamento.</p>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden flex flex-col min-h-[60vh]">
                <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por Paciente, Guia ou Convênio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                        />
                    </div>
                    <button className="flex items-center space-x-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg text-sm transition-colors">
                        <Filter size={16} /> <span>Filtros</span>
                    </button>
                </div>

                <div className="flex-1 overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-64 text-slate-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                            Carregando registros da fila...
                        </div>
                    ) : filteredEventos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                            <ClipboardList size={48} className="mb-4 opacity-20" />
                            <p>Nenhum evento médico encontrado na sua fila.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-700/50 text-slate-300 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-5 py-4">Data Proc.</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4">Paciente</th>
                                    <th className="px-5 py-4">Convênio / Senha</th>
                                    <th className="px-5 py-4">Hospital</th>
                                    <th className="px-5 py-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {filteredEventos.map(ev => {
                                    // Formatação de Data
                                    const dataFormatada = new Date(ev.data_procedimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

                                    // Cores de Status
                                    let statusColor = 'bg-slate-700 text-slate-400 border-slate-600'
                                    if (ev.status_operacional === 'Pronto') statusColor = 'bg-green-500/10 text-green-500 border-green-500/20'
                                    else if (ev.status_operacional === 'Rascunho') statusColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20'

                                    return (
                                        <tr key={ev.id} className="hover:bg-slate-700/30 transition-colors group">
                                            <td className="px-5 py-4 font-medium text-blue-400">
                                                {dataFormatada}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${statusColor}`}>
                                                    {ev.status_operacional}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="font-bold text-white">{ev.paciente_nome}</p>
                                                {ev.paciente_cpf && <p className="text-xs text-slate-500 font-mono mt-0.5">{ev.paciente_cpf}</p>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-slate-300 font-medium">{conveniosCache[ev.convenio_id] || 'Desconhecido'}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">Senha: <span className="font-mono">{ev.senha || 'N/A'}</span></p>
                                            </td>
                                            <td className="px-5 py-4 text-slate-300">
                                                {hospitaisCache[ev.hospital_id] || 'Desconhecido'}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <div className="flex justify-center items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="p-1.5 bg-slate-900 border border-slate-700 hover:border-blue-500 rounded text-slate-400 hover:text-blue-400 transition-all" title="Ver Detalhes">
                                                        <Eye size={16} />
                                                    </button>
                                                    <button className="p-1.5 bg-slate-900 border border-slate-700 hover:border-amber-500 rounded text-slate-400 hover:text-amber-400 transition-all" title="Editar Evento">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(ev.id)} className="p-1.5 bg-slate-900 border border-slate-700 hover:border-red-500 rounded text-slate-400 hover:text-red-400 transition-all" title="Excluir">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
