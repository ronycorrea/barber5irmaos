// POST /api/agendar  { barbeiro: <id|livre>, data: 'AAAA-MM-DD', hora: minutos ou 'HH:MM', servico, nome, fone }
// Valida tudo de novo (o navegador não manda em nada), grava e avisa o barbeiro no Telegram.
// 409: o horário foi pego nesse meio-tempo.
import { MAX_POR_CLIENTE } from './_config.js';
import { store, Conflito } from './_lib/store.js';
import { horariosLivres, barbeiro, servico, dataNoPrazo, normalizaFone } from './_lib/agenda.js';
import { iso, paraMin } from './_lib/tempo.js';
import { avisaBarbeiro, semFalhar } from './_lib/avisos.js';
import { json, protegido } from './_lib/http.js';

const limpa = (t) => String(t ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

export function POST(request) {
  return protegido(async () => {
    const corpo = await request.json().catch(() => null);
    if (!corpo) return json({ erro: 'Pedido inválido.' }, 400);
    const alvo = corpo.barbeiro || 'livre';
    const sv = servico(corpo.servico);
    const nome = limpa(corpo.nome);
    const fone = normalizaFone(corpo.fone);
    const hora = typeof corpo.hora === 'string' && corpo.hora.includes(':') ? paraMin(corpo.hora) : Number(corpo.hora);
    const { data } = corpo;

    if (alvo !== 'livre' && !barbeiro(alvo)) return json({ erro: 'Barbeiro não encontrado.' }, 400);
    if (!sv) return json({ erro: 'Serviço não encontrado.' }, 400);
    if (nome.length < 2) return json({ erro: 'Escreva seu nome.' }, 400);
    if (!fone) return json({ erro: 'Celular inválido. Use o DDD.' }, 400);
    if (!dataNoPrazo(data) || !Number.isInteger(hora)) return json({ erro: 'Data ou horário fora da agenda.' }, 400);

    const db = store();
    if ((await db.futurosDoCliente(fone)) >= MAX_POR_CLIENTE) {
      return json({ erro: `Esse celular já tem ${MAX_POR_CLIENTE} horários marcados. Para mudar, fale com a barbearia.` }, 429);
    }

    // o horário tem que estar livre agora, pela mesma conta que mostrou a grade
    const livre = (await horariosLivres(db, alvo, data, sv.min)).find((h) => h.min === hora);
    if (!livre) return json({ erro: 'Esse horário acabou de ser ocupado.' }, 409);

    // "primeira cadeira livre": quem tiver menos clientes no dia primeiro
    let candidatos = livre.barbeiros;
    if (alvo === 'livre' && candidatos.length > 1) {
      const doDia = await db.agendamentosEntre(iso(data, 0), iso(data, 24 * 60 - 1), candidatos);
      const conta = (id) => doDia.filter((a) => a.barbeiro_id === id).length;
      candidatos = [...candidatos].sort((a, b) => conta(a) - conta(b));
    }

    let ag = null;
    for (const id of candidatos) {
      try {
        ag = await db.criar({ barbeiro_id: id, inicio: iso(data, hora), fim: iso(data, hora + sv.min), servico: sv.nome, preco: sv.preco, cliente_nome: nome, cliente_fone: fone });
        break;
      } catch (e) { if (!(e instanceof Conflito)) throw e; } // o banco barrou: outra pessoa pegou; tenta o próximo
    }
    if (!ag) return json({ erro: 'Esse horário acabou de ser ocupado.' }, 409);

    const avisado = await semFalhar(() => avisaBarbeiro(ag));
    return json({ ok: true, id: ag.id, barbeiro: { id: ag.barbeiro_id, nome: barbeiro(ag.barbeiro_id).nome }, inicio: ag.inicio, servico: sv, avisado }, 201);
  });
}
