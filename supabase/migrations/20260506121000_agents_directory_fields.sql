-- Add directory fields used by Users & Teams (portal).

alter table public.agents
  add column if not exists team_name text,
  add column if not exists phone_e164 text;

comment on column public.agents.team_name is 'Equipo del agente para directorio (portal).';
comment on column public.agents.phone_e164 is 'Teléfono E.164 para acciones de llamada en el portal.';

