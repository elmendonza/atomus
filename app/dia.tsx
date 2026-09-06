import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { theme, COR_PARTICULAR } from '@/src/theme';
import { hoje, dateParaIso } from '@/src/utils/tempo';
import { alertar } from '@/src/utils/alerta';

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

function formatarDataExtenso(dataStr: string) {
  const [ano, mes, dia] = dataStr.split('-');
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${diasSemana[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}

function somarDias(dataStr: string, delta: number) {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  d.setDate(d.getDate() + delta);
  return dateParaIso(d);
}

export default function DiaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string }>();
  const [data, setData] = useState(params.data || hoje());
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);

  const carregar = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('atendimentos')
      .select('id, data, hora, procedimento, status, pacientes(nome), clinicas(nome, cor)')
      .eq('data', data)
      .order('hora');
    if (error) {
      alertar('Erro ao carregar o dia', error.message);
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
  }, [data]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCentro}>
          <TouchableOpacity onPress={() => setData(somarDias(data, -1))} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitulo}>{formatarDataExtenso(data)}</Text>
          <TouchableOpacity onPress={() => setData(somarDias(data, 1))} hitSlop={10}>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={atendimentos}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 4 }}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Ionicons name="calendar-outline" size={40} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Nenhum atendimento neste dia</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => router.push(`/modal?id=${item.id}`)}
          >
            <View style={[styles.faixaColorida, { backgroundColor: item.clinica_cor || COR_PARTICULAR }]} />
            <View style={styles.cardConteudo}>
              <Text style={styles.hora}>{item.hora}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.paciente}>{item.paciente_nome}</Text>
                <Text style={styles.detalhe}>
                  {item.clinica_nome || 'Particular'} · {item.procedimento || 'Consulta'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/modal?data=${data}`)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
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
  headerCentro: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitulo: { color: theme.colors.text, fontSize: 16, fontFamily: theme.font.medium },
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
  hora: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 13, width: 44 },
  paciente: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  detalhe: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.regular, marginTop: 2 },
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
