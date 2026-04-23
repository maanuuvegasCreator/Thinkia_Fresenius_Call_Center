# C2 — E2E producción: login → token → llamadas (AICONCTATC-92)

Escenarios según capacidad de prueba: **dos agentes** (dos cuentas Supabase / dos navegadores) o **un agente + PSTN**.

## Precondiciones

- [ ] Migración SQL aplicada en Supabase (`supabase/migrations/...c2_agents_inbound_rls.sql`).
- [ ] Variables en producción (Vercel/Run): Supabase + Twilio (ver `C2-DEPLOY-VERCEL.md`).
- [ ] Fila en `public.inbound_routing`: `twilio_to_number` = número Twilio en E.164, `agent_user_ids` = array de UUID de `auth.users` de los agentes que deben sonar.
- [ ] Webhooks Twilio apuntan a la URL de producción (AICONCTATC-90).

## Flujo

1. [ ] **Login**: cada agente abre `/login`, email/contraseña válidos en Supabase Auth.
2. [ ] **Softphone**: accede a `/softphone` (solo con sesión); presencia **Disponible** tras registrar Twilio.
3. [ ] **Token**: en red, `GET /api/token` con cookies de sesión devuelve 200 y JWT texto (no 401).
4. [ ] **Saliente (agente + PSTN)**: marca un móvil E.164; la llamada sale con `TWILIO_CALLER_ID`.
5. [ ] **Entrante (PSTN → agentes)**: llama al número Twilio; suenan los clientes mapeados en `inbound_routing`; uno **Descuelga** / **Cuelga** correctamente.
6. [ ] **Dos agentes**: con dos `agent_user_ids` en el mismo `inbound_routing`, ambos reciben la entrante (multi-ring); el primero en contestar enlaza la llamada.
7. [ ] **Mute / Colgar** en llamada activa.
8. [ ] **Cerrar sesión** y comprobar que `/softphone` redirige a `/login`.
