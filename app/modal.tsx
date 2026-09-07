import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CampoDataHora } from '@/components/campo-data-hora';
import { supabase } from '@/src/lib/supabase';
import { theme, COR_PARTICULAR, FORMAS_PAGAMENTO } from '@/src/theme';
import { isoParaDate, dateParaIso, formatarDataBR, horaParaDate, dateParaHora, hoje, somarDias, somarMeses } from '@/src/utils/tempo';
import { alertar } from '@/src/utils/alerta';
import { formatarNumeroWhatsApp } from '@/src/utils/formato';

type Clinica = { id: string; nome: string; cor: string; endereco: string | null };

type PacienteSugestao = {
  id: string;
  nome: string;
  tutor: string | null;
  telefone: string | null;
  forma_pagamento_preferida: string | null;
  horario_preferido: string | null;
  endereco: string | null;
  atendido_em_residencia: boolean | null;
};

const STATUS_OPCOES = ['agendado', 'realizado', 'cancelado'] as const;
const PROCEDIMENTOS_OPCOES = ['Acupuntura', 'Fisioterapia', 'Reabilitação', 'Outro'] as const;
const REPETICAO_OPCOES = [
  { chave: 'semanal', rotulo: 'Semanal' },
  { chave: 'quinzenal', rotulo: 'A cada 2 semanas' },
  { chave: 'mensal', rotulo: 'Mensal (mesmo dia)' },
] as const;
const REGEX_HORA = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;
const DURACAO_PADRAO_MIN = 60;

