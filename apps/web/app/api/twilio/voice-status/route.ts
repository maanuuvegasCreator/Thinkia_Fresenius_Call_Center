import twilio from 'twilio';
import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/admin';
import {
  mapTwilioCallStatusToLifecycle,
  mapTwilioDirection,
  type TwilioDirection,
} from '@/lib/aicx/twilio-session-map';
import { userIdFromTwilioClientIdentity } from '@/lib/twilio-identity';

export const dynamic = 'force-dynamic';

function normalizeDirection(dir: string): 'inbound' | 'outbound' | 'unknown' {
  const d = (dir || '').toLowerCase();
  if (d.includes('inbound')) return 'inbound';
  if (d.includes('outbound')) return 'outbound';
  return 'unknown';
}

function parseDuration(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

function parseTwilioTimestamp(raw: string | null | undefined): Date | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d : null;
}

function twilioRequestUrl(request: Request): string {
  const u = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? u.protocol.replace(':', '');
  if (host) return `${proto}://${host}${u.pathname}`;
  return `${u.protocol}//${u.host}${u.pathname}`;
}

/**
 * POST /api/twilio/voice-status — StatusCallback de Twilio (Dial / llamada).
 * Persiste en `voice_call_records` para Analytics (service role).
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = typeof value === 'string' ? value : '';
  });

  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (authToken) {
    const signature = request.headers.get('X-Twilio-Signature');
    if (!signature) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    const url = twilioRequestUrl(request);
    const ok = twilio.validateRequest(authToken, signature, url, params);
    if (!ok) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const callSid = params.CallSid;
  if (!callSid) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const parentCallSid = params.ParentCallSid?.trim() || null;
  const accountSid = params.AccountSid?.trim() || null;
  const direction = normalizeDirection(params.Direction ?? '');
  const callStatus = (params.CallStatus ?? 'unknown').trim() || 'unknown';
  const durationSeconds = parseDuration(params.CallDuration ?? null);
  const eventAt = parseTwilioTimestamp(params.Timestamp ?? null);
  const fromNumber = (params.From ?? '').trim() || null;
  const toNumber = (params.To ?? '').trim() || null;
  const agentUserId =
    userIdFromTwilioClientIdentity(fromNumber) ?? userIdFromTwilioClientIdentity(toNumber);

  const row = {
    twilio_call_sid: callSid,
    parent_call_sid: parentCallSid,
    account_sid: accountSid,
    direction,
    call_status: callStatus,
    duration_seconds: durationSeconds,
    from_number: fromNumber,
    to_number: toNumber,
    agent_user_id: agentUserId,
  };

  const lifecycleStatus = mapTwilioCallStatusToLifecycle(callStatus);
  const aicxDirection = mapTwilioDirection(direction);

  const callEndAt =
    lifecycleStatus === 'COMPLETED' || lifecycleStatus === 'FAILED' ? eventAt : null;
  const callStartAt =
    callEndAt && typeof durationSeconds === 'number'
      ? new Date(callEndAt.getTime() - durationSeconds * 1000)
      : lifecycleStatus === 'INITIATED'
        ? eventAt
        : null;

  const aicxRow = {
    call_provider: 'TWILIO' as const,
    provider_call_id: callSid,
    parent_provider_call_id: parentCallSid,
    direction: aicxDirection,
    call_status: lifecycleStatus,
    call_start_at: callStartAt?.toISOString() ?? null,
    call_end_at: callEndAt?.toISOString() ?? null,
    duration_seconds: durationSeconds,
    phone_number_from: fromNumber,
    phone_number_to: toNumber,
    account_sid: accountSid,
    agent_user_id: agentUserId,
  };

  try {
    const admin = createSupabaseServiceRoleClient();
    const { error } = await admin.from('voice_call_records').upsert(row, { onConflict: 'twilio_call_sid' });
    if (error) {
      console.error('voice_call_records upsert', error);
      return new NextResponse('Server Error', { status: 500 });
    }

    const { error: aicxErr } = await admin.schema('aicx').from('call_session').upsert(aicxRow, {
      onConflict: 'call_provider,provider_call_id',
    });
    if (aicxErr) {
      console.error('aicx.call_session upsert', aicxErr);
      return new NextResponse('Server Error', { status: 500 });
    }
  } catch (e) {
    console.error('voice-status', e);
    return new NextResponse('Server Error', { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
