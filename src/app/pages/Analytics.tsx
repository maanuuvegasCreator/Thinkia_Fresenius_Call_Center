import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ComposedChart,
} from 'recharts';

type AnalyticsRange = 'today' | 'week' | 'month';
type AnalyticsView = 'supervisor' | 'agent';
type AnalyticsChannel = 'global' | 'inbound' | 'outbound' | 'ai';

type SummaryJson = {
  meta?: { aiChannelEmpty?: boolean; dataSource?: string; timezone?: string };
  kpis: {
    totalCalls: number;
    totalCallsDeltaPct: number | null;
    inbound: number;
    inboundDeltaPct: number | null;
    outbound: number;
    outboundDeltaPct: number | null;
    avgDurationLabel: string;
    maxWaitLabel: string;
    callsWaiting: number | null;
    connectedAgents: number;
    availableAgents: number;
    asaSeconds: number | null;
    slaAnsweredPct: number | null;
    slaAnsweredUnder179: number | null;
    slaSegment17: number;
    slaAbandoned: number;
  };
  charts: {
    byDayOfWeek: { label: string; inbound: number; outbound: number; missed: number }[];
    byDate: { date: string; inbound: number; outbound: number }[];
    byHourToday: { hour: string; inbound: number; outbound: number; missed: number }[];
    abandonoByDow: { label: string; pct: number; agents: number }[];
    agentPerformance: {
      userId: string;
      name: string;
      total: number;
      answered: number;
      missed: number;
      direct: number;
      queue: number;
      transfers: number;
      avgDurationLabel: string;
      resolutionPct: number;
    }[];
    managedBars: { name: string; total: number; pctAnswered: number; pctMissed: number }[];
    lostByAgent: { name: string; lost: number }[];
    totalLostCalls: number;
    capacity: {
      agentsOnShift: number;
      occupancyPct: number | null;
      lostPctTotal: number;
      criticalFranja: string;
      hourlyDetail: {
        franja: string;
        recibidas: number;
        realizadas: number;
        agentes: number;
        pctPerdidas: number;
        estado: string;
      }[];
    };
  };
};

function formatDelta(p: number | null): { text: string; cls: string } {
  if (p === null) return { text: 'Sin dato previo', cls: 'text-slate-400' };
  if (p === 0) return { text: 'Sin cambios', cls: 'text-slate-400' };
  if (p > 0) return { text: `↑ +${p}% vs periodo anterior`, cls: 'text-emerald-600' };
  return { text: `↓ ${p}% vs periodo anterior`, cls: 'text-red-600' };
}

function tabClass(on: boolean): string {
  return on
    ? 'flex h-[50px] items-center gap-1.5 border-b-[2.5px] border-[#3B6CFF] px-3.5 text-xs font-bold text-[#3B6CFF]'
    : 'flex h-[50px] items-center gap-1.5 border-b-[2.5px] border-transparent px-3.5 text-xs font-medium text-slate-500';
}

function stabClass(on: boolean): string {
  return on
    ? 'border-b-2 border-[#001963] px-4 py-2.5 text-xs font-bold text-[#001963]'
    : 'cursor-pointer border-b-2 border-transparent px-4 py-2.5 text-xs font-medium text-slate-500';
}

function chipClass(on: boolean): string {
  return on
    ? 'inline-flex items-center gap-1 rounded-full border border-[#001963] bg-[#001963] px-3 py-1 text-[11px] font-medium text-white'
    : 'inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#dde1ee] bg-white px-3 py-1 text-[11px] font-medium text-slate-500';
}

const B4 = '#3B6CFF';
const B2 = '#90ABFF';
const OR = '#ea580c';

