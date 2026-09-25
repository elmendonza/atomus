import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming, SharedValue } from 'react-native-reanimated';
import { theme } from '@/src/theme';

// Tela de carregamento: o logo do Atomus (4 órbitas) com as 6 bolinhas girando ao longo delas, em loop.
const TAM = 260;
const C = TAM / 2;
const RX = 105;
const RY = 37;
const COR = '#1C1C1E';
const CicloS = 60; // todos os períodos abaixo dividem 60 s, então o loop não "pula"

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ORBITAS = [0, 90, 45, 135];
// rot = ângulo da órbita | periodo = segundos por volta | fase = posição inicial (0..1)
const BOLINHAS = [
  { rot: 0, periodo: 4, fase: 0.25 },
  { rot: 90, periodo: 5, fase: 0.6 },
  { rot: 45, periodo: 6, fase: 0.1 },
  { rot: 45, periodo: 6, fase: 0.6 },
  { rot: 135, periodo: 5, fase: 0.35 },
  { rot: 135, periodo: 5, fase: 0.85 },
];

function Bolinha({ t, rot, periodo, fase }: { t: SharedValue<number>; rot: number; periodo: number; fase: number }) {
  const r = (rot * Math.PI) / 180;
  const props = useAnimatedProps(() => {
    const a = 2 * Math.PI * ((t.value / periodo + fase) % 1);
    const x = RX * Math.cos(a);
    const y = RY * Math.sin(a);
    return { cx: C + x * Math.cos(r) - y * Math.sin(r), cy: C + x * Math.sin(r) + y * Math.cos(r) };
  });
  return <AnimatedCircle r={6.5} fill={COR} animatedProps={props} />;
}

export function LoadingScreen() {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(CicloS, { duration: CicloS * 1000, easing: Easing.linear }), -1);
  }, [t]);

  return (
    <View style={styles.container}>
      <Svg width={TAM} height={TAM} viewBox={`0 0 ${TAM} ${TAM}`}>
        {ORBITAS.map((rot) => (
          <G key={rot} rotation={rot} originX={C} originY={C}>
            <Ellipse cx={C} cy={C} rx={RX} ry={RY} fill="none" stroke={COR} strokeWidth={4} />
          </G>
        ))}
        {BOLINHAS.map((b, i) => (
          <Bolinha key={i} t={t} rot={b.rot} periodo={b.periodo} fase={b.fase} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
});
