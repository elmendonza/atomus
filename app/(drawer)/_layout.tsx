import { Drawer } from 'expo-router/drawer';
import { CustomDrawerContent } from '@/components/drawer-content';
import { theme } from '@/src/theme';

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: theme.colors.surface, width: 280 },
        overlayColor: 'rgba(0,0,0,0.3)',
      }}>
      <Drawer.Screen name="(tabs)" options={{ title: 'Agenda' }} />
      <Drawer.Screen name="clinicas" options={{ title: 'Clínicas' }} />
      <Drawer.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="clientes" options={{ title: 'Clientes' }} />
      <Drawer.Screen name="pacotes" options={{ title: 'Pacotes' }} />
      <Drawer.Screen name="pendentes" options={{ title: 'Pendentes' }} />
    </Drawer>
  );
}
