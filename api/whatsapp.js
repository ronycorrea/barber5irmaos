// /api/whatsapp: o webhook da Meta. É por aqui que o barbeiro controla a agenda, só com o WhatsApp:
//   • toque no botão "Cancelar este horário"  → cancela, o horário volta para o site e o cliente é avisado
//   • "folga sábado" / "folga 29/11" / "folga amanhã"  → fecha o dia dele no site
//   • "liberar sábado"                                 → desfaz a folga
//   • "agenda" / "agenda amanhã"                       → lista os clientes do dia
// Só aceita comandos dos números dos barbeiros (api/_config.js).
import { BARBEIROS, CONTATO_BARBEARIA } from './_config.js';
import { store } from './_lib/store.js';
import { barbeirosDoNumero } from './_lib/agenda.js';
import { texto, assinaturaValida } from './_lib/whatsapp.js';
import { avisaCancelamento, foneLegivel } from './_lib/avisos.js';
import { hoje, somaDias, diaSemana, local, legivel, iso, fmtHora } from './_lib/tempo.js';

// GET: a Meta confere o webhook uma vez, quando ele é cadastrado
export function GET(request) {
  const q = new URL(request.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (q.get('hub.mode') === 'subscribe' && token && q.get('hub.verify_token') === token) return new Response(q.get('hub.challenge') ?? '', { status: 200 });
  return new Response('proibido', { status: 403 });
}

export async function POST(request) {
  const cru = await request.text();
  if (!assinaturaValida(cru, request.headers.get('x-hub-signature-256'))) return new Response('assinatura inválida', { status: 401 });
  let corpo;
  try { corpo = JSON.parse(cru); } catch { return new Response('ok'); }
  const mensagens = (corpo.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? []));
  for (const msg of mensagens) {
    try { await trata(msg); } catch (e) { console.error('Webhook WhatsApp:', e); }
  }
  // sempre 200: senão a Meta reenvia a mesma mensagem várias vezes
  return new Response('ok');
}

async function trata(msg) {
  const de = msg.from;
  const meus = barbeirosDoNumero(de);
  const botao = msg.button?.payload ?? msg.interactive?.button_reply?.id;
  const txt = (msg.text?.body ?? '').trim();
  if (!botao && !txt) return;

  if (!meus.length) {
    // cliente respondendo o número do sistema: ninguém lê esta caixa, então manda para o WhatsApp da barbearia
    return texto(de, `Este número só envia os avisos da Barbearia 5 Irmãos. Para falar com a gente, chame aqui: wa.me/${CONTATO_BARBEARIA}`);
  }
  const db = store();

  if (botao?.startsWith('cancelar:')) {
    const ag = await db.buscar(botao.slice(9));
    if (!ag || !meus.some((b) => b.id === ag.barbeiro_id)) return texto(de, 'Não achei esse agendamento.');
    const l = local(ag.inicio);
    const cancelado = await db.cancelar(ag.id);
    if (!cancelado) return texto(de, `Esse horário (${ag.cliente_nome}, ${legivel(l.data, l.min)}) já estava cancelado.`);
    await avisaCancelamento(cancelado).catch((e) => console.error('Falha ao avisar o cliente:', e));
    return texto(de, `❌ Cancelado: ${ag.cliente_nome}, ${legivel(l.data, l.min)}.\nO cliente foi avisado e o horário voltou a ficar livre no site.`);
  }

  const [cmd, ...resto] = txt.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/);
  const argumento = resto.join(' ');

  if (cmd === 'folga' || cmd === 'liberar') {
    const data = interpretaDia(argumento);
    if (!data) return texto(de, `Não entendi o dia. Exemplos: "${cmd} amanhã", "${cmd} sábado", "${cmd} 29/11".`);
    if (data < hoje()) return texto(de, 'Esse dia já passou.');
    if (cmd === 'liberar') {
      for (const b of meus) await db.desbloquear(b.id, data);
      return texto(de, `✅ ${cap(legivel(data))} está aberto de novo no site.`);
    }
    for (const b of meus) await db.bloquear(b.id, data, 'folga pelo WhatsApp');
    const ja = await db.agendamentosEntre(iso(data, 0), iso(somaDias(data, 1), 0), meus.map((b) => b.id));
    const aviso = ja.length ? `\n\n⚠ Você já tem ${ja.length} cliente(s) nesse dia. Eles continuam marcados: cancele pelo botão de cada mensagem se não for atender.\n${lista(ja)}` : '';
    return texto(de, `🔒 Folga anotada: ${legivel(data)}. Ninguém mais consegue agendar com você nesse dia.\nPara desfazer: "liberar ${argumento}".${aviso}`);
  }

  if (cmd === 'agenda') {
    const data = argumento ? interpretaDia(argumento) : hoje();
    if (!data) return texto(de, 'Não entendi o dia. Exemplos: "agenda", "agenda amanhã", "agenda sábado".');
    const ags = await db.agendamentosEntre(iso(data, 0), iso(somaDias(data, 1), 0), meus.map((b) => b.id));
    return texto(de, ags.length ? `📋 ${cap(legivel(data))}\n${lista(ags)}` : `📋 ${cap(legivel(data))}: nenhum cliente agendado.`);
  }

  return texto(de, 'Comandos da agenda:\n• folga sábado  (ou: folga amanhã, folga 29/11)\n• liberar sábado  (desfaz a folga)\n• agenda  (ou: agenda amanhã)\nPara cancelar um cliente, toque em "Cancelar este horário" na mensagem do agendamento.');
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
function lista(ags) {
  const varios = BARBEIROS.length > 1;
  return ags.map((a) => `• ${fmtHora(local(a.inicio).min)} ${a.cliente_nome} · ${a.servico} · ${foneLegivel(a.cliente_fone)}${varios ? ` (${BARBEIROS.find((b) => b.id === a.barbeiro_id)?.nome.split(' ')[0]})` : ''}`).join('\n');
}

// "hoje", "amanhã", "sábado", "sab", "29/11", "29/11/2026" → 'AAAA-MM-DD' (dia da semana = o próximo, contando hoje)
const SEMANA = { dom: 0, domingo: 0, seg: 1, segunda: 1, ter: 2, terca: 2, qua: 3, quarta: 3, qui: 4, quinta: 4, sex: 5, sexta: 5, sab: 6, sabado: 6 };
export function interpretaDia(txt) {
  const t = txt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/-feira/g, '').trim();
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
