import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { agentPresenceDbToUi } from '@/lib/agent-presence';

export const dynamic = 'force-dynamic';

/**
 * Perfil agente + presencia usando cookies SSR (tras handoff el portal ya no tiene sesión en localStorage).
 */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const meta = user.user_metadata ?? {};
    const fullName =
      (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
      (typeof meta.name === 'string' && meta.name.trim()) ||
      (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
      null;

    const { data: row, error: rowErr } = await supabase
      .from('agents')
      .select('display_name, presence_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (rowErr) {
      return NextResponse.json({ error: rowErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'No hay fila en agents para este usuario' }, { status: 404 });
    }

    const ps = row.presence_status;
    const presence =
      typeof ps === 'string' && ps ? agentPresenceDbToUi(ps) : 'unavailable';

    return NextResponse.json(
      {
        userId: user.id,
        email: user.email ?? null,
        fullName,
        displayName: typeof row.display_name === 'string' ? row.display_name : null,
        presence,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
