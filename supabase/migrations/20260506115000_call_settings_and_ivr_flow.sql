-- Call settings + IVR flow persistence (Twilio-backed).
-- Keeps UI configuration real and publishable to Twilio via /api/voice.

create table if not exists public.call_settings (
  id text primary key default 'default',
  wrap_up_seconds integer not null default 30,
  auto_close_conversation boolean not null default false,
  auto_end_wrap_up boolean not null default false,
  always_on_top boolean not null default false,
  external_forward_number text,
  blocked_numbers text[] not null default '{}',
  inbound_recording_enabled boolean not null default true,
  inbound_pause_recording_enabled boolean not null default true,
  outbound_recording_enabled boolean not null default true,
  hold_message_enabled boolean not null default true,
  hold_message_delay_seconds integer not null default 30,
  business_hours_message text,
  after_hours_message text,
  outbound_recording_message text,
  hold_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists call_settings_singleton_uidx on public.call_settings (id);

create table if not exists public.ivr_flow (
  id uuid primary key default gen_random_uuid(),
  twilio_to_number text not null,
  flow_json jsonb not null,
  version integer not null default 1,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ivr_flow_twilio_to_number_key unique (twilio_to_number)
);

create index if not exists ivr_flow_to_number_idx on public.ivr_flow (twilio_to_number);

alter table public.call_settings enable row level security;
alter table public.ivr_flow enable row level security;

-- For now, allow authenticated users to manage settings.
-- You can tighten this later (e.g., only ADMIN) once roles are wired.
drop policy if exists "call_settings_authenticated_rw" on public.call_settings;
create policy "call_settings_authenticated_rw"
  on public.call_settings
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "ivr_flow_authenticated_rw" on public.ivr_flow;
create policy "ivr_flow_authenticated_rw"
  on public.ivr_flow
  for all
  to authenticated
  using (true)
  with check (true);

revoke all on public.call_settings from anon;
revoke all on public.ivr_flow from anon;

grant select, insert, update, delete on public.call_settings to authenticated;
grant select, insert, update, delete on public.ivr_flow to authenticated;
grant all on public.call_settings to service_role;
grant all on public.ivr_flow to service_role;

create or replace function public.set_updated_at_generic()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists call_settings_set_updated_at on public.call_settings;
create trigger call_settings_set_updated_at
  before update on public.call_settings
  for each row execute function public.set_updated_at_generic();

drop trigger if exists ivr_flow_set_updated_at on public.ivr_flow;
create trigger ivr_flow_set_updated_at
  before update on public.ivr_flow
  for each row execute function public.set_updated_at_generic();

