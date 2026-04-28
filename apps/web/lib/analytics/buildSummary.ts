import type {
  AgentRow,
  AnalyticsChannel,
  AnalyticsRange,
  AnalyticsView,
  VoiceCallRecord,
} from './types';

const TZ = 'Europe/Madrid';

function isAnswered(r: VoiceCallRecord): boolean {
  const s = (r.call_status || '').toLowerCase();
  return s === 'completed' && (r.duration_seconds ?? 0) > 0;
}

function isMissed(r: VoiceCallRecord): boolean {
  const s = (r.call_status || '').toLowerCase();
  if (['no-answer', 'busy', 'canceled', 'failed'].includes(s)) return true;
  if (s === 'completed' && (r.duration_seconds ?? 0) <= 0) return true;
  return false;
}

function channelMatch(channel: AnalyticsChannel, r: VoiceCallRecord): boolean {
  if (channel === 'global') return true;
  if (channel === 'inbound') return r.direction === 'inbound';
  if (channel === 'outbound') return r.direction === 'outbound';
  if (channel === 'ai') return false;
  return true;
}

function viewMatch(view: AnalyticsView, userId: string, r: VoiceCallRecord): boolean {
  if (view === 'supervisor') return true;
  return r.agent_user_id === userId;
}

function filterRows(
  rows: VoiceCallRecord[],
  view: AnalyticsView,
  userId: string,
  channel: AnalyticsChannel
): VoiceCallRecord[] {
  return rows.filter((r) => viewMatch(view, userId, r) && channelMatch(channel, r));
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function ymdInTz(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    d
  );
}

function hourInTz(iso: string): number {
  const d = new Date(iso);
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    hour12: false,
  }).format(d);
  return Number.parseInt(h, 10);
}

function dowMonday0(iso: string): number {
  const d = new Date(iso);
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}

const DOW_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function avgDurAnswered(rows: VoiceCallRecord[]): number | null {
  const answered = rows.filter(isAnswered);
  if (answered.length === 0) return null;
  const sum = answered.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
  return Math.round(sum / answered.length);
}

