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
] as const;

type Ordenacao = (typeof ORDENACAO_OPCOES)[number]['chave'];

const FILTRO_STATUS_OPCOES = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'pendentes', rotulo: 'Pendentes' },
  { chave: 'concluidos', rotulo: 'Concluídos' },
] as const;

type FiltroStatus = (typeof FILTRO_STATUS_OPCOES)[number]['chave'];

type Categoria = 'clinica' | 'ordenar' | 'filtro';

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
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [categoriaAberta, setCategoriaAberta] = useState<Categoria | null>(null);

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

  function alternarCategoria(categoria: Categoria) {
    setCategoriaAberta((atual) => (atual === categoria ? null : categoria));
  }

  const rotuloClinica =
    clinicaFiltro === null
      ? 'Todas'
      : clinicaFiltro === 'particular'
        ? 'Particular'
        : clinicas.find((c) => c.id === clinicaFiltro)?.nome ?? 'Todas';
  const rotuloOrdenacao = ORDENACAO_OPCOES.find((o) => o.chave === ordenacao)?.rotulo ?? 'A a Z';
  const rotuloFiltro = FILTRO_STATUS_OPCOES.find((f) => f.chave === filtroStatus)?.rotulo ?? 'Todos';

  const filtrados = pacientes
    .filter((p) => {
      const termo = busca.trim().toLowerCase();
      const bateBusca = !termo || p.nome.toLowerCase().includes(termo) || (p.tutor || '').toLowerCase().includes(termo);
      if (!bateBusca) return false;
      if (clinicaFiltro === 'particular' ? !!p.clinica_id : clinicaFiltro !== null && p.clinica_id !== clinicaFiltro) {
        return false;
      }
      const completo = cadastroCompleto(p);
      if (filtroStatus === 'pendentes' && completo) return false;
      if (filtroStatus === 'concluidos' && !completo) return false;
      return true;
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

      <View style={styles.categoriasContainer}>
        <TouchableOpacity
          style={[styles.categoriaBotao, categoriaAberta === 'clinica' && styles.categoriaBotaoAtivo]}
          onPress={() => alternarCategoria('clinica')}
        >
          <Text style={styles.categoriaLabel}>Clínica: {rotuloClinica}</Text>
          <Ionicons name={categoriaAberta === 'clinica' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.categoriaBotao, categoriaAberta === 'ordenar' && styles.categoriaBotaoAtivo]}
          onPress={() => alternarCategoria('ordenar')}
        >
          <Text style={styles.categoriaLabel}>Ordenar: {rotuloOrdenacao}</Text>
          <Ionicons name={categoriaAberta === 'ordenar' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.categoriaBotao, categoriaAberta === 'filtro' && styles.categoriaBotaoAtivo]}
          onPress={() => alternarCategoria('filtro')}
        >
          <Text style={styles.categoriaLabel}>Filtro: {rotuloFiltro}</Text>
          <Ionicons name={categoriaAberta === 'filtro' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {categoriaAberta === 'clinica' && (
        <View style={styles.opcoesBox}>
          <View style={styles.chipsContainer}>
            <TouchableOpacity
              style={[styles.opcaoChip, clinicaFiltro === null && styles.opcaoChipAtivo]}
              onPress={() => {
                setClinicaFiltro(null);
                setCategoriaAberta(null);
              }}
            >
              <Text style={[styles.opcaoChipTexto, clinicaFiltro === null && styles.opcaoChipTextoAtivo]}>Todas</Text>
            </TouchableOpacity>
            {clinicas.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.opcaoChip, { borderColor: c.cor }, clinicaFiltro === c.id && { backgroundColor: c.cor, borderColor: c.cor }]}
                onPress={() => {
                  setClinicaFiltro(c.id);
                  setCategoriaAberta(null);
                }}
              >
                <Text style={[styles.opcaoChipTexto, clinicaFiltro === c.id && styles.opcaoChipTextoAtivo]}>{c.nome}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.opcaoChip,
                { borderColor: COR_PARTICULAR },
                clinicaFiltro === 'particular' && { backgroundColor: COR_PARTICULAR, borderColor: COR_PARTICULAR },
              ]}
              onPress={() => {
                setClinicaFiltro('particular');
                setCategoriaAberta(null);
              }}
            >
              <Text style={[styles.opcaoChipTexto, clinicaFiltro === 'particular' && styles.opcaoChipTextoAtivo]}>Particular</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {categoriaAberta === 'ordenar' && (
        <View style={styles.opcoesBox}>
          <View style={styles.chipsContainer}>
            {ORDENACAO_OPCOES.map((o) => (
              <TouchableOpacity
                key={o.chave}
                style={[styles.opcaoChip, ordenacao === o.chave && styles.opcaoChipAtivo]}
                onPress={() => {
                  setOrdenacao(o.chave);
                  setCategoriaAberta(null);
                }}
              >
                <Text style={[styles.opcaoChipTexto, ordenacao === o.chave && styles.opcaoChipTextoAtivo]}>{o.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {categoriaAberta === 'filtro' && (
        <View style={styles.opcoesBox}>
          <View style={styles.chipsContainer}>
            {FILTRO_STATUS_OPCOES.map((f) => (
              <TouchableOpacity
                key={f.chave}
                style={[styles.opcaoChip, filtroStatus === f.chave && styles.opcaoChipAtivo]}
                onPress={() => {
                  setFiltroStatus(f.chave);
                  setCategoriaAberta(null);
                }}
              >
                <Text style={[styles.opcaoChipTexto, filtroStatus === f.chave && styles.opcaoChipTextoAtivo]}>{f.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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
  categoriasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: theme.spacing.md,
    marginTop: 12,
  },
  categoriaBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surface,
  },
  categoriaBotaoAtivo: { borderColor: theme.colors.primary },
  categoriaLabel: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 13 },
  opcoesBox: {
    marginHorizontal: theme.spacing.md,
    marginTop: 8,
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcaoChip: {
    borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.full,
    paddingVertical: 6, paddingHorizontal: 12, backgroundColor: theme.colors.surface,
  },
  opcaoChipAtivo: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  opcaoChipTexto: { color: theme.colors.textSecondary, fontFamily: theme.font.medium, fontSize: 12 },
  opcaoChipTextoAtivo: { color: theme.colors.primary },
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
