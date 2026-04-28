-- Registro de llamadas Voice (Twilio status callback) para Analytics en el portal.

create table if not exists public.voice_call_records (
  id uuid primary key default gen_random_uuid(),
  twilio_call_sid text not null,
  parent_call_sid text,
  account_sid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  direction text not null,
  call_status text not null,
  duration_seconds integer,
  from_number text,
  to_number text,
  agent_user_id uuid references auth.users (id) on delete set null,
  constraint voice_call_records_twilio_call_sid_key unique (twilio_call_sid),
  constraint voice_call_records_direction_check check (
    direction in ('inbound', 'outbound', 'unknown')
  )
);

create index if not exists voice_call_records_created_at_idx on public.voice_call_records (created_at desc);
create index if not exists voice_call_records_agent_user_id_idx on public.voice_call_records (agent_user_id);
create index if not exists voice_call_records_top_level_created_idx
  on public.voice_call_records (created_at desc)
  where parent_call_sid is null;

alter table public.voice_call_records enable row level security;

drop policy if exists "voice_call_records_select_authenticated" on public.voice_call_records;
create policy "voice_call_records_select_authenticated"
  on public.voice_call_records
  for select
  to authenticated
  using (true);

revoke all on public.voice_call_records from anon;
grant select on public.voice_call_records to authenticated;
grant all on public.voice_call_records to service_role;

create or replace function public.set_voice_call_records_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists voice_call_records_set_updated_at on public.voice_call_records;
create trigger voice_call_records_set_updated_at
  before update on public.voice_call_records
  for each row execute function public.set_voice_call_records_updated_at();

comment on table public.voice_call_records is
  'Eventos de llamada Twilio (status callback). KPIs del portal usan filas con parent_call_sid null.';
