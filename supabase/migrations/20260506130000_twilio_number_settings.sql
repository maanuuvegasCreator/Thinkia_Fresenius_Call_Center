-- Per-number settings stored in Supabase, synced with Twilio via backend.

create table if not exists public.twilio_number_settings (
  twilio_number_sid text primary key,
  phone_number_e164 text not null,
  respect_queuing_time boolean not null default false,
  priority boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint twilio_number_settings_phone_unique unique (phone_number_e164)
);

alter table public.twilio_number_settings enable row level security;

-- Only leads can manage via server; UI reads via API. For safety, no direct access to anon/authenticated.
revoke all on public.twilio_number_settings from anon;
revoke all on public.twilio_number_settings from authenticated;
grant all on public.twilio_number_settings to service_role;

create or replace function public.set_twilio_number_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists twilio_number_settings_set_updated_at on public.twilio_number_settings;
create trigger twilio_number_settings_set_updated_at
  before update on public.twilio_number_settings
  for each row execute function public.set_twilio_number_settings_updated_at();

