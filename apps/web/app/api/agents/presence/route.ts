import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { agentPresenceUiToDb, isAgentPresenceUi } from '@/lib/agent-presence';

export const dynamic = 'force-dynamic';

/**
 * Actualiza `agents.presence_status` con la sesión de cookies (mismo origen que el portal tras handoff).
 */
export async function PATCH(req: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { presence?: unknown } | null;
    const raw = body?.presence;
    if (typeof raw !== 'string' || !isAgentPresenceUi(raw)) {
      return NextResponse.json({ error: 'Body inválido: { "presence": "<estado>" }' }, { status: 400 });
    }

    const dbVal = agentPresenceUiToDb(raw);

    const { data, error: upErr } = await supabase
      .from('agents')
      .update({ presence_status: dbVal })
      .eq('user_id', user.id)
      .select('presence_status')
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: 'No se actualizó ninguna fila (¿RLS o usuario sin agents?)' },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, presence: raw }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
