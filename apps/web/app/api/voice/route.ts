import twilio from 'twilio';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/admin';
import { twilioClientIdentityFromUserId } from '@/lib/twilio-identity';
import { publicVoiceStatusCallbackUrl } from '@/lib/twilio-webhook-url';

const VoiceResponse = twilio.twiml.VoiceResponse;

function normalizeDialNumber(value: string): string {
  return value.trim();
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
  const toNorm = normalizeDialNumber(to);
  let clientIdentities: string[] = [];

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

    const ids = (row?.agent_user_ids as string[] | null) ?? [];
    clientIdentities = ids.map((id) => twilioClientIdentityFromUserId(id));
  } catch {
    twiml.say({ language: 'es-ES' }, 'Falta configuración Supabase para enrutamiento (service role y URL).');
    return xmlResponse(twiml);
  }

  if (clientIdentities.length === 0) {
    twiml.say(
      { language: 'es-ES' },
      'No hay agentes asignados para este número. Configura la tabla inbound_routing en Supabase.'
    );
    return xmlResponse(twiml);
  }

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

function xmlResponse(twiml: { toString: () => string }) {
  return new Response(twiml.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
    },
  });
}
