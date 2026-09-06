import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DrawerMenuButton } from '@/components/drawer-menu-button';
import { supabase } from '@/src/lib/supabase';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';

type Paciente = {
  id: string;
  nome: string;
  tutor: string | null;
  forma_pagamento_preferida: string | null;
  dias_preferidos: string | null;
  horario_preferido: string | null;
};

function cadastroCompleto(p: Paciente) {
  return !!(p.forma_pagamento_preferida || p.dias_preferidos || p.horario_preferido);
}

export default function ClientesScreen() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('pacientes')
      .select('id, nome, tutor, forma_pagamento_preferida, dias_preferidos, horario_preferido')
      .order('nome');
    if (error) {
      alertar('Erro ao carregar clientes', error.message);
      return;
    }
    setPacientes(data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const filtrados = pacientes.filter((p) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return p.nome.toLowerCase().includes(termo) || (p.tutor || '').toLowerCase().includes(termo);
  });

  const pendentes = filtrados.filter((p) => !cadastroCompleto(p)).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <DrawerMenuButton />
        <Text style={styles.headerTitulo}>Clientes</Text>
      </View>

      <View style={styles.buscaContainer}>
        <Ionicons name="search" size={18} color={theme.colors.textTertiary} />
        <TextInput
          style={styles.buscaInput}
          placeholder="Buscar por pet ou tutor"
          placeholderTextColor={theme.colors.textTertiary}
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      {pendentes > 0 && (
        <Text style={styles.avisoPendentes}>
          {pendentes} {pendentes === 1 ? 'cliente aguardando' : 'clientes aguardando'} cadastro completo
        </Text>
      )}

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: theme.spacing.sm }}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Ionicons name="people-outline" size={36} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>Nenhum cliente encontrado</Text>
            <Text style={styles.vazioDica}>Clientes aparecem aqui automaticamente ao agendar um atendimento</Text>
          </View>
        }
        renderItem={({ item }) => {
          const completo = cadastroCompleto(item);
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(`/cliente?id=${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Text style={styles.detalhe}>Tutor: {item.tutor || 'Não informado'}</Text>
                {completo && (
                  <Text style={styles.detalhe}>
                    {item.forma_pagamento_preferida || 'Pagamento não informado'}
                    {item.dias_preferidos ? ` · ${item.dias_preferidos}` : ''}
                    {item.horario_preferido ? ` · ${item.horario_preferido}` : ''}
                  </Text>
                )}
              </View>
              <View style={[styles.badge, completo ? styles.badgeCompleto : styles.badgePendente]}>
                <Text style={[styles.badgeTexto, completo ? styles.badgeTextoCompleto : styles.badgeTextoPendente]}>
                  {completo ? 'Completo' : 'Pendente'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
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
  buscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  buscaInput: { flex: 1, fontSize: 14, fontFamily: theme.font.regular, color: theme.colors.text },
  avisoPendentes: {
    color: theme.colors.warning,
    fontSize: 12,
    fontFamily: theme.font.medium,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
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
  detalhe: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.regular, marginTop: 2 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: theme.radius.full },
  badgeCompleto: { backgroundColor: theme.colors.successLight },
  badgePendente: { backgroundColor: theme.colors.warningLight },
  badgeTexto: { fontSize: 11, fontFamily: theme.font.medium },
  badgeTextoCompleto: { color: theme.colors.success },
  badgeTextoPendente: { color: theme.colors.warning },
});
