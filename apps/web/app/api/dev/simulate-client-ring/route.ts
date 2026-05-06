import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/admin';
import { twilioClientIdentityFromUserId } from '@/lib/twilio-identity';

export const dynamic = 'force-dynamic';

async function findUserIdByEmail(admin: ReturnType<typeof createSupabaseServiceRoleClient>, email: string) {
  let page = 1;
  const perPage = 200;
  const target = email.trim().toLowerCase();
  while (page < 30) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => (x.email ?? '').toLowerCase() === target);
    if (u) return u.id;
    if (!data.users.length || data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

/** Busca por fragmento de email o nombre de usuario (ej. davidalejano). */
async function findUserIdBySearch(
  admin: ReturnType<typeof createSupabaseServiceRoleClient>,
  q: string
) {
  const needle = q.trim().toLowerCase();
  if (!needle) return null;
  let page = 1;
  const perPage = 200;
  while (page < 30) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    for (const x of data.users) {
      const em = (x.email ?? '').toLowerCase();
      const meta = (x.user_metadata ?? {}) as Record<string, unknown>;
      const name = String(meta.full_name ?? meta.name ?? meta.preferred_username ?? '').toLowerCase();
      if (em.includes(needle) || name.includes(needle)) return x.id;
    }
    if (!data.users.length || data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

/**
 * Simula una “entrante” en el Voice SDK: Twilio crea una llamada **saliente** hacia `client:<identity>`
 * del usuario (por defecto el logueado). Opcionalmente, admin/supervisor puede marcar a otro usuario.
 *
 * Requiere `ALLOW_CLIENT_RING_SIMULATION=true` y un `TWILIO_CALLER_ID` que soporte **voz** (no solo SMS).
 * Tras la demo, borra la variable o pon `false`.
 */
export async function POST(request: Request) {
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

  let targetUserId = user.id;
  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    email?: string;
    search?: string;
  } | null;

  const wantsOther =
    Boolean(body?.userId?.trim()) || Boolean(body?.email?.trim()) || Boolean(body?.search?.trim());
  if (wantsOther) {
    const { data: me } = await supabase.from('agents').select('portal_role').eq('user_id', user.id).maybeSingle();
    const role = String((me as { portal_role?: string } | null)?.portal_role ?? 'agent');
    if (role !== 'admin' && role !== 'supervisor') {
      return NextResponse.json(
        { error: 'Solo admin o supervisor puede marcar a otro usuario (simulación).' },
        { status: 403 }
      );
    }

    try {
      const admin = createSupabaseServiceRoleClient();
      if (body?.userId?.trim()) {
        const id = body.userId.trim();
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (error || !data?.user) {
          return NextResponse.json({ error: 'userId no encontrado en Auth.' }, { status: 400 });
        }
        targetUserId = data.user.id;
      } else if (body?.email?.trim()) {
        const found = await findUserIdByEmail(admin, body.email);
        if (!found) return NextResponse.json({ error: 'Email no encontrado en Auth.' }, { status: 400 });
        targetUserId = found;
      } else if (body?.search?.trim()) {
        const found = await findUserIdBySearch(admin, body.search);
        if (!found) return NextResponse.json({ error: 'Ningún usuario coincide con la búsqueda.' }, { status: 400 });
        targetUserId = found;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error resolviendo usuario';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const identity = twilioClientIdentityFromUserId(targetUserId);
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
      targetUserId,
      hint:
        targetUserId === user.id
          ? 'Debería sonar en portal/softphone si Twilio Device está registrado con este usuario.'
          : 'La llamada va al client identity del usuario destino; debe estar logueado y registrado en Voice.',
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
