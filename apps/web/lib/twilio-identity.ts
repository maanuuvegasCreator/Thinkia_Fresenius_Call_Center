/**
 * Identidad estable Twilio Client derivada del user_id de Supabase (AICONCTATC-87).
 * Formato: `u` + UUID sin guiones (solo hex, válido para Twilio Client).
 */
export function twilioClientIdentityFromUserId(userId: string): string {
  return `u${userId.replace(/-/g, '')}`;
}

/** Inverso de `twilioClientIdentityFromUserId` para `From`/`To` tipo `client:u…`. */
export function userIdFromTwilioClientIdentity(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.startsWith('client:') ? value.slice('client:'.length) : value;
  if (!raw.startsWith('u') || raw.length !== 33) return null;
  const hex = raw.slice(1).toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
