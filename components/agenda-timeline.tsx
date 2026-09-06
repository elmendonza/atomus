import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { theme } from '@/src/theme';

// Faixa que deve caber inteira na tela, sem precisar rolar, ao abrir a agenda.
const HORA_INICIO_VISIVEL = 6;
const HORA_FIM_VISIVEL = 22;
const HORAS_VISIVEIS = HORA_FIM_VISIVEL - HORA_INICIO_VISIVEL;
const ALTURA_HORA_PADRAO = 45; // usado só até medirmos a tela de verdade

const DURACAO_PADRAO_MIN = 50;
const LARGURA_LABEL_HORA = 42;
const HORAS = Array.from({ length: 24 }, (_, i) => i);

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
  compacto?: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export const AgendaTimeline = memo(function AgendaTimeline({ dias, eventosPorDia, onPressEvento, compacto = true }: Props) {
  const [largura, setLargura] = useState(0);
  const [alturaContainer, setAlturaContainer] = useState(0);
  const [agora, setAgora] = useState(new Date());
  const scrollRef = useRef<ScrollView>(null);
  const jaRolou = useRef(false);

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

          {dias.map((dia) => (
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
                const topPx = inicioMin * (alturaHora / 60);
                const alturaPx = Math.max(duracaoMin * (alturaHora / 60), compacto ? 30 : 26);
                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={[
                      styles.evento,
                      { top: topPx, height: alturaPx, backgroundColor: ev.cor + '26', borderLeftColor: ev.cor },
                    ]}
                    onPress={() => onPressEvento(ev.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      numberOfLines={compacto ? 2 : 1}
                      style={[styles.eventoTexto, { color: ev.cor, fontSize: compacto ? 10 : 13 }]}
                    >
                      {ev.paciente_nome}
                      {!compacto ? ` · ${ev.clinica_nome || 'Particular'}` : ''}
                    </Text>
                    {!compacto && (
                      <Text style={[styles.eventoDetalhe, { color: ev.cor }]} numberOfLines={1}>
                        {ev.hora}–{ev.horaFim} · {ev.procedimento || 'Consulta'}
                      </Text>
                    )}
                  </TouchableOpacity>
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
