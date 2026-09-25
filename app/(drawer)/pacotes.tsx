import { useCallback, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DrawerMenuButton } from '@/components/drawer-menu-button';
import { supabase } from '@/src/lib/supabase';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';
import { formatarNumeroWhatsApp } from '@/src/utils/formato';
import { buscarAtendimentosPacote, buscarDatasPacote, montarMensagemRenovacao } from '@/src/utils/pacote';
import { formatarDataBR, hoje } from '@/src/utils/tempo';

type Pacote = {
  id: string;
  paciente_id: string;
  total_sessoes: number;
  sessoes_usadas: number;
  minimo_renovacao: number;
  paciente_nome: string;
  paciente_tutor: string | null;
  paciente_telefone: string | null;
};

function precisaRenovar(item: Pacote) {
  return item.total_sessoes > 0 && item.total_sessoes - item.sessoes_usadas <= item.minimo_renovacao;
}

export default function PacotesScreen() {
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [totalSessoes, setTotalSessoes] = useState('');
  const [sessoesUsadas, setSessoesUsadas] = useState('');
  const [minimoRenovacao, setMinimoRenovacao] = useState('');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('pacotes')
      .select('id, paciente_id, total_sessoes, sessoes_usadas, minimo_renovacao, pacientes(nome, tutor, telefone)')
      .order('id');
    if (error) {
      alertar('Erro ao carregar pacotes', error.message);
      return;
    }
    const lista = (data ?? [])
      .map((r: any) => ({
        id: r.id,
        paciente_id: r.paciente_id,
        total_sessoes: r.total_sessoes,
        sessoes_usadas: r.sessoes_usadas,
        minimo_renovacao: r.minimo_renovacao,
        paciente_nome: r.pacientes?.nome ?? '',
        paciente_tutor: r.pacientes?.tutor ?? null,
        paciente_telefone: r.pacientes?.telefone ?? null,
      }))
      .sort((a, b) => a.paciente_nome.localeCompare(b.paciente_nome));
    setPacotes(lista);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  function limparFormulario() {
    setEditandoId(null);
    setTotalSessoes('');
    setSessoesUsadas('');
    setMinimoRenovacao('');
  }

  function iniciarEdicao(item: Pacote) {
    setEditandoId(item.id);
    setTotalSessoes(String(item.total_sessoes));
    setSessoesUsadas(String(item.sessoes_usadas));
    setMinimoRenovacao(String(item.minimo_renovacao));
  }

  async function salvar() {
    if (!editandoId) return;
    const dados = {
      total_sessoes: parseInt(totalSessoes, 10) || 0,
      sessoes_usadas: parseInt(sessoesUsadas, 10) || 0,
      minimo_renovacao: parseInt(minimoRenovacao, 10) || 0,
    };
    const { error } = await supabase.from('pacotes').update(dados).eq('id', editandoId);
    if (error) {
      alertar('Erro ao salvar pacote', error.message);
      return;
    }
    limparFormulario();
    carregar();
  }

  async function renovar(item: Pacote) {
    const { error } = await supabase.from('pacotes').update({ sessoes_usadas: 0 }).eq('id', item.id);
    if (error) {
      alertar('Erro ao renovar pacote', error.message);
      return;
    }
    if (editandoId === item.id) setSessoesUsadas('0');
    carregar();
  }

  async function enviarMensagemRenovacao(item: Pacote) {
    if (!item.paciente_telefone) {
      alertar('Cadastre o telefone do tutor em Clientes para enviar a mensagem.');
      return;
    }
    const { datas, algumaFutura } = await buscarDatasPacote(item.paciente_id, item.sessoes_usadas);
    const numero = formatarNumeroWhatsApp(item.paciente_telefone);
    const mensagem = montarMensagemRenovacao(item.paciente_nome, datas, algumaFutura);
    Linking.openURL(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`);
  }

  // Pacote pago: marca como pagos os atendimentos REALIZADOS do pacote que ainda estão pendentes (pede confirmação com a lista).
  async function marcarPago(item: Pacote) {
    const todos = await buscarAtendimentosPacote(item.paciente_id, item.sessoes_usadas);
    const pendentes = todos.filter((a) => a.status === 'realizado' && !a.pago);
    if (pendentes.length === 0) {
      alertar('Pacote pago', todos.length === 0 ? 'Não há atendimentos neste pacote.' : 'Todos os atendimentos realizados deste pacote já estão pagos.');
      return;
    }
    const lista = pendentes.map((a) => `${formatarDataBR(a.data)} ${a.hora}`).join('\n');
    alertar(
      'Marcar pacote como pago',
      `${item.paciente_nome}: ${pendentes.length} ${pendentes.length === 1 ? 'atendimento realizado será marcado' : 'atendimentos realizados serão marcados'} como pago(s):\n\n${lista}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar pago',
          onPress: async () => {
            const { error } = await supabase
              .from('atendimentos')
              .update({ pago: true, data_pagamento: hoje() })
              .in('id', pendentes.map((a) => a.id));
            if (error) {
              alertar('Erro ao marcar como pago', error.message);
              return;
            }
            alertar('Pacote pago', `${pendentes.length} ${pendentes.length === 1 ? 'atendimento marcado' : 'atendimentos marcados'} como pago.`);
          },
        },
      ]
    );
  }

  function confirmarRemocao(item: Pacote) {
    alertar('Remover pacote', `Remover o pacote de "${item.paciente_nome}"? O paciente continua cadastrado normalmente.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('pacotes').delete().eq('id', item.id);
          if (error) {
            alertar('Erro ao remover pacote', error.message);
            return;
          }
          if (editandoId === item.id) limparFormulario();
          carregar();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <DrawerMenuButton />
        <Text style={styles.headerTitulo}>Pacotes</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <FlatList
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          data={pacotes}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            editandoId ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitulo}>
                  {pacotes.find((p) => p.id === editandoId)?.paciente_nome}
                </Text>

                <Text style={styles.label}>Total de sessões do pacote</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 10"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="number-pad"
                  value={totalSessoes}
                  onChangeText={setTotalSessoes}
                />

                <Text style={styles.label}>Sessões já usadas</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 0"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="number-pad"
                  value={sessoesUsadas}
                  onChangeText={setSessoesUsadas}
                />

                <Text style={styles.label}>Avisar renovação quando restarem</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 2"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="number-pad"
                  value={minimoRenovacao}
                  onChangeText={setMinimoRenovacao}
                />

                <TouchableOpacity style={styles.botao} onPress={salvar} activeOpacity={0.85}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.botaoTexto}>Salvar alterações</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.botaoCancelar} onPress={limparFormulario} activeOpacity={0.7}>
                  <Text style={styles.botaoCancelarTexto}>Cancelar edição</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.vazioContainer}>
              <Ionicons name="albums-outline" size={36} color={theme.colors.textTertiary} />
              <Text style={styles.vazio}>Nenhum paciente com pacote</Text>
              <Text style={styles.vazioDica}>Marque a opção &quot;Pacote&quot; no cadastro do cliente para ele aparecer aqui.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const restantes = item.total_sessoes - item.sessoes_usadas;
            const alerta = precisaRenovar(item);
            return (
              <TouchableOpacity
                style={[styles.itemPacote, editandoId === item.id && styles.itemPacoteAtivo]}
                onPress={() => iniciarEdicao(item)}
                activeOpacity={0.7}
              >
                {alerta && <View style={styles.pontoAlerta} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemNome}>{item.paciente_nome}</Text>
                  <Text style={styles.itemDetalhe}>Tutor: {item.paciente_tutor || 'Não informado'}</Text>
                  <Text style={[styles.itemDetalhe, alerta && styles.itemDetalheAlerta]}>
                    {item.sessoes_usadas} de {item.total_sessoes} sessões usadas · restam {restantes}
                    {alerta ? ' · renovar' : ''}
                  </Text>
                </View>
                <View style={{ gap: 10, alignItems: 'flex-end' }}>
                  <TouchableOpacity onPress={() => enviarMensagemRenovacao(item)} hitSlop={8} style={styles.linhaWhatsapp}>
                    <Ionicons name="logo-whatsapp" size={14} color={theme.colors.success} />
                    <Text style={styles.whatsapp}>Mensagem</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => marcarPago(item)} hitSlop={8} style={styles.linhaWhatsapp}>
                    <Ionicons name="cash-outline" size={14} color={theme.colors.success} />
                    <Text style={styles.whatsapp}>Pago</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => renovar(item)} hitSlop={8}>
                    <Text style={styles.renovar}>Renovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmarRemocao(item)} hitSlop={8}>
                    <Text style={styles.remover}>Remover</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  headerTitulo: { color: theme.colors.text, fontSize: 28, fontFamily: theme.font.bold },
  formCard: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
  },
  formTitulo: { color: theme.colors.text, fontSize: 16, fontFamily: theme.font.medium, marginBottom: 12 },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.medium, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    fontSize: 15,
    fontFamily: theme.font.regular,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    marginBottom: 16,
  },
  botao: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoTexto: { color: '#fff', fontFamily: theme.font.medium, fontSize: 15 },
  botaoCancelar: { paddingVertical: 12, alignItems: 'center' },
  botaoCancelarTexto: { color: theme.colors.textSecondary, fontFamily: theme.font.medium, fontSize: 13 },
  vazioContainer: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 40 },
  vazio: { color: theme.colors.textSecondary, fontSize: 14, fontFamily: theme.font.medium },
  vazioDica: { color: theme.colors.textTertiary, fontSize: 12, fontFamily: theme.font.regular, textAlign: 'center' },
  itemPacote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    gap: 12,
  },
  itemPacoteAtivo: { backgroundColor: theme.colors.primaryLight },
  pontoAlerta: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.warning },
  itemNome: { fontSize: 15, fontFamily: theme.font.medium, color: theme.colors.text },
  itemDetalhe: { fontSize: 12, fontFamily: theme.font.regular, color: theme.colors.textSecondary, marginTop: 2 },
  itemDetalheAlerta: { color: theme.colors.warning, fontFamily: theme.font.medium },
  linhaWhatsapp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  whatsapp: { color: theme.colors.success, fontFamily: theme.font.medium, fontSize: 13 },
  renovar: { color: theme.colors.primary, fontFamily: theme.font.medium, fontSize: 13 },
  remover: { color: theme.colors.danger, fontFamily: theme.font.medium, fontSize: 13 },
});
