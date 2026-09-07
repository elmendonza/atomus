import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DrawerMenuButton } from '@/components/drawer-menu-button';
import { supabase } from '@/src/lib/supabase';
import { theme, COR_PARTICULAR } from '@/src/theme';
import { dateParaIso, hoje, isoParaDate, formatarDataBR } from '@/src/utils/tempo';
import { formatarMoeda } from '@/src/utils/formato';

const DIAS_LIMITE_RESGATE = 30;
const TAXA_MAQUININHA_PARTICULAR = 2; // % descontado pela maquininha em cartão de crédito de clientes particulares

type Clinica = { id: string; nome: string; cor: string; percentual: number };

type Atendimento = {
  id: string;
  data: string;
  valor: number;
  pago: boolean;
  procedimento: string;
  forma_pagamento: string | null;
  clinica_id: string | null;
  paciente_id: string;
  paciente_nome: string;
  tutor: string;
  telefone: string;
};

type Despesa = {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  valor_total: number;
  data_compra: string;
};

type ProdutoEstoque = { id: string; nome: string; quantidade: number; unidade: string; estoque_minimo: number };

const ID_PARTICULAR = 'particular';
const CLINICA_PARTICULAR: Clinica = { id: ID_PARTICULAR, nome: 'Particular', cor: COR_PARTICULAR, percentual: 100 };

const CATEGORIAS_DESPESA: Record<string, string> = {
  insumo: 'Insumos',
  investimento: 'Investimento em materiais',
  curso: 'Cursos e especializações',
  operacional: 'Custo operacional',
  outro: 'Outro',
};

function mesAtual() {
  return dateParaIso(new Date()).slice(0, 7);
}

