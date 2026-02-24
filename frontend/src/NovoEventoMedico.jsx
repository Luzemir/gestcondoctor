import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { FilePlus, Save, AlertCircle, Plus, Trash2, Search, ArrowRight, BookOpen, Calculator, Paperclip, UploadCloud, X, FileText } from 'lucide-react'

// Códigos que pagam sempre 100% ao cirurgião principal e não dividem com auxiliares
const TAXAS_EXCLUSIVAS = ['60098007', '10102019', '10101039', '1113', '5904', '5905', '5906', '5907', '373', '40902056', '40201163', '1504', '1505', '1506', '1507'];


export default function NovoEventoMedico({ idEditar = null, modo = 'create', onClose = null }) {
    const [loadingData, setLoadingData] = useState(true)
    const [loadingEvento, setLoadingEvento] = useState(false)
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    // Combobox data
    const [convenios, setConvenios] = useState([])
    const [hospitais, setHospitais] = useState([])
    const [medicos, setMedicos] = useState([])

    // Event Data State
    const [eventoId, setEventoId] = useState(null) // If editing
    const [formData, setFormData] = useState({
        paciente_nome: '',
        paciente_cpf: '',
        paciente_nascimento: '',
        carteirinha: '',
        guia: '',
        senha: '',
        atendimento: '',
        convenio_id: '',
        hospital_id: '',
        data_procedimento: new Date().toISOString().split('T')[0],
        hora_inicio: '',
        hora_fim: '',
        urgencia: 'Eletiva',
        medico_principal_id: '',
        medico_aux1_id: '',
        medico_aux2_id: '',
        anestesista: '',
        instrumentador: '',
        observacoes_evento: '',
        observacoes_guia: '',
        day_clinic: false,
        acomodacao_apartamento: false
    })

    // Itens Data State
    const [itens, setItens] = useState([])

    // Anexos Pendentes State (Files aguardando upload no Save)
    const [anexosPendentes, setAnexosPendentes] = useState([])
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef(null)

    // UI States for Modal Picker
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [pickerLoading, setPickerLoading] = useState(false)
    const [pickerResults, setPickerResults] = useState([])

    // Tabela Vigente
    const [tabelaVigente, setTabelaVigente] = useState(null)

    useEffect(() => {
        fetchSupportData()
    }, [])

    useEffect(() => {
        if (idEditar && (convenios.length > 0 || hospitais.length > 0)) {
            fetchEventoData()
        }
    }, [idEditar, convenios, hospitais])

    async function fetchEventoData() {
        setLoadingEvento(true)
        try {
            // 1. Fetch Evento Principal
            const { data: eventoDb, error: errEvento } = await supabase
                .from('eventos')
                .select('*')
                .eq('id', idEditar)
                .single()
            if (errEvento) throw errEvento

            // 2. Fetch Itens
            const { data: itensDb, error: errItens } = await supabase
                .from('evento_itens')
                .select('*')
                .eq('evento_id', idEditar)
            if (errItens) throw errItens

            // Popular Formulário
            setFormData({
                paciente_nome: eventoDb.paciente_nome || '',
                paciente_cpf: eventoDb.paciente_cpf || '',
                paciente_nascimento: eventoDb.paciente_nascimento || '',
                carteirinha: eventoDb.carteirinha || '',
                guia: eventoDb.guia || '',
                senha: eventoDb.senha || '',
                atendimento: eventoDb.atendimento || '',
                convenio_id: eventoDb.convenio_id || '',
                hospital_id: eventoDb.hospital_id || '',
                data_procedimento: eventoDb.data_procedimento ? new Date(eventoDb.data_procedimento).toISOString().split('T')[0] : '',
                hora_inicio: eventoDb.hora_inicio || '',
                hora_fim: eventoDb.hora_fim || '',
                urgencia: eventoDb.urgencia || 'Eletiva',
                medico_principal_id: eventoDb.medico_principal_id || '',
                medico_aux1_id: eventoDb.medico_aux1_id || '',
                medico_aux2_id: eventoDb.medico_aux2_id || '',
                anestesista: eventoDb.anestesista || '',
                instrumentador: eventoDb.instrumentador || '',
                observacoes_evento: eventoDb.observacoes_evento || '',
                observacoes_guia: eventoDb.observacoes_guia || '',
                day_clinic: eventoDb.day_clinic || false,
                acomodacao_apartamento: eventoDb.acomodacao_apartamento || false
            })

            // Popular Itens Restruturando para o State Local
            if (itensDb && itensDb.length > 0) {
                // Remove duplicates based on uuid to avoid multiple rows for 1 procedure
                const uniqueUuid = [...new Set(itensDb.map(i => i.codigo))] // Simplificacao. O ideal seria ter o id_uuid_temp salvo no BD.
                // Como não salvamos o uuid_temp, vamos reconstruir baseado no item original:
                // Pegar apenas os registros principais (sem multiplicadores P/A1/A2, pois eles são recálculados online)

                // HACK para esta versão (já que o motor recálcula): recriamos o array de "itens" base a partir de itens_db distintos.
                // Como salvamos as linhas multiplicadas no evento_itens, precisamos desduplicar para jogar no state 'itens'.
                // Desduplicar pelo código
                const uniqueItens = [];
                const seenCodes = new Set();
                for (const row of itensDb) {
                    if (!seenCodes.has(row.codigo)) {
                        seenCodes.add(row.codigo);
                        uniqueItens.push({
                            id_uuid_temp: crypto.randomUUID(),
                            tabela_preco_id_snapshot: row.tabela_preco_id_snapshot,
                            codigo: row.codigo,
                            descricao: row.descricao,
                            quantidade: row.quantidade,
                            via_acesso: row.via_acesso,
                            valor_unitario_tabela_snapshot: row.valor_unitario_tabela_snapshot
                        });
                    }
                }
                setItens(uniqueItens)
            }

        } catch (error) {
            console.error(error)
            setErrorMsg("Erro ao carregar os dados do evento.")
        } finally {
            setLoadingEvento(false)
        }
    }

    async function fetchSupportData() {
        setLoadingData(true)

        // Em paralelo, busca convenios, hospitais e medicos
        const [resConvenios, resHospitais, resMedicos] = await Promise.all([
            supabase.from('convenios').select('id, nome, status').eq('status', 'Ativo').order('nome'),
            supabase.from('hospitais').select('id, nome_fantasia, status').eq('status', 'Ativo').order('nome_fantasia'),
            supabase.from('medicos').select('id, nome, especialidade, status').eq('status', 'Ativo').order('nome')
        ])

        if (resConvenios.data) setConvenios(resConvenios.data)
        if (resHospitais.data) setHospitais(resHospitais.data)
        if (resMedicos.data) setMedicos(resMedicos.data)

        setLoadingData(false)
    }

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleAddAnexoPendente = (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return

        // Verifica se tem PDF ou imagem aceitável (opcional, já restringido no HTML accept)
        setAnexosPendentes(prev => [...prev, ...files])
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return
        setAnexosPendentes(prev => [...prev, ...files])
    }

    const handleRemoveAnexoPendente = (indexToRemove) => {
        setAnexosPendentes(prev => prev.filter((_, index) => index !== indexToRemove))
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setErrorMsg('')
        setSuccessMsg('')

        if (!formData.paciente_nome || !formData.convenio_id || !formData.hospital_id || !formData.data_procedimento || !formData.medico_principal_id) {
            setErrorMsg('Preencha todos os campos obrigatórios (marcados com *).')
            return
        }

        setSaving(true)

        // Busca do empresa_id armazenado no login/sessao do app MVP
        const currentSession = JSON.parse(localStorage.getItem('sb-ptjxtovrrcbctoifosza-auth-token')) || null;
        let empresaId = null;
        if (currentSession?.user?.user_metadata?.empresa_id) {
            empresaId = currentSession.user.user_metadata.empresa_id;
        }

        // 1. Inserir Evento PAI
        const eventoPayload = {
            empresa_id: empresaId,
            tipo_evento: 'Procedimento Médico',
            status_operacional: itens.length > 0 ? 'Pronto' : 'Rascunho', // Logica inicial simplificada
            paciente_nome: formData.paciente_nome,
            paciente_cpf: formData.paciente_cpf || null,
            paciente_nascimento: formData.paciente_nascimento || null,
            carteirinha: formData.carteirinha || null,
            guia: formData.guia || null,
            senha: formData.senha || null,
            atendimento: formData.atendimento || null,
            convenio_id: formData.convenio_id,
            hospital_id: formData.hospital_id,
            data_procedimento: formData.data_procedimento,
            hora_inicio: formData.hora_inicio || null,
            hora_fim: formData.hora_fim || null,
            urgencia: formData.urgencia,
            medico_principal_id: formData.medico_principal_id,
            medico_aux1_id: formData.medico_aux1_id || null,
            medico_aux2_id: formData.medico_aux2_id || null,
            anestesista: formData.anestesista || null,
            instrumentador: formData.instrumentador || null,
            observacoes_evento: formData.observacoes_evento,
            observacoes_guia: formData.observacoes_guia,
            day_clinic: formData.day_clinic,
            acomodacao_apartamento: formData.acomodacao_apartamento
        }

        let eventoIdFinal = idEditar;

        if (idEditar) {
            // -- UPDATE MODO --
            const { error: errorUpdate } = await supabase
                .from('eventos')
                .update(eventoPayload)
                .eq('id', idEditar)

            if (errorUpdate) {
                setErrorMsg('Erro ao atualizar: ' + errorUpdate.message)
                setSaving(false)
                return
            }

            // Excluir Itens Antigos e Reinserir (forma simples de dar update 1-N)
            await supabase.from('evento_itens').delete().eq('evento_id', idEditar)

        } else {
            // -- INSERT MODO --
            const { data: eventoSalvo, error: errorEvento } = await supabase
                .from('eventos')
                .insert([eventoPayload])
                .select()
                .single()

            if (errorEvento) {
                console.error(errorEvento);
                let userFriendlyMsg = 'Erro técnico desconhecido.';
                if (errorEvento.message.includes('row-level security')) {
                    userFriendlyMsg = 'Você não tem permissão para salvar registros nesta empresa (Erro de Segurança RLS do Banco).';
                } else if (errorEvento.message.includes('foreign key constraint')) {
                    userFriendlyMsg = 'Algum dos dados selecionados (Convênio, Hospital ou Médico) não é mais válido no sistema.';
                } else {
                    userFriendlyMsg = `Falha do Banco de Dados: ${errorEvento.message}`
                }

                setErrorMsg(`Não foi possível salvar a ficha: ${userFriendlyMsg}`)
                setSaving(false)
                return
            }
            eventoIdFinal = eventoSalvo.id;
        }

        // 2. Inserir Itens FILHO (se existirem) - Roda tanto no Insert quanto Update (pois apagamos no update)
        if (itens.length > 0) {
            const itensPayload = itens.map(item => {
                const derivations = itensCalculados.filter(i => i.id_uuid_temp === item.id_uuid_temp);
                const principalRow = derivations.find(d => d.papel === 'P');
                const aux1Row = derivations.find(d => d.papel === 'A1');
                const aux2Row = derivations.find(d => d.papel === 'A2');

                const rateio = {
                    principal: principalRow ? principalRow.valor_calculado : 0,
                    aux1: aux1Row ? aux1Row.valor_calculado : 0,
                    aux2: aux2Row ? aux2Row.valor_calculado : 0
                };

                return {
                    evento_id: eventoIdFinal,
                    tabela_preco_id_snapshot: item.tabela_preco_id_snapshot,
                    codigo: item.codigo,
                    descricao: item.descricao,
                    quantidade: item.quantidade,
                    via_acesso: item.via_acesso,
                    percentual: principalRow ? principalRow.incisao_percent : 100,
                    incisao: principalRow ? principalRow.incisao_percent : 100,
                    valor_unitario_tabela_snapshot: item.valor_unitario_tabela_snapshot,
                    valor_calculado_item_snapshot: principalRow ? principalRow.valor_calculado : (item.valor_unitario_tabela_snapshot * item.quantidade),
                    rateio_por_medico_snapshot: rateio,
                    notas_item: item.notas_item || ''
                }
            })

            const { error: errorItens } = await supabase
                .from('evento_itens')
                .insert(itensPayload)

            if (errorItens) {
                setErrorMsg('Dados principais salvos, mas houve erro com os procedimentos: ' + errorItens.message)
                setSaving(false)
                return
            }
        }

        // 3. Upload dos Anexos Pendentes vinculados a este Evento!
        let anexosComErro = 0;
        if (anexosPendentes.length > 0) {
            for (const file of anexosPendentes) {
                try {
                    const fileExt = file.name.split('.').pop()
                    const fileName = `${eventoIdFinal}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`

                    const { error: uploadError } = await supabase.storage
                        .from('eventos_anexos')
                        .upload(fileName, file)

                    if (uploadError) throw uploadError

                    // Public URL
                    const { data: publicUrlData } = supabase.storage
                        .from('eventos_anexos')
                        .getPublicUrl(fileName)

                    // Record no BD
                    const { error: dbError } = await supabase
                        .from('evento_anexos')
                        .insert([{
                            evento_id: eventoIdFinal,
                            file_path: fileName,
                            file_url: publicUrlData.publicUrl,
                            nome_original: file.name,
                            tamanho_bytes: file.size,
                            tipo_documento: 'Guia/Relatório (Adicionado no Lançamento)'
                        }])

                    if (dbError) throw dbError
                } catch (error) {
                    console.error("Erro no anexo", file.name, error);
                    anexosComErro++;
                }
            }
        }

        if (anexosComErro > 0) {
            setSuccessMsg(`Evento salvo com sucesso, porém ${anexosComErro} arquivo(s) falharam no upload. Você pode anexar pela Fila de Eventos.`)
        } else {
            setSuccessMsg('Evento Médico e Procedimentos registrados com sucesso!')
        }

        if (idEditar && onClose) {
            onClose(); // Retorna se for modal após salvar
        } else {
            // Reset (comportamento de NOVO EVENTO se não for edit)
            setFormData({
                ...formData,
                paciente_nome: '',
                paciente_cpf: '',
                paciente_nascimento: '',
                observacoes_evento: '',
                observacoes_guia: ''
            })
            setItens([])
            setAnexosPendentes([])
        }

        setSaving(false)
    }

    // LÓGICA DO PICKER DE PROCEDIMENTOS
    // 1. Encontrar tabela vigente quando Convênio ou Data mudam
    useEffect(() => {
        if (formData.convenio_id && formData.data_procedimento) {
            buscarTabelaVigente(formData.convenio_id, formData.data_procedimento)
        } else {
            setTabelaVigente(null)
        }
    }, [formData.convenio_id, formData.data_procedimento])

    async function buscarTabelaVigente(convenioId, dataStr) {
        setTabelaVigente(null);
        const { data, error } = await supabase
            .from('tabelas_preco')
            .select('id, nome_origem, descricao')
            .eq('convenio_id', convenioId)
            .eq('status', 'Ativa')
            // Logica simplificada para MVP: Pega a primeira ativa.
            // Numa segunda fase, implementamos strictly o `vigencia_inicio` <= dataStr
            .limit(1)
            .maybeSingle()

        if (data) setTabelaVigente(data)
        else setTabelaVigente(null)
    }

    // 2. Busca com Debounce no Modal
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (isPickerOpen && searchTerm.length >= 2 && tabelaVigente) {
                realizarBuscaItens()
            } else if (searchTerm.length < 2) {
                setPickerResults([])
            }
        }, 500)

        return () => clearTimeout(delayDebounceFn)
    }, [searchTerm, isPickerOpen])

    async function realizarBuscaItens() {
        setPickerLoading(true)
        const { data, error } = await supabase
            .from('tabelas_preco_itens')
            .select('*')
            .eq('tabela_preco_id', tabelaVigente.id)
            .or(`codigo.ilike.%${searchTerm}%,descricao.ilike.%${searchTerm}%`)
            .limit(30)

        if (data) setPickerResults(data)
        setPickerLoading(false)
    }

    const addItem = (itemDb) => {
        const novoItem = {
            id_uuid_temp: crypto.randomUUID(),
            tabela_preco_id_snapshot: itemDb.tabela_preco_id,
            codigo: itemDb.codigo,
            descricao: itemDb.descricao,
            quantidade: 1,
            via_acesso: 'Exclusiva',
            valor_unitario_tabela_snapshot: itemDb.valor,
        }
        setItens([...itens, novoItem])
        setIsPickerOpen(false)
        setSearchTerm('')
    }

    const removerItem = (uuidTemp) => {
        setItens(itens.filter(i => i.id_uuid_temp !== uuidTemp))
    }

    const atualizarItem = (uuidTemp, field, value) => {
        setItens(itens.map(item => {
            if (item.id_uuid_temp === uuidTemp) {
                return { ...item, [field]: value }
            }
            return item
        }))
    }

    // MOTOR DE HONORÁRIOS (Opção C)
    const itensCalculados = React.useMemo(() => {
        const principal = medicos.find(m => m.id === formData.medico_principal_id) || { nome: 'Cirurgião Principal' };
        const aux1 = medicos.find(m => m.id === formData.medico_aux1_id);
        const aux2 = medicos.find(m => m.id === formData.medico_aux2_id);
        const convenio = convenios.find(c => c.id === formData.convenio_id) || { nome: '' };

        // 1. Encontrar o procedimento de maior valor (para bônus e base dos auxiliares)
        let maiorValor = 0;
        itens.forEach(item => {
            if (!TAXAS_EXCLUSIVAS.includes(item.codigo)) {
                const v = Number(item.valor_unitario_tabela_snapshot);
                if (v > maiorValor) maiorValor = v;
            }
        });

        let maiorValorUsado = false;
        let gridRows = [];

        // 2. Transpilação do loop do VBA
        itens.forEach(item => {
            const isTaxa = TAXAS_EXCLUSIVAS.includes(item.codigo);
            const valorBase = Number(item.valor_unitario_tabela_snapshot) * Number(item.quantidade);
            let incisaoPrincipal = 0;
            let valorPrincipal = 0;

            if (isTaxa) {
                // Taxas pagam 100% apenas ao principal
                incisaoPrincipal = 1.0;
                valorPrincipal = valorBase;
                gridRows.push({
                    id_row: item.id_uuid_temp + '_P',
                    id_uuid_temp: item.id_uuid_temp,
                    codigo: item.codigo,
                    descricao: item.descricao,
                    medico_nome: principal.nome,
                    papel: 'P',
                    via_acesso: item.via_acesso,
                    incisao_percent: 100,
                    valor_calculado: valorPrincipal
                });
            } else {
                const isUnimedDayClinic = convenio.nome.toUpperCase().includes('UNIMED DAY CLINIC');
                const isUnimed = convenio.nome.toUpperCase().includes('UNIMED');

                // Lógica de Via de Acesso para Cirurgião Principal
                if (Number(item.valor_unitario_tabela_snapshot) === maiorValor && !maiorValorUsado) {
                    maiorValorUsado = true;
                    incisaoPrincipal = formData.urgencia === 'Emergencia' ? 1.3 : 1.0;
                } else {
                    if (item.via_acesso === 'Exclusiva') {
                        incisaoPrincipal = formData.urgencia === 'Emergencia' ? 0.91 : 0.7;
                    } else if (item.via_acesso === 'Mesma Via') {
                        incisaoPrincipal = formData.urgencia === 'Emergencia' ? 0.65 : 0.5;
                    } else if (item.via_acesso === 'Diferente Via') {
                        incisaoPrincipal = formData.urgencia === 'Emergencia' ? 0.65 : 0.5;
                    } else {
                        incisaoPrincipal = formData.urgencia === 'Emergencia' ? 0.91 : 0.7; // Fallback
                    }
                }

                let multiplicadorAdicional = 1;
                if (isUnimedDayClinic) {
                    multiplicadorAdicional = 2; // Legado via nome convênio
                } else if ((formData.day_clinic && isUnimed) || formData.acomodacao_apartamento) {
                    multiplicadorAdicional = 2; // Novo via checkbox
                }

                incisaoPrincipal *= multiplicadorAdicional;

                valorPrincipal = valorBase * incisaoPrincipal;

                gridRows.push({
                    id_row: item.id_uuid_temp + '_P',
                    id_uuid_temp: item.id_uuid_temp,
                    codigo: item.codigo,
                    descricao: item.descricao,
                    medico_nome: principal.nome,
                    papel: 'P',
                    via_acesso: item.via_acesso,
                    incisao_percent: Number((incisaoPrincipal * 100).toFixed(0)),
                    valor_calculado: valorPrincipal
                });

                // Lógica dos Auxiliares
                if (aux1) {
                    let aux1Incisao = 0.3; // Padrão 30% do que o principal recebeu
                    if (isUnimed && formData.urgencia === 'Emergencia') {
                        aux1Incisao = 1.0; // Padrão 100% 
                    }
                    let effectiveAux1Percent = incisaoPrincipal * aux1Incisao;
                    gridRows.push({
                        id_row: item.id_uuid_temp + '_A1',
                        id_uuid_temp: item.id_uuid_temp,
                        codigo: item.codigo,
                        descricao: item.descricao,
                        medico_nome: aux1.nome,
                        papel: 'A1',
                        via_acesso: item.via_acesso,
                        incisao_percent: Number((effectiveAux1Percent * 100).toFixed(0)),
                        valor_calculado: valorBase * effectiveAux1Percent
                    });
                }

                if (aux2) {
                    let aux2Incisao = 0.2; // Correção do Bug do VBA (era aux1=0.2)
                    if (isUnimed && formData.urgencia === 'Emergencia') {
                        aux2Incisao = 1.0;
                    }
                    let effectiveAux2Percent = incisaoPrincipal * aux2Incisao;
                    gridRows.push({
                        id_row: item.id_uuid_temp + '_A2',
                        id_uuid_temp: item.id_uuid_temp,
                        codigo: item.codigo,
                        descricao: item.descricao,
                        medico_nome: aux2.nome,
                        papel: 'A2',
                        via_acesso: item.via_acesso,
                        incisao_percent: Number((effectiveAux2Percent * 100).toFixed(0)),
                        valor_calculado: valorBase * effectiveAux2Percent
                    });
                }
            }
        });

        return gridRows;
    }, [itens, formData.medico_principal_id, formData.medico_aux1_id, formData.medico_aux2_id, formData.urgencia, formData.convenio_id, medicos, convenios]);

    const totalCalculado = itensCalculados.reduce((acc, row) => acc + Number(row.valor_calculado || 0), 0);
    const totalPrincipal = itensCalculados.filter(r => r.papel === 'P').reduce((acc, r) => acc + r.valor_calculado, 0);
    const totalAux1 = itensCalculados.filter(r => r.papel === 'A1').reduce((acc, r) => acc + r.valor_calculado, 0);
    const totalAux2 = itensCalculados.filter(r => r.papel === 'A2').reduce((acc, r) => acc + r.valor_calculado, 0);

    if (loadingData || loadingEvento) {
        return <div className="p-8 text-center text-slate-400">Carregando formulário e bases...</div>
    }

    const isReadOnly = modo === 'view';
    const convenioSelecionado = convenios.find(c => c.id === formData.convenio_id) || null;
    const isUnimedLocal = convenioSelecionado ? convenioSelecionado.nome.toUpperCase().includes('UNIMED') : false;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-32">
            {!idEditar && (
                <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
                            <FilePlus className="text-blue-500" size={32} />
                            <span>Novo Procedimento Médico</span>
                        </h2>
                        <p className="text-slate-400 mt-2">Dossiê principal: Registre honorários, cirurgias e detalhes do paciente.</p>
                    </div>
                </div>
            )}

            {errorMsg && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-3 text-red-500">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{errorMsg}</span>
                </div>
            )}

            {successMsg && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start space-x-3 text-green-500">
                    <span className="text-sm font-medium">{successMsg}</span>
                </div>
            )}

            <form id="eventoForm" onSubmit={handleSave} className="space-y-8">
                {/* BLOCO 1: PACIENTE */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">1. Identificação do Paciente</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-slate-300">Nome do Paciente *</label>
                            <input
                                type="text"
                                name="paciente_nome"
                                required
                                placeholder="João da Silva"
                                value={formData.paciente_nome}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Data de Nascimento</label>
                            <input
                                type="date"
                                name="paciente_nascimento"
                                value={formData.paciente_nascimento}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500 [color-scheme:dark] disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">CPF</label>
                            <input
                                type="text"
                                name="paciente_cpf"
                                placeholder="000.000.000-00"
                                value={formData.paciente_cpf}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                            />
                        </div>

                        {/* Campos Extras - Faturamento Tradicional */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Carteirinha</label>
                            <input
                                type="text"
                                name="carteirinha"
                                placeholder="..."
                                value={formData.carteirinha}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Nº da Guia</label>
                            <input
                                type="text"
                                name="guia"
                                placeholder="..."
                                value={formData.guia}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Senha / Autorização</label>
                            <input
                                type="text"
                                name="senha"
                                placeholder="..."
                                value={formData.senha}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Atendimento</label>
                            <input
                                type="text"
                                name="atendimento"
                                placeholder="..."
                                value={formData.atendimento}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                            />
                        </div>

                        {/* Separador Visual */}
                        <div className="md:col-span-3 border-t border-slate-700/50 my-2"></div>

                        <div className="space-y-1 md:col-span-1">
                            <label className="text-sm font-medium text-slate-300">Convênio Faturado *</label>
                            <select
                                name="convenio_id"
                                required
                                value={formData.convenio_id}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                                <option value="">-- Selecione o Convênio --</option>
                                {convenios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">Ditará a Tabela de Preços vigente do paciente.</p>
                        </div>

                        {!isReadOnly && (
                            <div className="md:col-span-2 space-y-1">
                                <label className="text-sm font-medium text-slate-300 flex items-center justify-between">
                                    <span>Anexos Prévios e Guias (PDFs / Imagens)</span>
                                    <span className="text-xs text-slate-500">{anexosPendentes.length} arquivo(s) selecionado(s)</span>
                                </label>
                                <div className="flex items-start space-x-3">
                                    <div className="relative shrink-0">
                                        <input
                                            type="file"
                                            multiple
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            ref={fileInputRef}
                                            onChange={handleAddAnexoPendente}
                                            accept=".pdf,image/*"
                                        />
                                        <div className="bg-slate-900 border border-slate-700 hover:border-emerald-500 rounded-lg px-4 py-3 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer h-full">
                                            <UploadCloud size={24} className="mb-1" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Procurar</span>
                                        </div>
                                    </div>
                                    <div
                                        className={`flex-1 min-h-[70px] border-2 border-dashed rounded-lg p-2 overflow-y-auto max-h-[120px] transition-colors ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'bg-slate-900/50 border-slate-700'
                                            }`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        {anexosPendentes.length === 0 ? (
                                            <div className="text-xs text-slate-500 text-center py-4 flex flex-col items-center">
                                                <Paperclip size={16} className="mb-1 opacity-50" />
                                                Arraste PDFs ou Guias do Paciente aqui...
                                            </div>
                                        ) : (
                                            <ul className="space-y-1.5">
                                                {anexosPendentes.map((file, index) => (
                                                    <li key={index} className="flex justify-between items-center bg-slate-800 border border-slate-600 rounded p-1.5 px-2 text-xs">
                                                        <div className="flex items-center space-x-2 truncate">
                                                            <FileText size={14} className="text-emerald-500 shrink-0" />
                                                            <span className="truncate text-slate-300" title={file.name}>{file.name}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveAnexoPendente(index)}
                                                            className="text-slate-500 hover:text-red-400 transition-colors ml-2 shrink-0"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* BLOCO 2: DETALHES DO PROCEDIMENTO */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">2. Detalhes Clínicos e Local</h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-slate-300">Hospital / Local *</label>
                            <select
                                name="hospital_id"
                                required
                                value={formData.hospital_id}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                                <option value="">-- Selecione o Hospital --</option>
                                {hospitais.map(h => <option key={h.id} value={h.id}>{h.nome_fantasia}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Data do Proc. *</label>
                            <input
                                type="date"
                                name="data_procedimento"
                                required
                                value={formData.data_procedimento}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-bold text-blue-400 focus:outline-none focus:border-blue-500 [color-scheme:dark] disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Urgência</label>
                            <select
                                name="urgencia"
                                value={formData.urgencia}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                                <option value="Eletiva">Eletiva (Normal)</option>
                                <option value="Emergencia">Emergência</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Acomodação Principal</label>
                            <div className="flex items-center h-[42px] px-4 bg-slate-900 border border-slate-700 rounded-lg">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="acomodacao_apartamento"
                                        checked={formData.acomodacao_apartamento}
                                        onChange={(e) => setFormData({ ...formData, acomodacao_apartamento: e.target.checked })}
                                        disabled={isReadOnly}
                                        className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-800"
                                    />
                                    <span className="text-sm text-slate-300 font-medium whitespace-nowrap">Apartamento (+100%)</span>
                                </label>
                            </div>
                        </div>

                        <div className={`space-y-1 ${!isUnimedLocal ? 'opacity-30 pointer-events-none' : ''}`}>
                            <label className="text-sm font-medium text-slate-300">Day Clinic</label>
                            <div className="flex items-center h-[42px] px-4 bg-slate-900 border border-slate-700 rounded-lg">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="day_clinic"
                                        checked={formData.day_clinic}
                                        onChange={(e) => setFormData({ ...formData, day_clinic: e.target.checked })}
                                        disabled={isReadOnly || !isUnimedLocal}
                                        className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-800"
                                    />
                                    <span className="text-sm text-slate-300 font-medium">Paciente Day Clinic</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Hora Início</label>
                            <input
                                type="time"
                                name="hora_inicio"
                                value={formData.hora_inicio}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Hora Fim</label>
                            <input
                                type="time"
                                name="hora_fim"
                                value={formData.hora_fim}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                            />
                        </div>
                    </div>
                </div>

                {/* BLOCO 3: EQUIPE MÉDICA */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">3. Equipe Cirúrgica</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-blue-400">✅ Médico Principal *</label>
                            <select
                                name="medico_principal_id"
                                required
                                value={formData.medico_principal_id}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-blue-900/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                                <option value="">-- Selecione o Cirurgião --</option>
                                {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-400">1º Auxiliar</label>
                            <select
                                name="medico_aux1_id"
                                value={formData.medico_aux1_id}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                                <option value="">-- Opcional --</option>
                                {medicos.filter(m => m.id !== formData.medico_principal_id).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-400">2º Auxiliar</label>
                            <select
                                name="medico_aux2_id"
                                value={formData.medico_aux2_id}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                                <option value="">-- Opcional --</option>
                                {medicos.filter(m => m.id !== formData.medico_principal_id && m.id !== formData.medico_aux1_id).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                        </div>

                        {/* Separador visual */}
                        <div className="md:col-span-3 border-t border-slate-700/50 my-2"></div>

                        <div className="space-y-1 md:col-span-1">
                            <label className="text-sm font-medium text-slate-400">Anestesista (Texto)</label>
                            <input
                                type="text"
                                name="anestesista"
                                placeholder="..."
                                value={formData.anestesista}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1 md:col-span-1">
                            <label className="text-sm font-medium text-slate-400">Instrumentador (Texto)</label>
                            <input
                                type="text"
                                name="instrumentador"
                                placeholder="..."
                                value={formData.instrumentador}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            />
                        </div>
                    </div>
                </div>

                {/* BLOCO 4: PROCEDIMENTOS */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-2">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center">
                                <Calculator className="text-blue-500 mr-2" size={24} />
                                4. Motor de Honorários (Procedimentos e Cálculos)
                            </h3>
                            {tabelaVigente ? (
                                <p className="text-sm text-green-400 mt-1 flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                    Tabela Acoplada: {tabelaVigente.nome_origem}
                                </p>
                            ) : formData.convenio_id ? (
                                <p className="text-sm text-red-400 mt-1 flex items-center">
                                    <AlertCircle size={14} className="mr-1" />
                                    O convênio selecionado NÃO possui nenhuma tabela vigente com Status "Ativa". Crie uma primeiro em Cadastros &gt; Tabelas de Preço.
                                </p>
                            ) : (
                                <p className="text-sm text-amber-500 mt-1 flex items-center">
                                    <AlertCircle size={14} className="mr-1" />
                                    Selecione o Convênio para habilitar a busca de itens.
                                </p>
                            )}
                        </div>
                        {!isReadOnly && (
                            <button
                                type="button"
                                onClick={() => setIsPickerOpen(true)}
                                disabled={!tabelaVigente}
                                className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors font-medium shadow-lg shadow-blue-900/20"
                            >
                                <Search size={16} /> <span>Anexar Procedimento</span>
                            </button>
                        )}
                    </div>

                    {itens.length === 0 ? (
                        <div className="text-center py-10 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
                            <p className="text-slate-400">Nenhum procedimento médico registrado nesta ficha.</p>
                            <p className="text-xs text-slate-500 mt-2">Os itens injetarão regras automáticas de Auxílio na tabela estendida.</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* GRID MESTRE: PROCEDIMENTOS SELECIONADOS */}
                            <div>
                                <h4 className="text-white font-bold mb-3 text-sm uppercase tracking-wide text-slate-400 border-l-4 border-blue-500 pl-2">Grid Origem (Lançamento)</h4>
                                <div className="overflow-x-auto rounded-lg border border-slate-700">
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead className="bg-slate-900 text-slate-300 text-xs uppercase">
                                            <tr>
                                                <th className="px-4 py-3">Código</th>
                                                <th className="px-4 py-3">Descrição e Notas</th>
                                                <th className="px-4 py-3 w-24">Qtde</th>
                                                <th className="px-4 py-3 w-40">Via de Acesso</th>
                                                <th className="px-4 py-3 text-right">Valor Tabela</th>
                                                {!isReadOnly && <th className="px-4 py-3 w-12 text-center">Ações</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50 bg-slate-800">
                                            {itens.map(item => (
                                                <tr key={`origem_${item.id_uuid_temp}`} className="hover:bg-slate-700/30 transition-colors group">
                                                    <td className="px-4 py-3 font-mono text-blue-400">{item.codigo}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-white line-clamp-2" title={item.descricao}>{item.descricao}</p>
                                                        <input
                                                            type="text"
                                                            placeholder="Anotações internas..."
                                                            value={item.notas_item || ''}
                                                            onChange={(e) => atualizarItem(item.id_uuid_temp, 'notas_item', e.target.value)}
                                                            disabled={isReadOnly}
                                                            className="mt-1 w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:border-blue-500 focus:outline-none placeholder-slate-600 disabled:opacity-50 disabled:bg-transparent disabled:border-transparent disabled:px-0"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantidade}
                                                            onChange={(e) => atualizarItem(item.id_uuid_temp, 'quantidade', parseInt(e.target.value) || 1)}
                                                            disabled={isReadOnly}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:text-white disabled:font-bold disabled:px-0 text-center"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={item.via_acesso}
                                                            onChange={(e) => atualizarItem(item.id_uuid_temp, 'via_acesso', e.target.value)}
                                                            disabled={isReadOnly}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:text-amber-500 disabled:opacity-90 disabled:appearance-none text-xs"
                                                        >
                                                            <option value="Exclusiva">EXCLUSIVA</option>
                                                            <option value="Mesma Via">COMPARTILHADA (M. VIA)</option>
                                                            <option value="Diferente Via">DIFERENTE VIA</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium">
                                                        R$ {Number(item.valor_unitario_tabela_snapshot).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    {!isReadOnly && (
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removerItem(item.id_uuid_temp)}
                                                                className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* GRID DERIVADO: CÁLCULOS */}
                            <div>
                                <h4 className="text-white font-bold mb-3 text-sm uppercase tracking-wide text-slate-400 border-l-4 border-emerald-500 pl-2">Grid Cálculo (Repasse Automático)</h4>
                                <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/50">
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead className="text-slate-400 text-xs border-b border-slate-700">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">Médico</th>
                                                <th className="px-4 py-3 font-medium">P/A</th>
                                                <th className="px-4 py-3 font-medium">Via</th>
                                                <th className="px-4 py-3 font-medium text-center">% Incisão</th>
                                                <th className="px-4 py-3 font-medium">Código</th>
                                                <th className="px-4 py-3 font-medium">Descrição Procedimento</th>
                                                <th className="px-4 py-3 font-medium text-right text-emerald-400">R$ Repasse</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {itensCalculados.map(row => (
                                                <tr key={row.id_row} className="hover:bg-slate-800 transition-colors">
                                                    <td className="px-4 py-2.5 font-bold text-slate-200">{row.medico_nome}</td>
                                                    <td className="px-4 py-2.5 font-mono text-xs">{row.papel}</td>
                                                    <td className="px-4 py-2.5 text-xs uppercase">{row.via_acesso}</td>
                                                    <td className="px-4 py-2.5 text-center font-bold text-amber-500/80">{row.incisao_percent}%</td>
                                                    <td className="px-4 py-2.5 font-mono text-blue-400/80">{row.codigo}</td>
                                                    <td className="px-4 py-2.5 text-xs truncate max-w-[200px]" title={row.descricao}>{row.descricao}</td>
                                                    <td className="px-4 py-2.5 text-right font-bold text-emerald-400">
                                                        {Number(row.valor_calculado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </form>

            {/* BARRA INFERIOR FIXA NA BASE DO FLEX-COL */}
            <div className="sticky bottom-0 p-5 bg-slate-900/95 backdrop-blur-md border-t border-slate-700 flex justify-between items-center z-40 rounded-t-2xl shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.5)]">
                <div className="flex space-x-8">
                    {totalPrincipal > 0 && (
                        <div>
                            <span className="text-xs text-slate-400 block uppercase tracking-wide">Principal</span>
                            <span className="text-lg font-bold text-white">R$ {totalPrincipal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {totalAux1 > 0 && (
                        <div>
                            <span className="text-xs text-slate-400 block uppercase tracking-wide">1º Auxiliar</span>
                            <span className="text-lg font-bold text-white">R$ {totalAux1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {totalAux2 > 0 && (
                        <div>
                            <span className="text-xs text-slate-400 block uppercase tracking-wide">2º Auxiliar</span>
                            <span className="text-lg font-bold text-white">R$ {totalAux2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    <div className="border-l border-slate-700 pl-6">
                        <span className="text-xs text-emerald-500 block uppercase tracking-wide font-bold">Total do Procedimento</span>
                        <span className="text-2xl font-bold text-emerald-400">R$ {totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <div className="flex space-x-3">
                    {idEditar && onClose && (
                        <button type="button" onClick={onClose} className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors">
                            {isReadOnly ? 'Sair' : 'Cancelar Edição'}
                        </button>
                    )}
                    {!idEditar && (
                        <button type="button" onClick={() => window.location.reload()} className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors">
                            Descartar
                        </button>
                    )}

                    {!isReadOnly && (
                        <button
                            type="submit"
                            form="eventoForm"
                            disabled={saving}
                            className={`flex items-center space-x-2 px-8 py-2.5 text-white rounded-lg transition-colors font-bold shadow-lg disabled:opacity-50 ${idEditar ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/40' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/40'}`}
                        >
                            <Save size={20} />
                            <span>{saving ? 'Registrando...' : (idEditar ? 'Salvar Alterações' : 'Registrar Evento')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* MODAL PICKER DE PROCEDIMENTOS */}
            {isPickerOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-700 flex flex-col h-[80vh]">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center">
                                    <Search className="mr-3 text-blue-500" /> Consultar Tabela
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">Busque por código (ex: 3100) ou termo (ex: artroscopia).</p>
                            </div>
                            <button onClick={() => { setIsPickerOpen(false); setSearchTerm('') }} className="text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1 text-sm font-medium transition-colors">
                                Cancelar
                            </button>
                        </div>

                        <div className="p-4 border-b border-slate-700 bg-slate-900">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input
                                    type="text"
                                    placeholder="Digite ao menos 2 caracteres para buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-800 border-2 border-slate-700 focus:border-blue-500 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-500 outline-none shadow-inner"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 bg-slate-900/50">
                            {pickerLoading ? (
                                <div className="flex items-center justify-center h-full text-slate-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                                    Buscando na matriz TUSS/CBHPM...
                                </div>
                            ) : pickerResults.length > 0 ? (
                                <ul className="space-y-2 p-2">
                                    {pickerResults.map(item => (
                                        <li
                                            key={item.id}
                                            onClick={() => addItem(item)}
                                            className="bg-slate-800 border border-slate-700 rounded-xl p-4 cursor-pointer hover:border-blue-500 hover:bg-slate-750 transition-all flex justify-between items-center group"
                                        >
                                            <div className="pr-4">
                                                <span className="font-mono text-blue-400 font-bold tracking-wider">{item.codigo}</span>
                                                <p className="text-white mt-1 text-sm leading-relaxed">{item.descricao}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Valor</p>
                                                <p className="text-emerald-400 font-bold text-lg">
                                                    R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                                <div className="opacity-0 group-hover:opacity-100 flex items-center text-blue-400 text-xs font-bold uppercase tracking-wider mt-2 justify-end transition-opacity">
                                                    Inserir <ArrowRight size={14} className="ml-1" />
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : searchTerm.length >= 2 ? (
                                <div className="text-center py-20 text-slate-500">
                                    <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                                    Nenhum procedimento encontrado para "{searchTerm}".
                                </div>
                            ) : (
                                <div className="text-center py-20 text-slate-600">
                                    <BookOpen size={48} className="mx-auto mb-4 opacity-10" />
                                    Aguardando digitação para buscar na base.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
