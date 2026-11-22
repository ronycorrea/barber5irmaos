// /api/telegram: o webhook do bot. É por aqui que o barbeiro controla a agenda, só pelo Telegram:
//   • /start                 → qualquer pessoa: mostra o ID do Telegram (para cadastrar em api/_config.js)
//   • botão "❌ Cancelar este horário" → cancela (só o próprio barbeiro), o horário volta para o site
//   • /hoje  /amanha         → lista os clientes do dia
//   • /folga <dia>           → fecha o dia dele no site ("29/11", "29/11/2026", "hoje", "amanha", "sabado")
//   • /abrir <dia>           → desfaz a folga
// Fora o /start, só vale para os telegramChatId cadastrados em api/_config.js.
import { BARBEIROS } from './_config.js';
import { store } from './_lib/store.js';
import { chamar, envia, escapa, segredoValido } from './_lib/telegram.js';
import { linkAvisoCancelamento, foneLegivel, quando } from './_lib/avisos.js';
import { hoje, somaDias, diaSemana, local, legivel, iso, fmtHora } from './_lib/tempo.js';

const barbeirosDoChat = (chat) => BARBEIROS.filter((b) => b.telegramChatId && String(b.telegramChatId) === String(chat));
const SEM_PERMISSAO = 'Você não tem permissão para usar a agenda. Mande /start, envie seu ID para o dono do site e espere ele cadastrar.';

export async function POST(request) {
  if (!segredoValido(request.headers.get('x-telegram-bot-api-secret-token'))) return new Response('proibido', { status: 401 });
  const update = await request.json().catch(() => null);
  try {
    if (update?.callback_query) await botao(update.callback_query);
    else if (update?.message?.text) await mensagem(update.message);
  } catch (e) { console.error('Webhook Telegram:', e); }
  // sempre 200: senão o Telegram reenvia a mesma atualização várias vezes
  return new Response('ok');
}

/* ---------- botão "Cancelar este horário" ---------- */
async function botao(cq) {
  const chat = cq.message?.chat?.id;
  const responde = (text) => chamar('answerCallbackQuery', { callback_query_id: cq.id, text });
  const meus = barbeirosDoChat(chat);
  if (!meus.length || !cq.data?.startsWith('cancelar:')) return responde('Você não tem permissão.');

  const db = store();
  const ag = await db.buscar(cq.data.slice(9));
  if (!ag || !meus.some((b) => b.id === ag.barbeiro_id)) return responde('Não achei esse agendamento.');
  const cancelado = await db.cancelar(ag.id);
  await responde(cancelado ? 'Cancelado ✓' : 'Esse horário já estava cancelado.');
  if (!cancelado) return;

  // risca a mensagem original e tira o botão
  if (cq.message?.message_id) {
    await chamar('editMessageText', {
      chat_id: chat, message_id: cq.message.message_id, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
      text: `❌ <b>Cancelado</b>\n<s>${escapa(ag.cliente_nome)} · ${escapa(ag.servico)} · ${quando(ag)}</s>`,
    }).catch((e) => console.error('Telegram editMessageText:', e));
  }
  return envia(chat, `O horário de ${escapa(ag.cliente_nome)} (${quando(ag)}) voltou a ficar livre no site.\n\n👉 <a href="${linkAvisoCancelamento(ag)}">Toque aqui para avisar o cliente no WhatsApp</a>`);
}

/* ---------- comandos de texto ---------- */
export const AJUDA = [
  'Comandos da agenda:',
  '/hoje · clientes de hoje',
  '/amanha · clientes de amanhã',
  '/folga sabado · fecha o dia no site (ou: /folga 29/11, /folga amanha)',
  '/abrir sabado · desfaz a folga',
  'Para cancelar um cliente, toque em "❌ Cancelar este horário" na mensagem do agendamento.',
].join('\n');

