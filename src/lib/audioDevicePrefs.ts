export type AudioDevicePrefs = {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
};

const LS_INPUT = 'thinkia.audio.inputDeviceId';
const LS_OUTPUT = 'thinkia.audio.outputDeviceId';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (!value) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getAudioDevicePrefs(): AudioDevicePrefs {
  return {
    inputDeviceId: safeGet(LS_INPUT),
    outputDeviceId: safeGet(LS_OUTPUT),
  };
}

export function setAudioInputDeviceId(deviceId: string | null) {
  safeSet(LS_INPUT, deviceId);
}

export function setAudioOutputDeviceId(deviceId: string | null) {
  safeSet(LS_OUTPUT, deviceId);
}

export async function listAudioDevices(): Promise<{
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
}> {
  const list = await navigator.mediaDevices.enumerateDevices();
  const inputs = list.filter((d) => d.kind === 'audioinput');
  const outputs = list.filter((d) => d.kind === 'audiooutput');
  return { inputs, outputs };
}

export async function ensureAudioDeviceLabels(): Promise<void> {
  // Sin permiso, enumerateDevices suele devolver labels vacíos.
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
}

type SinkIdElement = HTMLMediaElement & { setSinkId?: (sinkId: string) => Promise<void> };

export async function applyAudioOutputDeviceToPage(outputDeviceId: string | null): Promise<number> {
  if (!outputDeviceId) return 0;
  const nodes = Array.from(document.querySelectorAll('audio')) as SinkIdElement[];
  let applied = 0;
  await Promise.all(
    nodes.map(async (el) => {
      if (typeof el.setSinkId !== 'function') return;
      try {
        await el.setSinkId(outputDeviceId);
        applied += 1;
      } catch {
        /* ignore */
      }
    })
  );
  return applied;
}

export function createGetUserMediaWithPreferredInput(getInputId: () => string | null) {
  return async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
    const inputId = getInputId();
    if (!inputId) return navigator.mediaDevices.getUserMedia(constraints);

    const next: MediaStreamConstraints = { ...constraints };
    const audio = next.audio;
    if (audio == null || audio === true) {
      next.audio = { deviceId: { exact: inputId } };
      return navigator.mediaDevices.getUserMedia(next);
    }
    if (typeof audio === 'object') {
      // Respetar si el caller ya fijó deviceId.
      const a = audio as MediaTrackConstraints;
      if (a.deviceId == null) {
        next.audio = { ...a, deviceId: { exact: inputId } };
      }
      return navigator.mediaDevices.getUserMedia(next);
    }
    return navigator.mediaDevices.getUserMedia(constraints);
  };
}

