import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { FileText, FileCheck, Filter, Search, Plus, Layers, AlertTriangle, ArrowRight, X } from 'lucide-react'

export default function Faturamento({ initialTab = 'fila' }) {
    const [activeTab, setActiveTab] = useState(initialTab) // 'fila', 'lotes', ou 'glosas'

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

    // Glosas State
    const [modalGlosaItems, setModalGlosaItems] = useState(null)
    const [selectedGlosasIds, setSelectedGlosasIds] = useState([])
    const [formGlosa, setFormGlosa] = useState({ motivo_codigo: 'Outros', motivo: '', valor_glosado: '', usar_integral: false })
    const [glosasData, setGlosasData] = useState({ ativas: 0, recurso: 0, recuperado: 0, lista: [] })

    // Busca de Glosas para o Dashboard
    useEffect(() => {
        if (activeTab === 'glosas') fetchGlosas()
    }, [activeTab])

    async function fetchGlosas() {
        const currentSession = JSON.parse(localStorage.getItem('sb-ptjxtovrrcbctoifosza-auth-token')) || null;
        let empresaId = currentSession?.user?.user_metadata?.empresa_id || null;

        const { data, error } = await supabase
            .from('glosas_recursos')
            .select('*')
            .eq('empresa_id', empresaId);

        if (data) {
            const ativas = data.filter(g => g.status_recurso === 'aberta').reduce((acc, g) => acc + Number(g.valor_glosado), 0);
            const recurso = data.filter(g => g.status_recurso === 'em_recurso').reduce((acc, g) => acc + Number(g.valor_glosado), 0);
            const recuperado = data.filter(g => g.status_recurso === 'finalizada' && Number(g.valor_recuperado) > 0).reduce((acc, g) => acc + Number(g.valor_recuperado || 0), 0);
            setGlosasData({ ativas, recurso, recuperado, lista: data });
        }
    }

    // Modal Régua & NF
    const [modalNfAberta, setModalNfAberta] = useState(false)
    const [formNf, setFormNf] = useState({
        numero_nf: '',
        data_emissao: new Date().toISOString().split('T')[0],
        valor_nf: '',
        data_vencimento: ''
    })
    const [loadingNf, setLoadingNf] = useState(false)

    // Combos de filtro
    const [convenios, setConvenios] = useState([])

    // Session state
    const [empresaId, setEmpresaId] = useState(null)
    const [authLoaded, setAuthLoaded] = useState(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            const eid = session?.user?.user_metadata?.empresa_id || null;
            if (eid) setEmpresaId(eid);
            setAuthLoaded(true);
        });
    }, []);

    useEffect(() => {
        if (!authLoaded) return;
        fetchSupportData();
        if (activeTab === 'fila') {
            fetchFilaDeFaturamento();
        } else {
            fetchLotes();
        }
    }, [activeTab, authLoaded, empresaId]);

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
                    evento_itens(id, codigo, descricao, rateio_por_medico_snapshot, valor_calculado_item_snapshot)
                `)
                .is('faturamento_lote_id', null)
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
                .from('faturamento_lotes')
                .select('*')
                .order('created_at', { ascending: false })

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
                    evento_itens(id, codigo, descricao, rateio_por_medico_snapshot, valor_calculado_item_snapshot)
                `)
                .eq('faturamento_lote_id', lote.id)
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
            alert('Você só pode agrupar em um mesmo lote guias referentes ao mesmo Convênio!');
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
            const mesCompetencia = new Date().getMonth() + 1;
            const anoCompetencia = new Date().getFullYear();
            const codigoLote = `LOTE-${anoCompetencia}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

            const { data: loteHeader, error: errLote } = await supabase
                .from('faturamento_lotes')
                .insert([{
                    empresa_id: empresaId,
                    codigo_lote: codigoLote,
                    mes_competencia: mesCompetencia,
                    ano_competencia: anoCompetencia,
                    convenio_id: targetConvenio,
                    status: 'Aberto',
                    valor_total_calculado: totalDoLote
                }])
                .select()
                .single();

            if (errLote) throw errLote;

            // 3. Vincular os eventos ao Lote
            const { error: errUpdate } = await supabase
                .from('eventos')
                .update({
                    faturamento_lote_id: loteHeader.id,
                    status_faturamento: 'Em Lote'
                })
                .in('id', selectedEventosIds);

            if (errUpdate) throw errUpdate;

            // Refresh Fila
            alert('Lote criado com sucesso! Eventos transferidos da fila.');
            setSelectedEventosIds([]);
            fetchFilaDeFaturamento();

        } catch (error) {
            console.error('Falha ao criar lote:', error);
            const msgErro = error?.message || error?.details || 'Erro desconhecido';
            alert(`Falha ao criar lote. Motivo: ${msgErro}`);
        }
    }

    const handleSalvarNF = async () => {
        if (!formNf.numero_nf || !formNf.valor_nf || !formNf.data_vencimento) {
            alert('Preencha Número da NF, Valor e Vencimento para iniciar a régua.');
            return;
        }

        setLoadingNf(true);
        try {
            // 1. Cria a nota fiscal
            const { error: errNf } = await supabase.from('notas_fiscais').insert([{
                empresa_id: empresaId,
                faturamento_lote_id: loteSelecionado.id,
                numero_nf: formNf.numero_nf,
                data_emissao: formNf.data_emissao,
                valor_nf: parseFloat(formNf.valor_nf)
            }]);

            if (errNf) throw errNf;

            // 2. Atualiza o Lote engatilhando a Régua de Cobrança
            const { error: errLote } = await supabase.from('faturamento_lotes').update({
                status: 'Aguardando Pagamento',
                data_vencimento: formNf.data_vencimento
            }).eq('id', loteSelecionado.id);

            if (errLote) throw errLote;

            alert('✅ Nota Fiscal atrelada com sucesso! Régua de cobrança ativada.');
            setModalNfAberta(false);
            setLoteSelecionado(null);
            fetchLotes(); // Recarrega Lotes atualizando o novo status
        } catch (e) {
            console.error(e);
            alert('Erro ao salvar Nota Fiscal.');
        } finally {
            setLoadingNf(false);
        }
    }

    const handleLiquidarLote = async () => {
        const confirmacao = confirm('✅ Deseja confirmar o recebimento do valor TOTAL Deste lote? Todos os registros associados serão pintados de verde!');
        if (!confirmacao) return;

        try {
            const { error: errLote } = await supabase.from('faturamento_lotes').update({
                status: 'Liquidado',
                data_pagamento: new Date().toISOString().split('T')[0]
            }).eq('id', loteSelecionado.id);
            if (errLote) throw errLote;

            const { error: errEventos } = await supabase.from('eventos').update({
                status_faturamento: 'Pago'
            }).eq('faturamento_lote_id', loteSelecionado.id);
            if (errEventos) throw errEventos;

            alert('Pagamento Liquidado com sucesso! Fluxo de faturamento encerrado para este lote.');
            setLoteSelecionado(null);
            fetchLotes();
        } catch (error) {
            console.error(error);
            alert('Falha ao liquidar lote.');
        }
    }

    const handleSalvarGlosa = async () => {
        try {
            const currentSession = JSON.parse(localStorage.getItem('sb-ptjxtovrrcbctoifosza-auth-token')) || null;
            let empresaId = currentSession?.user?.user_metadata?.empresa_id || null;

            const payload = modalGlosaItems.map(item => ({
                empresa_id: empresaId,
                faturamento_lote_id: loteSelecionado.id,
                evento_item_id: item.id,
                valor_esperado: Number(item.valor_calculado_item_snapshot),
                valor_glosado: formGlosa.usar_integral ? Number(item.valor_calculado_item_snapshot) : parseFloat(formGlosa.valor_glosado),
                motivo_glosa_codigo: formGlosa.motivo_codigo,
                motivo_glosa_descricao: formGlosa.motivo,
                status_recurso: 'aberta',
                data_identificacao: new Date().toISOString().split('T')[0]
            }));

            const { error } = await supabase.from('glosas_recursos').insert(payload);
            if (error) throw error;

            alert(`${payload.length} Glosa(s) registrada(s) com sucesso! Entraram no funil de Recuperação.`);
            setModalGlosaItems(null);
            setSelectedGlosasIds([]);
            fetchGlosas(); // Refresh background
        } catch (err) {
            console.error(err);
            alert('Falha ao registrar Glosa.');
        }
    }

    const handleReverterGlosa = async (idGlosa) => {
        if (!confirm('Deseja realmente excluir (reverter) este registro de glosa? O valor voltará a ser esperado.')) return;
        try {
            const { error } = await supabase.from('glosas_recursos').delete().eq('id', idGlosa);
            if (error) throw error;
            alert('Glosa revertida com sucesso!');
            fetchGlosas();
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir glosa.');
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
                <button
                    onClick={() => setActiveTab('glosas')}
                    className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all flex items-center justify-center space-x-2 ${activeTab === 'glosas'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                        }`}
                >
                    <AlertTriangle size={18} />
                    <span>Glosas & Recursos</span>
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

                                // Cores dinâmicas para a régua
                                let statusColor = 'bg-slate-700 text-slate-300 border-slate-600';
                                if (lote.status === 'Aberto') statusColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                                else if (lote.status === 'Aguardando Pagamento') statusColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                                else if (lote.status === 'Liquidado') statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

                                return (
                                    <div key={lote.id} onClick={() => handleAbrirLote(lote)} className="bg-slate-900 border border-slate-700 hover:border-blue-500/50 rounded-xl p-5 transition-colors group cursor-pointer relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-2">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${statusColor}`}>
                                                {lote.status}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-white text-lg mb-1">{convNome}</h4>
                                        <p className="text-slate-500 text-xs font-mono mb-4">{lote.codigo_lote} ({lote.mes_competencia}/{lote.ano_competencia})</p>

                                        <div className="space-y-2 mt-4">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Abertura:</span>
                                                <span className="text-white">{new Date(lote.created_at).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            {lote.data_vencimento && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-amber-400">Vencimento:</span>
                                                    <span className="text-amber-400 font-bold">{new Date(lote.data_vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Valor Estimado:</span>
                                                <span className="text-emerald-400 font-medium">R$ {Number(lote.valor_total_calculado).toFixed(2)}</span>
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
                                {loteSelecionado.codigo_lote}
                            </h3>
                            <p className="text-slate-400 text-sm">
                                {convenios.find(c => c.id === loteSelecionado.convenio_id)?.nome || 'Convênio N/A'} • Aberto em {new Date(loteSelecionado.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            {loteSelecionado.status === 'Aguardando Pagamento' && (
                                <button
                                    onClick={handleLiquidarLote}
                                    className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-900/40 transition-colors"
                                >
                                    <FileCheck size={18} />
                                    <span>Dar Baixa (Recebido)</span>
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setFormNf(prev => ({ ...prev, valor_nf: Number(loteSelecionado.valor_total_calculado).toFixed(2) }));
                                    setModalNfAberta(true);
                                }}
                                disabled={loadingDetalhe || loteSelecionado.status !== 'Aberto'}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-bold shadow-lg transition-colors ${loteSelecionado.status === 'Aberto'
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/40'
                                    : 'bg-slate-700 text-slate-400 border border-slate-600'
                                    }`}
                            >
                                <AlertTriangle size={18} />
                                <span>{loteSelecionado.status === 'Aberto' ? 'Anexar NF' : 'NF Já Anexada'}</span>
                            </button>
                            <button
                                onClick={handleExportarCSV}
                                disabled={loadingDetalhe || eventosDoLote.length === 0}
                                className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold shadow-lg transition-colors border border-slate-600"
                            >
                                <FileText size={18} />
                                <span>Exportar XML/CSV</span>
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
                                            <React.Fragment key={evt.id}>
                                                <tr className="hover:bg-slate-700/30 transition-colors">
                                                    <td className="px-4 py-4 text-slate-300 font-mono text-sm border-l-4 border-blue-500 bg-slate-800/40">{evt.data_procedimento}</td>
                                                    <td className="px-4 py-4 font-bold text-white bg-slate-800/40">{evt.paciente_nome}</td>
                                                    <td className="px-4 py-4 text-slate-400 font-mono bg-slate-800/40">{evt.guia || '-'}</td>
                                                    <td className="px-4 py-4 text-slate-400 font-mono bg-slate-800/40">{evt.senha || '-'}</td>
                                                    <td className="px-4 py-4 text-right bg-slate-800/40">
                                                        <span className="font-bold text-emerald-400">R$ {(evt.valor_calculado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    </td>
                                                </tr>
                                                {evt.evento_itens && evt.evento_itens.map(item => (
                                                    <tr key={`item_${item.id}`} className="bg-slate-800/10 hover:bg-slate-800/30 transition-colors text-sm">
                                                        <td colSpan="4" className="px-4 py-2 pl-4 border-l-2 border-slate-600/50 text-slate-400">
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 accent-red-500 cursor-pointer mr-3"
                                                                    checked={selectedGlosasIds.includes(item.id)}
                                                                    onChange={() => setSelectedGlosasIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])}
                                                                />
                                                                <span className="text-slate-500 mr-2">↳</span>
                                                                <span className="font-mono text-xs text-blue-400/70 mr-2">{item.codigo || 'S/C'}</span>
                                                                {item.descricao}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-right">
                                                            <div className="flex items-center justify-end space-x-3">
                                                                <span className="text-slate-300">R$ {Number(item.valor_calculado_item_snapshot).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                {loteSelecionado.status !== 'Cancelado' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setFormGlosa({ motivo_codigo: 'Outros', motivo: '', valor_glosado: '', usar_integral: false });
                                                                            setModalGlosaItems([item]);
                                                                        }}
                                                                        className="text-xs font-bold text-red-400 hover:text-white bg-red-500/20 hover:bg-red-600 px-3 py-1 rounded transition-colors shadow-sm"
                                                                    >
                                                                        Adicionar Glosa
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-900/50 border-t-2 border-slate-700">
                                        {selectedGlosasIds.length > 0 && (
                                            <tr>
                                                <td colSpan="5" className="px-4 py-3 bg-red-900/20 text-center">
                                                    <button
                                                        onClick={() => {
                                                            const itemsParaGlosar = eventosDoLote.flatMap(e => e.evento_itens).filter(i => selectedGlosasIds.includes(i.id));
                                                            setFormGlosa({ motivo_codigo: 'Outros', motivo: '', valor_glosado: '', usar_integral: true });
                                                            setModalGlosaItems(itemsParaGlosar);
                                                        }}
                                                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg transition-colors border border-red-500/50"
                                                    >
                                                        Registrar Glosa em Lote ({selectedGlosasIds.length} selecionados)
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td colSpan="4" className="px-4 py-4 text-right font-bold text-slate-400 uppercase tracking-wider text-sm">
                                                TOTAL DO LOTE:
                                            </td>
                                            <td className="px-4 py-4 text-right font-bold text-emerald-400 text-lg">
                                                R$ {Number(loteSelecionado.valor_total_calculado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </div >
            )
            }

            {/* MODAL DE EMISSÃO DA NOTA FISCAL (Régua de Vencimento) */}
            {
                modalNfAberta && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                                        <FileText className="text-amber-500" />
                                        <span>Vincular Nota Fiscal</span>
                                    </h3>
                                    <p className="text-sm text-slate-400 mt-1">Inicia a régua de cobrança deste Lote.</p>
                                </div>
                                <button onClick={() => setModalNfAberta(false)} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Número da NF</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                                        placeholder="Ex: 2026/0045"
                                        value={formNf.numero_nf}
                                        onChange={e => setFormNf({ ...formNf, numero_nf: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Data Emissão</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-amber-500 outline-none"
                                            value={formNf.data_emissao}
                                            onChange={e => setFormNf({ ...formNf, data_emissao: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-amber-300 mb-1">Data Vencimento</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-900 border border-amber-600/50 rounded-lg p-2.5 text-amber-100 focus:border-amber-500 outline-none"
                                            value={formNf.data_vencimento}
                                            onChange={e => setFormNf({ ...formNf, data_vencimento: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Valor da NF (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-slate-900 border border-emerald-600/50 rounded-lg p-2.5 text-emerald-100 font-medium focus:border-emerald-500 outline-none"
                                        value={formNf.valor_nf}
                                        onChange={e => setFormNf({ ...formNf, valor_nf: e.target.value })}
                                    />
                                    <p className="text-xs text-slate-500 mt-2">O valor acima foi importado do cálculo base do lote ({loteSelecionado?.valor_total_calculado}). Ajuste se houve acréscimos contábeis.</p>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-900 border-t border-slate-700 flex justify-end space-x-3">
                                <button
                                    onClick={() => setModalNfAberta(false)}
                                    className="px-5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSalvarNF}
                                    disabled={loadingNf}
                                    className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center shadow-lg shadow-amber-900/20 transition-colors disabled:opacity-50"
                                >
                                    {loadingNf ? 'Salvando...' : 'Salvar NF e Ativar Régua'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* CONTEÚDO DE GLOSAS (Painel de ROI) */}
            {
                activeTab === 'glosas' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                                <span className="text-sm font-bold text-red-400 uppercase tracking-widest block mb-1">Glosas Ativas</span>
                                <span className="text-3xl font-black text-white">R$ {glosasData.ativas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                                <span className="text-sm font-bold text-blue-400 uppercase tracking-widest block mb-1">Em Recurso</span>
                                <span className="text-3xl font-black text-white">R$ {glosasData.recurso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="bg-slate-800 rounded-xl border border-emerald-900/50 p-6 shadow-[0_0_30px_rgba(16,185,129,0.1)] relative overflow-hidden">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
                                <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest block mb-1 flex items-center"><FileText size={16} className="mr-2" /> ROI Recuperado</span>
                                <span className="text-3xl font-black text-emerald-400">R$ {glosasData.recuperado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                <p className="text-xs text-slate-400 mt-2 font-medium">Lucro real salvo da lixeira este ano.</p>
                            </div>
                        </div>

                        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                            {glosasData.lista.length === 0 ? (
                                <div className="p-16 text-center flex flex-col items-center">
                                    <AlertTriangle size={64} className="text-emerald-500/20 mb-4" />
                                    <h3 className="text-2xl font-bold text-slate-300 mb-2">Painel de Retenção de Glosas Aberto</h3>
                                    <p className="text-slate-500 max-w-lg mb-6">O motor de glosas permite sinalizar itens recusados no momento da baixa de Lotes ou Notas Fiscais parciais. Você não tem nenhuma glosa registrada.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-700/50 text-slate-300 text-xs uppercase tracking-wider">
                                                <th className="px-4 py-4 font-semibold">Data da Glosa</th>
                                                <th className="px-4 py-4 font-semibold">Motivo</th>
                                                <th className="px-4 py-4 font-semibold text-right">Valor Retido</th>
                                                <th className="px-4 py-4 font-semibold text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {glosasData.lista.map(g => (
                                                <tr key={g.id} className="hover:bg-slate-700/30 transition-colors">
                                                    <td className="px-4 py-4 text-slate-300 font-mono text-sm">{new Date(g.data_identificacao + 'T12:00:00Z').toLocaleDateString('pt-BR')}</td>
                                                    <td className="px-4 py-4 font-bold text-slate-300 max-w-[300px] truncate" title={g.motivo_glosa_descricao}>
                                                        <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 mr-2">{g.motivo_glosa_codigo}</span>
                                                        {g.motivo_glosa_descricao}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <span className="font-bold text-red-400">R$ {Number(g.valor_glosado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <span className={`text-xs font-bold px-2 py-1 rounded border ${g.status_recurso === 'aberta' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                                {g.status_recurso.toUpperCase()}
                                                            </span>
                                                            {g.status_recurso === 'aberta' && (
                                                                <button onClick={() => handleReverterGlosa(g.id)} className="text-slate-400 hover:text-red-400 transition-colors p-1" title="Reverter/Excluir Glosa">
                                                                    <X className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* MODAL DE GLOSA */}
            {
                modalGlosaItems && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                        <div className="bg-slate-800 rounded-2xl border border-red-900 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-red-900/20">
                                <div>
                                    <h3 className="text-xl font-bold text-red-400 flex items-center space-x-2">
                                        <AlertTriangle />
                                        <span>{modalGlosaItems.length > 1 ? `Glosa em Lote (${modalGlosaItems.length} Itens)` : `Registrar Glosa - Item ${modalGlosaItems[0].codigo || ''}`}</span>
                                    </h3>
                                    <p className="text-sm text-slate-300 mt-1 truncate">{modalGlosaItems.length > 1 ? 'Múltiplos itens selecionados' : modalGlosaItems[0].descricao}</p>
                                </div>
                                <button onClick={() => setModalGlosaItems(null)} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Motivo Padrão (Codificação TISS)</label>
                                        <select
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-red-500 outline-none"
                                            value={formGlosa.motivo_codigo}
                                            onChange={e => setFormGlosa({ ...formGlosa, motivo_codigo: e.target.value })}
                                        >
                                            <option value="1701">1701 - Senha Inválida / Vencida</option>
                                            <option value="1006">1006 - Ausência de Assinatura do Beneficiário</option>
                                            <option value="2504">2504 - Cobrança Indevida / Duplicada</option>
                                            <option value="1013">1013 - Falta de Parecer Técnico</option>
                                            <option value="1015">1015 - Identificação do Profissional Executante Inválida</option>
                                            <option value="1710">1710 - Procedimento Sem Cobertura</option>
                                            <option value="Outros">Outros / Motivo Desconhecido</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Descrição Detalhada / Parecer da Glosa *</label>
                                    <textarea
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-red-500 outline-none min-h-[80px]"
                                        placeholder="Detalhes adicionais para o recurso..."
                                        value={formGlosa.motivo}
                                        onChange={e => setFormGlosa({ ...formGlosa, motivo: e.target.value })}
                                    />
                                </div>

                                {modalGlosaItems.length > 1 ? (
                                    <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-lg">
                                        <label className="flex items-center space-x-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formGlosa.usar_integral}
                                                onChange={e => setFormGlosa({ ...formGlosa, usar_integral: e.target.checked })}
                                                className="w-5 h-5 rounded border-red-500 bg-slate-900 accent-red-500"
                                            />
                                            <span className="text-white font-medium">Glosar <span className="text-red-400 uppercase font-black tracking-widest">Valor Integral</span> dos itens.</span>
                                        </label>
                                        <p className="text-xs text-slate-400 mt-2 ml-8">Ao marcar, o Gestcon extrairá o valor original (faturado) de cada item automaticamente como valor retido.</p>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Valor Glosado (Retido) *</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                disabled={formGlosa.usar_integral}
                                                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 p-2.5 text-white focus:border-red-500 outline-none disabled:opacity-50"
                                                placeholder="0.00"
                                                value={formGlosa.valor_glosado}
                                                onChange={e => setFormGlosa({ ...formGlosa, valor_glosado: e.target.value })}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">
                                            Lançado para este item: R$ {Number(modalGlosaItems[0].valor_calculado_item_snapshot).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            <button
                                                onClick={() => setFormGlosa({ ...formGlosa, valor_glosado: modalGlosaItems[0].valor_calculado_item_snapshot })}
                                                className="text-blue-400 ml-2 hover:underline"
                                            >
                                                Preencher Total
                                            </button>
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-slate-900 border-t border-slate-700 flex justify-end space-x-3">
                                <button onClick={() => setModalGlosaItems(null)} className="px-4 py-2 font-medium text-slate-300 hover:text-white transition-colors">Cancelar</button>
                                <button
                                    onClick={handleSalvarGlosa}
                                    disabled={!formGlosa.motivo || (!formGlosa.usar_integral && !formGlosa.valor_glosado && modalGlosaItems.length === 1) || (modalGlosaItems.length > 1 && !formGlosa.usar_integral)}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg shadow-red-900/40 disabled:opacity-50 transition-colors"
                                >
                                    Confirmar Glosa
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
