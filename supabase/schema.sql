-- Schema do Atomus para Supabase (Postgres)
--
-- Como usar:
-- 1. Abra o seu projeto em supabase.com
-- 2. Vá em "SQL Editor" (menu lateral)
-- 3. Cole todo este arquivo e clique em "Run"
--
-- Isso cria as 3 tabelas (clínicas, pacientes, atendimentos) e configura
-- a segurança para que cada usuário só veja e edite os próprios dados
-- (Row Level Security).

create table public.clinicas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,
  cor text not null,
  percentual numeric not null default 100,
  endereco text,
  created_at timestamptz not null default now()
);

create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,
  tutor text,
  telefone text,
  especie text,
  forma_pagamento_preferida text,
  dias_preferidos text,
  horario_preferido text,
  endereco text,
  created_at timestamptz not null default now()
);

create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  paciente_id uuid not null references public.pacientes (id) on delete cascade,
  clinica_id uuid references public.clinicas (id) on delete set null,
  data date not null,
  hora text not null,
  procedimento text,
  valor numeric,
  forma_pagamento text,
  status text not null default 'agendado',
  pago boolean not null default false,
  data_pagamento date,
  created_at timestamptz not null default now()
);

-- Índices para as consultas mais comuns (agenda por data, financeiro por clínica)
create index clinicas_user_id_idx on public.clinicas (user_id);
create index pacientes_user_id_idx on public.pacientes (user_id);
create index atendimentos_user_id_idx on public.atendimentos (user_id);
create index atendimentos_data_idx on public.atendimentos (user_id, data);
create index atendimentos_clinica_idx on public.atendimentos (clinica_id);
create index atendimentos_paciente_idx on public.atendimentos (paciente_id);

-- Row Level Security: cada usuário só acessa as próprias linhas
alter table public.clinicas enable row level security;
alter table public.pacientes enable row level security;
alter table public.atendimentos enable row level security;

create policy "Isolamento por usuário" on public.clinicas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Isolamento por usuário" on public.pacientes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Isolamento por usuário" on public.atendimentos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Controle de estoque (insumos e produtos usados nos atendimentos)
create table public.produtos_estoque (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,
  quantidade numeric not null default 0,
  unidade text not null default 'un',
  estoque_minimo numeric not null default 0,
  created_at timestamptz not null default now()
);

create index produtos_estoque_user_id_idx on public.produtos_estoque (user_id);

alter table public.produtos_estoque enable row level security;

create policy "Isolamento por usuário" on public.produtos_estoque
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Controle de despesas (saídas: insumos, investimentos, cursos, custos operacionais...)
create table public.despesas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,
  categoria text not null default 'outro',
  quantidade numeric not null default 1,
  valor_unitario numeric not null default 0,
  valor_total numeric not null default 0,
  forma_pagamento text,
  data_compra date not null default current_date,
  created_at timestamptz not null default now()
);

create index despesas_user_id_idx on public.despesas (user_id);
create index despesas_data_idx on public.despesas (user_id, data_compra);

alter table public.despesas enable row level security;

create policy "Isolamento por usuário" on public.despesas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Duração dos atendimentos: horário de término passa a ser obrigatório
alter table public.atendimentos add column hora_fim text;

update public.atendimentos
set hora_fim = to_char((hora || ':00')::time + interval '50 minutes', 'HH24:MI')
where hora_fim is null;

alter table public.atendimentos
  alter column hora_fim set not null,
  add constraint atendimentos_horario_valido check (hora_fim > hora);

-- Backup automático diário (roda dentro do próprio Supabase, via pg_cron).
-- Tabela sem nenhuma política de RLS: fica inacessível para o app (anon/
-- authenticated), só é lida/gravada via acesso administrativo direto ao banco.
create table public.backups_diarios (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  conteudo jsonb not null
);

alter table public.backups_diarios enable row level security;

create or replace function public.criar_backup_diario()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.backups_diarios (conteudo)
  values (
    jsonb_build_object(
      'clinicas', (select coalesce(jsonb_agg(t), '[]'::jsonb) from public.clinicas t),
      'pacientes', (select coalesce(jsonb_agg(t), '[]'::jsonb) from public.pacientes t),
      'atendimentos', (select coalesce(jsonb_agg(t), '[]'::jsonb) from public.atendimentos t),
      'produtos_estoque', (select coalesce(jsonb_agg(t), '[]'::jsonb) from public.produtos_estoque t),
      'despesas', (select coalesce(jsonb_agg(t), '[]'::jsonb) from public.despesas t)
    )
  );

  -- mantém só os últimos 30 backups para a tabela não crescer indefinidamente
  delete from public.backups_diarios
  where id not in (
    select id from public.backups_diarios order by criado_em desc limit 30
  );
end;
$$;

create extension if not exists pg_cron;

-- 02:00 UTC = 23:00 no horário de Brasília (o agendador do Supabase roda em UTC)
select cron.schedule('backup-diario-atomus', '0 2 * * *', $$select public.criar_backup_diario();$$);

-- Cadastro completo do cliente: CPF/raça/idade (opcionais) e clínica de
-- referência (usada para puxar o endereço automaticamente quando o paciente
-- não é particular).
alter table public.pacientes
  add column cpf text,
  add column raca text,
  add column idade text,
  add column clinica_id uuid references public.clinicas (id) on delete set null;

create index pacientes_clinica_idx on public.pacientes (clinica_id);

-- Atendimento em residência: paciente vinculado a uma clínica mas atendido
-- na casa dele (usa a coluna "endereco", que fica sem uso quando não é particular).
alter table public.pacientes
  add column atendido_em_residencia boolean not null default false;

-- Pacotes de sessões (opcional, um por paciente).
create table public.pacotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  paciente_id uuid not null unique references public.pacientes (id) on delete cascade,
  total_sessoes integer not null default 0,
  sessoes_usadas integer not null default 0,
  minimo_renovacao integer not null default 0,
  created_at timestamptz not null default now()
);

create index pacotes_user_id_idx on public.pacotes (user_id);

alter table public.pacotes enable row level security;

create policy "Isolamento por usuário" on public.pacotes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
