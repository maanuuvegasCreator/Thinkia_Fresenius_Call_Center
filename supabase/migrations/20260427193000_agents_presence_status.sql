-- Presencia UI del portal: persiste estado y filtra entrantes (solo 'available' muestra popup).

alter table public.agents
  add column if not exists presence_status text;

update public.agents
set presence_status = 'available'
where presence_status is null;

alter table public.agents
  alter column presence_status set default 'available';

alter table public.agents
  alter column presence_status set not null;

alter table public.agents drop constraint if exists agents_presence_status_check;

alter table public.agents
  add constraint agents_presence_status_check check (
    presence_status in (
      'available',
      'unavailable',
      'do_not_disturb',
      'be_right_back',
      'appear_away'
    )
  );

comment on column public.agents.presence_status is
  'Estado de presencia en el portal; solo ''available'' acepta popup de llamada entrante (Voice SDK).';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agents (user_id, display_name, operational_status, presence_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'offline',
    'available'
  );
  return new;
end;
$$;
