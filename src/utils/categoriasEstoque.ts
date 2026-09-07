import { Ionicons } from '@expo/vector-icons';

export type CategoriaEstoque = {
  id: string;
  label: string;
  icone: keyof typeof Ionicons.glyphMap;
};

export const CATEGORIAS_ESTOQUE: CategoriaEstoque[] = [
  { id: 'agulhas', label: 'Agulhas', icone: 'medical-outline' },
  { id: 'descartaveis', label: 'Descartáveis', icone: 'bandage-outline' },
  { id: 'moxa', label: 'Moxa', icone: 'flame-outline' },
  { id: 'pereciveis', label: 'Perecíveis', icone: 'flask-outline' },
  { id: 'seringa', label: 'Seringa', icone: 'water-outline' },
  { id: 'sondas', label: 'Sondas', icone: 'git-commit-outline' },
];

const REGEX_DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');

export function normalizarNomeProduto(texto: string) {
  return texto.normalize('NFD').replace(REGEX_DIACRITICOS, '').toLowerCase().trim();
}

export function sugerirCategoria(nome: string): string | null {
  const n = normalizarNomeProduto(nome);
  if (!n) return null;
  if (n.startsWith('agulha')) return 'agulhas';
  if (n.startsWith('seringa')) return 'seringa';
  if (n.startsWith('moxa') || n === 'mocha') return 'moxa';
  if (
    n.startsWith('algodao') ||
    n.startsWith('gaze') ||
    n.startsWith('gases') ||
    n.startsWith('luvas') ||
    n.startsWith('sacos')
  ) {
    return 'descartaveis';
  }
  if (
    n.startsWith('solucao') ||
    n.startsWith('nutrisco') ||
    n.startsWith('nutricos') ||
    n.startsWith('alcool') ||
    n.startsWith('agua') ||
    n.startsWith('clorexidina') ||
    n.startsWith('ringer') ||
    n.startsWith('gel')
  ) {
    return 'pereciveis';
  }
  if (n.includes('sonda') || n.startsWith('scalp') || n.startsWith('equipo')) return 'sondas';
  return null;
}
