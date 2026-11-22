// As regras da agenda: quais horários estão livres e com quem.
import { BARBEIROS, SERVICOS, GRADE_MIN, DIAS_A_FRENTE, ANTECEDENCIA_MIN } from '../_config.js';
import { local, hoje, ehData, somaDias, diaSemana, diferencaDias, iso, paraMin } from './tempo.js';

export const barbeiro = (id) => BARBEIROS.find((b) => b.id === id);
const igual = (t) => String(t ?? '').normalize('NFC').trim().toLowerCase();
export const servico = (nome) => SERVICOS.find((s) => igual(s.nome) === igual(nome));

// A data pode ser agendada? (de hoje até DIAS_A_FRENTE - 1 dias à frente)
export function dataNoPrazo(data) {
  if (!ehData(data)) return false;
  const d = diferencaDias(hoje(), data);
  return d >= 0 && d < DIAS_A_FRENTE;
}

// Horários livres de uma data para os barbeiros pedidos ('livre' = qualquer um).
// Devolve [{ min, barbeiros: [ids livres nesse horário] }], em ordem.
export async function horariosLivres(db, alvo, data, duracao) {
  const ids = alvo === 'livre' ? BARBEIROS.map((b) => b.id) : [alvo];
  const [ocupados, bloqueios] = await Promise.all([
    db.agendamentosEntre(iso(data, 0), iso(somaDias(data, 1), 0), ids),
    db.bloqueiosDoDia(data),
  ]);
  const agora = local();
  const minimo = data === agora.data ? agora.min + ANTECEDENCIA_MIN : -1;
  const porMin = new Map();
  for (const id of ids) {
    if (bloqueios.some((b) => b.barbeiro_id === id)) continue;
    const turnos = barbeiro(id).expediente[diaSemana(data)] ?? [];
    // agendamentos do barbeiro em minutos do dia
    const dele = ocupados.filter((a) => a.barbeiro_id === id).map((a) => {
      const i = local(a.inicio), f = local(a.fim);
      return [i.data < data ? 0 : i.min, f.data > data ? 24 * 60 : f.min];
    });
    for (const [ent, sai] of turnos) {
      for (let m = paraMin(ent); m + duracao <= paraMin(sai); m += GRADE_MIN) {
        if (m < minimo) continue;
        if (dele.some(([i, f]) => m < f && i < m + duracao)) continue;
        if (!porMin.has(m)) porMin.set(m, []);
        porMin.get(m).push(id);
      }
    }
  }
  return [...porMin.entries()].sort((a, b) => a[0] - b[0]).map(([min, barbeiros]) => ({ min, barbeiros }));
}

// Celular brasileiro → só dígitos com 55 na frente. Devolve null se não parece um celular.
export function normalizaFone(fone) {
  let d = String(fone ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

// O WhatsApp às vezes manda o número brasileiro sem o 9 extra do celular (5592 9 9100-4747 → 5592 9100-4747).
// Compara as duas formas.
const sem9 = (n) => (n.length === 13 && n.startsWith('55') && n[4] === '9' ? n.slice(0, 4) + n.slice(5) : n);
export const mesmoNumero = (a, b) => !!a && !!b && sem9(String(a).replace(/\D/g, '')) === sem9(String(b).replace(/\D/g, ''));
export const barbeirosDoNumero = (numero) => BARBEIROS.filter((b) => mesmoNumero(b.whatsapp, numero));
