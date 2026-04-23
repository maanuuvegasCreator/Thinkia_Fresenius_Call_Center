# C2 — Deploy Vercel / Cloud Run + env (AICONCTATC-89)

## Vercel (recomendado para esta app Next.js)

1. Crea un proyecto en [Vercel](https://vercel.com) y enlaza el repositorio.
2. **Root Directory**: `apps/web`. El archivo `apps/web/vercel.json` fuerza `npm ci` desde la **raíz del repo** para que respete el `package-lock.json` del monorepo.
3. **Output Directory (Next)**: en el proyecto Next **no pongas `dist`**. Deja el campo vacío o quita el override: Vercel usa el preset de Next.js y busca `.next` automáticamente. `dist` solo aplica al **segundo proyecto** (Vite estático).
4. **Package manager**: hay `pnpm-lock.yaml` y `package-lock.json` en la raíz; **Vercel suele usar npm** si detecta `package-lock.json`. Si prefieres **pnpm**, en Settings → General elige *pnpm* y borra o ignora `package-lock.json` en tu rama.
5. **Install Command** (por defecto basta): `npm install` o `pnpm install` en la **raíz del repo** (Vercel clona todo el monorepo aunque el Root Directory sea `apps/web`).
6. **Build Command** por defecto: `next build` (en el contexto de `apps/web`).
7. **Variables de entorno** (Production + Preview), alineadas con `apps/web/.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (públicas).
   - `SUPABASE_SERVICE_ROLE_KEY` (secreta; solo servidor, nunca `NEXT_PUBLIC_`).
   - `NEXT_PUBLIC_VITE_LOGIN_URL`: URL **pública** del portal de login (app Vite). Ejemplo: `https://tu-portal-vite.vercel.app` (debe coincidir con donde sirves el `dist` de Vite).
   - `AUTH_HANDOFF_ALLOWED_ORIGIN`: mismo origin que el navegador usa para abrir el portal Vite (sin barra final), p. ej. `https://tu-portal-vite.vercel.app`. Si pruebas con varios orígenes, sepáralos por comas.
   - Todas las `TWILIO_*` de `.env.example` (necesarias para voz y `/api/token`).
8. **Dominio estable**: en Vercel → Settings → Domains, asigna el dominio de producción (HTTPS incluido).
9. **Logs**: Vercel → proyecto → Logs (runtime y build). Revisa errores 401 en `/api/token` y 500 en `/api/voice`.

### Portal de login (Vite) en otro proyecto Vercel

El login Figma corre en la app **Vite** de la raíz del repo (`vite build` → carpeta `dist/`). Crea un **segundo** proyecto en Vercel con el mismo repo, **Root Directory** = raíz (`./`), preset **Vite**, **Output Directory** `dist`.

En la raíz del monorepo hay un `vercel.json` que fuerza **`npm ci`** + **`npm run build`** (usa `package-lock.json`). Así evitas el error de CI `ERR_PNPM_OUTDATED_LOCKFILE` cuando Vercel detecta `pnpm-lock.yaml` desfasado respecto a `package.json`.

Variables en ese proyecto: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (mismos valores que las `NEXT_PUBLIC_SUPABASE_*` del proyecto Next). Luego pon la URL del portal en `NEXT_PUBLIC_VITE_LOGIN_URL` y `AUTH_HANDOFF_ALLOWED_ORIGIN` del proyecto Next y redeploy.

## Cloud Run (contenedor)

1. Dockerfile multi-stage: build `apps/web` y `next start` (puerto `8080` típico).
2. Inyecta las mismas variables por **Secret Manager** o flags `--set-env-vars`; la `service_role` solo en secretos.
3. **Cold start**: primera petición tras inactividad puede tardar; sube CPU mínima o mínimo de instancias si el SLA lo exige. Revisa logs de arranque y tiempo de `/api/voice` (Twilio espera respuesta rápida).

## Tras el deploy (AICONCTATC-90)

Actualiza en Twilio Console la **TwiML App** y el **número**: Voice URL `https://TU-DOMINIO/api/voice` (POST). Elimina dependencia de ngrok en producción estable.
