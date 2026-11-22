// Envio pela WhatsApp Cloud API (Meta).
// MODO TESTE: sem WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID, nada sai; a mensagem só aparece no terminal (console.log).
import { createHmac, timingSafeEqual } from 'node:crypto';

const env = () => process.env;
export const modoTeste = () => !(env().WHATSAPP_TOKEN && env().WHATSAPP_PHONE_NUMBER_ID);

async function envia(corpo, resumo) {
  if (modoTeste()) { console.log(`\n[WhatsApp · modo teste] → ${corpo.to}\n${resumo}\n`); return { teste: true }; }
  const versao = env().WHATSAPP_API_VERSION || 'v23.0';
  const r = await fetch(`https://graph.facebook.com/${versao}/${env().WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env().WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo }),
  });
  const json = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${JSON.stringify(json)}`);
  return json;
}

// Modelo (template) aprovado na Meta. `variaveis` preenche {{1}}, {{2}}… do corpo; `botao` é o payload do botão de resposta rápida 0.
export function template(para, nome, variaveis, { botao, previa } = {}) {
  const components = [{ type: 'body', parameters: variaveis.map((text) => ({ type: 'text', text: String(text) })) }];
  if (botao) components.push({ type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: botao }] });
  return envia(
    { to: para, type: 'template', template: { name: nome, language: { code: env().WHATSAPP_TEMPLATE_IDIOMA || 'pt_BR' }, components } },
    `(modelo "${nome}")\n${previa ?? variaveis.join(' | ')}${botao ? `\n[ botão: Cancelar este horário → ${botao} ]` : ''}`,
  );
}

// Texto livre: só funciona dentro da janela de 24 h depois que a pessoa mandou mensagem (respostas aos comandos do barbeiro).
export const texto = (para, body) => envia({ to: para, type: 'text', text: { body, preview_url: false } }, body);

// A Meta assina o webhook com o App Secret: X-Hub-Signature-256: sha256=<hmac do corpo cru>
export function assinaturaValida(corpoCru, assinatura) {
  const segredo = env().WHATSAPP_APP_SECRET;
  if (!segredo) return modoTeste(); // sem segredo, só aceita no modo teste (simulação local)
  if (!assinatura?.startsWith('sha256=')) return false;
  const esperado = Buffer.from(`sha256=${createHmac('sha256', segredo).update(corpoCru).digest('hex')}`);
  const recebido = Buffer.from(assinatura);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export const nomesTemplates = () => ({
  barbeiro: env().WA_TEMPLATE_BARBEIRO || 'novo_agendamento_barbeiro',
  cliente: env().WA_TEMPLATE_CLIENTE || 'agendamento_confirmado',
  cancelado: env().WA_TEMPLATE_CANCELADO || 'agendamento_cancelado',
});
