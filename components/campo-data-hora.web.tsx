import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';

type Props = {
  valor: Date;
  modo: 'date' | 'time';
  aoAlterar: (data: Date) => void;
  textoExibido: string;
  icone: React.ComponentProps<typeof Ionicons>['name'];
};

function paraValorInput(valor: Date, modo: 'date' | 'time') {
  if (modo === 'time') {
    return `${String(valor.getHours()).padStart(2, '0')}:${String(valor.getMinutes()).padStart(2, '0')}`;
  }
  const ano = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function CampoDataHora({ valor, modo, aoAlterar, textoExibido, icone }: Props) {
  function aoMudar(evento: React.ChangeEvent<HTMLInputElement>) {
    const texto = evento.target.value;
    if (!texto) return;
    const novaData = new Date(valor);
    if (modo === 'time') {
      const [h, m] = texto.split(':').map(Number);
      novaData.setHours(h, m, 0, 0);
    } else {
      const [ano, mes, dia] = texto.split('-').map(Number);
      novaData.setFullYear(ano, mes - 1, dia);
    }
    aoAlterar(novaData);
  }

  return (
    <View style={styles.campo}>
      <Ionicons name={icone} size={18} color={theme.colors.textSecondary} />
      <Text style={styles.valor}>{textoExibido}</Text>
      <input
        type={modo}
        value={paraValorInput(valor, modo)}
        onChange={aoMudar}
        style={estiloInputInvisivel}
      />
    </View>
  );
}

const estiloInputInvisivel: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  margin: 0,
};

const styles = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    backgroundColor: theme.colors.surface,
    position: 'relative',
    overflow: 'hidden',
  },
  valor: { fontSize: 15, fontFamily: theme.font.regular, color: theme.colors.text },
});
