import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/contexts/auth-context';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';

export default function RedefinirSenhaScreen() {
  const { redefinirSenha, cancelarRecuperacaoSenha } = useAuth();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function confirmar() {
    if (!novaSenha || !confirmarSenha) {
      alertar('Preencha a nova senha nos dois campos.');
      return;
    }
    if (novaSenha.length < 6) {
      alertar('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      alertar('As senhas não são iguais.');
      return;
    }
    setCarregando(true);
    const resultado = await redefinirSenha(novaSenha);
    setCarregando(false);

    if (resultado.error) {
      alertar('Não foi possível redefinir a senha', resultado.error);
    }
  }

  function cancelar() {
    alertar('Cancelar', 'Deseja cancelar a redefinição e voltar para o login?', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim', style: 'destructive', onPress: cancelarRecuperacaoSenha },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.conteudo}>
          <Text style={styles.titulo}>Definir nova senha</Text>
          <Text style={styles.subtitulo}>Escolha uma nova senha para acessar sua conta.</Text>

          <Text style={styles.label}>Nova senha</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.textTertiary}
            secureTextEntry
            value={novaSenha}
            onChangeText={setNovaSenha}
          />

          <Text style={styles.label}>Confirmar nova senha</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.textTertiary}
            secureTextEntry
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
          />

          <TouchableOpacity
            style={[styles.botao, carregando && { opacity: 0.6 }]}
            onPress={confirmar}
            activeOpacity={0.85}
            disabled={carregando}
          >
            <Text style={styles.botaoTexto}>{carregando ? 'Salvando...' : 'Salvar nova senha'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={cancelar} style={styles.linkContainer}>
            <Text style={styles.link}>Cancelar e voltar para o login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  conteudo: { flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xl },
  titulo: { color: theme.colors.text, fontSize: 22, fontFamily: theme.font.bold, textAlign: 'center' },
  subtitulo: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: theme.font.regular,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: theme.spacing.xl,
  },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.medium, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12,
    fontSize: 15, fontFamily: theme.font.regular, color: theme.colors.text, backgroundColor: theme.colors.surface,
  },
  botao: { backgroundColor: theme.colors.primary, padding: 15, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 28 },
  botaoTexto: { color: '#fff', fontFamily: theme.font.medium, fontSize: 15 },
  linkContainer: { marginTop: 18, alignItems: 'center' },
  link: { color: theme.colors.primary, fontFamily: theme.font.medium, fontSize: 13 },
});
