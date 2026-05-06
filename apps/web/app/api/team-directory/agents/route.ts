import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type DirectoryAgent = {
  user_id: string;
  email: string | null;
  display_name: string;
  portal_role: string;
  presence_status: string;
  team_name: string | null;
  phone_e164: string | null;
  updated_at: string | null;
};

async function requireLeadOrSelfDirectoryAccess() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' as const };

  // Portal role lives in public.agents; RLS-safe because this is "me".
  const { data: me, error: meErr } = await supabase
    .from('agents')
    .select('portal_role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (meErr || !me) return { error: 'No se pudo resolver rol' as const };

  const role = String((me as any).portal_role ?? 'agent');
  return { user, role };
}

export async function GET() {
  try {
    const auth = await requireLeadOrSelfDirectoryAccess();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const isLead = auth.role === 'admin' || auth.role === 'supervisor';
    if (!isLead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createSupabaseServiceRoleClient();
    // Use '*' to be forward/backward compatible (avoid failing if some columns are missing in a partially migrated DB).
    const { data: rows, error } = await admin
      .from('agents')
      .select('*')
      .order('display_name', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const userIds = (rows ?? []).map((r: any) => r.user_id).filter(Boolean);

    // Join email from auth.users (service role only)
    const emailsById = new Map<string, string | null>();
    for (const id of userIds) {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        emailsById.set(id, data?.user?.email ?? null);
      } catch {
        emailsById.set(id, null);
      }
    }

    const agents: DirectoryAgent[] = (rows ?? []).map((r: any) => ({
      user_id: String(r.user_id),
      email: emailsById.get(String(r.user_id)) ?? null,
      display_name: String(r.display_name ?? ''),
      portal_role: String(r.portal_role ?? 'agent'),
      presence_status: String(r.presence_status ?? 'unavailable'),
      team_name: (r.team_name ?? null) as string | null,
      phone_e164: (r.phone_e164 ?? null) as string | null,
      updated_at: (r.updated_at ?? null) as string | null,
    }));

    return NextResponse.json({ agents }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    // Common cause in Vercel: missing SUPABASE_SERVICE_ROLE_KEY in the Next project env.
    const hint =
      msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('Faltan en el servidor Next')
        ? 'Revisa variables en Vercel (proyecto Next): SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL.'
        : null;
    return NextResponse.json({ error: msg, hint }, { status: 500 });
  }
}

