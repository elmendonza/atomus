import { supabase } from '@/src/lib/supabase';

// Datas (dd/mm) das sessões do pacote de um paciente: os últimos `sessoesUsadas` atendimentos não cancelados,
// em ordem cronológica. O pacote não guarda uma data de início, então "as últimas N sessões" é o vínculo.
export async function buscarDatasPacote(pacienteId: string, sessoesUsadas: number): Promise<{ datas: string[]; algumaFutura: boolean }> {
  if (sessoesUsadas <= 0) return { datas: [], algumaFutura: false };
  const { data } = await supabase
    .from('atendimentos')
    .select('data')
    .eq('paciente_id', pacienteId)
    .neq('status', 'cancelado')
    .order('data', { ascending: false })
    .limit(sessoesUsadas);
  const isos = ((data ?? []) as { data: string }[]).map((r) => r.data).reverse();
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    datas: isos.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`),
    algumaFutura: isos.some((d) => d > hoje),
  };
}

export function montarMensagemRenovacao(nomePaciente: string, datas: string[], algumaFutura = false) {
  const lista = datas.length
    ? `${algumaFutura ? 'As sessões desse pacote estão nos dias' : 'Até o momento, já realizamos'}:\n\n${datas.join('\n')}\n\n`
    : '';
  return `Olá, tudo bem? ✨🤍

Passando para avisar que estamos chegando às últimas sessões do pacotinho da ${nomePaciente}. ${lista}Com isso, estamos entrando na reta final desse pacote e já quis te avisar com antecedência para conseguirmos nos organizar direitinho e deixar a próxima renovação programada, mantendo a frequência do acompanhamento e a evolução dela. 🥰

Se tiver qualquer dúvida sobre os pacotes, pode me chamar, tá bom?! 🤍✨`;
}
