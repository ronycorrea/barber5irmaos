// As mensagens que o bot do Telegram manda para o barbeiro.
// O cliente não recebe mensagem automática (o Telegram não manda para número de telefone): ele vê a confirmação no site,
// e quando o barbeiro cancela, o bot entrega um link de WhatsApp pronto para o barbeiro avisar o cliente.
import { SITE_URL } from '../_config.js';
import { envia, escapa } from './telegram.js';
import { local, legivel } from './tempo.js';
import { barbeiro } from './agenda.js';

export const foneLegivel = (f) => { const d = f.replace(/^55/, ''); return `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`; };
export const quando = (ag) => { const l = local(ag.inicio); return legivel(l.data, l.min); };
const primeiroNome = (n) => n.split(' ')[0];
const linkWhats = (fone, texto) => `https://wa.me/${fone}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;

export function avisaBarbeiro(ag) {
  const b = barbeiro(ag.barbeiro_id);
  const html = [
    `📅 <b>Novo agendamento</b>${b ? ` · ${escapa(b.nome)}` : ''}`,
    `Cliente: ${escapa(ag.cliente_nome)}`,
    `Serviço: ${escapa(ag.servico)} · R$ ${ag.preco}`,
    `Quando: <b>${quando(ag)}</b>`,
    `WhatsApp: <a href="${linkWhats(ag.cliente_fone)}">${foneLegivel(ag.cliente_fone)}</a>`,
  ].join('\n');
  return envia(b?.telegramChatId, html, [[{ text: '❌ Cancelar este horário', callback_data: `cancelar:${ag.id}` }]]);
}

// o texto que o barbeiro manda pelo WhatsApp para o cliente quando cancela
export function linkAvisoCancelamento(ag) {
  return linkWhats(ag.cliente_fone, `Olá, ${primeiroNome(ag.cliente_nome)}! Aqui é da Barbearia 5 Irmãos. Infelizmente precisei cancelar seu horário de ${ag.servico} (${quando(ag)}). Desculpe o transtorno! Você pode escolher outro horário em ${SITE_URL}`);
}

// manda sem deixar uma falha do Telegram derrubar o agendamento (que já está gravado)
export async function semFalhar(...envios) {
  const r = await Promise.allSettled(envios.map((f) => f()));
  r.filter((x) => x.status === 'rejected').forEach((x) => console.error('Falha ao enviar no Telegram:', x.reason));
  return r.every((x) => x.status === 'fulfilled');
}
