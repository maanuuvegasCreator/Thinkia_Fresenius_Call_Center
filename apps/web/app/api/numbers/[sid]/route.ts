import twilio from 'twilio';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function normalizeE164(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function twilioClient() {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim();
  const apiKeySid = (process.env.TWILIO_API_KEY_SID ?? '').trim();
  const apiKeySecret = (process.env.TWILIO_API_KEY_SECRET ?? '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN ?? '').trim();

  if (!accountSid) throw new Error('Falta TWILIO_ACCOUNT_SID');
  if (apiKeySid && apiKeySecret) return twilio(apiKeySid, apiKeySecret, { accountSid });
  if (authToken) return twilio(accountSid, authToken);
  throw new Error('Faltan credenciales Twilio (TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET o TWILIO_AUTH_TOKEN).');
}

async function requireLead() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' as const };

  const { data: me } = await supabase.from('agents').select('portal_role').eq('user_id', user.id).maybeSingle();
  const role = String((me as any)?.portal_role ?? 'agent');
  const isLead = role === 'admin' || role === 'supervisor';
  if (!isLead) return { error: 'Forbidden' as const };

  return { ok: true as const };
}

export async function GET(_: Request, ctx: { params: { sid: string } }) {
  try {
    const auth = await requireLead();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === 'No autenticado' ? 401 : 403 });
    }

    const sid = String(ctx.params.sid);
    const client = twilioClient();
    const admin = createSupabaseServiceRoleClient();

    const n = await client.incomingPhoneNumbers(sid).fetch();
    const phone = normalizeE164(String(n.phoneNumber ?? ''));

    const { data: routing } = await admin
      .from('inbound_routing')
      .select('agent_user_ids')
      .eq('twilio_to_number', phone)
      .maybeSingle();

    const { data: settings } = await admin
      .from('twilio_number_settings')
      .select('respect_queuing_time,priority')
      .eq('twilio_number_sid', sid)
      .maybeSingle();

    return NextResponse.json(
      {
        number: {
          sid,
          friendlyName: n.friendlyName ?? null,
          phoneNumber: phone,
          isoCountry: (n as any).isoCountry ?? null,
        },
        config: {
          respect_queuing_time: Boolean((settings as any)?.respect_queuing_time ?? false),
          priority: Boolean((settings as any)?.priority ?? false),
          agent_user_ids: (routing?.agent_user_ids as string[] | null) ?? [],
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request, ctx: { params: { sid: string } }) {
  try {
    const auth = await requireLead();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === 'No autenticado' ? 401 : 403 });
    }

    const sid = String(ctx.params.sid);
    const body = (await request.json().catch(() => null)) as any;
    const patch = body?.config;
    if (!patch || typeof patch !== 'object') {
      return NextResponse.json({ error: 'Body inválido: { config: {...} }' }, { status: 400 });
    }

    const client = twilioClient();
    const admin = createSupabaseServiceRoleClient();

    const n = await client.incomingPhoneNumbers(sid).fetch();
    const phone = normalizeE164(String(n.phoneNumber ?? ''));

    // Optional: update friendly name in Twilio
    if (typeof patch.friendly_name === 'string') {
      await client.incomingPhoneNumbers(sid).update({ friendlyName: patch.friendly_name });
    }

    // Save per-number settings in DB
    const respect = Boolean(patch.respect_queuing_time ?? false);
    const priority = Boolean(patch.priority ?? false);
    await admin.from('twilio_number_settings').upsert(
      {
        twilio_number_sid: sid,
        phone_number_e164: phone,
        respect_queuing_time: respect,
        priority,
      },
      { onConflict: 'twilio_number_sid' }
    );

    // Save routing assignment (who rings)
    const agentIds = Array.isArray(patch.agent_user_ids) ? (patch.agent_user_ids as string[]).map(String) : [];
    await admin.from('inbound_routing').upsert(
      {
        twilio_to_number: phone,
        agent_user_ids: agentIds,
      },
      { onConflict: 'twilio_to_number' }
    );

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

