import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SINGLETON_ID = 'default';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('call_settings')
    .select('*')
    .eq('id', SINGLETON_ID)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings:
      data ??
      ({
        id: SINGLETON_ID,
        wrap_up_seconds: 30,
        auto_close_conversation: false,
        auto_end_wrap_up: false,
        always_on_top: false,
        external_forward_number: null,
        blocked_numbers: [],
        inbound_recording_enabled: true,
        inbound_pause_recording_enabled: true,
        outbound_recording_enabled: true,
        hold_message_enabled: true,
        hold_message_delay_seconds: 30,
        business_hours_message: null,
        after_hours_message: null,
        outbound_recording_message: null,
        hold_message: null,
      } as const),
  });
}

export async function PUT(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const settings = body?.settings;
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'Missing settings' }, { status: 400 });
  }

  const row = {
    id: SINGLETON_ID,
    wrap_up_seconds: Number(settings.wrap_up_seconds ?? 30),
    auto_close_conversation: Boolean(settings.auto_close_conversation ?? false),
    auto_end_wrap_up: Boolean(settings.auto_end_wrap_up ?? false),
    always_on_top: Boolean(settings.always_on_top ?? false),
    external_forward_number: (settings.external_forward_number ?? null) as string | null,
    blocked_numbers: Array.isArray(settings.blocked_numbers)
      ? (settings.blocked_numbers as string[])
      : [],
    inbound_recording_enabled: Boolean(settings.inbound_recording_enabled ?? true),
    inbound_pause_recording_enabled: Boolean(settings.inbound_pause_recording_enabled ?? true),
    outbound_recording_enabled: Boolean(settings.outbound_recording_enabled ?? true),
    hold_message_enabled: Boolean(settings.hold_message_enabled ?? true),
    hold_message_delay_seconds: Number(settings.hold_message_delay_seconds ?? 30),
    business_hours_message: (settings.business_hours_message ?? null) as string | null,
    after_hours_message: (settings.after_hours_message ?? null) as string | null,
    outbound_recording_message: (settings.outbound_recording_message ?? null) as string | null,
    hold_message: (settings.hold_message ?? null) as string | null,
  };

  const { error } = await supabase.from('call_settings').upsert(row, { onConflict: 'id' });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

