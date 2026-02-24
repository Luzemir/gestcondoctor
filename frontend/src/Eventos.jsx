import React, { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { ClipboardList, Search, Edit2, Trash2, Filter, Eye, Paperclip, UploadCloud, X, FileText, Download, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Save } from 'lucide-react'
import NovoEventoMedico from './NovoEventoMedico'

export default function Eventos() {
    const [eventos, setEventos] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Anexos Modal State
    const [isAnexosModalOpen, setIsAnexosModalOpen] = useState(false)
    const [eventoSelecionado, setEventoSelecionado] = useState(null)
    const [anexos, setAnexos] = useState([])
    const [loadingAnexos, setLoadingAnexos] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef(null)

    // Edição e Detalhes Modals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editFormData, setEditFormData] = useState({})
    const [savingEdit, setSavingEdit] = useState(false)

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
    const [detalhesItens, setDetalhesItens] = useState([])
    const [loadingDetalhes, setLoadingDetalhes] = useState(false)

    // Ordenação
    const [sortConfig, setSortConfig] = useState({ key: 'data_procedimento', direction: 'desc' })

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

    const filteredEventos = useMemo(() => {
        let sorted = [...eventos];

        // 1. Filtragem por busca
        if (searchTerm) {
            sorted = sorted.filter(ev =>
                ev.paciente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ev.guia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                conveniosCache[ev.convenio_id]?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // 2. Ordenação
        sorted.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            // Tratamento especial para lookup fields
            if (sortConfig.key === 'convenio') {
                valA = conveniosCache[a.convenio_id] || '';
                valB = conveniosCache[b.convenio_id] || '';
            } else if (sortConfig.key === 'hospital') {
                valA = hospitaisCache[a.hospital_id] || '';
                valB = hospitaisCache[b.hospital_id] || '';
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [eventos, searchTerm, sortConfig, conveniosCache, hospitaisCache]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    }

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="opacity-30 inline-block ml-1" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="text-blue-400 inline-block ml-1" />
            : <ArrowDown size={14} className="text-blue-400 inline-block ml-1" />;
    };

    const handleOpenEdit = (ev) => {
        setEventoSelecionado(ev)
        setIsEditModalOpen(true)
    }

    const handleOpenDetails = (ev) => {
        setEventoSelecionado(ev)
        setIsDetailsModalOpen(true)
    }

    const fecharModaisEErregarTable = () => {
        setIsEditModalOpen(false)
        setIsDetailsModalOpen(false)
        fetchData() // Recarrega os dados caso tenha havido edição
    }

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

    const handleOpenAnexos = async (ev) => {
        setEventoSelecionado(ev)
        setIsAnexosModalOpen(true)
        fetchAnexos(ev.id)
    }

    const fetchAnexos = async (eventoId) => {
        setLoadingAnexos(true)
        const { data, error } = await supabase
            .from('evento_anexos')
            .select('*')
            .eq('evento_id', eventoId)
            .order('created_at', { ascending: false })

        if (data) setAnexos(data)
        if (error) console.error(error)
        setLoadingAnexos(false)
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${eventoSelecionado.id}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`

            // 1. Upload to Storage
            const { error: uploadError, data: uploadData } = await supabase.storage
                .from('eventos_anexos')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            // 2. Get Public URL
            const { data: publicUrlData } = supabase.storage
                .from('eventos_anexos')
                .getPublicUrl(fileName)

            // 3. Insert into Database
            const { error: dbError } = await supabase
                .from('evento_anexos')
                .insert([{
                    evento_id: eventoSelecionado.id,
                    file_path: fileName,
                    file_url: publicUrlData.publicUrl,
                    nome_original: file.name,
                    tamanho_bytes: file.size,
                    tipo_documento: 'Guia/Relatório'
                }])

            if (dbError) throw dbError

            fetchAnexos(eventoSelecionado.id)
        } catch (error) {
            alert('Erro ao enviar arquivo: ' + error.message)
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleDeleteAnexo = async (anexo) => {
        if (!window.confirm(`Deseja excluir permanentemente o anexo "${anexo.nome_original}"?`)) return

        try {
            const { error: storageError } = await supabase.storage
                .from('eventos_anexos')
                .remove([anexo.file_path])

            if (storageError) console.error("Erro storage", storageError)

            const { error: dbError } = await supabase
                .from('evento_anexos')
                .delete()
                .eq('id', anexo.id)

            if (dbError) throw dbError

            setAnexos(anexos.filter(a => a.id !== anexo.id))
        } catch (error) {
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
                                    <th className="px-5 py-4 cursor-pointer hover:bg-slate-700/80 transition-colors" onClick={() => requestSort('data_procedimento')}>
                                        Data Proc. {getSortIcon('data_procedimento')}
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-slate-700/80 transition-colors" onClick={() => requestSort('status_operacional')}>
                                        Status {getSortIcon('status_operacional')}
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-slate-700/80 transition-colors" onClick={() => requestSort('paciente_nome')}>
                                        Paciente {getSortIcon('paciente_nome')}
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-slate-700/80 transition-colors" onClick={() => requestSort('convenio')}>
                                        Convênio / Senha {getSortIcon('convenio')}
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-slate-700/80 transition-colors" onClick={() => requestSort('hospital')}>
                                        Hospital {getSortIcon('hospital')}
                                    </th>
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
                                                    <button onClick={() => handleOpenAnexos(ev)} className="p-1.5 bg-slate-900 border border-slate-700 hover:border-emerald-500 rounded text-slate-400 hover:text-emerald-400 transition-all" title="Gerenciar Anexos (PDF, Imagens)">
                                                        <Paperclip size={16} />
                                                    </button>
                                                    <button onClick={() => handleOpenDetails(ev)} className="p-1.5 bg-slate-900 border border-slate-700 hover:border-blue-500 rounded text-slate-400 hover:text-blue-400 transition-all" title="Ver Detalhes do Rateio">
                                                        <Eye size={16} />
                                                    </button>
                                                    <button onClick={() => handleOpenEdit(ev)} className="p-1.5 bg-slate-900 border border-slate-700 hover:border-amber-500 rounded text-slate-500 hover:text-amber-400 transition-all" title="Editar Cabeçalho">
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

            {/* Modal de Anexos */}
            {isAnexosModalOpen && eventoSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                                    <Paperclip className="text-emerald-500" />
                                    <span>Anexos do Evento</span>
                                </h3>
                                <p className="text-slate-400 text-sm mt-1">
                                    Paciente: <strong className="text-slate-300">{eventoSelecionado.paciente_nome}</strong>
                                </p>
                            </div>
                            <button onClick={() => setIsAnexosModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-slate-900/50">

                            {/* Upload Area */}
                            <div className="mb-8 relative">
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    accept=".pdf,image/*"
                                />
                                <div className={`border-2 border-dashed ${uploading ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-emerald-500 bg-slate-800 hover:bg-slate-800/80'} rounded-xl p-8 text-center transition-all duration-200`}>
                                    {uploading ? (
                                        <div className="flex flex-col items-center justify-center text-blue-400">
                                            <Loader2 size={32} className="animate-spin mb-3" />
                                            <p className="font-medium text-lg">Enviando arquivo...</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <UploadCloud size={40} className="mb-3 text-slate-500" />
                                            <p className="font-medium text-lg text-white mb-1">Clique ou arraste arquivos aqui</p>
                                            <p className="text-sm">Suporta PDF, JPG, PNG (Guias, Relatórios Cirúrgicos)</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Lista de Anexos */}
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Arquivos Salvos</h4>

                            {loadingAnexos ? (
                                <div className="text-center py-8 text-slate-500">
                                    <Loader2 className="animate-spin inline-block mr-2" /> Carregando lista...
                                </div>
                            ) : anexos.length === 0 ? (
                                <div className="text-center py-10 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                    <FileText size={32} className="mx-auto text-slate-600 mb-2" />
                                    <p className="text-slate-400 text-sm">Nenhum anexo registrado para este evento médico.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {anexos.map(anexo => (
                                        <li key={anexo.id} className="flex justify-between items-center bg-slate-800 border border-slate-700 p-3 rounded-lg hover:border-slate-600 transition-colors">
                                            <div className="flex items-center space-x-3 overflow-hidden">
                                                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-white text-sm font-medium truncate" title={anexo.nome_original}>
                                                        {anexo.nome_original}
                                                    </p>
                                                    <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                                                        <span>{(anexo.tamanho_bytes / 1024 / 1024).toFixed(2)} MB</span>
                                                        <span>•</span>
                                                        <span>{new Date(anexo.created_at).toLocaleDateString()}</span>
                                                        <span>•</span>
                                                        <span className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">{anexo.tipo_documento}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2 ml-4">
                                                <a
                                                    href={anexo.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                                                    title="Baixar/Visualizar"
                                                >
                                                    <Download size={18} />
                                                </a>
                                                <button
                                                    onClick={() => handleDeleteAnexo(anexo)}
                                                    className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-700 bg-slate-800/80 text-right">
                            <button onClick={() => setIsAnexosModalOpen(false)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Edit ou View Completo gerenciado pelo componente Base */}
            {isEditModalOpen && eventoSelecionado && (
                <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto">
                    <div className="p-6 h-full w-full">
                        <NovoEventoMedico
                            idEditar={eventoSelecionado.id}
                            modo="edit"
                            onClose={fecharModaisEErregarTable}
                        />
                    </div>
                </div>
            )}

            {isDetailsModalOpen && eventoSelecionado && (
                <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto">
                    <div className="p-6 h-full w-full">
                        <NovoEventoMedico
                            idEditar={eventoSelecionado.id}
                            modo="view"
                            onClose={fecharModaisEErregarTable}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
