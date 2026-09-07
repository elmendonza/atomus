import { useCallback, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';
import { CATEGORIAS_ESTOQUE, sugerirCategoria } from '@/src/utils/categoriasEstoque';

export default function ProdutoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const produtoId = params.id;
  const editando = !!produtoId;

  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [categoriaEscolhidaManualmente, setCategoriaEscolhidaManualmente] = useState(false);
  const [carregado, setCarregado] = useState(!editando);

  useFocusEffect(
    useCallback(() => {
      if (!editando) return;
      (async () => {
        const { data: item, error } = await supabase
          .from('produtos_estoque')
          .select('nome, quantidade, unidade, estoque_minimo, categoria')
          .eq('id', produtoId)
          .single();
        if (error) {
          alertar('Erro ao carregar produto', error.message);
        } else if (item) {
          setNome(item.nome);
          setQuantidade(String(item.quantidade));
          setUnidade(item.unidade);
          setEstoqueMinimo(String(item.estoque_minimo));
          setCategoria(item.categoria);
          setCategoriaEscolhidaManualmente(!!item.categoria);
        }
        setCarregado(true);
      })();
    }, [editando, produtoId])
  );

  function alterarNome(texto: string) {
    setNome(texto);
    if (!categoriaEscolhidaManualmente) {
      setCategoria(sugerirCategoria(texto));
    }
  }

  function escolherCategoria(id: string) {
    setCategoriaEscolhidaManualmente(true);
    setCategoria((atual) => (atual === id ? null : id));
  }

  async function salvar() {
    if (!nome.trim()) {
      alertar('Preencha o nome do produto');
      return;
    }
    if (!categoria) {
      alertar('Escolha uma categoria', 'Selecione em qual categoria esse produto entra no estoque.');
      return;
    }
    const dados = {
      nome: nome.trim(),
      quantidade: Number(quantidade.replace(',', '.')) || 0,
      unidade: unidade.trim() || 'un',
      estoque_minimo: Number(estoqueMinimo.replace(',', '.')) || 0,
      categoria,
    };

    const { error } = editando
      ? await supabase.from('produtos_estoque').update(dados).eq('id', produtoId)
      : await supabase.from('produtos_estoque').insert(dados);

    if (error) {
      alertar('Erro ao salvar produto', error.message);
      return;
    }
    router.back();
  }

  function excluir() {
    alertar('Excluir produto', 'Deseja remover este produto do estoque?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('produtos_estoque').delete().eq('id', produtoId);
          if (error) {
            alertar('Erro ao excluir produto', error.message);
            return;
          }
          router.back();
        },
      },
    ]);
  }

  if (!carregado) {
    return <SafeAreaView style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>{editando ? 'Editar produto' : 'Novo produto'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nome do produto</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Agulhas, Gases, Mocha..."
            placeholderTextColor={theme.colors.textTertiary}
            value={nome}
            onChangeText={alterarNome}
          />

          <Text style={styles.label}>Categoria</Text>
          <View style={styles.categoriasContainer}>
            {CATEGORIAS_ESTOQUE.map((cat) => {
              const selecionada = categoria === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoriaChip, selecionada && styles.categoriaChipSelecionada]}
                  activeOpacity={0.7}
                  onPress={() => escolherCategoria(cat.id)}
                >
                  <Ionicons
                    name={cat.icone}
                    size={16}
                    color={selecionada ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text style={[styles.categoriaChipTexto, selecionada && styles.categoriaChipTextoSelecionada]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.linha}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Quantidade em estoque</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={theme.colors.textTertiary}
                value={quantidade}
                onChangeText={setQuantidade}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 90 }}>
              <Text style={styles.label}>Unidade</Text>
              <TextInput
                style={styles.input}
                placeholder="un"
                placeholderTextColor={theme.colors.textTertiary}
                value={unidade}
                onChangeText={setUnidade}
              />
            </View>
          </View>

          <Text style={styles.label}>Estoque mínimo</Text>
          <TextInput
            style={styles.input}
            placeholder="Avisar quando chegar a esta quantidade"
            placeholderTextColor={theme.colors.textTertiary}
            value={estoqueMinimo}
            onChangeText={setEstoqueMinimo}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.botaoSalvar} onPress={salvar} activeOpacity={0.85}>
            <Text style={styles.botaoTexto}>Salvar produto</Text>
          </TouchableOpacity>

          {editando && (
            <TouchableOpacity style={styles.botaoExcluir} onPress={excluir} activeOpacity={0.85}>
              <Text style={styles.botaoExcluirTexto}>Excluir produto</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  headerTitulo: { color: theme.colors.text, fontSize: 16, fontFamily: theme.font.medium },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.medium, marginBottom: 6, marginTop: 14 },
  categoriasContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoriaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  categoriaChipSelecionada: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  categoriaChipTexto: { fontFamily: theme.font.regular, fontSize: 13, color: theme.colors.textSecondary },
  categoriaChipTextoSelecionada: { color: theme.colors.primary, fontFamily: theme.font.medium },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12,
    fontSize: 15, fontFamily: theme.font.regular, color: theme.colors.text, backgroundColor: theme.colors.surface,
  },
  linha: { flexDirection: 'row', gap: 10 },
  botaoSalvar: { backgroundColor: theme.colors.primary, padding: 15, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 28 },
  botaoTexto: { color: '#fff', fontFamily: theme.font.medium, fontSize: 15 },
  botaoExcluir: { padding: 15, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 12 },
  botaoExcluirTexto: { color: theme.colors.danger, fontFamily: theme.font.medium, fontSize: 15 },
});
