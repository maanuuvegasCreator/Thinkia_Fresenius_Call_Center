import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type SeedUser = {
  email: string;
  password: string;
  display_name: string;
  portal_role: 'admin' | 'supervisor' | 'agent';
  team_name: string;
  phone_e164?: string;
};

const DEFAULT_SEED: SeedUser[] = [
  {
    email: 'laura.sanchez+demo@thinkia.com',
    password: 'Thinkia123!',
    display_name: 'Laura Sánchez',
    portal_role: 'admin',
    team_name: 'Atención al Cliente',
    phone_e164: '+34912345601',
  },
  {
    email: 'javier.ruiz+demo@thinkia.com',
    password: 'Thinkia123!',
    display_name: 'Javier Ruiz',
    portal_role: 'supervisor',
    team_name: 'Atención al Cliente',
    phone_e164: '+34912345602',
  },
  {
    email: 'pedro.ramirez+demo@thinkia.com',
    password: 'Thinkia123!',
    display_name: 'Pedro Ramírez',
    portal_role: 'agent',
    team_name: 'Atención al Cliente',
    phone_e164: '+34912345603',
  },
  {
    email: 'elena.fernandez+demo@thinkia.com',
    password: 'Thinkia123!',
    display_name: 'Elena Fernández',
    portal_role: 'agent',
    team_name: 'Atención al Cliente',
    phone_e164: '+34912345604',
  },
  {
    email: 'carmen.rodriguez+demo@thinkia.com',
    password: 'Thinkia123!',
    display_name: 'Carmen Rodríguez',
    portal_role: 'admin',
    team_name: 'Enfermería',
    phone_e164: '+34919496201',
  },
  {
    email: 'ana.martinez+demo@thinkia.com',
    password: 'Thinkia123!',
    display_name: 'Ana Martínez',
    portal_role: 'supervisor',
    team_name: 'Enfermería',
    phone_e164: '+34919496202',
  },
];

export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: me } = await supabase.from('agents').select('portal_role').eq('user_id', user.id).maybeSingle();
  const role = String((me as any)?.portal_role ?? 'agent');
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createSupabaseServiceRoleClient();
  const created: Array<{ email: string; userId: string }> = [];
  const skipped: Array<{ email: string; reason: string }> = [];

  for (const seed of DEFAULT_SEED) {
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: seed.email,
        password: seed.password,
        email_confirm: true,
        user_metadata: { display_name: seed.display_name },
      });
      if (error || !data.user) {
        skipped.push({ email: seed.email, reason: error?.message ?? 'unknown' });
        continue;
      }
      created.push({ email: seed.email, userId: data.user.id });

      // Ensure directory fields exist (row is created by trigger, but update is idempotent).
      await admin
        .from('agents')
        .update({
          display_name: seed.display_name,
          portal_role: seed.portal_role,
          team_name: seed.team_name,
          phone_e164: seed.phone_e164 ?? null,
          presence_status: 'available',
        })
        .eq('user_id', data.user.id);
    } catch (e) {
      skipped.push({ email: seed.email, reason: e instanceof Error ? e.message : 'unknown' });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      created,
      skipped,
      credentials: { password: 'Thinkia123!' },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

