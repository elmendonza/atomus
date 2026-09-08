import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { ScrollView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '@/src/theme';

// Faixa que deve caber inteira na tela, sem precisar rolar, ao abrir a agenda.
const HORA_INICIO_VISIVEL = 6;
const HORA_FIM_VISIVEL = 22;
const HORAS_VISIVEIS = HORA_FIM_VISIVEL - HORA_INICIO_VISIVEL;
const ALTURA_HORA_PADRAO = 45; // usado só até medirmos a tela de verdade

const DURACAO_PADRAO_MIN = 60;
const LARGURA_LABEL_HORA = 42;
const HORAS = Array.from({ length: 24 }, (_, i) => i);
const DISTANCIA_MINIMA_ARRASTO = 6; // px — distância máxima para o gesto ainda contar como toque
const ESPERA_PARA_LIBERAR_ARRASTO_MS = 2000; // tempo de toque-e-segure para liberar arrastar/redimensionar

export type EventoTimeline = {
  id: string;
  hora: string;
  horaFim: string;
  paciente_nome: string;
  clinica_nome: string | null;
  procedimento: string;
  cor: string;
};

type EventoComLayout = EventoTimeline & { coluna: number; totalColunas: number };

function paraMinutos(hora: string) {
  const [hh, mm] = hora.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

function formatarMinutos(minutos: number) {
  const total = Math.max(0, Math.min(Math.round(minutos), 23 * 60 + 59));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function arredondarPara15(minutos: number) {
  return Math.round(minutos / 15) * 15;
}

/** Divide eventos que se sobrepõem no tempo em colunas lado a lado, como no Google Agenda. */
function calcularLayoutEventos(eventos: EventoTimeline[]): EventoComLayout[] {
  const ordenados = [...eventos].sort((a, b) => {
    const inicioA = paraMinutos(a.hora);
    const inicioB = paraMinutos(b.hora);
    if (inicioA !== inicioB) return inicioA - inicioB;
    return paraMinutos(b.horaFim) - paraMinutos(a.horaFim);
  });

  const colunas: { fimMin: number }[] = [];
  const atribuicoes: { ev: EventoTimeline; coluna: number; inicioMin: number; fimMin: number }[] = [];

  for (const ev of ordenados) {
    const inicioMin = paraMinutos(ev.hora);
    const fimMin = Math.max(paraMinutos(ev.horaFim), inicioMin + 1);
    let colunaEscolhida = colunas.findIndex((c) => c.fimMin <= inicioMin);
    if (colunaEscolhida === -1) {
      colunaEscolhida = colunas.length;
      colunas.push({ fimMin });
    } else {
      colunas[colunaEscolhida].fimMin = fimMin;
    }
    atribuicoes.push({ ev, coluna: colunaEscolhida, inicioMin, fimMin });
  }

  return atribuicoes.map(({ ev, coluna, inicioMin, fimMin }) => {
    const sobrepostos = atribuicoes.filter((o) => o.inicioMin < fimMin && o.fimMin > inicioMin);
    const totalColunas = Math.max(1, ...sobrepostos.map((o) => o.coluna + 1));
    return { ...ev, coluna, totalColunas };
  });
}

export type DiaTimeline = {
  iso: string;
  letra: string;
  numero: number;
  hoje: boolean;
};

type Props = {
  dias: DiaTimeline[];
  eventosPorDia: Record<string, EventoTimeline[]>;
  onPressEvento: (id: string) => void;
  onMoverEvento?: (id: string, novaData: string, novaHora: string, novaHoraFim: string) => void;
  compacto?: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

type EventoBlocoProps = {
  ev: EventoComLayout;
  indiceDia: number;
  diasIso: string[];
  larguraColuna: number;
  alturaHora: number;
  compacto: boolean;
  onPressEvento: (id: string) => void;
  onMoverEvento?: (id: string, novaData: string, novaHora: string, novaHoraFim: string) => void;
  onTocarInicio: () => void;
  onTocarFim: () => void;
};

const EventoBloco = memo(function EventoBloco({
  ev,
  indiceDia,
  diasIso,
  larguraColuna,
  alturaHora,
  compacto,
  onPressEvento,
  onMoverEvento,
  onTocarInicio,
  onTocarFim,
}: EventoBlocoProps) {
  const inicioMin = paraMinutos(ev.hora);
  const fimMin = paraMinutos(ev.horaFim);
  const duracaoMin = fimMin > inicioMin ? fimMin - inicioMin : DURACAO_PADRAO_MIN;
  const topPx = inicioMin * (alturaHora / 60);
  const alturaBase = Math.max(duracaoMin * (alturaHora / 60), compacto ? 30 : 26);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const alturaExtra = useSharedValue(0);
  const emDestaque = useSharedValue(0);

  function finalizarMover(deltaX: number, deltaY: number) {
    const distancia = Math.hypot(deltaX, deltaY);
    if (distancia < DISTANCIA_MINIMA_ARRASTO) return;
    if (!onMoverEvento || alturaHora === 0) return;
    const minutosPorPixel = 60 / alturaHora;
    const deltaMinutos = arredondarPara15(deltaY * minutosPorPixel);
    const novoInicioMin = Math.max(0, Math.min(1440 - duracaoMin, inicioMin + deltaMinutos));
    const novoFimMin = novoInicioMin + duracaoMin;
    const deltaColunas = larguraColuna > 0 ? Math.round(deltaX / larguraColuna) : 0;
    const novoIndiceDia = Math.max(0, Math.min(diasIso.length - 1, indiceDia + deltaColunas));
    onMoverEvento(ev.id, diasIso[novoIndiceDia], formatarMinutos(novoInicioMin), formatarMinutos(novoFimMin));
  }

  function finalizarRedimensionar(deltaY: number) {
    if (!onMoverEvento || alturaHora === 0) return;
    const minutosPorPixel = 60 / alturaHora;
    const deltaMinutos = arredondarPara15(deltaY * minutosPorPixel);
    const novoFimMin = Math.max(inicioMin + 15, fimMin + deltaMinutos);
    onMoverEvento(ev.id, diasIso[indiceDia], ev.hora, formatarMinutos(novoFimMin));
  }

  const gestoToque = Gesture.Tap()
    .maxDuration(ESPERA_PARA_LIBERAR_ARRASTO_MS - 100)
    .maxDistance(DISTANCIA_MINIMA_ARRASTO)
    .onEnd(() => {
      runOnJS(onPressEvento)(ev.id);
    });

  const gestoArrastar = Gesture.Pan()
    .activateAfterLongPress(ESPERA_PARA_LIBERAR_ARRASTO_MS)
    .onBegin(() => {
      emDestaque.value = 1;
      runOnJS(onTocarInicio)();
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(finalizarMover)(e.translationX, e.translationY);
      translateX.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(0, { duration: 150 });
    })
    .onFinalize(() => {
      emDestaque.value = 0;
      runOnJS(onTocarFim)();
    });

  const gestoMover = Gesture.Race(gestoToque, gestoArrastar);

  const gestoRedimensionar = Gesture.Pan()
    .activateAfterLongPress(ESPERA_PARA_LIBERAR_ARRASTO_MS)
    .onBegin(() => {
      emDestaque.value = 1;
      runOnJS(onTocarInicio)();
    })
    .onUpdate((e) => {
      alturaExtra.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(finalizarRedimensionar)(e.translationY);
      alturaExtra.value = withTiming(0, { duration: 150 });
    })
    .onFinalize(() => {
      emDestaque.value = 0;
      runOnJS(onTocarFim)();
    });

  const estiloAnimado = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    height: Math.max(20, alturaBase + alturaExtra.value),
    zIndex: emDestaque.value ? 10 : 1,
    opacity: emDestaque.value ? 0.88 : 1,
  }));

  const larguraPercentual = 100 / ev.totalColunas;
  const leftPercentual = ev.coluna * larguraPercentual;

  return (
    <GestureDetector gesture={gestoMover}>
      <Animated.View
        style={[
          styles.evento,
          {
            top: topPx,
            left: `${leftPercentual}%`,
            width: `${larguraPercentual}%`,
            backgroundColor: ev.cor + '26',
            borderLeftColor: ev.cor,
          },
          estiloAnimado,
        ]}
      >
        <Text
          numberOfLines={compacto ? 2 : 1}
          style={[styles.eventoTexto, { color: theme.colors.text, fontSize: compacto ? 10 : 13 }]}
        >
          {ev.paciente_nome}
          {!compacto ? ` · ${ev.clinica_nome || 'Particular'}` : ''}
        </Text>
        {!compacto && (
          <Text style={[styles.eventoDetalhe, { color: ev.cor }]} numberOfLines={1}>
            {ev.hora}–{ev.horaFim} · {ev.procedimento || 'Consulta'}
          </Text>
        )}

        {!!onMoverEvento && (
          <GestureDetector gesture={gestoRedimensionar}>
            <View style={styles.alcaRedimensionar}>
              <View style={styles.alcaRedimensionarTraco} />
            </View>
          </GestureDetector>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

export const AgendaTimeline = memo(function AgendaTimeline({
  dias,
  eventosPorDia,
  onPressEvento,
  onMoverEvento,
  compacto = true,
}: Props) {
  const [largura, setLargura] = useState(0);
  const [alturaContainer, setAlturaContainer] = useState(0);
  const [agora, setAgora] = useState(new Date());
  const [toquesAtivos, setToquesAtivos] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const jaRolou = useRef(false);

  const onTocarInicio = useCallback(() => setToquesAtivos((n) => n + 1), []);
  const onTocarFim = useCallback(() => setToquesAtivos((n) => Math.max(0, n - 1)), []);

  const alturaHora = alturaContainer > 0 ? alturaContainer / HORAS_VISIVEIS : ALTURA_HORA_PADRAO;
  const diasIso = useMemo(() => dias.map((d) => d.iso), [dias]);

  const estiloGradeWeb = useMemo(
    () =>
      Platform.OS === 'web'
        ? ({
            backgroundImage: `repeating-linear-gradient(to bottom, ${theme.colors.divider} 0, ${theme.colors.divider} 1px, transparent 1px, transparent ${alturaHora}px)`,
          } as any)
        : null,
    [alturaHora]
  );

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    jaRolou.current = false;
  }, [diasIso.join(',')]);

  const eventosPorDiaComLayout = useMemo(() => {
    const resultado: Record<string, EventoComLayout[]> = {};
    for (const iso of diasIso) {
      resultado[iso] = calcularLayoutEventos(eventosPorDia[iso] || []);
    }
    return resultado;
  }, [diasIso, eventosPorDia]);

  const larguraColuna = largura > 0 ? (largura - LARGURA_LABEL_HORA) / dias.length : 0;
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  return (
    <View style={styles.container}>
      {dias.length > 1 && (
        <View style={styles.cabecalho}>
          <View style={{ width: LARGURA_LABEL_HORA }} />
          {dias.map((dia) => (
            <View key={dia.iso} style={[styles.cabecalhoColuna, { width: larguraColuna || undefined, flex: larguraColuna ? undefined : 1 }]}>
              <Text style={styles.cabecalhoLetra}>{dia.letra}</Text>
              <View style={[styles.cabecalhoNumeroContainer, dia.hoje && styles.cabecalhoNumeroHoje]}>
                <Text style={[styles.cabecalhoNumero, dia.hoje && styles.cabecalhoNumeroTextoHoje]}>{dia.numero}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={toquesAtivos === 0}
        onLayout={(e) => {
          setLargura(e.nativeEvent.layout.width);
          setAlturaContainer(e.nativeEvent.layout.height);
        }}
        onContentSizeChange={() => {
          if (jaRolou.current || !scrollRef.current || alturaContainer === 0) return;
          jaRolou.current = true;
          scrollRef.current.scrollTo({ y: HORA_INICIO_VISIVEL * alturaHora, animated: false });
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: LARGURA_LABEL_HORA }}>
            {HORAS.map((h) => (
              <View key={h} style={{ height: alturaHora }}>
                <Text style={styles.horaLabel}>{pad(h)}:00</Text>
              </View>
            ))}
          </View>

          {dias.map((dia, indiceDia) => (
            <View
              key={dia.iso}
              style={[
                styles.coluna,
                { height: alturaHora * 24, width: larguraColuna || undefined, flex: larguraColuna ? undefined : 1 },
                estiloGradeWeb,
              ]}
            >
              {!estiloGradeWeb &&
                HORAS.map((h) => <View key={h} style={[styles.linhaHora, { top: h * alturaHora }]} />)}

              {(eventosPorDiaComLayout[dia.iso] || []).map((ev) => (
                <EventoBloco
                  key={ev.id}
                  ev={ev}
                  indiceDia={indiceDia}
                  diasIso={diasIso}
                  larguraColuna={larguraColuna}
                  alturaHora={alturaHora}
                  compacto={compacto}
                  onPressEvento={onPressEvento}
                  onMoverEvento={onMoverEvento}
                  onTocarInicio={onTocarInicio}
                  onTocarFim={onTocarFim}
                />
              ))}

              {dia.hoje && (
                <View style={[styles.linhaAgora, { top: minutosAgora * (alturaHora / 60) }]}>
                  <View style={styles.linhaAgoraPonto} />
                  <View style={styles.linhaAgoraTraco} />
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  cabecalho: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    paddingBottom: 8,
  },
  cabecalhoColuna: { alignItems: 'center', gap: 4 },
  cabecalhoLetra: { color: theme.colors.textSecondary, fontSize: 11, fontFamily: theme.font.medium },
  cabecalhoNumeroContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabecalhoNumeroHoje: { backgroundColor: theme.colors.primary },
  cabecalhoNumero: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.medium },
  cabecalhoNumeroTextoHoje: { color: '#fff' },
  horaLabel: {
    color: theme.colors.textTertiary,
    fontSize: 10,
    fontFamily: theme.font.regular,
    marginTop: -6,
    textAlign: 'right',
    paddingRight: 6,
  },
  coluna: { borderLeftWidth: 1, borderLeftColor: theme.colors.divider },
  linhaHora: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.colors.divider,
  },
  evento: {
    position: 'absolute',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderRightWidth: 1,
    borderRightColor: theme.colors.background,
    padding: 4,
    overflow: 'hidden',
  },
  eventoTexto: { fontFamily: theme.font.medium },
  eventoDetalhe: { fontFamily: theme.font.regular, fontSize: 11, marginTop: 1, opacity: 0.85 },
  alcaRedimensionar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
    ...Platform.select({ web: { cursor: 'ns-resize' } as any, default: {} }),
  },
  alcaRedimensionarTraco: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.text,
    opacity: 0.25,
    marginBottom: 2,
  },
  linhaAgora: {
    position: 'absolute',
    left: -1,
    right: 0,
    height: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linhaAgoraPonto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
    marginLeft: -4,
  },
  linhaAgoraTraco: { flex: 1, height: 1.5, backgroundColor: theme.colors.danger },
});
