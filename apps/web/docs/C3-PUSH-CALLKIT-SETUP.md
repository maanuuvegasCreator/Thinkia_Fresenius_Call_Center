# C3 — Push (95), CallKit (96), ConnectionService (97)

Estos puntos **no** se pueden “cerrar” solo con código en el servidor: requieren **Apple Developer**, **Google Cloud / Firebase**, **Twilio Console** (credenciales VoIP push) y **builds nativos** en dispositivos.

## Orden recomendado

1. **Expo prebuild** en `apps/thinkia-mobile-expo` (`npx expo prebuild`) para generar `ios/` y `android/`.
2. **Twilio Voice React Native SDK** (`@twilio/voice-react-native-sdk`) siguiendo la [documentación oficial](https://www.twilio.com/docs/voice/sdks/react-native).
3. **Push VoIP**
   - **iOS:** certificado / clave APNs en Twilio; capability Push + Background modes (Voice over IP).
   - **Android:** FCM en Firebase; servidor de push enlazado en Twilio para credenciales Android.
4. **CallKit (iOS)** y **ConnectionService (Android)**  
   El SDK de Twilio y las guías de integración describen cómo mostrar **llamadas entrantes nativas** y paridad entre plataformas. Revisad la versión **2.x** del SDK si usáis **Expo** (soporte documentado por Twilio).

## Paridad mínima con web (94)

| Web (`TwilioSoftphone`) | Móvil (SDK RN) |
|-------------------------|----------------|
| `GET /api/token` + cookies | `POST /api/token/mobile` + `Authorization: Bearer` (access token Supabase del login en app) |
| `Device.register()` | `voice.register(token)` |
| Colgar / mute / marcar | `call.disconnect()`, `call.mute()`, `connect` con params `To` |

## Pruebas pantalla bloqueada (97)

Tras integrar ConnectionService + permisos, validar en **hardware real** con pantalla apagada y llamada entrante de prueba desde Twilio.

## Referencias

- [Twilio — Voice React Native](https://www.twilio.com/docs/voice/sdks/react-native)
- [Twilio — Apple VoIP push](https://www.twilio.com/docs/voice/sdks/ios) (sección push / CallKit en documentación iOS)
- [Expo — notifications](https://docs.expo.dev/push-notifications/overview/) (FCM / APNs con EAS)
