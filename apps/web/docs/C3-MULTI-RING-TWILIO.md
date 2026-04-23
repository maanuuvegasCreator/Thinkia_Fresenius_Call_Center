# C3 — Diseño multi-ring Twilio Client (AICONCTATC-98)

## Objetivo

Varias **identidades WebRTC** (`Client`) pueden sonar a la vez para una **misma** llamada entrante PSTN. El **primer cliente que descuelga** enlaza la llamada; el resto debe **dejar de sonar** (ringing cancelado).

## Cómo lo hace hoy el backend (C2 / AICONCTATC-88)

`POST /api/voice` (Next) resuelve `public.inbound_routing` por `To` (número Twilio en E.164) y obtiene `agent_user_ids[]`. Para cada UUID genera una identidad estable `client:…` (ver `lib/twilio-identity.ts`) y emite TwiML:

```xml
<Dial timeout="45">
  <Client>…</Client>
  <Client>…</Client>
</Dial>
```

Twilio **simultaneous ring** a todos los `<Client>` del mismo `<Dial>`. Cuando **uno acepta**, Twilio cancela las patas pendientes; los SDKs reciben eventos (`cancel` / `reject`) en los clientes que no ganaron.

## Limitaciones

1. **Misma identidad en dos navegadores** con el mismo `user_id` generan la **misma** `Client` identity: Twilio puede tratarlos como un solo endpoint o comportarse de forma no deseada según versión. Para **dos pestañas del mismo usuario**, el multi-ring real suele requerir **dos `user_id` distintos** (dos agentes) o política explícita de Twilio.
2. **Timeout**: `timeout` en `<Dial>` (p. ej. 45 s) cuelga el ring a todos si nadie contesta.
3. **Identidad JWT** (`GET /api/token`) debe coincidir con las identidades del TwiML; si no, el ring no llega al cliente correcto.
4. **Push móvil** (C3-95/96/97): el flujo web anterior no cubre despertar la app en segundo plano; eso es otro pipeline (VoIP push + CallKit / ConnectionService).

## Riesgos

- **CORS / cookies** entre portal Vite y Next afectan solo al **login** y handoff; no al audio Twilio una vez registrado en el dominio Next.
- **RLS / `agents`**: los agentes deben existir en Auth y, si la UI consulta `agents`, respetar políticas.
- **Producción**: webhooks Twilio deben apuntar al mismo entorno que emite el TwiML (`AICONCTATC-90`).

## Cliente web (AICONCTATC-99)

El softphone (`TwilioSoftphone.tsx`) debe:

- Escuchar `cancel` / `reject` en la `Call` entrante y limpiar UI (otro dispositivo contestó o timeout).
- Opcional: mensaje breve al usuario cuando la entrante se cancela sin acción local.

## Referencias

- [Twilio Dial Client](https://www.twilio.com/docs/voice/twiml/dial)
- [Twilio Voice JS SDK — Device](https://www.twilio.com/docs/voice/sdks/javascript/twiliodevice)
