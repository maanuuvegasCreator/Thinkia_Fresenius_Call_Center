import twilio from 'twilio';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function normalizeE164(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function publicAppUrl(): string | null {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = (process.env.VERCEL_URL ?? '').trim();
  if (vercel) return `https://${vercel}`.replace(/\/+$/, '');
  return null;
}

async function ensureTwilioNumbersPointToVoiceUrl(entryNumbers: string[]) {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN ?? '').trim();
  if (!accountSid || !authToken) return { updated: 0, skipped: entryNumbers.length, reason: 'missing_twilio_auth' };

  const baseUrl = publicAppUrl();
  if (!baseUrl) return { updated: 0, skipped: entryNumbers.length, reason: 'missing_public_app_url' };

  const client = twilio(accountSid, authToken);
  let updated = 0;
  let skipped = 0;

  for (const raw of entryNumbers) {
    const phoneNumber = normalizeE164(raw);
    try {
      const nums = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 20 });
      const match = nums.find((n) => normalizeE164(n.phoneNumber ?? '') === phoneNumber);
      if (!match) {
        skipped++;
        continue;
      }
      await client.incomingPhoneNumbers(match.sid).update({
        voiceUrl: `${baseUrl}/api/voice`,
        voiceMethod: 'POST',
      });
      updated++;
    } catch {
      skipped++;
    }
  }

  return { updated, skipped };
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const to = url.searchParams.get('to');

  const q = supabase.from('ivr_flow').select('*');
  const { data, error } = to ? await q.eq('twilio_to_number', to).maybeSingle() : await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ flow: data ?? null });
}

export async function PUT(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const toNumbers = Array.isArray(body?.entryNumbers) ? (body.entryNumbers as string[]) : [];
  const flowJson = body?.flow;
  if (!toNumbers.length || !flowJson) {
    return NextResponse.json({ error: 'Missing entryNumbers or flow' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Upsert one row per Twilio To-number for fast lookup in /api/voice
  for (const n of toNumbers) {
    const twilio_to_number = normalizeE164(n);
    const { data: existing } = await supabase
      .from('ivr_flow')
      .select('version')
      .eq('twilio_to_number', twilio_to_number)
      .maybeSingle();

    const version = (existing?.version ?? 0) + 1;

    const { error } = await supabase.from('ivr_flow').upsert(
      {
        twilio_to_number,
        flow_json: flowJson,
        version,
        published_at: now,
        created_by: auth.user.id,
      },
      { onConflict: 'twilio_to_number' }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const twilioSync = await ensureTwilioNumbersPointToVoiceUrl(toNumbers);
  return NextResponse.json({ ok: true, twilioSync });
}

