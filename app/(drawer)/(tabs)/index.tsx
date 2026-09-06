import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarList, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { DrawerMenuButton } from '@/components/drawer-menu-button';
import { AgendaTimeline, type DiaTimeline, type EventoTimeline } from '@/components/agenda-timeline';
import { SwipePager } from '@/components/swipe-pager';
import { supabase } from '@/src/lib/supabase';
import { theme, COR_PARTICULAR } from '@/src/theme';
import { hoje, dateParaIso, isoParaDate } from '@/src/utils/tempo';

LocaleConfig.locales['pt-br'] = {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

const LETRAS_DIA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_COMPLETO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

type Atendimento = {
  id: string;
  data: string;
  hora: string;
  hora_fim: string;
  procedimento: string;
  status: string;
  paciente_nome: string;
  clinica_nome: string | null;
  clinica_cor: string | null;
};

function somarDias(iso: string, delta: number) {
  const d = isoParaDate(iso);
  d.setDate(d.getDate() + delta);
  return dateParaIso(d);
}

function inicioDaSemana(iso: string) {
  const d = isoParaDate(iso);
  d.setDate(d.getDate() - d.getDay());
  return dateParaIso(d);
}

function gerarDiasDaSemana(inicioIso: string) {
  return Array.from({ length: 7 }, (_, i) => somarDias(inicioIso, i));
}

function construirDiasSemana(inicioIso: string): DiaTimeline[] {
  return gerarDiasDaSemana(inicioIso).map((iso) => {
    const d = isoParaDate(iso);
    return { iso, letra: LETRAS_DIA[d.getDay()], numero: d.getDate(), hoje: iso === hoje() };
  });
}

function construirDiaUnico(iso: string): DiaTimeline[] {
  const d = isoParaDate(iso);
  return [{ iso, letra: LETRAS_DIA[d.getDay()], numero: d.getDate(), hoje: iso === hoje() }];
}

function formatarMesSemana(diasSemana: string[]) {
  const diaDoMeio = isoParaDate(diasSemana[3]);
  return `${MESES_COMPLETO[diaDoMeio.getMonth()]} ${diaDoMeio.getFullYear()}`;
}

function formatarDiaCompleto(iso: string) {
  const d = isoParaDate(iso);
  return `${DIAS_SEMANA_NOME[d.getDay()]}, ${d.getDate()} de ${MESES_ABREV[d.getMonth()]}`;
}

type Visualizacao = 'mensal' | 'semanal' | 'diario';

export default function AgendaScreen() {
  const router = useRouter();
  const [visualizacao, setVisualizacao] = useState<Visualizacao>('mensal');
  const [larguraCalendario, setLarguraCalendario] = useState(0);
  const dataInicial = useRef(hoje().slice(0, 7) + '-01').current;
  const [marcados, setMarcados] = useState<any>({});
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [semanaInicio, setSemanaInicio] = useState(inicioDaSemana(hoje()));
  const [diaSelecionado, setDiaSelecionado] = useState(hoje());

  const carregarDados = useCallback(async () => {
    const { data: rows } = await supabase
      .from('atendimentos')
      .select('id, data, hora, hora_fim, procedimento, status, pacientes(nome), clinicas(nome, cor)')
      .order('hora');

    const todos: Atendimento[] = (rows ?? []).map((r: any) => ({
      ...r,
      paciente_nome: r.pacientes?.nome ?? '',
      clinica_nome: r.clinicas?.nome ?? null,
      clinica_cor: r.clinicas?.cor ?? null,
    }));

    const novasMarcacoes: any = {};
    todos.forEach((item) => {
      if (!novasMarcacoes[item.data]) novasMarcacoes[item.data] = { dots: [] };
      novasMarcacoes[item.data].dots.push({ color: item.clinica_cor || COR_PARTICULAR });
    });
    novasMarcacoes[hoje()] = {
      ...(novasMarcacoes[hoje()] || { dots: [] }),
      selected: true,
      selectedColor: theme.colors.primaryLight,
    };
    setMarcados(novasMarcacoes);
    setAtendimentos(todos);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [carregarDados])
  );

  const diasSemana: DiaTimeline[] = useMemo(() => construirDiasSemana(semanaInicio), [semanaInicio]);

  const paginasSemana = useMemo(
    () => ({
      '-1': construirDiasSemana(somarDias(semanaInicio, -7)),
      '0': diasSemana,
      '1': construirDiasSemana(somarDias(semanaInicio, 7)),
    }),
    [semanaInicio, diasSemana]
  );

  const paginasDia = useMemo(
    () => ({
      '-1': construirDiaUnico(somarDias(diaSelecionado, -1)),
      '0': construirDiaUnico(diaSelecionado),
      '1': construirDiaUnico(somarDias(diaSelecionado, 1)),
    }),
    [diaSelecionado]
  );

  const aoPressionarEvento = useCallback((id: string) => router.push(`/modal?id=${id}`), [router]);

  const eventosPorDia = useMemo(() => {
    const mapa: Record<string, EventoTimeline[]> = {};
    atendimentos.forEach((item) => {
      if (!mapa[item.data]) mapa[item.data] = [];
      mapa[item.data].push({
        id: item.id,
        hora: item.hora,
        horaFim: item.hora_fim,
        paciente_nome: item.paciente_nome,
        clinica_nome: item.clinica_nome,
        procedimento: item.procedimento,
        cor: item.clinica_cor || COR_PARTICULAR,
      });
    });
    return mapa;
  }, [atendimentos]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <DrawerMenuButton />
        <Text style={styles.headerTitulo}>Agenda</Text>
      </View>

      <View style={styles.segmentoContainer}>
        {(['mensal', 'semanal', 'diario'] as const).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.segmentoBotao, visualizacao === v && styles.segmentoBotaoAtivo]}
            onPress={() => setVisualizacao(v)}
          >
            <Text style={[styles.segmentoTexto, visualizacao === v && styles.segmentoTextoAtivo]}>
              {v === 'mensal' ? 'Mensal' : v === 'semanal' ? 'Semanal' : 'Diário'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {visualizacao === 'mensal' && (
        <>
          <View style={styles.calendarioCard}>
            <View
              style={styles.calendarioMedida}
              onLayout={(e) => setLarguraCalendario(Math.round(e.nativeEvent.layout.width))}
            >
              {larguraCalendario > 0 && (
                <CalendarList
                  current={dataInicial}
                  horizontal
                  pagingEnabled
                  calendarWidth={larguraCalendario}
                  showScrollIndicator={false}
                  pastScrollRange={0}
                  futureScrollRange={24}
                  removeClippedSubviews
                  markingType="multi-dot"
                  markedDates={marcados}
                  onDayPress={(day) => router.push(`/dia?data=${day.dateString}`)}
                  firstDay={1}
                  theme={{
                    backgroundColor: 'transparent',
                    calendarBackground: 'transparent',
                    dayTextColor: theme.colors.text,
                    monthTextColor: theme.colors.text,
                    textMonthFontFamily: theme.font.medium,
                    textDayFontFamily: theme.font.regular,
                    textDayHeaderFontFamily: theme.font.medium,
                    textMonthFontWeight: '500',
                    textMonthFontSize: 16,
                    textDayFontSize: 14,
                    textDayHeaderFontSize: 12,
                    textDisabledColor: theme.colors.border,
                    arrowColor: theme.colors.primary,
                    todayTextColor: theme.colors.primary,
                    todayBackgroundColor: theme.colors.primaryLight,
                    selectedDayBackgroundColor: theme.colors.primaryLight,
                    selectedDayTextColor: theme.colors.primary,
                    textSectionTitleColor: theme.colors.textSecondary,
                  }}
                />
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.extratoBotao}
            onPress={() => router.push('/extrato-mensal')}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.extratoBotaoTexto}>Ver extrato de um mês (inclusive anteriores)</Text>
          </TouchableOpacity>
        </>
      )}

      {visualizacao === 'semanal' && (
        <>
          <View style={styles.navContainer}>
            <TouchableOpacity onPress={() => setSemanaInicio(somarDias(semanaInicio, -7))} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSemanaInicio(inicioDaSemana(hoje()))}>
              <Text style={styles.navTitulo}>{formatarMesSemana(diasSemana.map((d) => d.iso))}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSemanaInicio(somarDias(semanaInicio, 7))} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <SwipePager
            aoTrocarPagina={(direcao) => setSemanaInicio((atual) => somarDias(atual, direcao * 7))}
            renderPagina={(offset) => (
              <AgendaTimeline
                dias={paginasSemana[String(offset) as '-1' | '0' | '1']}
                eventosPorDia={eventosPorDia}
                onPressEvento={aoPressionarEvento}
                compacto
              />
            )}
          />
        </>
      )}

      {visualizacao === 'diario' && (
        <>
          <View style={styles.navContainer}>
            <TouchableOpacity onPress={() => setDiaSelecionado(somarDias(diaSelecionado, -1))} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDiaSelecionado(hoje())}>
              <Text style={styles.navTitulo}>{formatarDiaCompleto(diaSelecionado)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDiaSelecionado(somarDias(diaSelecionado, 1))} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <SwipePager
            aoTrocarPagina={(direcao) => setDiaSelecionado((atual) => somarDias(atual, direcao))}
            renderPagina={(offset) => (
              <AgendaTimeline
                dias={paginasDia[String(offset) as '-1' | '0' | '1']}
                eventosPorDia={eventosPorDia}
                onPressEvento={aoPressionarEvento}
                compacto={false}
              />
            )}
          />
        </>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(visualizacao === 'diario' ? `/modal?data=${diaSelecionado}` : '/modal')}
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
    gap: 14,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  headerTitulo: { color: theme.colors.text, fontSize: 28, fontFamily: theme.font.bold },
  segmentoContainer: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.md,
    padding: 4,
    gap: 4,
  },
  segmentoBotao: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: theme.radius.sm,
  },
  segmentoBotaoAtivo: { backgroundColor: theme.colors.surface },
  segmentoTexto: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.medium },
  segmentoTextoAtivo: { color: theme.colors.primary },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: theme.spacing.sm,
  },
  navTitulo: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.medium, minWidth: 160, textAlign: 'center' },
  calendarioCard: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  calendarioMedida: { width: '100%', overflow: 'hidden' },
  extratoBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingVertical: 8,
  },
  extratoBotaoTexto: { color: theme.colors.primary, fontSize: 13, fontFamily: theme.font.medium },
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
