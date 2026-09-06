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
import { useEffect } from 'react';
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

  useEffect(() => {
    if (pronto) {
      SplashScreen.hideAsync();
    }
  }, [pronto]);

  if (!pronto) {
    return <LoadingScreen />;
  }

  return (
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
