import twilio from 'twilio';
import { twilioClientIdentityFromUserId } from '@/lib/twilio-identity';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

/** JWT de acceso Twilio Voice para un `auth.users.id` ya validado. */
export function mintTwilioVoiceJwt(userId: string): { jwt: string } | { error: string; status: number } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const outgoingApplicationSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !outgoingApplicationSid) {
    return {
      error:
        'Faltan variables Twilio (TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID).',
      status: 500,
    };
  }

  const identity = twilioClientIdentityFromUserId(userId);
  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: 3600,
  });
  token.addGrant(
    new VoiceGrant({
      incomingAllow: true,
      outgoingApplicationSid,
    })
  );
  return { jwt: token.toJwt() };
}
