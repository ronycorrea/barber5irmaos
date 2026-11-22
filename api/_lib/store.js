// Onde a agenda fica gravada.
// - Com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY: no Supabase (Postgres), pela API REST, sem biblioteca extra.
// - Sem elas, no computador (npm run dev): na memória, só para testar. Some quando o servidor reinicia.
// - Sem elas, na Vercel: recusa (a memória de uma função serverless não é compartilhada, a agenda ficaria furada).
import { randomUUID } from 'node:crypto';

export class Conflito extends Error { constructor() { super('horário ocupado'); this.code = 'CONFLITO'; } }
export class SemBanco extends Error { constructor() { super('agenda sem banco de dados configurado'); this.code = 'SEM_BANCO'; } }

const sobrepoe = (a, b) => Date.parse(a.inicio) < Date.parse(b.fim) && Date.parse(b.inicio) < Date.parse(a.fim);

/* ---------- memória (teste local) ---------- */
function memoria() {
  const m = (globalThis.__agenda5irmaos ??= { agendamentos: [], bloqueios: [] });
  return {
    tipo: 'memória',
    async agendamentosEntre(inicio, fim, barbeiros) {
      return m.agendamentos.filter((a) => a.status === 'confirmado' && (!barbeiros || barbeiros.includes(a.barbeiro_id)) && sobrepoe(a, { inicio, fim }))
        .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
    },
    async bloqueiosDoDia(data) { return m.bloqueios.filter((b) => b.data === data); },
    async futurosDoCliente(fone) { return m.agendamentos.filter((a) => a.status === 'confirmado' && a.cliente_fone === fone && Date.parse(a.inicio) > Date.now()).length; },
    async criar(ag) {
      if (m.agendamentos.some((a) => a.status === 'confirmado' && a.barbeiro_id === ag.barbeiro_id && sobrepoe(a, ag))) throw new Conflito();
      const linha = { id: randomUUID(), status: 'confirmado', criado_em: new Date().toISOString(), ...ag };
      m.agendamentos.push(linha);
      return linha;
    },
    async buscar(id) { return m.agendamentos.find((a) => a.id === id) ?? null; },
    // só cancela o que ainda está confirmado; devolve null se já estava cancelado ou não existe
    async cancelar(id) {
      const a = m.agendamentos.find((x) => x.id === id && x.status === 'confirmado');
      if (!a) return null;
      Object.assign(a, { status: 'cancelado', cancelado_em: new Date().toISOString() });
      return a;
    },
    async bloquear(barbeiro_id, data, motivo) { if (!m.bloqueios.some((b) => b.barbeiro_id === barbeiro_id && b.data === data)) m.bloqueios.push({ id: randomUUID(), barbeiro_id, data, motivo }); },
    async desbloquear(barbeiro_id, data) { m.bloqueios = m.bloqueios.filter((b) => !(b.barbeiro_id === barbeiro_id && b.data === data)); },
  };
}

/* ---------- Supabase (produção) ---------- */
function supabase(url, chave) {
  const base = `${url.replace(/\/$/, '')}/rest/v1`;
  // chave nova (sb_secret_...) vai só no apikey; a antiga (service_role, um JWT "eyJ...") vai também no Authorization
  const cab = { apikey: chave, 'Content-Type': 'application/json', ...(chave.startsWith('eyJ') ? { Authorization: `Bearer ${chave}` } : {}) };
  async function rest(caminho, { method = 'GET', query = {}, body, prefer } = {}) {
    const r = await fetch(`${base}/${caminho}?${new URLSearchParams(query)}`, { method, headers: { ...cab, ...(prefer ? { Prefer: prefer } : {}) }, body: body && JSON.stringify(body) });
    const txt = await r.text();
    const json = txt ? JSON.parse(txt) : null;
    if (!r.ok) {
      if (json?.code === '23P01') throw new Conflito(); // a constraint EXCLUDE do banco: horário sobreposto
      throw new Error(`Supabase ${r.status}: ${txt}`);
    }
    return json;
  }
  const lista = (ids) => `in.(${ids.map((i) => `"${i}"`).join(',')})`;
  return {
    tipo: 'supabase',
    agendamentosEntre: (inicio, fim, barbeiros) => rest('agendamentos', {
      query: { select: '*', status: 'eq.confirmado', inicio: `lt.${fim}`, fim: `gt.${inicio}`, order: 'inicio', ...(barbeiros ? { barbeiro_id: lista(barbeiros) } : {}) },
    }),
    bloqueiosDoDia: (data) => rest('bloqueios', { query: { select: 'barbeiro_id,data,motivo', data: `eq.${data}` } }),
    async futurosDoCliente(fone) {
      const r = await rest('agendamentos', { query: { select: 'id', status: 'eq.confirmado', cliente_fone: `eq.${fone}`, inicio: `gt.${new Date().toISOString()}` } });
      return r.length;
    },
    async criar(ag) { return (await rest('agendamentos', { method: 'POST', body: ag, prefer: 'return=representation' }))[0]; },
    async buscar(id) { return (await rest('agendamentos', { query: { select: '*', id: `eq.${id}` } }))[0] ?? null; },
    async cancelar(id) {
      const r = await rest('agendamentos', { method: 'PATCH', query: { id: `eq.${id}`, status: 'eq.confirmado' }, body: { status: 'cancelado', cancelado_em: new Date().toISOString() }, prefer: 'return=representation' });
      return r[0] ?? null;
    },
    bloquear: (barbeiro_id, data, motivo) => rest('bloqueios', { method: 'POST', query: { on_conflict: 'barbeiro_id,data' }, body: { barbeiro_id, data, motivo }, prefer: 'resolution=ignore-duplicates' }),
    desbloquear: (barbeiro_id, data) => rest('bloqueios', { method: 'DELETE', query: { barbeiro_id: `eq.${barbeiro_id}`, data: `eq.${data}` } }),
  };
}

export function store() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERCEL } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) return supabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  if (VERCEL) throw new SemBanco();
  return memoria();
}
