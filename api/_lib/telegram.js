// Envio pelo bot do Telegram (Bot API, gratuita).
// MODO TESTE: sem TELEGRAM_BOT_TOKEN, nada sai; a mensagem só aparece no terminal (console.log).
import { timingSafeEqual } from 'node:crypto';

export const modoTeste = () => !process.env.TELEGRAM_BOT_TOKEN;
// os textos vão em HTML do Telegram: tudo que vem do cliente passa por aqui
export const escapa = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function chamar(metodo, corpo) {
  if (modoTeste()) {
    const txt = (corpo.text ?? '').replace(/<a href="([^"]*)">([^<]*)<\/a>/g, '$2 ($1)').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const botoes = corpo.reply_markup?.inline_keyboard?.flat().map((b) => `[ ${b.text} → ${b.callback_data} ]`).join(' ') ?? '';
    console.log(`\n[Telegram · modo teste] ${metodo} → ${corpo.chat_id ?? corpo.callback_query_id ?? ''}\n${txt}${botoes ? `\n${botoes}` : ''}\n`);
    return { teste: true };
  }
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const json = await r.json().catch(() => null);
  if (!json?.ok) throw new Error(`Telegram ${metodo} ${r.status}: ${JSON.stringify(json)}`);
  return json.result;
}

// `botoes`: [[{ text, callback_data }]] — botões embaixo da mensagem
export function envia(chat, html, botoes) {
  if (!chat) { console.warn('Telegram: barbeiro sem telegramChatId em api/_config.js, mensagem não enviada.'); return Promise.resolve(null); }
  return chamar('sendMessage', { chat_id: chat, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(botoes ? { reply_markup: { inline_keyboard: botoes } } : {}) });
}

// O Telegram manda o segredo combinado no setWebhook no cabeçalho X-Telegram-Bot-Api-Secret-Token
export function segredoValido(recebido) {
  const segredo = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!segredo) return modoTeste(); // sem segredo, só aceita no modo teste (simulação local)
  const a = Buffer.from(String(recebido ?? '')), b = Buffer.from(segredo);
  return a.length === b.length && timingSafeEqual(a, b);
}
