import { useState } from 'react';
import { Platform, View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';

type Props = {
  valor: Date;
  modo: 'date' | 'time';
  aoAlterar: (data: Date) => void;
  textoExibido: string;
  icone: React.ComponentProps<typeof Ionicons>['name'];
};

export function CampoDataHora({ valor, modo, aoAlterar, textoExibido, icone }: Props) {
  const [mostrarIOS, setMostrarIOS] = useState(false);

  function abrir() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: valor,
        mode: modo,
        is24Hour: true,
        onChange: (event, dataSelecionada) => {
          if (event.type === 'set' && dataSelecionada) aoAlterar(dataSelecionada);
        },
      });
    } else if (Platform.OS === 'ios') {
      setMostrarIOS(true);
    }
  }

  return (
    <>
      <TouchableOpacity style={styles.campo} onPress={abrir} activeOpacity={0.7} disabled={Platform.OS === 'web'}>
        <Ionicons name={icone} size={18} color={theme.colors.textSecondary} />
        <Text style={styles.valor}>{textoExibido}</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <Modal visible={mostrarIOS} transparent animationType="slide" onRequestClose={() => setMostrarIOS(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMostrarIOS(false)}>
            <View style={styles.folha} onStartShouldSetResponder={() => true}>
              <View style={styles.folhaHeader}>
                <TouchableOpacity onPress={() => setMostrarIOS(false)} hitSlop={8}>
                  <Text style={styles.folhaConcluir}>Concluir</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={valor}
                mode={modo}
                display="spinner"
                is24Hour
                locale="pt-BR"
                themeVariant="light"
                textColor={theme.colors.text}
                onChange={(_event, dataSelecionada) => {
                  if (dataSelecionada) aoAlterar(dataSelecionada);
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

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
  },
  valor: { fontSize: 15, fontFamily: theme.font.regular, color: theme.colors.text },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  folha: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingBottom: 20,
  },
  folhaHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  folhaConcluir: { color: theme.colors.primary, fontFamily: theme.font.medium, fontSize: 15 },
});
