import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/contexts/auth-context';
import { theme } from '@/src/theme';
import { alertar } from '@/src/utils/alerta';

export default function LoginScreen() {
  const { signIn, signUp, enviarRecuperacaoSenha } = useAuth();
  const [modoCadastro, setModoCadastro] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);

  async function confirmar() {
    if (!email.trim() || !senha || (modoCadastro && !nome.trim())) {
      alertar(modoCadastro ? 'Preencha nome, e-mail e senha.' : 'Preencha e-mail e senha.');
      return;
    }
    setCarregando(true);
    const resultado = modoCadastro
      ? await signUp(email.trim(), senha, nome.trim())
      : await signIn(email.trim(), senha);
    setCarregando(false);

    if (resultado.error) {
      alertar(modoCadastro ? 'Não foi possível criar a conta' : 'Não foi possível entrar', resultado.error);
    }
  }

  function esqueciSenha() {
    if (!email.trim()) {
      alertar('Digite seu e-mail no campo acima primeiro, depois toque em "Esqueci minha senha".');
      return;
    }
    alertar(
      'Recuperar senha',
      `Vamos enviar um link de recuperação para ${email.trim()}. Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            setEnviandoRecuperacao(true);
            const resultado = await enviarRecuperacaoSenha(email.trim());
            setEnviandoRecuperacao(false);
            if (resultado.error) {
              alertar('Não foi possível enviar o e-mail', resultado.error);
            } else {
              alertar('E-mail enviado', 'Confira sua caixa de entrada e siga o link para criar uma nova senha.');
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.conteudo}>
          <View style={styles.logoCircle}>
            <Image source={require('@/assets/images/icon.png')} style={styles.logoImagem} resizeMode="contain" />
          </View>
          <Text style={styles.titulo}>Atomus</Text>
          <Text style={styles.subtitulo}>
            {modoCadastro ? 'Crie sua conta para começar' : 'Entre para acessar sua agenda'}
          </Text>

          {modoCadastro && (
            <>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                placeholder="Como podemos te chamar?"
                placeholderTextColor={theme.colors.textTertiary}
                autoCapitalize="words"
                value={nome}
                onChangeText={setNome}
              />
            </>
          )}

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.textTertiary}
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />

          {!modoCadastro && (
            <TouchableOpacity onPress={esqueciSenha} style={styles.linkEsqueciContainer} disabled={enviandoRecuperacao}>
              <Text style={styles.linkEsqueci}>
                {enviandoRecuperacao ? 'Enviando...' : 'Esqueci minha senha'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.botao, carregando && { opacity: 0.6 }]}
            onPress={confirmar}
            activeOpacity={0.85}
            disabled={carregando}
          >
            <Text style={styles.botaoTexto}>
              {carregando ? 'Aguarde...' : modoCadastro ? 'Criar conta' : 'Entrar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setModoCadastro(!modoCadastro)} style={styles.linkContainer}>
            <Text style={styles.link}>
              {modoCadastro ? 'Já tem conta? Entrar' : 'Não tem conta? Criar agora'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  conteudo: { flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xl },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  logoImagem: { width: 44, height: 44 },
  titulo: { color: theme.colors.text, fontSize: 24, fontFamily: theme.font.bold, textAlign: 'center' },
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
  linkEsqueciContainer: { marginTop: 14, alignItems: 'flex-end' },
  linkEsqueci: { color: theme.colors.textSecondary, fontFamily: theme.font.medium, fontSize: 13 },
});