function mesAnterior(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesSeguinte(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nomeDoMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  const texto = new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function variacao(atual: number, anterior: number) {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

export default function DashboardScreen() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [estoque, setEstoque] = useState<ProdutoEstoque[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual());

  const carregar = useCallback(async () => {
    const { data: cli } = await supabase.from('clinicas').select('*').order('nome');
    setClinicas(cli ?? []);

    const { data: rows } = await supabase
      .from('atendimentos')
      .select('id, data, valor, pago, procedimento, forma_pagamento, clinica_id, paciente_id, pacientes(nome, tutor, telefone)');
    setAtendimentos(
      (rows ?? []).map((r: any) => ({
        ...r,
        paciente_nome: r.pacientes?.nome ?? '',
        tutor: r.pacientes?.tutor ?? '',
        telefone: r.pacientes?.telefone ?? '',
      }))
    );

    const { data: desp } = await supabase
      .from('despesas')
      .select('id, nome, categoria, quantidade, valor_total, data_compra');
    setDespesas(desp ?? []);

    const { data: prod } = await supabase
      .from('produtos_estoque')
      .select('id, nome, quantidade, unidade, estoque_minimo');
    setEstoque(prod ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const resumoMes = useMemo(() => {
    const mes = mesSelecionado;
    const mesPassado = mesAnterior(mes);

    const entradas = atendimentos.filter((a) => a.pago && a.data.startsWith(mes)).reduce((s, a) => s + (a.valor || 0), 0);
    const entradasAnterior = atendimentos
      .filter((a) => a.pago && a.data.startsWith(mesPassado))
      .reduce((s, a) => s + (a.valor || 0), 0);

    const saidas = despesas.filter((d) => d.data_compra.startsWith(mes)).reduce((s, d) => s + (d.valor_total || 0), 0);
    const saidasAnterior = despesas
      .filter((d) => d.data_compra.startsWith(mesPassado))
      .reduce((s, d) => s + (d.valor_total || 0), 0);

    const saldo = entradas - saidas;
    const saldoAnterior = entradasAnterior - saidasAnterior;

    return {
      entradas,
      saidas,
      saldo,
      variacaoEntradas: variacao(entradas, entradasAnterior),
      variacaoSaidas: variacao(saidas, saidasAnterior),
      variacaoSaldo: variacao(saldo, saldoAnterior),
    };
  }, [atendimentos, despesas, mesSelecionado]);

  const indicadoresMes = useMemo(() => {
    const mes = mesSelecionado;
    const doMes = atendimentos.filter((a) => a.data.startsWith(mes));
    const ticketMedio = doMes.length > 0 ? doMes.reduce((s, a) => s + (a.valor || 0), 0) / doMes.length : 0;
    const pagos = doMes.filter((a) => a.pago).length;
    const taxaPagamento = doMes.length > 0 ? (pagos / doMes.length) * 100 : 0;
    return { totalAtendimentos: doMes.length, ticketMedio, taxaPagamento };
  }, [atendimentos, mesSelecionado]);

  const despesasPorCategoria = useMemo(() => {
    const mes = mesSelecionado;
    const mapa = new Map<string, number>();
    despesas
      .filter((d) => d.data_compra.startsWith(mes))
      .forEach((d) => mapa.set(d.categoria, (mapa.get(d.categoria) || 0) + (d.valor_total || 0)));
    const totalGeral = Array.from(mapa.values()).reduce((s, v) => s + v, 0);
    return Array.from(mapa.entries())
      .map(([categoria, total]) => ({ categoria, total, proporcao: totalGeral > 0 ? total / totalGeral : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [despesas, mesSelecionado]);

  const principaisInsumos = useMemo(() => {
    const mapa = new Map<string, { nome: string; qtdComprada: number; totalGasto: number }>();
    despesas
      .filter((d) => d.categoria === 'insumo')
      .forEach((d) => {
        const chave = d.nome.trim().toLowerCase();
        const atual = mapa.get(chave) || { nome: d.nome, qtdComprada: 0, totalGasto: 0 };
        atual.qtdComprada += Number(d.quantidade) || 0;
        atual.totalGasto += Number(d.valor_total) || 0;
        mapa.set(chave, atual);
      });
    return Array.from(mapa.entries())
      .map(([chave, item]) => {
        const noEstoque = estoque.find((p) => p.nome.trim().toLowerCase() === chave);
        return {
          ...item,
          estoqueAtual: noEstoque?.quantidade ?? null,
          unidade: noEstoque?.unidade ?? 'un',
          estoqueBaixo: !!noEstoque && noEstoque.quantidade <= noEstoque.estoque_minimo,
        };
      })
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .slice(0, 5);
  }, [despesas, estoque]);

  const clientesAssiduos = useMemo(() => {
    const mapa = new Map<string, { nome: string; tutor: string; visitas: number; total: number }>();
    for (const item of atendimentos) {
      const atual = mapa.get(item.paciente_id) || { nome: item.paciente_nome, tutor: item.tutor, visitas: 0, total: 0 };
      atual.visitas += 1;
      atual.total += item.valor || 0;
      mapa.set(item.paciente_id, atual);
    }
    return Array.from(mapa.values())
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 5);
  }, [atendimentos]);

  const clientesParaResgate = useMemo(() => {
    const hojeData = isoParaDate(hoje());
    const mapaUltima = new Map<string, { nome: string; tutor: string; telefone: string; ultimaData: string }>();
    for (const item of atendimentos) {
      const atual = mapaUltima.get(item.paciente_id);
      if (!atual || item.data > atual.ultimaData) {
        mapaUltima.set(item.paciente_id, {
          nome: item.paciente_nome,
          tutor: item.tutor,
          telefone: item.telefone,
          ultimaData: item.data,
        });
      }
    }
    return Array.from(mapaUltima.values())
      .map((c) => ({
        ...c,
        diasSemVisita: Math.round((hojeData.getTime() - isoParaDate(c.ultimaData).getTime()) / 86400000),
      }))
      // diasSemVisita negativo = já tem um atendimento futuro agendado, não entra na lista
      .filter((c) => c.diasSemVisita > DIAS_LIMITE_RESGATE)
      .sort((a, b) => b.diasSemVisita - a.diasSemVisita);
  }, [atendimentos]);

  function ligarPara(telefone: string) {
    Linking.openURL(`tel:${telefone.replace(/\D/g, '')}`);
  }

  const listaComParticular = useMemo(() => {
    const temParticular = atendimentos.some((a) => a.clinica_id == null);
    return temParticular ? [...clinicas, CLINICA_PARTICULAR] : clinicas;
  }, [clinicas, atendimentos]);

  function pertenceAClinica(a: Atendimento, clinica: Clinica) {
    return clinica.id === ID_PARTICULAR ? a.clinica_id == null : a.clinica_id === clinica.id;
  }

  const financeiroPorClinica = useMemo(() => {
    const mes = mesSelecionado;
    return listaComParticular.map((clinica) => {
      const doMes = atendimentos.filter((a) => pertenceAClinica(a, clinica) && a.data.startsWith(mes));
      const faturado = doMes.reduce((soma, a) => soma + (a.valor || 0), 0);
      const pagos = doMes.filter((a) => a.pago);
      const recebido = pagos.reduce((soma, a) => soma + (a.valor || 0), 0);
      const recebidoCartaoCredito = pagos
        .filter((a) => a.forma_pagamento === 'Cartão de crédito')
        .reduce((soma, a) => soma + (a.valor || 0), 0);
      // A taxa da maquininha só incide sobre atendimentos particulares pagos em cartão de crédito.
      const taxaMaquininha = clinica.id === ID_PARTICULAR ? recebidoCartaoCredito * (TAXA_MAQUININHA_PARTICULAR / 100) : 0;
      const percentual = clinica.percentual ?? 100;
      const liquido = (recebido - taxaMaquininha) * (percentual / 100);
      const quantidadeAtendimentos = doMes.length;
      const ticketMedioLiquido = quantidadeAtendimentos > 0 ? liquido / quantidadeAtendimentos : 0;
      return { clinica, faturado, recebido, liquido, percentual, taxaMaquininha, quantidadeAtendimentos, ticketMedioLiquido };
    });
  }, [listaComParticular, atendimentos, mesSelecionado]);

  const servicosPorClinica = useMemo(() => {
    return listaComParticular.map((clinica) => {
      const doClinica = atendimentos.filter((a) => pertenceAClinica(a, clinica));
      const mapa = new Map<string, { qtd: number; total: number }>();
      for (const item of doClinica) {
        const nomeServico = item.procedimento?.trim() || 'Consulta';
        const atual = mapa.get(nomeServico) || { qtd: 0, total: 0 };
        atual.qtd += 1;
        atual.total += item.valor || 0;
        mapa.set(nomeServico, atual);
      }
      const top = Array.from(mapa.entries())
        .map(([nome, dados]) => ({ nome, ...dados }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 3);
      return { clinica, top };
    });
  }, [listaComParticular, atendimentos]);

  const nomeMesAtual = nomeDoMes(mesSelecionado);
  const podeAvancarMes = mesSelecionado < mesAtual();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <DrawerMenuButton />
        <Text style={styles.headerTitulo}>Dashboard</Text>
      </View>

      <View style={styles.seletorMesContainer}>
        <TouchableOpacity onPress={() => setMesSelecionado((m) => mesAnterior(m))} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.seletorMesTexto}>{nomeMesAtual}</Text>
        <TouchableOpacity
          onPress={() => podeAvancarMes && setMesSelecionado((m) => mesSeguinte(m))}
          disabled={!podeAvancarMes}
          hitSlop={10}
        >
          <Ionicons name="chevron-forward" size={20} color={podeAvancarMes ? theme.colors.text : theme.colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.secaoTitulo}>Resumo</Text>
        <View style={styles.resumoContainer}>
          <View style={styles.resumoCard}>
            <View style={styles.resumoCabecalho}>
              <Text style={[styles.resumoLabel, { color: theme.colors.success }]}>Entradas</Text>
              <VariacaoBadge valor={resumoMes.variacaoEntradas} />
            </View>
            <Text style={[styles.resumoValor, { color: theme.colors.success }]}>{formatarMoeda(resumoMes.entradas)}</Text>
          </View>
          <View style={styles.resumoCard}>
            <View style={styles.resumoCabecalho}>
              <Text style={[styles.resumoLabel, { color: theme.colors.danger }]}>Saídas</Text>
              <VariacaoBadge valor={resumoMes.variacaoSaidas} inverso />
            </View>
            <Text style={[styles.resumoValor, { color: theme.colors.danger }]}>{formatarMoeda(resumoMes.saidas)}</Text>
          </View>
          <View style={styles.resumoCard}>
            <View style={styles.resumoCabecalho}>
              <Text style={[styles.resumoLabel, { color: theme.colors.primary }]}>Saldo</Text>
              <VariacaoBadge valor={resumoMes.variacaoSaldo} />
            </View>
            <Text style={[styles.resumoValor, { color: theme.colors.primary }]}>{formatarMoeda(resumoMes.saldo)}</Text>
          </View>
        </View>

        <View style={styles.indicadoresContainer}>
          <View style={styles.indicadorItem}>
            <Text style={styles.indicadorValor}>{indicadoresMes.totalAtendimentos}</Text>
            <Text style={styles.indicadorLabel}>Atendimentos no mês</Text>
          </View>
          <View style={styles.indicadorItem}>
            <Text style={styles.indicadorValor}>{formatarMoeda(indicadoresMes.ticketMedio)}</Text>
            <Text style={styles.indicadorLabel}>Ticket médio</Text>
          </View>
          <View style={styles.indicadorItem}>
            <Text style={styles.indicadorValor}>{indicadoresMes.taxaPagamento.toFixed(0)}%</Text>
            <Text style={styles.indicadorLabel}>Taxa de pagamento</Text>
          </View>
        </View>

        <Text style={styles.secaoTitulo}>Financeiro por clínica</Text>
        {financeiroPorClinica.length === 0 ? (
          <View style={styles.vazioContainer}>
            <Ionicons name="business-outline" size={32} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Cadastre uma clínica para ver os números</Text>
          </View>
        ) : (
          financeiroPorClinica.map(({ clinica, faturado, recebido, liquido, percentual, taxaMaquininha }) => (
            <View key={clinica.id} style={styles.card}>
              <View style={styles.clinicaHeaderLinha}>
                <View style={[styles.pontoClinica, { backgroundColor: clinica.cor }]} />
                <Text style={styles.clinicaNomeTitulo}>{clinica.nome}</Text>
                <Text style={styles.percentualBadge}>recebe {percentual}%</Text>
              </View>
              <View style={styles.metricasLinha}>
                <View style={styles.metrica}>
                  <Text style={styles.metricaLabel}>Faturado</Text>
                  <Text style={styles.metricaValor}>{formatarMoeda(faturado)}</Text>
                </View>
                <View style={styles.metrica}>
                  <Text style={[styles.metricaLabel, { color: theme.colors.success }]}>Recebido</Text>
                  <Text style={[styles.metricaValor, { color: theme.colors.success }]}>{formatarMoeda(recebido)}</Text>
                </View>
                <View style={styles.metrica}>
                  <Text style={[styles.metricaLabel, { color: theme.colors.primary }]}>Líquido</Text>
                  <Text style={[styles.metricaValor, { color: theme.colors.primary }]}>{formatarMoeda(liquido)}</Text>
                </View>
              </View>
              {taxaMaquininha > 0 && (
                <Text style={styles.taxaMaquininhaTexto}>
                  Taxa maquininha ({TAXA_MAQUININHA_PARTICULAR}% cartão de crédito): -{formatarMoeda(taxaMaquininha)}
                </Text>
              )}
            </View>
          ))
        )}

        <Text style={styles.secaoTitulo}>Ticket médio líquido por clínica</Text>
        {financeiroPorClinica.length === 0 ? (
          <View style={styles.vazioContainer}>
            <Ionicons name="pricetag-outline" size={32} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Cadastre uma clínica para ver os números</Text>
          </View>
        ) : (
          financeiroPorClinica.map(({ clinica, quantidadeAtendimentos, ticketMedioLiquido }) => (
            <View key={clinica.id} style={styles.card}>
              <View style={styles.clinicaHeaderLinha}>
                <View style={[styles.pontoClinica, { backgroundColor: clinica.cor }]} />
                <Text style={styles.clinicaNomeTitulo}>{clinica.nome}</Text>
              </View>
              {quantidadeAtendimentos === 0 ? (
                <Text style={styles.clienteDetalhe}>Nenhum atendimento neste mês</Text>
              ) : (
                <View style={styles.metricasLinha}>
                  <View style={styles.metrica}>
                    <Text style={styles.metricaLabel}>Atendimentos</Text>
                    <Text style={styles.metricaValor}>{quantidadeAtendimentos}</Text>
                  </View>
                  <View style={styles.metrica}>
                    <Text style={[styles.metricaLabel, { color: theme.colors.primary }]}>Ticket médio líquido</Text>
                    <Text style={[styles.metricaValor, { color: theme.colors.primary }]}>{formatarMoeda(ticketMedioLiquido)}</Text>
                  </View>
                </View>
              )}
            </View>
          ))
        )}

        <Text style={styles.secaoTitulo}>Principais serviços por clínica</Text>
        {servicosPorClinica.map(({ clinica, top }) => (
          <View key={clinica.id} style={styles.card}>
            <View style={styles.clinicaHeaderLinha}>
              <View style={[styles.pontoClinica, { backgroundColor: clinica.cor }]} />
              <Text style={styles.clinicaNomeTitulo}>{clinica.nome}</Text>
            </View>
            {top.length === 0 ? (
              <Text style={styles.clienteDetalhe}>Nenhum atendimento registrado</Text>
            ) : (
              top.map((servico, index) => (
                <View key={servico.nome} style={[styles.linhaServico, index > 0 && styles.linhaComTopo]}>
                  <Text style={styles.servicoNome}>{servico.nome}</Text>
                  <Text style={styles.servicoDetalhe}>{servico.qtd}x · {formatarMoeda(servico.total)}</Text>
                </View>
              ))
            )}
          </View>
        ))}

        <Text style={styles.secaoTitulo}>Saídas por categoria</Text>
        {despesasPorCategoria.length === 0 ? (
          <View style={styles.vazioContainer}>
            <Ionicons name="pricetags-outline" size={32} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Nenhuma saída registrada este mês</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {despesasPorCategoria.map((item, index) => (
              <View key={item.categoria} style={[styles.linhaCategoria, index > 0 && styles.linhaComTopo]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoriaNome}>{CATEGORIAS_DESPESA[item.categoria] || item.categoria}</Text>
                  <View style={styles.barraFundo}>
                    <View style={[styles.barraPreenchida, { width: `${Math.round(item.proporcao * 100)}%` }]} />
                  </View>
                </View>
                <Text style={styles.categoriaValor}>{formatarMoeda(item.total)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.secaoTitulo}>Principais insumos</Text>
        {principaisInsumos.length === 0 ? (
          <View style={styles.vazioContainer}>
            <Ionicons name="cube-outline" size={32} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Nenhum insumo lançado nas saídas ainda</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {principaisInsumos.map((item, index) => (
              <View key={item.nome} style={[styles.linhaInsumo, index > 0 && styles.linhaComTopo]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clienteNome}>{item.nome}</Text>
                  <Text style={styles.clienteDetalhe}>
                    {item.qtdComprada} comprada(s) · {formatarMoeda(item.totalGasto)} no total
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.clienteVisitas}>
                    {item.estoqueAtual !== null ? `${item.estoqueAtual} ${item.unidade}` : '—'}
                  </Text>
                  {item.estoqueBaixo && (
                    <View style={styles.badgeEstoqueBaixo}>
                      <Text style={styles.badgeEstoqueBaixoTexto}>Estoque baixo</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.secaoTitulo}>Clientes mais assíduos</Text>
        {clientesAssiduos.length === 0 ? (
          <View style={styles.vazioContainer}>
            <Ionicons name="people-outline" size={32} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Nenhum atendimento registrado ainda</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {clientesAssiduos.map((cliente, index) => (
              <View key={`${cliente.nome}-${index}`} style={[styles.linhaCliente, index > 0 && styles.linhaComTopo]}>
                <View style={styles.rankCirculo}>
                  <Text style={styles.rankTexto}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clienteNome}>{cliente.nome}</Text>
                  <Text style={styles.clienteDetalhe}>Tutor: {cliente.tutor || 'Não informado'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.clienteVisitas}>{cliente.visitas}x</Text>
                  <Text style={styles.clienteDetalhe}>{formatarMoeda(cliente.total)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.secaoTitulo}>Clientes para resgate (30+ dias sem visita)</Text>
        {clientesParaResgate.length === 0 ? (
          <View style={styles.vazioContainer}>
            <Ionicons name="happy-outline" size={32} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Nenhum cliente sumido no momento</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {clientesParaResgate.map((cliente, index) => (
              <View
                key={`${cliente.nome}-${index}`}
                style={[styles.linhaCliente, index > 0 && styles.linhaComTopo]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.clienteNome}>{cliente.nome}</Text>
                  <Text style={styles.clienteDetalhe}>Tutor: {cliente.tutor || 'Não informado'}</Text>
                  <Text style={styles.clienteDetalhe}>Última visita: {formatarDataBR(cliente.ultimaData)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={styles.badgeDiasSemVisita}>
                    <Text style={styles.badgeDiasSemVisitaTexto}>{cliente.diasSemVisita} dias</Text>
                  </View>
                  {!!cliente.telefone && (
                    <TouchableOpacity style={styles.botaoLigar} onPress={() => ligarPara(cliente.telefone)} hitSlop={8}>
                      <Ionicons name="call-outline" size={13} color={theme.colors.primary} />
                      <Text style={styles.botaoLigarTexto}>Ligar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function VariacaoBadge({ valor, inverso = false }: { valor: number; inverso?: boolean }) {
  if (!Number.isFinite(valor) || valor === 0) return null;
  const positivo = valor > 0;
  // Para "Saídas", subir é ruim (vermelho) e cair é bom (verde) — invertido em relação a Entradas/Saldo.
  const bom = inverso ? !positivo : positivo;
  return (
    <View style={styles.variacaoContainer}>
      <Ionicons
        name={positivo ? 'arrow-up' : 'arrow-down'}
        size={10}
        color={bom ? theme.colors.success : theme.colors.danger}
      />
      <Text style={[styles.variacaoTexto, { color: bom ? theme.colors.success : theme.colors.danger }]}>
        {Math.abs(valor).toFixed(0)}%
      </Text>
    </View>
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
  seletorMesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  seletorMesTexto: {
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: theme.font.medium,
    minWidth: 160,
    textAlign: 'center',
  },
  secaoTitulo: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.font.medium,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
  },
  vazioContainer: { alignItems: 'center', paddingVertical: 24, gap: 8, marginHorizontal: theme.spacing.md },
  vazio: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.regular },
  resumoContainer: { flexDirection: 'row', gap: 8, marginHorizontal: theme.spacing.md },
  resumoCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  resumoCabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  resumoLabel: { fontSize: 12, fontFamily: theme.font.regular },
  resumoValor: { fontSize: 15, fontFamily: theme.font.bold },
  variacaoContainer: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  variacaoTexto: { fontSize: 10, fontFamily: theme.font.medium },
  indicadoresContainer: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  indicadorItem: { flex: 1, alignItems: 'center', gap: 2 },
  indicadorValor: { color: theme.colors.text, fontSize: 16, fontFamily: theme.font.bold },
  indicadorLabel: { color: theme.colors.textSecondary, fontSize: 11, fontFamily: theme.font.regular, textAlign: 'center' },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  linhaCategoria: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  categoriaNome: { color: theme.colors.text, fontSize: 13, fontFamily: theme.font.medium, marginBottom: 6 },
  categoriaValor: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.medium },
  barraFundo: { height: 5, borderRadius: 3, backgroundColor: theme.colors.surfaceVariant, overflow: 'hidden' },
  barraPreenchida: { height: 5, borderRadius: 3, backgroundColor: theme.colors.danger },
  linhaInsumo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  badgeEstoqueBaixo: { backgroundColor: theme.colors.warningLight, borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeEstoqueBaixoTexto: { color: theme.colors.warning, fontSize: 10, fontFamily: theme.font.medium },
  linhaCliente: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  linhaComTopo: { borderTopWidth: 1, borderTopColor: theme.colors.divider },
  rankCirculo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankTexto: { color: theme.colors.primary, fontFamily: theme.font.bold, fontSize: 13 },
  clienteNome: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  clienteDetalhe: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.regular, marginTop: 2 },
  clienteVisitas: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.bold },
  badgeDiasSemVisita: { backgroundColor: theme.colors.dangerLight, borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeDiasSemVisitaTexto: { color: theme.colors.danger, fontSize: 11, fontFamily: theme.font.medium },
  botaoLigar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  botaoLigarTexto: { color: theme.colors.primary, fontSize: 12, fontFamily: theme.font.medium },
  clinicaHeaderLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.sm },
  pontoClinica: { width: 10, height: 10, borderRadius: 5 },
  clinicaNomeTitulo: { flex: 1, color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  percentualBadge: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.regular },
  metricasLinha: { flexDirection: 'row', gap: 8 },
  metrica: { flex: 1, backgroundColor: theme.colors.surfaceVariant, borderRadius: theme.radius.md, padding: theme.spacing.sm },
  metricaLabel: { color: theme.colors.textSecondary, fontSize: 11, fontFamily: theme.font.regular, marginBottom: 2 },
  metricaValor: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.medium },
  taxaMaquininhaTexto: { color: theme.colors.warning, fontSize: 11, fontFamily: theme.font.regular, marginTop: 8 },
  linhaServico: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  servicoNome: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.regular },
  servicoDetalhe: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.regular },
});
