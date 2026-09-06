import { TouchableOpacity } from 'react-native';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';

export function DrawerMenuButton() {
  const navigation = useNavigation();

  return (
    <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} hitSlop={10}>
      <Ionicons name="menu" size={26} color={theme.colors.text} />
    </TouchableOpacity>
  );
}
