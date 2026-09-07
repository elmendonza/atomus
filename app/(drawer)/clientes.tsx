import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DrawerMenuButton } from '@/components/drawer-menu-button';
import { supabase } from '@/src/lib/supabase';
import { theme, COR_PARTICULAR } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';

type Paciente = {
  id: string;
  nome: string;
  tutor: string | null;
  forma_pagamento_preferida: string | null;
  dias_preferidos: string | null;
  horario_preferido: string | null;
  clinica_id: string | null;
  created_at: string;
};

type Clinica = { id: string; nome: string; cor: string };

const ORDENACAO_OPCOES = [
  { chave: 'az', rotulo: 'A a Z' },
  { chave: 'za', rotulo: 'Z a A' },
  { chave: 'antigos', rotulo: 'Mais antigos' },
  { chave: 'recentes', rotulo: 'Mais recentes' },
  { chave: 'pendentes', rotulo: 'Pendentes' },
  { chave: 'concluidos', rotulo: 'Concluídos' },
] as const;

type Ordenacao = (typeof ORDENACAO_OPCOES)[number]['chave'];

function cadastroCompleto(p: Paciente) {
  return !!(p.forma_pagamento_preferida || p.dias_preferidos || p.horario_preferido);
}

export default function ClientesScreen() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [busca, setBusca] = useState('');
  const [clinicaFiltro, setClinicaFiltro] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('az');

  const carregar = useCallback(async () => {
    const [{ data, error }, { data: cli }] = await Promise.all([
      supabase
        .from('pacientes')
        .select('id, nome, tutor, forma_pagamento_preferida, dias_preferidos, horario_preferido, clinica_id, created_at')
        .order('nome'),
      supabase.from('clinicas').select('id, nome, cor').order('nome'),
    ]);
    if (error) {
      alertar('Erro ao carregar clientes', error.message);
      return;
    }
    setPacientes(data ?? []);
    setClinicas(cli ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const filtrados = pacientes
    .filter((p) => {
      const termo = busca.trim().toLowerCase();
      const bateBusca = !termo || p.nome.toLowerCase().includes(termo) || (p.tutor || '').toLowerCase().includes(termo);
      if (!bateBusca) return false;
      if (clinicaFiltro === null) return true;
      if (clinicaFiltro === 'particular') return !p.clinica_id;
      return p.clinica_id === clinicaFiltro;
    })
    .sort((a, b) => {
      switch (ordenacao) {
        case 'az':
          return a.nome.localeCompare(b.nome, 'pt-BR');
        case 'za':
          return b.nome.localeCompare(a.nome, 'pt-BR');
        case 'antigos':
          return a.created_at.localeCompare(b.created_at);
        case 'recentes':
          return b.created_at.localeCompare(a.created_at);
        case 'pendentes':
          return Number(cadastroCompleto(a)) - Number(cadastroCompleto(b));
        case 'concluidos':
          return Number(cadastroCompleto(b)) - Number(cadastroCompleto(a));
        default:
          return 0;
      }
    });

  const pendentes = filtrados.filter((p) => !cadastroCompleto(p)).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <DrawerMenuButton />
        <Text style={styles.headerTitulo}>Clientes</Text>
      </View>

      <View style={styles.buscaContainer}>
        <Ionicons name="search" size={18} color={theme.colors.textTertiary} />
        <TextInput
          style={styles.buscaInput}
          placeholder="Buscar por pet ou tutor"
          placeholderTextColor={theme.colors.textTertiary}
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      <View style={styles.filtrosContainer}>
        <Text style={styles.filtroLabel}>Clínica</Text>
        <View style={styles.chipsContainer}>
          <TouchableOpacity
            style={[styles.filtroChip, clinicaFiltro === null && styles.filtroChipAtivo]}
            onPress={() => setClinicaFiltro(null)}
          >
            <Text style={[styles.filtroChipTexto, clinicaFiltro === null && styles.filtroChipTextoAtivo]}>Todas</Text>
          </TouchableOpacity>
          {clinicas.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.filtroChip, { borderColor: c.cor }, clinicaFiltro === c.id && { backgroundColor: c.cor, borderColor: c.cor }]}
              onPress={() => setClinicaFiltro(c.id)}
            >
              <Text style={[styles.filtroChipTexto, clinicaFiltro === c.id && styles.filtroChipTextoAtivo]}>{c.nome}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              styles.filtroChip,
              { borderColor: COR_PARTICULAR },
              clinicaFiltro === 'particular' && { backgroundColor: COR_PARTICULAR, borderColor: COR_PARTICULAR },
            ]}
            onPress={() => setClinicaFiltro('particular')}
          >
            <Text style={[styles.filtroChipTexto, clinicaFiltro === 'particular' && styles.filtroChipTextoAtivo]}>Particular</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.filtroLabel, { marginTop: 10 }]}>Ordenar por</Text>
        <View style={styles.chipsContainer}>
          {ORDENACAO_OPCOES.map((o) => (
            <TouchableOpacity
              key={o.chave}
              style={[styles.filtroChip, ordenacao === o.chave && styles.filtroChipAtivo]}
              onPress={() => setOrdenacao(o.chave)}
            >
              <Text style={[styles.filtroChipTexto, ordenacao === o.chave && styles.filtroChipTextoAtivo]}>{o.rotulo}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {pendentes > 0 && (
        <Text style={styles.avisoPendentes}>
          {pendentes} {pendentes === 1 ? 'cliente aguardando' : 'clientes aguardando'} cadastro completo
        </Text>
      )}

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: theme.spacing.sm }}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Ionicons name="people-outline" size={36} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Nenhum cliente encontrado</Text>
            <Text style={styles.vazioDica}>Clientes aparecem aqui automaticamente ao agendar um atendimento</Text>
          </View>
        }
        renderItem={({ item }) => {
          const completo = cadastroCompleto(item);
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(`/cliente?id=${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Text style={styles.detalhe}>Tutor: {item.tutor || 'Não informado'}</Text>
                {completo && (
                  <Text style={styles.detalhe}>
                    {item.forma_pagamento_preferida || 'Pagamento não informado'}
                    {item.dias_preferidos ? ` · ${item.dias_preferidos}` : ''}
                    {item.horario_preferido ? ` · ${item.horario_preferido}` : ''}
                  </Text>
                )}
              </View>
              <View style={[styles.badge, completo ? styles.badgeCompleto : styles.badgePendente]}>
                <Text style={[styles.badgeTexto, completo ? styles.badgeTextoCompleto : styles.badgeTextoPendente]}>
                  {completo ? 'Completo' : 'Pendente'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/cliente')} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
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
  buscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  buscaInput: { flex: 1, fontSize: 14, fontFamily: theme.font.regular, color: theme.colors.text },
  filtrosContainer: { marginHorizontal: theme.spacing.md, marginTop: 12 },
  filtroLabel: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.medium, marginBottom: 6 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filtroChip: {
    borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.full,
    paddingVertical: 6, paddingHorizontal: 12, backgroundColor: theme.colors.surface,
  },
  filtroChipAtivo: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  filtroChipTexto: { color: theme.colors.textSecondary, fontFamily: theme.font.medium, fontSize: 12 },
  filtroChipTextoAtivo: { color: theme.colors.primary },
  avisoPendentes: {
    color: theme.colors.warning,
    fontSize: 12,
    fontFamily: theme.font.medium,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  vazioContainer: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 40 },
  vazio: { color: theme.colors.textSecondary, fontSize: 14, fontFamily: theme.font.medium },
  vazioDica: { color: theme.colors.textTertiary, fontSize: 12, fontFamily: theme.font.regular, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
    gap: 10,
  },
  nome: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  detalhe: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.regular, marginTop: 2 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: theme.radius.full },
  badgeCompleto: { backgroundColor: theme.colors.successLight },
  badgePendente: { backgroundColor: theme.colors.warningLight },
  badgeTexto: { fontSize: 11, fontFamily: theme.font.medium },
  badgeTextoCompleto: { color: theme.colors.success },
  badgeTextoPendente: { color: theme.colors.warning },
  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
