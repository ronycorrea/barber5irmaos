# Barbearia 5 Irmãos

Site da Barbearia 5 Irmãos: barba, cabelo e atitude.

- **Rodar no computador:** `npm install` e depois `npm run dev` (abre em http://localhost:5173)
- **Gerar a versão final:** `npm run build` (sai na pasta `dist/`)
- **Publicação:** na Vercel (framework Vite, build `npm run build`, pasta `dist`). Cada push na branch `main` publica de novo.

Feito com Vite, Three.js, GSAP e Lenis. Cadeira 3D: "Barber Chair", de sweedboy69 (CC BY 4.0), crédito em `CREDITOS-cadeira-3d.txt`.

---

## Agendamento

O cliente agenda pelo site, e o barbeiro fica sabendo e controla tudo **só pelo WhatsApp**. Não existe painel do barbeiro.

```
Site (src/agenda.js) ──► /api/horarios   horários livres de verdade
                    └──► /api/agendar    grava ──► WhatsApp do barbeiro (com botão "Cancelar este horário")
                                                └► WhatsApp do cliente (confirmação)
WhatsApp do barbeiro ──► /api/whatsapp   cancelar · "folga sábado" · "liberar sábado" · "agenda amanhã"
                              │
                         Supabase (Postgres): agendamentos + folgas
```

| Arquivo | O que faz |
|---|---|
| `api/_config.js` | **O único arquivo para editar:** barbeiros, WhatsApp de cada um, expediente, serviços, grade de 20 min, prazo de 7 dias |
| `api/horarios.js` | `GET ?barbeiro=<id\|livre>&data=AAAA-MM-DD&servico=<nome>` → horários livres |
| `api/agendar.js` | `POST` → valida de novo, grava, avisa no WhatsApp. `409` se o horário foi pego |
| `api/whatsapp.js` | Webhook da Meta: botão Cancelar e comandos de texto do barbeiro |
| `api/barbeiros.js` | Lista pública dos barbeiros (sem os números) |
| `supabase/schema.sql` | Tabelas. O banco impede dois agendamentos sobrepostos para o mesmo barbeiro |

Todas as contas de horário usam o fuso de Manaus (UTC-4), não o do servidor.

### O que o barbeiro pode fazer pelo WhatsApp

| Mandar / tocar | Resultado |
|---|---|
| Botão **Cancelar este horário** | Cancela, avisa o cliente e o horário volta a ficar livre no site |
| `folga sábado` · `folga amanhã` · `folga 29/11` | Fecha o dia dele no site (avisa se já tiver cliente marcado) |
| `liberar sábado` | Desfaz a folga |
| `agenda` · `agenda amanhã` | Lista os clientes do dia |
| qualquer outra coisa | Mostra a lista de comandos |

Só os números cadastrados em `api/_config.js` podem dar comandos. Se um cliente mandar mensagem para o número do sistema, ele recebe o link do WhatsApp da barbearia (`CONTATO_BARBEARIA`).

### 1. Testar no computador (sem Supabase e sem Meta)

`npm run dev` já responde as rotas `/api`. Sem as variáveis de ambiente, a agenda fica **na memória** (some quando o servidor reinicia) e as mensagens de WhatsApp **só aparecem no terminal**. Dá para agendar pelo site e ver o que cada um receberia.

Para simular o barbeiro (o webhook só aceita isso no modo teste):

```bash
curl -X POST http://localhost:5173/api/whatsapp -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"5592991004747","type":"text","text":{"body":"folga amanhã"}}]}}]}]}'
```

### 2. Banco de dados (Supabase)

1. Crie um projeto em supabase.com (plano gratuito). Na região, escolha **São Paulo**.
2. **SQL Editor → New query**, cole `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API Keys**, copie a **Project URL** e a **secret key** (`sb_secret_...`) ou a antiga `service_role`. **Nunca use a publishable/anon key.**
4. Copie `.env.example` para `.env.local` e preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Reinicie o `npm run dev`.

> Na Vercel, sem o Supabase configurado, a agenda recusa agendar (responde 503). Assim ela nunca roda furada na memória.

### 3. Vercel

Em **Settings → Environment Variables**, cadastre as mesmas variáveis do `.env.local` e faça um novo deploy. A pasta `api/` vira funções sozinha.

### 4. WhatsApp (Meta Cloud API)

1. Em developers.facebook.com, crie um app do tipo **Business** e adicione o produto **WhatsApp**. Use um número que **não** esteja no WhatsApp comum.
2. Copie o **Phone number ID** (`WHATSAPP_PHONE_NUMBER_ID`) e gere um **token permanente** em Business Settings → System users (`WHATSAPP_TOKEN`). O token temporário vence em 24 h.
3. O **App secret** fica em App settings → Basic (`WHATSAPP_APP_SECRET`).
4. **Webhook:** WhatsApp → Configuration → URL `https://SEU-SITE.vercel.app/api/whatsapp`. Invente um texto para o **Verify token** e coloque o mesmo em `WHATSAPP_VERIFY_TOKEN`. Assine o campo **messages**.
5. Crie os 3 modelos abaixo (WhatsApp Manager → Message templates), em **Português (BR)** e na categoria **Utilidade**. Se usar outros nomes, ajuste `WA_TEMPLATE_*`.

**`novo_agendamento_barbeiro`** (para o barbeiro), com um botão de **resposta rápida** chamado `Cancelar este horário`:
```
📅 Novo agendamento
Cliente: {{1}} · {{2}}
Serviço: {{3}} · R$ {{4}}
Quando: {{5}}
```

**`agendamento_confirmado`** (para o cliente):
```
Olá, {{1}}! Seu horário na Barbearia 5 Irmãos está confirmado: {{2}} com {{3}}, {{4}}. Pagamento na cadeira. Precisa remarcar? Fale com a gente: {{5}}
```

**`agendamento_cancelado`** (para o cliente):
```
Olá, {{1}}. O barbeiro precisou cancelar seu horário de {{2}} ({{3}}) na Barbearia 5 Irmãos. Desculpe o transtorno! Escolha outro horário em {{4}}
```

Enquanto os modelos não forem aprovados, o agendamento funciona normalmente, mas as mensagens falham. A falha fica registrada no log da Vercel e não derruba a reserva.

### Trocar os dados de teste pelos reais

Edite só `api/_config.js`: nomes, `whatsapp`, `expediente` e `CONTATO_BARBEARIA`. Não troque o `id` de um barbeiro que já tem agendamentos gravados. Se mudar o cardápio no `index.html`, atualize `SERVICOS` com os mesmos nomes, durações e preços.
