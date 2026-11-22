// GET /api/horarios?barbeiro=<id|livre>&data=AAAA-MM-DD&servico=<nome do serviço>
// (ou &duracao=<min> no lugar do serviço) → { horarios: [minutos desde a meia-noite, …] }
// Livre = expediente − almoço − folgas − agendamentos confirmados − horários que já passaram,
// e o serviço inteiro tem que caber.
import { store } from './_lib/store.js';
import { horariosLivres, barbeiro, servico, dataNoPrazo } from './_lib/agenda.js';
import { json, protegido } from './_lib/http.js';

export function GET(request) {
  return protegido(async () => {
    const q = new URL(request.url).searchParams;
    const alvo = q.get('barbeiro') || 'livre';
    const data = q.get('data');
    const duracao = servico(q.get('servico'))?.min ?? Number(q.get('duracao'));
    if (alvo !== 'livre' && !barbeiro(alvo)) return json({ erro: 'Barbeiro não encontrado.' }, 400);
    if (!Number.isInteger(duracao) || duracao < 5 || duracao > 240) return json({ erro: 'Serviço inválido.' }, 400);
    if (!dataNoPrazo(data)) return json({ data, horarios: [] });
    const livres = await horariosLivres(store(), alvo, data, duracao);
    return json({ data, horarios: livres.map((h) => h.min) });
  });
}
