/**
 * Identidad estable Twilio Client derivada del user_id de Supabase (AICONCTATC-87).
 * Formato: `u` + UUID sin guiones (solo hex, válido para Twilio Client).
 */
export function twilioClientIdentityFromUserId(userId: string): string {
  return `u${userId.replace(/-/g, '')}`;
}
