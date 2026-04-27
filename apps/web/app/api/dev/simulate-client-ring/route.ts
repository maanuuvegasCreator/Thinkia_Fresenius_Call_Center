import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { twilioClientIdentityFromUserId } from '@/lib/twilio-identity';

export const dynamic = 'force-dynamic';

/**
 * Simula una “entrante” en el Voice SDK: Twilio crea una llamada **saliente** hacia `client:<identity>`
 * del usuario logueado; el navegador registrado recibe el evento `incoming` (demo para jefa / QA).
 *
 * Requiere `ALLOW_CLIENT_RING_SIMULATION=true` y un `TWILIO_CALLER_ID` que soporte **voz** (no solo SMS).
 * Tras la demo, borra la variable o pon `false`.
 */
export async function POST() {
  if (process.env.ALLOW_CLIENT_RING_SIMULATION !== 'true') {
    return NextResponse.json(
      { error: 'Simulación desactivada. Pon ALLOW_CLIENT_RING_SIMULATION=true en Vercel y redeploy.' },
      { status: 404 }
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autenticado. Inicia sesión en el portal primero.' }, { status: 401 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const from = process.env.TWILIO_CALLER_ID;
  if (!accountSid || !apiKeySid || !apiKeySecret || !from) {
    return NextResponse.json({ error: 'Faltan variables Twilio en el servidor.' }, { status: 500 });
  }

  const identity = twilioClientIdentityFromUserId(user.id);
  const client = twilio(apiKeySid, apiKeySecret, { accountSid });

  try {
    const call = await client.calls.create({
      to: `client:${identity}`,
      from,
      twiml: '<Response><Pause length="45"/></Response>',
    });
    return NextResponse.json({
      ok: true,
      callSid: call.sid,
      dialed: `client:${identity}`,
      hint: 'Debería sonar el modal en el portal si Twilio Device está registrado.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error Twilio';
    return NextResponse.json(
      {
        error: msg,
        hint: 'Si el número en TWILIO_CALLER_ID es solo SMS, Twilio rechazará la llamada. Usa un número con Voice.',
      },
      { status: 502 }
    );
  }
}
