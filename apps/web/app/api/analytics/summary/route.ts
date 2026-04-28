import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/admin';
import { buildAnalyticsSummary } from '@/lib/analytics/buildSummary';
import { previousWindow, rangeBounds } from '@/lib/analytics/range';
import type { AnalyticsChannel, AnalyticsRange, AnalyticsView, VoiceCallRecord } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';

function parseEnum<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  if (!raw) return fallback;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/**
 * GET /api/analytics/summary — agregados reales (voice_call_records + agents).
 * Requiere sesión (cookies). Usa service role solo tras validar usuario.
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
    const view = parseEnum<AnalyticsView>(
      searchParams.get('view'),
      ['supervisor', 'agent'] as const,
      'supervisor'
    );
    const channel = parseEnum<AnalyticsChannel>(
      searchParams.get('channel'),
      ['global', 'inbound', 'outbound', 'ai'] as const,
      'global'
    );

    const { from: rangeFrom, to: rangeTo } = rangeBounds(rangeKey);
    const { from: prevFrom, to: prevTo } = previousWindow(rangeFrom, rangeTo);

    const admin = createSupabaseServiceRoleClient();
    const { data: rows, error: rowErr } = await admin
      .from('voice_call_records')
      .select('*')
      .is('parent_call_sid', null)
      .gte('created_at', prevFrom.toISOString())
      .lte('created_at', rangeTo.toISOString())
      .order('created_at', { ascending: true })
      .limit(25000);

    if (rowErr) {
      return NextResponse.json({ error: rowErr.message }, { status: 500 });
    }

    const all = (rows ?? []) as VoiceCallRecord[];
    const rowsCurrent = all.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= rangeFrom.getTime() && t <= rangeTo.getTime();
    });
    const rowsPrev = all.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= prevFrom.getTime() && t <= prevTo.getTime();
    });

    const { data: agentRows, error: agentErr } = await admin
      .from('agents')
      .select('user_id, display_name, operational_status, presence_status');

    if (agentErr) {
      return NextResponse.json({ error: agentErr.message }, { status: 500 });
    }

    const summary = buildAnalyticsSummary({
      rangeKey,
      rangeFrom,
      rangeTo,
      prevFrom,
      prevTo,
      view,
      channel,
      userId: user.id,
      rowsCurrent,
      rowsPrev,
      agents: agentRows ?? [],
    });

    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
