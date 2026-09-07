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

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = ['00', '15', '30', '45'];

function paraValorInputData(valor: Date) {
  const ano = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function CampoDataHora({ valor, modo, aoAlterar, textoExibido, icone }: Props) {
  if (modo === 'time') {
    const horaAtual = String(valor.getHours()).padStart(2, '0');
    const minutoAtual = String(valor.getMinutes()).padStart(2, '0');
    const minutoReconhecido = MINUTOS.includes(minutoAtual);

    function mudarHora(evento: React.ChangeEvent<HTMLSelectElement>) {
      const novaData = new Date(valor);
      novaData.setHours(Number(evento.target.value), novaData.getMinutes(), 0, 0);
      aoAlterar(novaData);
    }

    function mudarMinuto(evento: React.ChangeEvent<HTMLSelectElement>) {
      const novaData = new Date(valor);
      novaData.setHours(novaData.getHours(), Number(evento.target.value), 0, 0);
      aoAlterar(novaData);
    }

    return (
      <View style={styles.campo}>
        <Ionicons name={icone} size={18} color={theme.colors.textSecondary} />
        <select value={horaAtual} onChange={mudarHora} style={estiloSelect}>
          {HORAS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <Text style={styles.separador}>:</Text>
        <select value={minutoReconhecido ? minutoAtual : ''} onChange={mudarMinuto} style={estiloSelect}>
          {!minutoReconhecido && (
            <option value="" disabled>
              {minutoAtual}
            </option>
          )}
          {MINUTOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </View>
    );
  }

  function aoMudarData(evento: React.ChangeEvent<HTMLInputElement>) {
    const texto = evento.target.value;
    if (!texto) return;
    const novaData = new Date(valor);
    const [ano, mes, dia] = texto.split('-').map(Number);
    novaData.setFullYear(ano, mes - 1, dia);
    aoAlterar(novaData);
  }

  return (
    <View style={styles.campo}>
      <Ionicons name={icone} size={18} color={theme.colors.textSecondary} />
      <Text style={styles.valor}>{textoExibido}</Text>
      <input type="date" value={paraValorInputData(valor)} onChange={aoMudarData} style={estiloInputInvisivel} />
    </View>
  );
}

const estiloSelect: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 15,
  fontFamily: theme.font.regular,
  color: theme.colors.text,
  cursor: 'pointer',
  padding: 0,
};

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
  separador: { fontSize: 15, fontFamily: theme.font.regular, color: theme.colors.text },
});
