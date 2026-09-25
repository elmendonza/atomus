import { formatarMoeda } from '@/src/utils/formato';

// Mensagem de cobrança dos atendimentos em atraso de um paciente (datas em dd/mm; valor = soma dos atendimentos listados).
export function montarMensagemCobranca(nomePet: string, datasIso: string[], valorTotal: number) {
  const datas = datasIso.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join('\n');
  const valor = formatarMoeda(valorTotal).replace(/ /g, ' ');
  return `Olá, tudo bem? ✨🤍
Passando para deixar um lembretinho referente ao pacote da(o) ${nomePet}. 🐾
Até o momento, os atendimentos realizados foram:
${datas}
O valor referente a esse pacote ficou em ${valor}. 🤍
Estamos passando apenas para deixar tudo organizadinho por aqui. Caso o pagamento já tenha sido realizado, pode desconsiderar essa mensagem, tá bom? 🥰
Qualquer dúvida, estamos à disposição! ✨🤍`;
}
