import type { LucideIcon } from 'lucide-react';
import { Call, Device } from '@twilio/voice-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Clock, FileText, Phone, PhoneIncoming, Shield, UserRound } from 'lucide-react';
import { useAgentPresence } from '../context/AgentPresenceContext';
import { resolveDynamicsCallerProfile } from '@/lib/dynamicsCallerEnrichment';
import {
  TWILIO_VOICE_TOKEN_REFRESH_MARGIN_MS,
  createTwilioVoiceRefreshController,
  fetchTwilioVoiceTokenWithRetry,
} from '@/lib/twilioVoiceDeviceHelpers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

function formatCallerId(params: Record<string, string> | undefined): {
  from: string;
  callerName: string;
  to: string;
  callSid: string;
} {
  const p = params ?? {};
  return {
    from: p.From ?? '—',
    callerName: (p.CallerName ?? '').trim(),
    to: p.To ?? '—',
    callSid: p.CallSid ?? '—',
  };
}

function InfoTile({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#eef0f6] bg-white p-2.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#3B6CFF]" aria-hidden />
        {label}
      </div>
      <p
        className={`mt-1 text-xs font-semibold leading-snug text-[#03091D] ${mono ? 'font-mono text-[11px] font-medium' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Registro Twilio + popup de entrante en todo el portal (MainLayout).
 * El micrófono se pide al descolgar (navegadores suelen exigir gesto del usuario).
 */
export function PortalVoiceLayer() {
  const { acceptsIncomingCalls } = useAgentPresence();
  const acceptsRef = useRef(acceptsIncomingCalls);
  acceptsRef.current = acceptsIncomingCalls;

  const deviceRef = useRef<Device | null>(null);
  const [voiceBanner, setVoiceBanner] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const [incoming, setIncoming] = useState<Call | null>(null);
  const [active, setActive] = useState<Call | null>(null);
  const [muted, setMuted] = useState(false);

  const attachCallListeners = useCallback((call: Call) => {
    call.on('disconnect', () => {
      setActive(null);
      setIncoming(null);
      setMuted(false);
    });
    call.on('cancel', () => setIncoming(null));
    call.on('reject', () => setIncoming(null));
  }, []);

  useEffect(() => {
    let disposed = false;
    let detachVoiceRefresh: (() => void) | null = null;

    async function connect() {
      setVoiceBanner(null);
      try {
        const jwt = await fetchTwilioVoiceTokenWithRetry();
        if (disposed) return;

        detachVoiceRefresh?.();
        detachVoiceRefresh = null;
        deviceRef.current?.destroy();
        const device = new Device(jwt, {
          logLevel: 0,
          closeProtection: true,
          tokenRefreshMs: TWILIO_VOICE_TOKEN_REFRESH_MARGIN_MS,
        });
        deviceRef.current = device;

        const voiceRefresh = createTwilioVoiceRefreshController(device, {
          isActive: () => !disposed,
          onRefreshFailed: (e) => {
            if (!disposed) {
              setVoiceBanner(e instanceof Error ? e.message : 'No se pudo renovar el token de voz');
            }
          },
          onRefreshed: () => {
            if (!disposed) setVoiceBanner(null);
          },
        });
        detachVoiceRefresh = voiceRefresh.detach;

        device.on('registered', () => {
          if (!disposed) {
            setRegistered(true);
            setVoiceBanner(null);
          }
        });
        device.on('unregistered', () => {
          if (!disposed) setRegistered(false);
        });
        device.on('error', (err) => {
          if (disposed) return;
          if (voiceRefresh.handleExpiredDeviceError(err)) return;
          setVoiceBanner(err.message ?? 'Error Twilio');
        });
        device.on('incoming', (call) => {
          if (disposed) return;
          if (!acceptsRef.current) {
            try {
              call.reject();
            } catch {
              /* ignore */
            }
            return;
          }
          attachCallListeners(call);
          setIncoming(call);
        });

        await device.register();
      } catch (e) {
        if (!disposed) {
          setVoiceBanner(e instanceof Error ? e.message : 'No se pudo registrar voz');
        }
      }
    }

    void connect();

    return () => {
      disposed = true;
      detachVoiceRefresh?.();
      detachVoiceRefresh = null;
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, [attachCallListeners]);

  const hangup = useCallback(() => {
    active?.disconnect();
    incoming?.reject();
    setIncoming(null);
    setActive(null);
    setMuted(false);
  }, [active, incoming]);

  const answer = useCallback(async () => {
    if (!incoming) return;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceBanner('Permiso de micrófono necesario para contestar.');
      return;
    }
    incoming.accept();
    setActive(incoming);
    setIncoming(null);
  }, [incoming]);

  const rejectIncoming = useCallback(() => {
    incoming?.reject();
    setIncoming(null);
  }, [incoming]);

  const toggleMute = useCallback(() => {
    if (!active) return;
    const next = !muted;
    active.mute(next);
    setMuted(next);
  }, [active, muted]);

  const dialogOpen = Boolean(incoming || active);
  const meta = incoming
    ? formatCallerId(incoming.parameters as Record<string, string>)
    : active
      ? formatCallerId(active.parameters as Record<string, string>)
      : null;

  const dynamics = useMemo(() => {
    if (!meta) return null;
    return resolveDynamicsCallerProfile(meta.from, meta.callerName);
  }, [meta]);

  return (
    <>
      {voiceBanner ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[90] max-w-md -translate-x-1/2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 shadow-lg">
          <span className="font-medium">Voz: </span>
          {voiceBanner}
        </div>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (incoming) rejectIncoming();
            if (active) hangup();
          }
        }}
      >
        <DialogContent className="z-[100] max-w-lg gap-0 overflow-hidden border-[#e8eaf0] p-0 shadow-2xl sm:max-w-lg [&>button.absolute]:hidden">
          {incoming && meta && dynamics ? (
            <>
              <div className="bg-[#001963] px-5 py-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                      <PhoneIncoming className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold tracking-tight text-white">Llamada entrante</DialogTitle>
                      <p className="mt-0.5 text-[11px] font-medium text-white/80">Thinkia Call Center</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-[#3B6CFF] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Dynamics 365
                  </span>
                </div>
                <p className="mt-3 text-[11px] leading-snug text-white/75">
                  Ficha enriquecida (simulación): coincidencia por teléfono como en integración CRM real.
                </p>
              </div>

              <div className="bg-[#f2f3f8] px-5 py-4">
                <div className="flex items-center gap-3 rounded-xl border border-[#eef0f6] bg-white p-3 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef1fb] text-base font-extrabold text-[#001963]">
                    {dynamics.contactName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-[#03091D]">{dynamics.contactName}</p>
                    <p className="font-mono text-sm font-semibold text-[#3B6CFF]">{dynamics.phoneDisplay}</p>
                    {dynamics.matchedInCrm ? (
                      <span className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                        Coincidencia en CRM
                      </span>
                    ) : (
                      <span className="mt-1 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-200">
                        Sin ficha exacta · vista genérica
                      </span>
                    )}
                  </div>
                </div>

                <DialogHeader className="sr-only">
                  <DialogDescription>Llamada entrante con datos simulados de Dynamics</DialogDescription>
                </DialogHeader>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <InfoTile icon={Building2} label="Cuenta / organización" value={dynamics.accountName} />
                  <InfoTile icon={FileText} label="Identificadores" value={dynamics.patientOrContactId} />
                  <InfoTile icon={Shield} label="Segmento" value={dynamics.segment} />
                  <InfoTile icon={Clock} label="Última actividad" value={dynamics.lastActivity} />
                  <InfoTile icon={UserRound} label="Propietario (Dynamics)" value={dynamics.caseOwner} />
                  <InfoTile icon={Phone} label="Línea / destino" value={meta.to} mono />
                </div>

                <div className="mt-3 rounded-lg border border-[#c7d4ff] bg-[#f0f4ff] px-3 py-2.5 text-[11px] leading-relaxed text-[#001963]">
                  <span className="font-extrabold">Notas CRM · </span>
                  {dynamics.notes}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  ID Twilio: <span className="font-mono">{meta.callSid}</span>
                </p>
              </div>

              <DialogFooter className="flex w-full flex-row gap-2 border-t border-[#eef0f6] bg-white px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-slate-300"
                  onClick={rejectIncoming}
                >
                  Rechazar
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-[#001963] font-semibold text-white hover:bg-[#0a2463]"
                  onClick={() => void answer()}
                >
                  Descolgar
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {active && meta && dynamics ? (
            <>
              <div className="bg-[#001963] px-5 py-3 text-white">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 shrink-0" aria-hidden />
                  <DialogTitle className="text-base font-bold text-white">En llamada</DialogTitle>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-white/95">{dynamics.contactName}</p>
                <p className="font-mono text-xs text-white/80">{dynamics.phoneDisplay}</p>
              </div>
              <DialogHeader className="sr-only">
                <DialogDescription>Llamada activa</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 px-5 py-3 text-left text-xs text-slate-600">
                <p>
                  <span className="font-semibold text-slate-500">Cuenta: </span>
                  {dynamics.accountName}
                </p>
                <p className="text-slate-500">Estado Twilio: {String(active.status())}</p>
              </div>
              <DialogFooter className="gap-2 border-t border-[#eef0f6] px-5 py-3 sm:justify-end">
                <Button type="button" variant="secondary" onClick={toggleMute}>
                  {muted ? 'Quitar silencio' : 'Silenciar'}
                </Button>
                <Button type="button" variant="destructive" onClick={hangup}>
                  Colgar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
