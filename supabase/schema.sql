-- Agenda da Barbearia 5 Irmãos. Rodar uma vez no Supabase: SQL Editor → New query → colar tudo → Run.

create extension if not exists btree_gist;

create table if not exists public.agendamentos (
  id            uuid primary key default gen_random_uuid(),
  barbeiro_id   text        not null,
  inicio        timestamptz not null,
  fim           timestamptz not null,
  servico       text        not null,
  preco         int         not null,
  cliente_nome  text        not null,
  cliente_fone  text        not null,
  status        text        not null default 'confirmado' check (status in ('confirmado', 'cancelado')),
  criado_em     timestamptz not null default now(),
  cancelado_em  timestamptz,
  check (fim > inicio),
  -- o próprio banco impede dois agendamentos confirmados sobrepostos com o mesmo barbeiro,
  -- mesmo que duas pessoas cliquem em "Confirmar" no mesmo segundo
  constraint sem_horario_sobreposto exclude using gist (
    barbeiro_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status = 'confirmado')
);
create index if not exists agendamentos_inicio on public.agendamentos (inicio);
create index if not exists agendamentos_fone on public.agendamentos (cliente_fone) where status = 'confirmado';

-- folgas avulsas (o barbeiro manda "folga sábado" no WhatsApp)
create table if not exists public.bloqueios (
  id           uuid primary key default gen_random_uuid(),
  barbeiro_id  text not null,
  data         date not null,
  motivo       text,
  criado_em    timestamptz not null default now(),
  unique (barbeiro_id, data)
);

-- ninguém de fora lê ou escreve: RLS ligado e nenhuma política. Só as funções /api, com a chave secreta
-- (service_role / sb_secret_...), passam, e essa chave nunca vai para o navegador.
alter table public.agendamentos enable row level security;
alter table public.bloqueios enable row level security;
revoke all on public.agendamentos, public.bloqueios from anon, authenticated;
