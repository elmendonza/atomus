import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { theme } from '@/src/theme';

// Na web, travar uma altura fixa vinha cortando o texto (o conteúdo real de
// ícone + rótulo às vezes precisa de um pouco mais de espaço do que o número
// escolhido). Sem "height", a barra cresce sozinha para caber o conteúdo, e só
// controlamos a folga com padding.
const ESTILO_TAB_BAR_WEB =
  Platform.OS === 'web'
    ? ({ paddingBottom: 10, paddingTop: 8 } as any)
    : null;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.divider,
          borderTopWidth: 1,
          ...ESTILO_TAB_BAR_WEB,
        },
        tabBarLabelStyle: {
          fontFamily: theme.font.medium,
          fontSize: 12,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          title: 'Financeiro',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="dollarsign.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="estoque"
        options={{
          title: 'Estoque',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="shippingbox.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
