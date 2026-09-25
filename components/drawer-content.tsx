import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/auth-context';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';

const ITENS = [
  { route: '(tabs)', label: 'Agenda', icon: 'calendar-outline' as const },
  { route: 'clinicas', label: 'Clínicas', icon: 'medical-outline' as const },
  { route: 'dashboard', label: 'Dashboard', icon: 'stats-chart-outline' as const },
  { route: 'clientes', label: 'Clientes', icon: 'people-outline' as const },
  { route: 'pacotes', label: 'Pacotes', icon: 'albums-outline' as const },
  { route: 'pendentes', label: 'Pendentes', icon: 'wallet-outline' as const },
];

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const rotaAtiva = props.state.routeNames[props.state.index];
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const nome = (user?.user_metadata as any)?.nome as string | undefined;

  function confirmarSaida() {
    alertar('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
        <Text style={styles.saudacao}>Olá, {nome || 'visitante'}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.itens}>
        {ITENS.map((item) => {
          const ativo = rotaAtiva === item.route;
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.item, ativo && styles.itemAtivo]}
              onPress={() => props.navigation.navigate(item.route)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={22} color={ativo ? theme.colors.primary : theme.colors.textSecondary} />
              <Text style={[styles.itemTexto, ativo && styles.itemTextoAtivo]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.item} onPress={confirmarSaida} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={22} color={theme.colors.danger} />
        <Text style={[styles.itemTexto, { color: theme.colors.danger }]}>Sair</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 0, flexGrow: 1 },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  saudacao: { fontSize: 18, fontFamily: theme.font.bold, color: theme.colors.text },
  divider: { height: 1, backgroundColor: theme.colors.divider, marginBottom: theme.spacing.sm },
  itens: { marginTop: theme.spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    marginHorizontal: theme.spacing.sm,
    marginBottom: 2,
    borderRadius: theme.radius.full,
  },
  itemAtivo: { backgroundColor: theme.colors.primaryLight },
  itemTexto: { fontSize: 15, fontFamily: theme.font.medium, color: theme.colors.textSecondary },
  itemTextoAtivo: { color: theme.colors.primary },
});
