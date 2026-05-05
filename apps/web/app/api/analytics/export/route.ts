import { rangeBounds } from '@/lib/analytics/range';
import type { AnalyticsChannel, AnalyticsRange, AnalyticsView, VoiceCallRecord } from '@/lib/analytics/types';
import { getPortalRoleForUser, isLeadPortalRole } from '@/lib/portal-role';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseEnum<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  if (!raw) return fallback;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * GET /api/analytics/export — CSV de `voice_call_records` del rango actual (nivel superior).
 */
export async function GET(req: Request) {
  try {
    const userClient = createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rangeKey = parseEnum<AnalyticsRange>(
      searchParams.get('range'),
      ['today', 'week', 'month'] as const,
      'today'
    );
    const portalRole = await getPortalRoleForUser(userClient, user.id);
    const requestedView = parseEnum<AnalyticsView>(
      searchParams.get('view'),
      ['supervisor', 'agent'] as const,
      'supervisor'
    );
    const view: AnalyticsView = isLeadPortalRole(portalRole) ? requestedView : 'agent';
    const channel = parseEnum<AnalyticsChannel>(
      searchParams.get('channel'),
      ['global', 'inbound', 'outbound', 'ai'] as const,
      'global'
    );

    const { from: rangeFrom, to: rangeTo } = rangeBounds(rangeKey);
    const { data: rows, error: rowErr } = await userClient
      .from('voice_call_records')
      .select('*')
      .is('parent_call_sid', null)
      .gte('created_at', rangeFrom.toISOString())
      .lte('created_at', rangeTo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10000);

    if (rowErr) {
      return NextResponse.json({ error: rowErr.message }, { status: 500 });
    }

    let list = (rows ?? []) as VoiceCallRecord[];
    if (view === 'agent') {
      list = list.filter((r) => r.agent_user_id === user.id);
    }
    if (channel === 'inbound') list = list.filter((r) => r.direction === 'inbound');
    if (channel === 'outbound') list = list.filter((r) => r.direction === 'outbound');
    if (channel === 'ai') list = [];

    const header = [
      'twilio_call_sid',
      'created_at',
      'direction',
      'call_status',
      'duration_seconds',
      'agent_user_id',
      'from_number',
      'to_number',
    ];
    const lines = [
      header.join(','),
      ...list.map((r) =>
        [
          r.twilio_call_sid,
          r.created_at,
          r.direction,
          r.call_status,
          r.duration_seconds ?? '',
          r.agent_user_id ?? '',
          csvEscape(r.from_number ?? ''),
          csvEscape(r.to_number ?? ''),
        ].join(',')
      ),
    ];

    const body = lines.join('\n');
    const name = `thinkia-analytics-${rangeKey}.csv`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
