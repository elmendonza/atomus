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

export function mesesEntre(isoInicio: string, isoFim: string): number {
  const a = isoParaDate(isoInicio);
  const b = isoParaDate(isoFim);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export type UnidadeIdade = 'meses' | 'anos';

/** A partir de uma idade aproximada (ex: 9 meses), estima o mês/ano de nascimento. */
export function nascimentoAPartirDeIdade(
  quantidade: number,
  unidade: UnidadeIdade,
  referenciaIso: string = hoje()
): { mes: number; ano: number } {
  const totalMeses = unidade === 'anos' ? quantidade * 12 : quantidade;
  const d = isoParaDate(somarMeses(referenciaIso, -totalMeses));
  return { mes: d.getMonth() + 1, ano: d.getFullYear() };
}

/** A partir do mês/ano de nascimento, calcula a idade atual (evolui sozinha com o tempo). */
export function idadeAPartirDeNascimento(
  mes: number,
  ano: number,
  referenciaIso: string = hoje()
): { quantidade: number; unidade: UnidadeIdade } {
  const nascimentoIso = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const totalMeses = Math.max(0, mesesEntre(nascimentoIso, referenciaIso));
  if (totalMeses < 12) return { quantidade: totalMeses, unidade: 'meses' };
  return { quantidade: Math.floor(totalMeses / 12), unidade: 'anos' };
}

export type UnidadeRecorrencia = 'dia' | 'semana' | 'mes' | 'ano';
export type FimRecorrencia = 'nunca' | 'apos' | 'data';

const LIMITE_SEGURANCA_OCORRENCIAS = 104;

/** Gera as datas (ISO, ordem crescente, incluindo dataBase quando aplicável) de uma recorrência. */
export function gerarOcorrenciasRecorrencia(params: {
  dataBase: string;
  unidade: UnidadeRecorrencia;
  intervalo: number;
  diasSemana?: number[];
  fim: FimRecorrencia;
  quantidadeOcorrencias?: number;
  dataFim?: string;
}): string[] {
  const { dataBase, unidade, diasSemana, fim, dataFim } = params;
  const passo = Math.max(1, params.intervalo || 1);
  const limite =
    fim === 'apos'
      ? Math.max(1, Math.min(LIMITE_SEGURANCA_OCORRENCIAS, params.quantidadeOcorrencias || 1))
      : LIMITE_SEGURANCA_OCORRENCIAS;
  const resultado: string[] = [];

  if (unidade === 'semana' && diasSemana && diasSemana.length > 0) {
    const diasOrdenados = [...diasSemana].sort((a, b) => a - b);
    const inicioSemana = isoParaDate(dataBase);
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    for (let semana = 0; resultado.length < limite && semana < 300; semana++) {
      for (const dow of diasOrdenados) {
        const d = new Date(inicioSemana);
        d.setDate(d.getDate() + dow + semana * 7 * passo);
        const iso = dateParaIso(d);
        if (iso < dataBase) continue;
        if (fim === 'data' && dataFim && iso > dataFim) return resultado;
        resultado.push(iso);
        if (resultado.length >= limite) break;
      }
    }
    return resultado.sort();
  }

  for (let i = 0; resultado.length < limite && i < 400; i++) {
    const atual =
      unidade === 'dia'
        ? somarDias(dataBase, passo * i)
        : unidade === 'semana'
          ? somarDias(dataBase, 7 * passo * i)
          : unidade === 'mes'
            ? somarMeses(dataBase, passo * i)
            : somarMeses(dataBase, 12 * passo * i);
    if (fim === 'data' && dataFim && atual > dataFim) break;
    resultado.push(atual);
  }
  return resultado;
}
