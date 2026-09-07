import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';

if (!LocaleConfig.locales['pt-br']) {
  LocaleConfig.locales['pt-br'] = {
    monthNames: [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ],
    monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
    dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    today: 'Hoje',
  };
}
LocaleConfig.defaultLocale = 'pt-br';

type Props = {
  valor: string;
  aoAlterar: (iso: string) => void;
  textoExibido: string;
};

export function SeletorDataInline({ valor, aoAlterar, textoExibido }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <View>
      <TouchableOpacity style={styles.campo} onPress={() => setAberto((a) => !a)} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={18} color={theme.colors.textSecondary} />
        <Text style={styles.valor}>{textoExibido}</Text>
        <Ionicons
          name={aberto ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.textSecondary}
          style={{ marginLeft: 'auto' }}
        />
      </TouchableOpacity>
      {aberto && (
        <View style={styles.calendarioBox}>
          <Calendar
            current={valor}
            onDayPress={(dia) => {
              aoAlterar(dia.dateString);
              setAberto(false);
            }}
            markedDates={{ [valor]: { selected: true, selectedColor: theme.colors.primary } }}
            firstDay={1}
            theme={{
              backgroundColor: 'transparent',
              calendarBackground: 'transparent',
              dayTextColor: theme.colors.text,
              monthTextColor: theme.colors.text,
              textMonthFontFamily: theme.font.medium,
              textDayFontFamily: theme.font.regular,
              textDayHeaderFontFamily: theme.font.medium,
              textMonthFontWeight: '500',
              arrowColor: theme.colors.primary,
              todayTextColor: theme.colors.primary,
              selectedDayBackgroundColor: theme.colors.primary,
              selectedDayTextColor: '#fff',
              textSectionTitleColor: theme.colors.textSecondary,
            }}
          />
        </View>
      )}
    </View>
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
  calendarioBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: theme.radius.md,
    padding: 8,
    backgroundColor: theme.colors.surface,
  },
});
