type Botao = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

// O Alert.alert do react-native-web não faz nada (é um stub vazio), então
// nenhuma confirmação ou mensagem de erro aparecia na versão web. Essa versão
// usa window.alert/window.confirm, que cobrem os dois formatos usados no app:
// aviso simples (1 botão/nenhum) e confirmação cancelar-ou-agir (2 botões).
export function alertar(titulo?: string, mensagem?: string, botoes?: Botao[]) {
  const texto = [titulo, mensagem].filter(Boolean).join('\n\n');

  if (!botoes || botoes.length === 0) {
    window.alert(texto);
    return;
  }
  if (botoes.length === 1) {
    window.alert(texto);
    botoes[0].onPress?.();
    return;
  }

  const botaoCancelar = botoes.find((b) => b.style === 'cancel');
  const botaoConfirmar = botoes.find((b) => b !== botaoCancelar) ?? botoes[botoes.length - 1];
  const confirmado = window.confirm(texto);

  if (confirmado) {
    botaoConfirmar?.onPress?.();
  } else {
    botaoCancelar?.onPress?.();
  }
}
