import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { Plus, Edit2, Trash2, ArrowLeft, Search, Save, X, AlertCircle, UploadCloud } from 'lucide-react'
import Papa from 'papaparse'

export default function TabelasItens({ tabelaId, convenioNome, onBack }) {
    const [itens, setItens] = useState([])
    const [loading, setLoading] = useState(true)
    const [tabelaInfo, setTabelaInfo] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [formData, setFormData] = useState({
        codigo: '',
        descricao: '',
        valor: ''
    })
    const [errorMsg, setErrorMsg] = useState('')
    const [saving, setSaving] = useState(false)
    const [listErrorMsg, setListErrorMsg] = useState('')

    const fileInputRef = useRef(null)
    const [importLoading, setImportLoading] = useState(false)

    const handleFileUpload = (e) => {
        const file = e.target.files[0]
        if (!file) return

        setImportLoading(true)
        setListErrorMsg('')

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data
                if (data.length === 0) {
                    setListErrorMsg('O arquivo CSV está vazio ou inválido.')
                    setImportLoading(false)
                    return
                }

                // Check for required columns
                if (!data[0].hasOwnProperty('codigo') || !data[0].hasOwnProperty('descricao')) {
                    setListErrorMsg('O CSV precisa ter as colunas "codigo" e "descricao". Verifique se salvou separado por vírgulas ou ponto e vírgula.')
                    setImportLoading(false)
                    return
                }

                // Validar duplicidades estritas no CSV
                const seenCodes = new Map()
                const duplicateErrors = []

                data.forEach((row, index) => {
                    if (row.codigo && row.descricao) {
                        const codeStr = String(row.codigo).trim()
                        const rowNumber = index + 2 // +1 for 0-index, +1 for header row

                        if (seenCodes.has(codeStr)) {
                            const firstSeenRow = seenCodes.get(codeStr)
                            duplicateErrors.push(`Código '${codeStr}' repetido nas linhas ${firstSeenRow} e ${rowNumber}`)
                        } else {
                            seenCodes.set(codeStr, rowNumber)
                        }
                    }
                })

                if (duplicateErrors.length > 0) {
                    setListErrorMsg(`Falha na validação! Corrija as duplicidades na sua planilha antes de importar:\n- ${duplicateErrors.slice(0, 5).join('\n- ')}${duplicateErrors.length > 5 ? `\n...e mais ${duplicateErrors.length - 5} duplicações.` : ''}`)
                    setImportLoading(false)
                    e.target.value = null
                    return
                }

                const payloads = data.map(row => ({
                    tabela_preco_id: tabelaId,
                    codigo: String(row.codigo).trim(),
                    descricao: String(row.descricao).trim(),
                    valor: row.valor ? parseFloat(String(row.valor).replace(',', '.')) : 0.00
                })).filter(p => p.codigo && p.descricao)

                if (payloads.length > 0) {
                    const { error } = await supabase.from('tabelas_preco_itens').upsert(payloads, { onConflict: 'tabela_preco_id,codigo' })
                    if (error) {
                        setListErrorMsg('Erro na importação: ' + error.message)
                    } else {
                        setListErrorMsg('')
                        fetchItens() // refresh list
                    }
                }
                setImportLoading(false)
                e.target.value = null // reset input
            },
            error: (err) => {
                setListErrorMsg('Erro ao ler CSV: ' + err.message)
                setImportLoading(false)
            }
        })
    }

    useEffect(() => {
        if (tabelaId) {
            fetchTabelaInfo()
            fetchItens()
        }
    }, [tabelaId])

    async function fetchTabelaInfo() {
        const { data } = await supabase
            .from('tabelas_preco')
            .select('nome_origem, vigencia_inicio, vigencia_fim')
            .eq('id', tabelaId)
            .single()
        if (data) setTabelaInfo(data)
    }

    async function fetchItens() {
        setLoading(true)
        const { data, error } = await supabase
            .from('tabelas_preco_itens')
            .select('*')
            .eq('tabela_preco_id', tabelaId)
            .order('codigo', { ascending: true })

        if (error) console.error(error)
        else setItens(data || [])

        setLoading(false)
    }

    const handleOpenModal = (item = null) => {
        setErrorMsg('')
        if (item) {
            setEditingItem(item)
            setFormData({
                codigo: item.codigo,
                descricao: item.descricao,
                valor: item.valor.toString()
            })
        } else {
            setEditingItem(null)
            setFormData({
                codigo: '',
                descricao: '',
                valor: ''
            })
        }
        setIsModalOpen(true)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setErrorMsg('')

        if (!formData.codigo || !formData.descricao || !formData.valor) {
            setErrorMsg('Todos os campos são obrigatórios.')
            return
        }

        // Regra Crítica: Código deve ser único na tabela
        const isDuplicate = itens.some(i => i.codigo === formData.codigo && (!editingItem || i.id !== editingItem.id))
        if (isDuplicate) {
            setErrorMsg(`O código ${formData.codigo} já existe nesta tabela.`)
            return
        }

        setSaving(true)
        const payload = {
            tabela_preco_id: tabelaId,
            codigo: formData.codigo,
            descricao: formData.descricao,
            valor: parseFloat(formData.valor.replace(',', '.'))
        }

        if (editingItem) {
            const { error } = await supabase.from('tabelas_preco_itens').update(payload).eq('id', editingItem.id)
            if (error) setErrorMsg('Erro ao atualizar: ' + error.message)
            else {
                setIsModalOpen(false)
                fetchItens()
            }
        } else {
            const { error } = await supabase.from('tabelas_preco_itens').insert([payload])
            if (error) setErrorMsg('Erro ao cadastrar: ' + error.message)
            else {
                setIsModalOpen(false)
                fetchItens()
            }
        }
        setSaving(false)
    }

    const handleDelete = async (id, codigo) => {
        if (window.confirm(`Tem certeza que deseja apagar o código ${codigo}?`)) {
            await supabase.from('tabelas_preco_itens').delete().eq('id', id)
            fetchItens()
        }
    }

    const filteredItens = itens.filter(item =>
        item.codigo.includes(searchTerm) ||
        item.descricao.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6 relative">
            <div className="flex items-center space-x-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                        <span>Itens da Tabela</span>
                    </h2>
                    <p className="text-slate-400 text-sm">
                        Convênio: <strong className="text-blue-400">{convenioNome}</strong> |
                        Tabela: <strong className="text-amber-400">{tabelaInfo?.nome_origem}</strong>
                    </p>
                </div>
                <div className="ml-auto flex items-center space-x-3">
                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importLoading}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors disabled:opacity-50"
                        title="Baixe o template em docs/Template_Importacao_Convenios.csv"
                    >
                        <UploadCloud size={20} />
                        <span>{importLoading ? 'Importando...' : 'Importar CSV'}</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        <Plus size={20} />
                        <span>Adicionar Código</span>
                    </button>
                </div>
            </div>

            {listErrorMsg && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-3 text-red-500">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{listErrorMsg}</span>
                </div>
            )}

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex space-x-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por código ou descrição..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 p-8 flex items-center justify-center text-slate-400">Carregando itens...</div>
                ) : filteredItens.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 flex-1">
                        <p className="text-lg font-medium text-white mb-2">Nenhum item encontrado</p>
                        <p className="text-sm max-w-sm">
                            {searchTerm ? 'Tente buscar com outro termo.' : 'Adicione códigos e valores (ex: honorários e taxas) a esta tabela.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-auto flex-1 h-0">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-slate-700 text-slate-300 text-sm uppercase">
                                    <th className="px-6 py-4 font-semibold w-32 border-b border-slate-600">Código</th>
                                    <th className="px-6 py-4 font-semibold border-b border-slate-600">Descrição do Procedimento</th>
                                    <th className="px-6 py-4 font-semibold w-40 text-right border-b border-slate-600">Valor (R$)</th>
                                    <th className="px-6 py-4 font-semibold w-24 text-center border-b border-slate-600">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {filteredItens.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="text-blue-400 font-mono font-bold">{item.codigo}</div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="text-slate-300 text-sm">{item.descricao}</div>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="text-green-400 font-bold whitespace-nowrap">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center space-x-3">
                                            <button onClick={() => handleOpenModal(item)} className="text-slate-400 hover:text-blue-400 transition-colors" title="Editar">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(item.id, item.codigo)} className="text-slate-400 hover:text-red-400 transition-colors" title="Excluir">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Novo/Editar Item */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700 flex flex-col max-h-full">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
                            <h3 className="text-xl font-bold text-white">
                                {editingItem ? 'Editar Código' : 'Adicionar Código'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {errorMsg && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-3 text-red-500">
                                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                    <span className="text-sm font-medium">{errorMsg}</span>
                                </div>
                            )}

                            <form id="itemForm" onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Código (TUSS/AMB) *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: 30101018"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        value={formData.codigo}
                                        onChange={e => setFormData({ ...formData, codigo: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Descrição Comercial *</label>
                                    <textarea
                                        rows="2"
                                        required
                                        placeholder="Nome do procedimento"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                                        value={formData.descricao}
                                        onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                    ></textarea>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Valor Unitário Bruto (R$) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        placeholder="Ex: 150.00"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        value={formData.valor}
                                        onChange={e => setFormData({ ...formData, valor: e.target.value })}
                                    />
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-slate-700 bg-slate-800/80 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="itemForm"
                                disabled={saving}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                            >
                                <Save size={18} />
                                <span>{saving ? 'Salvando...' : 'Salvar Código'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
