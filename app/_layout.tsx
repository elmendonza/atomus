import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  useFonts,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { theme } from '@/src/theme';
import { AuthProvider, useAuth } from '@/src/contexts/auth-context';
import { LoadingScreen } from '@/components/loading-screen';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(drawer)',
};

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
  },
};

function NavegacaoRaiz() {
  const { session, carregando, modoRecuperacaoSenha } = useAuth();
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });

  const pronto = fontsLoaded && !carregando;

  // A animação de abertura fica pelo menos 1 s na tela, mesmo com o app já carregado; depois faz o zoom e entra no app.
  const [minimoAtingido, setMinimoAtingido] = useState(false);
  const [aberturaTerminou, setAberturaTerminou] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMinimoAtingido(true), 1000);
    return () => clearTimeout(id);
  }, []);
  const terminarAbertura = useCallback(() => setAberturaTerminou(true), []);

  useEffect(() => {
    if (pronto) {
      SplashScreen.hideAsync();
    }
  }, [pronto]);

  const liberado = pronto && minimoAtingido;

  // Estrutura fixa (o app só monta quando está pronto, mas a LoadingScreen nunca é recriada — a animação segue sem reiniciar).
  return (
    <View style={{ flex: 1 }}>
    {pronto && (
    <ThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Protected guard={!session && !modoRecuperacaoSenha}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={modoRecuperacaoSenha}>
          <Stack.Screen name="redefinir-senha" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !modoRecuperacaoSenha}>
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="dia" options={{ presentation: 'modal', title: 'Dia', headerShown: false }} />
          <Stack.Screen name="cliente" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="produto" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="despesa" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="extrato-mensal" options={{ presentation: 'modal', headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
    )}
    {!aberturaTerminou && <LoadingScreen saindo={liberado} aoTerminar={terminarAbertura} />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NavegacaoRaiz />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
