import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { FileText, FileCheck, Filter, Search, Plus, Layers, AlertTriangle, ArrowRight, X } from 'lucide-react'

export default function Faturamento() {
    const [activeTab, setActiveTab] = useState('fila') // 'fila' ou 'lotes'

    // Fila UI state
    const [eventosFila, setEventosFila] = useState([])
    const [loadingFila, setLoadingFila] = useState(true)
    const [searchTermFila, setSearchTermFila] = useState('')
    const [selectedEventosIds, setSelectedEventosIds] = useState([])

    // Lotes UI state
    const [lotes, setLotes] = useState([])
    const [loadingLotes, setLoadingLotes] = useState(true)

    // Detalhe Lote UI state
    const [loteSelecionado, setLoteSelecionado] = useState(null)
    const [eventosDoLote, setEventosDoLote] = useState([])
    const [loadingDetalhe, setLoadingDetalhe] = useState(false)

    // Combos de filtro
    const [convenios, setConvenios] = useState([])

    // Session state
    const [empresaId, setEmpresaId] = useState(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            const eid = session?.user?.user_metadata?.empresa_id || session?.user?.id;
            if (eid) {
                setEmpresaId(eid);
            } else {
                setLoadingFila(false);
                setLoadingLotes(false);
            }
        });
    }, []);

    useEffect(() => {
        if (!empresaId) return;
        fetchSupportData();
        if (activeTab === 'fila') {
            fetchFilaDeFaturamento();
        } else {
            fetchLotes();
        }
    }, [activeTab, empresaId]);

    async function fetchSupportData() {
        const { data } = await supabase.from('convenios').select('id, nome, status').eq('status', 'Ativo');
        if (data) setConvenios(data);
    }

    async function fetchFilaDeFaturamento() {
        setLoadingFila(true)
        try {
            // Busca eventos "Pronto" ou "Rascunho" que AINDA NÃO têm lote_id
            const { data, error } = await supabase
                .from('eventos')
                .select(`
                    id, 
                    paciente_nome, 
                    data_procedimento, 
                    status_operacional,
                    urgencia,
                    convenio_id,
                    guia,
                    senha,
                    evento_itens(rateio_por_medico_snapshot)
                `)
                .is('lote_id', null)
                .order('data_procedimento', { ascending: false })

            if (error) throw error;

            // Processar a soma total usando os snapshots do repasse_por_medico
            const filaProcessada = (data || []).map(evt => {
                let valorGuia = 0;
                if (evt.evento_itens) {
                    evt.evento_itens.forEach(item => {
                        const r = item.rateio_por_medico_snapshot || {};
                        valorGuia += (r.principal || 0) + (r.aux1 || 0) + (r.aux2 || 0);
                    });
                }
                return { ...evt, valor_calculado: valorGuia };
            });

            setEventosFila(filaProcessada);
        } catch (error) {
            console.error("Erro ao carregar fila:", error);
        } finally {
            setLoadingFila(false);
        }
    }

    async function fetchLotes() {
        setLoadingLotes(true)
        try {
            const { data, error } = await supabase
                .from('lotes_faturamento')
                .select('*')
                .order('data_criacao', { ascending: false })

            if (error) throw error;
            setLotes(data || []);
        } catch (error) {
            console.error("Erro ao carregar lotes:", error);
        } finally {
            setLoadingLotes(false);
        }
    }

    const handleAbrirLote = async (lote) => {
        setLoteSelecionado(lote);
        setLoadingDetalhe(true);
        try {
            const { data, error } = await supabase
                .from('eventos')
                .select(`
                    id, 
                    paciente_nome, 
                    data_procedimento, 
                    guia,
                    senha,
                    evento_itens(rateio_por_medico_snapshot)
                `)
                .eq('lote_id', lote.id)
                .order('data_procedimento', { ascending: false });

            if (error) throw error;

            const processados = (data || []).map(evt => {
                let valorGuia = 0;
                if (evt.evento_itens) {
                    evt.evento_itens.forEach(item => {
                        const r = item.rateio_por_medico_snapshot || {};
                        valorGuia += (r.principal || 0) + (r.aux1 || 0) + (r.aux2 || 0);
                    });
                }
                return { ...evt, valor_calculado: valorGuia };
            });
            setEventosDoLote(processados);

        } catch (e) {
            console.error(e);
            alert('Erro ao carregar os eventos deste lote.');
        } finally {
            setLoadingDetalhe(false);
        }
    }

    const handleExportarCSV = () => {
        if (!loteSelecionado || eventosDoLote.length === 0) return;

        let csvContent = "ID,Paciente,Data Proc,Guia,Senha,Valor Total\n";

        eventosDoLote.forEach(evt => {
            const valor = evt.valor_calculado ? evt.valor_calculado.toFixed(2) : "0.00";
            csvContent += `${evt.id},${evt.paciente_nome},${evt.data_procedimento},${evt.guia || ''},${evt.senha || ''},${valor.replace('.', ',')}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `LOTE_${loteSelecionado.id.substring(0, 8)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const removeAccents = (str) => {
        return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    };

    const eventosFilaFiltrados = eventosFila.filter(evt => {
        if (!searchTermFila) return true;
        const term = removeAccents(String(searchTermFila).toLowerCase());
        const paciente = removeAccents(String(evt.paciente_nome || '').toLowerCase());
        const guia = removeAccents(String(evt.guia || '').toLowerCase());
        const senha = removeAccents(String(evt.senha || '').toLowerCase());
        const convNome = convenios.find(c => c.id === evt.convenio_id)?.nome || 'Sem Convênio';
        const convenio = removeAccents(String(convNome).toLowerCase());

        return paciente.includes(term) || guia.includes(term) || senha.includes(term) || convenio.includes(term);
    });

    const toggleEventoSelection = (id) => {
        setSelectedEventosIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }

    const selectAllEventos = () => {
        if (selectedEventosIds.length === eventosFilaFiltrados.length) {
            setSelectedEventosIds([]);
        } else {
            setSelectedEventosIds(eventosFilaFiltrados.map(e => e.id));
        }
    }

    const handleCriarLote = async () => {
        if (selectedEventosIds.length === 0) return;

        // MVP: Agrupar apenas do mesmo convênio! 
        // Identificamos o convênio do primeiro evento selecionado
        const firstEvent = eventosFila.find(e => e.id === selectedEventosIds[0]);
        const targetConvenio = firstEvent.convenio_id;

        const invalidSelection = selectedEventosIds.some(id => {
            const evt = eventosFila.find(e => e.id === id);
            return evt.convenio_id !== targetConvenio;
        });

        if (invalidSelection) {
            alert('Você sê pode agrupar em um mesmo lote guias referentes ao mesmo Convênio!');
            return;
        }

        const confirmacao = confirm(`Deseja criar um lote com as ${selectedEventosIds.length} guias selecionadas? Elas serão "trancadas" para edição.`);
        if (!confirmacao) return;

        try {
            // 1. Calcular o Valor Total do Lote 
            const totalDoLote = selectedEventosIds.reduce((sum, id) => {
                const evt = eventosFila.find(e => e.id === id);
                return sum + (evt?.valor_calculado || 0);
            }, 0);

            // 2. Criar Lote Header
            const { data: loteHeader, error: errLote } = await supabase
                .from('lotes_faturamento')
                .insert([{
                    empresa_id: empresaId,
                    convenio_id: targetConvenio,
                    status: 'Aberto',
                    valor_total: totalDoLote
                }])
                .select()
                .single();

            if (errLote) throw errLote;

            // 2. Vincular os eventos ao Lote
            const { error: errUpdate } = await supabase
                .from('eventos')
                .update({ lote_id: loteHeader.id })
                .in('id', selectedEventosIds);

            if (errUpdate) throw errUpdate;

            // Refresh Fila
            alert('Lote criado com sucesso! Eventos transferidos da fila.');
            setSelectedEventosIds([]);
            fetchFilaDeFaturamento();

        } catch (error) {
            console.error('Falha ao criar lote:', error);
            alert('Falha ao criar lote. Veja o console.');
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
                        <FileText className="text-blue-500" size={32} />
                        <span>Faturamento e Lotes</span>
                    </h2>
                    <p className="text-slate-400 mt-2">Auditoria das fichas prontas e expedição de Lotes para convênios.</p>
                </div>
            </div>

            {/* Abas */}
            <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700 w-full max-w-md">
                <button
                    onClick={() => setActiveTab('fila')}
                    className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all flex items-center justify-center space-x-2 ${activeTab === 'fila'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                        }`}
                >
                    <FileCheck size={18} />
                    <span>Fila de Auditoria ({eventosFilaFiltrados.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab('lotes')}
                    className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all flex items-center justify-center space-x-2 ${activeTab === 'lotes'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                        }`}
                >
                    <Layers size={18} />
                    <span>Meus Lotes</span>
                </button>
            </div>

            {/* CONTEÚDO DA FILA DE AUDITORIA */}
            {activeTab === 'fila' && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-[300px]">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar paciente, guia..."
                                    value={searchTermFila}
                                    onChange={(e) => setSearchTermFila(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {selectedEventosIds.length > 0 && (
                            <button
                                onClick={handleCriarLote}
                                className="flex items-center space-x-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-900/40 animate-in fade-in zoom-in duration-200"
                            >
                                <Plus size={20} />
                                <span>Criar Lote com {selectedEventosIds.length} guias</span>
                            </button>
                        )}
                    </div>

                    {loadingFila ? (
                        <div className="p-12 text-center text-slate-400">Verificando fila pendente...</div>
                    ) : eventosFila.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center">
                            <FileCheck size={48} className="text-emerald-500 mb-4 opacity-50" />
                            <h3 className="text-xl font-bold text-slate-300 mb-2">Fila de Faturamento Limpa</h3>
                            <p className="text-slate-500">Não há produções médicas aguardando faturamento e geração de lotes neste momento.</p>
                        </div>
                    ) : eventosFilaFiltrados.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center">
                            <Search size={48} className="text-slate-500 mb-4 opacity-50" />
                            <h3 className="text-xl font-bold text-slate-300 mb-2">Nenhum resultado</h3>
                            <p className="text-slate-500">A busca por "{searchTermFila}" não retornou nenhuma guia na fila de auditoria.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-700/50 text-slate-300 text-xs uppercase tracking-wider">
                                        <th className="px-4 py-4 w-12 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-600 bg-slate-800"
                                                checked={selectedEventosIds.length === eventosFilaFiltrados.length && eventosFilaFiltrados.length > 0}
                                                onChange={selectAllEventos}
                                            />
                                        </th>
                                        <th className="px-4 py-4 font-semibold">Data / ID</th>
                                        <th className="px-4 py-4 font-semibold">Paciente</th>
                                        <th className="px-4 py-4 font-semibold">Convênio</th>
                                        <th className="px-4 py-4 font-semibold text-right">R$ Calculado</th>
                                        <th className="px-4 py-4 font-semibold">Status / Pendências</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {eventosFilaFiltrados.map((evt) => {
                                        const convNome = convenios.find(c => c.id === evt.convenio_id)?.nome || 'Sem Convênio';
                                        const temPendencias = !evt.guia || !evt.senha;

                                        return (
                                            <tr key={evt.id} className={`hover:bg-slate-700/30 transition-colors ${selectedEventosIds.includes(evt.id) ? 'bg-blue-900/10' : ''}`}>
                                                <td className="px-4 py-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800"
                                                        checked={selectedEventosIds.includes(evt.id)}
                                                        onChange={() => toggleEventoSelection(evt.id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="text-white font-mono text-sm">{evt.data_procedimento}</div>
                                                    <div className="text-slate-500 text-xs mt-1">ID: ...{String(evt.id).substring(String(evt.id).length - 6 > 0 ? String(evt.id).length - 6 : 0)}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="font-bold text-white">{evt.paciente_nome}</div>
                                                    {evt.urgencia === 'Emergencia' && (
                                                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                            EMERGÊNCIA
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="text-slate-300 font-medium text-sm">{convNome}</div>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="font-bold text-emerald-400">R$ {(evt.valor_calculado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    {evt.status_operacional === 'Pronto' ? (
                                                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">PRONTO</span>
                                                    ) : (
                                                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-400 border border-slate-600">RASCUNHO</span>
                                                    )}

                                                    {temPendencias && (
                                                        <div className="mt-2 text-xs flex items-center space-x-1 text-red-400">
                                                            <AlertTriangle size={12} />
                                                            <span>Falta guia ou senha</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* CONTEÚDO DOS LOTES */}
            {activeTab === 'lotes' && !loteSelecionado && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                    {loadingLotes ? (
                        <div className="p-12 text-center text-slate-400">Carregando seus lotes de expedição...</div>
                    ) : lotes.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center">
                            <Layers size={48} className="text-slate-600 mb-4" />
                            <h3 className="text-xl font-bold text-slate-300 mb-2">Nenhum lote gerado</h3>
                            <p className="text-slate-500">Vá para a Fila de Auditoria e selecione guias para fechar um Lote de Faturamento.</p>
                        </div>
                    ) : (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {lotes.map(lote => {
                                const convNome = convenios.find(c => c.id === lote.convenio_id)?.nome || 'Convênio N/A';
                                return (
                                    <div key={lote.id} onClick={() => handleAbrirLote(lote)} className="bg-slate-900 border border-slate-700 hover:border-blue-500/50 rounded-xl p-5 transition-colors group cursor-pointer relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-2">
                                            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                {lote.status}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-white text-lg mb-1">{convNome}</h4>
                                        <p className="text-slate-500 text-xs font-mono mb-4">Lote #{String(lote.id).substring(0, 8)}</p>

                                        <div className="space-y-2 mt-4">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Abertura:</span>
                                                <span className="text-white">{new Date(lote.data_criacao).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Valor Estimado:</span>
                                                <span className="text-emerald-400 font-medium">R$ {Number(lote.valor_total).toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-xs text-blue-400 font-medium">Abrir Lote Completo</span>
                                            <ArrowRight size={16} className="text-blue-400" />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* DETALHE DO LOTE */}
            {activeTab === 'lotes' && loteSelecionado && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <button
                        onClick={() => setLoteSelecionado(null)}
                        className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowRight size={16} className="rotate-180" />
                        <span>Voltar para Lista de Lotes</span>
                    </button>

                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-1">
                                Lote #{String(loteSelecionado.id).substring(0, 8)}
                            </h3>
                            <p className="text-slate-400 text-sm">
                                {convenios.find(c => c.id === loteSelecionado.convenio_id)?.nome || 'Convênio N/A'} • Aberto em {new Date(loteSelecionado.data_criacao).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={handleExportarCSV}
                                disabled={loadingDetalhe || eventosDoLote.length === 0}
                                className="flex items-center space-x-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-900/40 disabled:opacity-50 transition-colors"
                            >
                                <FileText size={18} />
                                <span>Exportar CSV (TISS)</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                        {loadingDetalhe ? (
                            <div className="p-12 text-center text-slate-400">Carregando guias do lote...</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-700/50 text-slate-300 text-xs uppercase tracking-wider">
                                            <th className="px-4 py-4 font-semibold">Data Proc.</th>
                                            <th className="px-4 py-4 font-semibold">Paciente</th>
                                            <th className="px-4 py-4 font-semibold">Nº Guia</th>
                                            <th className="px-4 py-4 font-semibold">Senha</th>
                                            <th className="px-4 py-4 font-semibold text-right">R$ Lançado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {eventosDoLote.map(evt => (
                                            <tr key={evt.id} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="px-4 py-4 text-slate-300 font-mono text-sm">{evt.data_procedimento}</td>
                                                <td className="px-4 py-4 font-bold text-white">{evt.paciente_nome}</td>
                                                <td className="px-4 py-4 text-slate-400 font-mono">{evt.guia || '-'}</td>
                                                <td className="px-4 py-4 text-slate-400 font-mono">{evt.senha || '-'}</td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="font-bold text-emerald-400">R$ {(evt.valor_calculado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-900/50 border-t-2 border-slate-700">
                                        <tr>
                                            <td colSpan="4" className="px-4 py-4 text-right font-bold text-slate-400 uppercase tracking-wider text-sm">
                                                TOTAL DO LOTE:
                                            </td>
                                            <td className="px-4 py-4 text-right font-bold text-emerald-400 text-lg">
                                                R$ {Number(loteSelecionado.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
