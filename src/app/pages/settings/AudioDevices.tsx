import { useEffect, useMemo, useState } from 'react';
import { Headphones, Mic, RotateCcw, Volume2 } from 'lucide-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  applyAudioOutputDeviceToPage,
  ensureAudioDeviceLabels,
  getAudioDevicePrefs,
  listAudioDevices,
  setAudioInputDeviceId,
  setAudioOutputDeviceId,
} from '@/lib/audioDevicePrefs';

type DeviceChoice = { id: string; label: string };

function deviceLabel(d: MediaDeviceInfo, fallback: string) {
  const l = (d.label ?? '').trim();
  return l || fallback;
}

export function AudioDevices() {
  const [inputs, setInputs] = useState<DeviceChoice[]>([]);
  const [outputs, setOutputs] = useState<DeviceChoice[]>([]);
  const [prefs, setPrefs] = useState(() => getAudioDevicePrefs());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedInput = prefs.inputDeviceId ?? '__default__';
  const selectedOutput = prefs.outputDeviceId ?? '__default__';

  const outputSupported = useMemo(() => {
    const anyAudio = document.createElement('audio') as HTMLMediaElement & { setSinkId?: unknown };
    return typeof (anyAudio as any).setSinkId === 'function';
  }, []);

  const refresh = async () => {
    setBusy(true);
    setNotice(null);
    try {
      try {
        await ensureAudioDeviceLabels();
      } catch {
        // sin permiso: seguiremos pero con labels vacíos
      }
      const { inputs: ins, outputs: outs } = await listAudioDevices();
      setInputs(
        ins.map((d, idx) => ({
          id: d.deviceId,
          label: deviceLabel(d, `Micrófono ${idx + 1}`),
        }))
      );
      setOutputs(
        outs.map((d, idx) => ({
          id: d.deviceId,
          label: deviceLabel(d, `Salida ${idx + 1}`),
        }))
      );
      setPrefs(getAudioDevicePrefs());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No se pudo enumerar dispositivos');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const playTest = async () => {
    setNotice(null);
    try {
      const a = new Audio(
        // beep corto (data URI) – evita assets externos
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
      ) as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
      if (prefs.outputDeviceId && typeof a.setSinkId === 'function') {
        await a.setSinkId(prefs.outputDeviceId);
      }
      await a.play();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No se pudo reproducir la prueba');
    }
  };

  return (
    <SettingsLayout>
      <div className="h-full flex flex-col bg-white">
        <div className="border-b px-8 py-6">
          <h1 className="text-2xl font-semibold text-slate-900">Dispositivos de audio</h1>
          <p className="text-sm text-slate-600 mt-2">
            Elige el micrófono y la salida de audio para el softphone (aplica al portal y al .exe).
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl space-y-6">
            {notice ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {notice}
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-slate-700" />
                  <h2 className="font-semibold text-slate-900">Entrada (micrófono)</h2>
                </div>
                <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Micrófono</Label>
                <Select
                  value={selectedInput}
                  onValueChange={(v) => {
                    const next = v === '__default__' ? null : v;
                    setAudioInputDeviceId(next);
                    setPrefs(getAudioDevicePrefs());
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona micrófono" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Predeterminado del sistema</SelectItem>
                    {inputs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Si los nombres salen vacíos, concede permisos de micrófono y pulsa “Actualizar”.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-slate-700" />
                  <h2 className="font-semibold text-slate-900">Salida (altavoces/auriculares)</h2>
                </div>
                <Button variant="outline" size="sm" onClick={() => void playTest()} disabled={busy}>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Probar
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Salida</Label>
                <Select
                  value={selectedOutput}
                  onValueChange={(v) => {
                    const next = v === '__default__' ? null : v;
                    setAudioOutputDeviceId(next);
                    setPrefs(getAudioDevicePrefs());
                    void applyAudioOutputDeviceToPage(next);
                  }}
                  disabled={!outputSupported}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona salida" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Predeterminado del sistema</SelectItem>
                    {outputs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!outputSupported ? (
                  <p className="text-xs text-slate-500">
                    Tu entorno no soporta cambiar la salida desde la app (falta `setSinkId`). Usa el dispositivo
                    predeterminado de Windows.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    En algunas llamadas, el cambio puede requerir iniciar una llamada nueva para aplicar al audio remoto.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}

