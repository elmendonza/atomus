import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DrawerMenuButton } from '@/components/drawer-menu-button';
import { supabase } from '@/src/lib/supabase';
import { theme, COR_PARTICULAR } from '@/src/theme';
import { hoje, dateParaIso } from '@/src/utils/tempo';
import { formatarMoeda } from '@/src/utils/formato';
import { alertar } from '@/src/utils/alerta';

type Atendimento = {
  id: string;
  data: string;
  hora: string;
  procedimento: string;
  valor: number;
  forma_pagamento: string;
  pago: boolean;
  data_pagamento: string | null;
  paciente_nome: string;
  clinica_id: string | null;
  clinica_nome: string | null;
  clinica_cor: string | null;
};

type Clinica = { id: string; nome: string; cor: string };

type Despesa = {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  forma_pagamento: string | null;
  data_compra: string;
};

const ID_PARTICULAR = 'particular';

const CATEGORIAS_DESPESA: Record<string, string> = {
  insumo: 'Insumos',
  investimento: 'Investimento em materiais',
  curso: 'Cursos e especializações',
  operacional: 'Custo operacional',
  outro: 'Outro',
};

const DESPESAS_EXEMPLO = [
  { nome: 'Agulhas', categoria: 'insumo', quantidade: 100, valor_unitario: 0.5, valor_total: 50, forma_pagamento: 'Pix', data_compra: hoje() },
  { nome: 'Gases', categoria: 'insumo', quantidade: 20, valor_unitario: 3.5, valor_total: 70, forma_pagamento: 'Cartão', data_compra: hoje() },
  { nome: 'Mocha', categoria: 'insumo', quantidade: 10, valor_unitario: 12, valor_total: 120, forma_pagamento: 'Dinheiro', data_compra: hoje() },
];

function formatarDataCurta(dataStr: string) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function inicioDaSemana() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return dateParaIso(d);
}

function inicioDoMes() {
  const d = new Date();
  return dateParaIso(new Date(d.getFullYear(), d.getMonth(), 1));
}

