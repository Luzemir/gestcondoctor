import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Building2, PlusCircle, Globe } from 'lucide-react'

export default function Hospitais() {
    const [hospitais, setHospitais] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchHospitais()
    }, [])

    async function fetchHospitais() {
        setLoading(true)
        const { data, error } = await supabase
            .from('hospitais')
            .select('*')
            .order('nome', { ascending: true })

        if (error) {
            console.error(error)
        } else {
            setHospitais(data)
        }
        setLoading(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Hospitais</h2>
                <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                    <PlusCircle size={20} />
                    <span>Cadastrar Hospital</span>
                </button>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Carregando hospitais...</div>
                ) : hospitais.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Nenhum hospital cadastrado.</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-700/50 text-slate-300 text-sm uppercase">
                                <th className="px-6 py-4 font-semibold">Nome / Apelido</th>
                                <th className="px-6 py-4 font-semibold">CNPJ / CNES</th>
                                <th className="px-6 py-4 font-semibold">Contato</th>
                                <th className="px-6 py-4 font-semibold">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {hospitais.map((hospital) => (
                                <tr key={hospital.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-white font-medium">{hospital.nome}</div>
                                        <div className="text-slate-400 text-xs">{hospital.apelido || 'Sem apelido'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-300">{hospital.cnpj}</div>
                                        <div className="text-slate-500 text-xs">CNES: {hospital.cnes || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        <div>{hospital.telefone || hospital.email || 'N/A'}</div>
                                        <div className="text-slate-500 text-xs">{hospital.contato}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-blue-500 hover:text-blue-400 text-sm font-semibold">Detalhes</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
