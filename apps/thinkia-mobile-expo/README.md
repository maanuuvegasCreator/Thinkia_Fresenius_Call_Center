# Thinkia — Expo / softphone móvil (C3 / AICONCTATC-94–97)

App **fuera** de los `workspaces` npm del monorepo (la raíz solo instala `apps/web` y `apps/mobile-softphone`). Instala dependencias aquí:

```bash
cd apps/thinkia-mobile-expo
cp .env.example .env
# Edita .env con Supabase + URL base de Next (Vercel o túnel).
npm install
```

## APK release (local)

Si Gradle falla en el Escritorio con **OneDrive** o **ninja: build.ninja still dirty**, usa el script que copia a `%TEMP%` y compila allí:

```powershell
cd apps/thinkia-mobile-expo
npm run build:apk
```

Requisitos previos: **`android/local.properties`** con `sdk.dir=...` (Android SDK) y **`.env`** con `EXPO_PUBLIC_*` (mismo contenido que necesitas para `expo start`).

Alternativa manual (tras copiar el proyecto a `C:\Temp\...`):

`.\gradlew.bat assembleRelease --no-daemon --project-cache-dir C:\Temp\thinkia-gradle-project-cache -PreactNativeArchitectures=arm64-v8a`

Exporta `NODE_ENV=production` antes de Gradle si ves avisos de Expo al empaquetar.

El APK queda en **`artifacts/Thinkia-Mobile-arm64-v8a-release.apk`** (~100 MB, **solo arm64-v8a**; firma release = keystore **debug** de plantilla, válido para pruebas internas).

**Si la APK se cierra al abrir:** casi siempre es (1) **Twilio** cargando en frío sin sesión — ya se carga solo tras login (`React.lazy`); (2) **sin `.env` en el momento del `gradlew assembleRelease`**, así que `EXPO_PUBLIC_*` van vacías. Copia `.env` con Supabase + URL Next **antes** de compilar; `expo start` no rellena la release.

## Arranque

- **Metro (JS):** `npx expo start`
- **Binarios nativos (Twilio Voice 2.x):** hace falta proyecto nativo generado una vez:

```bash
npx expo prebuild
npx expo run:ios
# o
npx expo run:android
```

`@twilio/voice-react-native-sdk@2.0.0-preview.1` está alineado con **Expo 52** según Twilio. Para **llamadas entrantes en Android** añade `google-services.json` en esta carpeta (Expo lo enlaza si existe; ver `app.config.ts`).

## Funcionalidad en la app

1. Login con **email y contraseña** (mismo Supabase que el portal / Vite).
2. Registro en Twilio con `POST …/api/token/mobile` y `Authorization: Bearer` (access token Supabase).
3. **Saliente:** `Voice.connect` con `params: { To: '<número>' }` (misma convención que el softphone web).
4. **Entrante:** `Voice.Event.CallInvite` → contestar / rechazar.
5. **Silenciar / colgar** en la llamada activa.
6. Refresco periódico del JWT Twilio (cada 45 min) sobre la sesión Supabase actual.

## Variables de entorno

Ver `.env.example`:

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_NEXT_API_BASE` — origen del Next donde está `POST /api/token/mobile`

CORS: si usas un cliente que envía `Origin`, configura `TOKEN_MOBILE_ALLOWED_ORIGINS` o `AUTH_HANDOFF_ALLOWED_ORIGIN` en Next (`apps/web/docs/C3-TICKETS-93-99.md`).

## Push, CallKit, ConnectionService

`apps/web/docs/C3-PUSH-CALLKIT-SETUP.md`.
