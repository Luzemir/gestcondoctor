import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { UserPlus, UserCheck, UserX } from 'lucide-react'

export default function Medicos() {
    const [medicos, setMedicos] = useState([])
    const [loading, setLoading] = useState(true)

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
            console.error(error)
        } else {
            setMedicos(data)
        }
        setLoading(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Médicos</h2>
                <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                    <UserPlus size={20} />
                    <span>Novo Médico</span>
                </button>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Carregando médicos...</div>
                ) : medicos.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Nenhum médico cadastrado.</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-700/50 text-slate-300 text-sm uppercase">
                                <th className="px-6 py-4 font-semibold">Nome</th>
                                <th className="px-6 py-4 font-semibold">CRM</th>
                                <th className="px-6 py-4 font-semibold">Especialidade</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {medicos.map((medico) => (
                                <tr key={medico.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-4 text-white font-medium">{medico.nome}</td>
                                    <td className="px-6 py-4 text-slate-300">{medico.crm}</td>
                                    <td className="px-6 py-4 text-slate-300">{medico.especialidade}</td>
                                    <td className="px-6 py-4">
                                        {medico.ativo ? (
                                            <span className="flex items-center space-x-1 text-green-500 text-xs font-bold uppercase">
                                                <UserCheck size={14} /> <span>Ativo</span>
                                            </span>
                                        ) : (
                                            <span className="flex items-center space-x-1 text-red-500 text-xs font-bold uppercase">
                                                <UserX size={14} /> <span>Inativo</span>
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-blue-500 hover:text-blue-400 text-sm font-semibold">Editar</button>
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
