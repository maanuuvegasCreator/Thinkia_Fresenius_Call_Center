import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mintTwilioVoiceJwt } from '@/lib/twilio-voice-token';

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

    const minted = mintTwilioVoiceJwt(user.id);
    if ('error' in minted) {
      return new Response(JSON.stringify({ error: minted.error }), {
        status: minted.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(minted.jwt, {
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
