# Thinkia — Expo / React Native (AICONCTATC-94 … 97)

App **fuera** de los `workspaces` npm del monorepo (`package.json` raíz solo incluye `apps/web` y `apps/mobile-softphone`). Instalación local:

```bash
cd apps/thinkia-mobile-expo
npm install
npx expo start
```

## Twilio Voice SDK nativo

1. Instala el SDK: `npm i @twilio/voice-react-native-sdk`
2. `npx expo prebuild` para generar proyectos **ios/** y **android/**.
3. Sigue la [guía Twilio React Native](https://www.twilio.com/docs/voice/sdks/react-native) (CallKit / ConnectionService / push).

## Token con el backend actual

`POST https://<TU-NEXT>/api/token/mobile`  
Cabecera: `Authorization: Bearer <access_token>` del usuario (Supabase), el mismo JWT de sesión que obtienes tras `signIn` en la app móvil.

Variables en Expo (`.env` o `app.config.js`):

- `EXPO_PUBLIC_NEXT_API_BASE` — URL base del proyecto Next (sin barra final).

Orígenes CORS opcionales en Next: `TOKEN_MOBILE_ALLOWED_ORIGINS` o reutiliza `AUTH_HANDOFF_ALLOWED_ORIGIN` (ver `apps/web/docs/C3-TICKETS-93-99.md`).

## Push, CallKit, ConnectionService

Ver `apps/web/docs/C3-PUSH-CALLKIT-SETUP.md`.
