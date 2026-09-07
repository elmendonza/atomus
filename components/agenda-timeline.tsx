import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, GestureResponderEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { theme } from '@/src/theme';

// Faixa que deve caber inteira na tela, sem precisar rolar, ao abrir a agenda.
const HORA_INICIO_VISIVEL = 6;
const HORA_FIM_VISIVEL = 22;
const HORAS_VISIVEIS = HORA_FIM_VISIVEL - HORA_INICIO_VISIVEL;
const ALTURA_HORA_PADRAO = 45; // usado só até medirmos a tela de verdade

const DURACAO_PADRAO_MIN = 60;
const LARGURA_LABEL_HORA = 42;
const HORAS = Array.from({ length: 24 }, (_, i) => i);
const DISTANCIA_MINIMA_ARRASTO = 6; // px — abaixo disso, tratamos como toque (abre popup), não arrasto

export type EventoTimeline = {
  id: string;
  hora: string;
  horaFim: string;
  paciente_nome: string;
  clinica_nome: string | null;
  procedimento: string;
  cor: string;
};

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

export type DiaTimeline = {
  iso: string;
  letra: string;
  numero: number;
  hoje: boolean;
};

type Arrasto = {
  id: string;
  tipo: 'mover' | 'redimensionar';
  indiceDia: number;
  startPageX: number;
  startPageY: number;
  horaOriginal: string;
  horaFimOriginal: string;
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
  const scrollRef = useRef<ScrollView>(null);
  const jaRolou = useRef(false);

  const arrastoRef = useRef<Arrasto | null>(null);
  const deltaAtualRef = useRef({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState<{ id: string; tipo: 'mover' | 'redimensionar'; deltaX: number; deltaY: number } | null>(
    null
  );

  const alturaHora = alturaContainer > 0 ? alturaContainer / HORAS_VISIVEIS : ALTURA_HORA_PADRAO;

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
  }, [dias.map((d) => d.iso).join(',')]);

  const larguraColuna = largura > 0 ? (largura - LARGURA_LABEL_HORA) / dias.length : 0;
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  function iniciarArrasto(evt: GestureResponderEvent, ev: EventoTimeline, indiceDia: number, tipo: 'mover' | 'redimensionar') {
    arrastoRef.current = {
      id: ev.id,
      tipo,
      indiceDia,
      startPageX: evt.nativeEvent.pageX,
      startPageY: evt.nativeEvent.pageY,
      horaOriginal: ev.hora,
      horaFimOriginal: ev.horaFim,
    };
    deltaAtualRef.current = { x: 0, y: 0 };
    setArrastando({ id: ev.id, tipo, deltaX: 0, deltaY: 0 });
  }

  function moverArrasto(evt: GestureResponderEvent) {
    const info = arrastoRef.current;
    if (!info) return;
    const deltaX = evt.nativeEvent.pageX - info.startPageX;
    const deltaY = evt.nativeEvent.pageY - info.startPageY;
    deltaAtualRef.current = { x: deltaX, y: deltaY };
    setArrastando({ id: info.id, tipo: info.tipo, deltaX, deltaY });
  }

  function finalizarArrasto() {
    const info = arrastoRef.current;
    const { x: deltaX, y: deltaY } = deltaAtualRef.current;
    arrastoRef.current = null;
    deltaAtualRef.current = { x: 0, y: 0 };
    setArrastando(null);
    if (!info) return;

    const distancia = Math.hypot(deltaX, deltaY);
    if (distancia < DISTANCIA_MINIMA_ARRASTO) {
      onPressEvento(info.id);
      return;
    }
    if (!onMoverEvento || alturaHora === 0) return;

    const minutosPorPixel = 60 / alturaHora;
    const inicioOriginalMin = paraMinutos(info.horaOriginal);
    const fimOriginalMin = paraMinutos(info.horaFimOriginal);
    const duracaoOriginal = Math.max(15, fimOriginalMin - inicioOriginalMin);

    if (info.tipo === 'redimensionar') {
      const deltaMinutos = arredondarPara15(deltaY * minutosPorPixel);
      const novoFimMin = Math.max(inicioOriginalMin + 15, fimOriginalMin + deltaMinutos);
      onMoverEvento(info.id, dias[info.indiceDia].iso, info.horaOriginal, formatarMinutos(novoFimMin));
      return;
    }

    const deltaMinutos = arredondarPara15(deltaY * minutosPorPixel);
    const novoInicioMin = Math.max(0, Math.min(1440 - duracaoOriginal, inicioOriginalMin + deltaMinutos));
    const novoFimMin = novoInicioMin + duracaoOriginal;
    const deltaColunas = larguraColuna > 0 ? Math.round(deltaX / larguraColuna) : 0;
    const novoIndiceDia = Math.max(0, Math.min(dias.length - 1, info.indiceDia + deltaColunas));
    onMoverEvento(info.id, dias[novoIndiceDia].iso, formatarMinutos(novoInicioMin), formatarMinutos(novoFimMin));
  }

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
        scrollEnabled={!arrastando}
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

              {(eventosPorDia[dia.iso] || []).map((ev) => {
                const inicioMin = paraMinutos(ev.hora);
                const fimMin = paraMinutos(ev.horaFim);
                const duracaoMin = fimMin > inicioMin ? fimMin - inicioMin : DURACAO_PADRAO_MIN;
                const estaArrastando = arrastando?.id === ev.id;
                const deltaMover = estaArrastando && arrastando!.tipo === 'mover' ? arrastando! : null;
                const deltaRedimensionar = estaArrastando && arrastando!.tipo === 'redimensionar' ? arrastando! : null;
                const topPx = inicioMin * (alturaHora / 60);
                const alturaBase = Math.max(duracaoMin * (alturaHora / 60), compacto ? 30 : 26);
                const alturaPx = deltaRedimensionar ? Math.max(20, alturaBase + deltaRedimensionar.deltaY) : alturaBase;
                return (
                  <View
                    key={ev.id}
                    style={[
                      styles.evento,
                      {
                        top: topPx,
                        height: alturaPx,
                        backgroundColor: ev.cor + '26',
                        borderLeftColor: ev.cor,
                        zIndex: estaArrastando ? 10 : 1,
                        opacity: estaArrastando ? 0.85 : 1,
                        transform: deltaMover ? [{ translateX: deltaMover.deltaX }, { translateY: deltaMover.deltaY }] : undefined,
                      },
                    ]}
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    onResponderGrant={(e) => iniciarArrasto(e, ev, indiceDia, 'mover')}
                    onResponderMove={moverArrasto}
                    onResponderRelease={finalizarArrasto}
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
                      <View
                        style={styles.alcaRedimensionar}
                        onStartShouldSetResponder={() => true}
                        onResponderTerminationRequest={() => false}
                        onResponderGrant={(e) => iniciarArrasto(e, ev, indiceDia, 'redimensionar')}
                        onResponderMove={moverArrasto}
                        onResponderRelease={finalizarArrasto}
                      >
                        <View style={styles.alcaRedimensionarTraco} />
                      </View>
                    )}
                  </View>
                );
              })}

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
    left: 2,
    right: 2,
    borderRadius: 6,
    borderLeftWidth: 3,
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
