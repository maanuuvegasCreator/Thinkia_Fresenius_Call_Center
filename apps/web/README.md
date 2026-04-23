# Thinkia — Web (Twilio Voice C1)

Next.js 14 (App Router) + Tailwind: APIs `/api/token` y `/api/voice`, y softphone en `/softphone`.

## Desarrollo

Desde la **raíz del monorepo**:

```bash
npm install
npm run dev:web
```

Abre [http://localhost:3000](http://localhost:3000) y enlaza a **Softphone**. Variables: copia `apps/web/.env.example` a `apps/web/.env`.

## Documentación sprint

- C1 ngrok / Twilio local: `docs/C1-NGROK-CHECKLIST.md`
- C2 deploy Vercel / Cloud Run: `docs/C2-DEPLOY-VERCEL.md`
- C2 E2E producción (login → token → llamadas): `docs/C2-E2E-CHECKLIST.md`
- SQL Supabase (agentes + enrutamiento entrante): `../../supabase/migrations/20260423140000_c2_agents_inbound_rls.sql`
- **C3** (93–99): índice `docs/C3-TICKETS-93-99.md` — multi-ring `docs/C3-MULTI-RING-TWILIO.md`, push/CallKit `docs/C3-PUSH-CALLKIT-SETUP.md`
- **C3 móvil** (Expo, fuera de workspaces npm): `../thinkia-mobile-expo/README.md`
- **C3 escritorio** (Tauri): `../thinkia-desktop-tauri/README.md`
- **Token móvil** (Supabase Bearer → JWT Twilio): `POST /api/token/mobile`

La UI legacy del call center sigue en la app Vite de la raíz (`npm run dev`).
