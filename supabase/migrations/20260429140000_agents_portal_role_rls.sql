-- Roles del portal: agent | supervisor | admin (Analytics, equipos, números, etc.).
-- David Alejano → supervisor (ajusta el email si tu cuenta usa otro dominio).

alter table public.agents
  add column if not exists portal_role text not null default 'agent';

alter table public.agents drop constraint if exists agents_portal_role_check;

alter table public.agents
  add constraint agents_portal_role_check check (
    portal_role in ('agent', 'supervisor', 'admin')
  );

comment on column public.agents.portal_role is
  'Rol en el portal Vite: agent (operador), supervisor, admin. Afecta menú y RLS de lectura.';

-- Cuenta supervisor (email contiene davidalejano, típico fresenius.es / empresa).
update public.agents a
set portal_role = 'supervisor'
from auth.users u
where a.user_id = u.id
  and lower(coalesce(u.email, '')) like '%davidalejano%';

-- Sustituye la política "todos los agentes visibles" por: solo propia fila, o admin/supervisor ven directorio.
drop policy if exists "agents_select_any_authenticated" on public.agents;

drop policy if exists "agents_select_directory_leads" on public.agents;
create policy "agents_select_directory_leads" on public.agents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.agents me
      where me.user_id = auth.uid()
        and me.portal_role in ('admin', 'supervisor')
    )
  );

-- voice_call_records: agentes solo ven filas asignadas a ellos; admin/supervisor ven todo.
drop policy if exists "voice_call_records_select_authenticated" on public.voice_call_records;

drop policy if exists "voice_call_records_select_scoped" on public.voice_call_records;
create policy "voice_call_records_select_scoped" on public.voice_call_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.agents me
      where me.user_id = auth.uid()
        and me.portal_role in ('admin', 'supervisor')
    )
    or (
      agent_user_id is not null
      and agent_user_id = auth.uid()
    )
  );
