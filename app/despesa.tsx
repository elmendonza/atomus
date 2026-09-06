import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CampoDataHora } from '@/components/campo-data-hora';
import { supabase } from '@/src/lib/supabase';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';
import { hoje, isoParaDate, dateParaIso, formatarDataBR } from '@/src/utils/tempo';

const CATEGORIAS = [
  { valor: 'insumo', label: 'Insumos' },
  { valor: 'investimento', label: 'Investimento em materiais' },
  { valor: 'curso', label: 'Cursos e especializações' },
  { valor: 'operacional', label: 'Custo operacional' },
  { valor: 'outro', label: 'Outro' },
] as const;

const FORMAS_PAGAMENTO = ['Pix', 'Cartão', 'Dinheiro', 'Boleto'];

type SugestaoEstoque = { id: string; nome: string; unidade: string };

export default function DespesaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const despesaId = params.id;
  const editando = !!despesaId;

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]['valor']>('insumo');
  const [quantidade, setQuantidade] = useState('1');
  const [valorUnitario, setValorUnitario] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [dataCompra, setDataCompra] = useState(hoje());
  const [carregado, setCarregado] = useState(!editando);

  // Valores originais (antes de qualquer edição), usados para desfazer a
  // contribuição antiga no estoque e aplicar só a diferença.
  const [nomeOriginal, setNomeOriginal] = useState('');
  const [categoriaOriginal, setCategoriaOriginal] = useState('');
  const [quantidadeOriginal, setQuantidadeOriginal] = useState(0);

  const [sugestoesEstoque, setSugestoesEstoque] = useState<SugestaoEstoque[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!editando) return;
      (async () => {
        const { data: item, error } = await supabase
          .from('despesas')
          .select('nome, categoria, quantidade, valor_unitario, forma_pagamento, data_compra')
          .eq('id', despesaId)
          .single();
        if (error) {
          alertar('Erro ao carregar despesa', error.message);
        } else if (item) {
          setNome(item.nome);
          setCategoria(item.categoria);
          setQuantidade(String(item.quantidade));
          setValorUnitario(String(item.valor_unitario));
          setFormaPagamento(item.forma_pagamento || 'Pix');
          setDataCompra(item.data_compra);
          setNomeOriginal(item.nome);
          setCategoriaOriginal(item.categoria);
          setQuantidadeOriginal(Number(item.quantidade) || 0);
        }
        setCarregado(true);
      })();
    }, [editando, despesaId])
  );

  useEffect(() => {
    if (categoria !== 'insumo') {
      setSugestoesEstoque([]);
      return;
    }
    const termo = nome.trim();
    if (termo.length < 2) {
      setSugestoesEstoque([]);
      return;
    }
    let cancelado = false;
    (async () => {
      const { data } = await supabase
        .from('produtos_estoque')
        .select('id, nome, unidade')
        .ilike('nome', `%${termo}%`)
        .order('nome')
        .limit(5);
      if (!cancelado) {
        setSugestoesEstoque((data ?? []).filter((p) => p.nome.toLowerCase() !== termo.toLowerCase()));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [nome, categoria]);

  // Ajusta (soma ou subtrai) a quantidade de um produto no estoque. Se ainda
  // não existir e o ajuste for positivo, cria o produto. Nunca deixa a
  // quantidade final ficar negativa.
  async function ajustarEstoque(nomeProduto: string, delta: number) {
    const nomeTrim = nomeProduto.trim();
    if (!nomeTrim || delta === 0) return;

    const { data: existentes } = await supabase
      .from('produtos_estoque')
      .select('id, quantidade')
      .ilike('nome', nomeTrim)
      .limit(1);

    if (existentes && existentes.length > 0) {
      const novaQuantidade = Math.max(0, Number(existentes[0].quantidade) + delta);
      await supabase.from('produtos_estoque').update({ quantidade: novaQuantidade }).eq('id', existentes[0].id);
    } else if (delta > 0) {
      await supabase.from('produtos_estoque').insert({ nome: nomeTrim, quantidade: delta, unidade: 'un', estoque_minimo: 0 });
    }
  }

  async function sincronizarEstoque(nomeNovo: string, categoriaNova: string, quantidadeNova: number) {
    if (categoriaOriginal === 'insumo' && nomeOriginal) {
      await ajustarEstoque(nomeOriginal, -quantidadeOriginal);
    }
    if (categoriaNova === 'insumo') {
      await ajustarEstoque(nomeNovo, quantidadeNova);
    }
  }

  async function salvar() {
    if (!nome.trim()) {
      alertar('Preencha o nome da despesa');
      return;
    }
    const qtd = Number(quantidade.replace(',', '.')) || 0;
    const unitario = Number(valorUnitario.replace(',', '.')) || 0;
    const dados = {
      nome: nome.trim(),
      categoria,
      quantidade: qtd,
      valor_unitario: unitario,
      valor_total: qtd * unitario,
      forma_pagamento: formaPagamento.trim(),
      data_compra: dataCompra,
    };

    const { error } = editando
      ? await supabase.from('despesas').update(dados).eq('id', despesaId)
      : await supabase.from('despesas').insert(dados);

    if (error) {
      alertar('Erro ao salvar despesa', error.message);
      return;
    }

    await sincronizarEstoque(nome, categoria, qtd);

    router.back();
  }

  function excluir() {
    alertar('Excluir despesa', 'Deseja remover este lançamento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('despesas').delete().eq('id', despesaId);
          if (error) {
            alertar('Erro ao excluir despesa', error.message);
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
        <Text style={styles.headerTitulo}>{editando ? 'Editar despesa' : 'Nova despesa'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Agulhas, Gases, Mocha, Curso de acupuntura..."
            placeholderTextColor={theme.colors.textTertiary}
            value={nome}
            onChangeText={setNome}
          />
          {sugestoesEstoque.length > 0 && (
            <View style={styles.sugestoesContainer}>
              {sugestoesEstoque.map((item) => (
                <TouchableOpacity key={item.id} style={styles.sugestaoItem} onPress={() => setNome(item.nome)}>
                  <Ionicons name="cube-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.sugestaoNome}>{item.nome}</Text>
                  <Text style={styles.sugestaoDetalhe}>já no estoque · {item.unidade}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Categoria</Text>
          <View style={styles.chipsContainer}>
            {CATEGORIAS.map((c) => (
              <TouchableOpacity
                key={c.valor}
                style={[styles.chip, categoria === c.valor && styles.chipAtivo]}
                onPress={() => setCategoria(c.valor)}
              >
                <Text style={[styles.chipTexto, categoria === c.valor && styles.chipTextoAtivo]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {categoria === 'insumo' && (
            <Text style={styles.dica}>
              💡 Ao salvar, {quantidade || '0'} unidade(s) de &quot;{nome || '...'}&quot; será(ão) somada(s) automaticamente ao Estoque.
            </Text>
          )}

          <View style={styles.linha}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Quantidade</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                placeholderTextColor={theme.colors.textTertiary}
                value={quantidade}
                onChangeText={setQuantidade}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Custo por unidade (R$)</Text>
              <TextInput
                style={styles.input}
                placeholder="0,00"
                placeholderTextColor={theme.colors.textTertiary}
                value={valorUnitario}
                onChangeText={setValorUnitario}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.label}>Data da compra</Text>
          <CampoDataHora
            valor={isoParaDate(dataCompra)}
            modo="date"
            aoAlterar={(d) => setDataCompra(dateParaIso(d))}
            textoExibido={formatarDataBR(dataCompra)}
            icone="calendar-outline"
          />

          <Text style={styles.label}>Forma de pagamento</Text>
          <View style={styles.chipsContainer}>
            {FORMAS_PAGAMENTO.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, formaPagamento === f && styles.chipAtivo]}
                onPress={() => setFormaPagamento(f)}
              >
                <Text style={[styles.chipTexto, formaPagamento === f && styles.chipTextoAtivo]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.botaoSalvar} onPress={salvar} activeOpacity={0.85}>
            <Text style={styles.botaoTexto}>Salvar despesa</Text>
          </TouchableOpacity>

          {editando && (
            <TouchableOpacity style={styles.botaoExcluir} onPress={excluir} activeOpacity={0.85}>
              <Text style={styles.botaoExcluirTexto}>Excluir despesa</Text>
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
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12,
    fontSize: 15, fontFamily: theme.font.regular, color: theme.colors.text, backgroundColor: theme.colors.surface,
  },
  sugestoesContainer: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  sugestaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    backgroundColor: theme.colors.surfaceVariant,
  },
  sugestaoNome: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 14, flex: 1 },
  sugestaoDetalhe: { color: theme.colors.textSecondary, fontFamily: theme.font.regular, fontSize: 11 },
  dica: { color: theme.colors.primary, fontFamily: theme.font.regular, fontSize: 12, marginTop: 8 },
  linha: { flexDirection: 'row', gap: 10 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.full,
    paddingVertical: 8, paddingHorizontal: 14, backgroundColor: theme.colors.surface,
  },
  chipAtivo: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  chipTexto: { color: theme.colors.textSecondary, fontFamily: theme.font.medium, fontSize: 13 },
  chipTextoAtivo: { color: theme.colors.primary },
  botaoSalvar: { backgroundColor: theme.colors.primary, padding: 15, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 28 },
  botaoTexto: { color: '#fff', fontFamily: theme.font.medium, fontSize: 15 },
  botaoExcluir: { padding: 15, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 12 },
  botaoExcluirTexto: { color: theme.colors.danger, fontFamily: theme.font.medium, fontSize: 15 },
});
