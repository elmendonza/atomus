import { useCallback, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DrawerMenuButton } from '@/components/drawer-menu-button';
import { supabase } from '@/src/lib/supabase';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';

const CORES = ['#1A73E8', '#D93025', '#1E8E3E', '#F29900', '#9334E6', '#12B5CB', '#E52592', '#795548'];

type Clinica = { id: string; nome: string; cor: string; percentual: number; endereco: string | null };

export default function ClinicasScreen() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [nome, setNome] = useState('');
  const [percentual, setPercentual] = useState('100');
  const [endereco, setEndereco] = useState('');
  const [corSelecionada, setCorSelecionada] = useState(CORES[0]);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const carregarClinicas = useCallback(async () => {
    const { data, error } = await supabase.from('clinicas').select('*').order('nome');
    if (error) {
      alertar('Erro ao carregar clínicas', error.message);
      return;
    }
    setClinicas(data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarClinicas();
    }, [carregarClinicas])
  );

  function limparFormulario() {
    setNome('');
    setPercentual('100');
    setEndereco('');
    setCorSelecionada(CORES[0]);
    setEditandoId(null);
  }

  function iniciarEdicao(item: Clinica) {
    setEditandoId(item.id);
    setNome(item.nome);
    setCorSelecionada(item.cor);
    setPercentual(String(item.percentual ?? 100).replace('.', ','));
    setEndereco(item.endereco || '');
  }

  async function salvarClinica() {
    if (!nome.trim()) {
      alertar('Preencha o nome da clínica');
      return;
    }
    const percentualNumerico = percentual ? parseFloat(percentual.replace(',', '.')) : 100;

    const dados = {
      nome: nome.trim(),
      cor: corSelecionada,
      percentual: percentualNumerico,
      endereco: endereco.trim(),
    };

    const { error } = editandoId
      ? await supabase.from('clinicas').update(dados).eq('id', editandoId)
      : await supabase.from('clinicas').insert(dados);

    if (error) {
      alertar('Erro ao salvar clínica', error.message);
      return;
    }
    limparFormulario();
    carregarClinicas();
  }

  async function confirmarRemocao(item: Clinica) {
    const { count } = await supabase
      .from('atendimentos')
      .select('id', { count: 'exact', head: true })
      .eq('clinica_id', item.id);
    const total = count ?? 0;
    const mensagem =
      total > 0
        ? `Esta clínica tem ${total} atendimento(s) registrado(s). Ao excluir, ele(s) ficará(ão) marcado(s) como "Particular" no histórico. Deseja continuar?`
        : `Tem certeza que deseja excluir "${item.nome}"?`;

    alertar('Excluir clínica', mensagem, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('clinicas').delete().eq('id', item.id);
          if (error) {
            alertar('Erro ao excluir clínica', error.message);
            return;
          }
          if (editandoId === item.id) limparFormulario();
          carregarClinicas();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <DrawerMenuButton />
        <Text style={styles.headerTitulo}>Clínicas</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <FlatList
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          data={clinicas}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.formCard}>
              <Text style={styles.label}>Nome da clínica</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Clínica Central"
                placeholderTextColor={theme.colors.textTertiary}
                value={nome}
                onChangeText={setNome}
              />

              <Text style={styles.label}>Endereço</Text>
              <TextInput
                style={styles.input}
                placeholder="Rua, número, bairro, cidade..."
                placeholderTextColor={theme.colors.textTertiary}
                value={endereco}
                onChangeText={setEndereco}
                multiline
              />

              <Text style={styles.label}>Percentual que a clínica recebe (%)</Text>
              <TextInput
                style={styles.input}
                placeholder="100"
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="decimal-pad"
                value={percentual}
                onChangeText={setPercentual}
              />

              <Text style={styles.label}>Cor</Text>
              <View style={styles.coresContainer}>
                {CORES.map((cor) => (
                  <TouchableOpacity
                    key={cor}
                    style={[
                      styles.corBolinha,
                      { backgroundColor: cor },
                      corSelecionada === cor && styles.corSelecionada,
                    ]}
                    onPress={() => setCorSelecionada(cor)}
                  />
                ))}
              </View>

              <TouchableOpacity style={styles.botao} onPress={salvarClinica} activeOpacity={0.85}>
                <Ionicons name={editandoId ? 'checkmark' : 'add'} size={18} color="#fff" />
                <Text style={styles.botaoTexto}>{editandoId ? 'Salvar alterações' : 'Adicionar clínica'}</Text>
              </TouchableOpacity>

              {editandoId && (
                <TouchableOpacity style={styles.botaoCancelar} onPress={limparFormulario} activeOpacity={0.7}>
                  <Text style={styles.botaoCancelarTexto}>Cancelar edição</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.vazioContainer}>
              <Ionicons name="business-outline" size={36} color={theme.colors.textTertiary} />
              <Text style={styles.vazio}>Nenhuma clínica cadastrada</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.itemClinica, editandoId === item.id && styles.itemClinicaAtivo]}
              onPress={() => iniciarEdicao(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.corBolinhaItem, { backgroundColor: item.cor }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNome}>{item.nome}</Text>
                <Text style={styles.itemDetalhe}>Recebe {item.percentual ?? 100}%{item.endereco ? ` · ${item.endereco}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => confirmarRemocao(item)} hitSlop={8}>
                <Text style={styles.remover}>Excluir</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
  },
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
  coresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  corBolinha: { width: 30, height: 30, borderRadius: 15 },
  corSelecionada: { borderWidth: 3, borderColor: theme.colors.text },
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
  vazioContainer: { alignItems: 'center', marginTop: 60, gap: 10 },
  vazio: { color: theme.colors.textSecondary, fontSize: 14, fontFamily: theme.font.medium },
  itemClinica: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    gap: 12,
  },
  itemClinicaAtivo: { backgroundColor: theme.colors.primaryLight },
  corBolinhaItem: { width: 12, height: 12, borderRadius: 6 },
  itemNome: { fontSize: 15, fontFamily: theme.font.regular, color: theme.colors.text },
  itemDetalhe: { fontSize: 12, fontFamily: theme.font.regular, color: theme.colors.textSecondary, marginTop: 2 },
  remover: { color: theme.colors.danger, fontFamily: theme.font.medium, fontSize: 13 },
});
