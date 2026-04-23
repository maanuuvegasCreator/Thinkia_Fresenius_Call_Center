# C3 — Tickets AICONCTATC-93 … 99 (estado en monorepo)

| Ticket | Descripción breve | En repo |
|--------|-------------------|---------|
| **93** | Tauri: web en escritorio, audio, build firmado | [`apps/thinkia-desktop-tauri/README.md`](../../thinkia-desktop-tauri/README.md) — inicializar con Rust + `npm create tauri-app` o seguir README; **no** se versiona binario firmado (política interna vuestra). |
| **94** | React Native + Twilio Voice móvil | [`apps/thinkia-mobile-expo`](../../thinkia-mobile-expo) — app Expo fuera de `npm` workspaces; Twilio Voice RN tras `expo prebuild`. Token: **`POST /api/token/mobile`** con `Authorization: Bearer` (Supabase). |
| **95** | Push APNs + FCM | [C3-PUSH-CALLKIT-SETUP.md](./C3-PUSH-CALLKIT-SETUP.md) — pasos y enlaces; credenciales en Twilio Console + Apple/Google (no automatizable en git). |
| **96** | iOS CallKit | Mismo doc + [Twilio Voice RN iOS](https://www.twilio.com/docs/voice/sdks/react-native); tras `prebuild`, configurar **Push** y **CallKit** según guía Twilio. |
| **97** | Android ConnectionService | Mismo doc + guía Android Twilio RN; pruebas pantalla bloqueada en dispositivo real. |
| **98** | Diseño multi-ring | [C3-MULTI-RING-TWILIO.md](./C3-MULTI-RING-TWILIO.md) |
| **99** | POC primer answer + cancelar ringing | **Web:** TwiML multi `<Client>` en `/api/voice` + mensaje en softphone al `cancel` entrante. **Móvil:** mismo backend; ringing lo gestiona Twilio entre patas. |

## Variables nuevas (Next)

| Variable | Uso |
|----------|-----|
| `TOKEN_MOBILE_ALLOWED_ORIGINS` | Opcional. Orígenes permitidos para **CORS** de `POST /api/token/mobile` (p. ej. Expo web). Si está vacío y el cliente **no** envía `Origin`, se acepta (típico en RN nativo). Si envía `Origin`, debe coincidir con alguna entrada (o reutiliza `AUTH_HANDOFF_ALLOWED_ORIGIN` si no defines esta). |

## Índice

- Multi-ring: `C3-MULTI-RING-TWILIO.md`
- Push / CallKit / ConnectionService: `C3-PUSH-CALLKIT-SETUP.md`
