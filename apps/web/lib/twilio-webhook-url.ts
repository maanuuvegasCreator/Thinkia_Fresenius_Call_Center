/**
 * URL pública absoluta para callbacks Twilio (TwiML statusCallback).
 * Prioridad: NEXT_PUBLIC_APP_URL → https://VERCEL_URL
 */
export function publicAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//i, '')}`;
  return '';
}

export function publicVoiceStatusCallbackUrl(): string | undefined {
  const base = publicAppBaseUrl();
  if (!base) return undefined;
  return `${base}/api/twilio/voice-status`;
}
