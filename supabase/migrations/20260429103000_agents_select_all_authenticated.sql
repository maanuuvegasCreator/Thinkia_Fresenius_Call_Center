-- Portal Analytics / directorio: lectura de todos los agentes para usuarios autenticados.
-- Las políticas RLS se combinan con OR: sigue existiendo agents_select_own; esta amplía SELECT.

drop policy if exists "agents_select_any_authenticated" on public.agents;
create policy "agents_select_any_authenticated" on public.agents
  for select
  to authenticated
  using (true);

comment on policy "agents_select_any_authenticated" on public.agents is
  'Listado de agentes para analytics y vistas de equipo; insert/update siguen restringidos a la propia fila.';
