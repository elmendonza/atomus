import { useCallback, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CampoDataHora } from '@/components/campo-data-hora';
import { supabase } from '@/src/lib/supabase';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';
import { horaParaDate, dateParaHora } from '@/src/utils/tempo';

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

type Clinica = { id: string; nome: string; cor: string; endereco: string | null };

export default function ClienteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const pacienteId = params.id;

  const [nome, setNome] = useState('');
  const [tutor, setTutor] = useState('');
  const [telefone, setTelefone] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);
  const [horario, setHorario] = useState('');
  const [endereco, setEndereco] = useState('');
  const [carregado, setCarregado] = useState(false);

  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [clinicaId, setClinicaId] = useState<string | null>(null);
  const [modoParticular, setModoParticular] = useState(true);

  const [mostrarCompleto, setMostrarCompleto] = useState(false);
  const [cpf, setCpf] = useState('');
  const [raca, setRaca] = useState('');
  const [idade, setIdade] = useState('');

  const [atendidoEmResidencia, setAtendidoEmResidencia] = useState(false);
  const [temPacote, setTemPacote] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { data: cli } = await supabase.from('clinicas').select('id, nome, cor, endereco').order('nome');
        setClinicas(cli ?? []);

        const { data: item, error } = await supabase
          .from('pacientes')
          .select('nome, tutor, telefone, forma_pagamento_preferida, dias_preferidos, horario_preferido, endereco, clinica_id, cpf, raca, idade, atendido_em_residencia')
          .eq('id', pacienteId)
          .single();
        if (error) {
          alertar('Erro ao carregar cliente', error.message);
        } else if (item) {
          setNome(item.nome);
          setTutor(item.tutor || '');
          setTelefone(item.telefone || '');
          setFormaPagamento(item.forma_pagamento_preferida || '');
          setDiasSelecionados(item.dias_preferidos ? item.dias_preferidos.split(',') : []);
          setHorario(item.horario_preferido || '');
          setEndereco(item.endereco || '');
          setClinicaId(item.clinica_id);
          setModoParticular(item.clinica_id == null);
          setCpf(item.cpf || '');
          setRaca(item.raca || '');
          setIdade(item.idade || '');
          setMostrarCompleto(!!(item.cpf || item.raca || item.idade));
          setAtendidoEmResidencia(!!item.atendido_em_residencia);
        }

        const { data: pacote } = await supabase
          .from('pacotes')
          .select('id')
          .eq('paciente_id', pacienteId)
          .maybeSingle();
        setTemPacote(!!pacote);

        setCarregado(true);
      })();
    }, [pacienteId])
  );

  function alternarDia(dia: string) {
    setDiasSelecionados((atual) =>
      atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia]
    );
  }

  async function salvar() {
    if (!nome.trim()) {
      alertar('Preencha o nome do pet');
      return;
    }
    const residenciaAtiva = !modoParticular && atendidoEmResidencia;
    const { error } = await supabase
      .from('pacientes')
      .update({
        nome: nome.trim(),
        tutor: tutor.trim(),
        telefone: telefone.trim(),
        forma_pagamento_preferida: formaPagamento.trim(),
        dias_preferidos: diasSelecionados.join(','),
        horario_preferido: horario.trim(),
        clinica_id: modoParticular ? null : clinicaId,
        endereco: modoParticular || residenciaAtiva ? endereco.trim() : '',
        atendido_em_residencia: residenciaAtiva,
        cpf: mostrarCompleto ? cpf.trim() : '',
        raca: mostrarCompleto ? raca.trim() : '',
        idade: mostrarCompleto ? idade.trim() : '',
      })
      .eq('id', pacienteId);

    if (error) {
      alertar('Erro ao salvar cliente', error.message);
      return;
    }

    if (temPacote) {
      const { data: existente } = await supabase
        .from('pacotes')
        .select('id')
        .eq('paciente_id', pacienteId)
        .maybeSingle();
      if (!existente) {
        await supabase.from('pacotes').insert({ paciente_id: pacienteId });
      }
    } else {
      await supabase.from('pacotes').delete().eq('paciente_id', pacienteId);
    }

    router.back();
  }

  async function confirmarExclusao() {
    const { count } = await supabase
      .from('atendimentos')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId);
    const total = count ?? 0;
    const mensagem =
      total > 0
        ? `Este cliente tem ${total} atendimento(s) no histórico. Ao excluir, ele(s) será(ão) apagado(s) junto. Deseja continuar?`
        : `Tem certeza que deseja excluir "${nome}"?`;

    alertar('Excluir cliente', mensagem, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('pacientes').delete().eq('id', pacienteId);
          if (error) {
            alertar('Erro ao excluir cliente', error.message);
            return;
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>Cadastro do cliente</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Pet</Text>
        <TextInput style={styles.input} placeholder="Nome do animal" placeholderTextColor={theme.colors.textTertiary} value={nome} onChangeText={setNome} />

        <Text style={styles.label}>Tutor</Text>
        <TextInput style={styles.input} placeholder="Nome do tutor" placeholderTextColor={theme.colors.textTertiary} value={tutor} onChangeText={setTutor} />

        <Text style={styles.label}>Telefone do tutor (com DDD) — opcional</Text>
        <TextInput
          style={styles.input}
          placeholder="(11) 99999-9999"
          placeholderTextColor={theme.colors.textTertiary}
          keyboardType="phone-pad"
          value={telefone}
          onChangeText={setTelefone}
        />

        <Text style={styles.label}>Forma de pagamento preferida</Text>
        <TextInput
          style={styles.input}
          placeholder="Pix, cartão, dinheiro..."
          placeholderTextColor={theme.colors.textTertiary}
          value={formaPagamento}
          onChangeText={setFormaPagamento}
        />

        <Text style={styles.label}>Dias possíveis para atendimento</Text>
        <View style={styles.chipsContainer}>
          {DIAS_SEMANA.map((dia) => {
            const ativo = diasSelecionados.includes(dia);
            return (
              <TouchableOpacity
                key={dia}
                style={[styles.diaChip, ativo && styles.diaChipAtivo]}
                onPress={() => alternarDia(dia)}
              >
                <Text style={[styles.diaChipTexto, ativo && styles.chipTextoAtivo]}>{dia}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Horário preferido</Text>
        <CampoDataHora
          valor={horaParaDate(horario)}
          modo="time"
          aoAlterar={(d) => setHorario(dateParaHora(d))}
          textoExibido={horario || 'Selecionar horário'}
          icone="time-outline"
        />

        <Text style={styles.label}>Clínica vinculada</Text>
        <View style={styles.chipsContainer}>
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
          <TouchableOpacity
            style={[styles.particularChip, modoParticular && styles.particularChipAtivo]}
            onPress={() => {
              setModoParticular(true);
              setClinicaId(null);
            }}
          >
            <Ionicons name="home-outline" size={14} color={modoParticular ? '#fff' : theme.colors.textSecondary} />
            <Text style={[styles.clinicaChipTexto, modoParticular && styles.clinicaChipTextoAtivo]}>Particular</Text>
          </TouchableOpacity>
        </View>

        {modoParticular ? (
          <>
            <Text style={styles.label}>Endereço (atendimento particular)</Text>
            <TextInput
              style={styles.input}
              placeholder="Rua, número, bairro, cidade..."
              placeholderTextColor={theme.colors.textTertiary}
              value={endereco}
              onChangeText={setEndereco}
              multiline
            />
          </>
        ) : (
          <>
            <View style={styles.enderecoBox}>
              <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.enderecoTexto}>
                {clinicaSelecionada?.endereco || 'Endereço da clínica não cadastrado. Adicione em Clínicas.'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.linhaCompleto}
              onPress={() => setAtendidoEmResidencia(!atendidoEmResidencia)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, atendidoEmResidencia && styles.checkboxAtivo]}>
                {atendidoEmResidencia && <Text style={styles.checkboxMarca}>✓</Text>}
              </View>
              <Text style={styles.label2}>Atendido em residência</Text>
            </TouchableOpacity>

            {atendidoEmResidencia && (
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Endereço da residência"
                placeholderTextColor={theme.colors.textTertiary}
                value={endereco}
                onChangeText={setEndereco}
                multiline
              />
            )}
          </>
        )}

        <TouchableOpacity style={styles.linhaCompleto} onPress={() => setMostrarCompleto(!mostrarCompleto)} activeOpacity={0.7}>
          <View style={[styles.checkbox, mostrarCompleto && styles.checkboxAtivo]}>
            {mostrarCompleto && <Text style={styles.checkboxMarca}>✓</Text>}
          </View>
          <Text style={styles.label2}>Completo</Text>
          <Text style={styles.completoDica}>(CPF, raça e idade)</Text>
        </TouchableOpacity>

        {mostrarCompleto && (
          <>
            <Text style={styles.label}>CPF do tutor</Text>
            <TextInput
              style={styles.input}
              placeholder="000.000.000-00"
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="numeric"
              value={cpf}
              onChangeText={setCpf}
            />

            <Text style={styles.label}>Raça</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Labrador, SRD, Persa..."
              placeholderTextColor={theme.colors.textTertiary}
              value={raca}
              onChangeText={setRaca}
            />

            <Text style={styles.label}>Idade</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 2 anos, 6 meses..."
              placeholderTextColor={theme.colors.textTertiary}
              value={idade}
              onChangeText={setIdade}
            />
          </>
        )}

        <TouchableOpacity style={styles.linhaCompleto} onPress={() => setTemPacote(!temPacote)} activeOpacity={0.7}>
          <View style={[styles.checkbox, temPacote && styles.checkboxAtivo]}>
            {temPacote && <Text style={styles.checkboxMarca}>✓</Text>}
          </View>
          <Text style={styles.label2}>Pacote</Text>
          <Text style={styles.completoDica}>(sessões e renovação em Pacotes)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botaoSalvar} onPress={salvar} activeOpacity={0.85}>
          <Text style={styles.botaoTexto}>Salvar cadastro</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botaoExcluir} onPress={confirmarExclusao} activeOpacity={0.7}>
          <Text style={styles.botaoExcluirTexto}>Excluir cliente</Text>
        </TouchableOpacity>
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
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  diaChip: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.full,
    paddingVertical: 8, paddingHorizontal: 16, backgroundColor: theme.colors.surface,
  },
  diaChipAtivo: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  diaChipTexto: { color: theme.colors.textSecondary, fontFamily: theme.font.medium, fontSize: 13 },
  chipTextoAtivo: { color: theme.colors.primary },
  clinicaChip: { borderWidth: 2, borderRadius: theme.radius.full, paddingVertical: 8, paddingHorizontal: 14 },
  clinicaChipTexto: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 13 },
  clinicaChipTextoAtivo: { color: '#fff' },
  particularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  particularChipAtivo: { backgroundColor: theme.colors.textSecondary, borderColor: theme.colors.textSecondary },
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
  linhaCompleto: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  completoDica: { color: theme.colors.textTertiary, fontSize: 12, fontFamily: theme.font.regular },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface,
  },
  checkboxAtivo: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checkboxMarca: { color: '#fff', fontFamily: theme.font.bold, fontSize: 13 },
  botaoSalvar: { backgroundColor: theme.colors.primary, padding: 15, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 28 },
  botaoTexto: { color: '#fff', fontFamily: theme.font.medium, fontSize: 15 },
  botaoExcluir: { padding: 15, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 12 },
  botaoExcluirTexto: { color: theme.colors.danger, fontFamily: theme.font.medium, fontSize: 14 },
});
