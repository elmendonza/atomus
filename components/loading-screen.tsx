import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { theme } from '@/src/theme';
import { AtomusOrbitas } from '@/components/atomus-orbitas';

// Tela de carregamento: só o logo animado. Quando `saindo` vira true, faz um zoom até o vazio no centro do logo e
// some (revelando o app por baixo); ao terminar chama `aoTerminar`.
const DURACAO_ZOOM = 900;

export function LoadingScreen({ saindo = false, aoTerminar }: { saindo?: boolean; aoTerminar?: () => void }) {
  const escala = useSharedValue(1);
  const opacidade = useSharedValue(1);

  useEffect(() => {
    if (!saindo) return;
    escala.value = withTiming(16, { duration: DURACAO_ZOOM, easing: Easing.in(Easing.cubic) });
    opacidade.value = withDelay(
      DURACAO_ZOOM * 0.55,
      withTiming(0, { duration: DURACAO_ZOOM * 0.45 }, (fim) => {
        if (fim && aoTerminar) runOnJS(aoTerminar)();
      })
    );
  }, [saindo, escala, opacidade, aoTerminar]);

  const estiloContainer = useAnimatedStyle(() => ({ opacity: opacidade.value }));
  const estiloLogo = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Animated.View style={[styles.container, estiloContainer]} pointerEvents={saindo ? 'none' : 'auto'}>
      <Animated.View style={estiloLogo}>
        <AtomusOrbitas />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
