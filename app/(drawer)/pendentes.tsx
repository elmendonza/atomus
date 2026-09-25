import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DrawerMenuButton } from '@/components/drawer-menu-button';
import { supabase } from '@/src/lib/supabase';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';
import { formatarMoeda, formatarNumeroWhatsApp } from '@/src/utils/formato';
import { formatarDataBR, hoje } from '@/src/utils/tempo';
import { montarMensagemCobranca } from '@/src/utils/cobranca';

// Pendentes: atendimentos REALIZADOS ainda não pagos, agrupados por paciente (pet), para a cobrança.
type Atend = { id: string; data: string; hora: string; procedimento: string | null; valor: number | null };
type Grupo = { pacienteId: string; nome: string; tutor: string | null; telefone: string | null; atendimentos: Atend[]; total: number };

const PASTEL = { vermelho: '#FBE3E1', vermelhoTexto: '#8A4B46', verde: '#DDF1E4', verdeTexto: '#2E6B45' };

export default function PendentesScreen() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('atendimentos')
      .select('id, data, hora, procedimento, valor, paciente_id, pacientes(nome, tutor, telefone)')
      .eq('status', 'realizado')
      .eq('pago', false)
      .order('data', { ascending: true })
      .order('hora', { ascending: true });
    setCarregando(false);
    if (error) {
      alertar('Erro ao carregar pendentes', error.message);
      return;
    }
    const mapa = new Map<string, Grupo>();
    for (const r of (data ?? []) as any[]) {
      const g: Grupo = mapa.get(r.paciente_id) ?? {
        pacienteId: r.paciente_id,
        nome: r.pacientes?.nome ?? '',
        tutor: r.pacientes?.tutor ?? null,
        telefone: r.pacientes?.telefone ?? null,
        atendimentos: [],
        total: 0,
      };
      g.atendimentos.push({ id: r.id, data: r.data, hora: r.hora, procedimento: r.procedimento, valor: r.valor });
      g.total += Number(r.valor) || 0;
      mapa.set(r.paciente_id, g);
    }
    setGrupos([...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? grupos.filter((g) => g.nome.toLowerCase().includes(t) || (g.tutor ?? '').toLowerCase().includes(t)) : grupos;
  }, [grupos, busca]);
  const totalGeral = grupos.reduce((s, g) => s + g.total, 0);

  async function gravarPago(ids: string[], resumo: string) {
    const { error } = await supabase.from('atendimentos').update({ pago: true, data_pagamento: hoje() }).in('id', ids);
    if (error) {
      alertar('Erro ao marcar como pago', error.message);
      return;
    }
    alertar('Pago', resumo);
    carregar();
  }

  function pagarUm(g: Grupo, a: Atend) {
    alertar('Marcar como pago', `${g.nome} — ${formatarDataBR(a.data)} ${a.hora}${a.valor ? ` · ${formatarMoeda(Number(a.valor))}` : ''}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar pago', onPress: () => gravarPago([a.id], 'Atendimento marcado como pago.') },
    ]);
  }

  function pagarTodos(g: Grupo) {
    const lista = g.atendimentos.map((a) => formatarDataBR(a.data)).join('\n');
    alertar('Marcar tudo como pago', `${g.nome}: ${g.atendimentos.length} atendimento(s), total ${formatarMoeda(g.total)}\n\n${lista}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar pago', onPress: () => gravarPago(g.atendimentos.map((a) => a.id), `${g.atendimentos.length} atendimento(s) marcado(s) como pago.`) },
    ]);
  }

  function cobrarWhatsApp(g: Grupo) {
    if (!g.telefone) {
      alertar('Cadastre o telefone do tutor em Clientes para enviar a cobrança.');
      return;
    }
    const mensagem = montarMensagemCobranca(g.nome, g.atendimentos.map((a) => a.data), g.total);
    Linking.openURL(`https://wa.me/${formatarNumeroWhatsApp(g.telefone)}?text=${encodeURIComponent(mensagem)}`);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <DrawerMenuButton />
        <Text style={styles.headerTitulo}>Pendentes</Text>
      </View>

      <FlatList
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} />}
        data={filtrados}
        keyExtractor={(g) => g.pacienteId}
        ListHeaderComponent={
          <View>
            <View style={styles.resumoCard}>
              <Text style={styles.resumoLabel}>Total a receber</Text>
              <Text style={styles.resumoValor}>{formatarMoeda(totalGeral)}</Text>
              <Text style={styles.resumoDetalhe}>
                {grupos.length} {grupos.length === 1 ? 'cliente' : 'clientes'} · {grupos.reduce((s, g) => s + g.atendimentos.length, 0)} atendimentos realizados sem pagamento
              </Text>
            </View>
            <View style={styles.buscaWrap}>
              <Ionicons name="search-outline" size={18} color={theme.colors.textTertiary} />
              <TextInput
                style={styles.buscaInput}
                placeholder="Buscar por pet ou tutor"
                placeholderTextColor={theme.colors.textTertiary}
                value={busca}
                onChangeText={setBusca}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Text style={styles.vazio}>{grupos.length === 0 ? 'Nenhum pagamento pendente 🎉' : 'Nenhum resultado para a busca'}</Text>
            {grupos.length === 0 && <Text style={styles.vazioDica}>Atendimentos realizados e ainda não pagos aparecem aqui.</Text>}
          </View>
        }
        renderItem={({ item: g }) => (
          <View style={styles.card}>
            <View style={styles.cardTopo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{g.nome}</Text>
                <Text style={styles.detalhe}>Tutor: {g.tutor || 'Não informado'}</Text>
              </View>
              <View style={styles.totalBadge}>
                <Text style={styles.totalTexto}>{formatarMoeda(g.total)}</Text>
              </View>
            </View>

            {g.atendimentos.map((a) => (
              <View key={a.id} style={styles.linhaAtend}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.data}>{formatarDataBR(a.data)} · {a.hora}</Text>
                  {!!a.procedimento && <Text style={styles.detalhe}>{a.procedimento}</Text>}
                </View>
                <Text style={styles.valor}>{a.valor ? formatarMoeda(Number(a.valor)) : 'sem valor'}</Text>
                <TouchableOpacity style={styles.botaoPagoPeq} onPress={() => pagarUm(g, a)} hitSlop={6}>
                  <Text style={styles.botaoPagoPeqTexto}>Pago</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.acoes}>
              <TouchableOpacity style={styles.acaoWhats} onPress={() => cobrarWhatsApp(g)} activeOpacity={0.7}>
                <Ionicons name="logo-whatsapp" size={16} color={PASTEL.verdeTexto} />
                <Text style={styles.acaoWhatsTexto}>Cobrar no WhatsApp</Text>
              </TouchableOpacity>
              {g.atendimentos.length > 1 && (
                <TouchableOpacity style={styles.acaoTodos} onPress={() => pagarTodos(g)} activeOpacity={0.7}>
                  <Text style={styles.acaoTodosTexto}>Marcar todos como pago</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xs },
  headerTitulo: { color: theme.colors.text, fontSize: 28, fontFamily: theme.font.bold },
  resumoCard: { marginHorizontal: theme.spacing.md, marginTop: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: PASTEL.vermelho },
  resumoLabel: { color: PASTEL.vermelhoTexto, fontSize: 12, fontFamily: theme.font.medium },
  resumoValor: { color: theme.colors.text, fontSize: 26, fontFamily: theme.font.bold, marginTop: 2 },
  resumoDetalhe: { color: PASTEL.vermelhoTexto, fontSize: 12, fontFamily: theme.font.regular, marginTop: 4 },
  buscaWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: theme.spacing.md, marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.full, backgroundColor: theme.colors.surface },
  buscaInput: { flex: 1, paddingVertical: 10, fontSize: 14, fontFamily: theme.font.regular, color: theme.colors.text },
  card: { marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.divider },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  nome: { fontSize: 16, fontFamily: theme.font.medium, color: theme.colors.text },
  detalhe: { fontSize: 12, fontFamily: theme.font.regular, color: theme.colors.textSecondary, marginTop: 2 },
  totalBadge: { backgroundColor: PASTEL.vermelho, borderRadius: theme.radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  totalTexto: { color: PASTEL.vermelhoTexto, fontSize: 13, fontFamily: theme.font.bold },
  linhaAtend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  data: { fontSize: 14, fontFamily: theme.font.medium, color: theme.colors.text },
  valor: { fontSize: 13, fontFamily: theme.font.medium, color: theme.colors.textSecondary },
  botaoPagoPeq: { backgroundColor: PASTEL.verde, borderRadius: theme.radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  botaoPagoPeqTexto: { color: PASTEL.verdeTexto, fontSize: 12, fontFamily: theme.font.bold },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  acaoWhats: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PASTEL.verde, borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  acaoWhatsTexto: { color: PASTEL.verdeTexto, fontSize: 13, fontFamily: theme.font.medium },
  acaoTodos: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  acaoTodosTexto: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.medium },
  vazioContainer: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 40 },
  vazio: { color: theme.colors.textSecondary, fontSize: 14, fontFamily: theme.font.medium },
  vazioDica: { color: theme.colors.textTertiary, fontSize: 12, fontFamily: theme.font.regular, textAlign: 'center' },
});
