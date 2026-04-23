-- AICONCTATC-86: agentes ligados a auth.users + RLS por user_id
-- AICONCTATC-88: enrutamiento entrante (base multi-ring con array de user_id)

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  operational_status text not null default 'offline',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agents_user_id_key unique (user_id),
  constraint agents_operational_status_check check (
    operational_status in ('offline', 'available', 'busy')
  )
);

create index if not exists agents_user_id_idx on public.agents (user_id);

create table if not exists public.inbound_routing (
  id uuid primary key default gen_random_uuid(),
  twilio_to_number text not null,
  business_key text,
  agent_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint inbound_routing_twilio_to_number_key unique (twilio_to_number)
);

alter table public.agents enable row level security;
alter table public.inbound_routing enable row level security;

drop policy if exists "agents_select_own" on public.agents;
create policy "agents_select_own" on public.agents for select using (auth.uid() = user_id);

drop policy if exists "agents_insert_own" on public.agents;
create policy "agents_insert_own" on public.agents for insert with check (auth.uid() = user_id);

drop policy if exists "agents_update_own" on public.agents;
create policy "agents_update_own" on public.agents for update using (auth.uid() = user_id);

-- Sin políticas para anon/authenticated en inbound_routing: solo service_role (webhook Twilio) accede vía API server-side

revoke all on public.agents from anon;
revoke all on public.inbound_routing from anon;
revoke all on public.inbound_routing from authenticated;

grant select, insert, update on public.agents to authenticated;
grant all on public.agents to service_role;
grant all on public.inbound_routing to service_role;

create or replace function public.set_agents_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists agents_set_updated_at on public.agents;
create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_agents_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agents (user_id, display_name, operational_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'offline'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on table public.agents is 'Perfil agente; RLS por user_id (AICONCTATC-86)';
comment on table public.inbound_routing is 'Mapeo número Twilio → agentes (UUID auth); multi-ring vía array (AICONCTATC-88)';
