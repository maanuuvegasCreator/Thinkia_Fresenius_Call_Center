'use client';

import { Call, Device } from '@twilio/voice-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type MicState = 'idle' | 'checking' | 'granted' | 'denied' | 'blocked' | 'no-device';

type DeviceState = 'idle' | 'loading-token' | 'registering' | 'registered' | 'error';

const dialKeys = [
  { d: '1', l: '' },
  { d: '2', l: 'ABC' },
  { d: '3', l: 'DEF' },
  { d: '4', l: 'GHI' },
  { d: '5', l: 'JKL' },
  { d: '6', l: 'MNO' },
  { d: '7', l: 'PQRS' },
  { d: '8', l: 'TUV' },
  { d: '9', l: 'WXYZ' },
  { d: '*', l: '' },
  { d: '0', l: '+' },
  { d: '#', l: '' },
];

/** Presencia local según Device/Call (AICONCTATC-91). */
function localPresence(
  deviceState: DeviceState,
  active: Call | null,
  incoming: Call | null
): { label: string; className: string } {
  if (active) {
    return { label: 'En llamada', className: 'bg-rose-100 text-rose-900 ring-1 ring-rose-200' };
  }
  if (incoming) {
    return { label: 'Entrante (sonando)', className: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200' };
  }
  if (deviceState === 'registered') {
    return { label: 'Disponible', className: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200' };
  }
  if (deviceState === 'loading-token' || deviceState === 'registering') {
    return { label: 'Conectando…', className: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200' };
  }
  if (deviceState === 'error') {
    return { label: 'Error Twilio', className: 'bg-red-100 text-red-900 ring-1 ring-red-200' };
  }
  return { label: 'Desconectado', className: 'bg-neutral-200 text-neutral-700 ring-1 ring-neutral-300' };
}

function micErrorMessage(err: unknown): string {
  if (!(err instanceof DOMException)) {
    return 'No se pudo acceder al micrófono.';
  }
  switch (err.name) {
    case 'NotAllowedError':
      return 'Permiso denegado. Revisa el icono de la barra de direcciones o ajustes del sitio y permite el micrófono.';
    case 'NotFoundError':
      return 'No se detectó ningún micrófono.';
    case 'NotReadableError':
      return 'El micrófono está en uso por otra aplicación o el navegador no puede leerlo.';
    case 'SecurityError':
      return 'El navegador bloqueó el acceso (HTTPS requerido salvo en localhost).';
    default:
      return `Error de audio (${err.name}).`;
  }
}

/**
 * Softphone WebRTC + @twilio/voice-sdk (AICONCTATC-81) y flujo de micrófono (AICONCTATC-82).
 */
export function TwilioSoftphone() {
  const deviceRef = useRef<Device | null>(null);
  const [micState, setMicState] = useState<MicState>('idle');
  const [micDetail, setMicDetail] = useState<string | null>(null);

  const [deviceState, setDeviceState] = useState<DeviceState>('idle');
  const [deviceDetail, setDeviceDetail] = useState<string | null>(null);

  const [incoming, setIncoming] = useState<Call | null>(null);
  const [active, setActive] = useState<Call | null>(null);
  const [digits, setDigits] = useState('');
  const [muted, setMuted] = useState(false);

  const attachCallListeners = useCallback(
    (call: Call, opts?: { ringLabel?: string }) => {
      call.on('disconnect', () => {
        setActive(null);
        setIncoming(null);
        setMuted(false);
      });
      call.on('cancel', () => {
        setIncoming(null);
        if (opts?.ringLabel) {
          setDeviceDetail(opts.ringLabel);
        }
      });
      call.on('reject', () => {
        setIncoming(null);
      });
    },
    []
  );

  const requestMic = useCallback(async () => {
    setMicState('checking');
    setMicDetail(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicState('granted');
    } catch (e) {
      const msg = micErrorMessage(e);
      setMicDetail(msg);
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        setMicState('denied');
      } else if (e instanceof DOMException && e.name === 'NotFoundError') {
        setMicState('no-device');
      } else {
        setMicState('blocked');
      }
    }
  }, []);

  const connectTwilio = useCallback(async () => {
    if (micState !== 'granted') return;
    setDeviceState('loading-token');
    setDeviceDetail(null);
    try {
      const res = await fetch('/api/token', { cache: 'no-store', credentials: 'include' });
      if (!res.ok) {
        const errText = await res.text();
        let msg = `Token HTTP ${res.status}`;
        try {
          const j = JSON.parse(errText) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          if (errText) msg = errText;
        }
        throw new Error(msg);
      }
      const jwt = await res.text();
      deviceRef.current?.destroy();
      const device = new Device(jwt, {
        logLevel: 0,
        closeProtection: true,
      });
      deviceRef.current = device;

      device.on('registered', () => {
        setDeviceState('registered');
      });
      device.on('unregistered', () => {
        setDeviceState('idle');
        setDeviceDetail(null);
      });
      device.on('error', (err) => {
        setDeviceState('error');
        setDeviceDetail(err.message ?? 'Error en el dispositivo Twilio');
      });
      device.on('incoming', (call) => {
        setIncoming(call);
        attachCallListeners(call, {
          ringLabel:
            'Entrante cancelada: otro cliente contestó antes, tiempo agotado o la llamada se retiró (multi-dispositivo / AICONCTATC-99).',
        });
      });

      setDeviceState('registering');
      await device.register();
    } catch (e) {
      setDeviceState('error');
      setDeviceDetail(e instanceof Error ? e.message : 'Error al conectar');
    }
  }, [attachCallListeners, micState]);

  useEffect(() => {
    return () => {
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, []);

  const hangup = useCallback(() => {
    active?.disconnect();
    incoming?.reject();
    setIncoming(null);
    setActive(null);
    setMuted(false);
  }, [active, incoming]);

  const toggleMute = useCallback(() => {
    if (!active) return;
    const next = !muted;
    active.mute(next);
    setMuted(next);
  }, [active, muted]);

  const answer = useCallback(() => {
    if (!incoming) return;
    incoming.accept();
    setActive(incoming);
    setIncoming(null);
    attachCallListeners(incoming);
  }, [attachCallListeners, incoming]);

  const placeCall = useCallback(async () => {
    const device = deviceRef.current;
    if (!device || deviceState !== 'registered' || !digits.trim()) return;
    try {
      const call = await device.connect({ params: { To: digits.trim() } });
      setActive(call);
      attachCallListeners(call);
    } catch (e) {
      setDeviceDetail(e instanceof Error ? e.message : 'No se pudo iniciar la llamada');
    }
  }, [attachCallListeners, deviceState, digits]);

  const inCallUi = incoming || active;

  const presence = useMemo(
    () => localPresence(deviceState, active, incoming),
    [deviceState, active, incoming]
  );

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-neutral-900">Softphone (Twilio)</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${presence.className}`}>{presence.label}</span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Presencia local según Device/Call; flujo: micrófono → Twilio → teclado (base para sincro global en etapa 2).
        </p>
      </header>

      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">1. Micrófono</h2>
        {micState === 'idle' && (
          <p className="mt-2 text-sm text-neutral-600">
            Antes de registrar el cliente Twilio, el navegador debe permitir el audio.
          </p>
        )}
        {micState === 'checking' && <p className="mt-2 text-sm text-neutral-600">Solicitando permiso…</p>}
        {micState === 'granted' && <p className="mt-2 text-sm text-green-800">Micrófono permitido.</p>}
        {(micState === 'denied' || micState === 'blocked' || micState === 'no-device') && (
          <p className="mt-2 text-sm text-red-800">{micDetail}</p>
        )}
        <button
          type="button"
          onClick={requestMic}
          disabled={micState === 'checking' || micState === 'granted'}
          className="mt-3 w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {micState === 'granted' ? 'Audio listo' : 'Comprobar permisos de micrófono'}
        </button>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">2. Conexión Twilio</h2>
        {deviceState === 'idle' && (
          <p className="mt-2 text-sm text-neutral-600">Registra el cliente cuando el micrófono esté concedido.</p>
        )}
        {(deviceState === 'loading-token' || deviceState === 'registering') && (
          <p className="mt-2 text-sm text-neutral-600">Conectando…</p>
        )}
        {deviceState === 'registered' && <p className="mt-2 text-sm text-green-800">Cliente registrado.</p>}
        {deviceState === 'error' && <p className="mt-2 text-sm text-red-800">{deviceDetail}</p>}
        <button
          type="button"
          onClick={connectTwilio}
          disabled={micState !== 'granted' || deviceState === 'loading-token' || deviceState === 'registering' || deviceState === 'registered'}
          className="mt-3 w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {deviceState === 'registered' ? 'Conectado' : 'Conectar con Twilio'}
        </button>
      </section>

      {deviceState === 'registered' && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">3. Teclado</h2>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-center text-2xl tracking-widest text-neutral-900">
            {digits || <span className="text-neutral-400">—</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {dialKeys.map(({ d, l }) => (
              <button
                key={d}
                type="button"
                onClick={() => setDigits((prev) => prev + d)}
                className="flex h-14 flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white text-lg font-medium hover:bg-neutral-50"
              >
                <span>{d}</span>
                {l ? <span className="text-[10px] text-neutral-500">{l}</span> : null}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDigits((prev) => prev.slice(0, -1))}
              className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => setDigits('')}
              className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Limpiar
            </button>
          </div>
          <button
            type="button"
            onClick={placeCall}
            disabled={!digits.trim() || !!inCallUi}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            Llamar
          </button>
        </section>
      )}

      {incoming && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Llamada entrante</p>
          <p className="mt-1 text-xs text-amber-800">Desde: {incoming.parameters?.From ?? '—'}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={answer}
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white"
            >
              Descolgar
            </button>
            <button
              type="button"
              onClick={() => {
                incoming.reject();
                setIncoming(null);
              }}
              className="flex-1 rounded-lg bg-neutral-200 py-2 text-sm font-semibold text-neutral-900"
            >
              Rechazar
            </button>
          </div>
        </section>
      )}

      {active && (
        <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-sm font-medium text-sky-950">En llamada</p>
          <p className="mt-1 text-xs text-sky-900">Estado: {String(active.status())}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white"
            >
              {muted ? 'Quitar silencio' : 'Mute'}
            </button>
            <button type="button" onClick={hangup} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">
              Colgar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
