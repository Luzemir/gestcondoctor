import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import {
    Scale,
    FileText,
    CheckCircle,
    XCircle,
    UploadCloud,
    Download,
    Eye,
    PlusCircle,
    AlertTriangle,
    Clock,
    DollarSign
} from 'lucide-react'

function GlosasRecursos() {
    const [activeTab, setActiveTab] = useState('abertas') // 'abertas', 'julgamento', 'finalizadas'
    const [glosas, setGlosas] = useState([])
    const [metricas, setMetricas] = useState({ aberta: 0, recurso: 0, recuperado: 0 })
    const [loading, setLoading] = useState(true)

    // Modal de Novo Recurso
    const [modalRecursoAberto, setModalRecursoAberto] = useState(false)
    const [glosaSelecionada, setGlosaSelecionada] = useState(null)
    const [formRecurso, setFormRecurso] = useState({ justificativa: '', arquivo: null })

    useEffect(() => {
        fetchGlosas()
    }, [activeTab])

    const fetchGlosas = async () => {
        setLoading(true)
        try {
            // Faremos um Join simples com os eventos para pegar o nome do paciente, ou vindo direto do lote
            // Por ora, vamos focar nos campos estritos de glosas_recursos
            let statusFiltro = ''
            if (activeTab === 'abertas') statusFiltro = 'aberta'
            if (activeTab === 'julgamento') statusFiltro = 'em_recurso'
            if (activeTab === 'finalizadas') statusFiltro = 'finalizada'

            const { data, error } = await supabase
                .from('glosas_recursos')
                .select('*')
                .eq('status_recurso', statusFiltro)
                .order('created_at', { ascending: false })

            if (error) throw error
            setGlosas(data || [])
        } catch (error) {
            console.error('Erro ao buscar glosas:', error.message)
            alert('Não foi possível carregar as glosas.')
        } finally {
            setLoading(false)
            fetchMetricasGlobais()
        }
    }

    const fetchMetricasGlobais = async () => {
        try {
            const { data, error } = await supabase
                .from('glosas_recursos')
                .select('status_recurso, valor_glosado, valor_recuperado')

            if (error) throw error

            let ab = 0, rec = 0, recup = 0
            data.forEach(g => {
                if (g.status_recurso === 'aberta') ab += Number(g.valor_glosado || 0)
                if (g.status_recurso === 'em_recurso') rec += Number(g.valor_glosado || 0)
                if (g.status_recurso === 'finalizada' && g.valor_recuperado) recup += Number(g.valor_recuperado || 0)
            })

            setMetricas({ aberta: ab, recurso: rec, recuperado: recup })
        } catch (error) {
            console.error('Falha carregando métricas', error)
        }
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
    }

    const formatDate = (dateString) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('pt-BR')
    }

    const handleAbrirModalRecurso = (glosa) => {
        setGlosaSelecionada(glosa)
        setFormRecurso({ justificativa: '', arquivo: null })
        setModalRecursoAberto(true)
    }

    const handleUploadPdf = async (file, glosaId) => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${glosaId}_${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { data, error: uploadError } = await supabase.storage
                .from('recursos_arquivos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Pega a URL Pública
            const { data: publicUrlData } = supabase.storage
                .from('recursos_arquivos')
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        } catch (err) {
            console.error('Erro no upload', err);
            throw err;
        }
    }

    const handleSubmeterRecurso = async (e) => {
        e.preventDefault()
        if (!glosaSelecionada) return

        try {
            let anexoUrl = glosaSelecionada.arquivo_anexo_url

            if (formRecurso.arquivo) {
                anexoUrl = await handleUploadPdf(formRecurso.arquivo, glosaSelecionada.id)
            }

            const { error } = await supabase
                .from('glosas_recursos')
                .update({
                    status_recurso: 'em_recurso',
                    justificativa_recurso: formRecurso.justificativa,
                    arquivo_anexo_url: anexoUrl
                })
                .eq('id', glosaSelecionada.id)

            if (error) throw error

            alert('Recurso iniciado com sucesso!')
            setModalRecursoAberto(false)
            fetchGlosas()
        } catch (error) {
            console.error('Erro ao salvar recurso:', error.message)
            alert('Falha ao registrar o recurso.')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-amber-500 bg-clip-text text-transparent">Glosas e Recursos</h2>
                    <p className="text-slate-400 mt-1">Gestão de cortes financeiros e defesas junto aos convênios</p>
                </div>
                <div className="flex bg-slate-800 p-1 border border-slate-700 rounded-lg">
                    {[
                        { id: 'abertas', label: 'Cortes (Abertos)', icon: AlertTriangle },
                        { id: 'julgamento', label: 'Em Recurso', icon: Clock },
                        { id: 'finalizadas', label: 'Finalizadas', icon: CheckCircle }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center px-4 py-2 space-x-2 rounded-md font-medium transition-all ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            <tab.icon size={16} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* DASHBOARD CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertTriangle size={64} className="text-red-500" />
                    </div>
                    <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2">GLOSAS ATIVAS (SEM RECURSO)</p>
                    <h3 className="text-3xl font-black text-white">{formatCurrency(metricas.aberta)}</h3>
                    <p className="text-slate-500 text-xs mt-2">Diferença cortada aguardando defesa.</p>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock size={64} className="text-blue-500" />
                    </div>
                    <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">EM JULGAMENTO (RECURSOS)</p>
                    <h3 className="text-3xl font-black text-white">{formatCurrency(metricas.recurso)}</h3>
                    <p className="text-slate-500 text-xs mt-2">Valores defendidos junto aos convênios.</p>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle size={64} className="text-emerald-500" />
                    </div>
                    <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">ROI RECUPERADO</p>
                    <h3 className="text-3xl font-black text-white">{formatCurrency(metricas.recuperado)}</h3>
                    <p className="text-slate-500 text-xs mt-2">Lucro real salvo da lixeira.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                    {glosas.length === 0 ? (
                        <div className="p-16 text-center">
                            <Scale size={64} className="mx-auto text-slate-600 mb-6 drop-shadow-md" />
                            <h3 className="text-2xl font-bold text-slate-300">Nenhum Registro Aqui</h3>
                            <p className="text-slate-500 mt-2 max-w-sm mx-auto">Você está na aba "{activeTab}". Quando houverem movimentações de glosa neste estado, elas aparecerão listadas abaixo.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900 border-b border-slate-700 text-xs uppercase text-slate-400 tracking-wider">
                                        <th className="p-4 font-bold">Data ID</th>
                                        <th className="p-4 font-bold">Lote Vinculado</th>
                                        <th className="p-4 font-bold">Valor Glosado</th>
                                        <th className="p-4 font-bold">Motivo (TISS)</th>
                                        <th className="p-4 font-bold text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {glosas.map((glosa) => (
                                        <tr key={glosa.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                                            <td className="p-4 text-slate-300 font-medium">
                                                {formatDate(glosa.data_identificacao)}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center space-x-2">
                                                    <FileText size={16} className="text-slate-500" />
                                                    <span className="text-slate-300 font-mono text-sm">{glosa.faturamento_lote_id?.slice(0, 8)}...</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="inline-block px-3 py-1 bg-red-500/10 text-red-400 font-bold rounded-lg border border-red-500/20">
                                                    {formatCurrency(glosa.valor_glosado)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-400 text-sm max-w-xs truncate" title={glosa.motivo_glosa_descricao}>
                                                {glosa.motivo_glosa_codigo ? `[${glosa.motivo_glosa_codigo}] ` : ''}
                                                {glosa.motivo_glosa_descricao || 'Não informado na Baixa'}
                                            </td>
                                            <td className="p-4 text-right">
                                                {activeTab === 'abertas' && (
                                                    <button
                                                        onClick={() => handleAbrirModalRecurso(glosa)}
                                                        className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white font-medium rounded-lg text-sm transition-all border border-blue-500/30 flex items-center justify-center space-x-2 ml-auto"
                                                    >
                                                        <Scale size={16} />
                                                        <span>Iniciar Defesa</span>
                                                    </button>
                                                )}
                                                {activeTab === 'julgamento' && (
                                                    <div className="flex justify-end space-x-2">
                                                        {glosa.arquivo_anexo_url && (
                                                            <a href={glosa.arquivo_anexo_url} target="_blank" rel="noreferrer" className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all" title="Ver Anexo">
                                                                <Eye size={16} />
                                                            </a>
                                                        )}
                                                        <button
                                                            className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white font-medium rounded-lg text-sm transition-all border border-emerald-500/30 flex items-center space-x-2"
                                                        >
                                                            <DollarSign size={16} />
                                                            <span>Dar Desfecho</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL DE NOVO RECURSO */}
            {modalRecursoAberto && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-2xl border border-slate-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-white flex items-center">
                                <Scale className="mr-3 text-blue-400" /> Montar Defesa de Glosa
                            </h3>
                            <button onClick={() => setModalRecursoAberto(false)} className="text-slate-400 hover:text-white">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex justify-between items-center">
                            <div>
                                <p className="text-red-400 text-sm font-bold uppercase tracking-wider mb-1">Valor Contestado</p>
                                <p className="text-2xl font-black text-white">{formatCurrency(glosaSelecionada?.valor_glosado)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 text-sm">Motivo Declarado:</p>
                                <p className="text-slate-200 font-medium max-w-xs">{glosaSelecionada?.motivo_glosa_descricao || 'Nenhum'}</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmeterRecurso} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Justificativa Técnica do Recurso
                                </label>
                                <textarea
                                    required
                                    rows="4"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="Ex: O procedimento foi previamente autorizado através da senha XYZ. Anexamos a guia e o relatório médico assinado."
                                    value={formRecurso.justificativa}
                                    onChange={e => setFormRecurso({ ...formRecurso, justificativa: e.target.value })}
                                />
                            </div>

                            <div className="p-4 border border-dashed border-slate-600 rounded-xl bg-slate-900/50 hover:bg-slate-900 transition-colors">
                                <label className="flex flex-col items-center justify-center cursor-pointer">
                                    <UploadCloud size={32} className="text-slate-400 mb-2" />
                                    <span className="text-slate-300 font-medium mb-1">Anexar Documento TISS / Relatório</span>
                                    <span className="text-slate-500 text-xs mb-3">PDF ou Imagem (Max 5MB)</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,image/*"
                                        onChange={e => setFormRecurso({ ...formRecurso, arquivo: e.target.files[0] })}
                                    />
                                    {formRecurso.arquivo ? (
                                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-md font-mono text-sm">
                                            {formRecurso.arquivo.name}
                                        </span>
                                    ) : (
                                        <span className="px-4 py-2 border border-slate-700 bg-slate-800 rounded-md text-sm text-slate-400 hover:text-white transition-colors">
                                            Procurar Arquivo
                                        </span>
                                    )}
                                </label>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setModalRecursoAberto(false)}
                                    className="px-6 py-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-bold shadow-lg shadow-blue-500/30 flex items-center space-x-2"
                                >
                                    <UploadCloud size={18} />
                                    <span>Enviar Defesa ao Convênio</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default GlosasRecursos
