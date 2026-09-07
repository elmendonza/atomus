export function hoje(): string {
  return dateParaIso(new Date());
}

export function isoParaDate(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const d = new Date();
  d.setFullYear(ano || d.getFullYear(), (mes || 1) - 1, dia || 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dateParaIso(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return 'Selecionar data';
  return `${dia}/${mes}/${ano}`;
}

export function horaParaDate(hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export function dateParaHora(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function somarDias(iso: string, dias: number): string {
  const d = isoParaDate(iso);
  d.setDate(d.getDate() + dias);
  return dateParaIso(d);
}

export function somarMeses(iso: string, meses: number): string {
  const d = isoParaDate(iso);
  const diaOriginal = d.getDate();
  const alvo = new Date(d.getFullYear(), d.getMonth() + meses, 1);
  const ultimoDiaDoMes = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(diaOriginal, ultimoDiaDoMes));
  return dateParaIso(alvo);
}
