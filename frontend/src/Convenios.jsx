import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { ShieldCheck, Files, Plus } from 'lucide-react'

export default function Convenios() {
    const [convenios, setConvenios] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
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
            setConvenios(data)
        }
        setLoading(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Convênios</h2>
                <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                    <Plus size={20} />
                    <span>Novo Convênio</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full p-8 text-center text-slate-400">Carregando convênios...</div>
                ) : convenios.length === 0 ? (
                    <div className="col-span-full p-8 text-center text-slate-400">Nenhum convênio cadastrado.</div>
                ) : (
                    convenios.map((convenio) => (
                        <div key={convenio.id} className="p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-blue-500 transition-all shadow-lg group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                                    <ShieldCheck size={24} />
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${convenio.status === 'Ativo' ? 'bg-green-500/10 text-green-500' : 'bg-slate-700 text-slate-400'}`}>
                                    {convenio.status}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{convenio.nome}</h3>
                            <p className="text-slate-400 text-sm mb-6 line-clamp-2">{convenio.observacoes || 'Sem observações.'}</p>

                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700">
                                <button className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white transition-colors">
                                    <Files size={14} />
                                    <span>Ver Tabelas</span>
                                </button>
                                <button className="text-blue-500 hover:text-blue-400 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                    Configurar
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
