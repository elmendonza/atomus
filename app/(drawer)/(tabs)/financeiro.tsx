import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DrawerMenuButton } from '@/components/drawer-menu-button';
import { CampoDataHora } from '@/components/campo-data-hora';
import { supabase } from '@/src/lib/supabase';
import { theme, COR_PARTICULAR } from '@/src/theme';
import { hoje, dateParaIso, isoParaDate, formatarDataBR } from '@/src/utils/tempo';
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

const PERIODO_OPCOES = [
  { chave: 'todos', rotulo: 'Todo período' },
  { chave: 'hoje', rotulo: 'Hoje' },
  { chave: 'semana', rotulo: 'Esta semana' },
  { chave: 'mes', rotulo: 'Este mês' },
  { chave: 'personalizado', rotulo: 'Personalizado' },
] as const;

const STATUS_PAGAMENTO_OPCOES = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'pagos', rotulo: 'Pagos' },
  { chave: 'pendentes', rotulo: 'Pendentes' },
] as const;

const FORMAS_PAGAMENTO_DESPESA = ['Pix', 'Cartão', 'Dinheiro', 'Boleto'];

type CategoriaFiltro = 'periodo' | 'status' | 'clinica' | 'categoriaDespesa' | 'pagamentoDespesa';

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
  const [categoriaAberta, setCategoriaAberta] = useState<CategoriaFiltro | null>(null);

  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [despesasCarregadas, setDespesasCarregadas] = useState(false);
  const [periodoSaidas, setPeriodoSaidas] = useState<Periodo>('todos');
  const [dataInicioSaidas, setDataInicioSaidas] = useState(hoje());
  const [dataFimSaidas, setDataFimSaidas] = useState(hoje());
  const [filtroCategoriaDespesa, setFiltroCategoriaDespesa] = useState<string | null>(null);
  const [filtroFormaPagamentoDespesa, setFiltroFormaPagamentoDespesa] = useState<string | null>(null);

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

  const totalHojeDespesas = despesas
    .filter((d) => d.data_compra === hoje())
    .reduce((soma, d) => soma + (d.valor_total || 0), 0);

  const intervaloDataSaidas = useMemo(() => {
    if (periodoSaidas === 'hoje') return { inicio: hoje(), fim: hoje() };
    if (periodoSaidas === 'semana') return { inicio: inicioDaSemana(), fim: hoje() };
    if (periodoSaidas === 'mes') return { inicio: inicioDoMes(), fim: fimDoMes() };
    if (periodoSaidas === 'personalizado') return { inicio: dataInicioSaidas, fim: dataFimSaidas };
    return null;
  }, [periodoSaidas, dataInicioSaidas, dataFimSaidas]);

  const despesasFiltradas = despesas.filter((d) => {
    if (filtroCategoriaDespesa !== null && d.categoria !== filtroCategoriaDespesa) return false;
    if (filtroFormaPagamentoDespesa !== null && d.forma_pagamento !== filtroFormaPagamentoDespesa) return false;
    if (intervaloDataSaidas && (d.data_compra < intervaloDataSaidas.inicio || d.data_compra > intervaloDataSaidas.fim)) return false;
    return true;
  });

  const totalFiltradoDespesas = despesasFiltradas.reduce((soma, d) => soma + (d.valor_total || 0), 0);

  const principaisGastos = useMemo(() => {
    const porCategoria: Record<string, number> = {};
    despesasFiltradas.forEach((d) => {
      porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + (d.valor_total || 0);
    });
    return Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [despesasFiltradas]);

  function alternarCategoria(categoria: CategoriaFiltro) {
    setCategoriaAberta((atual) => (atual === categoria ? null : categoria));
  }

  const listaClinicasComParticular = [...clinicas, { id: ID_PARTICULAR, nome: 'Particular', cor: COR_PARTICULAR }];
  const rotuloPeriodo = PERIODO_OPCOES.find((p) => p.chave === periodo)?.rotulo ?? 'Todo período';
  const rotuloStatus = STATUS_PAGAMENTO_OPCOES.find((s) => s.chave === filtroStatus)?.rotulo ?? 'Todos';
  const rotuloClinica = filtroClinica === null ? 'Todas' : listaClinicasComParticular.find((c) => c.id === filtroClinica)?.nome ?? 'Todas';
  const rotuloPeriodoSaidas = PERIODO_OPCOES.find((p) => p.chave === periodoSaidas)?.rotulo ?? 'Todo período';
  const rotuloCategoriaDespesa = filtroCategoriaDespesa === null ? 'Todas' : CATEGORIAS_DESPESA[filtroCategoriaDespesa] ?? filtroCategoriaDespesa;
  const rotuloFormaPagamentoDespesa = filtroFormaPagamentoDespesa ?? 'Todas';

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

          <View style={styles.categoriasContainer}>
            <TouchableOpacity
              style={[styles.categoriaBotao, categoriaAberta === 'periodo' && styles.categoriaBotaoAtivo]}
              onPress={() => alternarCategoria('periodo')}
            >
              <Text style={styles.categoriaLabel}>Período: {rotuloPeriodo}</Text>
              <Ionicons name={categoriaAberta === 'periodo' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoriaBotao, categoriaAberta === 'status' && styles.categoriaBotaoAtivo]}
              onPress={() => alternarCategoria('status')}
            >
              <Text style={styles.categoriaLabel}>Status pagamento: {rotuloStatus}</Text>
              <Ionicons name={categoriaAberta === 'status' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoriaBotao, categoriaAberta === 'clinica' && styles.categoriaBotaoAtivo]}
              onPress={() => alternarCategoria('clinica')}
            >
              <Text style={styles.categoriaLabel}>Clínica: {rotuloClinica}</Text>
              <Ionicons name={categoriaAberta === 'clinica' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {categoriaAberta === 'periodo' && (
            <View style={styles.opcoesBox}>
              <View style={styles.chipsContainer}>
                {PERIODO_OPCOES.map((p) => (
                  <TouchableOpacity
                    key={p.chave}
                    style={[styles.opcaoChip, periodo === p.chave && styles.opcaoChipAtivo]}
                    onPress={() => {
                      setPeriodo(p.chave);
                      setCategoriaAberta(null);
                    }}
                  >
                    <Text style={[styles.opcaoChipTexto, periodo === p.chave && styles.opcaoChipTextoAtivo]}>{p.rotulo}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {periodo === 'personalizado' && (
            <View style={styles.periodoPersonalizadoContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.periodoLabel}>De</Text>
                <CampoDataHora
                  valor={isoParaDate(dataInicio)}
                  modo="date"
                  aoAlterar={(d) => setDataInicio(dateParaIso(d))}
                  textoExibido={formatarDataBR(dataInicio)}
                  icone="calendar-outline"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.periodoLabel}>Até</Text>
                <CampoDataHora
                  valor={isoParaDate(dataFim)}
                  modo="date"
                  aoAlterar={(d) => setDataFim(dateParaIso(d))}
                  textoExibido={formatarDataBR(dataFim)}
                  icone="calendar-outline"
                />
              </View>
            </View>
          )}

          {categoriaAberta === 'status' && (
            <View style={styles.opcoesBox}>
              <View style={styles.chipsContainer}>
                {STATUS_PAGAMENTO_OPCOES.map((s) => (
                  <TouchableOpacity
                    key={s.chave}
                    style={[styles.opcaoChip, filtroStatus === s.chave && styles.opcaoChipAtivo]}
                    onPress={() => {
                      setFiltroStatus(s.chave);
                      setCategoriaAberta(null);
                    }}
                  >
                    <Text style={[styles.opcaoChipTexto, filtroStatus === s.chave && styles.opcaoChipTextoAtivo]}>{s.rotulo}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {categoriaAberta === 'clinica' && (
            <View style={styles.opcoesBox}>
              <View style={styles.chipsContainer}>
                <TouchableOpacity
                  style={[styles.opcaoChip, filtroClinica === null && styles.opcaoChipAtivo]}
                  onPress={() => {
                    setFiltroClinica(null);
                    setCategoriaAberta(null);
                  }}
                >
                  <Text style={[styles.opcaoChipTexto, filtroClinica === null && styles.opcaoChipTextoAtivo]}>Todas</Text>
                </TouchableOpacity>
                {listaClinicasComParticular.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.opcaoChip,
                      { borderColor: item.cor },
                      filtroClinica === item.id && { backgroundColor: item.cor, borderColor: item.cor },
                    ]}
                    onPress={() => {
                      setFiltroClinica(item.id);
                      setCategoriaAberta(null);
                    }}
                  >
                    <Text style={[styles.opcaoChipTexto, filtroClinica === item.id && styles.opcaoChipTextoAtivo]}>{item.nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

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
              <Text style={[styles.resumoLabel, { color: theme.colors.danger }]}>Total</Text>
              <Text style={[styles.resumoValor, { color: theme.colors.danger }]}>{formatarMoeda(totalFiltradoDespesas)}</Text>
            </View>
            <View style={styles.resumoCard}>
              <Text style={styles.resumoLabel}>Gasto hoje</Text>
              <Text style={styles.resumoValor}>{formatarMoeda(totalHojeDespesas)}</Text>
            </View>
          </View>

          <View style={styles.categoriasContainer}>
            <TouchableOpacity
              style={[styles.categoriaBotao, categoriaAberta === 'periodo' && styles.categoriaBotaoAtivo]}
              onPress={() => alternarCategoria('periodo')}
            >
              <Text style={styles.categoriaLabel}>Período: {rotuloPeriodoSaidas}</Text>
              <Ionicons name={categoriaAberta === 'periodo' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoriaBotao, categoriaAberta === 'categoriaDespesa' && styles.categoriaBotaoAtivo]}
              onPress={() => alternarCategoria('categoriaDespesa')}
            >
              <Text style={styles.categoriaLabel}>Categoria: {rotuloCategoriaDespesa}</Text>
              <Ionicons name={categoriaAberta === 'categoriaDespesa' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoriaBotao, categoriaAberta === 'pagamentoDespesa' && styles.categoriaBotaoAtivo]}
              onPress={() => alternarCategoria('pagamentoDespesa')}
            >
              <Text style={styles.categoriaLabel}>Forma de pagamento: {rotuloFormaPagamentoDespesa}</Text>
              <Ionicons name={categoriaAberta === 'pagamentoDespesa' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {categoriaAberta === 'periodo' && (
            <View style={styles.opcoesBox}>
              <View style={styles.chipsContainer}>
                {PERIODO_OPCOES.map((p) => (
                  <TouchableOpacity
                    key={p.chave}
                    style={[styles.opcaoChip, periodoSaidas === p.chave && styles.opcaoChipAtivo]}
                    onPress={() => {
                      setPeriodoSaidas(p.chave);
                      setCategoriaAberta(null);
                    }}
                  >
                    <Text style={[styles.opcaoChipTexto, periodoSaidas === p.chave && styles.opcaoChipTextoAtivo]}>{p.rotulo}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {periodoSaidas === 'personalizado' && (
            <View style={styles.periodoPersonalizadoContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.periodoLabel}>De</Text>
                <CampoDataHora
                  valor={isoParaDate(dataInicioSaidas)}
                  modo="date"
                  aoAlterar={(d) => setDataInicioSaidas(dateParaIso(d))}
                  textoExibido={formatarDataBR(dataInicioSaidas)}
                  icone="calendar-outline"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.periodoLabel}>Até</Text>
                <CampoDataHora
                  valor={isoParaDate(dataFimSaidas)}
                  modo="date"
                  aoAlterar={(d) => setDataFimSaidas(dateParaIso(d))}
                  textoExibido={formatarDataBR(dataFimSaidas)}
                  icone="calendar-outline"
                />
              </View>
            </View>
          )}

          {categoriaAberta === 'categoriaDespesa' && (
            <View style={styles.opcoesBox}>
              <View style={styles.chipsContainer}>
                <TouchableOpacity
                  style={[styles.opcaoChip, filtroCategoriaDespesa === null && styles.opcaoChipAtivo]}
                  onPress={() => {
                    setFiltroCategoriaDespesa(null);
                    setCategoriaAberta(null);
                  }}
                >
                  <Text style={[styles.opcaoChipTexto, filtroCategoriaDespesa === null && styles.opcaoChipTextoAtivo]}>Todas</Text>
                </TouchableOpacity>
                {Object.entries(CATEGORIAS_DESPESA).map(([valor, label]) => (
                  <TouchableOpacity
                    key={valor}
                    style={[styles.opcaoChip, filtroCategoriaDespesa === valor && styles.opcaoChipAtivo]}
                    onPress={() => {
                      setFiltroCategoriaDespesa(valor);
                      setCategoriaAberta(null);
                    }}
                  >
                    <Text style={[styles.opcaoChipTexto, filtroCategoriaDespesa === valor && styles.opcaoChipTextoAtivo]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {categoriaAberta === 'pagamentoDespesa' && (
            <View style={styles.opcoesBox}>
              <View style={styles.chipsContainer}>
                <TouchableOpacity
                  style={[styles.opcaoChip, filtroFormaPagamentoDespesa === null && styles.opcaoChipAtivo]}
                  onPress={() => {
                    setFiltroFormaPagamentoDespesa(null);
                    setCategoriaAberta(null);
                  }}
                >
                  <Text style={[styles.opcaoChipTexto, filtroFormaPagamentoDespesa === null && styles.opcaoChipTextoAtivo]}>Todas</Text>
                </TouchableOpacity>
                {FORMAS_PAGAMENTO_DESPESA.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.opcaoChip, filtroFormaPagamentoDespesa === f && styles.opcaoChipAtivo]}
                    onPress={() => {
                      setFiltroFormaPagamentoDespesa(f);
                      setCategoriaAberta(null);
                    }}
                  >
                    <Text style={[styles.opcaoChipTexto, filtroFormaPagamentoDespesa === f && styles.opcaoChipTextoAtivo]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

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
            data={despesasFiltradas}
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
  categoriasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
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
    marginBottom: theme.spacing.sm,
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcaoChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  opcaoChipAtivo: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  opcaoChipTexto: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.medium },
  opcaoChipTextoAtivo: { color: theme.colors.primary },
  periodoPersonalizadoContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: 10,
    marginBottom: theme.spacing.sm,
  },
  periodoLabel: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.regular, marginBottom: 4 },
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
