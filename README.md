# Barbearia 5 Irmãos

Site da Barbearia 5 Irmãos: barba, cabelo e atitude.

- **Rodar no computador:** `npm install` e depois `npm run dev` (abre em http://localhost:5173)
- **Gerar a versão final:** `npm run build` (sai na pasta `dist/`)
- **Publicação:** na Vercel (framework Vite, build `npm run build`, pasta `dist`). Cada push na branch `main` publica de novo.

Feito com Vite, Three.js, GSAP e Lenis. Cadeira 3D: "Barber Chair", de sweedboy69 (CC BY 4.0), crédito em `CREDITOS-cadeira-3d.txt`.

---

## Agendamento

O cliente agenda pelo site, e o barbeiro fica sabendo e controla tudo **só pelo Telegram**, com um robô (Bot API oficial e gratuita). Não existe painel do barbeiro, e o site não usa a API do WhatsApp: a barbearia não tem CNPJ.

```
Site (src/agenda.js) ──► /api/horarios   horários livres de verdade
                    └──► /api/agendar    grava ──► Telegram do barbeiro (com botão "❌ Cancelar este horário")
Telegram do barbeiro ──► /api/telegram   cancelar · /hoje · /amanha · /folga · /abrir · /start
                              │
                         Supabase (Postgres): agendamentos + folgas
```

| Arquivo | O que faz |
|---|---|
| `api/_config.js` | **O único arquivo para editar:** barbeiros, `telegramChatId` de cada um, expediente, serviços, grade de 20 min, prazo de 7 dias |
| `api/horarios.js` | `GET ?barbeiro=<id\|livre>&data=AAAA-MM-DD&servico=<nome>` → horários livres |
| `api/agendar.js` | `POST` → valida de novo, grava e avisa o barbeiro. `409` se o horário foi pego |
| `api/telegram.js` | Webhook do bot: o botão Cancelar e os comandos |
| `api/barbeiros.js` | A lista pública dos barbeiros (sem os IDs do Telegram) |
| `supabase/schema.sql` | Tabelas. O banco impede dois agendamentos sobrepostos para o mesmo barbeiro |
| `scripts/telegram-comandos.mjs` | Registra o menu de comandos do bot (`setMyCommands`) |

Todas as contas de horário usam o fuso de Manaus (UTC-4), não o do servidor. Se o Telegram falhar ou o barbeiro não tiver `telegramChatId`, o agendamento é gravado do mesmo jeito; o erro só fica no log.

### O que o barbeiro faz pelo Telegram

| Comando / botão | Resultado |
|---|---|
| Botão **❌ Cancelar este horário** | Cancela (só se o agendamento for dele), a mensagem vira "❌ Cancelado" e o horário volta para o site. O bot manda um link pronto do WhatsApp para ele avisar o cliente |
| `/hoje` · `/amanha` | Clientes do dia, em ordem de horário |
| `/folga sabado` · `/folga 29/11` · `/folga amanha` | Fecha o dia dele no site (avisa e lista se já tiver cliente marcado, sem cancelar ninguém) |
| `/abrir sabado` | Desfaz a folga |
| `/start` | Qualquer pessoa: mostra o ID do Telegram |
| qualquer outro texto | Lista os comandos |

Fora o `/start`, só os IDs cadastrados em `api/_config.js` podem usar o bot. O cliente não recebe mensagem automática, porque o Telegram não manda mensagem para número de telefone: ele vê a confirmação na tela do site.

### 1. Testar no computador

`npm run dev` já responde as rotas `/api`. Sem as variáveis de ambiente, a agenda fica **na memória** (some quando o servidor reinicia) e as mensagens do Telegram **só aparecem no terminal**. Para simular o barbeiro no modo teste:

```bash
curl -X POST http://localhost:5173/api/telegram -H "Content-Type: application/json" \
  -d '{"message":{"chat":{"id":123},"text":"/start"}}'
```

### 2. Banco de dados (Supabase)

1. Crie um projeto em supabase.com (plano gratuito), na região **São Paulo**.
2. Abra **SQL Editor → New query**, cole `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API Keys**, copie a **Project URL** e a **secret key** (`sb_secret_...`) ou a antiga `service_role`. **Nunca use a publishable/anon key.**
4. Coloque `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` (modelo em `.env.example`) e na Vercel.

> Na Vercel, sem o Supabase configurado, a agenda recusa agendar (responde 503). Assim ela nunca roda furada na memória.

### 3. Criar o bot do Telegram

1. No Telegram, abra o **@BotFather**, mande `/newbot` e escolha um nome e um usuário que termine em `bot` (ex.: `barbearia5irmaos_bot`). Ele entrega o **token**.
2. Invente um segredo para o webhook: letras, números, `_` e `-` (ex.: `b5i_8f3k2m9q`).
3. Na Vercel, em **Settings → Environment Variables**, cadastre `TELEGRAM_BOT_TOKEN` e `TELEGRAM_WEBHOOK_SECRET` e faça um **Redeploy**. Coloque as duas também no `.env.local`.
4. Ative o webhook abrindo no navegador (troque os três pedaços):
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<dominio>/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```
   Deve aparecer `"ok":true`. Para conferir, abra `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`: a `url` tem que estar certa, e `last_error_message` não pode aparecer.
5. Registre o menu de comandos (uma vez só): `node --env-file=.env.local scripts/telegram-comandos.mjs`
6. **Cada barbeiro** abre o bot, manda `/start` e envia para você o ID que o bot responder. Cole o ID no `telegramChatId` dele em `api/_config.js`, faça commit e push.

### Trocar os dados de teste pelos reais

Edite só `api/_config.js`: `nome`, `telegramChatId` e `expediente` de cada barbeiro. Não troque o `id` de um barbeiro que já tem agendamentos gravados. Se mudar o cardápio no `index.html`, atualize `SERVICOS` com os mesmos nomes, durações e preços.
