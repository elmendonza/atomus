import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { formatarDataBR } from '@/src/utils/tempo';

export type EventoPopupInfo = {
  id: string;
  titulo: string;
  procedimento: string;
  clinicaNome: string | null;
  cor: string;
  data: string;
  hora: string;
  horaFim: string;
  tutor: string;
  endereco: string | null;
  pago: boolean;
};

function abrirNoGoogleMaps(endereco: string) {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`);
}

type Props = {
  evento: EventoPopupInfo | null;
  onFechar: () => void;
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onExcluir: (id: string) => void;
};

export function EventoPopup({ evento, onFechar, onEditar, onDuplicar, onExcluir }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    setMenuAberto(false);
  }, [evento?.id]);

  if (!evento) return null;

  function fechar() {
    setMenuAberto(false);
    onFechar();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={fechar}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={fechar}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <View style={styles.cabecalho}>
            <View style={[styles.ponto, { backgroundColor: evento.cor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>{evento.titulo}</Text>
              <Text style={styles.detalhe}>
                {formatarDataBR(evento.data)} · {evento.hora}–{evento.horaFim}
              </Text>
              {!!evento.procedimento && <Text style={styles.detalhe}>{evento.procedimento}</Text>}
              <Text style={styles.detalhe}>{evento.clinicaNome || 'Particular'}</Text>
              {!!evento.tutor && <Text style={styles.detalhe}>Tutor: {evento.tutor}</Text>}
            </View>
            <TouchableOpacity onPress={() => onEditar(evento.id)} hitSlop={8} style={styles.botaoIcone}>
              <Ionicons name="pencil-outline" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuAberto((a) => !a)} hitSlop={8} style={styles.botaoIcone}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.linhaInfo}>
            <View style={[styles.badge, evento.pago ? styles.badgePago : styles.badgePendente]}>
              <Text style={[styles.badgeTexto, evento.pago ? styles.badgeTextoPago : styles.badgeTextoPendente]}>
                {evento.pago ? 'Pago' : 'Pendente'}
              </Text>
            </View>
            {!!evento.endereco && (
              <TouchableOpacity
                style={styles.enderecoBotao}
                onPress={() => abrirNoGoogleMaps(evento.endereco!)}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={14} color={theme.colors.primary} />
                <Text style={styles.enderecoTexto} numberOfLines={1}>{evento.endereco}</Text>
              </TouchableOpacity>
            )}
          </View>

          {menuAberto && (
            <View style={styles.menu}>
              <TouchableOpacity style={styles.menuItem} onPress={() => onDuplicar(evento.id)} activeOpacity={0.7}>
                <Ionicons name="copy-outline" size={16} color={theme.colors.text} />
                <Text style={styles.menuItemTexto}>Duplicar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => onExcluir(evento.id)} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                <Text style={[styles.menuItemTexto, { color: theme.colors.danger }]}>Excluir</Text>
              </TouchableOpacity>
            </View>
          )}
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
    padding: theme.spacing.md,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ponto: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  titulo: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 15 },
  detalhe: { color: theme.colors.textSecondary, fontFamily: theme.font.regular, fontSize: 12, marginTop: 3 },
  botaoIcone: { padding: 2 },
  linhaInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  badge: { borderRadius: theme.radius.sm, paddingVertical: 4, paddingHorizontal: 8 },
  badgePago: { backgroundColor: theme.colors.successLight },
  badgePendente: { backgroundColor: theme.colors.warningLight },
  badgeTexto: { fontFamily: theme.font.medium, fontSize: 11 },
  badgeTextoPago: { color: theme.colors.success },
  badgeTextoPendente: { color: theme.colors.warning },
  enderecoBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    borderRadius: theme.radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surfaceVariant,
  },
  enderecoTexto: { color: theme.colors.primary, fontFamily: theme.font.regular, fontSize: 12, flexShrink: 1 },
  menu: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: 6,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  menuItemTexto: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 14 },
});
