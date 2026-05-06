import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/admin';
import { isAgentPresenceUi, agentPresenceUiToDb } from '@/lib/agent-presence';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: me } = await supabase.from('agents').select('portal_role').eq('user_id', user.id).maybeSingle();
  const role = String((me as any)?.portal_role ?? 'agent');
  const isLead = role === 'admin' || role === 'supervisor';
  if (!isLead) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { userId?: unknown; presence?: unknown } | null;
  const userId = typeof body?.userId === 'string' ? body.userId : null;
  const presence = typeof body?.presence === 'string' ? body.presence : null;
  if (!userId || !presence || !isAgentPresenceUi(presence)) {
    return NextResponse.json({ error: 'Body inválido: { userId, presence }' }, { status: 400 });
  }

  const dbVal = agentPresenceUiToDb(presence);
  const admin = createSupabaseServiceRoleClient();
  const { data, error } = await admin
    .from('agents')
    .update({ presence_status: dbVal })
    .eq('user_id', userId)
    .select('user_id,presence_status,updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No se actualizó ninguna fila' }, { status: 409 });

  return NextResponse.json({ ok: true, presence }, { headers: { 'Cache-Control': 'no-store' } });
}

