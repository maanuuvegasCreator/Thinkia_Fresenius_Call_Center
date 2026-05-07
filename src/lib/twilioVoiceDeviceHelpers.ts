import type { Device } from '@twilio/voice-sdk';

/**
 * JWT mint server-side ~3600s; emitir tokenWillExpire con margen cómodo (red / UI).
 * @see https://www.twilio.com/docs/voice/sdks/javascript/twiliodevice
 */
export const TWILIO_VOICE_TOKEN_REFRESH_MARGIN_MS = 180_000;

/** Backup si el evento del SDK falla ( suspensión de pestaña, reloj, etc.). */
const BACKUP_REFRESH_INTERVAL_MS = 45 * 60 * 1000;

const RETRY_DELAYS_MS = [400, 1_200, 2_800] as const;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function isTwilioVoiceTokenExpiredError(err: unknown): boolean {
  const t = err as { code?: number; message?: string; name?: string };
  if (t.code === 20104 || t.code === 31205) return true;
  if (t.name === 'AccessTokenExpired') return true;
  const msg =
    typeof t.message === 'string'
      ? t.message
      : err instanceof Error
        ? err.message
        : String(err);
  return (
    /AccessTokenExpired|JWTTokenExpired|token has expired/i.test(msg) ||
    msg.includes('20104') ||
    msg.includes('31205')
  );
}

export async function fetchTwilioVoiceToken(signal?: AbortSignal): Promise<string> {
  const res = await fetch('/api/token', {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
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

function isNonRetryableTokenError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /HTTP 401\b|HTTP 403\b|JWTTokenExpirationTooLong|NoValidAccount/i.test(msg);
}

export async function fetchTwilioVoiceTokenWithRetry(signal?: AbortSignal): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await fetchTwilioVoiceToken(signal);
    } catch (e) {
      last = e;
      if (signal?.aborted) throw e;
      if (isNonRetryableTokenError(e)) throw e;
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt], signal);
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export type TwilioVoiceRefreshControllerOptions = {
  isActive: () => boolean;
  onRefreshFailed: (error: unknown) => void;
  onRefreshed?: () => void;
};

/**
 * Refresco single-flight, reintentos al pedir JWT, evento tokenWillExpire + intervalo de respaldo.
 * Usar handleExpiredDeviceError dentro del único `device.on('error', …)` del componente.
 */
export function createTwilioVoiceRefreshController(
  device: Device,
  options: TwilioVoiceRefreshControllerOptions
): {
  refresh: () => Promise<void>;
  detach: () => void;
  handleExpiredDeviceError: (err: unknown) => boolean;
} {
  let inflight: Promise<void> | null = null;
  let backupTimer: ReturnType<typeof setInterval> | null = null;

  const runRefresh = async (): Promise<void> => {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const jwt = await fetchTwilioVoiceTokenWithRetry();
        if (!options.isActive()) return;
        await device.updateToken(jwt);
        if (options.isActive()) options.onRefreshed?.();
      } catch (e) {
        if (options.isActive()) options.onRefreshFailed(e);
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };

  const onWillExpire = () => {
    void runRefresh();
  };

  device.on('tokenWillExpire', onWillExpire);

  backupTimer = setInterval(() => {
    void runRefresh();
  }, BACKUP_REFRESH_INTERVAL_MS);

  const detach = () => {
    device.removeListener('tokenWillExpire', onWillExpire);
    if (backupTimer !== null) {
      clearInterval(backupTimer);
      backupTimer = null;
    }
  };

  const handleExpiredDeviceError = (err: unknown): boolean => {
    if (!isTwilioVoiceTokenExpiredError(err)) return false;
    void runRefresh();
    return true;
  };

  return { refresh: runRefresh, detach, handleExpiredDeviceError };
}
