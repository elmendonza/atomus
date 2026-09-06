import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

type Props = {
  renderPagina: (offset: -1 | 0 | 1) => React.ReactNode;
  aoTrocarPagina: (direcao: 1 | -1) => void;
};

const LIMIAR_PROPORCAO = 0.28;
const VELOCIDADE_MINIMA = 500;

export function SwipePager({ renderPagina, aoTrocarPagina }: Props) {
  const [largura, setLargura] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (largura > 0) {
      translateX.value = -largura;
    }
  }, [largura, translateX]);

  function trocar(direcao: 1 | -1) {
    aoTrocarPagina(direcao);
  }

  const gesto = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      translateX.value = -largura + e.translationX;
    })
    .onEnd((e) => {
      const limiar = largura * LIMIAR_PROPORCAO;
      const foiParaEsquerda = e.translationX < -limiar || (e.translationX < -40 && e.velocityX < -VELOCIDADE_MINIMA);
      const foiParaDireita = e.translationX > limiar || (e.translationX > 40 && e.velocityX > VELOCIDADE_MINIMA);

      if (foiParaEsquerda) {
        translateX.value = withTiming(-largura * 2, { duration: 220 }, (concluido) => {
          if (concluido) {
            translateX.value = -largura;
            runOnJS(trocar)(1);
          }
        });
      } else if (foiParaDireita) {
        translateX.value = withTiming(0, { duration: 220 }, (concluido) => {
          if (concluido) {
            translateX.value = -largura;
            runOnJS(trocar)(-1);
          }
        });
      } else {
        translateX.value = withSpring(-largura, { damping: 28, stiffness: 300 });
      }
    });

  const estiloAnimado = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.container} onLayout={(e) => setLargura(Math.round(e.nativeEvent.layout.width))}>
      {largura > 0 && (
        <GestureDetector gesture={gesto}>
          <Animated.View style={[styles.trilho, { width: largura * 3 }, estiloAnimado]}>
            <View style={{ width: largura }}>{renderPagina(-1)}</View>
            <View style={{ width: largura }}>{renderPagina(0)}</View>
            <View style={{ width: largura }}>{renderPagina(1)}</View>
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  trilho: { flexDirection: 'row', position: 'absolute', top: 0, bottom: 0, left: 0 },
});
