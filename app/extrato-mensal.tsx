import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CampoDataHora } from '@/components/campo-data-hora';
import { supabase } from '@/src/lib/supabase';
import { theme, COR_PARTICULAR } from '@/src/theme';
import { hoje, isoParaDate, dateParaIso } from '@/src/utils/tempo';
import { alertar } from '@/src/utils/alerta';

const MESES_COMPLETO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
};

type Atendimento = {
  id: string;
  data: string;
  hora: string;
  procedimento: string;
  status: string;
  paciente_nome: string;
  clinica_nome: string | null;
  clinica_cor: string | null;
};

function inicioDoMes(mes: string) {
  return `${mes}-01`;
}

function fimDoMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  const ultimoDia = new Date(ano, m, 0).getDate();
  return `${mes}-${String(ultimoDia).padStart(2, '0')}`;
}

function somarMeses(mes: string, delta: number) {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatarDataCurta(dataStr: string) {
  const [, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}`;
}

export default function ExtratoMensalScreen() {
  const router = useRouter();
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('atendimentos')
      .select('id, data, hora, procedimento, status, pacientes(nome), clinicas(nome, cor)')
      .gte('data', inicioDoMes(mes))
      .lte('data', fimDoMes(mes))
      .order('data')
      .order('hora');
    setCarregando(false);
    if (error) {
      alertar('Erro ao carregar extrato', error.message);
      return;
    }
    setAtendimentos(
      (data ?? []).map((r: any) => ({
        ...r,
        paciente_nome: r.pacientes?.nome ?? '',
        clinica_nome: r.clinicas?.nome ?? null,
        clinica_cor: r.clinicas?.cor ?? null,
      }))
    );
  }, [mes]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const [ano, mesNum] = mes.split('-').map(Number);
  const tituloMes = `${MESES_COMPLETO[mesNum - 1]} ${ano}`;
  const realizados = atendimentos.filter((a) => a.status === 'realizado').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>Extrato mensal</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.navContainer}>
        <TouchableOpacity onPress={() => setMes((m) => somarMeses(m, -1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.navTitulo}>{tituloMes}</Text>
        <TouchableOpacity onPress={() => setMes((m) => somarMeses(m, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.escolherMesContainer}>
        <CampoDataHora
          valor={isoParaDate(inicioDoMes(mes))}
          modo="date"
          aoAlterar={(d) => setMes(dateParaIso(d).slice(0, 7))}
          textoExibido="Ir para um mês específico"
          icone="calendar-outline"
        />
      </View>

      <View style={styles.resumoContainer}>
        <View style={styles.resumoCard}>
          <Text style={styles.resumoLabel}>Total no mês</Text>
          <Text style={styles.resumoValor}>{atendimentos.length}</Text>
        </View>
        <View style={styles.resumoCard}>
          <Text style={[styles.resumoLabel, { color: theme.colors.success }]}>Realizados</Text>
          <Text style={[styles.resumoValor, { color: theme.colors.success }]}>{realizados}</Text>
        </View>
      </View>

      <FlatList
        data={atendimentos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Ionicons name="document-text-outline" size={40} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>{carregando ? 'Carregando...' : 'Nenhum atendimento neste mês'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.faixaColorida, { backgroundColor: item.clinica_cor || COR_PARTICULAR }]} />
            <View style={styles.cardConteudo}>
              <View style={styles.dataHoraBox}>
                <Text style={styles.dataTexto}>{formatarDataCurta(item.data)}</Text>
                <Text style={styles.horaTexto}>{item.hora}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paciente}>{item.paciente_nome}</Text>
                <Text style={styles.detalhe}>
                  {item.clinica_nome || 'Particular'} · {item.procedimento || 'Consulta'}
                </Text>
              </View>
              <Text
                style={[
                  styles.statusTexto,
                  item.status === 'realizado' && { color: theme.colors.success },
                  item.status === 'cancelado' && { color: theme.colors.danger },
                ]}
              >
                {STATUS_LABEL[item.status] || item.status}
              </Text>
            </View>
          </View>
        )}
      />
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
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  navTitulo: { color: theme.colors.text, fontSize: 16, fontFamily: theme.font.medium, minWidth: 160, textAlign: 'center' },
  escolherMesContainer: { paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm },
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
  resumoValor: { color: theme.colors.text, fontSize: 18, fontFamily: theme.font.bold },
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
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  dataHoraBox: { width: 48, alignItems: 'flex-start' },
  dataTexto: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 13 },
  horaTexto: { color: theme.colors.textSecondary, fontFamily: theme.font.regular, fontSize: 12, marginTop: 1 },
  paciente: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  detalhe: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.regular, marginTop: 2 },
  statusTexto: { color: theme.colors.textTertiary, fontFamily: theme.font.medium, fontSize: 12 },
});