export default function Analytics() {
  const [view, setView] = useState<AnalyticsView>('supervisor');
  const [channel, setChannel] = useState<AnalyticsChannel>('global');
  const [range, setRange] = useState<AnalyticsRange>('today');
  const [data, setData] = useState<SummaryJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('range', range);
    p.set('view', view);
    p.set('channel', channel);
    return p.toString();
  }, [range, view, channel]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/summary?${query}`, { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        setError('Sesión caducada. Vuelve a iniciar sesión.');
        setData(null);
        return;
      }
      if (!res.ok) {
        const t = await res.text();
        setError(t || `Error ${res.status}`);
        setData(null);
        return;
      }
      const j = (await res.json()) as SummaryJson;
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportHref = `/api/analytics/export?${query}`;

  const c1Data = useMemo(() => {
    if (!data) return [];
    return data.charts.byDayOfWeek.map((d) => ({
      ...d,
      pct: d.inbound + d.outbound > 0 ? Math.round((d.missed / (d.inbound + d.outbound)) * 1000) / 10 : 0,
    }));
  }, [data]);

  const c2Data = useMemo(() => {
    if (!data) return [];
    if (range === 'today') {
      return data.charts.byHourToday.map((h) => ({
        label: h.hour,
        inbound: h.inbound,
        outbound: h.outbound,
      }));
    }
    return data.charts.byDate.map((d) => ({
      label: d.date.slice(5),
      inbound: d.inbound,
      outbound: d.outbound,
    }));
  }, [data, range]);

  const kpis = data?.kpis;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f2f3f8] text-[#03091D]">
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {/* Nav */}
        <div className="flex h-[50px] shrink-0 items-center justify-between border-b border-[#e8eaf0] bg-white px-5">
          <div className="flex items-center">
            <span className="text-[15px] font-extrabold">Analytics</span>
            <div className="ml-6 flex">
              <button type="button" className={tabClass(view === 'supervisor')} onClick={() => setView('supervisor')}>
                Vista supervisor
              </button>
              <button type="button" className={tabClass(view === 'agent')} onClick={() => setView('agent')}>
                Vista agente
              </button>
            </div>
          </div>
          <a
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#001963] px-3.5 py-1.5 text-[11px] font-bold text-white"
            href={exportHref}
          >
            Export CSV
          </a>
        </div>

        <div className="flex shrink-0 border-b border-[#eef0f6] bg-white px-5">
          <button type="button" className={stabClass(channel === 'global')} onClick={() => setChannel('global')}>
            Visión global
          </button>
          <button type="button" className={stabClass(channel === 'inbound')} onClick={() => setChannel('inbound')}>
            Entrantes
          </button>
          <button type="button" className={stabClass(channel === 'outbound')} onClick={() => setChannel('outbound')}>
            Salientes
          </button>
          <button type="button" className={stabClass(channel === 'ai')} onClick={() => setChannel('ai')}>
            AI Voice Agent
          </button>
        </div>

        <div className="flex shrink-0 gap-2 bg-[#f2f3f8] px-5 py-2.5">
          <button type="button" className={chipClass(range === 'today')} onClick={() => setRange('today')}>
            Hoy
          </button>
          <button type="button" className={chipClass(range === 'week')} onClick={() => setRange('week')}>
            Semana
          </button>
          <button type="button" className={chipClass(range === 'month')} onClick={() => setRange('month')}>
            Mes
          </button>
          <span className="ml-auto text-[10px] text-slate-400">
            Zona horaria métricas: {data?.meta?.timezone ?? 'Europe/Madrid'}
          </span>
        </div>

        <div className="flex flex-col gap-3.5 px-5 pb-8 pt-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          {data?.meta?.aiChannelEmpty && channel === 'ai' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              AI Voice Agent: aún no hay etiquetado de llamadas IA en base de datos. Cuando exista, este filtro se
              conectará.
            </div>
          )}
          {loading && !data && <div className="py-16 text-center text-sm text-slate-500">Cargando métricas…</div>}

          {kpis && (
            <>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <KpiCard
                  label="Total llamadas"
                  value={kpis.totalCalls.toLocaleString('es-ES')}
                  delta={formatDelta(kpis.totalCallsDeltaPct)}
                />
                <KpiCard
                  label="Llamadas entrantes"
                  value={kpis.inbound.toLocaleString('es-ES')}
                  delta={formatDelta(kpis.inboundDeltaPct)}
                />
                <KpiCard label="Tiempo conv. medio" value={kpis.avgDurationLabel} delta={{ text: 'Llamadas contestadas', cls: 'text-slate-400' }} />
                <KpiCard
                  label="Llamadas salientes"
                  value={kpis.outbound.toLocaleString('es-ES')}
                  delta={formatDelta(kpis.outboundDeltaPct)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
                <KpiCard label="Tiempo max. espera" value={kpis.maxWaitLabel} delta={{ text: 'Requiere cola ACD', cls: 'text-slate-400' }} />
                <KpiCard
                  label="Llamadas en espera"
                  value={kpis.callsWaiting == null ? '—' : String(kpis.callsWaiting)}
                  delta={{ text: 'Tiempo real Twilio', cls: 'text-slate-400' }}
                />
                <KpiCard label="Agentes en roster" value={String(kpis.connectedAgents)} delta={{ text: 'Filas en agents', cls: 'text-slate-400' }} />
                <KpiCard label="Agentes disponibles" value={String(kpis.availableAgents)} delta={{ text: 'presence_status = available', cls: 'text-slate-400' }} />
                <KpiCard label="ASA vel. respuesta" value={kpis.asaSeconds == null ? '—' : `${kpis.asaSeconds}s`} delta={{ text: 'Sin cola ACD', cls: 'text-slate-400' }} />
              </div>

              <div className="flex flex-wrap items-center gap-5 rounded-xl border border-[#eef0f6] bg-white px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#eef1fb] text-[#3B6CFF]">✓</div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Contestación entrantes (contestadas / (contestadas + perdidas))
                  </p>
                  <p className="text-4xl font-extrabold leading-none text-[#3B6CFF]">
                    {kpis.slaAnsweredPct == null ? '—' : `${kpis.slaAnsweredPct}%`}
                  </p>
                </div>
                <div className="hidden h-12 w-px bg-[#eef0f6] sm:block" />
                <div className="flex gap-7">
                  <div>
                    <p className="text-2xl font-extrabold">{kpis.slaSegment17}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Contestadas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-red-600">{kpis.slaAbandoned}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Perdidas / sin contestar</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {data && (
            <div className="grid gap-2.5 lg:grid-cols-2">
              <div className="rounded-xl border border-[#eef0f6] bg-white p-4">
                <p className="text-[13px] font-bold">Llamadas por día de la semana</p>
                <p className="mb-2 text-[11px] text-slate-400">Entrantes, salientes y % perdidas (aprox.)</p>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={c1Data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: OR }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip />
                      <Bar yAxisId="left" dataKey="inbound" name="Entrantes" stackId="a" fill={B4} radius={[3, 3, 0, 0]} />
                      <Bar yAxisId="left" dataKey="outbound" name="Salientes" stackId="a" fill={B2} radius={[3, 3, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="pct" name="% Perdidas" stroke={OR} strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-[#eef0f6] bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-bold">Llamadas por periodo</p>
                    <p className="text-[11px] text-slate-400">
                      {range === 'today' ? 'Por hora (08–19h) del periodo' : 'Por día (periodo superior)'}
                    </p>
                  </div>
                </div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={c2Data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: range === 'month' ? 8 : 10, fill: '#9ca3af' }} angle={range === 'month' ? -35 : 0} textAnchor={range === 'month' ? 'end' : 'middle'} height={range === 'month' ? 50 : 30} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <Tooltip />
                      <Bar dataKey="inbound" name="Entrantes" stackId="x" fill={B4} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outbound" name="Salientes" stackId="x" fill={B2} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-[#eef0f6] bg-white p-4">
                <p className="text-[13px] font-bold">Historial por día (entrantes / salientes / perdidas)</p>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.byDayOfWeek}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <Tooltip />
                      <Bar dataKey="inbound" name="Entrantes" stackId="h" fill={B4} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="outbound" name="Salientes" stackId="h" fill="#8544FF" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="missed" name="Perdidas" stackId="h" fill="#C1A0FF" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-[#eef0f6] bg-white p-4">
                <p className="text-[13px] font-bold">% abandono por día (entrantes) vs agentes disponibles (actual)</p>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.charts.abandonoByDow}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis yAxisId="p" domain={[0, 100]} tick={{ fontSize: 10, fill: OR }} tickFormatter={(v) => `${v}%`} />
                      <YAxis yAxisId="a" orientation="right" tick={{ fontSize: 10, fill: B4 }} />
                      <Tooltip />
                      <Bar yAxisId="a" dataKey="agents" name="Agentes disp." fill="rgba(59,108,255,0.15)" stroke={B4} />
                      <Line yAxisId="p" type="monotone" dataKey="pct" name="% Abandono" stroke={OR} strokeWidth={2} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-[#eef0f6] bg-white p-4 lg:col-span-2">
                <p className="text-[13px] font-bold">Actividad por hora (08–19h, periodo seleccionado arriba)</p>
                <p className="text-[11px] text-slate-400">Apilado: entrantes + salientes; no es concurrencia en tiempo real.</p>
                <div className="h-[170px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.byHourToday}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <Tooltip />
                      <Bar dataKey="inbound" name="Entrantes" stackId="z" fill={B4} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="outbound" name="Salientes" stackId="z" fill="#8544FF" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {data && (
            <div className="rounded-xl border border-[#eef0f6] bg-white p-4">
              <p className="text-[13px] font-bold">Rendimiento de agentes</p>
              <p className="text-[11px] text-slate-400">Basado en `voice_call_records` con agente identificado (WebRTC client).</p>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-[860px] w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#f0f1f5] text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-2 py-2">Agente</th>
                      <th className="px-2 py-2">Total</th>
                      <th className="px-2 py-2">Contestadas</th>
                      <th className="px-2 py-2">Perdidas</th>
                      <th className="px-2 py-2">Inbound</th>
                      <th className="px-2 py-2">Cola gral.</th>
                      <th className="px-2 py-2">Trans.</th>
                      <th className="px-2 py-2">T. medio</th>
                      <th className="px-2 py-2">Resolución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.charts.agentPerformance.map((a) => (
                      <tr key={a.userId} className="border-b border-[#f8f9fb]">
                        <td className="px-2 py-2 font-bold">{a.name}</td>
                        <td className="px-2 py-2 font-bold">{a.total}</td>
                        <td className="px-2 py-2 text-emerald-700">
                          {a.answered}{' '}
                          <span className="text-[10px] text-slate-400">({a.total ? Math.round((a.answered / a.total) * 100) : 0}%)</span>
                        </td>
                        <td className="px-2 py-2 text-red-600">
                          {a.missed}{' '}
                          <span className="text-[10px] text-slate-400">({a.total ? Math.round((a.missed / a.total) * 100) : 0}%)</span>
                        </td>
                        <td className="px-2 py-2 font-bold text-[#3B6CFF]">{a.direct}</td>
                        <td className="px-2 py-2 text-slate-400">—</td>
                        <td className="px-2 py-2 text-slate-400">—</td>
                        <td className="px-2 py-2">{a.avgDurationLabel}</td>
                        <td className="px-2 py-2 font-bold">{a.resolutionPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data && data.charts.managedBars.length > 0 && (
            <div className="grid gap-2.5 lg:grid-cols-2">
              <div className="rounded-xl border border-[#eef0f6] bg-white p-4">
                <p className="text-[13px] font-bold">Llamadas gestionadas por agente</p>
                <div className="mt-3 space-y-2">
                  {(() => {
                    const mx = Math.max(...data.charts.managedBars.map((b) => b.total), 1);
                    return data.charts.managedBars.map((b) => (
                    <div key={b.name} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-[11px] font-semibold">{b.name}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#3B6CFF]" style={{ width: `${(b.total / mx) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right text-[11px] font-bold">{b.total}</span>
                      <span className="w-10 text-right text-[10px] font-bold text-emerald-600">✓{b.pctAnswered}%</span>
                      <span className="w-10 text-right text-[10px] font-bold text-red-600">✗{b.pctMissed}%</span>
                    </div>
                    ));
                  })()}
                </div>
              </div>
              <div className="rounded-xl border border-[#eef0f6] bg-white p-4">
                <p className="text-[13px] font-bold">Llamadas perdidas por agente</p>
                <p className="text-[11px] text-slate-400">Total período: {data.charts.totalLostCalls}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {data.charts.lostByAgent.map((x, i) => {
                    const pct = data.charts.totalLostCalls ? Math.round((x.lost / data.charts.totalLostCalls) * 100) : 0;
                    const colors = ['#001963', B4, '#8544FF', '#5900FF', B2, '#C1A0FF', '#9ca3af'];
                    const c = colors[i % colors.length];
                    return (
                      <div key={x.name} className="rounded-[10px] border border-[#eef0f6] px-2 py-3 text-center">
                        <p className="text-[10px] font-bold uppercase text-slate-400">{x.name}</p>
                        <p className="text-2xl font-extrabold" style={{ color: c }}>
                          {x.lost}
                        </p>
                        <p className="text-[10px] text-slate-400">{pct}% del total</p>
                        <div className="mx-auto mt-2 h-1 w-full max-w-[80px] overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {data && (
            <div className="border-t-[2.5px] border-[#3B6CFF] pt-4">
              <p className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-[#001963]">
                Gestión de capacidad
              </p>
              <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                <KpiCard label="Agentes en turno" value={String(data.charts.capacity.agentsOnShift)} delta={{ text: 'Filas en agents', cls: 'text-slate-400' }} />
                <KpiCard label="% llamadas perdidas (entrantes)" value={`${data.charts.capacity.lostPctTotal}%`} delta={{ text: 'Periodo actual', cls: 'text-slate-400' }} />
                <KpiCard label="Franja más cargada (entrantes)" value={data.charts.capacity.criticalFranja} delta={{ text: 'Por volumen', cls: 'text-slate-400' }} />
                <KpiCard label="Ocupación media" value={data.charts.capacity.occupancyPct == null ? 'N/D' : `${data.charts.capacity.occupancyPct}%`} delta={{ text: 'Sin ACD', cls: 'text-slate-400' }} />
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#eef0f6] bg-white p-4">
                <p className="mb-2 text-[13px] font-bold">Detalle por franja horaria</p>
                <table className="min-w-[560px] w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#f0f1f5] text-[10px] font-bold uppercase text-slate-400">
                      <th className="px-2 py-2">Franja</th>
                      <th className="px-2 py-2">Recib.</th>
                      <th className="px-2 py-2">Realiz.</th>
                      <th className="px-2 py-2">Ag.</th>
                      <th className="px-2 py-2">% Perd.</th>
                      <th className="px-2 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.charts.capacity.hourlyDetail.map((row) => (
                      <tr key={row.franja} className="border-b border-[#f8f9fb]">
                        <td className="px-2 py-2">{row.franja}</td>
                        <td className="px-2 py-2">{row.recibidas}</td>
                        <td className="px-2 py-2">{row.realizadas}</td>
                        <td className="px-2 py-2">{row.agentes}</td>
                        <td className="px-2 py-2">{row.pctPerdidas}%</td>
                        <td className="px-2 py-2">
                          <span
                            className={
                              row.estado === 'OK'
                                ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800'
                                : row.estado === 'Alerta'
                                  ? 'rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900'
                                  : 'rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800'
                            }
                          >
                            {row.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data?.meta?.dataSource && (
            <p className="text-center text-[10px] text-slate-400">{data.meta.dataSource}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: { text: string; cls: string };
}) {
  return (
    <div className="rounded-xl border border-[#eef0f6] bg-white px-4 py-3.5">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mb-1 text-[22px] font-extrabold leading-tight">{value}</p>
      <p className={`text-[10px] font-semibold ${delta.cls}`}>{delta.text}</p>
    </div>
  );
}
