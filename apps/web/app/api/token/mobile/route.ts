import { NextResponse } from 'next/server';
import { mintTwilioVoiceJwt } from '@/lib/twilio-voice-token';

function corsHeaders(origin: string | null) {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

/** Orígenes opcionales (Expo web, etc.). RN nativo suele no enviar Origin. */
function isOriginOk(origin: string | null): boolean {
  if (!origin) return true;
  const raw =
    process.env.TOKEN_MOBILE_ALLOWED_ORIGINS ?? process.env.AUTH_HANDOFF_ALLOWED_ORIGIN ?? '';
  const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) return true;
  try {
    const o = new URL(origin).origin;
    return entries.some((e) => {
      try {
        return new URL(e).origin === o;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * POST /api/token/mobile — JWT Twilio para apps móviles (C3 / AICONCTATC-94).
 * Auth: `Authorization: Bearer <access_token>` de Supabase (misma sesión que el portal).
 * Si el cliente envía `Origin` (p. ej. Expo web), debe estar en TOKEN_MOBILE_ALLOWED_ORIGINS
 * o en AUTH_HANDOFF_ALLOWED_ORIGIN (coma-separados).
 */
export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  if (!isOriginOk(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (!isOriginOk(origin)) {
    return NextResponse.json({ error: 'Origin no permitido' }, { status: 403 });
  }

  const auth = request.headers.get('authorization');
  const bearer = auth?.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) {
    return NextResponse.json(
      { error: 'Falta Authorization: Bearer <access_token_supabase>' },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500, headers: corsHeaders(origin) });
  }

  const userRes = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      apikey: anonKey,
    },
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Token Supabase inválido o expirado' }, { status: 401, headers: corsHeaders(origin) });
  }

  const userJson = (await userRes.json()) as { id?: string };
  const userId = userJson?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Respuesta Supabase sin usuario' }, { status: 401, headers: corsHeaders(origin) });
  }

  const minted = mintTwilioVoiceJwt(userId);
  if ('error' in minted) {
    return NextResponse.json({ error: minted.error }, { status: minted.status, headers: corsHeaders(origin) });
  }

  return new Response(minted.jwt, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