function fimDoMes() {
  const d = new Date();
  return dateParaIso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

type Periodo = 'todos' | 'hoje' | 'semana' | 'mes' | 'personalizado';

export default function FinanceiroScreen() {
  const router = useRouter();
  const [aba, setAba] = useState<'entradas' | 'saidas'>('entradas');

  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [filtroClinica, setFiltroClinica] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pagos' | 'pendentes'>('todos');
  const [periodo, setPeriodo] = useState<Periodo>('todos');
  const [dataInicio, setDataInicio] = useState(hoje());
  const [dataFim, setDataFim] = useState(hoje());

  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [despesasCarregadas, setDespesasCarregadas] = useState(false);

  const carregarEntradas = useCallback(async () => {
    const { data: cli } = await supabase.from('clinicas').select('id, nome, cor').order('nome');
    setClinicas(cli ?? []);

    const { data: rows, error } = await supabase
      .from('atendimentos')
      .select(
        `id, data, hora, procedimento, valor, forma_pagamento, pago, data_pagamento, clinica_id,
         pacientes(nome), clinicas(nome, cor)`
      )
      .order('data', { ascending: false })
      .order('hora', { ascending: false });
    if (error) {
      alertar('Erro ao carregar financeiro', error.message);
      return;
    }
    setAtendimentos(
      (rows ?? []).map((r: any) => ({
        ...r,
        paciente_nome: r.pacientes?.nome ?? '',
        clinica_nome: r.clinicas?.nome ?? null,
        clinica_cor: r.clinicas?.cor ?? null,
      }))
    );
  }, []);

  const carregarSaidas = useCallback(async () => {
    const { data, error } = await supabase
      .from('despesas')
      .select('id, nome, categoria, quantidade, valor_unitario, valor_total, forma_pagamento, data_compra')
      .order('data_compra', { ascending: false });
    if (error) {
      alertar('Erro ao carregar despesas', error.message);
      return;
    }

    if ((data ?? []).length === 0 && !despesasCarregadas) {
      const { data: novaLista, error: erroSeed } = await supabase
        .from('despesas')
        .insert(DESPESAS_EXEMPLO)
        .select('id, nome, categoria, quantidade, valor_unitario, valor_total, forma_pagamento, data_compra');
      if (!erroSeed) {
        setDespesas((novaLista ?? []).sort((a, b) => (a.data_compra < b.data_compra ? 1 : -1)));
        setDespesasCarregadas(true);
        return;
      }
    }

    setDespesas(data ?? []);
    setDespesasCarregadas(true);
  }, [despesasCarregadas]);

  useFocusEffect(
    useCallback(() => {
      carregarEntradas();
      carregarSaidas();
    }, [carregarEntradas, carregarSaidas])
  );

  async function alternarPago(item: Atendimento) {
    const novoStatus = !item.pago;
    const dataPagamento = novoStatus ? hoje() : null;
    const { error } = await supabase
      .from('atendimentos')
      .update({ pago: novoStatus, data_pagamento: dataPagamento })
      .eq('id', item.id);
    if (error) {
      alertar('Erro ao atualizar pagamento', error.message);
      return;
    }
    carregarEntradas();
  }

  const intervaloData = useMemo(() => {
    if (periodo === 'hoje') return { inicio: hoje(), fim: hoje() };
    if (periodo === 'semana') return { inicio: inicioDaSemana(), fim: hoje() };
    if (periodo === 'mes') return { inicio: inicioDoMes(), fim: fimDoMes() };
    if (periodo === 'personalizado') return { inicio: dataInicio, fim: dataFim };
    return null;
  }, [periodo, dataInicio, dataFim]);

  const filtrados = atendimentos.filter((item) => {
    if (filtroClinica !== null) {
      const combina = filtroClinica === ID_PARTICULAR ? item.clinica_id === null : item.clinica_id === filtroClinica;
      if (!combina) return false;
    }
    if (filtroStatus === 'pagos' && !item.pago) return false;
    if (filtroStatus === 'pendentes' && item.pago) return false;
    if (intervaloData && (item.data < intervaloData.inicio || item.data > intervaloData.fim)) return false;
    return true;
  });

  const totalGeral = filtrados.reduce((soma, item) => soma + (item.valor || 0), 0);
  const totalPago = filtrados.filter((i) => i.pago).reduce((soma, item) => soma + (item.valor || 0), 0);
  const totalPendente = totalGeral - totalPago;

  const inicioMes = inicioDoMes();
  const fimMes = fimDoMes();
  const totalMesDespesas = despesas
    .filter((d) => d.data_compra >= inicioMes && d.data_compra <= fimMes)
    .reduce((soma, d) => soma + (d.valor_total || 0), 0);
  const totalHojeDespesas = despesas
    .filter((d) => d.data_compra === hoje())
    .reduce((soma, d) => soma + (d.valor_total || 0), 0);

  const principaisGastos = useMemo(() => {
    const porCategoria: Record<string, number> = {};
    despesas.forEach((d) => {
      porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + (d.valor_total || 0);
    });
    return Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [despesas]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <DrawerMenuButton />
        <Text style={styles.headerTitulo}>Financeiro</Text>
      </View>

      <View style={styles.segmentoContainer}>
        <TouchableOpacity
          style={[styles.segmentoBotao, aba === 'entradas' && styles.segmentoBotaoAtivo]}
          onPress={() => setAba('entradas')}
        >
          <Ionicons name="arrow-down-circle" size={16} color={aba === 'entradas' ? theme.colors.success : theme.colors.textSecondary} />
          <Text style={[styles.segmentoTexto, aba === 'entradas' && { color: theme.colors.success }]}>Entradas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentoBotao, aba === 'saidas' && styles.segmentoBotaoAtivo]}
          onPress={() => setAba('saidas')}
        >
          <Ionicons name="arrow-up-circle" size={16} color={aba === 'saidas' ? theme.colors.danger : theme.colors.textSecondary} />
          <Text style={[styles.segmentoTexto, aba === 'saidas' && { color: theme.colors.danger }]}>Saídas</Text>
        </TouchableOpacity>
      </View>

      {aba === 'entradas' ? (
        <>
          <View style={styles.resumoContainer}>
            <View style={styles.resumoCard}>
              <Text style={styles.resumoLabel}>Total</Text>
              <Text style={styles.resumoValor}>{formatarMoeda(totalGeral)}</Text>
            </View>
            <View style={styles.resumoCard}>
              <Text style={[styles.resumoLabel, { color: theme.colors.success }]}>Recebido</Text>
              <Text style={[styles.resumoValor, { color: theme.colors.success }]}>{formatarMoeda(totalPago)}</Text>
            </View>
            <View style={styles.resumoCard}>
              <Text style={[styles.resumoLabel, { color: theme.colors.warning }]}>Pendente</Text>
              <Text style={[styles.resumoValor, { color: theme.colors.warning }]}>{formatarMoeda(totalPendente)}</Text>
            </View>
          </View>

          <View style={styles.filtrosStatusContainer}>
            {(['todos', 'hoje', 'semana', 'mes', 'personalizado'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.filtroChip, periodo === p && styles.filtroChipAtivo]}
                onPress={() => setPeriodo(p)}
              >
                <Text style={[styles.filtroChipTexto, periodo === p && styles.filtroChipTextoAtivo]}>
                  {p === 'todos' ? 'Todo período' : p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mês' : 'Personalizado'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {periodo === 'personalizado' && (
            <View style={styles.periodoPersonalizadoContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.periodoLabel}>De</Text>
                <TextInput
                  style={styles.periodoInput}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={dataInicio}
                  onChangeText={setDataInicio}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.periodoLabel}>Até</Text>
                <TextInput
                  style={styles.periodoInput}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={dataFim}
                  onChangeText={setDataFim}
                />
              </View>
            </View>
          )}

          <View style={styles.filtrosStatusContainer}>
            {(['todos', 'pagos', 'pendentes'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filtroChip, filtroStatus === f && styles.filtroChipAtivo]}
                onPress={() => setFiltroStatus(f)}
              >
                <Text style={[styles.filtroChipTexto, filtroStatus === f && styles.filtroChipTextoAtivo]}>
                  {f === 'todos' ? 'Todos' : f === 'pagos' ? 'Pagos' : 'Pendentes'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[...clinicas, { id: ID_PARTICULAR, nome: 'Particular', cor: COR_PARTICULAR }]}
            keyExtractor={(item) => String(item.id)}
            style={styles.filtrosClinicaLista}
            contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.clinicaChip,
                  { borderColor: item.cor },
                  filtroClinica === item.id && { backgroundColor: item.cor },
                ]}
                onPress={() => setFiltroClinica(filtroClinica === item.id ? null : item.id)}
              >
                <View style={[styles.clinicaChipPonto, { backgroundColor: item.cor }]} />
                <Text
                  style={[
                    styles.clinicaChipTexto,
                    filtroClinica === item.id && styles.clinicaChipTextoAtivo,
                  ]}
                >
                  {item.nome}
                </Text>
              </TouchableOpacity>
            )}
          />

          <FlatList
            data={filtrados}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
            ListEmptyComponent={
              <View style={styles.vazioContainer}>
                <Ionicons name="cash-outline" size={40} color={theme.colors.textTertiary} />
                <Text style={styles.vazio}>Nenhum atendimento encontrado</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/modal?id=${item.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.faixaColorida, { backgroundColor: item.clinica_cor || COR_PARTICULAR }]} />
                <View style={styles.cardConteudo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paciente}>{item.paciente_nome}</Text>
                    <Text style={styles.detalhe}>
                      {item.clinica_nome || 'Particular'} · {formatarDataCurta(item.data)} · {item.forma_pagamento || 'Não informado'}
                    </Text>
                    {item.pago && item.data_pagamento && (
                      <Text style={styles.detalhePago}>Pago em {formatarDataCurta(item.data_pagamento)}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.valor}>{formatarMoeda(item.valor || 0)}</Text>
                    <TouchableOpacity
                      style={[styles.badge, item.pago ? styles.badgePago : styles.badgePendente]}
                      onPress={() => alternarPago(item)}
                      hitSlop={8}
                    >
                      <Text style={[styles.badgeTexto, item.pago ? styles.badgeTextoPago : styles.badgeTextoPendente]}>
                        {item.pago ? 'Pago' : 'Pendente'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </>
      ) : (
        <>
          <View style={styles.resumoContainer}>
            <View style={styles.resumoCard}>
              <Text style={[styles.resumoLabel, { color: theme.colors.danger }]}>Gasto no mês</Text>
              <Text style={[styles.resumoValor, { color: theme.colors.danger }]}>{formatarMoeda(totalMesDespesas)}</Text>
            </View>
            <View style={styles.resumoCard}>
              <Text style={styles.resumoLabel}>Gasto hoje</Text>
              <Text style={styles.resumoValor}>{formatarMoeda(totalHojeDespesas)}</Text>
            </View>
          </View>

          {principaisGastos.length > 0 && (
            <View style={styles.principaisContainer}>
              <Text style={styles.principaisTitulo}>Principais gastos</Text>
              {principaisGastos.map(([categoria, valor]) => (
                <View key={categoria} style={styles.principaisLinha}>
                  <Text style={styles.principaisCategoria}>{CATEGORIAS_DESPESA[categoria] || categoria}</Text>
                  <Text style={styles.principaisValor}>{formatarMoeda(valor)}</Text>
                </View>
              ))}
            </View>
          )}

          <FlatList
            data={despesas}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }}
            ListEmptyComponent={
              <View style={styles.vazioContainer}>
                <Ionicons name="trending-down" size={40} color={theme.colors.textTertiary} />
                <Text style={styles.vazio}>Nenhuma despesa registrada</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/despesa?id=${item.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.faixaColorida, { backgroundColor: theme.colors.danger }]} />
                <View style={styles.cardConteudo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paciente}>{item.nome}</Text>
                    <Text style={styles.detalhe}>
                      {CATEGORIAS_DESPESA[item.categoria] || item.categoria} · {formatarDataCurta(item.data_compra)} · {item.forma_pagamento || 'Não informado'}
                    </Text>
                    <Text style={styles.detalhe}>
                      {item.quantidade} × {formatarMoeda(item.valor_unitario)}
                    </Text>
                  </View>
                  <Text style={[styles.valor, { color: theme.colors.danger }]}>{formatarMoeda(item.valor_total)}</Text>
                </View>
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity style={styles.fab} onPress={() => router.push('/despesa')} activeOpacity={0.85}>
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>
        </>
      )}
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
  segmentoContainer: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.md,
    padding: 4,
    gap: 4,
  },
  segmentoBotao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: theme.radius.sm,
  },
  segmentoBotaoAtivo: { backgroundColor: theme.colors.surface },
  segmentoTexto: { color: theme.colors.textSecondary, fontSize: 14, fontFamily: theme.font.medium },
  resumoContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  resumoCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  resumoLabel: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.regular, marginBottom: 4 },
  resumoValor: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  principaisContainer: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
  },
  principaisTitulo: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.medium, marginBottom: 8 },
  principaisLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  principaisCategoria: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.regular },
  principaisValor: { color: theme.colors.text, fontSize: 13, fontFamily: theme.font.medium },
  filtrosStatusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  filtroChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filtroChipAtivo: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  filtroChipTexto: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.medium },
  filtroChipTextoAtivo: { color: theme.colors.primary },
  periodoPersonalizadoContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: 10,
    marginBottom: theme.spacing.sm,
  },
  periodoLabel: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.regular, marginBottom: 4 },
  periodoInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: theme.font.regular,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  filtrosClinicaLista: { marginBottom: theme.spacing.sm, flexGrow: 0 },
  clinicaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  clinicaChipPonto: { width: 8, height: 8, borderRadius: 4 },
  clinicaChipTexto: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.medium },
  clinicaChipTextoAtivo: { color: '#fff' },
  vazioContainer: { alignItems: 'center', marginTop: 60, gap: 10 },
  vazio: { color: theme.colors.textSecondary, fontSize: 14, fontFamily: theme.font.medium },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    overflow: 'hidden',
  },
  faixaColorida: { width: 4 },
  cardConteudo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  paciente: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  detalhe: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.regular, marginTop: 2 },
  detalhePago: { color: theme.colors.success, fontSize: 12, fontFamily: theme.font.regular, marginTop: 2 },
  valor: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  badge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: theme.radius.full },
  badgePago: { backgroundColor: theme.colors.successLight },
  badgePendente: { backgroundColor: theme.colors.warningLight },
  badgeTexto: { fontSize: 11, fontFamily: theme.font.medium },
  badgeTextoPago: { color: theme.colors.success },
  badgeTextoPendente: { color: theme.colors.warning },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
});
