import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { theme } from '@/src/theme';

type Props = {
  visivel: boolean;
  onFechar: () => void;
  onExcluirEste: () => void;
  onExcluirSeguintes: () => void;
  onExcluirTodos: () => void;
};

// window.confirm só suporta OK/Cancelar, então a exclusão de um evento
// recorrente (que precisa de 3 opções, como no Google Agenda) usa um modal
// próprio em vez do `alertar` padrão do app.
export function ExcluirRecorrenciaModal({
  visivel, onFechar, onExcluirEste, onExcluirSeguintes, onExcluirTodos,
}: Props) {
  if (!visivel) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onFechar}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.titulo}>Excluir evento recorrente</Text>

          <TouchableOpacity style={styles.opcao} onPress={onExcluirEste} activeOpacity={0.7}>
            <Text style={styles.opcaoTexto}>Este evento</Text>
          </TouchableOpacity>
          <View style={styles.divisor} />
          <TouchableOpacity style={styles.opcao} onPress={onExcluirSeguintes} activeOpacity={0.7}>
            <Text style={styles.opcaoTexto}>Este e todos os eventos seguintes</Text>
          </TouchableOpacity>
          <View style={styles.divisor} />
          <TouchableOpacity style={styles.opcao} onPress={onExcluirTodos} activeOpacity={0.7}>
            <Text style={styles.opcaoTexto}>Todos os eventos</Text>
          </TouchableOpacity>
          <View style={styles.divisor} />
          <TouchableOpacity style={styles.opcao} onPress={onFechar} activeOpacity={0.7}>
            <Text style={styles.opcaoCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingTop: theme.spacing.md,
    overflow: 'hidden',
  },
  titulo: {
    color: theme.colors.text,
    fontFamily: theme.font.medium,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  divisor: { height: 1, backgroundColor: theme.colors.divider },
  opcao: { paddingVertical: 14, alignItems: 'center', paddingHorizontal: theme.spacing.md },
  opcaoTexto: { color: theme.colors.danger, fontFamily: theme.font.medium, fontSize: 15 },
  opcaoCancelarTexto: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 15 },
});
