-- Las políticas que hacen SELECT sobre public.agents dentro del USING de agents
-- provocan recursión infinita en RLS. Esta función corre como owner y evita RLS.

create or replace function public.auth_is_portal_lead()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select me.portal_role in ('admin', 'supervisor')
      from public.agents me
      where me.user_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

comment on function public.auth_is_portal_lead() is
  'True si el usuario autenticado es admin o supervisor del portal; usa en políticas RLS sin recursión.';

grant execute on function public.auth_is_portal_lead() to authenticated;

drop policy if exists "agents_select_directory_leads" on public.agents;
create policy "agents_select_directory_leads" on public.agents
  for select
  to authenticated
  using (public.auth_is_portal_lead());

drop policy if exists "voice_call_records_select_scoped" on public.voice_call_records;
create policy "voice_call_records_select_scoped" on public.voice_call_records
  for select
  to authenticated
  using (
    public.auth_is_portal_lead()
    or (
      agent_user_id is not null
      and agent_user_id = auth.uid()
    )
  );