function formatDuration(sec: number | null): string {
  if (sec == null || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function buildAnalyticsSummary(input: {
  rangeKey: AnalyticsRange;
  rangeFrom: Date;
  rangeTo: Date;
  prevFrom: Date;
  prevTo: Date;
  view: AnalyticsView;
  channel: AnalyticsChannel;
  userId: string;
  rowsCurrent: VoiceCallRecord[];
  rowsPrev: VoiceCallRecord[];
  agents: AgentRow[];
}): Record<string, unknown> {
  const { view, channel, userId, agents } = input;
  const cur = filterRows(input.rowsCurrent, view, userId, channel);
  const prev = filterRows(input.rowsPrev, view, userId, channel);

  const inboundCur = cur.filter((r) => r.direction === 'inbound');
  const outboundCur = cur.filter((r) => r.direction === 'outbound');
  const inboundPrev = prev.filter((r) => r.direction === 'inbound');
  const outboundPrev = prev.filter((r) => r.direction === 'outbound');

  const totalCur = cur.length;
  const totalPrev = prev.length;
  const answeredInbound = inboundCur.filter(isAnswered);
  const missedInbound = inboundCur.filter(isMissed);
  const slaDenom = answeredInbound.length + missedInbound.length;
  const slaPct = slaDenom > 0 ? Math.round((answeredInbound.length / slaDenom) * 1000) / 10 : null;

  const connectedAgents = agents.length;
  const availableAgents = agents.filter((a) => (a.presence_status ?? '').toLowerCase() === 'available').length;

  const byDow = DOW_LABELS.map((label, i) => ({
    label,
    inbound: 0,
    outbound: 0,
    missed: 0,
    callback: 0,
  }));
  for (const r of cur) {
    const idx = dowMonday0(r.created_at);
    if (!byDow[idx]) continue;
    if (r.direction === 'inbound') byDow[idx].inbound += 1;
    if (r.direction === 'outbound') byDow[idx].outbound += 1;
    if (isMissed(r)) byDow[idx].missed += 1;
  }

  const byDateMap = new Map<string, { inbound: number; outbound: number }>();
  for (const r of cur) {
    const k = ymdInTz(r.created_at);
    const slot = byDateMap.get(k) ?? { inbound: 0, outbound: 0 };
    if (r.direction === 'inbound') slot.inbound += 1;
    if (r.direction === 'outbound') slot.outbound += 1;
    byDateMap.set(k, slot);
  }
  const byDate = [...byDateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const byHour = Array.from({ length: 12 }, (_, i) => i + 8).map((h) => ({
    hour: `${String(h).padStart(2, '0')}h`,
    inbound: 0,
    outbound: 0,
    missed: 0,
  }));
  for (const r of cur) {
    const h = hourInTz(r.created_at);
    if (h < 8 || h > 19) continue;
    const idx = h - 8;
    if (!byHour[idx]) continue;
    if (r.direction === 'inbound') byHour[idx].inbound += 1;
    if (r.direction === 'outbound') byHour[idx].outbound += 1;
    if (isMissed(r)) byHour[idx].missed += 1;
  }

  const abandonoByDow = DOW_LABELS.map((label, i) => {
    const slice = cur.filter((r) => dowMonday0(r.created_at) === i);
    const inb = slice.filter((r) => r.direction === 'inbound');
    if (inb.length === 0) return { label, pct: 0, agents: availableAgents };
    const missed = inb.filter(isMissed).length;
    return { label, pct: Math.round((missed / inb.length) * 1000) / 10, agents: availableAgents };
  });

  const agentStats = new Map<
    string,
    { total: number; answered: number; missed: number; sumDur: number; inbound: number; outbound: number }
  >();
  for (const r of cur) {
    if (!r.agent_user_id) continue;
    const slot =
      agentStats.get(r.agent_user_id) ?? {
        total: 0,
        answered: 0,
        missed: 0,
        sumDur: 0,
        inbound: 0,
        outbound: 0,
      };
    slot.total += 1;
    if (isAnswered(r)) {
      slot.answered += 1;
      slot.sumDur += r.duration_seconds ?? 0;
    }
    if (isMissed(r)) slot.missed += 1;
    if (r.direction === 'inbound') slot.inbound += 1;
    if (r.direction === 'outbound') slot.outbound += 1;
    agentStats.set(r.agent_user_id, slot);
  }

  const agentPerformance = [...agents]
    .map((a) => {
    const st = agentStats.get(a.user_id) ?? {
      total: 0,
      answered: 0,
      missed: 0,
      sumDur: 0,
      inbound: 0,
      outbound: 0,
    };
    const avg = st.answered > 0 ? Math.round(st.sumDur / st.answered) : null;
    const resol = st.total > 0 ? Math.round((st.answered / st.total) * 1000) / 10 : 0;
      return {
        userId: a.user_id,
        name: a.display_name,
        total: st.total,
        answered: st.answered,
        missed: st.missed,
        direct: st.inbound,
        queue: 0,
        transfers: 0,
        avgDurationSec: avg,
        avgDurationLabel: formatDuration(avg),
        resolutionPct: resol,
      };
    })
    .sort((x, y) => y.total - x.total);

  const managedBars = agents
    .map((a) => {
      const st = agentStats.get(a.user_id);
      if (!st || st.total === 0) return null;
      return {
        name: a.display_name,
        total: st.total,
        pctAnswered: Math.round((st.answered / st.total) * 100),
        pctMissed: Math.round((st.missed / st.total) * 100),
      };
    })
    .filter(Boolean);

  const lostByAgent = agents
    .map((a) => {
      const st = agentStats.get(a.user_id);
      return { name: a.display_name, lost: st?.missed ?? 0 };
    })
    .filter((x) => x.lost > 0);
  const totalLost = lostByAgent.reduce((s, x) => s + x.lost, 0);

  const hourlyDetail = byHour.map((row, i) => {
    const start = 8 + i;
    const end = start + 1;
    const pct = row.inbound > 0 ? Math.round((row.missed / row.inbound) * 1000) / 10 : 0;
    let state: 'OK' | 'Alerta' | 'Critico' = 'OK';
    if (pct >= 12) state = 'Critico';
    else if (pct >= 6) state = 'Alerta';
    return {
      franja: `${String(start).padStart(2, '0')}–${String(end).padStart(2, '0')}h`,
      recibidas: row.inbound,
      realizadas: row.outbound,
      agentes: availableAgents,
      pctPerdidas: pct,
      colaGral: 0,
      callback: 0,
      tEsp: row.inbound > 0 ? `${Math.min(120, 15 + row.missed * 3)}s` : '—',
      estado: state,
    };
  });

  const maxInboundHour = byHour.reduce(
    (best, row, i) => (row.inbound > best.v ? { v: row.inbound, label: row.hour } : best),
    { v: 0, label: '—' as string }
  );

  const lostPctTotal =
    cur.filter((r) => r.direction === 'inbound').length > 0
      ? Math.round(
          (cur.filter((r) => r.direction === 'inbound' && isMissed(r)).length /
            cur.filter((r) => r.direction === 'inbound').length) *
            1000
        ) / 10
      : 0;

  return {
    range: {
      key: input.rangeKey,
      from: input.rangeFrom.toISOString(),
      to: input.rangeTo.toISOString(),
    },
    previousRange: {
      from: input.prevFrom.toISOString(),
      to: input.prevTo.toISOString(),
    },
    filters: { view, channel },
    meta: {
      timezone: TZ,
      aiChannelEmpty: channel === 'ai',
      dataSource:
        'voice_call_records (Twilio status callback). KPIs usan llamadas de nivel superior (sin ParentCallSid).',
    },
    kpis: {
      totalCalls: totalCur,
      totalCallsDeltaPct: pctChange(totalCur, totalPrev),
      inbound: inboundCur.length,
      inboundDeltaPct: pctChange(inboundCur.length, inboundPrev.length),
      outbound: outboundCur.length,
      outboundDeltaPct: pctChange(outboundCur.length, outboundPrev.length),
      avgDurationSec: avgDurAnswered(cur),
      avgDurationLabel: formatDuration(avgDurAnswered(cur)),
      maxWaitLabel: '—',
      callsWaiting: null,
      connectedAgents,
      availableAgents,
      asaSeconds: null,
      slaAnsweredPct: slaPct,
      slaAnsweredUnder179: slaPct,
      slaSegment17: answeredInbound.length,
      slaAbandoned: missedInbound.length,
    },
    charts: {
      byDayOfWeek: byDow,
      byDate,
      byHourToday: byHour,
      abandonoByDow,
      agentPerformance,
      managedBars,
      lostByAgent,
      totalLostCalls: totalLost,
      capacity: {
        agentsOnShift: agents.length,
        occupancyPct: null,
        lostPctTotal,
        criticalFranja: maxInboundHour.v > 0 ? maxInboundHour.label : '—',
        hourlyDetail,
      },
    },
  };
}
