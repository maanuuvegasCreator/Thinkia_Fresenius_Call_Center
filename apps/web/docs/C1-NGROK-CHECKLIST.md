# C1 — Ngrok, Twilio y pruebas manuales (AICONCTATC-83)

## Túnel HTTPS

1. Instala [ngrok](https://ngrok.com/) y autentica tu cuenta.
2. Arranca la app web: desde la raíz del repo, `npm run dev:web` (Next.js 14 App Router en `http://localhost:3000`).
3. Crea el túnel: `ngrok http 3000`.
4. Copia la URL `https://xxxx.ngrok-free.app` (HTTPS).

## URLs en Twilio

1. **TwiML App** (Console → Voice → TwiML apps): campo **Voice URL** = `https://xxxx.ngrok-free.app/api/voice`, método **POST**.
2. **Número de teléfono** (opcional en MVP): si las entradas van al número, en el número configura el webhook de voz a la misma URL POST `/api/voice` (o la que use tu flujo).
3. Asegúrate de que la TwiML App está enlazada al **API Key** usado en el token (`TWILIO_TWIML_APP_SID` en `.env`).

## Variables `.env` (carpeta `apps/web`)

Copia `.env.example` a `.env` y rellena credenciales (sin subir `.env` al repositorio).

## Checklist pruebas manuales

- [ ] **Sesión Supabase (C2)**: iniciar sesión en `/login` antes de probar el softphone; `GET /api/token` requiere cookies de sesión (401 si no hay login).
- [ ] `GET /api/token` devuelve JWT (texto plano) con servidor en marcha y env Twilio + Supabase correctos.
- [ ] `POST /api/voice` responde `Content-Type: text/xml` (probar con curl o la consola de Twilio “TwiML Bins” / reenvío de prueba).
- [ ] Softphone: permiso de micrófono concedido → “Conectar con Twilio” → estado **registrado** sin error.
- [ ] **Saliente**: marcar un número E.164 de prueba, comprobar que Twilio recibe el `To` y que suena / llega según configuración.
- [ ] **Entrante**: llamar al número Twilio desde un móvil, comprobar que el cliente `agente_prueba` recibe la llamada y se puede **Descolgar** / **Colgar**.
- [ ] **Mute** y **Colgar** durante una llamada activa.
- [ ] Navegador con micrófono **denegado**: mensaje claro y posibilidad de reintentar tras cambiar permisos.

Cuando ngrok cambie de URL, actualiza la TwiML App y el número en Twilio.
