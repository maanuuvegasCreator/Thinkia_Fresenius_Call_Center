import { Call, Device } from '@twilio/voice-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneIncoming } from 'lucide-react';
import { useAgentPresence } from '../context/AgentPresenceContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

/** Misma cookie de sesión que Next; en prod `/portal` y `/api` comparten origen. */
async function fetchVoiceToken(): Promise<string> {
  const res = await fetch('/api/token', { cache: 'no-store', credentials: 'include' });
  const text = await res.text();
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return text;
}

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

    async function connect() {
      setVoiceBanner(null);
      try {
        const jwt = await fetchVoiceToken();
        if (disposed) return;

        deviceRef.current?.destroy();
        const device = new Device(jwt, { logLevel: 0, closeProtection: true });
        deviceRef.current = device;

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
          if (!disposed) setVoiceBanner(err.message ?? 'Error Twilio');
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

  return (
    <>
      {voiceBanner ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[90] max-w-md -translate-x-1/2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 shadow-lg">
          <span className="font-medium">Voz: </span>
          {voiceBanner}
        </div>
      ) : registered ? (
        <div
          className={
            acceptsIncomingCalls
              ? 'pointer-events-none fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-900 shadow'
              : 'pointer-events-none fixed bottom-4 left-1/2 z-[90] max-w-md -translate-x-1/2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-center text-[11px] font-medium text-slate-800 shadow'
          }
        >
          {acceptsIncomingCalls
            ? 'Twilio conectado · listo para entrantes'
            : 'Twilio conectado · estado ≠ disponible: las entrantes se rechazan (sin popup)'}
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
        <DialogContent className="z-[100] max-w-md gap-4 border-slate-200 sm:max-w-md [&>button.absolute]:hidden">
          {incoming && meta ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-amber-700">
                  <PhoneIncoming className="h-6 w-6 shrink-0" />
                  <DialogTitle className="text-lg">Llamada entrante</DialogTitle>
                </div>
                <DialogDescription asChild>
                  <div className="space-y-2 pt-2 text-left text-base text-slate-800">
                    <p>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teléfono</span>
                      <br />
                      <span className="font-mono text-lg font-semibold">{meta.from}</span>
                    </p>
                    {meta.callerName ? (
                      <p>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</span>
                        <br />
                        <span>{meta.callerName}</span>
                      </p>
                    ) : null}
                    <p>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Llamada a</span>
                      <br />
                      <span className="font-mono text-sm">{meta.to}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      ID llamada: <span className="font-mono">{meta.callSid}</span>
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={rejectIncoming}>
                  Rechazar
                </Button>
                <Button
                  type="button"
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                  onClick={() => void answer()}
                >
                  Descolgar
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {active && meta ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-sky-800">
                  <Phone className="h-6 w-6 shrink-0" />
                  <DialogTitle className="text-lg">En llamada</DialogTitle>
                </div>
                <DialogDescription asChild>
                  <div className="space-y-1 pt-2 text-left text-sm text-slate-700">
                    <p className="font-mono font-medium">{meta.from}</p>
                    {meta.callerName ? <p>{meta.callerName}</p> : null}
                    <p className="text-xs text-slate-500">Estado: {String(active.status())}</p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
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
