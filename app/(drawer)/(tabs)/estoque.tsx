import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DrawerMenuButton } from '@/components/drawer-menu-button';
import { supabase } from '@/src/lib/supabase';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';

type Produto = {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  estoque_minimo: number;
};

const PRODUTOS_EXEMPLO = [
  { nome: 'Agulhas', quantidade: 150, unidade: 'un', estoque_minimo: 30 },
  { nome: 'Gases', quantidade: 40, unidade: 'pct', estoque_minimo: 15 },
  { nome: 'Mocha', quantidade: 5, unidade: 'un', estoque_minimo: 10 },
];

function estoqueBaixo(p: Produto) {
  return p.quantidade <= p.estoque_minimo;
}

export default function EstoqueScreen() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregado, setCarregado] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('produtos_estoque')
      .select('id, nome, quantidade, unidade, estoque_minimo')
      .order('nome');
    if (error) {
      alertar('Erro ao carregar estoque', error.message);
      return;
    }

    if ((data ?? []).length === 0 && !carregado) {
      const { data: novaLista, error: erroSeed } = await supabase
        .from('produtos_estoque')
        .insert(PRODUTOS_EXEMPLO)
        .select('id, nome, quantidade, unidade, estoque_minimo');
      if (!erroSeed) {
        setProdutos((novaLista ?? []).sort((a, b) => a.nome.localeCompare(b.nome)));
        setCarregado(true);
        return;
      }
    }

    setProdutos(data ?? []);
    setCarregado(true);
  }, [carregado]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const baixos = produtos.filter(estoqueBaixo).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <DrawerMenuButton />
        <Text style={styles.headerTitulo}>Estoque</Text>
      </View>

      {baixos > 0 && (
        <View style={styles.avisoContainer}>
          <Ionicons name="alert-circle" size={16} color={theme.colors.warning} />
          <Text style={styles.avisoTexto}>
            {baixos} {baixos === 1 ? 'produto está' : 'produtos estão'} com estoque baixo
          </Text>
        </View>
      )}

      <FlatList
        data={produtos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: theme.spacing.sm }}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Ionicons name="cube-outline" size={40} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Nenhum produto cadastrado</Text>
            <Text style={styles.vazioDica}>Toque no + para adicionar o primeiro produto</Text>
          </View>
        }
        renderItem={({ item }) => {
          const baixo = estoqueBaixo(item);
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(`/produto?id=${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Text style={styles.detalhe}>
                  {item.quantidade} {item.unidade} em estoque
                </Text>
              </View>
              {baixo && (
                <View style={styles.badge}>
                  <Ionicons name="alert-circle" size={13} color={theme.colors.warning} />
                  <Text style={styles.badgeTexto}>Estoque baixo</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/produto')} activeOpacity={0.85}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  headerTitulo: { color: theme.colors.text, fontSize: 28, fontFamily: theme.font.bold },
  avisoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warningLight,
  },
  avisoTexto: { color: theme.colors.warning, fontSize: 13, fontFamily: theme.font.medium },
  vazioContainer: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 40 },
  vazio: { color: theme.colors.textSecondary, fontSize: 14, fontFamily: theme.font.medium },
  vazioDica: { color: theme.colors.textTertiary, fontSize: 12, fontFamily: theme.font.regular, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
    gap: 10,
  },
  nome: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  detalhe: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.regular, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warningLight,
  },
  badgeTexto: { fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.warning },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
});
