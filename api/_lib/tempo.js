// Datas e horas sempre no fuso da barbearia (America/Manaus, UTC-4 fixo), nunca no do servidor.
// Uma data é a string 'AAAA-MM-DD'; uma hora é o número de minutos desde a meia-noite (14:20 = 860).
import { FUSO } from '../_config.js';

const OFFSET_MIN = (() => { const [, s, h, m] = FUSO.match(/([+-])(\d\d):(\d\d)/); return (s === '-' ? -1 : 1) * (Number(h) * 60 + Number(m)); })();
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const doisDig = (n) => String(n).padStart(2, '0');
export const fmtHora = (m) => `${doisDig(Math.floor(m / 60))}:${doisDig(m % 60)}`;
export const paraMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// um instante (Date ou ISO) visto no relógio da barbearia
export function local(instante = new Date()) {
  const d = new Date(new Date(instante).getTime() + OFFSET_MIN * 60000);
  return { data: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
export const hoje = () => local().data;
export const ehData = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export function somaDias(data, n) { const d = new Date(`${data}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const diaSemana = (data) => new Date(`${data}T00:00:00Z`).getUTCDay();
export const diferencaDias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
// 'AAAA-MM-DD' + minutos → ISO com o fuso da barbearia (é assim que vai para o banco)
export const iso = (data, min) => `${data}T${fmtHora(min)}:00${FUSO}`;
// "sábado, 29/11 às 14:00"
export function legivel(data, min) {
  const [, mes, dia] = data.split('-');
  return `${DIAS_LONGOS[diaSemana(data)]}, ${dia}/${mes}${min == null ? '' : ` às ${fmtHora(min)}`}`;
}
