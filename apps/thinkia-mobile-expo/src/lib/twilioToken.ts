import { getResolvedNextApiBase, isNextApiBaseConfigured } from './env';

export function getApiBase(): string {
  return getResolvedNextApiBase();
}

export { isNextApiBaseConfigured };

/** POST /api/token/mobile — cuerpo texto plano con el JWT Twilio. */
export async function fetchTwilioAccessToken(supabaseAccessToken: string): Promise<string> {
  const API_BASE = getResolvedNextApiBase();
  const res = await fetch(`${API_BASE}/api/token/mobile`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${supabaseAccessToken}` },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(body.slice(0, 500) || `HTTP ${res.status}`);
  }
  return body.trim();
}
