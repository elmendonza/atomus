export function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarNumeroWhatsApp(telefoneBruto: string) {
  let numeros = telefoneBruto.replace(/\D/g, '');
  if (!numeros.startsWith('55')) numeros = '55' + numeros;
  return numeros;
}

export function formatarTelefone(texto: string) {
  const digitos = texto.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 2) return digitos.length ? `(${digitos}` : '';
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}