function paraMinutos(hora: string) {
  const [hh, mm] = hora.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

function formatarMinutos(minutos: number) {
  const total = Math.max(0, Math.min(minutos, 23 * 60 + 59));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function montarMensagemConfirmacao(dataIso: string, horaInicio: string) {
  return `Olá, tudo bem? ✨🤍

Estou entrando em contato para confirmar o seu agendamento:

📅 Data: ${formatarDataBR(dataIso)}
🕐 Horário: ${horaInicio}

Caso algum imprevisto, peço que me avise com antecedência.
Agradeço pela confirmação e esperamos vocês! 🤍🐶🐱`;
}

export default function ModalAtendimento() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; data?: string }>();
  const atendimentoId = params.id ?? null;

  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [clinicaId, setClinicaId] = useState<string | null>(null);
  const [modoParticular, setModoParticular] = useState(true);

  const [nomePaciente, setNomePaciente] = useState('');
  const [pacienteVinculadoId, setPacienteVinculadoId] = useState<string | null>(null);
  const [tutor, setTutor] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enderecoPaciente, setEnderecoPaciente] = useState('');
  const [atendidoEmResidencia, setAtendidoEmResidencia] = useState(false);
  const [pacote, setPacote] = useState<{ id: string; total_sessoes: number; sessoes_usadas: number; minimo_renovacao: number } | null>(null);
  const [data, setData] = useState(params.data || hoje());
  const [hora, setHora] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const duracaoRef = useRef(DURACAO_PADRAO_MIN);
  const [repetir, setRepetir] = useState(false);
  const [padraoRepeticao, setPadraoRepeticao] = useState<(typeof REPETICAO_OPCOES)[number]['chave']>('semanal');
  const [qtdRepeticoes, setQtdRepeticoes] = useState('4');
  const [procedimento, setProcedimento] = useState('');
  const [procedimentoChip, setProcedimentoChip] = useState<string>('');
  const [procedimentoOutro, setProcedimentoOutro] = useState('');
  const [valor, setValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_OPCOES)[number]>('agendado');
  const [pago, setPago] = useState(false);
  const [carregado, setCarregado] = useState(!atendimentoId);

  const [sugestoes, setSugestoes] = useState<PacienteSugestao[]>([]);
  const [sugestaoHorarioTexto, setSugestaoHorarioTexto] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { data: rows } = await supabase.from('clinicas').select('*').order('nome');
        setClinicas(rows ?? []);

        if (atendimentoId) {
          const { data: item } = await supabase
            .from('atendimentos')
            .select(
              `data, hora, hora_fim, procedimento, valor, forma_pagamento, status, pago,
               clinica_id, paciente_id, pacientes(nome, tutor, telefone, endereco, atendido_em_residencia)`
            )
            .eq('id', atendimentoId)
            .single();
          if (item) {
            const paciente = item.pacientes as unknown as { nome: string; tutor: string | null; telefone: string | null; endereco: string | null; atendido_em_residencia: boolean | null } | null;
            setData(item.data);
            setHora(item.hora);
            setHoraFim(item.hora_fim);
            duracaoRef.current = Math.max(paraMinutos(item.hora_fim) - paraMinutos(item.hora), 5);
            aplicarProcedimento(item.procedimento || '');
            setValor(item.valor ? String(item.valor).replace('.', ',') : '');
            setFormaPagamento(item.forma_pagamento || '');
            setStatus((item.status as any) || 'agendado');
            setPago(!!item.pago);
            setClinicaId(item.clinica_id);
            setModoParticular(item.clinica_id == null);
            setNomePaciente(paciente?.nome ?? '');
            setPacienteVinculadoId(item.paciente_id);
            setTutor(paciente?.tutor || '');
            setTelefone(paciente?.telefone || '');
            setEnderecoPaciente(paciente?.endereco || '');
            setAtendidoEmResidencia(!!paciente?.atendido_em_residencia);
            carregarPacote(item.paciente_id);
          }
          setCarregado(true);
        }
      })();
    }, [atendimentoId])
  );

  useEffect(() => {
    if (atendimentoId) return;
    const termo = nomePaciente.trim();
    if (termo.length < 2) {
      setSugestoes([]);
      return;
    }
    let cancelado = false;
    (async () => {
      const { data: rows } = await supabase
        .from('pacientes')
        .select('id, nome, tutor, telefone, forma_pagamento_preferida, horario_preferido, endereco, atendido_em_residencia')
        .ilike('nome', `%${termo}%`)
        .order('nome')
        .limit(5);
      if (!cancelado) setSugestoes((rows ?? []).filter((r) => r.nome.toLowerCase() !== termo.toLowerCase()));
    })();
    return () => {
      cancelado = true;
    };
  }, [nomePaciente, atendimentoId]);

  async function carregarPacote(pacienteId: string) {
    const { data } = await supabase
      .from('pacotes')
      .select('id, total_sessoes, sessoes_usadas, minimo_renovacao')
      .eq('paciente_id', pacienteId)
      .maybeSingle();
    setPacote(data ?? null);
  }

  function aoDigitarNomePaciente(texto: string) {
    setNomePaciente(texto);
    if (!atendimentoId) {
      setPacienteVinculadoId(null);
      setSugestaoHorarioTexto('');
      setAtendidoEmResidencia(false);
      setPacote(null);
    }
  }

  function aplicarProcedimento(procedimentoCarregado: string) {
    setProcedimento(procedimentoCarregado);
    if (['Acupuntura', 'Fisioterapia', 'Reabilitação'].includes(procedimentoCarregado)) {
      setProcedimentoChip(procedimentoCarregado);
      setProcedimentoOutro('');
    } else {
      setProcedimentoChip(procedimentoCarregado ? 'Outro' : '');
      setProcedimentoOutro(procedimentoCarregado);
    }
  }

  async function aplicarUltimoAtendimento(pacienteId: string) {
    const { data: ultimo } = await supabase
      .from('atendimentos')
      .select('clinica_id, procedimento, valor')
      .eq('paciente_id', pacienteId)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ultimo) return;
    if (ultimo.clinica_id) {
      setClinicaId(ultimo.clinica_id);
      setModoParticular(false);
    } else {
      setClinicaId(null);
      setModoParticular(true);
    }
    aplicarProcedimento(ultimo.procedimento || '');
    if (ultimo.valor) {
      setValor(String(ultimo.valor).replace('.', ','));
    }
  }

  function selecionarSugestao(item: PacienteSugestao) {
    setNomePaciente(item.nome);
    setPacienteVinculadoId(item.id);
    setTutor(item.tutor || '');
    setTelefone(item.telefone || '');
    setEnderecoPaciente(item.endereco || '');
    setAtendidoEmResidencia(!!item.atendido_em_residencia);
    carregarPacote(item.id);
    aplicarUltimoAtendimento(item.id);
    if (!formaPagamento && item.forma_pagamento_preferida) {
      setFormaPagamento(item.forma_pagamento_preferida);
    }
    if (item.horario_preferido && REGEX_HORA.test(item.horario_preferido)) {
      if (!hora) {
        setHora(item.horario_preferido);
        setHoraFim(formatarMinutos(paraMinutos(item.horario_preferido) + duracaoRef.current));
      }
      setSugestaoHorarioTexto('');
    } else {
      setSugestaoHorarioTexto(item.horario_preferido || '');
    }
    setSugestoes([]);
  }

  function aoAlterarHora(d: Date) {
    const novaHora = dateParaHora(d);
    setHora(novaHora);
    setHoraFim(formatarMinutos(paraMinutos(novaHora) + duracaoRef.current));
  }

  function aoAlterarHoraFim(d: Date) {
    const novoHoraFim = dateParaHora(d);
    if (!hora) {
      alertar('Selecione primeiro o horário de início.');
      return;
    }
    const duracao = paraMinutos(novoHoraFim) - paraMinutos(hora);
    if (duracao <= 0) {
      alertar('O horário de término deve ser depois do horário de início.');
      return;
    }
    duracaoRef.current = duracao;
    setHoraFim(novoHoraFim);
  }

  async function salvar() {
    if (!nomePaciente.trim() || (!clinicaId && !modoParticular) || !hora.trim() || !horaFim.trim()) {
      alertar('Preencha ao menos: paciente, clínica (ou particular), horário de início e de término.');
      return;
    }
    if (paraMinutos(horaFim) <= paraMinutos(hora)) {
      alertar('O horário de término deve ser depois do horário de início.');
      return;
    }
    let pacienteId: string;
    if (pacienteVinculadoId) {
      // Paciente já identificado (edição de atendimento existente ou selecionado
      // via sugestão do autocompletar): atualiza o mesmo registro em vez de
      // procurar por nome, evitando renomear/mesclar o cliente errado.
      pacienteId = pacienteVinculadoId;
      const { error } = await supabase
        .from('pacientes')
        .update({ nome: nomePaciente.trim(), tutor: tutor.trim(), telefone: telefone.trim() })
        .eq('id', pacienteId);
      if (error) {
        alertar('Erro ao salvar paciente', error.message);
        return;
      }
    } else {
      const { data: pacientesExistentes } = await supabase
        .from('pacientes')
        .select('id')
        .eq('nome', nomePaciente.trim())
        .limit(1);
      if (pacientesExistentes && pacientesExistentes.length > 0) {
        pacienteId = pacientesExistentes[0].id;
        const { error } = await supabase
          .from('pacientes')
          .update({ tutor: tutor.trim(), telefone: telefone.trim() })
          .eq('id', pacienteId);
        if (error) {
          alertar('Erro ao salvar paciente', error.message);
          return;
        }
      } else {
        const { data: novoPaciente, error } = await supabase
          .from('pacientes')
          .insert({ nome: nomePaciente.trim(), tutor: tutor.trim(), telefone: telefone.trim() })
          .select('id')
          .single();
        if (error || !novoPaciente) {
          alertar('Erro ao criar paciente', error?.message ?? 'Tente novamente.');
          return;
        }
        pacienteId = novoPaciente.id;
      }
    }

    const valorNumerico = valor ? parseFloat(valor.replace(',', '.')) : 0;
    const dataPagamento = pago ? hoje() : null;
    const clinicaFinal = modoParticular ? null : clinicaId;

    const dadosAtendimento = {
      paciente_id: pacienteId,
      clinica_id: clinicaFinal,
      data,
      hora: hora.trim(),
      hora_fim: horaFim.trim(),
      procedimento: procedimento.trim(),
      valor: valorNumerico,
      forma_pagamento: formaPagamento.trim(),
      status,
      pago,
      data_pagamento: dataPagamento,
    };

    const { error: erroAtendimento } = atendimentoId
      ? await supabase.from('atendimentos').update(dadosAtendimento).eq('id', atendimentoId)
      : await supabase.from('atendimentos').insert(dadosAtendimento);

    if (erroAtendimento) {
      alertar('Erro ao salvar atendimento', erroAtendimento.message);
      return;
    }

    if (!atendimentoId) {
      // Novo agendamento: se o paciente tem pacote, já desconta uma sessão.
      const { data: pacoteExistente } = await supabase
        .from('pacotes')
        .select('id, sessoes_usadas')
        .eq('paciente_id', pacienteId)
        .maybeSingle();
      if (pacoteExistente) {
        await supabase
          .from('pacotes')
          .update({ sessoes_usadas: pacoteExistente.sessoes_usadas + 1 })
          .eq('id', pacoteExistente.id);
      }

      if (repetir) {
        const quantidade = Math.max(1, Math.min(52, parseInt(qtdRepeticoes, 10) || 1));
        let sessoesAdicionais = 0;
        for (let i = 1; i < quantidade; i++) {
          const proximaData =
            padraoRepeticao === 'semanal'
              ? somarDias(data, 7 * i)
              : padraoRepeticao === 'quinzenal'
                ? somarDias(data, 14 * i)
                : somarMeses(data, i);
          const { error: erroRepeticao } = await supabase.from('atendimentos').insert({
            ...dadosAtendimento,
            data: proximaData,
            status: 'agendado',
            pago: false,
            data_pagamento: null,
          });
          if (!erroRepeticao) sessoesAdicionais += 1;
        }
        if (pacoteExistente && sessoesAdicionais > 0) {
          await supabase
            .from('pacotes')
            .update({ sessoes_usadas: pacoteExistente.sessoes_usadas + 1 + sessoesAdicionais })
            .eq('id', pacoteExistente.id);
        }
      }
    }

    if (telefone.trim()) {
      alertar('Confirmação por WhatsApp', 'Deseja enviar a confirmação do agendamento pelo WhatsApp?', [
        { text: 'Não', style: 'cancel', onPress: () => router.back() },
        {
          text: 'Sim',
          onPress: () => {
            enviarConfirmacaoWhatsApp();
            router.back();
          },
        },
      ]);
    } else {
      router.back();
    }
  }

  function enviarConfirmacaoWhatsApp() {
    if (!telefone.trim()) {
      alertar('Cadastre o telefone do tutor para enviar a confirmação pelo WhatsApp.');
      return;
    }
    if (!data || !hora) {
      alertar('Preencha a data e o horário antes de enviar a confirmação.');
      return;
    }
    const numero = formatarNumeroWhatsApp(telefone);
    const mensagem = montarMensagemConfirmacao(data, hora);
    Linking.openURL(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`);
  }

  function confirmarExclusao() {
    alertar('Excluir atendimento', 'Tem certeza que deseja excluir este atendimento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('atendimentos').delete().eq('id', atendimentoId!);
          if (error) {
            alertar('Erro ao excluir atendimento', error.message);
            return;
          }
          if (pacote) {
            await supabase
              .from('pacotes')
              .update({ sessoes_usadas: Math.max(0, pacote.sessoes_usadas - 1) })
              .eq('id', pacote.id);
          }
          router.back();
        },
      },
    ]);
  }

  if (!carregado) {
    return <SafeAreaView style={styles.container} />;
  }

  const clinicaSelecionada = clinicas.find((c) => c.id === clinicaId);
  const residenciaAtiva = !modoParticular && atendidoEmResidencia && !!enderecoPaciente;
  const enderecoExibido = modoParticular || residenciaAtiva ? enderecoPaciente : clinicaSelecionada?.endereco;
  const restantesPacote = pacote ? pacote.total_sessoes - pacote.sessoes_usadas : null;
  const pacotePrecisaRenovar =
    !!pacote && pacote.total_sessoes > 0 && restantesPacote !== null && restantesPacote <= pacote.minimo_renovacao;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>{atendimentoId ? 'Editar atendimento' : 'Novo atendimento'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Paciente</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome do animal"
            placeholderTextColor={theme.colors.textTertiary}
            value={nomePaciente}
            onChangeText={aoDigitarNomePaciente}
          />
          {sugestoes.length > 0 && (
            <View style={styles.sugestoesContainer}>
              {sugestoes.map((item) => (
                <TouchableOpacity key={item.id} style={styles.sugestaoItem} onPress={() => selecionarSugestao(item)}>
                  <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sugestaoNome}>{item.nome}</Text>
                    <Text style={styles.sugestaoDetalhe}>Tutor: {item.tutor || 'Não informado'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {!!pacote && (
            <Text style={[styles.dica, pacotePrecisaRenovar && styles.dicaAlerta]}>
              📦 Pacote: {pacote.sessoes_usadas} de {pacote.total_sessoes} sessões usadas
              {pacotePrecisaRenovar ? ' · hora de renovar' : ''}
            </Text>
          )}

          <Text style={styles.label}>Tutor</Text>
          <TextInput style={styles.input} placeholder="Nome do tutor" placeholderTextColor={theme.colors.textTertiary} value={tutor} onChangeText={setTutor} />

          <Text style={styles.label}>Clínica</Text>
          <View style={styles.chipsContainer}>
            <TouchableOpacity
              style={[styles.particularChip, modoParticular && styles.particularChipAtivo]}
              onPress={() => {
                setModoParticular(true);
                setClinicaId(null);
              }}
            >
              <Ionicons name="home-outline" size={14} color={modoParticular ? '#fff' : COR_PARTICULAR} />
              <Text style={[styles.clinicaChipTexto, modoParticular && styles.clinicaChipTextoAtivo]}>Particular</Text>
            </TouchableOpacity>
            {clinicas.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.clinicaChip,
                  { borderColor: c.cor },
                  !modoParticular && clinicaId === c.id && { backgroundColor: c.cor },
                ]}
                onPress={() => {
                  setClinicaId(c.id);
                  setModoParticular(false);
                }}
              >
                <Text style={[styles.clinicaChipTexto, !modoParticular && clinicaId === c.id && styles.clinicaChipTextoAtivo]}>
                  {c.nome}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {clinicas.length === 0 && !modoParticular && (
            <Text style={styles.aviso}>Cadastre uma clínica na aba &quot;Clínicas&quot; ou use &quot;Particular&quot;.</Text>
          )}

          {(clinicaId || modoParticular) && (
            <View style={styles.enderecoBox}>
              <Ionicons name={residenciaAtiva ? 'home-outline' : 'location-outline'} size={16} color={theme.colors.textSecondary} />
              <View style={{ flex: 1 }}>
                {residenciaAtiva && <Text style={styles.enderecoRotulo}>Atendido em residência</Text>}
                <Text style={styles.enderecoTexto}>
                  {enderecoExibido ||
                    (modoParticular
                      ? 'Endereço do cliente não cadastrado. Adicione em Clientes.'
                      : 'Endereço da clínica não cadastrado. Adicione em Clínicas.')}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.label}>Data</Text>
          <CampoDataHora
            valor={isoParaDate(data)}
            modo="date"
            aoAlterar={(d) => setData(dateParaIso(d))}
            textoExibido={formatarDataBR(data)}
            icone="calendar-outline"
          />

          <View style={styles.linha}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Horário de início</Text>
              <CampoDataHora
                valor={horaParaDate(hora)}
                modo="time"
                aoAlterar={aoAlterarHora}
                textoExibido={hora || 'Selecionar horário'}
                icone="time-outline"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Horário de término</Text>
              <CampoDataHora
                valor={horaParaDate(horaFim || hora)}
                modo="time"
                aoAlterar={aoAlterarHoraFim}
                textoExibido={horaFim || 'Selecionar horário'}
                icone="time-outline"
              />
            </View>
          </View>
          {!!hora && !!horaFim && (
            <Text style={styles.dica}>Duração: {paraMinutos(horaFim) - paraMinutos(hora)} min</Text>
          )}
          {!!sugestaoHorarioTexto && (
            <Text style={styles.dica}>💡 Horário sugerido no cadastro: {sugestaoHorarioTexto}</Text>
          )}

          {!atendimentoId && (
            <>
              <TouchableOpacity style={styles.linhaPago} onPress={() => setRepetir(!repetir)} activeOpacity={0.7}>
                <View style={[styles.checkbox, repetir && styles.checkboxAtivo]}>
                  {repetir && <Text style={styles.checkboxMarca}>✓</Text>}
                </View>
                <Text style={styles.label2}>Repetir agendamento</Text>
              </TouchableOpacity>

              {repetir && (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.chipsContainer}>
                    {REPETICAO_OPCOES.map((r) => (
                      <TouchableOpacity
                        key={r.chave}
                        style={[styles.statusChip, padraoRepeticao === r.chave && styles.statusChipAtivo]}
                        onPress={() => setPadraoRepeticao(r.chave)}
                      >
                        <Text style={[styles.statusChipTexto, padraoRepeticao === r.chave && styles.chipTextoAtivo]}>
                          {r.rotulo}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.label, { marginTop: 12 }]}>Quantas vezes (incluindo esta)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="4"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="number-pad"
                    value={qtdRepeticoes}
                    onChangeText={setQtdRepeticoes}
                  />
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>Procedimento</Text>
          <View style={styles.chipsContainer}>
            {PROCEDIMENTOS_OPCOES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.statusChip, procedimentoChip === p && styles.statusChipAtivo]}
                onPress={() => {
                  setProcedimentoChip(p);
                  setProcedimento(p === 'Outro' ? procedimentoOutro : p);
                }}
              >
                <Text style={[styles.statusChipTexto, procedimentoChip === p && styles.chipTextoAtivo]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {procedimentoChip === 'Outro' && (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Descreva o procedimento"
              placeholderTextColor={theme.colors.textTertiary}
              value={procedimentoOutro}
              onChangeText={(texto) => {
                setProcedimentoOutro(texto);
                setProcedimento(texto);
              }}
            />
          )}

          <Text style={styles.label}>Status</Text>
          <View style={styles.chipsContainer}>
            {STATUS_OPCOES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, status === s && styles.statusChipAtivo]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.statusChipTexto, status === s && styles.chipTextoAtivo]}>
                  {s === 'agendado' ? 'Agendado' : s === 'realizado' ? 'Realizado' : 'Cancelado'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Valor (R$)</Text>
          <TextInput style={styles.input} placeholder="150.00" placeholderTextColor={theme.colors.textTertiary} keyboardType="decimal-pad" value={valor} onChangeText={setValor} />

          <Text style={styles.label}>Forma de pagamento</Text>
          <View style={styles.chipsContainer}>
            {FORMAS_PAGAMENTO.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.statusChip, formaPagamento === f && styles.statusChipAtivo]}
                onPress={() => setFormaPagamento(f)}
              >
                <Text style={[styles.statusChipTexto, formaPagamento === f && styles.chipTextoAtivo]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.linhaPago} onPress={() => setPago(!pago)} activeOpacity={0.7}>
            <View style={[styles.checkbox, pago && styles.checkboxAtivo]}>
              {pago && <Text style={styles.checkboxMarca}>✓</Text>}
            </View>
            <Text style={styles.label2}>Pagamento recebido</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.botaoSalvar} onPress={salvar} activeOpacity={0.85}>
            <Text style={styles.botaoTexto}>{atendimentoId ? 'Salvar alterações' : 'Salvar atendimento'}</Text>
          </TouchableOpacity>

          {atendimentoId && (
            <TouchableOpacity style={styles.botaoExcluir} onPress={confirmarExclusao} activeOpacity={0.7}>
              <Text style={styles.botaoExcluirTexto}>Excluir atendimento</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  headerTitulo: { color: theme.colors.text, fontSize: 16, fontFamily: theme.font.medium },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.medium, marginBottom: 6, marginTop: 14 },
  label2: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12,
    fontSize: 15, fontFamily: theme.font.regular, color: theme.colors.text, backgroundColor: theme.colors.surface,
  },
  sugestoesContainer: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  sugestaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    backgroundColor: theme.colors.surfaceVariant,
  },
  sugestaoNome: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 14 },
  sugestaoDetalhe: { color: theme.colors.textSecondary, fontFamily: theme.font.regular, fontSize: 12, marginTop: 1 },
  linha: { flexDirection: 'row', gap: 10 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clinicaChip: { borderWidth: 2, borderRadius: theme.radius.full, paddingVertical: 8, paddingHorizontal: 14 },
  clinicaChipTexto: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 13 },
  clinicaChipTextoAtivo: { color: '#fff' },
  particularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: COR_PARTICULAR,
    borderRadius: theme.radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  particularChipAtivo: { backgroundColor: COR_PARTICULAR, borderColor: COR_PARTICULAR },
  enderecoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  enderecoTexto: { flex: 1, color: theme.colors.textSecondary, fontFamily: theme.font.regular, fontSize: 13 },
  enderecoRotulo: { color: theme.colors.primary, fontFamily: theme.font.medium, fontSize: 12, marginBottom: 2 },
  statusChip: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.full, paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: theme.colors.surface,
  },
  statusChipAtivo: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  statusChipTexto: { color: theme.colors.textSecondary, fontFamily: theme.font.medium, fontSize: 13 },
  chipTextoAtivo: { color: theme.colors.primary },
  aviso: { color: theme.colors.danger, fontFamily: theme.font.regular, fontSize: 13, marginTop: 8 },
  dica: { color: theme.colors.primary, fontFamily: theme.font.regular, fontSize: 12, marginTop: 6 },
  dicaAlerta: { color: theme.colors.warning, fontFamily: theme.font.medium },
  linhaPago: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface,
  },
  checkboxAtivo: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  checkboxMarca: { color: '#fff', fontFamily: theme.font.bold, fontSize: 13 },
  botaoSalvar: { backgroundColor: theme.colors.primary, padding: 15, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 28 },
  botaoTexto: { color: '#fff', fontFamily: theme.font.medium, fontSize: 15 },
  botaoExcluir: { padding: 15, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 12 },
  botaoExcluirTexto: { color: theme.colors.danger, fontFamily: theme.font.medium, fontSize: 14 },
});
