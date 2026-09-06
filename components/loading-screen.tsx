import { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { theme } from '@/src/theme';

const NUM_PONTOS = 8;
const RAIO = 22;
const TAMANHO_PONTO = 7;

export function LoadingScreen() {
  const rotacao = useSharedValue(0);

  useEffect(() => {
    rotacao.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1);
  }, [rotacao]);

  const estiloAnimado = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotacao.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logoImagem} resizeMode="contain" />
      </View>
      <Text style={styles.titulo}>Atomus</Text>

      <Animated.View style={[styles.anel, estiloAnimado]}>
        {Array.from({ length: NUM_PONTOS }).map((_, i) => {
          const angulo = (i / NUM_PONTOS) * 2 * Math.PI;
          const x = RAIO * Math.cos(angulo);
          const y = RAIO * Math.sin(angulo);
          const opacidade = 0.15 + (i / NUM_PONTOS) * 0.85;
          return (
            <View
              key={i}
              style={[styles.ponto, { opacity: opacidade, transform: [{ translateX: x }, { translateY: y }] }]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImagem: { width: 50, height: 50 },
  titulo: { fontSize: 22, fontFamily: theme.font.bold, color: theme.colors.text },
  anel: {
    width: RAIO * 2,
    height: RAIO * 2,
    marginTop: 8,
  },
  ponto: {
    position: 'absolute',
    top: RAIO - TAMANHO_PONTO / 2,
    left: RAIO - TAMANHO_PONTO / 2,
    width: TAMANHO_PONTO,
    height: TAMANHO_PONTO,
    borderRadius: TAMANHO_PONTO / 2,
    backgroundColor: theme.colors.primary,
  },
});
