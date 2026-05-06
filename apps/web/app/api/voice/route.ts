import twilio from 'twilio';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/admin';
import { twilioClientIdentityFromUserId } from '@/lib/twilio-identity';
import { publicVoiceStatusCallbackUrl } from '@/lib/twilio-webhook-url';

const VoiceResponse = twilio.twiml.VoiceResponse;

function normalizeDialNumber(value: string): string {
  return value.trim();
}

function normalizeE164(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function isBlockedNumber(blocked: string[], fromValue: string): boolean {
  const from = normalizeE164(fromValue);
  return blocked.some((b) => normalizeE164(b) === from);
}

type IvrFlow = {
  entryNumbers: string[];
  root: {
    type: 'time_rule';
    config: { name: string; schedules?: { days: string; from: string; to: string }[] };
    branches: { id: string; label: string; nodes: Array<any> }[];
  };
};

function isInBusinessHours(schedules: { days: string; from: string; to: string }[], now: Date): boolean {
  // days are like "L-J", "V", "S", "D", "L", "M", "X", "J"
  const dow = now.getDay(); // 0=Sun..6=Sat
  const map = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;
  const day = map[dow] ?? 'L';
  const hhmm = now.toISOString().slice(11, 16);

  const inRange = (from: string, to: string) => hhmm >= from && hhmm <= to;
  const includesDay = (expr: string) => {
    const t = expr.replace(/\s+/g, '');
    if (t.includes('-') && t.length === 3) {
      const [a, b] = t.split('-') as [string, string];
      const order = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      const id = order.indexOf(day);
      if (ia === -1 || ib === -1 || id === -1) return false;
      return ia <= id && id <= ib;
    }
    return t === day;
  };

  return schedules.some((s) => includesDay(s.days) && inRange(s.from, s.to));
}

function readStep(request: Request): number {
  const url = new URL(request.url);
  const s = url.searchParams.get('step');
  const n = s ? Number.parseInt(s, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function withStepUrl(request: Request, step: number): string {
  const u = new URL(request.url);
  u.searchParams.set('step', String(step));
  return u.toString();
}

async function loadCallSettings() {
  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase.from('call_settings').select('*').eq('id', 'default').maybeSingle();
  return data;
}

async function loadIvrFlow(toNumber: string): Promise<IvrFlow | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase.from('ivr_flow').select('flow_json').eq('twilio_to_number', toNumber).maybeSingle();
  return (data?.flow_json as IvrFlow | null) ?? null;
}

async function filterAvailableAgents(agentUserIds: string[]): Promise<string[]> {
  const ids = agentUserIds.filter(Boolean);
  if (!ids.length) return [];
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('agents')
    .select('user_id,presence_status')
    .in('user_id', ids);
  if (error) return [];
  const available = new Set(
    (data ?? [])
      .filter((r: any) => String(r.presence_status ?? '').toLowerCase() === 'available')
      .map((r: any) => String(r.user_id))
  );
  return ids.filter((id) => available.has(id));
}

function resolveAgentTargets(target: string | undefined, agentUserIds: string[]) {
  const ids = agentUserIds.filter(Boolean);
  if (!target) return ids;
  if (target === 'a1') return ids.slice(0, 1);
  if (target === 'a2') return ids.slice(1, 2);
  if (target === 'g1') return ids.slice(0, 4);
  if (target === 'g2') return ids.slice(0); // cola general = todos
  return ids.slice(0);
}

/**
 * POST /api/voice — TwiML entrante/saliente (AICONCTATC-80 + AICONCTATC-88).
 * Entrante: mapeo `inbound_routing` → uno o varios `<Client>` (base multi-ring).
 * Saliente: `From` client:* → marcar `To` con callerId.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const from = String(form.get('From') ?? '');
  const to = String(form.get('To') ?? '');
  const callerId = process.env.TWILIO_CALLER_ID;
  const step = readStep(request);

  const twiml = new VoiceResponse();

  if (!callerId) {
    twiml.say({ language: 'es-ES' }, 'Configuración incompleta: falta caller ID.');
    return xmlResponse(twiml);
  }

  const isFromClient = from.startsWith('client:');

  if (isFromClient) {
    if (!to) {
      twiml.say({ language: 'es-ES' }, 'No se indicó número de destino.');
      return xmlResponse(twiml);
    }
    const statusCb = publicVoiceStatusCallbackUrl();
    const dial = twiml.dial({
      callerId,
      ...(statusCb
        ? {
            statusCallback: statusCb,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'] as const,
            statusCallbackMethod: 'POST' as const,
          }
        : {}),
    });
    dial.number(normalizeDialNumber(to));
    return xmlResponse(twiml);
  }

  /* Entrante PSTN → WebRTC por mapeo */
  const toNorm = normalizeE164(normalizeDialNumber(to));
  let clientIdentities: string[] = [];
  let agentUserIds: string[] = [];

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data: row, error: qErr } = await supabase
      .from('inbound_routing')
      .select('agent_user_ids')
      .eq('twilio_to_number', toNorm)
      .maybeSingle();

    if (qErr) {
      twiml.say({ language: 'es-ES' }, 'Error al consultar el enrutamiento de llamadas.');
      return xmlResponse(twiml);
    }

    agentUserIds = ((row?.agent_user_ids as string[] | null) ?? []).map(String);
  } catch {
    twiml.say({ language: 'es-ES' }, 'Falta configuración Supabase para enrutamiento (service role y URL).');
    return xmlResponse(twiml);
  }

  const settings = await loadCallSettings().catch(() => null);
  if (settings && Array.isArray(settings.blocked_numbers) && isBlockedNumber(settings.blocked_numbers as string[], from)) {
    twiml.reject();
    return xmlResponse(twiml);
  }

  const ivr = await loadIvrFlow(toNorm).catch(() => null);
  const schedules = ivr?.root?.config?.schedules ?? [];
  const inHours = schedules.length ? isInBusinessHours(schedules, new Date()) : true;

  const branch =
    ivr?.root?.branches?.find((b) => (inHours ? b.label === 'En horario' : b.label === 'Fuera de horario')) ??
    ivr?.root?.branches?.[0] ??
    null;

  if (!agentUserIds.length) {
    twiml.say(
      { language: 'es-ES' },
      'No hay agentes asignados para este número. Configura la tabla inbound_routing en Supabase.'
    );
    return xmlResponse(twiml);
  }

  // Global availability filter: Twilio only rings available agents.
  const availableAgentUserIds = await filterAvailableAgents(agentUserIds).catch(() => []);

  // If no IVR published, keep legacy simultaneous ring (all).
  if (!branch) {
    if (!availableAgentUserIds.length) {
      const forward = settings?.external_forward_number as string | null;
      if (forward) {
        const dial = twiml.dial({ callerId });
        dial.number(normalizeDialNumber(forward));
        return xmlResponse(twiml);
      }
      twiml.say({ language: 'es-ES' }, 'En este momento no hay agentes disponibles. Por favor, inténtelo más tarde.');
      twiml.hangup();
      return xmlResponse(twiml);
    }

    clientIdentities = availableAgentUserIds.map((id) => twilioClientIdentityFromUserId(id));
    const statusCb = publicVoiceStatusCallbackUrl();
    const dial = twiml.dial({
      timeout: 45,
      ...(statusCb
        ? {
            statusCallback: statusCb,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'] as const,
            statusCallbackMethod: 'POST' as const,
          }
        : {}),
    });
    for (const identity of clientIdentities) {
      dial.client(identity);
    }
    return xmlResponse(twiml);
  }

  const nodes: Array<any> = Array.isArray(branch.nodes) ? branch.nodes : [];
  const node = nodes[step] ?? null;
  if (!node) {
    twiml.hangup();
    return xmlResponse(twiml);
  }

  const type = String(node.type ?? '');
  const cfg = (node.config ?? {}) as any;
  const statusCb = publicVoiceStatusCallbackUrl();

  if (type === 'audio_message' || type === 'waiting') {
    const text =
      (cfg.message_text as string | undefined) ??
      (inHours ? (settings?.business_hours_message as string | null) : (settings?.after_hours_message as string | null)) ??
      'Gracias por llamar. Un agente le atenderá en breve.';
    twiml.say({ language: 'es-ES' }, text);
    twiml.redirect({ method: 'POST' }, withStepUrl(request, step + 1));
    return xmlResponse(twiml);
  }

  if (type === 'ring_to') {
    const targetIds = resolveAgentTargets(cfg.target, availableAgentUserIds);
    if (!targetIds.length) {
      // Nobody available for this step → proceed to next node (queue/voicemail/redirect).
      twiml.redirect({ method: 'POST' }, withStepUrl(request, step + 1));
      return xmlResponse(twiml);
    }
    const identities = targetIds.map((id) => twilioClientIdentityFromUserId(id));
    const timeout = typeof cfg.timeout === 'number' ? cfg.timeout : 15;

    const dial = twiml.dial({
      timeout,
      action: withStepUrl(request, step + 1),
      method: 'POST',
      ...(statusCb
        ? {
            statusCallback: statusCb,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'] as const,
            statusCallbackMethod: 'POST' as const,
          }
        : {}),
      ...(settings?.inbound_recording_enabled
        ? {
            record: 'record-from-answer' as const,
          }
        : {}),
    });

    for (const identity of identities) {
      dial.client(identity);
    }
    return xmlResponse(twiml);
  }

  if (type === 'redirect') {
    // Redirect-to PSTN forward (optional).
    const forward = (cfg.forward_number as string | undefined) ?? (settings?.external_forward_number as string | null);
    if (forward) {
      const dial = twiml.dial({ callerId });
      dial.number(normalizeDialNumber(forward));
      return xmlResponse(twiml);
    }
    twiml.redirect({ method: 'POST' }, withStepUrl(request, step + 1));
    return xmlResponse(twiml);
  }

  if (type === 'voicemail') {
    const text =
      (cfg.message_text as string | undefined) ??
      (settings?.after_hours_message as string | null) ??
      'Por favor, deje su mensaje después de la señal.';
    twiml.say({ language: 'es-ES' }, text);
    twiml.record({
      playBeep: true,
      maxLength: 120,
    });
    return xmlResponse(twiml);
  }

  // end / unknown
  twiml.hangup();
  return xmlResponse(twiml);
}

function xmlResponse(twiml: { toString: () => string }) {
  return new Response(twiml.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
    },
  });
}
