import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { FileText, CalendarCheck, AlertTriangle, ArrowRight, MessageSquare, Plus, X, Activity } from 'lucide-react'

export default function NotasFiscais() {
    const [activeTab, setActiveTab] = useState('abertos') // 'abertos' ou 'regua'
    const [empresaId, setEmpresaId] = useState(null)
    const [userId, setUserId] = useState(null)
    const [authLoaded, setAuthLoaded] = useState(false)
    const [convenios, setConvenios] = useState([])

    // Lotes state
    const [todosLotes, setTodosLotes] = useState([])
    const [filtroStatus, setFiltroStatus] = useState('Todos') // Todos, Aguardando NF, A Receber, Atrasados, Recebidos
    const [loading, setLoading] = useState(true)

    // Modal NF state
    const [modalNfAberta, setModalNfAberta] = useState(false)
    const [loteParaNf, setLoteParaNf] = useState(null)
    const [formNf, setFormNf] = useState({ numero_nf: '', data_emissao: new Date().toISOString().split('T')[0], valor_nf: '', data_vencimento: '' })
    const [submittingNf, setSubmittingNf] = useState(false)

    // Regua / Detalhe State
    const [loteReguaSelecionado, setLoteReguaSelecionado] = useState(null)
    const [historicoRegua, setHistoricoRegua] = useState([])
    const [loadingHistorico, setLoadingHistorico] = useState(false)
    const [novoFollowUp, setNovoFollowUp] = useState('')
    const [statusRegua, setStatusRegua] = useState('Contato Inicial')
    const [submittingFollowUp, setSubmittingFollowUp] = useState(false)

    // Baixa Financeira State
    const [modalBaixaAberta, setModalBaixaAberta] = useState(false)
    const [formBaixa, setFormBaixa] = useState({ valor_recebido: '', valor_glosado: '0', data_recebimento: new Date().toISOString().split('T')[0], acao_saldo: 'manter_aberto' })
    const [submittingBaixa, setSubmittingBaixa] = useState(false)

    // Init
    useEffect(() => {
        const getSessionAndEmpresa = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
                if (session.user.user_metadata?.empresa_id) {
                    setEmpresaId(session.user.user_metadata.empresa_id);
                }
            }
            setAuthLoaded(true);
        };
        getSessionAndEmpresa();
    }, []);

    // Fetcher
    useEffect(() => {
        if (!authLoaded) return;
        fetchBaseData();
    }, [authLoaded, empresaId]);

    const fetchBaseData = async () => {
        setLoading(true);
        try {
            // Convênios para o nome
            const { data: convData } = await supabase.from('convenios').select('id, nome');
            setConvenios(convData || []);

            // Busca os lotes mistos
            let query = supabase.from('faturamento_lotes')
                .select(`
                    *,
                    notas_fiscais(numero_nf, data_emissao, valor_nf)
                `)
                .order('created_at', { ascending: false });

            if (empresaId) query = query.eq('empresa_id', empresaId);

            const { data: lotesData, error } = await query;
            if (error) throw error;

            setTodosLotes(lotesData || []);
        } catch (error) {
            console.error('Erro ao buscar lotes para NF:', error);
        } finally {
            setLoading(false);
        }
    }

    // Handlers de NF
    const openModalNf = (lote) => {
        setLoteParaNf(lote);
        setFormNf(prev => ({
            ...prev,
            valor_nf: Number(lote.valor_total_calculado).toFixed(2),
            numero_nf: '',
            data_vencimento: ''
        }));
        setModalNfAberta(true);
    }

    const handleSalvarNF = async () => {
        if (!formNf.numero_nf || !formNf.valor_nf || !formNf.data_vencimento) {
            alert('Preencha Número da NF, Valor e Vencimento para iniciar a régua.');
            return;
        }

        setSubmittingNf(true);
        try {
            // 1. Cria a nota fiscal
            const { error: errNf } = await supabase.from('notas_fiscais').insert([{
                empresa_id: empresaId || null,
                faturamento_lote_id: loteParaNf.id,
                numero_nf: formNf.numero_nf,
                data_emissao: formNf.data_emissao,
                valor_nf: parseFloat(formNf.valor_nf)
            }]);

            if (errNf) throw errNf;

            // 2. Atualiza o Lote engatilhando a Régua de Cobrança
            const { error: errLote } = await supabase.from('faturamento_lotes').update({
                status: 'Aguardando Pagamento',
                data_vencimento: formNf.data_vencimento
            }).eq('id', loteParaNf.id);

            if (errLote) throw errLote;

            // 3. (Opcional) Cria o primeiro follow_up automático da Régua
            await supabase.from('cobranca_follow_up').insert([{
                empresa_id: empresaId || null,
                user_id: userId,
                faturamento_lote_id: loteParaNf.id,
                data_contato: new Date().toISOString(),
                status: 'Nota Emitida',
                tipo_contato: 'Sistema',
                anotacao: `Nota Fiscal ${formNf.numero_nf} vinculada ao lote. Vencimento em ${new Date(formNf.data_vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}.`
            }]);

            setModalNfAberta(false);
            setLoteParaNf(null);
            fetchBaseData();
            setFiltroStatus('A Receber'); // Move o foco para a nota recém emitida
        } catch (e) {
            console.error(e);
            alert('Erro ao salvar Nota Fiscal.');
        } finally {
            setSubmittingNf(false);
        }
    }

    // Handlers da Régua de Cobrança
    const handleAbrirRegua = async (lote) => {
        setLoteReguaSelecionado(lote);
        setLoadingHistorico(true);
        try {
            const { data, error } = await supabase
                .from('cobranca_follow_up')
                .select('*')
                .eq('faturamento_lote_id', lote.id)
                .order('data_contato', { ascending: false });

            if (error) throw error;
            setHistoricoRegua(data || []);
        } catch (error) {
            console.error('Falha ao carregar historico:', error);
        } finally {
            setLoadingHistorico(false);
        }
    }

    const handleSalvarFollowUp = async () => {
        if (!novoFollowUp) return;
        setSubmittingFollowUp(true);
        try {
            const { error } = await supabase.from('cobranca_follow_up').insert([{
                empresa_id: empresaId || null,
                user_id: userId,
                faturamento_lote_id: loteReguaSelecionado.id,
                data_contato: new Date().toISOString(),
                status: statusRegua,
                tipo_contato: 'Interação Manual',
                anotacao: novoFollowUp
            }]);

            if (error) throw error;

            setNovoFollowUp('');
            handleAbrirRegua(loteReguaSelecionado); // refresh historico
        } catch (error) {
            console.error('Erro ao registrar histórico:', error);
            alert(`Falha ao salvar a interação: ${error?.message || error?.details || 'Erro desconhecido'}`);
        } finally {
            setSubmittingFollowUp(false);
        }
    }

    const abrirModalBaixa = () => {
        // Calcula o saldo restante baseado no que já foi recebido/glosado
        const totalCalculado = Number(loteReguaSelecionado.valor_total_calculado || 0);
        const jaRecebido = Number(loteReguaSelecionado.valor_recebido || 0);
        const jaGlosado = Number(loteReguaSelecionado.valor_glosado || 0);
        const saldoPendente = totalCalculado - jaRecebido - jaGlosado;

        setFormBaixa({
            valor_recebido: saldoPendente > 0 ? saldoPendente.toFixed(2) : '0.00',
            valor_glosado: '0.00',
            data_recebimento: new Date().toISOString().split('T')[0],
            acao_saldo: 'manter_aberto' // 'manter_aberto' ou 'glosa_definitiva'
        });
        setModalBaixaAberta(true);
    };

    const handleConfirmarBaixa = async () => {
        if (!formBaixa.valor_recebido || !formBaixa.data_recebimento) {
            alert('Preencha pelo menos o valor recebido e a data.');
            return;
        }

        setSubmittingBaixa(true);
        try {
            const vlrRecebidoInput = Number(formBaixa.valor_recebido);

            // Lote atual
            const totalCalculado = Number(loteReguaSelecionado.valor_total_calculado || 0);
            const jaRecebido = Number(loteReguaSelecionado.valor_recebido || 0);
            const jaGlosado = Number(loteReguaSelecionado.valor_glosado || 0);
            const saldoAnterior = totalCalculado - jaRecebido - jaGlosado;

            let novoRecebido = jaRecebido + vlrRecebidoInput;
            let novoGlosado = jaGlosado;
            let novoStatus = loteReguaSelecionado.status;
            let saldoRestante = saldoAnterior - vlrRecebidoInput;

            let observacaoAcao = `Recebimento de R$ ${vlrRecebidoInput.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;

            if (saldoRestante <= 0.01) {
                // Pagou tudo o que faltava
                novoStatus = 'Liquidado';
                observacaoAcao += ' Lote totalmente liquidado.';
            } else {
                // Pagou a menos
                if (formBaixa.acao_saldo === 'glosa_definitiva') {
                    // O que faltou é glosa
                    const vlrGlosadoInput = Number(formBaixa.valor_glosado) || saldoRestante; // Tenta pegar do input, senao pega o saldo
                    novoGlosado += vlrGlosadoInput;
                    novoStatus = 'Liquidado'; // Fechou tudo com glosa
                    observacaoAcao += ` Diferença de R$ ${vlrGlosadoInput.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} lançada como GLOSA DEFINITIVA. Lote encerrado.`;
                } else {
                    // Continua em aberto
                    novoStatus = 'Parcialmente Recebido';
                    observacaoAcao += ` Resta um saldo de R$ ${saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em aberto na Régua.`;
                }
            }

            // 1. Atualiza Lote
            await supabase.from('faturamento_lotes').update({
                status: novoStatus,
                data_pagamento: formBaixa.data_recebimento,
                valor_recebido: novoRecebido,
                valor_glosado: novoGlosado
            }).eq('id', loteReguaSelecionado.id);

            // 2. Se Liquidou, atualiza Eventos
            if (novoStatus === 'Liquidado') {
                await supabase.from('eventos').update({ status_faturamento: 'Pago' }).eq('faturamento_lote_id', loteReguaSelecionado.id);
            }

            // 3. Insere Follow Up
            await supabase.from('cobranca_follow_up').insert([{
                empresa_id: empresaId || null,
                user_id: userId,
                faturamento_lote_id: loteReguaSelecionado.id,
                data_contato: new Date().toISOString(),
                status: novoStatus === 'Liquidado' ? 'Liquidado' : 'Recebido Parcialmente',
                tipo_contato: 'Sistema',
                anotacao: observacaoAcao
            }]);

            setModalBaixaAberta(false);
            setLoteReguaSelecionado(null);
            fetchBaseData();
        } catch (error) {
            console.error('Falha na Liquidação:', error);
            alert('Falha interna ao liquidar recebimento.');
        } finally {
            setSubmittingBaixa(false);
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
                        <FileText className="text-blue-500" size={32} />
                        <span>Notas Fiscais & Recebíveis</span>
                    </h2>
                    <p className="text-slate-400 mt-2">Atrele Notas Fiscais aos seus lotes TISS e controle a Régua de Cobrança passo a passo.</p>
                </div>
            </div>

            {/* FILTROS E LISTA UNIFICADA */}
            {!loteReguaSelecionado && (
                <div className="flex flex-col space-y-4">
                    {/* Botoes de Filtro */}
                    <div className="flex flex-wrap gap-2 w-full">
                        {['Todos', 'Aguardando NF', 'A Receber', 'Atrasados', 'Recebidos'].map((filtro) => (
                            <button
                                key={filtro}
                                onClick={() => setFiltroStatus(filtro)}
                                className={`py-1.5 px-4 rounded-full font-medium text-sm transition-all border ${filtroStatus === filtro
                                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-sm'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300 hover:bg-slate-700/50'
                                    }`}
                            >
                                {filtro}
                            </button>
                        ))}
                    </div>

                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl p-4 md:p-6">
                        {loading ? (
                            <div className="p-12 text-center text-slate-400 font-mono">Aplicando filtros...</div>
                        ) : (
                            <div className="space-y-4">
                                {(() => {
                                    const todayStr = new Date().toISOString().split('T')[0];

                                    let filtrados = todosLotes.filter(lote => {
                                        const podeAtrasar = lote.status === 'Aguardando Pagamento' || lote.status === 'Parcialmente Recebido';
                                        const isAtrasado = podeAtrasar && lote.data_vencimento && lote.data_vencimento < todayStr;
                                        const isAReceber = podeAtrasar && (!lote.data_vencimento || lote.data_vencimento >= todayStr);

                                        if (filtroStatus === 'Aguardando NF') return lote.status === 'Aberto';
                                        if (filtroStatus === 'A Receber') return isAReceber;
                                        if (filtroStatus === 'Atrasados') return isAtrasado;
                                        if (filtroStatus === 'Recebidos') return lote.status === 'Liquidado' || lote.status === 'Parcialmente Recebido';
                                        return true; // Todos
                                    });

                                    if (filtrados.length === 0) {
                                        return (
                                            <div className="p-16 text-center">
                                                <Activity size={48} className="mx-auto text-slate-600 mb-4" />
                                                <h3 className="text-xl font-bold text-slate-300">Nenhuma Nota Encontrada</h3>
                                                <p className="text-slate-500 mt-2">Nenhum lote corresponde ao filtro selecionado ({filtroStatus}).</p>
                                            </div>
                                        );
                                    }

                                    return filtrados.map(lote => {
                                        const nfData = lote.notas_fiscais?.[0] || {};
                                        const isLiquidado = lote.status === 'Liquidado';
                                        const isAberto = lote.status === 'Aberto';
                                        const isParcial = lote.status === 'Parcialmente Recebido';

                                        const podeAtrasar = lote.status === 'Aguardando Pagamento' || lote.status === 'Parcialmente Recebido';
                                        const isAtrasado = podeAtrasar && lote.data_vencimento && lote.data_vencimento < todayStr;

                                        const valorEmAberto = Number((lote.valor_total_calculado || 0) - (lote.valor_recebido || 0) - (lote.valor_glosado || 0));
                                        const valorJaRecebido = Number(lote.valor_recebido || 0);

                                        // Definindo estilo baseado no status
                                        let bgClass = 'bg-slate-900 border-slate-700 hover:border-blue-500/50';
                                        let badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                                        let badgeText = lote.status;
                                        let valueColorClass = 'text-amber-400';

                                        if (isAberto) {
                                            bgClass = 'bg-slate-900 border-slate-700 hover:border-amber-500/50 border-l-2 border-l-amber-500/50';
                                            badgeClass = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                                            badgeText = 'Aguardando NF';
                                        } else if (isLiquidado) {
                                            bgClass = 'bg-emerald-900/10 border-emerald-500/20 hover:border-emerald-500/50';
                                            badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                                            valueColorClass = 'text-emerald-500';
                                        } else if (isParcial) {
                                            if (filtroStatus === 'Recebidos') {
                                                bgClass = 'bg-teal-900/10 border-teal-500/20 hover:border-teal-500/50';
                                                badgeClass = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
                                                valueColorClass = 'text-teal-400';
                                            } else {
                                                bgClass = 'bg-blue-900/10 border-blue-500/20 hover:border-blue-500/50';
                                                badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                                            }
                                        }

                                        if (isAtrasado && filtroStatus !== 'Recebidos') {
                                            bgClass = 'bg-red-900/10 border-red-500/30 hover:border-red-500/60';
                                            badgeClass = 'bg-red-500/10 text-red-400 border-red-500/30 font-black animate-pulse';
                                            badgeText = isParcial ? 'Atrasado (Parcial)' : 'Atrasado';
                                            valueColorClass = 'text-red-400';
                                        }

                                        return (
                                            <div
                                                key={lote.id}
                                                onClick={() => {
                                                    if (isAberto) openModalNf(lote);
                                                    else handleAbrirRegua(lote);
                                                }}
                                                className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${bgClass}`}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3 mb-1">
                                                        <h4 className="font-bold text-white text-lg">{convenios.find(c => c.id === lote.convenio_id)?.nome || 'Convênio N/A'}</h4>
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${badgeClass}`}>
                                                            {badgeText}
                                                        </span>
                                                        {Number(lote.valor_glosado) > 0 && (
                                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border bg-red-500/10 text-red-500 border-red-500/20">
                                                                C/ Restrição
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-y-2 space-x-6 text-sm">
                                                        <span className="text-slate-400">Lote <span className="text-slate-300 font-mono">{lote.codigo_lote}</span></span>
                                                        {isAberto ? (
                                                            <span className="text-amber-500/70 font-bold font-mono text-xs mt-0.5">Clique para Anexar NF</span>
                                                        ) : (
                                                            <span className="text-slate-400">NF <span className="text-blue-400 font-mono font-bold">Nº {nfData.numero_nf || 'S/N'}</span></span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4 md:mt-0 flex flex-col md:items-end w-48 shrink-0">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-slate-500 mb-1">
                                                            {isAberto ? 'Valor Total do Lote' :
                                                                (filtroStatus === 'Recebidos' || isLiquidado) ? 'Valor Já Recebido' :
                                                                    'Saldo Faltante'}
                                                        </span>
                                                        <span className={`font-black text-xl ${valueColorClass}`}>
                                                            R$ {isAberto ? Number(lote.valor_total_calculado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) :
                                                                (filtroStatus === 'Recebidos' || isLiquidado) ? valorJaRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) :
                                                                    valorEmAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-4 md:mt-0 md:ml-6 flex items-center justify-between md:justify-end md:w-32 shrink-0 border-t md:border-t-0 border-slate-800 pt-3 md:pt-0">
                                                    {!isAberto && (
                                                        <div className="flex flex-col mr-4">
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Vencimento</span>
                                                            <span className={`${isAtrasado ? 'text-red-400' : 'text-slate-300'} font-bold`}>
                                                                {lote.data_vencimento ? new Date(lote.data_vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Sem Prazo'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isAberto ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white transition-colors' : 'bg-slate-800 text-slate-400'}`}>
                                                        {isAberto ? <Plus size={16} strokeWidth={3} /> : <ArrowRight size={14} />}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ABA: RÉGUA DE COBRANÇA (DETALHE CRM) */}
            {loteReguaSelecionado && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <button
                        onClick={() => setLoteReguaSelecionado(null)}
                        className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowRight size={16} className="rotate-180" />
                        <span>Voltar para Lista de Cobranças</span>
                    </button>

                    {/* Cabecalho Detalhe */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div>
                            <div className="flex items-center space-x-3">
                                <h3 className="text-2xl font-bold text-white mb-1">
                                    Lote: {loteReguaSelecionado.codigo_lote}
                                </h3>
                                <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-xs font-bold uppercase">
                                    {convenios.find(c => c.id === loteReguaSelecionado.convenio_id)?.nome}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-4">
                                <span className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-300">
                                    Total Lote: <strong className="text-emerald-400 font-mono">R$ {Number(loteReguaSelecionado.valor_total_calculado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                </span>
                                <span className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-300">
                                    Pago: <strong className="text-blue-400 font-mono">R$ {Number(loteReguaSelecionado.valor_recebido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                </span>
                                {Number(loteReguaSelecionado.valor_glosado) > 0 && (
                                    <span className="bg-red-900/10 border border-red-500/20 px-3 py-1.5 rounded-lg text-sm text-red-400 font-bold animate-pulse">
                                        Glosa Consolidada: <strong className="font-mono">R$ {Number(loteReguaSelecionado.valor_glosado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                    </span>
                                )}
                                <span className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-400 mt-1 sm:mt-0">
                                    Venc: <strong className="text-amber-400">{loteReguaSelecionado.data_vencimento ? new Date(loteReguaSelecionado.data_vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'N/A'}</strong>
                                </span>
                            </div>
                        </div>

                        {loteReguaSelecionado.status !== 'Liquidado' && (
                            <button
                                onClick={abrirModalBaixa}
                                className="mt-4 md:mt-0 flex items-center space-x-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-900/40 transition-colors"
                            >
                                <CalendarCheck size={18} />
                                <span>Dar Baixa Financeira</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Feed da Régua Timeline */}
                        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl flex flex-col h-[500px]">
                            <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
                                <h4 className="font-bold text-white flex items-center space-x-2">
                                    <Activity size={18} className="text-blue-400" />
                                    <span>Histórico da Cobrança</span>
                                </h4>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto space-y-6">
                                {loadingHistorico ? (
                                    <div className="text-center text-slate-500 py-10">Carregando interações...</div>
                                ) : historicoRegua.length === 0 ? (
                                    <div className="text-center text-slate-500 py-10 border border-dashed border-slate-700 rounded-lg">Sem histórico registrado.</div>
                                ) : (
                                    <div className="relative border-l-2 border-slate-700 ml-3 space-y-8">
                                        {historicoRegua.map((item, idx) => (
                                            <div key={item.id} className="relative pl-6">
                                                <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-4 border-slate-800 ${idx === 0 ? 'bg-blue-500' : 'bg-slate-500'}`}></div>
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <span className="font-bold text-slate-200 text-sm">{item.status || item.tipo_contato}</span>
                                                    <span className="text-xs text-slate-500 font-mono">{new Date(item.data_contato).toLocaleString('pt-BR')}</span>
                                                </div>
                                                <div className="bg-slate-900/50 rounded-lg p-3 text-sm text-slate-300 border border-slate-700/50 mt-2">
                                                    {item.anotacao}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Formulário Novo Follow-up */}
                        {loteReguaSelecionado.status !== 'Liquidado' && (
                            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl flex flex-col h-[500px]">
                                <div className="p-4 bg-slate-800/80 border-b border-slate-700">
                                    <h4 className="font-bold text-white flex items-center space-x-2">
                                        <MessageSquare size={18} className="text-amber-400" />
                                        <span>Registrar Interação</span>
                                    </h4>
                                </div>
                                <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Classificação do Contato</label>
                                        <select
                                            value={statusRegua}
                                            onChange={(e) => setStatusRegua(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 h-10"
                                        >
                                            <option value="Contato Inicial">Contato Inicial</option>
                                            <option value="Cobrança 1º Aviso">Cobrança 1º Aviso</option>
                                            <option value="Cobrança 2º Aviso">Cobrança 2º Aviso</option>
                                            <option value="Aguardando Retorno">Aguardando Retorno do Convênio</option>
                                            <option value="Promessa de Pagamento">Promessa de Pagamento Recebida</option>
                                            <option value="Glosa Sinalizada">Glosa Sinalizada pelo Convênio</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Resumo da Conversa/Ação</label>
                                        <textarea
                                            value={novoFollowUp}
                                            onChange={(e) => setNovoFollowUp(e.target.value)}
                                            placeholder="Ex: Falei com a atendente Maria que confirmou a recepção da NF e prometeu pagamento para o dia 10."
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 h-32 resize-none"
                                        ></textarea>
                                    </div>

                                    <button
                                        onClick={handleSalvarFollowUp}
                                        disabled={!novoFollowUp || submittingFollowUp}
                                        className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-lg transition-colors mt-auto"
                                    >
                                        <Plus size={18} />
                                        <span>Salvar Interação</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {/* MODAL ANEXAR NF */}
            {modalNfAberta && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-700 relative">
                            <button onClick={() => setModalNfAberta(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                            <h3 className="text-xl font-bold flex items-center space-x-2 text-white">
                                <FileText className="text-amber-500" size={24} />
                                <span>Emitir/Vincular NF</span>
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">
                                Inicia a régua de cobrança deste Lote.
                            </p>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-1.5">Número da NF Oficial</label>
                                <input
                                    type="text"
                                    value={formNf.numero_nf}
                                    onChange={e => setFormNf({ ...formNf, numero_nf: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="Ex: 2026/0045"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-1.5">Data Emissão</label>
                                    <input
                                        type="date"
                                        value={formNf.data_emissao}
                                        onChange={e => setFormNf({ ...formNf, data_emissao: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-amber-500 mb-1.5">Data Vencimento</label>
                                    <input
                                        type="date"
                                        value={formNf.data_vencimento}
                                        onChange={e => setFormNf({ ...formNf, data_vencimento: e.target.value })}
                                        className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-1.5">Valor da NF (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formNf.valor_nf}
                                    onChange={e => setFormNf({ ...formNf, valor_nf: e.target.value })}
                                    className="w-full bg-slate-900 border border-emerald-500/30 rounded-lg px-4 py-2.5 text-emerald-400 font-bold font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="0.00"
                                />
                                <p className="text-[11px] text-slate-500 mt-2">
                                    O valor acima foi estipulado com base no lote ({parseFloat(loteParaNf?.valor_total_calculado || 0).toFixed(2)}). Ajuste se houve acréscimos contábeis antes da emissão.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-900 border-t border-slate-700 flex justify-end space-x-3">
                            <button
                                onClick={() => setModalNfAberta(false)}
                                className="px-5 py-2.5 rounded-lg font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSalvarNF}
                                disabled={submittingNf}
                                className="px-5 py-2.5 rounded-lg font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-900/20 transition-all disabled:opacity-50"
                            >
                                {submittingNf ? 'Salvando...' : 'Salvar NF e Ativar Régua'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* MODAL BAIXA FINANCEIRA */}
            {modalBaixaAberta && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-700 relative">
                            <button onClick={() => setModalBaixaAberta(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                            <h3 className="text-xl font-bold flex items-center space-x-2 text-emerald-500">
                                <CalendarCheck size={24} />
                                <span>Baixa de Recebimento</span>
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">
                                Informe o valor que efetivamente entrou na conta da clínica.
                            </p>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-1.5">Data do Pagamento no Banco</label>
                                <input
                                    type="date"
                                    value={formBaixa.data_recebimento}
                                    onChange={e => setFormBaixa({ ...formBaixa, data_recebimento: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all [color-scheme:dark]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-1.5">Valor Recebido da Operadora (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formBaixa.valor_recebido}
                                    onChange={e => setFormBaixa({ ...formBaixa, valor_recebido: e.target.value })}
                                    className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg px-4 py-3 text-emerald-400 text-xl font-black font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                />
                                <div className="text-xs text-slate-400 mt-2 flex justify-between">
                                    <span>Saldo Antes: R$ {Number((loteReguaSelecionado?.valor_total_calculado || 0) - (loteReguaSelecionado?.valor_recebido || 0) - (loteReguaSelecionado?.valor_glosado || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {Number(formBaixa.valor_recebido) < Number((loteReguaSelecionado?.valor_total_calculado || 0) - (loteReguaSelecionado?.valor_recebido || 0) - (loteReguaSelecionado?.valor_glosado || 0)) - 0.05 && (
                                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4 animate-in slide-in-from-top-2">
                                    <p className="text-sm text-amber-500 font-bold mb-3">O valor recebido é menor que o saldo. E a diferença?</p>

                                    <div className="space-y-3">
                                        <label className="flex items-start space-x-3 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="acao_saldo"
                                                value="manter_aberto"
                                                checked={formBaixa.acao_saldo === 'manter_aberto'}
                                                onChange={e => setFormBaixa({ ...formBaixa, acao_saldo: e.target.value })}
                                                className="mt-1 bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                                            />
                                            <div>
                                                <span className="block text-sm font-medium text-slate-300 group-hover:text-amber-400 transition-colors">Manter Restante na Régua em Aberto</span>
                                                <span className="block text-xs text-slate-500">O convênio fará depósitos fracionados. Cobre o restante.</span>
                                            </div>
                                        </label>

                                        <label className="flex items-start space-x-3 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="acao_saldo"
                                                value="glosa_definitiva"
                                                checked={formBaixa.acao_saldo === 'glosa_definitiva'}
                                                onChange={e => setFormBaixa({ ...formBaixa, acao_saldo: e.target.value })}
                                                className="mt-1 bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
                                            />
                                            <div>
                                                <span className="block text-sm font-medium text-slate-300 group-hover:text-rose-400 transition-colors">É uma Glosa Definitiva. Cortaram o valor.</span>
                                                <span className="block text-xs text-slate-500">Liquida o Lote e envia a diferença para as perdas (Glosa).</span>
                                            </div>
                                        </label>
                                    </div>

                                    {formBaixa.acao_saldo === 'glosa_definitiva' && (
                                        <div className="mt-4 pt-4 border-t border-amber-500/20">
                                            <label className="block text-xs font-bold text-rose-400 mb-1.5">Valor Declarado como Glosa (R$)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formBaixa.valor_glosado}
                                                onChange={e => setFormBaixa({ ...formBaixa, valor_glosado: e.target.value })}
                                                className="w-full bg-slate-950 border border-rose-500/50 rounded-lg px-3 py-2 text-rose-400 font-mono focus:ring-2 focus:ring-rose-500"
                                            />
                                            <span className="block text-[10px] text-slate-500 mt-1">Por padrão puxamos 100% da diferença, mas ajuste se necessário.</span>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        <div className="p-4 bg-slate-900 border-t border-slate-700 flex justify-end space-x-3">
                            <button
                                onClick={() => setModalBaixaAberta(false)}
                                className="px-5 py-2.5 rounded-lg font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleConfirmarBaixa}
                                disabled={submittingBaixa}
                                className="px-5 py-2.5 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 flex items-center space-x-2"
                            >
                                {submittingBaixa ? 'Processando...' : 'Confirmar Baixa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
