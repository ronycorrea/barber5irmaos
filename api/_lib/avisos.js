// As mensagens que o sistema manda (os textos fixos ficam nos modelos aprovados na Meta; aqui só as variáveis).
import { CONTATO_BARBEARIA, SITE_URL } from '../_config.js';
import { template, nomesTemplates } from './whatsapp.js';
import { local, legivel } from './tempo.js';
import { barbeiro } from './agenda.js';

export const foneLegivel = (f) => { const d = f.replace(/^55/, ''); return `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`; };
const primeiroNome = (n) => n.split(' ')[0];
const quando = (ag) => { const l = local(ag.inicio); return legivel(l.data, l.min); };

// barbeiro: {{1}} cliente · {{2}} celular · {{3}} serviço · {{4}} preço · {{5}} quando  + botão "Cancelar este horário"
export function avisaBarbeiro(ag) {
  const b = barbeiro(ag.barbeiro_id);
  const v = [ag.cliente_nome, foneLegivel(ag.cliente_fone), ag.servico, ag.preco, quando(ag)];
  return template(b.whatsapp, nomesTemplates().barbeiro, v, {
    botao: `cancelar:${ag.id}`,
    previa: `📅 Novo agendamento (${b.nome})\nCliente: ${v[0]} · ${v[1]}\nServiço: ${v[2]} · R$ ${v[3]}\nQuando: ${v[4]}`,
  });
}

// cliente: {{1}} nome · {{2}} serviço · {{3}} barbeiro · {{4}} quando · {{5}} WhatsApp da barbearia
export function confirmaCliente(ag) {
  const v = [primeiroNome(ag.cliente_nome), ag.servico, barbeiro(ag.barbeiro_id).nome, quando(ag), `wa.me/${CONTATO_BARBEARIA}`];
  return template(ag.cliente_fone, nomesTemplates().cliente, v, {
    previa: `Olá, ${v[0]}! Seu horário na Barbearia 5 Irmãos está confirmado: ${v[1]} com ${v[2]}, ${v[3]}. Pagamento na cadeira. Precisa remarcar? Fale com a gente: ${v[4]}`,
  });
}

// cliente: {{1}} nome · {{2}} serviço · {{3}} quando · {{4}} site
export function avisaCancelamento(ag) {
  const v = [primeiroNome(ag.cliente_nome), ag.servico, quando(ag), SITE_URL];
  return template(ag.cliente_fone, nomesTemplates().cancelado, v, {
    previa: `Olá, ${v[0]}. O barbeiro precisou cancelar seu horário de ${v[1]} (${v[2]}) na Barbearia 5 Irmãos. Desculpe o transtorno! Escolha outro horário em ${v[3]}`,
  });
}

// manda tudo sem deixar uma falha do WhatsApp derrubar o agendamento (que já está gravado)
export async function semFalhar(...envios) {
  const r = await Promise.allSettled(envios.map((f) => f()));
  r.filter((x) => x.status === 'rejected').forEach((x) => console.error('Falha ao enviar WhatsApp:', x.reason));
  return r.every((x) => x.status === 'fulfilled');
}
