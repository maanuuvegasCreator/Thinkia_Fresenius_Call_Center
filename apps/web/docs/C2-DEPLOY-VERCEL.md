# C2 — Deploy Vercel / Cloud Run + env (AICONCTATC-89)

## Vercel (recomendado para esta app Next.js)

1. Crea un proyecto en [Vercel](https://vercel.com) y enlaza el repositorio.
2. **Root Directory**: `apps/web`. El archivo `apps/web/vercel.json` fuerza `npm ci` desde la **raíz del repo** para que respete el `package-lock.json` del monorepo y ejecuta **`npm run build:portal`** (Vite) antes de **`next build`**, de modo que el portal quede en `public/portal/` y todo viva en **un solo dominio**.
3. **Output Directory (Next)**: no pongas `dist`. Deja el campo vacío: Vercel usa el preset de Next.js y busca `.next` automáticamente. El `vercel.json` de esta carpeta incluye `"framework": "nextjs"` para que Vercel no trate el repo como Vite buscando `dist`.
4. **Si el build falla con** “No Output Directory named `dist` found”: el proyecto venía como **Vite**. En Vercel → **Settings** → **General** → **Framework Preset** elige **Next.js**. En **Build & Development** borra el valor de **Output Directory** (déjalo vacío; no `dist`). Guarda y vuelve a desplegar.
5. **Package manager**: hay `pnpm-lock.yaml` y `package-lock.json` en la raíz; **Vercel suele usar npm** si detecta `package-lock.json`. Si prefieres **pnpm**, en Settings → General elige *pnpm* y alinea lockfiles en tu rama.
6. **Install Command**: por defecto basta con instalar desde la raíz del repo (Vercel clona todo el monorepo aunque el Root Directory sea `apps/web`). `apps/web/vercel.json` fija `cd ../.. && npm ci`.
7. **Build Command**: `apps/web/vercel.json` fija `build:portal` + `next build`. No hace falta override manual salvo que quieras cambiarlo en el panel de Vercel.
8. **Variables de entorno** (Production + Preview), alineadas con `apps/web/.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (públicas).
   - `SUPABASE_SERVICE_ROLE_KEY` (secreta; solo servidor, nunca `NEXT_PUBLIC_`).
   - **`NEXT_PUBLIC_VITE_LOGIN_URL` (opcional)**: vacío = portal embebido en **`https://TU-DOMINIO/portal/`**. Si necesitas un segundo despliegue solo del portal, pon aquí su URL absoluta (o una ruta que empiece por `/`).
   - **`AUTH_HANDOFF_ALLOWED_ORIGIN`**: orígenes permitidos para el CORS de `POST /api/auth/handoff` (coma-separados). Con portal embebido, el propio dominio de Next se acepta **automáticamente** por coincidencia de `Origin` con el `Host` de la petición; esta variable sigue siendo útil para **portal en otro dominio** (legacy) o para `check:voice` / clientes móviles que reutilizan la lista.
   - Todas las `TWILIO_*` de `.env.example` (necesarias para voz y `/api/token`).
9. **Dominio estable**: en Vercel → Settings → Domains, asigna el dominio de producción (HTTPS incluido).
10. **Logs**: Vercel → proyecto → Logs (runtime y build). Revisa errores 401 en `/api/token` y 500 en `/api/voice`.

### Portal en un solo proyecto (recomendado)

No hace falta un segundo proyecto Vercel. El build raíz ejecuta `vite build` con `base: '/portal/'` y salida en `apps/web/public/portal`. Las rutas del SPA bajo `/portal/*` se resuelven con `rewrites` en `vercel.json` hacia `/portal/index.html` cuando no hay fichero estático (los assets en `/portal/assets/*` siguen sirviéndose con normalidad).

Variables en el portal Vite (`VITE_SUPABASE_*`) se leen en tiempo de build de Vite; en despliegue unificado conviene definir en Vercel las mismas credenciales Supabase que uses en Next (como `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` si el código del portal las exige en build).

### Legacy: segundo proyecto solo Vite

Si mantienes un proyecto aparte con preset **Vite** y **Output Directory** `dist`, define `NEXT_PUBLIC_VITE_LOGIN_URL` y `AUTH_HANDOFF_ALLOWED_ORIGIN` en el proyecto Next con el dominio público de ese portal.

## Cloud Run (contenedor)

1. Dockerfile multi-stage: desde la raíz del repo, ejecuta `npm run build:portal`, luego `next build` en `apps/web` y `next start` (puerto `8080` típico).
2. Inyecta las mismas variables por **Secret Manager** o flags `--set-env-vars`; la `service_role` solo en secretos.
3. **Cold start**: primera petición tras inactividad puede tardar; sube CPU mínima o mínimo de instancias si el SLA lo exige. Revisa logs de arranque y tiempo de `/api/voice` (Twilio espera respuesta rápida).

## Tras el deploy (AICONCTATC-90)

Actualiza en Twilio Console la **TwiML App** y el **número**: Voice URL `https://TU-DOMINIO/api/voice` (POST). Elimina dependencia de ngrok en producción estable.
