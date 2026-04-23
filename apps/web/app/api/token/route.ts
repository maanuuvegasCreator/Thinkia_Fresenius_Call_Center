import twilio from 'twilio';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { twilioClientIdentityFromUserId } from '@/lib/twilio-identity';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

/**
 * GET /api/token — JWT Twilio con sesión Supabase (AICONCTATC-87).
 * Identidad Client = derivada de auth.users.id (sin secretos en cliente).
 */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autenticado. Inicia sesión.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const outgoingApplicationSid = process.env.TWILIO_TWIML_APP_SID;

    if (!accountSid || !apiKeySid || !apiKeySecret || !outgoingApplicationSid) {
      return new Response(
        JSON.stringify({
          error:
            'Faltan variables Twilio (TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID).',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const identity = twilioClientIdentityFromUserId(user.id);

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    });

    const voiceGrant = new VoiceGrant({
      incomingAllow: true,
      outgoingApplicationSid,
    });

    token.addGrant(voiceGrant);

    return new Response(token.toJwt(), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al emitir token';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
