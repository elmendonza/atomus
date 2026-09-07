import { useCallback, useMemo, useState } from 'react';
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

const REGEX_DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(REGEX_DIACRITICOS, '').toLowerCase().trim();
}

type Categoria = {
  id: string;
  label: string;
  icone: keyof typeof Ionicons.glyphMap;
  pertence: (nomeNormalizado: string) => boolean;
};

const CATEGORIAS: Categoria[] = [
  {
    id: 'geral',
    label: 'Geral',
    icone: 'grid-outline',
    pertence: () => true,
  },
  {
    id: 'agulhas',
    label: 'Agulhas',
    icone: 'medical-outline',
    pertence: (n) => n.startsWith('agulha'),
  },
  {
    id: 'descartaveis',
    label: 'Descartáveis',
    icone: 'bandage-outline',
    pertence: (n) =>
      n.startsWith('algodao') || n.startsWith('gaze') || n.startsWith('gases') || n.startsWith('luvas') || n.startsWith('sacos'),
  },
  {
    id: 'moxa',
    label: 'Moxa',
    icone: 'flame-outline',
    pertence: (n) => n.startsWith('moxa') || n === 'mocha',
  },
  {
    id: 'pereciveis',
    label: 'Perecíveis',
    icone: 'flask-outline',
    pertence: (n) =>
      n.startsWith('solucao') ||
      n.startsWith('nutrisco') ||
      n.startsWith('nutricos') ||
      n.startsWith('alcool') ||
      n.startsWith('agua') ||
      n.startsWith('clorexidina') ||
      n.startsWith('ringer lactato') ||
      n.startsWith('ringer'),
  },
  {
    id: 'seringa',
    label: 'Seringa',
    icone: 'water-outline',
    pertence: (n) => n.startsWith('seringa'),
  },
  {
    id: 'sondas',
    label: 'Sondas',
    icone: 'git-commit-outline',
    pertence: (n) => n.includes('sonda') || n.startsWith('scalp'),
  },
];

function estoqueBaixo(p: Produto) {
  return p.quantidade <= p.estoque_minimo;
}

export default function EstoqueScreen() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState('geral');

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

  const contagemPorCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const categoria of CATEGORIAS) {
      mapa[categoria.id] = produtos.filter((p) => categoria.pertence(normalizar(p.nome))).length;
    }
    return mapa;
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    const categoria = CATEGORIAS.find((c) => c.id === categoriaAtiva) ?? CATEGORIAS[0];
    return produtos.filter((p) => categoria.pertence(normalizar(p.nome)));
  }, [produtos, categoriaAtiva]);

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

      <View style={styles.categoriasGrid}>
        {CATEGORIAS.map((categoria) => {
          const ativa = categoria.id === categoriaAtiva;
          return (
            <TouchableOpacity
              key={categoria.id}
              style={[styles.categoriaCard, ativa && styles.categoriaCardAtiva]}
              activeOpacity={0.7}
              onPress={() => setCategoriaAtiva(categoria.id)}
            >
              <Ionicons
                name={categoria.icone}
                size={22}
                color={ativa ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={[styles.categoriaLabel, ativa && styles.categoriaLabelAtiva]}>{categoria.label}</Text>
              <Text style={styles.categoriaContagem}>{contagemPorCategoria[categoria.id] ?? 0}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={produtosFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: theme.spacing.sm }}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Ionicons name="cube-outline" size={40} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Nenhum produto nessa categoria</Text>
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
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  headerTitulo: { fontFamily: theme.font.bold, fontSize: 20, color: theme.colors.text },
  avisoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.radius.sm,
  },
  avisoTexto: { fontFamily: theme.font.medium, fontSize: 13, color: theme.colors.warning },
  categoriasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  categoriaCard: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: 2,
  },
  categoriaCardAtiva: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  categoriaLabel: {
    fontFamily: theme.font.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  categoriaLabelAtiva: { color: theme.colors.primary },
  categoriaContagem: {
    fontFamily: theme.font.regular,
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
  vazioContainer: { alignItems: 'center', paddingTop: theme.spacing.xl, gap: theme.spacing.xs },
  vazio: { fontFamily: theme.font.medium, fontSize: 15, color: theme.colors.textSecondary },
  vazioDica: { fontFamily: theme.font.regular, fontSize: 13, color: theme.colors.textTertiary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  nome: { fontFamily: theme.font.medium, fontSize: 15, color: theme.colors.text },
  detalhe: { fontFamily: theme.font.regular, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warningLight,
  },
  badgeTexto: { fontFamily: theme.font.medium, fontSize: 11, color: theme.colors.warning },
  fab: {
    position: 'absolute',
    right: theme.spacing.md,
    bottom: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.25)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
});
