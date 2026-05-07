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

Requisitos previos:

- **`android/local.properties`** con `sdk.dir=...` (Android SDK).
- **`.env`** con `EXPO_PUBLIC_*` (mismo contenido que necesitas para `expo start`).
- **`android/app/google-services.json`** (Firebase): el SDK de Twilio en Android llama a `FirebaseMessaging.getInstance().getToken()` al registrarse. Sin Firebase bien configurado, la app puede **cerrarse sola** justo al mostrar «Registrando en Twilio…». Crea un proyecto en [Firebase Console](https://console.firebase.google.com), añade una app Android con el id **`com.thinkia.mobile`**, activa Cloud Messaging y descarga el JSON a `apps/thinkia-mobile-expo/android/app/google-services.json`.

Alternativa manual (tras copiar el proyecto a `C:\Temp\...`):

`.\gradlew.bat assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a` (sin `--project-cache-dir` en algunos equipos Windows falla al borrar `buildOutputCleanup.lock`).

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

## iOS (sin pagar) — “paridad” con app abierta

Sin **Apple Developer Program** no es posible conseguir **entrantes con pantalla bloqueada** (VoIP Push + CallKit).
Lo que sí podemos validar gratis es:

- iOS compila en modo dev.
- Login + `POST /api/token/mobile` + `Voice.register(...)` funcionan.
- Entrantes/salientes **con la app abierta** (foreground).

Requisitos prácticos:

- Para compilar iOS local necesitas **Mac + Xcode**.
- Alternativa sin Mac: dejar el repo listo y cuando haya Apple Developer usar **EAS Build** (cloud).

Checklist (local en Mac):

```bash
cd apps/thinkia-mobile-expo
cp .env.example .env
npm install

# Genera ios/ (y android/ si hace falta)
npx expo prebuild --platform ios

# Compila e instala en un iPhone conectado (requiere Xcode)
npx expo run:ios --device
```

Notas:

- `expo prebuild --platform ios` **no se puede ejecutar en Windows** (Expo lo bloquea); hay que hacerlo en macOS.
- iOS pedirá permiso de micrófono al contestar/hacer llamada.
- Para que “suene bloqueado” (CallKit) ver `apps/web/docs/C3-PUSH-CALLKIT-SETUP.md` y requiere Apple Developer + credenciales APNs en Twilio.

`@twilio/voice-react-native-sdk@2.0.0-preview.1` está alineado con **Expo 52** según Twilio. En Android, **FCM es obligatorio para `Voice.register()`**: el `google-services.json` debe estar en **`android/app/`** (y el plugin `com.google.gms.google-services` ya está aplicado en el `build.gradle` nativo). `app.config.ts` usa la misma ruta si ejecutas `expo prebuild`.

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
