// GET /api/barbeiros → a lista pública de barbeiros (sem os chats do Telegram) e o prazo de agendamento.
import { BARBEIROS, DIAS_A_FRENTE } from './_config.js';
import { hoje } from './_lib/tempo.js';
import { json } from './_lib/http.js';

export function GET() {
  return json({
    barbeiros: BARBEIROS.map(({ id, nome, extra }) => ({ id, nome, extra })),
    diasAFrente: DIAS_A_FRENTE,
    hoje: hoje(),
  });
}