async function mensagem(msg) {
  const chat = msg.chat.id;
  const [cmd, ...resto] = msg.text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^\//, '').replace(/^(\w+)@\w+/, '$1').split(/\s+/);
  const argumento = resto.join(' ');

  if (cmd === 'start') return envia(chat, `Seu ID do Telegram é <code>${chat}</code>. Envie esse número para o dono do site.`);

  const meus = barbeirosDoChat(chat);
  if (!meus.length) return envia(chat, SEM_PERMISSAO);
  const db = store();
  const ids = meus.map((b) => b.id);

  if (cmd === 'hoje' || cmd === 'amanha') {
    const data = cmd === 'hoje' ? hoje() : somaDias(hoje(), 1);
    const ags = await db.agendamentosEntre(iso(data, 0), iso(somaDias(data, 1), 0), ids);
    if (!ags.length) return envia(chat, `📋 <b>${cap(legivel(data))}</b>: o dia está livre, nenhum cliente agendado.`);
    return envia(chat, `📋 <b>${cap(legivel(data))}</b>\n${lista(ags)}`);
  }

  if (cmd === 'folga' || cmd === 'abrir') {
    const data = interpretaDia(argumento);
    if (!data) return envia(chat, `Não entendi o dia. Exemplos: /${cmd} amanha, /${cmd} sabado, /${cmd} 29/11`);
    if (data < hoje()) return envia(chat, 'Esse dia já passou.');
    if (cmd === 'abrir') {
      for (const id of ids) await db.desbloquear(id, data);
      return envia(chat, `✅ ${cap(legivel(data))} está aberto de novo no site.`);
    }
    for (const id of ids) await db.bloquear(id, data, 'folga pelo Telegram');
    const ja = await db.agendamentosEntre(iso(data, 0), iso(somaDias(data, 1), 0), ids);
    const aviso = ja.length ? `\n\n⚠ Você já tem ${ja.length} cliente(s) nesse dia. Eles continuam marcados: cancele pelo botão de cada mensagem se não for atender.\n${lista(ja)}` : '';
    return envia(chat, `🔒 Folga anotada: <b>${legivel(data)}</b>. Ninguém mais consegue agendar com você nesse dia.\nPara desfazer: /abrir ${escapa(argumento)}${aviso}`);
  }

  return envia(chat, AJUDA);
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
function lista(ags) {
  const varios = BARBEIROS.length > 1;
  return ags.map((a) => `• <b>${fmtHora(local(a.inicio).min)}</b> ${escapa(a.servico)} · ${escapa(a.cliente_nome)} · ${foneLegivel(a.cliente_fone)}${varios ? ` (${escapa(BARBEIROS.find((b) => b.id === a.barbeiro_id)?.nome ?? a.barbeiro_id)})` : ''}`).join('\n');
}

// "hoje", "amanhã", "sábado", "sab", "29/11", "29/11/2026" → 'AAAA-MM-DD' (dia da semana = o próximo, contando hoje)
const SEMANA = { dom: 0, domingo: 0, seg: 1, segunda: 1, ter: 2, terca: 2, qua: 3, quarta: 3, qui: 4, quinta: 4, sex: 5, sexta: 5, sab: 6, sabado: 6 };
export function interpretaDia(txt) {
  const t = txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/-feira/g, '').trim();
  const h = hoje();
  if (t === 'hoje') return h;
  if (t === 'amanha') return somaDias(h, 1);
  if (t in SEMANA) return somaDias(h, (SEMANA[t] - diaSemana(h) + 7) % 7);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const [dia, mes] = [Number(m[1]), Number(m[2])];
  let ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(h.slice(0, 4));
  const monta = (a) => `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  if (!m[3] && monta(ano) < h) ano += 1; // "05/01" em dezembro = janeiro do ano que vem
  const d = monta(ano);
  const real = new Date(`${d}T00:00:00Z`);
  return real.getUTCMonth() + 1 === mes && real.getUTCDate() === dia ? d : null;
}
