import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatarMoeda } from '@/src/utils/formato';

// "Olho" de ocultar valores (como nos apps de banco): só os valores em R$ viram "R$ ••••", o resto da tela continua igual.
// A escolha fica salva no aparelho e vale para todas as telas que usarem este hook.
const CHAVE = 'atomus:ocultarValores';
let oculto = false;
const ouvintes = new Set<() => void>();

AsyncStorage.getItem(CHAVE)
  .then((v) => {
    if (v === '1' && !oculto) {
      oculto = true;
      ouvintes.forEach((f) => f());
    }
  })
  .catch(() => {});

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

export function useOcultarValores() {
  const valor = useSyncExternalStore(assinar, () => oculto, () => false);
  const alternar = () => {
    oculto = !oculto;
    AsyncStorage.setItem(CHAVE, oculto ? '1' : '0').catch(() => {});
    ouvintes.forEach((f) => f());
  };
  const moeda = (v: number) => (valor ? 'R$ ••••' : formatarMoeda(v));
  return { oculto: valor, alternar, moeda };
}
