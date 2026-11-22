// Registra a lista de comandos do bot (o menu "/" do Telegram). Rodar uma vez, no computador:
//   node --env-file=.env.local scripts/telegram-comandos.mjs
// (precisa de TELEGRAM_BOT_TOKEN no .env.local)
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error('Falta TELEGRAM_BOT_TOKEN no .env.local'); process.exit(1); }

const commands = [
  { command: 'hoje', description: 'Clientes de hoje' },
  { command: 'amanha', description: 'Clientes de amanhã' },
  { command: 'folga', description: 'Fechar um dia: /folga sabado, /folga 29/11' },
  { command: 'abrir', description: 'Desfazer a folga: /abrir sabado' },
  { command: 'start', description: 'Mostrar meu ID do Telegram' },
];

const r = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ commands }),
});
console.log(await r.json());
