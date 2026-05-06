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
  // Prefer API Key for server calls; fallback to auth token if provided.
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

function countryName(code: string | null | undefined): string {
  const c = (code ?? '').toUpperCase();
  const m: Record<string, string> = {
    ES: 'España',
    FR: 'Francia',
    MX: 'México',
    US: 'Estados Unidos',
    GB: 'Reino Unido',
    PT: 'Portugal',
    DE: 'Alemania',
  };
  return m[c] ?? c ?? '—';
}

function twilioTypeToUi(t: string | null | undefined): 'local' | 'toll-free' | 'mobile' {
  const s = (t ?? '').toLowerCase();
  if (s.includes('toll')) return 'toll-free';
  if (s.includes('mobile')) return 'mobile';
  return 'local';
}

export async function GET() {
  try {
    const auth = await requireLead();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === 'No autenticado' ? 401 : 403 });
    }

    const client = twilioClient();
    const admin = createSupabaseServiceRoleClient();

    const incoming = await client.incomingPhoneNumbers.list({ limit: 200 });
    const phones = incoming
      .map((n) => ({
        sid: String(n.sid),
        friendlyName: String(n.friendlyName ?? ''),
        phoneNumber: normalizeE164(String(n.phoneNumber ?? '')),
        isoCountry: String((n as any).isoCountry ?? ''),
        type: String((n as any).capabilities?.voice ? (n as any).phoneNumberType ?? '' : (n as any).type ?? ''),
      }))
      .filter((n) => n.phoneNumber);

    const phoneNumbers = phones.map((p) => p.phoneNumber);
    const { data: routing } = await admin
      .from('inbound_routing')
      .select('twilio_to_number, agent_user_ids')
      .in('twilio_to_number', phoneNumbers);

    const { data: ivrRows } = await admin.from('ivr_flow').select('twilio_to_number').in('twilio_to_number', phoneNumbers);

    const { data: settings } = await admin
      .from('twilio_number_settings')
      .select('twilio_number_sid, phone_number_e164')
      .in('phone_number_e164', phoneNumbers);

    const routingByNumber = new Map<string, any>();
    (routing ?? []).forEach((r: any) => routingByNumber.set(String(r.twilio_to_number), r));
    const hasIvr = new Set((ivrRows ?? []).map((r: any) => String(r.twilio_to_number)));
    const sidByPhone = new Map((settings ?? []).map((s: any) => [String(s.phone_number_e164), String(s.twilio_number_sid)]));

    const numbers = phones.map((p) => {
      const r = routingByNumber.get(p.phoneNumber);
      const users = Array.isArray(r?.agent_user_ids) ? (r.agent_user_ids as string[]).length : 0;
      const status = hasIvr.has(p.phoneNumber) ? ('business-hours' as const) : ('always-open' as const);
      return {
        id: p.sid,
        twilioSid: p.sid,
        name: p.friendlyName || p.phoneNumber,
        number: p.phoneNumber,
        country: countryName(p.isoCountry),
        countryCode: p.isoCountry || '',
        type: twilioTypeToUi(p.type),
        status,
        users,
        hasDbSettings: sidByPhone.has(p.phoneNumber),
      };
    });

    return NextResponse.json({ numbers }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

